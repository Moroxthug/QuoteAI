import { describe, expect, test } from "vitest";
import { effectivePaySettings, holidayPay, holidaysBetween, overtimeWindow, periodContaining, splitWindow, PROVINCE_HOLIDAY_RULES, PROVINCE_OVERTIME, type WindowEntry } from "./rules.js";

const e = (id: string, day: string, hours: number, rateCents = 4000): WindowEntry => ({ id, day, hours, rateCents });
const none = new Set<string>();

describe("statutory holidays", () => {
  test("counts per province for 2026", () => {
    const count = (p: string) => holidaysBetween(p, "2026-01-01", "2026-12-31").length;
    expect(count("ON")).toBe(9);
    expect(count("BC")).toBe(11);
    expect(count("QC")).toBe(8);
    expect(count("AB")).toBe(9);
    expect(count("NS")).toBe(6);
    expect(count("NL")).toBe(6);
  });
  test("moving dates land on the right day", () => {
    const on = holidaysBetween("ON", "2026-01-01", "2026-12-31").map((h) => `${h.key}:${h.date}`);
    expect(on).toContain("good_friday:2026-04-03");
    expect(on).toContain("family_day:2026-02-16");
    expect(on).toContain("victoria_day:2026-05-18");
    expect(on).toContain("labour_day:2026-09-07");
    expect(on).toContain("thanksgiving:2026-10-12");
    expect(on).toContain("boxing_day:2026-12-26");
    expect(holidaysBetween("ON", "2027-03-01", "2027-03-31").map((h) => h.date)).toEqual(["2027-03-26"]);
    expect(holidaysBetween("ON", "2025-05-01", "2025-05-31").map((h) => h.date)).toEqual(["2025-05-19"]);
  });
  test("Quebec moves Canada Day off a Sunday; other provinces don't", () => {
    expect(holidaysBetween("QC", "2029-07-01", "2029-07-02").map((h) => h.date)).toEqual(["2029-07-02"]);
    expect(holidaysBetween("ON", "2029-07-01", "2029-07-02").map((h) => h.date)).toEqual(["2029-07-01"]);
  });
  test("the company's own additions and removals", () => {
    const s = { holidays: { added: [{ date: "2026-08-03", name: "Civic Holiday" }], removed: ["2026-12-26"] } };
    const days = holidaysBetween("ON", "2026-08-01", "2026-12-31", s);
    expect(days.find((h) => h.date === "2026-08-03")).toMatchObject({ custom: true, name: "Civic Holiday" });
    expect(days.some((h) => h.date === "2026-12-26")).toBe(false);
  });
});

