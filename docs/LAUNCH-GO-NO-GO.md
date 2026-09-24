# QuoteAI — Launch go / no-go review (Phase 70)

Prepared 2026-09-21 (refreshed 2026-09-23, Phase 98) as the last step of `QA-VERIFICATION-PLAN.md` (Phases 61-69 closed). Phase 70 is the **human gate**: nothing below is code that can be written — each line is a decision, a purchase, a registration or a review that only the owner can make. This document is the agenda for that review, with the current state of every item and exactly where to act.

Legend — **Owner** is who has to do it; **Blocks launch?** is the recommendation, not a rule. Tick the box, date it, and record the decision in §5.

---

## 1. Go / no-go criteria (recommended blockers)

These are the items that, if left open, put real customers' money, contracts or data at risk on day one. Everything else can follow launch.

**State refreshed 2026-09-23 (Phase 98)** from what the systems answer, not from memory: `ops:preflight` against https://quoteai.ca (API, database, cron, headers, tax rates, schema drift 0, no test accounts in production — all pass; one blocker, the legal identity), `gh` (repository secrets and workflow runs) and `ops:owner-check`. Each item carries its Phase 99 number from `LAUNCH-FINISH-PLAN.md`.

**Before ticking anything, run:**
```bash
CRON_SECRET='…' pnpm ops:owner-check
```
It prints every Phase 99 item as DONE / PARTIAL / TODO / MANUAL with the next step, and exits 1 while any L-item is open. `CRON_SECRET` (from the password manager; Vercel won't show it) lets it ask the deployment which variables are set and whether the Stripe ids and pilot code are valid for the live key; `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` + `VERCEL_TEAM_ID` add the Sensitive check (1.9). `pnpm --filter @workspace/api-server ops:preflight -- --url https://quoteai.ca` remains the deployment's own health check.

| # | Item | State 2026-09-23 | What to do | Owner | Blocks launch? |
|---|---|---|---|---|---|
| 1.1 | **Database backups** (L-1) | **None exist.** The GitHub repository has **no Actions secrets at all**; the nightly Backup workflow runs every morning and finishes green in ~10 s because it skips ("BACKUP_DATABASE_URL secret not set") — a green run is not a backup, only an artifact is (`ops:owner-check` checks for one). Supabase Free: no daily backups, no PITR. | Set `BACKUP_DATABASE_URL`, `BACKUP_SUPABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (RUNBOOKS §5), run Actions → Backup once, download the artifact. Optionally Supabase Pro. | Owner | **Yes** |
| 1.2 | **Restore rehearsal** (L-2) | Never run against a second database. Now one command: `ops:rehearse --target <url>` backs production up, restores it into the target with `--wipe`, runs schema drift and records the result in `docs/RESTORE-REHEARSALS.md` (empty today). Production today: 101 tables, 193 rows. | Reset the password of the unused July project `cynlsphsuxrnctsxcmve` and hand the assistant its pooler URL (RUNBOOKS §36). | Owner (URL) → assistant (run) | **Yes** — a backup nobody has restored is not a backup |
| 1.3 | **Legal review of the contract templates** (L-3) | `TEMPLATE_VERSION = 1`, never read by a lawyer. **The packet is ready**: `docs/legal-packet/QuoteAI-legal-packet.pdf` — questions, recipients of personal information, the signing evidence, all six templates rendered by the product, and the live terms and privacy policy in English and French (§2). | Send the PDF to a Canadian construction/consumer-law lawyer. Changes → the assistant applies them and bumps `TEMPLATE_VERSION`. | Owner | **Yes if contracts are sold as a feature at launch**; No if launch is quotes-only and contracts follow the review |
| 1.4 | **ToS / privacy policy review** (L-3, L-4) | English and French (`/terms`, `/privacy-policy`, `/fr/conditions`, `/fr/confidentialite`, Phase 95). Phase 98 added the three recipients the privacy policy was missing (Twilio for SMS, Sentry for error reports, the browsers' push services). Unreviewed. The business is named only "QuoteAI": `lib/legal-entity` is blank (`ops:preflight`'s one FAIL). | Same lawyer, same packet. Give the assistant the registered name and address (1.5). | Owner | **Yes** |
| 1.5 | **Registered business identity in outbound messages** (L-4) | The plumbing is done (Phase 73): the privacy policy, terms, footer, billing page and every QuoteAI email read `lib/legal-entity`. It is blank, so CASL's name + mailing address are missing from QuoteAI's own emails. Contractors' messages carry the contractor's details (correct). | Decide the legal name, mailing address, GST/HST and QST numbers, and the person in charge of personal information (Law 25); the assistant fills the one file. | Owner (decision) → assistant (edit) | **Yes** |
| 1.6 | **Staging Supabase project** (L-5) | Does not exist; no `E2E_*` secrets, so CI's e2e job skips and the e2e suite runs against **production** by hand. Production has no leftover test accounts today (preflight). | Create it (or reuse the July slot after 1.2), set `E2E_DATABASE_URL` / `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY`; the assistant applies the migrations and turns CI e2e on. | Owner | **Yes** — the day a real customer exists, e2e must stop touching prod |
| 1.7 | **Error tracking + ops alerts live** (L-6) | `/api/healthz/ops` answers 200, last cron tick 2026-09-24 04:57 UTC. Whether `SENTRY_*`, `CRON_HEARTBEAT_URL`, `OPS_ALERT_EMAIL` are set now can't be read from a checkout (Sensitive) — `ops:owner-check` with `CRON_SECRET` answers it. As of Phase 97 they were unset. | Sentry project + DSNs (RUNBOOKS §1); Healthchecks.io check → `CRON_HEARTBEAT_URL`; uptime monitor on `GET /api/healthz/ops` (RUNBOOKS §2). | Owner | **Yes** — cheap, and the only way to know something broke |
| 1.8 | **Quebec-specific P1s** | **Closed in Phase 71**; preflight re-checks BC 12 % / ON 13 % / QC 14.975 % on the live API (pass today). | Nothing. | — | No |
| 1.9 | **Vercel readable secrets** (P-4) | `STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_SECRET` were Encrypted, not Sensitive; unverified since. `ops:owner-check` checks the types when given a Vercel token. | Recreate the three as Sensitive; redeploy. | Owner | No (hygiene) — but 5 minutes |
| 1.10 | **`TOKEN_ENCRYPTION_KEY` escrow** (L-7) | Sensitive in Vercel, not in `.env.staging`. If lost, every stored OAuth token is unrecoverable. | Confirm it is in the password manager (RUNBOOKS §6); if not, the assistant rotates it now while there are only a handful of token rows. | Owner | **Yes** |
| 1.11 | **Stripe prices and the pilot code** (L-8, L-9) | Live site: 5 paid plans priced; **annual billing says "coming soon"** (no `STRIPE_PRICE_YEARLY_*`); **no pilot code running** (`PILOT_PROMO_CODE` unset); add-on prices (extra company, extra seat) unverified. `ops:owner-check` validates each id against the live key: right mode, active, CAD, monthly vs yearly. | `stripe-addon-prices` and `stripe-annual-prices` in test and live mode, paste the ids; create the pilot promotion code in Stripe. | Owner | **Yes for the pilot** (the offer is the code); annual can follow |

---

## 2. Legal review packet (what to hand the lawyer)

**It exists as one PDF: `docs/legal-packet/QuoteAI-legal-packet.pdf`** (with the HTML beside it), regenerated by `pnpm --filter @workspace/api-server ops:legal-packet` after any change to a template or a legal page (it reads the pages from the live site, so deploy first). It holds the questions below, the recipients of personal information, how a signature is captured, all six contract templates rendered by the product, and the terms and privacy policy in both languages. The notes below are the long form of its questions.

**A. Contract templates** — `artifacts/api-server/src/contracts/templates.ts` (293 lines) and the rendering in `contracts/render.ts` / `contracts/pdf.ts`. Ask them to confirm, per province:
- ON — *Consumer Protection Act, 2002* direct-agreement cancellation notice (10 days) wording and placement; *Construction Act* holdback clause (10 %, release 60 days after substantial performance), lien rights not waived; WSIB clause.
- BC — *Business Practices and Consumer Protection Act* direct-sales cancellation; *Builders Lien Act* 55-day holdback; WorkSafeBC.
- AB — *Consumer Protection Act* + Prepaid Contracting licence disclosure; *Prompt Payment and Construction Lien Act* (proper invoice, 28 days, 14-day dispute); WCB-Alberta.
- QC — Civil Code contract of enterprise (arts. 2098-2129), legal hypothec (2724 ff.); *Consumer Protection Act* itinerant-merchant cancellation; RBQ licence number field; French-first with the customer's written request for English captured (`englishRequestedInQuebec`); CNESST.
- CA generic — the fallback for the other provinces/territories; ask whether it is safe to offer at all or should be gated.
- Whether "compliant" may appear in marketing copy (today the product says "informed by … not legal advice").

**B. E-signature evidence** — `routes/sign.ts` and the audit certificate: identity by email OTP (6 digits, 10-minute TTL, 5 attempts), explicit consent checkbox (`sign.consent` text in `translations.dashboard.ts`), typed full name, IP/user-agent/timestamp per signer, SHA-256 of unsigned and signed PDFs, signed PDF immutable in private storage, retained on job archive. Ask: sufficient under provincial e-commerce acts (ON ECA 2000, BC ECA, AB ETA, QC *Act to establish a legal framework for IT*) for residential renovation contracts.

**C. Invoices** — `invoices/` + PDF: sequential non-reusable numbers, GST/HST number, buyer name, tax shown separately, void keeps the number. Ask: CRA invoice requirements at the $30 / $150 thresholds; QC TVQ presentation.

**D. CASL** — `lib/leadMessaging.ts`, `lib/quoteMessaging.ts`, `lib/jobMessaging.ts`: consent source recorded per lead (`consentSource`), unsubscribe link in every automated message honoured instantly, contractor identity in the footer, sequences stop on reply/accept/decline. Ask: implied-consent reliance for "requested a quote" and the 2-year existing-customer window; whether QuoteAI (platform) carries exposure in addition to the contractor.

**E. Terms of Service and Privacy Policy** — `pages/terms.tsx`, `pages/privacy-policy.tsx`. Ask: PIPEDA + Québec Law 25 obligations (privacy officer, breach register; erasure and portability now exist — ZIP export and account deletion with a 7-day grace, Phase 72 — is the policy's description of them right?); sub-processor list accuracy (Groq/OpenAI, Vercel, Supabase, Resend, Stripe, Gmail/Outlook, Meta, Google/Microsoft, QuickBooks/Wave, Financeit/Flinks, PostHog/GA, and since Phase 98 Twilio, Sentry and the browser push services); the French versions and terms §1 ("both versions have the same effect"); governing law clause; limitation of liability for AI-generated pricing.

**F. Help-centre statements** — `artifacts/quote-ai/src/data/help-articles.ts` (live at `/help/`): the articles describe the legal mechanics in plain language (cooling-off, holdback, lien periods, CASL). Ask them to skim for anything that reads as legal advice.

---

## 3. Recommended before launch, not blocking

| Item | State | Action | Owner |
|---|---|---|---|
| Product analytics | `POSTHOG_KEY` / `VITE_POSTHOG_KEY` unset — no funnel data from day one | Create the PostHog project (EU host is the default), set both keys | Owner |
| Resend webhook | `RESEND_WEBHOOK_SECRET` unset — bounces/complaints 500 and `email_events` stays empty | Create the webhook in Resend → `POST /api/webhooks/resend`, set the secret | Owner |
| Cron cadence | Vercel Hobby = daily tick; automation retries are one per day, 5 days to dead | Vercel Pro → hourly cron + `CRON_STALE_AFTER_HOURS=2` (RUNBOOKS §2) | Owner |
| External pentest | Phase 64 (auth, IDOR sweep, CSP, rate limits, webhooks) closed 2026-09-20 — the prerequisite is met | Procure a scoped web-app test (auth, tenant isolation, public token pages `/p` `/i` `/sign` `/t`, Stripe/Resend webhooks, public API keys). Give them `docs/ROUTE-MATRIX.md`. | Owner |
| Real-device pass | Still emulated only, but two machine passes now cover the parts a machine can. Phase 82: the phone-gutter check in `qa:visual` (at 375 px every element with its own text keeps 12 px from both edges, measured on the glyphs) — it found the homepage hero, all eight CTA bands, the footer bottom row and `/pricing` scrolling sideways. Phase 83: the **screen-reader / keyboard check** in the same sweep — it found the dashboard sidebar’s 20 links still tabbable and still read out while parked off-canvas on a phone, no skip link on any page (24 tab stops before the content), navigation that said “you are here” in colour only, two inputs with no focus ring at all, the trade marquee read out twice and — under reduced motion — permanently unreachable, and the mobile menus with no dialog role, no focus trap and no Escape. All fixed; the sweep reports 0 across 244 pages. **A real iPhone Safari / Android Chrome pass, and a real screen reader driven by a person, are still owed** — neither check can tell you the mic button is awkward to reach or that a reading order makes no sense. | 30 minutes on each: sign-up → quote → send → `/p` accept → `/sign` on the phone → `/t` clock-in with location | Owner |
| Live AI pass | Quote generation, contract drafting quality, receipt OCR, assistant tool-calling never exercised with a real model key locally (prod has `GROQ_API_KEY`) | Run three real jobs end to end in production before the first customer does | Owner |
| WhatsApp templates | Three templates (lead follow-up, review request, photo share) coded but never submitted to Meta — they silently fall back to email | Submit in Meta Business Manager; set the 8 `WHATSAPP_*` vars | Owner |
| OAuth app registrations | Gmail send (3 vars), Meta Lead Ads (4), Search Console (2) absent → those integrations show "not configured"; Outlook/Wave/Financeit/Flinks/LSA partner access still pending | Register what is meant to be live at launch; leave the rest honest-disabled | Owner |
| Help-centre content | Ten guides shipped in Phase 70 (`/help/`, EN+FR, prerendered, in the sitemap, footer link, support bot points to them) | Read once for tone/accuracy in your own voice; they state product behaviour from the code, not marketing claims | Owner |

---

## 4. Known and accepted for launch (post-launch punch list)

Carried from `deferred-work-post-launch` — re-audited 2026-09-21. None of these should stop a launch to ON/BC/AB contractors on Starter/Pro.

- ~~No account deletion / data export~~ — closed Phase 72 (Settings → Security: ZIP export, deletion with a 7-day grace).
- ~~233 hand-built static SEO/blog bodies are the pre-redesign layout~~ — closed Phase 80 (every public page renders through `entry-server.tsx`, head included, critical CSS inlined). ~~Still open: 14 `picsum.photos` placeholders on public pages~~ — closed Phase 81: the third-party host is gone and every slot draws an owned product mockup or brand cover until a photograph is named in `src/data/marketing-images.ts`. Real photography is still owed (owner track O12) — the four homepage story slots are the ones that matter.
- ~~Invoice/contract PDFs lack the company logo; quote PDF chapter orphans~~ — closed Phase 80.
- ~~Job "Mark complete"/"Archive" lack a confirm and final-invoice/holdback prompt~~ — closed Phase 80.
- ~~Lead follow-up cadence and review-request delay are constants~~ — closed Phase 80 (Settings → Business → Follow-up cadence / review delay).
- ~~The client page's portal card and message thread 404'd on every client~~ — closed Phase 82 (`/dashboard/clients` groups the quotes table, so its ids are `md5(dedupKey)`, never `clients.id`; the four portal/message routes now accept either).
- ~~Frontend role-awareness: a few deep dialogs (quote editor internals, imports upload) still rely on the server's 403~~ — closed Phase 83: `/dashboard/new` (all three tabs), the imports upload card and both dropzones, the job setup editor, "Draft contract", the payment schedule's "Edit schedule" and Archive's Restore now ask `useCan()` first, and `phase83.e2e.test.ts` pins each one to the 403 the server would have answered — and to the matrix rather than a blanket wall, since a foreman *may* edit a job's setup.
- Rate limiters are per-instance memory; move to a shared store if abuse appears.
- Company analytics O(P×N) in JS — fine to a few hundred jobs.
- Optional integrations log at `error` level when unconfigured (log noise only).
- ~~`lib/db/src/schema/incentives.ts` stray edit~~ — gone (tree clean on 2026-09-23).

---

## 5. Decision record

| Date | Decision | Market / plans | Conditions | Signed |
|---|---|---|---|---|
| | GO / NO-GO / GO with conditions | e.g. ON+BC+AB, Starter+Pro | e.g. 1.1, 1.2, 1.7, 1.10 done; 1.3/1.4 review booked for … | |

When this table has a row, Phase 70 is closed. Record the outcome in `QA-VERIFICATION-PLAN.md` §3 and strike the matching lines in `deferred-work-post-launch`.
