// Flow 06 and Flow 07 (teacher side): T12 Today, T13 Schedule (+ Empty Day), T14 Session Detail
// (+ Reschedule, Cancel Lessons), T15 Students, T16 Student Detail, T17 Edit Availability, T18 Update Progress.
import { useMemo, useState } from 'react';
import { ActionSheet, Alert, GlassButton, GlassText, Screen, Sheet } from '../../layout/layout';
import { Avatar, Badge, Button, EmptyState, Group, InlineAlert, ListRow, MilestoneRow, SearchField, Segmented, TextField, DayPill } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useMe, type ScreenProps } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { addDays, atTime, fmtDate, fmtDateTime, fmtHM, fmtLong, fmtMonthDay, fmtRange, fmtTime, fmtYear, now, startOfDay, toMinutes, WEEKDAYS, zoned, zonedEpoch } from '../../data/clock';
import { fmt } from '../../data/money';
import { notInPrototype, toast, useNow } from '../../data/ui';
import { cancelCourse, getOrCreateThread, markLessonComplete, refundPreview, requestReschedule, saveAvailability, saveProgress, setAttendance, type WindowInput } from '../../services';
import { RulesGroup, WindowsEditor } from './Setup';
import type { DB, Enrollment, Lesson } from '../../data/schema';

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

function studentLevelLabel(db: DB, studentId: string) {
  const sp = sel.studentProfile(db, studentId);
  return sp ? sel.LEVEL_LABEL[sel.studentLevelToLevel(sp.level)] : 'Student';
}
const studentName = (db: DB, id: string) => sel.user(db, id)?.name ?? 'Deleted student';

