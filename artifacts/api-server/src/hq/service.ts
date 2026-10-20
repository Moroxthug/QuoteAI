// Owner HQ (Phase 132): the numbers behind /api/admin/hq. SQL does the grouping; this file only assembles.
// Honesty rules (docs/GROWTH-PLAN.md): measured numbers come from billing_events; where a subscriber has no recorded
// events yet the figure is an ESTIMATE at plan list price and `notes` says so. Missing sources are null / "not connected".

import { sql, type SQL } from "drizzle-orm";
import {
  db, billingEventsTable, businessProfilesTable, signupAttributionTable, growthEventsTable, quotesTable, invoicesTable,
  usageDailySummaryTable, marketingSpendTable, ownerExpensesTable, ownerSettingsTable, emailEventsTable, authUsersTable,
} from "@workspace/db";
import { PLANS } from "../routes/payments.js";
import { yearlyPriceFor } from "../lib/billing.js";
import { opsHealth } from "../lib/ops.js";
import { expenseShareExact, type ExpenseLike } from "./expenses.js";
import { buildCohortGrid, monthOf, addMonths, monthsBetween, type CohortCell } from "./cohorts.js";
import { estimatedRevenueExact, listMonthlyCents, moneyTotals, mrrAt, mrrMovements, mrrStateAt, profitCents, runwayMonths, type EstimatedCustomer, type SubEvent } from "./money.js";
import { arpuCents, buildFunnel, buildSources, cacCents, grossMarginPct, ltvCents, paybackMonths } from "./unit.js";
import { TEST_EMAIL_SUFFIX, TEST_USER_PREFIXES } from "./testAccounts.js";
import { addDays, bucketSpan, bucketStarts, torontoDate, torontoDayStart, type Bucket, type HqRange } from "./time.js";

const TZ = sql.raw("'America/Toronto'");

/** True for real companies: not a QA account (id prefix, or an @example.invalid sign-in). NULL ids pass (rows no company owns). `col` is a trusted column expression written in this file. */
const nt = (col: string): SQL => {
  const c = sql.raw(col);
  const prefixes = TEST_USER_PREFIXES.map((p) => sql`${c} not like ${p.replace(/_/g, "\_") + "%"}`);
  return sql`(${c} is null or (${sql.join(prefixes, sql` and `)} and not exists (select 1 from ${authUsersTable} tu where tu.id = ${c} and lower(tu.email) like ${"%" + TEST_EMAIL_SUFFIX})))`;
};
const iso = (d: Date): SQL => sql`${d.toISOString()}::timestamptz`;
const SUB_TYPES = sql`('subscription_started','subscription_changed','subscription_canceled')`;

async function rows<T extends Record<string, unknown>>(query: SQL): Promise<T[]> {
  return (await db.execute<T>(query)).rows as unknown as T[];
}
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

// ── Plan list prices (the same list /admin/margin uses) ───────────────────────

const PLAN_PRICE_CAD: Record<string, number> = Object.fromEntries(PLANS.filter((p) => p.interval === "month" && p.price !== null).map((p) => [p.id, p.price as number]));

export function planMonthlyCents(plan: string | null, interval: string | null): number {
  if (!plan) return 0;
  const price = PLAN_PRICE_CAD[plan];
  if (price === undefined) return 0;
  return listMonthlyCents(price, interval, yearlyPriceFor(price));
}

/** An integer written into the SQL text (not a parameter, so Postgres types the CASE as integer). Only ever fed constants from PLANS. */
const intLiteral = (v: number): SQL => sql.raw(String(Math.trunc(Number.isFinite(v) ? v : 0)));

/** SQL CASE that gives each profile's list-price month in cents (0 for free, unknown and custom plans). Plan ids come from the PLANS constant, never from a request. */
function listPriceCase(planCol: SQL, intervalCol: SQL): SQL {
  const parts: SQL[] = [sql`case ${planCol}`];
  for (const id of Object.keys(PLAN_PRICE_CAD)) {
    parts.push(sql` when ${id} then (case when ${intervalCol} = 'year' then ${intLiteral(planMonthlyCents(id, "year"))} else ${intLiteral(planMonthlyCents(id, "month"))} end)`);
  }
  parts.push(sql` else 0 end`);
  return sql.join(parts, sql``);
}

// ── Shared loaders ────────────────────────────────────────────────────────────

/** Paying subscribers per the profile: active, own subscription (not covered by a group parent), a real plan. */
const profilePaying = sql`(${businessProfilesTable.subscriptionStatus} = 'active' and ${businessProfilesTable.planCoveredBy} is null and coalesce(${businessProfilesTable.subscriptionPlan}, '') not in ('', 'free'))`;

/** True when billing_events knows this profile (by user id or Stripe customer id). */
const hasBillingEvents = sql`exists (select 1 from ${billingEventsTable} be where be.type in ('payment','subscription_started','subscription_changed','subscription_canceled') and (be.user_id = ${businessProfilesTable.userId} or (${businessProfilesTable.stripeCustomerId} is not null and be.customer_id = ${businessProfilesTable.stripeCustomerId})))`;

type EstimatedProfile = EstimatedCustomer & { userId: string; plan: string | null; createdAt: Date };

/** Paying subscribers that billing_events has never seen: the ones we can only estimate. */
async function loadEstimated(): Promise<EstimatedProfile[]> {
  const r = await rows<{ user_id: string; plan: string | null; interval: string | null; created_at: Date }>(sql`
    select ${businessProfilesTable.userId} as user_id, ${businessProfilesTable.subscriptionPlan} as plan, ${businessProfilesTable.subscriptionInterval} as interval, ${businessProfilesTable.createdAt} as created_at
    from ${businessProfilesTable}
    where ${profilePaying} and not ${hasBillingEvents} and ${nt('"business_profiles"."user_id"')}`);
  return r.map((x) => ({ userId: x.user_id, plan: x.plan, createdAt: new Date(x.created_at), sinceYmd: torontoDate(new Date(x.created_at)), monthlyCents: planMonthlyCents(x.plan, x.interval) }));
}

type EventKey = { events: SubEvent[]; userIdOf: Map<string, string | null> };

