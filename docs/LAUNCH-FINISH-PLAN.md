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
| 93 | Sign-up, walked for real | assistant | **done** 2026-09-23 |
| 94 | Job and quote rough edges | assistant | **done** 2026-09-23 |
| 95 | French legal pages + who did what | assistant | **done** 2026-09-23 |
| 96 | Integrations, one level deeper | assistant | **done** 2026-09-23 |
| 97 | Test coverage where there is none | assistant | **done** 2026-09-23 |
| 98 | Owner handoff kit | assistant | **done** 2026-09-23 |
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

**Start here:** `CRON_SECRET='…' pnpm ops:owner-check` prints this whole list with each item's current state and next step (RUNBOOKS §36); run it again after each item. Grouped by urgency. **(→ assistant)** marks items where you only provide a value or credential and the assistant does the rest in a conversation.

### Blocks launch

| # | Item | What to do | Time | Then |
|---|---|---|---|---|
| L-1 | **Database backups** (O1, GO/NO-GO 1.1) | GitHub → repo Settings → Secrets: `BACKUP_DATABASE_URL`, `BACKUP_SUPABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (RUNBOOKS §5). Run the "backup" workflow once, download the artifact. Optionally Supabase Pro for daily backups. | 15 min | — |
| L-2 | **Restore rehearsal** (O3, 1.2) | Supabase → the unused July project `cynlsphsuxrnctsxcmve` → Database → reset password → copy the pooler URL. | 5 min | **→ assistant** runs `ops:rehearse --target <url>` (backup → restore → schema drift → row in `docs/RESTORE-REHEARSALS.md`) |
| L-3 | **Legal review** (O8, 1.3, 1.4) | Send `docs/legal-packet/QuoteAI-legal-packet.pdf` (Phase 98) to a Canadian construction/consumer-law lawyer: contract templates ON/BC/AB/QC/generic, ToS and privacy policy in English and French (the French pages from Phase 95 are a translation, and terms §1 has a new "both versions have the same effect" clause to confirm). Book now, it takes weeks. | 30 min + wait | **→ assistant** applies changes, bumps `TEMPLATE_VERSION` |
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
| F-4b | **Google Calendar scope** (Phase 96) | Google Cloud → the calendar OAuth app → add `https://www.googleapis.com/auth/calendar.calendarlist.readonly` to the consent screen scopes (the app already requests it). Anyone connected before Phase 96 reconnects once to pick a calendar. |
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

### Phase 93 — Sign-up, walked for real (2026-09-23)

**Built**
- **The walk** (`phase93.e2e`): Chrome against the real SPA (Vite proxied at the in-process API, shared launcher `e2e/viteServer.ts`), each person in their own browser with their own IP, the real sign-up form and the verification link out of the email. Five people, each in EN and FR at 1280 and 375 px (20 walks, a screenshot and an overflow / error-boundary / raw-key check at every step):
  - A new owner: sign-up, "send it again", verify, the four steps, first quote, dashboard.
  - An owner from `/pricing` with Pro and 4 logins wanted. Stripe is mocked at the SDK; EN runs have a seat price, FR runs don't. Checkout, then the way back.
  - An employee with an access code: `/join`, sign up, verify, back to `/join`, join, profile.
  - An emailed invite (admin) end to end, then `/onboarding` by accident: dashboard, the employer's company untouched, no company of their own.
  - An invitee who signed up without the link.
  Real sign-ups are cleaned up by address (`adoptUserByEmail`, and the stale purge now also takes `e2e-walk-…@example.invalid`).
- **qa:visual reaches every onboarding step** without a URL a customer could use. A `newcomer` session (signed in, no company, reset before each page) is clicked through steps 1-4 and step 4 with `?plan=monthly_pro`. An `invitee` session shows the invitation screen.
- **Account emails** (`lib/accountEmails.ts`): verify, reset and welcome in the site's language (`x-quoteai-lang` from the auth client, Accept-Language as fallback). Navy, no emojis. The welcome no longer promises "unlimited quotes / 3 free PDFs" and is not sent to people joining a company.
- **Invitations waiting for your address**: `GET /api/team/pending-invites` and `POST …/:id/accept` (verified address only, never access-code rows). Onboarding shows them before any form.
- **Back from Stripe**: onboarding's checkout returns to Team → Members. A notice on Team and the dashboard reports success or cancellation and syncs the subscription once.

