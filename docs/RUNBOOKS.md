# QuoteAI runbooks

Phase 69 (docs/QA-VERIFICATION-PLAN.md). Written so that someone with the repo, the Vercel + Supabase logins and the password manager can recover the service without reading source. Every command runs from the repo root on any machine with Node 24 + pnpm — no Docker, no `psql`.

**Exit criterion of Phase 69:** on-call can recover from these docs alone. If a step here needed a source dive, fix the doc.

---

## 0. Where things are

| What | Where |
|---|---|
| Production | https://quoteai.ca — one Vercel project `quote-ai` (static frontend + `api/index.js` → the bundled Express app in `artifacts/api-server/dist/app.mjs`) |
| Deploys | `git push origin main` → Vercel builds and promotes automatically. Nothing else deploys. |
| Database | Supabase project **quoteai** (`iwrujhplhilhxweejbtt`, us-west-2, Postgres 17). Connect through the **session pooler** `aws-0-us-west-2.pooler.supabase.com:5432` (the direct `db.*` host is IPv6-only). `DATABASE_URL` in Vercel is that URL. |
| Storage | Supabase Storage buckets `public-assets` (logos) and `private-assets` (signed contract/invoice PDFs, job photos). |
| Cron | Vercel Cron, `vercel.json` → `GET /api/cron/tick` **daily at 12:00 UTC** and `GET /api/cron/evening` **daily at 23:00 UTC** (crew reminders, Phase 75) — that is the Hobby plan cap: two jobs, once a day each. Both take Bearer `CRON_SECRET`. |
| Logs | Vercel → project → **Logs** (runtime, pino JSON, `LOG_LEVEL` default `info`). Build logs under Deployments. |
| Errors | Sentry, when `SENTRY_DSN` / `VITE_SENTRY_DSN` are set (see §1). Otherwise only the Vercel logs. |
| Admin API | `/api/admin/*`, any signed-in user whose email is in `ADMIN_EMAIL`. Use the browser session or a bearer session token. |
| Ops probe | `GET https://quoteai.ca/api/healthz/ops` — public, 200 = healthy, 503 = degraded with `problems[]` (see §2). |
| Env vars | `docs/ENV-INVENTORY.md` (generated) and `pnpm env:inventory` (§7). |
| Migrations | `lib/db/drizzle/NNNN_*.sql`, applied **by hand**: `supabase db query --linked --file lib/db/drizzle/NNNN_x.sql`. No migration table; the files are additive and idempotent. |
| Backups | Nightly GitHub Action `Backup` (encrypted artifact, 30 days) once its secrets exist; `pnpm --filter @workspace/api-server ops:backup` by hand (§5). |

First response to any incident: open `/api/healthz/ops`, the Vercel logs filtered to `level:error`, and Sentry. Then the relevant section below.

---

## 1. Error tracking (Sentry) — setup and what is wired

Both apps report through `lib/error-reporting` (a small envelope client, no SDK — see the file header for why). It is inert until the DSN is set.

**Setup once (user):**
1. Create a Sentry project (platform "Node.js" is fine for both), copy the DSN.
2. Vercel → Settings → Environment Variables → add `SENTRY_DSN` and `VITE_SENTRY_DSN` (same value; Production + Preview). `SENTRY_ENVIRONMENT` is optional — it defaults to `VERCEL_ENV`.
3. For **readable stack traces** (source maps): create an org auth token with `project:releases` + `org:read`, add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as build-time env vars. `scripts/sentry-sourcemaps.mjs` then injects debug ids and uploads the maps on every build (and deletes the frontend `.map` files before deploy). Without the token, builds are unchanged.
4. Sentry → Alerts: one rule "a new issue is created" → email/Slack; a second rule on `logger:ops` (the cron/automation warnings from §2) so operational alerts page too.
5. Redeploy and confirm: the function boot log says `Error tracking: Sentry enabled` (Vercel → Logs). To see a real event, break something on a **preview** deployment (e.g. set `DATABASE_URL` to a wrong host there and open `/api/healthz/db`) and watch the issue arrive with a symbolicated stack.

**What reports automatically:** every `500` from the API (with route, method, actor id, no bodies/cookies); every failed automation attempt (tags `automation_event`, `automation_status`); a cron tick that throws (level fatal); unhandled rejections / uncaught exceptions in the function; browser `window.onerror` / `unhandledrejection` and the React error boundary (tags `route`, `lang`; max 10 per page load, duplicates dropped).

---

## 2. Cron / automation failures

**How it works.** The daily tick (`routes/cron.ts`) runs, in order: automation retries → contract reminders → invoice maintenance (overdue, reminders, auto-send, holdback releases) → lead follow-ups → review requests → incentives freshness → price-trend check → quote follow-ups → Flinks sync → Google LSA poll → usage roll-up. Every domain side effect is an `automation_runs` row executed inline and **retried by the tick** with backoff 5 min / 15 min / 1 h / 4 h / 24 h, 5 attempts, then `dead`. With a daily tick, "5 attempts" means 5 days.

