import { db, calendarConnectionsTable, calendarSyncedEventsTable, businessProfilesTable, hasFeature, type Milestone, type ScheduleBlock, type CalendarProvider, type CalendarConnection } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { getValidCalendarAccessToken, markCalendarSynced } from "./service.js";
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from "../lib/googleCalendarClient.js";
import { createOutlookEvent, updateOutlookEvent, deleteOutlookEvent } from "../lib/outlookCalendarClient.js";
import { toIsoDate } from "../jobs/dates.js";
import { logger } from "../lib/logger.js";

// One-way push of a job milestone as an all-day calendar event, into every
// provider the company has connected and enabled. A milestone with no
// planned dates is skipped (nothing meaningful to put on a calendar). The
// milestone's own `status` is reflected in the event title so a completed
// milestone doesn't look like a stale open task on someone's phone calendar.

function eventTitle(m: Milestone, jobName: string): string {
  const prefix = m.status === "completed" ? "✓ " : "";
  return `${prefix}${jobName} — ${m.title}`;
}

function eventDescription(m: Milestone): string {
  return m.description || "";
}

/** Exclusive end date (both Google and Outlook all-day events end at midnight the day *after* the last day). */
function exclusiveEndIso(start: Date, end: Date | null): string {
  const last = end ?? start;
  const exclusive = new Date(last.getTime() + 86_400_000);
  return toIsoDate(exclusive)!;
}

async function pushToConnection(
  conn: CalendarConnection,
  milestone: Milestone,
  jobName: string,
): Promise<{ externalEventId: string | null; error: string | null }> {
  const accessToken = await getValidCalendarAccessToken(conn.userId, conn.provider as CalendarProvider);
  if (!accessToken) return { externalEventId: null, error: "Not connected or token refresh failed" };

  const start = milestone.plannedStart!;
  const startIso = toIsoDate(start)!;
  const endIsoExclusive = exclusiveEndIso(start, milestone.plannedEnd);

  const [existing] = await db
    .select()
    .from(calendarSyncedEventsTable)
    .where(and(eq(calendarSyncedEventsTable.milestoneId, milestone.id), eq(calendarSyncedEventsTable.provider, conn.provider)));

  try {
    let externalEventId: string;
    if (conn.provider === "google") {
      const payload = { summary: eventTitle(milestone, jobName), description: eventDescription(milestone), start: { date: startIso }, end: { date: endIsoExclusive } };
      if (existing?.externalEventId) {
        const res = await updateGoogleEvent(accessToken, conn.calendarId, existing.externalEventId, payload);
        externalEventId = res.id;
      } else {
        const res = await createGoogleEvent(accessToken, conn.calendarId, payload);
        externalEventId = res.id;
      }
    } else {
      const payload = {
        subject: eventTitle(milestone, jobName),
        body: { contentType: "text" as const, content: eventDescription(milestone) },
        start: { dateTime: `${startIso}T00:00:00`, timeZone: "UTC" as const },
        end: { dateTime: `${endIsoExclusive}T00:00:00`, timeZone: "UTC" as const },
        isAllDay: true as const,
      };
      if (existing?.externalEventId) {
        const res = await updateOutlookEvent(accessToken, existing.externalEventId, payload);
        externalEventId = res.id;
      } else {
        const res = await createOutlookEvent(accessToken, conn.calendarId, payload);
        externalEventId = res.id;
      }
    }
    await markCalendarSynced(conn.userId, conn.provider as CalendarProvider);
    return { externalEventId, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, milestoneId: milestone.id, provider: conn.provider }, "Calendar event push failed");
    return { externalEventId: existing?.externalEventId ?? null, error: message.slice(0, 2000) };
  }
}

/** Pushes (creates or updates) one milestone's event to every connected + enabled provider. Never throws. */
export async function syncMilestoneToCalendar(userId: string, milestone: Milestone, jobName: string): Promise<void> {
  if (!milestone.plannedStart) return; // nothing to put on a calendar

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!profile || !hasFeature(profile, "calendar_sync")) return;

  const connections = await db
    .select()
    .from(calendarConnectionsTable)
    .where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.isEnabled, true)));
  if (!connections.length) return;

  for (const conn of connections) {
    const { externalEventId, error } = await pushToConnection(conn, milestone, jobName);
    await db
      .insert(calendarSyncedEventsTable)
      .values({
        userId,
        provider: conn.provider,
        milestoneId: milestone.id,
        externalEventId,
        status: error ? "failed" : "synced",
        error,
      })
      .onConflictDoUpdate({
        target: [calendarSyncedEventsTable.milestoneId, calendarSyncedEventsTable.provider],
        set: { externalEventId, status: error ? "failed" : "synced", error },
      });
  }
}

/** Removes one milestone's event from every provider it was synced to (milestone deleted, job deleted). Never throws. */
export async function removeMilestoneFromCalendar(userId: string, milestoneId: string): Promise<void> {
  const rows = await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.milestoneId, milestoneId));
  if (!rows.length) return;

  const connections = await db.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.userId, userId));
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  for (const row of rows) {
    if (!row.externalEventId) continue;
    const conn = byProvider.get(row.provider);
    const accessToken = conn ? await getValidCalendarAccessToken(userId, row.provider as CalendarProvider) : null;
    if (!accessToken || !conn) continue;
    if (row.provider === "google") await deleteGoogleEvent(accessToken, conn.calendarId, row.externalEventId);
    else await deleteOutlookEvent(accessToken, row.externalEventId);
  }
  // `calendar_synced_events` rows cascade-delete with the milestone itself; nothing further to clean up here.
}

