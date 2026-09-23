// Phase 85 — pulling calendars in.
//
// `sync.ts` pushes QuoteAI's schedule out. This reads the other way: what the
// connected Google/Outlook account, and any subscribed .ics feed, says is
// happening. Everything landed here is **read-only context** — we never edit
// someone's personal calendar beyond the events we created ourselves, and the
// mirror is rebuilt from the source on every sync rather than merged.
//
// Scope is a window, not "everything": a fortnight back for context and three
// months forward is what the dashboard widget and the schedule board show.

import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  calendarConnectionsTable,
  calendarExternalEventsTable,
  calendarFeedsTable,
  calendarSyncedEventsTable,
  hasFeature,
  type CalendarProvider,
} from "@workspace/db";
import { getValidCalendarAccessToken } from "./service.js";
import { listGoogleEvents } from "../lib/googleCalendarClient.js";
import { listOutlookEvents } from "../lib/outlookCalendarClient.js";
import { parseIcs } from "./ics.js";
import { logger } from "../lib/logger.js";

const INBOUND_WINDOW_BACK_DAYS = 14;
const INBOUND_WINDOW_FORWARD_DAYS = 92;
/** A feed that answers with a novel is not a calendar; stop reading. */
const MAX_ICS_BYTES = 4_000_000;
const FEED_TIMEOUT_MS = 10_000;

function inboundWindow(now = new Date()): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - INBOUND_WINDOW_BACK_DAYS * 86_400_000),
    to: new Date(now.getTime() + INBOUND_WINDOW_FORWARD_DAYS * 86_400_000),
  };
}

type MirrorRow = {
  userId: string;
  source: "google" | "outlook" | "ics";
  feedId: string | null;
  externalId: string;
  title: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  busy: boolean;
  htmlLink: string | null;
  isOurs: boolean;
};

/**
 * Replaces this source's slice of the mirror for the window. A delete-then-
 * insert (inside one transaction) rather than a diff: the source is the truth,
 * an event cancelled there must disappear here, and the volume is a few
 * hundred rows.
 */
async function replaceWindow(userId: string, source: MirrorRow["source"], feedId: string | null, from: Date, to: Date, rows: MirrorRow[]): Promise<number> {
  await db.transaction(async (tx) => {
    const scope = feedId
      ? and(eq(calendarExternalEventsTable.userId, userId), eq(calendarExternalEventsTable.feedId, feedId))
      : and(eq(calendarExternalEventsTable.userId, userId), eq(calendarExternalEventsTable.source, source), sql`${calendarExternalEventsTable.feedId} is null`);
    await tx
      .delete(calendarExternalEventsTable)
      .where(and(scope, gte(calendarExternalEventsTable.startsAt, from), lte(calendarExternalEventsTable.startsAt, to)));
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      if (chunk.length) {
        await tx
          .insert(calendarExternalEventsTable)
          .values(chunk)
          .onConflictDoUpdate({
            target: [calendarExternalEventsTable.userId, calendarExternalEventsTable.source, calendarExternalEventsTable.externalId],
            set: {
              title: sql`excluded.title`,
              location: sql`excluded.location`,
              startsAt: sql`excluded.starts_at`,
              endsAt: sql`excluded.ends_at`,
              allDay: sql`excluded.all_day`,
              busy: sql`excluded.busy`,
              htmlLink: sql`excluded.html_link`,
              isOurs: sql`excluded.is_ours`,
              feedId: sql`excluded.feed_id`,
              updatedAt: new Date(),
            },
          });
      }
    }
  });
  return rows.length;
}

/** The external ids of events QuoteAI itself pushed, so the mirror can hide them. */
async function ourEventIds(userId: string, provider: CalendarProvider): Promise<Set<string>> {
  const rows = await db
    .select({ externalEventId: calendarSyncedEventsTable.externalEventId })
    .from(calendarSyncedEventsTable)
    .where(and(eq(calendarSyncedEventsTable.userId, userId), eq(calendarSyncedEventsTable.provider, provider)));
  return new Set(rows.map((r) => r.externalEventId).filter((id): id is string => !!id));
}

