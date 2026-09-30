# Components

Build these 24 pieces first, in a sandbox screen that mirrors `Components.dc.html`, in light, night and French. Every screen after that is composed only from them. Sizes are in points (px in the design). Token names refer to `tokens/tokens.json`.

## Foundations

### 1. Text and Num (the font rule)
- `Text`: Geist, weights 400/500/600 only, sizes only from `type.scale`. Default 15/400, colour `ink`, letter-spacing −0.01em.
- `Num`: Manrope with tabular figures, for standalone figures (amounts, KPIs, times, IDs, percentages). Big figures 600 weight with tight letter-spacing (−0.03 to −0.045em).
- **Digits inside sentences are Manrope too.** On the web the design does this with a digits-only Manrope font face (`kit/numlock.py`). React Native can't merge fonts, so `Text` must split its string into runs: every run matching `/[0-9$%+−°]+(?:[.,  ][0-9]+)*/` renders as a nested `<Text style={{fontFamily: 'Manrope'}}>`, and the rest stays Geist. Put this inside the base `Text` so nobody has to remember it. Inputs that hold numbers (amounts, quantities, codes) use Manrope for the whole field. **Digit weight matches the text around it:** Geist 400 → Manrope 400, 500 → 500, 600 → 600. Bundle the Manrope variable font (or static 400, 500, 600 and 700), not only 500 to 700; heavier digits in a regular sentence look bolded.
- Money: en-CA `$4,131.05`; fr-CA `4 131,05 $` (narrow no-break space for thousands, no-break space before `$`). Use `Intl.NumberFormat` per locale; never build the string by hand.

### 2. Icon
- 3 layers on a 19×19 viewBox (`icons/icons.json`): `d1` full, `d2` at 60%, `d3` at 35%, all filled with a two-stop diagonal gradient from the tone (`icons/tones.json`).
- Sizes: 28 in lists and settings rows, 30 in quick actions, 25 in the tab bar, 22 to 44 elsewhere. No box, no background tile.
- Utility glyphs (back, close, chevron, plus, search, more) are simple 1.8 to 2.2 stroke SVGs in `currentColor`, not gradient icons.
- Night mode: the same gradients, brightened ×1.15.

### 3. Theme
- `light` and `dark` token sets. The background (`ground`) option only changes the light ground, sunk, soft, line, line2, av and (on fades) muted. Default ground: `dusk`, a porcelain base with a lilac fade rising from the bottom. The fade is fixed to the screen and does not scroll with content.
- Follow the system appearance; Settings can force Light, Night or Auto. Until Settings is built (phase 5), put a temporary Light / Night / Auto switch on the sandbox screen only.

## Surfaces

### 4. Card
Background `card`, radius 22, a 1px `ring` outline (no drop shadow at rest), padding 16. Lists of rows sit inside one card with hairline dividers.

### 5. Sheet
Bottom sheet for input and choices only (pickers, Quick add, confirmations, Edit Home). Radius 28 on top, grab handle 36×5 in `line2`, scrim `scrim`, shadow `shadow.sheet`. Slides up with the `out` easing; drag down or tap the scrim to close.

### 6. Expandable card (read in place)
- Tap the top of a card: the same card grows downward and pushes content below. Nothing covers the page.
- Height 0→auto over 450ms (`expand` easing). Content fades in 6pt from above after 120ms. The 24pt chevron top-right rotates 180° and gets a `sunk` circle.
- Floating pop: the opening card scales .985 → 1.022 → 1 and settles 2pt up over 620ms (`pop` easing) with a deep soft shadow. Its rows, figures and actions pop in one after another, 40ms apart.
- In a list, the open row detaches: 8pt outside the list edges, its own radius 22 and shadow, other rows fade to 45%.
- Only one card open per screen; opening another closes the first. The opened card scrolls itself into view.
- Inside: a hairline, optional caption, up to 5 rows (title 14.5/500, context 12.5 muted, plain status, one 34pt action), optional 3 mini figures, then one primary action (44, `inv`) and one "Open …" link button (44, `sunk`). Anything longer belongs on the full page.
- Home widgets: the open card locks its row (no sideways swipe) and widens to the full 358.
- Reduced motion: it opens instantly.

### 7. Header
52 tall: a 44 back button on the left, a centred title 15/600 (ellipsis), and a 44 "more" button on the right. Tab screens use a large page title (30/600) instead.

### 8. Floating tab bar and assistant orb
- One row 16 from the sides and 26 from the bottom: the glass bar (`glass` + 20pt blur + `shadow.float`, 62 tall, radius 31, padding 5) takes the width, then a 10 gap, then the orb.
- Four tabs: Home, Quotes, Jobs, Clients (French: Accueil, Soumissions, Travaux, Clients). Each tab has a 25pt icon over a 10.5 label, gap 4. The active tab gets a `sunk` pill (radius 26), label 600 `ink`; inactive tabs have greyscale icons at 50% and 500 `muted` labels.
- On the right, the 62pt assistant orb: a white disc with the swirl logo rotating slowly (18s) and a violet halo breathing (3.2s).
- Content scrolls under the bar; leave 120 bottom padding.

