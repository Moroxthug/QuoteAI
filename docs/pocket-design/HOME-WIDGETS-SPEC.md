# Smart Home: widgets build spec

Reference prototype: the "Smart Home" artboard on the quoteAI Pocket CRM canvas. Build with React 19 + Tailwind 4 in `artifacts/quote-ai`, shipped through Capacitor.
Companion spec for the AI bar: `AI-QUOTE-BAR-SPEC.md`.

## Global rules
- Background `#F5F4F1`, cards `#FFFFFF`, ink `#141416`, secondary text `#3C3C43`, muted `#6E6E76`, faint `#8A8A90`, hairlines `#EFEEEA`.
- One accent: violet `#6A2FBF` (text `#5E2AB0`). Status colours: success `#1F7A45` / dot `#1F9D55`; warning `#9A6412` / dot `#D69524`; danger `#C2371F`.
- Text in Geist; every number, time, ID and % in Manrope with `tabular-nums`. Cents on big totals are shown smaller in `#A3A3A9`.
- No uppercase labels above titles, no emojis, no instruction paragraphs, no repeated titles.
- Main ease `cubic-bezier(.16,1,.3,1)`; sheet morph ease `cubic-bezier(.32,.72,0,1)`. Respect `prefers-reduced-motion`.
- Card shadow: `0 1px 2px rgba(20,20,22,.04), 0 0 0 1px rgba(20,20,22,.05)`.

## Page structure (390pt wide phone, 16pt gutters, vertical scroll)
1. **Header:** date plus site weather (12.5 / 500 muted, weather icon 14), greeting "Good morning, Marco" (Geist 24 / 600 / -0.035em). Avatar at right: 40pt ink circle with initials, and a 10pt violet notification dot. Tapping it opens Menu.
2. **AI quote bar:** see `AI-QUOTE-BAR-SPEC.md`.
3. **Three widget rows**, each a horizontal carousel: **Today**, **Money**, **Field**.
4. **"Edit Home"** pill, centred: 38pt high, `#EBEAE6`, 13 / 500, sliders icon.
5. Bottom padding of 120pt so content clears the floating tab bar.

Sections rise in on load (10pt up + fade, .9s), staggered 70ms per row.

## Widget rows (carousels)
- Row header: title 15 / 600 / -0.02em on the left. Page dots on the right (5×5 `#C9C8C4`; the active one stretches to 16×5 ink, animating width over .4s).
- Carousel: `display:flex; gap:10px; overflow-x:auto; scroll-snap-type:x mandatory; padding:0 16px; scroll-padding-left:16px`. Hidden scrollbar, `overscroll-behavior-x: contain`.
- Cards are 342×198 and snap to the start. The next card peeks about 22pt at the right edge, so people see there's more.
- Active dot index = `round(scrollLeft / 352)`.
- Rows with no enabled widgets are hidden entirely.

## Widget card (collapsed)
- 342×198, radius 24, padding 16/18, white, card shadow. The whole card is one `<button>` with `aria-haspopup="dialog"`.
- Top line: label left and context right, both 12.5 muted.
- Hover (web): shadow gains `0 14px 30px -18px rgba(20,20,22,.3)`. Press: scale .975.
- Each widget below lists its collapsed content, then what the expanded view shows.

### Today row
1. **Next up**
   - Collapsed:
     - Label "Next up" with "3 today" on the right.
     - Time in Manrope 32 / 600, with the countdown "in 1 h 20 min" (12.5 / 500 violet) beside it.
     - Title 15 / 500, then client, job and address (12 muted).
     - Day line: a 2pt track (`#EFEEEA`) covering 7:00 to 18:00; the elapsed part is `#C9C8C4`. Visits are 8pt dots coloured by type, and the next visit's dot has a 4pt violet halo. "Now" is a 2×16 violet tick. Labels 7:00 / 12:00 / 18:00 underneath in Manrope 10.5.
   - Expanded: 7-day strip with a sliding ink selector, and the agenda timeline (time, type dot, title, place, "On site" / "Next" tags). An empty day shows "Nothing booked" with an "Add visit" button.
