---
name: Field Architecture
colors:
  surface: '#faf9fc'
  surface-dim: '#dad9dd'
  surface-bright: '#faf9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f7'
  surface-container: '#eeedf1'
  surface-container-high: '#e9e8eb'
  surface-container-highest: '#e3e2e6'
  on-surface: '#1a1c1e'
  on-surface-variant: '#47464e'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f1f0f4'
  outline: '#78767f'
  outline-variant: '#c8c5cf'
  surface-tint: '#5b5b80'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#181839'
  on-primary-container: '#8180a7'
  inverse-primary: '#c4c3ed'
  secondary: '#006973'
  on-secondary: '#ffffff'
  secondary-container: '#99edf9'
  on-secondary-container: '#006d78'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#25005a'
  on-tertiary-container: '#9864ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c4c3ed'
  on-primary-fixed: '#181839'
  on-primary-fixed-variant: '#434367'
  secondary-fixed: '#9cf0fc'
  secondary-fixed-dim: '#80d3df'
  on-secondary-fixed: '#001f23'
  on-secondary-fixed-variant: '#004f57'
  tertiary-fixed: '#eaddff'
  tertiary-fixed-dim: '#d2bcff'
  on-tertiary-fixed: '#25005a'
  on-tertiary-fixed-variant: '#5900c7'
  background: '#faf9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e3e2e6'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  metric-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  metric-sm:
    fontFamily: Hanken Grotesk
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an executive, field-ready standard for mobile construction and contracting operations. It merges the exacting rigor of high-end computational tools with tactical field resilience. Contractor workflows demand immediate clarity under variable lighting, single-handed ergonomics on active jobsites, and a visual language that feels authoritative when presenting six-figure estimates to commercial clients.

The aesthetic philosophy centers on **Precision Functionalism**:
- **Utilitarian Balance**: High-density construction operational data is structured into tactile, scannable cards rather than squished desktop tables.
- **Architectural Weight**: Grounded by deep midnight navy framing with structural hair-thin borders, balancing heavy industrial utility with executive refinement.
- **AI as an Ambient Utility**: AI and automated features are rendered in focused ultraviolet accents, signifying assistive power without visual gimmickry or excessive decoration.

## Colors

The palette is engineered around high optical contrast, clear transactional states, and rigorous hierarchy.

### Core Hierarchy
- **Primary Navy (`#101031`)**: Grounding color used for solid buttons, top app headers, primary title cards, and high-impact structural anchors. Interactive state hover/active is `#24244a`.
- **Secondary Teal (`#0a7580`)**: Represents active jobs, live sync states, and primary informational markers, paired with `#e3f5f4` for soft surfaces.
- **Tertiary AI Violet (`#6c2bd9`)**: Dedicated to QuoteAI intelligence, predictive estimating, voice transcription, and automated takeoff suggestions. Tint surface: `#eeecfc`.
- **Ink Neutral (`#393a3d`)**: High-legibility core body text, replacing pure black to soften high-contrast glare under outdoor direct sunlight.

### Neutral Foundation & Surfaces
- **Canvas Base (`#fbfbfc`)**: Off-white backdrop to prevent optical fatigue.
- **Card Surface (`#ffffff`)**: Clean white elevated planar surfaces.
- **Surface Soft (`#f4f5f7`)**: Inset containers, segmented track backgrounds, and table header rows.
- **Surface Soft-2 (`#eceef2`)**: Recessed input fields, chip inactive fills, and interactive pressed layers.
- **Structural Border (`#dfe1e6`)**: 1px structural boundary line defining cards, itemized rows, and dialog sheets.
- **Text Layers**: Headings (`#101031`), Body (`#393a3d`), Muted metadata (`#6b6c72`), Faint placeholders & borders (`#6d6f76`).