### 9. Floating action bar (detail screens)
Same position as the tab bar: a 56 round "more" glass button plus one 56 pill primary button. One primary action per screen.

## Controls

### 10. Button
| Size | Height | Radius | Text |
|---|---|---|---|
| sm | 36 (44 hit area) | 11 | 13.5/600 |
| md | 44 | 13 | 14.5/600 |
| default | 50 | 15 | 15/600 |
| lg | 54 | 17 | 16/600 |

Kinds: primary (`inv` / `on-inv`, inverts at night), secondary (`sunk`), destructive (`bad-soft` / `bad`), accent (`acc`, rare). Disabled 40% opacity. Press: scale .96 over 200ms. Never set a button's height, radius or font size by hand.

### 11. Chip (filters)
34 tall, radius 999, 13.5/500, `sunk`. Selected is `inv` / `on-inv`. An optional count in Manrope 11.5/600 at 65%. Chips sit in a horizontal scroll strip with gap 6 and 16 side padding; this is the only sideways scrolling allowed besides tabs and Home widget rows.

### 12. Segmented control
A 36 track in `sunk`, radius 11, padding 2. The thumb is `card` with radius 9 and a small shadow, and slides over 450ms (`out` easing). Labels 13.5/500.

### 13. Tabs (inside a screen)
44 tall, gap 22, 14.5/500 muted. Active is `ink` 600 with a 2pt underline. Sticky under the header, hairline below.

### 14. Search
44 tall, radius 14, `sunk`, a search glyph, input 15, placeholder `faint`.

### 15. Field and form
- Field: 12.5 muted label above a 46 input (radius 13, `card`, 1px `line2` outline). Focus: 1.5px `acc` outline. Error: 12.5 `bad` text with an icon.
- Form card: grouped rows 62 tall inside one card, label 12.5 muted over a 16 input, hairlines between, the focused row tinted `soft`. The card outline turns `bad` on error.

### 16. Switch
51×31, radius 999, padding 2. The knob is 27 white with a small shadow and travels 20pt with a spring (400ms). On: `acc`; off: `track-off`. Always paired with a text label (accessibility role switch).

### 17. Swipe row
A list row that slides left to reveal 78-wide action tiles (11.5/600 label under a glyph, tinted by tone: info, ok, acc, bad, warn, mute). It snaps open or closed. A row that is expanded can't be swiped.

## Content

### 18. List row
44 minimum height, padding 12×16, gap 12. Left: icon or avatar. Middle: title 14.5/500 and meta 12.5 muted, each one line with ellipsis. Right: figure (Num) and/or status. Pressed: `soft`.

### 19. Avatar
38, round, initials 12.5/600. Five tints: tn1 green, tn2 violet, tn3 amber, tn4 blue, tn5 neutral.

### 20. Status pill and tag
- Status: 24 tall, radius 999, 11.5/600, a 14pt shape icon on the left. Six tones × twelve shapes: see `tokens.json → status`. The word always shows. The plain variant (no background, 18 tall) is for headers and inline text.
- Tag (roles and labels, not states): 24 tall, radius 8, 11.5/600, `sunk` / `t2`; the accent tag uses violet tint.

### 21. KPI tile and progress bar
- KPI: label 12.5 muted, value Num 19/600, sub-line 11.5 muted. Grid of 2 or 3 inside one card.
- Progress: 4 tall, radius 4, `sunk` track, `inv` fill that grows in over 1.2s on first view.

### 22. Banner
Radius 16, padding 12×14, 13.5 text with the key phrase bold, an icon on the left. Tones: info, warn, bad, ok, accent. One banner per screen at most.

### 23. Empty, loading and toast
- Empty: centred icon 44, title 16/600, one line 13.5 muted (max 260 wide), one button.
- Loading: skeleton blocks in `sunk`/`soft` with a 1.2s shimmer. No spinners on content.
- Toast: 40 tall pill, `inv` / `on-inv`, 13.5/500, 104 above the bottom, slides in over 450ms, disappears after 3s. Undo lives here when offered.

### 24. Motion helpers
- Rise: sections enter from 10pt below with opacity 0 → 1 over 800ms, staggered 40 to 80ms.
- Press: scale .96 on every tappable.
- Everything respects the OS reduced-motion setting.

## Accessibility baseline
- Touch targets at least 44×44.
- Contrast: body and meta text at least 4.5:1 on every ground (muted switches to #66666E on the lilac fades for that reason). `faint` is decoration only.
- Every icon-only button has a label; expandable cards announce expanded/collapsed; status reads as its word.
- Dynamic Type: all text scales; rows grow taller, and nothing is cut off or overlaps. Test at the largest size on Quotes, Invoice, Home and Settings.
- French runs about 20% longer: no fixed-width labels.