2. **Today's list**
   - Collapsed: label "Today's list" and "2 of 6". The top 3 open tasks, each with a 16pt empty circle, text (13.5 / 500, one line with ellipsis) and meta (11.5; red if urgent, amber if due soon).
   - Expanded: the full list. Round 22pt checkboxes whose check strokes in over .35s, done text strikes through and fades to `#9A9AA0`, and a progress bar.
3. **Site weather** (for the site where most crew are today)
   - Collapsed: "12°" in Manrope 34, the summary "Rain after 3 pm", a cloud icon in `#3F86D0`. Eight rain bars (height = probability, opacity .25 to 1) with hour labels, growing in with a stagger. One practical line, e.g. "Plan exterior work before 14:00".
   - Expanded: one card per active site with the current temperature, a summary, 6 time slots (hour, temperature, rain %; slots at 50% rain or more get a `#E7F0FA` background), and one practical note.

### Money row
4. **Collected**
   - Collapsed: "Collected in September" with "↑ 12%" in green, the amount in Manrope 32, and a sparkline (2pt violet line with an 8% violet fill and an end dot) over the last 6 months.
   - Expanded: Week / Month / Quarter selector with a sliding white indicator. Smooth line chart that draws in and reshapes between periods. Stats row: Quotes won (with a mini bar), Outstanding, Margin.
5. **Outstanding**
   - Collapsed: the total in Manrope 32. A 6pt split bar (ink for not yet due, red for overdue) with both amounts under it. The worst overdue invoice in a `#FBF1EE` pill: client and invoice number on the left, amount and days late on the right in red.
   - Expanded: every unpaid invoice with client, invoice number (Manrope), due status (red when overdue) and amount. Overdue rows get a "Remind" button (ink, 32pt).
6. **Quotes**
   - Collapsed: pipeline in 4 columns (Drafts, Sent, Viewed, Won; Manrope 24 with 11.5 labels, divided by hairlines), a win-rate bar in the logo gradient `#6A2FBF → #4A8EDB`, and the latest client activity line.
   - Expanded: the pipeline card, then "Waiting on clients": quotes with client, job, amount and status (viewed = violet, expiring = amber, draft/sent = muted). Rows open the quote.

### Field row
7. **Crew**
   - Collapsed: 42pt initials avatars (bg `#F1EDE4`) with status rings: 2pt white gap, then a 1.5pt ring (green on site, amber en route, grey off). First names below at 11pt. Summary "3 on site · 1 en route", plus one live line ("Jonah is 14 min from Galloway Rd").
   - Expanded: avatar row where tapping a person shows their role, site and status in a detail strip. Add call/message actions in production.
8. **Sites**
   - Collapsed: the top 2 active sites, each with name, % (Manrope), a 4pt ink progress bar and the phase line. "5 active" at top right.
   - Expanded: all sites with progress, phase, crew and weather.

## Expand / collapse (the key interaction, v2: in place)
- Tap the top of a widget: the card grows downward in place (no overlay, no bottom sheet). Its row locks, the card widens from 342 to 358pt, the neighbours fade out, and the page content below moves down.
- The expanded part: hairline, optional caption, the widget's rows (each with a plain status and, where useful, one action such as Remind, Follow up, Call, Directions), then a primary action ("Remind both") and/or an "Open …" link to the full screen.
- Tap the top again to close. Only one widget open at a time; opening another closes the first and scrolls it into view.
- Row buttons turn green-soft with the past tense when tapped ("Reminded"), tap again to undo.
- See DESIGN-LOCK.md, "Expand in place", for timing and classes.

