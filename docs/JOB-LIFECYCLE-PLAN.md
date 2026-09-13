# Quote → Contract → Job → Invoice: Product & Implementation Plan

Status: **approved 2026-09-12, all §9 recommendations accepted. Phases 0–2 built (see §10); 0–1 deployed.**

---

## 1. Verdict on the idea

The idea is right. It's the Jobber / Buildertrend / Houzz Pro playbook (quote → contract → job management → invoicing) but AI-first, cheaper, and built for small Canadian contractors who today do this with PDFs, e-transfers and a notebook. The differentiator isn't any single module — it's that **nothing has to be typed twice**: the quote seeds the contract, the contract seeds the job, the job's payment schedule seeds the invoices, and receipts/timesheets become costs with one tap.

Four things need refining before it's buildable and safe to sell:

| Your framing | Refined | Why |
|---|---|---|
| "AI writes a contract legal in Canada / province" | **Lawyer-reviewed provincial templates; AI fills variables and drafts the scope/schedule/price sections from the quote.** | A fully LLM-generated contract can hallucinate clauses and we can't claim "legal". Templates make the legal part deterministic; AI does the merge and the narrative. The legal-review gate is a pre-launch task, not a code task. |
| "Digital signature if legal here, sent by email, we somehow get the signed doc back" | **Native in-app e-signature via a secure link in the email.** Customer signs on our page; we produce a signed PDF + audit certificate and email it to both parties. | E-signatures are valid across Canada (PIPEDA Part 2; ON *Electronic Commerce Act*; BC/AB *Electronic Transactions Acts*; QC *Act to establish a legal framework for IT*). Construction/renovation contracts are not in the excluded categories (wills, some land transfers, POAs). No email interception needed — the email just carries the link. $0/document vs DocuSign per-envelope pricing. |
| "Manage employees' timesheets and salary" | **Track labour cost (hours × rate × burden), not payroll.** Export a payroll summary; don't compute CPP/EI/withholding. | Payroll is its own regulated product (Wagepoint, QBO Payroll). Building it would sink the project. Labour *cost* is what the job P&L needs. |
| "Machinery, machine loans" | **Equipment register at company level (owned/rented, financing payments) → jobs are charged a usage rate per day/hour.** | A loan payment is overhead, not a job cost. Allocating by usage keeps job margins honest and still shows the loan in company-level cash flow. |

Two things you didn't mention that construction needs and the plan adds:

- **Change orders.** Scope changes mid-job are the #1 cause of margin loss and disputes. A change order = mini-quote → customer e-signs → contract value and invoice schedule update. Without this, "how much we're about to make" is wrong after week 2.
- **Statutory holdback.** ON/BC/AB require a 10% lien holdback on progress payments for construction contracts. Optional per-contract toggle; when on, invoices show the holdback and a final "holdback release" invoice is generated.

Things to explicitly **not** build in v1: payroll, accounting ledger (sync to QuickBooks later), card payments via Stripe Connect (contractors get paid by Interac e-Transfer; 2.9% on a $20k invoice is a non-starter — offer it later as opt-in), worker mobile app (start with a magic-link time-entry page).

---

## 2. What already exists (and what we reuse)

| Area | Exists today | Reuse / gap |
|---|---|---|
| Quote generation, PDF, public link `/p/:id`, accept with name + IP + timestamp | ✅ `routes/quotes.ts`, `routes/public-quotes.ts` | Reuse. Gap: no notification to the company on acceptance; acceptance doesn't create anything downstream. |
| Payment terms on quote | `condizioniPagamento: text[]` (free text) | **Blocker for automation.** Must become a structured payment schedule (§4.1). |
| Tax | `ivaPercentuale` default 22, AI prompt says "13% HST" | Replace with per-province tax config (GST/HST/PST/QST). |
| Clients | Derived on the fly from quotes (`routes/clients.ts`, md5 of name+email+phone) | Need a real `clients` table (contract party, invoice recipient). Backfill from quotes. |
| CRM | `projects`, `project_tasks`, `collaborators` (hourly rate, cents), `project_assignments`, `extra_costs`, `suppliers`; one 1,900-line page at `/crm` | Keep tables, extend. Rebuild UI as `/dashboard/jobs` with tabs (§6). |
| Invoicing | `/dashboard/invoices` "Coming soon"; `/crm/invoices/generate` is a Fatture in Cloud mock | Replace entirely with native invoicing. |
| Document upload + AI extraction | `uploaded_documents` → OpenAI extraction → `price_intelligence` | Reuse the pipeline for receipts/supplier invoices → cost entries. |
| Email | Resend + webhook → `email_events` | Reuse; add contract/invoice/notification templates. |
| Auth / billing | better-auth, Stripe subscriptions ($19/$49/$59) | Gate features by plan. |
| AI | OpenAI gpt-4o / gpt-4o-mini via `lib/integrations-openai-ai-server` | Reuse for contract merge, milestone planning, receipt extraction, assistant (function calling). |
| Infra | Vercel: single serverless function, 60 s max, **no cron, no queue** | Add Vercel Cron (`vercel.json` `crons`) + an `automation_runs` table for retries. Keep every automation idempotent and < 60 s. |
| i18n | EN / FR contexts in `src/i18n` | All new UI needs both. Quebec contracts must be offered in French. |

