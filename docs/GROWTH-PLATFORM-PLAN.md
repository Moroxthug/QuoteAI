# QuoteAI — Growth Platform Plan: Team Accounts, Integrations, WhatsApp, Lead Reachout

Status: **draft, 2026-09-13 — not yet approved or built.** Builds on `docs/JOB-LIFECYCLE-PLAN.md` (Phases 0–6, quote→contract→job→invoice, launch readiness in progress). This plan is Phases 7+.

---

## 1. What's being added, and why

Four requests, plus a gap audit of what's still missing:

1. **Multi-user team accounts** — today one `auth_user` = one company. A real contracting company has an owner, an office admin who does invoicing, and foremen who need job/schedule access but not financials. No login-sharing workaround.
2. **"Company logic"** — formalizing what a "company" *is* as a first-class thing you can add members to, not an implicit 1:1 with a login.
3. **Connections to software Canadian trades companies already run** — accounting, payroll, admin, CRM — researched below, not assumed.
4. **WhatsApp as a send channel** — today WhatsApp is inbound only (a contractor can *generate* a quote by chatting with a bot). Nothing lets a company *send* a quote/invoice/contract link to a customer over WhatsApp the way it already does over email.
5. **Customer reachout pipeline** — capture every inbound "I want a quote" contact as a lead (today only the embeddable widget does this, and only once a full AI quote is generated — a bare "call me" inquiry has nowhere to go), and automatically follow up with leads who went quiet.
6. **Per-org cost observability** — know what each company actually costs to run (AI tokens, WhatsApp messages, storage, email) so pricing (§3.5) is based on real numbers, not guesses, and so a single abusive/heavy account can't quietly erode margin unnoticed.
7. **Security hardening** — concrete measures to make QuoteAI harder to breach, beyond the IDOR fix and rate-limit audit already done in Phase 6.
8. **Data migration / import** — let a company bring in quotes they already have elsewhere instead of starting from zero.
9. **Customer-branded emails** — a company's own logo (not QuoteAI's) on the emails their customers receive.

Plus §5 below is a gap audit of what else is missing across the whole product, independent of these asks, so this plan can prioritize honestly rather than just building what was asked.

---

## 2. Research: what Canadian contractors actually run today

Findings from current (2026) market data — cite-checked, not assumed:

