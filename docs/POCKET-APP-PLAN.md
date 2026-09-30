# quoteAI Pocket: the Expo app

The phone app, rebuilt in Expo from the final design in `docs/pocket-design/` (handoff in `handoff/`). This plan replaces `docs/POCKET-DESIGN-PLAN.md` (143–152). That plan built an earlier canvas into the web app's phone view; its Main/HomeFull boards are no longer in the design (SmartHome is Home now).

Phase numbers continue the repo's sequence. Each phase maps to a phase in `handoff/BUILD-PLAN.md`, and a phase is done only when that plan's "done" line holds.

## Decisions
- **Stack (owner, 2026-09-30):** a new Expo app, as the handoff brief recommends, not the Capacitor app.
- **Where:** `artifacts/pocket/` in this pnpm workspace. It reuses:
  - the existing API, unchanged;
  - the generated hooks and types (`lib/api-client-react`, `lib/api-zod`), whose base URL is configurable;
  - better-auth's bearer token, kept in `expo-secure-store`.
- **Same Play listing:** application id `ca.quoteai.app`, signed with the same upload key, and a version code above the Capacitor build's (391623). The Expo app replaces the Capacitor one as an update. The Capacitor build stays on internal testing until handoff Phase 2 is done.
- **Push:** `expo-notifications` with the native FCM token (`getDevicePushTokenAsync`), so the server's FCM sender stays as it is.
- **The web:** the client-facing pages (client quote, sign, invoice, deposit, portal, subcontractor portal, website form, unsubscribe) stay in `artifacts/quote-ai`, re-styled with `handoff/tokens/tokens.css`. The logged-in web dashboard is not part of this plan.
- **Design answers to earlier open questions:**
  - Night mode exists (THEME-SPEC).
  - Crew location is shared only while clocked in (LiveLocation).
  - Plans and billing link out to quoteai.ca; there are no prices in the app.

## Owner answers (2026-09-30)
1. **Digit weight matches the text around it:** Geist 400 → Manrope 400, 500 → 500, 600 → 600. Bundle Manrope 400–700 (now in COMPONENTS §1).
2. **Light / Night / Auto switch:** on `/sandbox` only, defaulting to Auto (follow the phone). It moves to Settings in Phase 5 and never goes on a real screen.
3. **Menu is built in Phase 2.** Every row or link to a later-phase screen stays visible exactly as designed, and routes to one shared **Coming soon** screen: the normal back header, that screen's real title, and one short line. This covers:
   - Menu rows to later screens;
   - the Jobs tab;
   - Home's links to Jobs, Schedule, Books and Crew map;
   - Quote editor's links to Contract and Price book;
   - Invoices' link to Dunning.

   Rows are never hidden, and later screens are never built early. (The owner said BUILD-PLAN and COMPONENTS were updated with this; the files on disk only have the digit-weight change, so this plan is the record.)
4. **The design pack is committed** as its own commit (c4b8649). `.gitattributes` marks the boards `-diff linguist-generated`.

## Phase 153: The Expo project (handoff Phase 0, part 1)
**Project and dependencies**
- `artifacts/pocket` created with `create-expo-app` (TypeScript, expo-router). Use the current Expo SDK whose React version matches the workspace catalog.
- Added: reanimated, gesture-handler, react-native-svg, expo-font, expo-blur, expo-localization, i18next and react-i18next, and expo-secure-store.
- Metro is set up for the pnpm monorepo. If isolated installs fight Metro, this package alone switches to hoisted.

**Tooling**
- `tsc` strict.
- A check (`pnpm --filter @workspace/pocket lint:tokens`) that fails on any hex, `rgb(` or numeric `fontSize`/`borderRadius` outside `src/theme/tokens.ts`.

**Wiring**
- `src/theme/tokens.ts` is copied from `handoff/tokens/tokens.ts`, with a note that the handoff file is the source.
- i18n has en-CA and fr-CA dictionaries from the first string.
- The API client points at the API. Sign-in stores the bearer token. A signed-in `/` shows "Hello" (throwaway, replaced in Phase 1).

**Dev loop on this Windows machine**
- Expo on the Android emulator (the SDK is installed), with screenshots via `adb exec-out screencap`.
- `expo start --web` for quick Playwright screenshots next to the rendered board. Web is for layout only; blur and motion are judged on Android.

**Done when:** the app boots on the emulator in EN and FR, signs in against the local API, and `lint:tokens` passes.

