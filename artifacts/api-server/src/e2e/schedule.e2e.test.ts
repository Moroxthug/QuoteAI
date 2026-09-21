// Phase 75 — the schedule board end to end: window + blocks + conflicts,
// moving/reassigning (with the reminder stamp reset), reference checks,
// the worker's /t page listing their blocks, the evening-before reminder
// sweep (text via the Twilio stub, email when the worker has no phone,
// nothing twice, off with the toggle) and the timed-event push to a
// stubbed Google Calendar.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, calendarConnectionsTable, calendarSyncedEventsTable, scheduleBlocksTable, smsMessagesTable } from "@workspace/db";
import { runScheduleReminderMaintenance } from "../schedule/maintenance.js";
import { encryptSecret } from "../lib/crypto.js";
import { startServer, stopServer, createOrg, cleanupAll, daysFromNow } from "./harness.js";
import { emailsTo } from "./mailbox.js";
import { stubHost, json, requestsTo, resetRecorded } from "./vendorStub.js";

const TWILIO = "https://api.twilio.com/";
const GCAL = "https://www.googleapis.com/";

/** 08:00 → 16:00 Toronto on a given day (ISO with the -04:00 offset — EDT in 2026-10). */
const shift = (day: string, from = 8, to = 16) => ({ startsAt: `${day}T${String(from).padStart(2, "0")}:00:00-04:00`, endsAt: `${day}T${String(to).padStart(2, "0")}:00:00-04:00` });
const win = (from: string, to: string) => `/api/schedule?from=${encodeURIComponent(`${from}T00:00:00-04:00`)}&to=${encodeURIComponent(`${to}T00:00:00-04:00`)}`;

async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

