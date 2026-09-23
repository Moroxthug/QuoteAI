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

/** Keeps the Fault body so a caller can tell "duplicate name" (6240) from a real failure. */
class QboError extends Error {
  constructor(readonly path: string, readonly status: number, readonly body: string) {
    super(`QuickBooks API ${path.split("?")[0]} failed: ${status} ${body.slice(0, 500)}`);
  }
  get isDuplicateName(): boolean {
    return this.body.includes("6240") || /duplicate name/i.test(this.body);
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
  if (!res.ok) throw new QboError(path, res.status, await res.text());
  return res.json() as Promise<T>;
}

export async function getCompanyName(realmId: string, accessToken: string): Promise<string> {
  const data = await qboRequest<{ CompanyInfo: { CompanyName?: string } }>(realmId, accessToken, `/companyinfo/${realmId}`);
  return data.CompanyInfo.CompanyName ?? "";
}

type QbAccount = { Id: string; Name: string };
type QbRef = { value: string; name?: string };

/** QBO query strings quote with single quotes; a quote inside a value is backslash-escaped. */
const q = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function query<T>(realmId: string, accessToken: string, entity: string, sql: string): Promise<T[]> {
  const data = await qboRequest<{ QueryResponse: Record<string, T[] | undefined> }>(realmId, accessToken, `/query?query=${encodeURIComponent(sql)}`);
  return data.QueryResponse[entity] ?? [];
}

async function queryAccounts(realmId: string, accessToken: string, accountTypeFilter: string): Promise<QbAccount[]> {
  return query<QbAccount>(realmId, accessToken, "Account", `select Id, Name from Account where ${accountTypeFilter} and Active = true maxresults 200`);
}

export function listExpenseAccounts(realmId: string, accessToken: string): Promise<QbAccount[]> {
  return queryAccounts(realmId, accessToken, "AccountType In ('Expense', 'Cost of Goods Sold', 'Other Expense')");
}

export function listPaymentAccounts(realmId: string, accessToken: string): Promise<QbAccount[]> {
  return queryAccounts(realmId, accessToken, "AccountType In ('Bank', 'Credit Card')");
}

export function listIncomeAccounts(realmId: string, accessToken: string): Promise<QbAccount[]> {
  return queryAccounts(realmId, accessToken, "AccountType In ('Income', 'Other Income')");
}

/** Deposit targets for payments: bank accounts plus Other Current Asset (where Undeposited Funds lives). */
export function listDepositAccounts(realmId: string, accessToken: string): Promise<QbAccount[]> {
  return queryAccounts(realmId, accessToken, "AccountType In ('Bank', 'Other Current Asset')");
}

/** Sales tax codes (HST ON, GST/QST QC, Exempt, Out of scope …) — every Canadian QBO company has its own list. */
export async function listTaxCodes(realmId: string, accessToken: string): Promise<QbAccount[]> {
  return query<QbAccount>(realmId, accessToken, "TaxCode", "select Id, Name from TaxCode where Active = true maxresults 200");
}

/**
 * The service item every synced invoice line is booked against. One item per
 * income account ("QuoteAI Job Revenue" when none was picked, as before Phase
 * 88), so picking a different income account in the mapping takes effect.
 */
export async function getOrCreateRevenueItem(realmId: string, accessToken: string, incomeAccount: { id: string; name: string } | null): Promise<QbAccount> {
  const name = incomeAccount ? `QuoteAI Job Revenue - ${incomeAccount.name}`.slice(0, 100) : "QuoteAI Job Revenue";
  const [existing] = await query<QbAccount>(realmId, accessToken, "Item", `select Id, Name from Item where Name = ${q(name)} maxresults 1`);
  if (existing) return existing;

  let accountId = incomeAccount?.id;
  if (!accountId) {
    const incomeAccounts = await listIncomeAccounts(realmId, accessToken);
    accountId = incomeAccounts[0]?.Id;
  }
  if (!accountId) throw new Error("No QuickBooks income account found to attach the revenue item to");

  const data = await qboRequest<{ Item: QbAccount }>(realmId, accessToken, "/item", {
    method: "POST",
    body: JSON.stringify({ Name: name, Type: "Service", IncomeAccountRef: { value: accountId } }),
  });
  return data.Item;
}

type QbParty = { Id: string; DisplayName: string };

/**
 * Finds a customer or vendor without creating a twin: by email first (a name
 * typed two ways is still one person), then by display name. QBO display
 * names are unique across customers, vendors and employees, so a name already
 * taken by the other kind gets the email (or a short id) added.
 */
export async function findOrCreateParty(
  realmId: string,
  accessToken: string,
  kind: "Customer" | "Vendor",
  party: { name: string; email?: string | null; suffix?: string },
): Promise<{ id: string; created: boolean }> {
  const name = (party.name.trim() || (kind === "Customer" ? "QuoteAI Customer" : "QuoteAI Vendor")).slice(0, 100);
  const email = (party.email ?? "").trim();
  if (email.includes("@")) {
    const [byEmail] = await query<QbParty>(realmId, accessToken, kind, `select Id, DisplayName from ${kind} where PrimaryEmailAddr = ${q(email)} maxresults 1`);
    if (byEmail) return { id: byEmail.Id, created: false };
  }
  const [byName] = await query<QbParty>(realmId, accessToken, kind, `select Id, DisplayName from ${kind} where DisplayName = ${q(name)} maxresults 1`);
  if (byName) return { id: byName.Id, created: false };

  const create = (displayName: string) =>
    qboRequest<Record<string, QbParty>>(realmId, accessToken, `/${kind.toLowerCase()}`, {
      method: "POST",
      body: JSON.stringify({ DisplayName: displayName, ...(email.includes("@") ? { PrimaryEmailAddr: { Address: email } } : {}) }),
    });
  try {
    const data = await create(name);
    return { id: data[kind]!.Id, created: true };
  } catch (err) {
    if (!(err instanceof QboError) || !err.isDuplicateName) throw err;
    const data = await create(`${name} (${email || party.suffix || kind.toLowerCase()})`.slice(0, 100));
    return { id: data[kind]!.Id, created: true };
  }
}

export type QbInvoice = { Id: string; SyncToken: string; TotalAmt: number; Balance: number; DocNumber?: string };

export async function findInvoiceByDocNumber(realmId: string, accessToken: string, docNumber: string): Promise<QbInvoice | null> {
  const [found] = await query<QbInvoice>(realmId, accessToken, "Invoice", `select Id, SyncToken, TotalAmt, Balance, DocNumber from Invoice where DocNumber = ${q(docNumber)} maxresults 1`);
  return found ?? null;
}

export async function createInvoice(realmId: string, accessToken: string, payload: Record<string, unknown>): Promise<QbInvoice> {
  const data = await qboRequest<{ Invoice: QbInvoice }>(realmId, accessToken, "/invoice", { method: "POST", body: JSON.stringify(payload) });
  return data.Invoice;
}

export async function getInvoice(realmId: string, accessToken: string, id: string): Promise<QbInvoice> {
  const data = await qboRequest<{ Invoice: QbInvoice }>(realmId, accessToken, `/invoice/${encodeURIComponent(id)}`);
  return data.Invoice;
}

/** QBO keeps a voided invoice (zeroed, marked Voided) rather than deleting it — the same rule QuoteAI follows. */
export async function voidInvoice(realmId: string, accessToken: string, invoice: Pick<QbInvoice, "Id" | "SyncToken">): Promise<void> {
  await qboRequest(realmId, accessToken, "/invoice?operation=void", { method: "POST", body: JSON.stringify({ Id: invoice.Id, SyncToken: invoice.SyncToken }) });
}

export async function createPayment(realmId: string, accessToken: string, payload: Record<string, unknown>): Promise<{ Id: string }> {
  const data = await qboRequest<{ Payment: { Id: string } }>(realmId, accessToken, "/payment", { method: "POST", body: JSON.stringify(payload) });
  return data.Payment;
}

/** Deleting needs the current SyncToken, so it is read first. A payment already gone counts as deleted. */
export async function deletePayment(realmId: string, accessToken: string, id: string): Promise<void> {
  let syncToken: string;
  try {
    const data = await qboRequest<{ Payment: { Id: string; SyncToken: string } }>(realmId, accessToken, `/payment/${encodeURIComponent(id)}`);
    syncToken = data.Payment.SyncToken;
  } catch (err) {
    if (err instanceof QboError && (err.status === 404 || err.body.includes("610"))) return;
    throw err;
  }
  await qboRequest(realmId, accessToken, "/payment?operation=delete", { method: "POST", body: JSON.stringify({ Id: id, SyncToken: syncToken }) });
}

export async function createExpense(realmId: string, accessToken: string, payload: Record<string, unknown>): Promise<{ Id: string }> {
  const data = await qboRequest<{ Purchase: { Id: string } }>(realmId, accessToken, "/purchase", { method: "POST", body: JSON.stringify(payload) });
  return data.Purchase;
}

export type QbPayment = {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PaymentRefNum?: string;
  CustomerRef?: QbRef;
  Line?: { Amount: number; LinkedTxn?: { TxnId: string; TxnType: string }[] }[];
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string };
};

/** Payments created or changed after `since`, oldest first, one page — the caller advances its cursor and comes back. */
export async function listPaymentsSince(realmId: string, accessToken: string, since: Date, max = 200): Promise<QbPayment[]> {
  const iso = since.toISOString().replace(/\.\d{3}Z$/, "Z");
  return query<QbPayment>(realmId, accessToken, "Payment", `select * from Payment where MetaData.LastUpdatedTime > ${q(iso)} orderby MetaData.LastUpdatedTime maxresults ${max}`);
}

