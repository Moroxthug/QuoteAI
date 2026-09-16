# QuoteAI pixel-accurate redesign — plan v2 (supersedes the Phase 30-37 approach)

**Status: planning only, nothing in this doc is built yet.**

## Why this doc exists

Phases 30-37 (see `docs/DESIGN-SYSTEM.md`) treated the two user-supplied mockups as a *palette and radius* reference: navy/Figtree/pill tokens were layered onto the existing shadcn + Tailwind component set, and pages got a mechanical `rounded-xl` → `rounded-[var(--radius)]` sweep. That was a misread of the ask.

The mockups (now saved permanently at `docs/mockups/homepage-mockup.html` and `docs/mockups/dashboard-mockup.html` — previously they only existed as pasted chat content and were lost between conversations, which is why Phase 33 had to work from a written description) are **complete, self-contained design systems**: real CSS custom classes (`.card`, `.chip-*`, `.tgl`, `.seg`, `.kan-col`, `.pill`, `.sb-link`, `.bubble`, `.tbl`, `.stat-card`, `.form-grid`/`.field`, `.dropzone`, `.mega-card`, `.tile`, etc.), exact spacing/shadow/radius values, and exact page structure. The instruction is to make the real app **visually identical** to these two files — same DOM shape, same classes, same spacing — with QuoteAI's real data and backend wired in, and to treat these two files as the component library for anything new going forward. Logo is the one deliberate exception (keep the current one).

## Two decisions locked in for this rebuild (confirmed with user 2026-09-16)

1. **No dark mode.** Both mockups are light-only. Dark mode (ThemeProvider, `theme-toggle.tsx`, every `dark:` Tailwind variant) is being removed, not extended.
2. **Verbatim CSS, not a Tailwind translation.** The mockups' own `:root` tokens and component classes get ported into the app as real CSS (new stylesheet, imported once) and pages are rebuilt to use those exact classes. Tailwind stays only for layout utilities (flex/grid/gap) where the mockup doesn't define its own layout class. Existing shadcn primitives (`button.tsx`, `badge.tsx`, `card.tsx`, etc.) are superseded wherever the mockup has a direct equivalent — this is a deliberate move away from "shadcn + tokens" toward "the mockup's own system."

## Source-of-truth files

- `docs/mockups/homepage-mockup.html` — marketing site (announcement bar, mega-menu header, hero, 4-tile product grid, 3 alternating story splits, navy impact-stats band, 3-card newsroom, image-bg trial CTA, 5-column footer).
- `docs/mockups/dashboard-mockup.html` — full app shell + every dashboard view as a single-page mock with view-switching JS (sidebar with 4 grouped sections + bottom notifications/user, topbar with search/support/bell/avatar, and markup for: dashboard home, quotes, clients, leads (kanban), contracts, jobs, team, assistant (chat), analytics, price list, invoices, archive, import, settings (stacked cards, no tabs), notifications (full page)).

Read the relevant mockup file directly (not this doc's prose) before touching a page in any phase — the exact class names and structure live there.

## Gaps the mockup exposes that the current app doesn't have

- **Settings is currently tabbed** (`settings.tsx` + `settings-business-tab.tsx` + `settings-security-tab.tsx`). The mockup's settings view is one continuous stack of cards (Business profile / Branding / Quote defaults / Notifications / Billing & plan / Security), no tabs at all. Phase 45 needs to decide whether to flatten to match, or keep tabs as an intentional, documented exception (settings has grown larger than the mockup's version).
- **Archive and a full-page Notifications view don't exist yet** (`App.tsx` has no route for either; notifications today is only the topbar bell popover). Building these as more than static shells means real backend concepts (a soft-delete/archive table, a notifications feed). Phase 47 flags this explicitly rather than quietly building fake UI.
- **Documents, Profile, Onboarding, and the Billing page have no literal mockup section** — apply the shared vocabulary (`.card`, `.form-grid`/`.field`, `.dropzone`, `.chip`, `.set-row`/`.tgl`) consistently even without a 1:1 template, per the "use the elements in these two files" instruction.

