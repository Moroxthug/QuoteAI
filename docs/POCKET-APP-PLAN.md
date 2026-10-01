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
