// Mock service: the "server" of the specs. Every write goes through one of these functions,
// which update all related records in one atomic commit (chapters 09 and 10).
import type { Course, DB, Enrollment, Lesson, Offering, Result, Role, StudentLevel, TeacherProfile, Format, Level } from '../data/schema';
import { commit, getState, uid, resetStore } from '../data/store';
import { DEMO_START, addDays, now, nextMonday, nextOccurrence, fmtMonthDay, fmtDate, fmtTime, fmtDateTime, WEEKDAYS, fmtHM, toMinutes } from '../data/clock';
import { FEE_RATE, MIN_PRICE_PER_LESSON_CENTS, feeCents, fmt, releaseSchedule, coursePriceCents } from '../data/money';
import * as sel from '../data/selectors';
import { latency, toast, wait } from '../data/ui';

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: string, message: string): Result<never> => ({ ok: false, code, message });
const OFFLINE = fail('offline', 'You are offline. This needs a connection; nothing was changed.');

function notify(db: DB, userId: string, role: Role, type: string, title: string, body: string, targetRoute: string, lessonId?: string) {
  db.notifications.push({ id: uid('ntf'), userId, role, type, title, body, targetRoute, createdAt: now(), lessonId });
  const s = db.session && db.users.find((u) => u.id === db.session!.userId);
  if (s && s.id === userId && s.activeRole === role) window.setTimeout(() => toast(title, { icon: 'info' }), 0);
}

/* =================== Auth and roles =================== */

export async function createAccount(input: { name: string; email: string; password: string; dateOfBirth: string }): Promise<Result<string>> {
  await latency();
  const email = input.email.trim().toLowerCase();
  if (getState().users.some((u) => u.email.toLowerCase() === email)) return fail('email_in_use', 'This email already has an account.');
  const id = uid('usr');
  commit((db) => {
    db.users.push({
      id,
      name: input.name.trim(),
      email,
      dateOfBirth: input.dateOfBirth,
      password: input.password,
      authProvider: 'email',
      roles: [],
      activeRole: null,
      lastRouteByRole: {},
      createdAt: now(),
    });
    db.session = { userId: id, expiresAt: now() + 30 * 86400000 };
  });
  return ok(id);
}

export async function signIn(email: string, password: string): Promise<Result<string>> {
  await latency();
  const u = getState().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
  if (!u) return fail('bad_credentials', 'Email or password is incorrect');
  commit((db) => {
    db.session = { userId: u.id, expiresAt: now() + 30 * 86400000 };
  });
  return ok(u.id);
}

/** Simulated Sign in with Apple: finds the Apple demo user, or creates it (about 600 ms). */
export async function signInWithApple(): Promise<Result<{ id: string; isNew: boolean }>> {
  await wait(600);
  const existing = getState().users.find((u) => u.authProvider === 'apple');
  const id = existing?.id ?? uid('usr');
  commit((db) => {
    if (!existing) {
      db.users.push({
        id,
        name: 'Sam Taylor',
        email: 'sam.taylor@privaterelay.example',
        dateOfBirth: '1999-08-21',
        password: '',
        authProvider: 'apple',
        roles: [],
        activeRole: null,
        lastRouteByRole: {},
        createdAt: now(),
      });
    }
    db.session = { userId: id, expiresAt: now() + 30 * 86400000 };
  });
  return ok({ id, isNew: !existing || existing.roles.length === 0 });
}

export function signOut() {
  commit((db) => {
    db.session = null;
  });
}

/** Sign in as any seeded user (developer panel). */
export function devSignInAs(userId: string) {
  commit((db) => {
    db.session = { userId, expiresAt: now() + 30 * 86400000 };
  });
}

function ensureRoleProfile(db: DB, userId: string, role: Role) {
  if (role === 'student' && !db.studentProfiles.some((p) => p.userId === userId)) {
    db.studentProfiles.push({
      userId,
      instruments: [],
      genres: [],
      level: 'never',
      format: 'either',
      recentSearches: [],
      savedTeacherIds: [],
      onboardingComplete: false,
    });
  }
  if (role === 'teacher' && !db.teacherProfiles.some((p) => p.userId === userId)) {
    db.teacherProfiles.push({
      userId,
      instruments: [],
      levels: [],
      formats: 'either',
      city: 'Austin, TX',
      timeZone: 'America/Chicago',
      idStatus: 'not_started',
      backgroundCheck: 'not_started',
      setupStep: 1,
      setupComplete: false,
      lessonsTaughtBefore: 0,
    });
  }
}

/** A03 Continue and A07 Add role: add the role, make it active, create its profile. */
export function chooseRole(userId: string, role: Role) {
  commit((db) => {
    const u = db.users.find((x) => x.id === userId)!;
    if (!u.roles.includes(role)) u.roles.push(role);
    u.activeRole = role;
    ensureRoleProfile(db, userId, role);
  });
}

export function switchRole(userId: string, role: Role) {
  commit((db) => {
    const u = db.users.find((x) => x.id === userId)!;
    if (u.roles.includes(role)) u.activeRole = role;
  });
}

export function setLastRoute(userId: string, role: Role, route: string) {
  const u = sel.user(getState(), userId);
  if (!u || u.lastRouteByRole[role] === route) return;
  commit((db) => {
    const x = db.users.find((y) => y.id === userId);
    if (x) x.lastRouteByRole[role] = route;
  });
}

/* =================== Student preferences =================== */

