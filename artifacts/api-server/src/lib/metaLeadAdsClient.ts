import { logger } from "./logger.js";

// Thin wrapper over Meta's OAuth (Facebook Login for Business) + Graph API
// (developers.facebook.com). No SDK — same "plain fetch against the vendor's
// API" approach as waveClient.ts/quickbooksClient.ts. QuoteAI already has a
// working Meta developer app from Phase 9's WhatsApp Cloud API integration,
// but Lead Ads needs its own per-company OAuth grant (each company connects
// their own Facebook Page), unlike WhatsApp's single-tenant platform number
// — so this reuses the app credentials, not the WhatsApp connection.

const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_REDIRECT_URI = process.env.META_REDIRECT_URI ?? "";

if (!META_APP_ID || !META_APP_SECRET) {
  logger.error("WARNING: META_APP_ID/META_APP_SECRET are not set. Meta Lead Ads integration will fail.");
}

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

// pages_show_list (list the company's Pages), pages_manage_metadata (subscribe the Page to the
// leadgen webhook field), leads_retrieval (read submitted lead data), ads_management (resolve
// campaign/ad names for attribution) — the standard scope set for a Lead Ads integration.
const SCOPE = "pages_show_list,pages_manage_metadata,leads_retrieval,ads_management";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: SCOPE,
    response_type: "code",
    state,
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

async function graphGet<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Meta Graph API error: ${json.error?.message ?? res.status}`);
  }
  return json as T;
}

async function graphPost<T>(path: string, accessToken: string, body: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Meta Graph API error: ${json.error?.message ?? res.status}`);
  }
  return json as T;
}

export type MetaTokenResponse = { access_token: string; token_type: string; expires_in?: number };

/** Exchanges the OAuth callback code for a short-lived user access token. */
export async function exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("redirect_uri", META_REDIRECT_URI);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`Meta token exchange failed: ${json.error?.message ?? res.status}`);
  return json as MetaTokenResponse;
}

/** Exchanges a short-lived user token for a long-lived one (~60 days), so the Page token derived from it doesn't expire quickly. */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", shortLivedToken);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`Meta long-lived token exchange failed: ${json.error?.message ?? res.status}`);
  return json as MetaTokenResponse;
}

export type MetaPage = { id: string; name: string; access_token: string };

/** The Pages the connected user manages, each with its own (effectively non-expiring, tied to the user token) Page access token. */
export async function listPages(userAccessToken: string): Promise<MetaPage[]> {
  const data = await graphGet<{ data: MetaPage[] }>("/me/accounts", userAccessToken, { fields: "id,name,access_token" });
  return data.data;
}

/** v1 auto-connects the first Page returned — mirrors waveClient.ts's `getFirstBusiness` fallback. */
export async function getFirstPage(userAccessToken: string): Promise<MetaPage | null> {
  const pages = await listPages(userAccessToken);
  return pages[0] ?? null;
}

/** Subscribes the Page to the `leadgen` webhook field so new Lead Ads submissions are pushed to our webhook. */
export async function subscribePageToLeadgen(pageId: string, pageAccessToken: string): Promise<void> {
  await graphPost<{ success: boolean }>(`/${pageId}/subscribed_apps`, pageAccessToken, { subscribed_fields: "leadgen" });
}

export type MetaLeadFieldDatum = { name: string; values: string[] };
export type MetaLeadData = {
  id: string;
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  created_time?: string;
  field_data: MetaLeadFieldDatum[];
};

/** Fetches the full submitted lead (name/email/phone + form/ad/campaign attribution) after a `leadgen` webhook event. */
export async function getLeadData(leadgenId: string, pageAccessToken: string): Promise<MetaLeadData> {
  return graphGet<MetaLeadData>(`/${leadgenId}`, pageAccessToken, {
    fields: "id,form_id,ad_id,ad_name,campaign_id,campaign_name,created_time,field_data",
  });
}

/** Meta's standard Lead Ads field-data keys for name/email/phone — a form can use custom labels for anything else. */
export function extractContactFields(fieldData: MetaLeadFieldDatum[]): { name: string | null; email: string | null; phone: string | null } {
  const get = (keys: string[]) => {
    for (const f of fieldData) {
      if (keys.includes(f.name.toLowerCase())) return f.values[0] ?? null;
    }
    return null;
  };
  return {
    name: get(["full_name", "first_name"]),
    email: get(["email"]),
    phone: get(["phone_number"]),
  };
}
