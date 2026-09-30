# Briefs for Claude Code

Paste the **project context** once into the app's `CLAUDE.md` (or at the top of your first session), then paste one **phase brief** per session. Paths assume the design sits at `docs/pocket-design/` in the repo.

---

## Project context (put in CLAUDE.md)

```
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
```

---

## Phase 0: Foundations

```
Read docs/pocket-design/handoff/README.md, COMPONENTS.md and tokens/tokens.ts, and open docs/pocket-design/Components.dc.html in a browser.

Set up the Expo + TypeScript project (expo-router, reanimated, react-native-svg, expo-font, i18next). Then build, in src/ui:
1. The theme: tokens from tokens.ts; light/night/auto; the ground option (default dusk, with its fixed lilac fade).
2. Fonts: bundle Geist (400/500/600) and Manrope (500/600/700). Build the Text component so every digit run renders in Manrope (see COMPONENTS.md §1), and a Num component for standalone figures (tabular). Add locale-aware money, number and date helpers for en-CA and fr-CA.
3. The Icon component, rendering any glyph from icons.json in any tone from tones.json (3 layers at 1 / .6 / .35 with a diagonal gradient). Add simple stroke glyphs for back, close, chevron, plus, search and more.
4. All 24 components in COMPONENTS.md, with exact sizes, states and motion. Pay special attention to the expandable card (height + floating pop + staggered rows, one open per screen), the swipe row, the segmented control and the floating tab bar with the assistant orb.
5. A /sandbox route that reproduces Components.dc.html, with a light/night toggle and an EN/FR toggle.

Stop when the sandbox matches the board side by side in light, night and French, and runs smoothly on a real phone. Show me screenshots of each state.
```

## Phase 1 to 6

Use this template, filling in the phase number from BUILD-PLAN.md:

```
We're on phase N of docs/pocket-design/handoff/BUILD-PLAN.md. Build every screen listed for phase N, using only the components in src/ui.

For each screen:
- Open docs/pocket-design/NAME.dc.html (plus NAMEDark and NAMEFR) and reproduce it exactly. Click through it in the browser to see its interactions.
- Build every state listed for it in handoff/SCREENS.md.
- Wire its navigation to match handoff/navigation.json.
- Add all its strings to en and fr. Copy the French from NAMEFR.dc.html; don't retranslate it.
- Use realistic local mock data from the sample world in the boards (Rossi Renovations, Marco Rossi, the Harts' basement job and so on) behind a data layer I can later point at the real API.

Work one screen at a time. After each one, show me a screenshot in light, night and French, and tick the checklist at the end of BUILD-PLAN.md. If anything in the design is ambiguous, ask rather than invent. Stop at the phase's "done" line.
```

Web-page screens in phases 2, 3 and 5 (client quote, sign, invoice, deposit, portal, subcontractor portal, website form, unsubscribe) go in the quoteai.ca web codebase instead. Use `handoff/tokens/tokens.css` there, and the same brief with "web page" in place of "screen".
