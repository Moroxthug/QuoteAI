# QuoteAI — Calm mobile + the app stores (Phases 100-116)

Written 2026-09-26. Two tracks, in this order:

- **Track A — Calm mobile (Phases 100-111).** The phone experience rebuilt around one idea: *open a screen, see the thing, do the one obvious action.* Nothing here is a new feature; it is the same product arranged for a 375 px screen and a thumb.
- **Track B — The apps (Phases 112-116).** QuoteAI on Google Play and the App Store, built from the same React code with Capacitor, **with no Mac and no Apple device required to build** (cloud macOS builds). One iPhone to test on is still strongly advised (§B.0).

Track B starts after Track A's navigation and core screens (100-104) — an app store listing of today's mobile layout would be the "messy" version with an icon.

Same conventions as every plan before: one phase per conversation, in order, one commit per phase pushed to `main` (auto-deploys), a build-log entry at the bottom of this file, a runbook section when behaviour changes, `qa:visual` before calling it done. **Every phase in Track A also ships the phone contact sheets** (§A.4) for the screens it touched, before and after.

---

## Status

| Phase | Title | Track | State |
|---|---|---|---|
| 100 | Mobile foundation: rules, primitives, the phone check | A | not started |
| 101 | Navigation: bottom tabs, the More sheet, one New button | A | not started |
| 102 | Today (dashboard home) | A | not started |
| 103 | Quotes: list, new quote, quote detail | A | not started |
| 104 | Jobs: list and the job page | A | not started |
| 105 | Money and people: invoices, clients, leads, contracts | A | not started |
| 106 | The crew app and the foreman | A | not started |
| 107 | Schedule on a phone | A | not started |
| 108 | Settings and the long tail | A | not started |
| 109 | What clients see: accept, sign, pay, portal, sign-up | A | not started |
| 110 | The public site on a phone | A | not started |
| 111 | The phone gate: rules enforced, sheets reviewed | A | not started |
| 112 | App foundation (Capacitor) | B | not started |
| 113 | Native device features: push, camera, files, location | B | not started |
| 114 | Google Play release | B | not started |
| 115 | App Store release without a Mac | B | not started |
| 116 | Store listings, release process, runbook | B | not started |

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
| Settings | **10 pill tabs wrapping to 4 rows** before any setting. | 2½ |
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

- Desktop layout does not change except where a shared component has to (and then it must look the same or better at 1280).
- The mockup design system (`docs/mockups/*`, `mockup-system.css`) stays the vocabulary; Phase 100 adds the mobile pieces it never had (tab bar, action sheet, bottom sheet, list row, stat strip).
- No dark mode (decided in Phase 38), no new animations beyond a sheet sliding up, respects reduced motion.

## A.4 How "calm" is checked

The screenshots are the proof, so they get produced every time:

- **`qa:phone-sheets`** (Phase 100): for any set of routes, slices the 375 px full-page screenshots into phone frames and lays out the first three screens side by side (the script used for the audit above), plus a before/after pair when given a baseline folder. Each phase attaches its sheets to the build log.
- **New `qa:visual` phone rules** (warnings in 100, enforced in 111): at 375 px — more than two full-width buttons stacked; a `.stat-card` spanning the full width; a `<table>` wider than its container; tabs wrapping to a second line; page taller than N screens for app pages (budget per page, set in 111); the page's primary action not within the first screen or the sticky bar; anything under the bottom tab bar not reachable (padding for the bar).
- **A person looks.** The sheets exist so the owner can glance at them on a phone; that remains the real test (Phase 99 P-1 device pass, repeated after 111).

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
  - worker: the crew app (106), not the dashboard
