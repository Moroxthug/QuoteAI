// Owner HQ (Phase 132): how much of an owner expense falls inside a date range. Pure.
//
// - one_off: the whole amount, if starts_on is in the range.
// - monthly: each day from starts_on to ends_on accrues amount / days-in-that-calendar-month, so a full month is exactly the amount.
// - yearly: each day accrues amount / days-in-that-calendar-year (366 in a leap year).
// ends_on is inclusive. Dates are Toronto calendar dates (YYYY-MM-DD).

import { addDays, daysInMonth, isLeapYear } from "./time";

export type ExpenseLike = { amountCents: number; cadence: "one_off" | "monthly" | "yearly"; startsOn: string; endsOn: string | null };

const MAX = (a: string, b: string) => (a > b ? a : b);
const MIN = (a: string, b: string) => (a < b ? a : b);

/** Exact (fractional) cents inside [from, to]. Sum these and round once, so buckets add up to the total. */
export function expenseShareExact(e: ExpenseLike, from: string, to: string): number {
  if (from > to) return 0;
  if (e.cadence === "one_off") {
    return e.startsOn >= from && e.startsOn <= to ? e.amountCents : 0;
  }
  const start = MAX(from, e.startsOn);
  const end = e.endsOn ? MIN(to, e.endsOn) : to;
  if (start > end) return 0;
  let total = 0;
  let cursor = start;
  while (cursor <= end) {
    const y = +cursor.slice(0, 4);
    const m = +cursor.slice(5, 7);
    if (e.cadence === "monthly") {
      const dim = daysInMonth(y, m);
      const monthEnd = `${cursor.slice(0, 7)}-${String(dim).padStart(2, "0")}`;
      const segEnd = MIN(end, monthEnd);
      const days = dayCount(cursor, segEnd);
      total += (e.amountCents * days) / dim;
      cursor = addDays(segEnd, 1);
    } else {
      const diy = isLeapYear(y) ? 366 : 365;
      const segEnd = MIN(end, `${y}-12-31`);
      const days = dayCount(cursor, segEnd);
      total += (e.amountCents * days) / diy;
      cursor = addDays(segEnd, 1);
    }
  }
  return total;
}

export const expenseShareCents = (e: ExpenseLike, from: string, to: string): number => Math.round(expenseShareExact(e, from, to));

function dayCount(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
}
