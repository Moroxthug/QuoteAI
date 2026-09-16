# QuoteAI visual redesign — design system reference

**Status**: Phases 30-31 built & pushed (2026-09-16). Supersedes `docs/HOMEPAGE-DESIGN-PLAN.md`'s palette/radius recommendations — see the note at the top of that file. Numbered as Phase 30 onward (not 29 — Phase 29 was already used by Google Local Services Ads lead capture, see `docs/EDGE-FEATURES-PLAN.md`). Each remaining phase is intended to run as its own conversation.

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

## What's NOT done yet

Each of these is meant to be its own conversation/phase, per the user's request:

- **Phase 32**: dashboard shell (`dashboard-layout.tsx`) — sidebar rail-collapse animation, grouped nav labels, topbar search/notifications restyle.
- **Phase 33**: marketing homepage + `public-layout.tsx` — mega-menu, hero word-reveal, animated count-up stats, story-split restyle.
- **Phase 34**: per-page dashboard visual pass, including rebuilding Leads (`leads/index.tsx`) as a kanban board.

Starting a new phase: read this file plus `[[deploy-workflow]]`'s conventions (typecheck, `preview_start` + Browser-pane visual check, auto-push) — no migrations are involved in any of these, this is frontend-only.
