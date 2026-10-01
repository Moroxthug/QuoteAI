// The server calls of the guided first quote, the same ones the web's new-quote page and quote page
// make: POST /api/quotes (the AI writes and prices it), GET /api/quotes/:id, the price check, and
// POST /api/quotes/:id/send-pdf-email. The generated hooks don't cover the multipart create with
// the app's fetch, so these go through lib/api.ts and the wrapped fetch.
import { ApiFailure, api } from "./api";
import { API_ORIGIN } from "./session";
import type { QuoteLike } from "./firstQuote";

export type FirstQuoteProblem = "offline" | "quota" | "cannot" | "unlock" | "failed";
export type Result<T> = { ok: true; data: T } | { ok: false; problem: FirstQuoteProblem };

export type FullQuote = QuoteLike & { id: string; status?: string };
export type PriceCheck = { linesChecked: number; findings: unknown[]; references: number };
export type Profile = {
  companyName?: string | null; vatNumber?: string | null; address?: string | null; phone?: string | null; email?: string | null; logoUrl?: string | null;
  province?: string | null;
};

function problemOf(e: unknown): FirstQuoteProblem {
  if (e instanceof ApiFailure) {
    if (e.offline) return "offline";
    if (e.status === 429) return "quota";
    if (e.status === 400 || e.status === 422) return "cannot";
    if (e.status === 402) return "unlock";
  }
  return "failed";
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, problem: problemOf(e) };
  }
}

export const firstQuoteApi = {
  profile: () => run(() => api<Profile>("/api/business-profile")),

  /** The AI writes and prices the job (multipart, like the web). The company's details go in as the quote's letterhead. */
  create: (rawInput: string, profile: Profile | null) =>
    run(async () => {
      const form = new FormData();
      form.append("rawInput", rawInput);
      if (profile) {
        const snapshot = {
          companyName: profile.companyName || "",
          ...(profile.vatNumber ? { vatNumber: profile.vatNumber } : null),
          ...(profile.address ? { address: profile.address } : null),
          ...(profile.phone ? { phone: profile.phone } : null),
          ...(profile.email ? { email: profile.email } : null),
          ...(profile.logoUrl ? { logoUrl: profile.logoUrl } : null),
        };
        form.append("companySnapshot", JSON.stringify(snapshot));
      }
      let res: Response;
      try {
        res = await fetch(`${API_ORIGIN}/api/quotes`, { method: "POST", body: form, headers: { accept: "application/json" } });
      } catch {
        throw new ApiFailure(0, undefined, "offline");
      }
      const text = await res.text();
      let body: { error?: string; code?: string } & Partial<FullQuote> = {};
      try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
      if (!res.ok) throw new ApiFailure(res.status, body.code ?? body.error, body.error ?? `HTTP ${res.status}`);
      return body as FullQuote;
    }),

  quote: (id: string) => run(() => api<FullQuote>(`/api/quotes/${encodeURIComponent(id)}`)),

  priceCheck: (id: string) => run(() => api<PriceCheck>(`/api/quotes/${encodeURIComponent(id)}/price-check`)),

  /** The PDF and the link to accept it online, by email. */
  send: (id: string, toEmail: string, clientName?: string) =>
    run(() => api<{ success: boolean }>(`/api/quotes/${encodeURIComponent(id)}/send-pdf-email`, { method: "POST", body: { toEmail, ...(clientName ? { clientName } : null) } })),

  /** When the account was made (better-auth's session), for "From sign-up to sent". */
  async accountCreatedAt(): Promise<unknown> {
    try {
      const r = await api<{ user?: { createdAt?: unknown } }>("/api/auth/get-session");
      return r?.user?.createdAt ?? null;
    } catch {
      return null;
    }
  },
};
