// Phase 117 (docs/APP-PLAN.md "Sync II") — two devices, one server:
//  • idempotency: a create replayed with the same Idempotency-Key (its answer
//    was lost) returns the first answer and makes nothing twice; the same key
//    with a different body is refused
//  • versions: an edit made against an older version answers 409 STALE with
//    the row as it is now; the phone's merge re-sends the fields the other
//    device left alone on the new version; a field both changed stays theirs
//    until the person picks
//  • live: the other device's long poll on /api/changes wakes with exactly
//    the rows that changed, within a couple of seconds; another company's
//    feed stays quiet
//  • chaos: queued edits from both devices replayed with random drops (before
//    and after the server applied them) — nothing lost, nothing duplicated

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, authSessionsTable, projectsTable, projectTasksTable, jobNotesTable } from "@workspace/db";
import { startServer, stopServer, createOrg, cleanupAll, api, type ApiOptions } from "./harness.js";

/** A second signed-in device for the same person: its own session token. */
async function secondDevice(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(authSessionsTable).values({ id: randomUUID(), token, userId, expiresAt: new Date(Date.now() + 86_400_000) });
  return (path: string, o: ApiOptions = {}) => api(path, { ...o, token });
}

describe("Sync II (Phase 117)", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("a create replayed with the same key is answered, not redone", async () => {
    const org = await createOrg();
    const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Sync job", status: "active" }).returning();
    const key = randomUUID();
    const first = await org.api(`/api/jobs/${job!.id}/notes`, { body: { body: "Order the tiles" }, headers: { "Idempotency-Key": key } });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const replay = await org.api(`/api/jobs/${job!.id}/notes`, { body: { body: "Order the tiles" }, headers: { "Idempotency-Key": key } });
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotent-replayed")).toBe("true");
    expect(replay.body.note.id).toBe(first.body.note.id);
    expect((await db.select().from(jobNotesTable).where(eq(jobNotesTable.projectId, job!.id))).length).toBe(1);

    const other = await org.api(`/api/jobs/${job!.id}/notes`, { body: { body: "Something else" }, headers: { "Idempotency-Key": key } });
    expect(other.status).toBe(422);
    // Without a key, as before: two requests, two notes.
    await org.api(`/api/jobs/${job!.id}/notes`, { body: { body: "A" } });
    await org.api(`/api/jobs/${job!.id}/notes`, { body: { body: "A" } });
    expect((await db.select().from(jobNotesTable).where(eq(jobNotesTable.projectId, job!.id))).length).toBe(3);
  });

  test("two devices edit one job: a stale edit gets 409 with the row as it is now", async () => {
    const org = await createOrg();
    const phone = await secondDevice(org.userId);
    const created = await org.api("/api/jobs", { body: { name: "Basement finish", plannedStart: "2026-10-01", plannedEnd: "2026-10-10" } });
    expect(created.status, JSON.stringify(created.body)).toBeLessThan(300);
    const jobId = created.body.job.id as string;
    const seen = (await phone(`/api/jobs/${jobId}`)).body.job;

    // The office moves the end date.
    const office = await org.api(`/api/jobs/${jobId}`, { method: "PUT", body: { plannedEnd: "2026-10-14" }, headers: { "X-Base-Version": seen.updatedAt } });
    expect(office.status).toBe(200);

    // The foreman's phone, still on the old version, sets the status and a different end date.
    const stale = await phone(`/api/jobs/${jobId}`, { method: "PUT", body: { status: "active", plannedEnd: "2026-10-20" }, headers: { "X-Base-Version": seen.updatedAt } });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("STALE");
    expect(stale.body.current.plannedEnd).toBe("2026-10-14");
    expect(stale.body.updatedAt).toBe(office.body.job.updatedAt);
    // Nothing of the stale edit was applied.
    expect((await db.select().from(projectsTable).where(eq(projectsTable.id, jobId)))[0]!.status).not.toBe("active");

    // The merge: status was untouched by the office → re-sent on the new version; the end date collided → theirs kept.
    const merged = await phone(`/api/jobs/${jobId}`, { method: "PUT", body: { status: "active" }, headers: { "X-Base-Version": stale.body.updatedAt } });
    expect(merged.status, JSON.stringify(merged.body)).toBe(200);
    expect(merged.body.job.status).toBe("active");
    expect(merged.body.job.plannedEnd).toBe("2026-10-14");

    // Without the header an edit behaves as before (last write wins).
    const plain = await org.api(`/api/jobs/${jobId}`, { method: "PUT", body: { name: "Basement" } });
    expect(plain.status).toBe(200);
  });

  test("tasks and milestones carry their version and refuse stale edits", async () => {
    const org = await createOrg();
    const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Versions", status: "active" }).returning();
    const task = await org.api(`/api/jobs/${job!.id}/tasks`, { body: { title: "Prime walls" } });
    expect(task.status).toBe(201);
    const v1 = task.body.task.updatedAt as string;
    expect(typeof v1).toBe("string");
    const tick = await org.api(`/api/jobs/${job!.id}/tasks/${task.body.task.id}`, { method: "PATCH", body: { status: "done" }, headers: { "X-Base-Version": v1 } });
    expect(tick.status).toBe(200);
    expect(tick.body.task.updatedAt).not.toBe(v1);
    const late = await org.api(`/api/jobs/${job!.id}/tasks/${task.body.task.id}`, { method: "PATCH", body: { title: "Paint" }, headers: { "X-Base-Version": v1 } });
    expect(late.status).toBe(409);
    expect(late.body.current.status).toBe("done");
  });

  test("the other device hears about a change within seconds; another company hears nothing", async () => {
    const org = await createOrg();
    const stranger = await createOrg();
    const phone = await secondDevice(org.userId);
    const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Live", status: "active" }).returning();
    const [task] = await db.insert(projectTasksTable).values({ projectId: job!.id, title: "Frame the wall", status: "todo" }).returning();

    const start = await phone("/api/changes");
    expect(start.status).toBe(200);
    const strangerStart = await stranger.api("/api/changes");

    // The phone waits; the office ticks the task a moment later.
    const t0 = Date.now();
    const waiting = phone(`/api/changes?after=${start.body.cursor}&wait=10`);
    await new Promise((r) => setTimeout(r, 300));
    await org.api(`/api/jobs/${job!.id}/tasks/${task!.id}`, { method: "PATCH", body: { status: "done" } });
    const heard = await waiting;
    const took = Date.now() - t0;
    expect(heard.status).toBe(200);
    expect(heard.body.changes).toContainEqual({ entity: "task", id: task!.id, parentId: job!.id, op: "update" });
    expect(took).toBeLessThan(2_500);

    const quiet = await stranger.api(`/api/changes?after=${strangerStart.body.cursor}&wait=0`);
    expect(quiet.body.changes).toEqual([]);
    // Signed out: no feed.
    expect((await api("/api/changes")).status).toBe(401);
  });

  test("chaos: both devices replay queued edits through dropped connections — none lost, none doubled", async () => {
    const org = await createOrg();
    const phone = await secondDevice(org.userId);
    const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Chaos", status: "active" }).returning();
    let s = 117;
    const rand = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;

    // Each device: 6 notes and 6 tasks, each op with its own key, replayed until answered.
    type Op = { device: typeof phone; path: string; body: Record<string, unknown>; key: string };
    const ops: Op[] = [];
    for (const [device, name] of [[org.api, "office"], [phone, "phone"]] as const) {
      for (let i = 0; i < 6; i++) {
        ops.push({ device, path: `/api/jobs/${job!.id}/notes`, body: { body: `${name} note ${i}` }, key: randomUUID() });
        ops.push({ device, path: `/api/jobs/${job!.id}/tasks`, body: { title: `${name} task ${i}` }, key: randomUUID() });
      }
    }
    let sends = 0;
    for (const op of ops) {
      for (;;) {
        sends++;
        // A drop before the request leaves: nothing reaches the server — just try again.
        if (rand() < 0.3) continue;
        const res = await op.device(op.path, { body: op.body, headers: { "Idempotency-Key": op.key } });
        // A drop after the server applied it: the answer is lost; the same key goes again.
        if (rand() < 0.3) continue;
        expect(res.status).toBe(201);
        break;
      }
    }
    expect(sends).toBeGreaterThan(ops.length); // there were drops
    const notes = await db.select().from(jobNotesTable).where(eq(jobNotesTable.projectId, job!.id));
    const tasks = await db.select().from(projectTasksTable).where(eq(projectTasksTable.projectId, job!.id));
    expect(notes.map((n) => n.body).sort()).toEqual([...Array(6).keys()].flatMap((i) => [`office note ${i}`, `phone note ${i}`]).sort());
    expect(tasks.map((t) => t.title).sort()).toEqual([...Array(6).keys()].flatMap((i) => [`office task ${i}`, `phone task ${i}`]).sort());
  });
});
