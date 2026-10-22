// Derived values (chapter 09): computed from the store on every render, never stored twice.
import type { Availability, Course, DB, Enrollment, Lesson, Level, Offering, Role, StudentLevel, TeacherProfile, User } from './schema';
import { addDays, nextOccurrence, startOfDay, toMinutes, fromMinutes, zoned } from './clock';
import { coursePriceCents } from './money';

export const BREAK_MIN = 15; // break after each lesson (UNSPECIFIED, A-12)

export const user = (db: DB, id?: string | null): User | undefined => db.users.find((u) => u.id === id);
export const currentUser = (db: DB): User | undefined => (db.session ? user(db, db.session.userId) : undefined);
export const studentProfile = (db: DB, id?: string) => db.studentProfiles.find((p) => p.userId === id);
export const teacherProfile = (db: DB, id?: string): TeacherProfile | undefined => db.teacherProfiles.find((p) => p.userId === id);
export const offering = (db: DB, id?: string): Offering | undefined => db.offerings.find((o) => o.id === id);
export const course = (db: DB, offeringId?: string): Course | undefined => db.courses.find((c) => c.offeringId === offeringId);
export const enrollment = (db: DB, id?: string): Enrollment | undefined => db.enrollments.find((e) => e.id === id);
export const lesson = (db: DB, id?: string): Lesson | undefined => db.lessons.find((l) => l.id === id);

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
export const firstName = (name: string) => name.trim().split(/\s+/)[0];
export const shortName = (name: string) => {
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
};

export function ageFrom(dob: string, ref: number): number {
  const [y, m, d] = dob.split('-').map(Number);
  const z = zoned(ref);
  let age = z.y - y;
  if (z.m < m || (z.m === m && z.d < d)) age -= 1;
  return age;
}
export const isMinor = (u: User, ref: number) => ageFrom(u.dateOfBirth, ref) < 18;

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
export const STUDENT_LEVEL_LABEL: Record<StudentLevel, string> = {
  never: 'Never played',
  basics: 'Know a few basics',
  comfortable: 'Comfortable',
  advanced: 'Advanced',
};
export const studentLevelToLevel = (l: StudentLevel): Level => (l === 'comfortable' ? 'intermediate' : l === 'advanced' ? 'advanced' : 'beginner');

export function formatLabel(f: string, area?: string): string {
  const city = (area ?? 'Austin').replace(/, TX$/, '');
  if (f === 'online') return 'Online';
  if (f === 'in_person') return `In person in ${city}`;
  return `Online or ${city}`;
}

/* ---------- Skills (unique milestones) ---------- */
export function skillsOf(c?: Course): string[] {
  if (!c) return [];
  const out: string[] = [];
  for (const item of c.curriculum) if (item.milestone && !out.includes(item.milestone)) out.push(item.milestone);
  return out;
}
export function skillIndexForLesson(c: Course | undefined, lessonIndex: number): number {
  if (!c) return -1;
  const item = c.curriculum.find((x) => x.index === lessonIndex);
  return item ? skillsOf(c).indexOf(item.milestone) : -1;
}
export function curriculumItem(db: DB, enr: Enrollment, lessonIndex: number) {
  return course(db, enr.offeringId)?.curriculum.find((c) => c.index === lessonIndex);
}

/* ---------- Open weekly times ---------- */
export interface Slot {
  weekday: number;
  time: string; // HH:mm
  status: 'open' | 'taken';
  heldByMe?: boolean;
}

/** Bookings that block a weekly time: confirmed with an active enrollment, or unexpired holds. */
export function blockingBookings(db: DB, teacherId: string, nowMs: number) {
  return db.bookings.filter((b) => {
    if (b.teacherId !== teacherId) return false;
    if (b.status === 'held') return b.holdExpiresAt > nowMs;
    if (b.status !== 'confirmed') return false;
    const enr = db.enrollments.find((e) => e.bookingId === b.id);
    return !!enr && enr.status === 'active';
  });
}

export function windowStarts(w: Availability, minutes: number): string[] {
  const out: string[] = [];
  const end = toMinutes(w.end);
  for (let t = toMinutes(w.start); t + minutes <= end; t += minutes + BREAK_MIN) out.push(fromMinutes(t));
  return out;
}

export function slotsFor(db: DB, off: Offering, nowMs: number, meId?: string): Slot[] {
  const windows = db.availability.filter((a) => a.teacherId === off.teacherId).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  const blocking = blockingBookings(db, off.teacherId, nowMs);
  const slots: Slot[] = [];
  for (const w of windows) {
    for (const time of windowStarts(w, off.lessonMinutes)) {
      const s = toMinutes(time);
      const e = s + off.lessonMinutes + BREAK_MIN;
      const hit = blocking.find((b) => {
        if (b.weekday !== w.weekday) return false;
        const bo = offering(db, b.offeringId);
        const bs = toMinutes(b.startTime);
        const be = bs + (bo?.lessonMinutes ?? 45) + BREAK_MIN;
        return bs < e && s < be;
      });
      if (!hit) slots.push({ weekday: w.weekday, time, status: 'open' });
      else if (hit.status === 'held' && hit.studentUserId === meId) slots.push({ weekday: w.weekday, time, status: 'open', heldByMe: true });
      else slots.push({ weekday: w.weekday, time, status: 'taken' });
    }
  }
  return slots;
}

export const openCount = (db: DB, off: Offering, nowMs: number, meId?: string) => slotsFor(db, off, nowMs, meId).filter((s) => s.status === 'open').length;

/** Teacher-wide open weekly times (the 45-minute grid). */
export function teacherOpenSlots(db: DB, teacherId: string, nowMs: number): Slot[] {
  const probe = { teacherId, lessonMinutes: 45 } as Offering;
  return slotsFor(db, probe, nowMs);
}