export function saveInterests(userId: string, instruments: string[], genres: string[]) {
  commit((db) => {
    const p = db.studentProfiles.find((x) => x.userId === userId)!;
    p.instruments = instruments;
    p.genres = genres;
  });
}

export function saveLevelFormat(userId: string, level: StudentLevel, format: Format, approxArea?: string) {
  commit((db) => {
    const p = db.studentProfiles.find((x) => x.userId === userId)!;
    p.level = level;
    p.format = format;
    p.approxArea = approxArea;
    p.onboardingComplete = true;
  });
}

export function saveRecentSearch(userId: string, q: string, query: string, label: string) {
  commit((db) => {
    const p = db.studentProfiles.find((x) => x.userId === userId);
    if (!p) return;
    p.recentSearches = [{ q, query, label }, ...p.recentSearches.filter((r) => r.query !== query)].slice(0, 5);
  });
}

export function toggleSaveTeacher(userId: string, teacherId: string): boolean {
  let saved = false;
  commit((db) => {
    const p = db.studentProfiles.find((x) => x.userId === userId);
    if (!p) return;
    saved = !p.savedTeacherIds.includes(teacherId);
    p.savedTeacherIds = saved ? [...p.savedTeacherIds, teacherId] : p.savedTeacherIds.filter((t) => t !== teacherId);
  });
  return saved;
}

/* =================== Teacher setup (T01 to T05) =================== */

export function saveTeacherStep(userId: string, step: number, patch: Partial<TeacherProfile>) {
  commit((db) => {
    const p = db.teacherProfiles.find((x) => x.userId === userId)!;
    Object.assign(p, patch);
    p.setupStep = Math.max(p.setupStep, step + 1);
  });
}

export function finishTeacherSetup(userId: string) {
  commit((db) => {
    const p = db.teacherProfiles.find((x) => x.userId === userId)!;
    p.setupComplete = true;
    p.setupStep = 5;
  });
}

const idTimers = new Map<string, number>();
/** Simulated photo ID check: pending, then passed after 5 seconds (or from the developer panel). */
export function startIdCheck(userId: string) {
  commit((db) => {
    const p = db.teacherProfiles.find((x) => x.userId === userId)!;
    p.idStatus = 'pending';
    p.idCheckStartedAt = now();
  });
  window.clearTimeout(idTimers.get(userId));
  idTimers.set(userId, window.setTimeout(() => passIdCheck(userId), 5000));
}

export function passIdCheck(userId: string) {
  const p = sel.teacherProfile(getState(), userId);
  if (!p || p.idStatus === 'passed') return;
  commit((db) => {
    const tp = db.teacherProfiles.find((x) => x.userId === userId)!;
    tp.idStatus = 'passed';
    notify(db, userId, 'teacher', 'id_passed', 'ID check passed', 'You can publish your courses now.', '/t/offerings');
  });
}

export function addBankAccount(userId: string) {
  commit((db) => {
    const p = db.teacherProfiles.find((x) => x.userId === userId)!;
    p.bankAccount = { label: 'Chase checking', last4: '0932' };
  });
}

/* =================== Availability =================== */

export interface WindowInput {
  weekday: number;
  start: string;
  end: string;
}

export function validateWindows(windows: WindowInput[]): string | null {
  if (!windows.length) return 'Add at least one weekly window.';
  for (const w of windows) {
    if (toMinutes(w.end) <= toMinutes(w.start)) return `${WEEKDAYS[w.weekday]}: the window ends before it starts.`;
    if (toMinutes(w.start) % 15 || toMinutes(w.end) % 15) return 'Times move in 15-minute steps.';
  }
  return null;
}

export function saveAvailability(teacherId: string, windows: WindowInput[]): Result<null> {
  const err = validateWindows(windows);
  if (err) return fail('invalid', err);
  commit((db) => {
    db.availability = db.availability.filter((a) => a.teacherId !== teacherId);
    for (const w of windows) db.availability.push({ id: uid('av'), teacherId, ...w, timeZone: 'America/Chicago' });
    releaseOpenTimeAlerts(db, teacherId);
  });
  return ok(null);
}

/** When a weekly time frees up, students who asked to be notified get one A05 notification. */
function releaseOpenTimeAlerts(db: DB, teacherId: string) {
  const t = now();
  db.openTimeAlerts = db.openTimeAlerts.filter((a) => {
    const off = db.offerings.find((o) => o.id === a.offeringId);
    if (!off || off.teacherId !== teacherId) return true;
    if (sel.openCount(db, off, t) === 0) return true;
    notify(db, a.studentUserId, 'student', 'open_time', 'A weekly time opened', `${off.title} has a weekly time open again. It is not held for you.`, `/s/course/${off.id}`);
    return false;
  });
}

/* =================== Course builder (T07 to T11) =================== */

export interface DraftInput {
  offering: Partial<Offering>;
  course?: Partial<Course>;
  step: number; // the step to open next
}

export async function saveCourseDraft(teacherId: string, offeringId: string | null, input: DraftInput): Promise<Result<string>> {
  await wait(350);
  const id = offeringId ?? uid('off');
  commit((db) => {
    let off = db.offerings.find((o) => o.id === id);
    if (!off) {
      off = {
        id,
        teacherId,
        type: 'course',
        title: '',
        description: '',
        instrument: '',
        level: 'beginner',
        format: sel.teacherProfile(db, teacherId)?.formats ?? 'either',
        pricePerLessonCents: 0,
        lessonCount: 8,
        lessonMinutes: 45,
        capacity: 6,
        status: 'draft',
        draftStep: 1,
        createdAt: now(),
      };
      db.offerings.push(off);
      db.courses.push({ offeringId: id, outcomes: [], curriculum: [] });
    }
    if (off.status === 'published') return; // published offerings are read-only here (T10 read-only)
    Object.assign(off, input.offering);
    off.draftStep = Math.max(off.draftStep, input.step);
    if (input.course) {
      const c = db.courses.find((x) => x.offeringId === id)!;
      Object.assign(c, input.course);
      if (input.course.curriculum) {
        off.lessonCount = input.course.curriculum.length;
        c.outcomes = sel.skillsOf(c);
      }
    }
  });
  return ok(id);
}