- **More** opens a sheet grouping the other ~15 sections under four headings (Work, Money, Team, Business) with the notifications count and the account at the top. Plan-gated sections show their lock the same way the sidebar does.
- **New** (a centred button or the top-bar +): one sheet — New quote, New client, Log a cost (photo), New job note. The same sheet the Capacitor app long-press shortcut opens (112).
- Scroll position and tab memory per section (Phase 84's scroll restoration extended); Android back and iOS swipe-back behave (history, not a trap).
- The drawer stays for 640-980 px tablets if the tab bar reads worse there — decide on the sheets.

## Phase 102 — Today (dashboard home)

- First screen: greeting line, **"Needs you"** — one prioritised list merging what is today spread over cards (blocked on site, quotes waiting for reply, invoices overdue, hours to approve, follow-ups due), each row with its one action.
- The describe-a-job box stays, compact (one line that expands).
- KPIs as a `StatStrip` (quotes, won, outstanding, this period), the period switch in its ⋯.
- Crew today as a short list ("3 on site, 1 not clocked in"), the month calendar replaced by the next 5 things (agenda) with "Open schedule".

## Phase 103 — Quotes: list, new quote, quote detail

- **List**: `ListRow`s (client · title / date · status chip / amount), filters in a sheet with the active one shown as a single chip, search as a top field that stays.
- **New quote**: the describe box first (full width, multiline, mic and photo buttons inside it), client picker second, then "Options" (layout Standard/Professional/Elegant, target amount, trade) collapsed into one line summary "Standard · no target" that opens a sheet. Manual and Price list modes as `ScrollTabs`.
- **Quote detail**: the document first — client, total, status as a header card, then chapters as collapsible sections with **line items as rows** (description over two lines max, "qty × unit price" underneath, amount right). Sticky bar: **Send** (or the state-appropriate primary: Send / Copy link / Start job). Everything else (Edit, Regenerate, PDF, Copy link, Start project, Upgrade layout) in ⋯.
- The same for the manual editor: line editing in a bottom sheet per line instead of an inline grid.

## Phase 104 — Jobs: list and the job page

- **List** as rows: job · client / next milestone · progress bar / contract value.
- **Job page**: compact header (title, status, address as one tappable line to Maps, dates), **`StatStrip`** (contract, invoiced, costs, margin), then the tabs sticky. Sticky bar: **Photo** and **Dictate** (the two things you do standing in a kitchen). Edit plan, Put on hold, Mark complete, Archive in ⋯.
- Charts on phones: one chart at a time with a toggle, legends under, axis labels that fit (budget vs actual as horizontal bars with the numbers written on them).
- Change orders, photos, tasks, costs tabs reviewed for the rules (photo grid 3-up, tasks as checklist rows).

## Phase 105 — Money and people: invoices, clients, leads, contracts

- Invoices, clients, leads, contracts, documents lists as rows; invoice detail like the quote detail (document first, sticky **Send** / **Record payment**).
- Leads kanban on phones: one column at a time with a stage switcher (swipe between stages), not a horizontally scrolled board.
- Client page: contact actions as a row of icon buttons (call, text, email, map), then their jobs/quotes/invoices as tabs.
- Analytics: the few numbers that matter as a strip, charts one per screen with a picker.

## Phase 106 — The crew app and the foreman

- **`/t` (worker)**: the first screen is **Now**: the current or next shift card with **Clock in / out** as the big button, the job address one tap to Maps, the gate code. Below: today's tasks as a checklist. "Report from site", travel and per diem become actions in a sheet from a sticky bar (**Report** · **Photo**), not three always-open forms. "Since you last looked" collapses to a count chip. Company switcher moves into the header menu (only shown when there are two).
- **Foreman dashboard and job page** get the same treatment: who is where, blocked items first, approve hours as a swipe list.

## Phase 107 — Schedule on a phone

- Under 768 px the default is **Day agenda** (by person or by job, switchable), with week as a compact 7-day strip of dots at the top to jump; the drag grid stays for tablet/desktop.
- Add block as a bottom-sheet form (who, job, day, from-to) with sensible defaults (the job's crew, today, 7:00-15:30). Double-booking shown inline on the row.
- Copy for touch ("tap a day" instead of "drag on the board").

## Phase 108 — Settings and the long tail

- **Settings** becomes a menu screen on phones (like the phone's own settings): grouped rows (Business, Plan & billing, Messaging, Integrations, Website widget, Security, Usage), each opening its own page with a back button. Desktop keeps tabs.
- Plan comparison as a swipeable card row with the current plan first.
- The long tail against the rules, one pass each: books (bank, claims), pay, compliance, group, team (workers, time, equipment, members), catalog, imports, archive, notifications, profile, assistant, billing, documents.

## Phase 109 — What clients see: accept, sign, pay, portal, sign-up

- `/p` quote accept, `/sign`, `/i` invoice pay, the client portal and messages: these are opened by **the contractor's customers on their phones from an email** — the most-viewed phone screens in the product. Document first, one sticky primary (Accept / Sign / Pay), the OTP code field with `autocomplete="one-time-code"`, signature pad sized for a thumb.
- Sign-in, sign-up, onboarding steps and `/join`: one question per screen where it helps, keyboard types, no field hidden under the keyboard.

## Phase 110 — The public site on a phone

- Homepage from 24 screens to about 8: hero, the 30-second demo, three short proof blocks, one feature overview (a list, not four colour slabs), pricing teaser, FAQ, footer. The desktop keeps its length if it reads well there; phones get the condensed order (same components, `hidden` per breakpoint where needed).
- The support chat button stops covering content (inline "Questions?" link on phones, or offset above the fine print).
- Pricing: plans as a swipeable row with Pro in front; comparison table as a per-feature list. Pilot and province pages, help centre, blog article template checked against the rules.

## Phase 111 — The phone gate: rules enforced, sheets reviewed

- The `qa:visual` phone rules from 100 become errors (exit 1), with a per-page height budget.
- Full 375 px sweep EN + FR, all sheets generated into one review page the owner can open on a phone.
- The Phase 99 P-1 real-device pass repeated on the new design (owner), fixes from it.
- `docs/MOBILE-RULES.md` updated with anything the phases learned.

---

## B.0 The app stores without a Mac — what that really means

| Need | Without a Mac | Cost |
|---|---|---|
| Write the app | Capacitor wraps the existing React build. The iOS project is generated and edited on Windows (Swift Package Manager, no CocoaPods); nobody opens Xcode. | — |
| Build and sign iOS | A cloud macOS machine: **Codemagic** (free tier includes macOS build minutes each month; automatic code signing from an App Store Connect API key) or **GitHub Actions** macOS runners (private repos burn macOS minutes 10× faster). Certificates and provisioning profiles are created through the App Store Connect API — no Keychain, no Mac. | Free tier to start |
| Build Android | GitHub Actions on Linux, or locally on Windows with Android Studio. | Free |
| Apple Developer Program | Enrol at developer.apple.com with an Apple ID with two-factor on (an SMS phone number works as the trusted device). **Organisation** enrolment needs a D-U-N-S number and the registered business (ties to Phase 99 L-4); **individual** shows your personal name as the seller. | US$99 / year |
| Google Play Console | Identity verification. **Personal** accounts created since late 2023 must run a closed test with at least 12 testers for 14 days before production; **organisation** accounts (D-U-N-S) skip that. | US$25 once |
| Test on iOS | TestFlight installs builds on a real iPhone — the only way to feel it. Options: borrow one, a used iPhone (any model on a supported iOS), or a cloud device service (BrowserStack/others) for spot checks. The simulator runs only on a Mac (Codemagic can take simulator screenshots for the store). | Borrow / ~$150-250 used |
| App Review | Apple reviews every release (usually 1-2 days). A reviewer logs in with a demo account we provide. | — |

**Recommendation:** Capacitor, bundled web assets (not a remote-URL shell), Codemagic for iOS, GitHub Actions for Android, organisation accounts once the business is registered (L-4) — individual accounts are fine for internal testing meanwhile, but transferring an app between account types later is paperwork.

**The three App Store rules that shape the build** (and Play's equivalents):
1. **No buying inside the app** (Guideline 3.1.1; Play's payments policy is similar). The plan picker, upgrade buttons, single-quote purchase and checkout links are hidden in the native apps; an account is subscribed on the website. On iOS the app may not even point to the website to buy (anti-steering, outside the US). The contractor's *clients* paying invoices by card is a physical service and stays.
2. **More than a website** (4.2 minimum functionality). Native push, camera capture, offline crew mode, location clock-in, share sheet and file saving are what make it an app — Phase 113 is not optional.
3. **Account deletion inside the app** (5.1.1(v)) — already built (Phase 72), must be reachable from the app's settings. Sign in with Apple is **not** required: QuoteAI has no social logins.

## Phase 112 — App foundation (Capacitor)

- `artifacts/mobile` (Capacitor 7+) wrapping the quote-ai client build: `appId ca.quoteai.app`, name QuoteAI, bundled assets, splash and icons generated from the logo.
- **Auth for a bundled app**: the WebView's origin is `capacitor://localhost` (iOS) / `https://localhost` (Android), so cookies to quoteai.ca are third-party. Use better-auth's **bearer** plugin (already on): token in the device keychain/keystore (secure storage plugin), sent as `Authorization`; CORS + `TRUSTED_ORIGINS` for the two app origins; 2FA flow checked.
- An `isNativeApp` flag: hides purchase UI (rule 1), the marketing site and cookie banner; the app opens straight to sign-in or Today.
- **Offline**: the IndexedDB outbox (Phase 77) works without the service worker; iOS WKWebView does not run service workers for `capacitor://`, and doesn't need to — the shell is bundled. Verify the outbox replay and the offline pages in both.
- Links: `/p`, `/sign`, `/i`, `/join` links opened from email stay in the browser (they are for clients); `quoteai.ca/dashboard/*` links open the app when installed (Android App Links + iOS Universal Links: `assetlinks.json` and `apple-app-site-association` served by the site).
- Status bar colour, safe areas (100 already), Android back button to history, keyboard resize mode, pull-to-refresh on lists.
- CI: Android debug APK on every push to `main`.

## Phase 113 — Native device features: push, camera, files, location

- **Push**: Firebase Cloud Messaging for both platforms (FCM relays to Apple's APNs with an APNs key from the Apple developer site — made in the browser). A `device_tokens` table next to the Phase 77 web-push subscriptions; every notification that goes to web push also goes to the devices; tapping it opens the right screen. Permission asked at a moment that explains itself (after the first quote is sent, "Know when they accept?"), not at launch.
- **Camera**: job photos and receipts through the native camera (and library), compressed on device before upload, working with the offline outbox.
- **Files**: PDFs (quote, invoice, contract, payroll export) saved and shared through the native share sheet — a WebView can't download a blob the way a browser does.
- **Location**: clock-in location with the permission strings Apple requires ("QuoteAI records where you clock in so your employer can confirm site attendance") and only while in use.
- **Voice**: dictation uses the microphone permission, same strings discipline.
- Optional, if cheap: Face ID / fingerprint to reopen the app, app-icon shortcuts (New quote, Clock in).

## Phase 114 — Google Play release

- Owner: Play Console account (organisation if the business is registered), app created, testers list.
- Assistant: release-signed AAB from GitHub Actions (upload key in GitHub secrets, Play App Signing holds the app key), version code from the build number; store listing EN + FR; **Data safety** form answered from the privacy policy's recipient list; content rating; target API level current; account deletion URL (`/dashboard/settings` security → the public help article that explains it).
- Internal testing → closed testing (12 testers × 14 days if a personal account) → production, staged rollout 20 % → 100 %.

## Phase 115 — App Store release without a Mac

- Owner: Apple Developer Program enrolment; App Store Connect app record; an **App Store Connect API key** (admin creates it in the browser) handed to Codemagic; a demo account for App Review; a test iPhone or a plan for one.
- Assistant: `codemagic.yaml` — build the web assets, `cap sync ios`, automatic signing, build, upload to **TestFlight**; the same workflow on a tag submits for review. Push entitlement and APNs key wired to FCM. `Info.plist` usage strings (camera, photos, microphone, location-when-in-use). **Privacy nutrition labels** from the recipient list; App Tracking Transparency not needed if no tracking SDK runs in the app (PostHog in the app configured without cross-app tracking, or off).
- Review notes that pre-empt the usual rejections: what the app does beyond the website (push, camera, offline field mode, location clock-in), where account deletion is, that subscriptions are managed outside the app and the app sells nothing, the demo login.
- iPhone only at first (no iPad screenshots needed), portrait.

## Phase 116 — Store listings, release process, runbook

- Screenshots generated from the real app screens at the required sizes (the same fake-data preview routes + Chrome at device sizes; Codemagic simulator for true iOS frames), EN and FR, captions in the product's own voice; short/long descriptions; keywords; support and privacy URLs; the promo video optional.
- Release process in `RUNBOOKS.md`: version numbers, a tag builds both stores, staged rollout, how to roll back (halt rollout / expedited review), what a web deploy does and doesn't change in the app (bundled assets update only with a new build — or with a live-update service later, decision recorded), and the checks before every submission (`qa:visual`, the phone sheets, a TestFlight + internal-track install).
- `ops:owner-check` gains the app items (store accounts, API key present in CI, last successful build per platform).

---

## Owner items for Track B (added to Phase 99 when Track B starts)

| # | Item | Time | Cost |
|---|---|---|---|
| M-1 | Decide individual vs organisation store accounts (organisation needs L-4 + a D-U-N-S number, free from Dun & Bradstreet, takes days to a couple of weeks) | 5 min + wait | free |
| M-2 | Google Play Console account + identity verification | 30 min + wait | US$25 |
| M-3 | Apple Developer Program enrolment | 30 min + wait (1-2 days, longer for organisations) | US$99/yr |
| M-4 | App Store Connect API key → Codemagic (the assistant says exactly which role and where to paste) | 10 min | free tier |
| M-5 | Firebase project (for push), APNs key uploaded to it | 20 min | free |
| M-6 | An iPhone for TestFlight (borrow / used) and an Android phone | — | — |
| M-7 | 12 testers for Google's closed test if the Play account is personal | 14 days | — |
| M-8 | Demo account for App Review (the assistant seeds it) | 5 min | — |

---

## Build log

*(one entry per phase: date, built, found, deferred, verification with the phone sheets)*
