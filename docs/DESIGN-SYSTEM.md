# QuoteAI visual design system (current, post Phase 49 cleanup)

**Source of truth for the visual system.** This describes what actually shipped from the pixel-redesign effort (`docs/PIXEL-REDESIGN-PLAN.md`, Phases 38-49). An earlier approach (Phases 30-37: navy/Figtree tokens + `rounded-[var(--radius)]` layered onto shadcn primitives) was tried first and superseded — it's purely historical now; see `docs/PIXEL-REDESIGN-PLAN.md` for that history. Do not treat that older approach as current guidance.

## The approach

The two mockup files supplied by the user are the real component library, not a palette reference:

- `docs/mockups/homepage-mockup-v2.html` — **current homepage source of truth.** Announcement bar, mega-menu header, dark hero with a `.doc-mock` receipt visual, 6-tile product grid, 3 alternating story splits, embedded WhatsApp section, comparison table, navy impact-stats band, newsroom, reviews, guides, trades marquee, deep-dive essay section, trial CTA, 6-column footer.
- `docs/mockups/homepage-mockup.html` — the original (v1) mockup. Kept for history; several of its component classes (`.tile`, `.split`, `.news-card`) carried forward unchanged into v2.
- `docs/mockups/dashboard-mockup.html` — full dashboard app shell + every dashboard view as a single-page mock (sidebar, topbar, dashboard home, quotes, clients, leads kanban, contracts, jobs, team, assistant chat, analytics, price list, invoices, archive, import, settings, notifications).

Their own CSS was ported **verbatim** — real custom classes, exact spacing/shadow/radius values, exact DOM shape — into `artifacts/quote-ai/src/mockup-system.css`, which is `@import`-ed once from `src/index.css`. **Tailwind is used only for layout utilities** (flex/grid/gap, spacing) where the mockup doesn't define its own layout class; it is not used to approximate componentry. Existing shadcn primitives are superseded wherever a mockup class covers the same thing (buttons, cards, badges/chips, tabs/segmented controls, switches).

**No dark mode.** Both mockups are light-only; `ThemeProvider`, `theme-toggle.tsx`, and every `dark:` Tailwind variant were removed in Phase 38 and confirmed absent as of the Phase 49 cleanup (a grep for `dark:` across `src/` turns up nothing except an unrelated internal object key in `ui/chart.tsx` that predates a `.dark` class ever being applied, and prop values literally named `"dark"` for a footer color variant — neither is a real dark-mode remnant).

## Tokens

### `mockup-system.css` `:root` tokens (the mockups' own tokens, used by every mockup-vocabulary class)

| Token | Value | Notes |
|---|---|---|
| `--navy` / `--navy-hover` | `#101031` / `#24244a` | Primary brand color + hover state. |
| `--ink` / `--muted-mk` / `--faint` | `#393a3d` / `#6b6c72` / `#8f9198` | Body text / secondary text / tertiary text. |
| `--line` / `--soft` / `--soft-2` | `#dfe1e6` / `#f4f5f7` / `#eceef2` | Border / light fill / slightly darker fill. |
| `--green` / `--green-dark` / `--green-t` | `#2ca01c` / `#1f7d12` / `#e9f6e6` | Success / "won" / positive chip + toggle-on color. |
| `--teal` / `--teal-dark` / `--teal-t` | `#0f97a2` / `#0b7c86` / `#e3f5f4` | "Sent"/in-progress chip. |
| `--purple` / `--purple-dark` / `--purple-t` | `#6c2bd9` / `#5a21bd` / `#eeecfc` | "Owner" role chip, one mega-menu tile color. |
| `--yellow` / `--yellow-t` / `--yellow-dark` | `#ffe01b` / `#fdf6c9` / `#7a5c00` | "Draft"/pending/due chip. |
| `--red` / `--red-t` | `#d9480f` / `#fdeee5` | "Overdue"/error chip. |
| `--radius-mk` | `18px` | The mockups' own card radius. |
| `--font-mk` | `'Figtree', -apple-system, ...` | Loaded via Google Fonts `@import` in `index.css`. |
| `--ease-mk` | `cubic-bezier(.2,.7,.2,1)` | Standard motion easing used across the mockup vocabulary. |
| `--shadow-lift` / `--shadow-card` | `0 24px 48px rgba(16,16,49,.16)` / `0 14px 34px rgba(16,16,49,.10)` | Hover-lift shadow / resting card shadow. |

