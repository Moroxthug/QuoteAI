// The free-quote allowance (GET /api/me/allowance): what the counter says and when the locked state shows.
// Pure, so it can be tested. The server decides; nothing here knows the number of free quotes.
export type Allowance = {
  freeQuotes: { paid: boolean; used: number; limit: number | null; left: number | null; enforced: boolean };
  launch?: { active: boolean; payingCustomers: number; limit: number; remaining: number; launchPriceCents: number; standardPriceCents: number };
  founding?: boolean;
};

/** none: show nothing (paid, unlimited, or the server didn't say). counting: more than one left. low: one left, or none while blocking is still off. used: none left and the server blocks. */
export type FreeState = { kind: "none" } | { kind: "counting" | "low" | "used"; left: number; limit: number; used: number };

export function freeState(a: Allowance | null | undefined): FreeState {
  const f = a?.freeQuotes;
  if (!f || f.paid || f.limit == null || f.left == null || !(f.limit > 0)) return { kind: "none" };
  const left = Math.max(0, f.left);
  const base = { left, limit: f.limit, used: f.used };
  if (left === 0 && f.enforced) return { kind: "used", ...base };
  return { kind: left <= 1 ? "low" : "counting", ...base };
}

/** The banner's string key under `fq.banner`: count (2 or more left), one, zero (none left, not blocking yet) or used. */
export function bannerKey(s: FreeState): "count" | "one" | "zero" | "used" | null {
  if (s.kind === "none") return null;
  if (s.kind === "used") return "used";
  return s.left === 0 ? "zero" : s.left === 1 ? "one" : "count";
}

/** True when the server will refuse a new quote. */
export const isBlocked = (a: Allowance | null | undefined): boolean => freeState(a).kind === "used";

/** The server's answer when blocking is on and the free quotes are gone: HTTP 402 with this code. */
export const FREE_QUOTES_USED = "FREE_QUOTES_USED";
export const isFreeQuotesUsed = (status: number, code: string | undefined): boolean => status === 402 && code === FREE_QUOTES_USED;

/** limit/used out of the 402's body, when they are numbers. */
export function usedInfo(body: unknown): { limit: number | null; used: number | null } {
  const b = (body && typeof body === "object" ? body : {}) as { limit?: unknown; used?: unknown };
  return { limit: typeof b.limit === "number" ? b.limit : null, used: typeof b.used === "number" ? b.used : null };
}
