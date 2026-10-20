import { count, eq } from "drizzle-orm";
import { db, businessProfilesTable, effectivePlan, quotesTable } from "@workspace/db";

// The free-quote hook (docs/GROWTH-PLAN.md, Phase 133): a company on no paid plan may make FREE_QUOTES_LIMIT quotes in total, then needs a plan.
// Counting always works (the apps can show "2 of 3 free quotes left"); BLOCKING is switched on by FREE_QUOTES_ENFORCED=1 so it can be turned on the day an in-app purchase exists.

export const FREE_QUOTES_DEFAULT_LIMIT = 3;

export function freeQuotesLimit(env: NodeJS.ProcessEnv = { FREE_QUOTES_LIMIT: process.env.FREE_QUOTES_LIMIT }): number {
  const n = Number.parseInt(env.FREE_QUOTES_LIMIT ?? "", 10);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : FREE_QUOTES_DEFAULT_LIMIT;
}

export const freeQuotesEnforced = (env: NodeJS.ProcessEnv = { FREE_QUOTES_ENFORCED: process.env.FREE_QUOTES_ENFORCED }): boolean => env.FREE_QUOTES_ENFORCED === "1";

export type QuoteAllowance = {
  /** True on any paid (or trialing) plan: no free-quote counting applies. */
  paid: boolean;
  /** Quotes the company has made in total. */
  used: number;
  /** Free quotes in all; null on a paid plan. */
  limit: number | null;
  /** Free quotes left; null on a paid plan. */
  left: number | null;
  /** Whether running out of them actually stops new quotes today. */
  enforced: boolean;
};

/** Pure: what the numbers say. */
export function allowanceOf(o: { paid: boolean; used: number; limit: number; enforced: boolean }): QuoteAllowance {
  if (o.paid) return { paid: true, used: o.used, limit: null, left: null, enforced: o.enforced };
  return { paid: false, used: o.used, limit: o.limit, left: Math.max(0, o.limit - o.used), enforced: o.enforced };
}

export const isBlocked = (a: QuoteAllowance): boolean => a.enforced && !a.paid && a.left === 0;

export async function quoteAllowance(userId: string): Promise<QuoteAllowance> {
  const [profile] = await db
    .select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus, featureFlags: businessProfilesTable.featureFlags })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId));
  const paid = effectivePlan(profile) !== "free";
  if (paid) return allowanceOf({ paid, used: 0, limit: freeQuotesLimit(), enforced: freeQuotesEnforced() });
  const [row] = await db.select({ n: count() }).from(quotesTable).where(eq(quotesTable.userId, userId));
  return allowanceOf({ paid, used: Number(row?.n ?? 0), limit: freeQuotesLimit(), enforced: freeQuotesEnforced() });
}

/** The answer to a blocked request: 402, a code the apps recognise, and the numbers for the "you have used your free quotes" screen. */
export function freeQuotesUsedBody(a: QuoteAllowance) {
  return { error: `You have used your ${a.limit} free quotes. Choose a plan to keep quoting.`, code: "FREE_QUOTES_USED", limit: a.limit, used: a.used };
}