export function readiness(db: DB, off: Offering) {
  const c = sel.course(db, off.id);
  const tp = sel.teacherProfile(db, off.teacherId);
  const t = now();
  const curriculumOk = !!c && c.curriculum.length >= 1 && c.curriculum.length <= 24 && c.curriculum.every((x) => x.title.trim() && x.milestone.trim());
  return [
    { key: 'basics', label: 'Title, level and description', ok: off.title.trim().length >= 4 && off.title.trim().length <= 60 && !!off.description.trim(), step: 'basics' },
    { key: 'curriculum', label: `${c?.curriculum.length ?? 0} lessons with objectives`, ok: curriculumOk, step: 'curriculum' },
    { key: 'price', label: 'Price and payout set', ok: off.pricePerLessonCents >= MIN_PRICE_PER_LESSON_CENTS, step: 'price' },
    { key: 'id', label: tp?.idStatus === 'passed' ? 'ID check passed' : tp?.idStatus === 'pending' ? 'ID check in review' : 'ID check not started', ok: tp?.idStatus === 'passed', step: 'id' },
    { key: 'schedule', label: 'Schedule has no conflicts', ok: sel.openCount(db, off, t) > 0, step: 'availability' },
    { key: 'policy', label: 'Cancellation policy', ok: true, step: 'preview' },
  ];
}

export async function publishCourse(offeringId: string): Promise<Result<null>> {
  if (getState().dev.offline) return OFFLINE;
  await latency();
  const db0 = getState();
  const off = sel.offering(db0, offeringId);
  if (!off) return fail('missing', 'That course no longer exists.');
  if (readiness(db0, off).some((r) => !r.ok)) return fail('not_ready', 'Some checklist items still need attention.');
  commit((db) => {
    const o = db.offerings.find((x) => x.id === offeringId)!;
    o.status = 'published';
    o.publishedAt = now();
  });
  return ok(null);
}

/* =================== Booking and payment (S10 to S14) =================== */

export async function holdSlot(input: { studentUserId: string; offeringId: string; weekday: number; time: string; format: 'online' | 'in_person' }): Promise<Result<string>> {
  const db0 = getState();
  if (db0.dev.offline) return OFFLINE;
  await wait(400);
  const db1 = getState();
  const off = sel.offering(db1, input.offeringId);
  if (!off || off.status !== 'published') return fail('missing', 'This course is not available.');
  const t = now();
  const slot = sel.slotsFor(db1, off, t, input.studentUserId).find((s) => s.weekday === input.weekday && s.time === input.time);
  if (!slot || slot.status !== 'open') return fail('slot_taken', `${fmtHM(input.time)} was just booked by another student. Pick another time.`);
  const id = uid('bkg');
  commit((db) => {
    // One hold per student and offering.
    for (const b of db.bookings) {
      if (b.studentUserId === input.studentUserId && b.offeringId === input.offeringId && b.status === 'held') {
        b.status = 'cancelled';
        db.payments = db.payments.filter((p) => !(p.bookingId === b.id && p.status === 'pending'));
      }
    }
    db.bookings.push({
      id,
      studentUserId: input.studentUserId,
      payerUserId: input.studentUserId,
      offeringId: off.id,
      teacherId: off.teacherId,
      weekday: input.weekday,
      startTime: input.time,
      startDate: nextOccurrence(t, input.weekday, input.time),
      format: input.format,
      status: 'held',
      holdExpiresAt: t + 10 * 60000,
      createdAt: t,
    });
    db.payments.push({ id: uid('pay'), bookingId: id, amountCents: coursePriceCents(off.pricePerLessonCents, off.lessonCount), method: 'apple_pay_sim', status: 'pending', refundedCents: 0 });
  });
  return ok(id);
}

/** S12 Cancel: payment discarded and hold released; no error is shown. */
export function cancelHold(bookingId: string) {
  commit((db) => {
    const b = db.bookings.find((x) => x.id === bookingId);
    if (b && b.status === 'held') b.status = 'cancelled';
    db.payments = db.payments.filter((p) => !(p.bookingId === bookingId && p.status === 'pending'));
  });
}

export function expireHolds() {
  const t = now();
  const db0 = getState();
  if (!db0.bookings.some((b) => b.status === 'held' && b.holdExpiresAt <= t)) return;
  commit((db) => {
    for (const b of db.bookings) {
      if (b.status === 'held' && b.holdExpiresAt <= t) {
        b.status = 'expired';
        for (const p of db.payments) if (p.bookingId === b.id && p.status === 'pending') Object.assign(p, { status: 'failed', failureReason: 'hold_expired' });
      }
    }
  });
}