## Phase 154: Theme, fonts, icons (handoff Phase 0, part 2)
- **Theme** (COMPONENTS §3):
  - light and dark token sets;
  - Light/Night/Auto following the system;
  - the 16 grounds, with dusk as default and its lilac fade drawn fixed to the screen behind content;
  - `muted` switching to #66666e on the fade grounds.
- **Fonts** (§1):
  - Geist 400/500/600 and Manrope 400/500/600/700 bundled; digits take the weight of the text around them.
  - `Text` splits digit runs (`/[0-9$%+−°]+(?:[.,  ][0-9]+)*/`) into nested Manrope runs.
  - `Num` for standalone figures, with tabular figures.
  - Number inputs are Manrope throughout.
- **Formats:** money, number, date and time helpers on `Intl` for en-CA and fr-CA (4 131,05 $ · 29 sept. · 14 h 30), with unit tests.
- **Icons** (§2):
  - `Icon` renders any glyph from `icons.json` in any tone from `tones.json`: 3 layers at 1 / .6 / .35, with a diagonal gradient, brightened ×1.15 at night.
  - The stroke glyphs: back, close, chevron, plus, search, more.

**Done when:** the sandbox's first section shows the type scale, every icon in every tone, and the grounds, in light, night and French. Every digit is Manrope.

## Phase 155: The static components (handoff Phase 0, part 3)
- Built one at a time in `src/ui`, each added to `/sandbox` in the order of `Components.dc.html`: Card, Header, Button (4 sizes × 4 kinds), Chip strip, Segmented, Tabs, Search, Field and form card, Switch, List row, Avatar, Status pill (6 tones × 12 shapes) and tag, KPI tile and progress bar, Banner, Empty / skeleton / toast.
- Each one is shown to the owner working before the next one starts: an emulator screenshot next to the matching crop of the rendered board, in light, night and FR.

**Done when:** those parts of the sandbox match the board side by side.

## Phase 156: The motion pieces and a phone build (handoff Phase 0, part 4)
- **Sheet:** slides up with the `out` easing; drag down or tap the scrim to close.
- **Expandable card:**
  - height, the floating pop, rows staggered 40 ms apart;
  - one open per screen;
  - in a list, the open row detaches and the other rows fade to 45%;
  - it scrolls itself into view.
- **Swipe row:** 78-wide action tiles that snap open or closed.
- **Tab bar and orb:** the floating glass tab bar (blur) with the assistant orb (18 s swirl, 3.2 s halo), plus the floating action bar.
- **Everywhere:** rise and press helpers; reduced motion turns it all off.
- **Phone build:** `expo prebuild`, then a local signed `.aab` with the same id and upload key, sent to the owner through Internal app sharing.

**Done when:** the sandbox matches `Components.dc.html` in light, night and French, and the owner confirms the expand card and swipe row feel right at 60 fps on their phone. That closes handoff Phase 0.

## After Phase 0 (one plan phase per handoff phase; detail written when each starts)
| Phase | Handoff phase | Scope |
|---|---|---|
| 157 | 1 Getting in | 11 screens, Welcome to FirstQuote, on the real auth (sign-up, verify, two-step, invites, join code) |
| 158–160 | 2 Quote to cash | 11 app screens, plus the 7 web pages and messages re-styled in quoteai.ca. The first build for real contractors; it replaces the Capacitor app on Play |
| 161–162 | 3 Jobs and crew | 16 screens; clock in/out with location only on the clock; foreman home |
| 163 | 4 Money and office | 13 screens |
| 164–165 | 5 Assistant, settings, account | 31 screens; SetPlan / Dunning link out |
| 166 | 6 Polish and release | SystemStates, Tablet, largest text size everywhere, Quebec French review, store screenshots in both languages |

Every screen follows the per-screen checklist at the end of `handoff/BUILD-PLAN.md`.

## Owner items
- Answer the three questions above.
- **iOS:** needs a Mac or EAS Build (an Expo account), plus the Apple developer account. Not blocking Android.
- **Carried over:** the `CRON_SECRET` GitHub secret; the App signing SHA-256 for `ANDROID_CERT_SHA256`; and the GitHub secrets for the upload key and `GOOGLE_SERVICES_JSON`.

## Build log
- **2026-09-30:** the owner chose Expo. `CLAUDE.md` was written at the repo root (the brief's project context, where things are, and the reading rules). This plan was written.
- **2026-09-30:** owner answers recorded (digit weight, sandbox-only theme switch, the Coming soon rule, the design pack committed as c4b8649).
