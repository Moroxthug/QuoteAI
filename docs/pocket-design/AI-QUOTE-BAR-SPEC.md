# AI quote bar: build spec (Home screen)

Replaces the dark "New quote" card on Home. Reference prototype: the "Home, AI bar" artboard on the quoteAI Pocket CRM canvas.
Stack in this repo: React 19 + Tailwind 4 (`artifacts/quote-ai`), shipped to phones through Capacitor. Icons: lucide-react, stroke 1.8.

## Rules
- No "New quote" title and no "ON · HST 13%" label on the bar. No uppercase labels above titles, no emojis, no sparkle icons.
- Text: Geist. Every number: Manrope with `font-variant-numeric: tabular-nums`.
- One accent only: violet `#6A2FBF` (as text `#5E2AB0`). Primary buttons are ink `#141416`.
- Everything animates with `cubic-bezier(.16,1,.3,1)` unless stated. Respect `prefers-reduced-motion` (no animation, instant state changes).
- Touch targets ≥ 44px where possible (chips are 36px high inside a 58px bar; keep their hit area ≥ 44px with padding).

## Placement
Directly under the greeting on Home, 18px below it, 16px side gutters, above Schedule.

## States
`collapsed` → `open` → (optional panel: `client` | `budget`) → `building` → `done`.
Only one panel open at a time. Sending closes any open panel.

## 1. Collapsed bar (ChatGPT-style pill)
- Container: white `#FFFFFF`, radius 29px, height 58px.
  Shadow: `0 0 0 1px rgba(20,20,22,.07), 0 10px 26px -14px rgba(20,20,22,.25)`.
- Whole pill is one button (`aria-expanded=false`, label "Start a quote. Describe the job.").
- Layout, left padding 20px, right 9px, gap 4px:
  - Placeholder "Describe a job to quote…": Geist 15px / 400, `#8A8A90`, -0.01em.
  - Mic icon: 40px circle, transparent, icon 19px `#3C3C43`.
  - Send: 40px circle, `#141416`, white arrow-up 17px stroke 2.3. Scales to .92 on press.

## 2. Open (expand transition)
- Tap the pill → the same container grows into a card. Never swap containers; animate height.
- Height technique: wrap each region in a grid with `grid-template-rows: 0fr → 1fr` (inner div `overflow:hidden; min-height:0`), transition `grid-template-rows .6s`, plus opacity 0→1 over .35s ease. The pill row collapses (1fr→0fr) while the body opens (0fr→1fr), so it reads as one morph.
- Container when open: radius 26px (animate .55s). Shadow:
  `0 0 0 1px rgba(106,47,191,.26), 0 0 0 6px rgba(106,47,191,.06), 0 30px 60px -22px rgba(20,20,22,.34)` (a thin violet ring + soft halo).
- Rest of Home below the bar: opacity .3, `filter: blur(2px) saturate(.8)`, transition .55s. Tapping it collapses the bar.
- Focus the textarea ~380ms after opening.

Open card content (padding 14px, bottom 12px):
- Row 1: textarea + collapse button.
  - Textarea: no border, transparent, Geist 15.5px / 1.5, `#141416`, min-height 96px, 4 rows, no resize.
    Placeholder "Describe the job the way you'd say it on site", `#9A9AA0`.
  - Collapse: 34px circle `#F3F2EE`, chevron-down 18px `#3C3C43`.
- Row 2 (10px below; gap 6px): `[Client ▾] [$ Budget ▾] [photo]` … spacer … `[mic] [send]`.

## 3. Chips
- Default: height 36px, radius 999, background `#F3F2EE`, text `#141416` 13px / 500, icon 15px, chevron 12px at 45% opacity, padding 0 10 0 9.
- Open (its panel showing): background `#141416`, white text, chevron rotates 180° (.45s).
- Set (has a value): background `#EFE9FF`, text `#3D1A86`.
- Client chip when set: 24px avatar circle (`#3D1A86` bg, white initials 9.5px / 600) + first name (max width 96px, ellipsis).
- Budget chip when set: amount in Manrope, e.g. "$5,000".
- Photo chip: icon-only 36px circle.
- Mic: 36px, transparent, `#3C3C43`. Send: 40px `#141416`, shadow `0 8px 18px -6px rgba(20,20,22,.45)`; while building it shows a 14px spinner (2px ring, white top).

