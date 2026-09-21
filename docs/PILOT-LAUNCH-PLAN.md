# QuoteAI — Pilot launch plan (Phases 71-82)

Written 2026-09-21 after Phase 70. Decision: **pilot launch in BC, ON and QC**, all three plans. This document turns `LAUNCH-GO-NO-GO.md` §1-§3 and the market-gap review into build phases, plus a parallel **owner track** of things only the user can do. Same convention as every plan before it: one phase per conversation, each ends with a §3 build-log entry, auto-pushed.

QC in the pilot changes the order: the two Québec P1s go first, because a QC contractor's very first quote would be wrong.

---

## 1. Owner track (runs in parallel with the code phases)

Each item says exactly what to do. Do them in this order; none needs code from the assistant except where marked *→ then tell the assistant*.

### O1 — Backups (15 min) — do first
1. Supabase dashboard → project `quoteai` → **Project Settings → Database**. Under *Connection string* pick **Session pooler**, copy the URI, replace `[YOUR-PASSWORD]` with the DB password (reset it there if you don't have it).
2. Same page → **API**: copy *Project URL* and the **service_role** key.
3. Make up a long passphrase (20+ chars) and save it in your password manager as `QuoteAI BACKUP_PASSPHRASE`.
4. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**, four times: `BACKUP_DATABASE_URL` (step 1), `BACKUP_SUPABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY` (step 2), `BACKUP_PASSPHRASE` (step 3).
5. GitHub → **Actions → "Nightly backup" → Run workflow**. It should go green and leave an artifact `backup-<date>` (30-day retention). Download one and keep it somewhere off GitHub.

### O2 — Key escrow (5 min)
Open your password manager. Confirm there is an entry with the exact value of `TOKEN_ENCRYPTION_KEY`. If there isn't (it is *Sensitive* in Vercel, so it can't be read back), *→ tell the assistant* and we rotate it (RUNBOOKS §6) while only two token rows exist.

### O3 — Second Supabase project = staging + restore rehearsal (20 min)
1. Supabase dashboard → the unused July project `cynlsphsuxrnctsxcmve` → **Project Settings → Database → Reset database password**, then copy the **Session pooler** URI with the new password.
2. Same → **API**: Project URL + service_role key.
3. *→ give the assistant the three values* (paste them in chat; they go into `.env.staging`, never the repo). The assistant runs the restore rehearsal into it, then `schema-drift`, then adds `E2E_DATABASE_URL` / `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY` as GitHub secrets so CI e2e stops touching production.

### O4 — Monitoring (30 min, all free tiers)
1. **Sentry**: sentry.io → create org → *Create project* → platform **Node.js** → copy DSN. Create a second project, platform **React**, copy its DSN. Settings → *Auth Tokens* → create one with `project:releases` + `org:read` scopes.
2. Vercel → project → **Settings → Environment Variables** (Production), add: `SENTRY_DSN` (Node DSN), `VITE_SENTRY_DSN` (React DSN), `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` (org slug), `SENTRY_PROJECT` (the Node project slug). Mark the DSNs plain, the token **Sensitive**.
3. **Heartbeat**: healthchecks.io → *Add check*, period **1 day**, grace **2 hours** → copy the ping URL → Vercel env `CRON_HEARTBEAT_URL`.
4. **Uptime**: same site (or Better Stack) → HTTP check on `https://quoteai.ca/api/healthz/ops`, expect **200**, every 10 min, alert to your email.
5. Vercel env `OPS_ALERT_EMAIL` = the inbox you actually read.
6. Vercel → **Deployments → Redeploy** the latest so the new env is live. Sentry should show a first event within a day (the tick logs a breadcrumb-free "ops" message if anything is stale).

### O5 — Registered entity (5 min) — *→ tell the assistant*
Send: legal business name, mailing address, the province of incorporation/registration, GST/HST number if registered, QST number if registered. Phase 73 (built) reads all of it from **one file**, `lib/legal-entity/src/index.ts` (`LEGAL_ENTITY`): the assistant fills it in the moment you send the details, and the privacy policy §1/§10, the ToS §1/§11, the public footer, every email QuoteAI sends from quoteai.ca and the billing page's "receipts issued by" line all update on the next deploy. Until then those places say plain "QuoteAI" — nothing renders blank.

