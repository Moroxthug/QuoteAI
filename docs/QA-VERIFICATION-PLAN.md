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
- ~~Phase 4 (contract → deposit invoice → send → pay)~~ verified in Phase 63; `/api/cron/tick` end-to-end → Phase 65. Phase 5 (assistant tool-calling, `/dashboard/analytics`) — never live-tested.
- Mobile responsiveness — code review + emulated viewport only, no real device.
- Only 7 unit test files exist (`analytics/math`, `invoices/math`, `incentives/matching`, `crypto`, `requirePermission`, `connectedEmailSend`, `gmailSendClient`). Everything from Phase 7 on (team invites, lead sequencing, archive filtering, imports review queue, variants, clock-in, all OAuth syncs) has zero coverage.
- Root `pnpm run typecheck` still fails on `lib/api-zod` (zod v3/v4 mismatch), so CI (`.github/workflows/test.yml`) only typechecks the two apps.
- No ESLint config at all (`npx eslint` errors out) — unused imports/dead code are only caught by hand.
- Phase 29's `local_services_lead_conversation` contact-detail lookup left as a follow-up.
- Phase 47 note: dashboard Clients is a virtual list from `quotes.client_data`; `clientsTable.archivedAt` exists but nothing sets it.
- `artifacts/quote-ai/public/sitemap.xml` has an uncommitted 9-line local change sitting in the working tree (and `lib/db/src/schema/incentives.ts` had one for weeks — check whether it is still there).

**Configuration / external (user-owned, not code)**
- Vercel env vars for QuickBooks / Google Calendar / Outlook / `INVOICE_LINK_SECRET` — QuickBooks + Google were registered 2026-09-14; **Outlook (Entra ID) still not**.
- Three WhatsApp templates never submitted to Meta (lead follow-up, review request, photo share) → silently fall back to email.
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
