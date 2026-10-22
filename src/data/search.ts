// Flow 02 search: published offerings joined with teacher profiles. Query and filters live in the URL.
import type { DB, Level, Offering, StudentProfile } from './schema';
import * as sel from './selectors';
import { now } from './clock';
import { INSTRUMENTS } from './seed';

export interface Filters {
  q: string;
  instruments: string[];
  level?: Level;
  format?: 'online' | 'in_person';
  min?: number; // dollars per lesson
  max?: number;
  avail: string[]; // this_week | evenings | weekends
  type?: 'courses' | 'single';
}

export const PRICE_MIN = 15;
export const PRICE_MAX = 100;

export function parseFilters(q: URLSearchParams): Filters {
  const list = (k: string) => (q.get(k) ? q.get(k)!.split(',').filter(Boolean) : []);
  const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined);
  return {
    q: q.get('q') ?? '',
    instruments: list('instrument'),
    level: (q.get('level') as Level) || undefined,
    format: (q.get('format') as Filters['format']) || undefined,
    min: num('min'),
    max: num('max'),
    avail: list('avail'),
    type: (q.get('type') as Filters['type']) || undefined,
  };
}

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.instruments.length) p.set('instrument', f.instruments.join(','));
  if (f.level) p.set('level', f.level);
  if (f.format) p.set('format', f.format);
  if (f.min !== undefined && f.min > PRICE_MIN) p.set('min', String(f.min));
  if (f.max !== undefined && f.max < PRICE_MAX) p.set('max', String(f.max));
  if (f.avail.length) p.set('avail', f.avail.join(','));
  if (f.type) p.set('type', f.type);
  return p.toString();
}

export const AVAIL_LABEL: Record<string, string> = { this_week: 'This week', evenings: 'Weekday evenings', weekends: 'Weekends' };
export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

/** Applied filter chips, in display order. Each removes itself from the filters. */
export function chipsOf(f: Filters): { key: string; label: string; remove: (f: Filters) => Filters }[] {
  const out: { key: string; label: string; remove: (f: Filters) => Filters }[] = [];
  for (const i of f.instruments) out.push({ key: `i-${i}`, label: i, remove: (x) => ({ ...x, instruments: x.instruments.filter((y) => y !== i) }) });
  if (f.level) out.push({ key: 'level', label: LEVEL_LABEL[f.level], remove: (x) => ({ ...x, level: undefined }) });
  if (f.format) out.push({ key: 'format', label: f.format === 'online' ? 'Online' : 'In person', remove: (x) => ({ ...x, format: undefined }) });
  if ((f.min ?? PRICE_MIN) > PRICE_MIN || (f.max ?? PRICE_MAX) < PRICE_MAX)
    out.push({ key: 'price', label: `$${f.min ?? PRICE_MIN} to $${f.max ?? PRICE_MAX}`, remove: (x) => ({ ...x, min: undefined, max: undefined }) });
  for (const a of f.avail) out.push({ key: `a-${a}`, label: AVAIL_LABEL[a], remove: (x) => ({ ...x, avail: x.avail.filter((y) => y !== a) }) });
  if (f.type) out.push({ key: 'type', label: f.type === 'courses' ? 'Courses' : 'Single lessons', remove: (x) => ({ ...x, type: undefined }) });
  return out;
}

/** Defaults applied when a search starts from Discover: a typed instrument becomes a filter, plus the S02 level. */
export function defaultsFor(q: string, sp?: StudentProfile): Filters {
  const instr = INSTRUMENTS.find((i) => i.toLowerCase() === q.trim().toLowerCase());
  return {
    q: q.trim(),
    instruments: instr ? [instr] : [],
    level: sp ? sel.studentLevelToLevel(sp.level) : undefined,
    format: sp?.format === 'online' ? 'online' : sp?.format === 'in_person' ? 'in_person' : undefined,
    avail: [],
  };
}

export function recentLabel(f: Filters): string {
  const parts = [f.level ? LEVEL_LABEL[f.level] : 'Any level'];
  if (f.format) parts.push(f.format === 'online' ? 'Online' : 'In person');
  return parts.join(' · ');
}

const norm = (s: string) => s.toLowerCase();
const formatOk = (have: string, want?: string) => !want || have === 'either' || have === want;

function availOk(db: DB, off: Offering, avail: string[], t: number): boolean {
  if (!avail.length) return true;
  const open = sel.slotsFor(db, off, t).filter((s) => s.status === 'open');
  return avail.some((a) => {
    if (a === 'this_week') return open.length > 0;
    if (a === 'evenings') return open.some((s) => s.weekday >= 1 && s.weekday <= 5 && s.time >= '17:00');
    if (a === 'weekends') return open.some((s) => s.weekday === 0 || s.weekday === 6);
    return true;
  });
}

export interface Results {
  courses: Offering[];
  teachers: string[];
  count: number;
}

export function search(db: DB, f: Filters): Results {
  const t = now();
  const qq = norm(f.q.trim());
  const priceOk = (cents: number) => cents / 100 >= (f.min ?? PRICE_MIN) && cents / 100 <= (f.max ?? PRICE_MAX);
  const instrOk = (have: string[]) => !f.instruments.length || f.instruments.some((i) => have.some((h) => norm(h).includes(norm(i))));

  const live = db.offerings.filter((o) => o.status === 'published' && sel.teacherProfile(db, o.teacherId)?.setupComplete && sel.user(db, o.teacherId));
  const textOk = (o: Offering) => {
    if (!qq) return true;
    const u = sel.user(db, o.teacherId)!;
    const tp = sel.teacherProfile(db, o.teacherId)!;
    return [o.title, o.instrument, o.description, u.name, ...tp.instruments].some((s) => norm(s).includes(qq));
  };

  const courses =
    f.type === 'single'
      ? []
      : live.filter((o) => o.type !== 'single' && textOk(o) && instrOk([o.instrument]) && (!f.level || o.level === f.level) && formatOk(o.format, f.format) && priceOk(o.pricePerLessonCents) && availOk(db, o, f.avail, t));

  const teacherIds = [...new Set(live.map((o) => o.teacherId))];
  const teachers =
    f.type === 'courses'
      ? []
      : teacherIds.filter((id) => {
          const tp = sel.teacherProfile(db, id)!;
          const offs = live.filter((o) => o.teacherId === id);
          const singles = offs.filter((o) => o.type === 'single');
          const pool = singles.length ? singles : offs;
          return (
            pool.some((o) => textOk(o)) &&
            instrOk(tp.instruments) &&
            (!f.level || tp.levels.includes(f.level)) &&
            formatOk(tp.formats, f.format) &&
            pool.some((o) => priceOk(o.pricePerLessonCents)) &&
            pool.some((o) => availOk(db, o, f.avail, t))
          );
        });

  // Best match: instrument, then online or nearby, then rating.
  const score = (id: string) => {
    const tp = sel.teacherProfile(db, id)!;
    const r = sel.rating(db, id);
    return (instrOk(tp.instruments) ? 100 : 0) + (tp.formats === 'either' ? 10 : 5) + (r.show ? r.avg : 0);
  };
  teachers.sort((a, b) => score(b) - score(a));
  courses.sort((a, b) => score(b.teacherId) - score(a.teacherId) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  return { courses, teachers, count: courses.length + teachers.length };
}
