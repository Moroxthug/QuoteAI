# QuoteAI security and compliance audit — 2026-11-09

Read-only audit of the repository (API, web app, Pocket app, CI, docs) against what a SOC 2 auditor and Canadian privacy law (PIPEDA, Québec Law 25) would look for. Nothing was changed. Every High finding below was re-checked by hand in the code; Medium and Low findings come from the review and cite file:line so they can be checked the same way.

## Bottom line

The foundations are better than most companies this size: tokens encrypted with AES-256-GCM, hashed share tokens, signature-checked webhooks, tenant scoping on almost every route, a strict web CSP, encrypted nightly backups with a rehearsed restore, self-serve export and deletion, and a security audit log.

It is **not** ready to be marketed as "ironclad" or "SOC 2 compliant", for three reasons:

1. **Four exploitable bugs** (section A) — one stored XSS that any sign-up can use against any logged-in user, one cross-tenant client read, and known-critical versions of the auth library in production.
2. **No change control**: every push to `main` goes to production, unreviewed and ungated by tests or the dependency audit. This alone fails SOC 2 CC8.1.
3. **The paperwork SOC 2 and Law 25 actually audit does not exist**: no written security policies, no named privacy officer, no incident/breach register, no privacy impact assessment, no access reviews, no vendor reviews, no staging environment.

**On the marketing idea itself:** SOC 2 is not something you can be "100% compliant" with by yourself. It is a report a licensed CPA firm writes after examining your controls — Type I (controls exist on a date) and then Type II (controls worked over 3–12 months). Until that report exists, saying "SOC 2 compliant" (or "bank-level", "ironclad") on quoteai.ca is a claim you cannot back, which the Competition Act treats as misleading advertising, and enterprise buyers will ask for the report. What you *can* say today, truthfully, is in section E.

## A. Fix now (High — confirmed in code)

| # | Finding | Where | Exploit | Fix |
|---|---|---|---|---|
| A1 | **Stored XSS through SVG logos.** SVG uploads are accepted on the client's declared type, not sanitised, and served unauthenticated from quoteai.ca itself (`/api/*` is same-origin). The API CSP is only `frame-ancestors`. | `api-server/src/routes/business-profile.ts:25,292-309`, `routes/storage.ts:39-60` | Any free sign-up uploads `logo.svg` with `<script>`, sends the link to a logged-in user or admin; the script calls `/api/*` with their cookie and reads/changes their whole CRM. | Drop SVG (or rasterise to PNG on upload); sniff type from bytes; serve storage with `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff`. |
| A2 | **Vulnerable production dependencies, nothing blocks the deploy.** `pnpm audit --prod`: 3 critical, 12 high. Lockfile pins better-auth 1.7.3 (<1.7.7), dompurify 3.4.15, proxy-addr 2.0.7, multer 2.3.0 (<2.5.0), plus body-parser, zod, sharp, compression, vite. | `pnpm-lock.yaml`; `.github/workflows/dependency-audit.yml` | Known auth-library flaws are live; the audit job is red but Vercel deploys anyway. | Upgrade now; make tests + audit required checks before deploy (section C1). |
| A3 | **Cross-tenant client read/messaging (IDOR).** `buildInvoiceContext` loads the contract and client by id with no `userId` filter; job create stores a body `clientId` without an ownership check; job detail and text/email-client then load it unscoped. | `api-server/src/invoices/service.ts:133-135`, `routes/invoices.ts:245`, `routes/public-v1/invoices.ts:69`, `routes/jobs.ts:254,306,1196,1325`, `routes/public-v1/jobs.ts:81` | A user with another company's client UUID reads that client's name/address/email/phone and can text or email them. Needs the UUID (not guessable), so it's the kind of bug a pentester finds and reports as High. | Add `eq(table.userId, userId)` to every by-id lookup taking a body id; validate `clientId`/`contractId` before insert. Backstop: composite FKs `(id, user_id)` or Postgres RLS. |
| A4 | **Reflected XSS on Meta verify endpoints if the token env var is unset.** `token === process.env.X` passes when both are `undefined`; the challenge is echoed as HTML. | `routes/whatsapp.ts:1185-1190`, `routes/meta-lead-ads.ts:190-195` | `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=<script>…` runs script on quoteai.ca. | 403 when the env var is unset; constant-time compare; `res.type("text/plain")`. (Check whether `WHATSAPP_VERIFY_TOKEN` / `META_LEADGEN_VERIFY_TOKEN` are set in Vercel.) |