describe("pay periods", () => {
  const biweekly = effectivePaySettings("ON", { frequency: "biweekly", anchorDate: "2026-01-04" });
  test("biweekly counts from the anchor, backwards too", () => {
    expect(periodContaining("2026-01-04", biweekly)).toEqual({ start: "2026-01-04", end: "2026-01-17" });
    expect(periodContaining("2026-01-17", biweekly)).toEqual({ start: "2026-01-04", end: "2026-01-17" });
    expect(periodContaining("2026-09-23", biweekly)).toEqual({ start: "2026-09-13", end: "2026-09-26" });
    expect(periodContaining("2025-12-31", biweekly)).toEqual({ start: "2025-12-21", end: "2026-01-03" });
  });
  test("semi-monthly and monthly", () => {
    expect(periodContaining("2026-02-20", { frequency: "semimonthly", anchorDate: "" })).toEqual({ start: "2026-02-16", end: "2026-02-28" });
    expect(periodContaining("2026-02-10", { frequency: "semimonthly", anchorDate: "" })).toEqual({ start: "2026-02-01", end: "2026-02-15" });
    expect(periodContaining("2028-02-10", { frequency: "monthly", anchorDate: "" })).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
  test("overtime week and averaging block", () => {
    expect(overtimeWindow("2026-09-23", { weekStartsOn: 0, averaging: null })).toEqual({ start: "2026-09-20", end: "2026-09-26" });
    expect(overtimeWindow("2026-09-23", { weekStartsOn: 1, averaging: null })).toEqual({ start: "2026-09-21", end: "2026-09-27" });
    expect(overtimeWindow("2026-09-23", { weekStartsOn: 0, averaging: { weeks: 2, startDate: "2026-09-13" } })).toEqual({ start: "2026-09-13", end: "2026-09-26" });
  });
});

describe("splitting a week", () => {
  test("Ontario: nothing daily, overtime after 44 in the week, on the hours that crossed it", () => {
    const week = [e("a", "2026-09-21", 10), e("b", "2026-09-22", 10), e("c", "2026-09-23", 10), e("d", "2026-09-24", 10), e("f", "2026-09-25", 8)];
    const s = splitWindow(week, PROVINCE_OVERTIME.ON!, none, 1.5);
    expect(s.get("a")!.overtimeHours).toBe(0);
    expect(s.get("d")!.overtimeHours).toBe(0);
    expect(s.get("f")).toMatchObject({ overtimeHours: 4, premiumCents: 4 * 4000 * 0.5 });
  });
  test("BC: daily after 8, double after 12, weekly on straight time only", () => {
    const s = splitWindow([e("a", "2026-09-21", 13)], PROVINCE_OVERTIME.BC!, none, 1.5);
    expect(s.get("a")).toMatchObject({ overtimeHours: 4, doubleHours: 1, premiumCents: 4 * 2000 + 1 * 4000 });
    // Six 8-hour days: 48 straight → the last 8 cross 40.
    const six = ["21", "22", "23", "24", "25", "26"].map((d, i) => e(`d${i}`, `2026-09-${d}`, 8));
    const w = splitWindow(six, PROVINCE_OVERTIME.BC!, none, 1.5);
    expect(w.get("d5")!.overtimeHours).toBe(8);
    expect(w.get("d4")!.overtimeHours).toBe(0);
  });
  test("Alberta: daily-then-weekly equals whichever is greater", () => {
    // 9 h × 6 days = 54 h: daily 6, weekly 54 − 44 = 10 → 10.
    const days = ["21", "22", "23", "24", "25", "26"].map((d, i) => e(`d${i}`, `2026-09-${d}`, 9));
    const s = splitWindow(days, PROVINCE_OVERTIME.AB!, none, 1.5);
    const total = [...s.values()].reduce((n, x) => n + x.overtimeHours, 0);
    expect(total).toBe(Math.max(6, 54 - 44));
  });
  test("two jobs in one day: the second job carries the hours past 8", () => {
    const s = splitWindow([e("am", "2026-09-21", 6), e("pm", "2026-09-21", 4.5)], PROVINCE_OVERTIME.MB!, none, 1.5);
    expect(s.get("am")!.overtimeHours).toBe(0);
    expect(s.get("pm")!.overtimeHours).toBe(2.5);
  });
  test("quarter hours add up exactly", () => {
    const s = splitWindow([e("a", "2026-09-21", 7.25), e("b", "2026-09-21", 0.75), e("c", "2026-09-21", 0.01)], PROVINCE_OVERTIME.MB!, none, 1.5);
    expect(s.get("b")!.overtimeHours).toBe(0);
    expect(s.get("c")!.overtimeHours).toBe(0.01);
  });
  test("hours on a holiday are paid at the holiday multiplier and count toward nothing", () => {
    const week = [e("hol", "2026-09-07", 8), ...["08", "09", "10", "11", "12"].map((d, i) => e(`d${i}`, `2026-09-${d}`, 8))];
    const s = splitWindow(week, PROVINCE_OVERTIME.MB!, new Set(["2026-09-07"]), 1.5);
    expect(s.get("hol")).toMatchObject({ holidayHours: 8, overtimeHours: 0, premiumCents: 8 * 2000 });
    expect(s.get("d4")!.overtimeHours).toBe(0);
  });
  test("averaging over two weeks: 50 + 30 is no overtime at 40 a week in Ontario-style rules", () => {
    const rules = { ...PROVINCE_OVERTIME.ON!, weeklyHours: 40 };
    const entries = [e("w1", "2026-09-14", 50), e("w2", "2026-09-21", 30)];
    const s = splitWindow(entries, rules, none, 1.5, 2);
    expect(s.get("w1")!.overtimeHours + s.get("w2")!.overtimeHours).toBe(0);
    expect(splitWindow([e("w1", "2026-09-14", 50)], rules, none, 1.5, 1).get("w1")!.overtimeHours).toBe(10);
  });
});

describe("holiday pay", () => {
  const input = { straightCents: 4 * 5 * 8 * 4000, straightHours: 160, daysWorked: 20, firstWorkedDaysAgo: 400 };
  test("Ontario: four weeks of wages over 20", () => {
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.ON!, input)).toEqual({ cents: 32_000, hours: 8 });
  });
  test("BC: needs 15 of the 30 days and 30 days on the payroll", () => {
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.BC!, { ...input, daysWorked: 14 })).toMatchObject({ cents: null, reason: "too_few_days" });
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.BC!, { ...input, firstWorkedDaysAgo: 20 })).toMatchObject({ cents: null, reason: "not_employed_long_enough" });
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.BC!, input)).toEqual({ cents: 32_000, hours: 8 });
  });
  test("nobody who hasn't worked, and nothing when the company pays another way", () => {
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.ON!, { ...input, daysWorked: 0, straightCents: 0, straightHours: 0 })).toMatchObject({ cents: null });
    expect(holidayPay({ ...PROVINCE_HOLIDAY_RULES.ON!, method: "none" }, input)).toMatchObject({ cents: null, reason: "method_none" });
  });
});

describe("effective settings", () => {
  test("province defaults unless overridden", () => {
    const s = effectivePaySettings("bc", {});
    expect(s.overtime).toEqual(PROVINCE_OVERTIME.BC);
    expect(s.overtimeIsDefault).toBe(true);
    expect(s.holidays.method).toBe("avg_day_30d");
    const o = effectivePaySettings("ON", { holidays: { method: "none" }, earningCodes: { regular: "1", overtime: "" } });
    expect(o.holidays).toMatchObject({ method: "none", workedMultiplier: 1.5 });
    expect(o.earningCodes).toMatchObject({ regular: "1", overtime: "OT" });
  });
});