/** Every subscription row before `before`, keyed by the company (user id, else Stripe customer id). Few rows: one per subscription change. */
async function loadSubEvents(before: Date): Promise<EventKey> {
  const r = await rows<{ key: string; uid: string | null; type: SubEvent["type"]; amount_cents: string; at: Date }>(sql`
    select coalesce(be.user_id, bp.user_id, be.customer_id, be.id::text) as key, coalesce(be.user_id, bp.user_id) as uid, be.type, be.amount_cents, be."at"
    from ${billingEventsTable} be
    left join ${businessProfilesTable} bp on be.user_id is null and be.customer_id is not null and bp.stripe_customer_id = be.customer_id
    where be.type in ${SUB_TYPES} and be."at" < ${iso(before)} and ${nt('coalesce(be.user_id, bp.user_id)')}
    order by be."at"`);
  const userIdOf = new Map<string, string | null>();
  const events = r.map((x) => {
    userIdOf.set(x.key, x.uid);
    return { key: x.key, type: x.type, amountCents: n(x.amount_cents), at: new Date(x.at) };
  });
  return { events, userIdOf };
}

const USAGE_GROUP: Record<string, "ai" | "messaging" | "email" | "storage"> = {
  ai_text: "ai", ai_vision: "ai", voice_seconds: "ai", whatsapp_message: "messaging", sms: "messaging", email: "email", storage_bytes: "storage",
};

type CostBlock = { ai: number; messaging: number; email: number; storage: number; infra: number; other: number };
const emptyCosts = (): CostBlock => ({ ai: 0, messaging: 0, email: 0, storage: 0, infra: 0, other: 0 });

type ExpenseRow = ExpenseLike & { id: string; name: string; category: string };

async function loadExpensesOverlapping(from: string, to: string): Promise<ExpenseRow[]> {
  const r = await rows<{ id: string; name: string; category: string; amount_cents: string; cadence: ExpenseLike["cadence"]; starts_on: string; ends_on: string | null }>(sql`
    select id, name, category, amount_cents, cadence, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on
    from ${ownerExpensesTable}
    where starts_on <= ${to}::date and (ends_on is null or ends_on >= ${from}::date)`);
  return r.map((x) => ({ id: x.id, name: x.name, category: x.category, amountCents: n(x.amount_cents), cadence: x.cadence, startsOn: x.starts_on, endsOn: x.ends_on }));
}

/** Where an owner expense lands in the P&L. Income-tax / CRA remittances are not an operating cost, so they are left out. */
function expenseBucket(category: string): keyof CostBlock | "fees" | "excluded" {
  switch (category) {
    case "infrastructure": return "infra";
    case "ai": return "ai";
    case "messaging": return "messaging";
    case "email": return "email";
    case "payment_fees": return "fees";
    case "tax": return "excluded";
    default: return "other";
  }
}

function expenseTotals(list: ExpenseRow[], from: string, to: string): { costs: CostBlock; feesCents: number; excludedTaxCents: number } {
  const exact = { ai: 0, messaging: 0, email: 0, storage: 0, infra: 0, other: 0, fees: 0, excluded: 0 };
  for (const e of list) exact[expenseBucket(e.category)] += expenseShareExact(e, from, to);
  return {
    costs: { ai: Math.round(exact.ai), messaging: Math.round(exact.messaging), email: Math.round(exact.email), storage: 0, infra: Math.round(exact.infra), other: Math.round(exact.other) },
    feesCents: Math.round(exact.fees),
    excludedTaxCents: Math.round(exact.excluded),
  };
}

async function loadUsageCosts(from: string, to: string): Promise<{ ai: number; messaging: number; email: number; storage: number }> {
  const r = await rows<{ kind: string; cost: string }>(sql`
    select kind, coalesce(sum(cost_cents), 0) as cost from ${usageDailySummaryTable}
    where "date" >= ${from} and "date" <= ${to} and ${nt('user_id')} group by kind`);
  const out = { ai: 0, messaging: 0, email: 0, storage: 0 };
  for (const x of r) {
    const g = USAGE_GROUP[x.kind];
    if (g) out[g] += n(x.cost);
  }
  return { ai: Math.round(out.ai), messaging: Math.round(out.messaging), email: Math.round(out.email), storage: Math.round(out.storage) };
}

export async function readCashCents(): Promise<{ cashCents: number | null; updatedAt: string | null }> {
  const r = await rows<{ value: unknown; updated_at: Date }>(sql`select value, updated_at from ${ownerSettingsTable} where key = 'cash_cents'`);
  const v = r[0]?.value;
  return { cashCents: typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null, updatedAt: r[0] ? new Date(r[0].updated_at).toISOString() : null };
}

export async function writeCashCents(cashCents: number | null): Promise<{ cashCents: number | null; updatedAt: string | null }> {
  if (cashCents === null) {
    await db.execute(sql`delete from ${ownerSettingsTable} where key = 'cash_cents'`);
    return { cashCents: null, updatedAt: null };
  }
  await db.execute(sql`
    insert into ${ownerSettingsTable} (key, value, updated_at) values ('cash_cents', ${JSON.stringify(cashCents)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`);
  return readCashCents();
}

// ── Overview ──────────────────────────────────────────────────────────────────

