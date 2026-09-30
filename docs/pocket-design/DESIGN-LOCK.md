# quoteAI Pocket: design lock

The phone app's design is locked. Every new screen must be built from the same tokens, components and rules. Source of truth: the Claude Design canvas "quoteAI Pocket CRM" and the files in this folder.

## What's in this folder

- `handoff/`: the developer handoff pack (tokens, icons, screen inventory, navigation, components, build plan, Claude Code briefs). Start with `handoff/README.md`.
- `*.dc.html`: every designed screen (a Design Component page per board). `*Dark.dc.html` are the night versions. Each screen also has a `dark` prop.
- `canvas.json`: the board layout, grouped into pages: Home and assistant, Sales, Jobs, Money and team, Menu and settings, Crew and clients, Getting in, System, Night mode.
- `kit/kit.css`: the tokens (day and night) and every component class.
- `kit/glyphs.js`: the icon library, i.e. the unboxed gradient icons (glyph × tone).
- `kit/README.md`: the build rules and visual language, in short.
- `THEME-SPEC.md`: colours, day/night, Menu and Settings, icons, plan card.
- `HOME-WIDGETS-SPEC.md`: Home, widgets, tab bar, assistant.
- `AI-QUOTE-BAR-SPEC.md`: the AI quote bar.

## Brief → screen map (QUOTEAI-APP-DESIGN-BRIEF.md)
| Brief | Screen(s) |
|---|---|
| §1 Components | Components |
| §2.1 Shell, tab bar, assistant button | every tab screen; SmartHome (assistant) |
| §2.2 Notifications, push opt-in | Notifications |
| §2.3 Search | Search |
| §2.4 Offline and sync, §2.5 locks and quotas, §2.6 app lock and permissions | SystemStates |
| §3 Getting in | Welcome, SignIn, Verify, Onboarding |
| §4.1 Home | SmartHome (widgets, AI quote bar, weather, crew, sites, Edit Home) |
| §5.1 Quotes list | Quotes |
| §5.2 New quote (AI / Manual / Price list) | NewQuote |
| §5.3 Quote detail | Quote |
| §5.4 Clients and client | Clients, Client |
| §5.5 Leads | Leads |
| §5.6 Contracts | Contracts, Contract |
| §6.1–6.3 Jobs, job setup, job (10 tabs) | Jobs, JobSetup, Job |
| §6.4 Schedule | Schedule |
| §7.1 Invoices and invoice (record payment, e-Transfer confirm) | Invoices, Invoice |
| §7.2 Pay | Pay |
| §7.3 Books | Books |
| §8.1 Team (workers, time, equipment, logins, access codes) | Team |
| §10.1 Menu (with plan card, store-compliant: no prices) | Menu |
| §10.2 Settings | Settings |
| §11 Crew phone | CrewNow |
| §12 Assistant | SmartHome (voice orb, keyboard mode) |
| §14 Client quote, signing, invoice, portal | ClientQuote, ClientSign, ClientInvoice, Portal |
| Dark mode | every screen (the `dark` prop, plus the Night mode page) |

## Added screens (all phases done)
| Brief | Screen(s) |
|---|---|
| §3 Getting in | SignUp, ForgotPassword, TwoStep, Invites, JoinCode, FirstQuote, CompanyPicker |
| §4.2 Foreman Home, §15 role homes | ForemanHome, RoleHomes (role prop), CustomizeHome, SetRoles |
| §5.3 Quote editing | QuoteEditor (line items, Good/Better/Best, payment schedule), PriceCheck |
| §6.3 Change orders | ChangeOrder (step prop) |
| §7.4 Compliance | Compliance (accountant view as a state) |
| §8.2–8.3 | Profile, Teammate, Group |
| §9 Insights and workspace | Analytics, Documents, PriceBook, Imports, Archive |
| §10.2 Settings pages | SetSecurity, SetCompany, SetTaxes, SetInvoices, SetQuotes, SetMessaging, SetWidget, SetPlan (store-compliant), MessageTemplates |
| §11 Crew phone | CrewHours, CrewTravel, CrewExpired, LiveLocation |
| §12 Assistant | AssistantProposals, AssistantActivity, AssistantPermissions |
| §13 Integrations | Integrations, Integration |
| §14 What clients see | EmailQuote, TextMessages, WidgetForm, Unsubscribe, ClientDeposit |
| §15 Coming next | CrewMap, SubPortal, AccountantView, Feedback, HelpCentre, VideoPlayer, WhatsNew, Dunning, Suppliers, Supplier, Inventory, ServiceCalls, Tablet (1366 wide) |
| §16 French and large text | QuotesFR, InvoicesFR, InvoiceFR, JobsFR, NewQuoteFR, OnboardingFR, QuotesXL, InvoiceXL |
Every screen has a night copy (`NAMEDark.dc.html`). States are Tweaks props (`state`, `step`, `role`, `video`, `lang`, `channel`), never on-screen toggles.
Canvas pages: Home and assistant · Sales · Jobs · Money and team · Menu and settings · Crew and clients · Getting in · System · Assistant · Insights and workspace · Settings pages · French and large text · Night mode.

## Rebuilding
Sources are in `screens-src.zip` (NAME.body.html + NAME.js per screen). With the kit: `python3 kit/normalize.py screens/*.body.html screens/*.js` (English screens only), `python3 kit/rebuild.py` (reads `kit/manifest.json`: title, height, tab, props, width) and `python3 kit/darkify.py`. Hand-built boards (SmartHome, HomeAI, Quote, Menu, Settings, Main, HomeFull) are edited directly.

