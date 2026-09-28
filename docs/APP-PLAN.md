# QuoteAI — The app, and the videos that teach it (Phases 114-131)

Written 2026-09-26. Continues `MOBILE-AND-APP-PLAN.md`: **Track A (Phases 100-113)** makes every screen calm on a phone and rebuilds Settings and Integrations; this document is what comes after it:

- **Track B — The app (Phases 114-126).** QuoteAI on Google Play and the App Store: designed before it is built, instant to open, in sync across every device in real time, working with no signal, and released without a Mac.
- **Track C — Videos (Phases 127-131).** Short guided videos with voiceover in English and French, generated from the real app so they never go out of date, shown inside the app where people get stuck, on the help centre, in the store listings and on social.

Track B starts when Track A's Phases 100-106 are done (navigation, Settings, Integrations, Today, Quotes, Jobs). Track C's pipeline (128) can start any time after 114; the videos themselves are recorded after the screens they show are final.

Same conventions as every plan: one phase per conversation, in order, one commit per phase pushed to `main`, a build-log entry at the bottom, a runbook section when behaviour changes. For every Track B phase that changes what you see: **the phone contact sheets** (MOBILE-AND-APP-PLAN §A.4) and, from Phase 118 on, **a build installed on a real Android phone** before calling it done.

---

## Status

| Phase | Title | Track | State |
|---|---|---|---|
| 114 | The app, designed first: mockups you approve on your phone | B | **built** 2026-09-27 (owner: approve each screen on the phone) |
| 115 | Fast: performance budgets and an instant-feeling app | B | **built** 2026-09-27 (server p95 + web-vitals page owed, see log) |
| 116 | Sync I: open instantly, read offline | B | **built** 2026-09-27 (real-phone check owed, see log) |
| 117 | Sync II: every change queued, merged, and live on every device | B | **built** 2026-09-27 (offline quote creation + real phone owed, see log) |
| 118 | The native shell (Capacitor) | B | **built** 2026-09-27 (real-phone install + store keys owed, see log) |
| 119 | Native powers: push, camera, files, location, voice | B | **built** 2026-09-27 (Firebase project M-6 + real-phone pass owed, see log) |
| 120 | Feels native: motion, haptics, gestures, states | B | not started |
| 121 | First run: welcome, sign-in, permissions, the first quote | B | not started |
| 122 | Accessibility and the device lab pass | B | not started |
| 123 | Beta: pilot testers, in-app feedback, crash reports | B | not started |
| 124 | Google Play release | B | not started |
| 125 | App Store release without a Mac | B | not started |
| 126 | Store listings, release train, live updates | B | not started |
| 127 | Video system: style, voice, the script library | C | not started |
| 128 | Tutorials as code: the recording pipeline | C | not started |
| 129 | Voiceover, captions, music, assembly | C | not started |
| 130 | The videos inside the product | C | not started |
| 131 | Store previews, the homepage loop, social cuts | C | not started |

---

## 1. What "the best experience ever" means here — measurable

A contractor on a roof with one bar of signal, a foreman in a truck, an office manager at a desk: the app is good if all three trust it without thinking about it. Six pillars, each with a number we test against:

| Pillar | Promise | Measured by | Target |
|---|---|---|---|
| **Clear** | Every screen: see the thing, one obvious action | Phone rules enforced in `qa:visual` (Track A); first-screen primary action present | 0 rule violations |
| **Beautiful** | Looks designed, not assembled; consistent everywhere | Screens match the approved mockups (Phase 114) side by side | owner sign-off per screen |
| **Instant** | Opens to real data, never a blank spinner; taps answer immediately | Cold start to content (mid-range Android, 4G); tap-to-feedback; route change | < 1.5 s · < 100 ms · < 300 ms |
| **In sync** | What one person changes, everyone sees — no "refresh" | Office ↔ field propagation time; lost or duplicated changes | < 2 s online · 0 lost · 0 duplicates |
| **Works anywhere** | No signal is a normal state, not an error | Every create/edit in the app works offline and syncs later | 100 % of field + quote/client/note/cost edits |
| **Guided** | Nobody needs to call you to learn it | Help video reachable from every first-time screen; time to first sent quote | < 5 min from install |

Plus the store basics: crash-free sessions > 99.5 %, store rating ≥ 4.6, app size < 30 MB.

## 2. Decisions to make (recorded here once made)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D-1 | Dark mode in the app | none (as the web, Phase 38) / follow the phone's setting | **Decided 2026-09-27 (Phase 114, on the recommendation): follow the phone.** Was: **Follow the phone**, app-only at first: phone users expect it at night and in the store screenshots; it needs a dark palette designed in 114, so decide before 114 |
| D-2 | Tablets | phone only / iPad + Android tablets | **Decided 2026-09-27 (Phase 114, on the recommendation): phone only.** Was: **Phone only** for the first release (no iPad screenshots or review needed); the web already serves tablets |
| D-3 | Store accounts | individual / organisation | Organisation once the business is registered (Phase 99 L-4); individual is fine for internal testing |
| D-4 | Voice of the videos | your own voice / a synthetic voice / a hired narrator | **Your voice for the 60-second overview** (people buy from a person), a consistent synthetic voice for the task guides so they can be regenerated when screens change |
| D-5 | Where videos are hosted | YouTube / a video host (Mux, Cloudflare Stream) / Vercel Blob | **YouTube** for the public library (free, searchable, subtitles) + **self-hosted short MP4s** for in-app clips (no third-party player, no tracking cookies, work in the app) |
| D-6 | Live updates of the app's web code | new store build for every change / an over-the-air update service | Store builds first; decide in 126 once the release train exists (Apple allows JS updates that don't change the app's purpose) |

---

## Phase 114 — The app, designed first: mockups you approve on your phone

No product code. The outcome is a set of screens you have held in your hand and said yes to, so every later phase builds to a picture, not to a description.

- **The app's map, per role**: owner/office (Today · Quotes · Jobs · Money · More), foreman (Today · Jobs · Schedule · Crew · More), worker (Now · Tasks · Report · Me). What each tab shows first, what each screen's one primary action is, what lives in ⋯.
- **Visual language for the app**, extending the web's mockup system: type scale for phones, spacing, the navy + one-accent palette, the dark palette if D-1 says so, status colours, iconography (lucide, consistent weight), how numbers look (money, hours, percentages), photography and empty-state illustration style (quiet line illustrations, no mascots — the owner's standing rule).
- **Motion and feel spec**: sheet and page transitions (duration, easing), what gets a haptic tick (success, destructive confirm, pull-to-refresh threshold), what never animates, reduced-motion fallbacks.
- **High-fidelity mockups** as HTML in `docs/mockups/app/` (the same trick that made the web redesign exact): Today, Quotes list, New quote (typing and dictating), Quote detail, Send, Job page, Photo capture, Crew "Now" with Clock in, Schedule day, Invoice + record payment, Client, Settings menu, Integrations directory, Notifications, Offline and syncing states, Sign-in, the first-run screens. EN + FR text for the longest-label check.
- **Published as a private page you open on your phone** (tap through the screens at real size), with a comment per screen; the phase ends when every screen is approved or changed.

## Phase 115 — Fast: performance budgets and an instant-feeling app