---

## 3. The end-to-end flow (target)

```
Company                     Customer                       System
───────                     ────────                       ──────
Create quote ──────────────────────────────────────────────▶ payment schedule structured
Send (email link / PDF)  ─▶ opens /p/:id
                            Accepts (name, IP, ts) ───────▶ ▸ notify company
                                                             ▸ draft contract from quote + province template
Review contract, sign ──────────────────────────────────▶   ▸ email customer secure signing link
                            Signs (draw/type, OTP) ───────▶ ▸ signed PDF + audit cert → object storage (hash)
                                                             ▸ email final PDF to both
                                                             ▸ create Job: milestones, schedule, cost budget (AI proposal)
                                                             ▸ deposit invoice (draft or auto-send per settings)
"Review job setup" (1 click) ────────────────────────────▶   ▸ job active
Work: receipts → AI → costs; time entries; tasks
Mark milestone complete ────────────────────────────────▶   ▸ progress invoice generated (+ holdback if on) → send
                            Pays by e-transfer / card
Mark paid ──────────────────────────────────────────────▶   ▸ AR updated; reminders stop
Change order → customer signs ──────────────────────────▶   ▸ contract value + schedule updated
Job complete ───────────────────────────────────────────▶   ▸ final invoice (+ holdback release after lien period)
Dashboard: margin, cash, timeline, AR — and an assistant that can answer/act on any of it
```

"Fluent, not mechanical": the company never fills a form to create the job. They receive **one** message — *"Maria Rossi signed. We set up 'Kitchen reno – 12 Main St' with 4 milestones, a schedule ending Nov 14 and a $3,000 deposit invoice ready to send. Review →"* — and land on a review screen where everything is editable and confirmed with one click.

---

## 4. Data model (new / changed)

All new money columns are **integer cents** (matches CRM tables; quotes stay `numeric` and are converted at the boundary).

### 4.1 Structured payment schedule (on quotes, copied to contracts)
```ts
paymentSchedule: {
  currency: "CAD",
  terms: [
    { id, type: "deposit" | "milestone" | "completion" | "holdback_release",
      label, trigger: "on_signing" | "milestone:<milestoneKey>" | "on_completion" | "days_after:<n>",
      amountType: "percent" | "fixed", value, dueDays: 15 }
  ],
  holdback: { enabled: boolean, percent: 10 }
}
```
AI extracts this from the quote's free-text terms at generation time; the quote editor gets a proper "Payment schedule" section. Existing `condizioniPagamento[]` is kept as the human-readable rendering.

### 4.2 Province tax config (business profile + client)
`business_profiles.province`, `gstHstNumber`, `qstNumber`, `defaultTaxProfile`. Tax profiles table seeded: ON HST 13%; BC GST 5% + PST 7%; AB GST 5%; QC GST 5% + QST 9.975%; others. Quotes/invoices store line-level tax breakdown.

### 4.3 Clients
`clients` (id, userId, name, email, phone, address, city, province, postalCode, type: individual|business, businessNumber, notes). Quotes get `clientId` (nullable, backfilled by the same md5 grouping used today).

### 4.4 Contracts & signatures
- `contract_templates` (id, userId nullable = system, province, language, version, bodyMarkdown with `{{variables}}` and `{{#sections}}`, status).
- `contracts` (id, userId, quoteId, clientId, projectId, templateId, province, language, status: draft|sent|viewed|partially_signed|signed|declined|voided|expired, variables jsonb, renderedHtml, contractValueCents, paymentSchedule jsonb, holdback, unsignedPdfUrl, signedPdfUrl, documentHash, sentAt, expiresAt, signedAt).
- `contract_signers` (id, contractId, role: company|customer, name, email, token (hashed), status, otpVerifiedAt, signedAt, signatureImageUrl, signatureType: drawn|typed, ip, userAgent, consentText).
- `contract_events` (audit trail: created, sent, viewed, otp_sent, otp_verified, signed, completed, reminder_sent…). Rendered into the audit certificate page of the signed PDF.
- `change_orders` (id, projectId, contractId, number, description, items jsonb, amountCents, taxCents, status, scheduleDelta, signed via the same signer/event tables).

### 4.5 Jobs (extend `projects`)
Add: `clientId`, `contractId`, `address`, `province`, `contractValueCents`, `changeOrdersCents` (derived), `setupStatus: pending_review|confirmed`, `plannedStart/End`, `progressPercent`, `taxProfile`.
- `milestones` (id, projectId, key, title, description, sortOrder, plannedStart, plannedEnd, actualStart, actualEnd, status, paymentTermId nullable, sourceChapter).
- `project_tasks` gets `milestoneId`.
- `cost_budget_lines` (projectId, category, chapterRef, plannedCents) — AI-proposed split of the quote into expected costs; drives *projected* margin.

