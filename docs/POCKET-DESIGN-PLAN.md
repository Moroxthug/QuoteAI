# Pocket design plan: the phone app, built 1:1 from the chosen design

Source of truth: the Claude Design canvas **"quoteAI Pocket CRM"**, https://claude.ai/artifact/63hx7iusy5TVEybpZ6s49c. It has five artboards, each 390 px wide: Home (844), Quote draft (1420), Menu (844), Settings (1500), and Home full length (2180).

A pinned copy of its sources lives in `docs/pocket-design/` (see Phase 143). Every value in the app is taken from those files.

## The rule

The owner wants **that exact design, not something similar**. The same elements, sizes, fonts, colours, radii, shadows, spacing and motion.

- **Nothing is added** to a screen the canvas draws: no badges, banners, tips, install prompts, extra buttons or extra sections.
- **Screens the canvas doesn't draw** (quote list, jobs, a job, clients, invoices, schedule, crew, sign-in and so on) are built **only from the canvas's own parts**. Those parts are:
  - the white card
  - the section header (15 px title with a grey link on the right)
  - the list row
  - the menu row (30 px icon tile, label, grey value, chevron)
  - the switch
  - the segmented control
  - the −/+ stepper
  - the black pill button and the grey secondary button
  - the 44 px round back button with a centred mono title and ⋯
  - the floating pill tab bar
- **Where the design shows data the app doesn't have yet**, the data is built (below). Nothing is faked and nothing gets a stand-in element.
- **Scope: the phone layout.** That means the Android/iOS app and the website below 980 px wide, where the tab bar shows today. The desktop website keeps its current look.

## The design's system, in exact values

**Fonts**
- Geist 400/500/600/700 for text; Geist Mono 400/500 for numbers, codes and times.
- Self-hosted through `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`, not Google Fonts, so they work offline and pass the CSP.
- Body letter-spacing −0.01em.

**Colours**

| Role | Value |
|---|---|
| Page | `#f5f4f1` (outer `#e9e8e4`) |
| Card | `#ffffff` |
| Ink | `#141416` |
| Dark card | `#151517` |
| Dark button / FAB | `#111113` |
| Secondary text | `#6e6e76` |
| Tertiary text | `#8a8a90` / `#9a9aa0` |
| Tab-bar inactive | `#7a7a80` |
| Chevron | `#b0afab` |
| Body copy grey | `#3c3c43` |
| Hairline | `#efeeea` |
| Neutral fills | `#f1f0ec`, `#ebeae6`, `#e9e8e4`, `#e7e6e2`, `#f7f6f3` |
| Switch off | `#dddcd8` |
| Avatar | `#f1ede4` |
| Accent | `#e4572e` |
| Accent text / link | `#c2441f` |
| Danger | `#c2371f` |
| Success | `#1f7a45` (dot `#1f9d55`) |
| Warning | `#d69524` / `#9a6412` / `#b7791f` |

**Radii**
- Cards: 22, 20 in lists.
- Composer: 26. Inner card: 18.
- Segments: 14/11 and 10/8.
- Buttons: 14, 16 and pills.
- Tab bar: 31.
- Icon tiles: 9.
- Avatars and round buttons: 50%.

**Shadows**
- Card: `0 1px 2px rgba(20,20,22,.04), 0 0 0 1px rgba(20,20,22,.04)`.
- Floating: `0 10px 30px -8px rgba(20,20,22,.22), 0 0 0 1px rgba(20,20,22,.06)`.
- Composer: `0 1px 0 rgba(255,255,255,.06) inset, 0 20px 40px -12px rgba(20,20,22,.45)`.

**Type sizes**
- Headings: h1 24–28 / 600 / −0.035 to −0.04em. Section h2 15 / 600 / −0.02em. Group label 12.5 / 500 grey.
- Text: row 14 / 500. Meta 12. Mono 11–12.
- Totals: 28–32 / 600 / −0.045em.

**Motion**
- `rise`: 0.9 s, cubic-bezier(.16,1,.3,1), staggered 60–70 ms.
- `press`: scale .92–.97.
- Segment slide: .45 s. Switch knob: .4 s with an overshoot curve.
- Chart draw, check-mark draw, and progress-bar grow.
- Everything is off under reduced motion.

**Spacing**
- Page gutter 16 (headers 20). Section gap 22. Card padding 16. List rows 52 high, with 14–16 side padding.
- Floating tab bar: 16 from each side, 26 from the bottom, 62 high.

## Phases

### Phase 143: Foundations
- Pin the canvas sources into `docs/pocket-design/`.
- Install Geist and Geist Mono.
- Add the tokens above as CSS variables in a new `pocket.css`, scoped to the phone layout.
- Build the parts kit in `components/pocket/`: `Card`, `SectionHead`, `MenuRow`, `Switch`, `Segmented`, `Stepper`, `PillButton`, `BackHeader`, `Avatar`, `ProgressBar`, and the `rise` / `press` utilities.
- Add a dev page, `/dashboard/__pocket`, that shows every part with the canvas's own sample content.
- **Check:** a pixel comparison of each part against the same part rendered from the canvas source.

