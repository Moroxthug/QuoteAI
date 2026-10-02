import assert from "node:assert/strict";
import { test } from "node:test";
import { failuresOf, logLines, lookOf, mapRows, shortError, unmatchedTax, type Conn, type LogEntry } from "./quickbooks.ts";

const e = (id: string, entityType: string, entityId: string, status: string, error: string | null = null): LogEntry => ({ id, entityType, entityId, qboId: null, status, error, createdAt: `2026-10-01T0${id}:00:00Z` });

test("a failure counts until a later row for the same thing", () => {
  const rows = [e("3", "invoice", "a", "success"), e("2", "invoice", "a", "failed"), e("1", "invoice", "b", "failed"), e("0", "payment_pull", "c", "failed")];
  assert.deepEqual(failuresOf(rows).map((r) => r.entityId), ["b"]);
});

test("the state", () => {
  assert.equal(lookOf(undefined, 0), "off");
  assert.equal(lookOf({ connected: false }, 0), "off");
  assert.equal(lookOf({ connected: true }, 2), "attention");
  assert.equal(lookOf({ connected: true, isEnabled: false }, 0), "paused");
  assert.equal(lookOf({ connected: true, isEnabled: true }, 0), "on");
});

test("log lines name the invoice and its client", () => {
  const lines = logLines([e("2", "invoice", "i1", "failed", "no tax code"), e("1", "cost_entry", "c1", "success")], [{ id: "i1", number: "INV-0423", clientName: "Okoye Condo" }]);
  assert.deepEqual(lines.map((l) => [l.kind, l.title, l.failed, l.retryable]), [["invoice", "INV-0423 · Okoye Condo", true, true], ["expense", "", false, false]]);
});

test("short errors", () => {
  assert.equal(shortError("  a\n b  "), "a b");
  assert.equal(shortError("x".repeat(100)).length, 90);
  assert.equal(shortError(null), "");
});

test("the matching list has a row for each tax set and the accounts", () => {
  const c: Conn = { connected: true, taxSets: ["HST 13%", "none", "GST 5%"], taxCodeMap: { "HST 13%": "HST ON" }, incomeAccountName: "Sales", paymentAccountName: "Chequing", categoryMap: { materials: "Job Materials" } };
  assert.deepEqual(mapRows(c).map((r) => [r.key, r.to]), [["tax:HST 13%", "HST ON"], ["tax:GST 5%", null], ["income", "Sales"], ["deposit", null], ["payment", "Chequing"], ["materials", "Job Materials"]]);
  assert.deepEqual(unmatchedTax(c), ["GST 5%"]);
});
