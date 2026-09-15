import { logger } from "./logger.js";

// Thin wrapper over Wave's OAuth2 + GraphQL API (developer.waveapps.com).
// No SDK — same "plain fetch against the vendor's API" approach as
// quickbooksClient.ts/whatsapp.ts. Unlike QuickBooks, Wave has a single
// GraphQL endpoint for everything (no separate REST resources).

const WAVE_CLIENT_ID = process.env.WAVE_CLIENT_ID ?? "";
const WAVE_CLIENT_SECRET = process.env.WAVE_CLIENT_SECRET ?? "";
const WAVE_REDIRECT_URI = process.env.WAVE_REDIRECT_URI ?? "";

if (!WAVE_CLIENT_ID || !WAVE_CLIENT_SECRET) {
  logger.error("WARNING: WAVE_CLIENT_ID/WAVE_CLIENT_SECRET are not set. Wave integration will fail.");
}

const AUTH_BASE = "https://api.waveapps.com/oauth2/authorize/";
const TOKEN_URL = "https://api.waveapps.com/oauth2/token/";
const GRAPHQL_URL = "https://gql.waveapps.com/graphql/public";

// business:read (fetch the connected business's name), customer:read/write
// (find-or-create the invoice customer), account:read (list accounts for the
// mapping UI), invoice:read/write (post revenue), transaction:write (post
// expenses). No invoice:send — synced invoices are a books record, never
// emailed to the customer through Wave.
const SCOPE = "business:read customer:read customer:write account:read invoice:read invoice:write transaction:write";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: WAVE_CLIENT_ID,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: WAVE_REDIRECT_URI,
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export type WaveTokenResponse = { access_token: string; refresh_token: string; expires_in: number; businessId?: string };

async function tokenRequest(body: URLSearchParams): Promise<WaveTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Wave token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<WaveTokenResponse>;
}

export function exchangeCodeForTokens(code: string): Promise<WaveTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: WAVE_CLIENT_ID,
      client_secret: WAVE_CLIENT_SECRET,
      code,
      redirect_uri: WAVE_REDIRECT_URI,
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<WaveTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: WAVE_CLIENT_ID,
      client_secret: WAVE_CLIENT_SECRET,
      refresh_token: refreshToken,
      redirect_uri: WAVE_REDIRECT_URI,
    }),
  );
}

/** Wave has no documented token-revocation endpoint — disconnect just deletes the stored (encrypted) tokens. */
export async function revokeToken(): Promise<void> {
  return;
}

type GraphQlResponse<T> = { data?: T; errors?: { message: string }[] };

async function gql<T>(accessToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Wave API request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as GraphQlResponse<T>;
  if (json.errors?.length) throw new Error(`Wave API error: ${json.errors.map(e => e.message).join("; ")}`);
  if (!json.data) throw new Error("Wave API returned no data");
  return json.data;
}

export async function getBusiness(accessToken: string, businessId: string): Promise<{ id: string; name: string }> {
  const data = await gql<{ business: { id: string; name: string } }>(
    accessToken,
    `query GetBusiness($businessId: ID!) { business(id: $businessId) { id name } }`,
    { businessId },
  );
  return data.business;
}

/** The first (only, in practice) business the token is authorized for — used when no businessId was returned on connect. */
export async function getFirstBusiness(accessToken: string): Promise<{ id: string; name: string } | null> {
  const data = await gql<{ businesses: { edges: { node: { id: string; name: string } }[] } }>(
    accessToken,
    `query { businesses(page: 1, pageSize: 1) { edges { node { id name } } } }`,
    {},
  );
  return data.businesses.edges[0]?.node ?? null;
}

type WaveAccount = { id: string; name: string };

async function listAccounts(accessToken: string, businessId: string, types: string[]): Promise<WaveAccount[]> {
  const data = await gql<{ business: { accounts: { edges: { node: WaveAccount }[] } } }>(
    accessToken,
    `query ListAccounts($businessId: ID!, $types: [AccountTypeValue!]) {
      business(id: $businessId) {
        accounts(types: $types, isArchived: false, page: 1, pageSize: 200) {
          edges { node { id name } }
        }
      }
    }`,
    { businessId, types },
  );
  return data.business.accounts.edges.map(e => e.node);
}

