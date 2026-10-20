// Phase 132 (docs/GROWTH-PLAN.md): fills billing_events with Stripe history from before the webhook started recording it,
// so the owner HQ shows measured revenue instead of estimates for the past.
//
//   STRIPE_SECRET_KEY=sk_live_… DATABASE_URL=… \
//     pnpm --filter @workspace/api-server hq:backfill-stripe [--apply] [--until 2026-10-19T00:00:00Z]
//
// - READ-ONLY on Stripe (lists paid invoices, refunds and subscriptions; never creates or changes anything there).
// - Without --apply it is a dry run: it counts what it would insert and writes nothing.
// - Idempotent: every row has provider_event_id `bf_inv_<id>`, `bf_ref_<id>`, `bf_sub_<id>` or `bf_subcancel_<id>`, and the
//   insert ignores a row that exists. Run it again any time.
// - It only goes up to --until, which defaults to the oldest webhook-recorded event (so a payment is never counted twice,
//   once from the webhook and once from the backfill). With no webhook events yet, it defaults to now.
// - Limits: Stripe does not keep a history of subscription changes, so upgrades/downgrades before the webhook are not
//   recoverable: each subscription is recorded as started at its current price (and canceled, if it ended). Stripe processing
//   fees are not on invoices, so fee_cents stays 0. Plan names stay empty. Google Play is not part of this.

import Stripe from "stripe";
import pg from "pg";
import { billingRowFromStripeEvent, type BillingRow, type StripeEventLike } from "../src/lib/growth.js";

const apply = process.argv.includes("--apply");
const untilArg = process.argv.indexOf("--until");

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey || !process.env.DATABASE_URL) {
  console.error("STRIPE_SECRET_KEY and DATABASE_URL are required");
  process.exit(2);
}

const stripe = new Stripe(stripeKey);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });

type Loose = Record<string, unknown> & { id: string };
const asEvent = (id: string, type: string, createdSec: number, object: Loose): StripeEventLike => ({ id, type, created: createdSec, data: { object } });

async function untilUnix(): Promise<number> {
  if (untilArg > 0) {
    const ms = Date.parse(process.argv[untilArg + 1] ?? "");
    if (!Number.isFinite(ms)) {
      console.error("--until must be an ISO date, for example 2026-10-19T00:00:00Z");
      process.exit(2);
    }
    return Math.floor(ms / 1000);
  }
  const r = await pool.query<{ first_at: Date | null }>(`select min(at) as first_at from billing_events where provider = 'stripe' and provider_event_id not like 'bf\\_%'`);
  const first = r.rows[0]?.first_at;
  return Math.floor((first ? first.getTime() : Date.now()) / 1000);
}

async function userIdFor(customerId: string | null, cache: Map<string, string | null>): Promise<string | null> {
  if (!customerId) return null;
  if (cache.has(customerId)) return cache.get(customerId)!;
  const r = await pool.query<{ user_id: string }>("select user_id from business_profiles where stripe_customer_id = $1 limit 1", [customerId]);
  const v = r.rows[0]?.user_id ?? null;
  cache.set(customerId, v);
  return v;
}

const counts = { payment: 0, refund: 0, subscription_started: 0, subscription_canceled: 0, inserted: 0, skippedExisting: 0 };

async function save(row: BillingRow, cache: Map<string, string | null>): Promise<void> {
  counts[row.type as "payment" | "refund" | "subscription_started" | "subscription_canceled"] += 1;
  if (!apply) return;
  const userId = await userIdFor(row.customerId, cache);
  const r = await pool.query(
    `insert into billing_events (provider, provider_event_id, type, user_id, customer_id, plan, interval, amount_cents, tax_cents, fee_cents, currency, founding, at, raw)
     values ('stripe', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (provider, provider_event_id) do nothing`,
    [row.providerEventId, row.type, userId, row.customerId, row.plan, row.interval, row.amountCents, row.taxCents, row.feeCents, row.currency, row.founding, row.at, JSON.stringify({ backfill: true })],
  );
  if (r.rowCount) counts.inserted += 1;
  else counts.skippedExisting += 1;
}

async function main(): Promise<void> {
  const until = await untilUnix();
  console.log(`${apply ? "APPLY" : "DRY RUN"}: Stripe history created before ${new Date(until * 1000).toISOString()}`);
  const cache = new Map<string, string | null>();

  for await (const inv of stripe.invoices.list({ status: "paid", limit: 100, created: { lt: until } })) {
    const o = inv as unknown as Loose & { status_transitions?: { paid_at?: number | null }; created: number };
    const row = billingRowFromStripeEvent(asEvent(`bf_inv_${inv.id}`, "invoice.paid", o.status_transitions?.paid_at ?? o.created, o));
    if (row && row.amountCents > 0) await save(row, cache);
  }

  for await (const refund of stripe.refunds.list({ limit: 100, created: { lt: until }, expand: ["data.charge"] })) {
    if (refund.status === "failed" || refund.status === "canceled") continue;
    const charge = refund.charge as unknown as { customer?: string | null } | string | null;
    const customer = charge && typeof charge === "object" && typeof charge.customer === "string" ? charge.customer : null;
    const row = billingRowFromStripeEvent(asEvent(`bf_ref_${refund.id}`, "charge.refunded", refund.created, { id: refund.id, customer, amount_refunded: refund.amount, currency: refund.currency }));
    if (row) await save(row, cache);
  }

  for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, created: { lt: until } })) {
    const o = sub as unknown as Loose & { created: number; canceled_at?: number | null; ended_at?: number | null };
    const items = (o.items as { data?: Array<{ price?: { recurring?: { interval?: string } | null } }> } | undefined)?.data;
    const interval = items?.[0]?.price?.recurring?.interval === "year" ? "year" : "month";
    const started = billingRowFromStripeEvent(asEvent(`bf_sub_${sub.id}`, "customer.subscription.created", o.created, o));
    if (started) await save({ ...started, interval }, cache);
    const endedAt = o.canceled_at ?? o.ended_at ?? null;
    if (sub.status === "canceled" && endedAt && endedAt < until) {
      const ended = billingRowFromStripeEvent(asEvent(`bf_subcancel_${sub.id}`, "customer.subscription.deleted", endedAt, o));
      if (ended) await save({ ...ended, interval }, cache);
    }
  }

  console.log(JSON.stringify(counts, null, 2));
  if (!apply) console.log("Nothing written. Run again with --apply to insert.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
