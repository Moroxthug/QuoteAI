# QuoteAI — Calm mobile, a real Settings, and the app stores (Phases 100-118)

Written 2026-09-26. Two tracks, in this order:

- **Track A — Calm mobile (Phases 100-113).** Includes a full rebuild of **Settings and Integrations on desktop and phone** (102-103). The phone experience rebuilt around one idea: *open a screen, see the thing, do the one obvious action.* Nothing here is a new feature; it is the same product arranged for a 375 px screen and a thumb.
- **Tracks B and C — The app and the videos (Phases 114-131), planned in `APP-PLAN.md`.** QuoteAI on Google Play and the App Store, built from the same React code with Capacitor, **with no Mac and no Apple device required to build** (cloud macOS builds). One iPhone to test on is still strongly advised.

Track B starts after Track A's navigation, Settings/Integrations and core screens (100-106) — an app store listing of today's mobile layout would be the "messy" version with an icon.

Same conventions as every plan before: one phase per conversation, in order, one commit per phase pushed to `main` (auto-deploys), a build-log entry at the bottom of this file, a runbook section when behaviour changes, `qa:visual` before calling it done. **Every phase in Track A also ships the phone contact sheets** (§A.4) for the screens it touched, before and after.

---

## Status

| Phase | Title | Track | State |
|---|---|---|---|
| 100 | Mobile foundation: rules, primitives, the phone check | A | **done** 2026-09-26 |
| 101 | Navigation: bottom tabs, the More sheet, one New button | A | **done** 2026-09-26 |
| 102 | Settings, rebuilt (desktop and phone) | A | **done** 2026-09-26 |
| 103 | Integrations: an app directory with real logos | A | **done** 2026-09-26 |
| 104 | Today (dashboard home) | A | **done** 2026-09-26 |
| 105 | Quotes: list, new quote, quote detail | A | **done** 2026-09-27 |
| 106 | Jobs: list and the job page | A | **done** 2026-09-27 |
| 107 | Money and people: invoices, clients, leads, contracts | A | **done** 2026-09-27 |
| 108 | The crew app and the foreman | A | not started |
| 109 | Schedule on a phone | A | not started |
| 110 | The long tail | A | not started |
| 111 | What clients see: accept, sign, pay, portal, sign-up | A | not started |
| 112 | The public site on a phone | A | not started |
| 113 | The phone gate: rules enforced, sheets reviewed | A | not started |
| 114-131 | The app and the videos | B, C | see `APP-PLAN.md` |

---

## A.1 What the phone looks like today (audit, 2026-09-26)

`qa:visual -- --lang=en --widths=375` over 106 pages: **0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader blockers.** The machines are satisfied; the mess is design, not breakage. Every finding below was read off the screenshots (`artifacts/api-server/.qa/visual-mobile-audit/en/375/`).

**The one root cause:** the desktop layout is stacked into one column. Desktop has room for a toolbar, six stat cards and a table side by side; on a phone the same pieces become a tower, in desktop order, so the controls and numbers come *before* the thing the screen is for.

