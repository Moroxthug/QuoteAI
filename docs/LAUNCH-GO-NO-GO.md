# QuoteAI — Launch go / no-go review (Phase 70)

Prepared 2026-09-21 as the last step of `QA-VERIFICATION-PLAN.md` (Phases 61-69 closed). Phase 70 is the **human gate**: nothing below is code that can be written — each line is a decision, a purchase, a registration or a review that only the owner can make. This document is the agenda for that review, with the current state of every item and exactly where to act.

Legend — **Owner** is who has to do it; **Blocks launch?** is the recommendation, not a rule. Tick the box, date it, and record the decision in §5.

---

## 1. Go / no-go criteria (recommended blockers)

These are the items that, if left open, put real customers' money, contracts or data at risk on day one. Everything else can follow launch.

| # | Item | State today | What to do | Owner | Blocks launch? |
|---|---|---|---|---|---|
| 1.1 | **Database backups** | None exist. Supabase Free = no daily backups, no PITR. `ops:backup` + nightly `.github/workflows/backup.yml` are built and verified (`--verify`, encrypted round-trip) but the workflow skips until secrets exist. | Set the four GitHub secrets `BACKUP_DATABASE_URL`, `BACKUP_SUPABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (RUNBOOKS §5), then trigger the workflow once and download the artifact. Optionally also move Supabase to Pro (daily backups, 7-day retention). | Owner | **Yes** |
| 1.2 | **Restore rehearsal** | Never run against a real target. The loader (`ops:restore --wipe`) has only been exercised in code. | Get the pooler `DATABASE_URL` of the unused July project `cynlsphsuxrnctsxcmve` (Supabase dashboard → Database → reset password), then `pnpm --filter @workspace/api-server ops:restore --from .backups/rehearsal --target "<url>" --yes --wipe` and `DATABASE_URL="<url>" pnpm --filter @workspace/db schema-drift`. Or delete that project and create the staging project (1.6) in its slot and rehearse there. | Owner (credentials) → assistant (run) | **Yes** — a backup nobody has restored is not a backup |
| 1.3 | **Legal review of the contract templates** | `artifacts/api-server/src/contracts/templates.ts`, `TEMPLATE_VERSION = 1`: ON / BC / AB / QC (EN+FR) / generic CA. Written against the statutes in `JOB-LIFECYCLE-PLAN.md` §5; never read by a lawyer. The product copy and the help centre say "have your lawyer read it". | Send §2 (the legal packet) to a Canadian construction/consumer-law lawyer. Bump `TEMPLATE_VERSION` when wording changes so signed contracts keep their version. | Owner | **Yes if the contracts feature is marketed as compliant**; No if launch is Starter-only (quotes) and Pro/Elite contracts follow the review |
| 1.4 | **ToS / privacy policy review** | `pages/terms.tsx` (11 sections, "Last updated September 17, 2026") and `pages/privacy-policy.tsx` (sub-processor list corrected in Phase 68). Both still name the entity as "QuoteAI, a business operating from Ontario" — no registered name, no address. Drafted by an AI assistant, flagged in-file as unreviewed. | Same lawyer, same packet. Replace the entity line with the registered business name and address (also needed on every CASL message — 1.5). | Owner | **Yes** |
| 1.5 | **Registered business identity in outbound messages** | CASL requires legal name + mailing address + contact in every commercial message. `leadMessaging.ts` / `quoteMessaging.ts` / `jobMessaging.ts` insert the *contractor's* profile (correct for their messages). QuoteAI's own transactional footers (`lib/email.ts`: "QuoteAI · Professional AI-powered quotes") carry no legal name or mailing address, and the privacy policy says only "a business operating from Ontario". | Decide the registered name/address; update `privacy-policy.tsx`, the `.footer` blocks in `lib/email.ts`, and `terms.tsx` §11. | Owner (decision) → assistant (edit) | **Yes** |
| 1.6 | **Staging Supabase project** | Does not exist (Free tier caps at 2 projects). CI's `e2e` job skips; the 8-file / 61-test e2e suite runs against **production** `quoteai`. Fine with one user; not after launch. | Create the project (or reuse the July slot after 1.2), apply migrations (`supabase db push --linked` against it), set `E2E_DATABASE_URL` / `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY` in GitHub secrets. | Owner | **Yes** — the day a real customer exists, e2e must stop touching prod |
| 1.7 | **Error tracking + ops alerts live** | Wired (Phase 69) but inert: `SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN/ORG/PROJECT`, `OPS_ALERT_EMAIL`, `CRON_HEARTBEAT_URL` all unset. Nobody is paged if the daily cron stops or an automation dies. | Create the Sentry project, set the DSNs (RUNBOOKS §1); create a Healthchecks.io/Better Stack check for `CRON_HEARTBEAT_URL`; point an uptime monitor at `GET /api/healthz/ops` (expects 200; 503 = problems) (RUNBOOKS §2). | Owner | **Yes** — cheap, and the only way to know something broke |
| 1.8 | **Quebec-specific P1s** (only if QC is in the launch market) | Manual-quote tax picker is Italian-era (no GST+QST); the quote PDF is English-only with one "TAX (x %)" line (Phases 66/67). Contracts and invoices are bilingual and correct. | Decide: launch ON/BC/AB first (no work), or fix both before QC launch (assistant, ~1 phase). | Owner (decision) | **Yes for QC**, No otherwise |
| 1.9 | **Vercel readable secrets** | `STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_SECRET` were created as Encrypted, not Sensitive (Vercel shows `readable-secret`). | Recreate the three as Sensitive in Vercel → Settings → Environment Variables; redeploy. | Owner | No (hygiene) — but 5 minutes |
| 1.10 | **`TOKEN_ENCRYPTION_KEY` escrow** | Sensitive in Vercel (not readable back), not in `.env.staging`. If lost, every stored OAuth token is unrecoverable and rotation is impossible. | Confirm the value is in the password manager (RUNBOOKS §6). If it is not, rotate now while there are two live token rows, not two thousand. | Owner | **Yes** |

---

## 2. Legal review packet (what to hand the lawyer)

One folder, one meeting. Everything is in the repo; the assistant can export the rendered documents on request.

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

**E. Terms of Service and Privacy Policy** — `pages/terms.tsx`, `pages/privacy-policy.tsx`. Ask: PIPEDA + Québec Law 25 obligations (privacy officer, breach register, **right to erasure and portability — the product has neither account deletion nor data export today**, see §3); sub-processor list accuracy (Groq/OpenAI, Vercel, Supabase, Resend, Stripe, Gmail/Outlook, Meta, Google/Microsoft, QuickBooks/Wave, Financeit/Flinks, PostHog/GA); governing law clause; limitation of liability for AI-generated pricing.

**F. Help-centre statements** — `artifacts/quote-ai/src/data/help-articles.ts` (live at `/help/`): the articles describe the legal mechanics in plain language (cooling-off, holdback, lien periods, CASL). Ask them to skim for anything that reads as legal advice.

---

## 3. Recommended before launch, not blocking

| Item | State | Action | Owner |
|---|---|---|---|
| Product analytics | `POSTHOG_KEY` / `VITE_POSTHOG_KEY` unset — no funnel data from day one | Create the PostHog project (EU host is the default), set both keys | Owner |
| Resend webhook | `RESEND_WEBHOOK_SECRET` unset — bounces/complaints 500 and `email_events` stays empty | Create the webhook in Resend → `POST /api/webhooks/resend`, set the secret | Owner |
| Cron cadence | Vercel Hobby = daily tick; automation retries are one per day, 5 days to dead | Vercel Pro → hourly cron + `CRON_STALE_AFTER_HOURS=2` (RUNBOOKS §2) | Owner |
| External pentest | Phase 64 (auth, IDOR sweep, CSP, rate limits, webhooks) closed 2026-09-20 — the prerequisite is met | Procure a scoped web-app test (auth, tenant isolation, public token pages `/p` `/i` `/sign` `/t`, Stripe/Resend webhooks, public API keys). Give them `docs/ROUTE-MATRIX.md`. | Owner |
| Real-device pass | Emulated viewports only (Phase 67); iPhone Safari / Android Chrome never used; screen reader never used | 30 minutes on each: sign-up → quote → send → `/p` accept → `/sign` on the phone → `/t` clock-in with location | Owner |
| Live AI pass | Quote generation, contract drafting quality, receipt OCR, assistant tool-calling never exercised with a real model key locally (prod has `GROQ_API_KEY`) | Run three real jobs end to end in production before the first customer does | Owner |
| WhatsApp templates | Three templates (lead follow-up, review request, photo share) coded but never submitted to Meta — they silently fall back to email | Submit in Meta Business Manager; set the 8 `WHATSAPP_*` vars | Owner |
| OAuth app registrations | Gmail send (3 vars), Meta Lead Ads (4), Search Console (2) absent → those integrations show "not configured"; Outlook/Wave/Financeit/Flinks/LSA partner access still pending | Register what is meant to be live at launch; leave the rest honest-disabled | Owner |
| Help-centre content | Ten guides shipped in Phase 70 (`/help/`, EN+FR, prerendered, in the sitemap, footer link, support bot points to them) | Read once for tone/accuracy in your own voice; they state product behaviour from the code, not marketing claims | Owner |

---

## 4. Known and accepted for launch (post-launch punch list)

Carried from `deferred-work-post-launch` — re-audited 2026-09-21. None of these should stop a launch to ON/BC/AB contractors on Starter/Pro.

- No account deletion / data export (PIPEDA / Law 25 erasure + portability) — must exist before the first deletion request; ~1 phase.
- ~~233 hand-built static SEO/blog bodies are the pre-redesign layout~~ — closed Phase 80 (every public page renders through `entry-server.tsx`, head included, critical CSS inlined). Still open: 14 `picsum.photos` placeholders on public pages (real photography is content, Phase 81).
- ~~Invoice/contract PDFs lack the company logo; quote PDF chapter orphans~~ — closed Phase 80.
- ~~Job "Mark complete"/"Archive" lack a confirm and final-invoice/holdback prompt~~ — closed Phase 80.
- ~~Lead follow-up cadence and review-request delay are constants~~ — closed Phase 80 (Settings → Business → Follow-up cadence / review delay).
- Frontend role-awareness: Phase 80 hid or disabled the write controls on every dashboard page for foreman/viewer (`useCan`, shared matrix in `lib/permissions`); a few deep dialogs (quote editor internals, imports upload) still rely on the server's 403.
- Rate limiters are per-instance memory; move to a shared store if abuse appears.
- Company analytics O(P×N) in JS — fine to a few hundred jobs.
- Optional integrations log at `error` level when unconfigured (log noise only).
- `lib/db/src/schema/incentives.ts` has an uncommitted stray edit in the working tree — finish or discard, never sweep into a phase commit.

---

## 5. Decision record

| Date | Decision | Market / plans | Conditions | Signed |
|---|---|---|---|---|
| | GO / NO-GO / GO with conditions | e.g. ON+BC+AB, Starter+Pro | e.g. 1.1, 1.2, 1.7, 1.10 done; 1.3/1.4 review booked for … | |

When this table has a row, Phase 70 is closed. Record the outcome in `QA-VERIFICATION-PLAN.md` §3 and strike the matching lines in `deferred-work-post-launch`.
