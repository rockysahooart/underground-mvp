// Money rules from chapter 01. Integer cents only; screens display values computed here.

/** Marketplace fee taken from the teacher side (placeholder pending Q-09). */
export const FEE_RATE = 0.15;
/** Student service fee (Q-09) and tax (Q-22) are $0.00 in the prototype. */
export const STUDENT_FEE_RATE = 0;
export const TAX_RATE = 0;
/** Minimum listed price per lesson (Q-13). */
export const MIN_PRICE_PER_LESSON_CENTS = 1500;

const roundHalfUp = (x: number) => Math.floor(x + 0.5);

export function coursePriceCents(pricePerLessonCents: number, lessonCount: number): number {
  return pricePerLessonCents * lessonCount;
}

export function feeCents(grossCents: number, rate = FEE_RATE): number {
  return roundHalfUp(grossCents * rate);
}

export function netCents(grossCents: number, rate = FEE_RATE): number {
  return grossCents - feeCents(grossCents, rate);
}

export interface StudentTotal {
  subtotal: number;
  serviceFee: number;
  tax: number;
  total: number;
}

export function studentTotal(pricePerLessonCents: number, lessonCount: number): StudentTotal {
  const subtotal = coursePriceCents(pricePerLessonCents, lessonCount);
  const serviceFee = roundHalfUp(subtotal * STUDENT_FEE_RATE);
  const tax = roundHalfUp(subtotal * TAX_RATE);
  return { subtotal, serviceFee, tax, total: subtotal + serviceFee + tax };
}

/** Per-lesson release: lessons 1..n-1 get net/n rounded half up; lesson n gets the remainder. */
export function releaseSchedule(net: number, n: number): number[] {
  if (n <= 0) return [];
  const each = roundHalfUp(net / n);
  const out = Array.from({ length: n - 1 }, () => each);
  out.push(net - each * (n - 1));
  return out;
}

/** Student refund: full listed price per untaught lesson (Q-20 default). */
export function refundCents(pricePerLessonCents: number, untaughtLessons: number): number {
  return pricePerLessonCents * untaughtLessons;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** $260.00 */
export function fmt(cents: number): string {
  return usd.format(cents / 100);
}

/** $260 when whole, $32.50 otherwise. */
export function fmtShort(cents: number): string {
  return cents % 100 === 0 ? usdWhole.format(cents / 100) : usd.format(cents / 100);
}
