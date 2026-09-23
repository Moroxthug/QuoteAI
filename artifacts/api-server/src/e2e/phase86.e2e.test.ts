// Phase 86 — the crew's app: the worker's day on /t/:token, reporting from
// the field without an account, and the foreman's view of the same day.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, clientsTable, clientDedupKey, costEntriesTable, jobPhotosTable, notificationsTable, projectTasksTable, projectsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, api, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";

const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const MIN = 60_000;

async function member(owner: TestUser, role: "foreman" | "viewer"): Promise<TestUser> {
  const email = `e2e-${role}-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: `${role} person` });
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

function reportForm(fields: Record<string, string>, photo = false) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (photo) fd.append("file", new Blob([pngBytes], { type: "image/png" }), "crack.png");
  return fd;
}

describe("Phase 86 — the crew's app", () => {
  let owner: TestUser;
  let foreman: TestUser;
  let viewer: TestUser;
  let jobId: string;
  let otherJobId: string;
  let taskId: string;
  let token: string;
  let workerId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Crew Co", plan: "monthly_elite" });
    const [client] = await db.insert(clientsTable).values({ userId: owner.userId, name: "Pat Homeowner", phone: "+1 416 555 0199", dedupKey: clientDedupKey({ name: "Pat Homeowner", phone: "+1 416 555 0199" }) }).returning();

    jobId = (await owner.api("/api/jobs", { body: { name: "Kitchen reno", address: "12 Elm St, Toronto" } })).body.job.id;
    await db.update(projectsTable).set({ clientId: client!.id, status: "active" }).where(eq(projectsTable.id, jobId));
    otherJobId = (await owner.api("/api/jobs", { body: { name: "Garage slab", address: "4 Oak Rd" } })).body.job.id;
    await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, otherJobId));
    const task = await owner.api(`/api/jobs/${jobId}/tasks`, { body: { title: "Strip the old cabinets" } });
    expect(task.status, JSON.stringify(task.body)).toBe(201);
    taskId = task.body.task.id;

    const worker = await owner.api("/api/team/workers", { body: { name: "Sam Field", hourlyRateCents: 3500 } });
    workerId = worker.body.worker.id;
    // Assigned to the *other* job only; booked on the kitchen today. Before this
    // phase that combination could see the booking and not clock in on it.
    expect((await owner.api(`/api/jobs/${otherJobId}/assignments`, { body: { workerId } })).status).toBeLessThan(300);
    const block = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() - 30 * MIN).toISOString(), endsAt: new Date(Date.now() + 90 * MIN).toISOString(), notes: "Gate code 4471" } });
    expect(block.status, JSON.stringify(block.body)).toBe(201);
    token = (await owner.api(`/api/team/workers/${workerId}/invite`, { body: {} })).body.url.split("/t/")[1];

    foreman = await member(owner, "foreman");
    viewer = await member(owner, "viewer");
  }, 180_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("the worker's day: the booked job, its tasks, where it is and who to call", async () => {
    const res = await api(`/api/t/${token}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const today = res.body.todayJobs as Array<{ id: string; address: string; contact: { name: string; phone: string }; blocks: { notes: string }[]; tasks: { id: string; title: string }[] }>;
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ id: jobId, address: "12 Elm St, Toronto", contact: { name: "Pat Homeowner", phone: "+1 416 555 0199" } });
    expect(today[0]!.blocks[0]!.notes).toBe("Gate code 4471");
    expect(today[0]!.tasks.map((t) => t.title)).toEqual(["Strip the old cabinets"]);
    // Nothing with a price on it reaches the worker.
    expect(JSON.stringify(res.body)).not.toMatch(/Cents|budget|contractValue/i);
  });

  test("a job you are booked on is a job you can clock in on, even when assigned elsewhere", async () => {
    const jobs = (await api(`/api/t/${token}`)).body.jobs as Array<{ id: string }>;
    expect(jobs.map((j) => j.id).sort()).toEqual([jobId, otherJobId].sort());
    const clockIn = await api(`/api/t/${token}/clock-in`, { body: { projectId: jobId } });
    expect(clockIn.status, JSON.stringify(clockIn.body)).toBe(201);
    expect((await api(`/api/t/${token}/clock-out`, { body: {} })).status).toBe(200);
  });

  test("a task ticked in the field is ticked in the office, and audited", async () => {
    const res = await api(`/api/t/${token}/tasks/${taskId}`, { body: { status: "done" } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const [row] = await db.select().from(projectTasksTable).where(eq(projectTasksTable.id, taskId));
    expect(row!.status).toBe("done");
    // Still listed today (ticked today), so it does not vanish under the worker's thumb.
    expect((await api(`/api/t/${token}`)).body.todayJobs[0].tasks[0]).toMatchObject({ id: taskId, status: "done" });
    expect((await api(`/api/t/${token}/tasks/not-a-uuid`, { body: { status: "done" } })).status).toBe(400);
    expect((await api(`/api/t/${token}/tasks/${taskId}`, { body: { status: "finished" } })).status).toBe(400);
  });

  test("a task on another company's job is not reachable from this link", async () => {
    const stranger = await createOrg({ companyName: "Stranger Co" });
    const theirJob = (await stranger.api("/api/jobs", { body: { name: "Their job" } })).body.job.id;
    const theirTask = (await stranger.api(`/api/jobs/${theirJob}/tasks`, { body: { title: "Not yours" } })).body.task.id;
    expect((await api(`/api/t/${token}/tasks/${theirTask}`, { body: { status: "done" } })).status).toBe(404);
    // …and a report cannot be filed against their job either.
    expect((await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: theirJob, kind: "note", body: "hello" }) })).status).toBe(400);
  });

  test("a photo with a note lands in the job's gallery, once, however many times the phone retries", async () => {
    const clientRef = randomUUID();
    const send = () => api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "note", body: "Water damage behind the sink", clientRef }, true) });
    const first = await send();
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.report).toMatchObject({ kind: "note", authorName: "Sam Field", projectName: "Kitchen reno" });
    expect(first.body.report.photoId).toBeTruthy();
    const again = await send();
    expect(again.status).toBe(200);
    expect(again.body.report.id).toBe(first.body.report.id);
    const photos = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.projectId, jobId));
    expect(photos).toHaveLength(1);
    expect(photos[0]!.caption).toContain("Sam Field");
  });

  test("an empty report is refused rather than filed", async () => {
    const res = await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "note" }) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMPTY");
    expect((await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "materials", materialsCents: "0" }) })).body.error).toBe("EMPTY");
    expect((await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "gossip", body: "x" }) })).status).toBe(400);
  });

  test("materials become a cost waiting for review, not a confirmed cost", async () => {
    const res = await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "materials", body: "2 boxes of screws", materialsCents: "4250" }) });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const [cost] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, res.body.report.costEntryId));
    expect(cost).toMatchObject({ projectId: jobId, category: "materials", totalCents: 4250, status: "pending_review" });
    expect(cost!.description).toContain("Sam Field");
  });

  let blockerId: string;
  test("a blocker notifies the office as a push-worthy notification", async () => {
    const res = await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "blocker", body: "No power on site" }) });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    blockerId = res.body.report.id;
    const notes = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, owner.userId), eq(notificationsTable.type, "field_blocker")));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toContain("Sam Field");
    expect(notes[0]!.link).toBe(`/dashboard/jobs/${jobId}`);
  });

  test("the job lists everything the field sent", async () => {
    const res = await owner.api(`/api/jobs/${jobId}/field-reports`);
    expect(res.status).toBe(200);
    expect((res.body.reports as Array<{ kind: string }>).map((r) => r.kind).sort()).toEqual(["blocker", "materials", "note"]);
    const stranger = await createOrg({ companyName: "Nosy Co" });
    expect((await stranger.api(`/api/jobs/${jobId}/field-reports`)).status).toBe(404);
  });

  test("the foreman's day: who is booked where, what is blocked, hours to approve", async () => {
    const res = await foreman.api("/api/crew/today");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.enabled).toBe(true);
    const kitchen = (res.body.jobs as Array<{ jobId: string; crew: { workerName: string }[] }>).find((j) => j.jobId === jobId);
    expect(kitchen!.crew[0]!.workerName).toBe("Sam Field");
    expect((res.body.blockers as Array<{ id: string }>).map((b) => b.id)).toEqual([blockerId]);
    expect((res.body.awaitingApproval as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  test("a foreman may approve with the bulk button, as they already could one row at a time", async () => {
    const ids = ((await foreman.api("/api/crew/today")).body.awaitingApproval as Array<{ id: string }>).map((e) => e.id);
    const res = await foreman.api("/api/team/time-entries/approve", { body: { ids } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.approved).toBe(ids.length);
    expect((await viewer.api("/api/team/time-entries/approve", { body: { ids } })).status).toBe(403);
  });

  test("answering a blocker: a viewer cannot, a foreman can, and the worker sees the answer", async () => {
    expect((await viewer.api(`/api/field-reports/${blockerId}/resolve`, { body: { note: "no" } })).status).toBe(403);
    const stranger = await createOrg({ companyName: "Other Co" });
    expect((await stranger.api(`/api/field-reports/${blockerId}/resolve`, { body: {} })).status).toBe(404);
    const res = await foreman.api(`/api/field-reports/${blockerId}/resolve`, { body: { note: "Hydro is coming at 2" } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.report.resolvedAt).toBeTruthy();
    expect((await owner.api("/api/crew/today")).body.blockers).toEqual([]);
    const mine = (await api(`/api/t/${token}`)).body.reports as Array<{ id: string; resolutionNote: string | null }>;
    expect(mine.find((r) => r.id === blockerId)!.resolutionNote).toBe("Hydro is coming at 2");
  });

  test("a company without time tracking is told so rather than shown an empty day", async () => {
    const pro = await createOrg({ companyName: "Pro Co", plan: "monthly_pro" });
    const res = await pro.api("/api/crew/today");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: false });
    expect(res.body.requiredPlan).toBeTruthy();
  });
});
