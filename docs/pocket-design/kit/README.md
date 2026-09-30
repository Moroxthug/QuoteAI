# quoteAI screen kit: how to build a screen

Scratch root: `/tmp/claude-0/-home-claude/623c0fab-b115-55d7-b946-c161fcbc5c10/scratchpad` (below: `$S`).

The app's design is LOCKED. You build new screens in exactly this style. Study these first:
- `$S/kit/kit.css`: every token and component class (read it fully).
- `$S/screens/Quotes.body.html` + `$S/screens/Quotes.js`: the reference screen (list, KPI card, search, filter chips, grouped rows, status pills, empty state, tab bar).
- `$S/design/project/Quote.dc.html`, `Menu.dc.html`, `Settings.dc.html`, `SmartHome.dc.html`: finished screens (look, spacing, copy tone).
- The product brief: `/mnt/user-data/uploads/QuoteAI/docs/design/QUOTEAI-APP-DESIGN-BRIEF.md` (what each screen must show).

## Build a screen
1. Write `$S/screens/NAME.body.html` (markup only) and `$S/screens/NAME.js` (the BODY of renderVals0: compute data, `return { ... }`).
2. Run `python3 $S/kit/assemble.py NAME "Title" $S/screens/NAME.body.html $S/screens/NAME.js HEIGHT [TAB]`. It writes `$S/design/project/NAME.dc.html` with fonts, the kit CSS, the theme wrapper, the glyph library and (with TAB) the floating tab bar.
   - Main tab screens (Quotes, Jobs, Clients): HEIGHT 844 and TAB = Quotes|Jobs|Clients. The body scrolls inside the phone.
   - Inner/detail screens: NO tab. Use a tall board (for example 1400–2600) so the whole screen shows on the canvas. Start the body with the back header:
     `<header class="hdr">[[BACK Quotes.dc.html]]<span class="ht">Title or ID</span>[[MORE]]</header>`
   - A floating action bar for inner screens: `<div class="fab-bar"><button class="more" aria-label="More actions">⋯ svg</button><a class="btn btn-p press" href="...">Primary action</a></div>`. It is absolute to the board bottom, so on tall boards put it at the end and leave padding for it.
