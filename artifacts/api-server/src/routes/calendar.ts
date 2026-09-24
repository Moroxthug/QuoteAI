import { Router } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, businessProfilesTable, calendarSyncedEventsTable, calendarFeedsTable, calendarPublishTokensTable, hasFeature, minimumPlanFor, CALENDAR_PROVIDERS, type CalendarProvider } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { isIntegrationConfigured, refuseIfNotConfigured } from "../lib/integrationAvailability.js";
import { buildGoogleAuthUrl, CalendarScopeError } from "../lib/googleCalendarClient.js";
import { buildOutlookAuthUrl } from "../lib/outlookCalendarClient.js";
import { listCalendarConnections, connectCalendar, disconnectCalendar, setCalendarEnabled, getCalendarConnection } from "../calendar/service.js";
import { listWritableCalendars, moveConnectionToCalendar } from "../calendar/sync.js";
import { syncAllInbound, syncFeed } from "../calendar/inbound.js";
import { buildAgenda, publishableSchedule } from "../calendar/agenda.js";
import { buildIcs } from "../calendar/ics.js";
import { ipRateLimiter } from "../lib/rateLimit.js";

const router = Router();

// The OAuth `state` param is a self-contained, signed token (userId + provider + nonce + issued-at)
// rather than a server-side session, since Vercel serverless functions share no memory between the
// /connect and /callback requests. Same shape as quickbooks.ts's state signing.
const STATE_TTL_MS = 5 * 60_000;

function signState(userId: string, provider: CalendarProvider): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${provider}.${Date.now()}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyState(state: string, expectedUserId: string, expectedProvider: CalendarProvider): boolean {
  try {
    const secret = process.env.BETTER_AUTH_SECRET ?? "";
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 5) return false;
    const [userId, provider, iat, nonce, sig] = parts;
    const expectedSig = createHmac("sha256", secret).update(`${userId}.${provider}.${iat}.${nonce}`).digest("base64url");
    const sigBuf = Buffer.from(sig!);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false;
    if (userId !== expectedUserId || provider !== expectedProvider) return false;
    if (Date.now() - Number(iat) > STATE_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function requireCalendarFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  return db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId))
    .then(([profile]) => (hasFeature(profile, "calendar_sync") ? { ok: true } : { ok: false, plan: minimumPlanFor("calendar_sync") }));
}

const providerParam = z.enum(CALENDAR_PROVIDERS);

// GET /api/calendar/status — every connected provider's status
router.get("/calendar/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const connections = await listCalendarConnections(userId);
    res.json({
      available: { google: isIntegrationConfigured("google_calendar"), outlook: isIntegrationConfigured("outlook_calendar") },
      connections: connections.map((c) => ({
        provider: c.provider,
        accountEmail: c.accountEmail,
        isEnabled: c.isEnabled,
        connectedAt: c.connectedAt.toISOString(),
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        // Phase 96: which calendar the events go to ("primary" = the account's main one, no name).
        calendarId: c.calendarId,
        calendarName: c.calendarName,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar sync status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/calendar/:provider/connect — returns the OAuth authorization URL to redirect the browser to
router.get("/calendar/:provider/connect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const gate = await requireCalendarFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Calendar sync requires the Elite plan" });
      return;
    }
    if (refuseIfNotConfigured(res, provider === "google" ? "google_calendar" : "outlook_calendar", provider === "google" ? "Google Calendar" : "Outlook Calendar")) return;
    const url = provider === "google" ? buildGoogleAuthUrl(signState(userId, provider)) : buildOutlookAuthUrl(signState(userId, provider));
    res.json({ url });
  } catch (err) {
    req.log.error({ err }, "Error building calendar auth URL");
    res.status(400).json({ error: "Invalid provider" });
  }
});

// GET /api/calendar/:provider/callback — the provider redirects the browser here after the company
// approves access; this exchanges the code server-side and redirects back into Settings.
const settingsUrl = (status: "connected" | "error") => `${getBaseUrl()}/dashboard/settings?tab=integrations&cal=${status}`;

router.get("/calendar/:provider/callback", requireAuth, async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!state || !verifyState(state, userId, provider) || !code) {
      res.redirect(settingsUrl("error"));
      return;
    }

    await connectCalendar(userId, provider, code);
    res.redirect(settingsUrl("connected"));
  } catch (err) {
    req.log.error({ err }, "Calendar OAuth callback failed");
    res.redirect(settingsUrl("error"));
  }
});

