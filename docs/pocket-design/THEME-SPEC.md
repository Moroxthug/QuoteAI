# Day and night theme: build spec

Every colour in the app comes from these tokens. Never hard-code a hex in a component.
Put the tokens on the app root, switch them with `data-theme="light|dark"`, and follow the Appearance setting (Light / Dark / Auto = follow the phone).

| Token | Day | Night | Used for |
|---|---|---|---|
| `--ground` | `#F5F4F1` | `#0C0C0E` | screen background |
| `--card` | `#FFFFFF` | `#18181B` | cards, sheets, AI bar |
| `--sunk` | `#EFEEEA` | `#26262B` | chips, search field, steppers, segmented track |
| `--soft` | `#F7F6F3` | `#1F1F23` | row hover, panels inside cards |
| `--ink` | `#141416` | `#F3F2EF` | main text, icons |
| `--inv` / `--on-inv` | `#141416` / `#FFFFFF` | `#F3F2EF` / `#141416` | primary buttons, selected day, bars (they invert at night) |
| `--t2` | `#3C3C43` | `#D0CFD5` | secondary text |
| `--muted` | `#6E6E76` | `#A09FA7` | captions, meta |
| `--faint` | `#8A8A90` | `#7C7B83` | chart labels, chevrons |
| `--line` / `--line2` | `#EFEEEA` / `#E2E1DC` | `rgba(255,255,255,.07)` / `.12` | dividers |
| `--ring` | `rgba(20,20,22,.05)` | `rgba(255,255,255,.07)` | the 1px card outline |
| `--acc` | `#6A2FBF` | `#8B5CF6` | accent fills: switches on, chart line, dots |
| `--acc-t` | `#5E2AB0` | `#BDA6FF` | accent text |
| `--acc-soft` / `--acc-soft-t` | `#EFE9FF` / `#3D1A86` | `rgba(139,92,246,.2)` / `#D8CAFF` | selected chips, plan pill |
| `--ok` / `--ok-dot` / `--ok-soft` | `#1F7A45` / `#1F9D55` / `#E8F3EE` | `#62D498` / `#34C375` / `rgba(52,195,117,.16)` | on site, paid, within budget |
| `--warn` / `--warn-dot` | `#9A6412` / `#D69524` | `#F2B660` / `#E9A53A` | en route, due soon |
| `--bad` / `--bad-soft` | `#C2371F` / `#FBF1EE` | `#FF7D68` / `rgba(255,125,104,.13)` | overdue, sign out |
| `--av` | `#F1EDE4` | `#2D2A26` | initials avatars |
| `--glass` | `rgba(255,255,255,.84)` | `rgba(28,28,32,.8)` | floating tab bar (with `blur(20px) saturate(1.6)`) |
| `--track-off` | `#DDDCD8` | `#3B3B41` | switch off, inactive page dots |
| `--scrim` | `rgba(20,20,22,.2)` | `rgba(0,0,0,.45)` | behind sheets |

## Rules for night mode
- Same layout, same type, same spacing. Only the tokens change.
- Primary buttons invert: light button with dark text at night.
- Switch knobs stay pure white in both themes. Switch "on" uses `--acc`.
- Check marks inside inverted checkboxes turn dark at night.
- Chart gridlines at night: `rgba(255,255,255,.08)`. Loading shimmer at night: `#26262B → #34343A`.
- These stay the same in both themes: the coloured icon tiles and tab shapes (their shadow deepens at night), the logo, the assistant screen (already dark), and the brand gradient.
- Logo wordmark at night: `filter: brightness(1.4)` so the violet stays readable.
- Night text contrast: body text ≥ 4.5:1 on `--card`. The values above meet this.
- Set `color-scheme: dark` at night so native inputs, the keyboard and scrollbars match.
- When the theme switches, fade the background colour over .45s.

## Menu and Settings (Revolut-style)