**Found (and fixed)**
1. An invitee who signed up without their link had no way to join from onboarding. The only way on was to create a company of their own.
2. Onboarding showed its form before knowing whose company it was. An admin member reaching it could have written over the employer's name, address and payment schedule.
3. Step 4 showed "2 extra logins" and charged for none when `STRIPE_PRICE_EXTRA_SEAT` isn't set (true in production today). It also showed no total and put the arrow before "Continue to payment".
4. After paying, the owner landed on `/dashboard?payment=success`, which nothing read: no confirmation, no way to the invite step, plan possibly not synced yet.
5. The verification, reset and welcome emails were English only in purple, with emojis. The welcome went to every employee too, telling them to set up a business and pick a plan.
6. The check-your-email screen had no way to resend.
7. Step 3's button still said "Continue and create your first quote" (step 4 follows). In French it wrapped to four lines at 375 px. The default payment schedule was English in French. The two field icons sat on lines of their own. Step 1's placeholders were Toronto examples in French.
8. `/join` and the invite page drew the logo as a speck, and their two buttons wrapped to two lines each at 375 px. The invite page showed the role as the raw word "admin" in French.
9. The public header's "Sign up" broke onto two lines at 375 px. The floating help button covered the sign-up button and the terms line.
10. Team → Members overflowed sideways at 375 px once a company has seats to buy (count + three buttons in a row that didn't wrap). The invite dialog's email and role labels weren't tied to their fields.
11. The new owner's dashboard still said "Complete your profile" right after they had. The plan subtitle said Pro gives "unlimited quotes" (it's 60 a month). One French string said "devis".

**Not done / deferred**
- The subscription-activated email (sent by the webhook) still has emojis and the old colours; it is part of billing, not sign-up.
- The contractor's lead notification is still English only (from Phase 92).
- The dashboard mixes "30 seconds" and "60 seconds" for the first quote; so does the marketing site. Left alone.
- The `sent_by` / leaderboard work is Phase 95.

**Verification**: `pnpm typecheck` ✓ · `pnpm lint` **0 errors** (69 warnings, as before) · `pnpm knip` unchanged from before the phase · `i18n-audit` **4677 = 4677**, 0 missing, 0 split · `env:inventory` **no problems** · route matrix **480** (regenerated; the new accept route allowlisted with its reason) · unit **28 files / 191 tests** · e2e **phase93 20/20** · regression **team, security (21/21), account, billing, phase91, phase92** green · `pnpm build` ✓ · `qa:visual` on onboarding (every step as newcomer + invitation as invitee), sign-in/up, `/join`, `/team-invite`, `/pricing`, `/dashboard`, Team → Members: **112 pages**, EN × 5 widths + FR × 1280/375: 0 overflow, 0 gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys · every walk step checked by eye at 375 and 1280, EN and FR.

### Phase 94 — Job and quote rough edges (2026-09-23)

