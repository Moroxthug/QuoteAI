// Phase 98 (docs/LAUNCH-FINISH-PLAN.md): what the running deployment can say
// about the owner's Phase 99 items. `GET /api/healthz/owner` (CRON_SECRET
// bearer) returns this; `pnpm ops:owner-check` reads it.
//
// It answers from the deployment's own environment, not from a `vercel env
// pull` that may be weeks old — and it checks the Stripe ids with the Stripe
// key this deployment actually uses, so "the price id is from test mode but
// the key is live" shows up before a customer's checkout fails on it.
//
// Presence only: no value is ever returned except the Stripe mode, the price
// ids' own metadata (amount, interval, currency) and the pilot code, which is
// public on /pilot anyway.

import type Stripe from "stripe";

/** Every variable an owner item turns on, by Phase 99 item. Presence is all that is reported. */
export const OWNER_VARS: Record<string, string[]> = {
  "L-6": ["SENTRY_DSN", "VITE_SENTRY_DSN", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT", "CRON_HEARTBEAT_URL", "OPS_ALERT_EMAIL"],
  "L-8": ["STRIPE_PRICE_GROUP_COMPANY", "STRIPE_PRICE_GROUP_COMPANY_YEARLY", "STRIPE_PRICE_EXTRA_SEAT", "STRIPE_PRICE_EXTRA_SEAT_YEARLY"],
  "L-9": ["STRIPE_PRICE_YEARLY_STARTER", "STRIPE_PRICE_YEARLY_PRO", "STRIPE_PRICE_YEARLY_ELITE", "PILOT_PROMO_CODE"],
  "P-5": ["POSTHOG_KEY", "VITE_POSTHOG_KEY", "RESEND_WEBHOOK_SECRET"],
  "P-6": ["CRON_STALE_AFTER_HOURS"],
  "F-1": [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_NUMBER",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_LEAD_FOLLOWUP_TEMPLATE",
    "WHATSAPP_REVIEW_REQUEST_TEMPLATE",
    "WHATSAPP_PHOTO_SHARE_TEMPLATE",
  ],
  "F-2": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
  "F-3": ["GMAIL_SEND_CLIENT_ID", "GMAIL_SEND_CLIENT_SECRET", "GMAIL_SEND_REDIRECT_URI"],
  "F-4": ["OUTLOOK_CALENDAR_CLIENT_ID", "OUTLOOK_CALENDAR_CLIENT_SECRET", "OUTLOOK_CALENDAR_REDIRECT_URI"],
  "F-5": ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "META_LEADGEN_VERIFY_TOKEN", "GSC_SERVICE_ACCOUNT_KEY", "GSC_SITE_URL"],
};

/** The price variables and what each must be: recurring CAD at this interval. */
export const PRICE_VARS: Record<string, "month" | "year"> = {
  STRIPE_PRICE_GROUP_COMPANY: "month",
  STRIPE_PRICE_GROUP_COMPANY_YEARLY: "year",
  STRIPE_PRICE_EXTRA_SEAT: "month",
  STRIPE_PRICE_EXTRA_SEAT_YEARLY: "year",
  STRIPE_PRICE_YEARLY_STARTER: "year",
  STRIPE_PRICE_YEARLY_PRO: "year",
  STRIPE_PRICE_YEARLY_ELITE: "year",
};

export type PriceCheck = {
  set: boolean;
  ok: boolean;
  /** Why it is not ok, in words the owner can act on. */
  problem?: string;
  amount?: number | null;
  currency?: string;
  interval?: string | null;
};

export type OwnerReadiness = {
  checkedAt: string;
  environment: string | null;
  vars: Record<string, boolean>;
  stripe: {
    mode: "live" | "test" | "unset";
    prices: Record<string, PriceCheck>;
    promo: { set: boolean; ok: boolean; code: string | null; problem?: string; percentOff?: number | null; amountOff?: number | null };
  };
  cron: { staleAfterHours: number };
};