**Menu**
- Centred profile: 88pt avatar with a camera badge, name 24 / 600, role 13.5 muted, "Pro plan" pill.
- Three quick-action cards (Company, Documents, Invite).
- An action card for pending items, e.g. timesheets with a Review button.
- Groups with a 17 / 600 title above each white card. Rows are 60pt: 36pt icon tile, label 15 / 500, subtitle 12.5 muted, chevron. Dividers inset from the text.
- Sign out in its own card, red text.

**Settings**
- Title 30 / 600, then a search field (44pt, `--sunk`, radius 14).
- Same group, card and row pattern as Menu. Every row has an icon tile.
- Controls on the right: switch, stepper, or value plus chevron. Segmented choices (Language, Appearance, Units, Text size) sit full-width under their label.
- The Appearance control switches the theme live.

## Icons (update)
- Menu, Settings and the Edit Home list use unboxed icons, the same style as the tab bar. Each icon is a 28pt shape (30pt in quick actions) filled with its own 145° two-stop gradient. It has three layers: the main shape at full strength, a secondary shape at 60%, and an accent at 35%.
- On row hover the icon scales to 1.08 and rotates -4°.

## Plan card (Menu, under the profile)
- A normal card (`--card`, radius 22, 1px ring), so it follows day and night.
- Collapsed row:
  - The plan's tier icon (36pt, unboxed gradient).
  - "Business" 16 / 600 with a "Your plan" tag (`--acc-soft`).
  - "$249/month · Renews Oct 14" in 12.5 muted.
  - A round chevron (`--sunk`) that rotates 180° when open.
- Expanded (grid-rows 0fr → 1fr, .65s):
  1. **Tier selector.** A 4-column segmented track (`--sunk`, radius 17, 3pt padding) with a raised white thumb (`--card`, radius 14, soft shadow) that slides to the selected tier (.5s).
     - Each tier shows its gradient icon (26pt), name (12.5 / 600) and price, or "Current" for your plan (Manrope 11, muted).
     - Unselected tiers are desaturated (`grayscale(.85)`, opacity .55); the selected one is full colour and scales 1.08.
     - Tier icons, all unboxed with 3 opacity layers:
       - Starter: ringed dot, sage.
       - Pro: two stacked pills, indigo.
       - Business: three stacked pills, violet.
       - Elite: faceted diamond, gold `#F3D79B → #B8893A`.
  2. **Hero line.** Tier name 21 / 600 and a one-line pitch (12.5 muted) on the left; price in Manrope 26 / 600 with "per month" / "per year" / "priced with you" on the right.
  3. Monthly / Yearly segmented control, with a green "2 months free" tag.
  4. **Feature list.** A small muted title, then rows. Each row has its own unboxed gradient icon (24pt) and 14pt text, separated by hairlines, staggering in (35ms apart).
     - Current plan: "Included in your plan".
     - Higher plan: "Everything in Business, plus", with a green "New" on the right of each row.
     - Lower plan: "What you'd give up". Rows go grey (icon grayscale at 40%, text muted with a line through). Red notes on the right show the changes: "5 → 2" seats, "60 a month" quotes.
     - Icon per feature: quotes = page, seats = people, time tracking = clock, AI assistant = orb, analytics = bars, accounting sync = overlapping circles, calendar = calendar, card payments = card, price catalog = tag, contracts = pen, job sites = building, invoicing = document, email = envelope, API = brackets, lead ads = funnel, bank feeds = bank.
  5. **Button** (50pt, radius 15):
     - Current plan: "Manage billing" (`--sunk`).
     - Elite: "Talk to us about Elite" (`--inv`).
     - Lower plan: "Switch to Pro · $79/mo" (`--inv`). Once confirmed it shows "Downgrade scheduled" with a check (`--ok-soft`), and tapping again undoes.
     A 12pt muted note sits under it.
- Night mode: icons get `brightness(1.15)` so their lighter layers stay visible.
- Plans, prices and features are from quoteai.ca/pricing. Downgrades take effect at the end of the billing period.
