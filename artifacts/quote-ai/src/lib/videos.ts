// Phase 121: the guided videos (Track C, APP-PLAN 127-131) the app offers.
// None is recorded yet; each slot shows only once its video exists, so the
// screens that offer one need no change when it does — set its href here.

export type VideoSlot = { href: string } | null;

/** The 60-second overview, offered once on the welcome — never forced. */
export const OVERVIEW_VIDEO: VideoSlot = null;

const OFFERED_KEY = "quoteai.overviewOffered";

export function overviewOffered(): boolean {
  try {
    return localStorage.getItem(OFFERED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOverviewOffered(): void {
  try {
    localStorage.setItem(OFFERED_KEY, "1");
  } catch {
    /* ignore */
  }
}
