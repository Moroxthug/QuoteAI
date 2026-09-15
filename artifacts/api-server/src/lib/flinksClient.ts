import { logger } from "./logger.js";

// Thin wrapper over Flinks's BankingServices API (v3). Flinks access is a
// managed accreditation process (onboarding, consent management, governance
// per their own materials), not self-serve signup — see
// docs/EDGE-FEATURES-PLAN.md §14. Until FLINKS_CUSTOMER_ID/FLINKS_INSTANCE
// are set, every call below fails with a clear error rather than pretending
// to succeed.
//
// Flow: the frontend embeds Flinks Connect (a hosted iframe) so bank
// credentials are entered directly with Flinks/the institution, never with
// QuoteAI (PCI/compliance boundary Flinks requires). Connect posts a LoginId
// back to the browser; the backend exchanges that LoginId for account +
// transaction data via GetAccountsDetail, which is async — Flinks returns
// HTTP 202 with a RequestId while it polls the institution, so callers here
// poll the same endpoint until it resolves.

const FLINKS_CUSTOMER_ID = process.env.FLINKS_CUSTOMER_ID ?? "";
const FLINKS_INSTANCE = process.env.FLINKS_INSTANCE ?? "";
const FLINKS_ENVIRONMENT: "sandbox" | "production" = process.env.FLINKS_ENVIRONMENT === "production" ? "production" : "sandbox";

function apiBase(): string {
  // Flinks provisions a customer-specific instance subdomain; sandbox instances are suffixed "-sandbox".
  const instance = FLINKS_ENVIRONMENT === "production" ? FLINKS_INSTANCE : `${FLINKS_INSTANCE}-sandbox`;
  return `https://${instance}-api.private.fin.ag/v3/${FLINKS_CUSTOMER_ID}`;
}

export function flinksConfigured(): boolean {
  return !!FLINKS_CUSTOMER_ID && !!FLINKS_INSTANCE;
}

/** The hosted Connect iframe the frontend embeds — credentials are entered there, never sent to QuoteAI. */
export function buildConnectUrl(): string {
  if (!flinksConfigured()) {
    throw new Error("FLINKS_CUSTOMER_ID/FLINKS_INSTANCE are not set — Flinks accreditation has not been granted yet");
  }
  const instance = FLINKS_ENVIRONMENT === "production" ? FLINKS_INSTANCE : `${FLINKS_INSTANCE}-sandbox`;
  const params = new URLSearchParams({ demo: FLINKS_ENVIRONMENT === "sandbox" ? "true" : "false", theme: "light" });
  return `https://${instance}-iframe.private.fin.ag/v2/?${params.toString()}`;
}

async function flinksRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!flinksConfigured()) {
    throw new Error("FLINKS_CUSTOMER_ID/FLINKS_INSTANCE are not set — Flinks accreditation has not been granted yet");
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`Flinks API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 3000;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FlinksAccountDetail = {
  id: string;
  name: string;
  institution: string;
  last4: string | null;
  transactions: {
    id: string;
    date: string;
    description: string;
    amountCents: number;
    balanceCents: number | null;
  }[];
};

type RawFlinksAccount = {
  Id: string;
  Title?: string;
  AccountNumber?: string;
  Institution?: string;
  Transactions?: { Id: string; Date: string; Description?: string; Debit?: number; Credit?: number; Balance?: number }[];
};
type RawFlinksResponse = { HttpStatusCode?: number; RequestId?: string; Accounts?: RawFlinksAccount[] };

function toAccountDetail(a: RawFlinksAccount, institution: string): FlinksAccountDetail {
  return {
    id: a.Id,
    name: a.Title ?? "Account",
    institution: a.Institution ?? institution,
    last4: a.AccountNumber ? a.AccountNumber.slice(-4) : null,
    transactions: (a.Transactions ?? []).map((tx) => ({
      id: tx.Id,
      date: tx.Date,
      description: tx.Description ?? "",
      // Flinks reports debit/credit separately in dollars; normalize to signed cents (debit = money out).
      amountCents: Math.round(((tx.Credit ?? 0) - (tx.Debit ?? 0)) * 100),
      balanceCents: typeof tx.Balance === "number" ? Math.round(tx.Balance * 100) : null,
    })),
  };
}

/** Exchanges a Connect LoginId for every account (and its recent transactions) at that institution, polling until Flinks resolves. */
export async function getAccountsDetail(loginId: string, institutionName: string): Promise<FlinksAccountDetail[]> {
  let data = await flinksRequest<RawFlinksResponse>("/BankingServices/GetAccountsDetail", {
    LoginId: loginId,
    MostRecentCached: false,
    WithTransactions: true,
    DaysOfTransactions: "Days90",
  });

  let attempts = 0;
  while (data.HttpStatusCode === 202 && attempts < POLL_ATTEMPTS) {
    await sleep(POLL_DELAY_MS);
    data = await flinksRequest<RawFlinksResponse>("/BankingServices/GetAccountsDetail", {
      LoginId: loginId,
      RequestId: data.RequestId,
    });
    attempts++;
  }
  if (data.HttpStatusCode === 202) {
    throw new Error("Flinks is still retrieving this account — try refreshing again shortly");
  }

  return (data.Accounts ?? []).map((a) => toAccountDetail(a, institutionName));
}

if (!flinksConfigured()) {
  logger.warn("FLINKS_CUSTOMER_ID/FLINKS_INSTANCE not set — Flinks bank feed reconciliation is built but inert until accreditation is granted.");
}
