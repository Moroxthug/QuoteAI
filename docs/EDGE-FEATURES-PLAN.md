# QuoteAI — Edge Features Plan: Payments, Financing, Incentives, Price Intelligence, Public API

Status: **draft, 2026-09-14 — not yet approved or built.** Builds on `docs/GROWTH-PLATFORM-PLAN.md` (Phases 7–14, all built & pushed). This plan is Phases 15+.

Explicitly **out of scope for this plan** (deferred, bucketed with other pending follow-through per the user): SMS as a send channel, finishing the Outlook/Entra ID calendar OAuth app, WhatsApp template approval. Those stay on the existing punch list, not here.

---

## 1. Why these five, in this order

Phase 6 (launch readiness) through Phase 14 (data import) built a complete quote → contract → job → invoice → QuickBooks/calendar pipeline with team accounts, leads, and security hardening. Reviewing it end to end for what's *still* missing surfaced one real gap (not a nice-to-have) and four genuine differentiation opportunities:

1. **Invoice payment collection is not built.** Every step up to "send the invoice" is automated; getting paid still means the contractor manually marks an invoice "paid" after chasing an e-transfer outside the app. This is a hole in a pipeline that's otherwise complete, not a growth feature — highest priority.
2. **Point-of-sale financing** (Financeit) — Canadian-market-specific, high-ticket-close-rate lever. Needs a reality check on feasibility (§3 below) before committing.
3. **The Incentives Engine** — schema exists (`incentives_catalog`, Canadianized this session), nothing else does. A real differentiator if built out: "your quote already includes the $5,000 grant you qualify for."
4. **Supplier price intelligence, extended** — `price_intelligence` already learns prices from scanned receipts; turning that into proactive alerts sharpens the core AI-quoting value prop instead of adding a bolt-on.
5. **Public API / Zapier-Make listing** — cheap once QuickBooks's OAuth/webhook plumbing exists; opens up integrations QuoteAI will never build itself.

---

## 2. Phase 15 — Invoice payment collection (≈2–3 weeks)

**The gap, confirmed in code**: `artifacts/api-server/src/invoices/service.ts` only ever sets `status: "paid"` from a manual admin action (see the credit-note auto-mark and no other call site). The customer-facing invoice page (`/i/:token`, `public-invoices.ts`) has no way to actually pay.