export async function confirmPayment(bookingId: string, method: 'apple_pay_sim' | 'card_sim'): Promise<Result<string>> {
  if (getState().dev.offline) return OFFLINE;
  await wait(1000);
  const db0 = getState();
  const b = db0.bookings.find((x) => x.id === bookingId);
  const t = now();
  if (!b || b.status !== 'held' || b.holdExpiresAt <= t) return fail('hold_expired', 'Your hold ended. Pick a time again.');
  if (db0.dev.declineNextPayment) {
    commit((db) => {
      db.dev.declineNextPayment = false;
      const p = db.payments.filter((x) => x.bookingId === bookingId).pop();
      if (p) Object.assign(p, { status: 'failed', failureReason: 'card_declined', method });
    });
    return fail('declined', 'Your card was declined. You were not charged.');
  }
  const enrollmentId = uid('enr');
  commit((db) => {
    const bk = db.bookings.find((x) => x.id === bookingId)!;
    const off = db.offerings.find((o) => o.id === bk.offeringId)!;
    const student = db.users.find((u) => u.id === bk.studentUserId)!;
    const teacher = db.users.find((u) => u.id === bk.teacherId)!;
    const gross = coursePriceCents(off.pricePerLessonCents, off.lessonCount);
    let p = db.payments.filter((x) => x.bookingId === bookingId).pop();
    if (!p || p.status === 'failed') {
      // Retry after a decline creates a new attempt on the same hold.
      p = { id: uid('pay'), bookingId, amountCents: gross, method, status: 'pending', refundedCents: 0 };
      db.payments.push(p);
    }
    Object.assign(p, { status: 'succeeded', method, paidAt: now(), amountCents: gross });
    bk.status = 'confirmed';
    db.enrollments.push({
      id: enrollmentId,
      bookingId,
      studentUserId: bk.studentUserId,
      teacherId: bk.teacherId,
      offeringId: off.id,
      status: 'active',
      startedAt: now(),
      weekday: bk.weekday,
      startTime: bk.startTime,
      format: bk.format,
    });
    const net = gross - feeCents(gross, FEE_RATE);
    const releases = releaseSchedule(net, off.lessonCount);
    const c = db.courses.find((x) => x.offeringId === off.id);
    for (let i = 0; i < off.lessonCount; i++) {
      const lessonId = uid('les');
      const item = c?.curriculum.find((x) => x.index === i + 1);
      db.lessons.push({
        id: lessonId,
        enrollmentId,
        index: i + 1,
        scheduledAt: addDays(bk.startDate, 7 * i),
        durationMin: off.lessonMinutes,
        status: 'scheduled',
        materials: item && i === 0 && /guitar/i.test(off.instrument) ? [{ title: 'Open chord chart (G, C, D)', kind: 'PDF', detail: '1 page' }] : [],
      });
      db.transactions.push({
        id: uid('txn'),
        teacherId: bk.teacherId,
        enrollmentId,
        lessonId,
        grossCents: off.pricePerLessonCents,
        feeCents: off.pricePerLessonCents - releases[i],
        netCents: releases[i],
        state: 'pending',
        updatedAt: now(),
      });
    }
    sel.skillsOf(c).forEach((_, idx) => db.progress.push({ id: uid('prg'), enrollmentId, milestoneIndex: idx, state: 'upcoming' }));
    let thread = db.threads.find((th) => th.studentUserId === bk.studentUserId && th.teacherId === bk.teacherId);
    if (!thread) {
      thread = { id: uid('thr'), studentUserId: bk.studentUserId, teacherId: bk.teacherId };
      db.threads.push(thread);
    }
    thread.enrollmentId = enrollmentId;
    const when = `${WEEKDAYS[bk.weekday]}s at ${fmtHM(bk.startTime)}`;
    notify(db, bk.teacherId, 'teacher', 'new_booking', 'New booking', `${student.name} booked ${off.title} · ${when}, ${bk.format === 'online' ? 'online' : 'in person'}, starting ${fmtMonthDay(bk.startDate)}. Paid ${fmt(gross)}.`, `/t/students/${student.id}`);
    notify(db, bk.studentUserId, 'student', 'booked', 'You are booked', `${off.title}, ${when}. Receipt sent.`, `/s/learning/${enrollmentId}`);
    void teacher;
  });
  return ok(enrollmentId);
}

export function refundPreview(db: DB, enrollmentId: string, by: 'student' | 'teacher' | 'account_deleted') {
  const enr = sel.enrollment(db, enrollmentId);
  const off = sel.offering(db, enr?.offeringId);
  const ls = enr ? sel.lessonsOf(db, enr.id) : [];
  const t = now();
  const scheduled = ls.filter((l) => l.status === 'scheduled');
  const refundable = scheduled.filter((l) => by !== 'student' || l.scheduledAt - t > 24 * 3600000);
  const txns = db.transactions.filter((x) => refundable.some((l) => l.id === x.lessonId));
  return {
    taught: ls.filter((l) => l.status === 'taught').length,
    total: ls.length,
    refundable,
    refundCents: (off?.pricePerLessonCents ?? 0) * refundable.length,
    teacherLosesCents: txns.reduce((s, x) => s + x.netCents, 0),
    nextLesson: scheduled[0],
  };
}

