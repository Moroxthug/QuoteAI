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
  isAllDay: true;
};

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