**Built**
- **Money in the app's language** (`lib/money.ts`): `formatCad` / `formatCents` / `formatCadWhole` / `formatCadShort` / `formatAmount` follow the language the `LanguageProvider` renders with (set during render, so the first paint is right). `lib/jobs-api.ts` re-exports them, so its 30-odd callers changed nothing. Fourteen private `Intl.NumberFormat("en-CA", …)` copies (quotes list and editor, manual builder, payment schedule card and editor, catalog, contracts, documents, analytics, dashboard, price check, Gantt, job setup, the SEO quote mockup) now use it, and so do the long-format dates on Billing, Settings and Documents. French reads "12 345,50 $".
- **Chart axes**: one decimal, compact, in the language on screen ("$1.5K" / "1,5 k$"). The old ticks rounded to whole thousands, so 1 500 and 2 000 both read "2k $".
- **Client email and phone on both quote forms** (AI and manual share the client card): optional, labels tied to their fields, a malformed email shown under the field and the save stopped with focus on it. Picking a client shows their email and phone, editable. The picker now lists the account's clients from every device (`/api/clients`), then whatever this browser remembers. French placeholders are Montréal / QC / H2X 1Y4.
- **Server**: `POST /api/quotes` (AI) kept only name/address/tax numbers from the form and dropped email and phone. It keeps them now. `ensureClientForQuote`: a quote with an email/phone for a client first saved by name alone fills in that record instead of creating a second one. This only happens when the record's email/phone are blank or the same (a namesake with another email stays separate), and the key is left alone because the portal addresses clients by `md5(dedupKey)`.
- **Mark complete** also lists milestones not marked done (they don't block). The confirm dialogs themselves, the final-invoice and holdback drafts, and the permit block were already there (Phases 80 and 87). The plan's first bullet was out of date.
- **Job page KPI tiles** show whole dollars, with a smaller figure in five-tile rows.
- Runbook §32.

**Found (and fixed)**
1. The AI quote route threw away the client's email and phone even when a client sent them, so every CRM row from an AI quote started without contact details.
2. The quote form's "saved clients" were this browser's localStorage only (a new laptop showed none). The session hand-off `quoteai:selected_client` is read but written nowhere (left alone, harmless).
3. The client card's labels weren't tied to their inputs.
4. The job page's KPI tiles broke amounts over two lines at 1280 ("$11,300 / 00", "$2,758.7 / 3"). French would have been worse.
5. `security.e2e` had been failing since Phase 93: its new `pending-invites/:id/accept` route had no fixture, so the IDOR sweep counted three unseeded routes (limit two). It now uses A's invited-member row, so the check runs against a real foreign id.
6. A draft of the completion dialog said "completing the job marks them done". It doesn't (the server leaves milestones alone), so the wording says what actually happens.

**Not done / deferred**
- `pages/admin.tsx` keeps en-CA on purpose (internal, English only). Timestamps printed with a bare `toLocaleString()` follow the browser's locale, not the app's (Settings integrations, security sessions).
- Percentages still print "25%" in French (should be "25 %"): the job setup payment terms, KPI sub-lines.
- The picker lists clients who were on a quote (`/api/clients` groups quotes). A client with no quote yet, such as one created through the public API, isn't offered.

**Verification**: `pnpm typecheck` ✓ · `pnpm lint` **0 errors** (69 warnings, as before) · `pnpm knip` 3 fewer unused exports than before the phase (the duplicate formatters) · `i18n-audit` **4688 = 4688**, 0 missing, 0 split · `env:inventory` **no problems** · route matrix **480** (regenerated, line numbers only) · unit **29 files / 195 tests** (new `lib/money-format.test.ts`) · e2e **phase94 3/3** · regression **quotes, money, lifecycle, security (21/21 after the fixture fix), phase92, portal** green · `pnpm build` ✓ · `qa:visual` on the dashboard, quote form (plus a new client with a bad email, and a picked client), quotes, analytics, settings, billing, catalog, contracts, documents, the job page (plus its completion dialog), job setup: **140 pages**, EN × 5 widths + FR × 1280/375: 0 overflow, 0 gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys · French job page, charts, quote form and completion dialog checked by eye.

### Phase 95 — French legal pages + who did what (2026-09-23)

**Built**
- **`/fr/confidentialite` and `/fr/conditions`**: the privacy policy and terms in French, section for section, with the same `LEGAL_ENTITY` lines (`inProvince()` added to `lib/legal-entity` for "en Ontario" / "au Québec"). One file per page, English and French side by side, sharing `components/legal-page-shell.tsx` (breadcrumb, title, last updated, hreflang both ways, `inLanguage`). Prerendered, in the sitemap, in `LOCALE_PAGE_PAIRS` (so the toggle goes between the pair) and in the URL-decides-language list. French privacy also names the Commission d'accès à l'information. Terms §1 (both languages) says both versions exist with the same effect; the English terms' date moved to September 23.
- **Links in the reader's language**: the public footer (both places), sign-up (it linked the old `/termini/` and `/privacy/` redirects), the site map, Settings → Security, the widget's privacy link, the French account-deletion email.
- **Sent by** (migration 0054, applied): `quotes.sent_by_user_id` stamped by the first signed-in person to email the quote, `invoices.sent_by_user_id` by the first person to send the invoice (a scheduled send stamps nobody). Nothing backfilled.
- **Won by**: an accepted quote is credited to whoever sent it, or to its maker when it never went out from the app. `/api/me/stats` and the teammate page gain `quotes.sent` and a monthly "sent"; won and win rate follow the credit; invoiced follows the sender, else the maker. "Quotes made" tile now reads "3 · 2 sent · $51,099.30"; the month table has a Sent column; the note under it says how a win is credited.
- **Team leaderboard**: `GET /api/team/leaderboard?days=90` (team:full = owner, admin) and a card under Team → Team members: person, quotes sent, won, win rate, invoiced (amount only for roles that see invoices), sorted by wins then invoiced, hidden with one person. Two grouped queries whatever the team size.
- Runbook §33.

**Found (and fixed)**
1. Sign-up's "terms" and "privacy" links and the site map's pointed at the Italian-era redirect paths `/termini/` and `/privacy/`.
2. The personal page's English win rate read "100 % won" (French spacing in English).

**Not done / deferred**
- Terms §4.1 names the one-off purchases as the pricing page does ("Soumission à l'unité"); the English still says "Single with Watermark / Single Clean". Left for the lawyer pass.
- A quote sent only through a contract (never emailed on its own) isn't stamped with a sender; it is credited to its maker.
- Showcase and older invoices have no maker or sender, so the leaderboard's "invoiced" starts at zero for everyone until new invoices go out.

**Verification**: `pnpm typecheck` ✓ · `pnpm lint` **0 errors** (69 warnings, as before) · `pnpm knip` unchanged (100 exports / 34 types) · `i18n-audit` **4698 = 4698**, 0 missing, 0 split · route matrix **481** (regenerated: `GET /api/team/leaderboard`, team:full) · unit **29 files / 195 tests** · e2e **phase95 4/4** · regression **phase91, security, quotes, lifecycle, phase88, phase80** (54/54) · `pnpm build` ✓ (440 pages prerendered, `validate-prerender` and `validate-sitemap` 440/440; `/fr/confidentialite` is `lang="fr-CA"` with canonical + hreflang en/fr/x-default) · `qa:visual` on the four legal pages, sign-up, site map, `/dashboard/me` (owner and foreman), a teammate's page and Team → Members with the leaderboard: **70 pages**, EN × 5 widths + FR × 1280/375: 0 overflow, 0 gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys · French leaderboard, French "Mon profil" and the French privacy page at 375 checked by eye.

### Phase 96 — Integrations, one level deeper (2026-09-23)

**Built**
- **QuickBooks, line by line** (`quickbooks/lines.ts`, unit-tested): a sent invoice is one QBO line per invoice line, pre-tax, quantity and unit price kept when they multiply to the amount. With the invoice's tax set mapped (the Phase 88 mapping), every line carries that `TaxCodeRef` and QuickBooks computes the tax; the holdback is a negative line with the same code so the tax base is what QuoteAI taxed. Unmapped, the taxes follow as lines of their own (`HST 13%`, `GST 5%`, `QST 9.975%`) so the total matches to the cent — the old "tax-included one line" is gone. A cost (no items in QuoteAI) goes over as one pre-tax line with the code for the set its receipt implies (`costTaxSetKey`: breakdown says which taxes, the job's province — else the company's — says the rates; same key spelling as the invoice mapping so one row covers both), tax-included as before when unmapped. Purchase drift check added (QuickBooks' total vs ours → note on the log row). Nothing backfilled; the mapping help text says so in both languages.
- **Which calendar** (migration 0055 `calendar_name`, applied): `GET /api/calendar/:provider/calendars` lists the account's writable calendars (Google `calendarList` — the scope gained `calendar.calendarlist.readonly` — and Graph `/me/calendars`; the default one is "primary"); `PUT /api/calendar/:provider/calendar` picks one and **moves** what QuoteAI put in the old one: events deleted there, rows dropped, milestones and blocks from the last 30 days on pushed again (up to 200 each). Status returns `calendarId`/`calendarName`; the connected card in Settings → Integrations shows "Writes to: …" with Change → select → Use this calendar. A pre-96 Google connection gets 403 on the list → "Reconnect to choose", nothing else changes.
- **Thumbnails** (migration 0055 `thumb_url`; `jobs/thumbnails.ts`): `sharp` makes a ≤480 px JPEG (EXIF-rotated, mozjpeg q78) next to each original on upload, and lazily the first time `…/file?size=thumb` is asked for a photo without one — so old photos catch up as they are viewed. Under 40 KB, HEIC, or any failure → the original is served, as before. The office gallery (`loading="lazy"`), the portal grid, the crew card and the share email (thumbnails inline, linking to the signed originals) all use it. Delete removes both objects. `build.mjs` copies sharp, its runtime deps and the build host's `@img/*` platform package into `dist/node_modules` (Vercel = linux-x64); if sharp can't load, one warning and no thumbnails.
- Runbook §34; §25/§23 and the QA plan's v1 scope cuts updated; the showcase fixture now has a connected Google calendar (stubbed) so the sweep sees the picker.

