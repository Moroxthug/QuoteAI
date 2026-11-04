import assert from "node:assert/strict";
import { test } from "node:test";
import { afterAttempt, allPicked, coalesce, counts, foldsInto, mergeStale, overlay, photosMaySend, photoTotals, resolve, same, whyRejected, type Op } from "./sync.ts";

const op = (o: Partial<Op>): Op => ({ id: "1", kind: "quote", method: "PUT", path: "/api/quotes/q1", body: {}, base: "2026-10-01T09:41:00.000Z", before: {}, ref: "Q-2026-119", at: "2026-10-01T09:48:00.000Z", state: "waiting", ...o });

test("values compare by content, numbers and numeric strings alike", () => {
  assert.ok(same({ a: 1, b: [1, { c: "x" }] }, { b: [1, { c: "x" }], a: 1 }));
  assert.ok(same(860, "860"));
  assert.ok(same(null, undefined));
  assert.ok(!same({ a: 1 }, { a: 2 }));
});

test("two edits to the same quote become one, the later winning", () => {
  const a = op({ body: { note: "a", totale: 100 }, before: { note: "", totale: 90 } });
  const b = op({ id: "2", body: { note: "b" }, before: { note: "a" }, at: "2026-10-01T09:50:00.000Z" });
  assert.ok(foldsInto(a, b));
  const c = coalesce(a, b);
  assert.deepEqual(c.body, { note: "b", totale: 100 });
  assert.deepEqual(c.before, { note: "", totale: 90 }, "keeps the first edit's view of the row");
  assert.equal(c.at, "2026-10-01T09:50:00.000Z");
  assert.ok(!foldsInto(op({ kind: "jobNote", method: "POST" }), op({ kind: "jobNote", method: "POST" })), "notes never fold");
});

test("stale: fields only this phone changed go again on the new version", () => {
  const o = op({ body: { note: "mine" }, before: { note: "old" } });
  const r = mergeStale(o, { note: "old", titoloPreventivoRiga1: "Changed there" }, "2026-10-01T09:50:00.000Z");
  assert.equal(r.kind, "resend");
  if (r.kind === "resend") { assert.equal(r.op.base, "2026-10-01T09:50:00.000Z"); assert.deepEqual(r.op.body, { note: "mine" }); }
});

test("stale: a field both sides changed differently is a conflict by group", () => {
  const o = op({ body: { paymentSchedule: { deposit: 30 }, note: "mine" }, before: { paymentSchedule: { deposit: 20 }, note: "old" } });
  const r = mergeStale(o, { paymentSchedule: { deposit: 25 }, note: "old" }, "2026-10-01T09:50:00.000Z");
  assert.equal(r.kind, "conflict");
  if (r.kind !== "conflict") return;
  assert.deepEqual(r.op.conflict?.groups, ["schedule"]);
  assert.equal(r.op.state, "conflict");
  assert.ok(!allPicked(r.op.conflict!));
});

test("stale: a field sent along but not changed here never clashes", () => {
  const o = op({ body: { capitoli: [2], paymentSchedule: { deposit: 20 } }, before: { capitoli: [1], paymentSchedule: { deposit: 20 } } });
  const r = mergeStale(o, { capitoli: [1], paymentSchedule: { deposit: 25 } }, "v2");
  assert.equal(r.kind, "resend");
  if (r.kind === "resend") assert.deepEqual(r.op.body, { capitoli: [2] });
});

test("stale: nothing left when the server already has what the phone wants", () => {
  const o = op({ body: { note: "same" }, before: { note: "old" } });
  assert.equal(mergeStale(o, { note: "same" }, "x").kind, "done");
});

test("resolving: keep theirs drops the group, keep mine sends it on the server's version", () => {
  const o = op({ body: { paymentSchedule: { deposit: 30 }, note: "mine" }, state: "conflict", conflict: { current: {}, updatedAt: "v2", groups: ["schedule", "notes"], picks: { schedule: "theirs", notes: "mine" } } });
  const r = resolve(o);
  assert.equal(r.kind, "resend");
  if (r.kind === "resend") { assert.deepEqual(r.op.body, { note: "mine" }); assert.equal(r.op.base, "v2"); assert.equal(r.op.state, "waiting"); }
  const all = resolve({ ...o, conflict: { ...o.conflict!, picks: { schedule: "theirs", notes: "theirs" } } });
  assert.equal(all.kind, "done");
});

test("after a try: sent, no signal, later, stale, refused", () => {
  const o = op({ body: { note: "x" }, before: { note: "" } });
  assert.equal(afterAttempt(o, { ok: true }).kind, "sent");
  assert.equal(afterAttempt(o, { ok: false, status: 0 }).kind, "offline");
  assert.equal(afterAttempt(o, { ok: false, status: 503 }).kind, "later");
  assert.equal(afterAttempt(o, { ok: false, status: 409, code: "STALE", current: { note: "" }, updatedAt: "v2" }).kind, "stale");
  const r = afterAttempt(o, { ok: false, status: 403, message: "Forbidden" });
  assert.equal(r.kind, "rejected");
  if (r.kind === "rejected") assert.equal(r.op.state, "rejected");
});

test("why a change was refused", () => {
  assert.equal(whyRejected({ status: 403 }), "role");
  assert.equal(whyRejected({ status: 404 }), "gone");
  assert.equal(whyRejected({ status: 400, code: "LOCKED" }), "locked");
  assert.equal(whyRejected({ status: 403, code: "PRO_REQUIRED" }), "plan");
  assert.equal(whyRejected({ status: 400 }), "invalid");
  assert.equal(whyRejected({ status: 409, code: "OTHER" }), "other");
});

test("counts only what is waiting", () => {
  const c = counts([op({}), op({ id: "2" }), op({ id: "3", kind: "jobNote", method: "POST" }), op({ id: "4", state: "rejected" })]);
  assert.deepEqual(c, { quote: 2, jobNote: 1, total: 3 });
});

test("the screen shows waiting edits over the saved row, not refused ones", () => {
  const row = { note: "server", totale: 1 };
  const out = overlay(row, [op({ body: { note: "mine" } }), op({ id: "2", body: { totale: 9 }, state: "rejected" })], "/api/quotes/q1");
  assert.deepEqual(out, { note: "mine", totale: 1 });
});

test("photos: totals, and they wait on mobile data unless sent now", () => {
  assert.deepEqual(photoTotals([{ size: 1000 }, { size: 500 }, {}]), { count: 3, bytes: 1500 });
  assert.ok(photosMaySend({ online: true, wifi: true }, false));
  assert.ok(!photosMaySend({ online: true, wifi: false }, false));
  assert.ok(photosMaySend({ online: true, wifi: false }, true));
  assert.ok(!photosMaySend({ online: false, wifi: false }, true));
});
