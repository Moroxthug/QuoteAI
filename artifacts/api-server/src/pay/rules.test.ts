import { describe, expect, test } from "vitest";
import {
  effectivePaySettings,
  holidayBaseCents,
  holidayPay,
  holidayPercentOf,
  holidaysBetween,
  hoursAfterMidnight,
  overtimeWindow,
  periodContaining,
  splitWindow,
  zonedMidnight,
  PAY_PRESETS,
  PROVINCE_HOLIDAY_RULES,
  PROVINCE_OVERTIME,
  type WindowEntry,
} from "./rules.js";

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
  test("substitute days: a weekend holiday is taken on the next weekday that is free", () => {
    const sub = { holidays: { substituteWeekend: true } };
    // 2027: Christmas is a Saturday, Boxing Day a Sunday.
    expect(holidaysBetween("ON", "2027-12-20", "2027-12-31").map((h) => h.date)).toEqual(["2027-12-25", "2027-12-26"]);
    const moved = holidaysBetween("ON", "2027-12-20", "2027-12-31", sub);
    expect(moved.map((h) => [h.key, h.date, h.observedFrom])).toEqual([["christmas", "2027-12-27", "2027-12-25"], ["boxing_day", "2027-12-28", "2027-12-26"]]);
    // A holiday moved in from just before the range is found; removing the real date removes it.
    expect(holidaysBetween("ON", "2028-07-03", "2028-07-03", sub).map((h) => h.key)).toEqual(["canada_day"]);
    expect(holidaysBetween("ON", "2028-07-03", "2028-07-03", { holidays: { substituteWeekend: true, removed: ["2028-07-01"] } })).toEqual([]);
    // A weekday holiday stays put.
    expect(holidaysBetween("ON", "2026-09-07", "2026-09-07", sub)[0]).toMatchObject({ date: "2026-09-07", observedFrom: null });
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

describe("across midnight", () => {
  test("local midnight, including the night the clocks change", () => {
    expect(zonedMidnight("2026-09-22", "America/Toronto").toISOString()).toBe("2026-09-22T04:00:00.000Z");
    expect(zonedMidnight("2026-03-08", "America/Toronto").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(zonedMidnight("2026-03-09", "America/Toronto").toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(zonedMidnight("2026-09-22", "America/St_Johns").toISOString()).toBe("2026-09-22T02:30:00.000Z");
  });
  test("the part of a shift after midnight, as a share of the recorded hours", () => {
    const inAt = new Date("2026-09-22T02:00:00Z"); // 22:00 on the 21st in Toronto
    const outAt = new Date("2026-09-22T10:00:00Z"); // 06:00 on the 22nd
    expect(hoursAfterMidnight("2026-09-21", 8, inAt, outAt, "America/Toronto")).toBe(6);
    expect(hoursAfterMidnight("2026-09-21", 7, inAt, outAt, "America/Toronto")).toBe(5.25);
    expect(hoursAfterMidnight("2026-09-21", 8, null, null, "America/Toronto")).toBe(0);
    expect(hoursAfterMidnight("2026-09-21", 4, new Date("2026-09-21T12:00:00Z"), new Date("2026-09-21T16:00:00Z"), "America/Toronto")).toBe(0);
  });
  test("BC: a 22:00–08:00 shift is 2 + 8, not 10 on one day", () => {
    const night = { ...e("n", "2026-09-21", 10), nextDayHours: 8 };
    expect(splitWindow([night], PROVINCE_OVERTIME.BC!, none, 1.5).get("n")!.overtimeHours).toBe(0);
    // Four more hours on the 22nd make it a 12-hour day there.
    const s = splitWindow([night, e("d", "2026-09-22", 4)], PROVINCE_OVERTIME.BC!, none, 1.5);
    expect(s.get("d")!.overtimeHours).toBe(4);
  });
  test("the hours after midnight on a holiday are holiday hours", () => {
    const s = splitWindow([{ ...e("n", "2026-09-06", 8), nextDayHours: 3 }], PROVINCE_OVERTIME.BC!, new Set(["2026-09-07"]), 1.5);
    expect(s.get("n")).toMatchObject({ holidayHours: 3, overtimeHours: 0, premiumCents: 3 * 2000 });
  });
  test("a tail from the previous week counts toward that day's threshold", () => {
    const s = splitWindow([e("m", "2026-09-20", 6)], PROVINCE_OVERTIME.BC!, none, 1.5, 1, new Map([["2026-09-20", 4]]));
    expect(s.get("m")!.overtimeHours).toBe(2);
  });
});

describe("holiday pay", () => {
  const input = { wagesCents: 4 * 5 * 8 * 4000, straightHours: 160, daysWorked: 20, firstWorkedDaysAgo: 400 };
  test("Ontario: four weeks of wages over 20", () => {
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.ON!, input)).toEqual({ cents: 32_000, hours: 8 });
  });
  test("BC: needs 15 of the 30 days and 30 days on the payroll", () => {
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.BC!, { ...input, daysWorked: 14 })).toMatchObject({ cents: null, reason: "too_few_days" });
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.BC!, { ...input, firstWorkedDaysAgo: 20 })).toMatchObject({ cents: null, reason: "not_employed_long_enough" });
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.BC!, input)).toEqual({ cents: 32_000, hours: 8 });
  });
  test("nobody who hasn't worked, and nothing when the company pays another way", () => {
    expect(holidayPay(PROVINCE_HOLIDAY_RULES.ON!, { ...input, daysWorked: 0, wagesCents: 0, straightHours: 0 })).toMatchObject({ cents: null });
    expect(holidayPay({ ...PROVINCE_HOLIDAY_RULES.ON!, method: "none" }, input)).toMatchObject({ cents: null, reason: "method_none" });
    expect(holidayPay({ ...PROVINCE_HOLIDAY_RULES.ON!, method: "pct_of_wages", percent: 7.7 }, input)).toMatchObject({ cents: null, reason: "method_none" });
  });
  test("the base: vacation pay on the cheque counts in ON, AB and BC; overtime only when the rules say", () => {
    const wages = { straightCents: 100_000, overtimeCents: 30_000 };
    expect(holidayBaseCents(PROVINCE_HOLIDAY_RULES.ON!, 4, wages)).toBe(104_000);
    expect(holidayBaseCents(PROVINCE_HOLIDAY_RULES.ON!, null, wages)).toBe(100_000);
    expect(holidayBaseCents(PROVINCE_HOLIDAY_RULES.QC!, 4, wages)).toBe(100_000);
    expect(holidayBaseCents({ ...PROVINCE_HOLIDAY_RULES.QC!, includeOvertime: true }, null, wages)).toBe(130_000);
    expect(PROVINCE_HOLIDAY_RULES.AB!.includeVacationPay && PROVINCE_HOLIDAY_RULES.BC!.includeVacationPay).toBe(true);
  });
  test("ON construction: 7.7 % of wages in lieu", () => {
    const rules = { ...PROVINCE_HOLIDAY_RULES.ON!, ...PAY_PRESETS.on_construction!.holidays };
    expect(holidayPercentOf(rules, 100_000)).toBe(7_700);
    expect(holidayPercentOf(PROVINCE_HOLIDAY_RULES.ON!, 100_000)).toBe(0);
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
  test("presets and vacation pay", () => {
    expect(effectivePaySettings("ON", { preset: "on_road_building", vacationPayPercent: 4 })).toMatchObject({ preset: "on_road_building", vacationPayPercent: 4 });
    expect(effectivePaySettings("ON", { preset: "nope", vacationPayPercent: 0 })).toMatchObject({ preset: null, vacationPayPercent: null });
    expect(PAY_PRESETS.on_road_building!.overtime.weeklyHours).toBe(55);
    expect(PAY_PRESETS.qc_construction_residential!.overtime).toMatchObject({ dailyHours: 8, weeklyHours: 40 });
  });
});
