// Phase 134: which lifecycle email (if any) is due for one person right now. Pure: no database, no clock, no env.
// Rules in one place: docs/GROWTH-PLAN.md "Build log" (134).

export const LIFECYCLE_KEYS = ["welcome", "day1_no_quote", "first_quote_done", "free_quotes_low", "free_quotes_used", "day7_inactive", "win_back"] as const;
export type LifecycleKey = (typeof LIFECYCLE_KEYS)[number];

export type LifecycleState = {
  signupAt: Date;
  quoteCount: number;
  /** Quotes that have been emailed to a client. */
  sentQuoteCount: number;
  /** When the earliest quote was made; null with no quote. */
  firstQuoteAt: Date | null;
  /** On any paid (or trialing) plan. */
  paid: boolean;
  /** Free quotes left; null on a paid plan. */
  freeLeft: number | null;
  /** Last sign-in or quote activity; falls back to the sign-up date. */
  lastActivityAt: Date;
  lang: "en" | "fr";
  /** IANA time zone of the company. */
  timeZone: string;
  /** Message keys already sent, ever. */
  sentKeys: readonly string[];
  /** When the last lifecycle email (any key) went out; null if none. */
  lastSentAt: Date | null;
  optedOut: boolean;
  testAccount: boolean;
};

export const QUIET_START_HOUR = 8; // first local hour mail may go out
export const QUIET_END_HOUR = 20; // mail stops at 20:00 local
export const MIN_GAP_MS = 24 * 3_600_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The local hour (0-23) in a time zone. An unknown zone counts as Toronto. */
export function localHour(now: Date, timeZone: string): number {
  const fmt = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).formatToParts(now).find((p) => p.type === "hour")?.value;
  let raw: string | undefined;
  try {
    raw = fmt(timeZone);
  } catch {
    raw = fmt("America/Toronto");
  }
  return Number(raw ?? "0") % 24;
}

export function inSendWindow(now: Date, timeZone: string): boolean {
  const h = localHour(now, timeZone);
  return h >= QUIET_START_HOUR && h < QUIET_END_HOUR;
}

/**
 * At most one message key, or null. Order = priority when several are due; the 24 h cap then spreads the rest over the following days
 * (a message that stops being true by then, say a nudge to make a first quote, is simply not sent).
 */
export function dueMessages(s: LifecycleState, now: Date): LifecycleKey | null {
  if (s.optedOut || s.testAccount) return null;
  if (s.lastSentAt && now.getTime() - s.lastSentAt.getTime() < MIN_GAP_MS) return null;
  if (!inSendWindow(now, s.timeZone)) return null;

  const sent = new Set(s.sentKeys);
  const since = (d: Date) => now.getTime() - d.getTime();
  const age = since(s.signupAt);
  const idle = since(s.lastActivityAt);

  const want = (key: LifecycleKey, ok: boolean): LifecycleKey | null => (ok && !sent.has(key) ? key : null);

  // welcome: right after sign-up (not for an old account the day the switch is turned on).
  const welcome = want("welcome", age >= 0 && age <= 3 * DAY);
  if (welcome) return welcome;

  // first quote made, none emailed to a client yet: give them an hour to finish it, then nudge.
  const firstQuote = want("first_quote_done", s.quoteCount >= 1 && s.sentQuoteCount === 0 && s.firstQuoteAt !== null && since(s.firstQuoteAt) >= HOUR && since(s.firstQuoteAt) <= 14 * DAY);
  if (firstQuote) return firstQuote;

  // free quotes: only accounts on no paid plan, and only ones that have actually quoted.
  if (!s.paid && s.freeLeft !== null && s.quoteCount >= 1) {
    const used = want("free_quotes_used", s.freeLeft === 0);
    if (used) return used;
    const low = want("free_quotes_low", s.freeLeft === 1);
    if (low) return low;
  }

  const day1 = want("day1_no_quote", s.quoteCount === 0 && age >= DAY && age <= 6 * DAY);
  if (day1) return day1;

  // inactivity: no paid plan, and not already past the 30-day point (win_back covers that).
  const winBack = want("win_back", !s.paid && idle >= 30 * DAY);
  if (winBack) return winBack;
  const day7 = want("day7_inactive", !s.paid && idle >= 7 * DAY && idle < 30 * DAY);
  if (day7) return day7;

  return null;
}