| Screen | What a contractor sees on the first phone screen | Height |
|---|---|---|
| Quote detail | Title, then **7 full-width buttons** (Edit, Regenerate, Download PDF, Send by email, Copy link, Start CRM Project, Upgrade to Pro Spec). The quote itself starts on screen 2; its line items wrap to 8-line cells in a 3-column table. | 10½ screens |
| Job page | **5 full-width buttons** (Dictate, Photo, Edit plan, Put on hold, Mark complete), then 6 stat cards one per row. The tabs (Overview / Schedule / Changes…) appear on screen 2. | 6 screens |
| Dashboard home | Greeting, period switch, New quote, the AI box, then **stat cards one per row** (a whole card for "Unlocked: 1"), then crew, field reports, a full month calendar. | 5 screens |
| New quote | Mode tabs, **3 layout cards and a target amount first**; the "describe the job" box — the whole point — is at the bottom of screen 1 with its placeholder cut off. | 1½ |
| Quotes / Jobs / Clients lists | A desktop table in a scroll box: columns cut off on the right, filter pills wrapping to two lines, the button says "Create your quote in **60** seconds!" (the site says 30). | 1 |
| Schedule | A week grid with two visible days; the "drag to plan" instructions don't apply to a thumb. | 1 |
| Settings (phone) | **10 pill tabs wrapping to 4 rows** before any setting. | 2½ |
| Settings (desktop) | The same 10 pills on two rows, then long stacked cards with a Save button per card. "Business Account" and "Business" are two different tabs; the website widget appears both in Business Account and in its own tab. One 2,980-line page file. | — |
| Integrations (desktop) | **4,847 px** of stacked cards in one column. Generic icons (a credit card, a bank, a building) instead of each company's logo; apps waiting on a partner get full-size cards with a warning; QuickBooks' whole account and tax-code mapping is inline, so connecting one app makes the page three screens longer. Elite-only, so Starter and Pro don't see it exists. | 6 screens |
| Crew app (`/t`) | Company picker, a "since you last looked" list, then Today — **Clock in is on screen 2**, the report form on screen 3. | 4½ |
| Homepage | A "Now on WhatsApp" banner (WhatsApp is not live), the chat bubble covering the fine print, four saturated full-colour product cards in a row. | **24 screens** |
| Every dashboard screen | No page title or logo in the top bar, and a **grey blurred smudge behind the menu icon** (a desktop element's shadow leaking through). ~20 sections behind one hamburger. | — |

## A.2 The rules ("calm mobile")

Written once in Phase 100 (`docs/MOBILE-RULES.md`), applied in every phase after, checked by machine where possible (§A.4).

1. **Content first.** The first phone screen shows the thing the page is about (the quote, the job, the list), not the controls around it.
2. **One primary action per screen**, in a sticky bottom bar within thumb reach. Everything else goes in a **⋯ action sheet**. Never more than two full-width buttons stacked anywhere.
3. **Numbers as a strip, not a tower.** Stat cards become a compact 2-column grid or a horizontal summary line; a card that holds one number is never full-width.
4. **Lists, not tables.** Under 640 px every table becomes a list of rows: a strong line (client / title), a quiet line (date · status), the amount on the right. No horizontal scrolling for data.
5. **Tabs scroll, they don't wrap.** One line of segmented tabs, sticky under the header; long option sets become a menu screen (settings).
6. **Progressive disclosure.** Options, filters and rarely-used fields sit behind "Options" / "Filter" and open as a bottom sheet.
7. **One accent at a time.** Navy for structure, one colour for status; no full-bleed colour blocks side by side on a phone.
8. **Space is the design.** 16 px gutters, 12 px between cards, 44 px targets, one type scale (title 22 / section 17 / body 15 / meta 13).
9. **The phone knows it's a phone.** Safe areas (notch, home bar), `inputmode`/`autocomplete` on every field, camera and microphone one tap away, the numeric keypad for money.
10. **Same code, same words.** No separate mobile app code path: the same components, laid out by breakpoint, so the Capacitor app (Track B) inherits all of it.

## A.3 Scope boundaries

- Desktop layout does not change except where a shared component has to (and then it must look the same or better at 1280) — **with two deliberate exceptions: Settings (102) and Integrations (103) are redesigned on desktop too**, at the owner's request.
- The mockup design system (`docs/mockups/*`, `mockup-system.css`) stays the vocabulary; Phase 100 adds the mobile pieces it never had (tab bar, action sheet, bottom sheet, list row, stat strip).
- No dark mode (decided in Phase 38), no new animations beyond a sheet sliding up, respects reduced motion.

## A.4 How "calm" is checked

The screenshots are the proof, so they get produced every time:

- **`qa:phone-sheets`** (Phase 100): for any set of routes, slices the 375 px full-page screenshots into phone frames and lays out the first three screens side by side (the script used for the audit above), plus a before/after pair when given a baseline folder. Each phase attaches its sheets to the build log.
- **New `qa:visual` phone rules** (warnings in 100, enforced in 113): at 375 px — more than two full-width buttons stacked; a `.stat-card` spanning the full width; a `<table>` wider than its container; tabs wrapping to a second line; page taller than N screens for app pages (budget per page, set in 113); the page's primary action not within the first screen or the sticky bar; anything under the bottom tab bar not reachable (padding for the bar).
- **A person looks.** The sheets exist so the owner can glance at them on a phone; that remains the real test (Phase 99 P-1 device pass, repeated after 113).

---

## Phase 100 — Mobile foundation: rules, primitives, the phone check

- `docs/MOBILE-RULES.md` (the rules above, with do/don't pictures from the audit).
- New components on the mockup vocabulary, each with a `/dashboard/__preview` fake-data story (the visual-redesign trick): `BottomTabBar`, `ActionSheet` (⋯ menu, bottom sheet on phone / dropdown on desktop), `BottomSheet` (filters, options, pickers), `StickyActionBar` (safe-area aware), `ListRow` + `ResponsiveTable` (table ≥ 640 px, rows below, one column definition), `StatStrip` (2-col grid / summary line), `ScrollTabs`, `MobilePageHeader` (back, title, ⋯).
- Top bar on phones: page title + back where there is a parent; the smudge fixed (find the element whose shadow leaks — likely the hidden search).
- CSS: safe-area variables, the type scale, spacing tokens; `viewport-fit=cover`.
- `qa:phone-sheets` and the phone rules as **warnings** in `qa:visual`.
- **Honesty fixes that can't wait** (15 minutes, from the pilot post review): the homepage "Now on WhatsApp" banner and the `/pilot` "WhatsApp quoting" line hidden until WhatsApp is configured (read the same feature flag the integration uses); `/pricing`'s "Annual billing is not set up on this server yet" replaced by showing monthly only until `STRIPE_PRICE_YEARLY_*` exist; "60 seconds" → "30 seconds".

## Phase 101 — Navigation: bottom tabs, the More sheet, one New button

- Under 980 px the hamburger drawer is replaced by a **bottom tab bar**, role-aware:
  - owner / office: **Today · Quotes · Jobs · Money · More**
  - foreman: **Today · Jobs · Schedule · Crew · More**
  - worker: the crew app (108), not the dashboard
- **More** opens a sheet grouping the other ~15 sections under four headings (Work, Money, Team, Business) with the notifications count and the account at the top. Plan-gated sections show their lock the same way the sidebar does.
- **New** (a centred button or the top-bar +): one sheet — New quote, New client, Log a cost (photo), New job note. The same sheet the app's long-press shortcut opens (APP-PLAN Phase 119).
- Scroll position and tab memory per section (Phase 84's scroll restoration extended); Android back and iOS swipe-back behave (history, not a trap).
- The drawer stays for 640-980 px tablets if the tab bar reads worse there — decide on the sheets.

## Phase 102 — Settings, rebuilt (desktop and phone)

Today: one 2,980-line page, ten pill tabs, stacked cards each with its own Save button, overlapping sections. Rebuilt as a proper settings area — the pattern people know from their phone's settings and from Stripe/Linear/Google account pages.

- **Structure** — sections with plain names, grouped:
  - *You*: Profile, Sign-in & security (2FA, sessions, export my data, delete account in a clearly separated danger zone)
  - *Business*: Company details (name, numbers, address, logo together), Documents & branding (PDF layout, colours, footer, terms), Taxes & province
  - *Selling*: Quote defaults & follow-ups (cadence, review delay), Website widget (one place, with the Test button)
  - *Messaging*: Email sender, SMS, WhatsApp
  - *Connected apps* → Phase 103
  - *Plan & billing*: plan, usage, invoices (hidden in the native apps, APP-PLAN Phase 118)
- **Desktop**: two panes — a grouped left list (icon, name, one-line status like "2FA on" or "Not set up") and the section on the right at a readable width (~720 px). Deep-linkable URLs `/dashboard/settings/<section>`; the old `?tab=` links redirect.
- **Phone**: the same left list *is* the first screen (a menu); a section opens as its own page with a back arrow.
- **One save model**: fields save on a **sticky "Unsaved changes — Discard / Save" bar** that appears only when something changed (no per-card Save buttons, no losing edits when switching sections — a "leave without saving?" prompt).
- **One form layout**: label and help on the left, field on the right on desktop; stacked on phones. Toggles as full-row switches. Each section starts with a one-sentence "what this controls".
- **Status at a glance**: the list shows what needs attention (a dot on "Company details" if the GST number is missing, on "Sign-in & security" if 2FA is off).
- **Duplicates removed**: widget in one place; "Business Account"/"Business" merged; plan comparison as cards with the current plan first (swipeable on phones).
- **Code**: `settings.tsx` split into one file per section with a shared `SettingsSection` / `SettingsRow` / `SaveBar`; every existing setting keeps its endpoint and permission check (`useCan`); the e2e and `qa:visual` settings routes updated to the new URLs.

## Phase 103 — Integrations: an app directory with real logos

Today: a 4,847 px column of cards with generic icons. Rebuilt as a directory, like the app marketplaces contractors already know.

- **Directory page**: a grid of tiles (3-4 across on desktop, 2 on phones), each with the company's **official logo**, the name, one line on what it does for you ("Send invoices to QuickBooks with the right tax codes") and a status pill — **Connected**, **Connect**, **Needs attention** (a sync error, an expired token), or **Coming soon**. Grouped:
  - *Accounting*: QuickBooks Online, Wave
  - *Calendar*: Google Calendar, Outlook Calendar, calendar feed (.ics)
  - *Email*: Gmail
  - *Messaging*: WhatsApp, SMS (Twilio)
  - *Payments & financing*: Stripe (card payments), Financeit
  - *Banking*: Flinks
  - *Leads*: Meta Lead Ads, Google Local Services
  - *Your website & developers*: the widget, API keys, webhooks
- **Connected apps first**, then available, then a small "Coming soon" row at the bottom (logo + name only, no warning boxes) for those waiting on a partner or not configured on the server — honest, and out of the way.
- **Detail view** (a side panel on desktop, a full page on phones): what it does, what data is shared (from the privacy policy's list), the **Connect** button, and once connected: account connected, last sync, a short sync log with Retry, the app's own settings (QuickBooks account and tax mapping, the calendar picker, WhatsApp number) — and **Disconnect** at the bottom, with a confirm.
- **Official logos, used by the rules**: SVGs taken from each company's own brand/press page into `public/brands/`, with a `BRANDS.md` noting the source, the date, and the rules (minimum size, clear space, no recolouring, no stretching). Where a company *requires* its own button — Intuit's "Connect to QuickBooks" button is required for QuickBooks app review, Google has sign-in/branding rules — use theirs exactly. A one-line trademark notice at the foot of the page ("QuickBooks is a trademark of Intuit Inc. …").
- **Plan gating made visible**: Starter and Pro see the directory with a lock on the apps their plan doesn't include (today the whole tab is hidden below Elite); the lock explains which plan adds it (no upgrade button in the native apps).
- **Search** across apps once there are more than ~12.

## Phase 104 — Today (dashboard home)

- First screen: greeting line, **"Needs you"** — one prioritised list merging what is today spread over cards (blocked on site, quotes waiting for reply, invoices overdue, hours to approve, follow-ups due), each row with its one action.
- The describe-a-job box stays, compact (one line that expands).
- KPIs as a `StatStrip` (quotes, won, outstanding, this period), the period switch in its ⋯.
- Crew today as a short list ("3 on site, 1 not clocked in"), the month calendar replaced by the next 5 things (agenda) with "Open schedule".

## Phase 105 — Quotes: list, new quote, quote detail

- **List**: `ListRow`s (client · title / date · status chip / amount), filters in a sheet with the active one shown as a single chip, search as a top field that stays.
- **New quote**: the describe box first (full width, multiline, mic and photo buttons inside it), client picker second, then "Options" (layout Standard/Professional/Elegant, target amount, trade) collapsed into one line summary "Standard · no target" that opens a sheet. Manual and Price list modes as `ScrollTabs`.
- **Quote detail**: the document first — client, total, status as a header card, then chapters as collapsible sections with **line items as rows** (description over two lines max, "qty × unit price" underneath, amount right). Sticky bar: **Send** (or the state-appropriate primary: Send / Copy link / Start job). Everything else (Edit, Regenerate, PDF, Copy link, Start project, Upgrade layout) in ⋯.
- The same for the manual editor: line editing in a bottom sheet per line instead of an inline grid.

## Phase 106 — Jobs: list and the job page

- **List** as rows: job · client / next milestone · progress bar / contract value.
- **Job page**: compact header (title, status, address as one tappable line to Maps, dates), **`StatStrip`** (contract, invoiced, costs, margin), then the tabs sticky. Sticky bar: **Photo** and **Dictate** (the two things you do standing in a kitchen). Edit plan, Put on hold, Mark complete, Archive in ⋯.
- Charts on phones: one chart at a time with a toggle, legends under, axis labels that fit (budget vs actual as horizontal bars with the numbers written on them).
- Change orders, photos, tasks, costs tabs reviewed for the rules (photo grid 3-up, tasks as checklist rows).

## Phase 107 — Money and people: invoices, clients, leads, contracts

- Invoices, clients, leads, contracts, documents lists as rows; invoice detail like the quote detail (document first, sticky **Send** / **Record payment**).
- Leads kanban on phones: one column at a time with a stage switcher (swipe between stages), not a horizontally scrolled board.
- Client page: contact actions as a row of icon buttons (call, text, email, map), then their jobs/quotes/invoices as tabs.
- Analytics: the few numbers that matter as a strip, charts one per screen with a picker.

## Phase 108 — The crew app and the foreman

- **`/t` (worker)**: the first screen is **Now**: the current or next shift card with **Clock in / out** as the big button, the job address one tap to Maps, the gate code. Below: today's tasks as a checklist. "Report from site", travel and per diem become actions in a sheet from a sticky bar (**Report** · **Photo**), not three always-open forms. "Since you last looked" collapses to a count chip. Company switcher moves into the header menu (only shown when there are two).
- **Foreman dashboard and job page** get the same treatment: who is where, blocked items first, approve hours as a swipe list.

## Phase 109 — Schedule on a phone

- Under 768 px the default is **Day agenda** (by person or by job, switchable), with week as a compact 7-day strip of dots at the top to jump; the drag grid stays for tablet/desktop.
- Add block as a bottom-sheet form (who, job, day, from-to) with sensible defaults (the job's crew, today, 7:00-15:30). Double-booking shown inline on the row.
- Copy for touch ("tap a day" instead of "drag on the board").

## Phase 110 — The long tail

- Every remaining screen against the rules, one pass each: books (bank, claims), pay, compliance, group, team (workers, time, equipment, members), catalog, imports, archive, notifications, assistant, documents.

## Phase 111 — What clients see: accept, sign, pay, portal, sign-up

- `/p` quote accept, `/sign`, `/i` invoice pay, the client portal and messages: these are opened by **the contractor's customers on their phones from an email** — the most-viewed phone screens in the product. Document first, one sticky primary (Accept / Sign / Pay), the OTP code field with `autocomplete="one-time-code"`, signature pad sized for a thumb.
- Sign-in, sign-up, onboarding steps and `/join`: one question per screen where it helps, keyboard types, no field hidden under the keyboard.

## Phase 112 — The public site on a phone

- Homepage from 24 screens to about 8: hero, the 30-second demo, three short proof blocks, one feature overview (a list, not four colour slabs), pricing teaser, FAQ, footer. The desktop keeps its length if it reads well there; phones get the condensed order (same components, `hidden` per breakpoint where needed).
- The support chat button stops covering content (inline "Questions?" link on phones, or offset above the fine print).
- Pricing: plans as a swipeable row with Pro in front; comparison table as a per-feature list. Pilot and province pages, help centre, blog article template checked against the rules.

## Phase 113 — The phone gate: rules enforced, sheets reviewed

- The `qa:visual` phone rules from 100 become errors (exit 1), with a per-page height budget.
- Full 375 px sweep EN + FR, all sheets generated into one review page the owner can open on a phone.
- The Phase 99 P-1 real-device pass repeated on the new design (owner), fixes from it.
- `docs/MOBILE-RULES.md` updated with anything the phases learned.

---

## Track B and Track C → `docs/APP-PLAN.md`

The app (Phases 114-126: designed first, instant, real-time sync and offline, the native shell, store releases without a Mac) and the video tutorials (Phases 127-131) are planned in [APP-PLAN.md](APP-PLAN.md). Track B starts after Phases 100-106 here.

---

## Build log

*(one entry per phase: date, built, found, deferred, verification with the phone sheets)*

### Phase 100 — 2026-09-26

**Built**
- `docs/MOBILE-RULES.md` — the ten rules, the component table, what the machine checks, how to make sheets; do/don't pictures in `docs/mobile-rules/`.
- `components/mobile/`: `BottomTabBar` (≤ 980 px, marks `<html class="has-tabbar">`), `ActionSheet` (dropdown on desktop / sheet of 52 px rows on phones), `BottomSheet` (on `.modal`, grab handle, safe area), `StickyActionBar` (docked above tab bar + home indicator, spacer, `data-primary-action`), `ListRow` + `ResponsiveTable` (one column definition, `mobile: title/meta/amount/end/hidden`), `StatStrip` (grid / `line`), `ScrollTabs`, `MobilePageHeader` + `useMobileHeader()`.
- Phone top bar on every dashboard page: ‹ back to the parent (`/dashboard/quotes/:id` → Quotes, `/dashboard/people/:id` → team members), the section title, the page's ⋯ when it registers actions. The tab title (`document.title`) now uses the same section lookup, which also names New quote / My profile / Plan & billing / Notifications.
- CSS "CALM MOBILE (Phase 100)" in `mockup-system.css`: safe-area, type-scale, spacing tokens; phones get 16 px gutters, 22 px page titles, 12 px card gaps; `viewport-fit=cover`; `.wrap` respects the side safe areas.
- `/dashboard/__preview` (dev server only, `src/dev/mobile-preview.tsx`): every primitive on fake data inside the real shell; swept by `qa:visual`.
- `qa:visual` phone rules as warnings (≤ 640 px): stacked-buttons, full-width-stat, wide-table, wrapping-tabs, tall-page (> 8 screens, app pages), primary-offscreen, under-tabbar — "Phone rules" section in report.md, `phone:` on the console line.
- `qa:phone-sheets` (`src/e2e/phone-sheets.ts`): first N phone frames side by side per route, before/after with `--baseline`, plus an `index.html` for a phone.
- Honesty fixes: new public `GET /api/whatsapp/available` (the same env check as Connect, allow-listed in the route-matrix test); the "Now on WhatsApp" bar and the pilot's "…and WhatsApp quoting" wait for it (a WhatsApp-free `pilot.give4NoWhatsapp` otherwise, also what the prerender shows). `/pricing` shows monthly only until annual prices exist — the greyed toggle and "not set up on this server" chip are gone, FAQ reworded. "60 seconds" → "30 seconds" everywhere (dashboard empty states, SEO hero CTA, mega-menu, WhatsApp page, SEO sector copy).

**Found**
- The grey smudge behind the phone menu icon was the **skip link's shadow**: parked above the viewport, its 48 px blur reached ~57 px down. The shadow now only exists while the link is focused.
- The phone rules' first read (34 pages, EN 375/1280): 14 pages warn — `/dashboard` and the job pages full-width stat cards, the job page 5 stacked buttons, `/dashboard/quotes` wide table + wrapping filter pills, every settings tab the wrapping pill row, `/pricing` and the homepage the comparison table (inside its deliberate scroller — Phase 112 turns it into a per-feature list), the calendar-picker settings state 8.0 screens. Exactly the audit's list; Phases 102-112 clear them.
- Git Bash rewrites a bare `/` argument, so `--routes==/` doesn't reach the script on this machine; `/fr` stands in for the homepage (or run from PowerShell).

**Deferred**
- Nothing wired into real pages beyond the top bar — that is 101 (tab bar + More sheet) onwards.
- `pnpm spell` was already failing before this phase (543 issues, mostly the word "whatsapp" and names); +1 from the new key id. Not touched here.

**Verification**
- `qa:visual --lang=en --widths=375,1280` over home/pilot/pricing/dashboard/quotes/jobs/settings/preview (34 pages) and `--lang=en,fr --widths=375,1280 --routes=/fr,__preview` (8 pages): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings, 0 raw keys; the preview page has no phone-rule warnings.
- Phone sheets: `.qa/phone-sheets/p100/` (17 routes, before = `visual-mobile-audit`), `.qa/phone-sheets/p100b/dashboard-preview.png`. Before/after on `/pricing`: the WhatsApp bar and the annual-billing chip gone; dashboard top bar: smudge gone, "Dashboard" title in.
- typecheck (quote-ai, api-server), eslint on the touched files, knip (nothing new), i18n-audit (0 hard failures), route-matrix test 12/12.

### Phase 101 — 2026-09-26

**Built**
- `components/layout/phone-nav.tsx`: at ≤ 980 px the sidebar is gone (`display: none`, no drawer, no ☰) and `PhoneTabBar` takes over — Today + the first three of the role's list that the plan shows + More. Owner / admin / office / viewer: Quotes · Jobs · Money (Money covers invoices, pay, books, compliance); a plan without jobs and invoices gets Clients · Leads. Foreman: Jobs · Schedule · Crew (team + people pages). Workers are not dashboard users (the `/t` crew app, Phase 108), so there is no worker set.
- **More** sheet: account row (→ My profile), Notifications with the unread count (also the More tab's badge), the company switcher when there are two or more, every other section under Work / Money / Team / Business with the sidebar's Pro badge, Company profile / Plan & billing, Sign out. The More tab is highlighted while you are on a section that has no tab.
- **+** in the top bar (not a centred tab: five tabs + New is six cells with no centre): New quote, New lead (`/dashboard/leads?new=1` opens the form, then drops the parameter), Photo of a receipt (pick an open job → the camera opens in the same tap → `POST /api/costs/receipts` → the job's Costs tab), Job note (pick a job → the Phase 78 Dictate sheet, now exported as `JobCaptureSheet`). Filtered by role; no + when a role can do none of it.
- Tab memory: each tab reopens its last screen (path + query, sessionStorage) at its last scroll position (`restoreScrollOnNextVisit` in Phase 84's scroll manager); tapping the tab you are in goes to its first screen, then to the top. Every move is a push, so Android Back / iOS swipe-back retrace your steps; an open sheet closes when the screen changes.
- Phone top bar (≤ 640 px): back · title · ⋯ · +, on 16 px gutters; the bell and the avatar moved into More. 641-980 px keeps search, bell and avatar beside the +. `BottomTabBar` gained `match`, `onTabClick`, `expanded`.
- `DialogContent` now returns focus to whatever opened it when there is no `<DialogTrigger>`. Radix only knows its own trigger, so every dialog opened from state — the new sheets, Phase 100's ActionSheet, most of the app's dialogs — dropped focus to `<body>` on close.
- `qa:visual`: the More / New sheet states (owner and foreman); the modal audit opens More and + instead of the old drawer and skips driven states; the gutter check ignores `.sr-only` text. Runbook §37 (support answers) and a navigation section in MOBILE-RULES.

**Decided**
- The tab bar also serves 641-980 px (tablets): at 768 it reads well (`.qa/p101/en/768/dashboard.png`), and one navigation model beats a drawer kept only for tablets.
- The plan's "New client" became **New lead**: clients are created from a quote (the Clients page's Add button already opens New quote); a lead is the standalone record.

**Found**
- The More sheet's scrolling body let its cards shrink (a flex column of `overflow: hidden` children): the Notifications card collapsed to a hairline. Children are `flex: none` now.
- French "Aujourd'hui" sat 11 px from the edge with 4 px tab-bar padding; 8 px now.

**Deferred**
- Android's hardware Back closing an open sheet without leaving the screen needs the native shell (APP-PLAN, Capacitor `backButton`); in a browser, Back leaves the screen and the sheet closes with it.
- The page-content phone warnings (wide tables, wrapping pills, full-width stats, the foreman home's stacked buttons) belong to Phases 104-110.

**Verification**
- `qa:visual --lang=en,fr --widths=375,768,1280` over /dashboard, the More / New sheet states, quotes, leads, invoices, jobs, schedule, team, me, __preview, as owner and foreman (102 pages): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings (More and + open, trap focus, and close back onto their trigger), 0 raw keys, no `under-tabbar` warnings.
- Phone sheets: `.qa/phone-sheets/p101/` (17 routes, before = `p100`): the ☰ gone, the tab bar in, + in the top bar.
- typecheck (quote-ai), eslint on the touched files, knip (nothing new), i18n-audit (0 hard failures).

### Phase 102 — 2026-09-26

**Built**
- `pages/dashboard/settings.tsx` (2,982 lines) and its three `settings-*-tab.tsx` siblings replaced by `pages/dashboard/settings/`: one file per section plus `index.tsx` (the list, routing, redirects, the leave prompt), `ui.tsx` (`SettingsSection` / `SettingsGroup` / `SettingsRow` / `ToggleRow` / `ActionRow`, `useSettingsDraft`, `SaveBar`) and `data.ts` (the typed business profile, one partial-PUT saver).
- Twelve sections at `/dashboard/settings/<section>` in five groups — **You**: Profile (summary → `/dashboard/me`), Sign-in & security (2FA, sessions, history, export, and deletion under a separate "Danger zone"); **Business**: Company details (name, numbers, licence, contact, logo together), Taxes & province, Invoices & payments (e-Transfer, default payment schedule, invoice automation); **Selling**: Quotes & follow-ups (cadences, accepted-quote email, review requests), Website widget (one place, with the Try-it button); **Messaging**: Email sender, SMS, WhatsApp; **Apps and plan**: Connected apps, Plan & billing (plan + usage + plan cards, current plan first, swiping on a phone).
- Wide screens: grouped list on the left (icon, name, one-line status, red dot for "2FA off", "phone or address missing", "province not set", "GST/HST number missing"), the section at ≤ 720 px on the right. Under 860 px the list is its own screen and a section opens as a page (‹ back and the section name in the top bar via `useMobileHeader`).
- **One save model**: each section keeps one draft; a sticky "Unsaved changes — Discard / Save" bar appears only while it differs (docked above the tab bar on phones), Save disabled while a field is invalid (cadence, URL, email — each says why). In-app links with edits pending open "Leave without saving?" (Keep editing / Discard / Save and leave); closing or reloading asks through `beforeunload`. Saves send only the changed fields (the endpoint merges `automationSettings`). The SMS switches, which used to save on every tap, joined the draft.
- Redirects: `?tab=account|business|billing|usage|integrations|whatsapp|sms|widget|security`, `/dashboard/settings/account` and `/dashboard/profile` (its page deleted — a duplicate of Company details) land on the new sections, other query params kept. Every internal link and the OAuth callbacks (QuickBooks, Wave, calendars, Gmail, Meta, LSA, Stripe Connect), the SMS notification link and the month-end checklist now point at the section directly.
- `PlanPicker currentFirst`; help-centre articles renamed to the new section names (EN/FR); 70 new EN/FR strings; runbook §38; a settings paragraph in MOBILE-RULES.
- `qa:visual`: all twelve sections, the list, the foreman's list and plan, the save bar, the leave prompt, the apps calendar picker. The stacked-buttons phone rule no longer counts `role="switch"` rows (a list, not actions).

**Decided**
- The plan's "Documents & branding (PDF layout, colours, footer, terms)" has no settings behind it yet — there is no PDF colour/footer/terms setting to move. The section became **Invoices & payments**, holding what exists; a real branding section waits for those settings.
- Section gates are the old tabs' gates, with two changes: Company details and the widget now need `settings:edit` (a team member used to see a form whose save came back 403), and Email sender / Connected apps open to Business as well as Elite (each card already admitted Business; only the tab was Elite-only). Phase 103 rebuilds Connected apps as the directory.
- Single-pane below 860 px (not 640): at 768 two panes leave the section ~490 px wide.
- Browser Back with unsaved edits is not intercepted (wouter has no navigation blocker); the draft is dropped. Links, the tab bar, ‹ back and closing the tab all ask.

**Found**
- The WhatsApp section's three example tiles were 4.39:1 (never swept before — the WhatsApp tab wasn't in the route list); now `--muted-mk`.
- In the narrower settings pane, "Switch to Business" overflowed its plan card; the buttons wrap there now.
- A first run showed an error boundary on three desktop pages: the Vite server hot-reloaded `ui.tsx` while I edited it mid-sweep. Clean on the rerun.

**Deferred**
- Profile is a summary with a link: the editing stays on `/dashboard/me` with the person's stats.
- Connected apps is still the long column (7.2 phone screens) — Phase 103.
- `/dashboard/pay?tab=settings` keeps its wide table / wrapping tabs warnings (Phase 107).
- Hiding Plan & billing in the native apps: APP-PLAN Phase 118.

**Verification**
- `qa:visual --lang=en,fr --widths=375,768,1280 --routes=settings` (114 pages): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings, 0 raw keys; phone-rule warnings only on `/dashboard/pay?tab=settings`. Plan page rechecked after the button fix (`.qa/p102-plan`).
- Phone sheets: `.qa/phone-sheets/p102/` (19 routes, before = `visual-mobile-audit`): the settings list 1.4 screens (was 2.6, ten wrapping pills); every section except Connected apps within 2.6 screens.
- typecheck (quote-ai, api-server), eslint on the touched files, knip (nothing new), i18n-audit (0 hard failures; the literals left are URL/number placeholders), route-matrix test 12/12.

### Phase 103 — 2026-09-26

**Built**
- `pages/dashboard/settings/apps.tsx` (1,772 lines, nine stacked cards) replaced by `pages/dashboard/settings/apps/`: `catalog.ts` (the 15 apps: group, logo, the plan feature that unlocks each, the OAuth return params), `status.ts` (one hook that turns every status endpoint and sync log into a pill), `ui.tsx` (`BrandLogo`, `StatusPill`, `LockNote`, `SyncLog`, `DisconnectRow` with a confirm, `AccountFacts`), the panels by group (`accounting.tsx`, `calendar.tsx`, `gmail.tsx`, `payments.tsx`, `leads.tsx`, `developer.tsx`) and `index.tsx` (the directory and the detail).
- **The directory**: tiles, 3 across on a wide screen and 2 on a phone, each with the company's logo, the name, one line on what it does (or, once connected, the account: company, email, bank) and a pill — Connected, Needs attention, Paused, Connect / Set up, Coming soon, or a lock with the plan's name. Connected apps first (the ones needing attention leading), then Accounting, Calendar, Email, Messaging, Payments & financing, Banking, Leads, Your website & developers; the apps the server can't offer yet sit in a quiet "Coming soon" row of logo + name at the bottom. Search on top (15 apps > the 12 the plan set). A trademark line at the foot names every owner.
- **"Needs attention"** is real, not decorative: a QuickBooks/Wave/calendar sync whose newest attempt failed (the logs are append-only, so an item stops counting once a retry succeeds), Stripe sign-up unfinished, a Gmail send error, a calendar feed that can't be read, Flinks connected with no account picked.
- **The detail** at `/dashboard/settings/apps?app=<id>`: a side panel from the right on a wide screen, a page of its own under 860 px (‹ back to the directory and the app's name in the top bar). It says what the app does and what it shares and with whom (the privacy policy's list), then either the lock, the "not available yet" note, or the app's own settings in the Phase 102 vocabulary: the account (company or email, connected since, last sync), an on/off switch (it used to be an Enable/Disable button pair), the app's settings (QuickBooks account, deposit, tax-code and cost-category mapping; Wave's; the calendar picker; the Financeit dealer ID; Flinks' account picker; API keys and webhooks), the sync or import log with Retry, and **Disconnect** last, in its own card, behind a confirm. WhatsApp, SMS and the widget open their existing settings sections.
- **Every plan sees the directory** (anyone with `integrations:full`; it was Business and Elite). An app outside the plan shows a lock pill and, opened, "Included in the Business plan — available on Business and the plans above it" with See plans (a link to Plan & billing, which the native apps will hide — APP-PLAN 118 — so no checkout button lives here). Locked apps' status endpoints are never called. The gates come from `lib/plans.ts`, the mirror of the server's table.
- **Back from an OAuth screen** (`?qb=connected`, `?wave=`, `?cal=`, `?email=`, `?stripeConnect=`, `?metaLeadAds=`, `?googleLsa=`): a toast says which app connected (or didn't) and its panel opens. Nothing read those params before — people came back to an unchanged page. The calendar callback now adds `&provider=` so the right calendar opens.
- **Official logos** in `public/brands/` with `BRANDS.md` (source URL, date, variant, each owner's rules): Google's G, Google Calendar and Gmail icons, Intuit's "Connect to QuickBooks" button (green and transparent), Wave, Stripe, Financeit, Flinks — each from the company's own domain, unaltered. Wordmarks get a wider box. **Intuit's rules followed**: its Connect button starts the QuickBooks connection, shown only while disconnected, and "Disconnect from QuickBooks" is the reverse.
- Email sender (Messaging) now shows the same Gmail panel as the directory. The calendar feeds card lost its own icon tile (the panel header has it). Books' "Connect your bank" goes straight to the Flinks panel.
- 167 new EN/FR strings; the section intro rewritten; help-centre articles corrected (QuickBooks/Wave are Business and up, not Elite; "Stripe Connect" → Stripe; "API keys" → API & webhooks); runbook §39.
- `qa:visual`: all 12 app panels, the calendar picker driven on the Google Calendar panel, and a new **Pro owner session** (a second showcase company on Pro) for the directory and QuickBooks' lock.

**Decided**
- **No logo where the owner doesn't license one.** Microsoft (Outlook) and Twilio allow their logos only with express written permission; Meta's WhatsApp and Meta kits sit behind an "I accept the guidelines" click, which is the owner's to make (and the Meta logo needs a Meta contact's approval for every use). Those tiles show a plain icon. The QuickBooks app icon is only downloadable signed in to developer.intuit.com (the press-room logos are "editorial use only"), so QuickBooks shows an icon until the owner adds `public/brands/quickbooks.svg` — the tile picks it up with no code change.
- The status pill sits at the foot of the tile, not beside the logo: a wordmark (Flinks, Stripe) pushed it onto its own line and the tiles stopped lining up.
- WhatsApp, SMS and the widget keep their settings sections; their tiles lead there rather than duplicating them in a panel.
- Mapping edits keep their own "Save mapping" button inside the panel (the Phase 102 save bar belongs to the page behind the panel's scrim).
- Between 641 and 859 px a section (or an app) is a page of its own but the phone top bar and its ‹ are hidden, so there was no way back to the list: a "‹ Settings" / "‹ Connected apps" link now sits above the section at those widths only. (A Phase 102 gap; the leave-prompt check at 768 found it.)
- The panel takes focus itself when it opens, not its first switch (Radix's default painted a focus ring on a row nobody chose).

**Found**
- **Saving the QuickBooks or Wave mapping wiped every cost-category mapping you didn't touch.** The old card sent `null` for each unpicked category and the server deletes a mapping on `null`, so picking just the payment account and saving cleared all of them. The panels now send only what changed.
- The five pre-102 files (`settings.tsx`, `profile.tsx`, the three `settings-*-tab.tsx`) were back on disk as untracked files (identical to their pre-102 versions but for CRLF). Vite resolves `@/pages/dashboard/settings` to `settings.tsx` before `settings/index.tsx`, so local dev and `qa:visual` were serving the old settings page. Moved out of the tree (git still has them at `bc8df71^`); production never had them.

- `qa:visual`'s focus-ring check was fooled by focus traps: focusing anything behind an open panel lands on the panel's first field, which was then measured "before" while already focused. It blurs an already-focused element first now.
- The API key field used the old shadcn `Input`, with no focus state inside a settings row; the panels use the settings fields now.

**Deferred**
- Owner: download Intuit's QuickBooks app icon (and the hover states of the Connect button, which Intuit asks for) from developer.intuit.com; tick Meta's guideline box and download the WhatsApp kit if a WhatsApp logo is wanted; confirm Flinks' legal entity name for the trademark line (BRANDS.md).
- Stripe has no Disconnect: there is no endpoint. The panel says to write to support.
- The settings list shows no status line for Connected apps (it would call a dozen status endpoints on every settings visit).

**Verification**
- `qa:visual --lang=en,fr --widths=375,768,1280 --routes=settings` (198 pages): 0 overflow, 0 gutter, 0 axe serious/critical, 0 raw keys; the only phone-rule warnings are `/dashboard/pay?tab=settings` (Phase 107). Its two findings (the API key field's focus ring, the leave prompt at 768) were fixed and rechecked: 768 + 1280 EN/FR (132 pages, `.qa/p103-recheck`) and the API panel (`.qa/p103-api`), clean.
- Phone sheets: `.qa/phone-sheets/p103/` (33 routes, before = `visual-mobile-audit`): the directory 1.8 screens (was 7.2 as one column); every app panel 1-1.4 screens except QuickBooks (3.9: its account, tax-code and seven category mappings).
- typecheck (quote-ai, api-server), eslint on the touched files, knip (nothing new), i18n-audit (no new findings: the one missing key is in an untracked `translations - Copy.ts`; "Meta Lead Ads" is the same in both languages on purpose).

### Phase 104 — 2026-09-26

**Built**
- **"Needs you"**: one list, most urgent first, from a new server read `GET /api/today/needs-you` (`api-server/src/today/service.ts`, `routes/today.ts`). It merges a blocker reported on site (Answer → the job), an e-Transfer the customer says they sent (Confirm → the invoice), invoices past due, most days late first (**Remind** sends the reminder from the row; Open when the role can't send, the customer has no email, or it was reminded in the last 3 days), hours waiting for approval as one row ("7.5 h to approve · 1 entry · 1 person" → Review), leads whose follow-up is today or earlier (**Call** when there is a number), and quotes sent 3-45 days ago with no answer once the automatic follow-ups are over or off (Call / Follow up). Five rows, then "Show all N". Each part is filtered by the role's permissions and the plan (blockers and hours need the crew tier), so a viewer gets a shorter list, not a 403. An empty list says "Nothing needs you right now."
- **The numbers** as one `StatStrip` from `GET /api/today/stats?from&to&prevFrom` (the browser's months): Quotes, Won (count and value), Outstanding (open invoices now, red with "$x overdue" when any are late), Collected (payments in, credit notes excluded). Whole dollars. The Month / Quarter / Year switch moved into the calendar button beside the heading ("This month"), an `ActionSheet` (a sheet on a phone, a menu wider).
- **The crew as one line** ("0 on site · 1 not clocked in · 1 job", yellow when someone booked hasn't clocked in) linking to the schedule; hidden when nobody is booked. **Next up**: the next five things from the Phase 85 agenda over two weeks (blocks, milestones, invoices due, follow-ups, filings, permits, connected calendars), with Open schedule — the month grid is gone from the home (the foreman's home keeps it until Phase 108).
- **The describe-a-job box** is one line until it is used: the client row and saved-client chips appear once it has focus, text or an attachment.
- Layout: two columns on a wide screen (Needs you, numbers, recent quotes | crew, next up, the Elite cash outlook), one column under 980 px. On a phone the page's New quote button hides (the + in the top bar is it). Recent quotes are `ListRow`s.
- Removed from the home: the four-card stat tower, the revenue-by-week bars, the separate follow-ups card (now rows of Needs you), the owner's crew card (its blockers and hours are rows now, its roster a line), the three quick-action tiles (the tabs and + cover them).
- 52 new EN/FR strings; runbook §40; `qa:visual` has the period switch and a Pro owner's home; the showcase seeds one of each Needs-you kind (an invoice 9 days late, typed hours waiting, a lead due today, a quote sent 6 days ago).

**Decided**
- The list is computed on the server: one request instead of five, and the per-role and per-plan filtering in one place with the permission matrix. Its order is unit-tested (`today/service.test.ts`): on site first, then money, then people waiting on an answer.
- Days late count the company's local calendar against the due date's own day (due dates are stored as that day's UTC midnight — read in Toronto they'd be the evening before). Due today is not late.
- A quote whose automatic follow-ups are still running is not "waiting": the sequence is doing the chasing. It joins the list when the sequence ends, is off, or the client unsubscribed.
- Hours are approved on the Team page, not from the row: approving in bulk from a summary line hides who worked where.
- Lead rows open the leads board (there is no page per lead yet).

**Found**
- The onboarding cards' step text was 4.39:1 on its grey tile (never swept — the showcase always had quotes; the new Pro-owner route has none). `--muted-mk` now.
- `docs/ROUTE-MATRIX.md` was stale (485 routes; 499 before this phase's two). Regenerated with the untracked " - Copy" route files moved aside — with them in the tree the generator doubles every file.
- Office-entered hours auto-approve unless `approve: false` is sent; the seed sends it.

**Deferred**
- The foreman's home (stacked Schedule / Jobs / Hours buttons, the month calendar): Phase 108.
- An e-Transfer-to-confirm row is not in the showcase (it would change the invoice screens other phases check).

**Verification**
- `qa:visual --lang=en,fr --widths=375,768,1280 --routes==/dashboard` (42 pages, `.qa/p104`): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings, 0 raw keys; the only phone-rule warning is the foreman's home (Phase 108).
- Phone sheets: `.qa/phone-sheets/p104/` (before = `visual-mobile-audit`): the owner's home **2.8 screens (was 5.3)**, all five Needs-you rows on the first screen; the Pro owner's 1.4.
- `vitest src/today` 8/8, route-matrix test 12/12 (without the Copy files), typecheck (quote-ai, api-server), eslint on the touched files (one old warning in the composer), knip (nothing new), i18n-audit (no new findings).

### Phase 105 — 2026-09-27

**Built**
- **Quote detail**: a header card first — the client as the heading, the job's subject under it, the status chip, the total — then the document. **One primary** by where the quote is: Unlock quote (locked) → Send (never emailed) → Copy link for client (emailed; Send again in ⋯) → Start job / **Open job** (accepted; the page now knows its job). Everything else is in ⋯ (`ActionSheet`): Edit, Regenerate, Download PDF, Pro PDF / Pro spec, PDF layout (phone), Duplicate, and **Archive / Delete**, which only the list's row menu had. On a phone the ⋯ + primary dock at the bottom (`StickyActionBar`); on a desktop they sit under the total. The Actions side card is gone (it repeated the head buttons); the "editing is locked" notice sits under the header card.
- On a phone: the company letterhead, the document title and the chapter summary table are hidden (the header card says it); chapters are **collapsible rows** (closed when there are several) and **lines are rows** — description on two lines at most, "qty unit × price" under it, the amount right (`components/quotes/line-rows.tsx`). Professional and Elegant read like Standard there; the PDF keeps its layout. The PDF template card and the chapter summary card are hidden on phones (⋯ → PDF layout opens the same choices in a sheet).
- **Edit mode on a phone**: chapters with their lines as rows; tapping a line opens it in a **bottom sheet** (description, quantity, unit, unit price with the decimal keypad, the line total; Done / Delete line); "Add item" opens an empty one. Save / Cancel are the docked bar. Replaces the stacked five-input cards.
- **Quotes list**: rows on a phone (client · subject and date · amount and status chip); the search stays at the top while the list scrolls; the status filter is a sheet with counts, the one that's on shows as a removable chip. New statuses **Sent** and **Accepted** (both were "Unlocked") and filters for them. The page's New quote button hides on a phone (the + in the top bar is it).
- **New quote**: modes as `ScrollTabs`; the **describe box first** — a multiline field with the photo and microphone buttons inside it, the examples only while it's empty; then the client; then **Options** — one line ("Standard · no target amount") that opens a sheet with the layout and the target amount (`components/quotes/quote-options.tsx`). **Write my quote** is the docked primary; Ctrl/⌘+Enter also sends (Enter is a new line now).
- **Manual builder**: its layout cards became the same Options line; on a phone its lines are rows edited in the same sheet (with Improve with AI and price-list matches under the description); **Create quote** docks at the bottom.
- API: `sentAt` on a quote and in the list, the list's `title`, and `jobId` on `GET /quotes/{id}` (spec + codegen). 23 new EN/FR strings; runbook §41; `qa:visual` drives the Options sheet, the manual tab and a line of it, the list's filter, a quote's ⋯, its edit mode and a line of it, a locked quote and the foreman's read-only quote.

**Decided**
- The primary follows the quote's life, not the role's full menu: the thing you do next with this quote. Duplicate, PDF, Regenerate are all one tap further.
- A phone shows one layout for every template: Professional's numbered navy table and Elegant's flat list are PDF looks; on a 375 px screen they were a horizontal scroll of 6-column tables.
- Chapters start closed on a phone only when there are several: the header card has the total, the chapter rows have the subtotals, and the long quote fits in 2.8 screens instead of 10.5.
- The target amount and the layout are rarely changed: one line that says what they are, not three cards and a field above the box.
- `qa:visual`'s `stacked-buttons` no longer counts a section header that opens and closes (`[aria-expanded]`) or a button that is a list row (`li > button`) — rows, not stacked actions, like the settings switch rows in Phase 102 (MOBILE-RULES.md updated).

**Found**
- **The quotes list said "0 line items" for every AI or manual quote**: it counted the legacy flat `items` only; those quotes keep their lines in chapters. `GET /api/quotes` counts both now.
- **The manual builder saved "mq" as the unit of every new line**: the default unit was Italian and not in the unit list, so the picker showed "sq.ft" while "mq" went into the quote. New lines default to "LS".
- The manual builder's three header fields had labels that weren't tied to their inputs, and its line inputs had none (axe `label`, critical — never swept before: the manual tab had no drive state). Labelled now.
- The Original input card showed a lone dash on manual quotes (no request text). Hidden when empty.

**Deferred**
- Phase 106 picks up jobs; the quote's side cards (Good/Better/Best, contract, payment schedule) keep their Phase 60 look under the document on a phone.
- There is no "trade" option: nothing in the quote request takes one (the AI infers it from the description).

**Verification**
- `qa:visual --lang=en,fr --widths=375,768,1280 --routes=dashboard/quotes,dashboard/new` (90 pages, `.qa/p105b`): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings, 0 raw keys, 0 phone-rule warnings. The first pass (`.qa/p105`, EN 375 + 1280) found the unlabelled manual fields, a label-in-name mismatch on the line rows (the aria-label dropped the "qty × price" line; now the visible text is the name after an sr-only "Edit line:"), and the stacked-buttons false positive; a recheck after the header-card spacer fix (`.qa/p105c`, EN + FR 375, 14 pages) is clean.
- Phone sheets: `.qa/phone-sheets/p105b/` (before = `visual-mobile-audit`): the long quote **2.8 screens (was 10.5)**, first screen = client, subject, status, total and Send; new quote 1.3 (was 1.5) with the describe box on screen one; the list 1.0.
- typecheck (quote-ai, api-server, libs via codegen), eslint on the touched files (two old exhaustive-deps warnings), knip (nothing new), i18n-audit (no new findings).

### Phase 106 — 2026-09-27

**Built**
- **Job page**: a header card first — the contract number and dates, the job's name (rename from ⋯ or the desktop pencil), the client, the address as one line that opens the phone's maps app, the status, and the progress (bar, %, "1/3 milestones"). Then **four numbers as a `StatStrip`** (contract value, invoiced, costs to date, projected margin — the budget under it), then the **tabs as sticky `ScrollTabs`** with their "waiting for you" counts; switching tab while they are stuck brings you to the top of the new one. The top bar names the job.
- **Photo** (secondary) and **Dictate** (primary) are the page's buttons — docked at the bottom on a phone, under the progress on a desktop. Everything else is in **⋯** in the order a job lives it: On my way, Start / Resume, Edit plan, Rename job, Put on hold, Mark complete; once completed: Reopen, Archive. A completed job keeps only its ⋯. The old head row (Dictate, Photo, On my way, Edit plan, Put on hold, Mark complete — five full-width buttons on a phone) is gone.
- **Overview**: *Up next* first, then schedule health and unbilled work as a strip (rows on a phone), then the charts. **Budget vs actual is now labelled bars** (category and "spent / budget" written over each bar, red past the budget, a lilac tail and a line for what waits for review) on every width; on a phone the two charts share one card with a switch (one chart at a time), legends under the chart, a narrower money axis. The timeline is a **list of milestones on a phone** (`Gantt` → number, title, dates · payment, status; a row opens the Schedule). The budget-plan card is left out on a phone (the chart says it). The projected margin moved from the health tiles to the page strip (the analytics projection, same request, falling back to the budget estimate).
- **Schedule**: on a phone the milestone cards are the schedule (no week chart); Start / Complete wrap under the title instead of overlapping it; tasks are checklist rows with a 44 px target and a name for the checkbox.
- **Change orders, costs, invoices**: rows wrap their buttons onto a second line on a phone (`.wrap-phone` + `.row-acts`); the costs drop zone is one line ("Drop a receipt…" had nothing to drop on a phone); the date joins the quiet line. The invoices tab's four stat cards are a strip.
- **Team**: hour rows keep the name and hours (date and phase on the quiet line, status under the amount). **Row actions on a phone are one ⋯ per row** (`RowMore`, new in `components/mobile/`): approve / reject / reopen / delete hours, delete equipment use, remove from the job, edit / delete a cost — the hover icons they replace would all show at once on a touch screen.
- **Photos**: three to a row on a phone, the upload one line.
- **Jobs list**: rows on a phone — the job, the client and what's next ("Next: Cabinets and countertops, 13 Oct", "On hold" or the completion date), a progress bar, the value in whole dollars and the status (`ListRow` got a `below` slot). The receipts inbox is one row above the jobs ("2 receipts to review ›", the receipts in a sheet) and is not shown when nothing waits. **New job** moved to the top bar's + sheet on a phone (`/dashboard/jobs?new=1`, like New lead).
- Job setup: its summary is two numbers side by side on a phone.
- 21 new EN/FR strings (`jobs.m.*`); runbook §42; `qa:visual` sweeps every job tab (`?tab=`), the job's ⋯, Mark complete through ⋯, and the receipts sheet.

**Decided**
- The bar is Photo and Dictate for every open job, whatever its status — those are what you do standing in a kitchen; Start job and Mark complete are once-per-job and one tap further.
- Budget vs actual as labelled bars everywhere, not only on phones: the numbers were only in a hover before, and "$2,194 / $2,880" over the bar says it without an axis.
- On a phone, a row's small buttons live in one ⋯ at the end of the row rather than inline (approving hours is two taps there; Today's Needs-you list is where hours get approved at a glance).
- `ScrollTabs` carries `data-bleed`: on a phone the rail runs to the screen edges and a pill half out of view is the cue that it scrolls, so `qa:visual`'s gutter check skips it. `full-width-stat` skips `.stat-card.editable` (a card holding a field, not a number). MOBILE-RULES.md updated.

**Found**
- **The Schedule tab's milestone rows overlapped their own Start button on a phone** (the title squeezed to one word per line behind the buttons) and the Team tab cut every worker to "Pat…" — neither tab had ever been swept (`qa:visual` only opened the Overview).
- The task checkbox, the photo select box and the row delete buttons had no accessible name; the geofence radius label wasn't tied to its select (axe `select-name`, critical).
- The showcase job said "0%" with one milestone of three done: the fixture completed the milestone without recomputing the job's progress. It does now (the product path always did).

**Deferred**
- The job setup page (`/jobs/:id/setup`) keeps its desktop form on a phone apart from the summary strip (Phase 110).
- The Messages and Assistant tabs are unchanged (the thread and the chat already read as a phone conversation).
- The foreman's home still has stacked buttons (Phase 108).

**Verification**
- `qa:visual --lang=en,fr --widths=375,768,1280 --routes=dashboard/jobs,=/dashboard` (138 pages, `.qa/p106b`): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings, 0 raw keys; phone-rule warnings only on the foreman's home (Phase 108) and the setup summary (fixed after, see the recheck). First pass (`.qa/p106`, EN 375 + 1280) found the tab rail gutter and the geofence label; the recheck after the last fixes (`.qa/p106c`, EN + FR 375, 32 pages) is clean with **0 phone-rule warnings**.
- Phone sheets: `.qa/phone-sheets/p106b/` and `p106b-fr/` (before = `.qa/phone-sheets/p106-pre/`, the same sweep on the old code): the job page **4.3 screens (was 6.3)**, first screen = the job, its progress, the four numbers, the tabs and Photo / Dictate; Schedule 2.1 (was 3.3), Change orders 1.3 (2.1), Costs 3.1 (3.9), Team 3.2 (3.8), Photos 1.5 (2.3), Documents 1.4 (2.2); the list 1.0 with the receipts as one row.
- typecheck (quote-ai, api-server), eslint on the touched files (clean), knip (nothing new), i18n-audit (no new findings).

### Phase 107 — 2026-09-27

**Built**
- **Invoice page**: a header card first — the number and issue date, the client as the heading, the invoice's title (or its job, as a link), status and type, and **what is still owed** (the total for a draft, a paid or void invoice, or a credit note). **One primary** by where the invoice is: **Send** (draft) → **Record payment** (sent, viewed, awaiting the e-Transfer, partly paid, overdue); none once paid or void. Everything else is in ⋯: Download PDF, Edit draft, Resend, Remind, Copy customer link, Open what the customer sees, Credit note, Archive, Void, Discard draft. Docked at the bottom on a phone, under the amount on a desktop. The four stat cards are a `StatStrip`; the customer-link card is left out on a phone (it is in ⋯). The row of seven buttons (PDF, Resend, Record payment, Remind, Credit note, Void — five of them full-width on a phone) is gone.
- **Invoice lines on a phone** (New invoice, Edit draft): rows and a line in a sheet — `QuoteLineRows` and `LineItemSheet` from Phase 105, with a new `noUnit` (invoices price quantity × amount). An untouched first line is the empty form, so the list starts with "Add item".
- **Invoices list**: the four numbers as a strip; the aging card's legend two by two on a phone, the empty buckets left out; rows on a phone (client, number and when it is due / was paid, the amount — the balance once part is paid — and the status; `components/invoices/invoice-list-row.tsx`); the search and a filter sheet as on the quotes list. **New invoice** moved to the top bar's + on a phone (`/dashboard/invoices?new=1`).
- **`PhoneListBar`** (`components/mobile/list-filter.tsx`): the quotes list's sticky search + filter sheet with counts + removable chip, made shared; used by invoices, contracts and clients.
- **Client page**: the name, town and "client since", then **Call · Text · Email · Map** (`tel:`, `sms:`, `mailto:`, Google Maps; only those the client has details for), four numbers (quotes and how many won, quoted value, won value, owed to you), then sticky tabs **Quotes · Jobs · Invoices · Messages** (`?tab=`). Quotes as rows with the Phase 105 status chip; the client's jobs (started from their quotes or created for them) with progress; their invoices; the thread and the portal card. `GET /api/clients/:id/portal` now returns the client row's `clientId` — the page URL carries the md5 of the quotes grouping, jobs and invoices carry the UUID. The "{n} in total" line was English-only; gone with the old layout.
- **Clients list**: rows on a phone (avatar, name, town or contact · "3 quotes", lifetime value, Active / Prospect).
- **Leads**: on a phone **one stage at a time** — the stages as sticky tabs with counts, swipe left / right on the list for the next one, opening on the first stage with leads. Each lead has **⋯ → Move to …** on every width (the board was drag-only: no way to move a lead on a phone or with a keyboard). New lead is the top bar's + on a phone.
- **Contract page**: a header card (number and date, client, job, status, the related quote and job, the price) and the next step as the one primary — **Sign as company** → **Send to customer** → **Resend link** while the customer has not signed; Save / Cancel docked while editing. ⋯: PDF (signed PDF once signed), Edit (draft), Archive, Void. On a phone: a four-segment progress bar and "Next: …" in the header, the waiting / executed notice under it, and **the agreement folded** into one row ("Read the agreement · 16 sections") — open, it has "Fold the agreement"; the Next step card and the steps row are the desktop's.
- **Contracts list**: rows on a phone (client, number · job, price, status), a search (new: number, client or job) and the filter sheet.
- **Analytics**: the six business numbers and the four quote numbers as strips (three across between 641 and 980 px, two on a phone). On a phone **one chart at a time**, picked from tabs (Profit, Receivables, Cash flow, Jobs at risk with its count, Margins); margins by job is a list (job, client · costs of value · progress, the margin coloured, the status).
- 41 new EN/FR strings (`invoices.m.*`, `clients.m.*`, `leads.m.*`, `contracts.m.*`, `analytics.m.*`); runbook §43; MOBILE-RULES.md (`PhoneListBar`, the + sheet's full list, "nothing needs a hover or a drag"); `qa:visual` drives the invoices and contracts filter sheets, the invoice's and the contract's ⋯, the agreement unfolded, a new invoice's line sheet, the client's three other tabs, a lead's Move menu and two analytics charts.

**Decided**
- The invoice's primary is Record payment from the moment it is sent — what comes next is money in; Resend and Remind are one tap further (reminders go out on their own at 3 / 7 / 14 days).
- A contract's text is folded on a phone, not shortened: 9 screens of legal text is what the client reads and signs; the contractor checks where it stands and acts. One tap unfolds all of it.
- The desktop ⋯ menu is **not modal** any more (`DropdownMenu modal={false}` in `ActionSheet`): a menu is not a dialog (WAI-ARIA), and the modal one hid the whole page from assistive tech while open (axe `aria-hidden-focus`, first seen on the leads Move menu, true of every ⋯ on a desktop). Escape, outside click and focus return are unchanged; the phone sheet stays a modal dialog.
- Leads keep drag on a desktop; the Move menu is the way that works everywhere.
- Client tabs are on every width (the desktop page was the thread and the portal before the quotes; now it opens on the quotes like the phone).

**Found**
- **Analytics on a phone and a tablet kept its charts squeezed two to a row**: an inline `grid-template-columns: 2fr 1fr` beat the stylesheet's one-column rule under 980 px (the aging list was 80 px wide at 375). A `wide-left` class applies it from 981 px only.
- **The New invoice form and the invoice's own dialogs (record payment, credit note, send, void, edit draft) had labels not tied to their fields** — 22 of them — and the line editor's inputs and delete buttons had no name (axe `label`, `select-name`, `button-name`, critical; the New invoice form had never been swept). Tied / named now.
- The leads board's "No leads here" was grey on grey below 4.5:1 (axe `color-contrast`).
- The showcase's "Pay Client" invoice is past due but still says Sent (the overdue flip is the cron's; the aging card counts it in 1–30 days). Not a display bug — noted.

**Deferred**
- The Documents (price-list uploads) page is already one phone screen; its rows get their pass in Phase 110 with the long tail.
- The invoice's HTML document itself (the customer's layout) is unchanged — it is what the client sees at `/i/…` (Phase 111).

**Verification**
- `qa:visual --lang=en,fr --widths=375,768,1280 --routes=dashboard/invoices,dashboard/clients,dashboard/leads,dashboard/contracts,dashboard/analytics` (126 pages, `.qa/p107b`): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings, 0 raw keys; the only phone-rule warning is the agreement **unfolded on purpose** (9.2 screens, EN + FR). The first pass (`.qa/p107`, EN 375 + 1280) found the unlabelled invoice fields, the leads contrast and the modal menu.
- Recheck after the last polish plus a regression pass for the non-modal menu: `qa:visual --lang=en,fr --widths=375,1280 --routes=dashboard/invoices,dashboard/leads,dashboard/quotes,dashboard/jobs,=/dashboard` (128 pages, `.qa/p107c`): 0 overflow, 0 gutter, 0 axe serious/critical, 0 screen-reader findings, 0 raw keys, **0 phone-rule warnings**.
- Phone sheets: `.qa/phone-sheets/p107b/` (before = `.qa/phone-sheets/p107-pre/`, the same screens on the old code): contract **2.0 screens (was 9.0-9.2)**, first screen = client, job, status, price, where it stands and the next step; invoice 3.1 (was 4.0) with Record payment docked; client 1.0 (was 2.3) with Call / Text / Email / Map on screen one; analytics 3.2 (was 4.7); invoices list 1.4 (was 2.0); leads 1.0 (was 1.5) with every stage one tap away instead of six stacked columns.
- typecheck (quote-ai, api-server), eslint on the touched files (clean), knip (nothing new), i18n-audit (no new findings).
