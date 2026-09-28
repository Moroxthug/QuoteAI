// Phase 117: the merge, which queries a change touches, the route table, and
// the protocol against a model server — including two devices editing the
// same job offline and a chaos run where the connection drops at random,
// before or after the server applied the request.
// Run: pnpm --filter @workspace/quote-ai test (node:test through tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEdit, resolvePatch, sameValue } from "./merge";
import { affects } from "./affects";
import { matchRoute, changeOf } from "./routes";
import { sendEdit, rebase, type EditBase, type Transport } from "./protocol";

// ── merge ────────────────────────────────────────────────────────────────────

test("a field the other side left alone is sent again; one both changed is a conflict", () => {
  const base = { name: "Basement", plannedEnd: "2026-10-10", status: "planned" };
  const current = { name: "Basement finish", plannedEnd: "2026-10-14", status: "planned" };
  const r = mergeEdit(base, { status: "in_progress", plannedEnd: "2026-10-20" }, current);
  assert.deepEqual(r.patch, { status: "in_progress" });
  assert.deepEqual(r.conflicts, [{ field: "plannedEnd", mine: "2026-10-20", theirs: "2026-10-14", base: "2026-10-10" }]);
});

test("a field already set to our value is not sent", () => {
  const r = mergeEdit({ status: "todo" }, { status: "done" }, { status: "done" });
  assert.deepEqual(r.patch, {});
  assert.deepEqual(r.alreadySo, ["status"]);
  assert.equal(r.conflicts.length, 0);
});

test("without a base value the edit wins that field; a field the server doesn't show is sent as is", () => {
  const r = mergeEdit({}, { title: "Paint", secret: 1 }, { title: "Prime" });
  assert.deepEqual(r.patch, { title: "Paint", secret: 1 });
});

test("values compare as JSON; null and missing are the same", () => {
  assert.ok(sameValue({ a: [1, { b: null }] }, { a: [1, {}] }));
  assert.ok(!sameValue([1, 2], [2, 1]));
  assert.ok(sameValue(undefined, null));
});

test("resolving keeps mine or theirs per field", () => {
  const conflicts = [
    { field: "plannedEnd", mine: "2026-10-20", theirs: "2026-10-14", base: "2026-10-10" },
    { field: "name", mine: "A", theirs: "B", base: "C" },
  ];
  assert.deepEqual(resolvePatch({ status: "done" }, conflicts, { plannedEnd: "mine", name: "theirs" }), { status: "done", plannedEnd: "2026-10-20" });
});

// ── routes + affects ─────────────────────────────────────────────────────────

test("the route table recognises the app's edits and names their row and job", () => {
  const m = matchRoute("PATCH", "/api/jobs/j1/tasks/t1")!;
  assert.equal(m.route.name, "task.edit");
  assert.equal(m.id, "t1");
  assert.equal(m.jobId, "j1");
  assert.ok(m.route.versioned);
  assert.equal(matchRoute("POST", "/api/jobs/j1/tasks")!.route.name, "task.add");
  assert.equal(matchRoute("PUT", "/api/quotes/q1")!.route.name, "quote.edit");
  assert.equal(matchRoute("GET", "/api/jobs/j1"), null);
  assert.equal(matchRoute("POST", "/api/jobs/j1/archive"), null);
});

test("a queued edit answers like the route: the known row with the edit on top", () => {
  const m = matchRoute("PUT", "/api/jobs/j1")!;
  assert.deepEqual(m.route.echo({ body: { name: "New" }, row: { id: "j1", name: "Old", status: "planned" }, tempId: "q_x", params: m.params }), { job: { id: "j1", name: "New", status: "planned" } });
  const add = matchRoute("POST", "/api/jobs/j1/notes")!;
  const echo = add.route.echo({ body: { body: "Call Pat" }, row: {}, tempId: "q_abc", params: add.params }) as { note: { id: string; projectId: string; body: string } };
  assert.equal(echo.note.id, "q_abc");
  assert.equal(echo.note.projectId, "j1");
  assert.equal(add.route.createdId!({ note: { id: "real" } }), "real");
});

test("a task change refetches its job, the job lists and Today — not another job, not quotes", () => {
  const c = changeOf(matchRoute("PATCH", "/api/jobs/j1/tasks/t1")!);
  assert.ok(affects(c, ["job", "j1"]));
  assert.ok(affects(c, ["jobs"]));
  assert.ok(affects(c, ["today", "needs-you"]));
  assert.ok(affects(c, ["schedule", "2026-09-27", "2026-10-04"]));
  assert.ok(!affects(c, ["job", "j2"]));
  assert.ok(!affects(c, ["/api/quotes"]));
  assert.ok(!affects(c, ["invoices"]));
});

test("a quote change reaches the generated client's keys for that quote and the lists", () => {
  const c = { entity: "quote", id: "q1", parentId: null };
  assert.ok(affects(c, ["/api/quotes"]));
  assert.ok(affects(c, ["/api/quotes", { status: "sent" }]));
  assert.ok(affects(c, ["/api/quotes/q1"]));
  assert.ok(affects(c, ["/api/quotes/q1/variants"]));
  assert.ok(affects(c, ["contract-by-quote", "q1"]));
  assert.ok(!affects(c, ["/api/quotes/q2"]));
  assert.ok(!affects(c, ["job", "j1"]));
});

