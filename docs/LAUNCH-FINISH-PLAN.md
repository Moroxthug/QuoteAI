# QuoteAI — Launch finish plan (Phases 92-99)

Written 2026-09-23, after Phase 91. Every feature plan is built (Phases 0-91). What is left falls in two piles:

- **Code the assistant can finish** — Phases 92-98, one per conversation, in this order. Same conventions as every plan before: one phase per commit, pushed to `main` (auto-deploys), a build-log entry at the bottom of this file, a runbook section when behaviour changes, e2e + `qa:visual` before calling it done.
- **Things only the owner can do** — Phase 99, the whole list in one place, including every owner step carried over from `PILOT-LAUNCH-PLAN.md` (O1-O12), `LAUNCH-GO-NO-GO.md` §1-§3 and Phases 85-91. Each item says what to do, how long it takes, and what to tell the assistant afterwards (several are "give me the value, I do the rest").

To pick up in a new conversation: *"go on with phase 92"* (or whichever is next in the status table).

---

## Status

| Phase | Title | Who | State |
|---|---|---|---|
| 92 | The embed widget that doesn't exist | assistant | **done** 2026-09-23 |
| 93 | Sign-up, walked for real | assistant | not started |
| 94 | Job and quote rough edges | assistant | not started |
| 95 | French legal pages + who did what | assistant | not started |
| 96 | Integrations, one level deeper | assistant | not started |
| 97 | Test coverage where there is none | assistant | not started |
| 98 | Owner handoff kit | assistant | not started |
| 99 | Everything left to the owner | **owner** | open |

---

## Phase 92 — The embed widget that doesn't exist

**The bug** (confirmed 2026-09-23): Settings → Account and the admin page hand contractors an embed snippet that loads `https://<site>/widget.js` with `data-api-key`. There is no `widget.js` — the SPA rewrite serves `index.html` as JavaScript, so a contractor who pastes the snippet gets nothing, silently. The API half exists (`/api/public/*`, CORS fixed in an earlier phase, `app.ts` ~649).

- Build `widget.js` as a small standalone bundle (no React): reads `data-api-key`, renders the quote-request funnel into `#quoteai-widget` inside a shadow root (the host site's CSS can't break it, and it can't break the host's), EN/FR from `data-lang` or the page's `<html lang>`, posts to the existing public endpoints, shows the same confirmation the hosted form does.
- Serve it from `artifacts/quote-ai/public/` (versioned query string, long cache) and make sure the Vercel rewrite and CSP don't swallow it.
- A test page (`/widget-test.html`, `noindex`) that embeds it the way a contractor would, and an e2e case that loads it in the qa browser, submits a lead and finds it in the contractor's pipeline.
- Settings: a "Test your widget" link, and the snippet updated if the attributes change.
- Rate limits and abuse: reuse the public limiter; a bad or revoked key shows a neutral "unavailable" box, never an error dump.

## Phase 93 — Sign-up, walked for real

Phase 91's onboarding steps 2 (your work) and 4 (your team) were checked by typecheck and reading, never on a screen.

- Make each onboarding step reachable by the `qa:visual` sweep without a URL a customer could misuse (fixture-driven: the sweep seeds a fresh signed-in user with no company and drives the steps; no `?step=` in production code).
- Walk, in the browser, as three people: a brand-new owner (all four steps, then the dashboard); an owner arriving from `/pricing?plan=monthly_pro` with 4 logins wanted (checkout opens with plan + 2 extra seats — Stripe test mode, or the add-on stub when no test prices exist yet); an employee with an access code (`/join` → sign up → email verification → back to `/join` → join → profile setup).
- Also the email-invite path end to end, and an invitee who lands on `/onboarding` by accident (must go to the dashboard, never create an empty company).
- Fix whatever the walk finds; screenshots of every step at 375 and 1280, EN and FR.

## Phase 94 — Job and quote rough edges

From the Phase 66 functional walkthrough, still open:

- **"Mark complete" and "Archive" on a job** have no confirmation, and completing doesn't offer the final invoice or the holdback release. Add a confirm dialog that shows what is still open (unbilled milestones, holdback, open permits — permits already block) and offers to draft the final invoice / schedule the holdback release.
- **Quote forms collect no client email or phone**, so CRM rows are created without contact details (the send and contract dialogs compensate). Add both to the AI and manual quote forms, prefilled from the client when one is picked, saved to the client record.
- **French money formatting** on the job page is en-CA, and chart axes read "2k $" twice. Route every amount through the locale-aware formatter; fix the axis tick formatter.
- Sweep for any other `toLocaleString("en-CA")` left in French paths.

