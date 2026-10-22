// Flow 07 student side: S15 Course Progress (+ No Courses, Completed), S16 Lesson Notes,
// S17 Log Practice (sheet), S18 Write a Review (sheet), and the Lesson room placeholder.
import { useEffect, useState } from 'react';
import { ActionSheet, Screen, Sheet } from '../../layout/layout';
import { Badge, Button, EmptyState, Group, InlineAlert, ListRow, MilestoneRow, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useMe, type ScreenProps } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { fmtDate, fmtDateTime, fmtMonthDay, fmtRange, now } from '../../data/clock';
import { fmt } from '../../data/money';
import { toast, useNow } from '../../data/ui';
import { acceptReschedule, getOrCreateThread, logPractice, postReview } from '../../services';
import type { DB, Enrollment, PracticeAssignment } from '../../data/schema';

/* ---------- S17 Log Practice ---------- */
export function LogPracticeSheet({ assignment, onClose }: { assignment: PracticeAssignment | null; onClose: () => void }) {
  const { me } = useMe();
  const [minutes, setMinutes] = useState(15);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (assignment) {
      setMinutes(assignment.minutesPerDay ?? 15);
      setComment('');
      setError(null);
    }
  }, [assignment]);
  if (!assignment) return null;
  const close = () => {
    setDiscard(false);
    onClose();
  };
  const cancel = () => (comment.trim() ? setDiscard(true) : close());
  const save = async () => {
    if (minutes <= 0) {
      setError('Enter minutes practiced');
      return;
    }
    setSaving(true);
    const r = await logPractice(assignment.id, me.id, minutes, comment);
    setSaving(false);
    if (r.ok) {
      close();
      toast('Practice logged', { icon: 'check' });
    }
  };
  return (
    <>
      <Sheet open title="Log practice" onCancel={cancel} action={{ label: 'Save', onClick: save, loading: saving }}>
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <div className="grow stack-6" style={{ gap: 2 }}>
            <p className="t-headline" style={{ fontSize: '1.15rem' }} aria-live="polite">
              {minutes} minutes
            </p>
            <p className="t-subhead c-secondary">{assignment.title} · today</p>
          </div>
          <div className="stepper" role="group" aria-label="Minutes practiced">
            <button type="button" aria-label="5 minutes less" onClick={() => setMinutes((m) => Math.max(0, m - 5))}>
              <Icon name="minus" size={18} />
            </button>
            <button
              type="button"
              aria-label="5 minutes more"
              onClick={() => {
                setMinutes((m) => Math.min(240, m + 5));
                setError(null);
              }}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>
        {error && (
          <p className="field__error" role="alert" style={{ marginTop: -10 }}>
            <Icon name="exclamationmark.circle.fill" size={16} />
            {error}
          </p>
        )}
        <TextField label="How did it feel? · optional" value={comment} onChange={setComment} enterKeyHint="done" helper="Your teacher sees what you log. Logging practice does not confirm a skill; your teacher confirms skills in lessons." />
      </Sheet>
      <ActionSheet
        open={discard}
        message="Discard this practice log?"
        onCancel={() => setDiscard(false)}
        actions={[
          { label: 'Discard', destructive: true, onClick: close },
          { label: 'Keep editing', bold: true, onClick: () => setDiscard(false) },
        ]}
      />
    </>
  );
}