## 4. Client panel (expands under the chips, same grid technique)
- Panel: margin-top 10px, padding 10px, radius 18px, background `#F7F6F3`.
- Pick mode:
  - Search field: 40px high, radius 12, white, ring `0 0 0 1px rgba(20,20,22,.05)`, search icon 16px `#8A8A90`, Geist 14px.
  - Client rows (recent first): 34px avatar with a soft tint per client, name 14px / 500, address 12px `#6E6E76` (ellipsis). Rows stagger in (rise 10px + fade, 45ms apart). Hover `#EFEEEA`, radius 12.
  - Selecting: a 22px ink check springs in (`scale .4→1`, `cubic-bezier(.34,1.5,.64,1)`), then the panel closes after ~280ms and the chip shows the client.
  - Last row: "New client" with an ink "+" avatar.
- New mode (replaces the list, rises in):
  - "‹ Existing clients" back link, 12.5px `#6E6E76`.
  - Fields: Full name; Phone + Email in two columns; Site address. Label 12px `#6E6E76`; input 42px, radius 12, white, ring 1px `rgba(20,20,22,.06)`, focus ring 1.5px `#6A2FBF`.
  - "Add client": full width, 44px, radius 14, `#141416`, white 14px / 600. Saves, selects the client and closes the panel.
- Wire to the existing clients API (search + create).

## 5. Budget panel
The budget is the target total the AI should aim for, tax included.
- Same panel style.
- Big amount input centred: "$" in Manrope 26 / 600 `#B0AFAB`, value in Manrope 40 / 600 / -0.035em, numeric keyboard, formatted with thousands separators while typing. The width grows with the digits (animate .25s).
- Hint: "Tax included. The quote is shaped to land near it." 12px `#6E6E76`, centred.
- Presets in a 4-column grid, gap 6: $2.5k · $5k · $7.5k · $10k. 36px, radius 11, Manrope 13 / 600. Selected = ink bg white text; others white with a 1px ring.
- Actions: "No budget" (42px, radius 13, `#EFEEEA`) and "Set budget" (fills the remaining width, ink).
- Pass the budget to the quote generator as the target total incl. tax.

## 6. Building preview (the "watch it build" part)
Appears under the chips when Send is pressed (same grid expand). If the textarea is empty, don't send; shake it gently or keep focus.
- "Paper" card: margin-top 12, padding 14, radius 18, background `#FAF9F7`, inset ring `0 0 0 1px rgba(20,20,22,.05)`.
- Top edge: 2px progress line in the logo gradient `#6A2FBF → #4A8EDB`, growing left to right while building, fading out when done.
- Header: 26px client avatar (or a dashed "?" circle and "Client to confirm") + name 13px / 500; quote number on the right, Manrope 11.5px `#8A8A90`.
- Line items stream in one by one, ideally as the API streams them; otherwise reveal sequentially about 640ms apart. Each row: name 13px `#3C3C43`, amount Manrope 13 / 600, 1px top divider `#ECEBE7`, padding 8px 0. Entry animation: opacity 0, translateY 6px, blur 4px → normal, .6s.
- While the next item is coming: a shimmer placeholder row (two rounded bars 9px high, 58% and 18% wide, moving light gradient, 1.1s loop).
- Total row (divider `#E2E1DC`): "Total incl. HST" 12.5px `#6E6E76`; amount Manrope 26 / 600 / -0.035em with the cents at 16px `#A3A3A9`. The total counts up to each new running total (~480ms ease-out per step). Use the client's province tax, not a hard-coded 13%.
- With a budget: a 4px bar (track `#E7E6E2`) fills with total ÷ budget.
  - While building: "Fitting to your $5,000 budget".
  - When done and under budget: green `#1F9D55` bar, text "Within your $5,000 budget · $74 under" in `#1F7A45`.
  - When done and over budget: bar and text `#C2371F`, "Over budget by $X".
- Done: "Review and send" (ink, 46px, radius 14) opens the quote draft; "Edit" (46px, `#EFEEEA`) returns to the editable state.

## Accessibility
- The pill is a real `<button>` with `aria-expanded`; chips use `aria-expanded` for their panels; client rows use `aria-pressed`.
- Every input has a label (visually hidden where no label shows). Icon-only buttons have `aria-label`.
- Escape collapses the bar (web). Android back button closes a panel first, then the bar.
- Keep focus inside the card while it's open; return focus to the pill when it closes.

## Haptics (Capacitor)
Light impact when the bar opens, a client is selected, a budget is set, and when the quote finishes building.