export async function overview(range: HqRange) {
  const now = new Date();
  const notes: string[] = [];
  const { from, to, startAt, endAt } = range;

  const [
    moneyRows, usage, expenses, spendRows, estimated, sub, cash, custRow, foundingRow, funnelRow, visitsRow, sourceRows, sourceRev, productRow, activeRow, bounceRow, ops, excludedRow, firstBilling,
  ] = await Promise.all([
    rows<{ type: "payment" | "refund" | "dispute"; amount: string; tax: string; fee: string }>(sql`
      select type, coalesce(sum(amount_cents), 0) as amount, coalesce(sum(tax_cents), 0) as tax, coalesce(sum(fee_cents), 0) as fee
      from ${billingEventsTable} where type in ('payment','refund','dispute') and "at" >= ${iso(startAt)} and "at" < ${iso(endAt)} and ${nt('user_id')} group by type`),
    loadUsageCosts(from, to),
    loadExpensesOverlapping(from, to),
    rows<{ channel: string; spent: string }>(sql`
      select lower(trim(channel)) as channel, coalesce(sum(amount_cents), 0) as spent from ${marketingSpendTable}
      where spent_on >= ${from}::date and spent_on <= ${to}::date group by 1`),
    loadEstimated(),
    loadSubEvents(endAt),
    readCashCents(),
    rows<{ total: string; paying: string; trialing: string; new_in_range: string }>(sql`
      select count(*) as total,
        count(*) filter (where ${profilePaying}) as paying,
        count(*) filter (where ${businessProfilesTable.subscriptionStatus} = 'trialing') as trialing,
        count(*) filter (where ${businessProfilesTable.createdAt} >= ${iso(startAt)} and ${businessProfilesTable.createdAt} < ${iso(endAt)}) as new_in_range
      from ${businessProfilesTable} where ${nt('"business_profiles"."user_id"')}`),
    rows<{ founding: string }>(sql`
      select count(distinct bp.user_id) as founding from ${billingEventsTable} be
      join ${businessProfilesTable} bp on bp.user_id = be.user_id or (be.user_id is null and bp.stripe_customer_id = be.customer_id)
      where be.founding = 1 and bp.subscription_status = 'active' and ${nt('bp.user_id')}`),
    rows<{ signups: string; created_quote: string; sent_quote: string; accepted: string; paying: string }>(sql`
      select count(*) as signups,
        count(*) filter (where exists (select 1 from ${quotesTable} q where q.user_id = ${businessProfilesTable.userId})) as created_quote,
        count(*) filter (where exists (select 1 from ${quotesTable} q where q.user_id = ${businessProfilesTable.userId} and q.sent_at is not null)) as sent_quote,
        count(*) filter (where exists (select 1 from ${quotesTable} q where q.user_id = ${businessProfilesTable.userId} and q.accepted_at is not null)) as accepted,
        count(*) filter (where ${profilePaying} or exists (select 1 from ${billingEventsTable} be where be.type = 'payment' and (be.user_id = ${businessProfilesTable.userId} or (${businessProfilesTable.stripeCustomerId} is not null and be.customer_id = ${businessProfilesTable.stripeCustomerId})))) as paying
      from ${businessProfilesTable}
      where ${businessProfilesTable.createdAt} >= ${iso(startAt)} and ${businessProfilesTable.createdAt} < ${iso(endAt)} and ${nt('"business_profiles"."user_id"')}`),
    rows<{ visits: string }>(sql`
      select count(distinct coalesce(anon_id, user_id)) as visits from ${growthEventsTable}
      where event = 'landing_view' and "at" >= ${iso(startAt)} and "at" < ${iso(endAt)} and ${nt('user_id')}`),
    rows<{ source: string; signups: string; paying: string }>(sql`
      select coalesce(sa.source, 'unknown') as source, count(*) as signups,
        count(*) filter (where ${profilePaying} or exists (select 1 from ${billingEventsTable} be where be.type = 'payment' and (be.user_id = ${businessProfilesTable.userId} or (${businessProfilesTable.stripeCustomerId} is not null and be.customer_id = ${businessProfilesTable.stripeCustomerId})))) as paying
      from ${businessProfilesTable} left join ${signupAttributionTable} sa on sa.user_id = ${businessProfilesTable.userId}
      where ${businessProfilesTable.createdAt} >= ${iso(startAt)} and ${businessProfilesTable.createdAt} < ${iso(endAt)} and ${nt('"business_profiles"."user_id"')} group by 1`),
    rows<{ source: string; revenue: string }>(sql`
      select coalesce(sa.source, 'unknown') as source,
        coalesce(sum(case when be.type = 'payment' then be.amount_cents - be.tax_cents when be.type = 'refund' then -be.amount_cents else 0 end), 0) as revenue
      from ${billingEventsTable} be
      left join ${businessProfilesTable} bp on bp.user_id = be.user_id or (be.user_id is null and bp.stripe_customer_id = be.customer_id)
      left join ${signupAttributionTable} sa on sa.user_id = bp.user_id
      where be.type in ('payment','refund') and be."at" >= ${iso(startAt)} and be."at" < ${iso(endAt)} and ${nt('coalesce(be.user_id, bp.user_id)')} group by 1`),
    rows<{ created: string; sent: string; accepted: string }>(sql`
      select count(*) filter (where created_at >= ${iso(startAt)} and created_at < ${iso(endAt)}) as created,
        count(*) filter (where sent_at >= ${iso(startAt)} and sent_at < ${iso(endAt)}) as sent,
        count(*) filter (where accepted_at >= ${iso(startAt)} and accepted_at < ${iso(endAt)}) as accepted
      from ${quotesTable}
      where ${nt('user_id')} and ((created_at >= ${iso(startAt)} and created_at < ${iso(endAt)}) or (sent_at >= ${iso(startAt)} and sent_at < ${iso(endAt)}) or (accepted_at >= ${iso(startAt)} and accepted_at < ${iso(endAt)}))`),
    rows<{ wau: string; mau: string }>(sql`
      select count(distinct user_id) filter (where d >= ${iso(new Date(endAt.getTime() - 7 * 86_400_000))}) as wau, count(distinct user_id) as mau
      from (
        select user_id, created_at as d from ${quotesTable} where created_at >= ${iso(new Date(endAt.getTime() - 30 * 86_400_000))} and created_at < ${iso(endAt)}
        union all select user_id, created_at from ${invoicesTable} where created_at >= ${iso(new Date(endAt.getTime() - 30 * 86_400_000))} and created_at < ${iso(endAt)}
        union all select user_id, "at" from ${growthEventsTable} where user_id is not null and "at" >= ${iso(new Date(endAt.getTime() - 30 * 86_400_000))} and "at" < ${iso(endAt)}
      ) x where ${nt('user_id')}`),
    rows<{ bounced: string; total: string }>(sql`
      select count(*) filter (where type = 'email.bounced') as bounced,
        count(*) filter (where type in ('email.delivered','email.bounced','email.complained')) as total
      from ${emailEventsTable} where created_at >= ${iso(startAt)} and created_at < ${iso(endAt)}`),
    opsHealth().catch(() => null),
    rows<{ excluded: string }>(sql`select count(*) as excluded from ${businessProfilesTable} where not ${nt('"business_profiles"."user_id"')}`),
    rows<{ first_at: Date | null }>(sql`select min("at") as first_at from ${billingEventsTable}`),
  ]);

  // Money
  const t = moneyTotals(moneyRows.map((r) => ({ type: r.type, amountCents: n(r.amount), taxCents: n(r.tax), feeCents: n(r.fee) })));
  const estimatedInRange = estimated.filter((e) => e.sinceYmd <= to);
  const estRevenue = Math.round(estimatedRevenueExact(estimatedInRange, from, to));
  const revenueCents = t.revenueCents + estRevenue;
  const exp = expenseTotals(expenses, from, to);
  const costsCents: CostBlock = {
    ai: usage.ai + exp.costs.ai, messaging: usage.messaging + exp.costs.messaging, email: usage.email + exp.costs.email,
    storage: usage.storage + exp.costs.storage, infra: exp.costs.infra, other: exp.costs.other,
  };
  const costsTotal = Object.values(costsCents).reduce((a, b) => a + b, 0);
  const feesCents = t.feesCents + exp.feesCents;
  const marketingSpendCents = spendRows.reduce((a, r) => a + n(r.spent), 0);
  const profit = profitCents({ revenueCents, refundsCents: t.refundsCents, feesCents, costsCents: costsTotal, marketingSpendCents });

  // MRR
  const mrrMeasured = mrrAt(sub.events, endAt);
  const estimatedAtEnd = estimated.filter((e) => torontoDayStart(e.sinceYmd).getTime() < endAt.getTime());
  const mrrEstimated = estimatedAtEnd.reduce((a, e) => a + e.monthlyCents, 0);
  const mrrCents = mrrMeasured + mrrEstimated;
  const mv = mrrMovements(sub.events, startAt, endAt);
  const state = mrrStateAt(sub.events, endAt);
  const measuredPayers = [...state.values()].filter((v) => v > 0).length;
  const payersWithAmount = measuredPayers + estimatedAtEnd.filter((e) => e.monthlyCents > 0).length;

  // Customers
  const c = custRow[0];
  const total = n(c?.total);
  const paying = n(c?.paying);
  const trialing = n(c?.trialing);

  // Funnel
  const f = funnelRow[0];
  const visits = n(visitsRow[0]?.visits);
  const funnel = buildFunnel([
    { stage: "visits", count: visits },
    { stage: "signups", count: n(f?.signups) },
    { stage: "first_quote", count: n(f?.created_quote) },
    { stage: "quote_sent", count: n(f?.sent_quote) },
    { stage: "quote_accepted", count: n(f?.accepted) },
    { stage: "paying", count: n(f?.paying), rateOf: "signups" },
  ]);

  // Sources (acquisition)
  const revBySource = new Map(sourceRev.map((r) => [r.source, n(r.revenue)]));
  const spendBySource = new Map(spendRows.map((r) => [r.channel, n(r.spent)]));
  const names = new Set<string>([...sourceRows.map((r) => r.source), ...spendBySource.keys(), ...revBySource.keys()]);
  const sources = buildSources([...names].map((source) => {
    const s = sourceRows.find((r) => r.source === source);
    return { source, signups: n(s?.signups), paying: n(s?.paying), revenueCents: revBySource.get(source) ?? 0, spendCents: spendBySource.get(source) ?? 0 };
  }));

  // Unit economics
  const arpu = arpuCents(mrrCents, payersWithAmount);
  const cogs = usage.ai + usage.messaging + usage.email + usage.storage + feesCents;
  const margin = grossMarginPct(revenueCents, cogs);
  const measuredAtStart = [...mrrStateAt(sub.events, startAt).values()].filter((v) => v > 0).length;
  const ltv = ltvCents({ arpuCents: arpu, grossMarginPct: margin, churnedCustomers: mv.churnedCustomers, payingAtStart: measuredAtStart, days: range.days });
  const newPaying = mv.newCustomers + estimated.filter((e) => e.sinceYmd >= from && e.sinceYmd <= to).length;
  const payback = paybackMonths(cacCents(marketingSpendCents, newPaying), arpu, margin);

  // Product, ops
  const p = productRow[0];
  const a = activeRow[0];
  const bounceTotal = n(bounceRow[0]?.total);
  const opsBlock = {
    cronOk: ops ? !ops.cron.stale && ops.cron.lastError === null : null,
    deadRuns: ops ? ops.automations.dead : null,
    emailBounceRate: bounceTotal > 0 ? Math.round((n(bounceRow[0]?.bounced) / bounceTotal) * 10000) / 10000 : null,
  };

  // Notes: say what is estimated, missing or excluded.
  notes.push("Revenue and profit are shown without sales tax. GST/HST collected is owed to the CRA and is reported separately as taxCollectedCents.");
  const excluded = n(excludedRow[0]?.excluded);
  if (excluded > 0) notes.push(`${excluded} test account(s) (QA ids and @example.invalid sign-ins) are excluded from every HQ number.`);
  notes.push("Google Play revenue and fees are not connected yet: only Stripe payments are counted.");
  if (estimatedAtEnd.length > 0 || estRevenue > 0) {
    const withPrice = estimatedAtEnd.filter((e) => e.monthlyCents > 0).length;
    notes.push(`Estimated, not measured: ${estimatedAtEnd.length} paying subscriber(s) have no recorded Stripe events yet (billing events only started recently), so ${withPrice} of them count in MRR and revenue at the plan list price (${(mrrEstimated / 100).toFixed(2)} CAD/month in MRR, ${(estRevenue / 100).toFixed(2)} CAD in revenue for this period).`);
    notes.push("New, expansion and churned MRR come only from recorded subscription events; estimated subscribers are not in them.");
    const unpriced = estimatedAtEnd.filter((e) => e.monthlyCents === 0).length;
    if (unpriced > 0) notes.push(`${unpriced} Elite/custom customer(s) are not in MRR: their price is set per customer.`);
  }
  const anyBilling = firstBilling[0]?.first_at ? new Date(firstBilling[0].first_at) : null;
  if (!anyBilling) notes.push("No billing events are recorded yet, so all money figures are estimates until Stripe events (or hq:backfill-stripe) fill the ledger.");
  else if (anyBilling.getTime() > startAt.getTime()) notes.push(`Billing events start on ${torontoDate(anyBilling)}; anything earlier in this period is estimated or missing.`);
  if (t.feesCents === 0 && t.grossCents > 0) notes.push("Stripe processing fees are not recorded on the payments yet, so fees show only the fees you entered as expenses (0 means unknown, not free).");
  if (t.refundsCents > 0) notes.push("Refunds are deducted in full (including any tax they returned): the refund record has no tax split, so profit may be slightly understated.");
  if (t.disputesCents > 0) notes.push(`Open disputes totalling ${(t.disputesCents / 100).toFixed(2)} CAD are not deducted until they are lost.`);
  notes.push("AI, messaging, email and storage costs come from usage metering, which records US cents; they are not converted to CAD.");
  if (exp.excludedTaxCents > 0) notes.push("Expenses in the 'tax' category (remittances to the CRA) are left out of costs and profit.");
  if (cash.cashCents === null) notes.push("Cash in the bank is not set, so cash and runway are unknown. Enter it in HQ settings.");
  else if (runwayMonths(cash.cashCents, profit, range.days) === null) notes.push("Runway is not shown: this period did not burn cash (or cash is zero).");
  if (ltv === null) notes.push(`LTV is not shown until there are at least 10 recorded paying customers at the start of a period of 28+ days and some churn (now ${measuredAtStart} recorded, ${mv.churnedCustomers} churned).`);
  notes.push("Funnel: the stages after signups count companies that signed up in this period; paying is a share of signups, not of accepted quotes. Rates are capped at 100%.");
  if (visits === 0) notes.push("No landing-page visits are recorded in this period, so the funnel starts at signups in practice.");
  else if (visits < n(f?.signups)) notes.push("Visit tracking recorded fewer visitors than signups (tracking is new or blocked), so the visits-to-signup rate is not reliable.");
  if (sources.some((s) => s.source === "unknown")) notes.push("Signups listed as 'unknown' have no recorded source (they signed up before attribution existed).");
  if (!ops) notes.push("Ops health could not be read.");
  notes.push("Weekly/monthly active users count a company as active when it created a quote or invoice or sent an app event in the window ending at the period's end.");

  const costBlock: CostBlock = costsCents;
  return {
    range: { from, to },
    money: {
      mrrCents, arrCents: mrrCents * 12,
      newMrrCents: mv.newCents, expansionMrrCents: mv.expansionCents, churnedMrrCents: mv.churnedCents,
      contractionMrrCents: mv.contractionCents,
      revenueCents, refundsCents: t.refundsCents, taxCollectedCents: t.taxCollectedCents, feesCents,
      costsCents: costBlock, marketingSpendCents, profitCents: profit,
      cashCents: cash.cashCents, runwayMonths: runwayMonths(cash.cashCents, profit, range.days),
    },
    customers: {
      total, paying, trialing, free: Math.max(0, total - paying - trialing), newInRange: n(c?.new_in_range),
      churnedInRange: mv.churnedCustomers, foundingCount: n(foundingRow[0]?.founding),
    },
    funnel, sources,
    unit: { arpuCents: arpu, ltvCents: ltv, paybackMonths: payback, grossMarginPct: margin },
    product: { quotesCreated: n(p?.created), quotesSent: n(p?.sent), quotesAccepted: n(p?.accepted), wau: n(a?.wau), mau: n(a?.mau) },
    ops: opsBlock,
    notes,
  };
}