### 4.6 Costs, time, equipment
- `cost_entries` (id, userId, projectId, milestoneId?, category: materials|labour|subcontractor|permits_fees|equipment|misc|tax_nonrecoverable, vendor/supplierId, description, date, subtotalCents, taxCents (GST/HST/PST/QST split), totalCents, sourceDocumentId?, timeEntryId?, status: pending_review|confirmed, createdBy: user|ai|system). Replaces `extra_costs` (migrate rows as `misc`).
- `workers` (evolve `collaborators`): type employee|subcontractor, hourlyRateCents, burdenPercent (employer CPP/EI/WSIB — company sets, default 15%), overtimeRule, magicLinkToken, active.
- `time_entries` (id, workerId, projectId, milestoneId?, date, hours, rateCentsSnapshot, burdenSnapshot, note, approvedAt). Approved entries materialise a labour `cost_entry`.
- `equipment` (id, userId, name, ownership: owned|rented|financed, purchaseCents, financing: {lender, monthlyPaymentCents, remainingMonths}, usageRateCents per hour|day). `equipment_usage` (equipmentId, projectId, date, quantity) → equipment `cost_entry`.

### 4.7 Invoices
- `invoices` (id, userId, projectId, clientId, contractId?, number (per-company sequence, e.g. `INV-2026-0042`), type: deposit|progress|final|holdback_release|change_order|manual, status: draft|sent|viewed|partially_paid|paid|overdue|void, issueDate, dueDate, lines jsonb, subtotalCents, taxBreakdown, holdbackCents, totalCents, paidCents, pdfUrl, publicToken, sentAt, paymentInstructions (e-transfer email, etc.), milestoneId?, paymentTermId?).
- `invoice_payments` (invoiceId, date, amountCents, method: etransfer|cheque|cash|card|other, reference).
- `invoice_sequences` (userId, year, next).

### 4.8 Automation plumbing
- `automation_runs` (id, userId, event: quote.accepted|contract.signed|milestone.completed|invoice.overdue…, entityId, idempotencyKey unique, status, attempts, lastError, payload). Handlers run inline in the triggering request; failures are retried by cron.
- `notifications` (userId, type, title, body, link, readAt) → in-app bell + email digest.
- `audit_log` (userId, actor, entityType, entityId, action, diff).

---

## 5. Legal & compliance notes baked into the design

These are product requirements, not legal advice; the templates must be reviewed by a Canadian lawyer before you market them as compliant (**launch gate**).

