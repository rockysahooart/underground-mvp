// S03 Home: First Visit before the first booking (Flow 01), Home with a booking (Flow 07).
import { useState } from 'react';
import { GlassButton, Screen } from '../../layout/layout';
import { Button, EmptyState, Group, InlineAlert, ListRow, SectionHeader } from '../../components/ui';
import { CourseCard, TeacherCard } from '../../components/cards';
import { useMe } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { fmtDateTime, greeting } from '../../data/clock';
import { useNow } from '../../data/ui';
import { LogPracticeSheet } from './Learning';
import type { DB, PracticeAssignment } from '../../data/schema';

function Header({ db, userId }: { db: DB; userId: string }) {
  const unread = sel.unreadCount(db, userId, 'student');
  return (
    <div className="header-row">
      <p className="t-wordmark" aria-label="Scale">
        Scale
      </p>
      <GlassButton icon="bell" label={unread ? `Notifications, ${unread} unread` : 'Notifications'} badge={unread > 0} onClick={() => navigate('/notifications')} />
    </div>
  );
}

export function S03Home() {
  const { db, me } = useMe();
  const active = sel.studentEnrollments(db, me.id).filter((e) => e.status === 'active');
  return active.length ? <HomeBooked /> : <HomeFirstVisit />;
}

function HomeFirstVisit() {
  const { db, me } = useMe();
  const sp = sel.studentProfile(db, me.id)!;
  const level = sel.studentLevelToLevel(sp.level);
  const instr = sp.instruments.map((i) => i.toLowerCase());
  const matchesInstr = (s: string) => !instr.length || instr.some((i) => s.toLowerCase().includes(i));
  const courses = db.offerings.filter((o) => o.status === 'published' && o.type !== 'single' && matchesInstr(o.instrument) && o.level === level).sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  const teachers = [...new Set(db.offerings.filter((o) => o.status === 'published').map((o) => o.teacherId))]
    .filter((id) => {
      const tp = sel.teacherProfile(db, id);
      return tp?.setupComplete && tp.instruments.some(matchesInstr) && tp.levels.includes(level);
    })
    .sort((a, b) => sel.rating(db, b).count - sel.rating(db, a).count)
    .slice(0, 3);
  const picks = [...sp.instruments, ...sp.genres, sel.STUDENT_LEVEL_LABEL[sp.level], sp.format === 'either' ? 'Online or in person' : sp.format === 'online' ? 'Online' : 'In person'];
  const levelWord = sel.LEVEL_LABEL[level].toLowerCase();
  return (
    <Screen title="Home" noNav>
      <div className="stack">
        <div className="stack-12">
          <Header db={db} userId={me.id} />
          <h1 className="t-title1">Welcome, {sel.firstName(me.name)}</h1>
        </div>
        <section className="card" aria-labelledby="picks-h">
          <div className="spread">
            <h2 id="picks-h" className="t-headline" style={{ fontSize: '1.06rem' }}>
              Your picks
            </h2>
            <button type="button" className="link-btn" style={{ minHeight: 32 }} onClick={() => navigate('/s/onboarding/interests')} aria-label="Edit your picks">
              Edit
            </button>
          </div>
          <div className="hstack wrap">
            {picks.map((p) => (
              <span key={p} className="tag">
                {p}
              </span>
            ))}
          </div>
        </section>
        {!courses.length && !teachers.length ? (
          <EmptyState
            inCard
            icon="magnifyingglass"
            title="No matches yet"
            message="Nothing matches your picks right now. Try another instrument or level, or browse everything in Discover."
            action={<Button onClick={() => navigate('/s/onboarding/interests')}>Edit your picks</Button>}
          />
        ) : null}
        {courses.length > 0 && (
          <section className="stack-12">
            <SectionHeader title={`Start with a ${levelWord} course`} />
            {courses.slice(0, 3).map((o) => (
              <CourseCard key={o.id} db={db} off={o} onOpen={() => navigate(`/s/course/${o.id}`)} />
            ))}
          </section>
        )}
        {teachers.length > 0 && (
          <section className="stack-12">
            <SectionHeader title={`Teachers who take ${levelWord}s`} />
            {teachers.map((id) => (
              <TeacherCard key={id} db={db} teacherId={id} onOpen={() => navigate(`/s/teacher/${id}`)} />
            ))}
          </section>
        )}
      </div>
    </Screen>
  );
}

