import test from "node:test";
import assert from "node:assert/strict";
import {
  buildItems, cycle, daysBetween, defaultSelection, deadlineItem, doneVerb, featuredReturn, filePath, filterCounts, groups, isEmptyCalendar, kpis, lookOf, marks, monthTicks,
  netOf, periodLabel, previousReturn, reminderItem, setupOf, settingsFor, shortName, statusOf, wordOf, canEditBooks, FISCAL_ENDS, type ComplianceOverview, type DeadlineDto, type ReminderDto,
} from "./compliance.ts";

const TODAY = "2026-09-29";
const dl = (o: Partial<DeadlineDto>): DeadlineDto => ({
  key: "sales_tax:Q2026-09", kind: "sales_tax", periodKey: "Q2026-09", periodStart: "2026-07-01", periodEnd: "2026-09-30", dueDate: "2026-10-31", tax: "GST/HST", authority: "cra", frequency: "quarterly", hasWorksheet: true,
  filedAt: null, filedByName: null, note: "", daysLeft: 32, state: "upcoming", ...o,
});
const rem = (o: Partial<ReminderDto>): ReminderDto => ({
  id: "r1", kind: "other", preset: null, title: "Van plate renewal", authority: "", reference: "", url: null, dueDate: "2026-09-26", recurrence: "annual", remindDaysBefore: 30, notes: "", lastDoneAt: null, daysLeft: -3, state: "overdue", ...o,
});
const ov = (o: Partial<Extract<ComplianceOverview, { enabled: true }>> = {}): Extract<ComplianceOverview, { enabled: true }> => ({
  enabled: true, today: TODAY, settings: { salesTaxFrequency: "quarterly" }, registrations: { province: "ON", pstNumber: null },
  deadlines: [dl({}), dl({ key: "sales_tax:Q2026-12", periodKey: "Q2026-12", periodStart: "2026-10-01", periodEnd: "2026-12-31", dueDate: "2027-01-31" })],
  filed: [dl({ key: "sales_tax:Q2026-06", periodKey: "Q2026-06", periodStart: "2026-04-01", periodEnd: "2026-06-30", dueDate: "2026-07-31", state: "filed", filedAt: "2026-07-28T15:00:00.000Z" })],
  filedThisYear: { count: 3, onTime: 3 },
  reminders: [rem({}), rem({ id: "r2", kind: "insurance", title: "Liability insurance", dueDate: "2026-11-14", daysLeft: 46, authority: "" }), rem({ id: "r3", kind: "licence", title: "Contractor licence", dueDate: "2027-03-31", daysLeft: 183 })],
  presets: [], ...o,
});

test("days between calendar days, and a filing's look", () => {
  assert.equal(daysBetween("2026-09-29", "2026-10-31"), 32);
  assert.equal(daysBetween("2026-09-29", "2026-09-26"), -3);
  assert.equal(lookOf(-1, false), "overdue");
  assert.equal(lookOf(0, false), "due");
  assert.equal(lookOf(90, false), "due");
  assert.equal(lookOf(91, false), "later");
  assert.equal(lookOf(-40, true), "filed");
});

test("the list: open ones by date, then filed ones; a past filed period stays in", () => {
  const items = buildItems(ov());
  assert.deepEqual(items.map((i) => i.id), ["reminder:r1", "sales_tax:Q2026-09", "reminder:r2", "sales_tax:Q2026-12", "reminder:r3", "sales_tax:Q2026-06"]);
  assert.deepEqual(items.map((i) => i.look), ["overdue", "due", "due", "later", "later", "filed"]);
});

test("a deadline more than ten months off stays out of the list", () => {
  const far = dl({ key: "sales_tax:Q2027-09", periodKey: "Q2027-09", periodStart: "2027-07-01", periodEnd: "2027-09-30", dueDate: "2027-10-31" });
  assert.ok(!buildItems(ov({ deadlines: [dl({}), far] })).some((i) => i.id === far.key));
  assert.ok(buildItems(ov({ deadlines: [dl({}), far] })).some((i) => i.id === "sales_tax:Q2026-09"));
});

test("a deadline listed twice (in the calendar and as recently filed) shows once", () => {
  const filed = dl({ state: "filed", filedAt: "2026-09-29T12:00:00.000Z" });
  const items = buildItems(ov({ deadlines: [filed], filed: [filed], reminders: [] }));
  assert.equal(items.length, 1);
  assert.equal(items[0]!.filedToday, true);
});