**Found (and fixed)**
1. `ObjectStorageService.deleteObjectBuffer` swallowed Supabase errors; it now logs them. (Not a bug found in the wild — a download right after a remove can still answer from Supabase's cache, which is why the e2e checks deletion through the listing.)
2. The bundled `sharp` needs `@img/colour`, `detect-libc` and `semver` next to it — the first copy step only took the platform package; the build now walks sharp's runtime dependencies.

**Not done / deferred**
- Tax is per invoice in QuoteAI, so every line gets the set's code; per-line exemptions (a zero-rated item on a taxable invoice) are not modelled.
- Wave still sends one tax-included line (its comment says so); no Wave tax-code mapping exists.
- No PDF embeds job photos today (the plan said "gallery and PDFs"): there is nothing to switch; the share *email* got the thumbnails instead.
- HEIC has no thumbnail on the prebuilt libvips; the crew app already re-encodes on the phone, the office gallery does not.
- Existing Google connections must reconnect once to list calendars (new scope). The Google OAuth app's consent screen needs the scope added (owner, with F-3-style app work).

**Verification**: `pnpm typecheck` ✓ · `pnpm lint` **0 errors** (69 warnings, as before) · `pnpm knip` 99 exports / 35 types (was 100 / 34) · `i18n-audit` **4710 = 4710**, 0 missing, 0 split · route matrix **483** (+ `GET /api/calendar/:provider/calendars`, `PUT /api/calendar/:provider/calendar`, integrations:full) · schema drift **0 fatal** · unit **30 files / 205 tests** (+`quickbooks/lines.test.ts` 10) · e2e **phase96 5/5** · regression **phase88, integrations, security, schedule, phase85, offline-push, phase86, portal, voice-actions** (107/108 in one run: the one `offline-push` failure was a 401 on a time-entry approval, nothing of this phase in its path, and the file passes 6/6 alone) · `quote-ai build` ✓ (440 pages prerendered) · API bundle builds with sharp + `@img/sharp-win32-x64` copied and loading from `dist` · `qa:visual` on Settings → Integrations (closed and with the calendar picker open, Google stubbed with two writable calendars), the job page, its completion dialog and setup, and the foreman job page: **42 pages**, EN × 5 widths + FR × 1280/375: 0 overflow, 0 gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys.

### Phase 97 — Test coverage where there is none (2026-09-23)

**Built**
- **`phase97.e2e.test.ts`** (7 tests), the paths nothing covered end to end:
  - **Change orders over real HTTP**: draft (a body without items is a 400) → a second draft numbered CO-02 and deleted with its document → edit (totals and the "7 calendar days" clause follow) → sending before signing is a 409 → contractor signs → sent **from the contractor's Gmail** (headers and the `/sign/` link read out of the Gmail API `raw`) → edit and delete now 409, the job page says "sent", the value hasn't moved → the client: signing without a code is a 403, the code comes by email, a wrong one is a 400, then signs → CO signed and applied: `changeOrdersCents` and `budget` + 1 695.00, the end date and the open milestone 7 days later, **the milestone's Google event PATCHed to the new dates** (same event id), one notification; a second run of the automation adds nothing → the final invoice is contract + change order − already billed → sent while QuickBooks answers 503: failed sync-log row, visible in `GET /api/quickbooks/sync-log` → QuickBooks back → `POST /api/quickbooks/sync-log/retry` posts the invoice once, `DocNumber` ours and lines + tax lines adding up to our total to the cent. Plus the refusals: plan gate, no signed contract (409 `NO_CONTRACT`), another company's job (404).
  - **Job photos**: two phone-sized JPEG uploads, the offline outbox re-posting one (same `clientRef` → 200 `replayed`, no second row), a PDF refused, an unknown milestone 404 → caption/sort edit → original byte for byte, thumbnail ≤ 480 px → share refused for nothing selected (400), another company's photo (404), a job with no client (409), another company (404) → share by email: one message, an inline thumbnail per photo linking to its original, `sharedAt` set, audited → WhatsApp connected: the approved template to the client's phone, no email → Meta refuses the template: falls back to email → client unsubscribed: 409, nothing sent → delete: gone from the list and from storage.
  - **The job assistant chat** with a scripted model: the job's conversation (same one twice; Pro plan 403; another company 404) → a turn where `get_job_summary` runs and its result goes back to the model, which answers with two cards (task + milestone rename) → nothing written until confirmed → confirm the task (row with its due date), confirm again 409, dismiss the rename (milestone untouched), confirm/dismiss again 409, another company 404 → "the client paid the deposit": the payment card on a draft invoice is refused **back to the model** as a tool error, the model offers a send card instead; the earlier exchange is in the model's context → confirm: invoice sent, email with the note → payment card → confirmed → invoice paid → reload shows 3 turns and 4 cards → a model failure is a 502 and saves no card → empty message 400 → start over clears messages and cards; another company can't.
- **Fix found by the tests**: a signed change order with a schedule delta moved the milestones in the database but **not on the connected calendar**. `applySignedChangeOrder` now pushes each milestone it moved (the same event is PATCHed; one never pushed before is created), logged and left `failed` on a calendar error without undoing the change order.
- **Every route parses its body with a schema.** The route matrix's "manual" column went from 44 to **9 — the signed inbound webhooks, which must read the raw bytes**. 34 routes converted: the generated `@workspace/api-zod` contracts where they existed (catalog create/bulk/update, quote variants, send-PDF, manual quote in-app and public API via one `ManualQuoteBodySchema`, suggest-description, unlock-quote, change-plan, WhatsApp connect/verify/toggle), local `z.object`s elsewhere (admin ×6, `POST /api/quotes` multipart fields, the quote PUT's province/schedule extras, contract void, signing decline, receipt `projectId`, photo upload fields, Google LSA / Meta toggles, notifications read, push test, the widget's `POST /api/public/quotes`, quote accept, support ×3). Old error strings kept; the deliberate leniencies kept (bad company snapshot ignored, seats clamped, interval defaults to monthly, reasons trimmed). Runbook §35.
- **The matrix got stricter** so the column stays honest: `@workspace/api-zod` imports count as zod, and a route that parses a schema but also reads `req.body.x` by hand counts as manual (that caught 6 more: checkout's `extraSeats`/`returnTo`, the assistant's language fallback, `POST /api/quotes`, the quote PUT). **Rule 8** in `route-matrix.test.ts`: `manual` is only allowed on a route with webhook-signature evidence.
- **`lib/api-zod` builds**: nothing to do — `tsc --build --force` and `api-spec codegen` are clean with no diff (the Phase 70 `postgen.mjs` fix had already closed it; the plan line was stale).

**Found (and fixed)**
1. Change-order schedule shifts never reached the calendar (above).
2. `POST /api/notifications/read` with a non-UUID id was a Postgres cast error → 500; now 400.
3. `POST /api/catalog/bulk` with one bad row answered **500** with the thrown message; now 400.
4. `POST /api/admin/users/:userId/apikey` without a JSON body destructured `undefined` → 500; now it generates a key as intended.
5. `POST /api/support/admin-status` stored `"true"` for any truthy value (a string `"false"` included); now it takes a boolean.

**Not done / deferred**
- Nine webhooks stay "manual" by design (Stripe ×2, Financeit, Resend, WhatsApp ×2, Meta ×2, Twilio): they verify the signature over the raw body first, then read provider-shaped JSON.
- The generated api-zod schemas have no length limits; the routes add them locally where it matters. Adding `maxLength` to `openapi.yaml` would put them in the contract for the client too.
- WhatsApp's OTP compare (`otpRow.otp !== otp`) is a plain comparison; it is rate limited and expires in 15 minutes, so left as is.

**Verification**: `pnpm typecheck` ✓ (root, including `tsc --build` over `lib/api-zod`) · `api-spec codegen` ✓ with no diff · `pnpm lint` **0 errors** (69 warnings, as before) · `pnpm knip` unchanged (99 exports / 35 types) · route matrix **483** routes, manual **9** (all signed webhooks), `route-matrix.test.ts` **12/12** with the new rule 8 · unit **206 tests** · e2e **phase97 7/7** · **full e2e suite 34 files / 261 tests, all green in one run** (every route converted here is exercised by at least one of them). No UI changed, so no `qa:visual` run.

### Phase 98 — Owner handoff kit (2026-09-23)

**Built**
- **`pnpm ops:owner-check`** (`artifacts/api-server/scripts/owner-check.ts`): every Phase 99 item with its number, DONE / PARTIAL / TODO / MANUAL / ?, the detail and the next step; exit 1 while an L-item is open. Answers from the deployment, GitHub (`gh`), Vercel (optional token) and the checkout — the manual items are listed too, so the report is the whole list.
- **`GET /api/healthz/owner`** (`lib/ownerReadiness.ts`), behind `CRON_SECRET`: presence of each launch variable by item (never a value), and each Stripe add-on/annual price id and the pilot code checked with the deployment's own Stripe key (mode matches the key, active, CAD, monthly vs yearly; code exists and is active). `cronAuthorized` moved to `lib/cronAuth.ts` to share it.
- **`ops:rehearse --target <url>`**: backup → `ops:restore --wipe` → schema drift → a row in the new `docs/RESTORE-REHEARSALS.md`, which owner-check reads for L-2. The URL goes through the environment, never a command line.
- **`ops:legal-packet`** → `docs/legal-packet/QuoteAI-legal-packet.pdf` (and `.html`), 1 file for the lawyer: cover (versions, what's undecided), questions A–F, the recipients of personal information read from the live policy, the signing evidence and consent sentences, all six contract templates rendered by the product's own renderer with sample values (direct agreement, statutory holdback on in ON/BC/AB), and the terms and privacy policy EN + FR as served.
- **`LAUNCH-GO-NO-GO.md` §1–§4 refreshed** to what the systems answer today, each line tagged with its Phase 99 item; new 1.11 (Stripe prices + pilot code); §2 points at the PDF; two stale §4 lines struck (export/deletion shipped in 72; the stray `incentives.ts` edit is gone). Runbook §36; Phase 99's L-2/L-3 point at the new commands.

**Found (and fixed)**
1. **CI on `main` had been red since Phase 94**: `money-format.test.ts` expected `1,5 k$`, Linux ICU prints `1,5 k $`. The test now accepts either; the decimal is what it pins.
2. **The privacy policy's recipient list was missing three**: Twilio (SMS to clients and crew, Phase 74), Sentry (error reports, Phase 69) and the browsers' push services (Phase 77). Added in English and French, "last updated" moved to 23 September.
3. **The GitHub repository has no Actions secrets at all**, and the nightly Backup has been "succeeding" in 10 seconds by skipping. Owner-check now asks for the artifact, not the green tick.

**Found, not fixed (owner)**
- Production today (`ops:preflight`): all deployment checks pass; the one FAIL is `LEGAL_ENTITY` blank; annual billing and the pilot code are off. owner-check without `CRON_SECRET`: 8 to do, 9 manual, 9 not checkable — the Sensitive values can't be read from a checkout, by design.
- The Vercel MCP connection here is not authorized for the `youssefbouchtaoui-4103s-projects` scope, so the Sensitive check (P-4) was not run; owner-check does it with a token.

**Verification**: `pnpm typecheck` ✓ · eslint on the new/changed files 0 errors · unit **31 files / 211 tests** (+`ownerReadiness.test.ts` 5; the money test green) · e2e **phase98 2/2** (401 without / with a wrong secret; presence only, no value in the body) · route matrix **484** (+`GET /api/healthz/owner`, allowlisted as cron-secret-checked) · `env:inventory` exit 0 (`VERCEL_TOKEN/PROJECT_ID/TEAM_ID` classified local) · `ops:owner-check` run against production · `ops:rehearse` run end to end against a closed port (fresh 101-table backup taken, restore refused cleanly, fail row written — then removed along with the backup) · `ops:legal-packet` generated from production, sections checked by screenshot. No UI beyond the privacy text changed, so no `qa:visual` run.