**Status 2026-11-09 — A1–A4 fixed:**
- **A1:** logos and avatars are typed from their bytes (`lib/imageSniff.ts`); SVG is refused; every stored file is served with `default-src 'none'; sandbox` + nosniff, so SVGs uploaded earlier are inert too. The web pickers and their EN/FR copy no longer offer SVG (the PDFs never drew SVG anyway).
- **A2:** better-auth 1.7.18, multer 2.5.0, sharp 0.35.5, compression 1.8.2, and refreshed proxy-addr, body-parser, dompurify, vite, qs, zod 4.x, grpc-js, brace-expansion. Audit went from 3 critical / 12 high to 0 critical / 1 high. **The remaining high is zod 3.x** (memory exhaustion on oversized collections; fixed only in zod 4.6.6) — needs the zod 3 → 4 migration of the shared catalog, and lowering the 25 MB body limit (D) limits it meanwhile. Until then the weekly dependency-audit job stays red.
- **A3:** `buildInvoiceContext` scopes contract and client to the company; job create (app and public API) refuses a client that isn't the company's; job list/detail, text/email client, review request and the assistant read clients scoped to the job's company.
- **A4:** `lib/metaVerify.ts`: refuses when the verify token isn't configured, constant-time compare, challenge must be alphanumeric and is sent as text/plain.

## B. Fix before any security claim (Medium)

**Access and authentication**
- **B1 MFA not enforced anywhere** — not for owners, not for the platform super-admin, which is just an email allowlist (`routes/admin.ts:20-33`) able to grant plans and read every user's quotes; an admin without 2-step can sign in with an emailed code alone. Require 2-step in `requireAdmin`; add a per-company "require 2-step" setting.
- **B2 Rate limiters are in-memory** (`lib/rateLimit.ts`, better-auth default) — on Vercel every instance has its own counters, so every brute-force budget is weaker than written. Move to a shared store (Postgres/Upstash); better-auth `rateLimit.storage: "database"`.
- **B3 Emailed sign-in code brute force / email bombing** — send endpoint not rate-limited (`app.ts:61-77`), no per-account lockout (`lib/auth.ts:162-168`). Add send limits and a per-email failure counter.
- **B4 API keys outlive their creator** (`lib/apiKeys.ts`, `middlewares/apiKeyAuth.ts:39-43`) — a removed admin's key keeps the old role forever. Check the creator's membership on each use; revoke on removal; optional expiry.
- **B5 SSRF** in calendar feed import (`routes/calendar.ts:321-340`, `calendar/inbound.ts:201-205`: string-only host check, redirects followed) and outbound webhooks (`routes/developer-api.ts:96`, `lib/webhooks.ts:53`: no check). Resolve DNS, block private/loopback/link-local, `redirect: "manual"`, https only.