### `index.css` tokens still in active use

- `--qa-navy`/`--qa-green`/`--qa-teal`/`--qa-purple`/`--qa-yellow`/`--qa-red`/`--qa-grey-t` (+ `-t`/`-dark` variants) — the shadcn-era chip token set. Still referenced by `badge.tsx`'s `chip-*` variants and directly by several dashboard components (`jobs/badges.tsx`, `jobs/gantt.tsx`, `clients/[name].tsx`, `contracts/[id].tsx`), so it stays alongside `mockup-system.css`'s own (differently-named) chip tokens rather than being a leftover duplicate.
- `--grad-from`/`--grad-mid`/`--grad-to` (navy gradient) — still powers `.gradient-text`/`.btn-gradient`/`.btn-gradient-outline`, which remain in real use on pages not yet migrated to the mockup vocabulary (blog, SEO profession/city pages, sign-in/sign-up, admin) — see "Known scope boundary" below.
- `--color-navy-50…950` / `--color-teal-50…950` Tailwind color scales (defined in `index.css`'s `@theme inline` block) — still referenced across ~57 files for accent/hover/status colors on pages outside the mockup-covered set. Kept.

## Component class vocabulary (`mockup-system.css`)

Read `mockup-system.css` directly for the full, exact rule set — it's organized in the same phase-by-phase sections as `docs/PIXEL-REDESIGN-PLAN.md` (Phase 38 foundation → Phase 48e homepage v2). Summary by area:

- **Foundation**: `.wrap`, `.eyebrow`, `.sec-title`/`.sec-sub`, `.cta-link`, `.chev`, `.btn`/`.btn-navy`/`.btn-white`/`.btn-outline-light`/`.btn-outline-navy`/`.btn-sm`, `.chip`/`.chip-green`/`.chip-teal`/`.chip-yellow`/`.chip-grey`/`.chip-red`/`.chip-purple`/`.chip-new`.
- **Dashboard shell**: `.app`/`.app.rail`, `.sidebar`/`.sb-*` (top, mark, logo, collapse, new, group, link, txt, bottom, user, avatar, userinfo), `.badge-pro`, `.count-chip`, `.scrim`, `.main`, `.topbar`/`.tb-*`, `.search`, `.bell*`, `.pop`/`.pop-row`/`.pop-foot`, `.n-row`/`.n-dot` (notifications), `.content`.
- **Dashboard home**: `.page-head`, `.head-actions`, `.card`/`.card-head`/`.card-foot`/`.stack`, `.stat-grid`/`.stat-card`, `.seg`/`.seg-b`/`.seg-thumb` (segmented period control), `.composer`/`.comp-*` (AI input bar), `.mid-grid`, `.q-row`/`.q-ic`/`.q-body` (recent quotes), `.bars`/`.bar`/`.bar-x` (revenue chart), `.fu-row` (follow-ups), `.qa-grid`/`.qa`/`.qa-ic` (quick actions).
- **Quotes/Clients/Leads**: `.toolbar`, `.pills`/`.pill`, `.tbl-wrap`/`table.tbl` + `.t-strong`/`.t-sub`/`.t-amt`/`.cell-ic`/`.avat`/`.cell-flex`, `.kanban`/`.kan-col`/`.kan-head`/`.kan-card`/`.kan-foot`.
- **Contracts/Jobs/Team**: `.pbar` (progress bar).
- **Invoices/Analytics/Price list**: `.search.sm`, `.bars.tall`, `.hbar-row`/`.hbar-top`/`.hbar` (horizontal breakdown bars), `.split-2`.
- **Assistant**: `.chat-grid`, `.th-list`/`.th-row`/`.th-empty` (thread list), `.chat-head`/`.chat-av`/`.chat-clear`, `.chat-body`, `.bubble`/`.bubble.user`/`.bubble.ai`/`.bubble.typing`, `.chat-sug`, `.chat-in`, `.prop-card`/`.prop-head`/`.prop-ic`/`.prop-kind`/`.prop-summary`/`.prop-detail`/`.prop-actions`/`.prop-dismiss`/`.prop-status` (AI action-proposal cards).
- **Settings/Billing/Team/Profile**: `.form-grid`/`.field`, `.set-row`, `.tgl`/`.tgl.on` (toggle switch — wrapped by `components/ui/mockup-toggle.tsx`), `.logo-drop`/`.logo-tile`.
- **Import/Documents/Onboarding**: `.steps-3`/`.step-card`/`.step-num`, `.src-grid`/`.src`/`.src.on`, `.dropzone`.
- **Modals (Phase 60)**: `.modal-scrim`, `.modal` (+ `.sm`/`.lg`/`.xl`/`.xxl`/`.tall`/`.cmd`), `.modal-x`, `.modal-head` (`h2` + `.sub`), `.modal-body` (+ `.flush`; `.form-grid` inside gets `.cols-3`/`.one`/`.narrow-2`), `.modal-foot`; bottom-sheet at ≤640px. Emitted by `components/ui/dialog.tsx` / `alert-dialog.tsx` / `command.tsx` — never hand-write the shell, use `<Dialog><DialogContent size><DialogHeader/><DialogBody/><DialogFooter/></DialogContent></Dialog>`. Companions: `.btn-green`/`.btn-red`, `.chk-row`, `.quote-box`, `.copy-row`, `.money-box`, `.receipt-split`/`.receipt-frame`/`.ai-read`, `.li-head.cols-5`/`.li-row.cols-5`/`.li-sum`, `.plan-grid`/`.plan-opt`/`.or-rule`, `.cmd-in`/`.cmd-list`/`.cmd-item`/`.cmd-empty`/`.kbd`.
- **Homepage v2**: `.sec`/`.sec.soft`/`.sec-head`/`.h2`/`.lead`, `.annc` (announcement bar), `.site-head`/`.hd`/`.nav`/`.nav-link`/`.has-mega`/`.mega`/`.mega-card`/`.mc-*` (mega menu), `.mnav` (mobile nav), `.hero`/`.hero-grid`/`.hero-cta`/`.hero-note`/`.doc-mock`/`.dm-*` (hero + receipt visual), `.tiles`/`.tile`/`.t-*`/`.also` (product tiles), `.split`/`.split.rev`/`.split-body`/`.split-media`/`.steps3`/`.step` (story splits), `.cmp-wrap`/`table.cmp` (comparison table), `.impact`/`.impact .stat-grid`/`.impact .stat` (impact band — deliberately scoped under `.impact` so it doesn't collide with the dashboard's own `.stat-grid`), `.news-grid`/`.news-card`/`.news-media`/`.news-body` (newsroom, reused by guides), `.rev-grid`/`.rev-card`/`.stars`/`.rev-quote`/`.rev-who`/`.rav` (reviews), `.marquee`/`.mq-track`/`.wm` (trades ticker), `.dd-feats`/`.dd-feat`/`.dd-grid`/`.dd-card` (deep-dive essay), `.cta`/`.cta-bg`/`.cta-in` (trial CTA band), `.footer`/`.ft-grid`/`.ft-brand`/`.ft-col`/`.ft-fine`/`.ft-bottom`/`.ft-legal`/`.locale` (footer).

## shadcn `components/ui/*.tsx` — active vs removed

Phase 49 audited all 56 files against real usage (grep for imports from `pages/`/`components/` outside the `ui/` folder itself, cross-checked against `ui/*.tsx` internal references). **33 files had zero real usages and were deleted**: `accordion`, `alert` (component, not `alert-dialog`), `aspect-ratio`, `avatar`, `breadcrumb`, `button-group`, `calendar`, `carousel`, `chart`, `checkbox`, `collapsible`, `context-menu`, `drawer`, `empty`, `field`, `hover-card`, `input-group`, `input-otp`, `item`, `kbd`, `menubar`, `navigation-menu`, `pagination`, `progress`, `radio-group`, `resizable`, `scroll-area`, `separator`, `sheet`, `sidebar` (the dashboard shell uses the mockup's own `.sidebar`/`.sb-*` classes directly, not this primitive), `slider`, `sonner` (toasts use the older `toast.tsx`/`toaster.tsx`/`use-toast` stack, not this Sonner wrapper — the `sonner` npm package has no other consumer), `spinner`, `table` (dashboard tables use `table.tbl` markup directly), `tabs` (dashboard tab/segment UIs use `.pills`/`.pill` or `.seg` instead), `toggle`, `toggle-group`.

**19 files remain in active use**: `alert-dialog`, `badge` (including the `chip-*` variants), `button`, `card`, `command` (cmdk-based quick search), `dialog`, `dropdown-menu`, `form`, `input`, `label`, `mockup-toggle` (wraps `.tgl`/`.tgl.on`), `popover`, `select`, `skeleton`, `switch`, `textarea`, `toast`, `toaster`, `tooltip`. Since Phase 60, `dialog`, `alert-dialog` and `command` are Radix wrappers that emit the locked `.modal*`/`.cmd-*` classes (like `mockup-toggle`), not shadcn styling; `button`/`input`/`label`/`textarea`/`select` are no longer used inside any dialog.

Two dead `cva()` variant options were also pruned from surviving files (verified zero usages via grep before removal):
- `button.tsx`'s `buttonVariants`: removed the `link` variant and the `lg` size (never passed as a prop anywhere in the codebase).
- `badge.tsx`'s `badgeVariants`: removed the `destructive` variant (every `<Badge>` in the codebase uses `default`, `outline`, `secondary`, or one of the `chip-*` variants).

`index.css` also had several fully dead Phase-30-era utility classes and keyframes removed in the same pass (zero usages anywhere in `src/`): `.gradient-border`, `.pro-pulse`/`@keyframes pro-glow`, `.quote-row`, `.logo-glow`/`@keyframes logo-glow`, `.hero-3d-stage`/`.hero-doc`/`.hero-doc-layer`/`.hero-float-chip`/`.hero-grid-bg` (the old 3D hero stage), `.ai-bar-glow`/`@keyframes soft-pulse-glow`, `.hero-sheen`/`@keyframes hero-sheen-sweep`, `.crm-nav-active`, `.bar-grow-in`, `.mega-menu-panel`/`@keyframes mega-menu-in`, and the entire mesh-gradient blob section (`.mesh-blob`/`.mesh-blob-1/2/3`/`@keyframes blob-1/2/3`) — all superseded by Phase 48c-48d's move to plain, professional, non-"AI-mascot" styling (see `[[feedback-professional-visual-design]]`). `--color-navy-*`/`--color-teal-*` scales and the `--qa-*`/`--grad-*` tokens were checked too and are still genuinely referenced (see Tokens section above), so they were kept.

## Known scope boundary — not everything is on the mockup system yet

Phases 38-48e covered the dashboard app shell + every dashboard page, plus the homepage (`home.tsx` + `public-layout.tsx` + `testimonials-section.tsx` + `stats-bar.tsx`). They did **not** cover: auth pages (`sign-in.tsx`/`sign-up.tsx`), the WhatsApp feature page, the blog, SEO profession/city landing pages, legal/company pages, public transactional pages (`/p/:id`, `/i/:token`, etc.), or `admin.tsx`. Those pages still legitimately use the older `gradient-text`/`btn-gradient`/`card-soft` Tailwind-era classes in `index.css` — this is expected, not a miss, per the site-wide rollout plan (Phases 50-55, proposed but not started) documented in `docs/PIXEL-REDESIGN-PLAN.md`. Do not "fix" those pages onto the mockup vocabulary piecemeal outside of their own dedicated phase — each phase in that plan is meant to be its own conversation with its own live/visual verification pass.

Within the mockup-covered pages, Phase 49 additionally found and fixed two clear misses of old-style `bg-card rounded-2xl border border-border shadow-sm` Tailwind "card soup" that duplicated the `.card` class on the same element: the AI quote-creation wizard (`pages/dashboard/new.tsx`, its `ClientSelector` panel, target-amount bar, and AI input card) and its manual quote builder (`components/manual-quote-builder.tsx`, 6 section cards). Both now use `.card` directly.

## Verification

`pnpm run typecheck` (`tsc -p tsconfig.json --noEmit`) is the standard gate for a presentation-only pass — clean as of this cleanup. The homepage can be verified live in the Browser pane (no auth required); dashboard pages generally cannot be, in environments where the dev server's backend `/api/*` proxy is unreachable — rely on typecheck + careful code review against `mockup-system.css`/the mockup files in that case, per the note carried in `docs/PIXEL-REDESIGN-PLAN.md`.
