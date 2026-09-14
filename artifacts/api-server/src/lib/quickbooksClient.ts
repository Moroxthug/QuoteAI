import { logger } from "./logger.js";

// Thin wrapper over QuickBooks Online's OAuth2 + Accounting API v3. No SDK —
// same "plain fetch against the vendor's REST API" approach as whatsapp.ts.

const QB_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID ?? "";
const QB_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET ?? "";
const QB_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI ?? "";
const QB_ENVIRONMENT: "sandbox" | "production" = process.env.QUICKBOOKS_ENVIRONMENT === "sandbox" ? "sandbox" : "production";

if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
  logger.error("WARNING: QUICKBOOKS_CLIENT_ID/QUICKBOOKS_CLIENT_SECRET are not set. QuickBooks integration will fail.");
}

const AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE = "com.intuit.quickbooks.accounting";

function apiBase(): string {
  return QB_ENVIRONMENT === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
}

export function quickbooksEnvironment(): "sandbox" | "production" {
  return QB_ENVIRONMENT;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: QB_CLIENT_ID,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: QB_REDIRECT_URI,
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export type QbTokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(body: URLSearchParams): Promise<QbTokenResponse> {
  const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`QuickBooks token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<QbTokenResponse>;
}

export function exchangeCodeForTokens(code: string): Promise<QbTokenResponse> {
  return tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: QB_REDIRECT_URI }));
}

export function refreshAccessToken(refreshToken: string): Promise<QbTokenResponse> {
  return tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

export async function revokeToken(token: string): Promise<void> {
  const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    logger.warn({ err }, "QuickBooks token revoke failed (ignoring — disconnect still proceeds)");
  }
}

async function qboRequest<T>(realmId: string, accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/v3/company/${realmId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`QuickBooks API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function getCompanyName(realmId: string, accessToken: string): Promise<string> {
  const data = await qboRequest<{ CompanyInfo: { CompanyName?: string } }>(realmId, accessToken, `/companyinfo/${realmId}`);
  return data.CompanyInfo.CompanyName ?? "";
}

type QbAccount = { Id: string; Name: string };

async function queryAccounts(realmId: string, accessToken: string, accountTypeFilter: string): Promise<QbAccount[]> {
  const query = `select Id, Name from Account where ${accountTypeFilter} and Active = true maxresults 200`;
  const data = await qboRequest<{ QueryResponse: { Account?: QbAccount[] } }>(realmId, accessToken, `/query?query=${encodeURIComponent(query)}`);
  return data.QueryResponse.Account ?? [];
}

export function listExpenseAccounts(realmId: string, accessToken: string): Promise<QbAccount[]> {
  return queryAccounts(realmId, accessToken, "AccountType = 'Expense'");
}

export function listPaymentAccounts(realmId: string, accessToken: string): Promise<QbAccount[]> {
  return queryAccounts(realmId, accessToken, "AccountType In ('Bank', 'Credit Card')");
}

async function findServiceItem(realmId: string, accessToken: string, name: string): Promise<QbAccount | null> {
  const query = `select Id, Name from Item where Name = '${name.replace(/'/g, "\\'")}' maxresults 1`;
  const data = await qboRequest<{ QueryResponse: { Item?: QbAccount[] } }>(realmId, accessToken, `/query?query=${encodeURIComponent(query)}`);
  return data.QueryResponse.Item?.[0] ?? null;
}

/** Finds (or creates) the generic "QuoteAI Job Revenue" service item every synced invoice line is booked against. */
export async function getOrCreateRevenueItem(realmId: string, accessToken: string): Promise<QbAccount> {
  const name = "QuoteAI Job Revenue";
  const existing = await findServiceItem(realmId, accessToken, name);
  if (existing) return existing;

  const incomeAccounts = await queryAccounts(realmId, accessToken, "AccountType = 'Income'");
  const incomeAccount = incomeAccounts[0];
  if (!incomeAccount) throw new Error("No QuickBooks income account found to attach the revenue item to");

  const data = await qboRequest<{ Item: QbAccount }>(realmId, accessToken, "/item", {
    method: "POST",
    body: JSON.stringify({
      Name: name,
      Type: "Service",
      IncomeAccountRef: { value: incomeAccount.Id },
    }),
  });
  return data.Item;
}

async function findCustomer(realmId: string, accessToken: string, displayName: string): Promise<QbAccount | null> {
  const query = `select Id, Name from Customer where DisplayName = '${displayName.replace(/'/g, "\\'")}' maxresults 1`;
  const data = await qboRequest<{ QueryResponse: { Customer?: QbAccount[] } }>(realmId, accessToken, `/query?query=${encodeURIComponent(query)}`);
  return data.QueryResponse.Customer?.[0] ?? null;
}

export async function getOrCreateCustomer(realmId: string, accessToken: string, displayName: string): Promise<QbAccount> {
  const name = displayName.trim() || "QuoteAI Customer";
  const existing = await findCustomer(realmId, accessToken, name);
  if (existing) return existing;

  const data = await qboRequest<{ Customer: QbAccount }>(realmId, accessToken, "/customer", {
    method: "POST",
    body: JSON.stringify({ DisplayName: name }),
  });
  return data.Customer;
}

export async function createSalesReceipt(realmId: string, accessToken: string, payload: Record<string, unknown>): Promise<{ Id: string }> {
  const data = await qboRequest<{ SalesReceipt: { Id: string } }>(realmId, accessToken, "/salesreceipt", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.SalesReceipt;
}

export async function createExpense(realmId: string, accessToken: string, payload: Record<string, unknown>): Promise<{ Id: string }> {
  const data = await qboRequest<{ Purchase: { Id: string } }>(realmId, accessToken, "/purchase", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.Purchase;
}