// DELETE /api/calendar/:provider/disconnect
router.delete("/calendar/:provider/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    await disconnectCalendar(userId, provider);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting calendar");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/calendar/:provider/toggle
router.patch("/calendar/:provider/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setCalendarEnabled(userId, provider, body.data.isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling calendar sync");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Phase 96: which calendar ─────────────────────────────────────────────────

// GET /api/calendar/:provider/calendars — the calendars the connected account
// can write to, and the one events currently go to. A Google connection made
// before the calendar-list scope answers `needsReconnect: true` with an empty
// list rather than an error.
router.get("/calendar/:provider/calendars", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const conn = await getCalendarConnection(userId, provider);
    if (!conn) {
      res.status(404).json({ error: "NOT_CONNECTED" });
      return;
    }
    const current = { id: conn.calendarId, name: conn.calendarName };
    try {
      const calendars = await listWritableCalendars(userId, provider);
      res.json({ current, calendars, needsReconnect: false });
    } catch (err) {
      if (err instanceof CalendarScopeError) {
        res.json({ current, calendars: [], needsReconnect: true });
        return;
      }
      throw err;
    }
  } catch (err) {
    req.log.error({ err }, "Error listing calendars");
    res.status(502).json({ error: "PROVIDER_ERROR", message: "The calendar provider did not answer; try again in a minute." });
  }
});

// PUT /api/calendar/:provider/calendar — pick the calendar events are written
// to. Moves the upcoming events QuoteAI already created: deleted from the old
// calendar, pushed again into the new one (past items stay put).
router.put("/calendar/:provider/calendar", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const body = z.object({ calendarId: z.string().trim().min(1).max(500), calendarName: z.string().trim().max(200).nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const conn = await getCalendarConnection(userId, provider);
    if (!conn) {
      res.status(404).json({ error: "NOT_CONNECTED" });
      return;
    }
    const moved = await moveConnectionToCalendar(conn, body.data.calendarId, body.data.calendarName ?? null);
    res.json({ success: true, calendarId: body.data.calendarId, calendarName: body.data.calendarId === "primary" ? null : (body.data.calendarName ?? null), ...moved });
  } catch (err) {
    req.log.error({ err }, "Error changing calendar");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/calendar/sync-log — recent milestone sync attempts (success + failure), for the status UI
router.get("/calendar/sync-log", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select()
      .from(calendarSyncedEventsTable)
      .where(eq(calendarSyncedEventsTable.userId, userId))
      .orderBy(desc(calendarSyncedEventsTable.updatedAt))
      .limit(50);
    res.json({
      entries: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        milestoneId: r.milestoneId,
        scheduleBlockId: r.scheduleBlockId,
        status: r.status,
        error: r.error,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar sync log");
    res.status(500).json({ error: "Internal server error" });
  }
});


// ── Phase 85: the agenda, the feeds, and the published calendar ──────────────

const MAX_AGENDA_DAYS = 120;
/** The published .ics is a public URL guarded only by its token — rate-limit it like the other token pages. */
const feedLimiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Too many requests" });

// GET /api/calendar/agenda?from=&to= — blocks, milestones, invoices due,
// follow-ups and (Elite + connected) mirrored personal events, in one list.
router.get("/calendar/agenda", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const q = z
      .object({ from: z.string().datetime(), to: z.string().datetime(), lang: z.enum(["en", "fr"]).optional() })
      .safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters", details: q.error });
      return;
    }
    const from = new Date(q.data.from);
    const to = new Date(q.data.to);
    if (to <= from || to.getTime() - from.getTime() > MAX_AGENDA_DAYS * 86_400_000) {
      res.status(400).json({ error: "Invalid window", message: `Ask for at most ${MAX_AGENDA_DAYS} days at a time.` });
      return;
    }

    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    // The widget itself rides on the jobs feature (like the schedule board);
    // the personal-calendar half is the Elite integration.
    const canSchedule = hasFeature(profile, "jobs");
    const canExternal = hasFeature(profile, "calendar_sync");
    if (!canSchedule) {
      res.json({ entries: [], scheduleEnabled: false, externalEnabled: false, requiredPlan: minimumPlanFor("jobs") });
      return;
    }

    const entries = await buildAgenda(userId, from, to, { includeExternal: canExternal, includeCompliance: true, lang: q.data.lang });
    res.json({ entries, scheduleEnabled: true, externalEnabled: canExternal, requiredPlan: null });
  } catch (err) {
    req.log.error({ err }, "Error building agenda");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/calendar/refresh — pull every connected account and feed now.
router.post("/calendar/refresh", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!hasFeature(profile, "calendar_sync")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("calendar_sync") });
      return;
    }
    const result = await syncAllInbound(userId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error refreshing calendars");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Subscribed .ics feeds (Calendly, Apple, anything) ────────────────────────

const feedBody = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().min(8).max(2000),
});