/* ---------- Ratings and teacher stats ---------- */
export function rating(db: DB, teacherId: string) {
  const rs = db.reviews.filter((r) => r.teacherId === teacherId);
  const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
  return { count: rs.length, avg: Math.round(avg * 10) / 10, show: rs.length >= 3 };
}
export const fmtRating = (avg: number) => avg.toFixed(1);

export function lessonsTaught(db: DB, teacherId: string): number {
  const tp = teacherProfile(db, teacherId);
  const enrIds = new Set(db.enrollments.filter((e) => e.teacherId === teacherId).map((e) => e.id));
  return (tp?.lessonsTaughtBefore ?? 0) + db.lessons.filter((l) => enrIds.has(l.enrollmentId) && l.status === 'taught').length;
}

export const publishedOfferings = (db: DB, teacherId: string) => db.offerings.filter((o) => o.teacherId === teacherId && o.status === 'published');
export function fromPrice(db: DB, teacherId: string): number | undefined {
  const offs = publishedOfferings(db, teacherId);
  return offs.length ? Math.min(...offs.map((o) => o.pricePerLessonCents)) : undefined;
}
export const isNewCourse = (o: Offering, nowMs: number) => !!o.publishedAt && nowMs - o.publishedAt < 7 * 86400000;
export const offeringTotal = (o: Offering) => coursePriceCents(o.pricePerLessonCents, o.lessonCount);

/* ---------- Enrollments, lessons, progress ---------- */
export const lessonsOf = (db: DB, enrollmentId: string) => db.lessons.filter((l) => l.enrollmentId === enrollmentId).sort((a, b) => a.index - b.index);

export function activeEnrollmentFor(db: DB, studentId: string | undefined, offeringId: string) {
  return db.enrollments.find((e) => e.studentUserId === studentId && e.offeringId === offeringId && e.status === 'active');
}

export function studentEnrollments(db: DB, studentId?: string) {
  return db.enrollments.filter((e) => e.studentUserId === studentId).sort((a, b) => b.startedAt - a.startedAt);
}

export function nextLessonOf(db: DB, enrollmentId: string) {
  return lessonsOf(db, enrollmentId).find((l) => l.status === 'scheduled');
}

export function progressOf(db: DB, enr: Enrollment) {
  const ls = lessonsOf(db, enr.id);
  const c = course(db, enr.offeringId);
  const skills = skillsOf(c);
  const records = db.progress.filter((p) => p.enrollmentId === enr.id);
  const taught = ls.filter((l) => l.status === 'taught').length;
  const confirmed = records.filter((r) => r.state === 'confirmed').length;
  return { lessons: ls, total: ls.length, taught, skills, records, confirmed, next: ls.find((l) => l.status === 'scheduled') };
}

export function skillState(db: DB, enr: Enrollment, idx: number) {
  return db.progress.find((p) => p.enrollmentId === enr.id && p.milestoneIndex === idx);
}

export function assignmentsOf(db: DB, enrollmentId: string) {
  return db.assignments.filter((a) => a.enrollmentId === enrollmentId).sort((a, b) => b.createdAt - a.createdAt);
}
export function logsOf(db: DB, assignmentId: string) {
  return db.practiceLogs.filter((p) => p.assignmentId === assignmentId);
}
/** Distinct days logged in the current week (Mon to Sun). */
export function daysLoggedThisWeek(db: DB, assignmentId: string, nowMs: number): number {
  const sod = startOfDay(nowMs);
  const wd = (zoned(nowMs).weekday + 6) % 7;
  const weekStart = addDays(sod, -wd);
  const days = new Set(logsOf(db, assignmentId).filter((l) => l.loggedAt >= weekStart).map((l) => startOfDay(l.loggedAt)));
  return days.size;
}

/** Student-facing enrollment to open on the Learning tab (A-15). */
export function primaryEnrollment(db: DB, studentId?: string) {
  const list = studentEnrollments(db, studentId);
  return list.find((e) => e.status === 'active') ?? list[0];
}

/* ---------- Earnings ---------- */
export function balances(db: DB, teacherId: string) {
  const txns = db.transactions.filter((t) => t.teacherId === teacherId);
  const sum = (s: string) => txns.filter((t) => t.state === s).reduce((a, t) => a + t.netCents, 0);
  return {
    pending: sum('pending'),
    available: sum('available'),
    paidOut: sum('paid_out'),
    refunded: txns.filter((t) => t.state === 'refunded').reduce((a, t) => a + t.grossCents, 0),
    pendingCount: txns.filter((t) => t.state === 'pending').length,
    txns,
  };
}

/* ---------- Notifications ---------- */
export function notificationsFor(db: DB, userId?: string, role?: Role | null) {
  return db.notifications.filter((n) => n.userId === userId && n.role === role).sort((a, b) => b.createdAt - a.createdAt);
}
export const unreadCount = (db: DB, userId?: string, role?: Role | null) => notificationsFor(db, userId, role).filter((n) => !n.readAt).length;

/* ---------- Upcoming lessons for a teacher ---------- */
export function teacherLessons(db: DB, teacherId: string) {
  const enrs = new Map(db.enrollments.filter((e) => e.teacherId === teacherId).map((e) => [e.id, e]));
  return db.lessons.filter((l) => enrs.has(l.enrollmentId)).map((l) => ({ lesson: l, enr: enrs.get(l.enrollmentId)! }));
}

export function firstLessonFor(nowMs: number, weekday: number, time: string) {
  return nextOccurrence(nowMs, weekday, time);
}
