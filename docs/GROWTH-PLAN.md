# Growth, pricing and owner analytics plan (Phases 131+)

Decided by the owner on 2026-10-19. Launch market: **Canada only**. Prices in **CAD**. Never build from superseded plans.

## What the owner asked for
1. A hook: new users get **3 free quotes**, then pay.
2. Launch price **$19/month**, rising to **$29/month automatically at 100 paying customers**. People who subscribe at $19 keep it (founding price, for life).
3. Plan for **Google Play Billing** (Canada is not in Google's billing-choice markets, so in-app purchase on Android must use Play Billing; the owner lifted the "no prices in the app" rule for Android on 2026-10-19). Stripe stays for the web.
4. Automated sign-up funnels and AI outreach channels, built and operated by Claude, with the owner approving what goes out.
5. **One place that shows everything the owner needs to know**, with financial control (revenue, costs, profit, tax, cash).

## What already exists (do not rebuild)
- `GET /api/admin/metrics` (users, MRR by list price, quotes), `/admin/margin` (AI cost per user vs plan price), `/admin/quote-stats`, `/admin/widget/stats`, `/admin/search-console`, `/admin/email-events`, `/admin/ops`, `/admin/automations`; the admin page is `artifacts/quote-ai/src/pages/admin.tsx`.
- Cost capture: `usage_events` / `usage_daily_summary` (AI tokens, WhatsApp, SMS, email, storage; `lib/usage.ts`).
- Plans: `lib/db/src/schema/plans.ts` (ids free, monthly_starter, monthly_pro, monthly_business, monthly_elite), mirrored in `artifacts/quote-ai/src/lib/plans.ts`. Price list in `routes/payments.ts` (`PLANS`).
- A web trial already exists: 7 days and 3 PDF downloads (`getTrialStatus` in `routes/payments.ts`). The Pocket app enforces nothing yet.
- Stripe webhook in `app.ts` (checkout completed, subscription created/updated/deleted) writes the plan on the profile. It stores **no payment history**.
- Not captured anywhere: where a user came from (source), funnel events before signup, real payments, refunds, costs that are not AI usage, marketing spend, referrals.

## Phases
| Phase | Scope | Ships |
|---|---|---|
| **131 Data layer** | Tables: growth events, signup attribution, billing events (real Stripe payments, refunds, disputes, subscription changes), owner expenses (one-off and recurring), marketing spend. Event tracking endpoint; attribution captured at signup (web and app); Stripe webhook writes billing events. | The numbers start accumulating |
| **132 Owner HQ** | `GET /api/admin/hq/*` and the page `/admin/hq`: money, funnel, acquisition, unit economics, retention, product health, ops, costs, tax, cash. Expense and marketing-spend entry. CSV export for the accountant. | One screen for everything |
| **133 Free quotes and launch price** | 3 free quotes per verified account, server-enforced; launch price $19 then $29 at 100 paying customers, founding price locked; Stripe prices; locked screen. | The hook and the price |
| **134 Lifecycle emails and push** | Welcome, first quote, 3rd free quote, win-back, trial/payment reminders, on the existing automations and Resend, to people who signed up (CASL: express consent at signup). | Automated nurture |
| **135 Play Billing** | Play Billing library in the Pocket app, server-side purchase verification, entitlement merged with Stripe, price shown by Play, Play products and base plans. | In-app purchase on Android |
| **136 Referral and outreach** | Referral (both sides get free quotes), landing pages and a free quote tool with email capture, CASL-safe outreach queue with owner approval, and a suppression list. | Acquisition engine |

## Rules for this work
- Money is stored in **integer cents**, with the currency. Dates in UTC, reported in America/Toronto.
- Every number on the HQ page says where it comes from and the period; nothing is invented. When a source is missing (for example Play fees before Play Billing exists) the page says "not connected", never a zero that looks real.
- Owner-only: every HQ route sits behind `requireAdmin`; no HQ data reaches customers.
- Outreach follows CASL: express consent for sign-ups; cold B2B email only on the conspicuous-publication basis with a record of source, date and relevance, sender identity and a working unsubscribe; no cold texts; an approval queue before anything is sent.
- New env vars are read by name and added to `scripts/src/env-inventory.ts`; routes need the route-matrix entry; migrations are plain SQL in `lib/db/drizzle`, applied with `supabase db query --linked`.

## HQ API contract (Phase 132)
All under `/api/admin/hq`, query `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default last 30 days), all money in cents.
- `GET /overview` → `{ range, money: { mrrCents, arrCents, newMrrCents, expansionMrrCents, churnedMrrCents, revenueCents, refundsCents, taxCollectedCents, feesCents, costsCents: { ai, messaging, email, storage, infra, other }, marketingSpendCents, profitCents, cashCents|null, runwayMonths|null }, customers: { total, paying, trialing, free, newInRange, churnedInRange, foundingCount }, funnel: [{ stage, count, rateFromPrevious }], sources: [{ source, signups, paying, revenueCents, spendCents, cacCents|null }], unit: { arpuCents, ltvCents|null, paybackMonths|null, grossMarginPct }, product: { quotesCreated, quotesSent, quotesAccepted, wau, mau }, ops: { cronOk, deadRuns, emailBounceRate }, notes: [string] }`
- `GET /series?metric=mrr|signups|revenue|costs|profit|quotes&bucket=day|week|month` → `[{ at, value }]`
- `GET /cohorts` → retention by signup month.
- `GET /customers?sort=&q=` → one row per company: plan, since, MTD revenue, AI cost, margin, last active, source.
- `GET|POST|DELETE /expenses`, `GET|POST|DELETE /marketing-spend` → the owner's own ledger.
- `GET /export.csv?kind=revenue|expenses|customers` → for the accountant.
