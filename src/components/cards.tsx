// Teacher Card and Course Card (chapter 07): one element for screen readers, tap opens S07 / S08.
import type { DB, Offering } from '../data/schema';
import * as sel from '../data/selectors';
import { fmt, fmtShort } from '../data/money';
import { now } from '../data/clock';
import { Avatar, Badge } from './ui';
import { Icon } from './Icon';

export function TeacherCard({ db, teacherId, onOpen }: { db: DB; teacherId: string; onOpen: () => void }) {
  const u = sel.user(db, teacherId);
  const tp = sel.teacherProfile(db, teacherId);
  if (!u || !tp) return null;
  const r = sel.rating(db, teacherId);
  const price = sel.fromPrice(db, teacherId);
  const open = sel.teacherOpenSlots(db, teacherId, now()).some((s) => s.status === 'open');
  const where = tp.formats === 'online' ? 'Online' : tp.formats === 'in_person' ? 'In person' : 'Online + in person';
  const label = `${u.name}, ${tp.instruments.join(' and ')}, ${price !== undefined ? `from ${fmt(price)} per lesson` : ''}, ${r.show ? `rated ${sel.fmtRating(r.avg)} out of 5, ${r.count} reviews` : 'new teacher'}. Opens profile.`;
  return (
    <button type="button" className="card card--tap" onClick={onOpen} aria-label={label} style={{ gap: 12 }}>
      <span className="hstack" style={{ gap: 12, alignItems: 'flex-start' }}>
        <Avatar initials={sel.initials(u.name)} />
        <span className="grow stack-6" style={{ gap: 2 }}>
          <span className="t-headline">{u.name}</span>
          <span className="t-subhead c-secondary">
            {tp.instruments[0]} · {tp.city}
          </span>
          {r.show ? (
            <span className="hstack t-subhead" style={{ gap: 6 }}>
              <span style={{ color: 'var(--accent-gold)' }}>
                <Icon name="star.fill" size={15} />
              </span>
              {sel.fmtRating(r.avg)} <span className="c-secondary">({r.count} reviews)</span>
            </span>
          ) : (
            <span>
              <Badge tone="gold">New teacher</Badge>
            </span>
          )}
        </span>
        {price !== undefined && (
          <span className="stack-6" style={{ gap: 0, alignItems: 'flex-end', textAlign: 'right' }}>
            <span className="t-headline tabular" style={{ fontSize: '1.06rem' }}>
              {fmt(price)}
            </span>
            <span className="t-footnote c-secondary">from, per lesson</span>
          </span>
        )}
      </span>
      <span className="hstack wrap" style={{ gap: 8 }}>
        {tp.levels.includes('beginner') && <span className="tag">Beginner friendly</span>}
        <span className="tag">{where}</span>
        {open && <span className="tag tag--success">Open this week</span>}
      </span>
    </button>
  );
}

export function CourseMeta({ off }: { off: Offering }) {
  return (
    <span className="meta">
      <span>
        <Icon name="music.note" size={16} />
        {sel.LEVEL_LABEL[off.level]}
      </span>
      <span>
        <Icon name="clock" size={16} />
        {off.lessonCount} {off.lessonCount === 1 ? 'lesson' : 'weeks'} · {off.lessonMinutes} min
      </span>
      <span>
        <Icon name="video" size={16} />
        {sel.formatLabel(off.format)}
      </span>
    </span>
  );
}

export function CourseCard({ db, off, onOpen, static: isStatic }: { db: DB; off: Offering; onOpen?: () => void; static?: boolean }) {
  const t = now();
  const open = sel.openCount(db, off, t);
  const total = sel.offeringTotal(off);
  const isNew = off.status !== 'published' || sel.isNewCourse(off, t);
  const teacher = sel.user(db, off.teacherId);
  const label = `${off.title}, ${off.lessonCount}-lesson course with ${teacher?.name}, ${fmt(total)}, ${fmt(off.pricePerLessonCents)} per lesson, ${open} weekly times open. Opens course.`;
  const body = (
    <>
      <span className="spread" style={{ alignItems: 'flex-start' }}>
        <span className="t-title2" style={{ maxWidth: '78%' }}>
          {off.title || 'Untitled course'}
        </span>
        {isNew && <Badge tone="gold">New</Badge>}
      </span>
      <CourseMeta off={off} />
      <span className="spread" style={{ marginTop: 6, alignItems: 'baseline' }}>
        <span className="t-headline" style={{ fontSize: '1.06rem' }}>
          {fmtShort(total)} for {off.lessonCount} lesson{off.lessonCount === 1 ? '' : 's'}
        </span>
        <span className={`t-subhead ${open ? 'c-success' : 'c-warning'}`}>{open ? `${open} weekly time${open === 1 ? '' : 's'} open` : 'No weekly times open'}</span>
      </span>
    </>
  );
  if (isStatic || !onOpen)
    return (
      <div className="card" style={{ gap: 10 }}>
        {body}
      </div>
    );
  return (
    <button type="button" className="card card--tap" onClick={onOpen} aria-label={label} style={{ gap: 10 }}>
      {body}
    </button>
  );
}
