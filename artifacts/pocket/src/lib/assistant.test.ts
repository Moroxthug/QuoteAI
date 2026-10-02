import test from "node:test";
import assert from "node:assert/strict";
import { badge, clockLabel, dayFromKey, groupByDay, look, matches, moveMinute, orderTotal, thumbBox, voiceShare, type ActivityRow } from "./assistant.ts";
import { add, mergePatch, parse, without } from "./assistantOutbox.ts";

const row = (id: string, at: string, over: Partial<ActivityRow> = {}): ActivityRow => ({ id, at, kind: "reminder", title: "t", detail: "", params: {}, who: "Marco", whoKind: "you", category: "msg", undo: "none", word: "", undone: false, invoiceId: null, ...over });

test("activity is grouped by day, newest first, as Today and Yesterday", () => {
  const now = new Date(2026, 8, 29, 11, 0);
  const rows = [row("old", new Date(2026, 8, 20, 9, 0).toISOString()), row("y", new Date(2026, 8, 28, 17, 47).toISOString()), row("a", new Date(2026, 8, 29, 7, 5).toISOString()), row("b", new Date(2026, 8, 29, 10, 12).toISOString())];
  const g = groupByDay(rows, now);
  assert.deepEqual(g.map((x) => x.key), ["today", "yesterday", `2026-8-20`]);
  assert.deepEqual(g[0]!.rows.map((r) => r.id), ["b", "a"]);
});

test("the filters keep what they say", () => {
  const you = row("1", "2026-09-29T10:00:00Z", { whoKind: "you", category: "jobs" });
  const auto = row("2", "2026-09-29T10:00:00Z", { whoKind: "auto", category: "money" });
  assert.equal(matches("all", you), true);
  assert.equal(matches("you", auto), false);
  assert.equal(matches("auto", auto), true);
  assert.equal(matches("jobs", you), true);
  assert.equal(matches("money", you), false);
});

test("the voice allowance never reads past full, and the notice is due at 80 percent", () => {
  assert.deepEqual(voiceShare(142, 300), { pct: 47, near: false });
  assert.deepEqual(voiceShare(240, 300), { pct: 80, near: true });
  assert.deepEqual(voiceShare(900, 300), { pct: 100, near: true });
  assert.deepEqual(voiceShare(5, 0), { pct: 0, near: false });
});

test("quiet hours read as the boards write them", () => {
  assert.equal(clockLabel(20 * 60, "fr-CA"), "20 h");
  assert.equal(clockLabel(7 * 60 + 30, "fr-CA"), "7 h 30");
  assert.match(clockLabel(20 * 60, "en-CA"), /^8:00\s?p\.?m\.?$/i);
  assert.equal(moveMinute(23 * 60 + 30, 60), 30);
  assert.equal(moveMinute(0, -30), 23 * 60 + 30);
});

test("the three-stop control's thumb sits under the chosen stop (1 : 1.3 : 0.7)", () => {
  const a = thumbBox(0), b = thumbBox(1), c = thumbBox(2);
  assert.equal(a.left, 0);
  assert.ok(Math.abs(a.width - 1 / 3) < 1e-9);
  assert.ok(Math.abs(b.left - 1 / 3) < 1e-9 && Math.abs(b.width - 1.3 / 3) < 1e-9);
  assert.ok(Math.abs(c.left + c.width - 1) < 1e-9);
});

test("an order totals its lines; a line with no price counts nothing", () => {
  assert.equal(orderTotal([{ itemId: null, name: "a", unit: "x", qty: 30, unitPriceCents: 1470 }, { itemId: null, name: "b", unit: "x", qty: 2, unitPriceCents: null }]), 44100);
});

test("a day named by the server stays that day on the phone", () => {
  const d = dayFromKey("2026-11-01");
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 10, 1]);
});

test("a count past nine reads 9+", () => {
  assert.equal(badge(4), "4");
  assert.equal(badge(12), "9+");
});

test("each kind has a glyph, and an unknown one the assistant's orb", () => {
  assert.deepEqual(look("reminder"), { icon: "bell", tone: "amber" });
  assert.deepEqual(look("order"), { icon: "truck", tone: "clay" });
  assert.equal(look("nothing").icon, "orb");
});

test("two offline changes to permissions become one, the later winning", () => {
  const m = mergePatch<{ levels?: Record<string, number>; quiet?: Record<string, number | boolean>; spendLimitCents?: number }>({ levels: { crew: 2 }, spendLimitCents: 10000, quiet: { on: false } }, { levels: { crew: 0, fu: 1 }, quiet: { from: 1260 } });
  assert.deepEqual(m, { levels: { crew: 0, fu: 1 }, spendLimitCents: 10000, quiet: { on: false, from: 1260 } });
  assert.deepEqual(mergePatch(null, { spendLimitCents: 5 }), { spendLimitCents: 5 });
});

test("the outbox keeps one op per thing and survives junk", () => {
  let ops = add([], { type: "approve", id: "a", draft: "one" });
  ops = add(ops, { type: "approve", id: "a", draft: "two" });
  ops = add(ops, { type: "undo", id: "a" });
  assert.equal(ops.length, 2);
  assert.equal(ops.find((o) => o.type === "approve")?.type === "approve" && (ops.find((o) => o.type === "approve") as { draft?: string }).draft, "two");
  assert.equal(without(ops, "undo", "a").length, 1);
  assert.deepEqual(parse("not json"), []);
  assert.deepEqual(parse(JSON.stringify([{ type: "approve", id: "x" }, { type: "bad", id: 1 }, null])), [{ type: "approve", id: "x" }]);
  assert.deepEqual(parse(null), []);
});