function cancelEnrollmentIn(db: DB, enrollmentId: string, by: 'student' | 'teacher' | 'account_deleted', reason?: string) {
  const enr = db.enrollments.find((e) => e.id === enrollmentId);
  if (!enr || enr.status !== 'active') return 0;
  const preview = refundPreview(db, enrollmentId, by);
  const off = db.offerings.find((o) => o.id === enr.offeringId)!;
  const ids = new Set(preview.refundable.map((l) => l.id));
  for (const l of db.lessons) if (ids.has(l.id)) l.status = 'cancelled';
  for (const x of db.transactions) if (ids.has(x.lessonId)) Object.assign(x, { state: 'refunded', updatedAt: now() });
  const pay = db.payments.find((p) => p.bookingId === enr.bookingId && p.status !== 'failed' && p.status !== 'pending');
  if (pay) {
    pay.refundedCents += preview.refundCents;
    pay.status = pay.refundedCents >= pay.amountCents ? 'refunded' : 'partially_refunded';
  }
  Object.assign(enr, { status: 'cancelled', cancelledAt: now(), cancelledBy: by, cancelReason: reason, refundCents: preview.refundCents });
  const student = db.users.find((u) => u.id === enr.studentUserId);
  const teacher = db.users.find((u) => u.id === enr.teacherId);
  const n = preview.refundable.length;
  if (by === 'teacher') {
    notify(db, enr.studentUserId, 'student', 'cancelled', `${sel.firstName(teacher?.name ?? 'Your teacher')} cancelled your remaining lessons`, `${off.title}: ${n} untaught lesson${n === 1 ? '' : 's'} refunded, ${fmt(preview.refundCents)} back to your card in 3 to 5 business days.`, `/s/learning/${enr.id}`);
  } else {
    notify(db, enr.teacherId, 'teacher', 'cancelled', `${student?.name ?? 'A student'} cancelled ${off.title}`, `${n} untaught lesson${n === 1 ? '' : 's'} refunded. ${fmt(preview.teacherLosesCents)} removed from your pending balance.`, `/t/earnings/booking/${enr.id}`);
  }
  releaseOpenTimeAlerts(db, enr.teacherId);
  return preview.refundCents;
}

export async function cancelCourse(enrollmentId: string, by: 'student' | 'teacher', reason?: string): Promise<Result<number>> {
  if (getState().dev.offline) return OFFLINE;
  await latency();
  let refund = 0;
  commit((db) => {
    refund = cancelEnrollmentIn(db, enrollmentId, by, reason);
  });
  return ok(refund);
}

export function requestOpenTimeAlert(studentUserId: string, offeringId: string) {
  commit((db) => {
    if (!db.openTimeAlerts.some((a) => a.studentUserId === studentUserId && a.offeringId === offeringId))
      db.openTimeAlerts.push({ id: uid('ota'), studentUserId, offeringId, createdAt: now() });
  });
}

/* =================== Lessons and progress =================== */

export async function markLessonComplete(lessonId: string): Promise<Result<null>> {
  await latency();
  const l0 = sel.lesson(getState(), lessonId);
  if (!l0 || l0.status !== 'scheduled') return fail('invalid', 'This lesson cannot be marked complete.');
  if (now() < l0.scheduledAt) return fail('too_early', 'You can mark this lesson complete from its start time.');
  commit((db) => {
    const l = db.lessons.find((x) => x.id === lessonId)!;
    l.status = 'taught';
    l.taughtAt = now();
    l.attendance = l.attendance ?? 'attended';
    for (const x of db.transactions) if (x.lessonId === lessonId && x.state === 'pending') Object.assign(x, { state: 'available', updatedAt: now() });
    const enr = db.enrollments.find((e) => e.id === l.enrollmentId)!;
    const c = db.courses.find((x) => x.offeringId === enr.offeringId);
    const idx = sel.skillIndexForLesson(c, l.index);
    const rec = db.progress.find((p) => p.enrollmentId === enr.id && p.milestoneIndex === idx);
    if (rec && rec.state === 'upcoming') rec.state = 'practicing';
    const ls = db.lessons.filter((x) => x.enrollmentId === enr.id);
    if (enr.status === 'active' && ls.every((x) => x.status !== 'scheduled')) {
      enr.status = 'completed';
      const off = db.offerings.find((o) => o.id === enr.offeringId);
      notify(db, enr.studentUserId, 'student', 'completed', 'Course completed', `You finished ${off?.title}. Leave a review when you are ready.`, `/s/learning/${enr.id}`);
    }
  });
  return ok(null);
}

export function setAttendance(lessonId: string, attendance: Lesson['attendance']) {
  commit((db) => {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (l) l.attendance = attendance;
  });
}

export interface ProgressInput {
  confirm: number[]; // skill indexes to confirm
  note: string;
  assignment?: { id?: string; title: string; minutesPerDay?: number; daysPerWeek?: number };
}

export async function saveProgress(lessonId: string, input: ProgressInput): Promise<Result<null>> {
  if (getState().dev.offline) return OFFLINE;
  await latency();
  commit((db) => {
    const l = db.lessons.find((x) => x.id === lessonId)!;
    const enr = db.enrollments.find((e) => e.id === l.enrollmentId)!;
    const teacher = db.users.find((u) => u.id === enr.teacherId);
    for (const idx of input.confirm) {
      const rec = db.progress.find((p) => p.enrollmentId === enr.id && p.milestoneIndex === idx);
      if (rec && rec.state !== 'confirmed') Object.assign(rec, { state: 'confirmed', confirmedAt: now() });
    }
    if (input.note.trim()) {
      l.note = input.note.trim();
      l.noteAt = now();
    }
    const a = input.assignment;
    if (a && a.title.trim()) {
      const existing = a.id && db.assignments.find((x) => x.id === a.id);
      if (existing) Object.assign(existing, { title: a.title.trim(), minutesPerDay: a.minutesPerDay, daysPerWeek: a.daysPerWeek });
      else db.assignments.push({ id: uid('asg'), enrollmentId: enr.id, lessonId, title: a.title.trim(), minutesPerDay: a.minutesPerDay, daysPerWeek: a.daysPerWeek, createdAt: now() });
    }
    const c = db.courses.find((x) => x.offeringId === enr.offeringId);
    const skills = sel.skillsOf(c);
    const confirmedNames = input.confirm.map((i) => skills[i]).filter(Boolean);
    const body = [confirmedNames.length ? `Lesson ${l.index}: ${confirmedNames.join(', ').toLowerCase()} confirmed.` : `Lesson ${l.index} notes are ready.`, a?.title ? `Practice plan: ${a.title}.` : '']
      .filter(Boolean)
      .join(' ');
    notify(db, enr.studentUserId, 'student', 'progress', `New notes from ${sel.firstName(teacher?.name ?? 'your teacher')}`, body, `/s/learning/${enr.id}/lesson/${l.id}`, l.id);
  });
  return ok(null);
}

