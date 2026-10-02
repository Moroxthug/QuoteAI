// SetQuotes' follow-up steps (SetQuotes.dc.html): "Day 2", "Day 5", "Day 10" after a quote is sent, each on or off. The server keeps its touches as the days
// between one message and the next (automationSettings.quoteFollowupDays); the page keeps the days counted from sending, and which are on. Pure, so they
// are tested (followups.test.ts).
export type Step = { day: number; on: boolean };

/** The board's own steps, counted from the day the quote is sent. */
export const DEFAULT_DAYS = [2, 5, 10];

/**
 * The steps to show: what the page remembers; else the server's touches counted from sending (all on); else the board's three, off when the server has none
 * (the sequence is switched off).
 */
export function stepsOf(serverGaps: number[], page: { followupDays?: number[]; followupOn?: boolean[] }): Step[] {
  if (page.followupDays?.length) return page.followupDays.map((day, i) => ({ day, on: page.followupOn?.[i] ?? true }));
  if (serverGaps.length) {
    let at = 0;
    return serverGaps.map((g) => ({ day: (at += g), on: true }));
  }
  return DEFAULT_DAYS.map((day) => ({ day, on: false }));
}

/** The server's list for the steps that send: the days from one send to the next. */
export function gapsOf(steps: Step[]): number[] {
  const out: number[] = [];
  let last = 0;
  for (const s of steps.filter((x) => x.on).sort((a, b) => a.day - b.day)) {
    out.push(Math.max(1, s.day - last));
    last = s.day;
  }
  return out;
}

/** `{name}`, `{link}`, `{owner}`, `{company}` and `{date}` as the board writes them, filled in for a sample client (the "Send me a test" text). */
export function fill(text: string, v: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
}
