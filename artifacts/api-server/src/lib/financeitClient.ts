import { logger } from "./logger.js";

// Thin wrapper over Financeit's v3 API (financeit.ca/api/v3) — same "plain
// fetch against the vendor's REST API" approach as quickbooksClient.ts.
// Requires Financeit partner API access (app_id/app_secret), which is an
// enterprise onboarding process, not self-serve signup — see
// docs/EDGE-FEATURES-PLAN.md §3. Until FINANCEIT_APP_ID/FINANCEIT_APP_SECRET
// are set, every call below fails with a clear error rather than pretending
// to succeed.

const FINANCEIT_APP_ID = process.env.FINANCEIT_APP_ID ?? "";
const FINANCEIT_APP_SECRET = process.env.FINANCEIT_APP_SECRET ?? "";
const FINANCEIT_ENVIRONMENT: "sandbox" | "production" = process.env.FINANCEIT_ENVIRONMENT === "production" ? "production" : "sandbox";

function apiBase(): string {
  return FINANCEIT_ENVIRONMENT === "production" ? "https://financeit.ca/api/v3" : "https://sandbox.financeit.ca/api/v3";
}

export function financeitConfigured(): boolean {
  return !!FINANCEIT_APP_ID && !!FINANCEIT_APP_SECRET;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getBearerToken(): Promise<string> {
  if (!financeitConfigured()) {
    throw new Error("FINANCEIT_APP_ID/FINANCEIT_APP_SECRET are not set — Financeit partner API access has not been granted yet");
  }
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.token;

  const res = await fetch(`${apiBase()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", app_id: FINANCEIT_APP_ID, app_secret: FINANCEIT_APP_SECRET }),
  });
  if (!res.ok) throw new Error(`Financeit auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function financeitRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getBearerToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Financeit API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type FinanceitCalculatorEstimate = { monthlyPayment: number; termMonths: number; apr: number };

/** Indicative monthly-payment estimate — no application, no credit check. */
export async function calculateEstimate(dealerId: string, amountCents: number): Promise<FinanceitCalculatorEstimate> {
  const data = await financeitRequest<{ monthly_payment: number; term_months: number; apr: number }>(
    "/calculator/calculate/",
    {
      method: "POST",
      body: JSON.stringify({ partner_id: dealerId, amount: amountCents / 100 }),
    },
  );
  return { monthlyPayment: data.monthly_payment, termMonths: data.term_months, apr: data.apr };
}

export type FinanceitDirectInvite = { applicationId: string; applicationLink: string };

/** Sends the customer a hosted financing application (redirect flow) — no raw loan data ever touches QuoteAI. */
export async function sendDirectInvite(params: {
  dealerId: string;
  amountCents: number;
  referenceId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
}): Promise<FinanceitDirectInvite> {
  const data = await financeitRequest<{ application_id: string; application_link: string }>("/direct_invites/send", {
    method: "POST",
    body: JSON.stringify({
      partner_id: params.dealerId,
      amount: params.amountCents / 100,
      reference_id: params.referenceId,
      customer: {
        name: params.customerName,
        email: params.customerEmail || undefined,
        phone: params.customerPhone || undefined,
      },
    }),
  });
  return { applicationId: data.application_id, applicationLink: data.application_link };
}

if (!financeitConfigured()) {
  logger.warn("FINANCEIT_APP_ID/FINANCEIT_APP_SECRET not set — Financeit financing is built but inert until partner API access is granted.");
}
