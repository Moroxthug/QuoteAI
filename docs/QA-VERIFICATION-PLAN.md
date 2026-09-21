# QuoteAI — Full verification plan (Phases 61-70)

Written 2026-09-18, right after Phase 60 closed the pixel redesign. Every *build* plan is now complete:

| Plan | Phases | Status |
|---|---|---|
| `JOB-LIFECYCLE-PLAN.md` | 0-6 | 0-5 built. **6 (launch readiness) half-done** — see §1 |
| `GROWTH-PLATFORM-PLAN.md` | 7-14 | all built |
| `EDGE-FEATURES-PLAN.md` | 15-29 | all built (several gated on external partner access) |
| `PIXEL-REDESIGN-PLAN.md` | 38-60 | all built |

So "what's left" is not features — it is proving that ~60 phases shipped back-to-back (typecheck + code review + mock/fake-data browser checks, almost never against a live backend) actually work together. This document is that plan. Same convention as before: **one phase per conversation**, each ends with a written result in this file's §3 build log, auto-pushed.

---

## 1. What is genuinely still open (carried from every plan's "not done" notes)

**Code / verification never done**
- ~~Phase 6's `lifecycle.e2e.test.ts` — built, never run~~ → run and green in Phase 63 (+13 more scenarios); CI wiring waits on a real staging project.
- ~~Phase 4 (contract → deposit invoice → send → pay)~~ verified in Phase 63; ~~`/api/cron/tick` end-to-end~~ Phase 65. Phase 5 (assistant tool-calling, `/dashboard/analytics`) — never live-tested.
- Mobile responsiveness — code review + emulated viewport only, no real device.
- Only 7 unit test files exist (`analytics/math`, `invoices/math`, `incentives/matching`, `crypto`, `requirePermission`, `connectedEmailSend`, `gmailSendClient`). Everything from Phase 7 on (team invites, lead sequencing, archive filtering, imports review queue, variants, clock-in, all OAuth syncs) has zero coverage.
- Root `pnpm run typecheck` still fails on `lib/api-zod` (zod v3/v4 mismatch), so CI (`.github/workflows/test.yml`) only typechecks the two apps.
- No ESLint config at all (`npx eslint` errors out) — unused imports/dead code are only caught by hand.
- Phase 29's `local_services_lead_conversation` contact-detail lookup left as a follow-up.
- Phase 47 note: dashboard Clients is a virtual list from `quotes.client_data`; `clientsTable.archivedAt` exists but nothing sets it.
- ~~`artifacts/quote-ai/public/sitemap.xml` has an uncommitted 9-line local change sitting in the working tree~~ → the build date was the `lastmod`; fixed dates since Phase 68 (`incentives.ts` was clean).

**Configuration / external (user-owned, not code)**
- Vercel env vars for QuickBooks / Google Calendar / Outlook / `INVOICE_LINK_SECRET` — QuickBooks + Google were registered 2026-09-14; **Outlook (Entra ID) still not**, nor Gmail send (`GMAIL_SEND_*`), WhatsApp (`WHATSAPP_*`), Meta (`META_*`). Since Phase 65 every unregistered integration shows "not available yet" instead of a broken Connect button.
- Three WhatsApp templates never submitted to Meta (lead follow-up, review request, photo share) → fall back to email (Phase 65 proved the fallback is clean: automation succeeds with `channel: email`).
- **DNS: `quoteai.ca` has no DMARC record and no apex SPF** (Phase 65, `pnpm --filter @workspace/api-server email-dns-check`) — two TXT records for the domain owner.
- Partner-gated integrations with no real credentials: Wave (25), Financeit (16), Flinks (27), Google LSA (29). Meta Lead Ads (28) works once `META_APP_ID` is set.
- No monitoring/alerting on `automation_runs` failures; no error tracker (no Sentry or equivalent anywhere in `src/`).
- Legal review of contract templates; help-centre content; a real pentest (Phase 64 closed 2026-09-20 — the pentest can now be procured).

**Deliberate v1 scope cuts (not bugs, just record them in the launch notes)**
- Hardcoded lead-follow-up cadence and review-request delay (no editor UI); no SMS channel.
- QuickBooks/Wave: one line per invoice/cost, exact-name customer matching only.
- Calendar sync: primary calendar only, milestones only.
- No thumbnail generation for job photos.
- `pages/admin.tsx` stays on shadcn.

---

## 2. Verification phases

Each phase lists **what**, **how** (concrete commands / steps), **exit criteria**, and **who** (Claude / user / human-only). Order matters: 61-63 make the later phases cheap; 66-67 need the staging environment 63 creates.

### Phase 61 — Static integrity: make the toolchain trustworthy
*Everything later leans on "typecheck clean" meaning something.*
- Fix the `lib/api-zod` zod v3-vs-v4 mismatch (pin orval output or upgrade zod) so **root** `pnpm run typecheck` passes, then add it to `test.yml`.
- Add a flat `eslint.config.js` (typescript-eslint + react-hooks + `no-unused-vars`) and fix what it finds — Phase 60 already spotted `Users` unused in `leads/index.tsx` and `data` in `settings.tsx` via `--noUnusedLocals`; expect dozens more.
- `pnpm -r build` clean; inspect the Vite bundle report for accidental heavy imports (the dashboard chunks are lazy-loaded — confirm nothing pulls `admin.tsx` or the blog data into the main chunk).
- Dead-code sweep: `knip` or `ts-prune` over both apps (Phase 49 did this by hand for `components/ui/`; nothing has done it for `lib/` or `api-server/src/`).
- Resolve the two stray working-tree edits (`sitemap.xml`, `incentives.ts`): commit or discard, explicitly.
- Exit: CI runs lint + root typecheck + tests + build on every push, green.
- Who: Claude.

### Phase 62 — Backend route matrix audit
*47 route files, ~250 handlers, written across 55 phases by different sessions.*
- Generate a table (script under `artifacts/api-server/scripts/`) of every registered route → middleware chain (`requireAuth`? `requirePermission(which)`? `requirePlan`/feature flag? rate limit? zod body/query schema?). Post-Phase-13 cleanup claimed every route in `jobs`/`costs`/`invoicing` is gated — verify mechanically, not by memory.
- Rules to assert: every non-public route has `requireAuth`; every mutating route has a permission; every Elite/Pro feature route checks the flag; every `:id` handler scopes by `organizationId` (grep for `eq(table.id, id)` **without** an org predicate); every list endpoint filters `archivedAt IS NULL` (Phase 47) — clients is the known exception; every public token route (`/p/:id`, `/i/:token`, `/sign/:token`, `/api/public-*`) is rate limited (`lib/rateLimit.ts`) and constant-time compares tokens.
- Write the result as a vitest that fails when a new route breaks a rule (turn the audit into a regression guard).
- Exit: matrix committed, zero unexplained rows, test in CI.
- Who: Claude.

