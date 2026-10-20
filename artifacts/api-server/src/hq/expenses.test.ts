import { describe, expect, it } from "vitest";
import { expenseShareCents, expenseShareExact, type ExpenseLike } from "./expenses";

const monthly = (amountCents: number, startsOn: string, endsOn: string | null = null): ExpenseLike => ({ amountCents, cadence: "monthly", startsOn, endsOn });
const yearly = (amountCents: number, startsOn: string, endsOn: string | null = null): ExpenseLike => ({ amountCents, cadence: "yearly", startsOn, endsOn });
const oneOff = (amountCents: number, startsOn: string): ExpenseLike => ({ amountCents, cadence: "one_off", startsOn, endsOn: null });

describe("expense proration", () => {
  it("a full calendar month is exactly the monthly amount", () => {
    expect(expenseShareCents(monthly(3100, "2026-01-01"), "2026-10-01", "2026-10-31")).toBe(3100);
    expect(expenseShareCents(monthly(2800, "2026-01-01"), "2026-02-01", "2026-02-28")).toBe(2800);
  });
  it("a range inside a month takes its days of that month", () => {
    // October has 31 days: 10 days of 3100 = 1000
    expect(expenseShareCents(monthly(3100, "2026-01-01"), "2026-10-05", "2026-10-14")).toBe(1000);
    // the same 10 days in a 30-day month cost more per day
    expect(expenseShareCents(monthly(3000, "2026-01-01"), "2026-11-05", "2026-11-14")).toBe(1000);
  });
  it("starts_on part-way into the range, ends_on part-way out", () => {
    // starts Oct 21: 11 days of 31
    expect(expenseShareCents(monthly(3100, "2026-10-21"), "2026-10-01", "2026-10-31")).toBe(1100);
    // ends Oct 10 inclusive: 10 days
    expect(expenseShareCents(monthly(3100, "2026-01-01", "2026-10-10"), "2026-10-01", "2026-10-31")).toBe(1000);
  });
  it("nothing before it starts or after it ends", () => {
    expect(expenseShareCents(monthly(3100, "2026-11-01"), "2026-10-01", "2026-10-31")).toBe(0);
    expect(expenseShareCents(monthly(3100, "2026-01-01", "2026-09-30"), "2026-10-01", "2026-10-31")).toBe(0);
    expect(expenseShareCents(monthly(3100, "2026-01-01"), "2026-10-31", "2026-10-01")).toBe(0);
  });
  it("spans months: each month prorated by its own length", () => {
    // Jan 16-31 (16 days of 31) + Feb 1-14 (14 days of 28) of 3100/2800 = 1600 + 1400
    expect(expenseShareCents(monthly(3100, "2026-01-01"), "2026-01-16", "2026-01-31")).toBe(1600);
    expect(expenseShareCents({ ...monthly(3000, "2026-01-01") }, "2026-01-16", "2026-02-14")).toBe(Math.round((3000 * 16) / 31 + (3000 * 14) / 28));
  });
  it("leap day: February 2028 has 29 days, 2027 has 28", () => {
    expect(expenseShareCents(monthly(2900, "2028-01-01"), "2028-02-01", "2028-02-29")).toBe(2900);
    expect(expenseShareCents(monthly(2900, "2028-01-01"), "2028-02-29", "2028-02-29")).toBe(100);
    expect(expenseShareCents(monthly(2800, "2027-01-01"), "2027-02-28", "2027-02-28")).toBe(100);
  });
  it("yearly: a full year is the amount, a leap year divides by 366", () => {
    expect(expenseShareCents(yearly(36500, "2026-01-01"), "2026-01-01", "2026-12-31")).toBe(36500);
    expect(expenseShareCents(yearly(36600, "2028-01-01"), "2028-01-01", "2028-12-31")).toBe(36600);
    expect(expenseShareCents(yearly(36500, "2026-01-01"), "2026-03-01", "2026-03-10")).toBe(1000);
    expect(expenseShareCents(yearly(36600, "2028-01-01"), "2028-02-29", "2028-02-29")).toBe(100);
  });
  it("yearly across New Year uses each year's own length", () => {
    const exact = expenseShareExact(yearly(36500, "2027-01-01"), "2027-12-30", "2028-01-02");
    expect(exact).toBeCloseTo((36500 * 2) / 365 + (36500 * 2) / 366, 6);
  });
  it("one-off counts once, on its date", () => {
    expect(expenseShareCents(oneOff(12000, "2026-10-15"), "2026-10-01", "2026-10-31")).toBe(12000);
    expect(expenseShareCents(oneOff(12000, "2026-10-15"), "2026-10-15", "2026-10-15")).toBe(12000);
    expect(expenseShareCents(oneOff(12000, "2026-10-15"), "2026-10-16", "2026-10-31")).toBe(0);
  });
  it("exact shares add up across buckets", () => {
    const e = monthly(1000, "2026-01-01");
    const days = ["2026-10-01", "2026-10-02", "2026-10-03"].reduce((s, d) => s + expenseShareExact(e, d, d), 0);
    expect(days).toBeCloseTo(expenseShareExact(e, "2026-10-01", "2026-10-03"), 8);
  });
});
