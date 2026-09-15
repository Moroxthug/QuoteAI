import { logger } from "./logger.js";

// Thin wrapper over Google's OAuth2 + Google Ads API (GAQL) for Local Services
// Ads lead capture. No SDK — same "plain fetch against the vendor's REST API"
// approach as googleCalendarClient.ts/quickbooksClient.ts.
//
// Unlike Google Calendar, LSA leads are not exposed through a simple public
// API — they're read via the Google Ads API's `local_services_lead` resource
// using GAQL (Google Ads Query Language), which requires THREE things beyond
// standard OAuth2:
//   1. A developer token (GOOGLE_ADS_DEVELOPER_TOKEN) — Google approval gate.
//   2. A manager (MCC) account id sent as the `login-customer-id` header
//      (GOOGLE_ADS_LOGIN_CUSTOMER_ID) — QuoteAI's own Google Ads manager
//      account that each customer's LSA account gets linked under.
//   3. Per-customer OAuth2 consent (scope `.../auth/adwords`) via a dedicated
//      OAuth app/consent screen — separate from the Calendar integration's
//      app, since the scope and consent-screen copy differ.
// There is no webhook/push mechanism for LSA leads — they must be polled
// periodically (see googleLsa/maintenance.ts).

const CLIENT_ID = process.env.GOOGLE_LSA_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_LSA_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_LSA_REDIRECT_URI ?? "";
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "";

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.error("WARNING: GOOGLE_LSA_CLIENT_ID/GOOGLE_LSA_CLIENT_SECRET are not set. Google LSA integration will fail.");
}
if (!DEVELOPER_TOKEN) {
  logger.error("WARNING: GOOGLE_ADS_DEVELOPER_TOKEN is not set (requires Google approval). Google LSA lead polling will fail until it is.");
}
if (!LOGIN_CUSTOMER_ID) {
  logger.error("WARNING: GOOGLE_ADS_LOGIN_CUSTOMER_ID is not set. Google LSA lead polling will fail until QuoteAI's manager account is configured.");
}

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ADS_API_VERSION = "v17";
const ADS_API_BASE = "https://googleads.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/adwords";

export function buildAuthUrl(state: string): string {
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
  if (!res.ok) throw new Error(`Google LSA token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GoogleTokenResponse>;
}

export function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  return tokenRequest(
    new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  return tokenRequest(
    new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
  );
}

export type GoogleLsaLeadRow = {
  localServicesLead: {
    id: string;
    leadType: string;
    category?: string;
    creationDateTime?: string;
    leadStatus?: string;
  };
};

/**
 * Runs a GAQL query against the `local_services_lead` resource for one customer account, returning
 * leads created after `sinceIso`. Requires developer token + manager account header — throws with a
 * clear message if either is unset, so callers (the polling sweep) can catch and log per-connection.
 */
export async function queryNewLeads(customerId: string, accessToken: string, sinceIso: string): Promise<GoogleLsaLeadRow[]> {
  if (!DEVELOPER_TOKEN) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not configured");
  if (!LOGIN_CUSTOMER_ID) throw new Error("GOOGLE_ADS_LOGIN_CUSTOMER_ID is not configured");

  const query = `
    SELECT
      local_services_lead.id,
      local_services_lead.lead_type,
      local_services_lead.category_id,
      local_services_lead.creation_date_time,
      local_services_lead.lead_status
    FROM local_services_lead
    WHERE local_services_lead.creation_date_time > '${sinceIso}'
  `.trim();

  const url = `${ADS_API_BASE}/${ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
      "login-customer-id": LOGIN_CUSTOMER_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Google Ads API searchStream failed: ${res.status} ${await res.text()}`);

  // searchStream returns an array of { results: [...] } batches.
  const batches = (await res.json()) as { results?: GoogleLsaLeadRow[] }[];
  return batches.flatMap((b) => b.results ?? []);
}
