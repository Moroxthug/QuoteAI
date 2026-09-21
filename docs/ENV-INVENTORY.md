# Environment inventory

Generated 2026-09-21 by `pnpm env:inventory` — 95 variables read by the code, 105 in the manifest, 26 set in Vercel production.

Kinds: **required** (boot/core flows) · **recommended** (launch expectation, degraded without) · **feature** (integration reports "not configured") · **deferred** (partner access pending, intentionally unset) · legacy / build / platform / local.

## required

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `ADMIN_EMAIL` | yes |  | comma list; /api/admin/* access and default recipient of ops alerts | api-server/src/lib/ops.ts, api-server/src/routes/admin.ts |  |
| `BETTER_AUTH_SECRET` | yes |  | session signing; rotating it logs everyone out | api-server/src/invoices/service.ts, api-server/src/lib/auth.ts, api-server/src/routes/calendar.ts (+6) |  |
| `BETTER_AUTH_URL` | yes |  | https://quoteai.ca — auth callback base | api-server/src/lib/auth.ts |  |
| `CRON_SECRET` | yes |  | Vercel Cron bearer for /api/cron/tick; nothing scheduled runs without it | api-server/src/routes/cron.ts |  |
| `DATABASE_URL` | yes |  | Supabase Postgres via the session pooler (aws-0-us-west-2.pooler.supabase.com:5432) | lib/db/src/index.ts, lib/db/drizzle.config.ts |  |
| `GROQ_API_KEY` | yes |  | the AI provider in production (OpenAI-compatible); without any AI key every AI feature takes its fallback | lib/integrations-openai-ai-server/src/client.ts |  |
| `QUOTEAI_BASE_URL` | yes |  | public origin used in emails/PDF links | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `RESEND_API_KEY` | yes |  | every transactional email (auth, quotes, invoices, ops alerts) | api-server/src/lib/auth.ts, api-server/src/lib/email.ts, api-server/src/lib/emailUtils.ts (+4) |  |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | yes |  | POST /api/payments/connect/webhook signature (Phase 14 invoices paid by card) | api-server/src/app.ts |  |
| `STRIPE_PUBLISHABLE_KEY` | yes |  | returned to the client for Checkout | api-server/src/stripeClient.ts |  |
| `STRIPE_SECRET_KEY` | yes |  | subscriptions + Connect | api-server/src/stripeClient.ts |  |
| `STRIPE_WEBHOOK_SECRET` | yes |  | POST /api/payments/webhook signature | api-server/src/app.ts |  |
| `SUPABASE_PRIVATE_BUCKET` | yes |  | private-assets (signed URLs) | api-server/src/lib/objectStorage.ts |  |
| `SUPABASE_PUBLIC_BUCKET` | yes |  | public-assets | api-server/src/lib/objectStorage.ts |  |
| `SUPABASE_SERVICE_ROLE_KEY` | yes |  | Storage service key — server only, never in the client | api-server/src/lib/objectStorage.ts |  |
| `SUPABASE_URL` | yes |  | Storage (logos, PDFs, photos) | api-server/src/lib/objectStorage.ts |  |
| `TOKEN_ENCRYPTION_KEY` | yes |  | AES-256-GCM key for OAuth tokens at rest — see RUNBOOKS → rotate TOKEN_ENCRYPTION_KEY | api-server/src/lib/crypto.ts |  |
| `TRUSTED_ORIGINS` | yes |  | comma list of origins allowed by CORS + better-auth | api-server/src/lib/auth.ts |  |

## recommended

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `CRON_HEARTBEAT_URL` | — |  | dead-man switch pinged after each successful tick (Healthchecks.io / Better Stack / Cronitor) | api-server/src/lib/ops.ts | recommended for launch, not set |
| `CRON_STALE_AFTER_HOURS` | — |  | default 25 (daily schedule + 1 h grace); set 2 if the cron moves to hourly | api-server/src/lib/ops.ts | recommended for launch, not set |
| `OPS_ALERT_EMAIL` | — |  | where cron/automation alerts go; falls back to ADMIN_EMAIL | api-server/src/lib/ops.ts | recommended for launch, not set |
| `POSTHOG_HOST` | — |  | defaults to https://eu.i.posthog.com | api-server/src/lib/telemetry.ts | recommended for launch, not set |
| `POSTHOG_KEY` | — |  | server telemetry; unset = no product analytics | api-server/src/lib/telemetry.ts | recommended for launch, not set |
| `RESEND_WEBHOOK_SECRET` | — |  | POST /api/webhooks/resend — without it bounce/complaint events are rejected (500) and email_events stays empty | api-server/src/app.ts | recommended for launch, not set |
| `SENTRY_DSN` | — |  | API error tracking; unset = errors only in Vercel logs | api-server/src/lib/errorTracking.ts | recommended for launch, not set |
| `VITE_POSTHOG_HOST` | — |  | defaults to https://eu.i.posthog.com | quote-ai/src/lib/analytics.ts | recommended for launch, not set |
| `VITE_POSTHOG_KEY` | — |  | browser analytics (loaded on first interaction) | quote-ai/src/App.tsx, quote-ai/src/lib/analytics.ts | recommended for launch, not set |
| `VITE_SENTRY_DSN` | — |  | browser error tracking (same DSN is fine) | quote-ai/src/lib/error-tracking.ts | recommended for launch, not set |

## feature

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `AI_MODEL` | — | AI | model override; Groq rewrites gpt-4o* names itself | api-server/src/contracts/service.ts, api-server/src/jobs/setup.ts, api-server/src/lib/generateQuoteFromText.ts | AI not configured |
| `GMAIL_SEND_CLIENT_ID` | — | Gmail send | Phase 20 — OAuth app registration pending (growth-platform-plan) | api-server/src/lib/gmailSendClient.ts | Gmail send not configured |
| `GMAIL_SEND_CLIENT_SECRET` | — | Gmail send |  | api-server/src/lib/gmailSendClient.ts | Gmail send not configured |
| `GMAIL_SEND_REDIRECT_URI` | — | Gmail send |  | api-server/src/lib/gmailSendClient.ts | Gmail send not configured |
| `GOOGLE_CALENDAR_CLIENT_ID` | yes | Google Calendar | Phase 12 | api-server/src/lib/googleCalendarClient.ts |  |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | yes | Google Calendar |  | api-server/src/lib/googleCalendarClient.ts |  |
| `GOOGLE_CALENDAR_REDIRECT_URI` | yes | Google Calendar |  | api-server/src/lib/googleCalendarClient.ts |  |
| `GSC_SERVICE_ACCOUNT_KEY` | — | Search Console (admin) | admin SEO panel only | api-server/src/routes/admin.ts | Search Console (admin) not configured |
| `GSC_SITE_URL` | — | Search Console (admin) |  | api-server/src/routes/admin.ts | Search Console (admin) not configured |
| `META_APP_ID` | — | Meta Lead Ads | Phase 28 | api-server/src/lib/metaLeadAdsClient.ts, api-server/src/routes/meta-lead-ads.ts | Meta Lead Ads not configured |
| `META_APP_SECRET` | — | Meta Lead Ads |  | api-server/src/app.ts, api-server/src/lib/metaLeadAdsClient.ts, api-server/src/routes/meta-lead-ads.ts | Meta Lead Ads not configured |
| `META_LEADGEN_VERIFY_TOKEN` | — | Meta Lead Ads |  | api-server/src/routes/meta-lead-ads.ts | Meta Lead Ads not configured |
| `META_REDIRECT_URI` | — | Meta Lead Ads |  | api-server/src/lib/metaLeadAdsClient.ts | Meta Lead Ads not configured |
| `QUICKBOOKS_CLIENT_ID` | yes | QuickBooks | Phase 11 | api-server/src/lib/quickbooksClient.ts, api-server/src/routes/quickbooks.ts |  |
| `QUICKBOOKS_CLIENT_SECRET` | yes | QuickBooks |  | api-server/src/lib/quickbooksClient.ts, api-server/src/routes/quickbooks.ts |  |
| `QUICKBOOKS_ENVIRONMENT` | yes | QuickBooks | sandbox | production | api-server/src/lib/quickbooksClient.ts |  |
| `QUICKBOOKS_REDIRECT_URI` | yes | QuickBooks |  | api-server/src/lib/quickbooksClient.ts |  |
| `WHATSAPP_ACCESS_TOKEN` | — | WhatsApp | Phase 9 — Meta app + template approval pending | api-server/src/routes/whatsapp.ts | WhatsApp not configured |
| `WHATSAPP_APP_SECRET` | — | WhatsApp | webhook signature; the webhook 500s without it (safe: nothing is accepted) | api-server/src/app.ts | WhatsApp not configured |
| `WHATSAPP_BUSINESS_NUMBER` | — | WhatsApp |  | api-server/src/routes/whatsapp.ts | WhatsApp not configured |
| `WHATSAPP_LEAD_FOLLOWUP_TEMPLATE` | — | WhatsApp | approved template names | api-server/src/automations/leadFollowup.ts, api-server/src/routes/leads.ts | WhatsApp not configured |
| `WHATSAPP_PHONE_NUMBER_ID` | — | WhatsApp |  | api-server/src/routes/whatsapp.ts | WhatsApp not configured |
| `WHATSAPP_PHOTO_SHARE_TEMPLATE` | — | WhatsApp |  | api-server/src/routes/jobs.ts | WhatsApp not configured |
| `WHATSAPP_REVIEW_REQUEST_TEMPLATE` | — | WhatsApp |  | api-server/src/automations/jobReviewRequest.ts | WhatsApp not configured |
| `WHATSAPP_VERIFY_TOKEN` | — | WhatsApp |  | api-server/src/routes/whatsapp.ts | WhatsApp not configured |

## deferred

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `FINANCEIT_APP_ID` | — |  | Phase 27 — Financeit partner credentials not granted | api-server/src/lib/financeitClient.ts |  |
| `FINANCEIT_APP_SECRET` | — |  |  | api-server/src/lib/financeitClient.ts |  |
| `FINANCEIT_ENVIRONMENT` | — |  |  | api-server/src/lib/financeitClient.ts |  |
| `FINANCEIT_WEBHOOK_SECRET` | — |  |  | api-server/src/app.ts |  |
| `FLINKS_CUSTOMER_ID` | — |  | Phase 29 (bank feed) — Flinks sandbox not granted | api-server/src/lib/flinksClient.ts |  |
| `FLINKS_ENVIRONMENT` | — |  |  | api-server/src/lib/flinksClient.ts |  |
| `FLINKS_INSTANCE` | — |  |  | api-server/src/lib/flinksClient.ts |  |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | — |  |  | api-server/src/lib/googleLsaClient.ts |  |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | — |  |  | api-server/src/lib/googleLsaClient.ts |  |
| `GOOGLE_LSA_CLIENT_ID` | — |  | Phase 29 (LSA) — Google Ads developer token not applied for | api-server/src/lib/googleLsaClient.ts, api-server/src/routes/google-lsa.ts |  |
| `GOOGLE_LSA_CLIENT_SECRET` | — |  |  | api-server/src/lib/googleLsaClient.ts, api-server/src/routes/google-lsa.ts |  |
| `GOOGLE_LSA_REDIRECT_URI` | — |  |  | api-server/src/lib/googleLsaClient.ts |  |
| `OUTLOOK_CALENDAR_CLIENT_ID` | — |  | Phase 16 — Entra app registration not done | api-server/src/lib/outlookCalendarClient.ts |  |
| `OUTLOOK_CALENDAR_CLIENT_SECRET` | — |  |  | api-server/src/lib/outlookCalendarClient.ts |  |
| `OUTLOOK_CALENDAR_REDIRECT_URI` | — |  |  | api-server/src/lib/outlookCalendarClient.ts |  |
| `WAVE_CLIENT_ID` | — |  | Phase 25 — Wave partner app not granted | api-server/src/lib/waveClient.ts, api-server/src/routes/wave.ts |  |
| `WAVE_CLIENT_SECRET` | — |  |  | api-server/src/lib/waveClient.ts, api-server/src/routes/wave.ts |  |
| `WAVE_REDIRECT_URI` | — |  |  | api-server/src/lib/waveClient.ts |  |

## legacy

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | — |  | Replit-era alias; e2e uses it to point AI at a closed port | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | — |  | Replit-era alias | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `INVOICE_LINK_SECRET` | — |  | HMAC for public invoice links; falls back to BETTER_AUTH_SECRET (set in prod) — only needed to rotate invoice links independently of sessions | api-server/src/invoices/service.ts |  |
| `OPENAI_API_KEY` | — |  | alias of the AI key; GROQ_API_KEY wins | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `SESSION_SECRET` | yes |  | read by lib/auth for the pre-better-auth cookie; kept set, harmless | api-server/src/invoices/service.ts, api-server/src/lib/auth.ts |  |
| `admin_email` | — |  | lowercase alias of ADMIN_EMAIL | api-server/src/routes/admin.ts |  |
| `posthog_host` | — |  | lowercase alias of POSTHOG_HOST | api-server/src/lib/telemetry.ts |  |
| `posthog_key` | — |  | lowercase alias of POSTHOG_KEY | api-server/src/lib/telemetry.ts |  |

## build

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `SENTRY_AUTH_TOKEN` | — |  | build-time only: source map inject + upload (scripts/sentry-sourcemaps.mjs) | quote-ai/vite.config.ts |  |
| `SENTRY_ENVIRONMENT` | — |  | optional override; defaults to VERCEL_ENV | api-server/src/lib/errorTracking.ts |  |
| `SENTRY_ORG` | — |  | with SENTRY_AUTH_TOKEN |  |  |
| `SENTRY_PROJECT` | — |  | with SENTRY_AUTH_TOKEN |  |  |
| `SENTRY_RELEASE` | — |  | optional override; defaults to VERCEL_GIT_COMMIT_SHA | api-server/src/lib/errorTracking.ts, quote-ai/vite.config.ts, scripts/sentry-sourcemaps.mjs |  |
| `VITE_SENTRY_ENVIRONMENT` | — |  | optional override for the browser side | quote-ai/src/lib/error-tracking.ts |  |

## platform

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `NODE_ENV` | — |  | vercel.json sets production | api-server/src/app.ts, api-server/src/lib/errorTracking.ts, api-server/src/lib/logger.ts (+1) |  |
| `VERCEL_ENV` | — |  |  | api-server/src/lib/errorTracking.ts |  |
| `VERCEL_GIT_COMMIT_SHA` | — |  | becomes the Sentry release | api-server/src/lib/errorTracking.ts, quote-ai/vite.config.ts, scripts/sentry-sourcemaps.mjs |  |
| `VERCEL_PROJECT_PRODUCTION_URL` | — |  |  | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `VERCEL_REGION` | — |  |  | api-server/src/lib/errorTracking.ts |  |
| `VERCEL_SKIP_TYPECHECK` | — |  | vercel.json |  |  |
| `VERCEL_URL` | — |  |  | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `VITE_RELEASE` | — |  | injected by vite.config.ts from VERCEL_GIT_COMMIT_SHA | quote-ai/src/lib/error-tracking.ts, quote-ai/vite.config.ts |  |

## local

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `API_PROXY_TARGET` | — |  | server/serve.mjs proxy (Lighthouse QA) | quote-ai/vite.config.ts, quote-ai/server/serve.mjs |  |
| `BACKUP_DATABASE_URL` | — |  | GitHub Actions secret: the nightly backup source |  |  |
| `BACKUP_PASSPHRASE` | — |  | ops:backup encryption (also a GitHub Actions secret for the nightly backup) |  |  |
| `BASE_PATH` | — |  | vite base override | quote-ai/vite.config.ts |  |
| `E2E_DEBUG` | — |  | e2e harness |  |  |
| `E2E_NO_PURGE` | — |  | e2e harness |  |  |
| `E2E_REAL_AI` | — |  | e2e harness |  |  |
| `LOG_LEVEL` | — |  | pino level; default info | api-server/src/lib/logger.ts |  |
| `PORT` | — |  | local server only | api-server/src/index.ts, quote-ai/vite.config.ts, quote-ai/server/serve.mjs |  |
| `PRERENDER_SAMPLE` | — |  | validate-prerender sample size | quote-ai/scripts/validate-prerender.ts |  |
| `QA_CHROME_PATH` | — |  | qa:visual / qa:lighthouse |  |  |
| `WALKTHROUGH_FRONTEND` | — |  | walkthrough script |  |  |

## Summary

- AI_MODEL: AI not configured
- CRON_HEARTBEAT_URL: recommended for launch, not set
- CRON_STALE_AFTER_HOURS: recommended for launch, not set
- GMAIL_SEND_CLIENT_ID: Gmail send not configured
- GMAIL_SEND_CLIENT_SECRET: Gmail send not configured
- GMAIL_SEND_REDIRECT_URI: Gmail send not configured
- GSC_SERVICE_ACCOUNT_KEY: Search Console (admin) not configured
- GSC_SITE_URL: Search Console (admin) not configured
- META_APP_ID: Meta Lead Ads not configured
- META_APP_SECRET: Meta Lead Ads not configured
- META_LEADGEN_VERIFY_TOKEN: Meta Lead Ads not configured
- META_REDIRECT_URI: Meta Lead Ads not configured
- OPS_ALERT_EMAIL: recommended for launch, not set
- POSTHOG_HOST: recommended for launch, not set
- POSTHOG_KEY: recommended for launch, not set
- RESEND_WEBHOOK_SECRET: recommended for launch, not set
- SENTRY_DSN: recommended for launch, not set
- VITE_POSTHOG_HOST: recommended for launch, not set
- VITE_POSTHOG_KEY: recommended for launch, not set
- VITE_SENTRY_DSN: recommended for launch, not set
- WHATSAPP_ACCESS_TOKEN: WhatsApp not configured
- WHATSAPP_APP_SECRET: WhatsApp not configured
- WHATSAPP_BUSINESS_NUMBER: WhatsApp not configured
- WHATSAPP_LEAD_FOLLOWUP_TEMPLATE: WhatsApp not configured
- WHATSAPP_PHONE_NUMBER_ID: WhatsApp not configured
- WHATSAPP_PHOTO_SHARE_TEMPLATE: WhatsApp not configured
- WHATSAPP_REVIEW_REQUEST_TEMPLATE: WhatsApp not configured
- WHATSAPP_VERIFY_TOKEN: WhatsApp not configured