## Known follow-ups
- Tab bars on RoleHomes use the standard four tabs; each role's own tabs are shown in Customize home and Roles.
- A few secondary rows link to `#` (legal links, some template rows).

**Expand in place (the reading pattern, every section).** Read in place, choose in a sheet, work on a full page.
- A card shows the hot info. Tapping its top (`.xc-head`) grows the same card downward; content below is pushed, nothing covers the page. A 24pt chevron top right rotates 180° and gets a sunk circle when open.
- Motion: height via `grid-template-rows: 0fr → 1fr`, .45s `cubic-bezier(.32,.72,0,1)`; the new content fades up 6pt after .12s. Reduced motion: no animation.
- Floating pop: the open card lifts off the page — scale .985 → 1.022 → 1 and 2pt up over .62s `cubic-bezier(.22,1,.36,1)`, with a deep soft shadow. Its rows, figures and actions pop in one after another (10pt up, 97% → 100%, 40ms apart). Inside a list, the open row detaches: 8pt outside the list edges, its own 22pt corners and shadow, while the other rows fade to 45%.
- One card open per screen. Opening another closes the first. The opened card scrolls itself into view (`scrollIntoView({block:'nearest'})`). Other cards in the same list fade to 50% (`.xc-list.has-open`).
- Inside: a hairline, an optional caption, up to ~5 rows (title 14.5/500, context 12.5 muted, plain status, one 34pt action), optional 3 mini figures, then one primary action and one "Open …" link to the full page. Anything longer belongs on the full page.
- Home widget rows: the open card locks its row (no sideways swipe), widens to the full 358pt and the neighbours fade out.
- Bottom sheets stay for input: Quick add, pickers, confirmations, Edit Home.
- Kit: `kit/expand.css` classes `.xc .xc-head .xc-body .xc-clip .xc-in .xc-row .xc-rt .xc-rr .xc-btn .xc-acts .xc-main .xc-link .xc-list`, macro `[[XCHEV]]`. Live on Home, Jobs, Quotes, Invoices, Clients, Leads, Team and Schedule (visit list under each lane; the timeline bars stay as they are). Swipe rows and expand coexist: an open row cannot be swiped.

**Background.** Default is now **dusk** (porcelain with lilac rising from the bottom toward the tab bar and assistant orb); the other grounds stay in Tweaks for comparison. On the fades, muted text darkens to #66666E so it keeps 4.5:1 contrast on the lilac. Every board has a Tweaks option `ground` with 16 light-theme grounds. Warm: stone (previous default, #F5F4F1), paper (#F8F8F6, almost white), linen (#F7F3EC, cream), oat (#F4F1EA, sand), shell (#F7F2F0, faint rose). Green: mist (#F1F4F0), sage (#EEF2EC). Cool: fog (#F0F1F2, neutral grey), porcelain (#F3F5F8), sky (#EFF4F8, faint blue). Violet: lilac (#F5F3F9), lavender (#F4F2FA, tuned to the brand violet). Fades on a porcelain base, all whisper-quiet: dawn (lilac at the top, gone by 480px), dusk (lilac rising from the bottom toward the tab bar and assistant orb), veil (diagonal, porcelain top left to lilac bottom right), iris (brand violet at 8.5% opacity at the top, gone by 420px). Fades are fixed to the screen, not the content, so they stay put while scrolling. Screen containers must set `background-color: var(--ground)`, never the `background:` shorthand, or the fade is wiped out. Each option retunes only the light-theme ground, sunk, soft, line, line2 and avatar tokens (`kit/ground.css`); cards stay white, night mode is unchanged. See background-options.png.

**Number lock.** Every digit in the app renders in Manrope, wherever it sits: a sentence, a chip, a button, an input, an SVG label. `kit/numlock.py` embeds a 3 KB Manrope digits-only face (0-9 $ % + − °, from `kit/mdigits.woff2`) under the family name Geist, placed after the Google Fonts link so it wins for those characters. Words stay Geist. Standalone figures still use `.num` or `.mono` for tabular spacing. `rebuild.py` runs it on every board; run it by hand after editing a hand-built board. Verified with Chrome's platform-font check: no digit on any board renders outside Manrope.

**French.** Every screen has a French board except the Components sheet. 80 FR boards (+ night) sit on the "French and large text" page, grouped by section. Client-facing screens (client quote, invoice, signing, deposit, portal, emails, texts, website form, unsubscribe) were already bilingual through their own EN/FR switch. FR boards use `<html lang="fr-CA">`, the French tab bar, and link to other FR boards (`kit/frlinks.py`, run by rebuild.py). Sources are `screens/NAMEFR.body.html` + `NAMEFR.js`, manifest entries with `lang: fr`; `kit/frbuild.py NAME` builds and checks one board. Typography: `kit/frtypo.py` (no-break spaces before $ % : ?, thousands, months). Conventions and glossary: `kit/FR-BRIEF.md`. Money `4 131,05 $`, dates `29 sept.`, times `14 h 30`, decimals with a comma, HST = TVH, quote = soumission, job = chantier.

## Rules that override the old app
- No prices or purchases in the phone app. The plan card only compares features and says plans change on quoteai.ca.
- The logo appears only on the assistant button and screen, in Settings (about), and on Welcome.
- Status is always a word plus colour. Every number is in Manrope with tabular figures.
- SignIn, Verify, Onboarding and Notifications show their states through the `state` / `step` prop (Tweaks), not on-screen toggles.
