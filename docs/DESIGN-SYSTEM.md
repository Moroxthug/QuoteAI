# QuoteAI visual redesign — design system reference

**Status**: Phases 30-36 built & pushed. Supersedes `docs/HOMEPAGE-DESIGN-PLAN.md`'s palette/radius recommendations — see the note at the top of that file. Numbered as Phase 30 onward (not 29 — Phase 29 was already used by Google Local Services Ads lead capture, see `docs/EDGE-FEATURES-PLAN.md`). Each remaining phase is intended to run as its own conversation.

## Source

Two AI-generated HTML/CSS mockups the user supplied directly, to be replicated visually (structure, color, motion) with QuoteAI's real content:
- Marketing homepage mockup (mega-menu, hero word-reveal, product tiles, story splits, animated count-up stats, newsroom, footer).
- Dashboard app mockup (collapsible rail sidebar, topbar with search/notifications, AI composer, stat tiles, kanban leads board, chat-style assistant, recharts-style bar/pie charts, settings forms).

Both use: navy `#101031` as the single primary/brand color, Figtree as the display font, fully pill-shaped buttons (`border-radius:999px`), 18px-radius cards, and a fixed palette of tinted "chip" status colors (green/teal/yellow/grey/red/purple) that are NOT theme tokens — they're constant regardless of light/dark mode, same as a status color in any product.

## Tokens (`artifacts/quote-ai/src/index.css`)

| Token | Value | Notes |
|---|---|---|
| `--app-font-sans` | `'Figtree', 'Inter Variable', 'Inter Variable Fallback', sans-serif` | Figtree loaded via Google Fonts `@import` at the top of the file. Inter stays as fallback (already self-hosted for CLS). |
| `--radius` | `1.125rem` (18px) | Cascades to `--radius-sm/md/lg/xl` via the existing `@theme inline` mapping. |
| `--primary` (light) | `240 51% 13%` (navy `#101031`) | Was near-black `222 47% 11%`. Dark mode's `--primary` is unchanged (stays near-white — it's the "button color that contrasts with a dark page background," a different job than the brand hue). |
| `--ring` | `240 51% 45%` | Was violet `265 89% 60%`. |
| `--grad-from/mid/to` | `#1e1e50` / `#101031` / `#181850` | Was violet→indigo→cyan (`#7C3AED`/`#4F46E5`/`#06B6D4`). Powers `.btn-gradient` — now reads as a solid navy pill with a subtle sheen instead of a rainbow gradient. |
| `--qa-navy` | `#101031` | Raw hex, for anywhere a Tailwind arbitrary-value class is more convenient than the HSL token. |
| `--qa-green` / `--qa-green-t` / `--qa-green-dark` | `#2ca01c` / `#e9f6e6` / `#1f7d12` | "Won"/success/positive chip + the Switch component's "on" color (mockup uses green for toggles, not navy). |
| `--qa-teal` / `--qa-teal-t` / `--qa-teal-dark` | `#0f97a2` / `#e3f5f4` / `#0b7c86` | "Sent"/in-progress chip. |
| `--qa-purple` / `--qa-purple-t` | `#6c2bd9` / `#eeecfc` | One of the mega-menu product-tile colors + an "Owner" role chip; no longer the app's default/brand color. |
| `--qa-yellow` / `--qa-yellow-t` / `--qa-yellow-dark` | `#ffe01b` / `#fdf6c9` / `#7a5c00` | "Draft"/pending/due chip. |
| `--qa-red` / `--qa-red-t` | `#d9480f` / `#fdeee5` | "Overdue"/error chip. |
| `--qa-grey-t` | `#eceef2` | Neutral/inactive chip, pairs with `text-muted-foreground`. |

Every hardcoded `rgba(124,58,237,...)` / `#7C3AED` / `#4F46E5` / `#06B6D4` reference inside `index.css`'s animation/utility layer (`.quoteai-word` shimmer, `.logo-glow`, `.crm-nav-active`, `pro-glow`, `soft-pulse-glow`, `.hero-grid-bg`, `.mesh-blob-1/2/3`) was repointed to navy (and, for variety in the wordmark shimmer and the two smaller mesh blobs, teal/green from the same accent set) — this file-scoped sweep is done; the same `violet-*`/`indigo-*`/`cyan-*` Tailwind utility classes used directly in ~68 page/component files (not just `index.css`) are Phase 31, not yet done.

