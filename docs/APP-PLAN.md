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
| 115 | Fast: performance budgets and an instant-feeling app | B | not started |
| 116 | Sync I: open instantly, read offline | B | not started |
| 117 | Sync II: every change queued, merged, and live on every device | B | not started |
| 118 | The native shell (Capacitor) | B | not started |
| 119 | Native powers: push, camera, files, location, voice | B | not started |
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