## Phase 95 — French legal pages + who did what

- **French privacy policy and terms** (`/fr/confidentialite`, `/fr/conditions` or the existing FR routing pattern): translated from the current EN pages, same sections, same `LEGAL_ENTITY` lines, hreflang both ways, in the sitemap, footer links per language. Marked as awaiting the same legal review as the English (owner item L-3).
- **Who sent, who won** (Phase 91 counts only who *created*): record `sent_by_user_id` on quotes and invoices when they are sent (request context, like `created_by`), credit an accepted quote to whoever sent it, and show "sent" and "won" per person on `/dashboard/me` and teammates' pages.
- A small **team leaderboard** card for owners on Team → Team members (quotes sent, won, win rate, invoiced — last 90 days), hidden when there is one person.

## Phase 96 — Integrations, one level deeper

- **QuickBooks: one line per item with its Canadian tax code** instead of one total per invoice/cost (GST/HST, QST, PST mapped from the tax-code mapping built in Phase 88). Backfill nothing; new syncs only. Stubbed e2e.
- **Calendar: pick which calendar** to write to (Google `calendarList`, Outlook `/me/calendars`) instead of always the primary one.
- **Job photo thumbnails**: generate a small JPEG on upload (the crew app already shrinks client-side; this is server-side for office uploads and old photos, lazily on first request), gallery and PDFs use them.

## Phase 97 — Test coverage where there is none

- e2e for **change orders** (draft → sign → job value and invoices follow), **job photos** (upload, share, thumbnail from 96), **QuickBooks / Google Calendar / Gmail side effects** with the existing vendor stubs, and the **job assistant** with a stubbed model (tool call → proposal → confirm).
- Convert the remaining ~60 routes that validate `req.body` by hand (route matrix "manual" column) to zod, a file at a time; the matrix column should end near zero.
- `lib/api-zod` generated code still fails `tsc --build` (zod v3 vs v4); regenerate or pin so the whole workspace builds clean.

## Phase 98 — Owner handoff kit

Everything the assistant can prepare so each Phase 99 item is minutes, not an afternoon:

- `pnpm ops:owner-check` — one command that reports, green/red, every owner item it can detect from the outside: backup workflow has run and produced an artifact, staging secrets present in GitHub, Sentry DSN set and receiving, heartbeat URL set, `/api/healthz/ops` 200, PostHog key set, Resend webhook secret set, the four add-on price ids and three annual price ids present and valid in the right Stripe mode, `PILOT_PROMO_CODE` resolves, Vercel secrets marked Sensitive, `LEGAL_ENTITY` filled, WhatsApp/Gmail/Meta vars present. Prints the Phase 99 item number next to each red line.
- The restore rehearsal as one script call once the target URL exists.
- The legal packet (contract templates, ToS, privacy EN+FR, sub-processor list) exported to a single PDF for the lawyer.
- Update `LAUNCH-GO-NO-GO.md` §1-§3 to today's state so §5 can be signed.

---

## Phase 99 — Everything left to the owner

Grouped by urgency. **(→ assistant)** marks items where you only provide a value or credential and the assistant does the rest in a conversation.

### Blocks launch

