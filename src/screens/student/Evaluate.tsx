// Flow 03: S07 Teacher Profile, S08 Course Details (+ No Open Times, Enrolled, Preview), S09 Reviews.
import { useEffect, useState } from 'react';
import { ActionSheet, BottomMeta, GlassButton, Screen } from '../../layout/layout';
import { Badge, Button, Group, InlineAlert, ListRow, Segmented, Stars } from '../../components/ui';
import { ReportSheet } from '../../components/ReportSheet';
import { Avatar } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { share, useMe, type ScreenProps } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { agoLong, fmtHM, now, WEEKDAYS } from '../../data/clock';
import { fmt, fmtShort } from '../../data/money';
import { toast } from '../../data/ui';
import { getOrCreateThread, requestOpenTimeAlert, toggleSaveTeacher } from '../../services';
import type { DB, Review } from '../../data/schema';

function ReviewCard({ r, showCourse }: { r: Review; showCourse?: boolean }) {
  return (
    <article className="card" aria-label={`${r.rating} out of 5 stars, ${r.studentFirstName}`}>
      <div className="spread">
        <span className="t-headline">{r.studentFirstName}</span>
        <span className="t-subhead c-secondary">{agoLong(r.createdAt)}</span>
      </div>
      <Stars n={r.rating} />
      {r.text && <p className="t-body c-secondary">{r.text}</p>}
      {showCourse && <p className="t-footnote c-secondary">Took {r.offeringTitle}</p>}
    </article>
  );
}

const notAvailable = () => {
  toast('That page is not available', { icon: 'info' });
  navigate('/s/home', { replace: true });
};

