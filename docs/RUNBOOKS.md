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

## 15. On-site actions: dictation, photo → change order / note, job notes (Phase 78)

**Where**: `artifacts/quote-ai/src/components/jobs/voice-actions.tsx` (the Dictate / Photo buttons and the sheet), `components/jobs/notes-card.tsx`, `components/assistant/proposal-card.tsx` (shared cards). Server: `api-server/src/routes/assistant.ts` (`/api/assistant/actions`, `/voice`, `/photo`), `assistant/service.ts` (`ACTION_MODE_PROMPT`, image part), `assistant/tools.ts` (`propose_change_order`, `propose_job_note`), `assistant/apply.ts`, `jobs/photos.ts` (`storeJobPhoto`), table `job_notes` (migration 0043), notes routes in `routes/jobs.ts`.

**How it fits** — the sheet posts the recording (MediaRecorder, webm/mp4/ogg) to `/api/assistant/voice`; the server transcribes it with Whisper (`whisper-large-v3-turbo`, the user's language) and runs the *same* assistant turn as the chat on the job's conversation, with the on-site block appended to the system prompt. Nothing is written until the user confirms a card. Photos are saved to the gallery first (so nothing is lost if the model is down), then shown to the model once as a `data:` URL — never stored in `assistant_messages`. Gate: Elite (the assistant); role `jobs:edit` to propose, `jobs:full` to confirm a change order; 60 actions/hour per user.

| Ask | Do |
|---|---|
| "The mic does nothing" | the browser refused the microphone (toast "Couldn't access the microphone"); on iOS the site must be https and the permission granted in Settings → Safari. The typed line under the mic always works |
| "Didn't catch that" (422) | Whisper returned an empty transcript — background noise or a 1-second tap. Nothing was sent to the model |
| 502 `ASSISTANT_FAILED` / `TRANSCRIPTION_FAILED` | the AI provider (`GROQ_API_KEY` / `OPENAI_API_KEY`) is down or unset; the transcript (if any) is already in the job's Assistant thread, nothing else was touched. Locally the walkthrough server uses the keyword stub (`e2e/onSiteModelStub.ts`) when no key is set |
| "It made a note instead of a change order" | the job has no *signed* contract (`projects.contract_id` → `contracts.status = signed`); the tool refuses and the model keeps the words as a note. Sign the agreement, then dictate again |
| A photo was refused (415) | HEIC: the vision model cannot read it. iPhone → Settings → Camera → Formats → Most compatible; the gallery upload (Photos tab) still accepts HEIC |
| Where did the on-site action go? | the job's Assistant tab (same conversation): the transcript is the user message, the cards follow. `assistant_proposals.kind` is `change_order` / `job_note` / `cost_entry` …; `audit_log` rows `created_via_assistant` with `actor_type = ai` and the proposal id |
| Delete a note | Overview → Notes → trash (`DELETE /api/jobs/:id/notes/:noteId`, owner/admin/office/foreman). Notes from photos keep `photo_id`; deleting the photo nulls it |


## 16. Money intelligence: price check, cash outlook, budget alerts (Phase 79)

**Where**: `api-server/src/quotes/priceCheck.ts` (matching + reprice maths) and the two routes in `routes/quotes.ts` (`GET /api/quotes/:id/price-check`, `POST /api/quotes/:id/reprice`); `analytics/service.ts` `cashFlowOutlook` + `GET /api/analytics/cash-flow` (`routes/analytics.ts`); `jobs/budgetAlerts.ts` (`checkJobBudget`, `runBudgetAlertSweep`) wired through the `cost.confirmed` automation (`automations/costConfirmedBudget.ts`), the labour/equipment syncs in `costs/service.ts` and the daily tick. Frontend: `components/quotes/price-check-card.tsx` (quote page sidebar), `components/dashboard/cash-flow-card.tsx` (dashboard home). Migration 0044 (`projects.budget_alert_90_at` / `_100_at`).

**How it fits** — the price check is computed on read, nothing stored: every priced line of an editable quote is matched by name (accent-free word overlap ≥ 0.6, unit must agree when both are known, lump sums skipped) against the price catalog and the receipt-learned prices (`price_intelligence`, average of the latest 5 samples, ≥ 3 needed); a line is flagged when the reference differs by ≥ 5 %. Reprice recomputes every total server-side (line → chapter → subtotal → discount base → tax) and clears `pdf_url`; it refuses (`LOCKED`) once the PDF was downloaded or the quote accepted, like the editor. The outlook reuses the analytics cash-flow engine over 9 week buckets (day 60 falls in week index 8) with two extra sources: drafts with `scheduled_for` / `auto_send_at` (expected at send date + the invoice's own terms) and payroll (last 28 days of approved labour ÷ 4 as a weekly run-rate while jobs are open, submitted-not-approved hours in week 0; the labour budget category is dropped from the spread so wages are not counted twice). Budget alerts compare confirmed `cost_entries` with `cost_budget_lines`: one notification (+ push) at 90 %, one at 100 %, stamps cleared when costs fall back under so the next crossing alerts again.

| Ask | Do |
|---|---|
| "The price check flagged the wrong item" | the description shares ≥ 60 % of its words with a catalog/work-type name (after stopwords such as *supply / install / pose*). Rename the catalog item more specifically, or give the quote line a unit — a unit mismatch (`hr` vs `sqft`) blocks the match |
| "No price check card" | nothing flagged, the quote is locked, or the company has no catalog items and fewer than 3 receipts per work type (`GET …/price-check` → `references`, `findings`, `editable`) |
| "Reprice changed the tax / discount" | it re-applies the quote's stored `iva_percentuale` and `sconto.percentuale` to the new subtotal — the same maths as the editor's Save. `audit_log` action `repriced` on the quote holds `totale.from/to` |
| "Cash card says Elite" | `analytics_pro` feature (Elite), same gate as `/dashboard/analytics`. Free/trial accounts do not see the card at all |
| "The outlook looks wrong" | `GET /api/analytics/cash-flow` → `sources` lists what fed it (open/overdue invoices, scheduled drafts, milestone terms with `payment_amount_cents` and no invoice yet, active jobs, payroll run-rate). A job with no `planned_end` spreads its remaining budget over 4 weeks and keeps payroll running to the end of the window |
| No 90 % alert although the job page shows 92 % | only *confirmed* entries count (the job page also shows pending review); the live check runs on `cost.confirmed`, labour approval and equipment usage — a budget *edit* is picked up by the daily sweep (`runBudgetAlertSweep`, result `budgetAlerts` in the cron tick). Stamps: `projects.budget_alert_90_at / _100_at`; clear them to force a re-alert |
| Two "over budget" notifications for one job | costs dropped back under 100 % between them (an entry was deleted or the budget raised) and crossed again — by design, one per crossing |


## 17. SEO pipeline, roles in the dashboard, cadence settings, branded PDFs (Phase 80)

**Where**: `artifacts/quote-ai/src/entry-server.tsx` (`renderPage`, `listPrerenderRoutes` from `src/data/prerender-routes.ts`), `scripts/prerender-seo.ts` (the whole build-time prerender, ~180 lines; Beasties for the critical CSS), `scripts/validate-prerender.ts`; `lib/permissions` (the Phase 7 matrix, shared) + `src/hooks/use-role.ts` (`useCan`); `src/components/jobs/lifecycle-dialogs.tsx` (complete / archive confirmations); `api-server/src/lib/followupCadence.ts` + `automation_settings.leadFollowupDays / quoteFollowupDays / reviewRequestDelayDays`; `api-server/src/lib/companyLogo.ts` (logo for the invoice, contract and quote PDFs).

**How it fits** — every public page (428: home EN/FR, static pages, help, blog, sector EN/FR, city EN + FR-primary) is rendered at build time by the real React tree; the `<head>` is what each page's `<SeoHead>` renders (React 19 hoists title/meta/link to the front of the stream, the prerender takes that prefix), JSON-LD stays where `<SeoHead>` sits inside `#root`. `data-ssr="<route>"` on `#root` tells `main.tsx` to hydrate (the Vercel rewrite serves the homepage file for any unknown route, so "has children" alone would be wrong). Beasties inlines the CSS each page uses (~8 kB gz) and moves the full stylesheet link to the end of `<body>` — no inline handlers, the CSP stays as is. Roles: the server still answers 403 (`requirePermission`); the dashboard reads the role from `/api/team/orgs` and hides/disables what would 403, assuming `owner` until the list loads.

| Ask | Do |
|---|---|
| A public page is wrong in Google but right in the browser | it cannot differ any more: both come from the same render. Rebuild (`pnpm --filter @workspace/quote-ai build`) and check `dist/public/<route>/index.html`; `pnpm --filter @workspace/quote-ai validate-prerender` asserts title/canonical/hreflang/marker/critical CSS on all 428 files |
| "Prerender failed: No `<title>` rendered for /x" | the page does not render `<SeoHead>` (or throws before it). Every route in `listPrerenderRoutes()` must render one |
| hreflang points at a page that does not exist | `validate-prerender` fails on it. City pages advertise fr-CA only for `FRENCH_PRIMARY_CITY_SLUGS`; pass `altCanonical` to `<SeoHead>` only when the twin is built |
| A viewer still sees a button that 403s | wrap it in `can(area, action)` (`useCan` from `src/hooks/use-role.ts`) with the same area/action as the route's `requirePermission` (see docs/ROUTE-MATRIX.md, column Perm) |
| "Mark complete drafted an invoice I did not want" | the job.completed automation drafts the final invoice for the unbilled balance (contract + signed change orders − every non-void invoice except holdback releases / credit notes) and the holdback release; the dialog shows the amounts first. Delete the draft on the invoice page (`DELETE /api/invoices/:id`, drafts only) |
| Follow-ups too frequent / too rare | Settings → Business → *Follow-up cadence* (leads and quotes, up to 5 touches of 1–90 days, empty = off) and *Send the review request* (0–14 days). Stored in `business_profiles.automation_settings`; the defaults 1/3/7, 2/5/10 and 3 days apply when unset. Changing the cadence affects the *next* scheduled touch (`leads.next_follow_up_at` / `quotes.next_follow_up_at` already set keep their date) |
| Logo missing on an invoice / contract PDF | `business_profiles.logo_url` must be a PNG or JPEG (`lib/companyLogo.ts` sniffs the bytes; WebP/SVG are skipped silently so the document still renders). Sent invoices keep their stored "as sent" PDF; the download route re-renders drafts and the balance-bearing copy |
| Quote PDF chapter heading alone at the foot of a page | should no longer happen: the title is the first header row of the chapter table with `keepWithHeaderRows: 1`; a single line item never splits (`dontBreakRows`). A subtotal row can still land alone at the top of a page |


## 18. Marketing site: pricing, provinces, pilot, image slots (Phase 81)

**Where**: `quote-ai/src/pages/pricing.tsx` (`/pricing`, `/fr/tarifs`), `pages/pilot.tsx` (`/pilot`, `/fr/pilote`), `pages/provinces/[slug].tsx` (`/provinces/:slug`, `/fr/provinces/:slug`); data in `src/data/pricing.ts`, `src/data/province-data.ts`, `src/lib/tax-profiles.ts`, `src/data/marketing-images.ts`; the promo plumbing in `api-server/src/lib/billing.ts` (`pilotPromoCode`, `isPilotPromoCode`), `routes/payments.ts` (`GET /api/payments/pilot`, `pilotDiscount`) and `quote-ai/src/lib/pilot-promo.ts`.

**How it fits** — the three new page families are prerendered like every other public page (Phase 80), so they carry real prices and real tax rates in static HTML. Those numbers are *mirrors* of server data: `src/data/pricing.ts` mirrors `PLANS` in `routes/payments.ts`, `src/lib/tax-profiles.ts` mirrors `lib/db/src/schema/tax.ts`, and `src/lib/marketing-parity.test.ts` fails the build if either drifts. After hydration the pricing page refetches `GET /api/payments/plans`, which is also what tells it whether annual checkout exists yet. The pilot code is one Stripe promotion code named by `PILOT_PROMO_CODE`: `/pilot` publishes it, stores it in `localStorage`, and the plan picker sends it with `change-plan`; the server honours only its own configured code and attaches it as a Checkout `discounts` entry (Stripe forbids that together with `allow_promotion_codes`, so the coupon box is replaced, not doubled).

| Ask | Do |
|---|---|
| "The pilot page says no code is running" | `PILOT_PROMO_CODE` is unset on that deployment. Create the coupon **and** a promotion code in Stripe (Product catalogue → Coupons → *Add promotion code*), set the env var to the customer-facing code, redeploy. `GET /api/payments/pilot` shows what the server thinks |
| The code shows but the discount is not applied at checkout | the server could not find an *active* promotion code with that exact `code` in the current Stripe mode (test vs live are separate). It logs `PILOT_PROMO_CODE is set but Stripe has no active promotion code with that code` and sends the person to Checkout without a discount rather than failing — check the code exists, is active, and has redemptions left |
| A customer says they pasted a code and nothing happened | when a pilot discount is attached, Stripe hides its own promo box (the two are mutually exclusive). A *different* code therefore cannot be entered on that session; clear `quoteai:pilot-promo` from localStorage, or start checkout from `/dashboard/billing` in a browser that never visited `/pilot` |
| Prices on the marketing page disagree with Stripe | change `PLANS` in `routes/payments.ts` **and** `MARKETING_PLANS` in `quote-ai/src/data/pricing.ts`, then rebuild. `pnpm --filter @workspace/api-server test src/lib/marketing-parity` is the guard; the prerendered HTML only updates on a build |
| The annual toggle is greyed out on `/pricing` | the three `STRIPE_PRICE_YEARLY_*` ids are not set (owner track O9). That is the honest state — the toggle stays disabled rather than sending someone into a checkout that would 400 |
| A province page quotes the wrong tax rate | it reads `TAX_PROFILES`, the same table the PDFs use. Fix `lib/db/src/schema/tax.ts`, mirror it in `quote-ai/src/lib/tax-profiles.ts` (the parity test enforces it), rebuild |
| "Where do the photos go?" | `public/marketing/<name>.jpg`, then name the file in `src/data/marketing-images.ts` (`src`). Nothing else changes: `<MarketingImage>` swaps its fallback for the photograph and the aspect ratio is fixed per slot, so the layout does not move. Owner track O12 lists the 14 slots and their sizes |
| A marketing image slot renders a product mockup instead of a photo | that slot's `src` is still `null`. `slotsAwaitingPhotography()` lists the ones still waiting |
| A French page shows an English city name | `CityData.frName` / `frRegion` in `src/data/seo-data.ts`; `localizeCity(city, lang)` applies them. Slugs never change — `/fr/soumissions/peintre/montreal/` stays put |
| The language toggle does not switch a page's URL | only pages with a real French twin navigate; the list is `LOCALE_PAGE_PAIRS` + `PROVINCE_SLUG_PAIRS` + the sector/city rules in `src/data/seo-slugs.ts`. Everything else flips the chrome language in place. Add a new French page → add the pair there, add the route in `App.tsx`, the prerender entry in `data/prerender-routes.ts` and the sitemap entry in `scripts/generate-sitemap.ts` |


## 19. Pilot preflight + the phone gutter check (Phase 82)

**Where**: `api-server/scripts/preflight.ts` (`pnpm --filter @workspace/api-server ops:preflight`); the gutter check in `api-server/src/e2e/visual-a11y.ts` (`pnpm --filter @workspace/api-server qa:visual`).

**How it fits** — `docs/LAUNCH-GO-NO-GO.md` §1 is a table a person ticks. `ops:preflight` asks the *running deployment* the same questions and answers them from what it actually does, so the morning of a launch is not a memory exercise. It is read-only: GETs against the public surface, plus three counting queries and a `schema-drift` run when a `--db` is given. Nothing is written, nothing is sent, no secret is printed. Exit 1 on any FAIL (a launch blocker); WARNs are things to know about (annual prices absent, no pilot code). It is the *deployment* half — `pnpm env:inventory` is the environment half, and the two together are §1.

```bash
pnpm --filter @workspace/api-server ops:preflight -- --url https://quoteai.ca --db "$DATABASE_URL"
```

| Ask | Do |
|---|---|
| "Scheduler ran…" FAILs | same signal as `GET /api/healthz/ops` returning 503 — see §2. The detail line is the `problems[]` array |
| "No test fixtures in the target database" FAILs | the e2e suite has been run against this database (it creates `e2e_*` users with `@example.invalid` emails). Until the staging project exists (owner track O3) that is production, and every run also purges leftovers at start-up. Clean with `pnpm --filter @workspace/api-server walkthrough:cleanup` |
| "Database schema matches the code" FAILs | a migration in `lib/db/drizzle/` was never applied to that database. Apply it (`supabase db query --linked < lib/db/drizzle/00xx_….sql`) and re-run; `pnpm --filter @workspace/db schema-drift` prints the full diff |
| "Registered legal identity" FAILs | expected until owner track O5: `LEGAL_ENTITY` in `lib/legal-entity/src/index.ts` is blank, so policies, footers and emails say plain "QuoteAI". This check reads the *checkout*, not the deployment — it tells you what the next deploy will say |
| Preflight passes but the site is still wrong | it checks the API, not the pages. `pnpm --filter @workspace/api-server qa:visual` is the page-level sweep |
| A phone shows copy flush against the glass | that is the GUTTER flag in the `qa:visual` report. At ≤ 640 px every element with its own visible text must keep 12 px from both edges, measured on the *glyphs* (`Range.getClientRects`) and clipped by any scrolling or hidden-overflow ancestor, so a full-bleed band with inner padding is fine and an ellipsised row is fine. Opt a deliberately full-bleed strip out with `data-bleed` (the trade marquee on the homepage is the only one) |
| A `.wrap` element has no side padding on a phone | something later in `mockup-system.css` set the `padding` *shorthand* with a `0` horizontal component on the same element and silently won. Use `padding-block`. This is how `.hero-grid`, `.cta-in` and `.ft-bottom` lost the gutter |
| A page scrolls sideways on a phone and nothing visible overflows | look for an absolutely positioned descendant (typically `.sr-only`) inside a sideways scroller that is itself `position: static` — it takes its containing block from further up, escapes the clip and widens the document. Every scroller in `mockup-system.css` now carries `position: relative`; a new one must too |


## 20. The screen-reader pass a machine can run (Phase 83)

**Where**: `api-server/src/e2e/screen-reader.ts`, run by `qa:visual` on every route × language (`--sr=false` turns it off); the fixes it drove live in `quote-ai/src/components/a11y.tsx` (`SkipLink`, `RouteAnnouncer`), `src/hooks/use-modal-trap.ts`, `src/hooks/use-media-query.ts`, both layouts, and the `.skip-link` / `.sb-nav` / `.mq-copy` rules in `mockup-system.css`.

**How it fits** — axe reads the rendered tree and decides rules from it; at Phase 82 it was reporting 0 violations of any impact across 244 pages. What a keyboard and a screen reader *do* to a page — tab through it, land somewhere, be told where they are — is behaviour, and none of it is in axe's scope. This module asks those questions instead, in one pass inside the page plus one interaction per off-canvas menu. Six of its ten rules are blocking (`offscreen-focusable`, `skip-link`, `nav-current`, `focus-visible`, `positive-tabindex`, `modal-semantics`); the rest are reported to read.

| Ask | Do |
|---|---|
| `offscreen-focusable` on a drawer | the panel is parked off-canvas by a transform and is still tabbable and still read out. Give it `inert` while it is closed (`inert={sidebarIsDrawer && !isMobileMenuOpen}` in `dashboard-layout.tsx`) — `display:none` would kill the slide animation, `aria-hidden` alone leaves the tab stops behind. Content that is off-canvas because an **animation** is moving it (the trade marquee) is skipped by the rule; hide the duplicate copy instead and pause on `:focus-within` |
| `skip-link` | both layouts render `<SkipLink />` as the first tabbable element and their `<main>` carries `id="main"`. A new standalone page (one outside `PublicLayout` / `DashboardLayout`) needs its own `<main id="main">` — `/p`, `/i`, `/sign`, `/t`, `/onboarding` and `/team-invite` all have one |
| `nav-current` | the link to the current page must carry `aria-current="page"`, not just an `active` class — "you are here" cannot be a colour. Links with a fragment (`/#trades`, an article's table of contents) are exempt: they point into the page, not at it |
| `focus-visible` | the element *and* its first three ancestors showed no computed change on focus. Usually `outline: none` on an input whose wrapper never got a `:focus-within` state. Give the wrapper the standard ring (`outline: 2px solid var(--navy)`); use `outline-offset: -3px` when an ancestor clips |
| `modal-semantics` | an overlay must be `role="dialog"` with a name, must take focus, must return it to the trigger, must close on Escape, and everything behind it must be `inert`. `useModalTrap(open, panelRef, onClose)` does all five for the hand-rolled drawers (Radix dialogs already do). Mark the dim backdrop `data-modal-scrim` so tapping it still closes the panel |
| `route-announcer` | `<RouteAnnouncer />` in `App.tsx` is a polite live region that speaks the new page's `<h1>` 250 ms after a client-side navigation. A screen reader announces *document* loads; an SPA changes the page in silence without it |
| `label-in-name` | the visible label must appear inside `aria-label` (WCAG 2.5.3 — a voice-control user says what they see). The sidebar's Notifications link carried `aria-label="Notifications"` over a visible "Notifications 4", which also swallowed the count; the count is now an `aria-hidden` chip plus an `sr-only` "4 unread". `<select>` is exempt: its "visible text" is the option list |
| `landmarks` | exactly one `<main>` and one non-empty `<h1>` per page. A document rendered *inside* a dashboard page (the invoice and contract previews) passes `embedded: true` to its renderer so its title comes out as `<h2 class="doc-title">`; the public page and the PDF keep their `<h1>` |
| `table-headers` | a data table of three rows or more with no `<th>`. The invoice totals table now uses `<th scope="row">` for each label, so a screen reader reads "Total — $31,642.84" instead of two unrelated cells |
| The focus loop reports everything as ringless | the measurement is racing a CSS transition — a computed style read in the same tick as `.focus()` returns the value the transition starts *from*. The module injects `transition: none` for the duration of the loop; keep that if you touch it. It also presses Tab once first, because Chrome only paints `:focus-visible` for a programmatic focus when the last input modality was the keyboard |
| A page evaluate dies with `__name is not defined` | esbuild's `keepNames` wraps named function expressions — including the helpers inside a `page.evaluate` callback — in a helper that exists in the bundle, never in the page. `installNameShim(page)` evaluates a *string* (never transformed) that defines the identity shim |


## 21. Scroll position on navigation (Phase 84)

**Where**: `quote-ai/src/components/scroll-manager.tsx`, mounted once in `App.tsx`.

**How it fits** — a browser scrolls a new document to the top, remembers where you were on Back, and jumps to `#anchor`. All three are tied to a *document load*, and every link in this app is a `pushState`, so none of them happened: opening a quote from half-way down a list opened the quote half-way down, and `/#trades` from another page landed at the top of the homepage with the anchor ignored. `ScrollManager` listens to the same four window events wouter listens to (`pushState`, `replaceState`, `popstate`, `hashchange` — wouter patches the history methods to dispatch the first two), and decides: **hash** → that element, under the sticky header; **Back/Forward** → the offset that URL was left at; **anything else** → the top. `history.scrollRestoration` is `"manual"` while it is mounted, because the browser's own restore fires before a lazy route has rendered and lands against a page that is still short.

| Ask | Do |
|---|---|
| A page still opens part-way down | the navigation did not go through the history API (a raw `window.location` assignment, or a link the router did not intercept). Use wouter's `<Link>` / `navigate()` |
| An anchor lands under the sticky header | `stickyHeaderOffset()` measures `.site-head` / `.topbar` when their computed position is `sticky`, plus 24 px. A new sticky chrome element needs adding there |
| An anchor overshoots on the homepage | its sections reveal as they scroll into view, so the target moves for a few hundred ms after the first landing. The anchor case re-evaluates for 900 ms (`keepCorrecting`); everything else stops as soon as it arrives |
| The page fights the user after a click | it should not: any `wheel`, `touchstart`, `keydown` or `mousedown` cancels the correction loop immediately. If that regresses, check those listeners are still attached in `applyRepeatedly` |
| A filter or tab should *not* scroll to the top | it will, if it changes the URL. Keep that state in React (which is what every list page here does) or, if it must be in the URL, give `ScrollManager` an opt-out |