export async function logPractice(assignmentId: string, studentUserId: string, minutes: number, comment?: string): Promise<Result<null>> {
  if (minutes <= 0) return fail('invalid', 'Enter minutes practiced');
  await wait(300);
  commit((db) => {
    db.practiceLogs.push({ id: uid('plog'), assignmentId, studentUserId, minutes, comment: comment?.trim() || undefined, loggedAt: now() });
  });
  return ok(null);
}

export async function postReview(enrollmentId: string, rating: number, text?: string): Promise<Result<null>> {
  if (rating < 1 || rating > 5) return fail('invalid', 'Choose a star rating');
  await latency();
  commit((db) => {
    const enr = db.enrollments.find((e) => e.id === enrollmentId)!;
    const student = db.users.find((u) => u.id === enr.studentUserId)!;
    const off = db.offerings.find((o) => o.id === enr.offeringId)!;
    db.reviews = db.reviews.filter((r) => r.enrollmentId !== enrollmentId);
    db.reviews.push({
      id: uid('rev'),
      enrollmentId,
      studentUserId: student.id,
      studentFirstName: sel.shortName(student.name),
      teacherId: enr.teacherId,
      offeringTitle: off.title,
      rating,
      text: text?.trim() || undefined,
      createdAt: now(),
    });
    notify(db, enr.teacherId, 'teacher', 'review', `${sel.firstName(student.name)} left a ${rating}-star review`, text?.trim() ? `"${text.trim().slice(0, 90)}"` : off.title, `/t/students/${student.id}`);
  });
  return ok(null);
}

/* =================== Reschedule =================== */

export async function requestReschedule(lessonId: string, proposedAt: number, message: string): Promise<Result<null>> {
  if (getState().dev.offline) return OFFLINE;
  await latency();
  commit((db) => {
    const l = db.lessons.find((x) => x.id === lessonId)!;
    const enr = db.enrollments.find((e) => e.id === l.enrollmentId)!;
    const teacher = db.users.find((u) => u.id === enr.teacherId)!;
    const expiresAt = now() + 48 * 3600000;
    l.rescheduleRequest = { proposedAt, message, expiresAt, status: 'pending' };
    notify(
      db,
      enr.studentUserId,
      'student',
      'reschedule',
      `${sel.firstName(teacher.name)} asked to move Lesson ${l.index}`,
      `${fmtDateTime(l.scheduledAt)} to ${fmtDateTime(proposedAt)}. Answer by ${fmtDate(expiresAt)}, ${fmtTime(expiresAt)}.${message ? ` "${message}"` : ''}`,
      `/s/learning/${enr.id}`,
      l.id,
    );
  });
  return ok(null);
}

/** Accept takes effect after the 5-second undo window; this applies it. */
export function acceptReschedule(lessonId: string) {
  commit((db) => {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (!l?.rescheduleRequest || l.rescheduleRequest.status !== 'pending') return;
    const enr = db.enrollments.find((e) => e.id === l.enrollmentId)!;
    const student = db.users.find((u) => u.id === enr.studentUserId);
    l.scheduledAt = l.rescheduleRequest.proposedAt;
    l.rescheduleRequest.status = 'accepted';
    notify(db, enr.teacherId, 'teacher', 'reschedule_accepted', `${sel.firstName(student?.name ?? 'Your student')} accepted the new time`, `Lesson ${l.index} moved to ${fmtDateTime(l.scheduledAt)}.`, `/t/lesson/${l.id}`);
  });
}

/* =================== Messages, notifications, reports =================== */

export function getOrCreateThread(studentUserId: string, teacherId: string): string {
  const existing = getState().threads.find((t) => t.studentUserId === studentUserId && t.teacherId === teacherId);
  if (existing) return existing.id;
  const id = uid('thr');
  commit((db) => {
    db.threads.push({ id, studentUserId, teacherId });
  });
  return id;
}

export async function sendMessage(threadId: string, senderId: string, text: string): Promise<Result<null>> {
  const body = text.trim();
  if (!body) return fail('empty', 'A message cannot be empty');
  const offline = getState().dev.offline;
  await wait(250);
  commit((db) => {
    db.messages.push({ id: uid('msg'), threadId, senderId, text: body, sentAt: now(), failed: offline || undefined });
    if (offline) return;
    const th = db.threads.find((t) => t.id === threadId)!;
    const toTeacher = senderId === th.studentUserId;
    const sender = db.users.find((u) => u.id === senderId);
    notify(db, toTeacher ? th.teacherId : th.studentUserId, toTeacher ? 'teacher' : 'student', 'message', `Message from ${sender?.name ?? 'Scale'}`, body.slice(0, 120), `/messages/${threadId}`);
  });
  return offline ? OFFLINE : ok(null);
}