test("a note, a photo and a cost reach their own job's keys", () => {
  assert.ok(affects({ entity: "note", id: "n1", parentId: "j1" }, ["job-notes", "j1"]));
  assert.ok(affects({ entity: "photo", id: "p1", parentId: "j1" }, ["job-photos", "j1"]));
  assert.ok(affects({ entity: "cost", id: "c1", parentId: "j1" }, ["costs-review"]));
  assert.ok(!affects({ entity: "note", id: "n1", parentId: "j1" }, ["job-notes", "j2"]));
});

// ── protocol against a model server ──────────────────────────────────────────

type ServerRow = { id: string; updatedAt: string; [k: string]: unknown };

/** The API's contract in miniature: versioned PUT, 409 STALE with the row, Idempotency-Key replays. */
function modelServer(rows: Record<string, ServerRow>) {
  let clock = Date.parse("2026-09-27T12:00:00Z");
  const answered = new Map<string, { status: number; body: unknown }>();
  let writes = 0;
  let created = 0;
  const apply = (id: string, patch: Record<string, unknown>) => {
    clock += 1000;
    rows[id] = { ...rows[id]!, ...patch, updatedAt: new Date(clock).toISOString() };
    writes++;
  };
  const handle = (path: string, init: RequestInit): { status: number; body: unknown } => {
    const headers = new Headers(init.headers);
    const key = headers.get("idempotency-key")!;
    const replay = answered.get(key);
    if (replay) return replay;
    if (init.method === "POST") {
      const id = `c${++created}`;
      rows[id] = { id, updatedAt: new Date(clock).toISOString(), ...JSON.parse(String(init.body)) };
      const out = { status: 201, body: { row: rows[id] } };
      answered.set(key, out);
      return out;
    }
    const id = path.split("/").pop()!;
    const row = rows[id]!;
    const base = headers.get("x-base-version");
    let out: { status: number; body: unknown };
    if (base && base !== row.updatedAt) out = { status: 409, body: { code: "STALE", current: row, updatedAt: row.updatedAt } };
    else {
      apply(id, JSON.parse(String(init.body)));
      out = { status: 200, body: { row: rows[id] } };
    }
    answered.set(key, out);
    return out;
  };
  return {
    rows,
    writes: () => writes,
    created: () => created,
    /** Another device's plain edit, straight on the row. */
    edit: (id: string, patch: Record<string, unknown>) => apply(id, patch),
    transport: ((dropBefore: () => boolean, dropAfter: () => boolean): Transport => async (path, init) => {
      if (dropBefore()) throw new TypeError("network down");
      const out = handle(path, init);
      if (dropAfter()) throw new TypeError("connection dropped after the server applied it");
      return new Response(JSON.stringify(out.body), { status: out.status, headers: { "Content-Type": "application/json" } });
    }),
  };
}

let seq = 0;
const newKey = () => `k-${++seq}`;
const baseOf = (row: ServerRow, fields: string[]): EditBase => ({ version: row.updatedAt, values: Object.fromEntries(fields.map((f) => [f, row[f]])) });

test("two devices edit the same job offline: different fields merge, the same field asks", async () => {
  const job: ServerRow = { id: "j1", updatedAt: "2026-09-27T11:00:00.000Z", name: "Basement", plannedEnd: "2026-10-10", status: "planned", address: "12 Elm" };
  const server = modelServer({ j1: { ...job } });
  const never = () => false;
  const t = server.transport(never, never);

  // Both phones saw version 11:00. Phone A (office) changes the end date and address; phone B (foreman) the status and end date.
  const a = await sendEdit({ method: "PUT", path: "/api/jobs/j1", body: JSON.stringify({ plannedEnd: "2026-10-14", address: "14 Elm" }), key: newKey(), base: baseOf(job, ["plannedEnd", "address"]) }, t, newKey);
  assert.equal(a.kind, "sent");
  const b = await sendEdit({ method: "PUT", path: "/api/jobs/j1", body: JSON.stringify({ status: "in_progress", plannedEnd: "2026-10-20" }), key: newKey(), base: baseOf(job, ["status", "plannedEnd"]) }, t, newKey);
  assert.equal(b.kind, "conflict");
  if (b.kind !== "conflict") return;
  assert.deepEqual(b.fields.map((f) => [f.field, f.theirs, f.mine]), [["plannedEnd", "2026-10-14", "2026-10-20"]]);
  assert.deepEqual(b.patch, { status: "in_progress" });

  // The foreman keeps theirs for the date: only the status is sent, on the new version.
  const resolved = resolvePatch(b.patch, b.fields, { plannedEnd: "theirs" });
  const c = await sendEdit({ method: "PUT", path: "/api/jobs/j1", body: JSON.stringify(resolved), key: newKey(), base: { version: b.version, values: b.current } }, t, newKey);
  assert.equal(c.kind, "sent");
  assert.deepEqual({ ...server.rows.j1, updatedAt: "" }, { id: "j1", updatedAt: "", name: "Basement", plannedEnd: "2026-10-14", status: "in_progress", address: "14 Elm" });
});