Each tick writes a `cron_ticks` row. `/api/healthz/ops` returns **503** when: no successful tick in the last `CRON_STALE_AFTER_HOURS` (default 25), the last tick failed, or any run is `dead` (last 7 days) / `failed` with an overdue retry. The tick also emails `OPS_ALERT_EMAIL` (fallback `ADMIN_EMAIL`) whenever there is a dead/failed backlog, and pings `CRON_HEARTBEAT_URL` after a good run.

**Setup once (user):** point an uptime monitor (Better Stack, UptimeRobot, Cronitor — free tiers are enough) at `https://quoteai.ca/api/healthz/ops`, every 5–10 min, alert on non-200. Optionally create a heartbeat check there with a 26 h period and put its ping URL in `CRON_HEARTBEAT_URL`. Set `OPS_ALERT_EMAIL`.

### 2a. "no successful cron tick since …" / heartbeat missed
1. Vercel → project → Settings → **Cron Jobs**: is the job listed and enabled, and what does its last run say? Cron jobs only update on a production deploy — if `vercel.json` changed, redeploy.
2. Vercel → Logs, filter `url:/api/cron/tick`. `401` → `CRON_SECRET` changed in Vercel but Vercel Cron sends the value at deploy time: **redeploy**. `503 CRON_SECRET not configured` → the var is missing. `500` → open the error in Sentry / the log line "Cron tick failed", fix, redeploy.
3. Run it by hand to catch up (idempotent — safe to run twice):
   ```bash
   curl -sS -H "Authorization: Bearer $CRON_SECRET" https://quoteai.ca/api/cron/tick
   ```
   The JSON reply lists what each maintainer did and `backlog`.
4. Function timeout (the tick is bounded by `maxDuration: 60` in `vercel.json`): the reply/log shows `tookMs`. If it approaches 60 000, the queue is too big for one tick — run step 3 a few times (each tick retries 25 runs), then raise `maxDuration` or move the cron to hourly (Pro plan) and set `CRON_STALE_AFTER_HOURS=2`.

### 2b. "N automation run(s) dead / failed"
1. `GET /api/admin/automations` (or `?status=dead`) — each row has `event`, `entityType/entityId`, `userId`, `attempts`, `lastError`.
2. Read `lastError`. Common causes: a third-party token expired (→ §4), Resend key invalid (→ every email fails; check `RESEND_API_KEY`), a PDF render error (→ Sentry has the stack).
3. Fix the cause, then retry — one attempt right now, bypassing backoff and the attempt cap. Handlers are idempotent, so retrying a half-done run is safe:
   ```bash
   curl -sS -X POST https://quoteai.ca/api/admin/automations/<run id>/retry -H "Cookie: <your signed-in cookie>"
   ```
   The reply carries the run after the attempt (`status: succeeded | failed | dead`).
4. If the run can never succeed (entity deleted, tenant gone), leave it: `dead` rows drop out of the health check after 7 days, or delete the row.

### 2c. The tick itself throws
Everything after the failing maintainer is skipped for that day. Sentry gets a `fatal` event with `route: GET /api/cron/tick`; the ops email contains the message. Fix → deploy → run 2a step 3.

---

## 3. Stripe webhook backlog / subscription state wrong

Two endpoints, both verified with Stripe's signature before `express.json()`: `POST /api/payments/webhook` (subscriptions, quote unlocks — secret `STRIPE_WEBHOOK_SECRET`) and `POST /api/payments/connect-webhook` (contractor Connect accounts, card payments on invoices — `STRIPE_CONNECT_WEBHOOK_SECRET`). Stripe retries a failed delivery with backoff for **3 days**, then stops; the dashboard shows each attempt.

**Symptoms:** a customer paid but the plan is still free / the quote still locked; Stripe → Developers → Webhooks shows red attempts.

1. Stripe → Webhooks → the endpoint → **Attempts**. `400 Webhook signature error` → the signing secret in Vercel does not match this endpoint (each endpoint has its own `whsec_…`); fix the var, redeploy. `500 Webhook secret not configured` → the var is missing. `500` otherwise → Sentry / logs (`Webhook business logic error`).
2. **Replay**: after the fix, in the same Stripe screen select the failed events → **Resend**. The handlers are idempotent (Stripe event → upsert by customer id).
3. **One customer, no replay needed** — force a resync from Stripe's current state:
   - as the user: Settings → Billing → "Sync subscription" (`POST /api/payments/sync-subscription`);
   - as admin: `POST /api/admin/sync-subscription {"email": "<user email>"}` searches Stripe customers by email; if the Stripe email differs, `POST /api/admin/sync-by-customer {"stripeCustomerId": "cus_…", "userEmail": "<user email>"}`; a plan can be granted outright with `POST /api/admin/grant-plan`.