- **Budgets in CI**: JS per route (initial ≤ 180 KB gzipped for the app shell), total per screen, and a Lighthouse mobile run on the main screens; the build fails over budget.
- **Code splitting where it hurts today**: the chart library (395 KB) loads only on the screens with charts; the 430-460 KB App and dashboard chunks split per tab; PDF and signature libraries load on use.
- **Never a blank spinner**: skeletons shaped like the content for every list and detail; images with thumbnails (Phase 96) and fixed aspect ratios so nothing jumps.
- **Taps answer immediately**: optimistic updates for every edit that can be undone (tick a task, change a status, rename, add a note) with a quiet undo; prefetch the detail screen when a row is pressed, before it's released; lists virtualised past ~50 rows.
- **Server side**: the slowest list endpoints (`qa:perf`) under 200 ms p95 for a 5-year-old company's data volume; payloads trimmed to what the list shows.
- A **performance page in the admin** (web-vitals from real devices via the existing error/telemetry pipe).

## Phase 116 — Sync I: open instantly, read offline

Today every launch starts empty and refetches everything; with no signal only the crew pages work.

- **Persisted cache**: React Query's cache saved to IndexedDB per signed-in user (encrypted at rest on the device by the OS), restored before the first render — the app opens to the last known data, then refreshes in the background with a subtle "Updated just now".
- **What is kept offline**: today's and this week's jobs with their milestones, tasks, crew and addresses; the last 90 days of quotes, clients and invoices; the price catalog; the user's schedule. Sized and pruned (target < 20 MB).
- **Freshness rules** per query (`staleTime`): lists refresh on focus/resume, details on open, reference data (catalog, tax profiles) daily — instead of today's refetch-everything default.
- **Sign-out wipes** the cache and the outbox; switching company (groups, Phase 90) switches cache.
- **Offline banner** that is calm and specific ("Offline — showing what was synced at 9:42. Changes will send when you're back.").

## Phase 117 — Sync II: every change queued, merged, and live on every device

- **One outbox for everything**: the Phase 77 outbox (11 field operations today) generalised to every create/edit/delete the app offers — quotes (including drafts made offline and generated by AI when back online), clients, notes, tasks, milestones, costs, time, invoices drafts, messages. Each operation carries a client id; the server treats a replay as the same operation (**idempotency keys** on every mutating route, as photo upload already does).
- **Conflicts, honestly handled**: every editable row gets a version (`updated_at` precondition); a stale write answers 409 with the current row; the app merges field-by-field when the two edits touched different fields and asks only when they collide ("Pat changed the end date to Oct 14 while you were offline — keep yours or theirs?").
- **Live updates**: a per-company change stream — Supabase Realtime on the key tables, or a server-sent-events endpoint fed by a `changes` log — tells every open app "job X changed", which invalidates exactly that query. The foreman ticks a task, the office sees it within 2 s; a client accepts a quote, the contractor's phone updates without a refresh.
- **Sync status everywhere it matters**: a small indicator (synced / sending 3 / 1 needs attention) and a Sync screen listing waiting and failed changes with retry and discard — the existing outbox UI, extended.
- **Tests**: an e2e suite that runs two devices against one server — offline edits on both, reconnect, assert no loss, no duplicate, correct merge; plus a chaos run (random disconnects during replay).

## Phase 118 — The native shell (Capacitor)