### Phase 144: The shell
- **Floating pill tab bar** with Home · Quotes · Jobs · Clients, and the **assistant button** (62 px black circle with the mini orb) beside it. It replaces the current tab bar, the More tab and the top-bar `+`.
- **Headers:**
  - Home has no top bar; its own header is part of the page.
  - Other screens get the 44 px back circle, a centred mono title and ⋯, or an h1 at 28 px as on Settings.
- **Avatar top right** on Home opens the Menu. Notifications show as the orange dot on the avatar.
- **Roles:** crew and foreman keep their own tab sets, drawn with the same bar.

### Phase 145: Home, top half
1. **Header:**
   - Date · weather icon · "12°, rain after 3 pm" · "Good morning, <first name>" · avatar.
   - Weather comes from a new `/api/weather/today`, using Open-Meteo (free, no key) at the company's city, cached for 30 minutes. The icon and wording follow the forecast.
2. **New quote composer:** dark card, "New quote" with the beating dot, the province and tax in mono, and the textarea. Below it:
   - the client chip, photos chip, mic and orange send button;
   - the three staged steps with the progress bar;
   - the white "Draft ready" card with the counted-up total, "Incl. HST · N items · valid N days", the first 3 lines, **Review and send** and **Redo**;
   - the hint line under the card.
   The step labels follow what the server is doing; "Pricing at <city> rates" uses the company's city.
3. **Schedule:** a 7-day strip with a sliding black indicator, today's date in accent, and dots for booked days. The agenda rows show time, colour dot, title, place and tag, or "Nothing booked" with **Add visit**. Data comes from `/api/calendar/agenda`.

### Phase 146: Home, bottom half
4. **Today checklist:** "done/total" with a mini bar, and rows with a round check, title and a meta line in red, amber or grey.
   - The items are the owner's real to-dos from `/api/today/needs-you`: confirm a visit, approve timesheets, chase an overdue invoice, follow up a quote, blockers.
   - Checking an item marks it done for today; new server `today_checks`, per user per day.
5. **Business:** Week / Month / Quarter segmented control, "Collected <period>" total, ↑ delta vs the previous period, and the line chart with area and end dot. Below that, **Quotes won %** with a bar, **Outstanding** with an overdue line, and **Margin** "after labour".
   - New `/api/today/business?period=W|M|Q` returns the series (8 weeks, 6 months or 4 quarters), win rate, outstanding and overdue, and margin.
6. **Crew:** "N on site · N en route", 5 avatars with status rings (green on site, amber on the way, grey off), and a detail strip with name · role, site, and status with time. Data comes from `/api/crew/today`.
   - "On the way / 14 min away" needs live location. The app only has clock-in and geofence today; see Decisions.
7. **Sites:** "All N", then rows with name, mono %, progress bar, phase and crew names. Data comes from `projects.progress_percent`, the next milestone and the assigned crew.

### Phase 147: Quote draft
- Back circle, the quote number in mono, and ⋯.
- Status line ("Draft · valid until Oct 29"), a 24 px title, the client row with **Change**.
- **"Scope, as understood"** card with **Edit**.
- **Line items:**
  - Items with a unit get the −/+ stepper, showing quantity and unit in mono.
  - Items without a unit show "fixed".
  - **Add item** at the top of the list.
- **Totals card:** subtotal, tax by province, and the total at 28 px.
- **Deposit card:** the switch and "Due on acceptance".
- **Send by:** Email / SMS / WhatsApp segmented control, each showing the masked destination.
- **Floating bar:** **Preview** (frosted) and a black **Send $X** that turns green "Sent to <first name>".
- Sending by SMS and WhatsApp uses the existing Twilio and WhatsApp channels.
- The screen covers drafts; sent and accepted quotes use the same parts.

### Phase 148: Menu
- Back circle.
- Profile card: 52 px avatar, name, "Company · Role", chevron.
- Dark plan strip: "Pro plan", "Renews <date> · N seats", **Manage**.
- Groups, each row with a 30 px tile icon, label, value and chevron:
  - **Business:** Company profile, Price book, Quote templates, Taxes.
  - **Team:** Crew and roles, Timesheets (the value is shown in accent when something is waiting).
  - **Money:** Payments and payouts, Accounting sync.
  - **App:** Settings, Notifications, Help and support.
- **Sign out** as a white card button in danger red, and the version footer in mono.
- Screens that lived under More but aren't in these groups (Invoices, Schedule, Leads, Contracts, Documents, Compliance, Archive, Group) become rows in the matching group, using the same row part. The list is in Decisions.

### Phase 149: Settings
- A 28 px "Settings" h1.
- **Assistant:** voice picker (3 orbs), Language EN/FR segmented control, "Speak replies aloud", "Ask before sending".
- **Quote defaults:** Province row, then steppers for Deposit % (5), Valid for days (5), Materials markup % (1), and "Send me a copy".
- **Notifications:** Morning brief (6:30), Quote viewed, Payment received, Crew check-ins.
- **Display:** Appearance, Units, Text size.
- **Security:** Lock with Face ID / fingerprint, Export my data.
- **New server settings:** quote validity days, materials markup, copy-to-me, a language override, assistant voice / speak / confirm, and per-kind push preferences. The morning brief is a daily 6:30 local push.