type StripeLike = {
  prices: { retrieve: (id: string) => Promise<Pick<Stripe.Price, "active" | "livemode" | "currency" | "unit_amount" | "recurring">> };
  promotionCodes: {
    list: (p: { code: string; limit: number; expand?: string[] }) => Promise<{ data: Array<Pick<Stripe.PromotionCode, "active"> & { promotion?: { coupon?: string | { percent_off?: number | null; amount_off?: number | null } | null } | null }> }>;
  };
};

const present = (env: NodeJS.ProcessEnv, k: string) => (env[k] ?? "").trim().length > 0;

export async function ownerReadiness(env: NodeJS.ProcessEnv, stripe: StripeLike | null): Promise<OwnerReadiness> {
  const vars: Record<string, boolean> = {};
  for (const names of Object.values(OWNER_VARS)) for (const n of names) vars[n] = present(env, n);

  const key = env.STRIPE_SECRET_KEY ?? "";
  const mode: OwnerReadiness["stripe"]["mode"] = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : key ? "test" : "unset";
  const live = mode === "live";

  const prices: Record<string, PriceCheck> = {};
  for (const [name, interval] of Object.entries(PRICE_VARS)) {
    const id = (env[name] ?? "").trim();
    if (!id) {
      prices[name] = { set: false, ok: false, problem: "not set" };
      continue;
    }
    if (!stripe) {
      prices[name] = { set: true, ok: false, problem: "set, but this deployment has no Stripe key to check it with" };
      continue;
    }
    try {
      const p = await stripe.prices.retrieve(id);
      const problems: string[] = [];
      if (p.livemode !== live) problems.push(`a ${p.livemode ? "live" : "test"}-mode price on a ${mode}-mode key — paste the ${mode} id`);
      if (!p.active) problems.push("archived in Stripe");
      if (p.currency !== "cad") problems.push(`currency ${p.currency}, not cad`);
      if (p.recurring?.interval !== interval) problems.push(`bills every ${p.recurring?.interval ?? "once"}, should be every ${interval}`);
      prices[name] = { set: true, ok: problems.length === 0, problem: problems.join("; ") || undefined, amount: p.unit_amount, currency: p.currency, interval: p.recurring?.interval ?? null };
    } catch (err) {
      const msg = (err as { code?: string; message?: string }).code === "resource_missing" ? `no such price in ${mode} mode — likely pasted from the other mode` : ((err as Error).message ?? "lookup failed").slice(0, 160);
      prices[name] = { set: true, ok: false, problem: msg };
    }
  }

  const code = (env.PILOT_PROMO_CODE ?? "").trim();
  let promo: OwnerReadiness["stripe"]["promo"] = { set: false, ok: false, code: null, problem: "not set" };
  if (code) {
    if (!stripe) promo = { set: true, ok: false, code, problem: "set, but this deployment has no Stripe key to check it with" };
    else {
      try {
        const found = (await stripe.promotionCodes.list({ code, limit: 1, expand: ["data.promotion.coupon"] })).data[0];
        if (!found) promo = { set: true, ok: false, code, problem: `Stripe (${mode} mode) has no promotion code "${code}" — create it, or it was made in the other mode` };
        // Stripe marks a code inactive once its coupon expires or is used up, so this covers both.
        else if (!found.active) promo = { set: true, ok: false, code, problem: "the promotion code exists but is inactive (switched off, expired or used up)" };
        else {
          const coupon = typeof found.promotion?.coupon === "object" ? found.promotion.coupon : null;
          promo = { set: true, ok: true, code, percentOff: coupon?.percent_off ?? null, amountOff: coupon?.amount_off ?? null };
        }
      } catch (err) {
        promo = { set: true, ok: false, code, problem: ((err as Error).message ?? "lookup failed").slice(0, 160) };
      }
    }
  }

  const stale = Number(env.CRON_STALE_AFTER_HOURS);
  return {
    checkedAt: new Date().toISOString(),
    environment: env.VERCEL_ENV ?? env.NODE_ENV ?? null,
    vars,
    stripe: { mode, prices, promo },
    cron: { staleAfterHours: Number.isFinite(stale) && stale > 0 ? stale : 25 },
  };
}