| # | Item | What to do | Time | Then |
|---|---|---|---|---|
| L-1 | **Database backups** (O1, GO/NO-GO 1.1) | GitHub → repo Settings → Secrets: `BACKUP_DATABASE_URL`, `BACKUP_SUPABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (RUNBOOKS §5). Run the "backup" workflow once, download the artifact. Optionally Supabase Pro for daily backups. | 15 min | — |
| L-2 | **Restore rehearsal** (O3, 1.2) | Supabase → the unused July project `cynlsphsuxrnctsxcmve` → Database → reset password → copy the pooler URL. | 5 min | **→ assistant** runs `ops:restore` + schema drift against it |
| L-3 | **Legal review** (O8, 1.3, 1.4) | Send the legal packet (Phase 98) to a Canadian construction/consumer-law lawyer: contract templates ON/BC/AB/QC/generic, ToS, privacy policy EN+FR. Book now, it takes weeks. | 30 min + wait | **→ assistant** applies changes, bumps `TEMPLATE_VERSION` |
| L-4 | **Registered business identity** (O5, 1.5) | Decide the legal name, mailing address, tax numbers, person in charge of personal information (Law 25). | 5 min | **→ assistant** fills `lib/legal-entity` (privacy, ToS, footer, every email) |
| L-5 | **Staging Supabase project** (O3, 1.6) | Create it (or reuse the July slot after L-2), then GitHub secrets `E2E_DATABASE_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`. From then on the test suite stops touching production. | 20 min | **→ assistant** applies migrations 0000-0053 and turns the CI e2e job on |
| L-6 | **Error tracking + alerts** (O4, 1.7) | Sentry project → `SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN/ORG/PROJECT` in Vercel. Healthchecks.io (or Better Stack) check → `CRON_HEARTBEAT_URL`. Uptime monitor on `GET /api/healthz/ops`. `OPS_ALERT_EMAIL`. (RUNBOOKS §1-§2) | 30 min | — |
| L-7 | **Encryption key escrow** (O2, 1.10) | Confirm `TOKEN_ENCRYPTION_KEY` is in your password manager. If not, say so. | 5 min | **→ assistant** rotates it now (RUNBOOKS §6) |
| L-8 | **Stripe add-on prices** (Phases 90-91) | `STRIPE_SECRET_KEY=sk_test_… pnpm --filter @workspace/scripts stripe-addon-prices`, then again with `sk_live_…`. Paste the 4 printed lines into Vercel (Production = live ids, Preview = test ids). Check the seat price ($15/month default) before the first run. | 10 min | — |
| L-9 | **Stripe annual prices + pilot promo** (O9, Phase 73/81) | `pnpm --filter @workspace/scripts stripe-annual-prices` in each mode → `STRIPE_PRICE_YEARLY_{STARTER,PRO,ELITE}`. Create the pilot promotion code in Stripe → `PILOT_PROMO_CODE`. | 15 min | — |
| L-10 | **Go / no-go decision** (Phase 70) | Fill §5 of `docs/LAUNCH-GO-NO-GO.md` once L-1…L-9 are done or consciously deferred. | 15 min | — |

### Before the first pilot customer

| # | Item | What to do | Time |
|---|---|---|---|
| P-1 | **Real-device pass** (O11) | iPhone Safari and Android Chrome: sign-up → quote → send → `/p` accept → `/sign` on the phone → `/t` clock-in with location → `/join` with an access code. Note anything awkward. **→ assistant** fixes the list. | 1 h |
| P-2 | **A person with a screen reader** | NVDA (Windows) or VoiceOver (iPhone) through the same path. Machines report 0 issues; a person will find reading-order problems they can't. | 1 h |
| P-3 | **Live AI pass** | Three real jobs in production: AI quote, contract drafting, receipt reading, the job assistant. | 30 min |
| P-4 | **Vercel secrets as Sensitive** (1.9) | Recreate `STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_SECRET` as Sensitive; redeploy. | 5 min |
| P-5 | **Analytics + email events** (O6) | PostHog project → `POSTHOG_KEY`, `VITE_POSTHOG_KEY`. Resend → webhook to `POST /api/webhooks/resend` → `RESEND_WEBHOOK_SECRET`. | 10 min |
| P-6 | **Vercel Pro** (O7) | Hourly cron instead of daily, then `CRON_STALE_AFTER_HOURS=2` (RUNBOOKS §2). $20/month. | 5 min |
| P-7 | **Help centre read-through** | Read the ten guides at `/help` once, in your voice. **→ assistant** edits what reads wrong. | 30 min |

### When you want the feature live

| # | Item | What to do |
|---|---|---|
| F-1 | **WhatsApp** (O9) | Meta Business Manager: submit the three templates (lead follow-up, review request, photo share); set the 8 `WHATSAPP_*` vars. Until then they fall back to email. |
| F-2 | **SMS toll-free verification** (O9) | Twilio → Regulatory compliance → toll-free verification (text is in PILOT-LAUNCH-PLAN O9). 1-7 days. Until approved, texts to Canadian numbers are skipped. |
| F-3 | **Gmail sending** | Google Cloud OAuth app → 3 `GMAIL_SEND_*` vars. |
| F-4 | **Outlook calendar** (Phase 85) | Microsoft Entra app registration → `OUTLOOK_CALENDAR_CLIENT_ID/SECRET`. |
| F-5 | **Meta Lead Ads, Search Console** | App registrations → 4 `META_*` vars, 2 Search Console vars. |
| F-6 | **Partner access** | Wave, Financeit, Flinks, Google LSA — each needs the partner to approve an application; built and honest-disabled until then. |
| F-7 | **Payroll file layouts** (Phases 89/89b) | Export a period and try importing it into a real Wagepoint / Payworks / QuickBooks Payroll account. **→ assistant** fixes the layout from their error or template. |

### Later / ongoing

| # | Item |
|---|---|
| G-1 | **External pentest** (O10) — scoped web-app test; give them `docs/ROUTE-MATRIX.md`. **→ assistant** fixes findings. |
| G-2 | **Marketing photography** (O12) — the slots are built; the pictures are yours. |
| G-3 | **Multi-entity for real** — Phase 90 was built ahead of demand; the first pilot with two companies is the real test. |
| G-4 | Keep `xlsx` in mind: pinned to the SheetJS CDN tarball, `pnpm update` never bumps it — check https://cdn.sheetjs.com occasionally. |

---

## Build log

*(one entry per phase: date, built, found, deferred, verification)*

### Phase 92 — The embed widget (2026-09-23)

**Built**
- **`/widget.js`**: `src/widget/widget.ts`, one file with no imports and no React, compiled on its own to an IIFE by a small Vite plugin (served live in dev, emitted as `dist/public/widget.js` in the build: 18 KB, 7 KB gzipped). Shadow root, styles through `adoptedStyleSheets`, text only (no `innerHTML`), EN/FR from `data-lang` or the page's `<html lang>`, optional `data-target` and `data-color`. Two steps (the work, then who to contact, with consent), then the range or "a quote will follow". Labels, errors tied to their fields, focus on the heading at each step and on the error after a failed send, 44 px targets, reduced motion. Fires `quoteai:submitted` for the contractor's analytics.
- **Server**: `POST /api/public/quotes` keeps the lead when the AI fails (40 s, no retries; unreadable JSON; nothing priced): client filed, the visitor's words on the lead event, contractor told "no automatic estimate", visitor told a quote will follow. It used to answer 500 and store nothing. A `website` honeypot (201, nothing stored). `estimate: { min, max }` in the response (the old flat fields stay). The visitor's receipt email is in the widget's language; both widget emails lost their emojis and purple gradient for the product's navy, and the price box when there is no price.
- **`/widget-test.html`** (noindex): a plain sample "contractor site" that adds the widget exactly as the snippet does. Settings → Widget and Settings → Account have a **Test your widget** link and a line on `data-lang`.
- `vercel.json`: `/widget.js` 1 h cache + 1 day stale-while-revalidate (a versioned query string can't work: the snippet is pasted once and never edited), CORS `*`, CORP cross-origin; the test page `X-Robots-Tag: noindex`. Static files are served before the SPA rewrite, so neither is swallowed by it.
- Runbook §30. qa:visual now sweeps `/widget-test.html` and Settings → Widget; the showcase account has a widget key.

**Found**
1. **Settings → Account crashed ("Something went wrong") for every account that has a widget key**: the widget card used the form library's `FormLabel` outside a form. No sweep had shown it because the showcase account had no key. Plain labels now.
2. On those pages, rendered with a key for the first time: the two scrollable snippet boxes weren't reachable by keyboard and the Widget tab's key field had no label (axe). Fixed.
3. An AI failure answered the visitor with a 500 and stored nothing, and the model call ran with the SDK default (minutes, with retries) inside a 60 s function. Both fixed as above.
4. The screen-reader check's route-announcer rule would have thrown on a page without the SPA root; it now applies to SPA pages only.
5. The test page's HTML comment contained the text of a script tag, which the CSP guard read as an inline script. Reworded.

**Not done / deferred**
- Widget analytics beyond the DOM event (views, drop-off per step): nothing is counted server-side.
- The host site's CSP belongs to the host: a contractor whose site restricts `connect-src` must add quoteai.ca (runbook §30).
- The contractor's lead notification is still English only (the visitor's receipt follows the widget's language).

**Verification**: `pnpm typecheck` (in `pnpm build`) · `pnpm lint` **0 errors** (69 warnings, pre-existing) · `pnpm knip` clean · `i18n-audit` **4656 = 4656**, 0 missing, 0 split · `env:inventory` **no problems** · route matrix **478** (regenerated: the widget POST now reads the client back) · unit **28 files / 191 tests** · e2e **phase92 4/4** (a visitor on a cross-site page gets `$2,848 – $3,955`; the host's hostile CSS doesn't reach the form; errors in place with focus; consent required; draft quote + lead + client + both emails. French page with the AI down: French form, lead without a quote with the words kept, French receipt with no price box. Missing, wrong and regenerated keys show only the neutral box. Honeypot stores nothing. No uncaught page errors) · regression **security (IDOR + CORS), followups, quotes, public-tokens** green · `pnpm build` ✓ (`dist/public/widget.js` present) · `qa:visual` on `/widget-test.html`, Settings → Account and Settings → Widget, EN+FR × 1280/375: 0 overflow, 0 gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys · every widget state (step 1 and step 2 with errors, estimate, no estimate at 375 FR, not available) checked by eye.