## Primitives touched (`src/components/ui/*.tsx`)

- `button.tsx` — base + `sm`/`lg` sizes now `rounded-full` (pill). `icon` size has no radius override, so icon buttons became circular.
- `card.tsx` — `rounded-[var(--radius)]` (was `rounded-xl`) + the mockup's exact card shadow spec `shadow-[0_14px_34px_rgba(16,16,49,0.10)]` (was generic Tailwind `shadow`).
- `badge.tsx` — `rounded-full` (was `rounded-md`) + six new `chip-*` variants (`chip-green/teal/yellow/red/purple/grey`) using the `--qa-*` chip tokens above. Existing `default`/`secondary`/`destructive`/`outline` variants are untouched.
- `input.tsx` / `select.tsx` (SelectTrigger) — `rounded-[var(--radius-sm)]` (was `rounded-md`).
- `tabs.tsx` — `TabsList`/`TabsTrigger` now `rounded-full` (segmented-pill look, matching the mockup's period/status toggle).
- `switch.tsx` — checked state now `bg-[var(--qa-green)]` (was `bg-primary`/navy) — the mockup uses green for "on," reserving navy for brand/primary actions only.
- `logo.tsx` — dropped the `.logo-glow` violet drop-shadow pulse (kept the existing `/quoteai-logo.png` asset; no new brand asset was generated).

## Phase 31 (Tailwind color sweep) — built & pushed 2026-09-16

Added a `navy-50…950` and `teal-50…950` Tailwind color scale to `@theme inline` in `index.css` (hue 240 to match `--primary`/`--ring`, hue 187 to match `--qa-teal`; fixed, not theme-tokens, same as the `--qa-*` chips). Then swept all ~68 files: mechanical `violet-*`/`indigo-*` → `navy-*` and `cyan-*` → `teal-*` for brand-accent usage (icons, links, hover states, gradients, progress bars) — this covered the overwhelming majority of the ~1030 occurrences.

**Exception, done by hand**: a handful of spots used violet/indigo as a genuinely distinct *status* color sitting alongside blue in the same badge/chip set (`jobs/badges.tsx` MILESTONE.planned + INVOICE.viewed + the invoice "scheduled" chip, `contracts/[id].tsx` STATUS_STYLES.viewed, `jobs/gantt.tsx` BAR.planned, `leads/index.tsx` STATUS_COLORS.quoted, `quotes/index.tsx`'s "unlocked" badge). Recoloring those to navy would have made them visually collide with the "active/sent" blue status right next to them, so those specific keys were mapped to the existing `--qa-purple`/`--qa-purple-t` chip tokens instead (`bg-[var(--qa-purple-t)] text-[var(--qa-purple)]`), keeping them a distinct hue. Everything else in those same files (plain brand accents) still went to navy.

## Phase 32 (dashboard shell) — built & pushed 2026-09-16

`dashboard-layout.tsx`'s sidebar nav now renders in 5 presentational groups (`Overview`/`Sales`/`Delivery`/`Insights`/`Workspace`, defined by `NAV_GROUPS` + each item's `group` key) with uppercase group headers when expanded and thin dividers between groups when collapsed to the rail. The rail-collapse itself now animates each item's label (`max-w-0 opacity-0` ↔ `max-w-[140px] opacity-100`, `transition-[max-width,opacity] duration-200`) instead of hard-unmounting it, so text fades/shrinks in place alongside the `w-14`↔`w-56` sidebar width transition. Added a desktop topbar (new `<header>` row above `<main>`, `hidden md:flex`) holding a Cmd/Ctrl+K quick-search pill (`QuickSearch`, built on the existing `ui/command.tsx` cmdk wrapper — jumps to any nav page or "New Quote", no new backend search endpoint needed) and the notifications bell, which moved out of the sidebar's bottom stack into this topbar (`NotificationsBell` gained `side`/`align` props so its popover opens downward there instead of to the right); also added it to the mobile header, which never had it before. Translation keys added: `dashboard.nav.group.*`, `dashboard.search.*` (en + fr).

## Phase 33 (marketing homepage) — built & pushed

No copy of the two original mockups was saved to disk (they were pasted directly into the Phase 30 conversation), so this phase worked from this doc's written description rather than pixel-matching image references.

- **Mega-menu**: `TradesMegaMenu` in `public-layout.tsx`'s desktop nav — click-to-open (not hover; hover+click together fought each other and closed instantly on click), closes on outside click, shows a fixed `MEGA_MENU_TRADE_SLUGS` subset of `TRADE_LABELS` plus footer-style resource links and a WhatsApp callout card. `MobileTradesAccordion` mirrors it in the mobile drawer.
- **Hero word-reveal**: `components/reveal-heading.tsx`'s `RevealHeading` splits a heading into lines/words and staggers a slide-up+fade-in per word on mount (`.reveal-word-wrap`/`.reveal-word` in `index.css`, `@keyframes word-reveal-up`, reduced-motion-safe). Used for the homepage H1; gradient words (e.g. "30 seconds") keep the existing static `.gradient-text` class layered on top.
- **Animated count-up stats**: `components/stats-bar.tsx` + `hooks/use-count-up.ts` (IntersectionObserver-triggered count from 0, reduced-motion-safe). Shows 4 numbers, all real and derived from existing data rather than invented: "30 sec" to generate a quote, `Object.keys(TRADE_LABELS.en).length` trades supported, `CITIES.length` Canadian cities covered, and `AGGREGATE_RATING` (from `testimonials-section.tsx`).
- **Story-split restyle**: turned out to mean fixing 4 leftover hardcoded violet hex colors in `home.tsx` that Phase 31's Tailwind-*class* sweep couldn't catch because they were inline `style={{ background: "..." }}` strings, not Tailwind classes — the WhatsApp-teaser blob glow, one gradient-text accent, and two numbered-step-circle gradients. Repointed to `var(--qa-navy)` / `var(--qa-teal)` / `var(--grad-from)`/`var(--grad-to))`. The existing icon+text/visual split sections already matched the design system's spacing/color language after Phases 30-31, so no structural rebuild was needed there.

## Phase 34 (leads kanban board) — built & pushed 2026-09-16

`leads/index.tsx` rebuilt from a flat filterable list into a 6-column kanban board (`new`/`contacted`/`quoted`/`won`/`lost`/`unsubscribed`), one column per `LeadStatus` — data model was already 1:1, this was a presentation-only rewrite. Cards are draggable between columns via native HTML5 drag-and-drop (`draggable`, `onDragStart`/`onDragOver`/`onDrop`, no new dependency added — no DnD library existed in `package.json`) and call the existing `leadsApi.update` status-change mutation on drop; the column being dragged over highlights (`bg-navy-50 border-navy-300`). Each card shows name, channel icon + contact, a source chip, next-follow-up relative time, and the existing "Send now" button. The old per-row status `<Select>` and filter-pill row were removed since the column itself now encodes status; a plain search input remains. Column header dot/label colors reuse the chip token family (`--qa-purple`/`--qa-green`/`--qa-red` etc.) rather than introducing new colors. Added one new string key, `leads.column.empty` (en + fr).

**Per the visual-redesign-plan memory, the remaining ~20-page dashboard sweep is split into further phases** (each its own conversation), continuing the numbering from 35:
- **Phase 35**: core sales/delivery pages — `jobs/index.tsx`, `jobs/[id].tsx`, `jobs/setup.tsx`, `quotes/index.tsx`, `quotes/[id].tsx`, `invoices.tsx`, `invoices/[id].tsx`, `contracts/index.tsx`, `contracts/[id].tsx`, `clients/index.tsx`, `clients/[name].tsx`.
- **Phase 36**: `dashboard/index.tsx` (overview), `analytics.tsx`, `assistant.tsx`.
- **Phase 37**: `settings.tsx` + its `settings-business-tab.tsx`/`settings-security-tab.tsx`, `billing.tsx`, `team.tsx`, `catalog.tsx`, `documents.tsx`, `profile.tsx`, `onboarding.tsx`, `imports/index.tsx`.

## Phase 36 (dashboard overview, analytics, assistant) — built & pushed 2026-09-16

Presentation-only pass, same mechanical radius sweep as Phase 35 plus two leftover hardcoded gradient colors that predated the Phase 31 Tailwind-class sweep (same category of miss as Phase 33's `home.tsx` fix — these were inline `style={{background: "..."}}` strings, not Tailwind classes).

- **`dashboard/index.tsx`** (overview/`DashboardHome`): headers/hero already matched the pattern. Swept every custom container's `rounded-xl`/`rounded-2xl` (hero banner, AI quick-bar, client-info panel, onboarding card + its 3 step tiles + 3 quick links, trial banner, starter-upgrade card, subscription upsell banner, stat-card tiles, recent-quotes card, 3 quick-action cards, all loading skeletons) to `rounded-[var(--radius)]`; nested small elements (upload-button, no-saved-client CTA, saved-client chip buttons) to `rounded-[var(--radius-sm)]`. Fixed 2 hardcoded `rgba(124,58,237,...)`/`rgba(6,182,212,...)` (violet/cyan) inline gradient backgrounds — one on the onboarding welcome icon, one on the recent-quotes row icon — to `rgba(16,16,49,...)`/`rgba(15,151,162,...)` (navy/teal).
- **`analytics.tsx`**: header already matched. The 3/6/12-month period switcher (a custom segmented control, not the `Tabs` primitive) went from `rounded-xl` wrapper + `rounded-lg` buttons to `rounded-full` on both, matching the mockup's pill-toggle convention used elsewhere (`tabs.tsx`). Fixed the gated-plan card, loading skeletons, and the `Tile` stat-tile component's `rounded-2xl` to `rounded-[var(--radius)]`.
- **`components/charts.tsx`**: `ChartCard`'s outer `<section>` (used by every chart panel on both the overview and analytics pages) — `rounded-2xl` → `rounded-[var(--radius)]`. Left `SERIES.actual`'s violet (`#7c3aed`) alone: it's a fixed, CVD-validated multi-series chart data color (not a brand/UI accent), the same category of intentional exception as Phase 31's status-chip purples — recoloring it to navy would collide with the "invoiced" series' blue right next to it in the same chart.
- **`assistant.tsx`**: header already matched the standard pattern; the actual UI is `components/assistant/assistant-panel.tsx`.
- **`components/assistant/assistant-panel.tsx`**: fixed the gated-plan card and the main chat-panel wrapper `rounded-2xl` → `rounded-[var(--radius)]`. Left the chat message bubbles and proposal cards as-is (`rounded-2xl`/`rounded-xl` with an asymmetric `rounded-br-md`/`rounded-bl-md` tail) — those follow a chat-bubble shape convention distinct from the card/container radius, not a leftover hardcode.

Verification: `npm run typecheck` (tsc, no emit) is clean. Attempted a live dev-server check (the mock-api launch config exists but its backend on port 5055 isn't running in this environment) — confirmed the same `/api/*` 500s as prior dashboard-only phases, so no visual check was possible; this matches the known limitation, not a regression from this phase's changes.

Starting any new phase: read this file plus `[[deploy-workflow]]`'s conventions (typecheck, `preview_start` + Browser-pane visual check, auto-push) — no migrations are involved in any of these, this is frontend-only. Note: the local dev server's backend API isn't reachable from this environment (proxy `ECONNREFUSED` on `/api/*`), so authenticated dashboard pages can't be visually verified live in the Browser pane — verification for dashboard-only phases has relied on typecheck + code review instead; flag this to the user if a phase needs a true visual check.

## Phase 35 (sales/delivery pages) — built & pushed 2026-09-16

Presentation-only pass across the 11 core sales/delivery pages, mechanically fixing radius/pill hardcodes left over from before the `Card`/`Button`/`Badge` primitive updates (Phases 30-31 covered colors and the primitives themselves, not every page's custom `<div>` containers). No logic, data fetching, or i18n keys changed except where noted.

- **`jobs/index.tsx`**: already had the target header; fixed the filter-pill wrapper (`rounded-xl`→`rounded-full`, buttons `rounded-lg`→`rounded-full`), the empty state (`rounded-2xl`→`rounded-[var(--radius)]`, added `border-dashed`), the list container, the loading skeletons, and the `Stat` tile — all `rounded-xl`/`rounded-2xl`→`rounded-[var(--radius)]`.
- **`jobs/[id].tsx`**: header already matched the icon/extrabold pattern. Swept all 12 `rounded-2xl` occurrences (section cards, milestone rows, empty states) to `rounded-[var(--radius)]`, the tab strip to `rounded-full`/pill buttons, and the `Kpi` tile + loading skeletons to the token radius.
- **`jobs/setup.tsx`**: header already matched. Fixed the summary-strip tiles, the AI-proposal banner, the schedule/budget section cards, and the sticky footer bar (`rounded-xl`/`rounded-2xl`→`rounded-[var(--radius)]`); the per-milestone edit row (a nested element) moved to `rounded-[var(--radius-sm)]`.
- **`quotes/index.tsx`**: was the plainest page in the set — bumped the header from a small `text-xl` label to the standard `text-3xl font-extrabold` + `FileText` icon + `text-slate-500` subtitle, added a primary "New Quote" action button (reusing the existing `dashboard.quotesList.createFirstQuote` string, no new i18n key), and fixed the empty-state radius (`rounded-lg`→`rounded-[var(--radius)]`). Kept the compact row-`Card` list style since it's already correct via the `Card` primitive.
- **`quotes/[id].tsx`** (~2400 lines, the full quote editor): scope was limited to page chrome per plan — updated the `<h1>` to the `text-2xl md:text-3xl font-extrabold` + `FileText` icon pattern used by the other detail pages. The editor body already uses the `Card` primitive (correct radius) for its outer panels; nested inline elements (chapter rows, plan-comparison tiles, table wrappers) were left untouched as out of scope for a presentation pass on a page this size.
- **`invoices.tsx`**: header already matched. Fixed the filter-pill wrapper/buttons to `rounded-full`, and all `rounded-xl`/`rounded-2xl` main containers (gated-plan banner, empty state, list container, `Stat` tile, `Aging` section, loading skeletons) to `rounded-[var(--radius)]`.
- **`invoices/[id].tsx`**: header already matched. Mechanically swept every `rounded-2xl`/`rounded-xl` in the file (KPI tiles, scheduled/auto-send/void banners, document/sidebar section cards, draft editor card) to `rounded-[var(--radius)]`.
- **`contracts/index.tsx`**: header already matched. Fixed the filter-pill wrapper/buttons to `rounded-full`, and the loading skeletons, empty state, list container, and `Stat` tile to `rounded-[var(--radius)]`.
- **`contracts/[id].tsx`**: header already matched; body is mostly `Card` primitives (already correct). Fixed the loading skeleton, not-found state, progress-step tiles (→ `rounded-[var(--radius-sm)]` as nested elements), the declined-reason banner, and the draft-editing hint banner.
- **`clients/index.tsx`**: this page (and `clients/[name].tsx`) predates the i18n rollout and still has plain English copy — left as-is rather than adding translation keys out of scope. Updated the `<h1>` to the standard extrabold + `Users` icon + `text-slate-500` subtitle pattern; the rest already uses `Card` (correct radius) and `rounded-full` avatars.
- **`clients/[name].tsx`**: bumped the `<h1>` to `font-extrabold text-slate-900` for consistency with the list page. Fixed the per-quote status chip to reuse the `--qa-purple`/`--qa-purple-t` tokens for "unlocked" (matching `quotes/index.tsx`'s `StatusBadge`) instead of a one-off `navy-100`/`navy-700` pair — same status, same color everywhere now. `Card`-based summary tiles were already correct.

Verification: `npm run typecheck` (tsc, no emit) is clean. No dev-server visual check — same environment limitation as prior dashboard-only phases (backend `/api/*` proxy unreachable here).