describe("Schedule board (Phase 75)", () => {
  let baseUrl = "";
  beforeAll(async () => {
    baseUrl = await startServer();
    stubHost(TWILIO, () => json(201, { sid: `SM${Date.now()}`, status: "queued" }));
  });
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });
  beforeEach(() => resetRecorded());

  test("gating: free is refused, Pro gets a board without workers, bad windows are 400", async () => {
    const free = await createOrg({ plan: "free" });
    const refused = await free.api(win("2026-10-05", "2026-10-12"));
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ error: "PLAN_REQUIRED", requiredPlan: "monthly_pro" });

    const pro = await createOrg({ plan: "monthly_pro" });
    const board = await pro.api(win("2026-10-05", "2026-10-12"));
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    expect(board.body).toMatchObject({ blocks: [], workers: [], jobs: [] });

    const created = await pro.api("/api/schedule/blocks", { body: { ...shift("2026-10-06"), title: "Site visit" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.block).toMatchObject({ collaboratorId: null, projectId: null, label: "Site visit", conflicts: [], allDay: false });

    expect((await pro.api(win("2026-10-12", "2026-10-05"))).status).toBe(400);
    expect((await pro.api(win("2026-01-01", "2026-06-01"))).status).toBe(400);
    expect((await pro.api("/api/schedule/blocks", { body: { startsAt: "2026-10-06T16:00:00-04:00", endsAt: "2026-10-06T08:00:00-04:00" } })).status).toBe(400);
  });

  test("blocks on a job: conflicts both ways, reassign clears them, milestones overlay, refs are checked, delete", async () => {
    const org = await createOrg({ companyName: "Crew Co" });
    const job = await org.api("/api/jobs", { body: { name: "Basement finish", address: "45 Rue Laurier, Gatineau" } });
    expect(job.status, JSON.stringify(job.body)).toBe(201);
    const jobId = job.body.job.id as string;
    const ms = await org.api(`/api/jobs/${jobId}/milestones`, { body: { title: "Framing", plannedStart: "2026-10-06", plannedEnd: "2026-10-08" } });
    expect(ms.status).toBe(201);
    const sam = (await org.api("/api/team/workers", { body: { name: "Sam Carpenter", role: "Carpenter", phone: "6135550142" } })).body.worker;
    const alex = (await org.api("/api/team/workers", { body: { name: "Alex Helper", role: "Apprentice" } })).body.worker;

    const a = await org.api("/api/schedule/blocks", { body: { projectId: jobId, milestoneId: ms.body.milestone.id, collaboratorId: sam.id, ...shift("2026-10-06"), notes: "Gate code 4471" } });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(a.body.block).toMatchObject({ projectName: "Basement finish", projectAddress: "45 Rue Laurier, Gatineau", milestoneTitle: "Framing", collaboratorName: "Sam Carpenter", label: "Basement finish", conflicts: [] });

    // Overlap on the same worker → both sides flagged, but saved.
    const b = await org.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: sam.id, ...shift("2026-10-06", 14, 18) } });
    expect(b.status).toBe(201);
    expect(b.body.block.conflicts).toEqual([a.body.block.id]);
    const board = await org.api(win("2026-10-05", "2026-10-12"));
    const byId = Object.fromEntries(board.body.blocks.map((x: { id: string }) => [x.id, x]));
    expect(byId[a.body.block.id].conflicts).toEqual([b.body.block.id]);
    expect(byId[b.body.block.id].conflicts).toEqual([a.body.block.id]);
    expect(board.body.workers.map((w: { name: string; hasPhone: boolean; hasEmail: boolean }) => [w.name, w.hasPhone, w.hasEmail])).toEqual([["Alex Helper", false, false], ["Sam Carpenter", true, false]]);
    expect(board.body.jobs[0]).toMatchObject({ id: jobId, milestones: [{ title: "Framing", plannedStart: "2026-10-06", plannedEnd: "2026-10-08", status: "planned" }] });
    // Only this job's blocks when asked.
    expect((await org.api(`${win("2026-10-05", "2026-10-12")}&projectId=${jobId}`)).body.blocks).toHaveLength(2);

    // Reassign the second block to Alex → no more conflict, and the reminder stamp is cleared.
    await db.update(scheduleBlocksTable).set({ reminderSentAt: new Date() }).where(eq(scheduleBlocksTable.id, b.body.block.id));
    const moved = await org.api(`/api/schedule/blocks/${b.body.block.id}`, { method: "PUT", body: { collaboratorId: alex.id } });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.block).toMatchObject({ collaboratorName: "Alex Helper", conflicts: [], reminderSentAt: null });
    // A notes-only edit keeps the stamp.
    await db.update(scheduleBlocksTable).set({ reminderSentAt: new Date() }).where(eq(scheduleBlocksTable.id, b.body.block.id));
    expect((await org.api(`/api/schedule/blocks/${b.body.block.id}`, { method: "PUT", body: { notes: "Bring the laser level" } })).body.block.reminderSentAt).not.toBeNull();

    // Another company's worker / job cannot be referenced.
    const other = await createOrg({ companyName: "Other Co" });
    const foreign = await other.api("/api/schedule/blocks", { body: { collaboratorId: sam.id, ...shift("2026-10-07") } });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error).toBe("INVALID_REFERENCE");
    expect((await other.api(`/api/schedule/blocks/${a.body.block.id}`, { method: "PUT", body: { notes: "x" } })).status).toBe(404);
    // A milestone from another job is rejected.
    const job2 = await org.api("/api/jobs", { body: { name: "Deck" } });
    expect((await org.api("/api/schedule/blocks", { body: { projectId: job2.body.job.id, milestoneId: ms.body.milestone.id, ...shift("2026-10-07") } })).status).toBe(400);

    expect((await org.api(`/api/schedule/blocks/${a.body.block.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await org.api(`/api/schedule/blocks/${a.body.block.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await org.api(win("2026-10-05", "2026-10-12"))).body.blocks).toHaveLength(1);
  });

  test("the worker's /t page lists their upcoming blocks", async () => {
    const org = await createOrg({ province: "QC", companyName: "Équipe Inc." });
    const job = (await org.api("/api/jobs", { body: { name: "Sous-sol", address: "12 Rue Principale, Laval" } })).body.job;
    const worker = (await org.api("/api/team/workers", { body: { name: "Pat Worker", email: `pat-${org.userId}@example.invalid` } })).body.worker;
    const invite = await org.api(`/api/team/workers/${worker.id}/invite`, { body: { send: false } });
    const token = invite.body.url.split("/t/")[1] as string;

    const tomorrow = new Date(Date.now() + 86_400_000);
    const day = tomorrow.toISOString().slice(0, 10);
    const created = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: worker.id, startsAt: `${day}T12:00:00Z`, endsAt: `${day}T20:00:00Z`, notes: "Apporter la scie" } });
    expect(created.status).toBe(201);
    // A block for someone else, and one far in the future, must not show up.
    await org.api("/api/schedule/blocks", { body: { projectId: job.id, startsAt: `${day}T12:00:00Z`, endsAt: `${day}T20:00:00Z` } });
    await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: worker.id, startsAt: "2031-01-06T12:00:00Z", endsAt: "2031-01-06T20:00:00Z" } });

    const page = await fetch(`${baseUrl}/api/t/${token}`).then(async (r) => ({ status: r.status, body: await r.json() }));
    expect(page.status).toBe(200);
    expect(page.body.schedule).toHaveLength(1);
    expect(page.body.schedule[0]).toMatchObject({ label: "Sous-sol", address: "12 Rue Principale, Laval", notes: "Apporter la scie", allDay: false, startsAt: `${day}T12:00:00.000Z` });
  });

  test("evening reminders: text when the worker has a phone, email otherwise, once per block, again after a move, off with the toggle", async () => {
    const org = await createOrg({ companyName: "Reminder Co" });
    const job = (await org.api("/api/jobs", { body: { name: "Basement finish", address: "45 Rue Laurier, Gatineau" } })).body.job;
    const sam = (await org.api("/api/team/workers", { body: { name: "Sam Carpenter", phone: "6135550142" } })).body.worker;
    const alexEmail = `alex-${org.userId}@example.invalid`;
    const alex = (await org.api("/api/team/workers", { body: { name: "Alex Helper", email: alexEmail } })).body.worker;
    const nobody = (await org.api("/api/team/workers", { body: { name: "No Contact" } })).body.worker;

    // Tuesday 2026-10-06 08:00-16:00 Toronto for all three.
    const blocks = [] as string[];
    for (const w of [sam, alex, nobody]) {
      const r = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: w.id, ...shift("2026-10-06"), notes: w.id === sam.id ? "Gate code 4471" : "" } });
      expect(r.status).toBe(201);
      blocks.push(r.body.block.id as string);
    }

    // Monday 14:30 Toronto → too early.
    expect(await runScheduleReminderMaintenance(new Date("2026-10-05T18:30:00Z"))).toEqual({ sms: 0, email: 0, skipped: 0 });
    expect(requestsTo(TWILIO)).toHaveLength(0);

    // Monday 19:00 Toronto (the 23:00Z evening cron) → one text, one email, one with no channel.
    const evening = new Date("2026-10-05T23:00:00Z");
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ sms: 1, email: 1, skipped: 1 });
    const form = new URLSearchParams(requestsTo(TWILIO).at(-1)!.body ?? "");
    expect(form.get("To")).toBe("+16135550142");
    expect(form.get("Body")).toBe("Reminder Co ((613) 555-0100): Tomorrow 08:00-16:00: Basement finish, 45 Rue Laurier, Gatineau. Gate code 4471 Reply STOP to opt out.");
    const [smsRow] = await db.select().from(smsMessagesTable).where(and(eq(smsMessagesTable.userId, org.userId), eq(smsMessagesTable.purpose, "appointment_reminder")));
    expect(smsRow).toMatchObject({ status: "sent", relatedEntityType: "schedule_block", relatedEntityId: blocks[0] });
    const mail = emailsTo(alexEmail).at(-1)!;
    expect(mail.subject).toBe("Reminder Co — tomorrow: Basement finish");
    expect(mail.html).toContain("Tomorrow 08:00-16:00: Basement finish, 45 Rue Laurier, Gatineau.");
    for (const id of blocks) expect((await db.select().from(scheduleBlocksTable).where(eq(scheduleBlocksTable.id, id)))[0]!.reminderSentAt).not.toBeNull();

    // Same evening again → nothing.
    resetRecorded();
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ sms: 0, email: 0, skipped: 0 });

    // Sam's block moves to Wednesday → stamp cleared → Tuesday evening it goes again, as "tomorrow" with the new day.
    expect((await org.api(`/api/schedule/blocks/${blocks[0]}`, { method: "PUT", body: shift("2026-10-07", 7, 15) })).body.block.reminderSentAt).toBeNull();
    expect(await runScheduleReminderMaintenance(new Date("2026-10-06T23:00:00Z"))).toEqual({ sms: 1, email: 0, skipped: 0 });
    expect(new URLSearchParams(requestsTo(TWILIO).at(-1)!.body ?? "").get("Body")).toContain("Tomorrow 07:00-15:00: Basement finish");

    // A block added the night before gets the same-morning catch-up.
    resetRecorded();
    const late = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: sam.id, ...shift("2026-10-08", 9, 12) } });
    expect(late.status).toBe(201);
    expect(await runScheduleReminderMaintenance(new Date("2026-10-08T11:00:00Z"))).toEqual({ sms: 1, email: 0, skipped: 0 });
    expect(new URLSearchParams(requestsTo(TWILIO).at(-1)!.body ?? "").get("Body")).toContain("Today 09:00-12:00");

    // Toggle off → the sweep leaves the block alone.
    resetRecorded();
    const quiet = await createOrg({ companyName: "Quiet Co", profile: { automationSettings: { notifyOnQuoteAccepted: true, autoDraftContract: true, autoSendInvoices: false, invoiceAutoSendAfterHours: 0, invoiceReminders: true, smsEnabled: false, smsReminders: false, scheduleReminders: false } } });
    expect((await quiet.api("/api/sms/status")).body.scheduleReminders).toBe(false);
    const qw = (await quiet.api("/api/team/workers", { body: { name: "Quiet Worker", phone: "6135550177" } })).body.worker;
    const qb = await quiet.api("/api/schedule/blocks", { body: { collaboratorId: qw.id, ...shift("2026-10-06"), title: "Shop day" } });
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ sms: 0, email: 0, skipped: 0 });
    expect(requestsTo(TWILIO)).toHaveLength(0);
    expect((await db.select().from(scheduleBlocksTable).where(eq(scheduleBlocksTable.id, qb.body.block.id)))[0]!.reminderSentAt).toBeNull();
    // Flip it on through the SMS settings → sent.
    expect((await quiet.api("/api/sms/settings", { method: "PUT", body: { scheduleReminders: true } })).body.scheduleReminders).toBe(true);
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ sms: 1, email: 0, skipped: 0 });
    expect(new URLSearchParams(requestsTo(TWILIO).at(-1)!.body ?? "").get("Body")).toContain("Tomorrow 08:00-16:00: Shop day.");
  });

  test("calendar sync: a block becomes a timed event, a move PATCHes it, a delete DELETEs it", async () => {
    const org = await createOrg({ companyName: "Calendar Crew" });
    await db.insert(calendarConnectionsTable).values({
      userId: org.userId,
      provider: "google",
      accountEmail: `cal-${org.userId.slice(-6)}@gmail.example`,
      accessTokenEnc: encryptSecret("ya29.e2e-cal"),
      refreshTokenEnc: encryptSecret("1//e2e-cal-refresh"),
      tokenExpiresAt: daysFromNow(1),
    });
    let nextId = 0;
    stubHost(GCAL, (req) => {
      if (req.method === "POST") return json(200, { id: `gblk_${++nextId}` });
      if (req.method === "PATCH") return json(200, { id: req.url.split("/events/")[1]!.split("?")[0] });
      if (req.method === "DELETE") return new Response(null, { status: 204 });
      return json(404, {});
    });
    const job = (await org.api("/api/jobs", { body: { name: "Basement finish" } })).body.job;
    const sam = (await org.api("/api/team/workers", { body: { name: "Sam Carpenter" } })).body.worker;
    const created = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: sam.id, ...shift("2026-10-06") } });
    const blockId = created.body.block.id as string;

    const synced = await waitFor(async () => (await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.scheduleBlockId, blockId)))[0], "calendar_synced_events row for the block");
    expect(synced).toMatchObject({ status: "synced", externalEventId: "gblk_1", milestoneId: null });
    const post = requestsTo(GCAL).find((r) => r.method === "POST")!;
    expect(JSON.parse(post.body ?? "{}")).toEqual({ summary: "Sam Carpenter · Basement finish", description: "", start: { dateTime: "2026-10-06T12:00:00.000Z" }, end: { dateTime: "2026-10-06T20:00:00.000Z" } });

    resetRecorded();
    await org.api(`/api/schedule/blocks/${blockId}`, { method: "PUT", body: shift("2026-10-07") });
    const patch = await waitFor(async () => requestsTo(GCAL).find((r) => r.method === "PATCH"), "PATCH to Google");
    expect(patch.url).toContain("/events/gblk_1");
    expect(JSON.parse(patch.body ?? "{}").start).toEqual({ dateTime: "2026-10-07T12:00:00.000Z" });

    resetRecorded();
    expect((await org.api(`/api/schedule/blocks/${blockId}`, { method: "DELETE" })).status).toBe(200);
    expect(requestsTo(GCAL).some((r) => r.method === "DELETE" && r.url.includes("/events/gblk_1"))).toBe(true);
    expect(await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.scheduleBlockId, blockId))).toHaveLength(0);

    const log = await org.api("/api/calendar/sync-log");
    expect(log.status).toBe(200);
  });
});
