// Owner HQ (Phase 132): cohort retention grid by signup month. Pure.

export function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

/** 'YYYY-MM' plus n months. */
export function addMonths(ym: string, n: number): string {
  const total = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + n;
  const y = Math.floor(total / 12);
  return `${y}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(a: string, b: string): number {
  return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
}

export type CohortCell = { cohort: string; offset: number; users: number };

export type CohortRow = {
  /** Signup month, 'YYYY-MM'. */
  month: string;
  signups: number;
  /** Index k = month k after signup (0 = the signup month). Share (0-100, one decimal) of that month's signups still active; null = not yet reached or no data. */
  active: Array<number | null>;
  /** Same, for still paying. Null where billing history does not reach back. */
  paying: Array<number | null>;
};

const pct = (users: number, signups: number): number => Math.round((users / signups) * 1000) / 10;

/**
 * `activeCells` / `payingCells` hold, per (cohort, offset), how many of the cohort's users were active / paying in that month.
 * A cell is null when the month has not happened yet (offset beyond `currentMonth`), or - for paying - when it is before
 * `payingCoverageFrom` (billing_events had not started recording, so a missing payer is not a lost one).
 */
export function buildCohortGrid(p: {
  signups: Array<{ month: string; signups: number }>;
  activeCells: CohortCell[];
  payingCells: CohortCell[];
  currentMonth: string;
  payingCoverageFrom: string | null;
  maxOffset: number;
}): CohortRow[] {
  const key = (c: string, o: number) => `${c}|${o}`;
  const active = new Map(p.activeCells.map((c) => [key(c.cohort, c.offset), c.users]));
  const paying = new Map(p.payingCells.map((c) => [key(c.cohort, c.offset), c.users]));
  return [...p.signups]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((s) => {
      const a: Array<number | null> = [];
      const y: Array<number | null> = [];
      for (let k = 0; k <= p.maxOffset; k++) {
        const m = addMonths(s.month, k);
        const reached = m <= p.currentMonth && s.signups > 0;
        a.push(reached ? pct(active.get(key(s.month, k)) ?? 0, s.signups) : null);
        const covered = p.payingCoverageFrom !== null && m >= p.payingCoverageFrom;
        // The current month always has a cell: the profile's own status says who pays today.
        y.push(reached && (covered || m === p.currentMonth) ? pct(paying.get(key(s.month, k)) ?? 0, s.signups) : null);
      }
      return { month: s.month, signups: s.signups, active: a, paying: y };
    });
}