## Phase plan (each phase its own conversation, per established convention; numbering continues from 37)

- **Phase 38 — Foundation.** Port both mockups' `:root` tokens (union of both files' variables) and base/global classes (`.btn*`, `.chip*`, `.cta-link`, typography resets) into a new stylesheet, imported app-wide. Strip dark mode (ThemeProvider, `theme-toggle.tsx`, `dark:` variants — flag any large/risky removals rather than doing a blind mechanical strip). Establish the interop rule (mockup classes for componentry, Tailwind for layout only) so every later phase follows the same convention.
- **Phase 39 — Dashboard shell.** Rebuild `dashboard-layout.tsx` to literally match `.sidebar`/`.sb-*` (rail-collapse animation, grouped nav, PRO badges wired to real plan gating, bottom notifications+user block) and `.topbar`/`.search`/`.bell*`/`.pop` (popover, avatar initials), including the mobile scrim+slide-in behavior.
- **Phase 40 — Dashboard home.** `dashboard/index.tsx`: page-head + sliding-thumb `.seg` period control, `.composer` AI input card, `.stat-grid`, `.mid-grid` (recent quotes list + revenue bar chart + follow-ups card), `.qa-grid` quick actions — all wired to real data/mutations, structure ported verbatim.
- **Phase 41 — Quotes, Clients, Leads.** `.card`+`.toolbar`/`.pills`+`.tbl` for quotes/clients; leads kanban (already structurally a kanban since Phase 34) re-skinned to `.kanban`/`.kan-col`/`.kan-card`.
- **Phase 42 — Contracts, Jobs, Team.** Pill-filtered `.tbl`s, `.pbar` progress cells, role `.chip-*`s.
- **Phase 43 — Invoices, Analytics, Price list (catalog).** Stat-grid + tall bar chart + `.hbar` breakdown + top-clients table; catalog table with margin chip.
- **Phase 44 — Assistant.** `.chat-grid` (thread list + `.bubble` chat + suggestion `.pill`s + `.chat-in`), wired to the real assistant backend.
- **Phase 45 — Settings, Billing, Team permissions, Profile.** Resolve the tabs-vs-stack gap noted above; port `.form-grid`/`.field`/`.set-row`/`.tgl`/`.logo-drop` for the rest.
- **Phase 46 — Documents, Onboarding, Imports.** Import page gets the exact `.steps-3` + `.src-grid` + `.dropzone` port; Documents/Onboarding get the shared vocabulary applied by extension.
- **Phase 47 — Notifications page & Archive (needs a scope decision).** These don't exist as routes today. Before building, decide with the user whether this phase includes the real backend (soft-delete/archive, a notifications feed) or is deferred/dropped.
- **Phase 48 — Homepage.** `public-layout.tsx` + `home.tsx`: announcement bar, mega-menu header, hero, 4-tile product grid, 3 story splits, impact stats band, newsroom, trial CTA, 5-column footer — literal port, real copy/data (existing trades, testimonials, blog posts) filling the structure.
- **Phase 49 — Cleanup pass.** Remove now-dead Phase 30-37 Tailwind approximations and unused shadcn variants app-wide, confirm every page only uses the new stylesheet + layout-only Tailwind, typecheck, and rewrite `docs/DESIGN-SYSTEM.md` to describe the final, actually-shipped system instead of the superseded one.

## Verification note (carried over from Phases 34-37)

This environment's dev server backend (`/api/*`) is unreachable, so authenticated dashboard pages can't be visually checked live in the Browser pane. The homepage (Phase 48) *can* be checked live since it needs no auth — do a real visual diff against `docs/mockups/homepage-mockup.html` there. Dashboard phases rely on typecheck + careful code review against the mockup's markup.