/* ---------- S18 Write a Review ---------- */
function ReviewSheet({ db, enr, open, onClose }: { db: DB; enr: Enrollment; open: boolean; onClose: () => void }) {
  const teacher = sel.user(db, enr.teacherId);
  const off = sel.offering(db, enr.offeringId)!;
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const first = sel.firstName(teacher?.name ?? 'teacher');
  const close = () => {
    setDiscard(false);
    setRating(0);
    setText('');
    onClose();
  };
  return (
    <>
      <Sheet
        open={open}
        large
        title={`Review ${first}`}
        onCancel={() => (text.trim() || rating ? setDiscard(true) : close())}
        action={{
          label: 'Post',
          disabled: !rating,
          loading: saving,
          onClick: async () => {
            setSaving(true);
            await postReview(enr.id, rating, text);
            setSaving(false);
            close();
            toast('Thanks for your review', { icon: 'check' });
          },
        }}
      >
        <p className="section-label" style={{ margin: 0 }}>
          {off.title} · {off.lessonCount} lessons
        </p>
        <div className="stars-input" role="radiogroup" aria-label="Star rating, 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>
              <Icon name="star.fill" size={40} />
            </button>
          ))}
        </div>
        <p className="t-subhead c-secondary" style={{ marginTop: -12 }} aria-live="polite">
          {rating ? `${rating} of 5 · Tap a star to change` : 'Tap a star to rate. Post enables after a rating.'}
        </p>
        <div>
          <label htmlFor="review-text" className="sr-only">
            Your review (optional)
          </label>
          <textarea id="review-text" className="plain-input" rows={4} placeholder="What was it like? (optional)" value={text} onChange={(e) => setText(e.target.value)} />
          <p className="helper">Shown on {first}'s profile with your first name and the course. You can edit or delete it later.</p>
        </div>
      </Sheet>
      <ActionSheet
        open={discard}
        message="Discard your review?"
        onCancel={() => setDiscard(false)}
        actions={[
          { label: 'Discard review', destructive: true, onClick: close },
          { label: 'Keep editing', bold: true, onClick: () => setDiscard(false) },
        ]}
      />
    </>
  );
}

/* ---------- S15 Course Progress ---------- */
export function S15CourseProgress({ params }: ScreenProps) {
  const { db, me } = useMe();
  const primary = sel.primaryEnrollment(db, me.id);
  useEffect(() => {
    if (!params.enrollmentId && primary) navigate(`/s/learning/${primary.id}`, { replace: true, dir: 'none' });
  }, [params.enrollmentId, primary]);
  if (!params.enrollmentId) {
    if (primary) return null;
    return (
      <Screen title="Learning" noNav>
        <h1 className="t-large-title" style={{ paddingTop: 8 }}>
          Learning
        </h1>
        <div style={{ paddingTop: 60 }}>
          <EmptyState icon="music.note.list" title="Nothing here yet" message="Courses and lessons you book show up here, with notes, practice and skills from your teacher." action={<Button onClick={() => navigate('/s/discover')}>Find a course</Button>} />
        </div>
      </Screen>
    );
  }
  return <CourseProgress enrollmentId={params.enrollmentId} />;
}