export function retryMessage(messageId: string): boolean {
  if (getState().dev.offline) return false;
  commit((db) => {
    const m = db.messages.find((x) => x.id === messageId);
    if (m) {
      delete m.failed;
      m.sentAt = now();
    }
  });
  return true;
}

export function markNotificationRead(id: string) {
  commit((db) => {
    const n = db.notifications.find((x) => x.id === id);
    if (n && !n.readAt) n.readAt = now();
  });
}

export function sendReport(reporterId: string, subjectUserId: string, category: string, details?: string) {
  commit((db) => {
    db.reports.push({ id: uid('rpt'), reporterId, subjectUserId, category, details: details?.trim() || undefined, createdAt: now() });
  });
}

export function saveDraft(key: string, value: unknown) {
  commit((db) => {
    if (value === undefined || value === '') delete db.drafts[key];
    else db.drafts[key] = value;
  });
}

/* =================== Earnings and payouts =================== */

export function runPayout(teacherId: string): Result<number> {
  const db0 = getState();
  const tp = sel.teacherProfile(db0, teacherId);
  const b = sel.balances(db0, teacherId);
  if (!tp?.bankAccount) return fail('no_bank', 'Add a bank account before the first payout.');
  if (b.available <= 0) return fail('nothing', 'Nothing is available to pay out.');
  const failNow = db0.dev.failNextPayout;
  commit((db) => {
    const txns = db.transactions.filter((x) => x.teacherId === teacherId && x.state === 'available');
    const po = { id: uid('po'), teacherId, amountCents: txns.reduce((s, x) => s + x.netCents, 0), scheduledFor: nextMonday(now()), status: (failNow ? 'failed' : 'paid') as 'failed' | 'paid', transactionIds: txns.map((x) => x.id), failureReason: failNow ? 'account_closed' : undefined };
    db.payouts.push(po);
    if (failNow) {
      db.dev.failNextPayout = false;
      const p = db.teacherProfiles.find((x) => x.userId === teacherId)!;
      if (p.bankAccount) p.bankAccount.closed = true;
      notify(db, teacherId, 'teacher', 'payout_failed', `Payout of ${fmt(po.amountCents)} failed`, 'Your bank returned it. Your money is safe in Available.', '/t/payouts');
    } else {
      for (const x of txns) Object.assign(x, { state: 'paid_out', payoutId: po.id, updatedAt: now() });
      notify(db, teacherId, 'teacher', 'payout', `Payout of ${fmt(po.amountCents)} sent`, `To your bank on ${fmtDate(po.scheduledFor)}.`, '/t/payouts');
    }
  });
  return ok(b.available);
}

/** Fail the latest paid payout (entries return to Available), or make the next one fail. */
export function failPayout(teacherId: string): Result<string> {
  const db0 = getState();
  const last = db0.payouts.filter((p) => p.teacherId === teacherId && p.status === 'paid' && p.transactionIds.length).sort((a, b) => b.scheduledFor - a.scheduledFor)[0];
  if (!last || db0.transactions.find((t) => t.id === last.transactionIds[0])?.state !== 'paid_out') {
    commit((db) => {
      db.dev.failNextPayout = true;
    });
    return ok('next');
  }
  commit((db) => {
    const po = db.payouts.find((p) => p.id === last.id)!;
    po.status = 'failed';
    po.failureReason = 'account_closed';
    for (const x of db.transactions) if (po.transactionIds.includes(x.id)) Object.assign(x, { state: 'available', payoutId: undefined, updatedAt: now() });
    const p = db.teacherProfiles.find((x) => x.userId === teacherId)!;
    if (p.bankAccount) p.bankAccount.closed = true;
    notify(db, teacherId, 'teacher', 'payout_failed', `Payout of ${fmt(po.amountCents)} failed`, 'Your bank returned it. Your money is safe in Available.', '/t/payouts');
  });
  return ok('failed');
}

/* =================== Account deletion =================== */

export async function deleteAccount(userId: string): Promise<Result<number>> {
  if (getState().dev.offline) return OFFLINE;
  await latency();
  let refunded = 0;
  commit((db) => {
    for (const e of db.enrollments.filter((x) => x.status === 'active' && (x.studentUserId === userId || x.teacherId === userId))) {
      refunded += cancelEnrollmentIn(db, e.id, e.teacherId === userId ? 'teacher' : 'account_deleted');
    }
    for (const o of db.offerings) if (o.teacherId === userId && o.status === 'published') o.status = 'unpublished';
    db.users = db.users.filter((u) => u.id !== userId);
    db.studentProfiles = db.studentProfiles.filter((p) => p.userId !== userId);
    db.teacherProfiles = db.teacherProfiles.filter((p) => p.userId !== userId);
    db.notifications = db.notifications.filter((n) => n.userId !== userId);
    db.session = null;
  });
  return ok(refunded);
}

/* =================== Developer panel =================== */

export function setDev(patch: Partial<DB['dev']>) {
  commit((db) => {
    Object.assign(db.dev, patch);
  });
}

export function advanceClock(ms: number) {
  commit((db) => {
    db.dev.clockOffsetMs += ms;
  });
}

export function resetClock() {
  commit((db) => {
    db.dev.clockOffsetMs = DEMO_START - Date.now();
  });
}