/* ---------- T12 Today ---------- */
export function T12Today() {
  const { db, me } = useMe();
  const t = useNow(15000);
  const unread = sel.unreadCount(db, me.id, 'teacher');
  const lessons = sel
    .teacherLessons(db, me.id)
    .filter((x) => x.lesson.status === 'scheduled' && x.lesson.scheduledAt + x.lesson.durationMin * 60000 > t && x.lesson.scheduledAt < addDays(startOfDay(t), 7))
    .sort((a, b) => a.lesson.scheduledAt - b.lesson.scheduledAt)
    .slice(0, 5);
  const fresh = db.enrollments.filter((e) => e.teacherId === me.id && e.status === 'active' && t - e.startedAt < 7 * 86400000 && !sel.lessonsOf(db, e.id).some((l) => l.status === 'taught'));
  const myEnr = new Set(db.enrollments.filter((e) => e.teacherId === me.id).map((e) => e.id));
  const myAssign = db.assignments.filter((a) => myEnr.has(a.enrollmentId));
  const practice = db.practiceLogs
    .filter((p) => myAssign.some((a) => a.id === p.assignmentId) && t - p.loggedAt < 7 * 86400000)
    .sort((a, b) => b.loggedAt - a.loggedAt)
    .slice(0, 3);
  const threads = db.threads.filter((th) => th.teacherId === me.id);
  const questions = threads
    .map((th) => ({ th, last: db.messages.filter((m) => m.threadId === th.id).sort((a, b) => b.sentAt - a.sentAt)[0] }))
    .filter((x) => x.last && x.last.senderId === x.th.studentUserId && t - x.last.sentAt < 7 * 86400000)
    .slice(0, 3);
  const b = sel.balances(db, me.id);
  return (
    <Screen title="Today" noNav>
      <div className="stack">
        <div className="stack-12">
          <div className="header-row">
            <p className="t-wordmark">Scale</p>
            <span className="hstack">
              <GlassButton icon="bell" label={unread ? `Notifications, ${unread} unread` : 'Notifications'} badge={unread > 0} onClick={() => navigate('/notifications')} />
              <button type="button" className="glass glass-btn" aria-label="Account" onClick={() => navigate('/account')} style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent-gold-text)' }}>
                {sel.initials(me.name)}
              </button>
            </span>
          </div>
          <h1 className="t-title1">Hi {sel.firstName(me.name)}</h1>
        </div>
        {fresh.map((e) => {
          const off = sel.offering(db, e.offeringId)!;
          const pay = db.payments.find((p) => p.bookingId === e.bookingId && p.status !== 'failed');
          const name = studentName(db, e.studentUserId);
          return (
            <section key={e.id} className="card" style={{ gap: 12 }} aria-labelledby={`ne-${e.id}`}>
              <div className="spread">
                <h2 id={`ne-${e.id}`} className="t-headline" style={{ fontSize: '1.06rem' }}>
                  New enrollment
                </h2>
                <Badge tone="gold">New</Badge>
              </div>
              <p className="t-body c-secondary">
                {name} booked {off.title} · {WEEKDAYS[e.weekday]}s at {fmtHM(e.startTime)}, {e.format === 'online' ? 'online' : 'in person'}, starting {fmtMonthDay(sel.lessonsOf(db, e.id)[0]?.scheduledAt ?? e.startedAt)}. Paid {fmt(pay?.amountCents ?? 0)}.
              </p>
              <div className="bottombar__row">
                <Button variant="gray" onClick={() => navigate(`/messages/${getOrCreateThread(e.studentUserId, me.id)}`)}>
                  Message {sel.firstName(name)}
                </Button>
                <Button onClick={() => navigate(`/t/students/${e.studentUserId}`)}>View student</Button>
              </div>
            </section>
          );
        })}
        <section className="stack-6">
          <h2 className="section-label">Next up</h2>
          {lessons.length ? (
            <div className="group">
              {lessons.map(({ lesson, enr }) => {
                const off = sel.offering(db, enr.offeringId);
                const startable = t >= lesson.scheduledAt - 10 * 60000;
                return (
                  <ListRow
                    key={lesson.id}
                    title={fmtDateTime(lesson.scheduledAt)}
                    subtitle={`${studentName(db, enr.studentUserId)} · ${off?.type === 'single' ? 'Private lesson' : `Lesson ${lesson.index} of ${off?.lessonCount}`} · ${enr.format === 'online' ? 'Online' : 'In person'}`}
                    value={startable ? 'Start' : undefined}
                    chevron
                    onClick={() => navigate(`/t/lesson/${lesson.id}`)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="card">
              <p className="t-body c-secondary">No lessons in the next 7 days.</p>
            </div>
          )}
        </section>
        <section className="stack-6">
          <h2 className="section-label">Student activity</h2>
          {practice.length || questions.length ? (
            <div className="group">
              {practice.map((p) => {
                const a = myAssign.find((x) => x.id === p.assignmentId)!;
                const enr = sel.enrollment(db, a.enrollmentId)!;
                const days = sel.daysLoggedThisWeek(db, a.id, t);
                return (
                  <ListRow
                    key={p.id}
                    title={`${sel.firstName(studentName(db, enr.studentUserId))} logged practice`}
                    subtitle={`${a.title} · ${p.minutes} min · ${startOfDay(p.loggedAt) === startOfDay(t) ? 'today' : fmtDate(p.loggedAt)}`}
                    value={`${days} of ${a.daysPerWeek ?? 5}`}
                    chevron
                    onClick={() => navigate(`/t/students/${enr.studentUserId}`)}
                  />
                );
              })}
              {questions.map(({ th, last }) => (
                <ListRow key={th.id} title={`${studentName(db, th.studentUserId)} sent a message`} subtitle={`Messages · ${last!.text.slice(0, 40)}${last!.text.length > 40 ? '…' : ''}`} value="New" chevron onClick={() => navigate(`/messages/${th.id}`)} />
              ))}
            </div>
          ) : (
            <div className="card">
              <p className="t-body c-secondary">Practice logs and messages from students show up here.</p>
            </div>
          )}
        </section>
        <section className="stack-6">
          <h2 className="section-label">This week</h2>
          <div className="group">
            <ListRow title="Available to pay out" value={<span style={{ color: 'var(--text-primary)' }}>{fmt(b.available)}</span>} chevron onClick={() => navigate('/t/earnings')} />
            <ListRow title="Pending" subtitle={b.pendingCount ? `${b.pendingCount} untaught lesson${b.pendingCount === 1 ? '' : 's'}` : undefined} value={<span style={{ color: 'var(--text-primary)' }}>{fmt(b.pending)}</span>} chevron onClick={() => navigate('/t/earnings')} />
          </div>
        </section>
      </div>
    </Screen>
  );
}

/* ---------- T13 Schedule / T15 Students shared header ---------- */
function ScheduleHeader({ seg }: { seg: 'calendar' | 'students' }) {
  return (
    <div className="stack-16">
      <div className="header-row">
        <h1 className="t-large-title">Schedule</h1>
        <GlassText strong onClick={() => navigate('/t/availability')}>
          Availability
        </GlassText>
      </div>
      <Segmented
        label="Schedule view"
        value={seg}
        onChange={(v) => navigate(v === 'calendar' ? '/t/schedule' : '/t/students', { replace: true, dir: 'none' })}
        options={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'students', label: 'Students' },
        ]}
      />
    </div>
  );
}

const dayKey = (ms: number) => {
  const z = zoned(ms);
  return `${z.y}-${String(z.m).padStart(2, '0')}-${String(z.d).padStart(2, '0')}`;
};
const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return zonedEpoch(y, m, d);
};

export function T13Schedule({ query }: ScreenProps) {
  const { db, me } = useMe();
  const t = now();
  const day = query.get('day') ? fromKey(query.get('day')!) : startOfDay(t);
  const weekStart = addDays(day, -zoned(day).weekday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const all = sel.teacherLessons(db, me.id).filter((x) => x.lesson.status !== 'cancelled');
  const onDay = (d: number) => all.filter((x) => startOfDay(x.lesson.scheduledAt) === d).sort((a, b) => a.lesson.scheduledAt - b.lesson.scheduledAt);
  const todays = onDay(day);
  const wd = zoned(day).weekday;
  const windows = db.availability.filter((a) => a.teacherId === me.id && a.weekday === wd);
  const blocking = sel.blockingBookings(db, me.id, t);
  const openTimes = windows.flatMap((w) => sel.windowStarts(w, 45)).filter((time) => {
    const s = toMinutes(time);
    const busyLesson = todays.some((x) => {
      const ls = zoned(x.lesson.scheduledAt);
      const m = ls.h * 60 + ls.min;
      return m < s + 60 && s < m + x.lesson.durationMin + 15;
    });
    const weekly = blocking.some((b) => b.weekday === wd && Math.abs(toMinutes(b.startTime) - s) < 60);
    return !busyLesson && !weekly;
  });
  const go = (d: number) => navigate(`/t/schedule?day=${dayKey(d)}`, { replace: true, dir: 'none' });
  return (
    <Screen title="Schedule" noNav>
      <div className="stack">
        <ScheduleHeader seg="calendar" />
        <div className="stack-8">
          <div className="days" role="group" aria-label="Week">
            {days.map((d) => (
              <DayPill key={d} weekday={'SMTWTFS'[zoned(d).weekday]} date={zoned(d).d} selected={d === day} today={d === startOfDay(t)} hasLessons={onDay(d).length > 0} label={fmtLong(d)} onClick={() => go(d)} />
            ))}
          </div>
        </div>
        <div className="spread">
          <h2 className="t-title3">{fmtLong(day)}</h2>
          <span className="hstack" style={{ gap: 4 }}>
            <button type="button" className="round-btn" aria-label="Previous week" onClick={() => go(addDays(day, -7))}>
              <Icon name="chevron.left" size={18} />
            </button>
            <button type="button" className="round-btn" aria-label="Next week" onClick={() => go(addDays(day, 7))}>
              <Icon name="chevron.right" size={18} />
            </button>
          </span>
        </div>
        {!todays.length && !openTimes.length ? (
          <EmptyState
            icon="calendar"
            title={`Nothing on ${WEEKDAYS[wd]}`}
            message="You have no lessons or open times this day. Students can only book inside your weekly windows."
            action={
              <Button variant="gray-elevated" onClick={() => navigate('/t/availability')}>
                Edit availability
              </Button>
            }
          />
        ) : (
          <div className="stack-16">
            {[
              ...todays.map(({ lesson, enr }) => ({ at: lesson.scheduledAt, key: lesson.id, lesson, enr })),
              ...openTimes.map((time) => ({ at: atTime(day, time), key: time, lesson: undefined, enr: undefined })),
            ]
              .sort((a, b) => a.at - b.at)
              .map(({ key, at, lesson, enr }) => {
                if (!lesson || !enr)
                  return (
                    <div key={key} className="stack-6" style={{ padding: '4px 0' }}>
                      <div className="spread">
                        <span className="t-headline" style={{ fontSize: '1.06rem' }}>
                          {fmtRange(at, 45, ' – ')}
                        </span>
                        <span className="t-footnote c-secondary">Open</span>
                      </div>
                      <p className="t-subhead c-secondary">Available for course students. Booked weekly times block this slot automatically.</p>
                    </div>
                  );
                const off = sel.offering(db, enr.offeringId)!;
                const item = sel.curriculumItem(db, enr, lesson.index);
                return (
                  <button key={key} type="button" className="card card--tap" onClick={() => navigate(`/t/lesson/${lesson.id}`)}>
                    <span className="spread">
                      <span className="t-headline" style={{ fontSize: '1.06rem' }}>
                        {fmtRange(lesson.scheduledAt, lesson.durationMin, ' – ')}
                      </span>
                      {lesson.status === 'taught' ? <Badge tone="success">Taught</Badge> : <Badge tone="info">Scheduled</Badge>}
                    </span>
                    <span className="t-body">
                      {studentName(db, enr.studentUserId)} · {off.title}
                    </span>
                    <span className="t-subhead c-secondary">
                      {off.type === 'single' ? 'Private lesson' : `Lesson ${lesson.index} of ${off.lessonCount}`} · {enr.format === 'online' ? 'Online' : 'In person'}
                      {item ? ` · ${item.title}` : ''}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </Screen>
  );
}

/* ---------- T15 Students ---------- */
export function T15Students() {
  const { db, me } = useMe();
  const [q, setQ] = useState('');
  const enrs = db.enrollments.filter((e) => e.teacherId === me.id);
  const match = (id: string) => studentName(db, id).toLowerCase().includes(q.trim().toLowerCase());
  const courseStudents = enrs.filter((e) => sel.offering(db, e.offeringId)?.type !== 'single' && (e.status === 'active' || e.status === 'completed') && match(e.studentUserId));
  const singleIds = [...new Set(enrs.filter((e) => sel.offering(db, e.offeringId)?.type === 'single').map((e) => e.studentUserId))].filter(match);
  return (
    <Screen title="Students" noNav>
      <div className="stack">
        <ScheduleHeader seg="students" />
        <SearchField label="Search students" placeholder="Search students" value={q} onChange={setQ} />
        {!courseStudents.length && !singleIds.length && <EmptyState icon="person.fill" title="No students yet" message="Students appear here after their first booking." />}
        {courseStudents.length > 0 && (
          <Group label={`Enrolled in a course · ${courseStudents.length}`} labelId="cs-h">
            {courseStudents.map((e) => {
              const off = sel.offering(db, e.offeringId)!;
              const p = sel.progressOf(db, e);
              const z = fmtHM(e.startTime).replace(':00', '');
              return (
                <ListRow
                  key={e.id}
                  title={studentName(db, e.studentUserId)}
                  subtitle={`${off.title} · ${p.taught} of ${p.total} done${e.status === 'completed' ? ' · completed' : ''}`}
                  value={`${WEEKDAYS[e.weekday].slice(0, 3)} ${z}`}
                  chevron
                  label={`${studentName(db, e.studentUserId)}, ${off.title}, ${p.taught} of ${p.total} lessons done`}
                  onClick={() => navigate(`/t/students/${e.studentUserId}`)}
                />
              );
            })}
          </Group>
        )}
        {singleIds.length > 0 && (
          <Group label={`Single lessons · ${singleIds.length}`} labelId="sl-h">
            {singleIds.map((id) => {
              const mine = enrs.filter((e) => e.studentUserId === id && sel.offering(db, e.offeringId)?.type === 'single');
              const ls = mine.flatMap((e) => sel.lessonsOf(db, e.id)).sort((a, b) => b.scheduledAt - a.scheduledAt);
              return (
                <ListRow
                  key={id}
                  title={studentName(db, id)}
                  subtitle={`${sel.offering(db, mine[0].offeringId)?.title} · ${ls.length} lesson${ls.length === 1 ? '' : 's'}`}
                  value={ls[0] ? fmtMonthDay(ls[0].scheduledAt) : undefined}
                  chevron
                  onClick={() => navigate(`/t/students/${id}`)}
                />
              );
            })}
          </Group>
        )}
        <p className="helper">Students appear here after their first booking. You see the name, level and what they booked; contact details stay private.</p>
      </div>
    </Screen>
  );
}

/* ---------- T16 Student Detail ---------- */
export function T16StudentDetail({ params }: ScreenProps) {
  const { db, me } = useMe();
  const [progressFor, setProgressFor] = useState<Lesson | null>(null);
  const sid = params.studentId;
  const enrs = db.enrollments.filter((e) => e.teacherId === me.id && e.studentUserId === sid).sort((a, b) => (a.status === 'active' ? -1 : 0) - (b.status === 'active' ? -1 : 0) || b.startedAt - a.startedAt);
  const enr = enrs[0];
  if (!enr) {
    return (
      <Screen title="Student" navTitle back>
        <EmptyState icon="person.fill" title="That page is not available" message="This student has no booking with you." />
      </Screen>
    );
  }
  const name = studentName(db, sid);
  const off = sel.offering(db, enr.offeringId)!;
  const p = sel.progressOf(db, enr);
  const pay = db.payments.find((x) => x.bookingId === enr.bookingId && x.status !== 'failed');
  const assignments = sel.assignmentsOf(db, enr.id);
  const logs = assignments.flatMap((a) => sel.logsOf(db, a.id));
  const minutes = logs.reduce((s, l) => s + l.minutes, 0);
  const lastTaught = [...p.lessons].reverse().find((l) => l.status === 'taught');
  const lastNote = [...p.lessons].filter((l) => l.note).sort((a, b) => (b.noteAt ?? 0) - (a.noteAt ?? 0))[0];
  const since = Math.min(...enrs.map((e) => e.startedAt));
  const isCourse = off.type !== 'single';
  return (
    <Screen title={name} navTitle back>
      <div className="stack">
        <div className="stack-8" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar initials={sel.initials(name)} large />
          <h2 className="t-title1" style={{ fontSize: '1.9rem' }}>
            {name}
          </h2>
          <p className="t-body c-secondary">
            {studentLevelLabel(db, sid)} · Student since {fmtYear(since)}
          </p>
        </div>
        <div className="bottombar__row">
          <Button variant="gray-elevated" onClick={() => navigate(`/messages/${getOrCreateThread(sid, me.id)}`)}>
            Message
          </Button>
          <Button variant="gray-elevated" disabled={!lastTaught || !isCourse} describedBy="up-hint" onClick={() => lastTaught && setProgressFor(lastTaught)}>
            Update progress
          </Button>
        </div>
        {(!lastTaught || !isCourse) && (
          <p id="up-hint" className="helper" style={{ marginTop: -16 }}>
            {isCourse ? 'Update progress is available after the first lesson is marked complete.' : 'Progress tracking is for courses.'}
          </p>
        )}
        <Group label="Enrollment" labelId="enr-h">
          <ListRow title={off.title} subtitle={`${off.lessonCount} one-on-one lesson${off.lessonCount === 1 ? '' : 's'} · paid ${fmt(pay?.amountCents ?? 0)}`} value={enr.status === 'active' ? 'Active' : enr.status === 'completed' ? 'Completed' : 'Cancelled'} />
          <ListRow title="Weekly time" subtitle={`${WEEKDAYS[enr.weekday]}s, ${fmtHM(enr.startTime)} · ${enr.format === 'online' ? 'Online' : 'In person'}`} value="Change" chevron onClick={() => notInPrototype('Changing the weekly time')} />
          {p.next && <ListRow title="Next lesson" subtitle={`Lesson ${p.next.index} · ${fmtDate(p.next.scheduledAt)}`} value="Open" chevron onClick={() => navigate(`/t/lesson/${p.next!.id}`)} />}
        </Group>
        <Group label="Progress" labelId="prog-h">
          <ListRow title="Lessons completed" subtitle="Released to your earnings as each one is marked" value={`${p.taught} of ${p.total}`} />
          {p.skills.length > 0 && <ListRow title="Skills confirmed" value={`${p.confirmed} of ${p.skills.length}`} />}
          <ListRow title="Practice logged" subtitle={assignments.length ? assignments.map((a) => a.title).join(', ') : 'No practice assigned yet'} value={`${minutes} min · ${logs.length}`} label={`Practice logged, ${minutes} minutes in ${logs.length} sessions`} />
          {lastNote && <ListRow title="Last note" subtitle={lastNote.note} />}
        </Group>
        {p.skills.length > 0 && (
          <section className="stack-6">
            <h2 className="section-label">Skills</h2>
            <div className="group">
              {p.skills.map((s, i) => {
                const rec = sel.skillState(db, enr, i);
                return <MilestoneRow key={s} title={s} state={rec?.state ?? 'upcoming'} status={rec?.state === 'confirmed' ? `Confirmed · ${fmtMonthDay(rec.confirmedAt!)}` : rec?.state === 'practicing' ? 'Practicing' : 'Upcoming'} />;
              })}
            </div>
          </section>
        )}
        <Group label="Lessons" labelId="les-h">
          {enrs.flatMap((e) =>
            sel.lessonsOf(db, e.id).map((l) => (
              <ListRow
                key={l.id}
                title={`Lesson ${l.index}${sel.offering(db, e.offeringId)?.type === 'single' ? ' · Private lesson' : ''}`}
                subtitle={`${fmtDateTime(l.scheduledAt)} · ${l.status === 'taught' ? 'Taught' : l.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}`}
                chevron
                onClick={() => navigate(`/t/lesson/${l.id}`)}
              />
            )),
          )}
        </Group>
      </div>
      {progressFor && <T18UpdateProgress lesson={progressFor} enr={enr} onClose={() => setProgressFor(null)} />}
    </Screen>
  );
}

/* ---------- T14 Session Detail ---------- */
function rescheduleOptions(db: DB, teacherId: string, lesson: Lesson, t: number): number[] {
  const out: number[] = [];
  const busy = sel.teacherLessons(db, teacherId).filter((x) => x.lesson.status === 'scheduled' && x.lesson.id !== lesson.id);
  for (let d = -3; d <= 6 && out.length < 6; d++) {
    const day = addDays(startOfDay(lesson.scheduledAt), d);
    const wd = zoned(day).weekday;
    for (const w of db.availability.filter((a) => a.teacherId === teacherId && a.weekday === wd)) {
      for (const time of sel.windowStarts(w, lesson.durationMin)) {
        const at = atTime(day, time);
        if (at <= t + 3600000 || at === lesson.scheduledAt) continue;
        if (busy.some((x) => Math.abs(x.lesson.scheduledAt - at) < (lesson.durationMin + 15) * 60000)) continue;
        out.push(at);
      }
    }
  }
  return out.slice(0, 6);
}

export function T14SessionDetail({ params }: ScreenProps) {
  const { db, me } = useMe();
  const t = useNow(5000);
  const lesson = sel.lesson(db, params.lessonId);
  const enr = lesson ? sel.enrollment(db, lesson.enrollmentId) : undefined;
  const [completing, setCompleting] = useState(false);
  const [progress, setProgress] = useState(false);
  const [resched, setResched] = useState(false);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [more, setMore] = useState(false);
  if (!lesson || !enr || enr.teacherId !== me.id) {
    return (
      <Screen title="Lesson" navTitle back>
        <EmptyState icon="calendar" title="That page is not available" message="This lesson does not belong to you." />
      </Screen>
    );
  }
  const off = sel.offering(db, enr.offeringId)!;
  const name = studentName(db, enr.studentUserId);
  const first = sel.firstName(name);
  const item = sel.curriculumItem(db, enr, lesson.index);
  const end = lesson.scheduledAt + lesson.durationMin * 60000;
  const started = t >= lesson.scheduledAt;
  const txn = db.transactions.find((x) => x.lessonId === lesson.id);
  const nth = db.enrollments.filter((e) => e.teacherId === me.id && e.studentUserId === enr.studentUserId && e.startedAt <= enr.startedAt && sel.offering(db, e.offeringId)?.type !== 'single').length;
  const status =
    lesson.status === 'taught'
      ? `Taught ${fmtMonthDay(lesson.taughtAt ?? lesson.scheduledAt)}`
      : lesson.status === 'cancelled'
        ? 'Cancelled'
        : t > end
          ? `Ended ${fmtTime(end + 60000)}`
          : started
            ? 'In progress'
            : t >= lesson.scheduledAt - 10 * 60000
              ? 'Starting soon'
              : `Starts ${fmtDate(lesson.scheduledAt)}`;
  const preview = refundPreview(db, enr.id, 'teacher');
  const joinOpen = lesson.status === 'scheduled' && t >= lesson.scheduledAt - 10 * 60000 && t <= end;
  const req = lesson.rescheduleRequest;
  const tp = sel.teacherProfile(db, me.id);

  const complete = async () => {
    setCompleting(true);
    const r = await markLessonComplete(lesson.id);
    setCompleting(false);
    if (!r.ok) {
      toast(r.message, { icon: 'warning' });
      return;
    }
    toast(`${fmt(txn?.netCents ?? 0)} moved to Available`, { icon: 'check' });
    if (off.type !== 'single') setProgress(true);
  };
  const doCancel = async () => {
    setCancelling(true);
    const r = await cancelCourse(enr.id, 'teacher');
    setCancelling(false);
    setCancelAsk(false);
    if (r.ok) toast(`${preview.refundable.length} lesson${preview.refundable.length === 1 ? '' : 's'} cancelled. ${first} gets ${fmt(r.value)} back.`, { icon: 'check', duration: 5000 });
    else toast(r.message, { icon: 'warning' });
  };

  let bottom;
  if (lesson.status === 'scheduled')
    bottom = (
      <>
        <Button onClick={complete} loading={completing} disabled={!started} describedBy="complete-note">
          {off.type === 'single' ? 'Mark complete' : 'Mark complete and update progress'}
        </Button>
        <p id="complete-note" className="bottombar__note">
          {started ? `Completing releases ${fmt(txn?.netCents ?? 0)} to Available${off.type === 'single' ? '.' : ` and shares your notes with ${first}.`}` : `Available from ${fmtDate(lesson.scheduledAt)} at ${fmtTime(lesson.scheduledAt)}, when the lesson starts.`}
        </p>
      </>
    );
  else if (lesson.status === 'taught' && off.type !== 'single')
    bottom = (
      <>
        <Button variant="gray" onClick={() => setProgress(true)}>
          Update progress
        </Button>
        <p className="bottombar__note">
          Taught {fmtMonthDay(lesson.taughtAt ?? lesson.scheduledAt)} · {fmt(txn?.netCents ?? 0)} released to your earnings.
        </p>
      </>
    );

  return (
    <Screen title={off.type === 'single' ? 'Private lesson' : `Lesson ${lesson.index} of ${off.lessonCount}`} navTitle back trailing={<GlassButton icon="ellipsis" label="More" onClick={() => setMore(true)} />} bottom={bottom}>
      <div className="stack">
        <section className="card" aria-label="Lesson">
          <div className="hstack" style={{ gap: 12 }}>
            <Avatar initials={sel.initials(name)} />
            <div className="stack-6" style={{ gap: 2 }}>
              <span className="t-headline" style={{ fontSize: '1.06rem' }}>
                {name}
              </span>
              <span className="t-body c-secondary">
                {studentLevelLabel(db, enr.studentUserId)} · {off.type === 'single' ? 'Private lesson' : `${ordinal(Math.max(1, nth))} course with you`}
              </span>
            </div>
          </div>
          <div className="kv t-body">
            <span>When</span>
            <span>
              {fmtDate(lesson.scheduledAt)} · {fmtRange(lesson.scheduledAt, lesson.durationMin, '–')}
            </span>
          </div>
          <div className="kv t-body">
            <span>Where</span>
            <span>{enr.format === 'online' ? 'Online (Scale video link)' : `In person · ${tp?.serviceArea ?? 'Studio'}`}</span>
          </div>
          <div className="kv t-body">
            <span>Status</span>
            <span>{status}</span>
          </div>
        </section>
        {req?.status === 'pending' && req.expiresAt > t && (
          <InlineAlert tone="info" title={`Waiting for ${first} to accept`}>
            New time {fmtDateTime(req.proposedAt)}. If {first} declines or does not answer by {fmtDateTime(req.expiresAt)}, the lesson stays at the original time.
          </InlineAlert>
        )}
        {joinOpen && (
          <Button variant="gray-elevated" onClick={() => navigate(`/t/lesson-room/${lesson.id}`)}>
            Join lesson
          </Button>
        )}
        {item && (
          <section className="stack-6">
            <h2 className="section-label">Lesson plan</h2>
            <div className="group">
              <ListRow title={item.title} subtitle={`Milestone: ${item.milestone}`} />
            </div>
          </section>
        )}
        {lesson.status !== 'cancelled' && (
          <section className="stack-6">
            <h2 className="section-label" id="att-h">
              Attendance
            </h2>
            <Segmented
              label="Attendance"
              value={lesson.attendance ?? 'attended'}
              onChange={(v) => {
                setAttendance(lesson.id, v);
                toast('Attendance saved', { icon: 'check' });
              }}
              options={[
                { value: 'attended', label: 'Attended' },
                { value: 'no_show', label: 'No-show' },
                { value: 'teacher_cancelled', label: 'I cancelled' },
              ]}
            />
            <p className="helper">Stored with the lesson. Payment and progress effects of No-show and I cancelled are an open decision (Q-21).</p>
          </section>
        )}
        {enr.status === 'active' && (
          <Group label="Manage" labelId="man-h">
            <ListRow title="Reschedule a future lesson" subtitle="Student gets a request to accept" chevron onClick={() => setResched(true)} />
            <ListRow title="Cancel remaining lessons" subtitle={`Refunds untaught lessons to ${first}`} chevron onClick={() => setCancelAsk(true)} />
          </Group>
        )}
        {lesson.note && (
          <section className="card card--note">
            <p className="t-subhead-em" style={{ color: 'var(--accent-gold-text)' }}>
              Your note · {fmtMonthDay(lesson.noteAt!)}
            </p>
            <p className="t-body">{lesson.note}</p>
          </section>
        )}
      </div>
      {resched && <RescheduleSheet db={db} enr={enr} fromLesson={lesson} teacherId={me.id} t={t} onClose={() => setResched(false)} />}
      <Alert
        open={cancelAsk}
        title={`Cancel ${first}'s remaining ${preview.refundable.length} lesson${preview.refundable.length === 1 ? '' : 's'}?`}
        message={`${first} gets ${fmt(preview.refundCents)} back for the untaught lesson${preview.refundable.length === 1 ? '' : 's'}. The ${fmt(preview.teacherLosesCents)} pending for you is removed. This cannot be undone.`}
        cancel={{ label: 'Keep lessons', bold: true, onClick: () => setCancelAsk(false) }}
        confirm={{ label: `Cancel ${preview.refundable.length} lesson${preview.refundable.length === 1 ? '' : 's'}`, destructive: true, onClick: doCancel, loading: cancelling }}
      />
      <ActionSheet
        open={more}
        onCancel={() => setMore(false)}
        actions={[
          { label: `Message ${first}`, onClick: () => navigate(`/messages/${getOrCreateThread(enr.studentUserId, me.id)}`) },
          { label: `View ${first}`, onClick: () => navigate(`/t/students/${enr.studentUserId}`) },
          { label: 'Cancel', bold: true, onClick: () => setMore(false) },
        ]}
      />
      {progress && <T18UpdateProgress lesson={sel.lesson(db, lesson.id)!} enr={enr} onClose={() => setProgress(false)} />}
    </Screen>
  );
}

function RescheduleSheet({ db, enr, fromLesson, teacherId, t, onClose }: { db: DB; enr: Enrollment; fromLesson: Lesson; teacherId: string; t: number; onClose: () => void }) {
  const future = sel.lessonsOf(db, enr.id).filter((l) => l.status === 'scheduled' && l.scheduledAt > t);
  const [lessonId, setLessonId] = useState<string | undefined>((future.find((l) => l.index >= fromLesson.index) ?? future[0])?.id);
  const lesson = future.find((l) => l.id === lessonId);
  const options = useMemo(() => (lesson ? rescheduleOptions(db, teacherId, lesson, t) : []), [db, teacherId, lesson, t]);
  const [pick, setPick] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const first = sel.firstName(studentName(db, enr.studentUserId));
  return (
    <Sheet
      open
      large
      title={lesson ? `Reschedule Lesson ${lesson.index}` : 'Reschedule'}
      onCancel={onClose}
      action={{
        label: 'Send',
        disabled: !pick || !lesson,
        loading: sending,
        onClick: async () => {
          setSending(true);
          const r = await requestReschedule(lesson!.id, pick!, msg.trim());
          setSending(false);
          if (r.ok) {
            onClose();
            toast(`Request sent to ${first}`, { icon: 'check' });
          } else toast(r.message, { icon: 'warning' });
        },
      }}
    >
      {!future.length ? (
        <p className="t-body c-secondary">There are no future lessons to move.</p>
      ) : (
        <>
          {future.length > 1 && (
            <div className="stack-8">
              <p className="section-label" style={{ margin: 0 }}>
                Lesson to move
              </p>
              <div className="chips chips--scroll">
                {future.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`chip${l.id === lessonId ? ' chip--selected' : ''}`}
                    aria-pressed={l.id === lessonId}
                    onClick={() => {
                      setLessonId(l.id);
                      setPick(null);
                    }}
                  >
                    <span className="chip__face">
                      Lesson {l.index} · {fmtMonthDay(l.scheduledAt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {lesson && (
            <p className="section-label" style={{ margin: 0 }}>
              Now · {fmtDateTime(lesson.scheduledAt)}
            </p>
          )}
          <div className="stack-8">
            <p className="t-headline">Suggest a new time</p>
            <div className="stack-8" role="radiogroup" aria-label="New time">
              {options.length ? (
                options.map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={pick === o} className={`chip${pick === o ? ' chip--selected' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => setPick(o)}>
                    <span className="chip__face">{fmtDateTime(o)}</span>
                  </button>
                ))
              ) : (
                <p className="t-body c-secondary">No open times near this lesson. Add availability first.</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="resched-msg" className="sr-only">
              Message to {first} (optional)
            </label>
            <textarea id="resched-msg" className="plain-input" rows={3} placeholder={`Message to ${first} (optional)`} value={msg} onChange={(e) => setMsg(e.target.value)} />
            <p className="helper">Only open times inside your windows are shown. {first} has 48 hours to accept; if they decline or do not answer, the lesson stays at the original time.</p>
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---------- T18 Update Progress ---------- */
export function T18UpdateProgress({ lesson, enr, onClose }: { lesson: Lesson; enr: Enrollment; onClose: () => void }) {
  const { db } = useMe();
  const c = sel.course(db, enr.offeringId);
  const skills = sel.skillsOf(c);
  const name = studentName(db, enr.studentUserId);
  const first = sel.firstName(name);
  const own = sel.skillIndexForLesson(c, lesson.index);
  const relevant = skills.map((s, i) => ({ s, i, rec: sel.skillState(db, enr, i) })).filter((x) => x.i === own || x.rec?.state === 'practicing' || (x.rec?.state === 'confirmed' && x.i === own));
  const existing = db.assignments.filter((a) => a.enrollmentId === enr.id).sort((a, b) => b.createdAt - a.createdAt)[0];
  const [confirm, setConfirm] = useState<number[]>(own >= 0 && sel.skillState(db, enr, own)?.state !== 'confirmed' ? [own] : []);
  const [note, setNote] = useState(lesson.note ?? '');
  const [assignOpen, setAssignOpen] = useState(!existing);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [mins, setMins] = useState(String(existing?.minutesPerDay ?? 10));
  const [days, setDays] = useState(String(existing?.daysPerWeek ?? 5));
  const [discard, setDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = note !== (lesson.note ?? '') || title !== (existing?.title ?? '');
  const toggle = (i: number) => setConfirm((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]));
  const save = async () => {
    setSaving(true);
    const r = await saveProgress(lesson.id, {
      confirm,
      note,
      assignment: title.trim() ? { id: existing && title === existing.title ? existing.id : undefined, title, minutesPerDay: Number(mins) || undefined, daysPerWeek: Number(days) || undefined } : undefined,
    });
    setSaving(false);
    if (!r.ok) {
      toast(r.message, { icon: 'warning' });
      return;
    }
    onClose();
    toast(`Progress sent to ${first}`, { icon: 'check' });
  };
  return (
    <>
      <Sheet open large title={`${first} · Lesson ${lesson.index}`} onCancel={() => (dirty ? setDiscard(true) : onClose())} action={{ label: 'Save', onClick: save, loading: saving }}>
        <section className="stack-6">
          <h3 className="section-label">Skills from this lesson</h3>
          <div className="group">
            {relevant.length ? (
              relevant.map(({ s, i, rec }) =>
                rec?.state === 'confirmed' ? (
                  <MilestoneRow key={s} title={s} state="confirmed" status={`Confirmed ${fmtMonthDay(rec.confirmedAt!)}`} />
                ) : (
                  <MilestoneRow
                    key={s}
                    title={s}
                    state={confirm.includes(i) ? 'confirmed' : 'practicing'}
                    status={confirm.includes(i) ? `Confirm now · visible to ${first}` : 'Not yet · keep practicing'}
                    pressed={confirm.includes(i)}
                    onToggle={() => toggle(i)}
                  />
                ),
              )
            ) : (
              <p className="row t-body c-secondary">No skills to confirm for this lesson.</p>
            )}
          </div>
        </section>
        <section className="stack-6">
          <label className="section-label" htmlFor="t18-note">
            Note to {first}
          </label>
          <textarea id="t18-note" className="plain-input" rows={4} placeholder={`What went well, and what to work on before the next lesson`} value={note} onChange={(e) => setNote(e.target.value)} />
        </section>
        <section className="stack-6">
          <h3 className="section-label">Practice assignment</h3>
          <div className="group">
            {existing && !assignOpen && (
              <ListRow title={existing.title} subtitle={`${existing.minutesPerDay ?? '–'} minutes a day · ${existing.daysPerWeek ?? '–'} days`} value="Edit" chevron onClick={() => setAssignOpen(true)} />
            )}
            {!assignOpen && (
              <ListRow
                title="Add assignment"
                chevron
                onClick={() => {
                  setTitle('');
                  setAssignOpen(true);
                }}
              />
            )}
          </div>
          {assignOpen && (
            <div className="card stack-12">
              <TextField label="Practice" placeholder="e.g. G to C changes" value={title} onChange={setTitle} />
              <div className="hstack" style={{ gap: 12, alignItems: 'flex-start' }}>
                <TextField label="Minutes a day" inputMode="numeric" value={mins} onChange={(v) => setMins(v.replace(/\D/g, ''))} />
                <TextField label="Days a week" inputMode="numeric" value={days} onChange={(v) => setDays(v.replace(/\D/g, '').slice(0, 1))} />
              </div>
            </div>
          )}
        </section>
        <p className="helper">Nothing is required. Save sends whatever is filled and notifies {first}.</p>
      </Sheet>
      <ActionSheet
        open={discard}
        message={`Discard your notes for Lesson ${lesson.index}? ${first} has not seen them yet.`}
        onCancel={() => setDiscard(false)}
        actions={[
          {
            label: 'Discard notes',
            destructive: true,
            onClick: () => {
              setDiscard(false);
              onClose();
            },
          },
          { label: 'Keep editing', bold: true, onClick: () => setDiscard(false) },
        ]}
      />
    </>
  );
}

/* ---------- T17 Edit Availability ---------- */
export function T17EditAvailability() {
  const { db, me } = useMe();
  const [windows, setWindows] = useState<WindowInput[]>(db.availability.filter((a) => a.teacherId === me.id).map(({ weekday, start, end }) => ({ weekday, start, end })));
  const [error, setError] = useState<string | null>(null);
  const keeps = db.enrollments.filter((e) => e.teacherId === me.id && e.status === 'active');
  const save = () => {
    const r = saveAvailability(me.id, windows);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    toast('Availability saved', { icon: 'check' });
    history.length > 1 ? history.back() : navigate('/t/schedule', { replace: true });
  };
  return (
    <Screen title="Availability" navTitle back bottom={<Button onClick={save}>Save changes</Button>}>
      <div className="stack">
        <InlineAlert tone="info" title="Booked times stay booked">
          Changes apply to new bookings only.
          {keeps.length ? ` ${keeps.map((e) => `${sel.firstName(studentName(db, e.studentUserId))} keeps ${WEEKDAYS[e.weekday]}s at ${fmtHM(e.startTime)}`).join('; ')}.` : ''} To move an existing lesson, request a reschedule from the lesson.
        </InlineAlert>
        <section className="stack-6">
          <h2 className="section-label">Weekly windows</h2>
          <WindowsEditor
            value={windows}
            onChange={(w) => {
              setWindows(w);
              if (error) setError(null);
            }}
          />
          {error && (
            <p className="field__error" role="alert">
              <Icon name="exclamationmark.circle.fill" size={16} />
              {error}
            </p>
          )}
        </section>
        <RulesGroup />
      </div>
    </Screen>
  );
}