**Design — two payment rails, because Canada isn't card-first**:
- **Interac e-Transfer (primary rail)**: e-transfer is free, instant, and how most Canadian contractors already get paid — a card-only integration would miss the dominant real-world flow. Add a "Pay by e-Transfer" panel on the invoice page showing the company's e-transfer email/autodeposit info (from `business_profiles`) plus a "I've sent the payment" button the customer clicks, which flips the invoice to `pending_confirmation` and notifies the contractor to confirm receipt (one click) before it becomes `paid`. Zero payment-processor integration needed for this rail — it's a confirmation workflow, not a money-movement one.
- **Card/ACH via Stripe (secondary rail, optional per company)**: Elite-tier opt-in (mirrors Phase 11/12's Elite-gating pattern) — a company connects a **Stripe Connect** account (not QuoteAI's own Stripe account, which is reserved for QuoteAI's subscription billing) so customer payments land directly in the contractor's bank account and QuoteAI never touches customer funds or PCI scope. `POST /api/invoices/:id/pay-link` creates a Stripe Checkout Session against the connected account; a webhook (`checkout.session.completed`) marks the invoice paid automatically. Standard Stripe Connect Express onboarding (hosted, ~5 minutes, no partner application needed — unlike Financeit below).

**Build**:
- New `stripe_connect_accounts` table (userId, stripeAccountId, chargesEnabled, payoutsEnabled) — migration `0016_phase15_invoice_payments.sql`.
- `invoices.status` gains `pending_confirmation` (customer says they paid, contractor hasn't confirmed yet) between `sent` and `paid`.
- `artifacts/api-server/src/routes/invoice-payments.ts`: Stripe Connect onboarding link, Checkout Session creation, webhook handler; `public-invoices.ts` gains `POST /api/public/invoices/:token/mark-sent` (e-transfer self-report) and a public payment-status read.
- Settings → Integrations gains a "Get paid online" card (Stripe Connect status + e-transfer instructions editor).
- Invoice detail page + public invoice page get a payment panel with both options, whichever the company has enabled.
- Tests: webhook idempotency (a replayed Stripe event must not double-process), e-transfer self-report can't be spoofed into `paid` without contractor confirmation.

**Feasibility**: fully self-serve, no external approval needed. Stripe Connect is a standard, documented, public API — same trust tier as the QuickBooks/Calendar OAuth already built in Phases 11–12.

---

## 3. Phase 16 — Point-of-sale financing via Financeit (≈2–3 weeks engineering, but gated on a business step first)

**You asked directly whether this is really as easy as it sounded — it isn't, and here's the honest breakdown**, researched this session (Financeit's own v3 API docs, current as of 2026):

- Financeit **does** have a real, documented API (`financeit.ca/api/v3`) with OAuth-style auth (`app_id`/`app_secret` → bearer token), a **hosted redirect flow** (`/direct_invites/send` returns an `application_link` you send the customer — no PCI/lending-compliance burden on QuoteAI's side), multi-merchant support via a `partner_id` scoping model (built for exactly this "one platform, many dealers" shape), and webhooks for loan-status updates (`loan_state_event`, `funds_released` — best-effort, no auto-retry).
- **But**: API access is **not self-serve**. Financeit's docs say to "request API access" — this is an enterprise partner-onboarding process (sales conversation, likely an agreement/revenue-share discussion), not an instant signup like Stripe or QuickBooks's developer portal. This is a **business-development task for you, not something I can do in code** — the engineering plan below assumes that access has been granted.
- **Also**: each individual contractor (QuoteAI's customer) needs their **own** Financeit merchant/dealer account already, similar to the QuickBooks-per-company model — except Financeit dealer enrollment is itself a business-approval process (credit/business verification), not an instant OAuth connect. So even after QuoteAI gets partner API access, an individual contractor using QuoteAI still needs to already be (or become) a Financeit dealer before this feature does anything for them.

**Recommendation**: treat this as two separate tracks —
1. **You pursue Financeit partner/API access** directly (their contractor-software integrations — Jobber, Housecall Pro, ServiceTitan — went through the same "Nexstar Network" partner channel, so there's precedent for a vertical SaaS to get this). I can help draft the outreach or evaluate the agreement once you have something in hand, but the application itself needs your business info.
2. **Build the integration now against the hosted `direct_invites/send` flow** (lowest engineering lift, no raw loan-API surface to maintain) so it's ready the moment access is granted — don't block engineering on the business step.

**Build** (once access exists):
- New `financeit_connections` table (userId, dealer/partner credentials, encrypted like Phase 11's QuickBooks tokens via the existing `lib/crypto.ts` helper).
- Settings → Integrations: "Offer financing" card — a company enters its own Financeit dealer ID (QuoteAI's `app_id`/`app_secret` cover the platform-level call, the dealer ID scopes to their account, per the `partner_id` model).
- Quote-acceptance page gains a "Estimate your monthly payment" widget (calls `/calculator/calculate/` for an indicative payment, no application yet) and a "Apply for financing" button that calls `/direct_invites/send` and redirects to Financeit's hosted application.
- Webhook receiver logs `loan_state_event`/`funds_released` into a new `financeit_loan_events` table, surfaced on the quote/job as a financing-status badge.
- Elite-tier gate, same pattern as QuickBooks/Calendar.

**Alternative if the Financeit partnership stalls**: Wisetack and Hearth are the other modern Canadian-relevant POS financing options that came up in this research — worth a fallback look if Financeit's partner process is slow, though Financeit currently has the deepest FSM/contractor-software integration precedent.

---

## 4. Phase 17 — Build out the Incentives Engine (≈2 weeks)

The schema (`incentives_catalog`) exists and is now Canadianized (federal/provincial/municipal/utility, income-tested flag) but nothing populates or consumes it. i18n strings for an admin "Incentives Engine & Catalog" page already exist (`admin.incentivesEngineTitle` etc.) — this was clearly planned once and shelved.

**Build**:
- Seed data: a starting catalog of major federal (Canada Greener Homes Affordability Program successor programs, CGHAP), provincial (Ontario's OHPA-successor programs, Québec's Rénoclimat/Chauffez Vert), and utility (Enbridge, BC Hydro, Hydro-Québec) rebate programs — hand-curated to start, not scraped.
- Admin catalog CRUD (`GET/POST/PUT/DELETE /api/admin/incentives`) — the i18n strings already describe this exactly (add/edit incentive, mark human-verified).
- A daily AI freshness-check cron (mirrors the `isVerifiedByAi`/`lastCheckedAt` fields already in the schema) — fetches each `fonteUfficialeUrl` and flags if the page no longer matches the stored terms, rather than trying to auto-discover new programs (too failure-prone to trust unsupervised).
- Quote-generation integration: when a quote's `categoriaIntervento`-equivalent work type + province match a catalog entry, surface it in the AI-generated quote ("You may qualify for up to $X from [program]") with a clear "not a guarantee of eligibility" disclaimer (the `humanVerified` flag exists precisely to distinguish "AI-checked" from "a person confirmed this").
- Tests: matching logic (province + work-type + income-test flag → correct subset of programs), disclaimer always present when an incentive is surfaced.

**Feasibility**: fully self-serve, no external partner needed — this is QuoteAI's own content to curate and maintain.

---

## 5. Phase 18 — Supplier price intelligence, extended (≈1–2 weeks)

`price_intelligence` (Phase 2/3) already learns unit prices from scanned receipts (`workType`, `unitPrice`, `zone`, tied back to the source document). Currently it's a passive lookup table used to sanity-check AI-generated quote pricing.

**Build**:
- A weekly rollup job that flags work types where the learned price moved >X% since the last check (e.g. "drywall installation in Ontario is up 12% since your last 5 receipts") — surfaced as a Settings → Catalog notification, not a hard block.
- Cross-supplier view: when the same `workType`+`zone` has entries from multiple vendors (already captured via `sourceDocumentId` → `uploaded_documents`), show a simple "you're paying more at X than at Y for the same material" comparison.
- **No new external integration** — this is entirely built from data QuoteAI already has from receipt scanning; the only work is aggregation and surfacing it, which is why it's cheap relative to its value.

---

## 6. Phase 19 — Public API + Zapier/Make listing (≈2–3 weeks)

- A subset of existing endpoints (quotes, clients, jobs, invoices — read + create) exposed under a versioned `/api/v1/public/*` path, authenticated by a per-company API key (new `api_keys` table, hashed like existing tokens) rather than the cookie-session auth everything else uses.
- Rate-limited (reuse `userRateLimiter`), scoped by the Phase 7 permission matrix (an API key inherits the role of the member who created it).
- Webhooks: a company registers a URL + event types (`quote.accepted`, `invoice.paid`, etc.) — reuses the exact `raiseAutomation` event names already defined for internal automations, so no new event taxonomy needed.
- A Zapier "Premium App" listing (Zapier's own submission process, free) and/or a public Make.com app — thin wrappers over the same public API, submitted once the API itself is stable.
- Elite-tier gate (same pattern as every other integration in this plan).

**Feasibility**: fully self-serve. Zapier/Make submission has review lead time but no business-partnership gate like Financeit.

---

## 7. Phase 20 — Send customer emails from the contractor's own connected inbox (≈2 weeks)

**The gap**: every customer-facing email (quote PDF, contract signing/reminder, invoice, lead follow-up) sends from `no-reply@quoteai.ca`. Phase 8 already swapped the *display name* and logo ("{company} via QuoteAI"), but the actual From address — and therefore where a customer's reply lands — is still QuoteAI's, not the contractor's. A reply today has nowhere good to go.

**Design**: extend the exact OAuth pattern already built for Phase 12's Calendar connections to email — a per-company "Connect your email" integration, Gmail and Outlook both (Microsoft 365 is as common as Gmail with Canadian trades, and doesn't carry Google's extra scrutiny — see below), **send-only**. When connected, the existing customer-facing send call sites (`email.ts`/`emailContracts.ts`, already parameterized per Phase 8) send through the contractor's own account instead of QuoteAI's; when not connected, behavior is unchanged (Phase 8's branded `no-reply@quoteai.ca` stays the default/free-tier fallback, not replaced).

**Scope reality-check (researched this session)**:
- **Gmail**: `gmail.send` is a Google **"sensitive" scope, not "restricted"** — standard OAuth app verification only, no CASA security assessment. That assessment (~$500/year, third-party audit) only applies if the app also *reads* the inbox (`gmail.readonly`/`gmail.modify`) — which this phase deliberately does not do. Send-only keeps this cheap and fast to ship.
- **Outlook**: Microsoft Graph's delegated `Mail.Send` permission has no equivalent CASA-style audit requirement — standard app registration + consent, same tier of effort as the Outlook Calendar app registration already started in Phase 12 (and per [[growth-platform-plan]], not yet finished — this phase should piggyback on finishing that registration rather than duplicating the app-registration work).
- **Explicitly out of scope for v1**: reading replies back into QuoteAI (a shared inbox/thread view). That's the expensive, restricted-scope version and isn't needed to solve the actual problem (replies currently vanishing) — a reply landing in the contractor's own real inbox, read on their own phone/laptop like normal, already fixes it.

**Cheap independent win, ships regardless of this phase**: set a `Reply-To` header to the contractor's real email (already stored in `business_profiles`) on every customer-facing send today. Zero OAuth, same-day fix, solves most of the "replies disappear" problem immediately — should ship on its own before or alongside this phase, not wait for it.

**Build**:
- New `email_connections` table (userId, provider `google`|`microsoft`, encrypted OAuth tokens via the existing `lib/crypto.ts` helper, connected mailbox address) — migration `0017_phase20_email_connections.sql` (numbering depends on which phases land first).
- `artifacts/api-server/src/routes/email-connections.ts`: OAuth connect/callback (reusing Phase 11/12's signed-`state` HMAC pattern), disconnect, status.
- Thin send clients: `lib/gmailSendClient.ts` (Gmail API `users.messages.send`, raw MIME) and `lib/outlookSendClient.ts` (Graph `/me/sendMail`), mirroring `googleCalendarClient.ts`/`outlookCalendarClient.ts`'s style.
- `email.ts`/`emailContracts.ts` gain a "send via connected account if present, else via Resend as today" branch at each existing customer-facing call site — no change to transactional/internal emails (welcome, subscription, admin notifications), same boundary Phase 8 already drew.
- Settings → Integrations: "Send emails as yourself" card (connect/disconnect Gmail or Outlook, shows the connected address).
- Token refresh handling (both providers issue short-lived access tokens); a failed send falls back to the Resend/QuoteAI-branded path rather than silently dropping the email, logged for the contractor to notice and reconnect.
- Tests: fallback-on-failure behavior, that internal/QuoteAI-facing emails never route through a connected personal account (scope boundary), token-encryption round-trip (same helper already tested in Phase 13).

**Feasibility**: fully self-serve for the send-only scope described — no partner/business-approval gate like Phase 16's Financeit dependency. The one shared dependency is finishing the Outlook OAuth app registration (already started, blocked on flipping `signInAudience`, tracked in [[growth-platform-plan]]) — worth doing that first since both Phase 12's calendar sync and this phase need it.

---

## 8. Suggested build order

1. **Phase 15 (invoice payments)** — closes an actual functional gap, fully self-serve, no external dependency. Start here.
2. **Phase 17 (incentives engine)** — fully self-serve, reuses existing i18n/schema investment, meaningful differentiation.
3. **Phase 18 (price intelligence)** — cheap, self-serve, sharpens the core product.
4. **Phase 20 (connected-email sending)** — mostly self-serve (send-only scopes, no CASA-style audit); ship the independent `Reply-To` quick win first regardless of when the full phase starts. The Gmail half has no dependency; the Outlook half needs the Outlook OAuth app registration finished first (currently deferred — see below), so start with Gmail if that registration is still pending.
5. **Phase 19 (public API)** — self-serve, but lower urgency until there's third-party demand.
6. **Phase 16 (Financeit financing)** — highest potential close-rate impact, but blocked on you pursuing partner access first; build the engineering piece in parallel once you've started that conversation, not before.

Deferred, tracked elsewhere (per the user, handled personally rather than delegated): SMS channel, finishing the Outlook/Entra ID OAuth app registration (needed by both Phase 12's calendar sync and Phase 20's Outlook email — the `signInAudience` fix is the blocker, see [[growth-platform-plan]]), WhatsApp template approval.
