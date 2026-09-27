import { describe, expect, test } from "vitest";
import { daysPastDue, localDaysBetween, rankNeedsYou, type NeedsYouItem } from "./service.js";

// Phase 104: the home's "Needs you" is one list merged from five sources, so
// its order is the whole point.

const item = (kind: NeedsYouItem["kind"], id: string, extra: Partial<NeedsYouItem> = {}): NeedsYouItem => ({ id, kind, title: id, subtitle: "", at: null, href: "/", ...extra });

describe("rankNeedsYou", () => {
  test("a blocker on site comes before money, money before people waiting", () => {
    const ranked = rankNeedsYou([item("waiting", "q"), item("followup", "l"), item("hours", "h"), item("overdue", "i"), item("etransfer", "e"), item("blocker", "b")]);
    expect(ranked.map((i) => i.kind)).toEqual(["blocker", "etransfer", "overdue", "hours", "followup", "waiting"]);
  });

  test("the most overdue invoice leads its group", () => {
    const ranked = rankNeedsYou([item("overdue", "a", { days: 3 }), item("overdue", "b", { days: 40 }), item("overdue", "c", { days: 12 })]);
    expect(ranked.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  test("the newest blocker first, but the oldest follow-up and the longest-waiting quote first", () => {
    const at = (d: string) => ({ at: `2026-09-${d}T12:00:00Z` });
    expect(rankNeedsYou([item("blocker", "old", at("20")), item("blocker", "new", at("25"))]).map((i) => i.id)).toEqual(["new", "old"]);
    expect(rankNeedsYou([item("followup", "late", at("25")), item("followup", "early", at("20"))]).map((i) => i.id)).toEqual(["early", "late"]);
    expect(rankNeedsYou([item("waiting", "recent", at("22")), item("waiting", "long", at("02"))]).map((i) => i.id)).toEqual(["long", "recent"]);
  });

  test("does not reorder the list it was given", () => {
    const input = [item("waiting", "q"), item("blocker", "b")];
    rankNeedsYou(input);
    expect(input.map((i) => i.id)).toEqual(["q", "b"]);
  });
});

describe("localDaysBetween", () => {
  test("counts local calendar days, not 24-hour blocks", () => {
    // Noon UTC on the 25th is 08:00 in Toronto; 23:30 Toronto on the 25th is 03:30 UTC on the 26th.
    expect(localDaysBetween(new Date("2026-09-25T12:00:00Z"), new Date("2026-09-26T03:30:00Z"), "ON")).toBe(0);
    expect(localDaysBetween(new Date("2026-09-25T12:00:00Z"), new Date("2026-09-26T13:00:00Z"), "ON")).toBe(1);
  });

  test("a Vancouver evening is still the same local day", () => {
    // 17:00 PDT on the 22nd is 00:00 UTC on the 23rd.
    expect(localDaysBetween(new Date("2026-09-22T16:00:00Z"), new Date("2026-09-23T00:00:00Z"), "BC")).toBe(0);
  });
});

describe("daysPastDue", () => {
  const due = new Date("2026-09-25T00:00:00Z"); // due on the 25th (a date-only value)

  test("due today is not late, even in the evening when UTC has moved on", () => {
    // 21:00 in Vancouver on the 25th = 04:00 UTC on the 26th.
    expect(daysPastDue(due, new Date("2026-09-26T04:00:00Z"), "BC")).toBe(0);
  });

  test("the morning after is one day late — not two, and not zero", () => {
    // 08:00 in Toronto on the 26th.
    expect(daysPastDue(due, new Date("2026-09-26T12:00:00Z"), "ON")).toBe(1);
  });
});