// ── Series ────────────────────────────────────────────────────────────────────

export const SERIES_METRICS = ["mrr", "signups", "revenue", "costs", "profit", "quotes"] as const;
export type SeriesMetric = (typeof SERIES_METRICS)[number];

const bucketSql = (bucket: Bucket): SQL => sql.raw(`'${bucket}'`);

async function countSeries(table: "business_profiles" | "quotes", range: HqRange, bucket: Bucket): Promise<Map<string, number>> {
  const t = table === "quotes" ? quotesTable : businessProfilesTable;
  const r = await rows<{ b: string; c: string }>(sql`
    select to_char(date_trunc(${bucketSql(bucket)}, ${t.createdAt} at time zone ${TZ}), 'YYYY-MM-DD') as b, count(*) as c
    from ${t} where ${t.createdAt} >= ${iso(range.startAt)} and ${t.createdAt} < ${iso(range.endAt)} and ${nt('user_id')} group by 1`);
  return new Map(r.map((x) => [x.b, n(x.c)]));
}

export async function series(metric: SeriesMetric, bucket: Bucket, range: HqRange): Promise<Array<{ at: string; value: number }>> {
  const starts = bucketStarts(range.from, range.to, bucket);
  const out = (m: (start: string) => number) => starts.map((at) => ({ at, value: m(at) }));

  if (metric === "signups" || metric === "quotes") {
    const m = await countSeries(metric === "signups" ? "business_profiles" : "quotes", range, bucket);
    return out((s) => m.get(s) ?? 0);
  }

  if (metric === "mrr") {
    const [sub, estimated] = await Promise.all([loadSubEvents(range.endAt), loadEstimated()]);
    return out((s) => {
      const span = bucketSpan(s, bucket, range.from, range.to);
      const at = torontoDayStart(addDays(span.end, 1)); // end of the bucket's last day
      return mrrAt(sub.events, at) + estimated.filter((e) => torontoDayStart(e.sinceYmd).getTime() < at.getTime()).reduce((a, e) => a + e.monthlyCents, 0);
    });
  }

  // revenue / costs / profit share one pass
  const [money, usage, spend, expenses, estimated] = await Promise.all([
    rows<{ b: string; revenue: string; refunds: string; fees: string }>(sql`
      select to_char(date_trunc(${bucketSql(bucket)}, "at" at time zone ${TZ}), 'YYYY-MM-DD') as b,
        coalesce(sum(case when type = 'payment' then amount_cents - tax_cents else 0 end), 0) as revenue,
        coalesce(sum(case when type = 'refund' then amount_cents else 0 end), 0) as refunds,
        coalesce(sum(fee_cents), 0) as fees
      from ${billingEventsTable} where type in ('payment','refund','dispute') and "at" >= ${iso(range.startAt)} and "at" < ${iso(range.endAt)} and ${nt('user_id')} group by 1`),
    rows<{ b: string; cost: string }>(sql`
      select to_char(date_trunc(${bucketSql(bucket)}, "date"::date::timestamp), 'YYYY-MM-DD') as b, coalesce(sum(cost_cents), 0) as cost
      from ${usageDailySummaryTable} where "date" >= ${range.from} and "date" <= ${range.to} and ${nt('user_id')} group by 1`),
    rows<{ b: string; spent: string }>(sql`
      select to_char(date_trunc(${bucketSql(bucket)}, spent_on::timestamp), 'YYYY-MM-DD') as b, coalesce(sum(amount_cents), 0) as spent
      from ${marketingSpendTable} where spent_on >= ${range.from}::date and spent_on <= ${range.to}::date group by 1`),
    loadExpensesOverlapping(range.from, range.to),
    loadEstimated(),
  ]);
  const mm = new Map(money.map((x) => [x.b, x]));
  const um = new Map(usage.map((x) => [x.b, n(x.cost)]));
  const sm = new Map(spend.map((x) => [x.b, n(x.spent)]));

  const perBucket = (s: string) => {
    const span = bucketSpan(s, bucket, range.from, range.to);
    const m = mm.get(s);
    const exp = expenseTotals(expenses, span.start, span.end);
    const costs = n(um.get(s)) + exp.costs.ai + exp.costs.messaging + exp.costs.email + exp.costs.infra + exp.costs.other;
    const revenue = n(m?.revenue) + Math.round(estimatedRevenueExact(estimated, span.start, span.end));
    const profit = profitCents({ revenueCents: revenue, refundsCents: n(m?.refunds), feesCents: n(m?.fees) + exp.feesCents, costsCents: costs, marketingSpendCents: n(sm.get(s)) });
    return { revenue, costs, profit };
  };
  return out((s) => perBucket(s)[metric]);
}

