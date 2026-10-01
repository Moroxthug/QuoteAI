import test from "node:test";
import assert from "node:assert/strict";
import { candidateCount, checklist, closeState, dayOfIso, defaultMonth, filterCounts, linesFor, monthChips, monthLines, needsPicker, openCount, parseNa, serializeNa, shiftMonth, suggestion, type BankLine, type CheckItem, type Candidates } from "./books.ts";

const item = (key: CheckItem["key"], count: number, applies = true): CheckItem => ({ key, applies, count, cents: 0, href: "", rows: [] });
const line = (o: Partial<BankLine>): BankLine => ({ id: "l", date: "2026-09-28T00:00:00.000Z", description: "x", amountCents: 100, status: "unmatched", autoMatched: false, match: null, ...o });
const cands = (o: Partial<Candidates>): Candidates => ({ direction: "in", costs: [], payments: [], invoices: [], ...o });

test("months shift across the year", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-11", 3), "2027-02");
});
test("chips: the last four months ending now, closed ones marked; opens on the month just ended", () => {
  const c = monthChips("2026-10-01", ["2026-08", "2026-07"]);
  assert.deepEqual(c.map((x) => [x.month, x.closed]), [["2026-07", true], ["2026-08", true], ["2026-09", false], ["2026-10", false]]);
  assert.equal(defaultMonth("2026-10-01"), "2026-09");
  assert.equal(defaultMonth("2026-01-15"), "2025-12");
});
test("the checklist leaves out what does not apply and counts open, done and not needed", () => {
  const list = checklist([item("bank_unmatched", 3), item("payments_unbanked", 2, false), item("costs_pending", 0), item("hours" as never, 0, false), item("claims_open", 2)], new Set(["claims_open"]));
  assert.deepEqual(list.map((i) => [i.key, i.open, i.na]), [["bank_unmatched", true, false], ["costs_pending", false, false], ["claims_open", false, true]]);
  assert.equal(openCount(list), 1);
});
test("close: not before the month is over, not with items open, once", () => {
  const open = checklist([item("bank_unmatched", 1)], new Set());
  const done = checklist([item("bank_unmatched", 0)], new Set());
  assert.equal(closeState("2026-10", "2026-10-31", done, false), "notOver");
  assert.equal(closeState("2026-09", "2026-10-01", open, false), "openItems");
  assert.equal(closeState("2026-09", "2026-10-01", done, false), "ready");
  assert.equal(closeState("2026-09", "2026-10-01", open, true), "closed");
});
test("not-needed marks round-trip and survive garbage", () => {
  assert.deepEqual([...parseNa(serializeNa(new Set(["b", "a"])))], ["a", "b"]);
  assert.equal(parseNa("{nope").size, 0);
  assert.equal(parseNa(null).size, 0);
});
test("a bank day: midnight UTC is that date", () => {
  assert.equal(dayOfIso("2026-09-28T00:00:00.000Z"), "2026-09-28");
});
test("lines of the month, newest first, split by filter", () => {
  const ls = [line({ id: "a", date: "2026-09-16T00:00:00.000Z", status: "matched" }), line({ id: "b", date: "2026-09-28T00:00:00.000Z" }), line({ id: "c", date: "2026-08-30T00:00:00.000Z" }), line({ id: "d", date: "2026-09-18T00:00:00.000Z", status: "ignored" })];
  const m = monthLines(ls, "2026-09");
  assert.deepEqual(m.map((l) => l.id), ["b", "d", "a"]);
  assert.deepEqual(filterCounts(m), { open: 1, matched: 1, ignored: 1 });
  assert.deepEqual(linesFor(m, "ignored").map((l) => l.id), ["d"]);
});
test("suggestions: a payment first, an exact invoice before a part one, a cost for money out", () => {
  assert.equal(suggestion(undefined), null);
  assert.deepEqual(suggestion(cands({ payments: [{ id: "p", invoiceId: "i", invoiceNumber: "INV-1", customer: "A", date: "", amountCents: 1, method: "" }] })), { kind: "payment", id: "p", number: "INV-1", customer: "A" });
  const s = suggestion(cands({ invoices: [{ id: "1", number: "INV-1", customer: "A", balanceCents: 5, dueDate: "", status: "sent", exact: false }, { id: "2", number: "INV-2", customer: "B", balanceCents: 1, dueDate: "", status: "sent", exact: true }] }));
  assert.equal(s?.kind === "invoice" && s.id, "2");
  const o = suggestion(cands({ direction: "out", costs: [{ id: "c", vendor: "Home Depot", description: "", date: "2026-09-26", totalCents: 1, status: "", source: "receipt", projectName: null }] }));
  assert.deepEqual(o, { kind: "cost", id: "c", label: "Home Depot", date: "2026-09-26" });
});
test("one strong candidate matches in one tap; none or several open the sheet", () => {
  const inv = (id: string, exact: boolean) => ({ id, number: id, customer: "", balanceCents: 1, dueDate: "", status: "sent", exact });
  assert.equal(needsPicker(undefined), true);
  assert.equal(needsPicker(cands({})), true);
  assert.equal(needsPicker(cands({ invoices: [inv("1", true), inv("2", false), inv("3", false)] })), false);
  assert.equal(needsPicker(cands({ invoices: [inv("1", true), inv("2", true)] })), true);
  assert.equal(needsPicker(cands({ invoices: [inv("1", false)] })), false);
  assert.equal(needsPicker(cands({ invoices: [inv("1", false), inv("2", false)] })), true);
  assert.equal(candidateCount(cands({ invoices: [inv("1", false)] })), 1);
});