### Functional Status Tokens
- **Operational Green**: Solid `#227a15`, Background Tint `#e9f6e6`. Used for paid invoices, approved milestones, profit margins, and signed change orders.
- **Warning/Pending Amber**: Dark `#7a5c00`, Accent `#ffe01b`, Background Tint `#fdf6c9`. Used for bids under review, client inspection holds, and unverified line items.
- **Critical Alert Red**: Solid `#bf3d09`, Background Tint `#fdeee5`. Used for cost overruns, safety blocks, expired insurance, and rejected proposals.

## Typography

The type system prioritizes structural alignment, numerical legibility, and geometric clarity.

- **Typeface Selection**: Hanken Grotesk is specified across headlines, functional body, and numeric data for its robust geometric construction, tall x-height, and neutral precision.
- **Tabular Lining Requirement**: All currency indicators, project estimate totals, square footage measurements, unit rates, and change order differentials must enforce tabular figures (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`). This eliminates visual flutter during row expansions, batch calculations, and dynamic recalculations.
- **Hierarchy Rules**: Top headers use bold navy anchors (`#101031`). Descriptive notes drop to secondary ink (`#393a3d`), while audit trails, timestamps, and subcontract IDs remain locked at `body-sm` (`#6b6c72`).

## Layout & Spacing

Mobile contractor interfaces must handle severe information density without degrading into un-tappable clutter. The system uses an architectural 4px/8px incremental rhythm structured around thumb-friendly reach zones.

### Field Layout Model
- **Outer Canvas Margins**: Fixed at `16px` (`margin`) on standard handheld screens to maximize horizontal card real estate, stepping up to `24px` on tablet viewports.
- **Column Gutter**: `12px` (`gutter`) for responsive dual-column metrics inside card summaries.
- **Vertical Stack Cadence**: Structural cards stack with an explicit `12px` gap. Related form fields separate by `space-md` (`16px`), while sub-labels tuck against inputs with `space-xs` (`4px`).

### Ergonomics & Fixed Viewport Zones
- **Bottom Operational Anchor**: Standard `60px` bottom tab bar height (exclusive of device home indicators) providing constant routing across Projects, Quotes, Field Feed, and Catalog.
- **Floating Action Deck**: Floating Action Buttons (FABs) and voice input triggers sit pinned above the bottom bar with an `80px` baseline elevation offset.
- **Persistent Bottom Action Bar**: Complex multi-step actions (e.g., "Send Estimate", "Approve Change Order") lock into a sticky `72px` bottom container with an integrated blur and top divider border (`#dfe1e6`).

## Elevation & Depth

Visual hierarchy is communicated via clean planar surfaces and crisp low-contrast borders rather than deep blurry dropshadows, ensuring optimal visibility on outdoor mobile displays under direct sunlight.

### Depth Tiers
- **Tier 0 (Base Canvas)**: Flat `#fbfbfc`.
- **Tier 1 (Structural Cards & Modules)**: Flat `#ffffff` surface enclosed by a clean `1px solid #dfe1e6` border. Zero shadow in standard resting states.
- **Tier 2 (Active/Pressed/Hovered Surfaces)**: Surface `#ffffff` elevated by `box-shadow: 0 4px 12px -2px rgba(16, 16, 49, 0.06), 0 2px 6px -1px rgba(16, 16, 49, 0.04)`.
- **Tier 3 (Modals, Action Sheets, Floating Mic)**: Pinned surfaces float with `box-shadow: 0 12px 32px -4px rgba(16, 16, 49, 0.12), 0 4px 12px -2px rgba(16, 16, 49, 0.06)` combined with a `1px solid rgba(223, 225, 230, 0.8)` rim.
- **Sheet Backdrop**: Tinted scrim using `#101031` at 40% opacity with a `4px` backdrop blur.

## Shapes

The design system establishes a strict contrast between structural containers and actionable controls:

- **Cards & Modules**: Bound by an exact `18px` corner radius. This softens technical data dense grids while maintaining structural architectural alignment.
- **Inputs & Inset Wells**: Built with `10px` radius, providing nested visual harmony when seated inside an `18px` card (`padding: 16px`).
- **Interactive Controls (Buttons, Status Chips, Badges)**: Fully pill-shaped (`999px` / `rounded-full`). Buttons, segmented toggle indicators, and state tags maintain full continuous curves to instantly differentiate action points from structural cards.

## Components

### Buttons & Interactive Touch Targets
- **Primary Pill Button**: Navy solid fill (`#101031`), text `#ffffff`, height `48px` (exceeding the strict `44px` minimum touch target), horizontal padding `24px`, border-radius `999px`. Active press state shifts to `#24244a` with a micro-scale of `0.98`.
- **Secondary Outlined Pill**: 1.5px border (`#dfe1e6`), surface `#ffffff`, text `#101031`. Active fill `#f4f5f7`.
- **AI Assist Action Button**: Gradient or solid `#6c2bd9`, text `#ffffff`, pill-radius, housing an integrated spark icon.
- **Touch Target Safeguard**: All micro-controls (icon toggles, clear buttons, chevrons) must feature an explicit `min-height: 44px; min-width: 44px;` hit box regardless of visual glyph size.

### List Rows (`.lrow`)
- **Dimensions & Layout**: Standardized `60px` height row with border-bottom `1px solid #dfe1e6`.
- **Structure**:
  - *Leading Slot*: `36px` circular badge, vendor avatar, or functional status tint icon container.
  - *Center Text Block*: Two-line stack featuring Item/Client Title (`title-md`, `#101031`) over Scope/Trade category (`body-sm`, `#6b6c72`).
  - *Trailing Metrics Slot*: Right-aligned block displaying financial amounts (`metric-sm`, tabular numerals, `#101031`) stacked above approval badge or inline diff tag.
  - *Trailing Navigation*: `16px` chevron `#6d6f76` with a `4px` left margin.

### Card-Based Responsive Tables (Desktop-to-Mobile Translation)
- Spreadsheets and desktop column tables are strictly translated into nested multi-attribute cards.
- **Card Header**: Scope title, quantity chip, and unit rate.
- **Card Body**: Expandable breakdown of Material, Labor, Subcontractor, and Equipment costs.
- **Card Footer**: Gross margin pill badge and inline quick-edit slider.

### Expandable Line-Item Editors
- In-place row expansion allows quick editing of unit price, waste factor percentage, and markup without route navigation.
- Inactive rows display condensed summaries; tapping toggles an accordion reveal containing stepped stepper controls (`-` / `+`) and a direct numeric input field.

### Floating AI Mic & Quick-Action Bar
- **Floating AI Trigger**: Centered or trailing `56px` circular button floating `16px` above the bottom tab navigation. Surface `#6c2bd9` with ambient shadow. Tapping engages hands-free voice transcription for on-site estimate item additions.
- **Audio Pulse Feedback**: Radial pulse animation using `#eeecfc` to confirm audio capture in noisy field conditions.

### Inputs & Form Fields
- Height `48px`, border `1.5px solid #dfe1e6`, background `#ffffff`, border-radius `10px`, padding `0 14px`.
- Focused state transitions to `1.5px solid #101031` with an outer `3px` glow of `rgba(16, 16, 49, 0.08)`. Error state uses `#bf3d09`.

### Status Badges & Chips
- Fully pill-shaped (`999px`), `26px` total height, horizontal padding `10px`, typography `label-sm`.
- Always rendered using functional tinted backgrounds with solid high-contrast foreground text:
  - *Active/Draft*: Background `#e3f5f4`, Text `#0a7580`.
  - *Approved/Paid*: Background `#e9f6e6`, Text `#227a15`.
  - *Pending/Review*: Background `#fdf6c9`, Text `#7a5c00`.
  - *Overdue/Blocked*: Background `#fdeee5`, Text `#bf3d09`.