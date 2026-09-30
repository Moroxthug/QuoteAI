# quoteAI Pocket: developer handoff

This folder is everything needed to build the phone app from the approved design. The design itself lives in the Claude Design canvas and as `.dc.html` boards one folder up. Open any board in a browser to see and click through the real screen.

## What's here

| File | What it is | Use it for |
|---|---|---|
| `tokens/tokens.json` | Every colour (light, night, 16 backgrounds), font, type role, radius, size, spacing, shadow, motion and status rule | The single source of truth. Generate platform code from it |
| `tokens/tokens.ts` | The same, as a typed TS object | React Native / Expo, or any TS front end |
| `tokens/tokens.css` | The same, as CSS variables | The web pages clients see (quote, invoice, portal) |
| `icons/*.svg` | 69 gradient icons (violet), 4 tab bar icons, the assistant orb and the logo | Direct use. `preview.png` shows them all |
| `icons/icons.json`, `icons/tones.json` | Icon paths as 3 layers + the 13 colour tones | Render any icon in any tone in code |
| `SCREENS.md` | 92 screens by section: route, size, states, French, where each links | Planning and ticketing |
| `screens.json`, `navigation.json` | The same inventory and all 309 navigation links, as data | Routing, checklists, tests |
| `COMPONENTS.md` | The 24 building blocks, with sizes, states and behaviour | Build these first, then only compose screens from them |
| `BUILD-PLAN.md` | 7 phases, each shippable, with what "done" means | Order of work |
| `CLAUDE-CODE-BRIEF.md` | A ready-to-paste brief for Claude Code, one per phase | Building with Claude Code |

Also one folder up: `DESIGN-LOCK.md` (the rules and why), `HOME-WIDGETS-SPEC.md` (Home widgets in detail), `THEME-SPEC.md` (night mode), `kit/FR-BRIEF.md` (French glossary and formats), `Components.dc.html` (every component on one board).

## The rules that matter most

1. **Tokens only.** No colour, size or radius is typed by hand in a screen. Night mode and the background options depend on it.
2. **Two fonts, one rule.** Geist for words, Manrope for every digit, wherever it appears. See COMPONENTS.md, "Text", for how to do this in React Native, where you can't merge fonts the way the web design does.
3. **Status = word + colour + shape.** Never a coloured dot alone.
4. **Read in place, choose in a sheet, work on a full page.** Cards expand where they are. Bottom sheets are for input and choices only.
5. **No prices or purchases in the app.** Plans and billing happen on quoteai.ca (App Store and Google Play rules). The Plan screen shows the plan and links out.
6. **Two languages from day one.** Every string goes through the translation layer from the first screen. French is not a later task.
7. **Default look:** light theme, `dusk` background, night mode follows the phone setting with a manual override in Settings.

## What is NOT in the app

These screens are in the design but live outside the phone app. Build them as web pages on quoteai.ca (use `tokens.css`) or as email/SMS templates:

- Web pages clients open from a link: Client quote, Client sign, Client invoice, Client deposit, Client portal.
- Web pages for other outsiders: the subcontractor portal, the website lead form (embedded on the contractor's site), and the unsubscribe page.
- Email and SMS templates: Email quote and Texts to clients.
- Components is a reference board, not a screen.
- Tablet shows how the app adapts at 1366 wide. It's a layout rule, not a separate app.

## Where the design is not finished

- The lightest grey (`faint`, #8A8A90) is below 4.5:1 contrast. Use it only for placeholders and decoration, never for information.
- Large text: only Quotes and Invoice have large-text boards. Every screen must still work at the largest system text size. Rows grow taller; nothing is cut off.
- A few secondary rows link nowhere in the design (legal pages, some template rows). Treat them as "coming soon" or hide them.
- The French wording hasn't had a native Quebec review yet. Do that before launch, starting with Welcome, Quote editor, Contract and Help Centre.

## Regenerating this pack

`python3 kit/handoff_gen.py` in the design workspace rebuilds `tokens/`, `icons/`, `SCREENS.md`, `screens.json` and `navigation.json` from the live design sources. The written guides (this file, COMPONENTS, BUILD-PLAN, CLAUDE-CODE-BRIEF) are edited by hand.