test("status words as the board says them", () => {
  const items = buildItems(ov());
  const w = (id: string) => wordOf(items.find((i) => i.id === id)!);
  assert.deepEqual(w("reminder:r1"), { kind: "late", days: 3 });
  assert.deepEqual(w("sales_tax:Q2026-09"), { kind: "due", verb: "due" });
  assert.deepEqual(w("reminder:r2"), { kind: "due", verb: "renews" });
  assert.deepEqual(w("sales_tax:Q2026-06"), { kind: "filed" });
  const paid = deadlineItem(dl({ kind: "sales_tax_payment", state: "filed", filedAt: "2026-09-29T10:00:00.000Z" }), TODAY);
  assert.deepEqual(wordOf(paid), { kind: "paidToday" });
  assert.deepEqual(statusOf("overdue"), { tone: "bad", shape: "alert" });
  assert.deepEqual(statusOf("filed"), { tone: "ok", shape: "check" });
});

test("the verb on the done button", () => {
  assert.equal(doneVerb({ source: "deadline", kind: "sales_tax" }), "markFiled");
  assert.equal(doneVerb({ source: "deadline", kind: "gst_instalment" }), "markPaid");
  assert.equal(doneVerb({ source: "reminder", kind: "insurance" }), "markRenewed");
  assert.equal(doneVerb({ source: "reminder", kind: "licence" }), "markRenewed");
  assert.equal(doneVerb({ source: "reminder", kind: "workers_comp" }), "markFiled");
  assert.equal(doneVerb({ source: "reminder", kind: "other" }), "markDone");
});

test("the period a return covers", () => {
  assert.deepEqual(periodLabel({ start: "2026-07-01", end: "2026-09-30", frequency: "quarterly" }), { kind: "quarter", quarter: 3 });
  assert.deepEqual(periodLabel({ start: "2026-04-01", end: "2026-06-30", frequency: "quarterly" }), { kind: "quarter", quarter: 2 });
  assert.deepEqual(periodLabel({ start: "2026-02-01", end: "2026-04-30", frequency: "quarterly" }), { kind: "range", start: "2026-02-01", end: "2026-04-30" });
  assert.deepEqual(periodLabel({ start: "2026-09-01", end: "2026-09-30", frequency: "monthly" }), { kind: "month", month: "2026-09" });
  assert.deepEqual(periodLabel({ start: "2026-01-01", end: "2026-12-31", frequency: "annual" }), { kind: "year", end: "2026-12-31" });
});

test("the number cards", () => {
  const items = buildItems(ov());
  const k = kpis(items, { count: 3, onTime: 2 });
  assert.equal(k.late, 1);
  assert.equal(k.lateFirst?.title, "Van plate renewal");
  assert.equal(k.next30, 0);
  const near = buildItems(ov({ reminders: [rem({ id: "w", kind: "workers_comp", title: "WSIB premium report", authority: "WSIB", dueDate: "2026-10-15", daysLeft: 16 })] }));
  const k2 = kpis(near, { count: 0, onTime: 0 });
  assert.equal(k2.late, 0);
  assert.deepEqual(k2.nextTwo.map(shortName), ["WSIB"]);
  assert.equal(shortName(items.find((i) => i.id === "sales_tax:Q2026-09")!), "HST");
  assert.equal(shortName(deadlineItem(dl({ kind: "t5018", tax: "" }), TODAY)), "T5018");
  assert.equal(shortName(deadlineItem(dl({ tax: "GST/QST" }), TODAY)), "QST");
});

test("groups and chips", () => {
  const items = buildItems(ov());
  assert.deepEqual(groups(items, "all").map((g) => [g.key, g.items.length]), [["late", 1], ["next", 2], ["later", 2], ["filed", 1]]);
  assert.deepEqual(groups(items, "overdue").map((g) => g.key), ["late"]);
  assert.deepEqual(groups(items, "due").map((g) => g.key), ["next", "later"]);
  assert.deepEqual(groups(items, "filed").map((g) => g.key), ["filed"]);
  assert.deepEqual(filterCounts(items), { all: 6, due: 4, overdue: 1, filed: 1 });
  assert.deepEqual(groups(buildItems(ov({ reminders: [], deadlines: [] })), "overdue"), []);
});