/** Reads one connected account into the mirror. Never throws. */
async function syncConnectionInbound(userId: string, provider: CalendarProvider, now = new Date()): Promise<{ events: number; error: string | null }> {
  const { from, to } = inboundWindow(now);
  try {
    const [conn] = await db
      .select()
      .from(calendarConnectionsTable)
      .where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.provider, provider)));
    if (!conn || !conn.isEnabled) return { events: 0, error: null };

    const accessToken = await getValidCalendarAccessToken(userId, provider);
    if (!accessToken) return { events: 0, error: "Not connected or token refresh failed" };

    const ours = await ourEventIds(userId, provider);
    let rows: MirrorRow[] = [];

    if (provider === "google") {
      const events = await listGoogleEvents(accessToken, conn.calendarId, from, to);
      rows = events
        .filter((e) => e.status !== "cancelled" && (e.start?.date || e.start?.dateTime))
        .map((e) => {
          const allDay = !!e.start?.date;
          const startsAt = new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00.000Z`);
          const endsAt = new Date(e.end?.dateTime ?? `${e.end?.date ?? e.start?.date}T00:00:00.000Z`);
          return {
            userId,
            source: "google" as const,
            feedId: null,
            externalId: e.id,
            title: e.summary?.trim() || "(no title)",
            location: e.location?.trim() ?? "",
            startsAt,
            endsAt: endsAt > startsAt ? endsAt : new Date(startsAt.getTime() + 3_600_000),
            allDay,
            busy: e.transparency !== "transparent",
            htmlLink: e.htmlLink ?? null,
            isOurs: ours.has(e.id),
          };
        });
    } else {
      const events = await listOutlookEvents(accessToken, conn.calendarId, from, to);
      rows = events
        .filter((e) => !e.isCancelled && e.start?.dateTime)
        .map((e) => {
          // Graph returns a zone-less local string plus the zone we asked for (UTC).
          const startsAt = new Date(`${e.start!.dateTime}Z`.replace(/Z+$/, "Z"));
          const endsAt = new Date(`${e.end?.dateTime ?? e.start!.dateTime}Z`.replace(/Z+$/, "Z"));
          return {
            userId,
            source: "outlook" as const,
            feedId: null,
            externalId: e.id,
            title: e.subject?.trim() || "(no title)",
            location: e.location?.displayName?.trim() ?? "",
            startsAt,
            endsAt: endsAt > startsAt ? endsAt : new Date(startsAt.getTime() + 3_600_000),
            allDay: !!e.isAllDay,
            busy: (e.showAs ?? "busy") !== "free",
            htmlLink: e.webLink ?? null,
            isOurs: ours.has(e.id),
          };
        });
    }

    const count = await replaceWindow(userId, provider, null, from, to, rows);
    await db
      .update(calendarConnectionsTable)
      .set({ lastInboundSyncAt: new Date() })
      .where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.provider, provider)));
    return { events: count, error: null };
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    logger.warn({ err, userId, provider }, "calendar inbound sync failed");
    return { events: 0, error: message };
  }
}

/** Fetches and mirrors one subscribed .ics feed. Never throws. */
export async function syncFeed(feedId: string, now = new Date()): Promise<{ events: number; error: string | null }> {
  const { from, to } = inboundWindow(now);
  const [feed] = await db.select().from(calendarFeedsTable).where(eq(calendarFeedsTable.id, feedId));
  if (!feed) return { events: 0, error: "Feed not found" };

  const finish = async (events: number, error: string | null) => {
    await db
      .update(calendarFeedsTable)
      .set({ lastFetchedAt: new Date(), lastStatus: error ? "failed" : "ok", lastError: error, eventCount: events })
      .where(eq(calendarFeedsTable.id, feedId));
    return { events, error };
  };

  if (!feed.isEnabled) return { events: 0, error: null };

  try {
    const res = await fetch(feed.url, {
      redirect: "follow",
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8", "User-Agent": "QuoteAI-Calendar/1.0 (+https://quoteai.ca)" },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
    if (!res.ok) return finish(0, `The feed answered ${res.status}`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_ICS_BYTES) return finish(0, "The feed is too large to read");
    const text = await res.text();
    if (text.length > MAX_ICS_BYTES) return finish(0, "The feed is too large to read");
    if (!text.includes("BEGIN:VCALENDAR")) return finish(0, "That URL is not an iCalendar feed");

    const parsed = parseIcs(text, from, to);
    const rows: MirrorRow[] = parsed.map((e) => ({
      userId: feed.userId,
      source: "ics" as const,
      feedId: feed.id,
      // Namespaced by feed: two feeds may legitimately carry the same UID.
      externalId: `${feed.id}:${e.uid}`.slice(0, 500),
      title: e.title || feed.name,
      location: e.location,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      busy: e.busy,
      htmlLink: null,
      isOurs: false,
    }));
    const count = await replaceWindow(feed.userId, "ics", feed.id, from, to, rows);
    return finish(count, null);
  } catch (err) {
    const message = (err as Error).name === "TimeoutError" ? "The feed did not answer in time" : (err as Error).message.slice(0, 300);
    return finish(0, message);
  }
}

/** Everything inbound for one company: both providers, every enabled feed. */
export async function syncAllInbound(userId: string, now = new Date()): Promise<{ events: number; errors: string[] }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!profile || !hasFeature(profile, "calendar_sync")) return { events: 0, errors: [] };

  let events = 0;
  const errors: string[] = [];
  const connections = await db
    .select({ provider: calendarConnectionsTable.provider })
    .from(calendarConnectionsTable)
    .where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.isEnabled, true)));
  for (const c of connections) {
    const r = await syncConnectionInbound(userId, c.provider as CalendarProvider, now);
    events += r.events;
    if (r.error) errors.push(`${c.provider}: ${r.error}`);
  }

  const feeds = await db
    .select({ id: calendarFeedsTable.id, name: calendarFeedsTable.name })
    .from(calendarFeedsTable)
    .where(and(eq(calendarFeedsTable.userId, userId), eq(calendarFeedsTable.isEnabled, true)));
  for (const f of feeds) {
    const r = await syncFeed(f.id, now);
    events += r.events;
    if (r.error) errors.push(`${f.name}: ${r.error}`);
  }
  return { events, errors };
}

/**
 * The daily/hourly tick: every company that has something connected. Bounded
 * so one cron run cannot fan out indefinitely as the customer base grows —
 * the rest are picked up by the next tick.
 */
export async function syncInboundForAllCompanies(limit = 50, now = new Date()): Promise<{ companies: number; events: number }> {
  const connected = await db
    .selectDistinct({ userId: calendarConnectionsTable.userId })
    .from(calendarConnectionsTable)
    .where(eq(calendarConnectionsTable.isEnabled, true))
    .limit(limit);
  const feeds = await db
    .selectDistinct({ userId: calendarFeedsTable.userId })
    .from(calendarFeedsTable)
    .where(eq(calendarFeedsTable.isEnabled, true))
    .limit(limit);
  const userIds = [...new Set([...connected.map((c) => c.userId), ...feeds.map((f) => f.userId)])].slice(0, limit);

  let events = 0;
  for (const userId of userIds) {
    const r = await syncAllInbound(userId, now);
    events += r.events;
  }
  return { companies: userIds.length, events };
}

/** Drops mirrored rows outside the window — nothing else prunes them. */
export async function pruneExternalEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - (INBOUND_WINDOW_BACK_DAYS + 7) * 86_400_000);
  const deleted = await db
    .delete(calendarExternalEventsTable)
    .where(lte(calendarExternalEventsTable.endsAt, cutoff))
    .returning({ id: calendarExternalEventsTable.id });
  return deleted.length;
}