/**
 * `webcal://` is the scheme calendar apps hand out; it is plain https on the
 * wire. Anything else is refused rather than fetched — this URL is fetched by
 * the server, so it is an SSRF surface: https only, no credentials, no
 * loopback or private hosts.
 */
function normaliseFeedUrl(raw: string): { url: string } | { error: string } {
  let candidate = raw.trim();
  if (candidate.toLowerCase().startsWith("webcal://")) candidate = "https://" + candidate.slice("webcal://".length);
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: "INVALID_URL" };
  }
  if (parsed.protocol !== "https:") return { error: "HTTPS_REQUIRED" };
  if (parsed.username || parsed.password) return { error: "NO_CREDENTIALS" };
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|169\.254\.|192\.168\.|::1$|\[::1\]$)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) return { error: "PRIVATE_HOST" };
  return { url: parsed.toString() };
}

// GET /api/calendar/feeds
router.get("/calendar/feeds", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db.select().from(calendarFeedsTable).where(eq(calendarFeedsTable.userId, userId)).orderBy(desc(calendarFeedsTable.createdAt));
    res.json({
      feeds: rows.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        isEnabled: f.isEnabled,
        lastFetchedAt: f.lastFetchedAt?.toISOString() ?? null,
        lastStatus: f.lastStatus,
        lastError: f.lastError,
        eventCount: f.eventCount,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing calendar feeds");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/calendar/feeds — add a subscription, then read it once so the
// person sees immediately whether the URL actually works.
router.post("/calendar/feeds", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!hasFeature(profile, "calendar_sync")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("calendar_sync") });
      return;
    }
    const parsed = feedBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }
    const normalised = normaliseFeedUrl(parsed.data.url);
    if ("error" in normalised) {
      res.status(400).json({ error: normalised.error });
      return;
    }
    const existing = await db.select({ id: calendarFeedsTable.id }).from(calendarFeedsTable).where(eq(calendarFeedsTable.userId, userId));
    if (existing.length >= 10) {
      res.status(400).json({ error: "TOO_MANY_FEEDS", message: "Ten subscribed calendars is the limit." });
      return;
    }
    const [feed] = await db.insert(calendarFeedsTable).values({ userId, name: parsed.data.name, url: normalised.url }).returning();
    const result = await syncFeed(feed!.id);
    const [fresh] = await db.select().from(calendarFeedsTable).where(eq(calendarFeedsTable.id, feed!.id));
    res.status(201).json({
      feed: {
        id: fresh!.id,
        name: fresh!.name,
        url: fresh!.url,
        isEnabled: fresh!.isEnabled,
        lastFetchedAt: fresh!.lastFetchedAt?.toISOString() ?? null,
        lastStatus: fresh!.lastStatus,
        lastError: fresh!.lastError,
        eventCount: fresh!.eventCount,
      },
      events: result.events,
    });
  } catch (err) {
    req.log.error({ err }, "Error adding calendar feed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/calendar/feeds/:id — enable/disable
router.patch("/calendar/feeds/:id", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }
    const [updated] = await db
      .update(calendarFeedsTable)
      .set({ isEnabled: parsed.data.isEnabled })
      .where(and(eq(calendarFeedsTable.id, req.params.id!), eq(calendarFeedsTable.userId, userId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id: updated.id, isEnabled: updated.isEnabled });
  } catch (err) {
    req.log.error({ err }, "Error updating calendar feed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/calendar/feeds/:id — the mirrored events cascade with it.
router.delete("/calendar/feeds/:id", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [deleted] = await db
      .delete(calendarFeedsTable)
      .where(and(eq(calendarFeedsTable.id, req.params.id!), eq(calendarFeedsTable.userId, userId)))
      .returning({ id: calendarFeedsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error deleting calendar feed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── The published .ics (QuoteAI → any calendar app, no OAuth app needed) ─────

// GET /api/calendar/publish — the current link's state (never the token).
router.get("/calendar/publish", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [row] = await db.select().from(calendarPublishTokensTable).where(eq(calendarPublishTokensTable.userId, userId));
    res.json({
      enabled: !!row,
      hint: row?.hint ?? null,
      createdAt: row?.createdAt?.toISOString() ?? null,
      lastAccessedAt: row?.lastAccessedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error reading publish token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/calendar/publish — mint (or rotate) the link. The full URL is
// returned exactly once, here; only its hash is stored.
// integrations:full, not jobs:edit — this mints a URL that serves the whole
// company schedule to anyone holding it, which is an integration decision, not
// a scheduling one. (A foreman may move a block; they may not publish the board.)
router.post("/calendar/publish", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const token = randomBytes(24).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db
      .insert(calendarPublishTokensTable)
      .values({ userId, tokenHash, hint: token.slice(-4) })
      .onConflictDoUpdate({ target: calendarPublishTokensTable.userId, set: { tokenHash, hint: token.slice(-4), createdAt: new Date(), lastAccessedAt: null } });
    res.status(201).json({ url: `${getBaseUrl()}/api/calendar/feed/${token}.ics`, hint: token.slice(-4) });
  } catch (err) {
    req.log.error({ err }, "Error creating publish token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/calendar/publish — revoke; every subscriber breaks immediately.
router.delete("/calendar/publish", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    await db.delete(calendarPublishTokensTable).where(eq(calendarPublishTokensTable.userId, userId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error revoking publish token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/calendar/feed/:token.ics — public by token, read-only, no session.
// Blocks and milestones only: invoices and follow-ups are QuoteAI's own admin,
// not something anyone wants in their phone calendar.
router.get("/calendar/feed/:token.ics", feedLimiter, async (req, res) => {
  try {
    const raw = (req.params as Record<string, string>)["token"] ?? "";
    const token = raw.replace(/\.ics$/i, "");
    if (token.length < 20) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [row] = await db.select().from(calendarPublishTokensTable).where(eq(calendarPublishTokensTable.tokenHash, tokenHash));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const now = new Date();
    const from = new Date(now.getTime() - 30 * 86_400_000);
    const to = new Date(now.getTime() + 180 * 86_400_000);
    const events = await publishableSchedule(row.userId, from, to);
    const [profile] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, row.userId));
    const body = buildIcs(`${profile?.companyName || "QuoteAI"} — schedule`, events, now);

    await db.update(calendarPublishTokensTable).set({ lastAccessedAt: now }).where(eq(calendarPublishTokensTable.userId, row.userId));
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=600");
    res.setHeader("Content-Disposition", 'inline; filename="quoteai-schedule.ics"');
    res.send(body);
  } catch (err) {
    req.log.error({ err }, "Error serving calendar feed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