**Data protection and privacy**
- **B6 Data is in the US, residency not addressed.** Production Supabase is us-west-2 (`docs/RUNBOOKS.md:15`), Vercel functions run in the default US region (no `regions` in `vercel.json`), backups are GitHub artifacts (US). Legal, and disclosed generally in the privacy policy, but Law 25 s.17 requires a written assessment before moving Québec residents' data out of Québec, and "your data stays in Canada" is the claim Canadian contractors and their clients value most. Recommended: move Supabase to ca-central-1 and set `"regions": ["yul1"]` (the rehearsal project is already in ca-central-1); otherwise write the s.17 assessment.
- **B7 Law 25 governance missing** — no named person in charge of personal information (EN policy has none; FR only "la personne responsable", `privacy-policy.tsx:212`), no confidentiality-incident register, no breach-notification procedure, no PIA. These are statutory (Law 25 ss.3.1, 3.5–3.8; PIPEDA breach records), not optional.
- **B8 Logos and avatars survive account deletion** — they live in the public bucket, but `purgeAccount` only walks the private one (`account/service.ts:67,382`). The privacy policy promises deletion. Purge (and export) `logos/<id>` and `avatars/<id>` from the public bucket.
- **B9 Google/Apple sign-in tokens stored in plaintext** (`lib/db/src/schema/auth.ts:34-36`) while every other provider token is AES-GCM encrypted; also the webhook signing secret and widget key. Turn on better-auth `account.encryptOAuthTokens` (or don't keep provider tokens); encrypt the webhook secret with `encryptSecret`.
- **B10 Audit log is mutable, incomplete and deleted with the tenant** (`schema/automation.ts:95`). Not recorded: failed logins, password changes/resets, email change, every platform-admin/HQ action, the purge itself. Add a trigger that rejects UPDATE/DELETE, add those events, keep security events past purge under the tombstone id.
- **B11 Client PII sent to AI providers** (`lib/generateQuoteFromText.ts:274-282`: client name, address, photos to Groq/OpenAI). Disclosed, but zero-retention isn't confirmed and the model doesn't need name/address. Drop them from the prompt; get ZDR/DPA confirmation from both providers on file.
- **B12 No retention schedule for operational data** — only `cron_ticks` is purged; audit log, email events, SMS/WhatsApp messages, notifications, webhook deliveries grow forever. The policy's "technical logs 90 days" isn't backed by anything. Write a per-table schedule and cron purges.
- **B13 Email addresses in plaintext logs** (~13 `logger.info({ to })` sites, e.g. `lib/email.ts:202,578`). Add `*.to`, `*.email` to pino `redact`, log a message id instead.

## C. Change management and operations (SOC 2 CC7/CC8)

- **C1 No change control.** Push to `main` deploys to production; no PR, no reviewer, no required checks, and AI sessions push directly. Fix: protect `main` (PR required, tests + dependency audit required), enable Vercel "wait for checks", deploy only merged PRs. For a solo founder, auditors accept self-review *if* every change is a PR with passing checks — the record is what's audited.
- **C2 No staging; production secrets on the laptop.** e2e has run against production by hand (`docs/LAUNCH-GO-NO-GO.md:28`); `.env.staging` holds the production `DATABASE_URL`, service-role key, Stripe secret and `TOKEN_ENCRYPTION_KEY`, plus `.env.stripe-live.local`. Create the staging Supabase/Vercel project; keep production secrets only in Vercel and the password manager; full-disk encryption on the laptop.
- **C3 GitHub Actions supply chain** — actions pinned by tag not SHA, no `permissions:` on `test.yml`/`dependency-audit.yml`/`android.yml`, keystore secret interpolated into shell (`android.yml:71`). Pin SHAs, add `permissions: contents: read`, pass secrets through `env:`.
- **C4 Monitoring is wired but probably off** — Sentry, ops alert email and backup secrets are no-ops until their env vars are set (previously noted as unset). Set them and send a test alert; SOC 2 needs evidence that alerts reach a person.
- **C5 Next restore rehearsal due by 2026-12-26** (last passed 2026-09-26).

## D. Low

Localhost origins trusted for credentialed CORS in production (`lib/auth.ts:56`); `err.message` returned on some errors (`routes/catalog.ts:219`, several 400s); 25 MB JSON body limit on every route (`app.ts:721`); Resend webhook doesn't check the timestamp window (`app.ts:609-640`); invoice/portal links never expire and share `BETTER_AUTH_SECRET` as a fallback key; portal code attempts reset on resend and aren't atomic (`routes/portal.ts:113,144`); admins can demote other admins (`routes/team-members.ts:211-262`); better-auth session/password defaults (8-char minimum, no breached-password check); assistant send-invoice card doesn't show the emailed message (`assistant/tools.ts:384`); Sentry error text may contain row values; PostHog (EU host) receives quote totals and isn't deleted on purge, nor is the Stripe customer; sub-processor list misses FCM/APNs native push and Apple WeatherKit; mobile money screens aren't screenshot-protected and `android.allowBackup` isn't set; backup passphrase is static with default scrypt cost.

## E. What is solidly in place (and can be said truthfully today)

- All traffic over TLS with HSTS preload; strict CSP on the web app (hashed scripts, no `unsafe-eval`); nosniff, frame and referrer headers on web and API.
- Third-party connection tokens (QuickBooks, Wave, Google/Outlook calendar, Gmail, Meta, LSA, Flinks) encrypted at rest with AES-256-GCM; documented key rotation.
- Share links, invites, API keys and one-time codes stored only as SHA-256 hashes; constant-time comparisons.
- Every webhook (Stripe, Meta/WhatsApp, Twilio, Resend, Financeit) signature-verified, and refused when its secret is missing.
- Tenant scoping on nearly every route, re-checked company membership on every request, a role matrix enforced on writes.
- Email verification before any session; all sessions revoked on password reset; optional TOTP 2-step with backup codes.
- AI assistant only proposes; nothing is written until the user confirms, and every tool is scoped to the caller.
- Nightly encrypted backups of the database and files with a verify step; restore rehearsed and logged.
- Self-serve data export and account deletion (7-day grace, tokens revoked, tax records kept 7 years as required).
- Bilingual privacy policy with a sub-processor list and retention periods; CASL consent and unsubscribe records.
- Mobile app keeps its session in the device keychain/keystore.

Honest marketing lines available now: *"Encrypted in transit and at rest. Two-step sign-in. Your connected accounts' keys are encrypted with AES-256. Export or delete your data any time. Nightly encrypted backups."* After B6: *"Your data is stored in Canada."* After a Type I report: *"SOC 2 Type I audited."*

## F. SOC 2 gap map (Trust Services Criteria — Security, plus Confidentiality/Privacy)

| Area | Criteria | Status | Gap |
|---|---|---|---|
| Governance, policies | CC1, CC2, CC5 | ❌ | No information security policy, acceptable use, access control, change management, incident response, vendor management, data classification/retention, BCP/DR policies. No security training or background-check record. |
| Risk assessment | CC3, CC9 | ❌ | No written risk register or annual risk assessment; no vendor risk reviews (Supabase, Vercel, Stripe, OpenAI/Groq, Resend, Twilio SOC 2 reports on file). |
| Logical access | CC6.1–6.3 | ⚠️ | Strong app-level model; missing MFA enforcement (B1), access reviews of who can reach Vercel/Supabase/GitHub/Stripe, offboarding checklist, API-key lifecycle (B4). |
| Infrastructure / vulns | CC6.6–6.8, CC7.1 | ⚠️ | A1–A4, B5; dependency gate not enforced (A2); no external pentest yet (already on the owner list). |
| Monitoring, incidents | CC7.2–7.5 | ⚠️ | Runbooks exist; alerting likely off (C4); no security-incident plan or breach register (B7); audit log not tamper-evident (B10). |
| Change management | CC8.1 | ❌ | C1, C2. |
| Availability / backups | A1 | ✅/⚠️ | Backups and rehearsal good; backups in US GitHub artifacts; no written RTO/RPO. |
| Confidentiality / privacy | C1, P1–P8 | ⚠️ | B6–B9, B11–B13. |

## G. Recommended order

1. **This week (code, ~1–2 days):** A1–A4, B8, B9, low-hanging Lows (localhost CORS, verify tokens, error text).
2. **Next (code, ~1 week):** B1–B5, B10, B12, B13, C3; protect `main` and gate deploys (C1).
3. **Owner decisions:** move data to Canada (B6); name the privacy officer (B7); set Sentry/alerts/backup secrets (C4); create staging (C2); book the external pentest after step 1.
4. **Paperwork (the bulk of SOC 2):** policies, risk assessment, vendor reviews, incident/breach register, PIA, quarterly access review. A compliance platform (Vanta, Drata, Secureframe) generates the policy templates, collects evidence automatically from GitHub/Vercel/Supabase, and introduces auditors. Typical path: ~2–3 months to Type I readiness, then a 3–6-month observation window for Type II.
