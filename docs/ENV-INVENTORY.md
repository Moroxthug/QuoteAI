# Environment inventory

Generated 2026-09-22 by `pnpm env:inventory` — 113 variables read by the code, 122 in the manifest (Vercel side not checked).

Kinds: **required** (boot/core flows) · **recommended** (launch expectation, degraded without) · **feature** (integration reports "not configured") · **deferred** (partner access pending, intentionally unset) · legacy / build / platform / local.

## required

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `ADMIN_EMAIL` | ? |  | comma list; /api/admin/* access and default recipient of ops alerts | api-server/src/lib/ops.ts, api-server/src/routes/admin.ts |  |
| `BETTER_AUTH_SECRET` | ? |  | session signing; rotating it logs everyone out | api-server/src/invoices/service.ts, api-server/src/lib/auth.ts, api-server/src/portal/service.ts (+7) |  |
| `BETTER_AUTH_URL` | ? |  | https://quoteai.ca — auth callback base | api-server/src/lib/auth.ts |  |
| `CRON_SECRET` | ? |  | Vercel Cron bearer for /api/cron/tick; nothing scheduled runs without it | api-server/src/routes/cron.ts |  |
| `DATABASE_URL` | ? |  | Supabase Postgres via the session pooler (aws-0-us-west-2.pooler.supabase.com:5432) | api-server/scripts/backup.ts, api-server/scripts/rotate-token-key.ts, lib/db/src/index.ts (+1) |  |
| `GROQ_API_KEY` | ? |  | the AI provider in production (OpenAI-compatible); without any AI key every AI feature takes its fallback | lib/integrations-openai-ai-server/src/client.ts |  |
| `QUOTEAI_BASE_URL` | ? |  | public origin used in emails/PDF links | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `RESEND_API_KEY` | ? |  | every transactional email (auth, quotes, invoices, ops alerts) | api-server/src/lib/auth.ts, api-server/src/lib/email.ts, api-server/src/lib/emailUtils.ts (+4) |  |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | ? |  | POST /api/payments/connect/webhook signature (Phase 14 invoices paid by card) | api-server/src/app.ts |  |
| `STRIPE_PUBLISHABLE_KEY` | ? |  | returned to the client for Checkout | api-server/src/stripeClient.ts |  |
| `STRIPE_SECRET_KEY` | ? |  | subscriptions + Connect | api-server/src/account/service.ts, api-server/src/stripeClient.ts |  |
| `STRIPE_WEBHOOK_SECRET` | ? |  | POST /api/payments/webhook signature | api-server/src/app.ts |  |
| `SUPABASE_PRIVATE_BUCKET` | ? |  | private-assets (signed URLs) | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `SUPABASE_PUBLIC_BUCKET` | ? |  | public-assets | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `SUPABASE_SERVICE_ROLE_KEY` | ? |  | Storage service key — server only, never in the client | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `SUPABASE_URL` | ? |  | Storage (logos, PDFs, photos) | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `TOKEN_ENCRYPTION_KEY` | ? |  | AES-256-GCM key for OAuth tokens at rest — see RUNBOOKS → rotate TOKEN_ENCRYPTION_KEY | api-server/src/lib/crypto.ts |  |
| `TRUSTED_ORIGINS` | ? |  | comma list of origins allowed by CORS + better-auth | api-server/src/lib/auth.ts |  |

## recommended

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `CRON_HEARTBEAT_URL` | ? |  | dead-man switch pinged after each successful tick (Healthchecks.io / Better Stack / Cronitor) | api-server/src/lib/ops.ts |  |
| `CRON_STALE_AFTER_HOURS` | ? |  | default 25 (daily schedule + 1 h grace); set 2 if the cron moves to hourly | api-server/src/lib/ops.ts |  |
| `OPS_ALERT_EMAIL` | ? |  | where cron/automation alerts go; falls back to ADMIN_EMAIL | api-server/src/lib/ops.ts |  |
| `POSTHOG_HOST` | ? |  | defaults to https://eu.i.posthog.com | api-server/src/lib/telemetry.ts |  |
| `POSTHOG_KEY` | ? |  | server telemetry; unset = no product analytics | api-server/src/lib/telemetry.ts |  |
| `RESEND_WEBHOOK_SECRET` | ? |  | POST /api/webhooks/resend — without it bounce/complaint events are rejected (500) and email_events stays empty | api-server/src/app.ts |  |
| `SENTRY_DSN` | ? |  | API error tracking; unset = errors only in Vercel logs | api-server/src/lib/errorTracking.ts |  |
| `VITE_POSTHOG_HOST` | ? |  | defaults to https://eu.i.posthog.com | quote-ai/src/lib/analytics.ts |  |
| `VITE_POSTHOG_KEY` | ? |  | browser analytics (loaded on first interaction) | quote-ai/src/App.tsx, quote-ai/src/lib/analytics.ts |  |
| `VITE_SENTRY_DSN` | ? |  | browser error tracking (same DSN is fine) | quote-ai/src/lib/error-tracking.ts |  |

## feature

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `AI_MODEL` | ? | AI | model override; Groq rewrites gpt-4o* names itself | api-server/src/contracts/service.ts, api-server/src/jobs/setup.ts, api-server/src/lib/generateQuoteFromText.ts |  |
| `GMAIL_SEND_CLIENT_ID` | ? | Gmail send | Phase 20 — OAuth app registration pending (growth-platform-plan) | api-server/src/lib/gmailSendClient.ts |  |
| `GMAIL_SEND_CLIENT_SECRET` | ? | Gmail send |  | api-server/src/lib/gmailSendClient.ts |  |
| `GMAIL_SEND_REDIRECT_URI` | ? | Gmail send |  | api-server/src/lib/gmailSendClient.ts |  |
| `GOOGLE_CALENDAR_CLIENT_ID` | ? | Google Calendar | Phase 12 | api-server/src/lib/googleCalendarClient.ts |  |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | ? | Google Calendar |  | api-server/src/lib/googleCalendarClient.ts |  |
| `GOOGLE_CALENDAR_REDIRECT_URI` | ? | Google Calendar |  | api-server/src/lib/googleCalendarClient.ts |  |
| `GSC_SERVICE_ACCOUNT_KEY` | ? | Search Console (admin) | admin SEO panel only | api-server/src/routes/admin.ts |  |
| `GSC_SITE_URL` | ? | Search Console (admin) |  | api-server/src/routes/admin.ts |  |
| `META_APP_ID` | ? | Meta Lead Ads | Phase 28 | api-server/src/lib/metaLeadAdsClient.ts, api-server/src/routes/meta-lead-ads.ts |  |
| `META_APP_SECRET` | ? | Meta Lead Ads |  | api-server/src/app.ts, api-server/src/lib/metaLeadAdsClient.ts, api-server/src/routes/meta-lead-ads.ts |  |
| `META_LEADGEN_VERIFY_TOKEN` | ? | Meta Lead Ads |  | api-server/src/routes/meta-lead-ads.ts |  |
| `META_REDIRECT_URI` | ? | Meta Lead Ads |  | api-server/src/lib/metaLeadAdsClient.ts |  |
| `PILOT_PROMO_CODE` | ? | Pilot programme | Phase 81: the customer-facing Stripe promotion code for the BC/ON/QC pilot (e.g. PILOT2026). Create the coupon + promotion code in the Stripe dashboard first. Set = /pilot shows the code and Checkout applies it automatically; unset = /pilot honestly says no code is running and Checkout falls back to Stripe's own promo box | api-server/src/lib/billing.ts |  |
| `QUICKBOOKS_CLIENT_ID` | ? | QuickBooks | Phase 11 | api-server/src/lib/quickbooksClient.ts, api-server/src/routes/quickbooks.ts |  |
| `QUICKBOOKS_CLIENT_SECRET` | ? | QuickBooks |  | api-server/src/lib/quickbooksClient.ts, api-server/src/routes/quickbooks.ts |  |
| `QUICKBOOKS_ENVIRONMENT` | ? | QuickBooks | sandbox | production | api-server/src/lib/quickbooksClient.ts |  |
| `QUICKBOOKS_REDIRECT_URI` | ? | QuickBooks |  | api-server/src/lib/quickbooksClient.ts |  |
| `STRIPE_PRICE_YEARLY_ELITE` | ? | annual billing | Phase 73: yearly Stripe price id for Elite | api-server/src/lib/billing.ts |  |
| `STRIPE_PRICE_YEARLY_PRO` | ? | annual billing | Phase 73: yearly Stripe price id for Pro | api-server/src/lib/billing.ts |  |
| `STRIPE_PRICE_YEARLY_STARTER` | ? | annual billing | Phase 73: yearly Stripe price id for Starter — `pnpm --filter @workspace/scripts stripe-annual-prices` creates all three and prints them; unset = annual toggle says 'coming soon' | api-server/src/lib/billing.ts |  |
| `TWILIO_ACCOUNT_SID` | ? | SMS | Phase 74 — Twilio; without the three vars every send is logged as skipped/not_configured | api-server/src/lib/sms.ts |  |
| `TWILIO_AUTH_TOKEN` | ? | SMS | also signs the inbound webhook (/api/sms/webhook) | api-server/src/lib/sms.ts, api-server/src/routes/sms.ts |  |
| `TWILIO_FROM_NUMBER` | ? | SMS | E.164 Canadian number, toll-free verified | api-server/src/lib/sms.ts |  |
| `TWILIO_STATUS_CALLBACK_URL` | ? | SMS | optional delivery-status callback; unused by the app today | api-server/src/lib/sms.ts |  |
| `TWILIO_WEBHOOK_URL` | ? | SMS | optional; the exact URL configured in Twilio when it differs from <base>/api/sms/webhook (signature is computed over it) | api-server/src/routes/sms.ts |  |
| `VAPID_PRIVATE_KEY` | ? | Push | Sensitive; signs the VAPID JWT for every push | api-server/src/lib/webPush.ts |  |
| `VAPID_PUBLIC_KEY` | ? | Push | Phase 77 — Web Push (VAPID); without the pair the notifications page says push is not set up and no push is attempted. Generate with pnpm --filter @workspace/scripts vapid-keys | api-server/src/lib/webPush.ts |  |
| `VAPID_SUBJECT` | ? | Push | optional mailto:/https: contact the push services may use; defaults to mailto:support@quoteai.ca | api-server/src/lib/webPush.ts |  |
| `WHATSAPP_ACCESS_TOKEN` | ? | WhatsApp | Phase 9 — Meta app + template approval pending | api-server/src/routes/whatsapp.ts |  |
| `WHATSAPP_APP_SECRET` | ? | WhatsApp | webhook signature; the webhook 500s without it (safe: nothing is accepted) | api-server/src/app.ts |  |
| `WHATSAPP_BUSINESS_NUMBER` | ? | WhatsApp |  | api-server/src/routes/whatsapp.ts |  |
| `WHATSAPP_LEAD_FOLLOWUP_TEMPLATE` | ? | WhatsApp | approved template names | api-server/src/automations/leadFollowup.ts, api-server/src/routes/leads.ts |  |
| `WHATSAPP_PHONE_NUMBER_ID` | ? | WhatsApp |  | api-server/src/routes/whatsapp.ts |  |
| `WHATSAPP_PHOTO_SHARE_TEMPLATE` | ? | WhatsApp |  | api-server/src/routes/jobs.ts |  |
| `WHATSAPP_REVIEW_REQUEST_TEMPLATE` | ? | WhatsApp |  | api-server/src/automations/jobReviewRequest.ts |  |
| `WHATSAPP_VERIFY_TOKEN` | ? | WhatsApp |  | api-server/src/routes/whatsapp.ts |  |

## deferred

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `FINANCEIT_APP_ID` | ? |  | Phase 27 — Financeit partner credentials not granted | api-server/src/lib/financeitClient.ts |  |
| `FINANCEIT_APP_SECRET` | ? |  |  | api-server/src/lib/financeitClient.ts |  |
| `FINANCEIT_ENVIRONMENT` | ? |  |  | api-server/src/lib/financeitClient.ts |  |
| `FINANCEIT_WEBHOOK_SECRET` | ? |  |  | api-server/src/app.ts |  |
| `FLINKS_CUSTOMER_ID` | ? |  | Phase 29 (bank feed) — Flinks sandbox not granted | api-server/src/lib/flinksClient.ts |  |
| `FLINKS_ENVIRONMENT` | ? |  |  | api-server/src/lib/flinksClient.ts |  |
| `FLINKS_INSTANCE` | ? |  |  | api-server/src/lib/flinksClient.ts |  |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | ? |  |  | api-server/src/lib/googleLsaClient.ts |  |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ? |  |  | api-server/src/lib/googleLsaClient.ts |  |
| `GOOGLE_LSA_CLIENT_ID` | ? |  | Phase 29 (LSA) — Google Ads developer token not applied for | api-server/src/lib/googleLsaClient.ts, api-server/src/routes/google-lsa.ts |  |
| `GOOGLE_LSA_CLIENT_SECRET` | ? |  |  | api-server/src/lib/googleLsaClient.ts, api-server/src/routes/google-lsa.ts |  |
| `GOOGLE_LSA_REDIRECT_URI` | ? |  |  | api-server/src/lib/googleLsaClient.ts |  |
| `OUTLOOK_CALENDAR_CLIENT_ID` | ? |  | Phase 16 — Entra app registration not done | api-server/src/lib/outlookCalendarClient.ts |  |
| `OUTLOOK_CALENDAR_CLIENT_SECRET` | ? |  |  | api-server/src/lib/outlookCalendarClient.ts |  |
| `OUTLOOK_CALENDAR_REDIRECT_URI` | ? |  |  | api-server/src/lib/outlookCalendarClient.ts |  |
| `WAVE_CLIENT_ID` | ? |  | Phase 25 — Wave partner app not granted | api-server/src/lib/waveClient.ts, api-server/src/routes/wave.ts |  |
| `WAVE_CLIENT_SECRET` | ? |  |  | api-server/src/lib/waveClient.ts, api-server/src/routes/wave.ts |  |
| `WAVE_REDIRECT_URI` | ? |  |  | api-server/src/lib/waveClient.ts |  |

## legacy

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ? |  | Replit-era alias; e2e uses it to point AI at a closed port | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ? |  | Replit-era alias | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `INVOICE_LINK_SECRET` | ? |  | HMAC for public invoice links; falls back to BETTER_AUTH_SECRET (set in prod) — only needed to rotate invoice links independently of sessions | api-server/src/invoices/service.ts, api-server/src/portal/service.ts |  |
| `OPENAI_API_KEY` | ? |  | alias of the AI key; GROQ_API_KEY wins | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `SESSION_SECRET` | ? |  | read by lib/auth for the pre-better-auth cookie; kept set, harmless | api-server/src/invoices/service.ts, api-server/src/lib/auth.ts, api-server/src/portal/service.ts |  |
| `admin_email` | ? |  | lowercase alias of ADMIN_EMAIL | api-server/src/routes/admin.ts |  |
| `posthog_host` | ? |  | lowercase alias of POSTHOG_HOST | api-server/src/lib/telemetry.ts |  |
| `posthog_key` | ? |  | lowercase alias of POSTHOG_KEY | api-server/src/lib/telemetry.ts |  |

## build

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `SENTRY_AUTH_TOKEN` | ? |  | build-time only: source map inject + upload (scripts/sentry-sourcemaps.mjs) | quote-ai/vite.config.ts |  |
| `SENTRY_ENVIRONMENT` | ? |  | optional override; defaults to VERCEL_ENV | api-server/src/lib/errorTracking.ts |  |
| `SENTRY_ORG` | ? |  | with SENTRY_AUTH_TOKEN |  |  |
| `SENTRY_PROJECT` | ? |  | with SENTRY_AUTH_TOKEN |  |  |
| `SENTRY_RELEASE` | ? |  | optional override; defaults to VERCEL_GIT_COMMIT_SHA | api-server/src/lib/errorTracking.ts, quote-ai/vite.config.ts, quote-ai/scripts/build-sw.ts (+1) |  |
| `STRIPE_CONNECT_FEE_BPS` | ? |  | Phase 73: platform fee on Connect card payments in basis points; default 50 (0.5 %), capped at 500; 0 disables | api-server/src/lib/billing.ts |  |
| `VITE_SENTRY_ENVIRONMENT` | ? |  | optional override for the browser side | quote-ai/src/lib/error-tracking.ts |  |

## platform

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `NODE_ENV` | ? |  | vercel.json sets production | api-server/src/app.ts, api-server/src/lib/errorTracking.ts, api-server/src/lib/logger.ts (+1) |  |
| `VERCEL_ENV` | ? |  |  | api-server/src/lib/errorTracking.ts |  |
| `VERCEL_GIT_COMMIT_SHA` | ? |  | becomes the Sentry release | api-server/src/lib/errorTracking.ts, quote-ai/vite.config.ts, quote-ai/scripts/build-sw.ts (+1) |  |
| `VERCEL_PROJECT_PRODUCTION_URL` | ? |  |  | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `VERCEL_REGION` | ? |  |  | api-server/src/lib/errorTracking.ts |  |
| `VERCEL_SKIP_TYPECHECK` | ? |  | vercel.json |  |  |
| `VERCEL_URL` | ? |  |  | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `VITE_RELEASE` | ? |  | injected by vite.config.ts from VERCEL_GIT_COMMIT_SHA | quote-ai/src/lib/error-tracking.ts, quote-ai/vite.config.ts |  |

## local

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `API_PROXY_TARGET` | ? |  | server/serve.mjs proxy (Lighthouse QA) | quote-ai/vite.config.ts, quote-ai/server/serve.mjs |  |
| `BACKUP_DATABASE_URL` | ? |  | GitHub Actions secret: the nightly backup source |  |  |
| `BACKUP_PASSPHRASE` | ? |  | ops:backup encryption (also a GitHub Actions secret for the nightly backup) | api-server/scripts/backup.ts, api-server/scripts/restore.ts |  |
| `BASE_PATH` | ? |  | vite base override | quote-ai/vite.config.ts |  |
| `E2E_DEBUG` | ? |  | e2e harness |  |  |
| `E2E_NO_PURGE` | ? |  | e2e harness |  |  |
| `E2E_REAL_AI` | ? |  | e2e harness |  |  |
| `LOG_LEVEL` | ? |  | pino level; default info | api-server/src/lib/logger.ts |  |
| `PORT` | ? |  | local server only | api-server/src/index.ts, quote-ai/vite.config.ts, quote-ai/server/serve.mjs |  |
| `PRERENDER_SAMPLE` | ? |  | validate-prerender sample size | quote-ai/scripts/validate-prerender.ts |  |
| `QA_CHROME_PATH` | ? |  | qa:visual / qa:lighthouse |  |  |
| `RESTORE_DATABASE_URL` | ? |  | restore rehearsal target (scripts/restore.ts) — never the production URL | api-server/scripts/restore.ts |  |
| `RESTORE_SUPABASE_SERVICE_ROLE_KEY` | ? |  | restore rehearsal target service key | api-server/scripts/restore.ts |  |
| `RESTORE_SUPABASE_URL` | ? |  | restore rehearsal target project | api-server/scripts/restore.ts |  |
| `VITE_ENABLE_SW` | ? |  | Phase 77: =1 registers the service worker on the Vite dev server (production always does) | quote-ai/src/lib/pwa.ts |  |
| `WALKTHROUGH_FRONTEND` | ? |  | walkthrough script |  |  |

## Summary

No problems.
