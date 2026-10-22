// Chapter 14 money checks: $260.00 → fee $39.00, net $221.00, releases 7 × $27.63 + $27.59; refund after lesson 1 = $227.50.
import { describe, expect, it } from 'vitest';
import { coursePriceCents, feeCents, fmt, netCents, refundCents, releaseSchedule, studentTotal } from '../src/data/money';

describe('money', () => {
  it('computes the worked example', () => {
    const gross = coursePriceCents(3250, 8);
    expect(gross).toBe(26000);
    expect(feeCents(gross)).toBe(3900);
    expect(netCents(gross)).toBe(22100);
    expect(studentTotal(3250, 8)).toEqual({ subtotal: 26000, serviceFee: 0, tax: 0, total: 26000 });
  });

  it('releases net per lesson with the remainder on the last lesson', () => {
    const r = releaseSchedule(22100, 8);
    expect(r.slice(0, 7)).toEqual(Array(7).fill(2763));
    expect(r[7]).toBe(2759);
    expect(r.reduce((a, b) => a + b, 0)).toBe(22100);
    expect(22100 - r[0]).toBe(19337); // pending after lesson 1
  });

  it('refunds the full listed price per untaught lesson', () => {
    expect(refundCents(3250, 7)).toBe(22750);
    expect(fmt(22750)).toBe('$227.50');
  });

  it('rounds half up to the cent', () => {
    expect(feeCents(1)).toBe(0);
    expect(feeCents(10)).toBe(2); // 1.5 → 2
    expect(releaseSchedule(100, 3)).toEqual([33, 33, 34]);
  });
});
