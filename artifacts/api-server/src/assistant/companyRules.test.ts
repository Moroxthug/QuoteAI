import { describe, expect, it } from "vitest";
import { daysBetween, firstName, followupDraft, isQuiet, levelsOf, localClock, localDay, nextMonthStart, overLimit, reminderDraft, ruleOf } from "./companyRules.js";

describe("levels", () => {
  it("falls back to the recommended levels", () => {
    expect(levelsOf({})).toEqual({ followups: 0, reminders: 1, receipts: 1, scheduling: 0, crew: 1 });
    expect(levelsOf(null).reminders).toBe(1);
  });
  it("takes what was chosen and ignores junk", () => {
    expect(levelsOf({ followups: 2, scheduling: 1 })).toMatchObject({ followups: 2, scheduling: 1, reminders: 1 });
    expect(levelsOf({ crew: 7 as never }).crew).toBe(1);
  });
  it("reads a level as a rule", () => {
    expect([0, 1, 2].map((l) => ruleOf(l as 0 | 1 | 2))).toEqual(["ask", "send", "off"]);
  });
});

describe("quiet hours", () => {
  const q = { on: true, from: 20 * 60, until: 7 * 60, sunday: true };
  it("spans midnight", () => {
    expect(isQuiet(q, 2, 21 * 60)).toBe(true);
    expect(isQuiet(q, 2, 6 * 60 + 59)).toBe(true);
    expect(isQuiet(q, 2, 7 * 60)).toBe(false);
    expect(isQuiet(q, 2, 12 * 60)).toBe(false);
  });
  it("keeps all of Sunday quiet when asked, even with the hours off", () => {
    expect(isQuiet(q, 0, 12 * 60)).toBe(true);
    expect(isQuiet({ ...q, on: false }, 0, 12 * 60)).toBe(true);
    expect(isQuiet({ ...q, sunday: false }, 0, 12 * 60)).toBe(false);
  });
  it("is never quiet with the hours off on a weekday", () => {
    expect(isQuiet({ ...q, on: false }, 3, 23 * 60)).toBe(false);
  });
  it("reads the company's own clock", () => {
    // 2026-09-29 is a Tuesday; 01:30 UTC is 21:30 on the Monday in Toronto.
    expect(localClock(new Date("2026-09-29T01:30:00Z"), "America/Toronto")).toEqual({ day: 1, minute: 21 * 60 + 30 });
  });
});

describe("drafts", () => {
  const due = new Date("2026-09-20T16:00:00Z");
  it("writes the reminder in English", () => {
    const t = reminderDraft({ lang: "en", client: "Tom Hart", number: "INV-0412", balanceCents: 234000, due, link: "https://x/pay", who: "Marco", zone: "America/Toronto" });
    expect(t).toContain("Hi Tom,");
    expect(t).toContain("Sep 20");
    expect(t).toContain("INV-0412");
    expect(t).toContain("$2,340.00");
    expect(t).toContain("https://x/pay");
    expect(t.endsWith("Thanks, Marco")).toBe(true);
  });
  it("writes the reminder in French with the French money", () => {
    const t = reminderDraft({ lang: "fr", client: "Tom Hart", number: "INV-0412", balanceCents: 234000, due, link: "https://x/pay", who: "Marco", zone: "America/Toronto" });
    expect(t.startsWith("Bonjour Tom,")).toBe(true);
    expect(t).toMatch(/2\s340,00\s\$/);
  });
  it("writes a follow-up, with or without a title", () => {
    expect(followupDraft({ lang: "en", client: "Priya Nair", title: "backsplash", link: "L", who: "Marco" })).toContain("the backsplash quote");
    expect(followupDraft({ lang: "en", client: "", title: "", link: "L", who: "M" })).toMatch(/^Hi, just checking in on the quote/);
    expect(followupDraft({ lang: "fr", client: "Priya", title: "dosseret", link: "L", who: "Marco" })).toContain("« dosseret »");
  });
});

describe("the company's own calendar", () => {
  it("names the day in the zone, not in UTC", () => {
    // 02:00 UTC on Oct 2 is still Oct 1 in Toronto and Vancouver.
    expect(localDay(new Date("2026-10-02T02:00:00Z"), "America/Toronto")).toBe("2026-10-01");
    expect(localDay(new Date("2026-10-02T02:00:00Z"), "UTC")).toBe("2026-10-02");
  });
  it("finds the first of next month, over the year end too", () => {
    expect(nextMonthStart("2026-10-01")).toBe("2026-11-01");
    expect(nextMonthStart("2026-12-15")).toBe("2027-01-01");
  });
});

describe("small things", () => {
  it("takes a first name", () => {
    expect(firstName("  Tom  Hart ")).toBe("Tom");
    expect(firstName("")).toBe("");
  });
  it("counts whole days", () => {
    expect(daysBetween(new Date("2026-09-20T12:00:00Z"), new Date("2026-09-29T11:00:00Z"))).toBe(8);
    expect(daysBetween(new Date("2026-09-30T12:00:00Z"), new Date("2026-09-29T11:00:00Z"))).toBe(0);
  });
  it("asks above the limit", () => {
    expect(overLimit(48620, 30000)).toBe(true);
    expect(overLimit(30000, 30000)).toBe(false);
  });
});
