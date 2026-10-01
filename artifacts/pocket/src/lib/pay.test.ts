import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays, burdenPercent, canGoNext, centsFrom, earningCodesLine, employeeFlag, firstNames, frequencyOptions, holidaysInYear, jobCards, lineQty, nextHoliday, overtimeRows, percentFrom, periodEndFor,
  periodStatus, totalsOf, warnings, withCodes, withFrequency, withHolidayOff, withPreset, withVacation, type EarningLine, type PayReport, type Preset, type WorkerPay,
} from "./pay.ts";

const OT = { dailyHours: null, dailyDoubleHours: null, weeklyHours: 44, multiplier: 1.5, doubleMultiplier: 2 };
const report = (o: Partial<PayReport> = {}): PayReport => ({
  period: { start: "2026-09-14", end: "2026-09-27" }, today: "2026-09-29", isCurrent: false, holidays: [], employees: [], subcontractors: [], jobs: [],
  totals: { hours: 322.5, overtimeHours: 14, grossCents: 1_124_330, holidayCents: 0, allowanceCents: 19_500, premiumCents: 0 }, pending: { count: 0, hours: 0 }, pendingAllowances: [],
  warnings: { missingPayrollId: [], zeroRate: [] }, exports: [], changedSinceExport: [],
  settings: { province: "ON", frequency: "biweekly", anchorDate: "2026-01-04", weekStartsOn: 0, overtime: OT, overtimeIsDefault: true, averaging: null, holidays: { method: "div20_4w", workedMultiplier: 1.5, minDaysWorked: 0, minEmployedDays: 0, percent: 0, includeOvertime: false, includeVacationPay: false, substituteWeekend: false }, allowances: { kmRateCents: 72, perDiemCents: 0 }, exportFormat: "generic", earningCodes: { regular: "REG", overtime: "OT", double: "DT", holiday: "STAT", holiday_worked: "STATW", mileage: "KM", per_diem: "PD", other: "OTHER" }, vacationPayPercent: null, preset: null },
  previousStart: "2026-08-31", nextStart: "2026-09-28", ...o,
});
const line = (o: Partial<EarningLine>): EarningLine => ({ kind: "regular", code: "REG", hours: 80, quantity: null, rateCents: 3400, amountCents: 272_000, taxable: true, ...o });
const worker = (o: Partial<WorkerPay> = {}): WorkerPay => ({ workerId: "w", name: "Luca Bianchi", payrollId: "L1", hours: 80, lines: [line({})], grossCents: 272_000, allowances: [], jobs: [], ...o });

