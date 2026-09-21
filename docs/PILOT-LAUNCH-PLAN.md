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
Send: legal business name, mailing address, the province of incorporation/registration, GST/HST number if registered, QST number if registered. Phase 73 puts it on the privacy policy, ToS, every email footer and the invoice PDF for QuoteAI's own subscription receipts.

### O6 — Product analytics + email events (10 min)
1. posthog.com → new project (EU cloud) → copy the project API key → Vercel env `POSTHOG_KEY` and `VITE_POSTHOG_KEY` (same value).
2. resend.com → **Webhooks → Add** → URL `https://quoteai.ca/api/webhooks/resend`, events: delivered, bounced, complained, opened → copy the signing secret → Vercel env `RESEND_WEBHOOK_SECRET` (Sensitive).
3. Vercel → Environment Variables → the three flagged `readable-secret` (`STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_SECRET`): delete and re-add each as **Sensitive**. Redeploy.

### O7 — Vercel Pro (5 min, $20/mo)
Vercel → team → **Upgrade to Pro**. Then Vercel env `CRON_STALE_AFTER_HOURS=2` and *→ tell the assistant* to switch `vercel.json` cron to hourly. Pro also lifts function timeouts for long AI drafts.

### O8 — Legal review (book now, takes weeks)
Find a Canadian lawyer who does **construction + consumer law and has done Québec work** (needed for the Civil Code / Charter of the French Language items). Send them `LAUNCH-GO-NO-GO.md` §2 as the brief; the assistant can export the five rendered contract PDFs + ToS + privacy on request. Ask for a fixed-fee review. Until it lands, marketing copy says "informed by provincial law", never "compliant".

### O9 — Third-party registrations (each 15-45 min, only the ones you want live at pilot)
- **WhatsApp**: Meta Business Manager → WhatsApp → *Message templates* → submit the three templates (the assistant will export their exact text on request: lead follow-up, review request, photo share) in EN and FR → once approved, set `WHATSAPP_*` (8 vars, see `docs/ENV-INVENTORY.md`).
- **Gmail send**: Google Cloud Console → OAuth consent screen (external, scopes `gmail.send`) → credentials → `GMAIL_CLIENT_ID/SECRET/REDIRECT_URI`. Google verification takes 1-2 weeks for the send scope; testing mode works for 100 users meanwhile.
- **Twilio (SMS, Phase 74)**: twilio.com → buy a Canadian number → *Messaging → Toll-free verification* (required in Canada, ~1 week) → `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
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
- Uses: quote follow-ups, contract/invoice reminders, "on my way" from the job page, appointment reminders (Phase 75). Every message: contractor identity + STOP handling → `unsubscribed`.
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
