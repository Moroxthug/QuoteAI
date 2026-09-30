# quoteAI Pocket (mobile app)

quoteAI Pocket is the phone app for quoteai.ca: an AI pocket CRM for Canadian trade contractors (quotes, jobs, crew, invoices, money), in English and French (Canada).

## Source of truth
The design is final and approved. Build exactly what it shows; do not redesign.
- Screens: docs/pocket-design/*.dc.html. Open any board in a browser to see and click the real screen.
  NAME.dc.html is light, NAMEDark.dc.html night, NAMEFR.dc.html French.
- Handoff: docs/pocket-design/handoff/. Read README.md, COMPONENTS.md and BUILD-PLAN.md before coding.
- Tokens: handoff/tokens/tokens.ts. Icons: handoff/icons/ (icons.json + tones.json to render in code).
- Screen inventory, states and navigation: handoff/SCREENS.md, screens.json, navigation.json.
- Rules and reasons: docs/pocket-design/DESIGN-LOCK.md. French glossary and formats: docs/pocket-design/kit/FR-BRIEF.md.

## Stack
Expo + TypeScript, expo-router, react-native-reanimated, react-native-svg, expo-font (Geist, Manrope), i18next with en-CA and fr-CA.

## Non-negotiables
- Style only through tokens.ts. No hex colours, font sizes, radii or spacing typed in screens. Compose screens only from the components in src/ui (built in phase 0).
- Geist for words; Manrope for every digit, including digits inside sentences (the base Text component splits digit runs into Manrope). Standalone figures use tabular figures.
- Every user-visible string goes through i18n, EN and FR, from the first commit. Money, dates and numbers use Intl with the user's locale (fr-CA: 4 131,05 $, 29 sept., 14 h 30).
- Light and night themes; light ground defaults to "dusk". Follow the system setting unless overridden in Settings.
- Status = word + colour + shape (the status pill component). Never a coloured dot alone.
- Read in place (expandable cards, one open per screen), choose in a sheet, work on a full page.
- No prices, plans or purchases in the app. Plan and billing screens link out to quoteai.ca.
- Touch targets ≥ 44, Dynamic Type supported, reduced motion respected, every icon button labelled.
- Client-facing pages (client quote, sign, invoice, deposit, portal, subcontractor portal, website form, unsubscribe) are web pages, not app screens.

## How to verify a screen
Open the matching .dc.html board next to the running app (light, night, FR). Build every state listed for it in SCREENS.md. Check every link against navigation.json. Tick the checklist at the end of BUILD-PLAN.md.

## Where things are
- The plan and build log for this app: docs/POCKET-APP-PLAN.md.
- Read in full, in this order (about 13k tokens together): docs/pocket-design/handoff/README.md, COMPONENTS.md, BUILD-PLAN.md, CLAUDE-CODE-BRIEF.md, tokens/tokens.ts.
- The Expo app: artifacts/pocket/ (UI kit in src/ui). The rest of the monorepo is the existing product:
  - artifacts/api-server: the Express API the app talks to (better-auth bearer token).
  - lib/api-client-react + lib/api-zod: the generated API hooks and types, shared with the app.
  - artifacts/quote-ai: the quoteai.ca web app, where the client-facing pages live (styled with handoff/tokens/tokens.css).
  - artifacts/mobile: the old Capacitor wrapper, kept on Play until the Expo app replaces it (same id ca.quoteai.app).

## Reading rules (the design folder is 24 MB; don't search it again)
- Never read docs/pocket-design/*.dc.html whole. 348 boards, up to 50k tokens each, and every board repeats the same ~30 KB of shared CSS and icon code at the top. Open only the light English board (NAME.dc.html) and pull out the markup and data, e.g. `sed -n '/<x-dc>/,$p' NAME.dc.html | grep -v '^\s*$' | head -400`, or grep for what you need.
- Never use NAMEDark or NAMEFR boards as source: night comes from tokens; for French, grep the strings you need out of NAMEFR.dc.html.
- handoff/SCREENS.md, screens.json, navigation.json: query only the current phase's section (grep, or jq on screens.json), never the whole file.
- handoff/icons/: use icons.json + tones.json in code; don't open the SVGs one by one.
- Never open: docs/pocket-design/kit/ (design build scripts, except kit/FR-BRIEF.md when a doc points to it), screens-src.zip, canvas.json, *.png/*.jpg previews, or older spec files unless a handoff doc points to a specific one.

## Repo habits
- Windows; the repo has thousands of stray " - Copy" files. Ignore them, and `git add` files by path.
- `git push` to main auto-deploys the web app and API to Vercel.
