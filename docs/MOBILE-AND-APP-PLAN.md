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
| 103 | Integrations: an app directory with real logos | A | not started |
| 104 | Today (dashboard home) | A | not started |
| 105 | Quotes: list, new quote, quote detail | A | not started |
| 106 | Jobs: list and the job page | A | not started |
| 107 | Money and people: invoices, clients, leads, contracts | A | not started |
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