### Phase 63 — Staging environment + the e2e suite, finally run
- User creates a **disposable Supabase project** (never the linked `quoteai`), pastes `DATABASE_URL`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` into `.env.staging`.
- Apply migrations `0001` → `0032` in order with `supabase db query`; diff `lib/db/src/schema/*` against the resulting DB (`drizzle-kit check`/introspect) — this is the first time schema-vs-migrations drift can be measured. Phase 17 already found one migration (`0015`) that had never actually run in production; assume there are others.
- Run `lifecycle.e2e.test.ts` (ON/EN holdback + QC/FR no-holdback). Fix what breaks.
- Extend the suite with one scenario per growth/edge feature that has a service layer: team invite + role denial, lead capture → 1/3/7-day sequencing (`cron/tick` with a frozen clock), review request one-shot gate, archive → list exclusion → restore, import review queue → accept, quote variants, worker clock-in geofence flag, e-Transfer self-report → confirm.
- Exit: `pnpm test` runs unit + e2e against staging in CI (secrets in GitHub), green.
- Who: user (project + keys), Claude (everything else).

### Phase 64 — Security pass
- IDOR sweep with two real accounts on staging: every `:id` route, every storage path, every public token, every export/PDF URL. Phase 6 found one real IDOR by reading code; this is the runtime version.
- Webhook signature verification on **every** inbound hook (Stripe, Stripe Connect, Meta Lead Ads, WhatsApp, QuickBooks/Wave/Flinks callbacks) — replay a request with a bad signature, expect 4xx.
- Auth: better-auth session lifetime, 2FA enforcement paths (Phase 13), password reset, email change, invite-link expiry/single-use, team-member removal revokes sessions.
- Rate limits actually bite (public quote follow-up, sign, invoice pay, lead widget, speech).
- `pnpm audit` (already a workflow: `dependency-audit.yml` — check it is green), secrets scan of the repo history, CORS origin list, security headers on the Vercel edge (`helmet`-equivalent), CSP for the public pages.
- Token encryption (`TOKEN_ENCRYPTION_KEY`) covers every stored OAuth token (QuickBooks, Google, Microsoft, Gmail, Wave, Meta, Flinks).
- Exit: findings list with severities, all High/Critical fixed and re-tested; the rest triaged.
- Who: Claude; the **external pentest** at the end is user-procured.

### Phase 65 — Integrations live smoke (sandbox/test modes)
For each: connect from Settings → Integrations, trigger the real event, confirm the side effect, disconnect.
- Stripe (subscriptions + one-shot unlocks, test mode), Stripe Connect card payments on the public invoice page, e-Transfer self-report flow.
- QuickBooks sandbox: invoice.paid → sales receipt; cost.confirmed → expense.
- Google Calendar: milestone → all-day event, milestone date change → event update.
- Gmail connected send: a contract email actually arrives from the contractor's address; fallback to platform sender when disconnected.
- WhatsApp Cloud API: confirm the **template-less** paths work and the three unapproved templates degrade to email without erroring (or get the templates submitted — user task, do it in parallel).
- Meta Lead Ads: use Meta's Lead Ads Testing Tool to push a test lead → appears in `/dashboard/leads`.
- Wave / Financeit / Flinks / Google LSA: no credentials → verify the UI states are honest ("not connected / coming soon"), nothing throws, cron paths skip cleanly.
- `/api/cron/tick`: run it manually on staging with seeded due items (reminders, follow-ups, scheduled invoices, LSA poll) — check `automation_runs` rows and idempotency (run twice, nothing doubles).
- Email deliverability: SPF/DKIM/DMARC for the sending domain, and every transactional template renders in EN + FR.
- Exit: per-integration checklist with pass/fail; Outlook calendar explicitly marked "not registered".
- Who: user drives the portals (needs their accounts), Claude verifies logs/DB and fixes.

### Phase 66 — Functional walkthrough of every screen (real account, staging)
- One scripted journey, EN then FR: sign up → 2FA → onboarding (province, licence, e-transfer, schedule) → import price list (CSV + PDF OCR) → new quote (AI, manual, catalog, tiers) → send → customer accepts on `/p/:id` → contract → both sign → job setup review → assign crew → worker clock-in → costs + receipt review → change order → milestone invoice → customer pays → review request → archive → restore → CSV export → delete account.
- Then every one of the 56 routes in `App.tsx` and **every dialog from Phase 60** individually: empty state, loading state, error state (kill the API mid-action), validation messages, toasts, keyboard (Tab order, Esc closes, Enter submits), focus return after a modal closes.
- i18n: run a script that finds `t("…")` keys missing from `fr:` or `en:` (5,948 keys — there will be gaps) and any hardcoded English in JSX.
- Exit: a bug list, everything P1 fixed, P2s ticketed in `deferred-work`.
- Who: Claude (Browser pane on staging — the first time dashboard pages can be checked live instead of via the fake-data preview-route trick); user for a second pair of eyes on the journey.

### Phase 67 — Visual & accessibility QA
- Every page vs `docs/mockups/*.html` at 1280 / 980 / 768 / 640 / 375 — the redesign was verified page-by-page as it was built, never all at once after the later CSS sections landed (Phase 59's `.card + .card` leak was exactly this kind of cross-page regression).
- Grep survey for leftovers: shadcn `Button|Input|Label|Card|Badge` imports, `slate-`/`navy-500`/`rounded-2xl`/`text-muted-foreground`, emoji, `glow`/`parallax` (per the professional-design rule). Known allowed: `admin.tsx`, react-hook-form `Form`+`Input` stacks in settings/profile, 5 `Select`s in settings, 3 `Button`s in documents/profile — decide whether to leave them or run a small Phase 61b.
- Print/PDF: quote, contract, invoice, receipt PDFs in EN/FR, ON/QC, with and without logo, long line-item lists (page breaks).
- Real devices: iPhone Safari + Android Chrome for the public pages (`/p/:id`, `/i/:token`, sign, worker clock-in), the bottom-sheet modals, and the sidebar drawer.
- Accessibility: axe on every route, contrast on chips/notices, modal focus trap, form labels, `prefers-reduced-motion` for the modal/sheet animations.
- Exit: zero P1 visual bugs, axe serious/critical = 0.
- Who: Claude, plus user on real phones.

### Phase 68 — Performance, SEO & content integrity
- Lighthouse (mobile) on `/`, `/fr`, `/whatsapp`, a blog article, a city/profession landing page, the public quote page: targets Perf ≥ 90, SEO 100, no CLS from the SPA-shell fix.
- `scripts/prerender-seo.ts` output: every prerendered page has correct `<title>`/canonical/hreflang/OG; sitemap matches `PATHS` (this is where the uncommitted `sitemap.xml` diff gets resolved); `robots.txt`; OG images generated for every article/sector.
- API: p95 of the dashboard home, quotes list, job detail, analytics with a seeded 500-quote / 50-job org; look for N+1 in `clients.ts` (virtual aggregation over quotes), analytics, archive.
- Bundle: dashboard first-load JS budget; confirm `admin.tsx` and blog content never ship to the dashboard.
- Copy: spell/grammar pass over EN and FR public copy and every email template; legal pages reflect the real entity/province.
- Exit: numbers recorded here; anything under target fixed.
- Who: Claude.

### Phase 69 — Operations & launch readiness
- Error tracking (Sentry or Vercel's own) wired into both apps with source maps; alert on `automation_runs.status = 'failed'` and on cron tick not running for > 1 h.
- Vercel env inventory: script that lists every `process.env.X` in `api-server/src` and diffs against `vercel env ls` — every missing var either set or documented as intentionally absent (Outlook, Wave, Financeit, Flinks, LSA).
- Backups: confirm Supabase PITR/backup schedule; write and **rehearse** a restore into staging.
- Runbooks in `docs/RUNBOOKS.md`: cron failure, Stripe webhook backlog, OAuth token revoked, migration rollback, how to rotate `TOKEN_ENCRYPTION_KEY`.
- Update `deferred-work-post-launch` with what 61-68 left, strike what they closed.
- Exit: on-call could recover the service from the docs alone.
- Who: Claude; backup policy decisions are the user's.

### Phase 70 — Human-only gate (not code)
- Legal review of the province contract templates and the ToS/privacy pages.
- Help-centre articles for the top 10 flows (Phase 6 content task).
- WhatsApp template approval, Outlook/Entra app registration, partner credential applications (Wave, Financeit, Flinks, LSA) if those features are meant to be live at launch.
- External pentest after 64 is closed.
- Go/no-go review of this document.
- Who: user.

---

## 3. Build log

*(append one entry per phase as it completes: date, commit, what was found, what was fixed, what was deferred)*

### Phase 61 — Static integrity (2026-09-18)

**Found / fixed**
- Root `pnpm run typecheck` already passed: the `lib/api-zod` zod v3/v4 mismatch had been resolved by an earlier orval regen (Phase 25) and the CI comment was stale. It is now CI's first step.
- ESLint did not exist. Added flat `eslint.config.mjs` (`@eslint/js` + `typescript-eslint` + `react-hooks`, `no-unused-vars` as error with `_` escape, `no-explicit-any` as warning). First run: **82 errors / 73 warnings**. All 82 errors fixed: 69 unused imports/vars (incl. a 45-line dead `sendWhatsappImage` in `routes/whatsapp.ts`, dead `EXTRACTION_MIME_TYPES`, dead `MESSAGE_ID_WINDOW_MS`), 3 `no-useless-assignment`, 2 `prefer-const`, a literal BOM in a template string (`team.ts` payroll CSV → `\uFEFF`), 3 `preserve-caught-error`, 2 worklet globals. 68 warnings remain (60 `any`, 13 → 8 `react-hooks/exhaustive-deps`, all "load on mount" patterns — left deliberately). Scripts: `pnpm lint` (CI, warnings allowed) / `pnpm lint:strict`.
- **Bundle: the marketing homepage was modulepreloading the entire 1.5 MB dashboard chunk + the 237 KB seo chunk.** Cause: `manualChunks` grouped `/pages/dashboard/` into one chunk, Rollup pulled every shared module those pages touch (`ui/*`, `use-toast`, the auth client…) into it, so the public entry statically imported it — `lazy()` on the routes was defeated. Fixed by removing the page-level manual chunks (vendor splits kept) and making `DashboardLayout` lazy in `App.tsx`. Homepage first-load JS **2.64 MB → 1.48 MB**; recharts (386 KB) is now genuinely lazy; each dashboard route is its own chunk. Verified in the Browser pane against a mock API (dashboard home + analytics render through the lazy layout, no console errors from the change).
- Dead code (`knip`, config in `knip.json`, `pnpm knip` in CI): deleted 18 files — `generateQuotePreviewImage.ts` (puppeteer), the unmounted homepage demo player (`components/demo/*`, `lib/video/*`, framer-motion), `ui/badge|card|switch`, `use-mobile`, the EUR-era Stripe seed scripts, two broken one-off migration runners. Removed 35 unused dependencies (puppeteer — no more Chromium download on install/CI; 15 radix packages; cookie-parser, http-proxy-middleware, @swc/helpers, @opentelemetry/semantic-conventions, html2pdf.js, sonner, vaul, next-themes, embla, input-otp, react-day-picker, react-icons, react-resizable-panels, framer-motion, stripe in scripts).
- `pnpm test` in CI had been **red the whole time**: `incentives/matching.test.ts` is a plain `node:assert` script vitest reported as "no test suite". Converted it and the two excluded assert scripts (`analytics/math`, `invoices/math`) into vitest suites — 7 files / 22 tests now run in CI.
- Working tree: `sitemap.xml` committed (it is regenerated with today's `lastmod` by `prebuild`, so it will keep drifting — root cause is Phase 68's); `incentives.ts` had no stray edit.
- `test.yml` now runs: root typecheck → lint → knip → unit tests → `pnpm -r build`.

**Deferred (to 68 unless noted)**
- Main chunk still carries `translations.ts` (383 KB, both languages), `posthog-js` (284 KB — could be dynamically imported), `seo-data.ts` (129 KB, home only needs slug→label) and `blog-data.ts` (61 KB, home only needs 3 article summaries). Splitting these is the Phase 68 bundle-budget work.
- knip reports 105 unused exports / 33 unused exported types (warn-level, does not fail CI). Mostly API surface of service modules; prune opportunistically.
- 60 `no-explicit-any` warnings, concentrated in `admin.tsx` and the API/DB edges.
- `sitemap.xml` lastmod churn.

### Phase 62 — Backend route matrix audit (2026-09-18)

**Built**
- `artifacts/api-server/scripts/route-matrix.ts` — a TypeScript-AST parser (no module execution, no DB) over `src/app.ts` + `src/routes/**`. For each of the **342 registered routes in 50 files** it records: mount path, middleware chain (including `router.use("/admin", requireAdmin)` prefix middleware), auth kind, `requirePermission(area, action)`, rate limiter, zod/manual validation, plan/feature gate, tenant scoping of `:param` handlers (`predicate` / `post-check` / `helper` / `NONE` — the handler's reach includes every same-file helper it calls, transitively), archived filtering on list endpoints, token-comparison style on public token routes, and signature-verification evidence on inbound webhooks. `pnpm --filter @workspace/api-server route-matrix` writes `docs/ROUTE-MATRIX.md`.
- `scripts/route-matrix.test.ts` — 11 vitest assertions (in CI via `pnpm test`): every un-authed route is on a reasoned public allowlist (and the allowlist stays honest); every mutating session route names a permission; every public-API route is permissioned + rate limited; 29 feature entry points check their flag; every `:param` handler scopes by org; list endpoints exclude archived rows; every public token route is rate limited and never `===`-compares a secret; every inbound webhook verifies its signature; the committed matrix is up to date. Verified the guard bites: dropping one `requirePermission` fails rule 2 + the freshness check.

**Found / fixed**
- **76 mutating session routes had no `requirePermission`** — the Phase 13 claim only held for `jobs`/`costs`/`invoicing`. A `viewer` or `foreman` team member could create/delete quotes, edit the business profile, connect/disconnect WhatsApp, manage workers/equipment, void contracts, unlock quotes via Stripe, etc. Added permissions to 72 routes: quotes/catalog/documents/speech → `quotes:edit` (delete/archive/restore → `quotes:full`); contracts → `contracts:edit` (void/archive/restore → `full`); crm + assistant → `jobs:view|edit`; business-profile → `settings:edit`; payments unlock/sync → `settings:full`; WhatsApp → `integrations:full`; workers/equipment → `team:full`; time entries/assignments/equipment usage → `jobs:edit` (approve → `jobs:full`). The 4 remaining are allowlisted with reasons (notifications read, signed-upload URL, invite accept, org switch). `requirePermission` is now generic over `Request<P>` like `requireAuth` (crm.ts stopped typechecking otherwise).
- **Public API v1 lists (`/api/v1/public/quotes|jobs|invoices`) returned archived rows** — Phase 47 predates them. Now `isNull(archivedAt)`. Clients lists stay unfiltered by design (parity with the virtual `/api/clients`).
- Three feature entry points missed the plan gate while their siblings had it: `POST /team/workers` (team_time), `POST /invoices/:id/credit-note` (invoicing), `POST /flinks/sync` (flinks_bank_feed). Gated.
- Four un-authed token routes had no rate limiter: the three CASL unsubscribe links and `GET /team/invite/:token`. Now 30/min per IP.
- `POST /sign/:token/verify` compared the OTP hash with `===`; now `timingSafeEqual`. (Every other public token route is a hashed DB lookup or already timing-safe.)
- Tenant scoping: 114 `:param` handlers under session/API-key auth. 90 predicate, 24 post-fetch check, 20 via an imported service — all 20 services read by hand, every one filters `userId` or throws on mismatch. Only `POST /team/invite/:token/accept` has no org predicate (it *joins* an org; allowlisted). **No IDOR found.**
- Webhooks: all 6 inbound endpoints verify (Stripe `constructEvent` ×2, Financeit/Resend HMAC `timingSafeEqual`, Meta/WhatsApp `x-hub-signature-256` in `app.ts` before `express.json()`).

**Policy decided here**
- Feature gating is enforced at the *entry* route (create / connect / send); read/update/delete of existing rows stays open after a downgrade so nobody is locked out of their data. `FEATURE_ENTRY_ROUTES` in the test is the list.
- `catalog`, `quote_email`, `acceptance_notifications` are in `PLAN_FEATURES` but enforced nowhere (UI or API) — always have been. Product decision, added to deferred work.

**Deferred**
- The frontend is not role-aware: nothing in `quote-ai/src` reads the actor's role, so a viewer still sees every button and now gets a 403 toast instead of succeeding. Role-aware UI (hide/disable per `roleCan`) → Phase 66 bug list / deferred work. Note the matrix gives `admin` only `settings:view`, so admins can no longer edit the business profile via the API — confirm that is intended during 66.
- `validation` column shows 60-odd `manual` rows (hand-rolled `req.body` checks); converting to zod is opportunistic.

### Phase 63 — Staging environment + the e2e suite, finally run (2026-09-19/20)

**Environment decision** — there is no staging project yet. The free tier caps active projects at 2 (`quoteai` + an unused July project), and production held exactly one row of real data (the owner's profile). So the suite ran **against `quoteai`** this once, with a self-cleaning harness, instead of blocking on a new project. `.env.staging` (gitignored) was assembled by hand: `vercel env pull` returns every *Sensitive* var as an empty string, so `SUPABASE_URL`/service-role key came from `supabase projects api-keys`, `DATABASE_URL` from the dashboard password via the **session pooler** host (`aws-0-us-west-2.pooler.supabase.com:5432` — the direct `db.*` host is IPv6-only and unreachable from this network). CI keeps a separate `E2E_*` secret set that does not exist yet, so the CI job skips green until a real staging project is created (see Deferred).

**Built**
- `lib/db/scripts/schema-drift.ts` (`pnpm --filter @workspace/db schema-drift`) — introspects a live DB (or a `supabase db query` dump via `--from-dump <dir>`) and diffs it against `lib/db/src/schema`: tables, columns (type / nullability / default), enums, PKs, FKs, uniques, indexes. Exit 1 on anything missing or mismatched.
- `artifacts/api-server/vitest.e2e.config.ts` + `vitest.e2e.setup.ts` + `src/e2e/harness.ts` — `pnpm --filter @workspace/api-server test:e2e`. Boots the real Express app on an ephemeral port; mints users + bearer sessions straight into the auth tables (better-auth's `bearer()` plugin accepts a raw session token); the Resend SDK is mocked at the module boundary (`src/e2e/mailbox.ts` captures every send — nothing leaves); AI keys are blanked and the OpenAI client pointed at a closed local port so every AI call takes its deterministic fallback (`E2E_REAL_AI=1` to keep real keys). Teardown sweeps every table with a `user_id` column, `organization_members` by owner, the user rows, and the `contracts/<userId>/…` + `invoices/<userId>/…` storage prefixes; the first `createUser` of each process also purges `e2e_%` orphans from an earlier aborted run. Files run sequentially (shared DB + per-user rate limiters).
- Scenarios (5 files, 15 tests, 64 s): `lifecycle` (Phase 6, converted to vitest, unchanged logic); `team` (invite → email mismatch 403 → accept → link dead → viewer reads the org's quotes but gets 403 on variants/archive/invite → owner removes → access gone; Starter plan gate; Pro seat limit); `followups` (lead 1/3/7 sequence stage by stage, second tick a no-op, unsubscribe stops it; review request once-only with `automation_runs` count = 1, skipped for marketing-unsubscribed clients); `quotes` (archive → list exclusion → `/archive` → cross-tenant 403 → restore; variants cap 3, public accept refuses without a choice, chosen variant's `capitoli`/`totale` copied onto the quote; CSV import → 2 candidates → confirm blocked without client → reject → confirm → real quote + client → 409 on repeat); `public-tokens` (worker magic link → clock-in inside the geofence not flagged / 5 km away flagged / 409 while open → clock-out → revoke → 404; time tracking plan gate; e-Transfer `mark-sent` → `pending_confirmation` → repeat 400 → in-app notification → cross-tenant 404 → confirm → paid + `payment_recorded` + receipt; reject reopens the invoice).
- `.github/workflows/test.yml` `e2e` job: runs `schema-drift` + `test:e2e` when `E2E_DATABASE_URL`/`E2E_SUPABASE_URL`/`E2E_SUPABASE_SERVICE_ROLE_KEY` secrets exist, otherwise every step skips.
- `src/lib/pdfmake.ts` — the one place fonts are registered (finding 2). `src/lib/pngDataUrl.ts` + unit test (finding 3).

**Found / fixed**
1. **Migration `0031` (Google LSA) had never run in production** — `google_lsa_connections`, `google_lsa_import_log` and the three `leads.google_lsa_*` columns were missing (the Phase 17 `0015` pattern again). Applied; drift is now 77/77 tables, 0 missing, 0 type/nullability mismatches. 19 indexes exist in SQL but not in the drizzle schema — harmless, listed as informational.
2. **Every contract signing crashed after any invoice PDF in the same function instance.** `pdfmake`'s default export is a singleton; `contracts/pdf.ts`, `invoices/pdf.ts`, `routes/quotes.ts` and `lib/generateQuoteWhatsappPdfBuffer.ts` each assigned their own `lib.fonts = {…}` and cached it locally. Invoices registered only `Roboto`, so once one had rendered, the next `finalizeContract` died with `Font 'Serif' in style 'bold' is not defined` — after both signers were already marked signed. Fluid Compute reuses instances, so this was live. The QC/FR lifecycle scenario caught it (its contract renders after ON's invoice). All four now import `getPdfmake()` from `src/lib/pdfmake.ts`, which registers the union once.
3. **A corrupt drawn signature 500'd the customer's signing request after the row was written.** Both sign routes only checked the `data:image/png;base64,` prefix; pdfkit then threw "Incomplete or corrupt PNG file" inside `finalizeContract`. `isWellFormedPngDataUrl` (magic + IHDR + IEND) now rejects it with 400 up front in `routes/sign.ts` and `routes/contracts.ts`, and `contracts/pdf.ts` falls back to the typed-name rendering instead of failing the PDF.
4. Test-side: an invite link is `404` after acceptance (the hash is wiped), not `409` — the code is right, the assertion was corrected.

**Verified working, first time live** (was "never run / never live-tested" in §1): the Phase 4 contract → deposit → progress → final → holdback-release invoice chain incl. `sendInvoice`/`recordPayment`; tax math ON 13 % ($11 300) and QC GST+QST ($11 497.50); `raiseAutomation` idempotency; the cron maintenance functions (`runLeadMaintenance`, `runJobReviewRequestMaintenance`) with due rows — `automation_runs` never doubled across repeated ticks; signed-PDF storage upload + hash.

**Deferred**
- **A real staging project.** Once one exists (delete the unused July project or upgrade), set the three `E2E_*` GitHub secrets and the CI `e2e` job runs on every push. Until then the suite is local-only against `quoteai` — acceptable while production holds one user, **not** after launch. → `deferred-work`.
- `/api/cron/tick` itself is not exercised end-to-end (it has no clock parameter; a future-clock tick would sweep other tenants). The maintenance functions it calls are. Phase 65 runs the real tick on staging.
- Not covered by e2e yet: change orders, job photos, QuickBooks/Calendar/Gmail side effects (need sandboxes → Phase 65), assistant tool-calling (Phase 5). ~~2FA/password-reset flows, public-API-key routes~~ → Phase 64's `security.e2e.test.ts`.
- `.env.staging` stays local; never commit it.

### Phase 64 — Security pass (2026-09-20)

**Method** — static review of `app.ts`, `lib/auth.ts`, every webhook, every OAuth callback, every token store and the storage routes; then a sixth e2e file, `src/e2e/security.e2e.test.ts` (21 tests, ~45 s, part of `test:e2e`), that asks the same questions of the running app. Plus `pnpm audit`, a regex sweep of the full git history for key shapes (`sk_live_`, `whsec_`, `re_`, `AKIA`, JWTs, `postgres://user:pass@`, private-key PEM blocks…), and the CSP exercised in the Browser pane against the built site served with the `vercel.json` headers (`/`, `/fr/`, `/sign-in/` — zero violations; gtag and the canonical/theme inline scripts ran).

**Findings** (severity → fix)

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **High** | `xlsx@0.18.5` parses user-uploaded spreadsheets (`imports/parseSpreadsheet.ts`, `documents.ts`, `extractDocument.ts`) and has two open advisories: prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9). npm stops at 0.18.5; the patched line only ships from SheetJS's own CDN. | Dependency is now the `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` tarball. `pnpm audit --prod`: 0 high (1 low left: esbuild dev-server, dev-only). `dependency-audit.yml` is now **blocking** at `--audit-level=high`. |
| 2 | **High** | **A password reset did not revoke existing sessions** (`revokeSessionsOnPasswordReset` is off by default in better-auth): an attacker holding a session kept it through the victim's reset. | Enabled. Test: the pre-reset bearer token resolves to `null` after the reset. |
| 3 | **Medium** | **The password-reset rate limiter never fired.** `AUTH_RATE_LIMITERS` keyed `/api/auth/forget-password`, but better-auth ≥ 1.3 (we run 1.7.3) and the frontend use `/request-password-reset`. Only better-auth's own in-memory production limiter (3/min per instance) stood between the reset mailer and a flood. | Keyed on the real paths; added budgets for `sign-up/email`, `send-verification-email`, `two-factor/send-otp` (email-bombing vectors, 10 / 15 min), `two-factor/enable|disable`, `change-password`. Test: 12 reset requests → 429 appears, zero extra emails. |
| 4 | **Medium** | **No security headers anywhere**: the static site had none (Vercel adds none), the API set none, no CSP. | `vercel.json` `headers`: CSP with a **hash-based** `script-src` for the three inline scripts in `index.html` (no `'unsafe-inline'` for scripts), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `frame-src` only Flinks Connect, `connect-src` self + PostHog + GA; HSTS 2 y preload; nosniff; `X-Frame-Options SAMEORIGIN`; `Referrer-Policy strict-origin-when-cross-origin`; `Permissions-Policy` delegating camera/microphone/geolocation to self (clock-in geofence, voice notes and photos need them); immutable cache on `/assets/*`. API (`app.ts`): nosniff, `X-Frame-Options DENY`, CSP `frame-ancestors 'none'`, `Referrer-Policy no-referrer` (token links must never leak through Referer), HSTS, COOP. Guard: `scripts/security-headers.test.ts` recomputes the inline-script hashes from `index.html` (and from every prerendered page when `dist/` exists) and fails CI when `vercel.json` is stale — regenerate with `pnpm --filter @workspace/api-server csp-hashes`. |
| 5 | **Medium** | CORS allowed **any-port `localhost` with credentials in production** — a page served by any local program on a user's machine could call the API with their cookies. | Gated on `NODE_ENV !== "production"`. |
| 6 | Low | `POST /flinks/transactions/:id/unmatch` and `/ignore` answered `200 {success:true}` for a foreign id (the `UPDATE … WHERE user_id` matched nothing — no data change, but a client would believe it worked). | Services return the affected count; routes 404. |
| 7 | Low | `PUT /catalog/:id` and `PUT /crm/projects/:id` **500'd on an empty body** (drizzle throws on `set({})`). Scoping was intact; robustness only. | 400 "Nothing to update". |
| 8 | Low | Cron bearer compared with `!==`. | `timingSafeEqual`. |
| 9 | Low | User-controlled `name` interpolated unescaped into the verification / reset / welcome emails (self-XSS in the user's own mailbox). | `escapeHtml` (test asserts `<b>` arrives as `&lt;b&gt;`). |

**Verified clean** (no change needed)
- **IDOR at runtime**: org B (its own Elite org, valid session, its own API key) hit all **134 `:param` routes** under session / API-key auth from the committed route matrix with org A's ids — one seeded row of every kind: quote, contract, job, milestone, deposit invoice, payment, cost, receipt document, catalog item, task, worker, equipment, assignment, equipment usage, time entry, change order, photo, variant, lead, conversation, proposal, API key, webhook, import batch + candidate, Flinks transaction, price alert, invited member, virtual client. **114 → 403/404, 9 → 400 (body validated before the lookup), 0 → 2xx, 0 → 5xx** (after #6/#7). Two legitimate 200-with-empty answers are allowlisted (`/clients/:id/quotes` — the id is an md5 of client fields; `/contracts/by-quote/:quoteId` → `{contract:null}`). A `qai_active_org` cookie pointed at A's org without a membership does nothing. Admin routes: 403 for owners and for anonymous callers.
- **Private storage**: `/api/storage/objects/contracts/<A>/…` → A 200, B 404, anonymous 401 (the owner check is on the path's second segment, not on guessability).
- **Webhooks** (all six): missing header → 400; bad signature → 400/403/401; Stripe replay 1 h old → 400 (tolerance); correct signature → 2xx. Stripe ×2 (`constructEvent`), WhatsApp + Meta Lead Ads (`x-hub-signature-256` HMAC over the raw body, before `express.json`), Resend (svix `id.ts.body`), Financeit (shared token, `timingSafeEqual`). Cron: wrong bearer → 401.
- **OAuth callbacks** (QuickBooks, Wave, Google Calendar, Outlook, Gmail, Meta, Google LSA): `state` is an HMAC-signed `userId.iat.nonce` bound to the *session's* user, 5-minute TTL, `timingSafeEqual`. Flinks has no OAuth (Connect iframe → LoginId).
- **Token encryption**: every stored third-party credential is AES-256-GCM via `lib/crypto.ts` — QuickBooks, Wave, Google Calendar/Outlook (`calendar`), Gmail (`email-connections`), Meta page token, Google LSA refresh token, Flinks LoginId. Public-API keys and invite / sign / invoice tokens are stored as SHA-256 hashes; outbound webhook secrets are stored plain by necessity (needed to sign each delivery, never re-displayed). WhatsApp uses the platform token from env, nothing per tenant.
- **Auth flows at runtime**: sign-up → sign-in is **403 until the emailed verification link is used** → 200 with a 7-day session (default `expiresIn`, refreshed daily); the reset token is **single-use**; **2FA**: after enable + one TOTP, a correct password alone returns `twoFactorRedirect` and the echoed token does not resolve to a session, a wrong TOTP is refused, the right one mints exactly one session; `revoke-sessions` empties the table; `change-email` is not enabled (the endpoint refuses). Invite links: 410 once expired (preview and accept), 404 for an unknown token, single-use (Phase 63).
- **Rate limits bite**: invite preview 30/min → 429 with `RateLimit-*` headers; sign OTP 8 / 15 min → 429; password reset → 429 (#3).
- **Secrets in history**: none. The only `BEGIN PRIVATE KEY` hits are `jose`'s own source inside a source map that was once committed under `dist/` (no longer tracked). No `.env*` was ever committed; only `.env.example` is tracked.
- `requireAdmin` is an email allowlist (`ADMIN_EMAIL`) checked against the live session — fine for one operator.

**Policy / notes**
- Rate limiters (ours and better-auth's) are **in-memory per function instance**. On Fluid Compute that still bites (instances are few and long-lived) but is not a hard global cap; a shared store (Upstash/Redis through `express-rate-limit`'s store API + better-auth `secondaryStorage`) is the upgrade if abuse ever shows in the logs. → deferred work.
- The CSP is enforced (not report-only) and has no report endpoint. The dashboard was **not** browser-checked under it (same bundle, same policy) — Phase 66's staging walkthrough should keep DevTools open for violations on its first pass.
- `revokeSessionsOnPasswordReset` means a user resetting their password on their phone is logged out on their laptop — intended.

**Deferred / for other phases**
- **Account deletion does not exist** (no `deleteUser`, no data export). Phase 66's scripted journey lists "delete account" as a step that cannot be performed; PIPEDA right-to-erasure → `deferred-work`.
- **`/widget.js` does not exist in the repo** — the embed snippet in Settings points at it, and Vercel's SPA rewrite would serve `index.html` as JavaScript on the contractor's site. Phase 66 bug list (functional, not security).
- Distributed rate-limit store (above).
- The external pentest (Phase 70, user-procured) — this phase was its prerequisite and is now closed.

### Phase 65 — Integrations live smoke (2026-09-20, Claude half; vendor half pending)

**Method** — split the phase in two. Everything on *our* side of each integration contract is now proven by a seventh e2e file, `src/e2e/integrations.e2e.test.ts` (21 tests, ~30 s, part of `test:e2e`; suite total 7 files / 57 tests / ~100 s): the real app against the real database, with every vendor host answered at the `fetch` boundary by `src/e2e/vendorStub.ts`. The suite now also *refuses* to let any request leave toward a vendor (fifteen hosts pre-stubbed with a 599 in `vitest.e2e.setup.ts`), so the WhatsApp/Gmail/Calendar/QuickBooks paths can run with credentials set without ever touching Meta/Google/Intuit. The *vendor's* half — real sandbox accounts, real OAuth consent screens, real deliverability — needs the user at the portals and is the checklist below.

**Built**
- `src/e2e/integrations.e2e.test.ts` — (1) `GET /api/cron/tick` end-to-end with one seed per maintainer (overdue invoice → overdue + 3-day reminder, draft past its review window → auto-sent, holdback release past the lien period → notification, contract sent 4 days ago → reminder with a re-issued token, quote and lead follow-ups due, job completed 4 days ago → review request); every counter in the response asserted; a second tick changes nothing (automation_runs / notifications / emails snapshot equal, reminder counts stay 1). Wrong bearer → 401. (2) Stripe, signed synthetic events: `checkout.session.completed` one-shot → quote `unlocked` + `unlockedWithPlan`; subscription mode → plan active + `stripeCustomerId` + welcome email; `customer.subscription.updated` by customer id → plan change, unknown price → skipped not downgraded; `.deleted` → cancelled. Connect: `checkout.session.completed` → invoice paid, one `invoice_payments` row (`method: card`, `reference` = session id), receipt email; **replay → still one row, no second receipt**; unknown invoice → 200 no-op. (3) WhatsApp: template rejected by Meta (error 132001, the "never submitted" case) → review request and lead follow-up both fall back to email, automation `succeeded` with `channel: email`, sequence advances; template accepted → `channel: whatsapp`, no email; FR client → `language.code = fr`; connect → OTP as a plain text message (no template needed), wrong OTP refused, right OTP links the number. (4) Gmail: with an `email_connections` row the invoice goes to `gmail.googleapis.com/…/messages/send` with the decrypted bearer, `From: <account>`, the PDF attached, nothing through Resend, `lastSendAt` set; Google 401 → Resend fallback from `… via QuoteAI <no-reply@quoteai.ca>` and `lastSendError` recorded; disabled connection → Resend, Gmail never called. (5) Google Calendar: milestone with dates → `POST /calendar/v3/calendars/primary/events` all-day (`start.date`, exclusive `end.date` = day after), `calendar_synced_events` synced with the event id; date change → `PATCH …/events/<id>` with the new dates, no duplicate POST; provider 503 → row `failed` with the reason, event id kept for retry; milestone delete → `DELETE …/events/<id>`. (6) QuickBooks (sandbox host): `invoice.paid` → customer query (miss) → customer create → item query (hit) → **one** `SalesReceipt` with `DocNumber` = invoice number and `Amount` = total, sync log `synced/SR-…`; `cost.confirmed` with a mapped category → one `Purchase` from the payment account to the mapped expense account; unmapped category → sync log `failed` naming the category, no vendor call, cost still saved; `/quickbooks/sync-log` shows both. (7) All eleven integrations with their env vars removed → `available: false` on status and **503 `NOT_CONFIGURED`** on connect; with env present → `available: true` and a 200 URL. (8) Every email captured during the run (16 distinct subjects, EN + FR) scanned for `undefined` / `NaN` / `[object Object]` / `null` / `{{` — clean.
- `src/lib/integrationAvailability.ts` + `available` on every status endpoint (`WaveStatus`, `QuickbooksStatus`, `WhatsappStatus`, Stripe Connect, Financeit, Flinks, Meta, LSA; `available.{google,outlook}` on `CalendarStatus`, `available.google` on `EmailConnectionsStatus`) + `refuseIfNotConfigured` on every connect/onboard/dealer route. OpenAPI + generated clients updated. Settings → Integrations renders a "Not available yet / Pas encore disponible" note in place of the Connect button when `available === false` (WhatsApp additionally disables the phone input). Verified in the Browser pane in both languages.
- `scripts/email-dns-check.ts` (`pnpm --filter @workspace/api-server email-dns-check [domain]`) — SPF / DKIM / DMARC / MX for the sending domain, read-only.
- `lib/api-spec/postgen.mjs` — orval 8.5 emits zod v4 top-level helpers (`zod.int()`, `zod.email()`); the workspace pins zod 3.x. Rewritten after every `codegen` so regeneration is green again (it had not been run since Phase 25; the committed `api-zod` output was 279 lines stale — `archivedAt` and friends).

**Found / fixed**
1. **Every unregistered integration showed a live "Connect" button that bounced Elite users to the vendor's error page with an empty `client_id`** — Wave, Meta Lead Ads, Google LSA, Outlook Calendar and Gmail send are all unregistered in production (`vercel env pull` lists no `WAVE_*`, `META_*`, `GOOGLE_LSA_*`, `OUTLOOK_CALENDAR_*`, `GMAIL_SEND_*`, `WHATSAPP_*`, `FLINKS_*`, `FINANCEIT_*`). Only Flinks had a guard (a 502). Fixed as above; WhatsApp also stopped writing an OTP row before discovering it could not send it.
2. **Quote follow-ups were hard-wired to English** (`const lang = "en"` in `quoteMessaging.ts`) while the French copy sat unused — a Quebec client got "Still thinking it over?". Now the client's stored preference, else `QC → fr`, same rule as contract drafting; amounts formatted `fr-CA`. The tick test asserts a QC quote follows up with "Soumission …".
3. **DNS: no DMARC record on `quoteai.ca`, no SPF on the apex** (`send.quoteai.ca` SPF/MX and `resend._domainkey` DKIM are correct, so DKIM-aligned DMARC would pass — but there is no DMARC to evaluate, which Gmail/Yahoo have required for bulk senders since Feb 2024). User task, below.
4. Informational: the incentives freshness check flagged `www.transitionenergetique.gouv.qc.ca` (certificate does not match — Azure CDN front) — the catalog row is now `isVerifiedByAi = false`, which is exactly what the check is for.

**Per-integration checklist**

| Integration | Our side (e2e) | Vendor side (user, at the portal) |
|---|---|---|
| Stripe subscriptions + one-shot | PASS — all four event types, email | **TODO** — Stripe test mode: buy Pro with `4242…`, check the plan flips and the welcome email arrives; cancel from the portal, check downgrade |
| Stripe Connect card payments | PASS — paid, receipt, replay-safe | **TODO** — onboard a test Express account, pay a public invoice with a test card, watch `account.updated` land |
| e-Transfer self-report | PASS (Phase 63) | nothing to do |
| QuickBooks sandbox | PASS — SalesReceipt + Purchase + log | **TODO** — connect a sandbox company from Settings, pay an invoice, confirm a cost, see both in QBO; disconnect |
| Google Calendar | PASS — create / patch / delete | **TODO** — consent screen is in *testing* mode: add the account as a test user, connect, complete a milestone, see the all-day event, move it, delete it |
| Gmail connected send | PASS — send + 401 fallback | **BLOCKED** — `GMAIL_SEND_*` not registered (needs its own OAuth client with the `gmail.send` scope + verification); until then the UI says "not available yet" and everything goes out via Resend |
| WhatsApp Cloud API | PASS — OTP, template fallback, FR | **BLOCKED** — `WHATSAPP_*` not set; the three templates were never submitted. Submit `quoteai_lead_followup`, `quoteai_review_request`, `quoteai_photo_share` (EN + FR, 2 body params each) in Meta Business Manager, then set `WHATSAPP_*_TEMPLATE` to the approved names |
| Meta Lead Ads | PASS — honest not-available | **BLOCKED** — `META_APP_ID` not set; once set, use the Lead Ads Testing Tool → lead appears in `/dashboard/leads` (webhook signature already verified in Phase 64) |
| Wave / Financeit / Flinks / Google LSA | PASS — honest not-available, cron skips cleanly | partner-gated, no action until credentials exist |
| Outlook calendar | PASS — honest not-available | **not registered** (Entra ID app), explicitly out of scope for launch |
| `/api/cron/tick` | PASS — 8 due kinds, idempotent | nothing to do (Vercel cron already runs it) |
| Email deliverability | 4/6 DNS checks | **TODO** — add `_dmarc.quoteai.ca TXT "v=DMARC1; p=none; rua=mailto:dmarc@quoteai.ca"` (move to `p=quarantine` after a clean month) and `quoteai.ca TXT "v=spf1 include:amazonses.com ~all"`; re-run `email-dns-check` |
| Transactional templates EN/FR | PASS — 16 subjects clean | spot-check one of each in a real inbox (Gmail dark mode, Outlook) during the Phase 66 walkthrough |

**Deferred**
- Vendor-side rows above → the user; nothing in code is waiting on them (each switches on by setting env vars).
- Outlook calendar stays "not registered" through launch (Phase 66/70 notes).
- `src/e2e/vendorStub.ts` records but does not persist; if a vendor contract changes (Meta API version, QBO minor version) the stubs need updating by hand — they encode today's request shapes.

### Phase 66 — Functional walkthrough (2026-09-20)

**Method** — the first time the dashboard was driven live against a real backend from the Browser pane. `pnpm --filter @workspace/api-server walkthrough` (`src/e2e/walkthrough.ts`, launch config `walkthrough-api`, :5000) boots the real Express app on `.env.staging` with outbound email captured at the fetch boundary (`api.resend.com` → `.walkthrough-mailbox.json`, every link printed to the server log) and every other vendor host stubbed; the `quote-ai` Vite dev server proxies to it. AI keys are not in `.env.staging` (Vercel pulls Sensitive vars empty) so every AI path ran its fallback — **AI quote generation, contract drafting quality and receipt OCR still need a pass with a real `GROQ_API_KEY`** (user). The scripted journey ran end to end on a fresh account: sign up → verification link → onboarding (business, province, licence, e-Transfer, 15/35/35/15 schedule) → manual quote ($10 000 + 13 % HST) → send by email → customer accepts on `/p/:id` → account moved to Elite by SQL (Stripe secret is also empty locally) → contract drafted → company draws a signature → sent with the email typed in the dialog → customer OTP + drawn signature → job auto-created → setup reviewed (3 milestones linked to the schedule, $7 200 budget) → job started → worker added + assigned → worker magic link on a 375 px viewport: clock in → clock out → owner approves → labour cost → manual material cost ($1 130) → change order (+$904, +2 days) signed by both with typed signatures → deposit invoice sent → customer "I've sent it" → owner confirms → paid, receipt → milestone 1 completed → INV-0002 drafted → job marked complete → archived → restored. Then every route in `App.tsx` (56, incl. bad ids/tokens and the 404) was loaded and probed for the error boundary, an `<h1>` and content — all render; every not-found state is a proper message. The account was removed afterwards with `pnpm --filter @workspace/api-server walkthrough:cleanup <email>` (harness sweep, storage included). CSP: no violations in the dashboard.

**i18n** — `pnpm --filter @workspace/quote-ai i18n-audit` (`scripts/i18n-audit.ts`, now a CI step): EN/FR key parity is exact (3 052 / 3 052, 0 unknown `t()` keys). It also lists English literals in app JSX: **104 → 36**. Three whole dashboard pages had never been translated — Clients list, Client detail, Documents/Quote Archive — plus the team-invite page: all four are now on `t()` (79 new keys) and were checked in FR. The 36 left are placeholders/aria-labels (`"City"`, `"Move up"`, `"Home Depot"`…) — Phase 67's a11y pass.

**Bugs found → fixed** (P1 unless noted)
1. **Every accepted quote silently reverted to "unlocked" the moment a subscriber opened it.** `quotes/[id].tsx` calls `POST /payments/unlock-quote` on open whenever `status !== "unlocked"`, and the route unlocked anything that wasn't unlocked — including `accepted`. Route now touches only `draft`/`pending_payment`; the effect only fires for those; a regression test pins it. Editing is also locked once accepted (new `acceptedWarning` copy), and `acceptedByName`/`acceptedAt` are now serialized (the "Accepted by ___" chip was blank).
2. **Trial users could not send a quote by email** — the button needed `status === "unlocked"`, which only a PDF download set, while the badge already said "Unlocked". `send-pdf-email` now unlocks like a download does (subscription plan / one trial download / 402), the button shows for every un-locked quote, and the email always carries the `/p/:id` link.
3. **The quote follow-up sequence (Phase 21) was dead for every quote sent from the dashboard**: it emails `clientData.email`, which neither quote form collects, so every tick ended in `no_email`. The address typed in the send dialog is now saved onto the quote (+ CRM client) when none exists.
4. **`/payments/unlock-quote` required `settings:full`** (Phase 62 default) — every non-owner member got a 403 on every quote open. Now `quotes:edit`.
5. **Contracts could not be sent when the quote had no email**, and the only way to add one was Edit, which wipes the company signature. The send dialog now asks for the email and stores it on the contract + quote.
6. **Elite accounts saw "Price List — Pro Plan, upgrade to Pro"** (`catalog.tsx` checked `plan === "monthly_pro"` only) and the billing page offered Elite users a plan comparison.
7. **An evening clock-in was logged on the next day** — `worker-time.ts` stored `now` and `toIsoDate` read it in UTC (20:18 in Ottawa = 00:18 UTC). `localDayFor(now, province)` (`jobs/dates.ts`, unit-tested) resolves the company-province calendar day; the 7 frontend `toISOString().slice(0,10)` defaults (cost date, payment date, log-hours date, payroll CSV range) now use `lib/local-day.ts`. P2.
8. **An API outage bounced users to `/sign-in`** (a failed `get-session` was treated as signed-out). `useAuth` exposes `isError`; `DashboardLayout` shows a "Can't reach QuoteAI — Try again" card instead. P2.
9. Dashboard stats excluded accepted quotes from "Unlocked"/revenue (`stats` now counts `unlocked + accepted`, new `accepted` field). P2.
10. `document.title` on every dashboard route was the marketing homepage title — `DashboardLayout` now sets "Section · QuoteAI". P3.
11. Contract text read "Quote No. No. 1.2026 …" (`numeroPreventivoData` already carries the prefix). P3.
12. Table rows on Quotes/Clients/Contracts/Jobs/Invoices were `<tr onClick>` only — unreachable by keyboard; `lib/row-link.ts` adds role/tabIndex/Enter. Milestone cards were a `role="button"` row wrapping the Start/Complete buttons (nested controls) — the expand toggle is now its own `<button aria-expanded>`. P2 (a11y).
13. "1 drafts pending", "Contract signed" with an emoji on a public page (professional-design rule). P3.

**Bugs found → deferred (`deferred-work`)**
- Manual quote tax picker is Italian-era (`Exempt / 4 / 5 / 10 / 13 %`): a QC contractor cannot express GST + QST, an AB one gets 13 % offered. Should be derived from the province like the AI path (`resolveQuoteTaxRate`). **P1 for QC launch.**
- "Mark complete" / "Archive" on a job act immediately (no confirm) even with milestones open and a draft invoice; no final-invoice / holdback-release prompt on completion. P2.
- Quote forms collect no client email/phone (send dialog + contract dialog now compensate); the CRM row is created without contact details. P2.
- Public customer pages (`/p/:id`) render inside the marketing chrome (WhatsApp banner, "Go to Dashboard", footer sitemap) — customers see the SaaS, not the contractor. P2 (Phase 67 decision).
- Job page money is `en-CA` formatted in FR (`$12,204.00` instead of `12 204,00 $`); chart axes show "2k $" twice and put `$` after the number in EN. P3.
- Change-order emails/pages say "Contract … ready to sign" and "AI drafted this from the quote". P3.
- Controlled dialogs (opened by a plain button, no `DialogTrigger`) don't return focus to the opener on Esc; the sign-page OTP input has no label. → Phase 67.
- Optional integrations log at `error` level when merely unconfigured (14 lines on every boot) — noise for Phase 69's error tracking. P3.
- Journey steps that do not exist as features: **CSV data export** (only the payroll CSV and the import template exist) and **account deletion** (Phase 64) — PIPEDA portability + erasure, both still open.
- No AI key locally: AI quote generation returns a bare 500 "Something went wrong" when the model is unreachable — should be a 503 with a specific message. P3.

**Not done in this phase**: the "kill the API mid-action" state was tried once (fix 8); per-dialog validation/keyboard checks were done on the 9 dialogs the journey passes through (Esc closes all of them, Enter submits the single-field ones), not all of Phase 60's; the frontend is still not role-aware (Phase 62 leftover) — with only one owner account exercised, no role bug surfaced beyond fix 4.

**Verification**: `pnpm typecheck` (root) · `pnpm lint` 0 errors (69 warnings, unchanged) · `pnpm knip` · unit 11 files / 43 tests · e2e 7 files / 59 tests green against `quoteai` (2 new tests pin fixes 1-3 and 9) · `docs/ROUTE-MATRIX.md` regenerated · api-spec codegen re-run (`acceptedAt`, `QuoteStats.accepted`).

### Phase 67 — Visual & accessibility QA (2026-09-20)

**Built**
- `pnpm --filter @workspace/api-server qa:visual` (`src/e2e/visual-a11y.ts`): boots the real API on an ephemeral port (harness, `.env.staging`), spawns Vite proxied at it, seeds a **showcase account** (`src/e2e/fixtures.ts` — the lifecycle chain from `lifecycle.e2e.test.ts` plus a 30-line quote, a sent-but-unsigned contract whose `/sign/:token` link is pulled from the captured email, a sent manual invoice for `/i/:token`, a worker magic link, a team invite, catalog items) and drives the installed Chrome through `playwright-core` (no browser download). For every route × language × width it records a full-page screenshot, horizontal overflow with the widest offenders, axe-core violations (with fg/bg/ratio for contrast), console errors, failed `/api` calls and error-boundary text → `.qa/visual/report.{md,json}` (gitignored). Defaults: **51 routes, EN at 1280/980/768/640/375, FR at 1280/375 = 364 pages, ~16 min**. Flags: `--lang`, `--widths`, `--routes=substr,…` (no leading slash under Git Bash — MSYS rewrites it), `--screenshots=false` for an axe-only pass, `--keep` to leave the account/servers up, `--port`/`--out` + `E2E_NO_PURGE=1` to run a second pass beside a full sweep.
- `pnpm --filter @workspace/api-server qa:pdf` (`src/e2e/pdf-matrix.ts`): renders **44 PDFs** — ON/QC × logo/no-logo × {quote standard, quote 30 lines, trial watermark, capitolato, WhatsApp, signed contract, sent contract, language-flipped contract, partly-paid progress invoice, deposit draft, language-flipped 28-line invoice} → `.qa/pdfs/`. All 44 render; page breaks repeat table headers.
- `src/e2e/qaEnv.ts` — the `.env.staging` loader + offline defaults + Resend capture the walkthrough, cleanup and both new scripts now share (three copies before).
- `E2E_NO_PURGE=1` on the harness; `hooks/use-document-title.ts`; DB migration `0033_phase67_quote_defaults.sql` (applied to `quoteai`).

**Numbers** — first sweep (364 pages): **32 pages with horizontal overflow, 3 856 axe serious/critical nodes** across 12 rules, plus the `/p` page failing under its own rate limiter. Final sweep: **0 overflow, 0 axe serious/critical, 0 console errors, 0 failed `/api` calls**; moderate leftovers listed under deferred. `i18n-audit` JSX literals 36 → 9 (brand names, `••••`, example values). Exit criterion met for the automated half; the real-device half is the user's.

**Found → fixed**
1. **Customer-facing quote page (`/p/:id`) showed Italian** — "Analisi Economica e Computo Metrico Prezzato" / "Preventivo valido 30 giorni" for any quote row inserted without those fields (the DB column defaults were still Italian-era, and `public-quotes.ts` fell back to the Italian title when the AI omitted one); `iva_percentuale` defaulted to **22 %**. Defaults migrated to English / 0 % (`0033`), fallback fixed. P1.
2. **Discount stored with the opposite meaning on AI-generated quotes**: `quotes.ts` (create + regenerate) saved `sconto.importoScontato` as the *discount amount*, while the editor and every renderer (three pdfmake builders, two HTML templates, the dashboard, WhatsApp PDF) read it as the *discounted subtotal* — a 10 % discount on $10 000 printed "DISCOUNT −$9 000 / DISCOUNTED SUBTOTAL $1 000". Now stores the discounted subtotal like the editor does. P1.
3. **`/p/:id` hid the discount entirely** (subtotal $28 970 → total $27 521.50 with nothing between). Discount + "subtotal after discount" rows added, variants included.
4. **`/p/:id` rendered inside the marketing chrome** (WhatsApp banner, nav, "Sign up", footer sitemap, support bubble) — the Phase 66 deferred decision. It now uses the same `doc-shell`/`doc-head` as the invoice and signing pages: contractor name, quote number, EN/FR toggle (quotes carry no language), "generated with quoteai.ca" line. P2.
5. **Public quote view limiter** was 30/min per IP shared by the three calls every page load makes (quote, Financeit status, incentives) = 10 views/min, and the page renders a 429 as "Quote not available". Now 120/min. P2.
6. **French invoices and contracts labelled taxes "GST"/"QST"** — `taxLabel()` maps to TPS/TVH/TVQ/TVP/TVD in both the HTML and PDF renderers. P2.
7. **Analytics recent-quotes chip said "Draft" for accepted quotes** (no `accepted` branch). P3.
8. **Overflow (32 → 0)**: analytics KPI row was an inline `repeat(6, 1fr)` no media query could override; `.content` and `.card` had no `min-width: 0` so a nowrap pill row / wide table pushed the whole dashboard wider at 1280 (job page) and 375 (quotes, catalog, analytics); sitemap / about / contact used inline `repeat(3, 1fr)` grids; contract "parties" grid 2-col at 375; `.btn` nowrap broke long FR labels (widget key, logo upload); logo row now wraps.
9. **axe (3 856 → run 4)** — root causes: `--faint` #8f9198 (3.1:1) → #6d6f76; sidebar group labels #6f7191 on navy → #9294ad; `--green` #2ca01c (white text 3.4:1) → #227a15, `--green-dark` → #196010, `--teal` → #0a7580, `--teal-dark` → #0a6f78, `--red` → #bf3d09; `.chip-new` on green-dark; `kbd` hint; billing struck-through features lost `opacity-50`; invoice aging zeros; contract `.sig-empty`; the notification bell's `<span>` wrapper carried Radix's `aria-haspopup` (critical on every dashboard page) → the button is the trigger; unlabelled icon buttons (support bubble, password eye, attach, catalog edit/delete, job rename, copy/open link, worker ± hours, regenerate key), unlabelled selects/date/number inputs (job setup, team tab, costs filter, worker page), `<label>` without `htmlFor` on the sign and worker pages, star rating `aria-label` on a span → `role="img"`, scrollable gantt/comparison/preview regions focusable, decorative donut and WhatsApp phone mock-up `aria-hidden`.
10. **Reduced motion**: modal/sheet enter-exit, sidebar drawer, tw-animate surfaces collapse to 1 ms under `prefers-reduced-motion`.
11. **`document.title`** on `/p`, `/i`, `/sign`, `/t`, `/team-invite`, sign-in/up, onboarding (all showed the homepage title). i18n audit's remaining English aria-labels/placeholders translated (`a11y.*` keys); emoji in Settings' WhatsApp upsell → lucide icons, plan chips lost ⭐/👑.

**Found → deferred** (→ `deferred-work-post-launch`)
- **The quote PDF (all three templates, the capitolato and the WhatsApp PDF) is English-only and prints a single "TAX (x %)" line** — a QC contractor cannot send a French quote and GST/QST are never itemised on it, while contracts and invoices are fully bilingual with TPS/TVQ split. This is a build (string table + tax profile in `generateQuotePdfBuffer` & co.), not a QA fix. **P1 for the QC launch, same bundle as the manual-quote tax picker.**
- Invoice and contract PDFs never show the company logo (only quote PDFs do). P3.
- Quote PDF chapter headings can be orphaned at a page foot (header row on page 1, rows on page 2). P3.
- 14 `picsum.photos` placeholder images on public pages (home, /whatsapp, sectors) — random stock photos at runtime, third-party host in the CSP. Phase 68 content.
- axe moderate: `heading-order` (footer `<h4>`s, blog cards), `landmark-one-main` on about/contact/privacy/terms (rendered outside `PublicLayout`). Not in the exit criterion; left.
- Chart axes "6k $" in EN (Phase 66 P3) unchanged.
- **Real devices** (iPhone Safari / Android Chrome: `/p`, `/i`, `/sign`, `/t`, bottom sheets, sidebar drawer) and a screen-reader pass are the user's half — the emulated 375 px pass is not a substitute.
- Dialog focus-return (Phase 66 note): Radix returns focus to the previously focused element; the case observed in 66 (opener re-rendered/unmounted) was not reproduced here — re-check on device.

**Verification**: `pnpm typecheck` (root) · `pnpm lint` 0 errors (69 warnings, unchanged) · `pnpm knip` · unit 11 files / 43 tests · e2e 7 files / 59 tests green against `quoteai` · `qa:visual` 364 pages clean · `qa:pdf` 44/44 · `docs/ROUTE-MATRIX.md` regenerated (limiter change) · migration 0033 applied.

### Phase 68 — Performance, SEO & content integrity (2026-09-20/21)

**Built**
- `pnpm --filter @workspace/quote-ai qa:lighthouse` (`scripts/lighthouse.ts`, devDeps `lighthouse` + `chrome-launcher`): serves `dist/public` through `server/serve.mjs` (which now proxies `/api` to `API_PROXY_TARGET`, local QA only), runs Lighthouse's default mobile profile N times per URL (median), writes `.qa/lighthouse/report.{md,json}` plus one HTML report per URL, exit 1 under Perf ≥ 90 / SEO 100 / CLS ≤ 0.1. Flags `--urls`, `--runs`, `--api=<e2e API>` (public quote page; pair with `qa:visual --keep`), `--base=<any origin>`. Under Git Bash use `MSYS_NO_PATHCONV=1` or paths without the leading slash.
- `pnpm --filter @workspace/api-server qa:perf` (`src/e2e/api-perf.ts`): seeds 500 quotes / 50 jobs (+ milestones, costs, invoices, payments) into a fresh account by direct insert, samples 12 read endpoints × 20 after warm-up, p50/p95/max + payload → `.qa/perf/report.md`, exit 1 over budget.
- Build-time React rendering of the eight React-owned public pages (`src/entry-server.tsx`, `vite build --ssr`, `react-dom/static` `prerenderToNodeStream`, `main.tsx` `hydrateRoot`): `/`, `/fr`, `/whatsapp`, `/chi-siamo`, `/contatti`, `/privacy-policy`, `/terms`, `/mappa-sito`. The hand-written bodies these replace in `prerender-seo.ts` had drifted to the pre-redesign layout. `main.tsx` imports `App` on demand: the 233 static SEO/blog pages never load it.
- `validate-prerender` checks every file (was a 50-file sample) and asserts one `<title>`, one canonical matching the path, hreflang x-default, an `og:image` that exists in `dist/public`, `<meta charset>` first, `<html lang>` matching the route. `i18n-audit` §4 checks the dictionary split. `qa:visual` scans every page's text for raw translation keys (`RAWKEY:`).
- Root `pnpm spell` (cspell, EN + fr-FR) over the public copy and email templates; `cspell.json`.
- DB migration `0034_phase68_invoice_payments_user_idx.sql` (applied to `quoteai`). Launch config `quote-ai-static` (production build on :5199).

**Numbers** — Lighthouse mobile, medians of 3, local static server (Vercel's CDN can only be faster; run-to-run spread ±3–5):

| URL | before | after | LCP | TBT | CLS | JS |
|---|---|---|---|---|---|---|
| `/` | 74 (LCP 5.3 s, JS 402 kB) | **93** | 2.6 s | 111 ms | 0 | 197 kB |
| `/fr/` | ≈74 | **92** | 2.6 s | 122 ms | 0 | 197 kB |
| `/whatsapp/` | — | **92** | 2.6 s | 168 ms | 0 | 202 kB |
| blog article | — (CLS 0.08) | **99** | 1.7 s | 109 ms | 0 | 87 kB |
| `/quotes/painter/` | — (CLS 0.08) | **99** | 1.9 s | 45 ms | 0 | 87 kB |
| `/quotes/painter/toronto/` | — | **99** | 1.9 s | 46 ms | 0 | 87 kB |
| `/fr/soumissions/peintre/montreal/` | 62 (CLS 0.79) | **98** | 1.8 s | 135 ms | 0 | 87 kB |
| `/p/:id` (public quote, e2e API behind the proxy) | — | **92** | 2.7 s | 106 ms | 0 | 210 kB |

SEO 100 and Best Practices 96–100 everywhere; a11y 92–98 (the static SEO bodies' moderate axe leftovers from Phase 67). Public entry chunk 1 120 kB → 60 kB (+ an `App` chunk of 311 kB loaded only on hydrated/SPA routes and `modulepreload`ed on the rendered pages). Dashboard home first load ≈ 60 + 311 + 208 (react) + 35 (query) + 32 (icons) + 268 (dashboard dictionary) + 33 (layout) + page ≈ 290 kB gzipped; `admin.tsx` (79 kB) and the blog bodies (54 kB) ship only on their own routes.

API p95 with 500 quotes / 50 jobs (local app → staging Postgres): dashboard home 91 ms · **quotes list 1 731 ms / 1.46 MB → 315 ms / 266 kB** · clients 82 ms · jobs list 138 ms · job detail 173 ms · job analytics 136 ms · company analytics 585 ms (3 → 2 query rounds, new payments index) · invoices 181 ms · contracts / archive / notifications / profile < 100 ms. No N+1 anywhere; `clients.ts` is a single GROUP BY.

**Found → fixed**
1. **Figtree never loaded in production** — the Google Fonts `@import` sat after the `@font-face` rules, so PostCSS dropped it at build and every page rendered in Inter. Self-hosted from `@fontsource-variable/figtree` (20 kB latin woff2, preloaded); `@import`s moved to the top of `index.css`. P1 (the locked typeface).
2. **Every sector, city and blog page shipped two headers, the top one in Italian** ("Accedi / Registrati" — `SeoNavShell` inserted above the static body), and the 210 city pages + 23 blog pages had **no site header or footer** of their own. `/fr/soumissions/*` was not matched by `main.tsx` at all and got the whole App rendered over the static body (CLS 0.79). Now: bodies wrapped in the static layout, the nav shell replaces the static `header.sticky` within one frame, EN/FR labels. P1.
3. **`og:image` 404 on all 210 sector/city pages** (`/og/<slug>.jpg` vs the generated `/og/sectors/<slug>.png`); 12 of 22 sectors had no OG image. One map (`getOgImagePath`) for the engine, the generator (all sectors now) and the prerender; 78 stale Italian-era blog OG PNGs deleted. P2.
4. **`GET /api/quotes` returned every quote in full** (chapters, line items, raw input, company snapshot): 1.46 MB / 1.7 s at 500 quotes. New `QuoteSummary` (openapi + codegen), `lineItemCount` computed in SQL. P1 at scale.
5. `support-bot` polled `/api/support/admin-status` every 15 s from every public page for every visitor (a serverless invocation per visitor-minute, a console error on any host without the API); now only while the panel is open.
6. Header logo PNG 1545×688 / 134 kB displayed at 162×72 → 323×144 / 6 kB. 466 kB of unreferenced public assets removed (`prevai-*.png`, workbench PNG, the 12 MB `ai-particles.mp4`, Italian testimonial logos). Decorative 1800×900 CTA images `loading="lazy"`.
7. `posthog-js` (285 kB) and gtag (170 kB) no longer load before first paint: first user interaction or 5 s, whichever comes first (events queue meanwhile). CSP hashes regenerated.
8. `<meta charset>` was preceded by the injected `<title>` (with an en dash) on every prerendered page; the head block is now injected after charset/viewport.
9. `sitemap.xml` used the build date as `lastmod` for the static routes, so it churned on every build (the §1 item). `PUBLIC_ROUTES` carry a fixed `lastmod`.
10. Customer-private token pages (`/p`, `/i`, `/sign`, `/t`, `/team-invite`) were indexable: `noindex` in the shell script, `Disallow` in robots.txt.
11. Bundle: translation dictionary split (`translations.ts` 850 core keys / `translations.dashboard.ts` 2 235 keys registered by the dashboard layout + admin page); `seo-data` (117 kB) and the blog bodies out of the entry (`seo-slugs.ts`, `blog-index.ts`, sync assertion at build); `mappa-sito`, auth, legal and contact pages lazy; `@radix-ui` no longer a manual chunk (the homepage loaded all 136 kB for Tooltip + Toast).
12. Privacy policy §5 listed only Stripe / OpenAI / Resend; it now names the processors the product actually uses (Groq or OpenAI, Vercel, Supabase, Gmail/Outlook, Meta/WhatsApp, Google/Microsoft calendars, QuickBooks/Wave, Financeit/Flinks, PostHog/GA) and what the AI receives. Both legal pages said "Last updated: May 6, 2025".
13. Copy: cspell EN+FR over 21 files → 129 unknown words, all trade jargon, proper nouns or accented French; the only Italian left is in code comments. The legal entity is still "QuoteAI, a business operating from Ontario" — the registered name and address are the user's (§1).

**Found → deferred** (→ `deferred-work-post-launch`)
- The 233 static SEO/blog pages still use the hand-built pre-redesign bodies (violet gradient buttons, "Need help?" bubble) while the React versions are the navy redesign — crawlers and users see a different site on those pages. Fix = render them through `entry-server.tsx` like the eight pages above and delete ~1 800 lines of `prerender-seo.ts`; an SEO-content diff comes first (the hand-built bodies carry extra "Osservatorio" / "Quanto costa" text). P2.
- Homepage `SeoHead` title/description differ from the prerendered ones (crawler vs post-hydration).
- Critical-CSS inlining: the 35 kB gz stylesheet is the last render-blocking request (homepage LCP 2.6 s → ~2.2 s).
- 14 `picsum.photos` placeholder images (Phase 67) unchanged — real photography is content.
- Company analytics p95 ~600 ms: the per-project loops are O(P×N) in JS; fine to a few hundred jobs.

**Verification**: `pnpm typecheck` · `pnpm lint` 0 errors (69 warnings) · `pnpm knip` · unit 11 files / 43 tests · e2e 7 files / 59 tests green against `quoteai` · `qa:visual` EN+FR @1280, 104 pages, 0 raw keys / 0 console errors · `validate-prerender` 417/417 · `validate-sitemap` 417/417 · `i18n-audit` clean · `qa:lighthouse` (8 URLs above) · `qa:perf` 12 endpoints within budget · `docs/ROUTE-MATRIX.md` regenerated · migration 0034 applied.