Two things only you can do, in Stripe (5 min):
1. Stripe Dashboard → **Settings → Business details** (public details): enter the same legal name, address and support email. This is what appears on the subscription receipts and invoices Stripe emails to your customers — the app cannot set it.
2. Stripe Dashboard → **Settings → Tax** → add your GST/HST (and QST) registration so Stripe Tax shows the numbers on receipts. (If you are not registered yet, skip; the app already adds the tax lines to *your customers'* quotes and invoices from their own numbers.)

### O6 — Product analytics + email events (10 min)
1. posthog.com → new project (EU cloud) → copy the project API key → Vercel env `POSTHOG_KEY` and `VITE_POSTHOG_KEY` (same value).
2. resend.com → **Webhooks → Add** → URL `https://quoteai.ca/api/webhooks/resend`, events: delivered, bounced, complained, opened → copy the signing secret → Vercel env `RESEND_WEBHOOK_SECRET` (Sensitive).
3. Vercel → Environment Variables → the three flagged `readable-secret` (`STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_SECRET`): delete and re-add each as **Sensitive**. Redeploy.

### O7 — Vercel Pro (5 min, $20/mo)
Vercel → team → **Upgrade to Pro**. Then Vercel env `CRON_STALE_AFTER_HOURS=2` and *→ tell the assistant* to switch `vercel.json` cron to hourly. Pro also lifts function timeouts for long AI drafts.

### O8 — Legal review (book now, takes weeks)
Find a Canadian lawyer who does **construction + consumer law and has done Québec work** (needed for the Civil Code / Charter of the French Language items). Send them `LAUNCH-GO-NO-GO.md` §2 as the brief; the assistant can export the five rendered contract PDFs + ToS + privacy on request. Ask for a fixed-fee review. Until it lands, marketing copy says "informed by provincial law", never "compliant".

### O9 — Third-party registrations (each 15-45 min, only the ones you want live at pilot)
- **Annual plans (Phase 73, 10 min)**: the yearly Stripe prices are created by a script, once per Stripe mode. In a terminal at the repo root:
  ```bash
  STRIPE_SECRET_KEY=sk_test_… pnpm --filter @workspace/scripts stripe-annual-prices
  ```
  It prints three lines (`STRIPE_PRICE_YEARLY_STARTER=price_…` etc.). Vercel → project → Settings → Environment Variables → add the three to **Preview** with the *test* ids; re-run with `sk_live_…` and add the live ids to **Production**. Redeploy (or wait for the next push). Until they exist the Billing page shows the annual toggle greyed out with "coming soon" — nothing breaks. The script is idempotent (re-running finds the existing prices by `lookup_key`).
- **Platform fee on card payments (Phase 73)**: defaults to 0.5 % (`STRIPE_CONNECT_FEE_BPS=50`), disclosed on the contractor's "Get paid online" card. Change it in Vercel env (basis points; `0` disables; capped at 500) and redeploy. Stripe Connect Express accounts need no extra approval for application fees.
- **WhatsApp**: Meta Business Manager → WhatsApp → *Message templates* → submit the three templates (the assistant will export their exact text on request: lead follow-up, review request, photo share) in EN and FR → once approved, set `WHATSAPP_*` (8 vars, see `docs/ENV-INVENTORY.md`).
- **Gmail send**: Google Cloud Console → OAuth consent screen (external, scopes `gmail.send`) → credentials → `GMAIL_CLIENT_ID/SECRET/REDIRECT_URI`. Google verification takes 1-2 weeks for the send scope; testing mode works for 100 users meanwhile.
- **Twilio (SMS, Phase 74 — built, 30 min + ~1 week of carrier verification)**:
  1. twilio.com → sign up → *Phone Numbers → Buy a number* → country Canada, capability SMS, type **Toll-free** (toll-free is the only type that can text Canadian numbers without a 10DLC campaign). Pick one; ~US$2/mo.
  2. *Messaging → Regulatory compliance → Toll-free verification* → submit: business name/address (the O5 entity), website `https://quoteai.ca`, use case *Customer care + notifications*, sample messages (paste one from Settings → SMS → "What your customers receive"), opt-in description: *"Customers give their phone number to a contractor using QuoteAI (web form, phone call or in person); the contractor records the consent basis; every message offers STOP."* Expect 1-7 days. Until approved, texts to Canadian numbers are blocked by the carriers — the app keeps logging them as skipped, nothing breaks.
  3. Console → *Account → API keys & tokens*: copy **Account SID** and **Auth Token**. Vercel → project → Settings → Environment Variables → add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (the number in E.164, e.g. `+18005550199`) to **Production** (and Preview if you want to test from a preview deploy). Redeploy.
  4. *Phone Numbers → Active numbers → your number → Messaging configuration → "A message comes in"*: Webhook, `https://quoteai.ca/api/sms/webhook`, HTTP POST. Save. (If you ever put the app behind another host name, set `TWILIO_WEBHOOK_URL` to exactly the URL you typed here — the signature check uses it.)
  5. *Messaging → Services*: none needed. *Opt-out management*: leave Twilio's default STOP/START handling on — the app records the same keywords in its own tables and also unsubscribes the lead/client.
  6. Verify: sign in → Settings → SMS → "Send a test text to (your number)" → the text arrives as `Your Company (613) 555-0100: This is a test text… Reply STOP to opt out.` Reply STOP from that phone → within seconds a notification "… opted out of texts" appears in the bell and the number shows in Settings → SMS → Recent texts as *Opted out (STOP)*. Reply START to undo.
  7. Tell the assistant it is live; it will run the e2e suite against the real number once (`E2E_REAL_SMS=1`).
- Meta Lead Ads, Search Console, Financeit, Flinks, LSA: leave for after pilot unless a pilot customer asks.

### O10 — Pentest (book after Phase 72)
Scope: auth, tenant isolation, the token pages (`/p` `/i` `/sign` `/t` `/team-invite`), Stripe/Resend webhooks, public API keys, file upload. Hand them `docs/ROUTE-MATRIX.md`. Budget CAD 3-6k for a small firm.

### O11 — Real-world pass (1 hour, before the first pilot customer)
On your phone (iPhone Safari and an Android if you can borrow one): sign up → profile → new quote by voice with a photo → send to your own email → accept on `/p` → sign on `/sign` (OTP) → review job setup → `/t` clock-in with location → record an e-Transfer → mark complete. Note every rough edge in chat; that becomes the Phase 82 fix list.

---

## 2. Build phases

### Phase 71 — Québec quotes: province-derived taxes + bilingual quote PDF
*Why first*: QC pilot. Today the manual-quote tax picker is the Italian-era Exempt/4/5/10/13 % list and every quote PDF prints one English "TAX (x %)" line.
- Manual quote form and quote editor: replace the rate picker with the province tax profile (`lib/db/src/schema/tax.ts`) — default from the business profile, override per quote by picking a province or "tax exempt"; store components on the quote (`taxComponents` JSON) the way invoices already do.
- Quote totals everywhere (dashboard, `/p`, public API, WhatsApp) show GST + QST / GST + PST / HST as separate lines.
- Quote PDFs (three pdfmake templates, the capitolato and the WhatsApp PDF): a `quoteLang` (client `preferredLanguage` → business language → province default for QC = fr) string table for every label; tax lines from the components; FR number/date formatting.
- Contract and invoice already do this — reuse their helpers, don't fork.
- Exit: a QC company creates a manual quote → PDF in French with TPS 5 % + TVQ 9,975 %; the same quote's `/p` page and acceptance email match. e2e case added.

### Phase 72 — Account deletion + data export (PIPEDA / Law 25)
- `POST /api/account/export` → background job → ZIP (JSON per table + PDFs from storage) → signed URL emailed; rate-limited to one per day.
- `DELETE /api/account` with password re-auth (+2FA if enabled) → 7-day grace (soft-delete, login blocked, cancel Stripe subscription, revoke OAuth tokens, purge storage) → hard delete by the cron, **except** signed contracts/invoices which are kept 7 years under a tombstone company (CRA), documented in the privacy policy.
- Team members: owner-only; a member removes themself via Team.
- Settings → Security gains "Export my data" / "Delete account" with the legal explanation.
- Privacy policy §retention updated (the lawyer sees the final wording).

### Phase 73 — Legal identity, annual billing, Connect fee
- Registered entity (from O5) on privacy, ToS, all email footers, subscription receipts.
- Annual plans in Stripe (2 months free) + `plans.ts` + billing page toggle + proration on switch.
- Stripe Connect application fee on card payments (start at 0.5 %, configurable by env) shown transparently on the contractor's invoice settings.
- Hourly cron if O7 done.

### Phase 74 — SMS channel (Twilio) with CASL baked in
- `lib/sms.ts` behind the same honest "not configured" pattern as WhatsApp; vendor stub for e2e.
- Uses: quote follow-ups, contract/invoice reminders, "on my way" from the job page, crew schedule reminders (Phase 75, built). Every message: contractor identity + STOP handling → `unsubscribed`.
- Per-lead channel preference; consent recorded on the lead like WhatsApp.
- Metered in usage like WhatsApp; allowance per plan.

### Phase 75 — Schedule board (in-app calendar)
- New `schedule_blocks` (job, worker, start, end, notes) — the data model calendar sync wanted.
- `/dashboard/schedule`: day/week view, drag to create/move, per-worker lanes, milestones overlaid, conflicts flagged; worker gets the block on their `/t` page and an SMS/email the evening before.
- Calendar sync extended to blocks.

### Phase 76 — Client portal
- `/portal/:token` per client (email OTP like `/sign`): all quotes, contracts, invoices, job progress + photos, messages thread, one place to pay.
- Existing `/p` `/i` `/sign` links keep working and gain a "see everything" link.
- Contractor side: a "message client" thread on the job page; replies land in the portal and email.

### Phase 77 — PWA + offline field mode
- Manifest, icons, install prompt on the dashboard and `/t`; service worker caching the shell; offline queue for time entries, cost entries and photos (IndexedDB → sync on reconnect with conflict = last-write-wins + audit).
- Push notifications (web push) for follow-ups due, signatures, payments.

### Phase 78 — Voice-first job actions
- The dictation button on the job page: "log $340 at Home Depot for drywall", "add a change order: extra outlet in the garage, 250 dollars", "note: client wants the trim white" → structured proposal card → confirm. Reuses the assistant's tool-calling with the job as context.
- Photo → change-order draft ("this looks like knob-and-tube" → proposal).

### Phase 79 — Money intelligence
- Price-trend alerts on quotes (Phase 18 data): "lumber +8 % since this catalog price — reprice?"
- 60-day cash-flow forecast on the dashboard: scheduled invoices + AR ageing + budgeted costs + payroll export totals.
- Margin alerts when a job's actuals cross 90 % of budget.

### Phase 80 — SEO + role-aware frontend + PDF polish
- Render the 233 static SEO/blog bodies through `entry-server.tsx` (content diff first), delete the hand-built bodies from `prerender-seo.ts`; fix the homepage head mismatch; critical CSS.
- `roleCan()`-driven hide/disable pass across the dashboard.
- Company logo on invoice/contract PDFs; quote PDF orphan control; job complete/archive confirm + final-invoice prompt; per-company follow-up cadence and review delay settings.

### Phase 81 — Marketing site for the pilot
- Real photography replacing the 14 placeholders (owner supplies or licensed stock); pricing page with annual toggle; BC/ON/QC province pages; French homepage parity; "pilot program" sign-up with a promo code in Stripe.

### Phase 82 — Pilot hardening
- Fix list from O11 + the first pilot customers; second pentest findings; staging-based CI green; go/no-go §5 signed for general availability.

---

## 3. Build log

*(one entry per phase: date, commit, built, found, deferred)*

### Phase 71 — Québec quotes: province-derived taxes + bilingual quote documents (2026-09-21)

**Built**
- **Tax model** — `lib/db/src/schema/tax.ts`: `splitTaxRate(rate, province)` maps a quote's stored total rate back to the statutory components (QC 14.975 → GST 5 + QST 9.975, BC 12 → GST + PST, ON 13 → HST; 0 = exempt; anything else = one generic "Tax" line), `quoteTaxLines(taxable, rate, taxTotal, province)` computes the amounts with the last line absorbing rounding so they always sum to the stored `ivaValore`. Migration `0036_phase71_quote_tax_rate_scale.sql` (applied): `iva_percentuale` numeric(5,2) → numeric(6,3) on `quotes` and `quote_variants` — 14.975 was being stored as 14.98, a few cents off on every QC quote; all writers now `toFixed(3)`.
- **Manual quotes** — `quotes/manualCreate.ts` (internal route + public API): new `province` input; the tax rate defaults to that province's statutory total (client's province → company's), 0 = exempt; the Italian `?? 22` fallback and Italian default payment terms are gone. Builder UI (`manual-quote-builder.tsx`): the Exempt/4/5/10/13 % pills are replaced by a province select showing each province's components (from the new public `GET /api/tax-profiles`, cache 1 day, on the route-matrix allowlist) plus a "Tax exempt" option; the totals preview lists the component lines live.
- **Every quote surface shows the split** — `serializeQuote` / `serializeQuoteVariant` / `toPublicQuote` / `toPublicVariant` return `taxLines[]` (+ `documentLanguage` on the quote); `/dashboard/quotes/:id` and `/p/:id` render them (TPS/TVQ labels and fr-CA numbers when the page is in French); OpenAPI + orval client regenerated.
- **Documents in the customer's language** — `quotes/i18n.ts`: `resolveQuoteLanguage` = client `preferredLanguage`, else French in Québec (the rule contracts and invoices already use); a 45-key EN/FR string table; `fmtMoney` ("$ 1,234.56" / "1 234,50 $"), `fmtRate`, `fmtQuoteDate`. `quotes/pdf.ts` now holds `generateQuotePdfBuffer` + `generateCapitolatoPdfBuffer` (extracted from `routes/quotes.ts`, every label localised, tax rows per component, the English default title localised); `lib/generateQuoteWhatsappPdfBuffer.ts` is a 10-line wrapper over it instead of a 330-line drifted copy. The quote email (`lib/email.ts` `buildQuoteEmailHtml` / `sendQuotePdfEmail`) has an FR copy set (subject "Soumission …", filename `Soumission N.pdf`). Clients auto-created from a QC quote default to `preferredLanguage: "fr"` (`lib/clients.ts`) — previously they defaulted to English and would have received French PDFs with English emails.
- **Removed** — ~900 lines of dead HTML quote generators (`generateQuoteHtml`, `generateHtmlStandard/Professionale/Elegante`, exported but never called) and the duplicated WhatsApp layout; `routes/quotes.ts` 4 227 → 2 600 lines.
- Tests: `quotes/i18n.test.ts` (10: split, rounding, discount base, FR labels, language rule); e2e `quotes.e2e.test.ts` +2 (QC manual quote → 14.975 %, GST+QST lines summing to `ivaValore`, `documentLanguage: fr`, French email subject/body, public page split; ON/exempt/odd-rate + `/api/tax-profiles`). `e2e/fixtures.ts` long quote now carries real province taxes so the PDF matrix exercises the split; `pdf-matrix.ts` imports from `quotes/pdf.ts`.

**Found**
1. `ops.e2e.test.ts` failed on committed code after the reboot: cron ticks are stamped by the database clock, which was 0.7 s *behind* this machine, so a tick written inside a warm-started server sorted before the test's `new Date()`. The window now starts 10 s early (still scoped to the run).
2. Quote PDFs printed the DB-default English title even on French documents; a title equal to the English default is now localised, a company-typed title is kept.

**Not done / deferred**
- Browser check of the manual builder and `/p` was not possible this session (the 5 dev-server slots belong to other chats; no API reachable); the e2e cases cover the payloads and the PDF matrix the documents. Do a manual pass when a slot is free.
- AI-generated quotes already derive the rate from the province (`resolveQuoteTaxRate`); an AI-provided explicit rate still wins and shows as a generic line if it matches no profile — by design.
- Invoices/contracts untouched (already bilingual with the split).

**Verification**: `pnpm typecheck` · `pnpm lint` 0 errors · `pnpm knip` (new files clean) · `i18n-audit` clean · unit 13 files / 65 tests · e2e 8 files / 65 tests green against `quoteai` · both apps built (428 pages prerendered) · `qa:pdf` 44 PDFs, QC quote text: "SOUS-TOTAL 28 970,00 $ · RABAIS (5 %) · TPS 5 % 1 376,08 $ · TVQ 9,975 % 2 745,26 $ · TOTAL TAXES INCLUSES 31 642,84 $" · migration 0036 applied · `docs/ROUTE-MATRIX.md` regenerated (347 routes).

### Phase 72 — Account deletion + data export (PIPEDA / Law 25) (2026-09-21)

**Built**
- **Schema** — `lib/db/src/schema/account.ts` + migration `0037` (applied): `account_exports` (one row per "Export my data": status, storage path, size, table/file counts, expiry) and `account_deletions` (request → `scheduled_for` = +7 days → `purged_at` → `retain_until` = +7 years → `retention_purged_at`; keeps the company name + GST/QST numbers as the "tombstone company" and only the sha256 of the email after the purge). `tombstoneUserId(id)` = `tombstone:<deletion id>`. New automation event `account.export_requested`.
- **Export** — `account/service.ts`: walks the Drizzle schema for every table with a `user_id`/`owner_id` (no hand-list to forget the next table) plus nine parent-keyed child tables (signers, events, tasks, deliveries…); skips `auth_session` / `auth_account` / `two_factor` / `whatsapp_otp` and redacts any column named like token/secret/password/hash/otp/apiKey; downloads every file under the ten tenant storage prefixes; `fflate` ZIP (JSON deflated, PDFs stored) → `account-exports/<userId>/<id>.zip` → 7-day signed URL emailed (EN/FR, `account/emails.ts`). Runs inline via the automation runner so a failed build is retried by the cron and visible in the admin table. `POST /api/account/export` is owner-only and 429s inside 24 h (`Retry-After`); `GET /api/account` returns status + a fresh 1-hour link for the UI. Cron `expireAccountExports` drops ZIPs + rows after 7 days.
- **Deletion** — `DELETE /api/account` { password, code? }: password via better-auth `verifyPassword`, TOTP or backup code via `verifyTOTP` / `verifyBackupCode` when 2FA is on. Then: row inserted first (so the purge happens whatever fails next), Stripe active/trialing subscriptions cancelled, all nine integrations disconnected through their existing `disconnect*` services (Google/Intuit/Meta tokens revoked at the provider), every session deleted, audit event, EN/FR email with a single-use cancel link (`GET /api/account/deletion/cancel/:token`, hashed, IP-limited → `/sign-in/?deletion=cancelled|invalid`, banner on the page). Sign-in during the grace period: the better-auth `after` hook drops the just-created session, strips the set-cookie / set-auth-token headers and answers 403 `ACCOUNT_DELETION_PENDING` with the date — checked after the password so a wrong password still says "invalid credentials".
- **Purge (cron)** — `runAccountDeletionMaintenance`: signed contracts + sent/paid/overdue invoices (+ their payments) are re-keyed to the tombstone id and their PDFs kept; everything else — every tenant row (children cascade), every file under every prefix, memberships both ways, the `auth_user` — is deleted; `email`, `ip`, `user_agent`, cancel token nulled on the row. Seven years on, `purgeRetainedRecords` removes the tombstoned rows, their PDFs and the company identity. Members: `POST /api/team/members/leave` + a "Leave this team" button on the Team page (Phase 7's org switcher already scopes it); a member's own deletion removes their login + memberships only.
- **UI** — Settings → Security gains "Export my data" (explanation, button, list of exports with Ready/size/expiry/Download) and "Delete account" (the four legal points, privacy-policy link, dialog: password, 2FA code if enabled, type DELETE/SUPPRIMER, then a "Deletion scheduled on <date>" confirmation that signs the person out); 35 EN + 35 FR strings; audit-log labels for the three new actions. `privacy-policy.tsx` §4 rewritten (self-serve deletion, 7-day grace, 7-year CRA/RQ exception under an anonymous record, export TTL, 30-day encrypted backups) and §6 points at the buttons; "Last updated" bumped. `docs/RUNBOOKS.md` §9 (manual cancel, failed purge, CRA lookup by tombstone). `docs/ROUTE-MATRIX.md` regenerated (352 routes) with the four routes allowlisted in `route-matrix.test.ts`.
- Tests: `account.e2e.test.ts` (7: member 403; owner ZIP downloaded and unzipped — quotes/contracts/signers/invoices/profile JSON, contract + invoice PDFs, no auth tables, signer tokens `[redacted]`, manifest counts, FR email + README; 429 on the second request; export expiry; wrong/missing password; deletion → sessions gone, row fields, EN email; sign-in 403 with the date and no token; bogus/used cancel link → `deletion=invalid`, real one → `deletion=cancelled` and sign-in works; purge on the scheduled date → user/profile/quotes/clients/memberships/storage gone, exactly the signed contract + issued invoices under the tombstone with the signed PDF kept and nothing else; 7-year purge empties the tombstone). Harness storage sweep now walks all eleven tenant prefixes recursively (the old one only did contracts/invoices two levels deep).

**Found**
1. better-auth's `bearer()` plugin copies the session cookie into `set-auth-token` on every response, including one an `after` hook replaces with an error — the first run of the sign-in test got a 403 *with* a token header. The hook now deletes both headers before throwing.
2. Route-matrix rule 2 (every mutating session route names a permission) needed three allowlist entries: the account routes act on the actor, not the org.

**Not done / deferred**
- 2FA-enabled deletion is covered by better-auth's own `verifyTOTP` path, not by an e2e case (enabling TOTP in the harness is a Phase 64 helper I did not lift over).
- Stripe cancellation ran against no customer in the tests (e2e orgs have no `stripe_customer_id`); the code path is the same `subscriptions.cancel` the admin page uses.
- Backups: a purged account persists in the encrypted GitHub-artifact backups for up to 30 days — stated in the policy; nothing scrubs backups.
- The lawyer (O8) still needs to see §4 of the privacy policy; French privacy/ToS pages do not exist yet (Phase 73/81 territory).

**Verification**: `pnpm typecheck` · `pnpm lint` 0 errors · `pnpm knip` clean · `i18n-audit` clean · unit 13 files / 65 tests · e2e 9 files / 70 tests green against `quoteai` · both apps built (428 pages) · migration 0037 applied · browser pass on the walkthrough server: export → "Ready · 72 KB · link expires 2026-09-28" + email; delete dialog wrong password → "Incorrect password"; right password → "Deletion scheduled 2026-09-28"; sign-in → "This account is scheduled for deletion on September 28, 2026…"; cancel link → green "Account deletion cancelled" banner.

### Phase 73 — Legal identity, annual billing, Connect fee (2026-09-21)

**Built**
- **Legal identity** — new dependency-free package `lib/legal-entity` (`LEGAL_ENTITY`, `isLegalEntityConfigured`, `legalIdentityLines(lang)`, `operatedByLine`, `addressLine`, `taxNumbersLine`, `provinceName`), imported by both apps. Fields are blank until O5; every consumer falls back to plain "QuoteAI" so nothing renders an empty address. Consumers: privacy policy §1 (adds the Law 25 "person in charge" sentence) and §10, ToS §1 and §11, the public footer (new `.ft-fine` line), the billing page / Settings → Billing ("Subscription receipts are issued by …"), and **every email sent from quoteai.ca**: `lib/legalFooter.ts` injects a bilingual entity block before `</body>` (idempotent, marker attribute) and `emailUtils.brandedResend()` applies it at the Resend boundary — the seven files that built their own `new Resend()` now go through it, so no template can forget. Emails sent from a contractor's connected Gmail are theirs and untouched.
- **Annual billing** — tier stays in `subscription_plan`; new `business_profiles.subscription_interval` (`month|year`, migration `0038`, applied). `lib/billing.ts`: yearly = 10 × monthly, yearly price ids from `STRIPE_PRICE_YEARLY_{STARTER,PRO,ELITE}`, `resolvePrice()` maps any price id (monthly or yearly) to `{ tier, interval }` — used by the checkout webhook, `customer.subscription.*` webhooks and "Verify subscription", which all now record the cadence. `POST /api/payments/checkout` takes `interval`; `GET /payments/plans` returns `yearlyPrice` + `yearlyAvailable` (and no longer leaks `stripePriceId`); `GET /payments/subscription` returns `interval` + `annualAvailable`. New **`POST /api/payments/change-plan`** (owner-only): with a live Stripe subscription → `subscriptions.update` with `proration_behavior: "always_invoice"` (+ `billing_cycle_anchor: "now"` when moving to annual) so the difference is charged/credited immediately, DB updated from the returned item, plan-change email sent; without one → a Checkout URL; same price → `unchanged`. Annual requested before the price ids exist → 400 `ANNUAL_BILLING_UNAVAILABLE`, never a broken Checkout. `scripts/src/stripe-annual-prices.ts` (`pnpm --filter @workspace/scripts stripe-annual-prices`) creates the three yearly prices via REST with `lookup_key`s (idempotent) and prints the env lines — O9 step written for the user.
- **Connect fee** — `application_fee_amount` on every invoice Checkout session (direct charge on the connected account), `STRIPE_CONNECT_FEE_BPS` default 50 (0.5 %), capped at 500, `0` disables; the bps used is stamped on the session metadata. `GET /invoice-payments/connect/status` returns `applicationFeeBps` + `applicationFeePercent` and the "Get paid online" card discloses it *before* the contractor connects (EN/FR); card wording changed from "never touches the money" to "never holds the money".
- **UI** — one `PlanPicker` component (monthly/annual segmented control with a new 2-way `.seg-2` variant, "2 months free" chip or "coming soon" note, three tier cards with per-cadence price and ≈/month equivalent, "Current plan" state, inline proration note + Confirm/Cancel before a switch) used by `/dashboard/billing` (replaces the static Starter-vs-Pro compare table) and Settings → Billing (replaces the checkout grid; also shown to active subscribers). Current-plan header now reads "$490/year" on annual, and its feature list comes from the live plan list (the old hard-coded list showed Starter's features to Elite). 17 EN + 17 FR strings. ToS §4 prices corrected ($29/$69/$79 → the real $19/$49/$59) and rewritten for annual + proration; footer fine print and the home FAQ mention annual.
- **Ops** — `env-inventory` manifest: the four new vars + the three `RESTORE_*` vars Phase 69 left unclassified (inventory now clean). `docs/RUNBOOKS.md` §10. Route matrix regenerated (353 routes). O5 and O9 in §1 rewritten with the exact steps (file to fill, the two Stripe Dashboard settings, the price script + Vercel env).
- Tests: unit `billing.test.ts` (8: availability gating, 10× pricing, price resolution, fee clamping/rounding/labels) + `legalFooter.test.ts`; e2e `billing.e2e.test.ts` (5: plan list shape with/without the env, subscription payload for elite and free orgs, change-plan member 403 / bad tier 400 / annual-unavailable 400 on both change-plan and checkout, fee disclosure at 50/0/125 bps, and the footer present exactly once on a team-invite email *and* a better-auth password-reset email — two different Resend construction paths).

**Found**
1. `/dashboard/billing` showed Starter's feature list to Elite subscribers (only `isPro` was special-cased) — fixed by reading the live plan list.
2. `.walkthrough-mailbox.json` lives in `artifacts/api-server/`, not the repo root as its header comment implies.
3. The "Choose plan" button on the no-subscription billing page fell back to `/#pricing`, an anchor that does not exist — removed; the picker is the CTA.

**Not done / deferred**
- **Hourly cron** (plan line 4) not switched: Vercel Hobby rejects sub-daily schedules; do it with O7 (`vercel.json` `"schedule": "0 * * * *"` + `CRON_STALE_AFTER_HOURS=2`).
- The proration `subscriptions.update` itself was not exercised end-to-end (no Stripe in the harness, and the walkthrough stubs the vendor → the confirm flow returned the error toast as designed). First real switch should be watched in the Stripe test dashboard (O9 step).
- Stripe Tax is not enabled; ToS says tax "is added at checkout" — enable Stripe Tax in the dashboard (O5 step 2) or the subscription is charged tax-exclusive.
- French privacy/ToS pages still do not exist (Phase 81); the entity block is bilingual in emails and the footer only.
- Receipts: Stripe's own; the "issued by" line and O5 step 1 cover it. No in-app receipt PDF.

**Verification**: `pnpm typecheck` · `pnpm lint` 0 errors · `pnpm knip` no new findings · `i18n-audit` clean (0/0/0) · `env:inventory` 0 failures · unit 15 files / 73 tests · e2e 10 files / 75 tests green against `quoteai` · both apps built (428 pages) · migration 0038 applied · browser pass on the walkthrough server: sign-up email carries the footer (`QuoteAI · quoteai.ca · support@quoteai.ca`); billing page shows the picker with annual greyed out + "coming soon"; with the yearly ids patched in, the Annual toggle shows $190/$490/$590 per year, "≈ $40.83/month, billed once a year" and the "2 months free" chip; an annual Elite profile shows "$590/year" and Elite's real feature list; Settings → Billing "Switch to Pro" → proration note → Confirm → error toast (stubbed Stripe); Integrations card: "QuoteAI keeps 0.5% of each card payment as a platform fee…"; with a sample entity filled in, privacy §1/§10, ToS §1/§11 and the footer line render the name, address and tax numbers, and the FR footer line reads "QuoteAI est exploité par … · TPS/TVH …".

### Phase 74 — SMS channel (Twilio) with CASL baked in (2026-09-21)

**Built**
- **One sender** — `artifacts/api-server/src/lib/sms.ts`. `sendSms()` is the only path to Twilio (plain REST, no SDK, so the e2e stub answers it): it prepends `Company ((613) 555-0100):` and appends `Reply STOP to opt out.` / `Répondez STOP pour ne plus recevoir de textos.` (bodies capped at 200 chars, ASCII "..." not "…" so nothing silently doubles the segment count), then gates in order: Twilio configured (`INTEGRATION_ENV.twilio` = SID + token + from-number) → phone normalises to E.164 (NANP, or explicit `+`) → not in `sms_opt_outs` → plan allowance (`MONTHLY_USAGE_ALLOWANCE.smsMessages`: free 0 / Starter 50 / Pro 300 / Elite 1000 **segments**, metered as `usage_events kind=sms` at 0.8 ¢). Every outcome is a row in `sms_messages` (sent / failed / skipped + reason), which is what the Settings log shows. Migration `0039` (applied): `sms_messages`, `sms_opt_outs` (phone-keyed — the number is the platform's, so STOP is platform-wide, matching Twilio and the carriers).
- **Inbound** — `POST /api/sms/webhook` (public, rate-limited): Twilio's signature (HMAC-SHA1 over the exact URL + sorted fields, base64; `TWILIO_WEBHOOK_URL` or `<base>/api/sms/webhook`) or 403. STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT/ARRÊT/DÉSABONNER… → opt-out row **and** every lead and client with that number (digits-only match on the last ten) flips to unsubscribed on all channels, `lead_events.unsubscribed channel=sms`, notification `sms_opt_out` to the contractor who last texted it. START/UNSTOP/YES/OUI → opt-out removed (the lead stays unsubscribed — re-consent is a human decision). Anything else → stored as a `reply` + notification `sms_reply`. No auto-reply TwiML (Twilio sends the carrier-mandated confirmations).
- **Uses** — (1) lead follow-ups: `preferredChannel = "sms"` + phone + the company's `smsEnabled` toggle → the same 1/3/7-day copy by text, email fallback on any non-send (never silence); POST/PATCH `/api/leads` writes a `consent_recorded channel=sms` event when SMS is chosen. (2) quote follow-ups, (3) unsigned-contract reminders (fresh signing link) and (4) overdue-invoice reminders (balance + link) also go by text when `smsReminders` is on and a phone is known — and text-only when there is no email. (5) **"On my way"** on the job page: `POST /api/jobs/:id/sms/on-my-way { etaMinutes? }` → "${actor name} is on the way to ${address}, arriving in about N minutes" in the client's language; manual, so it ignores the automation toggles but not opt-outs/allowance. (6) `appointment_reminder` purpose reserved for Phase 75.
- **Settings → SMS** (new tab, any paid plan; `settings-sms-tab.tsx`): honest "not available yet" until Twilio is configured, a live preview of exactly what customers receive (identity line + STOP), the CASL note, the two toggles (`automationSettings.smsEnabled` / `smsReminders`, also accepted by `PUT /api/business-profile`), segments used vs allowance, "Send a test text to (your number)", and the message log with skip reasons. Usage tab + `/api/usage/summary` gained `smsMessages`. Leads: "Follow-ups by" (Email / Text) in the new-lead dialog (needs a phone) and a click-to-switch channel chip on each card. `POST /api/sms/opt-out` for a customer who asks in person. 63 EN + 63 FR strings.
- **Ops** — env inventory: 5 `TWILIO_*` vars; `docs/RUNBOOKS.md` §11; O9 Twilio rewritten as 7 click-by-click steps (toll-free number → verification → env → webhook URL → test); route matrix regenerated (360 routes; the matrix tool now recognises `x-twilio-signature` as webhook-verification evidence and allowlists the route); walkthrough server stubs Twilio and prints every text.
- Tests: unit `sms.test.ts` (9: NANP normalisation, GSM-7/UCS-2 segment counting, the CASL block in both languages and the two-segment cap, config presence, signature recipe + tamper/URL/missing-token rejection); e2e `sms.e2e.test.ts` (7: status/settings/allowance per plan; test send with the exact form body on the Twilio stub, log row, usage row, free plan 402 before any vendor call, no-phone 400; not-configured 503; the lead sequence over SMS with consent event, tampered webhook 403, STOP → opt-out + lead unsubscribed + notification + inbound row, sequence and manual send blocked after, START lifts, plain reply → notification; toggle off → email fallback; "on my way" FR body with name/address/ETA + 400/409/404 paths; manual opt-out blocks a later send).

**Found**
1. `…` (U+2026) is outside GSM-7: a truncated body with an ellipsis was billed as UCS-2 (70-char segments) — caught by the two-segment test; replaced with `...`.
2. The route-matrix unit test only knew Meta/Stripe/Svix signature idioms; a new webhook style needs a keyword in `scripts/route-matrix.ts` (documented by the failure itself).
3. Invoice reminders previously required an email address at all — a phone-only customer got no reminder; now text-only when `smsReminders` is on.

**Not done / deferred**
- Live carrier delivery is untested: the number, toll-free verification and env vars are O9 (steps written). First real STOP should be watched once in the Twilio debugger to confirm the signed URL matches.
- Delivery-status callbacks (`TWILIO_STATUS_CALLBACK_URL`) are accepted but not consumed — a "sent" row means Twilio accepted the message, not that the handset got it.
- French keywords (ARRÊT, DÉSABONNER…) are honoured by us but not by Twilio's own edge filter — a French STOP still reaches the webhook and works; only the carrier-level block is English-only.
- Allowances are per plan only (no per-org override via `featureFlags`); overage is observability-only like WhatsApp.
- No SMS for review requests / photo shares (WhatsApp/email only) — the plan did not list them; trivial to add through `sendSms` if a pilot customer asks.

**Verification**: `pnpm typecheck` · `pnpm lint` 0 errors · `pnpm knip` no new findings · `i18n-audit` 0/0/0 · `spell` no new words (LCAP, Twilio whitelisted) · `env:inventory` no problems · unit 16 files / 82 tests · e2e 11 files / 82 tests green against `quoteai` · both apps built (428 pages) · migration 0039 applied · browser pass on the walkthrough server (Twilio stubbed): Settings → SMS shows the preview "Acme Reno Inc. ((613) 555-0100): … Reply STOP to opt out.", "Send a test text" → 1 / 300 segments and a *Test · Sent* log row with the exact text; both toggles persist (`/api/sms/status` → `smsReminders: true`); job page "On my way" → ETA dialog → text logged as `to=+18195550142 "Acme Reno Inc. ((613) 555-0100): Sam Walkthrough est en route à 45 Rue Laurier, Gatineau, arrivée prévue dans environ 30 minutes. Répondez STOP…"` (client prefers FR); new-lead dialog "Follow-ups by: Text (SMS)" → lead created with `preferredChannel: sms` and a `consent_recorded:sms` event.

### Phase 75 — Schedule board (in-app calendar) (2026-09-21)

**Built**
- **Data model** — `schedule_blocks` (migration `0040`, applied): `user_id`, `project_id` (nullable → shop day / training), `milestone_id`, `collaborator_id` (nullable → the *Unassigned* lane), `title` (overrides the job name), `starts_at` / `ends_at` as instants, `all_day`, `notes`, `reminder_sent_at`. `calendar_synced_events.milestone_id` is now nullable and a `schedule_block_id` column (unique per provider) sits beside it, so one table tracks both kinds of pushed event.
- **API** (`routes/schedule.ts`, Jobs feature = Pro+, `jobs` permission): `GET /api/schedule?from&to[&projectId]` (≤ 62 days) returns the blocks overlapping the window with names resolved (job, address, milestone, worker), the active workers (with `hasPhone` / `hasEmail`), the open jobs with their dated milestones (the overlay) and a **conflict map** computed in `schedule/service.ts` (same worker + overlapping instants; touching ends and the Unassigned lane never conflict). `POST /api/schedule/blocks`, `PUT /:id`, `DELETE /:id` — every reference is checked against the company (a milestone must belong to the block's job), conflicts are flagged in the response but never refused, a time/worker change clears `reminder_sent_at`, and every write is audited (`schedule_block created|moved|updated|deleted`).
- **Board** — `/dashboard/schedule` (sidebar → Delivery). *Week*: one lane per worker + Unassigned, one column per day, a milestone strip on top (chips coloured by status, linking to the job's schedule tab), today tinted. *Day*: one column per lane on a 6:00–20:00 axis with an all-day strip, the milestone strip and a "now" line. Both: mouse-drag on empty space creates a block (week: across days → an all-day multi-day block; single click → 8:00–16:00; day: 30-min snaps, minimum 1 h) and opens the dialog prefilled; a block is HTML5-draggable onto another day / worker / time (keeps its duration and, in week view, its time of day). Conflicts: red outline + icon on the chip, a toast after a save that creates one, a notice in the dialog. `?job=<id>` filters the board to one job, `?date=` / `?view=day` deep-link. Shared **`BlockDialog`** (job → milestone → worker → label → date + hours or first/last day when all-day → notes; delete; "reminder already sent" note).
- **Job page** → Schedule tab: a *Crew schedule* card listing this job's blocks for the next four weeks (worker · milestone · label, day + hours, notes, double-booked chip), "Add block" with the job locked, "Open board" (filtered).
- **Worker page** (`/t/:token`): *Your upcoming shifts* — the worker's blocks from today (company-local) for two weeks, with job, address, milestone, notes and "Today" highlighted.
- **Reminders** — `schedule/maintenance.ts`: the evening before (company-local ≥ 15:00) each assigned worker gets `Tomorrow 08:00-16:00: Basement finish, 45 Rue Laurier, Gatineau. Gate code 4471` by text (`sendSms`, purpose `appointment_reminder` — the slot Phase 74 reserved, so identity line, STOP footer, opt-outs and allowance all apply) or, when they have no phone / the text cannot go, by email (`sendWorkerScheduleReminderEmail`, EN/FR). A block added the night before gets a same-morning "Today …" catch-up from the main tick. One send per block; moving it re-arms. Company toggle `automationSettings.scheduleReminders` (default on) in Settings → SMS. New **`GET /api/cron/evening`** (23:00 UTC = 19:00 Toronto / 16:00 Vancouver / 20:30 St. John's) in `vercel.json` — the second and last cron the Hobby plan allows; `cronAuthorized()` shared with the tick.
- **Calendar sync extended to blocks** — `syncBlockToCalendar` pushes a timed UTC event ("Sam Carpenter · Basement finish", notes as description; all-day blocks as date events) to every enabled Google/Outlook connection when the company has `calendar_sync`; updates PATCH the same event, deletes remove it; the sync log shows `scheduleBlockId`. `GoogleEventPayload` now accepts `dateTime`, `OutlookEventPayload.isAllDay` is a boolean.
- **Ops** — `docs/RUNBOOKS.md` §12 + the cron line in §0; route matrix regenerated (365 routes, `/api/cron/evening` allowlisted next to `/tick`); no new env vars.
- Tests: unit `schedule/service.test.ts` (7: conflict map incl. touching ends / other worker / unassigned; the 15:00 local rule for ON and BC around the 23:00 UTC cron, "today" catch-up, already-sent, two days out; province-local day/hour vs UTC; EN/FR reminder bodies, title over job name). e2e `schedule.e2e.test.ts` (5: free 403 / Pro board / bad windows; conflicts both ways → reassign clears them + `reminderSentAt` reset only on a move, milestone overlay, `projectId` filter, foreign worker / other-org block / cross-job milestone refused, delete; `/t` page lists only the worker's own upcoming blocks; the reminder sweep — too early → nothing, 23:00 UTC → text with the exact CASL-wrapped body + `sms_messages` row + email with the same body + no-contact worker stamped, nothing twice, a move re-sends with the new times, same-morning "Today", toggle off → skipped, toggle on via `/api/sms/settings` → sent; Google push with the exact `dateTime` payload → PATCH on move → DELETE on delete). `sms.e2e` status assertion updated for the third toggle.

**Found**
1. `–` (U+2013) in "08:00–16:00" would have pushed every reminder into UCS-2 (70-char segments) — the same trap Phase 74 hit with `…`; the SMS body uses a plain hyphen, the board and emails keep the dash.
2. The i18n audit's "English literal in JSX" regex matches `=> new Date(x) <` as prose; two expressions were reordered rather than teaching the audit about them.
3. Vercel Hobby caps crons at two, once a day each — `tick` + `evening` now use both; anything else (the hourly tick from Phase 73's note) waits for O7.

**Not done / deferred**
- Drag-and-drop is mouse-only (HTML5 DnD); on a phone, tap → dialog → change the date/worker. Touch DnD needs a pointer-events library and was not worth it for an office screen.
- Blocks do not touch time entries: a worker still clocks in on the `/t` page against the job (the block is the plan, the entry is the actual). Pre-filling the clock-in job from today's block is a small follow-up if the pilot asks.
- No recurring blocks ("every weekday 8–16 for three weeks") — drag across days makes an all-day span instead; recurrence is a Phase 82 candidate if crews want it.
- Reminder texts are metered against the company's SMS allowance like any other text (5 workers × 20 working days = 100 segments/month on Pro's 300) — deliberate; a separate allowance is a plans.ts one-liner if it bites.
- Outlook push for blocks is code-complete but exercised only through the Google stub (same as Phase 12's milestones).

**Verification**: `pnpm typecheck` · `pnpm lint` 0 errors · `pnpm knip` no new findings · `i18n-audit` 0/0/0 · `spell` no new words · `env:inventory` no problems · unit 17 files / 89 tests · e2e 12 files / 87 tests green against `quoteai` · both apps built · migration 0040 applied · browser pass on the walkthrough server (fresh Elite account seeded with 2 workers, 2 jobs, 3 milestones, 6 blocks): week board with lanes, milestone strip, today column and conflict badges on Sam's overlapping Tuesday blocks; day view with timed columns and the all-day strip; block dialog opens from a chip; drag on the Unassigned column 7:30→10:00 → dialog prefilled → saved → chip appears; a `DragEvent` drop moved "Pick up drywall" from Tue/Unassigned to Wed/Alex keeping 7:30–10:00 and cleared `reminderSentAt`; job page *Crew schedule* card lists the four blocks; worker `/t` page on a 375 px viewport shows *Your upcoming shifts* with Today highlighted; Settings → SMS third toggle round-trips through `/api/sms/status`. No console errors.