4. Endpoint disabled by Stripe (too many failures): re-enable it in the dashboard; the events from the disabled period must be resent by hand (step 2).
5. Rotating the webhook secret: Stripe → endpoint → Roll secret (24 h overlap available) → set the new value in Vercel → redeploy → expire the old one.

---

## 4. OAuth token revoked / integration stops syncing

Tokens for QuickBooks, Google Calendar, Gmail, Wave, Meta, Google LSA and the Flinks login id are stored encrypted (`TOKEN_ENCRYPTION_KEY`, AES-256-GCM) in the `*_connections` tables. Access tokens are refreshed on use; when the refresh fails (`… token refresh failed` in the logs) the sync returns `null`, the automation run fails and lands in §2b with the provider error in `lastError`. The Settings → Integrations card only shows a failure for connected email ("Last send failed — reconnect"); the sync log (`GET /api/quickbooks/sync-log`, Wave likewise) shows the rest.

**Causes:** user revoked access at the provider; the provider expired the refresh token (QuickBooks: 100 days unused; Google: 6 months unused, or 7 days while the OAuth app is in "Testing" status); our OAuth client secret was rotated; `TOKEN_ENCRYPTION_KEY` changed without §6 (every decrypt fails at once — "Unsupported state or unable to authenticate data").

1. One tenant only → ask them to **Disconnect and reconnect** in Settings → Integrations (`DELETE /api/<provider>/disconnect` then the connect button). Nothing else needs to happen; the dead runs are retried per §2b step 3.
2. Every tenant of one provider at the same moment → the app credentials: check the provider console (Intuit developer portal / Google Cloud console / Meta) for a rotated or expired client secret, a consent screen back in "Testing", or a suspended app; update `*_CLIENT_SECRET` in Vercel; redeploy; users still have to reconnect if their refresh tokens were invalidated.
3. Every provider at once → `TOKEN_ENCRYPTION_KEY` mismatch. If the previous key is still known, set it back (or run §6 properly). If it is lost, the tokens are unrecoverable: delete the `*_connections` rows and tell users to reconnect.
4. Disable a broken integration without disconnecting it: the `is_enabled` flag on the connection row (`PATCH /api/quickbooks/toggle`, the calendar/Wave equivalents, or SQL) stops the sync while keeping the tokens.

---

## 5. Backups and restore

**Facts.** The Supabase project is on the **Free plan: no automatic backups, no PITR.** Until it is on Pro (daily backups, 7-day retention; PITR is a paid add-on), the only backups are the ones below — and after that they remain the only copy outside Supabase. Backup policy (retention, off-site copy, encryption key custody) is the owner's decision; the tooling supports any of it.

