// Phase 86b — what Phase 86 left open: a crew member the office trusts adding
// tasks from the site, and "since you last looked" on the worker's page.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, collaboratorsTable, notificationsTable, projectsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, api, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Change = { kind: string; blockId?: string; taskId?: string; reportId?: string; title?: string; by?: string | null; answer?: string | null };

async function member(owner: TestUser, role: "foreman" | "viewer"): Promise<TestUser> {
  const email = `e2e-${role}-86b-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: `${role} person` });
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

describe("Phase 86b — tasks from the site, and what changed", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let jobId: string;
  let token: string;
  let workerId: string;
  let otherWorkerId: string;
  let todayBlockId: string;
  let handedBlockId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Crew Follow-up Co", plan: "monthly_elite" });
    jobId = (await owner.api("/api/jobs", { body: { name: "Bathroom gut", address: "8 Birch Ave" } })).body.job.id;
    await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, jobId));
    workerId = (await owner.api("/api/team/workers", { body: { name: "Robin Lead", hourlyRateCents: 4000 } })).body.worker.id;
    otherWorkerId = (await owner.api("/api/team/workers", { body: { name: "Alex Apprentice", hourlyRateCents: 2500 } })).body.worker.id;
    const block = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() - 30 * MIN).toISOString(), endsAt: new Date(Date.now() + 4 * HOUR).toISOString() } });
    expect(block.status, JSON.stringify(block.body)).toBe(201);
    todayBlockId = block.body.block.id;
    // On their week before they ever look; handed to someone else afterwards.
    handedBlockId = (await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() + 48 * HOUR).toISOString(), endsAt: new Date(Date.now() + 54 * HOUR).toISOString() } })).body.block.id;
    token = (await owner.api(`/api/team/workers/${workerId}/invite`, { body: {} })).body.url.split("/t/")[1];
    viewer = await member(owner, "viewer");
  }, 180_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  // ── Tasks from the site ──

  test("adding a task is off until the office turns it on for that worker, and only team:full may", async () => {
    const page = await api(`/api/t/${token}`);
    expect(page.body.worker.canAddTasks).toBe(false);
    const refused = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Shut-off valve is seized" } });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe("NOT_ALLOWED");

    expect((await viewer.api(`/api/team/workers/${workerId}`, { method: "PUT", body: { canAddTasks: true } })).status).toBe(403);
    const on = await owner.api(`/api/team/workers/${workerId}`, { method: "PUT", body: { canAddTasks: true } });
    expect(on.status, JSON.stringify(on.body)).toBe(200);
    expect(on.body.worker.canAddTasks).toBe(true);
    expect((await api(`/api/t/${token}`)).body.worker.canAddTasks).toBe(true);
  });

  test("a task added from the site is marked as theirs, once, however often the phone retries", async () => {
    const clientRef = randomUUID();
    const first = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Shut-off valve is seized", clientRef } });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.task).toMatchObject({ title: "Shut-off valve is seized", status: "todo", addedBy: "Robin Lead" });
    const again = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Shut-off valve is seized", clientRef } });
    expect(again.status).toBe(200);
    expect(again.body.task.id).toBe(first.body.task.id);

    // The office sees where it came from…
    const job = await owner.api(`/api/jobs/${jobId}`);
    const all = [...job.body.unassignedTasks, ...job.body.milestones.flatMap((m: { tasks: unknown[] }) => m.tasks)] as Array<{ id: string; addedFromFieldBy: string | null }>;
    expect(all.filter((t) => t.id === first.body.task.id)).toHaveLength(1);
    expect(all.find((t) => t.id === first.body.task.id)!.addedFromFieldBy).toBe("Robin Lead");
    // …and hears about it, once for the day, not once per task.
    await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Subfloor is soft by the tub" } });
    const bells = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, owner.userId), eq(notificationsTable.entityType, "project_task")));
    expect(bells).toHaveLength(1);
    expect(bells[0]!.title).toContain("Robin Lead");

    // And the worker's own list shows it on today's job.
    const today = (await api(`/api/t/${token}`)).body.todayJobs as Array<{ id: string; tasks: { title: string; addedBy: string | null }[] }>;
    expect(today.find((j) => j.id === jobId)!.tasks.find((t) => t.title === "Shut-off valve is seized")!.addedBy).toBe("Robin Lead");
  });

  test("an empty task is refused, and another company's job is out of reach", async () => {
    const empty = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "   " } });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe("EMPTY");
    const stranger = await createOrg({ companyName: "Elsewhere Co", plan: "monthly_elite" });
    const theirs = (await stranger.api("/api/jobs", { body: { name: "Not yours" } })).body.job.id;
    expect((await api(`/api/t/${token}/jobs/${theirs}/tasks`, { method: "POST", body: { title: "sneaky" } })).status).toBe(404);
  });

  // ── Since you last looked ──

  test("the first visit starts the marker instead of listing everything", async () => {
    await db.update(collaboratorsTable).set({ crewSeenAt: null }).where(eq(collaboratorsTable.id, workerId));
    const first = await api(`/api/t/${token}`);
    expect(first.body.changes).toEqual([]);
    const [w] = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, workerId));
    expect(w!.crewSeenAt).toBeTruthy();
  });

  test("what the office changed shows up; what the worker did themselves does not", async () => {
    // Clocks: the marker is the API's, audit rows are the database's. A beat
    // between them keeps the test about the rule, not about clock skew.
    await sleep(1500);
    const tomorrow = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() + 24 * HOUR).toISOString(), endsAt: new Date(Date.now() + 30 * HOUR).toISOString() } });
    expect(tomorrow.status).toBe(201);
    expect((await owner.api(`/api/schedule/blocks/${todayBlockId}`, { method: "PUT", body: { endsAt: new Date(Date.now() + 6 * HOUR).toISOString() } })).status).toBe(200);
    // A block handed from this worker to someone else is gone from their week.
    expect((await owner.api(`/api/schedule/blocks/${handedBlockId}`, { method: "PUT", body: { collaboratorId: otherWorkerId } })).status).toBe(200);
    // Created and deleted in between: nothing to say.
    const blip = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() + 72 * HOUR).toISOString(), endsAt: new Date(Date.now() + 74 * HOUR).toISOString() } });
    await owner.api(`/api/schedule/blocks/${blip.body.block.id}`, { method: "DELETE" });
    // Somebody else's shift is not news to this worker.
    await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: otherWorkerId, startsAt: new Date(Date.now() + 24 * HOUR).toISOString(), endsAt: new Date(Date.now() + 26 * HOUR).toISOString() } });
    const officeTask = await owner.api(`/api/jobs/${jobId}/tasks`, { body: { title: "Order the vanity" } });
    // The worker's own moves: a new task and a tick.
    const own = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Cap the old supply lines" } });
    await api(`/api/t/${token}/tasks/${own.body.task.id}`, { method: "POST", body: { status: "done" } });
    // A blocker, answered by the office.
    const fd = new FormData();
    fd.append("projectId", jobId);
    fd.append("kind", "blocker");
    fd.append("body", "No water shut-off at the street");
    const blocker = await api(`/api/t/${token}/reports`, { method: "POST", form: fd });
    await owner.api(`/api/field-reports/${blocker.body.report.id}/resolve`, { body: { note: "City is coming Tuesday" } });

    const res = await api(`/api/t/${token}`);
    const changes = res.body.changes as Change[];
    const kinds = (kind: string) => changes.filter((c) => c.kind === kind);
    expect(kinds("shift_added").map((c) => c.blockId)).toEqual([tomorrow.body.block.id]);
    expect(kinds("shift_changed").map((c) => c.blockId)).toEqual([todayBlockId]);
    expect(kinds("shift_removed").map((c) => c.blockId)).toEqual([handedBlockId]);
    expect(changes.some((c) => c.blockId === blip.body.block.id)).toBe(false);
    expect(kinds("task_added").map((c) => c.taskId)).toEqual([officeTask.body.task.id]);
    expect(changes.some((c) => c.taskId === own.body.task.id)).toBe(false);
    expect(kinds("answer")).toHaveLength(1);
    expect(kinds("answer")[0]!.answer).toBe("City is coming Tuesday");
    // Newest first.
    const ats = changes.map((c) => (c as unknown as { at: string }).at);
    expect([...ats].sort().reverse()).toEqual(ats);
    expect(typeof res.body.changesUpTo).toBe("string");
  });

  test("a reload keeps the list; \"Got it\" clears it, and a stale tab cannot bring it back", async () => {
    const before = await api(`/api/t/${token}`);
    expect((before.body.changes as Change[]).length).toBeGreaterThan(0);
    expect((await api(`/api/t/${token}`)).body.changes).toHaveLength(before.body.changes.length);

    expect((await api(`/api/t/${token}/seen`, { method: "POST", body: { upTo: before.body.changesUpTo } })).status).toBe(200);
    expect((await api(`/api/t/${token}`)).body.changes).toEqual([]);
    // An older "Got it" arriving late (another tab, a slow network) leaves the marker where it is.
    expect((await api(`/api/t/${token}/seen`, { method: "POST", body: { upTo: new Date(Date.now() - 10 * 86_400_000).toISOString() } })).status).toBe(200);
    expect((await api(`/api/t/${token}`)).body.changes).toEqual([]);
    expect((await api(`/api/t/${token}/seen`, { method: "POST", body: { upTo: "yesterday" } })).status).toBe(400);
  });

  test("a task the office ticks after the worker touched it is news again", async () => {
    await sleep(1500);
    const own = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Photograph the joists" } });
    expect((await api(`/api/t/${token}`)).body.changes).toEqual([]);
    expect((await owner.api(`/api/jobs/${jobId}/tasks/${own.body.task.id}`, { method: "PATCH", body: { status: "done" } })).status).toBe(200);
    const changes = (await api(`/api/t/${token}`)).body.changes as Change[];
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "task_done", taskId: own.body.task.id, by: null });
  });
});