test("days and period ends", () => {
  assert.equal(addDays("2026-09-27", 1), "2026-09-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(periodEndFor("2026-09-28", "biweekly"), "2026-10-11");
  assert.equal(periodEndFor("2026-09-28", "weekly"), "2026-10-04");
  assert.equal(periodEndFor("2026-09-16", "semimonthly"), "2026-09-30");
  assert.equal(periodEndFor("2026-10-01", "semimonthly"), "2026-10-15");
  assert.equal(periodEndFor("2026-02-01", "monthly"), "2026-02-28");
});
test("period status: exported wins, then over (ready), else in progress", () => {
  assert.deepEqual(periodStatus(report({ exports: [{ id: "x", format: "generic", exportedAt: "2026-09-29T10:00:00Z", exportedByName: null }] })), { kind: "exported", at: "2026-09-29T10:00:00Z" });
  assert.deepEqual(periodStatus(report()), { kind: "ready" });
  assert.deepEqual(periodStatus(report({ isCurrent: true, period: { start: "2026-09-28", end: "2026-10-11" } })), { kind: "progress" });
});
test("you cannot step into a period that has not started", () => {
  assert.equal(canGoNext(report({ nextStart: "2026-09-28" })), true);
  assert.equal(canGoNext(report({ nextStart: "2026-09-30" })), false);
});
test("warnings come in the order of the board and stay out when there is nothing", () => {
  assert.deepEqual(warnings(report(), { pendingNames: [], holiday: null }), []);
  const w = warnings(report({ pending: { count: 4, hours: 31.5 }, changedSinceExport: ["Luca Bianchi"], warnings: { missingPayrollId: ["Sofia Marin"], zeroRate: [] } }), { pendingNames: ["Luca Bianchi"], holiday: { date: "2026-10-12", key: "thanksgiving", name: null, custom: false, observedFrom: null } });
  assert.deepEqual(w.map((x) => x.key), ["approve", "changed", "payroll", "holiday"]);
  assert.equal(w[0]!.hours, 31.5);
});
test("the holiday in the next period", () => {
  const h = [{ date: "2026-09-07", key: "labour_day", name: null, custom: false, observedFrom: null }, { date: "2026-10-12", key: "thanksgiving", name: null, custom: false, observedFrom: null }];
  assert.equal(nextHoliday(h, report({ nextStart: "2026-09-28" }))?.key, "thanksgiving");
  assert.equal(nextHoliday(h, report({ nextStart: "2026-10-12" }))?.key, "thanksgiving");
  assert.equal(nextHoliday(h, report({ nextStart: "2026-10-13" })), null);
  assert.equal(nextHoliday(h, report({ nextStart: "2026-08-01" })), null);
  assert.equal(holidaysInYear(h, "2026-09-29"), 2);
});
test("first names, once each", () => assert.deepEqual(firstNames(["Luca Bianchi", "Amara Okafor", "Luca Rossi"]), ["Luca", "Amara"]));
test("totals", () => {
  const t = totalsOf(report({ employees: [worker(), worker({ workerId: "2" })], pendingAllowances: [{ id: "a", workerId: "w", workerName: "A", date: "", kind: "mileage", quantity: 1, rateCents: 1, amountCents: 1, note: "", projectId: null, projectName: null }] }));
  assert.deepEqual(t, { gross: 1_124_330, hours: 322.5, overtime: 14, holiday: 0, travel: 19_500, claimsWaiting: 1, employees: 2 });
});
test("a line reads as hours, km, days or only an amount", () => {
  assert.deepEqual(lineQty(line({})), { kind: "hours", value: 80, rateCents: 3400 });
  assert.deepEqual(lineQty(line({ kind: "mileage", hours: null, quantity: 142, rateCents: 72 })), { kind: "km", value: 142, rateCents: 72 });
  assert.deepEqual(lineQty(line({ kind: "per_diem", hours: null, quantity: 3, rateCents: 4500 })), { kind: "days", value: 3, rateCents: 4500 });
  assert.deepEqual(lineQty(line({ kind: "other", hours: null, quantity: 1 })), { kind: "amount" });
});
test("employee flags: no payroll number first, then no rate", () => {
  assert.equal(employeeFlag(worker()), null);
  assert.equal(employeeFlag(worker({ payrollId: null })), "noPayroll");
  assert.equal(employeeFlag(worker({ lines: [line({ rateCents: 0 })] })), "noRate");
});
test("jobs, biggest first, with their share", () => {
  const j = (name: string, total: number, burden = 0) => ({ projectId: name, name, hours: 1, overtimeHours: 0, straightCents: total, premiumCents: 0, burdenCents: burden, allowanceCents: 0, totalCents: total });
  const c = jobCards([j("a", 100), j("b", 300)]);
  assert.deepEqual(c.map((x) => [x.name, x.share]), [["b", 0.75], ["a", 0.25]]);
  assert.equal(jobCards([j("a", 0)])[0]!.share, 0);
  assert.equal(burdenPercent([j("a", 1000, 180)]), 18);
  assert.equal(burdenPercent([j("a", 1000)]), null);
});
test("overtime rows", () => {
  assert.deepEqual(overtimeRows(OT, 1.5), { starts: { kind: "weekly", hours: 44 }, multiplier: 1.5, premium: { kind: "holiday", multiplier: 1.5 } });
  assert.deepEqual(overtimeRows({ ...OT, dailyHours: 8, dailyDoubleHours: 12 }, 1).starts, { kind: "both", daily: 8, weekly: 44 });
  assert.deepEqual(overtimeRows({ ...OT, dailyHours: 8, dailyDoubleHours: 12 }, 1).premium, { kind: "double", hours: 12, multiplier: 2 });
  assert.deepEqual(overtimeRows({ ...OT, weeklyHours: null }, 1), { starts: { kind: "none" }, multiplier: 1.5, premium: { kind: "none" } });
});
test("frequencies: monthly shows only when the company has it", () => {
  assert.deepEqual(frequencyOptions("biweekly"), ["weekly", "biweekly", "semimonthly"]);
  assert.equal(frequencyOptions("monthly").length, 4);
});
test("amounts typed in fields", () => {
  assert.equal(centsFrom("0,72"), 72);
  assert.equal(centsFrom("$45.50"), 4550);
  assert.equal(centsFrom(""), null);
  assert.equal(percentFrom("4"), 4);
  assert.equal(percentFrom("25"), null);
  assert.equal(earningCodesLine(report().settings.earningCodes), "REG · OT · STAT · KM · PD");
});
test("saving keeps what was there and changes one thing", () => {
  const raw = { frequency: "biweekly" as const, holidays: { added: [{ date: "2026-12-24", name: "Shutdown" }], removed: ["2026-08-03"], method: "none", substituteWeekend: true } };
  assert.equal(withFrequency(raw, "weekly").frequency, "weekly");
  assert.equal(withFrequency(raw, "weekly").holidays, raw.holidays);
  const preset: Preset = { key: "on_construction", overtime: OT, holidays: { method: "pct_of_wages", percent: 7.7 } };
  const p = withPreset(raw, preset);
  assert.equal(p.preset, "on_construction");
  assert.deepEqual(p.holidays, { added: raw.holidays.added, removed: ["2026-08-03"], substituteWeekend: true, method: "pct_of_wages", percent: 7.7 });
  const g = withPreset(p, null);
  assert.equal(g.overtime, null);
  assert.deepEqual(g.holidays, { added: raw.holidays.added, removed: ["2026-08-03"], substituteWeekend: true });
  assert.equal(withVacation(raw, 0).vacationPayPercent, null);
  assert.equal(withVacation(raw, 4).vacationPayPercent, 4);
  assert.deepEqual(withHolidayOff(raw, "2026-09-07", true).holidays?.removed, ["2026-08-03", "2026-09-07"]);
  assert.deepEqual(withHolidayOff(raw, "2026-08-03", false).holidays?.removed, []);
  const d = report().settings.earningCodes;
  assert.deepEqual(withCodes({}, { ...d, regular: "REGULAR" }, d).earningCodes, { regular: "REGULAR" });
});