export function S07TeacherProfile({ params }: ScreenProps) {
  const { db, me } = useMe();
  const id = params.teacherId;
  const u = sel.user(db, id);
  const tp = sel.teacherProfile(db, id);
  const offs = sel.publishedOfferings(db, id).sort((a, b) => (a.type === 'single' ? 1 : 0) - (b.type === 'single' ? 1 : 0) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  const ok = !!u && !!tp && offs.length > 0;
  useEffect(() => {
    if (!ok) notAvailable();
  }, [ok]);
  const [more, setMore] = useState(false);
  const [report, setReport] = useState(false);
  if (!ok) return null;
  const sp = sel.studentProfile(db, me.id);
  const saved = !!sp?.savedTeacherIds.includes(id);
  const r = sel.rating(db, id);
  const reviews = db.reviews.filter((x) => x.teacherId === id).sort((a, b) => b.createdAt - a.createdAt);
  const featured = offs.find((o) => o.type !== 'single') ?? offs[0];
  const t = now();
  const where = tp!.formats === 'online' ? 'Online' : tp!.city;
  return (
    <Screen
      title={u!.name}
      back
      trailing={
        <>
          <GlassButton
            icon={saved ? 'heart.fill' : 'heart'}
            label={saved ? `Saved. Remove ${u!.name} from saved teachers` : `Save ${u!.name}`}
            pressed={saved}
            onClick={() => toast(toggleSaveTeacher(me.id, id) ? 'Saved to your teachers' : 'Removed from saved', { icon: 'check' })}
          />
          <GlassButton icon="ellipsis" label="More" onClick={() => setMore(true)} />
        </>
      }
      bottom={
        <div className="bottombar__row">
          <Button variant="gray" onClick={() => navigate(`/messages/${getOrCreateThread(me.id, id)}`)}>
            Message
          </Button>
          <Button onClick={() => navigate(`/s/course/${featured.id}`)}>View course</Button>
        </div>
      }
    >
      <div className="stack">
        <div className="stack-8" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar initials={sel.initials(u!.name)} large />
          <h1 className="t-title1" style={{ fontSize: '1.9rem', marginTop: 4 }}>
            {u!.name}
          </h1>
          <p className="t-body c-secondary">
            Independent {tp!.instruments[0]?.toLowerCase()} teacher · {where}
          </p>
          <div className="hstack wrap" style={{ justifyContent: 'center' }}>
            {tp!.idStatus === 'passed' && <Badge tone="success">ID verified</Badge>}
            {tp!.backgroundCheck === 'passed' && <Badge tone="success">Background check</Badge>}
            {!r.show && <Badge tone="gold">New teacher</Badge>}
            {tp!.teachingSince && <span className="t-subhead c-secondary">Teaching since {tp!.teachingSince}</span>}
          </div>
        </div>
        <div className="card" style={{ flexDirection: 'row', justifyContent: 'space-between', textAlign: 'center' }}>
          <div className="stack-6" style={{ gap: 0, flex: 1 }} aria-label={r.show ? `Rated ${sel.fmtRating(r.avg)} out of 5, ${r.count} reviews` : 'New teacher, fewer than 3 reviews'}>
            <span className="t-headline" style={{ fontSize: '1.15rem' }}>
              {r.show ? sel.fmtRating(r.avg) : 'New'}
            </span>
            <span className="t-footnote c-secondary">{r.show ? `${r.count} reviews` : 'teacher'}</span>
          </div>
          <div className="stack-6" style={{ gap: 0, flex: 1 }}>
            <span className="t-headline" style={{ fontSize: '1.15rem' }}>
              {sel.lessonsTaught(db, id)}
            </span>
            <span className="t-footnote c-secondary">lessons taught</span>
          </div>
          <div className="stack-6" style={{ gap: 0, flex: 1 }}>
            <span className="t-headline" style={{ fontSize: '1.15rem' }}>
              {tp!.replyTime ?? '—'}
            </span>
            <span className="t-footnote c-secondary">reply time</span>
          </div>
        </div>
        <Group label="Offerings" labelId="off-h">
          {offs.map((o) => (
            <ListRow
              key={o.id}
              title={o.title}
              subtitle={o.type === 'single' ? `${o.lessonMinutes} min · from ${fmtShort(o.pricePerLessonCents)}` : `Course · ${o.lessonCount} lessons · ${fmtShort(sel.offeringTotal(o))}`}
              value={o.type !== 'single' && sel.isNewCourse(o, t) ? 'New' : 'Book'}
              chevron
              onClick={() => navigate(`/s/course/${o.id}`)}
            />
          ))}
        </Group>
        {tp!.bio && (
          <section className="card" aria-labelledby="about-h">
            <h2 id="about-h" className="t-headline">
              About
            </h2>
            <p className="t-body c-secondary" style={{ fontSize: '1.06rem', lineHeight: 1.35 }}>
              {tp!.bio}
            </p>
          </section>
        )}
        {reviews.length > 0 && (
          <section className="stack-12" aria-labelledby="rev-h">
            <div className="spread">
              <h2 id="rev-h" className="section-title">
                Reviews
              </h2>
              <button type="button" className="t-body" style={{ minHeight: 44 }} onClick={() => navigate(`/s/teacher/${id}/reviews`)}>
                See all {reviews.length}
              </button>
            </div>
            {reviews.slice(0, 2).map((x) => (
              <ReviewCard key={x.id} r={x} />
            ))}
          </section>
        )}
      </div>
      <ActionSheet
        open={more}
        onCancel={() => setMore(false)}
        actions={[
          {
            label: 'Share profile',
            onClick: () => {
              setMore(false);
              share(`${u!.name} on Scale`, `/s/teacher/${id}`, () => toast('Link copied', { icon: 'check' }));
            },
          },
          {
            label: 'Report',
            destructive: true,
            onClick: () => {
              setMore(false);
              setReport(true);
            },
          },
          { label: 'Cancel', bold: true, onClick: () => setMore(false) },
        ]}
      />
      <ReportSheet open={report} onClose={() => setReport(false)} reporterId={me.id} subjectUserId={id} subjectName={u!.name} context="Profile" />
    </Screen>
  );
}

export function CourseDetails({ db, offeringId, preview, meId }: { db: DB; offeringId: string; preview?: boolean; meId: string }) {
  const off = sel.offering(db, offeringId);
  const enr = off ? sel.activeEnrollmentFor(db, meId, off.id) : undefined;
  const ok = !!off && (off.status === 'published' || !!enr || preview);
  const [showAll, setShowAll] = useState(false);
  const [notified, setNotified] = useState(() => db.openTimeAlerts.some((a) => a.studentUserId === meId && a.offeringId === offeringId));
  useEffect(() => {
    if (!ok) notAvailable();
  }, [ok]);
  if (!ok || !off) return null;
  const t = now();
  const teacher = sel.user(db, off.teacherId)!;
  const tp = sel.teacherProfile(db, off.teacherId)!;
  const c = sel.course(db, off.id);
  const r = sel.rating(db, off.teacherId);
  const open = sel.openCount(db, off, t, meId);
  const total = sel.offeringTotal(off);
  const skills = sel.skillsOf(c);
  const items = c?.curriculum ?? [];
  const lessonsShown = showAll ? items : items.slice(0, 4);
  const first = sel.firstName(teacher.name);
  const isCourse = off.type !== 'single';
  const levelSub = off.level === 'beginner' ? 'No experience needed' : off.level === 'intermediate' ? 'You know a few songs' : 'You play regularly';

  let bottom;
  if (preview) {
    bottom = (
      <>
        <BottomMeta left={`${fmtShort(total)} · ${off.lessonCount} lesson${off.lessonCount === 1 ? '' : 's'}`} right={<span className="c-success">{open} weekly times open</span>} />
        <Button disabled describedBy="preview-note">
          Choose a weekly time
        </Button>
        <p id="preview-note" className="bottombar__note">
          Preview: booking is disabled.
        </p>
      </>
    );
  } else if (enr) {
    bottom = (
      <>
        <BottomMeta left="You're enrolled" right={<span className="c-success">{WEEKDAYS[enr.weekday]}s at {fmtHM(enr.startTime)}</span>} />
        <Button onClick={() => navigate(`/s/learning/${enr.id}`)}>Go to your course</Button>
      </>
    );
  } else if (open === 0) {
    bottom = (
      <>
        <BottomMeta left={`${fmtShort(total)} · ${off.lessonCount} lessons`} right={<span className="c-warning">No weekly times open</span>} />
        <Button
          variant="gray"
          disabled={notified}
          onClick={() => {
            requestOpenTimeAlert(meId, off.id);
            setNotified(true);
            toast('We will notify you when a time opens', { icon: 'check' });
          }}
        >
          {notified ? 'We will notify you' : 'Notify me when a time opens'}
        </Button>
        <p className="bottombar__note">
          {first} has {off.capacity} students at capacity. You get one notification when a time opens; it is not held for you.
        </p>
      </>
    );
  } else {
    bottom = (
      <>
        <BottomMeta left={`${fmtShort(total)} · ${off.lessonCount} lesson${off.lessonCount === 1 ? '' : 's'}`} right={<span className="c-success">{open} weekly time{open === 1 ? '' : 's'} open</span>} />
        <Button onClick={() => navigate(`/s/book/${off.id}/time`)}>Choose a weekly time</Button>
      </>
    );
  }

  return (
    <Screen title={off.title} back bottom={bottom}>
      <div className="stack">
        {preview && (
          <div className="preview-banner">
            <InlineAlert tone="info" title="Preview">
              This is what students see. Booking is disabled.
            </InlineAlert>
          </div>
        )}
        <div className="stack-8">
          <span>{enr ? <Badge tone="success">Enrolled</Badge> : sel.isNewCourse(off, t) || preview ? <Badge tone="gold">New</Badge> : null}</span>
          <h1 className="t-title1" style={{ fontSize: '1.9rem' }}>
            {off.title}
          </h1>
          <button type="button" className="t-body c-secondary" style={{ textAlign: 'left', minHeight: 32 }} onClick={() => !preview && navigate(`/s/teacher/${teacher.id}`)} aria-label={`with ${teacher.name}${r.show ? `, rated ${sel.fmtRating(r.avg)} out of 5, ${r.count} reviews` : ''}. Opens profile.`}>
            with {teacher.name}
            {r.show ? ` · ${sel.fmtRating(r.avg)} ★ (${r.count})` : ' · New teacher'}
          </button>
          <p className="t-body" style={{ fontSize: '1.06rem' }}>
            {off.description}
          </p>
        </div>
        <div className="group">
          <ListRow title={`One-on-one, ${off.lessonMinutes} minutes`} subtitle={isCourse ? `Once a week for ${off.lessonCount} weeks` : 'A single lesson at a weekly time'} />
          <ListRow title={off.format === 'either' ? `Online or in ${tp.city.replace(/, TX$/, '')}` : sel.formatLabel(off.format, tp.city)} subtitle={off.format === 'either' ? 'Choose when you book' : off.format === 'online' ? 'Scale video link' : `Studio in ${tp.serviceArea ?? tp.city}`} />
          <ListRow title={sel.LEVEL_LABEL[off.level]} subtitle={levelSub} />
        </div>
        {skills.length > 0 && (
          <section className="stack-6" aria-labelledby="outcomes-h">
            <h2 id="outcomes-h" className="section-label">
              What you'll be able to do
            </h2>
            <ul className="group">
              {skills.map((s) => (
                <li key={s} className="row row--single" style={{ gap: 14 }}>
                  <span className="c-success">
                    <Icon name="checkmark" size={18} />
                  </span>
                  <span className="row__title">{s}</span>
                </li>
              ))}
            </ul>
            <p className="helper">{first} confirms each skill with you during lessons. These become your milestones.</p>
          </section>
        )}
        {items.length > 0 && (
          <section className="stack-6" aria-labelledby="curr-h">
            <h2 id="curr-h" className="section-label">
              Curriculum
            </h2>
            <div className="group">
              <ol>
                {lessonsShown.map((l) => (
                  <li key={l.index} className="row" style={{ position: 'relative' }}>
                    <span className="row__text">
                      <span className="row__title">
                        {l.index}. {l.title}
                      </span>
                      <span className="row__subtitle">{off.lessonMinutes} min</span>
                    </span>
                  </li>
                ))}
              </ol>
              {items.length > 4 && (
                <ListRow
                  title={showAll ? 'Show fewer lessons' : `Show all ${items.length} lessons`}
                  subtitle={showAll ? undefined : `Lessons 5 to ${items.length}`}
                  value={showAll ? undefined : `${items.length - 4} more`}
                  chevron
                  onClick={() => setShowAll((s) => !s)}
                />
              )}
            </div>
          </section>
        )}
        <section className="card" aria-labelledby="before-h">
          <h2 id="before-h" className="t-headline">
            Before you start
          </h2>
          <p className="t-body c-secondary">{off.beforeYouStart ?? `Bring your instrument. No instrument yet? Ask ${first} in Messages before booking and they will suggest a starter model.`}</p>
        </section>
        <section className="card" aria-labelledby="cancel-h">
          <h2 id="cancel-h" className="t-headline">
            Cancellation and refunds
          </h2>
          <p className="t-body c-secondary">
            Free cancellation until 24 hours before lesson 1. After that, untaught lessons are refunded at {fmt(off.pricePerLessonCents)} each when you cancel more than 24 hours before the next lesson.
          </p>
        </section>
        {r.count > 0 && !preview && (
          <div className="group">
            <ListRow title="Reviews" subtitle={r.show ? `${sel.fmtRating(r.avg)} out of 5 from ${r.count} students` : `${r.count} review${r.count === 1 ? '' : 's'}`} chevron onClick={() => navigate(`/s/teacher/${teacher.id}/reviews`)} />
          </div>
        )}
      </div>
    </Screen>
  );
}

export function S08CourseDetails({ params }: ScreenProps) {
  const { db, me } = useMe();
  return <CourseDetails db={db} offeringId={params.offeringId} meId={me.id} />;
}

export function S09Reviews({ params }: ScreenProps) {
  const { db } = useMe();
  const [sort, setSort] = useState<'recent' | 'high' | 'low'>('recent');
  const id = params.teacherId;
  const teacher = sel.user(db, id);
  const all = db.reviews.filter((x) => x.teacherId === id);
  const r = sel.rating(db, id);
  const list = [...all].sort((a, b) => (sort === 'recent' ? b.createdAt - a.createdAt : sort === 'high' ? b.rating - a.rating || b.createdAt - a.createdAt : a.rating - b.rating || b.createdAt - a.createdAt));
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((n) => all.filter((x) => x.rating === n).length));
  return (
    <Screen title="Reviews" navTitle back>
      <div className="stack">
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
          <div className="center" aria-label={`${sel.fmtRating(r.avg)} out of 5, ${r.count} reviews`}>
            <p className="t-large-title" style={{ fontSize: '2.4rem' }}>
              {r.count ? sel.fmtRating(r.avg) : '–'}
            </p>
            <p className="t-subhead c-secondary">{r.count} reviews</p>
          </div>
          <div className="grow stack-6" aria-hidden="true">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = all.filter((x) => x.rating === n).length;
              return (
                <div key={n} className="hstack" style={{ gap: 10 }}>
                  <span className="t-footnote c-secondary" style={{ width: 10 }}>
                    {n}
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(c / max) * 100}%`, display: 'block' }} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <Segmented
          label="Sort reviews"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Most recent' },
            { value: 'high', label: 'Highest' },
            { value: 'low', label: 'Lowest' },
          ]}
        />
        <div className="stack-16">
          {list.map((x) => (
            <ReviewCard key={x.id} r={x} showCourse />
          ))}
        </div>
        <p className="helper">Only students who completed a booked lesson can leave a review. {sel.firstName(teacher?.name ?? 'The teacher')} can reply once.</p>
      </div>
    </Screen>
  );
}