- **Ontario** — *Consumer Protection Act* (written contract requirements; **10-day cooling-off** for direct agreements signed at the consumer's home — very common for renovators, so the template includes the statutory cancellation notice); *Construction Act* (10% holdback, prompt payment 28 days, proper invoice requirements).
- **British Columbia** — *Business Practices and Consumer Protection Act* (direct sales 10-day cancellation); *Builders Lien Act* (10% holdback, 55-day lien period).
- **Alberta** — *Consumer Protection Act* + Prepaid Contracting Business licence disclosure; *Prompt Payment and Construction Lien Act* (10% holdback).
- **Quebec** — Civil Code (contract of enterprise, arts. 2098–2129); *Consumer Protection Act* (itinerant merchant 10-day cancellation); **RBQ licence number must appear**; **French version required** (Charter of the French Language) — English only if the customer expressly requests it in writing (we capture that choice).
- **Everywhere** — GST/HST registration number on invoices ≥ $30; buyer name ≥ $150; tax shown separately (CRA invoice requirements). Sequential, non-reusable invoice numbers.
- **E-signature evidence** — identity (email OTP), intent (explicit consent checkbox with text), integrity (SHA-256 of the unsigned and signed PDF stored; signed PDF immutable), attribution (IP, UA, timestamp per signer), retention (object storage, never deleted on project delete — void instead).
- **Data** — signed contracts and invoices are financial records; keep 7 years (CRA). Project deletion becomes archival.

Templates shipped: ON, BC, AB, QC (EN+FR), Generic-Canada. Companies can also upload their own template with `{{variables}}`.

---

## 6. UI (in line with the existing dashboard style)

New navigation: **Dashboard · Quotes · Clients · Jobs · Invoices · Team · Documents · Analytics · Settings**. `/crm` is retired (redirect to `/dashboard/jobs`).

- **Quote detail** — new "Payment schedule" card; after acceptance a "Contract" card (draft → send → status timeline).
- **Contract editor** `/dashboard/contracts/:id` — left: rendered contract with editable AI sections (scope, schedule, price) and locked legal sections (with "why is this locked?" tooltips); right: signers, status, send. Preview PDF.
- **Public signing page** `/sign/:token` — no login: contract view → OTP to email → consent checkbox → draw/type signature → done screen with download. Mobile-first (customers sign on phones).
- **Job page** `/dashboard/jobs/:id` — tabs: **Overview** (contract value, invoiced, collected, costs, projected vs actual margin, timeline strip), **Schedule** (milestones Gantt + tasks), **Costs** (entries by category, budget vs actual, receipt upload dropzone → AI review queue), **Team & time** (assignments, time entries, approve), **Invoices**, **Documents** (contract, change orders, receipts, photos), **Assistant** (chat scoped to this job).
- **Job setup review** — first screen after signing: AI-proposed milestones/dates/budget as editable cards, one "Looks good, start the job" button.
- **Invoices** `/dashboard/invoices` — list with AR aging; invoice detail with send / mark paid / remind; public `/i/:token` view for the customer with payment instructions.
- **Team** `/dashboard/team` — workers, rates, burden, equipment register; magic-link time entry page `/t/:token` for workers.
- **Analytics** — add: margin by job, AR aging, cash in vs out by month, labour hours by worker, quote→contract conversion.
- **Assistant** — reachable from every job and from the dashboard; can read everything, and *propose* writes (add cost, create milestone, draft invoice, log time) that the user confirms inline.

Charts: recharts (already installed); follow the `dataviz` skill palette rules for consistency.

---

## 7. Implementation phases

Each phase is shippable on its own and behind a feature flag (`business_profiles.featureFlags`). Estimates are focused build time with the whole pipeline (schema → API → UI → tests → FR strings).

### Phase 0 — Foundations (≈1 week)
- `clients` table + backfill; `clientId` on quotes.
- Structured `paymentSchedule` on quotes; AI extraction of it; quote editor UI; PDF rendering.
- Province tax profiles; replace `ivaPercentuale` semantics (keep column, fix defaults/prompt).
- `automation_runs`, `notifications`, `audit_log`; Vercel Cron endpoint `/api/cron/tick` (secret header) running every 15 min.
- Company notification email on quote acceptance (immediate win).
- Feature-flag helper + plan gating map.

### Phase 1 — Contracts & e-signature (≈2–3 weeks)
- Template engine (markdown + variables + conditional sections), 5 templates × EN/FR.
- `POST /contracts/from-quote/:quoteId` → AI merge (scope, schedule narrative, price table) → draft.
- Editor UI; company sign; `POST /contracts/:id/send` → Resend email with signing link (hashed token, 30-day expiry).
- Public signing flow: view → OTP → consent → signature (canvas/typed) → `POST /sign/:token/complete`.
- Signed PDF generation (existing puppeteer path) with signature page + audit certificate; hashes; storage; emails to both parties.
- Reminders (cron: unsigned after 3 and 7 days); void/expire; decline with reason.
- Automation: `quote.accepted` → auto-draft contract + notify.

### Phase 2 — Job setup automation, milestones, change orders (≈2 weeks)
- `contract.signed` → create/attach project, client, milestones (AI from chapters + payment schedule), schedule (AI, editable), cost budget lines (AI split), tasks; `setupStatus = pending_review`; single notification.
- Job page shell with Overview + Schedule tabs; setup-review screen; Gantt.
- Change orders (create → customer e-sign via Phase 1 machinery → contract value + schedule update).
- Retire `/crm` (redirect); migrate its working parts into Jobs.

### Phase 3 — Costs, team & time, receipt AI (≈2–3 weeks)
- `cost_entries`, categories, Costs tab with budget-vs-actual.
- Receipt / supplier-invoice upload → AI extraction (vendor, date, lines, GST/HST/PST/QST, total, suggested category + job) → review queue → confirm.
- Workers (evolve collaborators), burden, equipment register + usage.
- Time entries + approval → labour cost; worker magic-link time page; payroll summary export (CSV).
- Team tab, Documents tab.

### Phase 4 — Invoicing (≈2 weeks)
- Invoice model, per-company numbering, CRA-compliant PDF (bilingual), public view, send, mark paid / partial, void, credit note.
- Automations: `contract.signed` → deposit invoice; `milestone.completed` → progress invoice (holdback applied); `job.completed` → final; holdback release after lien period. Company setting: auto-send vs review (default review, with "auto-send after 24 h if not touched").
- Cron: overdue detection + reminder emails (3/7/14 days), AR aging.
- Replace mock `/crm/invoices/generate`.

### Phase 5 — Dashboards & assistant (≈2 weeks)
- Job Overview charts; company Analytics additions; cash-flow view.
- Assistant: OpenAI function-calling over a tool set (`get_job_summary`, `list_costs`, `list_invoices`, `propose_cost_entry`, `propose_milestone`, `propose_invoice`, `get_schedule_risks`…). Every write is a proposal card the user confirms. Conversation stored per job.

### Phase 6 — Launch readiness (≈1–2 weeks)
- **Legal review gate**: templates + signing consent text + invoice format reviewed by a Canadian lawyer/accountant; incorporate edits.
- End-to-end test suite: quote → accept → contract → sign (both) → job → costs → milestone → invoice → paid, in EN and FR, ON and QC.
- Mobile pass on signing, invoice and time-entry pages.
- Rate limits on all public token endpoints; token hashing; storage ACLs.
- Onboarding: province + tax numbers + RBQ/licence + e-transfer email + default payment schedule + signature.
- Pricing gating (`DECIDE`), migration rehearsal on a prod snapshot, monitoring (PostHog events per automation, alerts on `automation_runs` failures), help articles.

**Total: roughly 11–14 weeks** of focused work, delivered phase by phase. Phase 0 + 1 alone already give a sellable "quote → signed contract" product.

---

## 8. Production-readiness principles (applied in every phase)

1. **Idempotent automations** with unique idempotency keys; every automation logs a run; cron retries failures (max 5) and alerts.
2. **Nothing auto-sends money-related email without an explicit company setting**; defaults are "draft + notify".
3. **Immutable financial documents**: signed contracts and sent invoices are never edited — void and reissue.
4. **Every public URL is a hashed, expiring, single-purpose token** with rate limiting (existing pattern in `public-quotes.ts`).
5. **Integer cents, explicit tax breakdown, province on every money document.**
6. **Bilingual from day one** — no new string without an EN and FR key; QC defaults to FR.
7. **Plan gating in one map**, not scattered `if`s.
8. **Serverless-safe**: no work > 60 s in a request; PDFs generated once and cached in storage; AI calls with timeouts and fallbacks (if milestone planning fails, the job is still created with one milestone per payment term).
9. **Migrations are additive** in each phase; old columns removed one phase later.
10. **Tests for every automation handler** and for tax/holdback/invoice math.

---

## 9. Decisions needed (`DECIDE`)

| # | Question | Recommendation |
|---|---|---|
| 1 | E-signature: native vs DocuSign/Dropbox Sign integration | **Native.** Legally sufficient in Canada, seamless, free. Add DocuSign as an opt-in later if a customer demands it. |
| 2 | Contract generation: template + AI merge vs fully AI-generated | **Template + AI merge.** Only way to make a defensible compliance claim. |
| 3 | Provinces at launch | **ON, BC, AB, QC + Generic.** ~85% of the market. |
| 4 | Payments: manual tracking + e-transfer instructions vs Stripe Connect card payments | **Manual + e-transfer first.** Stripe Connect opt-in in a later phase. |
| 5 | Payroll | **Out of scope.** Labour cost + payroll summary export only. |
| 6 | Retire `/crm` in favour of `/dashboard/jobs` | **Yes**, in Phase 2. |
| 7 | Plan gating | Suggest: Starter = quotes + acceptance notifications; Pro = contracts/e-sign + jobs + costs + invoicing; Elite = assistant + team/time + equipment + analytics. |
| 8 | Team accounts (multi-user per company) | **Defer.** Workers use magic links; full roles later. |
| 9 | Legal review | Budget for a Canadian construction/consumer-law lawyer to review the 5 templates before launch. Non-negotiable if you market "compliant". |

Reply with any changes to these and I'll start Phase 0.

---

## 10. Build log

### Phase 0 — Foundations ✅ (built 2026-09-12, not yet deployed)

**Schema** (`lib/db/src/schema/`): `clients.ts`, `payment-schedule.ts` (zod + parser + validation), `tax.ts` (all 13 provinces/territories, GST/HST/PST/QST split), `automation.ts` (`automation_runs`, `notifications`, `audit_log`), `plans.ts` (feature ↔ tier map with per-profile overrides). `quotes` gained `client_id`, `province`, `payment_schedule`; `business_profiles` gained province, GST/HST/QST/PST numbers, licence, e-transfer email, default payment schedule, automation settings, feature flags.

**Migration**: `lib/db/drizzle/0001_phase0_foundations.sql` — additive, idempotent, backfills `clients` from existing quotes and links them. Apply with `pnpm --filter @workspace/db push` (needs `DATABASE_URL`) or paste the SQL into the Supabase SQL editor. Then set `CRON_SECRET` in Vercel (the `crons` entry in `vercel.json` calls `/api/cron/tick` every 15 min).

**Server** (`artifacts/api-server/src/`):
- `lib/automation.ts` — idempotent event runner with backoff retry; `automations/quoteAccepted.ts` — first handler (in-app notification + email to the company, audit entry).
- `routes/cron.ts`, `routes/notifications.ts`.
- `lib/clients.ts` — `ensureClientForQuote` + post-insert hook on all 5 quote-creation paths (web, manual, duplicate, widget, WhatsApp) that links the client, stamps the province and applies the company's default payment schedule.
- `lib/tax.ts` — replaced the Italian `?? 22` VAT fallback with the company's provincial rate.
- `routes/quotes.ts` — serializer returns `clientId`, `province`, `taxProfile`, `paymentSchedule` (derived from the free-text terms when not stored); `PUT` accepts `paymentSchedule` (validated: sums to total, one on-signing term) and `province`; the quote email now carries a **View & accept online** button.
- `routes/business-profile.ts` — new fields + returns `plan` and a `features` map.

**Frontend** (`artifacts/quote-ai/src/`): `components/payment-schedule-editor.tsx`, `components/payment-schedule-card.tsx` (quote detail sidebar), `pages/dashboard/settings-business-tab.tsx` (Settings → Business), `components/notifications-bell.tsx` (sidebar, 60 s polling), `lib/plans.ts`, `lib/payment-schedule.ts`; EN + FR strings.

**Verified**: workspace typecheck, api-server build, unit checks on parser/tax/plans. Not yet verified against a live DB (no `DATABASE_URL` locally).

**Deferred to Phase 2**: switching `/api/clients` and the Clients pages from the derived view to the `clients` table (the table is populated and linked; the read path is unchanged so nothing breaks).

### Phase 1 — Contracts & e-signature ✅ (built 2026-09-12, not yet deployed)

**Schema**: `lib/db/src/schema/contracts.ts` — `contracts` (structured document + variables, status machine draft→sent→viewed→signed / declined / voided / expired, PDF hashes), `contract_signers` (contractor + customer; hashed signing token, OTP, signature, consent, IP/UA), `contract_events` (audit trail), `contract_sequences`. Migration `lib/db/drizzle/0002_phase1_contracts.sql`.

**Templates** (`artifacts/api-server/src/contracts/templates.ts`): one 16-section construction services agreement, EN + FR, with province-specific clauses for ON (CPA 2002 cooling-off, Construction Act holdback), BC (BPCPA, Builders Lien Act), AB (CPA, PPCLA prompt payment), QC (LPC itinerant merchant, RBQ licence, Civil Code hypothec, French-language clause when English is requested) and a generic Canada variant. Legal sections are locked; scope + schedule are AI-drafted from the quote (gpt-4o-mini, deterministic fallback); price, payment schedule and parties are rendered from variables. `TEMPLATE_VERSION` is stamped on every contract. **Lawyer review still required before marketing as compliant.**

**Rendering**: `render.ts` (markdown-lite → HTML for preview/signing page), `pdf.ts` (pdfmake — Vercel-safe; signature page + electronic-signature certificate with event log, IPs, and SHA-256 fingerprints of the sent and signed documents).

**Flow** (`contracts/service.ts`, `routes/contracts.ts`, `routes/sign.ts`): draft from quote (manual or auto on `quote.accepted`) → company edits editable sections/variables → company signs (draw/type) → send: unsigned PDF frozen + hashed, 30-day single-purpose token emailed → customer opens `/sign/:token` (viewed event) → email OTP (6 digits, 10 min, 5 attempts) → consent + signature → `finalizeContract`: signed PDF with audit page stored in private bucket, both parties emailed the PDF, quote marked accepted, `contract.signed` automation raised. Decline with reason notifies the company. Cron: expiry + reminders at 3/7/14 days (re-issues token). Rate-limited by IP on all public endpoints.

**Frontend**: `/dashboard/contracts` (list + stats + filters), `/dashboard/contracts/:id` (progress steps, rendered document, edit mode, sign/send/void dialogs, signers, activity), `/sign/:token` (mobile-first public signing page in the contract's language), Contract card on the quote page, nav item (Pro), `signature-pad.tsx`, EN + FR strings.

**Verified**: workspace typecheck, api-server build, template/render/PDF pipeline for ON/BC/AB/QC/NS × EN/FR (sample PDFs generated). Not verified against a live DB/email.

**Deferred**: company-uploaded custom templates; AI "regenerate this section" button; contractor countersign-after-customer flow is supported by the API but the UI always signs first.

### Deployment notes (2026-09-12)
- Both migrations (0001, 0002) are applied to the production Supabase project `quoteai` (new tables created with RLS enabled; the API connects as the postgres role so RLS does not affect it).
- Vercel deploys are made from the local machine with `npx vercel deploy --prod --yes` (project `quote-ai`, Hobby plan) — GitHub pushes do NOT auto-deploy.
- Hobby plan allows one cron run per day → `vercel.json` cron is `0 12 * * *`. Reminders/retries are batched daily; the accept/sign automations run inline.
- `CRON_SECRET` must be set in Vercel env vars for `/api/cron/tick` to accept the tick.
- Live test on 2026-09-12: quote email → accept → notification worked end-to-end.

### Phase 2 — Job setup automation, milestones, change orders ✅ (built 2026-09-12, not yet deployed)

**Schema** (`lib/db/src/schema/`): `projects` gained `client_id`, `contract_id`, `address`, `province`, `contract_value_cents`, `change_orders_cents`, `setup_status` (pending_review|confirmed), `setup_proposal`, `planned_start/end`, `progress_percent`, `completed_at`; `project_tasks` gained `milestone_id`, `sort_order`. New `jobs.ts`: `milestones` (key, dates, status, linked payment term + snapshot amount, source chapter, value), `cost_budget_lines` (category, planned cents), `change_orders` (items, subtotal/tax/total cents, schedule delta, status, applied_at). `contracts` gained `kind` (agreement|change_order), `parent_contract_id`, `change_order_id`. Migration `lib/db/drizzle/0003_phase2_jobs.sql` (additive, idempotent; backfills legacy projects' value + client).

**Job setup automation** (`artifacts/api-server/src/jobs/`): `plan.ts` (pure) builds the deterministic plan — one milestone per quote chapter (fallback: one per payment term, or a single "Work" milestone) plus a final "Completion & walkthrough" milestone; milestone-triggered payment terms are mapped onto chapters by keyword overlap → start/completion words → even spread (with an order check); on_completion terms link to the final milestone; durations from the contract's estimated weeks (else a value-based guess) split by chapter value; tasks = chapter line items (≤8 per milestone); cost budget = 72% of pre-tax price split materials 42 / labour 40 / sub 5 / permits 3 / equipment 4 / misc 6. `setup.ts` lets gpt-4o-mini (20 s timeout) refine only durations, cost ratio and split — it never invents milestones, so payment links survive — then persists everything in one transaction (`setupStatus = pending_review`, adopts a legacy project already linked to the quote, idempotent on retry) and stamps `contracts.project_id`. `dates.ts` = Mon–Fri working-day layout. Verified with a sample 4-chapter quote: 15/35/35/15 schedule → A gets "start of work", D gets "substantial completion", completion milestone gets the final balance.

**Automations**: `contract.signed` now branches on kind — agreements run `setupJobFromContract` and send ONE notification ("Maria signed CTR-… — job set up with N milestones, schedule ending …, deposit $X due now. Review →" → `/dashboard/jobs/:id/setup`); on failure a plain "signed" notification is sent once and the cron retries the setup. Change-order documents run `applySignedChangeOrder` (claims `applied_at` atomically, adds the total to `change_orders_cents`, shifts open milestones + planned end by the schedule delta, notifies). `finalizeContract` no longer sends its own notification. New `milestone.completed` (notifies which payment term is now due — Phase 4 will draft the invoice) and `job.completed` handlers.

**Change orders** (`jobs/changeOrders.ts`): the signable document is a `contracts` row with kind = change_order and a 6-section EN/FR document (parties, agreement being amended, description [editable], price change with itemised table + province taxes, schedule delta, signatures). It reuses the entire Phase 1 machinery unchanged — contractor sign → send → OTP → customer sign → PDF + audit certificate → `contract.signed`. Numbered `CO-01…` per job, document numbered `<contract>-CO-01`. `applyVariableEdits` leaves change-order documents alone.

**API** (`routes/jobs.ts`, Pro-gated on "jobs" for creation): `GET/POST /api/jobs`, `GET/PUT/DELETE /api/jobs/:id` (delete refused when a signed contract backs the job), `PUT /jobs/:id/setup` + `POST /jobs/:id/setup/confirm` (edit milestones — ids kept so tasks stay attached, re-link payment terms with amount snapshots — and budget; confirm flips to active and recomputes progress) + `POST /jobs/:id/setup/regenerate`; milestones CRUD + status (completion raises `milestone.completed`, progress % = completed value ÷ total value); tasks CRUD with milestone links; `PUT /jobs/:id/budget`; change orders create/update(draft)/delete(draft); costs (legacy `extra_costs` until Phase 3). Contract serializer returns `kind`, `parentContractId`, `changeOrderId`.

**Frontend** (`artifacts/quote-ai/src/`): `/dashboard/jobs` (stats, filters incl. "To review", search, manual-create dialog), `/dashboard/jobs/:id/setup` (review screen: editable name, AI note + rationale, Gantt, milestone cards with dates / payment-term select / reorder / delete / add, shift-whole-schedule start date, payment-coverage strip, budget by category with projected margin, "Looks good, start the job"), `/dashboard/jobs/:id` (KPI strip: value incl. change orders, payments released, budget + projected margin, costs vs budget, progress; tabs Overview · Schedule (Gantt, milestone start/complete/reopen, tasks) · Change orders (list + dialog → contract signing page) · Costs (manual entries, budget vs actual) · Team (assign / add collaborators via legacy CRM endpoints) · Documents (contract, change orders, quote, PDFs)). `components/jobs/gantt.tsx` is a dependency-free CSS Gantt with week columns and a today marker. Contract page shows a "Change order" badge, links back to the job, and links a signed agreement to its job. Quote page "Start job" now creates via `/api/jobs` and opens the job. Nav: Jobs (Pro) replaces CRM; `/crm` and `/crm/*` redirect to `/dashboard/jobs`; `pages/dashboard/crm.tsx` (1.9k lines, mock Fatture in Cloud invoicing) deleted along with its 360 dead strings. EN + FR for every new string.

**Verified**: db/api-server/frontend typecheck, api-server + vite builds, planner unit run, and a browser smoke test of all three pages (EN + FR) against a mock API. Not verified against a live DB.

**Deploy**: apply `0003_phase2_jobs.sql` in Supabase **before** deploying (the contract routes select the new `kind` column).

**Deferred**: suppliers UI (API kept), collaborator management page (Phase 3 Team), switching Clients pages to the `clients` table (still deferred from Phase 0), deposit invoice on signing (Phase 4), holidays in the working-day calendar.

### Phase 3 — Costs, team & time, receipt AI ✅ (built 2026-09-13, not yet deployed)

**Schema** (`lib/db/src/schema/costs.ts`, `crm.ts`, `documents.ts`): `cost_entries` (project/milestone, category, vendor, description, date, subtotal/tax/total cents + GST/HST/PST/QST breakdown, status pending_review|confirmed, source manual|receipt|time_entry|equipment|legacy, created_by, source_document_id, time_entry_id, equipment_usage_id, ai_extraction). `collaborators` evolved into workers (kept name): `worker_type` employee|subcontractor, `burden_percent` (default 15, 0 for subs), `active`, `time_token_hash`/`time_token_expires_at` (magic link), `last_time_entry_at`. `time_entries` (worker, project, milestone?, date, hours, rate + burden snapshots, note, status submitted|approved|rejected, entered_by worker|company, cost_entry_id). `equipment` (ownership owned|rented|financed, purchase, financing {lender, monthly, remaining}, usage rate per hour|day) + `equipment_usage` (quantity, rate snapshot, cost_entry_id). `uploaded_documents` gained `purpose` (price_intelligence|receipt) + `project_id`. Migration `lib/db/drizzle/0004_phase3_costs_team.sql` (additive, idempotent; copies `extra_costs` rows into `cost_entries` as `legacy`/misc with the same ids; maps Italian role values to worker types).

**Receipt AI** (`artifacts/api-server/src/costs/receiptAi.ts`): photo → gpt-4o vision, PDF → pdf-parse + gpt-4o-mini, JSON mode, timeouts. The prompt lists the company's open jobs (name, address, client) so the model can pick `suggestedProjectId`; category taxonomy matches the budget categories. `normalizeReceipt()` is pure: clamps suggestions to known values, fills subtotal/total/taxes from each other, attributes an unitemised tax to the province's components (QC → GST+QST split), RST→PST. Unit-run on 4 cases (ON itemised HST, QC total-only, missing subtotal, garbage). AI failure still creates a blank pending entry.

**Cost service** (`costs/service.ts`): serializers, `costSummary` (confirmed totals by category + pending), `syncLabourCost` (approved time entry → labour cost = hours × rate × (1+burden), idempotent upsert on `time_entry_id`; un-approving deletes it), `syncEquipmentCost` (usage → equipment cost), `approvedHoursByWorker`.

**API**: `routes/costs.ts` (Pro "costs"): `GET/POST /jobs/:id/costs`, `PUT /jobs/:id/costs/:cid` (edit, confirm, move to another job; derived labour/equipment entries are locked), `DELETE`, `GET /costs/review` (all pending incl. unmatched), `POST /costs/receipts` (multipart, optional projectId; stores under `receipts/<user>/`, runs AI, creates pending entry; 60/h), `GET /costs/receipts/:docId/file`. `routes/team.ts`: workers CRUD (delete → deactivate when hours exist), `POST/DELETE /team/workers/:id/invite` (180-day hashed token, emails via `lib/emailTeam.ts` when the worker has an email, otherwise returns the URL), time entries list/filter, `POST /jobs/:id/time-entries` (company-entered, approved by default), `PUT /team/time-entries/:id` (approve freezes current rate/burden; reject; edit), bulk approve, delete, `GET /team/payroll-summary.csv?from&to` (per worker × job: hours, rate, gross, burden, labour cost + worker totals — no payroll math), equipment CRUD, `POST/DELETE /jobs/:id/equipment-usage`, job assignments. Time/equipment/invites are gated on "team_time" (Elite); workers stay open. `routes/worker-time.ts` (public, IP rate-limited): `GET /t/:token` (worker, company, assigned or all open jobs + open milestones, last 30 days of own entries; 410 when expired or the company lost the feature), `POST /t/:token/entries` (last 45 days, ≤24 h/day, one notification per worker per day), `DELETE` while submitted. `jobs.ts` detail now returns `costs` (confirmed total, pending, by category, entries), `timeEntries`, `equipmentUsage`; legacy `extra_costs` endpoints removed from `jobs.ts` and `crm.ts`.

**Frontend**: `lib/jobs-api.ts` (cost/time/usage DTOs, receipt scan, assignments), `lib/team-api.ts` (workers, time, equipment, worker page). Job page: **Costs** tab (`components/jobs/costs-tab.tsx` — dropzone → AI → review queue with one-click confirm, entries with source icons + category filter, budget-vs-actual per category with over-budget colouring, pending hint; `cost-entry-dialog.tsx` shows the receipt image + AI lines + confidence next to editable fields with tax split, "Confirm $X"), **Team** tab (`team-tab.tsx` — log hours per worker/milestone, approve/reject/reopen, equipment usage log, assignments), Documents tab lists receipts, tab badges for pending items, KPI "Costs" shows "n to review". `/dashboard/team` (`pages/dashboard/team.tsx`): Workers (type, rate + burden → loaded rate, invite link dialog with copy, revoke, deactivate), Time entries (approval queue with select/bulk approve, filters, payroll CSV link), Equipment (register, financing overhead line). `/t/:token` (`pages/t/[token].tsx`): mobile-first worker page in the company's language (job cards, phase, date, ± hours with 4/6/8/10 chips, note, submit, recent entries with status, delete while pending). Jobs list gets a "Receipt inbox" strip (scan from anywhere, review unmatched receipts and assign a job). Nav: Team (Pro). EN + FR for every new string; the three "next release" hints are gone.

**Verified**: db/api-server/frontend typecheck, api-server + vite builds, `normalizeReceipt` unit run, browser smoke test against a mock API (Costs tab + review dialog + confirm, Team tab, Team page approve-all, worker page submit in FR, jobs list inbox). Not verified against a live DB, storage or OpenAI.

**Deploy**: apply `0004_phase3_costs_team.sql` in Supabase **before** deploying (the job detail selects the new columns/tables).

**Deferred**: suppliers UI (still API only), per-line receipt splitting across categories, photo attachments beyond receipts, overtime rules, worker PWA install prompt, notifications digest for pending hours.