## Edit Home (customisation, v2 gallery)
- Bottom sheet as before (translateY 105% → 0, .6s `cubic-bezier(.32,.72,0,1)`, 30pt top radius, ground background).
- Header: "Your Home" (19 / 600) + "Done" pill. Under it: "**13** on Home. Tap to add or remove." (count in Manrope).
- Filter chips: All · Today · Money · Sales · Field · Office (34pt, ink when selected).
- Each group: title (15 / 600) + "N of M on Home" (12.5 muted), then a 2-column grid of widget tiles.
- Tile (radius 18, 1px ring, min height 148): unboxed gradient icon 30 · the widget's live headline figure (Manrope 19 / 600, e.g. "$6,212") · name (14.5 / 500) · one-line description (12.5 muted).
  - Off: an empty 22pt ring top right. On: 2px ink outline and the ring fills ink with a tick (spring .35s). Tap toggles; Home updates live behind the sheet.
- Save per user. In production also allow drag to reorder inside a row.

## Widget library (20 widgets, 5 rows)
Rows only show when at least one of their widgets is on. Default on = ●.
| Row | Widget | Collapsed card shows | Expanded shows |
|---|---|---|---|
| Today | ● Next up | next visit time, countdown, day line | today's agenda |
| Today | ● Today's list | open tasks | full task list |
| Today | ● Site weather | temp, rain by hour | per-site hourly |
| Today | ● This week | 7-day strip: visits as dots, rain drops, today tinted | rain days and the jobs to move (Move) |
| Today | Leave by | leave time, drive vs spare time bar | checklist, "text client I'm on the way" (Send), Start directions |
| Money | ● Collected | month total, trend | periods, chart |
| Money | ● Outstanding | total, due vs overdue | invoices with Remind |
| Money | ● Cash forecast | net next 30 days, weekly bars (green in, red out) | what's coming in and out, with status |
| Money | ● HST to set aside | amount, due date, collected vs credits bar | checks before filing, "Send summary to my accountant" |
| Money | e-Transfers | 2 payments with matching invoices | Confirm per payment |
| Sales | ● Follow-ups | 3 people to nudge, with status | drafted messages, Send each or Send all |
| Sales | ● Quotes | pipeline counts, win rate | quotes waiting on clients |
| Sales | New leads | count, split by source | leads with Reply, open Leads |
| Field | ● Crew | who's on site | crew list, live status |
| Field | ● Sites | progress on active jobs | all sites |
| Field | ● Hours to approve | hours, bars per person (amber = overtime) | entries with Approve, Approve all |
| Field | Materials | 3 items to order with status | items with cost, Order, one combined order |
| Field | Job costs | spent vs done per job | budget detail, Open job |
| Office | Done for you | what quoteAI did today | actions with Undo |
| Office | Expiring soon | WSIB, insurance, registration dates | Renew |
- Collapsed cards use one of four visuals so they stay calm: big figure, split bar with legend, small bars, 7-day strip, or up to 3 rows with a plain status. Never more than one visual plus one footer line.
- Row buttons in expanded sheets are 36pt, ink; after a tap they turn green-soft with the past tense ("Sent", "Approved", "Confirmed") and can be tapped again to undo.

## Needs you (top of Home, under the AI bar)
- Title "Needs you" (15 / 600) with an ink count badge (Manrope 12 / 600). Right: "Swipe for more".
- A horizontal snap row of action cards (268×124, radius 22, 10pt gap): gradient icon 26, title (14.5 / 500, one line), one or two lines of context (12.5 muted), a plain status bottom left and one ink 36pt button bottom right.
- Sources, most urgent first: hours to approve before payroll, e-Transfers to confirm, new leads with a drafted reply, overdue invoices with a drafted reminder, crew questions from site.
- Tap the button: the card turns green-soft, the content lifts out and a tick springs in with the past tense ("Approved") and Undo. After 2.6s the card collapses its width (.5s) and the row closes the gap; the count drops.
- Empty: a green-soft line "All caught up · New things that need you show up here." Never a celebration, never an exclamation mark.