/** Move the clock to the start of the signed-in user's next scheduled lesson. */
export function jumpToNextLesson(userId: string): Result<number> {
  const db0 = getState();
  const t = now();
  const enrIds = new Set(db0.enrollments.filter((e) => e.studentUserId === userId || e.teacherId === userId).map((e) => e.id));
  const next = db0.lessons.filter((l) => enrIds.has(l.enrollmentId) && l.status === 'scheduled' && l.scheduledAt > t).sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  if (!next) return fail('none', 'No upcoming lesson to jump to.');
  commit((db) => {
    db.dev.clockOffsetMs += next.scheduledAt - t + 60000;
  });
  return ok(next.scheduledAt);
}

/** Booking conflict test: another student holds the first open time of this offering. */
export function simulateOtherHold(offeringId: string, weekday?: number, time?: string): Result<string> {
  const db0 = getState();
  const off = sel.offering(db0, offeringId);
  if (!off) return fail('missing', 'No offering');
  const t = now();
  const other = db0.users.find((u) => u.id === 'usr_maya') ?? db0.users.find((u) => u.roles.includes('student'));
  const slot = sel.slotsFor(db0, off, t).find((s) => s.status === 'open' && (weekday === undefined || (s.weekday === weekday && s.time === time)));
  if (!slot || !other) return fail('none', 'No open time to hold.');
  commit((db) => {
    db.bookings.push({
      id: uid('bkg'),
      studentUserId: other.id,
      payerUserId: other.id,
      offeringId,
      teacherId: off.teacherId,
      weekday: slot.weekday,
      startTime: slot.time,
      startDate: nextOccurrence(t, slot.weekday, slot.time),
      format: 'online',
      status: 'held',
      holdExpiresAt: t + 10 * 60000,
      createdAt: t,
    });
  });
  return ok(`${WEEKDAYS[slot.weekday]} ${fmtHM(slot.time)}`);
}

/** Developer shortcut: a Leo draft with the chapter 13 basics and curriculum filled in. */
export function createDemoDraft(teacherId: string): string {
  const id = uid('off');
  commit((db) => {
    db.offerings.push({
      id,
      teacherId,
      type: 'course',
      title: 'Acoustic Guitar Foundations',
      description: 'Go from never holding a guitar to playing your first full song in eight weeks.',
      instrument: 'Acoustic guitar',
      level: 'beginner',
      format: 'either',
      pricePerLessonCents: 0,
      lessonCount: 8,
      lessonMinutes: 45,
      capacity: 6,
      status: 'draft',
      draftStep: 3,
      createdAt: now(),
      beforeYouStart: 'Bring an acoustic guitar. No guitar yet? Ask in Messages before booking and I will suggest a starter model.',
    });
    const T = 'Tune your guitar and hold it comfortably';
    const C = 'Play G, C, D, Em and Am cleanly';
    const S = 'Keep a steady strum at 60 bpm';
    const F = 'Play a full song start to finish';
    const curriculum = [
      ['Holding, tuning, first notes', T],
      ['Your first chords: G, C, D', C],
      ['Strumming patterns', S],
      ['Chord changes', C],
      ['Em and Am', C],
      ['Your first full song', F],
      ['Fingerpicking basics', S],
      ['Play it through', F],
    ].map(([title, milestone], i) => ({ index: i + 1, title, milestone }));
    db.courses.push({ offeringId: id, outcomes: [T, C, S, F], curriculum });
  });
  return id;
}

export function resetDemo() {
  resetStore();
}

export { FEE_RATE, MIN_PRICE_PER_LESSON_CENTS };
export type { Level, Enrollment, Format };

/** Developer shortcut to view completed sessions: teach every remaining lesson of an enrollment. */
export function devCompleteAll(enrollmentId: string): Result<null> {
  const db0 = getState();
  const ls = sel.lessonsOf(db0, enrollmentId).filter((l) => l.status === 'scheduled');
  if (!ls.length) return fail('none', 'No lessons left to teach.');
  const lastEnd = ls[ls.length - 1].scheduledAt + ls[ls.length - 1].durationMin * 60000;
  commit((db) => {
    if (now() < lastEnd) db.dev.clockOffsetMs += lastEnd - now() + 60000;
  });
  commit((db) => {
    const enr = db.enrollments.find((e) => e.id === enrollmentId)!;
    const c = db.courses.find((x) => x.offeringId === enr.offeringId);
    for (const l of db.lessons) {
      if (l.enrollmentId !== enrollmentId || l.status !== 'scheduled') continue;
      l.status = 'taught';
      l.taughtAt = l.scheduledAt + l.durationMin * 60000;
      l.attendance = l.attendance ?? 'attended';
      for (const x of db.transactions) if (x.lessonId === l.id && x.state === 'pending') Object.assign(x, { state: 'available', updatedAt: now() });
      const rec = db.progress.find((p) => p.enrollmentId === enrollmentId && p.milestoneIndex === sel.skillIndexForLesson(c, l.index));
      if (rec && rec.state === 'upcoming') rec.state = 'practicing';
    }
    for (const rec of db.progress) if (rec.enrollmentId === enrollmentId && rec.state !== 'confirmed') Object.assign(rec, { state: 'confirmed', confirmedAt: now() });
    if (enr.status === 'active') {
      enr.status = 'completed';
      const off = db.offerings.find((o) => o.id === enr.offeringId);
      notify(db, enr.studentUserId, 'student', 'completed', 'Course completed', `You finished ${off?.title}. Leave a review when you are ready.`, `/s/learning/${enr.id}`);
    }
  });
  return ok(null);
}