**Nightly (once the secrets exist).** `.github/workflows/backup.yml` runs at 07:17 UTC: `ops:backup` → `ops:restore --verify` → uploads `quoteai-backup-<run id>` (encrypted, 30-day retention). Secrets to set in GitHub → Settings → Secrets → Actions: `BACKUP_DATABASE_URL` (the pooler URL), `BACKUP_SUPABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (generate: `openssl rand -base64 32`, **store it in the password manager — without it every artifact is unreadable**). The workflow refuses to upload an unencrypted backup. Trigger one by hand: Actions → Backup → Run workflow.

**By hand** (any machine; reads `.env.staging` for `DATABASE_URL` / Supabase vars if present):
```bash
BACKUP_PASSPHRASE='…' pnpm --filter @workspace/api-server ops:backup --out .backups/$(date +%F)
```
Output: `manifest.json` (tables, row counts, sha256, sequences, migration list, schema snapshot), `tables/<table>.csv.gz[.enc]`, `storage/<bucket>/…`. One consistent snapshot (repeatable-read transaction). Verify any backup without a database:
```bash
BACKUP_PASSPHRASE='…' pnpm --filter @workspace/api-server ops:restore --verify --from .backups/2026-09-21
```

**Restore** (into a scratch/staging project, or production after data loss). Needs the target's pooler `DATABASE_URL` (Supabase → Project Settings → Database; reset the password there if unknown) and the checkout of the commit the backup was taken from (the manifest lists the migration files).
```bash
# fresh project: rebuild the schema from lib/db/drizzle/*.sql, then load
BACKUP_PASSPHRASE='…' pnpm --filter @workspace/api-server ops:restore --from .backups/2026-09-21 --target 'postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres' --yes --wipe
# schema already there (e.g. production after a bad delete): keep it, empty the tables, load
… ops:restore --from … --target … --yes --truncate --data-only
# also put the PDFs/logos back
RESTORE_SUPABASE_URL=… RESTORE_SUPABASE_SERVICE_ROLE_KEY=… … ops:restore … --storage
```
The script refuses the backup's own source unless `--allow-same-source`, refuses a non-empty target without `--truncate`/`--wipe`, checks the target schema against the manifest, loads in foreign-key order inside one transaction (rolled back on any error), restores sequences and compares row counts. Afterwards: `DATABASE_URL=<target> pnpm --filter @workspace/db schema-drift`.

**Restoring production itself:** `--truncate --data-only` on the production URL with `--allow-same-source`, from the newest artifact (download it from the Actions run, unzip). Put the app in maintenance first (Vercel → pause project, or set the deployment protection) so no writes race the load; run; unpause; run the cron tick by hand (§2a step 3).

**Rehearsal log:** backup of production taken 2026-09-21 (77 tables, 83 rows, Storage empty) and verified; encrypted round-trip verified; **the restore into a second project has not been run yet** — see the Phase 69 build log for why and what is needed.

**Supabase-side:** Project paused for inactivity (Free plan, 7 days idle) → Supabase dashboard → Restore; the API returns 500s meanwhile. Project deleted → the nightly artifact is the only copy.

---

## 6. Rotate `TOKEN_ENCRYPTION_KEY`

The key encrypts every stored OAuth token (§4). Rotating it without re-encrypting the rows breaks every integration at once. The script does the re-encryption and is idempotent, so the deploy window is safe.

1. Generate: `openssl rand -hex 32` → NEW. Get the current value from Vercel (it is a Sensitive var — copy it from the password manager, where it must live; Vercel will not show it).
2. Dry run against production — counts what would change and proves both keys work:
   ```bash
   OLD_TOKEN_ENCRYPTION_KEY=<old> NEW_TOKEN_ENCRYPTION_KEY=<new> DATABASE_URL=<pooler url> \
     pnpm --filter @workspace/api-server ops:rotate-token-key
   ```
   "N undecryptable" → those rows decrypt with neither key (already broken, or OLD is wrong). Add `--skip-undecryptable` to rotate the rest and have those users reconnect, or stop and find the right OLD.
3. `… ops:rotate-token-key --apply` — one transaction.
4. Vercel → set `TOKEN_ENCRYPTION_KEY` = NEW → **redeploy**.
5. Run step 2 again (dry run, same OLD/NEW): tokens that the old deployment refreshed between steps 3 and 4 show up as "to rotate" → `--apply` once more. Repeat until `0 value(s) to rotate`.
6. Update the password manager; keep OLD for 30 days in case a backup from before the rotation has to be restored (a restored row is under the key of its backup date — run the script with that OLD).

Same procedure, without the script, for `BETTER_AUTH_SECRET` (logs everyone out — do it at night) and `CRON_SECRET` (redeploy so Vercel Cron picks it up).

---

## 7. Deploy rollback and migrations

**Code rollback:** Vercel → Deployments → previous good deployment → **Instant Rollback** (or *Promote to Production*). Takes effect in seconds, no build. Then revert the commit on `main` so the next push does not redeploy the bug.

**Migrations** are additive SQL applied by hand; the code that needs them is pushed after. Order for a change: apply the migration → push the code. A rolled-back deployment therefore keeps working against a newer schema (nothing is dropped). To undo a migration, write a new forward one (`NNNN_revert_x.sql`), never edit an applied file. Drift check any time: `DATABASE_URL=<pooler url> pnpm --filter @workspace/db schema-drift` (exit 1 if the code expects something the DB lacks).

**A deploy that never boots** (`Startup failed` JSON from every `/api` route): `api/index.js` caught an import error — the Vercel function log shows it; usually a missing env var read at import time. Fix the var / rollback.

**Env var changes** need a redeploy to reach the function (Vercel → Deployments → Redeploy).

**Env inventory** — before launch and after any integration lands:
```bash
# keys only, from the Vercel dashboard or `vercel env ls` pasted into a file
pnpm env:inventory --vercel-keys keys.txt --write docs/ENV-INVENTORY.md
# or straight from the API
VERCEL_TOKEN=… VERCEL_PROJECT_ID=prj_3Xs1CcZ9QM7wd07jY20C2vBFaUTI pnpm env:inventory
```
Exit 1 = a variable the code reads is unclassified, or a required one is missing in production. `docs/ENV-INVENTORY.md` is the last snapshot.

---

## 8. Quick reference — other things that page

| Symptom | Look at | Do |
|---|---|---|
| Sign-in "Too many attempts" for everyone | `app.ts` auth limiters are per IP; a shared office NAT hits 30/15 min | wait, or raise the limit and deploy |
| `/p/:id` "Quote not available" for a client | public view limiter 120/min per IP, or the quote was archived | check `quotes.archived_at`; unarchive from the dashboard |
| Emails not arriving | Resend dashboard → Logs; `GET /api/admin/email-events` (bounces/complaints via the Resend webhook — needs `RESEND_WEBHOOK_SECRET`) | fix DNS (`pnpm --filter @workspace/api-server email-dns-check`), suppressions, or the API key |
| PDFs 500 | Sentry: pdfmake font errors → `src/lib/pdfmake.ts` registers fonts once; `includeFiles` in `vercel.json` ships `dist/data` | rollback, then fix |
| Storage uploads fail | Supabase → Storage → bucket policies; `SUPABASE_SERVICE_ROLE_KEY` rotated? | update the key, redeploy |
| Database "too many connections" | pooler session mode, `max: 3` per function instance; Free plan pooler cap 200 | Supabase → Database → connection stats; scale down concurrency or move to transaction pooler port 6543 (needs `prepare: false`) |
| Everything 500 after a deploy | function boot log → missing env var at import | §7 |
| Vercel flags `readable-secret` on a var | `STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_SECRET` were added as plain Encrypted, not Sensitive | recreate them as Sensitive (the code does not care) |

---

## 9. Account export / deletion (Phase 72, PIPEDA / Law 25)

**Where**: `artifacts/api-server/src/account/service.ts`; tables `account_exports`, `account_deletions`; routes in `src/routes/account.ts`; the daily tick runs `runAccountDeletionMaintenance` + `expireAccountExports`.

**Export** — `POST /api/account/export` (owner only, 1 per 24 h). The ZIP is built inline by the `account.export_requested` automation and lands in the private bucket at `account-exports/<userId>/<exportId>.zip`; a 7-day signed link is emailed. A failed build shows in the admin automations table like any other run — retry it there. Rows and ZIPs older than 7 days are dropped by the cron.

**Deletion** — `DELETE /api/account` (password + 2FA re-auth). Immediately: sessions revoked, Stripe subscription cancelled, integrations disconnected (provider tokens revoked where the provider supports it), sign-in refused with the scheduled date. **7 days later** the cron purges every row and file except signed contracts and issued invoices, which are re-keyed to `tombstone:<deletion id>` (their PDFs stay under `contracts|invoices/<original userId>/…`) and removed 7 years later (`retain_until`).

| Ask | Do |
|---|---|
| "I deleted by mistake" inside the grace period | they have the cancel link in the email; or `update account_deletions set cancelled_at = now(), cancel_token_hash = null where user_id = '<id>' and purged_at is null` |
| Same, after the purge | it is gone — restore from a backup (§5) only if the request is within the 30-day backup window and the person consents in writing; note it in the audit log |
| A purge failed | `select id, user_id, error from account_deletions where purged_at is null and scheduled_for < now()` — the next tick retries; the usual cause is storage listing (Supabase key) |
| Regulator / CRA asks for a deleted company's invoices | `select * from account_deletions where company_name ilike '…'` → contracts/invoices where `user_id = 'tombstone:<id>'`; PDFs at `contracts|invoices/<user_id>/…` |
| Prove an address was deleted | `email_hash` = sha256(lower(email)) stays on the row after purge; `email` itself is nulled |

## 10. Billing: annual plans, plan switches, Connect fee, legal identity (Phase 73)

**Where**: `artifacts/api-server/src/lib/billing.ts` (config + maths), `src/routes/payments.ts` (`/payments/plans`, `/payments/change-plan`), `src/invoices/stripeConnect.ts` (application fee), `lib/legal-entity/src/index.ts` (registered entity), `src/lib/legalFooter.ts` (email footer, applied in `emailUtils.brandedResend`).

**How it fits** — the tier stays in `business_profiles.subscription_plan` (`monthly_starter|monthly_pro|monthly_elite`); the cadence is `subscription_interval` (`month|year`). A yearly Stripe price id maps back to the same tier with interval `year` (`resolvePrice`), so features/allowances never look at the cadence. Yearly = 10 × monthly. Switching (`POST /api/payments/change-plan`) updates the live Stripe subscription with `proration_behavior: "always_invoice"` (and re-anchors the cycle to now when moving to annual), so the customer is charged/credited the difference on the spot and gets the plan-change email.

| Ask | Do |
|---|---|
| Annual toggle greyed out ("coming soon") | `STRIPE_PRICE_YEARLY_*` not all set for that environment — `pnpm --filter @workspace/scripts stripe-annual-prices` with the matching key, paste the three ids into Vercel, redeploy |
| Customer says the DB plan does not match Stripe | Settings → Billing → "Verify subscription" (`POST /api/payments/sync-subscription`) re-reads the active subscription and now records the cadence too; or the `customer.subscription.updated` webhook replays from the Stripe dashboard |
| Change the platform fee | `STRIPE_CONNECT_FEE_BPS` (basis points, default 50, `0` disables, capped at 500) → redeploy; the "Get paid online" card reads it live from `/api/invoice-payments/connect/status`. Existing Checkout sessions keep the fee they were created with (`metadata.applicationFeeBps`) |
| Where did a fee go? | Stripe → Connect → the connected account's payment → "Application fee"; the platform balance receives it as `application_fee` objects |
| Registered entity changes (new address, GST number) | edit `LEGAL_ENTITY` in `lib/legal-entity/src/index.ts`, push; also update Stripe → Settings → Business details by hand |
| An email went out without the footer | it did not go through `brandedResend` — grep for `new Resend(` outside `emailUtils.ts` (there should be none) |

## 11. SMS channel (Twilio, Phase 74)

**Where**: `artifacts/api-server/src/lib/sms.ts` (compose + gates + send + inbound), `src/routes/sms.ts` (Settings API + Twilio webhook), `src/routes/jobs.ts` (`POST /jobs/:id/sms/on-my-way`), tables `sms_messages` and `sms_opt_outs`.

**How it fits** — one platform number (`TWILIO_FROM_NUMBER`) texts on behalf of every contractor. `sendSms()` is the only sender: it prepends `Company (phone):` and appends `Reply STOP to opt out.` (FR equivalent), then checks, in order, Twilio configured → phone normalises to E.164 → not in `sms_opt_outs` → plan allowance (`MONTHLY_USAGE_ALLOWANCE.smsMessages`, counted in segments from `usage_events kind=sms`). Every outcome — sent, failed, skipped with a reason — is a row in `sms_messages`, which is what Settings → SMS shows. Automated sends need the contractor's toggles (`automationSettings.smsEnabled` for lead follow-ups to leads whose `preferredChannel = "sms"`, `smsReminders` for quote/contract/invoice reminders); the job page's "On my way" and the Settings test send are manual and only need allowance + no opt-out.

Inbound (`POST /api/sms/webhook`, Twilio "A message comes in"): signature = HMAC-SHA1(auth token, exact URL + sorted form fields), base64 — anything else is 403. STOP/ARRÊT/UNSUBSCRIBE… → `sms_opt_outs` row for the phone **and** every lead/client carrying that number flips to unsubscribed on all channels, with a notification to the contractor who last texted it. START/OUI → opt-out removed. Anything else → stored as a `reply` and surfaced as a notification (`sms_reply`).

| Ask | Do |
|---|---|
| Settings → SMS says "not available yet" | one of `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` is unset for that environment (O9 step). Sends are logged as `skipped / not_configured` meanwhile — nothing is lost, nothing is queued |
| Webhook returns 403 in the Twilio debugger | the URL Twilio calls differs from what we sign (`TWILIO_WEBHOOK_URL` or `<base>/api/sms/webhook`, scheme + host + path + query must match exactly); set `TWILIO_WEBHOOK_URL` to the URL as configured in the console |
| Customer says they still get texts after STOP | check `sms_opt_outs` for the E.164 number; Twilio also blocks at its edge (Messaging → Opt-out management). A manual opt-out: `POST /api/sms/opt-out { phone }` |
| Customer wants texts again | they reply START/UNSTOP/OUI; or delete their `sms_opt_outs` row (Twilio's own block clears on START only) |
| A text went out without the identity line | it did not go through `sendSms` — grep for `api.twilio.com` outside `lib/sms.ts` (there should be none) |
| Allowance too small for a pilot customer | `featureFlags` do not cover allowances; bump `MONTHLY_USAGE_ALLOWANCE` in `lib/db/src/schema/plans.ts` or move them up a plan |
| Cost check | Twilio Console → Monitor → Usage; our estimate is `usage_events.unit_cost_cents` (0.8 ¢/segment) in `/api/admin/margin` |

## 12. Schedule board + crew reminders (Phase 75)

**Where**: `artifacts/api-server/src/routes/schedule.ts` (board window + block CRUD), `src/schedule/service.ts` (conflicts, reminder rule, reminder copy — pure), `src/schedule/maintenance.ts` (the reminder sweep), `src/calendar/sync.ts` (`syncBlockToCalendar` / `removeBlockFromCalendar`), `src/routes/worker-time.ts` (`schedule` on `GET /api/t/:token`), table `schedule_blocks`, and `calendar_synced_events.schedule_block_id`.

**How it fits** — a block is one worker (or nobody: the *Unassigned* lane) on one job (or none: shop day) for a stretch of time; `starts_at` / `ends_at` are instants, all-day blocks run local midnight → next local midnight. `GET /api/schedule?from&to[&projectId]` returns the blocks overlapping the window with a server-computed conflict map (same worker, overlapping intervals — touching ends do not count), the active workers, the open jobs and their dated milestones (the overlay). Conflicts are flagged, never refused. Moving a block (time or worker) clears `reminder_sent_at`; a notes-only edit keeps it. Blocks are pushed to Google/Outlook as timed UTC events when the company has `calendar_sync`, alongside the all-day milestone events.

Reminders: `runScheduleReminderMaintenance(now)` runs from **`GET /api/cron/evening` (23:00 UTC)** and, as a same-day catch-up, from the morning tick. Rule (`reminderDue`): a block starting on the company's *next local day* is due once local time is ≥ 15:00 ("Tomorrow 08:00-16:00: Basement finish, 45 Rue Laurier."); a block starting *later today* is due at any time ("Today …"). One send per block: text through `sendSms(purpose = appointment_reminder)` when the worker has a phone and Twilio is configured, else the `sendWorkerScheduleReminderEmail` email, else nothing — but `reminder_sent_at` is stamped in every case so a worker with no contact details does not make the sweep retry daily. Company toggle: `automationSettings.scheduleReminders` (default on; Settings → SMS → "Crew schedule reminders").

| Ask | Do |
|---|---|
| Nobody got a reminder last night | Vercel → Logs, `url:/api/cron/evening` — same 401/503/500 triage as §2. `{ sms: 0, email: 0, skipped: 0 }` with blocks due → check the company's `automationSettings.scheduleReminders` and that the block has a `collaborator_id`. Blocks with `reminder_sent_at` already set are never re-sent — clear the column to resend by hand |
| Reminder went by email although the worker has a phone | Twilio not configured, the number replied STOP, or the plan allowance is used up — `sms_messages` has the `skipped` row with the reason; the email is the designed fallback |
| Reminder time is wrong by hours | the sweep uses the company's province for local time (`timeZoneForProvince`); a company with no province is treated as Toronto. The board itself shows instants in the *viewer's* browser zone |
| Worker says the block is missing on their page | `/t/:token` lists blocks from the start of *today* (company-local) for 15 days, assigned to that `collaborator_id`; unassigned blocks never show there |
| "Double-booked" but the times do not overlap | overlap is computed on instants — check both blocks' `starts_at`/`ends_at` in UTC; an all-day block covers the whole local day |
| Hobby cron cap | Vercel Hobby allows two cron jobs, once a day each — `tick` and `evening` use both. A third schedule needs O7 (Pro) |

## 13. Client portal + message thread (Phase 76)

**Where**: `artifacts/api-server/src/routes/portal.ts` (public `/api/portal/:token/*`), `src/routes/client-portal.ts` (dashboard: link, invite, thread), `src/portal/service.ts` (token, OTP, sessions, overview — pure parts unit-tested), `src/portal/messages.ts` (the one writer for both directions), `src/lib/emailPortal.ts` (code, invitation, message copies), tables `client_portal_sessions`, `client_messages`, columns `clients.portal_*`.

**How it fits** — the link `/portal/<token>` is an HMAC of the client id with `INVOICE_LINK_SECRET` (fallback `BETTER_AUTH_SECRET`), same as invoice links; the DB stores its hash (`clients.portal_token_hash`), written the first time anything asks for the link (dashboard card, `/i`, `/sign`, `/p` payloads, a contractor message). The token alone reveals the company name and a masked email. Opening the portal emails a 6-digit code to `clients.email`; a correct code creates a `client_portal_sessions` row (30 days) whose raw token the browser keeps in `localStorage` and sends as `X-Portal-Session`. Everything the client sees follows the public pages' visibility rules (no drafts). Messages are one thread per client; a contractor message is emailed to the client with the portal link, a client reply raises a `client_message` notification and an email to the company.

| Ask | Do |
|---|---|
| "The portal link says it's not valid" | The client row is archived, has no email, or the hash was never issued — open the job/client page once (the card's read re-stores the hash) and resend the invitation. A changed `INVOICE_LINK_SECRET` / `BETTER_AUTH_SECRET` invalidates every old link the same way (also every invoice link) — the next dashboard read re-issues portal links, invoices must be re-sent |
| Client never gets the code | `RESEND_API_KEY` unset (503-style log "Email service not configured"), or the client's email is wrong on the record; the code is only ever sent to `clients.email`. 8 requests / 15 min per IP, 5 wrong attempts per code, 10-minute expiry |
| Client says they signed in but sees nothing | Quotes show only `unlocked`/`accepted`, contracts only once sent, invoices only once sent, jobs only with a confirmed setup — and all keyed on `client_id`. A quote/contract/invoice with `client_id` null (legacy rows, unlinked manual quotes) is not in the portal |
| "Pay by card" missing | needs the company's `invoice_card_payments` feature **and** a Connect account with charges enabled — same rule as `/i` |
| "Sign now" gave a new link and the emailed one stopped working | by design: one live signing token per signer; the portal-minted link is marked OTP-verified because the portal session already proved the mailbox (`contract_events` shows `otp_verified` with `via: portal`) |
| Contractor did not get a reply | the notification always exists (`notifications.type = client_message`); the email goes to the business profile email, else the owner's login email — `client_messages.emailed_at` null means no email went out (check the log line "Client reply email not sent") |
| Revoke a client's access | `update client_portal_sessions set revoked_at = now() where client_id = …`; archiving the client also closes the portal (404) and drops the "See everything" links |
| Unread badge stuck | the count is `client_messages` with `sender = client and read_at is null`; opening the thread (job Messages tab or client page) marks them read |

## 14. PWA, offline field mode and web push (Phase 77)

**Where**: `artifacts/quote-ai/public/sw.js` (the service worker — hand-written, finalized by `scripts/build-sw.ts` after `vite build`: release id + the app-shell precache list from Vite's manifest), `public/manifest.webmanifest` + `icon-maskable-*.png` (`scripts/generate-pwa-icons.ts`, run once), `src/lib/pwa.ts` (registration, install prompt, update-waiting, cache clearing on sign-out), `src/lib/offline/outbox.ts` + `db.ts` (the IndexedDB queue), `src/components/pwa/*` (offline bar, install card, push toggle). Server: `api-server/src/lib/webPush.ts` (VAPID + aes128gcm over `fetch`, no vendor SDK), `src/lib/push.ts` (subscriptions, which notification types push, failure handling), `src/routes/push.ts`, table `push_subscriptions`; the worker/cost/photo routes accept `clientRef` (+ `at` on the clock) for idempotent replays.

**How it fits** — the worker opens `/sw.js` registered on the production build; caches are `qai-shell-<release>` (`/index.html`), `qai-assets-<release>` (the chunk closure of the entry, the App, the dashboard home, jobs list/page, schedule, notifications and `/t`), `qai-static-<release>` (manifest, icons, font) and `qai-api` (the last good JSON of the reads the field needs: `/api/t/:token`, jobs, photos lists, schedule, session, profile, notifications, workers, push config — served with `X-Served-From: sw-cache` when the network is gone; everything else under `/api` is never cached). A deploy installs the new worker next to the old one, the app shows "A new version of QuoteAI is ready · Reload", and the old release's caches are deleted on activate. Writes are never intercepted: the page's outbox queues clock in/out, hours, costs and photos when `navigator.onLine` is false or a request dies, replays them in order on reconnect/foreground with their own id as `clientRef`, and the server answers a replay it already applied with the same row (`replayed: true`). Clock ops carry `at` (the tap time, ≤ 7 days old): hours are computed from it, a sync more than 2 minutes after the tap writes an `offline_sync` audit row, and a clock-out landing on an entry someone already closed **overwrites it if the entry is still `submitted`** (`offline_overwrite` audit with the previous values) and is refused with `LOCKED` once reviewed. Push: `createNotification` fans out the types in `PUSH_NOTIFICATION_TYPES` (payments, signatures, client/SMS replies, crew hours, job setup ready) to every `push_subscriptions` row of the company; a 404/410 deletes the row, five failures in a row drop it.

| Ask | Do |
|---|---|
| "The app shows an old version" | it is waiting for a reload — the bar's *Reload* posts `SKIP_WAITING`; a hard refresh does the same. `/sw.js` is served `no-cache` (vercel.json), so a deploy is picked up on the next visit or when the app returns to the foreground (`registration.update()`) |
| Nuke a broken worker for one person | DevTools → Application → Service workers → Unregister, Storage → Clear site data; or from the console `caches.keys().then(k => k.forEach(c => caches.delete(c)))`. Nothing server-side to do |
| "My hours never arrived" | the phone keeps them in IndexedDB (`quoteai-offline` → `outbox`) until sent; the bar on `/t` says *N waiting to send* / *couldn't be sent* with the server's reason under *Details* (Retry / Discard). A 4xx (job closed, link revoked, entry locked) stays *failed* for the person; a 5xx retries with backoff up to 8 times |
| Duplicate entries after a bad connection | should not happen: same `clientRef` → same row (`time_entries.client_ref`, unique per worker; `cost_entries` / `job_photos` per company). If a duplicate shows up, the second one has `client_ref` null — i.e. it was created by a client without the ref (old build, API key) |
| A clock-out rewrote hours the office had set | by design for unreviewed entries (last write wins); the previous value is in `audit_log` (`entity_type = time_entry`, `action = offline_overwrite`). Approve entries you have adjusted so later replays get `LOCKED` |
| Push never arrives | in order: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` set in Vercel (the notifications page says "not set up on this server yet" otherwise) → the browser granted permission (page says "blocked") → iOS needs the app on the home screen first → `push_subscriptions` has a row for that member (`member_user_id`) with `failed_at` null → "Send a test" on the notifications page returns `sent: 1`. The log line "Push delivery failed" carries the push service's status |
| Rotating the VAPID keys | every subscribed browser stops receiving (the push service rejects the new signature) and is dropped after five failures; people re-enable from the notifications page. Do it only if the private key leaked |
| Someone else's data on a shared phone | the API cache is per origin, not per user; sign-out clears it (`CLEAR_API_CACHE` + `caches.delete("qai-api")`). The worker `/t` page has no sign-out — revoking the link (Team page) makes the cached page 404 on the next online load and the cache entry is dropped |