test("no collision: a stale edit is merged and sent again without asking", async () => {
  const task: ServerRow = { id: "t1", updatedAt: "2026-09-27T11:00:00.000Z", title: "Prime walls", status: "todo" };
  const server = modelServer({ t1: { ...task } });
  server.edit("t1", { title: "Prime and paint walls" });
  const never = () => false;
  const r = await sendEdit({ method: "PATCH", path: "/api/jobs/j1/tasks/t1", body: JSON.stringify({ status: "done" }), key: newKey(), base: baseOf(task, ["status"]) }, server.transport(never, never), newKey);
  assert.equal(r.kind, "sent");
  assert.deepEqual([server.rows.t1!.title, server.rows.t1!.status], ["Prime and paint walls", "done"]);
});

test("the same value set on both sides is nothing to send", async () => {
  const task: ServerRow = { id: "t1", updatedAt: "2026-09-27T11:00:00.000Z", status: "todo" };
  const server = modelServer({ t1: { ...task } });
  server.edit("t1", { status: "done" });
  const r = await sendEdit({ method: "PATCH", path: "/api/jobs/j1/tasks/t1", body: JSON.stringify({ status: "done" }), key: newKey(), base: baseOf(task, ["status"]) }, server.transport(() => false, () => false), newKey);
  assert.equal(r.kind, "noop");
  assert.equal(server.writes(), 1);
});

test("chaos: random drops before and after the server applies — every edit lands once, none lost", async () => {
  // A seeded generator, so a failure can be replayed.
  let s = 117;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const rows: Record<string, ServerRow> = {};
  const devices = ["A", "B"];
  const fieldsOf: Record<string, string[]> = { A: ["a1", "a2"], B: ["b1", "b2"] };
  for (let i = 0; i < 20; i++) rows[`r${i}`] = { id: `r${i}`, updatedAt: "2026-09-27T11:00:00.000Z", a1: 0, a2: 0, b1: 0, b2: 0 };
  const server = modelServer(rows);
  const transport = server.transport(() => rand() < 0.25, () => rand() < 0.25);

  // Each device queues 40 edits of its own fields on random rows, all made against the version it last saw.
  type Op = { method: "PUT" | "POST"; path: string; body: string; key: string; base: EditBase | null; row: string; field: string; value: number };
  const queues: Record<string, Op[]> = {};
  const expected: Record<string, Record<string, number>> = {};
  for (const d of devices) {
    queues[d] = [];
    for (let i = 0; i < 40; i++) {
      const row = `r${Math.floor(rand() * 20)}`;
      const field = fieldsOf[d]![Math.floor(rand() * 2)]!;
      const value = i + 1;
      queues[d]!.push({ method: "PUT", path: `/api/x/${row}`, body: JSON.stringify({ [field]: value }), key: newKey(), base: { version: "2026-09-27T11:00:00.000Z", values: { [field]: 0 } }, row, field, value });
      (expected[row] ??= {})[field] = value; // the last edit of a field wins (queues replay in order)
      if (i % 8 === 0) queues[d]!.push({ method: "POST", path: "/api/x", body: JSON.stringify({ note: `${d}${i}` }), key: newKey(), base: null, row: "", field: "", value: 0 });
    }
  }

  // Replay both queues interleaved, as two reconnecting phones would: an op leaves its queue only once it has an answer.
  let rounds = 0;
  while ((queues.A!.length || queues.B!.length) && rounds++ < 5_000) {
    const d = devices[Math.floor(rand() * 2)]!;
    const op = queues[d]![0];
    if (!op) continue;
    try {
      const out = await sendEdit({ method: op.method, path: op.path, body: op.body, key: op.key, base: op.base }, transport, newKey);
      assert.notEqual(out.kind, "conflict", "devices edit different fields, and a device's own edits are rebased, so nothing should collide");
      queues[d]!.shift();
      // As the outbox does: the edits queued behind this one on the same row are made against its answer.
      const answer = out.kind === "sent" ? ((await out.response.json()) as { row?: Record<string, unknown> }).row : out.kind === "noop" ? out.current : undefined;
      if (answer && op.method === "PUT") for (const later of queues[d]!) if (later.row === op.row && later.base) later.base = rebase(later.body, answer);
    } catch (err) {
      assert.ok(err instanceof TypeError); // dropped: the op stays, same key, and is tried again
    }
  }
  assert.equal(queues.A!.length + queues.B!.length, 0, "every op was eventually answered");
  for (const [row, fields] of Object.entries(expected)) for (const [f, v] of Object.entries(fields)) assert.equal(rows[row]![f], v, `${row}.${f}`);
  // No duplicates: a create whose answer was lost is answered from its key on the retry, never made twice.
  assert.equal(server.created(), 10);
  assert.ok(server.writes() >= 80);
});
