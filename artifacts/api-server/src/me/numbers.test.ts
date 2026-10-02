import { describe, expect, it } from "vitest";
import { numbersFor, periodWindow } from "./numbers.js";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("periods", () => {
  it("finds the month, the quarter and the year of a day, and the ones before", () => {
    expect(periodWindow("month", "2026-09-29")).toEqual({ start: "2026-09-01", end: "2026-10-01" });
    expect(periodWindow("month", "2026-01-15", 1)).toEqual({ start: "2025-12-01", end: "2026-01-01" });
    expect(periodWindow("quarter", "2026-09-29")).toEqual({ start: "2026-07-01", end: "2026-10-01" });
    expect(periodWindow("quarter", "2026-02-10", 1)).toEqual({ start: "2025-10-01", end: "2026-01-01" });
    expect(periodWindow("year", "2026-09-29")).toEqual({ start: "2026-01-01", end: "2027-01-01" });
    expect(periodWindow("year", "2026-09-29", 1)).toEqual({ start: "2025-01-01", end: "2026-01-01" });
  });
});

describe("a person's numbers", () => {
  const w = { from: d("2026-09-01"), to: d("2026-10-01") };
  const quotes = [
    { createdAt: d("2026-09-02"), sentAt: d("2026-09-03"), acceptedAt: d("2026-09-10"), accepted: true },
    { createdAt: d("2026-09-05"), sentAt: d("2026-09-06"), acceptedAt: null, accepted: false },
    { createdAt: d("2026-08-28"), sentAt: d("2026-09-01"), acceptedAt: null, accepted: false },
    { createdAt: d("2026-09-20"), sentAt: null, acceptedAt: null, accepted: false },
    { createdAt: d("2026-07-01"), sentAt: d("2026-07-02"), acceptedAt: null, accepted: true },
  ];
  it("counts quotes made and sent in the period, and the share of those sent that were won", () => {
    const n = numbersFor(w, quotes, [], []);
    expect([n.made, n.sent, n.won, n.wonPercent]).toEqual([3, 3, 1, 33]);
  });
  it("has no win rate with nothing sent", () => {
    expect(numbersFor(w, [], [], []).wonPercent).toBeNull();
  });
  it("adds what was invoiced, leaving out drafts and voids", () => {
    const n = numbersFor(w, [], [
      { issueDate: d("2026-09-04"), totalCents: 100_000, status: "paid" }, { issueDate: d("2026-09-05"), totalCents: 50_000, status: "sent" },
      { issueDate: d("2026-09-06"), totalCents: 9_000, status: "draft" }, { issueDate: d("2026-09-07"), totalCents: 7_000, status: "void" }, { issueDate: d("2026-08-31"), totalCents: 1, status: "paid" },
    ], []);
    expect(n.invoicedCents).toBe(150_000);
  });
  it("counts the jobs opened in the period and the ones active now", () => {
    const n = numbersFor(w, [], [], [{ createdAt: d("2026-09-09"), status: "active" }, { createdAt: d("2026-06-09"), status: "active" }, { createdAt: d("2026-09-10"), status: "planning" }]);
    expect([n.jobs, n.activeJobs]).toEqual([2, 2]);
  });
});
