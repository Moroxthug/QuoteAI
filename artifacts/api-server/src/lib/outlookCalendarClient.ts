import { logger } from "./logger.js";

// Thin wrapper over the Microsoft identity platform (OAuth2) + Microsoft
// Graph calendar API. No SDK — same "plain fetch against the vendor's REST
// API" approach as quickbooksClient.ts / googleCalendarClient.ts.

const CLIENT_ID = process.env.OUTLOOK_CALENDAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.OUTLOOK_CALENDAR_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.OUTLOOK_CALENDAR_REDIRECT_URI ?? "";

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.error("WARNING: OUTLOOK_CALENDAR_CLIENT_ID/OUTLOOK_CALENDAR_CLIENT_SECRET are not set. Outlook Calendar sync will fail.");
}

const AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const API_BASE = "https://graph.microsoft.com/v1.0";
const SCOPE = "offline_access Calendars.ReadWrite User.Read";

export function buildOutlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export type OutlookTokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(body: URLSearchParams): Promise<OutlookTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Outlook token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<OutlookTokenResponse>;
}

export function exchangeOutlookCode(code: string): Promise<OutlookTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      scope: SCOPE,
    }),
  );
}

export function refreshOutlookToken(refreshToken: string): Promise<OutlookTokenResponse> {
  return tokenRequest(
    new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token", scope: SCOPE }),
  );
}

export async function getOutlookAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return "";
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail ?? data.userPrincipalName ?? "";
}

async function graphRequest<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new Error(`Microsoft Graph API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type OutlookEventPayload = {
  subject: string;
  body?: { contentType: "text"; content: string };
  start: { dateTime: string; timeZone: "UTC" };
  end: { dateTime: string; timeZone: "UTC" };
  isAllDay: boolean;
};

/**
 * Phase 96: the mailbox's calendars, so Settings can pick one. The default
 * calendar is reported as "primary" (createOutlookEvent's shortcut path).
 * The existing `Calendars.ReadWrite` scope already covers this call.
 */
export async function listOutlookCalendars(accessToken: string): Promise<{ id: string; name: string; isPrimary: boolean; canWrite: boolean }[]> {
  const data = await graphRequest<{ value?: { id: string; name?: string; isDefaultCalendar?: boolean; canEdit?: boolean }[] }>(
    accessToken,
    "/me/calendars?$select=id,name,isDefaultCalendar,canEdit&$top=100",
  );
  return (data.value ?? []).map((c) => ({
    id: c.isDefaultCalendar ? "primary" : c.id,
    name: c.name || c.id,
    isPrimary: !!c.isDefaultCalendar,
    canWrite: c.canEdit !== false,
  }));
}

export async function createOutlookEvent(accessToken: string, calendarId: string, payload: OutlookEventPayload): Promise<{ id: string }> {
  const path = calendarId === "primary" ? "/me/calendar/events" : `/me/calendars/${encodeURIComponent(calendarId)}/events`;
  return graphRequest(accessToken, path, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateOutlookEvent(accessToken: string, eventId: string, payload: OutlookEventPayload): Promise<{ id: string }> {
  return graphRequest(accessToken, `/me/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteOutlookEvent(accessToken: string, eventId: string): Promise<void> {
  try {
    await graphRequest(accessToken, `/me/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (err) {
    // Already gone (deleted by the user on their calendar, or never created) — not a failure worth surfacing.
    logger.warn({ err, eventId }, "Outlook Calendar event delete failed (ignoring)");
  }
}

// ── Phase 85: reading the other way ──────────────────────────────────────────

export type OutlookListedEvent = {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string;
  webLink?: string;
  location?: { displayName?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
};

/**
 * `/me/calendarView` expands recurring series between two instants — the
 * Graph equivalent of Google's `singleEvents`.
 */
export async function listOutlookEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  top = 250,
): Promise<OutlookListedEvent[]> {
  const params = new URLSearchParams({
    startDateTime: timeMin.toISOString(),
    endDateTime: timeMax.toISOString(),
    $top: String(top),
    $orderby: "start/dateTime",
    $select: "id,subject,isAllDay,isCancelled,showAs,webLink,location,start,end",
  });
  const base = calendarId === "primary" ? "/me/calendarView" : `/me/calendars/${encodeURIComponent(calendarId)}/calendarView`;
  const res = await graphRequest<{ value?: OutlookListedEvent[] }>(accessToken, `${base}?${params.toString()}`, {
    // Graph returns event times in the requested zone; ask for UTC so the
    // mirror stores instants and the browser localises them.
    headers: { Prefer: 'outlook.timezone="UTC"' },
  });
  return res.value ?? [];
}
