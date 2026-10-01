import test from "node:test";
import assert from "node:assert/strict";
import { accessEnded, canSend, checks, companyInitials, exportsFor, monthEnd, monthState, type AccountantOverview } from "./accountant.ts";

const ov = (o: Partial<Extract<AccountantOverview, { enabled: true }>> = {}): Extract<AccountantOverview, { enabled: true }> => ({
  enabled: true, today: "2026-09-29", company: { name: "Rossi Renovations", ownerName: "Marco Rossi" }, you: { name: "Farah Haddad", role: "accountant" }, fiscalYearEnd: "12-31", province: "ON",
  month: "2026-09", months: [], bank: { total: 160, matched: 142 }, receipts: { total: 41, attached: 38 }, invoices: { total: 15, issued: 14, issuedCents: 5_238_000 },
  payroll: { periods: [{ start: "2026-09-01", end: "2026-09-15", exported: true }, { start: "2026-09-16", end: "2026-09-30", exported: false }] }, ...o,
});

test("the four parts of a month, as the board counts them", () => {
  const c = checks(ov());
  assert.deepEqual(c.map((x) => [x.key, x.done, x.total, x.pct, x.complete]), [["bank", 142, 160, 89, false], ["receipts", 38, 41, 93, false], ["invoices", 14, 15, 93, false], ["payroll", 1, 2, 50, false]]);
  assert.equal(c[2]!.cents, 5_238_000);
  assert.equal(c[2]!.drafts, 1);
  assert.deepEqual(c[3]!.periods, [{ start: "2026-09-01", end: "2026-09-15" }, { start: "2026-09-16", end: "2026-09-30" }]);
});

test("a finished month is all full", () => {
  const c = checks(ov({ bank: { total: 171, matched: 171 }, receipts: { total: 46, attached: 46 }, invoices: { total: 12, issued: 12, issuedCents: 4_491_000 }, payroll: { periods: [{ start: "2026-07-01", end: "2026-07-15", exported: true }] } }));
  assert.ok(c.every((x) => x.complete && x.pct === 100));
});

test("a part with nothing in it isn't listed", () => {
  assert.deepEqual(checks(ov({ bank: null, payroll: null })).map((x) => x.key), ["receipts", "invoices"]);
  assert.deepEqual(checks(ov({ bank: { total: 0, matched: 0 }, receipts: { total: 0, attached: 0 }, invoices: { total: 0, issued: 0, issuedCents: 0 }, payroll: { periods: [] } })), []);
});

test("closed or in progress", () => {
  assert.equal(monthState({ closed: { at: "x", by: null } }), "closed");
  assert.equal(monthState({ closed: null }), "inProgress");
  assert.equal(monthState(undefined), "inProgress");
});

test("the files of a month", () => {
  const e = exportsFor("2026-09", true, monthEnd("2026-09"));
  assert.deepEqual(e.map((x) => x.key), ["transactions", "tax", "payroll"]);
  assert.equal(e[1]!.path, "/api/compliance/remittance.csv?from=2026-09-01&to=2026-09-30");
  assert.equal(e[0]!.path, "/api/accountant/export.csv?kind=transactions&month=2026-09");
  assert.deepEqual(exportsFor("2026-02", false, monthEnd("2026-02")).map((x) => x.key), ["transactions", "tax"]);
  assert.equal(monthEnd("2028-02"), "2028-02-29");
});

test("access ended: the remembered company is gone from the list", () => {
  const known = [{ orgId: "o2", companyName: "Rossi Renovations", role: "accountant" }, { orgId: "o3", companyName: "Hart", role: "foreman" }];
  assert.deepEqual(accessEnded([{ orgId: "o1" }], "o2", known), { ended: true, company: "Rossi Renovations" });
  assert.deepEqual(accessEnded([{ orgId: "o1" }, { orgId: "o2" }], "o2", known), { ended: false, company: "" });
  assert.deepEqual(accessEnded([{ orgId: "o1" }], "o3", known), { ended: false, company: "" });
  assert.deepEqual(accessEnded([{ orgId: "o1" }], null, known), { ended: false, company: "" });
  assert.deepEqual(accessEnded([], "zz", known), { ended: false, company: "" });
});

test("initials and the comment box", () => {
  assert.equal(companyInitials("Rossi Renovations"), "RR");
  assert.equal(companyInitials("Hart"), "HA");
  assert.equal(companyInitials("  "), "");
  assert.equal(canSend("  "), false);
  assert.equal(canSend("Thanks"), true);
  assert.equal(canSend("x".repeat(2001)), false);
});
