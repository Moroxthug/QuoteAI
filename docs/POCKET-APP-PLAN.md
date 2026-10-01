# quoteAI Pocket: the Expo app

The phone app, rebuilt in Expo from the final Claude Design boards in `docs/pocket-design/` (handoff in `handoff/`). **Phase 123 onward is this app** (owner, 2026-09-30).

This plan replaces:
- `docs/APP-PLAN.md` phases 123–131 (beta, store releases and videos for the Capacitor app);
- `docs/VOICE-ASSISTANT-PLAN.md` 132–142 (built on the Stitch designs, which are dropped);
- `docs/POCKET-DESIGN-PLAN.md` 143–152 (an earlier canvas in the web app's phone view).

Every screen, the assistant included, is built exactly as its Claude Design board shows. Nothing comes from the Stitch designs.

Each phase maps to a phase in `handoff/BUILD-PLAN.md`, and a phase is done only when that plan's "done" line holds. From the end of 123, every phase ships a build to the Play testers.

## Decisions
- **Stack (owner, 2026-09-30):** a new Expo app, as the handoff brief recommends, not the Capacitor app.
- **Where:** `artifacts/pocket/`, outside the pnpm workspace, with its own npm install (`package-lock.json`). Metro skips pnpm's Windows junctions, so a pnpm-installed Expo app can't resolve its dependencies; this also keeps Expo out of Vercel's web/API install. Install with `npm install --before=<a day ago>`, matching the workspace's one-day `minimumReleaseAge`. It reuses:
  - the existing API, unchanged;
  - the generated hooks and types (`lib/api-client-react`, `lib/api-zod`), whose base URL is configurable;
  - better-auth's bearer token, kept in `expo-secure-store`.
- **Same Play listing:** application id `ca.quoteai.app`, signed with the same upload key, and a version code above the Capacitor build's (391623). Expo builds replace the Capacitor one as updates on the same tracks.
- **Closed test:** started by the owner (2026-09-30). Only Expo builds go to testers. Don't raise it again.
- **Push:** `expo-notifications` with the native FCM token (`getDevicePushTokenAsync`), so the server's FCM sender stays as it is.
- **The web:** the client-facing pages (client quote, sign, invoice, deposit, portal, subcontractor portal, website form, unsubscribe) stay in `artifacts/quote-ai`, re-styled with `handoff/tokens/tokens.css`. The logged-in web dashboard is not part of this plan.
- **Design answers to earlier open questions:**
  - Night mode exists (THEME-SPEC).
  - Crew location is shared only while clocked in (LiveLocation).
  - Plans and billing link out to quoteai.ca; there are no prices in the app.

## Owner answers (2026-09-30)
1. **Digit weight matches the text around it:** Geist 400 → Manrope 400, 500 → 500, 600 → 600. Bundle Manrope 400–700 (now in COMPONENTS §1).
2. **Light / Night / Auto switch:** on `/sandbox` only, defaulting to Auto (follow the phone). It moves to Settings in Phase 128 and never goes on a real screen.
3. **Menu is built in Phase 125** (quote to cash). Every row or link to a later-phase screen stays visible exactly as designed, and routes to one shared **Coming soon** screen: the normal back header, that screen's real title, and one short line. This covers:
   - Menu rows to later screens;
   - the Jobs tab;
   - Home's links to Jobs, Schedule, Books and Crew map;
   - Quote editor's links to Contract and Price book;
   - Invoices' link to Dunning.

   Rows are never hidden, and later screens are never built early. (The owner said BUILD-PLAN and COMPONENTS were updated with this; the files on disk only have the digit-weight change, so this plan is the record.)
4. **The design pack is committed** as its own commit (c4b8649). `.gitattributes` marks the boards `-diff linguist-generated`.
5. **The extra parts on `Components.dc.html` are built too:** checkbox, radio, stepper, code boxes, affix and select fields, the mic, and presence rings. They aren't among the 24 in COMPONENTS.md, but the sandbox must match the board.
6. **The assistant is the Claude Design one:** AssistantProposals, AssistantActivity and AssistantPermissions, HomeAI, the orb, and `AI-QUOTE-BAR-SPEC.md`. The Stitch plans are dropped.

## Phases
| Phase | Handoff phase | Scope | Ships |
|---|---|---|---|
| **123** | 0 Foundations | Project, theme, fonts, icons, every component on the board, motion, and the release pipeline | First Expo build to testers (sandbox) |
| **124** | 1 Getting in | 11 screens: Welcome, SignIn, SignUp, Verify, TwoStep, ForgotPassword, Invites, JoinCode, CompanyPicker, Onboarding, FirstQuote | Sign-up to an empty Home |
| **125** | 2 Quote to cash | 11 app screens (SmartHome, Quotes, NewQuote, Quote, QuoteEditor, PriceCheck, Clients, Client, Leads, Invoices, Invoice), plus Menu and the Coming soon screen. The 7 client web pages and messages are re-styled in quoteai.ca | **The first build for real contractors.** It replaces the Capacitor app for testers |
| **126** | 3 Jobs and crew | 16 screens; clock in/out with location only on the clock; foreman home; SubPortal web page | |
| **127** | 4 Money and office | 13 screens | |
| **128** | 5 Assistant, settings, account | 31 screens, the assistant exactly as its boards show (proposals, activity, permissions, HomeAI, orb, AI quote bar), plus the server work those screens need. SetPlan / Dunning link out | |
| **129** | 6 Polish and release | SystemStates, Tablet, largest text everywhere, Quebec French review. Play production (after the 14-day closed test), iOS through EAS Build + Submit (no Mac), store listings and screenshots in EN and FR, over-the-air updates (D-6) | **Public release** |
| **130** | (old Track C) | Videos from the finished app: tutorials, store previews, homepage loop | |

Every screen follows the per-screen checklist at the end of `handoff/BUILD-PLAN.md`.

## Phase 123: Foundations and the release pipeline (handoff Phase 0)

### 123.1 The project (done 2026-09-30, commit 5883444)
- Expo SDK 57, TypeScript, expo-router in `src/app`.
- i18n (en-CA / fr-CA), with `tokens.ts` copied from the handoff.
- `lint:tokens`: no colour outside `tokens.ts`, no typed sizes in screens.
- The shared API hooks with the bearer token.
- Android emulator: done 2026-09-30. The `pocket_pixel` AVD (Android 36, Play Store image) runs the dev build (`expo run:android`, NDK 27.1). Code changes reload in seconds.

### 123.2 Theme, fonts, icons
- **Theme** (COMPONENTS §3):
  - light and dark token sets, with Light/Night/Auto following the system;
  - the 16 grounds, with dusk as default and its lilac fade drawn fixed to the screen behind content;
  - `muted` switching to #66666e on the fade grounds.
- **Fonts** (§1):
  - Geist 400/500/600 and Manrope 400/500/600/700 bundled; digits take the weight of the text around them.
  - `Text` splits digit runs into nested Manrope runs.
  - `Num` for standalone figures, with tabular figures.
  - Number inputs are Manrope throughout.
- **Formats:** money, number, date and time helpers on `Intl` for en-CA and fr-CA (4 131,05 $ · 29 sept. · 14 h 30), with unit tests.
- **Icons** (§2):
  - `Icon` renders any glyph from `icons.json` in any tone from `tones.json`: 3 layers at 1 / .6 / .35, with a diagonal gradient, brightened ×1.15 at night.
  - The stroke glyphs: back, close, chevron, plus, search, more.

### 123.3 The components
- Every part on `Components.dc.html`, built one at a time in `src/ui` in the board's section order (Buttons, Chips, Controls, Inputs, Status, Rows, Numbers, Feedback, People, Voice), each added to `/sandbox`.
- Each is shown to the owner working before the next: an emulator screenshot next to the matching crop of the board, in light, night and FR.

### 123.4 Motion and the release pipeline
- **Motion:**
  - the sheet;
  - the expandable card (height, floating pop, staggered rows, one open per screen, list detach);
  - the swipe row;
  - the floating glass tab bar with the orb, and the floating action bar;
  - rise and press everywhere, with reduced motion respected.
- **Release (from the old 123/124):**
  - `expo prebuild`, then a signed `.aab` with the same id and upload key, and version codes above 391623;
  - Firebase `google-services.json`, so push works;
  - crash reports (`@sentry/react-native` on the existing Sentry project);
  - in-app feedback.
- **The build:** uploaded to the closed-test track, and to the owner through Internal app sharing.

**Done when:**
- the sandbox matches `Components.dc.html` in light, night and French;
- the owner confirms the expand card and swipe row feel right at 60 fps on their phone;
- the first Expo build is on the test track.

## Owner items
- **Before 129:**
  - an Expo account (for EAS iOS builds);
  - the Apple developer account.
- **Carried over:**
  - the `CRON_SECRET` GitHub secret;
  - the App signing SHA-256 for `ANDROID_CERT_SHA256`;
  - the GitHub secrets for the upload key and `GOOGLE_SERVICES_JSON`.

## Build log
- **2026-09-30:** the owner chose Expo. `CLAUDE.md` was written at the repo root (the brief's project context, where things are, and the reading rules). This plan was written.
- **2026-09-30:** owner answers recorded (digit weight, sandbox-only theme switch, the Coming soon rule, the design pack committed as c4b8649).
- **2026-09-30, 123.1** (first committed as "153 part 1"):
  - Expo SDK 57 (React 19.2.3, RN 0.86), expo-router in `src/app`, and i18n (en-CA / fr-CA from the phone's locale).
  - `tokens.ts` copied from the handoff, and the `lint:tokens` check.
  - The shared API hooks with the bearer token in SecureStore.
  - Checked on Expo web at 390×844: it signs in, shows the company through `useGetBusinessProfile` in EN and FR, and has one React in the bundle.
  - Moved out of the pnpm workspace after Metro couldn't follow pnpm's junctions.
- **2026-09-30:** the owner renumbered: Phase 123 onward is the new design. The old APP-PLAN 123–131, VOICE-ASSISTANT-PLAN 132–142 (Stitch) and POCKET-DESIGN-PLAN 143–152 are superseded. The emulator setup (command-line tools + Android 36 image) started.
- **2026-09-30, 123.2:**
  - Theme: light/dark, Auto/Light/Dark, and the 16 grounds with dusk's fixed fade.
  - Fonts: Geist + Manrope with the digit rule at matching weights.
  - Intl formats for en-CA / fr-CA.
  - Icons: 69 icons × 13 tones (checked against `icons/preview.png`), plus the board's stroke glyphs.
  - `sync:design`, and `/sandbox/foundations`.
- **2026-09-30, 123.3 Buttons:**
  - 5 kinds × 4 states, 4 sizes, the small row and the floating action bar.
  - Matched side by side with the board on Expo web, then confirmed on the Android emulator.
- **2026-09-30, Android dev loop:**
  - SDK command-line tools, an Android 36 image, the `pocket_pixel` AVD, NDK 27.1 and CMake 3.22 installed.
  - First native build took 34 min (later builds are cached).
  - The sandbox runs on the emulator; Metro is on 8081, reached through `adb reverse tcp:8081 tcp:8081`.
  - If the emulator freezes (adb commands hang): kill `qemu-system-x86_64`, then cold boot it with `-no-snapshot -gpu swiftshader_indirect`.
- **2026-09-30, 123.3 Chips and Controls:**
  - Chips: `Chip` (count, check/plus glyph, selected, disabled), `ChipStrip`, `ChipWrap`, and the inner `Tabs` strip (underline over the hairline).
  - Controls: `Switch` (spring knob, fading track), `Stepper`, `Segmented` (sliding thumb), `Checkbox` (square and round tick), `RadioRow`, plus `Card` / `Hairline`.
  - `src/theme/board.ts` holds the two board values tokens.json doesn't name (white knob, knob shadow).
  - French from QuotesFR / JobFR / NewQuoteFR / SettingsFR where the boards have it; the rest is marked `// owner`.
  - Checked on Expo web (light, night, FR; every control tapped) and on the emulator.
  - Metro now ignores " - Copy" files (an old placeholder copy in lib/ made the crawler fail with EINVAL).
  - The .dc.html boards need the Claude Design runtime (`support.js`, not in the repo) to fill their `{{ }}` data; without it they show only static markup. Compare against their CSS and script data instead.
  - Dev-menu Reload on Android crashes in expo-ui's native teardown (`clearAllContentOriginsImpl`); relaunch the app instead.
- **2026-09-30, 123.3 Inputs** (owner chose to finish 123 before starting 124):
  - `Field` (label, error line), `TextField` (focus / error / disabled / multi-line), `AffixField` (money and unit), `SelectField` (select, date, time), `CodeField` (one real input under the boxes, so paste and SMS autofill work), `Search`.
  - Number fields (money, units, phone, codes) are Manrope throughout; `dayDate` gives "Tue Sep 29" / "mar. 29 sept.".
  - Android draws no box shadow on a `TextInput`: the ring sits on a wrapping view.
  - The board's night placeholder (#6f6e76) is in `src/theme/board.ts`.
  - Checked against the board on Expo web (light, night, FR, typing in the code boxes) and on the emulator.
- **2026-09-30, 123.3 Status:**
  - `Status` (6 tones × 12 shapes, drawn from the board's mask SVGs; plain variant; the live dot pulses every 2.2 s unless reduced motion is on), `Tag` (plain and accent).
  - The board's seven status sets (quotes, invoices, jobs, contracts, leads, crew and time, permits) are on `/sandbox`. French from the FR boards where they have the word; the rest is marked `// owner`.
  - `src/theme/board.ts`: the warn tint (tokens.json has no `warn-soft`) and the SVG mask values.
  - The board's status rows need its runtime, so they were checked by filling them with the board's own data in the browser; the sandbox wraps row for row the same. Checked in light, night, FR and on the emulator.
- **2026-09-30, 123.3 Rows** (owner: finish all of 123 before 124):
  - `SectionHeader`, `ListRow` / `RowBody` / `RowList` (full-width hairlines), `MenuRow` / `MenuList` (hairlines inset 56), `GroupLabel`, `RowChevron`, `Avatar` (5 tints).
  - `SwipeRow`: drag (gesture handler) or tap; snaps past half the actions or on a flick; 450 ms `out`; `locked` for an expanded row; each action is also a screen-reader custom action.
  - Gotcha: gesture callbacks run on the UI thread; build easings once outside them (`easing()` inside `onEnd` crashed the drag on Android). A Tap gesture needs `maxDistance` or a drag also counts as a tap.
  - Checked on Expo web (light, night, FR) and on the emulator (tap, drag open, drag closed).
- **2026-09-30, 123.3 Numbers and Feedback:**
  - Numbers: `StatStrip`, `KpiTile` / `KpiGrid`, `Progress` (grows in from the left, 1.2 s after 0.2 s; still under reduced motion), `ProgressRow` / `ProgressList`.
  - Feedback: `Banner` (5 tones), `Empty` (also the error state), `Skeleton` (shimmer band, still under reduced motion), `Toast`, and `ToastHost` / `useToast` in the root layout (104 above the bottom, slides in, hides after 3 s).
  - `sentence()` in format.ts keeps one full stop after "a.m." ("last at 9:12 a.m.").
  - `/sandbox?only=<Section>` shows one section; the emulator opens it with `adb shell am start -a android.intent.action.VIEW -d "quoteai:///sandbox?only=Rows" ca.quoteai.app`. Don't flood the emulator with adb swipes (40 quick swipes made Android report the app as not responding).
  - Checked on the emulator in light, night and FR (the toast's slide and 3 s hide included).
- **2026-09-30, 123.3 People and Voice (123.3 complete):**
  - People: `Avatar` (photo or the board's placeholder, `me`, 5 tints, presence rings), `CompanyLogo`, `PresenceLegend`.
  - Voice: `MicButton` (idle, live with the breathing halo, busy with the three dots), `LevelMeter` (7 bars, offsets as on the board). Still under reduced motion.
  - Every section of `Components.dc.html` is now on `/sandbox`, checked on the emulator in light, night and FR.
- **2026-09-30, 123.4 Motion:**
  - `Header` / `IconButton` / `PageTitle` (the header clears the status bar), `Rise` (motion.tsx), `Sheet` (slides up over the scrim, drag down or tap the scrim to close), `ExpandCard` with `ExpandScrollView` / `ExpandGroup` (height + content fade + floating pop + rows rising in turn; one open per screen; a `row` in a `list` detaches and dims only its own list; scrolls itself into view), `XcRow` / `XcButton` / `XcCaption` / `XcDivider` / `XcActions`, `TabBar` + `AssistantOrb` (glass bar, greyscale inactive icons, the orb's 18 s swirl and 3.2 s halo).
  - `Screen` takes `floating` (tab bar, action bar) and wraps the content in expo-blur's `BlurTargetView`, which Android needs for a real blur (`blurMethod="dimezisBlurViewSdk31Plus"`).
  - `/sandbox/motion` puts them on one screen. Checked on the emulator: expand/close, one open at a time, the sheet's drag-to-close, light, night, FR.
  - Typed routes: the Metro started from the repo root writes new files into `.expo/types/router.d.ts` with broken Windows paths, so a new route needs `as Href` until Metro restarts.
- **2026-10-01, 123.4 Release pipeline:**
  - `npm run release:android` (scripts/release-android.mjs): `expo prebuild`, then Gradle `bundleRelease` signed with the Play upload key from `~/.quoteai-keys/upload.properties` (same key as the Capacitor app). `-- --no-prebuild` retries Gradle without regenerating android/; Gradle runs with `--max-workers=2` (worker daemons timed out with the emulator and two Metros running).
  - `plugins/with-release.js` writes the signing and the version code (minutes since 2026-01-01 UTC, the Capacitor rule) into the generated build.gradle.
  - Firebase: `google-services.json` copied from the Capacitor project (ignored by git), `android.googleServicesFile` in app.json.
  - Sentry: `@sentry/react-native` 7.11 (`src/lib/sentry.ts`), inert until `EXPO_PUBLIC_SENTRY_DSN` is set at build time; source-map upload only with `SENTRY_AUTH_TOKEN`. Testers' "Send feedback" (Sentry's feedback form) shows on /sandbox when Sentry is on.
  - **First signed bundle built:** version code 393560 (above 391623), 75 MB, signed with the upload certificate `6F:2B:6E:…:B8:3C`. Not installed on the emulator (it would replace the dev build).
  - Metro now ignores android/ and ios/ (the release build's files stalled the 8081 watcher; it was restarted).

**Phase 123 status (2026-10-01):** everything the assistant can do is built. The "done" line still needs the owner:
- upload `artifacts/pocket/android/app/build/outputs/bundle/release/app-release.aab` to the closed-test track (Play Console → Testing → Closed testing → Create new release) and through Internal app sharing;
- confirm the expand card and swipe row feel right at 60 fps on a real phone;
- optional now, needed before 125: a Sentry DSN for a React Native project (`EXPO_PUBLIC_SENTRY_DSN`, plus `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` for readable stack traces).
- **2026-10-01, owner:** Phase 123 is closed. The first Expo bundle (393560) went up to Play. The 60 fps feel check moves to the real screens ("will have to see them on the real deal"). **Next: Phase 124 (Getting in), in a new session.**
- **2026-10-01, 124 Getting in built (not pushed):** all 11 screens in `artifacts/pocket` (Welcome, SignIn, SignUp, Verify, TwoStep, ForgotPassword, Invites, JoinCode, CompanyPicker, Onboarding, FirstQuote) plus a temporary Home and the shared Coming soon screen. The session layer wraps `fetch` once (bearer token, `x-active-org`, app origin for the server's native-app handling, two-step cookie tunnel). `/` is a gate (`lib/gate.ts`, tested). Web preview: Metro proxies `/api` to the local API and presents the app origin. One server edit: `quoteai://forgot-password` is a trusted redirect for the reset link (`api-server/src/lib/auth.ts`, test `e2e/phase124.e2e.test.ts`); it needs a deploy before reset links work on a phone.
  - **Not done / owner to rule:** native pieces stubbed (photo picker for the logo, mic recording, push opt-in, clipboard paste, Face ID on Sign in: needs expo-image-picker, expo-audio, expo-notifications, expo-clipboard, expo-local-authentication and a new dev build). TwoStep drops the text-message method, "Trust this phone" and "Get help" (the server only has authenticator and backup codes). JoinCode is 10 characters (board shows 6). Several error strings are mine (listed in each screen's i18n file). "Remember my company" is stored but not read by the gate. Sign-up's duplicate-email answer is a decoy from the server, so `emailTaken` is never shown. Onboarding ends on `/home` per navigation.json; FirstQuote is built but only reachable by route until Home (125). French was not checked on screen for several screens; no emulator pass yet.
- **2026-10-01, 125 started (not pushed; 124 is also still unpushed).** Phase 125 is too large for one pass, so it goes in steps, each committed on its own. Each step ends on the owner's look at it in light, night and FR.
  - **125.1 done:** `lib/nav.ts` (`screenHref(name, title, params)`: a built screen's route, else Coming soon with its real title; building a screen = adding it to `BUILT`), `ui/TabShell.tsx` (`TabScreen`: tab bar + orb; Jobs opens Coming soon), **Menu** (`app/menu.tsx`, `ui/Menu.tsx`; all 5 groups and 28 rows, quick actions, sign out). The board's per-row counts ("3 new this week") stay empty until the screen that owns the number is built. The plan card's accordion of plans waits for the Plan screen (phase 128): its head opens Coming soon until then. `ScrollPage`, `TabHeader`, `Figures`/`MiniFigures`, `SwipeHint`, `useExpandOpen`, `weekdayShort`/`monthLong` added.
  - **125.2 done:** **Quotes** tab (`app/quotes.tsx`, `lib/quotes.ts` + 12 tests): glance card, search, filter chips, This week / Earlier groups, expandable rows inside swipe rows (Duplicate and Archive with Undo are real calls), states: list, no match, no quotes, loading, can't load, offline.
  - **Server gaps the boards assume (decide before 125.3):**
    1. A quote has no *viewed*, *declined* or *expired* state in the API (draft / unlocked / pending_payment / accepted, plus `sentAt` and `acceptedAt`). The app derives *Expired* and *Expires Fri* from `sentAt` + 30 days and does not show Viewed or Declined. Needs: the public quote page records opens and a decline.
    2. `GET /quotes` does not return the quote number (`numeroPreventivoData`), so rows show no "Q-2026-119" yet. One-line server change plus the API spec and codegen.
    3. No contractor-side "Mark won". The swipe tile is replaced (Sent → Follow up + Archive).
    4. Clients: the API client has name, contact, quote count, value and last quote date; the board's Active / Prospect, "jobs running", owed and last-activity lines need jobs and invoices joined in.
  - **Next:** 125.3 Smart Home (AI quote bar, Needs you, widgets), then Clients, Client, Leads, NewQuote, Quote, QuoteEditor, PriceCheck, Invoices, Invoice, then the web pages.
  - **Test data:** the local API on 5088 runs against the staging database. A test account (`pocket125@example.invalid`, "Marco Rossi") and 3 draft quotes were created there for checking; remove with `pnpm --filter @workspace/api-server walkthrough:cleanup` or by deleting that user.
  - **125.3 to 125.8 done (not pushed):** Smart Home (AI quote bar, Needs you, widget rows on real data), Clients and Client, Quote (review and send), Quote editor, Price check, Leads, Invoices and Invoice. Each is its own commit; see `git log` (`Pocket 125.x`).
  - **Server work done for these screens (this is the real database; migrations 0062 to 0064 are applied there):** quote *viewed* / *declined* / number / validity on the list; `POST /api/public/quotes/:id/decline` (records when and why, stops follow-ups, notifies the company; `quote_declined` push); client overview and details endpoints; quote *exclusions* ("Not included", also on the PDF and the client page) and the *recommended* option on a Good / Better / Best tier; `lines[]` on the price check (one row per priced line, so the app can show every line, not only the drifting ones); `POST /api/invoices/:id/receipt` (emails the latest payment's receipt). The client quote page (`p/[id].tsx`) now shows Not included, the Recommended tag and a Decline sheet.
  - **Deviations to rule on:** (1) the quote number is the server's long string ("No. 1.2026 - 2026-10-01"), not "Q-2026-119"; (2) the Quote editor's "version 2" banner is replaced by an honest "changes show on the same link" (the server has no quote versions); (3) Price check compares each line with the company's own price book and the average of its last receipts, not Toronto ranges and margins (the app has no such data), and the band is the reference plus or minus 5%; (4) the editor's holdback row is informational (the server's holdback is separate from payment terms); (5) "Mark won" is not supported by the server; (6) Invoice: no "Delivered" / "Viewed 3 times" marks, reminder rows follow the server's schedule (3, 7, 14 days after due), Credit note and New invoice open Coming soon, "Got paid" opens the payment sheet instead of a one-tap mark.
  - **Test data (remove before launch):** account `pocket125@example.invalid` and its quotes, clients, two draft invoices and one catalog item ("Subway tile backsplash") on the shared database. Local dev servers for 125 run on 8101 (web) and 5101 (API).
  - **Still to do in 125:** NewQuote and the client web pages / messages (running as separate steps), then the owner's look in light, night and FR, a new dev build (expo-audio, expo-image-picker, expo-clipboard, expo-sharing), and the push.
  - **125.9 NewQuote done (not pushed):** `/new-quote` with Write with AI (photos, mic, examples, PDF layout, target total, client list and new client, writing steps over the real request), Manual and Price list (both create through `/api/quotes/manual`). Gaps: PDF and spreadsheet chips and "Improve this line with AI" open Coming soon (no document picker; the server's suggest prompt is Italian); no client preselected; mic, photos and the multipart from a phone are untested; extra test rows (2 quotes, 5 catalog items, clients "Zoe Test", "Maya Test") on the shared DB.
  - **125.10 client web pages and messages done (not pushed, 10 commits):** client quote, sign, invoice (also serves deposit invoices), portal, unsubscribe, website form, all client emails (one shared layout) and the quote-sent SMS wording, from the boards with `client-pages.css` (tokens.css) and a same-origin Manrope digits font. Seen in the browser with fake data only; the boards themselves could not be opened (they need a runtime that is not in the repo). Deviations: docked Accept / sign / pay bars became inline cards as drawn; no valid-until, deposit amount or owner name on the quote page (not in the data); ClientDeposit's card form, "email me the link" and declined-card states are not built (the server uses Stripe-hosted checkout); no channel choice or Resubscribe on Unsubscribe (CASL: GET unsubscribes at once); SMS identity line, STOP footer and on-my-way text unchanged. The e2e suites (`phase92`, `visual-a11y` selectors) were edited but not run.
  - **Before the push:** run the api-server e2e and `qa:visual` suites, then the owner's look in light, night and FR on a device.
  - **Owner rulings (2026-10-01):** short quote number `Q-2026-001` (done, new quotes only); Mark as won needs no signature (done; an optional "signed a paper contract" flag is not built); quote versions are required (done: migration 0065 applied to the shared DB; editing a sent quote keeps the old version and makes version 2, 3...; the app shows "Version 2 is not sent yet", the client page shows "Updated, version 2"). Not built: a version history screen in the app (the data is there: `GET /api/quotes/:id/versions`), and a "Send update" label on the send button.

## Phase 126: Jobs and crew (handoff Phase 3)
Steps, each its own commit; the owner looks at each in light, night and FR before the next phase. Order follows the "done when" line: an accepted quote becomes a job with stages, the crew clocks in and out, the foreman gets a Home, a change order goes out and comes back signed.
- 126.1 Jobs tab · 126.2 JobSetup · 126.3 Job (10 tabs) · 126.4 ChangeOrder · 126.5 Schedule · 126.6 Team and Teammate · 126.7 CrewNow, CrewHours, CrewTravel, LiveLocation, CrewExpired · 126.8 ForemanHome · 126.9 CrewMap, ServiceCalls · 126.10 SubPortal (web).
- **2026-10-01, 126.1 Jobs tab done (not pushed):** `app/jobs.tsx`, `lib/jobs.ts` + 8 tests, `ui/Jobs.tsx`. Glance card (in progress, to invoice, on site today with clashes, from `/api/crew/today`), filter chips, "receipts to review", groups with job cards that open in place (who is on site and since when, next stage on track or late, blockers the crew raised with a real Resolve, Invoiced / Costs / Margin), the violet setup card, empty, loading, can't load, offline. The Jobs tab now opens it (BUILT.Jobs).
  - Server: `GET /api/jobs` also returns per job `crew`, `invoicedCents`, `costCents`, `pendingReceiptCount/Cents`, and `jobLimit` / `openJobs` for the footer. Additive.
  - `ExpandCard` got `compact` (the board's glance-card spacing: padding 14 4, 28 chevron column, body inset 12). Without it a five-digit figure wraps in the first column. Quotes, Clients and Invoices use the same card and could take it too (not changed here).
  - Gaps the server can't fill, so the screen leaves them out: warranty and review rows on a finished job; the reason a job is on hold (shows "On hold since {date}"); the paint-order and deposit rows on a job that hasn't started; "Message client" opens the client instead. "To invoice" is worked out as earned (value x progress) minus invoiced. Margin is on what has been invoiced.
  - Test data on the shared DB (remove before launch): 5 jobs on `pocket125@example.invalid` (Basement finish, Fence and gate, Main floor repaint, Back room shelving, Powder room).
- **2026-10-01, 126.2 Job setup done (not pushed):** `app/job-setup.tsx`, `lib/jobSetup.ts` (+9 tests), `ui/JobSetup.tsx`, `ui/DateSheet.tsx` (the app's date picker: a month grid in a sheet). Review the plan: name, client, contract value and window, milestones (move up, delete with Undo, add), "shift everything to start on" (the next four Mondays and Wednesdays, or a picked date), the cost budget per category with a stepper, the projected margin against a 30 % target. "Looks good, start the job" confirms (`POST /jobs/:id/setup/confirm`); on a running job the same screen saves. Opened with `id`, or `quoteId` (finds or makes the job: Start job on a quote now goes here), or nothing (a blank "New job" is created).
  - **Gaps:** no setting exists for the margin target, so the board's 30 % is a constant (`TARGET_MARGIN_PCT`); the board's "Dev is notified" isn't shown (nothing is sent); "Deposit paid" reads the deposit invoice. Not on the board: the menu (rebuild the plan from the contract, open the job).
- **2026-10-01, 126.3 Job done (not pushed, 2 commits):** `app/job.tsx` plus one file per tab in `src/jobTabs/`. Shell: status and dates, name with rename, client with Map, progress card (milestones, four figures), quick actions (On my way texts the client; Add photo; Voice note records and saves a note), sticky tabs, the floating bar's action changes with the tab (`usePrimary`), the more menu (edit the plan, hold, resume, complete, archive). Tabs: **Overview** (field reports with Answer and Mark sorted, on it today, up next and the payment it releases, budget against actual, permits, notes), **Schedule** (timeline, tasks that tick, Add task, Complete milestone; crew over four weeks with clashes), **Change orders**, **Costs** (scan a receipt, confirm, entries, budget), **Invoices** (billing plan from the contract, Create on a done term), **Team** (approve hours, log hours, assign, clock-in radius), **Photos** (grid, select, share, delete, add), **Messages** (the client's portal thread, copy link), **Documents**, **Assistant** (stays as designed; says it arrives later).
  - **Gaps:** the board's suggested permit ("a wet bar sink needs a plumbing permit") needs the kind of work, which the app doesn't know; receipt confidence is high / medium / low, not a percent; "180 m off site" is "outside the site radius" (the server keeps a flag, not a distance); the job-site pin can't be set from the phone (no location module), only its radius; Messages needs a client on the job; "En route" is not a state the server has (crew show On site, Not in yet or Booked). Task toggles, hours approval, notes and the receipt confirm were checked against the real API; the receipt scan and photo upload need the phone's camera and were not exercised.
  - `ExpandCard` takes `compact` (used by Jobs). New shared bits: `lib/jobDetail.ts` (the job's types), `lib/jobUpload.ts` (multipart), `lib/media.ts` (camera and library), `ui/AuthImage.tsx` (images that need the token), `lib/teamApi.ts`.
- **2026-10-01, 126.4 Change order done (not pushed):** `app/change-order.tsx`, `lib/changeOrder.ts` (+7 tests), `lib/changeOrderApi.ts`, `ui/ChangeOrder.tsx`. Describe (talk or type, a title) → Review → Sent → Signed, following the change order's status on the server. "Write the change order" asks the assistant (`POST /assistant/actions`) for the lines; if the plan has no assistant or it can't, the lines are added by hand. A draft is saved as soon as it has a line, so tax and totals always come from the server. "Send for signature" signs the document for the contractor with their typed name, then emails the client the signing link.
  - **Gaps:** only email (the server has no text for contracts); no "Signed on paper"; the other two billing choices (separate invoice, due on signing) and the reminder switch aren't built (a change order is billed with the next progress invoice); photos on a change order aren't stored; the tax line says "Tax" (the board names HST and the rate); a change order needs a job with a signed contract (the server says so, and the screen shows it). The sent and signed views were not seen against a real signed contract (none in the test data).