- **Accounting**: QuickBooks Online Canada dominates small-business accounting (~60% share). Sage 50cloud and Wave (free tier, Ontario/BC/Alberta payroll) are the next tier. A contractor-specific tool (e.g. Awditify) exists but has negligible share vs. QuickBooks.
- **Payroll**: QuickBooks Payroll (bundled with the accounting product), Wagepoint (liked for clean UX, common with small accounting firms managing <10 clients), ADP Canada and Ceridian/Dayforce (larger companies), Rise People, Payworks. **QuoteAI deliberately doesn't do payroll (regulated territory)** — the existing payroll-summary CSV export is the intentional boundary; integration should mean *exporting into* one of these tools, not replacing them.
- **CRM / field service**: Jobber, Housecall Pro, ServiceTitan, Buildertrend — i.e., QuoteAI's own competitive category. There is no separate "CRM" a contractor bolts on *in addition* — QuoteAI already is that layer for the customer-facing/job side. The integration need here is narrower: **calendar sync** (Google Calendar / Outlook) so job milestones and worker schedules show up where the owner already looks, not a full CRM bridge.
- **Messaging**: WhatsApp Business Platform (Meta Cloud API) is the standard API; Twilio, 360dialog, Wati, Gupshup are Business Solution Providers (BSPs) that wrap the same underlying Meta billing (per-message, since July 2025) with their own markup or subscription. **QuoteAI already holds Meta Cloud API credentials** (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` in `artifacts/api-server/src/routes/whatsapp.ts`) for the inbound bot — outbound sending can reuse the same Meta app instead of adding a new BSP.
- **Compliance**: Canada's Anti-Spam Legislation (CASL) covers email, SMS, and WhatsApp business messages alike whenever they're commercial. Requires (a) consent — express, or implied from an existing business relationship like "you asked for a quote", (b) sender identification (legal name, mailing address, contact method) in every message, (c) a working unsubscribe honoured within 10 business days, (d) consent records kept as evidence. **This directly gates the reachout pipeline (§4)** — it is not a "nice to have," it's the difference between a legal automated-follow-up feature and a CASL violation exposing the company (and QuoteAI) to CRTC penalties.

**Conclusion**: the highest-value integration is **QuickBooks Online** (accounting sync — by far the modal tool a Canadian contractor already has), **not** a new CRM (QuoteAI is the CRM) and **not** in-house payroll (already correctly out of scope). Calendar sync is a solid second. WhatsApp reuses existing infrastructure. The reachout pipeline needs CASL built into its data model from day one, not bolted on later.

Sources: [Best Payroll Software for Small Businesses in Canada (2026) – Agendrix](https://www.agendrix.com/blog/best-payroll-software-for-small-business-canada) · [Best Accounting Software for Contractors in Canada 2026](https://awditify.com/blog/best-accounting-software-for-contractors-in-canada-2026) · [10 Best Canadian Payroll Software Reviewed for 2026](https://peoplemanagingpeople.com/tools/best-canadian-payroll-software/) · [CRTC — FAQ about CASL](https://crtc.gc.ca/eng/com500/faq500.htm) · [CRTC — Guidance on Implied Consent](https://crtc.gc.ca/eng/com500/guide.htm) · [WhatsApp Business API Providers Compared 2026 – SocialVik](https://www.socialvik.com/blog/whatsapp-business-api-providers-compared-2026) · [Twilio vs 360Dialog Pricing – Kommunicate](https://www.kommunicate.io/blog/twilio-vs-360dialog-a-comparison/)

---

## 3. Multi-user team accounts — the core architectural decision

This section is also the answer to "organization structure for companies who want their employees to use QuoteAI" — that's exactly what §3.1–3.3 build. There is no separate "org structure" feature beyond this; a company's employees getting logins with appropriate access *is* the org structure.

**The problem**: every table in the schema (`business_profiles`, `quotes`, `clients`, `projects`, `contracts`, `invoices`, `cost_entries`, …) is keyed by a single `userId: text`, and `requireAuth` resolves that id directly from the better-auth session. There is no concept of "organization" distinct from "the person who signed up."

**Two ways to fix it:**

| Approach | What it means | Cost |
|---|---|---|
| A. **Organization = the existing owner's `userId`; add members** | `business_profiles.userId` becomes, conceptually, "the org id" (unchanged). New `organization_members` table maps *other* `auth_user` rows to that owner id with a role. `requireAuth` resolves the session to an **acting org id** (the user's own id if they own one, or their active membership's org id) and everything downstream — every existing query, every table — needs zero schema changes. | Small, additive. One new table, one middleware change, a role-check helper. |
| B. **First-class `organizations` table; migrate every `userId` FK to `organizationId`** | Textbook multi-tenant design. | Touches 15+ tables, every route, every query in the codebase built across Phases 0–6. Weeks of regression risk for a benefit (multiple people *owning* an org, org rename independent of the owner's identity) that isn't actually requested here. |

**Recommendation: Approach A.** It gets team accounts shipped without re-touching Phases 0–6, and it's not a dead end — if QuoteAI later needs "true" multi-owner organizations (e.g., an org that outlives its original owner leaving), migrating from "owner id doubles as org id" to a real `organizations` table is a mechanical one-column rename, not a redesign, because the *shape* (one id, many resources hang off it) stays identical.

### 3.1 Data model

```
organization_members (
  id, ownerId (= business_profiles.userId, the "org"),
  userId (the auth_user being granted access),
  role: "owner" | "admin" | "office" | "foreman" | "viewer",
  status: "invited" | "active" | "suspended",
  invitedEmail, invitedByUserId, invitedAt, joinedAt,
  permissions jsonb override (rare per-member exceptions to the role's default)
)
```

- `role` maps to a permission matrix (below), checked in a new `requirePermission(feature, action)` middleware that wraps today's `requireAuth` + `hasFeature`.
- A user can belong to more than one organization (e.g., a bookkeeper working two contractor accounts, or a foreman moving jobs). Session carries an **active org id**; a small org-switcher in the header flips it (stored in a cookie/local session field, not the JWT, so switching doesn't require re-login).
- Seats are plan-gated per §3.5 below (the existing `plans.ts` map is the right place). Overage prompts an upsell, doesn't hard-block (avoid locking someone out of their own data).

### 3.2 Permission matrix (draft — refine during build)

| Role | Quotes | Contracts/e-sign | Jobs/milestones | Costs/receipts | Invoices/payments | Team/time | Analytics | Settings/billing |
|---|---|---|---|---|---|---|---|---|
| Owner | full | full | full | full | full | full | full | full |
| Admin | full | full | full | full | full | full | full | no billing/plan changes |
| Office | full | send/void, not template edits | full | full | full | view only | view | no |
| Foreman | view | view | edit own jobs | add/confirm own jobs | view only | log time, no rates | view own jobs | no |
| Viewer | view | view | view | view | view | view | view | no |

This is a starting point, not a spec — validate against how a real 3–8 person renovation company actually splits work before locking it in.

### 3.3 Auth/session changes

- `requireAuth` (today: `authMiddleware.ts`) resolves `res.locals.userId` = the **acting org id**, and adds `res.locals.actorUserId` = the real logged-in person (needed for audit trails — `writeAudit` already has an `actorId` field, just needs to stop assuming actor === owner).
- Invitations: `POST /api/team/members/invite {email, role}` → creates an `organization_members` row `status: invited`, emails a signup/accept link (reuse the existing hashed-token pattern from worker invites, `routes/team.ts`). Accepting creates or links an `auth_user` and flips to `active`.
- Every `writeAudit` call across the codebase already threads `actorId` — this becomes genuinely meaningful once more than one person can act on an org (right now it's always the owner).

### 3.4 What does NOT change

Every existing route, query, and the entire Phase 0–6 feature set works unmodified, because `res.locals.userId` still means exactly what every query already assumes it means. This is the whole point of Approach A.

### 3.5 Pricing — base + per-seat, with metered add-ons for the two features that actually cost money

Current pricing (`plans.ts`): Starter $19 / Pro $49 / Elite $59 CAD/mo, flat, no seats. Team accounts (this phase) plus WhatsApp/QuickBooks (Phases 8–10) change the cost and value shape enough to revisit it now rather than retrofit later.

**1. Move from flat tiers to base price + per-seat add-on** — this is how every direct competitor (Jobber, Housecall Pro, ServiceTitan) prices, and it's the natural pricing axis for a feature (team accounts) that didn't exist before:

| Tier | Base | Seats included | Extra seat |
|---|---|---|---|
| Starter | $19–25 | 1 (solo only, no team accounts) | — |
| Pro | $49–59 (unchanged) | 2 | +$12–15/mo |
| Elite | **$79–99** (up from $59) | 5 | +$12–15/mo |

Starter and Pro roughly hold — they're the acquisition funnel and should stay cheap relative to Jobber's ~$39 entry point. Elite is where the increase belongs: it's the tier that gets team accounts, the assistant, analytics, and (per this plan) WhatsApp reachout and QuickBooks sync — the features that make switching away costly once a whole team and their accounting are wired in, which is exactly when a company has the least price sensitivity. $79–99 is still well under Buildertrend ($99–399) or ServiceTitan (enterprise-only).

**2. Meter the two features with real marginal cost, instead of raising flat prices for everyone.** Today's cost base is cheap (Groq/gpt-oss text generation, Vercel Hobby, Resend free tier) — quote generation, contracts, invoicing, PDF rendering all cost effectively nothing per use. Two things in this plan don't: **gpt-4o vision** calls for receipt AI, and **WhatsApp outbound** (Meta bills per-message, ~US$0.005–0.01 + margin). Bake a generous monthly allowance into each tier (e.g. 100 receipt scans, 200 WhatsApp sends on Pro; higher on Elite), then meter overage at a small margin above Meta's/OpenAI's cost. This protects margin as adoption grows without a repricing conversation every time a cost input changes, and avoids a heavy user's costs being subsidized by light users on the same flat tier.

**3. Add an annual billing discount** (~2 months free, the standard ~17% off) — not currently offered. Better cash flow now, and materially lower churn once team accounts make losing an account more costly (a 6-seat Elite account leaving hurts far more than a Starter solo).

**4. Keep QuickBooks and calendar sync un-metered inside Elite** — they cost nothing per-use (OAuth, no per-call fee) and are exactly the kind of feature that should feel "included" to justify the Elite price jump, not nickel-and-dimed as a separate add-on.

Net effect: Starter/Pro roughly unchanged, Elite up ~35–65%, seats become a real secondary revenue line as companies grow, and the two cost-bearing features (vision AI, WhatsApp) are insulated from margin erosion instead of averaged into everyone's flat fee.

---

## 4. Customer reachout pipeline

### 4.1 Gap today

The embeddable widget (`routes/public-quotes.ts`, `source: "widget"`) creates a full AI-drafted quote the instant a website visitor submits the form — that's the only lead-capture path, and it only fires once a complete quote exists. There's no path for:
- A bare "call me" / "I have a question" contact-form submission that hasn't become a quote yet.
- A phone or in-person lead the office manually logs.
- Tracking *why* a sent quote sits un-accepted for two weeks, or nudging the customer about it.

### 4.2 Data model

```
leads (
  id, userId, source: "widget" | "manual" | "whatsapp" | "phone" | "referral",
  name, email, phone, address, city, province,
  status: "new" | "contacted" | "quoted" | "won" | "lost" | "unresponsive",
  quoteId (nullable — set once a quote is generated from this lead),
  notes, consentSource (how CASL consent was obtained — see 4.4),
  createdAt, lastContactedAt, closedAt
)
lead_events (id, leadId, type: "created"|"contacted"|"quote_sent"|"followup_sent"|"replied"|"status_changed"|"unsubscribed", detail, createdAt)
```

Every quote already implicitly *is* a lead (client + status); `leads.quoteId` links them once one exists, so the pipeline view can show both "quotes with no reply" and "inquiries that never became a quote" in one board (`/dashboard/leads`, kanban-style: New → Contacted → Quoted → Won/Lost).

### 4.3 Automated follow-up ("nurture") sequences

- Configurable per company (Settings → Reachout): e.g. day 2, day 5, day 10 after a quote is sent with no accept/decline.
- Channel picked per lead based on what's on file and what the company has connected: email always available; SMS/WhatsApp only if the company has connected a number (§4.4) **and** the lead has consented.
- Templates are editable (mirrors the existing bilingual contract-template pattern), variable-substituted (`{{clientName}}`, `{{quoteTotal}}`, `{{quoteLink}}`).
- Stops automatically the moment the quote is accepted/declined, or the lead replies, or unsubscribes — driven by the existing `automation_runs` idempotent-handler pattern (a new `lead.followup_due` event on a daily cron tick, same shape as `invoice.overdue`).
- A reply (email reply-to webhook already exists via Resend; WhatsApp reply via the existing inbound webhook) marks the lead `status: contacted` and pauses the sequence — never talk over a customer who already answered.

### 4.4 CASL compliance, built into the model (not bolted on)

- `leads.consentSource` records *how* consent was established: "requested a quote" (implied consent — CASL explicitly permits this for the resulting business relationship), "checked opt-in box," "existing customer" (implied, 2-year window). Every automated message logs which consent record justified sending it (`lead_events`).
- Every automated message (email, SMS, WhatsApp) carries the company's legal name + mailing address + one contact method, and a working one-click unsubscribe that flips `leads.status = "unsubscribed"` and hard-stops all future sequences for that contact, honoured immediately (CASL allows up to 10 business days; doing it instantly is strictly safer and cheap to build).
- This is genuinely a legal-exposure feature for the *company* using QuoteAI, not just QuoteAI — worth a one-line disclaimer in the settings screen ("You are responsible for CASL compliance; QuoteAI logs consent and unsubscribes for you") mirroring the existing "lawyer review" disclaimer pattern from the contract templates.

### 4.5 WhatsApp as a send channel (ties into §4.3)

- Reuse the existing Meta Cloud API app/credentials (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`) — today used only for the inbound quote-generation bot.
- New outbound capability: "Send via WhatsApp" button next to the existing "Send via Email" on quotes, contracts, and invoices (parallel to `sendContractToCustomer` / `sendInvoice` / the quote email flow) — sends a templated message with the same secure public link customers already get by email.
- Meta requires pre-approved message templates for the first outbound message in a 24-hour window (free-form replies are fine *inside* an open customer-service window, e.g. after they've messaged the bot). Template approval is a one-time setup step per template (quote-ready, contract-ready-to-sign, invoice-due, follow-up-nudge), submitted through the existing Meta Business app.
- Company connects their own WhatsApp Business number the same way they already do for the inbound bot (`whatsappConnectionsTable` — reuse, don't rebuild).

---

## 4a. Per-organization cost observability

**Why now**: §3.5's metered pricing (receipt AI, WhatsApp overage) is only as good as the numbers behind it. Without this, "set the allowance and overage price near actual cost" is a guess. This is infrastructure the pricing model depends on, not a nice-to-have.

**Data model**:
```
usage_events (id, userId, kind: "ai_text" | "ai_vision" | "whatsapp_message" | "email" | "storage_bytes" | "sms",
  quantity, unitCostCents (snapshot at time of use — provider prices change), relatedEntityType, relatedEntityId, createdAt)
```
- Every AI call already goes through one client (`lib/integrations-openai-ai-server`) and every WhatsApp send goes through one route — both are single choke points, so instrumentation is a small wrapper at each, not a sweep across the codebase. Token counts come straight off the OpenAI/Groq response (`usage.prompt_tokens`/`completion_tokens`); WhatsApp cost comes from Meta's per-message billing category (already researched in §2).
- Storage bytes: a nightly job sums object sizes per company (Supabase Storage API exposes this) rather than tracking per-upload, since it only matters in aggregate.
- Roll up nightly into `usage_daily_summary (userId, date, kind, quantity, costCents)` — the raw event table is for debugging/audits, the summary is what powers dashboards and billing.

**Two audiences, one dataset**:
- **Internal (QuoteAI ops)**: a margin dashboard — cost vs. subscription revenue per org, flags accounts running at a loss so pricing/allowances can be corrected before it's a pattern.
- **Company-facing**: a simple "usage" panel in Settings showing their own WhatsApp/receipt-scan usage against their plan's allowance (transparency, and it's the natural place to prompt an upgrade before they hit overage).

## 4b. Customer-branded emails

**Current state (confirmed in code)**: every customer-facing email — quote, contract, invoice, acceptance notification — hardcodes the QuoteAI logo and sends `from: "QuoteAI <no-reply@quoteai.ca>"` (`artifacts/api-server/src/lib/email.ts`, `emailContracts.ts`). A company's own customers currently see QuoteAI's brand, not theirs, on every email about their own job.

**What's fully possible immediately**: swap the hardcoded `LOGO_URL` for `businessProfiles.logoUrl` (already collected — onboarding/Settings) in every customer-facing template, and change the visible sender name to `"{companyName} via QuoteAI" <no-reply@quoteai.ca>` (Resend supports an arbitrary display name on a shared verified domain; only the *display name* changes, not the underlying address). This alone removes QuoteAI's logo from the customer's inbox and puts the company's name first — most of the visible "whose brand is this" signal.

**What needs a caveat, with a real path**: fully replacing `no-reply@quoteai.ca` with the company's *own* domain (e.g. `no-reply@smithcontracting.ca`) is possible but requires each company to add DNS records (SPF/DKIM/DMARC) that Resend verifies — not something QuoteAI can do on their behalf. This is a real, well-trodden pattern (every email platform — Mailchimp, Resend itself — offers exactly this as "custom sending domain"), just not a zero-effort one for the company. Recommendation: ship the logo + display-name swap immediately (Phase 8 below, no dependency on the customer), and offer custom-domain sending as an Elite-tier opt-in with a guided DNS setup screen (Resend's API supports creating/verifying a domain per customer programmatically) — a company that skips the DNS step still gets the branded logo/name, so nothing is blocked on it.

## 4c. Security hardening

Phase 6 already fixed a real IDOR and confirmed rate limiting/token hashing on every public endpoint. Beyond that, concretely:

- **2FA** (TOTP, e.g. via `otplib`) for login — the single highest-value addition once Phase 7 means more than one person can log into one company's financial data. Optional per-account today, worth making it strongly prompted (not mandatory — avoid locking anyone out) once team accounts ship.
- **Login hardening**: rate-limit `/api/auth/sign-in` per IP *and* per email (today's `ipRateLimiter`/`userRateLimiter` primitives already exist, just need applying there if not already), and alert-log repeated failures per account as a brute-force signal.
- **Session management**: "sign out everywhere" + a visible active-sessions list (better-auth already tracks sessions in `auth_session` — this is a UI + one revoke endpoint, not new infrastructure).
- **Security headers**: confirm `helmet`-equivalent headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) are set on every response — quick to audit, easy to regress silently.
- **Dependency scanning**: `pnpm audit` / GitHub Dependabot wired into CI, not a one-off check — this is the most common real-world breach vector (a known CVE in a transitive dependency), and costs nothing to automate.
- **Secrets rotation runbook**: a documented process for rotating `BETTER_AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, etc. without downtime — not urgent to *do* now, but worth having written down before it's needed in a hurry (e.g. after this session's IDOR fix, or if a key ever leaks).
- **Audit log UI**: `writeAudit` already logs every sensitive action (Phase 0+) but there's no screen to read it — surfacing it (Settings → Activity log) turns existing data into an actual detection tool for "did someone on my team do something unexpected."
- **Anomaly alerting**: a cheap first version — alert (email/Slack to QuoteAI ops) on spikes in failed logins, unusual API-key usage, or a sudden burst of `automation_runs` failures for one account, using the `usage_events` infrastructure from §4a as the data source.
- **Third-party review**: a professional penetration test once the multi-user/integrations surface area (Phase 7 team accounts, Phase 11 QuickBooks OAuth) is live — the kind of check that catches what code review doesn't, and worth budgeting for once there's more than one person's data behind a login and an external OAuth connection in play.

None of this is exotic — it's the standard SaaS security baseline, and most of it is cheap relative to the exposure it closes once team accounts and third-party integrations (QuickBooks OAuth, WhatsApp) widen the attack surface.

## 4d. Data migration / import

**The ask**: let a company bring in quotes they already have (spreadsheets, PDFs, another tool's export) instead of starting from zero. Full automatic migration from every possible source isn't realistic — every competitor's export format differs and most "quotes" arrive as unstructured PDFs — but a good-enough version is very buildable:

1. **Structured import (CSV/Excel)**: a downloadable template (client name, address, items, prices, date, status) + an upload-and-map screen — the same shape as any CSV importer. Handles anyone whose past data is already in a spreadsheet (extremely common for small contractors).
2. **AI-assisted unstructured import**: reuse the exact document-AI pipeline already built for receipts (`costs/receiptAi.ts` — vision model, JSON extraction) against uploaded PDFs of old quotes: extract client, line items, totals, date into the same structured shape, then land every imported quote in a **review queue** (mirrors the existing receipt review-queue pattern) rather than writing directly — a company confirms each one before it becomes a real quote record. This is the same trust pattern already used for AI-extracted receipts, just pointed at a different document type.
3. **What it deliberately does NOT do**: reconstruct contracts, signatures, or payment history from a competitor's system, or attempt a live API integration with a specific competitor (Jobber, Buildertrend, etc.) for v1 — that's a much larger, per-competitor project with uncertain payoff. Imported records land as *historical quotes* (for the client list and quote history), not as fully wired jobs/contracts.
4. **Dedup against existing data**: imported clients run through the existing `clients` dedup key (name+email+phone, already built) so importing doesn't create duplicate client records for people already in the system.

This gets "don't start from zero" solved for the realistic 90% case (spreadsheets and PDFs) without overbuilding bespoke competitor integrations nobody's asked for by name yet.

---

## 5. Gap audit — what else is missing, independent of the four asks

Reviewing the full product against what a contractor SaaS at this maturity typically needs. Ranked by how much it changes the product's viability, not asked-for order:

**Security / trust (do before scaling multi-user access further) — now scheduled, see §4c and Phase 13:**
- **2FA**, **session/device management**, login hardening, audit-log UI, dependency scanning — all detailed in §4c / Phase 13.
- **Data export** (PIPEDA gives Canadians a right to their own data) — a company should be able to export everything (quotes, contracts, invoices, costs) as a zip/CSV bundle on request, not just via ad-hoc PDF downloads. Still backlog, but worth folding into Phase 13 since it touches the same account/settings surface.

**Revenue / retention (things that make contractors stick around and pay):**
- **Job photo galleries** — before/after, tied to milestones (already flagged last turn — still missing).
- **Review requests** — auto-ask for a Google review after `job.completed` (already flagged last turn — still missing; ties directly into this reachout infrastructure, since it's the same "automated message after an event" machinery as §4.3).
- **Customer portal** — right now every customer touchpoint is a one-off token link (`/sign/:token`, `/i/:token`) with no persistent "my project" view across multiple invoices/documents for the same job. A lightweight logged-in (or magic-link) customer portal showing job progress + all their documents in one place is a natural next step once there's more than one document per customer.
- **Calendar sync** (Google/Outlook) — milestones and worker schedules currently only live inside QuoteAI; most owners live in their phone's calendar.

**Operational gaps (things Phase 2–3 explicitly deferred and never returned to):**
- **Supplier/vendor management UI** — API and data exist, no page (`routes/costs.ts` / `crm.ts` mentioned this as deferred in Phase 2/3).
- **Materials/inventory tracking** beyond per-job cost entries — no reorder points, no "what's in the truck," which matters more as a company scales beyond a handful of jobs.
- **Warranty / service-call tracking** post-completion — a job disappears into "completed" with no path to log a callback or warranty claim against it.

**Platform-shaped gaps (only matter once scale increases, worth knowing about now):**
- **Public API / webhooks** for power users who want their own integrations (a natural home for the QuickBooks sync in §2 to eventually generalize into, and for a future Zapier/Make.com listing).
- **Multi-currency / multi-region** — CAD-only, Canada-only is a deliberate and correct scope for now; worth flagging as a real wall if US expansion is ever considered, since tax/legal templates are Canada-specific by design.
- **Own-subscription dunning** — what happens when a *company's own* Stripe subscription payment fails? Not yet designed; worth a small pass (grace period, feature downgrade, not silent lockout).

**Recommendation**: fold review-requests + job photos into this plan (Phase 10 below) since they reuse the exact automation/messaging infrastructure being built for §4 anyway — cheap to add once the machinery exists. Security (§4c) is now scheduled as Phase 13. Leave the remaining items (customer portal, supplier UI, inventory, warranty tracking, public API, dunning) as a named backlog rather than silently dropped.

---

## 6. Implementation phases

Continues the numbering from `docs/JOB-LIFECYCLE-PLAN.md` (Phases 0–6 done/in progress).

### Phase 7 — Team accounts (≈2–3 weeks)
- `organization_members` table + migration (additive).
- `requireAuth` resolves acting org id; `actorUserId` threaded through `writeAudit` everywhere it's already called.
- Role → permission matrix (§3.2) as a `requirePermission(feature, action)` middleware, applied incrementally per route group (financial routes first: invoices, contracts, billing).
- Invitation flow (email, hashed token, accept/decline), `/dashboard/team/members` UI (distinct from the existing `/dashboard/team` = *workers* page — naming needs to disambiguate "team members with logins" vs. "workers logging hours," likely unify into one page with tabs).
- Org switcher in the header for multi-org users.
- Seats plan-gated in `plans.ts`.
- Tests: permission matrix unit tests (every role × every action), invite/accept flow.

### Phase 8 — Cost observability + branded emails (≈1–2 weeks)
- `usage_events` + `usage_daily_summary` tables (§4a); instrumentation at the two existing AI/WhatsApp choke points (cheap — single call sites).
- Internal margin dashboard (QuoteAI ops only); company-facing usage panel in Settings.
- Swap `LOGO_URL` → `businessProfiles.logoUrl` and the sender display name across every customer-facing email template (§4b) — no dependency on anything else in this plan, safe to ship standalone or even before Phase 7 if there's a reason to prioritize it.
- Stretch: custom sending domain opt-in (Resend domain verification flow) for Elite.
- Tests: usage-event cost snapshotting (a provider price change shouldn't retroactively rewrite historical cost), email template rendering with/without a company logo set.

### Phase 9 — Customer reachout pipeline + WhatsApp send (≈3 weeks)
- `leads` + `lead_events` tables; `/dashboard/leads` kanban view.
- Widget and any future "contact us only" form write to `leads` first; quote generation links `leads.quoteId` after the fact instead of being the only entry point.
- CASL-compliant message templates (identification block + unsubscribe link) for email/SMS/WhatsApp, editable per company, bilingual.
- Follow-up sequence engine on the existing `automation_runs` cron pattern (`lead.followup_due`), configurable cadence, auto-stop on reply/accept/decline/unsubscribe.
- WhatsApp outbound: template submission/approval flow docs, "Send via WhatsApp" on quotes/contracts/invoices reusing `whatsappConnectionsTable`.
- Consent logging (`leads.consentSource`, `lead_events`), unsubscribe endpoint, compliance disclaimer in settings.
- Tests: sequence stop-conditions, consent-gating (a message must never send without a valid consent basis), CASL identification block present on every template.

### Phase 10 — Reachout-adjacent revenue features (≈1–2 weeks, rides on Phase 9's messaging engine)
- Review requests: auto-send (email/SMS/WhatsApp, same engine as Phase 9) N days after `job.completed`, link to Google Business Profile review page (company sets the link once in Settings).
- Job photo galleries: upload tied to milestones (reuses the existing document/storage pipeline), optional "share progress photos" send to the customer via the same channel picker.

### Phase 11 — QuickBooks Online integration (≈2–3 weeks)
- OAuth connection (company connects their QuickBooks account from Settings → Integrations).
- One-directional sync to start (QuoteAI → QuickBooks): paid invoices become QuickBooks sales receipts/invoices, confirmed cost entries become QuickBooks expenses — avoids the much harder two-way reconciliation problem for v1.
- Mapping UI: QuoteAI cost categories ↔ QuickBooks chart-of-accounts (per company, since every company's chart differs).
- Sync status + error surface (a failed sync must be visible and retryable, same idempotent-automation pattern as everything else).
- Explicitly NOT payroll — payroll summary CSV export (already built) remains the payroll boundary; a "push payroll summary to Wagepoint/QuickBooks Payroll" export format is a cheap add-on here if requested, not a live integration.

### Phase 12 — Calendar sync (≈1 week)
- Google Calendar + Outlook (Microsoft Graph) — one-way (QuoteAI → calendar) push of job milestones and worker-assigned schedule blocks as calendar events, updated on change, removed when a milestone is deleted/job archived.

### Phase 13 — Security hardening (≈2 weeks, prioritize before Phases 7/11 go live broadly)
- 2FA (TOTP), login rate-limiting/brute-force alerting, session management UI, security-header audit, Dependabot/`pnpm audit` in CI (§4c).
- Audit log UI surfacing existing `writeAudit` data; anomaly alerting on the `usage_events` stream from Phase 8.
- Secrets-rotation runbook (documented, not automated tooling).
- Budget a third-party penetration test once Phase 7 (team accounts) and Phase 11 (QuickBooks OAuth) are both live — that's the point the attack surface meaningfully widens.
- **Sequencing note**: the login-hardening and audit-log pieces are cheap and have no dependencies — pull them earlier (even before Phase 7) rather than waiting; the pentest specifically should wait until there's more surface area worth testing.

### Phase 14 — Data migration / import (≈2–3 weeks)
- CSV/Excel import: template, upload, column-mapping UI, validation, dedup against `clients` (§4d).
- AI-assisted PDF import: reuses `costs/receiptAi.ts`'s extraction pattern against old quote documents, lands in a review queue (mirrors the existing receipt review queue) — nothing becomes a real record without the company confirming it.
- Explicitly out of scope for v1: live competitor-API integrations (Jobber/Buildertrend/etc.), reconstructing signed contracts or payment history from imported data.
- Tests: dedup correctness (an imported client matching an existing one merges, doesn't duplicate), review-queue confirm/reject flow.

### Backlog (named, not scheduled — §5's remaining gaps)
Customer portal, supplier/vendor UI, materials/inventory tracking, warranty/service-call tracking, public API + webhooks, subscription dunning for QuoteAI's own billing, PIPEDA data export (worth pulling into Phase 13 if the security work is already touching account/session settings).

---

## 7. Open decisions (`DECIDE`)

| # | Question | Recommendation |
|---|---|---|
| 1 | Org model: owner-id-as-org (A) vs. first-class `organizations` table (B) | **A** — ships without touching Phases 0–6; mechanically upgradable to B later if ever needed (§3). |
| 2 | Seat limits + pricing per plan | Base + per-seat, not flat (§3.5): Starter $19–25/1 seat, Pro $49–59/2 seats +$12–15 extra, Elite **$79–99** (up from $59)/5 seats +$12–15 extra. Elite absorbs the price increase since it's where switching cost is highest. |
| 2a | Metering for cost-bearing features | Receipt AI (vision) and WhatsApp outbound get a monthly allowance per tier + metered overage near Meta's/OpenAI's actual cost (§3.5) — everything else (quotes, contracts, invoicing, PDFs, QuickBooks/calendar sync) stays flat/unmetered since it has no real marginal cost. |
| 2b | Annual billing | Add a ~2-months-free annual option (not currently offered) — cash flow + retention lever, more valuable once team accounts raise the cost of losing an account. |
| 3 | WhatsApp BSP | **Reuse existing Meta Cloud API app** (already integrated for inbound) rather than adding Twilio/360dialog. |
| 4 | Accounting integration priority | **QuickBooks Online first** (dominant share in Canada); Sage/Wave later only if customers ask. |
| 5 | Payroll integration | **Export only** (extend the existing CSV), never a live payroll run — stays out of regulated territory. |
| 6 | QuickBooks sync direction | **One-way (QuoteAI → QuickBooks) for v1** — two-way reconciliation is a much bigger, riskier project. |
| 7 | Review-request platform | Google Business Profile first (universally what contractors want reviews on); Houzz/Yelp later if asked. |
| 8 | Branded email sender address | **Logo + display-name swap first** (Phase 8, no dependency on the company); full custom-domain sending offered later as an Elite opt-in requiring the company's own DNS verification (§4b) — can't be done fully on QuoteAI's side alone. |
| 9 | Data migration scope | **CSV/Excel import + AI-assisted PDF import into a review queue** (§4d); explicitly not live competitor-API integrations or reconstructing signed contracts/payment history for v1. |
| 10 | Security investment timing | Cheap items (login hardening, audit log UI) pulled forward, no dependency; the paid penetration test specifically waits until Phases 7 + 11 (team accounts + QuickBooks OAuth) are live, since that's when the attack surface is actually bigger (§4c/Phase 13). |

---

## 8. Legal/compliance notes carried into this plan

- **CASL** (§4.4) governs every automated email/SMS/WhatsApp message — consent, identification, unsubscribe, records. This is a hard requirement, not a nice-to-have, before Phase 9 ships.
- **PIPEDA** — once multiple people can access one company's data (Phase 7) and once lead/customer contact data is being used for automated marketing-adjacent messages (Phase 9), a documented data-handling/privacy-policy update is warranted (a lawyer-review item, same bucket as the contract-template review from Phase 6 — bundle them into one legal-review pass if possible).
- **WhatsApp/Meta platform policy** — template messages must be submitted for approval before use; getting flagged for policy violations (e.g., messaging someone who hasn't interacted in 24h without an approved template) can suspend the number, so the send-flow must enforce the template/session-window rule in code, not rely on the company remembering it.

**Total estimate: roughly 16–21 weeks** across Phases 7–14, plus an unscheduled backlog (§5/§6). Suggested build order: **Phase 7 (team accounts) first** — it's the prerequisite for "office admin sends invoices while owner is on-site," the single most-requested real-world gap once a company grows past one person — followed immediately by **Phase 8** (cheap, standalone, and the branded-email half ships value from day one). Pull the low-cost parts of **Phase 13** (login hardening, audit log) forward alongside Phase 7 rather than waiting until the end; save the penetration test for after Phases 7 and 11 are both live.