function CourseProgress({ enrollmentId }: { enrollmentId: string }) {
  const { db, me } = useMe();
  const t = useNow(15000);
  const [logFor, setLogFor] = useState<PracticeAssignment | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [pendingAccept, setPendingAccept] = useState<string | null>(null);
  const enr = sel.enrollment(db, enrollmentId);
  useEffect(() => {
    if (!enr || enr.studentUserId !== me.id) {
      toast('That page is not available', { icon: 'info' });
      navigate('/s/learning', { replace: true });
    }
  }, [enr, me.id]);
  if (!enr) return null;
  const off = sel.offering(db, enr.offeringId)!;
  const teacher = sel.user(db, enr.teacherId);
  const tName = teacher?.name ?? 'Your teacher';
  const tFirst = sel.firstName(tName);
  const p = sel.progressOf(db, enr);
  const last = p.lessons[p.lessons.length - 1];
  const notes = p.lessons.filter((l) => l.note).sort((a, b) => (b.noteAt ?? 0) - (a.noteAt ?? 0));
  const assignments = sel.assignmentsOf(db, enr.id);
  const reviewed = db.reviews.some((r) => r.enrollmentId === enr.id);
  const others = sel.studentEnrollments(db, me.id).filter((e) => e.id !== enr.id);
  const requests = p.lessons.filter((l) => l.rescheduleRequest?.status === 'pending' && l.rescheduleRequest.expiresAt > t);
  const c = sel.course(db, enr.offeringId);

  let badge;
  if (enr.status === 'completed') badge = <Badge tone="success">Completed</Badge>;
  else if (enr.status === 'cancelled') badge = <Badge tone="danger">Cancelled</Badge>;
  else if (p.next) badge = <Badge tone="info">Lesson {p.next.index} next</Badge>;

  const accept = (lessonId: string) => {
    setPendingAccept(lessonId);
    const timer = window.setTimeout(() => {
      acceptReschedule(lessonId);
      setPendingAccept(null);
    }, 5000);
    toast('New time accepted', {
      icon: 'check',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          window.clearTimeout(timer);
          setPendingAccept(null);
        },
      },
    });
  };

  return (
    <Screen title="Learning" noNav>
      <div className="stack">
        <h1 className="t-large-title" style={{ paddingTop: 8 }}>
          Learning
        </h1>
        <section className="card" aria-labelledby="course-h">
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <h2 id="course-h" className="t-headline" style={{ fontSize: '1.06rem' }}>
              {off.title}
            </h2>
            {badge}
          </div>
          <p className="t-subhead c-secondary">
            {p.taught} of {p.total} lesson{p.total === 1 ? '' : 's'} done{p.skills.length ? ` · ${p.confirmed} of ${p.skills.length} skills confirmed` : ''}
          </p>
          {enr.status === 'active' && p.next && (
            <div className="kv t-body">
              <span>Next lesson</span>
              <span>{fmtDateTime(p.next.scheduledAt)}</span>
            </div>
          )}
          {enr.status === 'completed' && last && (
            <div className="kv t-body">
              <span>Finished</span>
              <span>{fmtDate(last.taughtAt ?? last.scheduledAt)}</span>
            </div>
          )}
          {enr.status === 'cancelled' && (
            <div className="kv t-body">
              <span>Cancelled {enr.cancelledAt ? fmtMonthDay(enr.cancelledAt) : ''}</span>
              <span>{fmt(enr.refundCents ?? 0)} refunded</span>
            </div>
          )}
        </section>
        {others.length > 0 && (
          <div className="chips chips--scroll" role="group" aria-label="Your courses">
            {[enr, ...others].map((e) => (
              <button key={e.id} type="button" className={`chip${e.id === enr.id ? ' chip--selected' : ''}`} aria-pressed={e.id === enr.id} onClick={() => navigate(`/s/learning/${e.id}`, { replace: true, dir: 'none' })}>
                <span className="chip__face">{sel.offering(db, e.offeringId)?.title}</span>
              </button>
            ))}
          </div>
        )}
        {requests.map((l) => (
          <section key={l.id} className="card" aria-label={`Reschedule request for lesson ${l.index}`}>
            <p className="t-headline">
              {tFirst} asked to move Lesson {l.index}
            </p>
            <p className="t-subhead c-secondary">
              {fmtDateTime(l.scheduledAt)} to {fmtDateTime(l.rescheduleRequest!.proposedAt)}
              {l.rescheduleRequest!.message ? ` · "${l.rescheduleRequest!.message}"` : ''}
            </p>
            {pendingAccept === l.id ? (
              <p className="t-subhead c-success">Accepted. Moving the lesson…</p>
            ) : (
              <div className="hstack">
                <Button small auto onClick={() => accept(l.id)}>
                  Accept
                </Button>
                <Button small auto variant="gray" onClick={() => navigate(`/messages/${getOrCreateThread(me.id, enr.teacherId)}`)}>
                  Other times
                </Button>
              </div>
            )}
          </section>
        ))}
        {enr.status === 'completed' && (
          <section className="card" style={{ gap: 12 }} aria-labelledby="next-h">
            <h2 id="next-h" className="t-headline" style={{ fontSize: '1.06rem' }}>
              What next?
            </h2>
            {reviewed ? <p className="t-body c-success">Thanks for your review</p> : <p className="t-body c-secondary">Leave {tFirst} a review, or book their next course. Your notes and materials stay here.</p>}
            {!reviewed && <Button onClick={() => setReviewing(true)}>Review {tFirst}</Button>}
            <Button variant="gray" onClick={() => navigate(`/s/teacher/${enr.teacherId}`)}>
              See next course
            </Button>
          </section>
        )}
        {notes[0] && (
          <button type="button" className="card card--note" style={{ textAlign: 'left', width: '100%' }} onClick={() => navigate(`/s/learning/${enr.id}/lesson/${notes[0].id}`)}>
            <span className="hstack t-subhead-em" style={{ color: 'var(--accent-gold-text)', fontSize: '1rem' }}>
              <Icon name="bubble.left" size={20} />
              Note from {tFirst} · {fmtMonthDay(notes[0].noteAt!)}
            </span>
            <span className="t-body" style={{ fontSize: '1.06rem', lineHeight: 1.35 }}>
              {notes[0].note}
            </span>
          </button>
        )}
        {assignments.length > 0 && (
          <section className="stack-6">
            <Group label="Practice this week" labelId="prac-h">
              {assignments.map((a) => {
                const days = sel.daysLoggedThisWeek(db, a.id, t);
                return (
                  <ListRow
                    key={a.id}
                    title={`${a.title}${a.minutesPerDay ? `, ${a.minutesPerDay} minutes a day` : ''}`}
                    subtitle={`Assigned by ${tFirst} · ${days ? `${days} of ${a.daysPerWeek ?? 5} days logged` : 'not started'}`}
                    value="Log"
                    chevron
                    onClick={() => setLogFor(a)}
                  />
                );
              })}
            </Group>
            <p className="helper">Practice you log is visible to {tFirst}. It does not count as a confirmed skill until they check it in a lesson.</p>
          </section>
        )}
        {p.skills.length > 0 && (
          <section className="stack-6" aria-labelledby="skills-h">
            <h2 id="skills-h" className="section-label">
              Skills
            </h2>
            <div className="group">
              {p.skills.map((s, i) => {
                const rec = sel.skillState(db, enr, i);
                const state = rec?.state ?? 'upcoming';
                const firstLesson = c?.curriculum.find((x) => x.milestone === s)?.index;
                const logs = assignments.reduce((n, a) => n + sel.logsOf(db, a.id).length, 0);
                const status =
                  state === 'confirmed'
                    ? `Confirmed by ${tFirst} · ${fmtMonthDay(rec!.confirmedAt!)}`
                    : state === 'practicing'
                      ? logs
                        ? `Practicing · you logged ${logs} practice session${logs === 1 ? '' : 's'}`
                        : 'Practicing · waiting for your teacher to confirm'
                      : `Starts in lesson ${firstLesson ?? '—'}`;
                return <MilestoneRow key={s} title={s} state={state} status={status} />;
              })}
            </div>
          </section>
        )}
        <section className="stack-6" aria-labelledby="lessons-h">
          <h2 id="lessons-h" className="section-label">
            Lessons
          </h2>
          <div className="group">
            {p.lessons.map((l) => {
              const item = c?.curriculum.find((x) => x.index === l.index);
              const sub =
                l.status === 'taught'
                  ? `${fmtDate(l.scheduledAt)} · Taught${l.note ? ' · notes' : ''}`
                  : l.status === 'cancelled'
                    ? `${fmtDate(l.scheduledAt)} · Cancelled, refunded`
                    : `${fmtDateTime(l.scheduledAt)}${l.rescheduleRequest?.status === 'pending' ? ' · move requested' : ''}`;
              return (
                <ListRow
                  key={l.id}
                  title={`Lesson ${l.index}${item ? ` · ${item.title}` : ''}`}
                  subtitle={sub}
                  chevron={l.status === 'taught'}
                  onClick={l.status === 'taught' ? () => navigate(`/s/learning/${enr.id}/lesson/${l.id}`) : undefined}
                />
              );
            })}
          </div>
        </section>
        <div className="group">
          <ListRow title={`Message ${tFirst}`} chevron onClick={() => navigate(`/messages/${getOrCreateThread(me.id, enr.teacherId)}`)} />
          <ListRow title="Course details" chevron onClick={() => navigate(`/s/course/${off.id}`)} />
          {enr.status === 'active' && <ListRow title="Cancel course" destructive chevron onClick={() => navigate(`/s/learning/${enr.id}/cancel`)} />}
        </div>
      </div>
      <LogPracticeSheet assignment={logFor} onClose={() => setLogFor(null)} />
      <ReviewSheet db={db} enr={enr} open={reviewing} onClose={() => setReviewing(false)} />
    </Screen>
  );
}