- `artifacts/mobile` (Capacitor 7+) wrapping the quote-ai client build: `appId ca.quoteai.app`, name QuoteAI, **bundled assets** (not a remote-URL shell), icons and splash from the brand.
- **Auth for a bundled app**: the WebView origin is `capacitor://localhost` / `https://localhost`, so cookies to quoteai.ca are third-party. Use better-auth's **bearer** plugin (already enabled): the token in the device keychain/keystore, sent as `Authorization`; CORS and `TRUSTED_ORIGINS` for the app origins; 2FA flow checked; optional Face ID / fingerprint to reopen.
- `isNativeApp`: purchase UI hidden (App Store 3.1.1 / Play payments — subscriptions are managed on the website; on iOS the app may not even point there to buy); no marketing site or cookie banner; opens to sign-in or Today.
- **Links**: `/p`, `/sign`, `/i`, `/join` from email stay in the browser (they're for clients); `quoteai.ca/dashboard/*` opens the app when installed (Android App Links, iOS Universal Links — `assetlinks.json` and `apple-app-site-association` served by the site).
- Status bar, safe areas, Android back = history, keyboard resize, pull-to-refresh.
- CI: an Android build on every push to `main`, downloadable from the run.

## Phase 119 — Native powers: push, camera, files, location, voice

These are also what makes Apple accept it as an app, not a website (Guideline 4.2).

- **Push**: Firebase Cloud Messaging for both platforms (FCM relays to Apple's APNs using an APNs key made in the Apple developer site — no Mac). A `device_tokens` table beside the Phase 77 web-push subscriptions; every notification reaches the devices too; tapping opens the exact screen; per-type preferences respected. Permission asked when it explains itself ("Know the moment they accept?" after the first quote is sent), not at launch.
- **Camera**: job photos, receipts and documents through the native camera with a document mode (edge detection for receipts), compressed on device, queued in the outbox.
- **Files**: PDFs saved and shared through the native share sheet; import a PDF/photo *into* QuoteAI from other apps (Android share target; iOS later if a share extension is worth the native code).
- **Location**: clock-in location while in use, with plain-language permission text; the job address opens the phone's maps app.
- **Voice**: dictation for new quotes and job notes with the microphone permission; works offline to record, transcribes when back online.
- **Home-screen shortcuts** (long-press the icon): New quote, Clock in, Snap a receipt.

## Phase 120 — Feels native: motion, haptics, gestures, states

- The Phase 114 motion spec implemented: page push/pop transitions, sheets that follow the finger, spring on release, reduced-motion respected.
- Haptics on the moments that matter (sent, signed, paid, clocked in, delete confirm) and nowhere else.
- Gestures: swipe back (iOS), swipe a row for its one quick action (approve hours, mark paid, call the client), pull to refresh, long-press for ⋯.
- **Every state designed**: empty (what this is, the one action, a "watch how" video link — Track C), loading (skeletons), error (what happened, retry, never a stack trace), offline, no permission, plan-locked. A catalogue page of all of them in the preview routes, checked in the sheets.
- Text that fits: every label checked in French (longest) at the phone's largest text size.

## Phase 121 — First run: welcome, sign-in, permissions, the first quote

- Welcome (three calm screens, skippable, no marketing wall) → sign in / create account → company basics (province and trade first — they drive taxes and suggestions) → **the first quote, guided**: dictate or type one real job, watch it price, send it to yourself to see what the client gets. Target: first quote sent in under 5 minutes from install.
- Permissions asked at the moment of use, each with a one-line why.
- Invited crew get a different first run: join code or invite link → their "Now" screen, no company setup.
- A 60-second overview video (Track C) offered once, never forced.

## Phase 122 — Accessibility and the device lab pass

- The phone's text-size setting honoured up to the largest sizes without clipping; contrast; 44 pt targets; VoiceOver and TalkBack labels and reading order on every Track A/B screen; focus after navigation.
- A **device lab run**: a small matrix — a low-end Android (2-3 years old), a current Android, an iPhone SE-size and a large iPhone (owned, borrowed or on a cloud device service) — through the ten core journeys; findings fixed.
- Battery and data: no background polling when the app is closed; photo uploads on Wi-Fi only if the user chooses.

## Phase 123 — Beta: pilot testers, in-app feedback, crash reports

- **TestFlight** (iOS) and **Play internal/closed testing** (Android) with the pilot contractors; a short "what to try this week" note per build.
- **In-app feedback**: shake or ⋯ → "Send feedback" captures a screenshot, the screen, app version and sync state, and lands in the admin with the user.
- **Crash and error reporting** for the native app (Sentry's Capacitor SDK on the existing Sentry project), release health per version; the go/no-go for store release = crash-free > 99.5 % over the beta.
- The Play **closed test with 12 testers for 14 days** (required for personal developer accounts) is run here if D-3 is "individual".

## Phase 124 — Google Play release

- Release-signed app bundle from GitHub Actions (upload key in secrets, Play App Signing holds the app key), version codes from the build number.
- Store listing EN + FR, **Data safety** answered from the privacy policy's recipient list, content rating, current target API level, the account-deletion URL.
- Internal → closed → production with a staged rollout (20 % → 100 %), watching crash rate and reviews.

## Phase 125 — App Store release without a Mac

- `codemagic.yaml`: build the web assets, `cap sync ios`, **automatic code signing through the App Store Connect API key** (no Keychain, no Xcode), build, upload to TestFlight; a tag submits for review.
- `Info.plist` permission texts (camera, photos, microphone, location when in use), push entitlement, privacy manifest, **App Privacy labels** from the recipient list; no tracking SDKs, so no App Tracking Transparency prompt.
- Review notes that pre-empt the usual rejections: the native features (push, camera, offline field mode, location clock-in), where account deletion is, that the app sells nothing and subscriptions are managed outside it, a demo login with a seeded company.
- iPhone only, portrait (D-2).

## Phase 126 — Store listings, release train, live updates

- **Screenshots** from the real app at every required size, EN and FR, captioned in the product's voice (from the preview routes + Codemagic's iOS simulator for true frames).
- **Release train** in the runbook: a tag builds both stores; staged rollout; halt and roll back; what a web deploy changes and doesn't change in the app; the checks before every submission (`qa:visual`, phone sheets, a real-device install, the sync e2e).
- D-6 decided (store builds only, or an over-the-air service for the web bundle).
- `ops:owner-check` gains the app items (store accounts, CI keys present, last green build per platform, crash-free rate).

---

## Track C — Videos

**The idea: tutorials as code.** Each video is a script in the repo — narration lines and the steps to perform. A pipeline drives the *real* app (the fake-data showcase company, like `qa:visual`) at phone size, records it, adds the voiceover, captions, tap highlights and gentle zooms, and exports finished files in English and French. When a screen changes, the video is re-rendered, not re-shot — so the help never shows an old screen.

Style (from the standing design rule: professional, no AI mascots or presenter avatars): the app on a clean phone frame over a calm background, a real finger-tap indicator, zoom-ins on what matters, short on-screen captions, a warm human voice, quiet music, 45-90 seconds each.

### The library (first release)

| # | Video | Length |
|---|---|---|
| 1 | QuoteAI in 60 seconds (overview — D-4: your voice) | 60 s |
| 2 | Your first quote: describe it, check it, send it | 75 s |
| 3 | Getting the quote accepted: what your client sees | 45 s |
| 4 | Your price list: make the AI price like you | 60 s |
| 5 | From accepted quote to signed contract | 75 s |
| 6 | Starting the job: milestones, crew, schedule | 75 s |
| 7 | Your crew's app: clock in, tasks, photos, reports | 75 s |
| 8 | Photos and dictation on site | 45 s |
| 9 | Costs and receipts: snap it, it's filed | 45 s |
| 10 | Change orders the client signs on their phone | 60 s |
| 11 | Invoices, deposits, holdback — and getting paid by card | 75 s |
| 12 | QuickBooks: set up once, then it's automatic | 60 s |
| 13 | Your calendar and the schedule board | 45 s |
| 14 | Team, roles and join codes | 45 s |
| 15 | Leads from your website: the widget | 45 s |
| 16 | Working with no signal | 30 s |

Each in English and French (Québec French voice), vertical 1080×1920 for phones and social, horizontal 1920×1080 for the web and YouTube.

## Phase 127 — Video system: style, voice, the script library

- **Style frame**: one finished 15-second sample in both orientations (phone frame, background, type, tap indicator, zoom, caption style, lower-thirds, music level) approved before anything else is produced.
- **Voice (D-4)**: sample the same script in 2-3 synthetic voices per language — including a genuine **fr-CA** voice (Québec audiences notice a France-French voice immediately) — and your own voice recorded on a phone; choose.
- **Script format** in `docs/videos/<slug>.md`: title, goal, the narration per beat (EN + FR written, not machine-translated line by line), the app steps per beat, the on-screen caption per beat. All 16 scripts drafted and reviewed in this phase (reading them aloud is the test: short sentences, one idea each, the viewer's words).

## Phase 128 — Tutorials as code: the recording pipeline

- `pnpm video:record <slug>`: seeds the showcase company, opens the app at phone size in Chrome (and the native Android build later if needed), performs each beat's steps with realistic pacing (typing speed, pauses where the narration explains), records video per beat, and writes a timeline (beat start/end, tap coordinates, elements to zoom).
- Deterministic: fixed dates, fixed AI responses (the recorded quote is always the same good quote), no network flakiness — the same trick the e2e harness uses.
- Runs in CI on demand; a changed screen shows up as a changed video diff (first frame of each beat compared).

## Phase 129 — Voiceover, captions, music, assembly

- Narration per beat synthesised (or your recorded takes dropped in), with word timings; beats stretch or trim so the picture waits for the voice, never the reverse.
- **Captions** from the script with the real timings: burned-in for social cuts, soft (VTT) for the web and in-app, EN and FR.
- Assembly with ffmpeg: phone frame, background, tap rings and zooms from the timeline, intro/outro cards (the logo, one line), music bed ducked under the voice, loudness normalised for phones (−16 LUFS).
- `pnpm video:build <slug> --lang en|fr --format vertical|horizontal` → MP4 + VTT + a poster frame; `video:build --all` renders the library.

## Phase 130 — The videos inside the product

- A **"Watch how"** link on each first-time and empty screen (Quotes with no quotes, Jobs with no jobs, Integrations, the crew's first day…), opening a clean in-app player (captions on by default, sound off-friendly, 1.5× option), the right language automatically.
- The **help centre** (`/help`, ten guides from Phase 70) gets the matching video at the top of each article; a `/help/videos` library page.
- First-run (Phase 121) offers the 60-second overview once.
- Videos self-hosted for the app (small MP4s, no third-party player, no tracking); the public library on YouTube (D-5) with chapters and both caption tracks, embedded on the site with the privacy-enhanced player.
- Analytics: which videos are started and finished, which screen they were opened from — to learn where people get stuck.

## Phase 131 — Store previews, the homepage loop, social cuts

- **App Store preview videos** (up to 30 s, the exact device sizes Apple asks for) and the **Play promo video**, cut from the library.
- A silent 20-second **homepage loop** of the first quote being made (replacing a static hero image on phones; lightweight, poster first).
- **Social cuts**: 15-30-second vertical versions of the best moments (the 30-second quote, the client signing on their phone, the receipt snapped and filed) with burned-in captions for sound-off viewing, EN and FR — ready for Reels, TikTok, Shorts and posts like the Reddit launch.

---

## Owner items for Tracks B and C

| # | Item | When | Cost |
|---|---|---|---|
| M-1 | D-1 … D-6 decisions (§2) | before 114 (D-1, D-2), before 124 (D-3), before 127 (D-4, D-5) | — |
| M-2 | Approve the app mockups on your phone | Phase 114 | — |
| M-3 | Google Play Console account + identity verification | before 123 | US$25 once |
| M-4 | Apple Developer Program enrolment (organisation needs a D-U-N-S number — free, days to weeks) | before 123 | US$99 / year |
| M-5 | App Store Connect API key → Codemagic (the assistant says which role and where) | before 125 | free tier to start |
| M-6 | Firebase project + the APNs key uploaded to it | before 119 | free |
| M-7 | Test phones: an iPhone (borrowed/used) and a low-end Android | before 122 | ~$150-250 used |
| M-8 | 5-10 pilot contractors for the beta (and 12 testers × 14 days if the Play account is personal) | Phase 123 | — |
| M-9 | A demo login for App Review (the assistant seeds it) | Phase 125 | — |
| M-10 | Voice: record the overview script on your phone in a quiet room, or pick the synthetic voices | Phase 127 | TTS: a few dollars for the whole library |
| M-11 | YouTube channel for QuoteAI | before 130 | free |

---

## Build log

*(one entry per phase: date, built, found, deferred, verification — sheets, a real-device install, the sync suite)*

### Phase 114 — 2026-09-27

- **Built:** `docs/mockups/app/index.html` — 25 screens drawn at phone size (390 × 844), every one in English and French (`fr-CA` numbers: 14 500 $, 7,5 h, 9 h 42) and in light and dark, with tap-through navigation that shows the motion spec (push, pop, tab cross-fade, sheet), a full-screen mode to hold on the phone, the screen's first-screen / one-action / ⋯ notes beside it, and **Approve / Ask for a change** per screen saved in the page's database (read back with ArtifactData, collection `reviews`, one doc per screen id). Published privately: https://claude.ai/artifact/Jx2qihtQht7soqPR67yZ2T. `docs/APP-DESIGN.md` is the written spec later phases build from: the map per role, each screen's primary action, the light and dark tokens, type, spacing, icons, numbers, empty states, and the motion and haptics table.
- **Screens:** Today, Quotes, New quote typing and dictating, Quote, Send, Jobs, Job, Photo capture, Money, Invoice + record payment, Client, Assistant (from VOICE-ASSISTANT-PLAN's calm design, so it is in the approved app), Notifications, More, Integrations, Offline, Sync with a conflict, Foreman Today, Schedule day, Crew Now with Clock in, Welcome, Sign in, First run, First quote sent + the notification ask.
- **Decided:** D-1 dark follows the phone, D-2 phone only (the plan's recommendations; change them here if not).
- **Choices worth a look:** violet is the assistant's colour and nothing else; dark mode's primary button is pale lavender with navy text (a navy button disappears on a dark ground); money has no cents in lists, cents on invoices; the camera is always dark; Money gets a tab of its own for owners (Pay and Books as rows inside it on a phone); no prices or upgrade anywhere in the app build.
- **Found:** the web design system is light-only (Phase 38), so the dark palette is new and app-only; Integrations logos are drawn as letters in the mockup, the real logos (Phase 103) go in the build.
- **Owed (owner, M-2):** open the page on the phone, go through all 25 screens in both languages and both themes, Approve or Ask for a change on each. The phase closes when all 25 are approved; changes are made to the mockup and re-published to the same link.


### Phase 115 — 2026-09-27

- **Budgets in CI** (`perf` job in `.github/workflows/test.yml`, its own job so the red knip step can't hide it): `pnpm --filter @workspace/quote-ai qa:bundle` adds up the gzipped JavaScript a cold visit downloads for 25 screens (the app shell in EN and FR, 14 signed-in screens, onboarding, 8 public and client pages) from the Vite manifest plus a chunk map the build now writes, against `artifacts/quote-ai/perf-budgets.json` (measured + ~4 kB); no single chunk on those screens over 75 kB. Then Lighthouse's mobile profile on `/`, `/fr/`, `/pricing/`, a city page and `/sign-in/` with a CI floor of 75 (local target stays 90; noindex pages aren't held to SEO 100). Reports are uploaded as a run artifact.
- **Code splitting:** the strings now come **one language at a time**. They're still authored as `{ en, fr }`; an `i18n-split` Vite plugin emits `strings-core-en/fr` and `strings-dashboard-en/fr`, and `i18n/registry.ts` loads the one in use: before the first render (main.tsx, alongside the App chunk), with the dashboard layout/onboarding/admin (`withDashboardStrings`), and before a language switch. **Recharts** (108 kB gz) is off Today and the job page (the charts are lazy, with skeletons of their height). **Home, the public layout, the 404 page and the toast viewport** are lazy, out of the chunk every signed-in screen loads. **Settings** loads one section at a time (was all twelve, 38 kB gz).
- **The app frame stays up:** the whole signed-in app is one route (`DashboardApp` in App.tsx), so the sidebar, top bar and tab bar no longer unmount on every tab tap, and a page waiting for its chunk shows a page-shaped skeleton inside the frame instead of blanking the screen. Nav links prefetch their page's chunk on hover/press, and the first eight sections' chunks are fetched while the phone is idle (not on data-saver/2G). Pages still remount per URL, as before.
- **Found and fixed — the marketing homepage on app routes:** Vercel answered every route without its own file with `index.html`, which is the prerendered homepage, so `/dashboard`, a client's `/p/…` link and `/sign-in` showed the marketing hero until React replaced it. Now `/dashboard/*` gets **`app.html`** (the app frame drawn in HTML with a skeleton — the first paint of the app, the same markup the router shows while loading) and every other route `spa.html`; `serve.mjs` and the service worker (offline fallback, precache of both shells, the layout and all four string packs) do the same. build-sw's App pattern had lost its backslashes and matched nothing.
- **Found and fixed — layout shift on the public site:** production had CLS 0.23 on `/fr/` and 0.17 on `/` (Lighthouse, mobile). Figtree's `@font-face` lived only in the stylesheet that Beasties defers to the end of `<body>`, and the fallback stack had no metric match. Now both Figtree's rule and a weight-banded, metric-matched **Figtree Fallback** (Arial/Liberation/Arimo, ratios measured in the page) are inlined in every prerendered page, and Figtree is `font-display: optional` (the `/fr/` hero's first line is exactly as wide as a 412 px phone, so any swap rewrapped it). Now CLS is 0.000 on all five.
- **Never a blank spinner / taps answer at once** (`components/skeletons.tsx`, `lib/optimistic.ts`, `hooks/use-prefetch-on-press.ts`, `hooks/use-progressive-list.ts`): content-shaped skeletons (appearing after 300 ms) on every list and detail and on Today; optimistic edits with a 5 s Undo for task tick/untick/delete, job start/hold/resume and rename, milestone start, notes add/delete, quote archive (Undo = restore), lead stage moves, mark-read; deletes with Undo are sent after the Undo window (or on `pagehide`); detail screens' chunk and data prefetched on row press (quote, job, invoice, contract, client — same query keys as the pages); phone rows use `content-visibility: auto`, tables render 50 rows then the rest when idle; avatars and the quote logo have fixed sizes.
- **Numbers** (gzip -9, kB): app shell EN **319 → 295**, FR 329 → 305; App chunk 142 → 56; dashboard strings 130 → 62 (EN) / 69 (FR); Today 350 → 328 and no recharts; Job 382 → 361; Settings 369 → 309; Home 212 → 209 (with its own chunks now counted); sign-in 214 → 189. Lighthouse local (serve.mjs, 3 runs): perf 81 / 81 / 82 / 81 / 87, CLS 0 everywhere.
- **Not met — the 180 kB shell target:** React DOM (67) and one language of the 8,000-key dashboard dictionary (62) are already 129 kB before any app code. Getting to 180 would need strings split per screen (keys are built dynamically in places, so a miss would show raw keys) — not worth the risk now; the budget holds the line at 305/310. In the Capacitor build (118) the bytes are local and only parse time counts.
- **Blocked this session (owner decision):** (1) *server p95 < 200 ms at a 5-year company's volume* — raising `qa:perf` to ~1,500 quotes/250 jobs and adding indexes means seeding and migrating the database in `.env.staging`, which **is production**; the permission gate refused it. Run it once a separate staging project exists (Phase 99 L-5), or approve running it against production. (2) *the admin performance page with web vitals from real devices* — needs a new `web_vitals` table and a public `POST /api/telemetry/vitals`; also refused as a production change. Both are ready to build on a yes.
- **Also found:** CI's `test` job has been red since Phase 112 on knip (unused exports/deps), so its typecheck/tests/build steps never ran; `docs/ROUTE-MATRIX.md` was generated with the stray " - Copy" route files in it (966 routes vs 487), so the route-matrix test fails locally depending on those files. Left for a separate fix.
- **Verification:** full build (440 pages prerendered), `qa:bundle` all within budget, Lighthouse as above, typecheck clean, lint 0 errors in the changed files, unit tests pass except the pre-existing route-matrix one, i18n audit clean (bar a " - Copy" file), `app.html`/`spa.html` routing checked on the built site at 412 px and desktop. Not verified: the signed-in screens in a browser with a real session (the walkthrough API needs the production database), and a real phone.

### Phase 116 — 2026-09-27

- **Built — the app opens from the device.** React Query's cache is saved to IndexedDB (`quoteai-offline` → `query-cache`), one record per person and company, and put back before the first render on `/dashboard/*` (`main.tsx`, capped at 400 ms so a slow disk shows the skeleton frame instead of waiting). While the first refresh runs a quiet pill says *Showing what was saved at 9:42 · updating…*, then *Updated just now* (floats above the tab bar, no layout shift). The restored person counts as signed in while the session check is on its way and when it can't be answered (no signal), so the app neither waits on a skeleton nor shows the "can't reach QuoteAI" card; when the check answers, its answer wins. Code: `lib/query-client.ts`, `lib/offline/query-policy.ts`, `query-cache.ts`, `cache-state.ts`, `warm.ts`, `week.ts`.
- **What is kept, how fresh** (`query-policy.ts`, unit-tested with `pnpm --filter @workspace/quote-ai test`, now in the root `pnpm test`): reference data (catalog, tax profiles, company profile, me, team-orgs, subscription) fresh for a day; lists (quotes, clients, jobs, invoices, contracts, leads, schedule, Today, agenda, notifications, crew) 30 s and refreshed on focus/reconnect; details (quote, job, invoice, contract, photos, notes) on every open. Nothing else is saved — admin, assistant, bank feeds, audit logs, connect links and token pages stay out. Newest first up to 20 MB, nothing older than 7 days, unused answers kept in memory a day. No retries with no signal (fail at once, keep the saved answer, refetch on reconnect). Job, invoice and contract pages now show the saved answer when a refresh fails instead of "Not found".
- **What is fetched ahead** (`warm.ts`, once per start, idle, not on data-saver/2G, only what the role can open): quotes, clients, catalog, tax profiles, company profile, jobs and invoices lists, this week's schedule (the schedule page's own key) and the full page of up to 15 jobs running or planned this week — milestones, tasks, crew, address.
- **Privacy on the device:** sign-out deletes every record, the pointer and the outbox (plus the service worker's `qai-api`, as before); opening sign-in / sign-up deletes the records too; a session for someone other than the saved record's owner drops it before the frame draws; a company switch points the next launch at that company's record and clears `qai-api` (which is keyed by URL, not company — it could have served the old company's jobs offline); leaving or joining a company forgets the record.
- **Offline banner:** *Offline — showing what was synced at 9:42; changes will send when you're back.* (or *…; 3 waiting to send.*), time in the page's language (fr-CA *18 h 33*), from the last answer that really came from the server.
- **Found and fixed:** an explicit `gcTime` makes TanStack schedule a real timer on the server, so `prerender-seo` rendered 440 pages and then never exited (it would have hung CI's build); the server gets `Infinity` (no timer) as TanStack's default does.
- **Numbers** (gzip kB, qa:bundle vs Phase 115 measured the same way): app shell EN 296.3 → 301.2, FR 305.7 → 310.5; public pages +2.6-2.8 (sign-in 189.1 → 192.0, home 209.0 → 211.7); crew `/t` 219.8 → 223.1. The persistence code is its own 1.3 kB chunk loaded by the signed-in app only; what every page pays is TanStack's hydrate/dehydrate in the shared vendor chunk (~1 kB), the freshness policy (0.7) and a small state module (0.7). Budgets raised to measured + ~4 on the four screens that crossed: shell FR 315, Jobs 320, Job 370, Settings 320.
- **Verification:** typecheck clean, lint 0 errors, 8 unit tests, i18n audit unchanged, full build (prerender exits), qa:bundle all within budget. In the dev server against a throwaway mock API (the walkthrough API needs the production database): record written under `u1:u1` with the profile; with the API **hanging completely**, a reload drew the jobs list from the device with the "saved at" pill (EN, 375 px); the warm-up fetched exactly the planned set; the offline event showed the new banner; sign-out and opening `/sign-in` left no record, no pointer and an empty outbox; a session for another user replaced the old record with the new user's only.
- **Not verified / owed:** a real phone (the Capacitor build is 118) and a real account on production data — the sizes of real records (the 20 MB cap has not been hit in a test), and the service worker's offline path in the production build together with the restore. **Accepted trade-off:** while the session check is in flight, the saved data of whoever last used this browser is on screen — that is what makes it open instantly; if their session has ended they are sent to sign-in as soon as the check answers.

### Phase 117 — 2026-09-27

- **Built — one path for every write** (`artifacts/quote-ai/src/lib/sync/`). `install.ts` wraps `fetch` once; the first write loads `sync-fetch.ts`, which gives every same-origin POST/PUT/PATCH/DELETE an **Idempotency-Key**. The edits in `routes.ts` — job, milestone, task (add / tick / edit / delete), note (add / delete), cost (edit / delete), quote, draft invoice, schedule block, lead — are also **queued in the outbox** when there is no signal, when the request dies on the way, or when older edits of the same job are still waiting, and the screen gets the route's answer as it will be (202, `X-Queued: 1`, the row as the phone knows it with the edit on top), so the optimistic screens of Phase 115 simply stay. A queued create gets a stand-in id `q_<op id>`; a later queued edit of that row uses it and the replay swaps in the real id (create a task offline, tick it offline → one task, done). The Phase 77 outbox is the same outbox: the `api` op sits beside the 11 field ops.
- **Built — idempotency on every mutating route** (`api-server/src/lib/idempotency.ts`, mounted on `/api`): the first request claims the key, its JSON answer (status < 500) is stored **before** it is sent (on Vercel the function can freeze right after the response), a replay gets that answer with `Idempotent-Replayed: true`; a 5xx, a file answer or a crash frees the key; the same key with another body is 422; a key still running is 409 `IDEMPOTENCY_IN_PROGRESS` (the outbox retries); a claim left by a killed function is taken over after 2 min; if the table can't be reached the request runs as before. Table `idempotency_keys`, pruned after 7 days by the daily cron.
- **Built — conflicts, honestly handled.** Editable rows carry their version (`updatedAt` added to the milestone, task and cost answers; jobs, quotes, invoices, schedule blocks and leads had it). `rejectStale` (`lib/versioning.ts`) on the job, milestone, task, cost, quote, invoice, schedule-block and lead edit routes: an edit sent with an old `X-Base-Version` is not applied and gets 409 `STALE` with the row as it is now. The app merges field by field (`merge.ts`): fields the other side left alone are sent again on the new version without asking, a field already set to our value is dropped, and only a field **both** changed becomes a conflict. The base is the server's row, never the optimistic screen (`versions.ts` records every server answer, including the cache put back at launch, and skips hand edits). Two edits of one row don't collide with each other: live ones are sent one at a time, queued ones are rebased on each answer (tick + Undo, or three taps in 150 ms, are three clean 200s).
- **Built — the conflict card**: the sync bar says *1 change needs you — it was also changed on another device* and, per field, **Now** (what the row says) and **Yours**, each with Keep; the edit is re-sent (keep mine) or dropped (keep theirs) once every field is decided. Values read as people read them (dates, money, *To do / Done*, *À faire / Fait*). EN + FR, 44 px targets on a phone.
- **Built — live on every device.** A trigger (`qai_log_change`, on 16 tables: jobs, milestones, tasks, notes, photos, costs, time, field reports, change orders, schedule blocks, quotes, quote variants, clients, invoices, contracts, leads) writes an id-only row to `change_log` for every insert/update/delete from anywhere — the app, a crew link, a client accepting a quote, an automation. `GET /api/changes?after=<cursor>&wait=25` is a long poll that answers as soon as the company has something newer (checks once a second, ids only, no content; another company's changes never appear). The app keeps one open while it is visible and online, refetches exactly the queries that show those rows (`affects.ts`), skips the echo of its own edits, stops in the background and catches up from its cursor when shown, and backs off 30 s → 5 min if the feed can't be reached. Pruned after 2 days (an older cursor gets `reset` = refetch what's on screen). **Chosen over Supabase Realtime**: the app signs in with better-auth, not Supabase Auth, so Realtime's row security would need a second token system; a long poll works with cookies now and with bearer tokens in the Capacitor app (118), and on Vercel functions.
- **Also:** a company switch is refused while this company still has changes waiting (they would be sent into the other company); the route-matrix script skips the stray " - Copy" files (the local route-matrix test failure noted in 115 is gone); e2e cleanup also clears the feed rows. Migration `0057_phase117_sync.sql` applied to the linked database (16 triggers confirmed).
- **Numbers** (gzip kB vs Phase 116): app shell EN 301.2 → 304.6, FR 310.5 → 314.1; public pages +1.2–1.7 (only the installer and the conflict card's strings — the write path, the outbox replay and the live feed are chunks of their own); crew `/t` 223.1 → 225.6. Budgets raised to measured + 4 on the 11 screens that crossed (shell 309 / 318).
- **Verification:** typecheck clean (bar the " - Copy" files), lint 0 errors, knip clean for the new code, **22 web unit tests** (merge, route table, which queries a change touches, the protocol against a model server: two devices editing one job offline — different fields merge, the same field asks — and a seeded **chaos run**, 25 % drops before and 25 % after the server applies, 80 edits + 10 creates: every edit lands, the last value of each field wins, every create exactly once), **8 idempotency unit tests**, **5 e2e tests on the real server and database** (replayed create answered not redone; stale job/task edit → 409 with the row now, merged re-send applied; the other device's long poll woke with exactly the changed task in < 2.5 s, another company's stayed quiet, signed-out 401; chaos: 24 creates from two devices through 30 % + 30 % drops → exactly 24 rows), and the neighbouring suites (offline, lifecycle, schedule, quotes all pass; money has one pre-existing failure — it expects cash-flow gated at Elite, the server says Business since the 2026-09 pricing). i18n audit unchanged, full build (prerender exits), qa:bundle within budget, route matrix 488 routes. **In the browser against the real API** (walkthrough server + seeded company, 1280 px and 375 px): an office rename appeared on the open job page in ~1.4 s with no reload; a rename made offline was queued with the server's version as its base, the other device renamed the same job and changed its address meanwhile, back online the card asked *Now / Yours* for the name only (the address came through) and Keep mine left the server with the foreman's name and the office's address; a task ticked offline while the office set it back → the card on a phone, Keep theirs dropped the edit; a task created and ticked offline replayed as one task, done.
- **Not done / owed:** quotes **created** offline, and AI generation of an offline draft when back online (the new-quote flow is not in the route table: it navigates to the new quote's id and runs the AI on the server — its own piece of work); client-thread messages; a two-browser UI e2e (the two-device suites run at the API level and in the model); a real phone (Capacitor is 118). **Known limits:** a write committed after a later feed id was read can be skipped by the cursor (the next focus refresh shows it); a job rename refreshes the job, lists, Today and the schedule but not every screen that prints the job's name (Pay shows it on its next refresh); coming back online, a list refetch can briefly show the server's state before the outbox has sent the queued edit. **Cost to watch:** each visible signed-in app makes ~2.4 feed calls a minute and one small indexed query a second while waiting (Hobby plan invocations; `WAIT_S` in `live.ts`).

### Phase 118 — 2026-09-27

- **Built — `artifacts/mobile`** (Capacitor 8.5, `ca.quoteai.app`, "QuoteAI"): the quote-ai client built with `vite build --mode native` into `www/` (4.5 MB: marketing images, the service worker and SEO files dropped) and **bundled** — it opens from the phone, not from quoteai.ca. `isNativeApp` / `API_ORIGIN` are build-time constants (`lib/native/env.ts`), so the website's bundle carries none of it (grep of `dist/public` for the native code: nothing). Android project committed (min SDK 24, target 36), launcher icons (adaptive + legacy + round) and launch screens drawn from the brand mark by `scripts/icons.ts` (one source: `quote-ai/public/icon-512.png`), plus the 512 px store icon. Plugins: app, browser, keyboard, splash screen, status bar, secure storage. **Debug APK: 10.4 MB** (target < 30 MB). No cloud backup or device transfer of the app's data (it holds the company's cached quotes, clients and jobs).
- **Built — sign-in for a bundled app.** The WebView is `https://localhost` (Android) / `capacitor://localhost` (iOS), so a quoteai.ca cookie would be third-party: the app's `fetch` (`lib/native/fetch.ts`, installed before anything captures `window.fetch`, so the Phase 117 sync layer, the outbox replay, the live feed and better-auth all use it) sends every `/api` call to `API_ORIGIN` with `credentials: "omit"`, keeps the `set-auth-token` that better-auth's **bearer** plugin returns in the Android Keystore / iOS Keychain (`session.ts`, secure-storage plugin) and sends `Authorization: Bearer`. Server: `lib/nativeApp.ts` answers CORS for exactly those two origins **without credentials** (mounted before the auth handler, which answered before the general CORS middleware), exposes `set-auth-token` / `X-Active-Org` / `X-Auth-Cookie`, and drops any `Cookie` header from the app's origin; better-auth trusts the two origins for its sign-in Origin check. The acting company, a cookie on the website, is the **`X-Active-Org`** header (`setActiveOrg` sets both on every switch / join / leave; membership is checked per request either way). **Two-step verification**: better-auth keeps the half-signed-in state in a cookie, so for the app only that one cookie (`better-auth.two_factor`) travels in `X-Auth-Cookie`; a session cookie smuggled through it is dropped. Sign-out clears the token and the company.
- **Built — the app is the app.** It opens on Today or sign-in, never the marketing site; `/` and `/fr` mean the app's home; any other site page (Terms, Privacy, help, a client's `/p` link) opens on the website in an in-app browser tab (`@capacitor/browser`) and the app stays put; external `https` links and `window.open` do the same. Sign-in / sign-up render without the site header, menu or footer. **It sells nothing** (App Store 3.1.1, Play payments policy): `UpgradeLink` replaces the 15 "Upgrade" links; `/dashboard/billing` opens Plan, which shows the plan and usage with *Plans can't be changed in the app.* instead of the plan grid and the Stripe portal; the quote paywall, Today's upgrade cards, the WhatsApp upsell, the logo upsell, the catalog and contract locks and onboarding's checkout step are left out or neutral (EN/FR). Images the API serves only to a signed-in person (job photos, receipts, avatars, logos) go through `ApiImg`, which fetches them with the token (an `<img>` cannot send one).
- **Built — the phone around it** (`lib/native/shell.ts`): Android back closes an open sheet / dialog / menu first, steps back through the app, and leaves the app from Today / sign-in; `quoteai.ca/dashboard/*` links open that screen (App Links with `autoVerify`; also a cold start from a link); the launch screen stays until the first screen draws (4 s cap); dark status-bar icons on the light app; edge-to-edge with the real insets from Capacitor's SystemBars in `--safe-area-inset-*` (the phone CSS's `--safe-*` falls back to `env()`); the focused field is scrolled into view when the keyboard opens (the WebView resizes); **pull to refresh** on the signed-in screens refetches what is on screen. No service worker in the app (its files are on the phone).
- **Built — links and CI.** `quote-ai/scripts/app-links.ts` writes `/.well-known/assetlinks.json` (from `ANDROID_CERT_SHA256`) and `apple-app-site-association` (from `APPLE_TEAM_ID`, served as JSON) into the site at build time — skipped while unset, so links keep opening the website until the keys exist. `.github/workflows/android.yml`: every push to `main` (and PRs touching the app) builds the web bundle, syncs and assembles the debug APK, downloadable as the `quoteai-android` artifact; versionCode = run number; a signed release `.aab` is built too once the upload-key secrets exist. `scripts/gradle.ts` finds Android Studio's JDK locally.
- **Numbers** (gzip kB): app shell EN 304.6 → 305.0 (`ApiImg`, `UpgradeLink`, the new strings); Job 370.1 and Schedule 325.4 crossed their budgets by 0.1 / 0.4 → raised to measured + 4 (374 / 329); public pages unchanged. Env inventory: `ANDROID_CERT_SHA256`, `APPLE_TEAM_ID` (deferred), `VITE_API_ORIGIN`, `VITE_NATIVE` (build), `CAP_DEV`, `NATIVE_OUT_DIR`, `JAVA_HOME`, `ANDROID_HOME` (local); the inventory now skips " - Copy" files.
- **Verification:** typecheck clean (api-server, quote-ai, mobile; bar the " - Copy" files), lint 0 errors on the changed files, knip clean for the new code, i18n EN/FR parity (5 255 each), **29 web unit tests** (+7: which calls go to the API — including iOS's opaque `capacitor://` origin — sign-out detection, the 2FA cookie's lifetime, which paths the app shows, which links open it, Android back, home vs website), api unit tests 233/233 after regenerating ROUTE-MATRIX (line numbers only), **6 new e2e tests on the real server** (preflight 204 for both app origins without credentials; sign-in from the app's origin returns a readable token that alone is the session; a valid web cookie sent from the app's origin counts for nothing; a foreign origin gets no CORS answer; `X-Active-Org` set by the switch and honoured, a company you're not in ignored; 2FA completes through `X-Auth-Cookie`, not without it, and a smuggled session cookie is dropped) plus the neighbouring suites (security, 90, 91, 95) — **40/40**. qa:bundle within budget, full web build (prerender; app-links skipped with no keys). **The app bundle in a phone-sized browser** against the local API through a proxy that speaks as the app (Origin `https://localhost`, no cookies): `/` opened sign-in with no site chrome; Terms opened the website and the app stayed on sign-up; sign-up → email verified → sign-in stored the bearer token and every following call carried `Authorization` and no cookie; `/dashboard/billing` → Plan with the note, no Stripe, no upgrade links; a sweep of 13 screens found no purchase links (the catalog's Pro lock still said "Upgrade" — fixed, and the contract lock with it); a photo uploaded through the app's fetch (FormData) showed on the job from a `blob:` via `ApiImg`; a pull-down refetched exactly the job page's queries. **Android build**: `pnpm --filter @workspace/mobile android:debug` → `app-debug.apk` 10.4 MB; `aapt` shows `ca.quoteai.app` 0.1.0, min 24 / target 36, `allowBackup=false`, the App Links filter for quoteai.ca / www.quoteai.ca `/dashboard` with `autoVerify`. Walkthrough accounts removed afterwards.
- **Not done / owed:** **the build on a real Android phone** (the plan's rule from 118 on — no phone or emulator image on this machine; install the CI or local APK, RUNBOOKS §53): sign-in including 2FA, the keystore surviving a restart, back button, splash, safe areas under the status and gesture bars, the keyboard over a docked save bar, a `quoteai.ca/dashboard` link opening the app (after `ANDROID_CERT_SHA256` is set — the debug key's fingerprint is enough for internal testing). The **iOS project** (`cap add ios`) waits for Phase 125 (Codemagic; the server side — `capacitor://localhost`, the AASA file — is ready). **Face ID / fingerprint to reopen** (optional in the plan) is not built — it fits Phase 121's first run. PDF downloads, "open receipt" and attachments in the app need the file + share-sheet work of Phase 119 (a plain link can't carry the token). A copy pass of the remaining "Upgrade to …" sentences in locked states and toasts (~25 strings; no links or buttons left) before store review (124/125). Dark mode follows D-1 once the app palette lands (120). **Owner:** set `ANDROID_CERT_SHA256` (and later `APPLE_TEAM_ID`) in Vercel; the upload keystore + `ANDROID_KEYSTORE_*` GitHub secrets come with Play (123/124). **Known limits:** email-verification and password-reset links open in the browser (they are /api/auth links, not /dashboard) — the person comes back to the app and signs in.

### Phase 119 — 2026-09-27

- **Built — push to the app.** `api-server/src/lib/fcm.ts` sends through Firebase Cloud Messaging's HTTP v1 API with no SDK (a service-account RS256 assertion swapped for an access token, cached; FCM relays to APNs for iPhones, so one token kind covers both). `device_tokens` (one row per install: `install_id` keeps a rotating token to one row, a token seen on another install moves) beside the Phase 77 browser subscriptions; every pushable notification goes to both, `UNREGISTERED` / 5 failures in a row drop the row. `POST/DELETE /api/push/devices` (503 until `FIREBASE_SERVICE_ACCOUNT` is set), `GET /api/push/config` → `appConfigured`. **Per-type preferences** (there were none): the pushable types are grouped into six categories (signatures, payments, messages, crew, budget, compliance); `push_preferences` holds what each person muted per company, `GET/PUT /api/push/preferences`, a checklist on the Notifications page for all their devices (website and app); the bell keeps everything. Migration `0058_phase119_device_tokens.sql` applied.
- **Built — the app side of push** (`lib/native/push.ts`): registers only when the person says yes — from Notifications ("Notifications on this phone", `app-push-toggle.tsx`) or the **"Know the moment they accept?"** sheet shown once after the first quote is emailed (`push-ask.tsx`, lazy sheet; on the website it asks for Web Push the same way). A tap opens the notification's link (cold start too); one arriving with the app open is a toast with Open; the Android channel is made; a rotated token is re-sent; **sign-out unregisters the install first** (`fetch.ts`), so the next person on the phone gets nothing of this company. Built only when the Android project has `google-services.json` (`VITE_APP_PUSH`, CI writes it from the `GOOGLE_SERVICES_JSON` secret); without it the app says notifications aren't set up instead of crashing Firebase.
- **Built — camera** (`lib/native/camera.ts`, `lib/capture.ts`): job photos (Take a photo / From your photos in the app), the job page's Photo, the crew page's photo and report photo use the native camera; **receipts** (phone + sheet, Costs tab, the receipt inbox) use Google's ML Kit **document scanner** on Android (edges found, page flattened, up to 4 pages; falls back to the camera without Play services / on iPhone). Photos and receipts are **shrunk on the device** on both builds (2000 px JPEG; before only crew reports were). **Receipts now queue offline** (`job.scanReceipt` in the outbox, read by the OCR on reconnect, once — the row id is the Idempotency-Key).
- **Built — files.** In the app every `/api` link, `window.open` of one and page-made `blob:` download is fetched with the token and handed to the **share sheet** (`files.ts`; name from the link, `Content-Disposition` or the type) — quote/invoice/contract PDFs, receipts, exports; `saveFile` (`lib/save-file.ts`) for code that set `location.href` (invoice PDF, quote PDF). **Share → QuoteAI** on Android (`@capgo/capacitor-share-target`, intent filters for images, PDF, text): a sheet offers *A receipt* (OCR), *Photos for a job* (pick the job), *Start a quote from this* (text into the new-quote box); through the outbox, so it works offline. iOS needs a share extension — left for 125 if worth the native code.
- **Built — location** (`lib/location.ts`): clock-in and "use my location" on a job's Team tab use the phone's location service in the app ("while using the app", asked at the tap), the browser's on the site; the crew page says why before the phone asks (*Clocking in notes where you are at that moment… Nothing is tracked after.*). **Crew links `/t/…` now open in the app** (App Links + AASA `/t/*`; the app remembers the link and opens there next time; forgotten on 404) — the only way a crew member clocks in, so the location work had to reach them. Job addresses open the **phone's maps app** (`geo:` / Apple Maps via `@capacitor/app-launcher`) instead of a web map.
- **Built — voice offline.** The mic records with no signal: new-quote dictation waits in the outbox (`voice.dictation`) and the words land in the box when the phone is back online (right away if the screen is still open, else the next time); a dictated job note (`job.voiceNote`) is transcribed and saved as a job note on reconnect (idempotent). `RECORD_AUDIO` in the manifest; the WebView's microphone prompt is the phone's.
- **Built — home-screen shortcuts** (long-press the icon, `@capawesome/capacitor-app-shortcuts`, vector icons in the brand navy): New quote, Snap a receipt (opens the + sheet's receipt flow), and Clock in when the app knows a crew link.
- **Android**: permissions POST_NOTIFICATIONS, CAMERA, RECORD_AUDIO, location (coarse + fine), each asked at the moment of use; camera/GPS/mic features not required; `geo:` query for Android 11+. 15 Capacitor plugins; debug APK 10.4 → 15.9 MB (ML Kit scanner, Firebase, camera).
- **Numbers** (gzip kB): app shell EN 305.0 → 308.3 (within 309), FR 317.9 (within 318); the 60 app strings live in the dashboard pack (only the crew page's location line is in core); the push-ask sheet is lazy; Today, Jobs, Job, Assistant and Settings crossed by 0.1–2.5 → raised to measured + 4 (345 / 327 / 379 / 316 / 326). Public pages unchanged. The website bundle carries no plugin code (one orphan `push-*.js` chunk is emitted but never referenced or precached). Env inventory: `FIREBASE_SERVICE_ACCOUNT` (deferred, Sensitive), `VITE_APP_PUSH` (platform).
- **Verification:** typecheck clean (api-server, quote-ai; bar the " - Copy" files); **34 web unit tests** (+5: `/t` opens the app and is a root screen, client links still don't, `/api` file links vs sign-in links, maps links → `geo:` / `maps://`, file names from links / `Content-Disposition` / type, install ids); **e2e on the real server 8/8** — phase119 (503 until configured, bad bodies 400, token rotation on one install = one row, delivery with the service-account assertion verified against the public key, the access token, title/body/`data.link`/tag, bell-only type silent, muted category skipped while others arrive, preferences round-trip and reject unknowns, `UNREGISTERED` drops the row, unregister) + the Phase 77 web-push suite unchanged; `qa:bundle` within budget; env inventory clean; knip clean for the new code; **APK built** locally (Gradle, all plugins linked). In the Browser pane on the walkthrough API: the Notifications page shows the checklist, unticking Payments persists across reload, fits 375 px with no sideways scroll; a 4000 px photo dropped on the Photos tab was re-encoded on the device and uploaded as JPEG. The app bundle through a proxy speaking as the app (bearer only): signed in, "Notifications on this phone" says not set up (no Firebase config), an `/api` CSV link was fetched with the token (200), named `quoteai-import-template.csv` from `Content-Disposition` and handed to the share step; no new console errors. Test accounts removed.
- **Not done / owed:** **Firebase (M-6)** — project, `google-services.json` → `GOOGLE_SERVICES_JSON` secret, service account → `FIREBASE_SERVICE_ACCOUNT` in Vercel (RUNBOOKS §54); until then push in the app is "not set up". **A real Android phone** for everything native: the camera and the document scanner, the share sheet, Share → QuoteAI, the maps app, location permission, the mic in the WebView, shortcuts, a push tap from a cold start. iOS: APNs key into Firebase and Info.plist usage strings (camera, microphone, location) come with the iOS project (125); iOS share-in needs a share extension. Not built: attaching shared files to a new quote (only its text), an in-app crew "Now" screen for signed-in crew (121's crew first run).