/** Removes every synced event for a set of milestones (job deleted). Never throws. */
export async function removeMilestonesFromCalendar(userId: string, milestoneIds: string[]): Promise<void> {
  if (!milestoneIds.length) return;
  const rows = await db.select().from(calendarSyncedEventsTable).where(inArray(calendarSyncedEventsTable.milestoneId, milestoneIds));
  if (!rows.length) return;

  const connections = await db.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.userId, userId));
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  for (const row of rows) {
    if (!row.externalEventId) continue;
    const conn = byProvider.get(row.provider);
    const accessToken = conn ? await getValidCalendarAccessToken(userId, row.provider as CalendarProvider) : null;
    if (!accessToken || !conn) continue;
    if (row.provider === "google") await deleteGoogleEvent(accessToken, conn.calendarId, row.externalEventId);
    else await deleteOutlookEvent(accessToken, row.externalEventId);
  }
}

// ── Phase 75: schedule blocks as timed events ───────────────────────────────
// A block is a real appointment ("Sam · Basement finish, Tue 8:00–16:00"), so
// unlike milestones it is pushed as a timed event. Instants are sent in UTC
// (RFC 3339 "Z") — Google and Outlook render them in the viewer's own zone,
// which is what a crew spread across a province border wants anyway.

function blockTitle(block: ScheduleBlock, jobName: string | null, workerName: string | null): string {
  const what = block.title || jobName || "Schedule block";
  return workerName ? `${workerName} · ${what}` : what;
}

/** Graph wants a bare local-style timestamp next to an explicit timeZone; strip the millis + "Z". */
const graphUtc = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "");

async function pushBlockToConnection(
  conn: CalendarConnection,
  block: ScheduleBlock,
  jobName: string | null,
  workerName: string | null,
): Promise<{ externalEventId: string | null; error: string | null }> {
  const accessToken = await getValidCalendarAccessToken(conn.userId, conn.provider as CalendarProvider);
  if (!accessToken) return { externalEventId: null, error: "Not connected or token refresh failed" };

  const [existing] = await db
    .select()
    .from(calendarSyncedEventsTable)
    .where(and(eq(calendarSyncedEventsTable.scheduleBlockId, block.id), eq(calendarSyncedEventsTable.provider, conn.provider)));

  const summary = blockTitle(block, jobName, workerName);
  const description = block.notes || "";
  try {
    let externalEventId: string;
    if (conn.provider === "google") {
      const payload = block.allDay
        ? { summary, description, start: { date: toIsoDate(block.startsAt)! }, end: { date: toIsoDate(block.endsAt)! } }
        : { summary, description, start: { dateTime: block.startsAt.toISOString() }, end: { dateTime: block.endsAt.toISOString() } };
      if (existing?.externalEventId) externalEventId = (await updateGoogleEvent(accessToken, conn.calendarId, existing.externalEventId, payload)).id;
      else externalEventId = (await createGoogleEvent(accessToken, conn.calendarId, payload)).id;
    } else {
      const payload = {
        subject: summary,
        body: { contentType: "text" as const, content: description },
        start: { dateTime: graphUtc(block.startsAt), timeZone: "UTC" as const },
        end: { dateTime: graphUtc(block.endsAt), timeZone: "UTC" as const },
        isAllDay: block.allDay,
      };
      if (existing?.externalEventId) externalEventId = (await updateOutlookEvent(accessToken, existing.externalEventId, payload)).id;
      else externalEventId = (await createOutlookEvent(accessToken, conn.calendarId, payload)).id;
    }
    await markCalendarSynced(conn.userId, conn.provider as CalendarProvider);
    return { externalEventId, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, blockId: block.id, provider: conn.provider }, "Calendar block push failed");
    return { externalEventId: existing?.externalEventId ?? null, error: message.slice(0, 2000) };
  }
}

/** Pushes (creates or updates) one schedule block to every connected + enabled provider. Never throws. */
export async function syncBlockToCalendar(userId: string, block: ScheduleBlock, jobName: string | null, workerName: string | null): Promise<void> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!profile || !hasFeature(profile, "calendar_sync")) return;

  const connections = await db
    .select()
    .from(calendarConnectionsTable)
    .where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.isEnabled, true)));
  if (!connections.length) return;

  for (const conn of connections) {
    const { externalEventId, error } = await pushBlockToConnection(conn, block, jobName, workerName);
    await db
      .insert(calendarSyncedEventsTable)
      .values({ userId, provider: conn.provider, scheduleBlockId: block.id, externalEventId, status: error ? "failed" : "synced", error })
      .onConflictDoUpdate({
        target: [calendarSyncedEventsTable.scheduleBlockId, calendarSyncedEventsTable.provider],
        set: { externalEventId, status: error ? "failed" : "synced", error },
      });
  }
}

/** Removes one block's event from every provider it was synced to (block deleted). Never throws. */
export async function removeBlockFromCalendar(userId: string, blockId: string): Promise<void> {
  const rows = await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.scheduleBlockId, blockId));
  if (!rows.length) return;
  const connections = await db.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.userId, userId));
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  for (const row of rows) {
    if (!row.externalEventId) continue;
    const conn = byProvider.get(row.provider);
    const accessToken = conn ? await getValidCalendarAccessToken(userId, row.provider as CalendarProvider) : null;
    if (!accessToken || !conn) continue;
    try {
      if (row.provider === "google") await deleteGoogleEvent(accessToken, conn.calendarId, row.externalEventId);
      else await deleteOutlookEvent(accessToken, row.externalEventId);
    } catch (err) {
      logger.error({ err, blockId, provider: row.provider }, "Calendar block delete failed");
    }
  }
  // calendar_synced_events rows cascade-delete with the block itself.
}
