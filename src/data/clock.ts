// Clock service: real time plus a developer offset. All demo times show in one zone (A-12).

export const TZ = 'America/Chicago';
export const TZ_LABEL = 'Central Time';

let offsetMs = 0;
export function setClockOffset(ms: number) {
  offsetMs = ms;
}
export function now(): number {
  return Date.now() + offsetMs;
}

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  y: number;
  m: number; // 1-12
  d: number;
  h: number;
  min: number;
  s: number;
  weekday: number;
}

export function zoned(ms: number): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  return {
    y: +p.year,
    m: +p.month,
    d: +p.day,
    h: +p.hour % 24,
    min: +p.minute,
    s: +p.second,
    weekday: WD[p.weekday],
  };
}

function tzOffset(ms: number): number {
  const z = zoned(ms);
  return Date.UTC(z.y, z.m - 1, z.d, z.h, z.min, z.s) - Math.floor(ms / 1000) * 1000;
}

/** Epoch ms for a wall-clock time in the demo zone. */
export function zonedEpoch(y: number, m: number, d: number, h = 0, min = 0): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ms = guess - tzOffset(guess);
  const second = guess - tzOffset(ms);
  if (second !== ms) ms = second;
  return ms;
}

export function startOfDay(ms: number): number {
  const z = zoned(ms);
  return zonedEpoch(z.y, z.m, z.d);
}

export function addDays(ms: number, days: number): number {
  const z = zoned(ms);
  return zonedEpoch(z.y, z.m, z.d + days, z.h, z.min);
}

export function hm(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h, m];
}

export function toMinutes(time: string): number {
  const [h, m] = hm(time);
  return h * 60 + m;
}

export function fromMinutes(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** Wall time on the same zoned date as `dayMs`. */
export function atTime(dayMs: number, time: string): number {
  const z = zoned(dayMs);
  const [h, m] = hm(time);
  return zonedEpoch(z.y, z.m, z.d, h, m);
}

/** Next occurrence of weekday at HH:mm strictly after `after`. */
export function nextOccurrence(after: number, weekday: number, time: string): number {
  for (let i = 0; i < 8; i++) {
    const day = addDays(startOfDay(after), i);
    if (zoned(day).weekday !== weekday) continue;
    const t = atTime(day, time);
    if (t > after) return t;
  }
  return atTime(addDays(startOfDay(after), 7), time);
}

/** Next Monday at 9:00 AM on or after `from` (payout day). */
export function nextMonday(from: number): number {
  for (let i = 0; i < 8; i++) {
    const day = addDays(startOfDay(from), i);
    if (zoned(day).weekday === 1) return atTime(day, '09:00');
  }
  return from;
}

const fDate = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const fMonthDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });
const fLong = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
const fTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const fYear = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });

/** Thu, Nov 5 */
export const fmtDate = (ms: number) => fDate.format(ms);
/** Nov 5 */
export const fmtMonthDay = (ms: number) => fMonthDay.format(ms);
/** Thursday, November 5 */
export const fmtLong = (ms: number) => fLong.format(ms);
/** 5:00 PM */
export const fmtTime = (ms: number) => fTime.format(ms);
/** Nov 2, 2026 */
export const fmtYear = (ms: number) => fYear.format(ms);
/** Thu, Nov 5 · 5:00 PM */
export const fmtDateTime = (ms: number) => `${fmtDate(ms)} · ${fmtTime(ms)}`;
/** 5:00 to 5:45 PM */
export function fmtRange(start: number, minutes: number, sep = ' to '): string {
  const end = start + minutes * 60000;
  const a = fmtTime(start);
  const b = fmtTime(end);
  const same = a.slice(-2) === b.slice(-2);
  return `${same ? a.slice(0, -3) : a}${sep}${b}`;
}
/** 17:00 → 5:00 PM */
export function fmtHM(time: string): string {
  const [h, m] = hm(time);
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** 16:00 → 4, 10:00 → 10 AM style compact labels: "4–7 PM" */
export function fmtWindow(start: string, end: string, sep = '–'): string {
  const [sh, sm] = hm(start);
  const [eh, em] = hm(end);
  const part = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}${m ? ':' + String(m).padStart(2, '0') : ''}`;
  const sp = sh < 12 ? 'AM' : 'PM';
  const ep = eh < 12 ? 'AM' : 'PM';
  return sp === ep ? `${part(sh, sm)}${sep}${part(eh, em)} ${ep}` : `${part(sh, sm)} ${sp}${sep}${part(eh, em)} ${ep}`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function relativeAgo(ms: number, ref = now()): string {
  const diff = Math.max(0, ref - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return WEEKDAYS_SHORT[zoned(ms).weekday];
  return fmtMonthDay(ms);
}

export function agoLong(ms: number, ref = now()): string {
  const days = Math.floor((ref - ms) / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? '' : 's'} ago`;
  }
  const mo = Math.floor(days / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}

/** Holiday dates that warn but do not block on S10 (month-day). */
const HOLIDAYS = ['11-26', '12-24', '12-25', '12-31', '1-1'];
export function isHoliday(ms: number): boolean {
  const z = zoned(ms);
  return HOLIDAYS.includes(`${z.m}-${z.d}`);
}

export function greeting(ms: number): string {
  const h = zoned(ms).h;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The demo starts Mon, Nov 2, 2026, 10:00 AM Central. */
export const DEMO_START = zonedEpoch(2026, 11, 2, 10, 0);
