import { logger } from "./logger.js";

// Thin wrapper over Google's OAuth2 + Calendar API v3. No SDK — same
// "plain fetch against the vendor's REST API" approach as quickbooksClient.ts.

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? "";

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.error("WARNING: GOOGLE_CALENDAR_CLIENT_ID/GOOGLE_CALENDAR_CLIENT_SECRET are not set. Google Calendar sync will fail.");
}

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API_BASE = "https://www.googleapis.com/calendar/v3";
// Phase 96: `calendar.calendarlist.readonly` is what lets Settings list the
// account's calendars to pick one; a connection made before it must reconnect.
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/userinfo.email";

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export type GoogleTokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GoogleTokenResponse>;
}

export function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  return tokenRequest(
    new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
  );
}

export function refreshGoogleToken(refreshToken: string): Promise<GoogleTokenResponse> {
  return tokenRequest(
    new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
  );
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `token=${encodeURIComponent(token)}` });
  } catch (err) {
    logger.warn({ err }, "Google token revoke failed (ignoring — disconnect still proceeds)");
  }
}

export async function getGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return "";
  const data = (await res.json()) as { email?: string };
  return data.email ?? "";
}

async function calendarRequest<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new Error(`Google Calendar API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type GoogleEventPayload = {
  summary: string;
  description?: string;
  /** All-day events use { date }; timed events (Phase 75 schedule blocks) use { dateTime } in RFC 3339 with an offset. */
  start: { date: string } | { dateTime: string };
  end: { date: string } | { dateTime: string };
};

export async function createGoogleEvent(accessToken: string, calendarId: string, payload: GoogleEventPayload): Promise<{ id: string }> {
  return calendarRequest(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateGoogleEvent(accessToken: string, calendarId: string, eventId: string, payload: GoogleEventPayload): Promise<{ id: string }> {
  return calendarRequest(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteGoogleEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await calendarRequest(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (err) {
    // Already gone (deleted by the user on their calendar, or never created) — not a failure worth surfacing.
    logger.warn({ err, eventId }, "Google Calendar event delete failed (ignoring)");
  }
}

// ── Phase 96: which calendar ─────────────────────────────────────────────────

export type ListedCalendar = { id: string; name: string; isPrimary: boolean; canWrite: boolean };

export class CalendarScopeError extends Error {
  constructor() {
    super("The connection predates the calendar-list permission; reconnect to choose a calendar");
    this.name = "CalendarScopeError";
  }
}

/**
 * The calendars the account can write to. The primary one is reported with
 * the id "primary" (what every write path uses when nothing was picked).
 * Throws `CalendarScopeError` when the token predates the calendarList scope
 * (Google answers 403): the caller asks the person to reconnect.
 */
export async function listGoogleCalendars(accessToken: string): Promise<ListedCalendar[]> {
  const res = await fetch(`${API_BASE}/users/me/calendarList?minAccessRole=writer&showHidden=false&maxResults=250`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 403) throw new CalendarScopeError();
  if (!res.ok) throw new Error(`Google Calendar API /users/me/calendarList failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean; accessRole?: string }[] };
  return (data.items ?? []).map((c) => ({
    id: c.primary ? "primary" : c.id,
    name: c.summaryOverride || c.summary || c.id,
    isPrimary: !!c.primary,
    canWrite: c.accessRole === "writer" || c.accessRole === "owner",
  }));
}

// ── Phase 85: reading the other way ──────────────────────────────────────────

export type GoogleListedEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

/**
 * Events overlapping [timeMin, timeMax). `singleEvents` expands recurrences
 * server-side, which is why nothing here has to understand RRULE — the ICS
 * path (calendar/ics.ts) is the one that does.
 */
export async function listGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  maxResults = 250,
): Promise<GoogleListedEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });
  const res = await calendarRequest<{ items?: GoogleListedEvent[] }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  return res.items ?? [];
}