### Phase 150: The assistant
- The black orb button opens the full-screen assistant.
- Home scales to .92 and dims. The layer grows out of the button in a circle.
- The large live orb reacts to listening, thinking and speaking.
- Controls: keyboard, mute and close.
- Keyboard mode: message bubbles, streaming reply with the orange caret, and a glass input with a send button.
- It runs on the existing assistant (`/dashboard/assistant`, `components/assistant`), with dictation and spoken replies. The three voices map to the TTS voices; this is where VOICE-ASSISTANT-PLAN 132–142 lands.

### Phase 151: Every other phone screen, from the kit only
The screens:
- Quotes list, Jobs list, Job, Clients, Client
- Invoices / Money, Invoice
- Schedule, Crew / Team, Timesheets
- Notifications, Me, Leads, Contracts, Documents
- Sign in / Sign up / Welcome
- Crew and foreman home

Each is redone with only the parts above: grey page, white 22 px cards, section headers, rows and pill buttons. No new pattern is introduced.

### Phase 152: Proof and a new test build
- `qa:visual` on the phone widths, EN + FR, with the text at 2×. 44 px targets.
- `qa:devices` journeys and `qa:bundle` budgets. The Geist fonts add about 30 kB.
- A pixel comparison of Home, Quote, Menu and Settings with sample data against the canvas at 390×844.
- New store screenshots, a new `.aab`, then Internal app sharing so the owner can check it on a phone.

## Decisions (the owner's)

1. **Appearance Light / Dark / Auto:** the canvas draws only light. Until dark artboards exist in the canvas, the control stays hidden. *Open.*
2. **Units ft / m / Both:** built as the units the quote writer uses (`business_profiles.units`). Both means as described.
3. **"On the way / 14 min away":** needs live crew location while clocked out (Phase 119 location). Without it, a crew member who is scheduled but not clocked in shows as amber "Starts 7:30". Choose: build live location, or use the scheduled time. *Built as the scheduled time for now (amber "Starts 7:30"); open.*
4. **Menu rows for screens the canvas's Menu doesn't list** (Invoices, Schedule, Leads, Contracts, Documents, Compliance, Archive, Group): proposed as rows in Money / Team / Business, using the same row part. *Built.*
5. **Plan card "N seats":** shown from the subscription; for plans with no seats the line shows only the renewal date. *Built.*

## Rollout switch

Until the owner has checked it on a phone, Pocket is on in the **phone app** and the **dev server**. On the website it is on only for a browser that opened a page with `?pocket=1`; `?pocket=0` turns it off again. Live phone-web users keep the old screens.

Turning it on for everyone is a one-line change: `pocketEnabled()` in `components/pocket/shell.tsx` returns true.

## Owner items

- **`CRON_SECRET` repository secret** in GitHub, with the same value as in Vercel. Without it the morning-brief workflow skips, so no 6:30 brief goes out.
- **WhatsApp:** Send by → WhatsApp shows "not set up" until the WhatsApp templates are approved.
- **Decisions 1 and 3 below** are still open.

## Build log

- **2026-09-29, 143–146, 148** (b875da9):
  - Foundations: Geist and Geist Mono fonts, `pocket.css` tokens, the parts kit and the canvas's icons.
  - The shell: floating tab bar with the assistant button, back and ⋯ header.
  - Home: ECCC weather, composer, week schedule, Today checklist (`today_checks`, migration 0059), Business card (`/api/today/business`), Crew, Sites.
  - Menu.
- **2026-09-29, 147** (16f3cad):
  - The quote screen.
  - Send by SMS (`/api/quotes/:id/send-sms`), and the quote-viewed alert on first open.
  - Quote validity, materials markup and units (migration 0060).
  - Crew check-in push, and the views / checkins / brief notification kinds.
- **2026-09-29, 149** (599f90b):
  - Settings, every row real (`/api/me/preferences`, the new profile fields, text size).
  - Morning brief: `/api/cron/morning`, migration 0061, and `.github/workflows/morning-brief.yml`.
- **2026-09-29, 150** (53bc525): the assistant overlay. Live orb, voice with pause detection, spoken replies, proposals to confirm.
- **2026-09-29, 151** (91aad81):
  - Every other screen re-skinned onto the canvas's parts; the colour tokens remapped.
  - Geist capped at 600 weight.
  - Back to Menu on screens opened from it; welcome and sign-in in the app.
- **2026-09-29, 152:**
  - `qa:bundle` is green after an 8 kB raise on the signed-in shell, recorded in `perf-budgets.json`. The Pocket quote, Settings, Home and the assistant load as their own chunks.
  - Canvas compared screen by screen against local renders of the canvas sources (`dc-runtime.js`). The sample data differs, so the comparison is structural, not pixel-exact.