3. Verify: `cp $S/design/project/NAME.dc.html $S/prev/ && cd $S/prev && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 shot.py NAME.dc.html out.png "CLICK_SELECTORS||..." VIEWPORT_H SCROLL_Y`. Then Read the PNG. The local server on port 8765 serves `$S/prev` (start it with `cd $S/prev && (python3 -m http.server 8765 >/dev/null 2>&1 &)` if it's down). Fonts fall back locally (Google Fonts is blocked); that's expected.
   - Check dark mode too: make a copy where `"dark":{"editor":"boolean","default":false}` becomes `true` and `var DARK_DEFAULT = false;` becomes `true`, then render it.
   - Fix anything clipped, overlapping, unreadable or invisible. Render at least light and dark for every screen, plus key interactive states.
4. Syntax-check the logic when in doubt: extract the script and run `node --check`.

## Format rules (the runtime is strict)
- `{{hole}}` is a dotted lookup only, never an expression. Compute everything in JS.
- Lists: `<sc-for list="{{items}}" as="it" hint-placeholder-count="3">…</sc-for>`. Branches: `<sc-if value="{{flag}}" hint-placeholder-val="{{ false }}">…</sc-if>`.
- Events: `onClick="{{fn}}"`, where fn is a function you return. Per-item handlers go on each item object. State: `self.g('key', default)` to read, `set({key: val})` to write.
- Close every element, quote every attribute, no self-closing custom tags. Inline `style="..."` is fine; a style hole like `style="width: {{x.w}}"` is fine.
- **Never put multi-layer backgrounds (several gradients) inside a hole string**: they fail to render. Use classes for complex backgrounds.
- No `<iframe>`, no emoji, no external images. Icons: the unboxed gradient icons below, or simple inline stroke SVGs (stroke="currentColor", width 1.8–2.2) for chevrons, plus, close, search, back.
- Links between screens: `<a href="Other.dc.html">`. Existing: SmartHome, Quote, Quotes, Menu, Settings. New names are listed in your task.

## Icons (unboxed gradient shapes)
In JS: `var x = ic('clock', 'teal');`. In markup: `[[ICON x 26]]` (sizes 22–44). Inside a sc-for use the item path: `[[ICON it.ic 24]]`.
- Glyphs: dot building tag list percent users user clock card sync gear bell help gift doc file cloud bars wave globe speaker shield pin mail sun eye moon ruler face export orb cal pen code funnel bank cone house camera photo mic chat phone send box truck warn check lock receipt hammer star link search plus tier1-4
- Tones: violet indigo lilac azure sage teal amber clay slate sky stone gold rose

## Visual language (non-negotiable)
- Background `var(--ground)`; content in `.card` (radius 22, 1px ring). Gutters 16px, section gap 18–24px. Calm, spacious, uncluttered.
- Type: Geist for text (inherited). Every number, amount, time, ID or % uses class `num` (big figures) or `mono` (small IDs, times). Titles: `.ptitle` (30/600) for tab screens; 21–24/600 for detail titles. Section headers: `.sh` with h2 15/600. Body 14–15, meta 12–12.5 muted.
- Colours only through tokens (`var(--ink)`, `var(--muted)`, `var(--card)`, `var(--sunk)`, `var(--acc)`, `var(--ok)`, `var(--bad)`, `var(--warn)`…) so dark mode works. Never a hard-coded grey or white for text or surfaces. The only allowed fixed colours are inside the icon tones.
- Status is always a word plus colour: `.st st-ok|st-warn|st-bad|st-acc|st-info|st-mute`.
- Buttons: `.btn btn-p` (primary, inverts in dark), `.btn-s` (secondary), `.btn-d` (destructive), `.btn-a` (accent violet, rarely), `.btn-sm` for small. One primary action per screen.
- Avatars: `.av` plus a tint class `tn1`–`tn5`.
- Lists: `.card` with `.lrow` rows (`.lt` > b + small, `.lr` on the right). Dividers come automatically.
- Filters: `.chips.scroll-x` with `.chip` (`.on` = selected, `.cnt` = count). Inner tab strips: `.tabs.scroll-x` with `.tab` (`.on`).
- Segmented control: see Settings (`.seg` + `.seg-ind` sliding thumb).
- KPIs: a `.card` grid, label 11.5–12 muted, value `.num` 17–19/600, a small sub line.
- Progress: `.bar > span` (use `.grow` to animate).
- Banners: `.banner b-info|b-warn|b-bad|b-ok|b-acc` (an icon plus text; bold the key phrase).
- Empty: `.empty` (icon 44, h3, p, one button). Loading: `.skel` blocks. Forms: `.field` (label + input).
- Motion: `.rise` on sections with small staggered `animation-delay`; `.press` on tappables. Keep it subtle.
- Copy: short, human, contractor-friendly. No uppercase labels above titles, no instruction paragraphs, no exclamation marks, no filler. English (Canada). Money `$4,131.05`, big figures `$48,230`. Canadian tax names (HST 13% Ontario).
- Sample world (keep consistent): company Rossi Renovations (Toronto), owner Marco Rossi. Clients: Dana Whitfield (17 Castle Frank Cres), Priya Nair (212 Dovercourt Rd), Tom & Lena Hart (48 Galloway Rd, Scarborough, basement finish $38,400 job, 64% done, drywall phase), Harbourfront Dental (Queens Quay W), Gill Residence, Okoye Condo, Marchetti Bakery, Chen Family. Crew: Luca Bianchi (painter lead), Amara Okafor (drywall), Sofia Marin (apprentice), Jonah Reyes (electrician, sub), Dev Patel (carpenter). Invoices INV-0412 Hart $2,340 9 days overdue, INV-0419 Harbourfront $780 3 days overdue. Today is Tue Sep 29 2026.
- Touch targets ≥ 44px; nothing may scroll sideways except chip and tab strips; labels must survive French (+20%), so avoid tight fixed widths.
- No prices or purchases in the phone app (store rules).

## Deliver
Report back: the files you created (NAME.dc.html in design/project), each board's HEIGHT, the links between them, and anything you couldn't do. Do NOT edit canvas.json, Menu/Settings/SmartHome/Quote/Quotes, the kit or other agents' screens.

## Design system v2 (read DESIGN-LOCK.md, "Design system v2")
- Status pills: `.st st-TONE si-SHAPE` (see the shape table). Never draw your own status dots. `.st-plain` for inline/header statuses. Roles/labels are `.tag` / `.tag tag-acc`.
- Buttons: `.btn` + `btn-sm` (36) / `btn-md` (44) / default (50) / `btn-lg` (54). Never set height, radius or font-size inline on a button.
- Type scale only: 10.5 11.5 12.5 13.5 14.5 15 16 17 19 21 24 28 30 32+. Weights 400/500/600.
- After editing sources: `python3 kit/normalize.py screens/*.body.html screens/*.js && python3 kit/rebuild.py && python3 kit/darkify.py`.
- Expandable cards: wrap in `.xc` with a `.xc-head` (onClick toggles, aria-expanded) containing the summary and `[[XCHEV]]`, then `.xc-body > .xc-clip > .xc-in` for the detail. One open per screen (store the open id in state), scroll it into view on open, add `has-open` to the list container. See DESIGN-LOCK.md "Expand in place".