// ── Cohorts ───────────────────────────────────────────────────────────────────

export async function cohorts(months: number) {
  const now = new Date();
  const currentMonth = monthOf(torontoDate(now));
  const firstMonth = addMonths(currentMonth, -(months - 1));
  const firstAt = torontoDayStart(`${firstMonth}-01`);

  const [signupRows, activeRows, sub, estimated, firstBilling] = await Promise.all([
    rows<{ month: string; c: string }>(sql`
      select to_char(created_at at time zone ${TZ}, 'YYYY-MM') as month, count(*) as c from ${businessProfilesTable}
      where created_at >= ${iso(firstAt)} and ${nt('user_id')} group by 1`),
    rows<{ cohort: string; mo: number; users: string }>(sql`
      with c as (select user_id, created_at at time zone ${TZ} as lc from ${businessProfilesTable} where created_at >= ${iso(firstAt)} and ${nt('user_id')}),
           ql as (select user_id, created_at at time zone ${TZ} as m from ${quotesTable} where created_at >= ${iso(firstAt)} and ${nt('user_id')})
      select to_char(c.lc, 'YYYY-MM') as cohort,
        ((extract(year from ql.m) * 12 + extract(month from ql.m)) - (extract(year from c.lc) * 12 + extract(month from c.lc)))::int as mo,
        count(distinct c.user_id) as users
      from c join ql on ql.user_id = c.user_id group by 1, 2`),
    loadSubEvents(now),
    loadEstimated(),
    rows<{ first_at: Date | null }>(sql`select min("at") as first_at from ${billingEventsTable}`),
  ]);

  const maxOffset = months - 1;
  const activeCells: CohortCell[] = activeRows.filter((r) => r.mo >= 0 && r.mo <= maxOffset).map((r) => ({ cohort: r.cohort, offset: r.mo, users: n(r.users) }));

  // Paying: replay each recorded company's subscription state at the end of every month since signup.
  const userKeys = new Map<string, string>(); // user id -> event key
  for (const [key, uid] of sub.userIdOf) if (uid) userKeys.set(uid, key);
  const payingCount = new Map<string, number>();
  const bump = (cohort: string, offset: number) => payingCount.set(`${cohort}|${offset}`, (payingCount.get(`${cohort}|${offset}`) ?? 0) + 1);
  if (userKeys.size > 0) {
    const ids = [...userKeys.keys()];
    const profiles = await rows<{ user_id: string; month: string }>(sql`
      select user_id, to_char(created_at at time zone ${TZ}, 'YYYY-MM') as month from ${businessProfilesTable}
      where created_at >= ${iso(firstAt)} and user_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
    const eventsByKey = new Map<string, SubEvent[]>();
    for (const e of sub.events) {
      const arr = eventsByKey.get(e.key) ?? [];
      arr.push(e);
      eventsByKey.set(e.key, arr);
    }
    for (const pr of profiles) {
      const evs = eventsByKey.get(userKeys.get(pr.user_id)!) ?? [];
      const elapsed = Math.min(maxOffset, monthsBetween(pr.month, currentMonth));
      for (let k = 0; k <= elapsed; k++) {
        const endOfMonth = torontoDayStart(`${addMonths(pr.month, k + 1)}-01`);
        const at = endOfMonth.getTime() > now.getTime() ? new Date(now.getTime() + 1) : endOfMonth;
        const st = mrrStateAt(evs, at);
        if ([...st.values()].some((v) => v > 0)) bump(pr.month, k);
      }
    }
  }
  // Subscribers with no recorded events: the profile says they pay today, so they count in the current month only.
  if (estimated.length > 0) {
    const ids = estimated.map((e) => e.userId);
    const profiles = await rows<{ month: string }>(sql`
      select to_char(created_at at time zone ${TZ}, 'YYYY-MM') as month from ${businessProfilesTable}
      where created_at >= ${iso(firstAt)} and user_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
    for (const pr of profiles) {
      const k = monthsBetween(pr.month, currentMonth);
      if (k >= 0 && k <= maxOffset) bump(pr.month, k);
    }
  }
  const payingCells: CohortCell[] = [...payingCount].map(([key, users]) => {
    const [cohort, offset] = key.split("|");
    return { cohort, offset: Number(offset), users };
  });

  const coverage = firstBilling[0]?.first_at ? monthOf(torontoDate(new Date(firstBilling[0].first_at))) : null;
  const grid = buildCohortGrid({
    signups: signupRows.map((r) => ({ month: r.month, signups: n(r.c) })),
    activeCells, payingCells, currentMonth, payingCoverageFrom: coverage, maxOffset,
  });
  const notes = [
    "Active = the company created at least one quote in that month. Paying = it had a recorded paid subscription at the end of that month.",
    coverage
      ? `Paying history is only known from ${coverage} (when billing events started); earlier months show no value rather than a false zero.`
      : "No billing events are recorded yet: only the current month shows a paying share, taken from today's subscription status (estimated).",
    "Subscribers without recorded billing events count as paying in the current month only.",
  ];
  return { months, cohorts: grid, notes };
}

// ── Customers ─────────────────────────────────────────────────────────────────

export const CUSTOMER_SORTS = ["since", "company", "plan", "revenue", "aiCost", "margin"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type CustomerRow = {
  userId: string; companyName: string; email: string | null; plan: string | null; status: string | null; interval: string | null;
  since: string; source: string; founding: boolean;
  /** This month so far (Toronto), ex tax. Measured payments minus refunds; when the company has no billing events yet, its plan's list price instead (see `estimated`). */
  mtdRevenueCents: number; estimated: boolean;
  aiCostCents: number; costCents: number; marginCents: number; lastActiveAt: string | null;
};

const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function customers(opts: { sort: CustomerSort; dir: "asc" | "desc"; q: string | null; limit: number; offset: number }) {
  const today = torontoDate(new Date());
  const monthStartYmd = `${today.slice(0, 7)}-01`;
  const monthStart = torontoDayStart(monthStartYmd);
  const nextMonth = torontoDayStart(`${addMonths(today.slice(0, 7), 1)}-01`);
  const bp = businessProfilesTable;

  const priceCase = listPriceCase(sql`${bp.subscriptionPlan}`, sql`${bp.subscriptionInterval}`);
  const needle = opts.q ? `%${likeEscape(opts.q.slice(0, 80))}%` : null;
  const where = needle
    ? sql`where ${nt('"business_profiles"."user_id"')} and (${bp.companyName} ilike ${needle} escape '\\' or au.email ilike ${needle} escape '\\' or ${bp.userId} = ${opts.q})`
    : sql`where ${nt('"business_profiles"."user_id"')}`;

  const mtdRevExpr = sql`(case when ${hasBillingEvents} then coalesce(mrev.rev, 0) when ${profilePaying} then ${priceCase} else 0 end)`;
  const orderCol: Record<CustomerSort, SQL> = {
    since: sql`${bp.createdAt}`, company: sql`lower(${bp.companyName})`, plan: sql`${bp.subscriptionPlan}`,
    revenue: mtdRevExpr, aiCost: sql`coalesce(mcost.ai, 0)`, margin: sql`(${mtdRevExpr} - coalesce(mcost.total, 0))`,
  };
  const order = sql`order by ${orderCol[opts.sort]} ${sql.raw(opts.dir === "asc" ? "asc" : "desc")} nulls last, ${bp.userId}`;

  const base = sql`
    from ${bp}
    left join ${authUsersTable} au on au.id = ${bp.userId}
    left join ${signupAttributionTable} sa on sa.user_id = ${bp.userId}
    left join (
      select coalesce(be.user_id, bp2.user_id) as uid,
        sum(case when be.type = 'payment' then be.amount_cents - be.tax_cents when be.type = 'refund' then -be.amount_cents else 0 end) as rev
      from ${billingEventsTable} be left join ${bp} bp2 on be.user_id is null and bp2.stripe_customer_id = be.customer_id
      where be.type in ('payment','refund') and be."at" >= ${iso(monthStart)} and be."at" < ${iso(nextMonth)} group by 1
    ) mrev on mrev.uid = ${bp.userId}
    left join (
      select user_id, sum(cost_cents) as total, sum(cost_cents) filter (where kind in ('ai_text','ai_vision','voice_seconds')) as ai
      from ${usageDailySummaryTable} where "date" >= ${monthStartYmd} and "date" <= ${today} group by user_id
    ) mcost on mcost.user_id = ${bp.userId}
    ${where}`;

  const [list, totalRow] = await Promise.all([
    rows<{
      user_id: string; company_name: string; email: string | null; plan: string | null; status: string | null; interval: string | null; created_at: Date; source: string | null;
      founding: boolean; has_events: boolean; paying: boolean; list_cents: string; mtd_revenue: string; ai_cost: string; total_cost: string;
    }>(sql`
      select ${bp.userId} as user_id, ${bp.companyName} as company_name, au.email as email, ${bp.subscriptionPlan} as plan, ${bp.subscriptionStatus} as status,
        ${bp.subscriptionInterval} as interval, ${bp.createdAt} as created_at, sa.source as source,
        exists (select 1 from ${billingEventsTable} bf where bf.founding = 1 and (bf.user_id = ${bp.userId} or (${bp.stripeCustomerId} is not null and bf.customer_id = ${bp.stripeCustomerId}))) as founding,
        ${hasBillingEvents} as has_events, ${profilePaying} as paying, ${priceCase} as list_cents,
        ${mtdRevExpr} as mtd_revenue,
        coalesce(mcost.ai, 0) as ai_cost, coalesce(mcost.total, 0) as total_cost
      ${base} ${order} limit ${opts.limit} offset ${opts.offset}`),
    rows<{ c: string }>(sql`select count(*) as c ${base}`),
  ]);

  // Last activity only for the page: the newest quote, invoice or app event.
  const ids = list.map((r) => r.user_id);
  const active = ids.length
    ? await rows<{ user_id: string; last_active: Date }>(sql`
        select user_id, max(d) as last_active from (
          select user_id, max(created_at) as d from ${quotesTable} where user_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) group by user_id
          union all select user_id, max(created_at) from ${invoicesTable} where user_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) group by user_id
          union all select user_id, max("at") from ${growthEventsTable} where user_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) group by user_id
        ) z group by user_id`)
    : [];
  const lastActive = new Map(active.map((a) => [a.user_id, new Date(a.last_active).toISOString()]));

  const result: CustomerRow[] = list.map((r) => {
    const revenue = n(r.mtd_revenue);
    const cost = Math.round(n(r.total_cost));
    return {
      userId: r.user_id, companyName: r.company_name, email: r.email, plan: r.plan, status: r.status, interval: r.interval,
      since: torontoDate(new Date(r.created_at)), source: r.source ?? "unknown", founding: !!r.founding,
      mtdRevenueCents: revenue, estimated: !r.has_events && !!r.paying,
      aiCostCents: Math.round(n(r.ai_cost)), costCents: cost, marginCents: revenue - cost, lastActiveAt: lastActive.get(r.user_id) ?? null,
    };
  });
  return {
    customers: result, total: n(totalRow[0]?.c), limit: opts.limit, offset: opts.offset,
    month: monthStartYmd.slice(0, 7),
    notes: [
      "Revenue is this month so far, without sales tax. Rows marked estimated have no recorded Stripe events yet, so the plan's list price is shown instead of a measured payment.",
      "Costs are this month's metered usage (AI, messaging, email, storage) in US cents; owner expenses are not split per customer.",
    ],
  };
}

// ── Ledgers ───────────────────────────────────────────────────────────────────

export type ExpenseInput = { name: string; category: string; amountCents: number; cadence: "one_off" | "monthly" | "yearly"; startsOn: string; endsOn: string | null; note: string | null };
export type SpendInput = { channel: string; campaign: string | null; spentOn: string; amountCents: number; note: string | null };

export async function listExpenses(from: string, to: string) {
  const r = await rows<{ id: string; name: string; category: string; amount_cents: string; currency: string; cadence: ExpenseLike["cadence"]; starts_on: string; ends_on: string | null; note: string | null; created_at: Date }>(sql`
    select id, name, category, amount_cents, currency, cadence, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on, note, created_at
    from ${ownerExpensesTable} order by starts_on desc, created_at desc limit 1000`);
  const items = r.map((x) => {
    const e: ExpenseLike = { amountCents: n(x.amount_cents), cadence: x.cadence, startsOn: x.starts_on, endsOn: x.ends_on };
    return {
      id: x.id, name: x.name, category: x.category, amountCents: e.amountCents, currency: x.currency, cadence: x.cadence, startsOn: x.starts_on, endsOn: x.ends_on, note: x.note,
      createdAt: new Date(x.created_at).toISOString(), countedCentsInRange: Math.round(expenseShareExact(e, from, to)),
    };
  });
  return { range: { from, to }, items, totalInRangeCents: items.reduce((a, i) => a + i.countedCentsInRange, 0) };
}

export async function addExpense(i: ExpenseInput) {
  const [row] = await db.insert(ownerExpensesTable).values({ name: i.name, category: i.category as never, amountCents: i.amountCents, cadence: i.cadence, startsOn: i.startsOn, endsOn: i.cadence === "one_off" ? null : i.endsOn, note: i.note }).returning();
  return row;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const r = await rows<{ id: string }>(sql`delete from ${ownerExpensesTable} where id = ${id}::uuid returning id`);
  return r.length > 0;
}

export async function listMarketingSpend(from: string, to: string) {
  const r = await rows<{ id: string; channel: string; campaign: string | null; spent_on: string; amount_cents: string; currency: string; note: string | null; created_at: Date }>(sql`
    select id, channel, campaign, to_char(spent_on, 'YYYY-MM-DD') as spent_on, amount_cents, currency, note, created_at
    from ${marketingSpendTable} where spent_on >= ${from}::date and spent_on <= ${to}::date order by spent_on desc, created_at desc limit 1000`);
  const items = r.map((x) => ({ id: x.id, channel: x.channel, campaign: x.campaign, spentOn: x.spent_on, amountCents: n(x.amount_cents), currency: x.currency, note: x.note, createdAt: new Date(x.created_at).toISOString() }));
  const byChannel = await rows<{ channel: string; spent: string }>(sql`
    select lower(trim(channel)) as channel, coalesce(sum(amount_cents), 0) as spent from ${marketingSpendTable}
    where spent_on >= ${from}::date and spent_on <= ${to}::date group by 1 order by 2 desc`);
  return {
    range: { from, to }, items, totalCents: byChannel.reduce((a, c) => a + n(c.spent), 0),
    byChannel: byChannel.map((c) => ({ channel: c.channel, amountCents: n(c.spent) })),
    truncated: items.length >= 1000,
  };
}

export async function addMarketingSpend(i: SpendInput) {
  const [row] = await db.insert(marketingSpendTable).values({ channel: i.channel, campaign: i.campaign, spentOn: i.spentOn, amountCents: i.amountCents, note: i.note }).returning();
  return row;
}

export async function deleteMarketingSpend(id: string): Promise<boolean> {
  const r = await rows<{ id: string }>(sql`delete from ${marketingSpendTable} where id = ${id}::uuid returning id`);
  return r.length > 0;
}

// ── Export rows (CSV) ─────────────────────────────────────────────────────────

const EXPORT_LIMIT = 100_000;

export async function revenueExportRows(range: HqRange) {
  return rows<{ day: string; type: string; company: string | null; customer_id: string | null; user_id: string | null; plan: string | null; interval: string | null; amount_cents: string; tax_cents: string; fee_cents: string; currency: string; provider: string; ref: string }>(sql`
    select to_char(be."at" at time zone ${TZ}, 'YYYY-MM-DD') as day, be.type, bp.company_name as company, be.customer_id, be.user_id, be.plan, be.interval,
      be.amount_cents, be.tax_cents, be.fee_cents, be.currency, be.provider, be.provider_event_id as ref
    from ${billingEventsTable} be left join ${businessProfilesTable} bp on bp.user_id = be.user_id or (be.user_id is null and bp.stripe_customer_id = be.customer_id)
    where be.type in ('payment','refund','dispute') and be."at" >= ${iso(range.startAt)} and be."at" < ${iso(range.endAt)} and ${nt('coalesce(be.user_id, bp.user_id)')}
    order by be."at" limit ${EXPORT_LIMIT}`);
}

export async function expenseExportRows(range: HqRange) {
  const exp = await rows<{ name: string; category: string; amount_cents: string; cadence: ExpenseLike["cadence"]; starts_on: string; ends_on: string | null; note: string | null }>(sql`
    select name, category, amount_cents, cadence, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on, note
    from ${ownerExpensesTable} where starts_on <= ${range.to}::date and (ends_on is null or ends_on >= ${range.from}::date) order by starts_on limit ${EXPORT_LIMIT}`);
  const spend = await rows<{ channel: string; campaign: string | null; spent_on: string; amount_cents: string; note: string | null }>(sql`
    select channel, campaign, to_char(spent_on, 'YYYY-MM-DD') as spent_on, amount_cents, note from ${marketingSpendTable}
    where spent_on >= ${range.from}::date and spent_on <= ${range.to}::date order by spent_on limit ${EXPORT_LIMIT}`);
  return {
    expenses: exp.map((x) => ({
      name: x.name, category: x.category, cadence: x.cadence, amountCents: n(x.amount_cents), startsOn: x.starts_on, endsOn: x.ends_on, note: x.note,
      countedCents: Math.round(expenseShareExact({ amountCents: n(x.amount_cents), cadence: x.cadence, startsOn: x.starts_on, endsOn: x.ends_on }, range.from, range.to)),
    })),
    spend: spend.map((x) => ({ channel: x.channel, campaign: x.campaign, spentOn: x.spent_on, amountCents: n(x.amount_cents), note: x.note })),
  };
}