export function listExpenseAccounts(accessToken: string, businessId: string): Promise<WaveAccount[]> {
  return listAccounts(accessToken, businessId, ["EXPENSE"]);
}

export function listIncomeAccounts(accessToken: string, businessId: string): Promise<WaveAccount[]> {
  return listAccounts(accessToken, businessId, ["INCOME"]);
}

export function listPaymentAccounts(accessToken: string, businessId: string): Promise<WaveAccount[]> {
  return listAccounts(accessToken, businessId, ["ASSET"]);
}

async function findCustomer(accessToken: string, businessId: string, name: string): Promise<WaveAccount | null> {
  const data = await gql<{ business: { customers: { edges: { node: WaveAccount }[] } } }>(
    accessToken,
    `query FindCustomer($businessId: ID!) {
      business(id: $businessId) { customers(page: 1, pageSize: 200) { edges { node { id name } } } }
    }`,
    { businessId },
  );
  const normalized = name.trim().toLowerCase();
  return data.business.customers.edges.map(e => e.node).find(c => c.name.trim().toLowerCase() === normalized) ?? null;
}

export async function getOrCreateCustomer(accessToken: string, businessId: string, displayName: string): Promise<WaveAccount> {
  const name = displayName.trim() || "QuoteAI Customer";
  const existing = await findCustomer(accessToken, businessId, name);
  if (existing) return existing;

  const data = await gql<{ customerCreate: { didSucceed: boolean; inputErrors?: { message: string }[]; customer?: WaveAccount } }>(
    accessToken,
    `mutation CreateCustomer($input: CustomerCreateInput!) {
      customerCreate(input: $input) { didSucceed inputErrors { message } customer { id name } }
    }`,
    { input: { businessId, name } },
  );
  if (!data.customerCreate.didSucceed || !data.customerCreate.customer) {
    throw new Error(`Wave customerCreate failed: ${data.customerCreate.inputErrors?.map(e => e.message).join("; ") ?? "unknown error"}`);
  }
  return data.customerCreate.customer;
}

export type MoneyTransactionResult = { id: string };

/**
 * Posts a one-line money-in/money-out transaction: `anchor` is the bank/cash
 * account the money lands in (deposit) or leaves from (withdrawal), and the
 * single line item books the other side against a revenue or expense
 * account. Same "one-line-per-transaction" v1 simplification as QuickBooks's
 * SalesReceipt/Purchase sync — a company can re-categorize in Wave after.
 */
export async function createMoneyTransaction(
  accessToken: string,
  businessId: string,
  payload: {
    externalId: string;
    date: string;
    description: string;
    anchorAccountId: string;
    anchorAmount: string;
    anchorDirection: "DEPOSIT" | "WITHDRAWAL";
    lineAccountId: string;
    lineAmount: string;
    lineBalance: "INCREASE" | "DECREASE";
    customerId?: string;
  },
): Promise<MoneyTransactionResult> {
  const data = await gql<{ moneyTransactionCreate: { didSucceed: boolean; inputErrors?: { message: string }[]; transaction?: { id: string } } }>(
    accessToken,
    `mutation CreateMoneyTransaction($input: MoneyTransactionCreateInput!) {
      moneyTransactionCreate(input: $input) { didSucceed inputErrors { message } transaction { id } }
    }`,
    {
      input: {
        businessId,
        externalId: payload.externalId,
        date: payload.date,
        description: payload.description,
        anchor: { accountId: payload.anchorAccountId, amount: payload.anchorAmount, direction: payload.anchorDirection },
        lineItems: [
          {
            accountId: payload.lineAccountId,
            amount: payload.lineAmount,
            balance: payload.lineBalance,
            ...(payload.customerId ? { customerId: payload.customerId } : {}),
          },
        ],
      },
    },
  );
  if (!data.moneyTransactionCreate.didSucceed || !data.moneyTransactionCreate.transaction) {
    throw new Error(`Wave moneyTransactionCreate failed: ${data.moneyTransactionCreate.inputErrors?.map(e => e.message).join("; ") ?? "unknown error"}`);
  }
  return data.moneyTransactionCreate.transaction;
}
