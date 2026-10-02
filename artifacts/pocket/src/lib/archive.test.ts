import assert from "node:assert/strict";
import { test } from "node:test";
import { byMonth, canDelete, matches, type ArchiveItem } from "./archive.ts";

const item = (id: string, type: ArchiveItem["type"], title: string, archivedAt: string, detail = "", state = ""): ArchiveItem => ({ id, type, title, detail, state, amountCents: null, archivedAt, archivedByName: null });

test("rows group by month, newest first", () => {
  const g = byMonth([item("a", "quote", "A", "2026-08-04T10:00:00Z"), item("b", "job", "B", "2026-09-14T10:00:00Z"), item("c", "client", "C", "2026-09-02T10:00:00Z")]);
  assert.deepEqual(g.map((x) => [x.month, x.rows.map((r) => r.id)]), [["2026-09", ["b", "c"]], ["2026-08", ["a"]]]);
});

test("search ignores case and accents and reads the number and the state", () => {
  const i = item("a", "invoice", "Hélène Côté", "2026-09-02T10:00:00Z", "INV-0388", "paid");
  assert.equal(matches(i, "helene"), true);
  assert.equal(matches(i, "inv-0388"), true);
  assert.equal(matches(i, "PAID"), true);
  assert.equal(matches(i, "invoice"), true);
  assert.equal(matches(i, "zzz"), false);
  assert.equal(matches(i, "  "), true);
});

test("only a quote, an invoice and a job can be deleted for good", () => {
  assert.deepEqual((["quote", "client", "invoice", "job", "contract"] as const).filter(canDelete), ["quote", "invoice", "job"]);
});