test("only the six most recent filed ones show", () => {
  const many = Array.from({ length: 9 }, (_, n) => dl({ key: `pst:P${n}`, kind: "pst", periodKey: `P${n}`, dueDate: `2026-0${(n % 9) + 1}-20`, state: "filed", filedAt: `2026-0${(n % 9) + 1}-18T12:00:00.000Z` }));
  const items = buildItems(ov({ deadlines: [], filed: many, reminders: [] }));
  const g = groups(items, "filed");
  assert.equal(g[0]!.items.length, 6);
  assert.equal(g[0]!.items[0]!.filedOn, "2026-09-18");
  assert.equal(filterCounts(items).filed, 6);
});

test("the first selection is the first late item", () => {
  assert.equal(defaultSelection(buildItems(ov())), "reminder:r1");
  assert.equal(defaultSelection(buildItems(ov({ reminders: [] }))), "sales_tax:Q2026-09");
  assert.equal(defaultSelection([]), null);
});

test("the 90-day strip: late at the left edge, alternating lanes, month ticks", () => {
  const m = marks(buildItems(ov()));
  assert.deepEqual(m.map((x) => x.id), ["reminder:r1", "sales_tax:Q2026-09", "reminder:r2"]);
  assert.equal(m[0]!.pct, 3.5);
  assert.deepEqual(m.map((x) => x.lane), ["up", "dn", "up"]);
  assert.equal(m[1]!.pct, 35.6);
  assert.deepEqual(monthTicks(TODAY), [{ month: "2026-10", pct: 2.2 }, { month: "2026-11", pct: 36.7 }, { month: "2026-12", pct: 70 }]);
});

test("the return on the HST card and the one before it", () => {
  const items = buildItems(ov());
  const f = featuredReturn(items);
  assert.equal(f?.id, "sales_tax:Q2026-09");
  assert.equal(previousReturn(items, f)?.id, "sales_tax:Q2026-06");
  assert.equal(featuredReturn(buildItems(ov({ deadlines: [], filed: [], reminders: [] }))), null);
});

test("net tax of a worksheet: GST/HST, plus QST in Québec", () => {
  const w = { from: "a", to: "b", summary: { invoiceCount: 1, gstHst: { collectedCents: 986840, creditsCents: 365640, netCents: 621200 }, qst: { collectedCents: 1000, creditsCents: 200, netCents: 800 } } };
  assert.deepEqual(netOf(w, "GST/HST"), { netCents: 621200, collectedCents: 986840, creditsCents: 365640 });
  assert.deepEqual(netOf(w, "GST/QST"), { netCents: 622000, collectedCents: 987840, creditsCents: 365840 });
});

test("the file an item downloads", () => {
  const items = buildItems(ov());
  assert.equal(filePath(items.find((i) => i.id === "sales_tax:Q2026-09")!), "/api/compliance/remittance.csv?from=2026-07-01&to=2026-09-30");
  assert.equal(filePath(deadlineItem(dl({ kind: "t5018", periodKey: "2026", periodStart: "2026-01-01", periodEnd: "2026-12-31" }), TODAY)), "/api/compliance/t5018.csv?year=2026");
  assert.equal(filePath(deadlineItem(dl({ kind: "gst_instalment" }), TODAY)), null);
  assert.equal(filePath(reminderItem(rem({}), TODAY)), null);
});

test("an empty calendar and the answers that fill it", () => {
  assert.equal(isEmptyCalendar(ov()), false);
  const empty = ov({ settings: {}, deadlines: [], filed: [], reminders: [] });
  assert.equal(isEmptyCalendar(empty), true);
  assert.equal(isEmptyCalendar({ ...empty, settings: { t5018: true } }), false);
  const s = setupOf({});
  assert.deepEqual(s, { frequency: "quarterly", fiscalYearEnd: "12-31", instalments: false, t5018: false });
  assert.deepEqual(settingsFor({ ...s, frequency: "monthly", t5018: true }), { salesTaxFrequency: "monthly", fiscalYearEnd: "12-31", instalments: false, t5018: true });
  assert.equal(setupOf({ fiscalYearEnd: "03-31", salesTaxFrequency: "annual" }).fiscalYearEnd, "03-31");
  assert.equal(setupOf({ fiscalYearEnd: "09-30" }).fiscalYearEnd, "12-31");
  assert.equal(cycle(FISCAL_ENDS, "06-30"), "12-31");
  assert.equal(cycle(["a", "b"] as const, "a"), "b");
});

test("who may change what is filed", () => {
  assert.equal(canEditBooks("owner"), true);
  assert.equal(canEditBooks("office"), true);
  assert.equal(canEditBooks("accountant"), false);
  assert.equal(canEditBooks("viewer"), false);
  assert.equal(canEditBooks(null), false);
});