## Quick add (the + next to the avatar)
- 40pt round sunk button with a plus. Opens a bottom sheet "Quick add" with a 3×2 grid of tiles (radius 18): Receipt, Site photo, Clock in, Payment, Lead, Voice note. Each tile: gradient icon 32, name (13.5 / 500), one short line (11.5 muted).
- Receipt goes straight to the camera: dark frame with white corner guides and a violet scan line. Once read, a card shows store, date, HST and total (Manrope) and the best-matching job with a "Best match" status; one large button "Save to Basement finish". Saved → green-soft button, then a toast "Receipt saved to Basement finish".
- Toasts: ink pill, 40pt, 13.5 / 500, 104pt above the bottom, 2.2s.

## Floating tab bar
- 16pt from the sides, 26pt from the bottom.
- Pill: 62pt high, `rgba(255,255,255,.82)` with `blur(20px) saturate(1.6)` behind it. Four tabs: Home, Quotes, Jobs, Clients. Labels 10.5. The active tab sits on a `#F1F0EC` pill.
- Tab icons have no box or background. Each one is a solid shape (25pt) filled with its own 145° gradient. Details like the door and the page lines are cut out of the shape (transparent), and a secondary part sits at 40–75% opacity for depth.
  - Home: violet `#A083F3→#6A2FBF`, house with a cut-out door and a faint chimney dot.
  - Quotes: indigo `#98A1F6→#4F57D6`, rounded page with two cut-out lines and a faint dot at the corner.
  - Jobs: amber `#F4C06C→#D07A1E`, site cone with a cut-out stripe, a base at 70% opacity, and a faint dot.
  - Clients: green `#86CFA6→#2F8A5C`, front person solid, second person's head at 45% and body at 75%.
- The active tab's icon is in full colour. Inactive icons use `filter: grayscale(1); opacity:.5`. On hover they get some colour back (`grayscale(.3)`, opacity .85) and lift 1pt. State changes animate over .45s; pressing scales the icon to .88.
- To the right: the **logo button**, a 62pt full swirl mark disc (`quoteai-mark.svg`) on white, turning slowly (18s per turn), with a pulsing violet halo and a violet-tinted shadow. It opens the voice assistant.

## Voice assistant (from the logo button)
- A dark layer (`#09090B`) grows as a circle out of the button (clip-path, .8s `cubic-bezier(.7,0,.2,1)`). Home scales to .92 and dims behind it.
- Orb: blurred blobs in `#7B3FE4`, `#4C9DE5`, `#4F46E5`, `#6EC8F5` and `#EFE9FF` inside a morphing sphere, plus a rotating conic glow. Its size and glow follow the voice level (listening, thinking, speaking). A small white swirl mark sits at the top.
- Controls: keyboard, a 76pt white mic (mute turns it red-tinted and the orb grey), close.
- Keyboard mode: the orb shrinks to the top and a message bar appears; replies stream word by word.

## Menu icon system (abstract tiles)
- 32pt tiles, radius 10, a 145° two-stop gradient per item.
- Inner light: `inset 0 1px 0 rgba(255,255,255,.35)` plus a soft radial highlight top-left.
- White glyphs built from 2–3 simple shapes at opacities 1 / .62 / .38.
- Colour families by group:
  - Business: violet, lilac, indigo, azure
  - Team: sage, teal
  - Money: amber, clay
  - App: slate, sky, stone
- Hover: scale 1.06 and rotate -3°.
- Gradient pairs: violet `#A387F4→#6A2FBF`, lilac `#C0A6F6→#7E4FD8`, indigo `#9EA6F6→#4F57D6`, azure `#93B8F6→#4D72D9`, sage `#98D5B2→#3E9468`, teal `#8AD8D2→#2E9C97`, amber `#F5CD8A→#D98E2B`, clay `#F3B2A3→#D5604F`, slate `#B3B8C6→#5F6677`, sky `#92C8F3→#3F86D0`, stone `#D8CAB7→#9A8466`.
- Export the glyphs from the prototype as SVG components, or ask for them as a separate icon set.