function HomeBooked() {
  const { db, me } = useMe();
  const t = useNow(15000);
  const [logFor, setLogFor] = useState<PracticeAssignment | null>(null);
  const active = sel.studentEnrollments(db, me.id).filter((e) => e.status === 'active');
  const upcoming = active
    .map((e) => ({ e, l: sel.nextLessonOf(db, e.id) }))
    .filter((x) => x.l)
    .sort((a, b) => a.l!.scheduledAt - b.l!.scheduledAt);
  const next = upcoming[0];
  const assignments = active.flatMap((e) => sel.assignmentsOf(db, e.id).slice(0, 2));
  const requests = active.flatMap((e) => sel.lessonsOf(db, e.id).filter((l) => l.rescheduleRequest?.status === 'pending' && l.rescheduleRequest.expiresAt > t).map((l) => ({ e, l })));
  const enrolledOffers = new Set(sel.studentEnrollments(db, me.id).map((e) => e.offeringId));
  const sp = sel.studentProfile(db, me.id)!;
  const level = sel.studentLevelToLevel(sp.level);
  const more = db.offerings.filter((o) => o.status === 'published' && o.type !== 'single' && !enrolledOffers.has(o.id) && o.level === level).slice(0, 2);

  let upNext = null;
  if (next) {
    const off = sel.offering(db, next.e.offeringId)!;
    const teacher = sel.user(db, next.e.teacherId);
    const item = sel.curriculumItem(db, next.e, next.l!.index);
    const joinOpen = t >= next.l!.scheduledAt - 10 * 60000 && t <= next.l!.scheduledAt + next.l!.durationMin * 60000;
    const shortTitle = item?.title.split(':')[0];
    upNext = (
      <section className="card card--dark" style={{ gap: 12 }} aria-labelledby="upnext-h">
        <button type="button" className="stack-6" style={{ textAlign: 'left', color: 'inherit' }} onClick={() => navigate(`/s/learning/${next.e.id}`)} aria-describedby="upnext-meta">
          <span className="t-footnote" style={{ textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Up next
          </span>
          <span id="upnext-h" className="t-title2">
            Lesson {next.l!.index}
            {shortTitle ? ` · ${shortTitle}` : ` · ${off.title}`}
          </span>
          <span id="upnext-meta" className="t-subhead">
            {fmtDateTime(next.l!.scheduledAt)} · {next.e.format === 'online' ? 'Online' : 'In person'} with {teacher?.name ?? 'your teacher'}
          </span>
        </button>
        <span style={{ display: 'block' }}>
          {joinOpen ? (
            <Button variant="gray-elevated" onClick={() => navigate(`/s/lesson-room/${next.l!.id}`)}>
              Join lesson
            </Button>
          ) : (
            <Button variant="gray-elevated" disabled describedBy="join-hint">
              Join opens 10 min before
            </Button>
          )}
          <span id="join-hint" className="sr-only">
            Join is available from 10 minutes before the lesson starts.
          </span>
        </span>
      </section>
    );
  }

  return (
    <Screen title="Home" noNav>
      <div className="stack">
        <div className="stack-12">
          <Header db={db} userId={me.id} />
          <h1 className="t-title1">
            {greeting(t)}, {sel.firstName(me.name)}
          </h1>
        </div>
        {upNext}
        {requests.map(({ e, l }) => {
          const teacher = sel.user(db, e.teacherId);
          return (
            <InlineAlert key={l.id} tone="info" title={`${sel.firstName(teacher?.name ?? 'Your teacher')} asked to move Lesson ${l.index}`}>
              {fmtDateTime(l.scheduledAt)} to {fmtDateTime(l.rescheduleRequest!.proposedAt)}.{' '}
              <button type="button" className="semibold" style={{ textDecoration: 'underline', color: 'inherit' }} onClick={() => navigate('/notifications')}>
                Answer in Notifications
              </button>
            </InlineAlert>
          );
        })}
        {assignments.length > 0 && (
          <Group label="Keep practicing" labelId="kp">
            {assignments.map((a) => (
              <ListRow
                key={a.id}
                title={a.title}
                subtitle={`${sel.daysLoggedThisWeek(db, a.id, t)} of ${a.daysPerWeek ?? 5} days this week`}
                value="Log"
                chevron
                onClick={() => setLogFor(a)}
              />
            ))}
          </Group>
        )}
        {more.length > 0 && (
          <section className="stack-12">
            <SectionHeader title={`More for ${sel.LEVEL_LABEL[level].toLowerCase()}s`} />
            {more.map((o) => (
              <CourseCard key={o.id} db={db} off={o} onOpen={() => navigate(`/s/course/${o.id}`)} />
            ))}
          </section>
        )}
        {!more.length && (
          <Button variant="gray-elevated" onClick={() => navigate('/s/discover')}>
            Find another course
          </Button>
        )}
      </div>
      <LogPracticeSheet assignment={logFor} onClose={() => setLogFor(null)} />
    </Screen>
  );
}