/* ---------- S16 Lesson Notes ---------- */
export function S16LessonNotes({ params }: ScreenProps) {
  const { db, me } = useMe();
  const [logFor, setLogFor] = useState<PracticeAssignment | null>(null);
  const enr = sel.enrollment(db, params.enrollmentId);
  const lesson = sel.lesson(db, params.lessonId);
  const ok = !!enr && !!lesson && enr.studentUserId === me.id && lesson.enrollmentId === enr.id && lesson.status === 'taught';
  useEffect(() => {
    if (!ok) navigate(enr ? `/s/learning/${enr.id}` : '/s/learning', { replace: true });
  }, [ok, enr]);
  if (!ok) return null;
  const teacher = sel.user(db, enr!.teacherId);
  const tFirst = sel.firstName(teacher?.name ?? 'Your teacher');
  const c = sel.course(db, enr!.offeringId);
  const item = c?.curriculum.find((x) => x.index === lesson!.index);
  const off = sel.offering(db, enr!.offeringId)!;
  const skillIdx = sel.skillIndexForLesson(c, lesson!.index);
  const skills = sel.skillsOf(c);
  const rec = skillIdx >= 0 ? sel.skillState(db, enr!, skillIdx) : undefined;
  const assignments = db.assignments.filter((a) => a.lessonId === lesson!.id);
  return (
    <Screen title={`Lesson ${lesson!.index} of ${off.lessonCount}`} navTitle ownHeading back>
      <div className="stack">
        <div className="title-block">
          <h1 className="t-title1">{item?.title ?? off.title}</h1>
          <p className="t-body c-secondary">
            {fmtDate(lesson!.scheduledAt)} · {fmtRange(lesson!.scheduledAt, lesson!.durationMin)} · {enr!.format === 'online' ? 'Online' : 'In person'} with {teacher?.name}
          </p>
        </div>
        {lesson!.note ? (
          <section className="card card--note" aria-label={`Note from ${tFirst}`}>
            <p className="hstack t-subhead-em" style={{ color: 'var(--accent-gold-text)', fontSize: '1rem' }}>
              <Icon name="bubble.left" size={20} />
              Note from {tFirst} · {fmtDate(lesson!.noteAt!)}
            </p>
            <p className="t-body" style={{ fontSize: '1.06rem', lineHeight: 1.35 }}>
              {lesson!.note}
            </p>
          </section>
        ) : (
          <InlineAlert tone="info" title="No notes yet">
            {tFirst} has not shared notes for this lesson yet.
          </InlineAlert>
        )}
        {skillIdx >= 0 && (
          <section className="stack-6">
            <h2 className="section-label">{rec?.state === 'confirmed' ? 'Skill confirmed in this lesson' : 'Skill from this lesson'}</h2>
            <div className="group">
              <MilestoneRow
                title={skills[skillIdx]}
                state={rec?.state ?? 'practicing'}
                status={rec?.state === 'confirmed' ? `Confirmed by ${tFirst} · ${fmtMonthDay(rec.confirmedAt!)}` : 'Practicing · not confirmed yet'}
              />
            </div>
          </section>
        )}
        {assignments.length > 0 && (
          <Group label="Practice assigned" labelId="pa-h">
            {assignments.map((a) => (
              <ListRow key={a.id} title={a.title} subtitle={[a.minutesPerDay && `${a.minutesPerDay} minutes a day`, a.daysPerWeek && `${a.daysPerWeek} days`].filter(Boolean).join(' · ') || 'Practice'} value="Log" chevron onClick={() => setLogFor(a)} />
            ))}
          </Group>
        )}
        {lesson!.materials.length > 0 && (
          <section className="stack-6">
            <Group label="Materials" labelId="mat-h">
              {lesson!.materials.map((m) => (
                <ListRow key={m.title} title={m.title} subtitle={`${m.kind} · ${m.detail}`} value="Open" chevron label={`${m.title}, ${m.kind} file`} onClick={() => toast('Materials are placeholders in the prototype.', { icon: 'info' })} />
              ))}
            </Group>
            <p className="helper">Materials stay available after the course ends.</p>
          </section>
        )}
      </div>
      <LogPracticeSheet assignment={logFor} onClose={() => setLogFor(null)} />
    </Screen>
  );
}

/* ---------- Lesson room placeholder (both roles) ---------- */
export function LessonRoom({ params }: ScreenProps) {
  const { db } = useMe();
  const l = sel.lesson(db, params.lessonId);
  const enr = l ? sel.enrollment(db, l.enrollmentId) : undefined;
  const teacher = enr ? sel.user(db, enr.teacherId) : undefined;
  const student = enr ? sel.user(db, enr.studentUserId) : undefined;
  return (
    <Screen title="Lesson room" navTitle back>
      <div className="lesson-room">
        <div className="stack-12" style={{ alignItems: 'center' }}>
          <Icon name="video" size={44} />
          <p className="t-headline">Lesson {l?.index ?? ''} · {teacher?.name} and {student?.name}</p>
          <p className="t-subhead" style={{ opacity: 0.8 }}>
            Video lessons are not in the prototype. In the app, this opens the Scale video room {l ? `at ${fmtDateTime(l.scheduledAt)}` : ''}.
          </p>
        </div>
      </div>
      <p className="helper">It is now {fmtDateTime(now())} on the demo clock.</p>
    </Screen>
  );
}
