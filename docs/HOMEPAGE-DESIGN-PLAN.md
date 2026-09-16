# Homepage & Design System Overhaul — Implementation Plan

**Status: superseded (2026-09-16).** The user supplied two concrete reference mockups (navy `#101031` + Figtree, pill buttons, tinted chips, mega-menu, animated hero/stats) and asked for a direct visual replication instead — the opposite direction from this doc's "Intuit-style restraint, muted bronze accent, small radii" recommendation. That work is tracked in `docs/DESIGN-SYSTEM.md`. This doc is kept for its diagnosis in §1 (wrong-product homepage copy, fake Italian testimonial logos) and its integration-logo sourcing notes in §5, which are still valid and unaddressed — but its palette/typography/radius recommendations in §4 are no longer the direction and should not be implemented.

**Status** (original): planning, not started. Nothing in this doc has been built yet — it's for review/approval before any code changes.

## 1. The actual problem (diagnosis, not vibes)

Read `artifacts/quote-ai/src/pages/home.tsx` and `artifacts/quote-ai/src/index.css` end to end. Three concrete, fixable problems, not a vague "make it nicer":

1. **The homepage sells the wrong product.** It markets "AI quote generator" only — a single hero + quote-builder demo. Phases 0–29 shipped a full job-lifecycle + team + payments + integrations platform (contracts, invoicing, GPS time tracking, QuickBooks/Wave sync, Meta lead ads, calendar sync, dark mode, tiered quotes...). None of that exists on the homepage. A visitor has no way to learn QuoteAI is more than a quote generator.
2. **The visual language reads as an AI-demo toy, not a company.** Concretely: a mouse-tracked 3D parallax hero scene (`handleHeroMove`/`handleHeroLeave`, home.tsx:48-57), gradient text, glow/blur shadows, and an index.css comment that literally says `/* LIGHT MODE — bianco puro, scala Scale AI */` — the palette was seeded from Scale AI's marketing site, a company whose entire brand is "look like a cutting-edge AI lab." That's the wrong reference for a tool a 50-year-old electrician in Trois-Rivières needs to trust with his invoicing.
3. **Trust signals are fake or mismatched.** `public/images/testimonials/abdul-edilizia-logo.png` / `rba-edilizia-logo.svg` are Italian construction-company logos ("Edilizia" = construction, in Italian) — leftover from an earlier non-Canadian iteration. A bilingual EN/FR Canadian contractor SaaS showing Italian testimonial logos is worse than showing none. **This must not be "fixed" by generating new fake testimonials** — either get real ones from the user's actual early customers, or remove the section until there are real ones (a stat-driven trust strip — "Built for Canadian contractors," province coverage, CASL-compliant messaging — works fine with zero customer logos).

## 2. Reference benchmark (researched live, 2026-09-15, quickbooks.intuit.com/ca)

Not guessing at "what QuickBooks looks like" — pulled real computed styles and page structure from the live site so the plan is grounded in an actual reference, not an invented pastiche:

- **Structure, top to bottom**: slim promo bar → black nav (logo, product dropdown, pricing, sign-in, phone number) → hero (headline + one-line subhead + single primary CTA + review-count trust line + a real product screenshot, not an abstract scene) → logo/stat strip → **icon-led feature grid**, one short paragraph + "Learn more" per feature, grouped by product area (Accounting / Payments / Payroll / Customers / Inventory / Project Management / Sales Tax / Reporting) → stat callout ("customers save 13 hours/month") → **one real testimonial** with a named person, title, company, city → pricing cards (3 tiers, one visually flagged as the recommended tier) → full feature-comparison table → footer.
- **Typography**: a single proprietary sans (their "AvenirNext forINTUIT") used everywhere — headline weight is closer to regular/medium (400–500), not heavy/black — restraint over impact.
- **Color**: overwhelmingly black (`rgb(0,0,0)`) nav/buttons and white/off-white (`rgb(250,251,252)`) body, with exactly **one** saturated brand accent (their green) used sparingly for the promo bar and key CTAs. Cards use small, consistent radii (4px on most UI chrome, 16px on a few feature cards) — never the large blobby/glassmorphism radius our current CSS uses.
- **No gradients, no glow, no parallax, no 3D.** The only "motion" is a sticky-scroll pricing toggle and standard hover states. The premium feeling comes from restraint, real screenshots, and information density — not effects.

This is the actual lesson to take: **fewer colors, real product screenshots instead of abstract art, structured grids instead of floating cards, one accent color used sparingly, and real names/numbers instead of decoration.**

## 3. Design principles for QuoteAI (the rules that prevent regressing to "AI toy")

1. **One accent color, used sparingly.** Everything else is ink, white, and gray. If a component wants a second bright color, that's a sign it should be a neutral instead.
2. **No abstract decoration.** No gradient blobs, no glow/blur shadows, no mouse-parallax, no generic "AI network/particle" imagery. If a section needs visual interest, it's a real screenshot of the actual product UI (the quote builder, the dashboard, the job timeline) — QuoteAI already has all of this built; use it.
3. **Real numbers or no numbers.** Never fabricate a stat, testimonial, or customer logo. A trust strip can say "Built for Ontario, Quebec & BC contractors" or "CASL-compliant by default" — factual claims about the product — without inventing social proof.
4. **Show the whole product.** The feature grid must cover the platform as it actually exists today: AI quoting, contracts & e-sign, job tracking & GPS time, invoicing & payments, team roles, integrations (QuickBooks/Wave/Google/Meta/WhatsApp), analytics. Reuse the phase list in `docs/JOB-LIFECYCLE-PLAN.md`, `docs/GROWTH-PLATFORM-PLAN.md`, `docs/EDGE-FEATURES-PLAN.md` as the literal source of what to list — don't re-derive marketing copy from imagination.
5. **Restraint in typography and motion.** Headline weight 600 max, no gradient text, standard ease-in-out hover/fade only — no scroll-jacking, no 3D.
6. **Integration logos are official brand marks, used correctly.** Vendor logos (QuickBooks, Wave, Google, Meta, WhatsApp, Microsoft/Outlook, Stripe) are trademarks — display them at a fixed small size in a neutral "works with" strip (monochrome/grayscale by default, color on hover is a common, safe convention), never implying a formal partnership we don't have, and only for integrations that are actually reachable in production (cross-reference `[[edge-features-plan]]`/`[[growth-platform-plan]]` gating status — don't show a logo for something gated on an unapproved developer app).

## 4. Design system (concrete tokens — this is what "the palette" means)

Replace the Scale-AI-derived tokens in `artifacts/quote-ai/src/index.css` (`:root` block, currently commented "scala Scale AI"). Proposed palette, grounded in the same restraint principle as §3, but distinct from Intuit's own trade dress (we're not copying their black+green, we're copying their *discipline*):

| Token | Value | Use |
|---|---|---|
| `--ink` (primary) | `#0B1220` (near-black navy) | headlines, nav, primary buttons, footer |
| `--paper` (background) | `#FFFFFF` | page background |
| `--surface` | `#F7F8FA` | alternating section backgrounds |
| `--border` | `#E4E7EC` | card borders, dividers |
| `--text-body` | `#374151` | body copy |
| `--text-muted` | `#6B7280` | secondary text, captions |
| `--accent` (brand gold) | `#B4791A` (deepened/desaturated from the current `41 96% 40%` amber — same hue family, less neon) | CTAs, active states, price highlights, checkmarks — used sparingly, never as a page background |
| `--accent-foreground` | `#FFFFFF` | text/icons on accent |
| `--success` | `#1A7F4E` (muted forest green, not neon) | "saved," "paid," positive deltas |
| `--danger` | keep existing destructive red | errors only |

Notes:
- This keeps the *existing* ink-navy/gold pairing (it's a good fit for a trades/contractor brand — Jobber, BuilderTrend, Procore all use a dark-neutral + one warm accent) but tones the gold down from a bright amber to something closer to bronze/brass, and strips out every gradient/glow currently layered on top.
- Dark mode (Phase 24, dashboard-scoped): same discipline — `--ink` becomes the background, `--paper`-equivalent becomes a near-black surface, accent stays the same gold (it already reads well on dark, per Phase 24's build notes).
- Radius: `--radius` drops from whatever produces the current "blobby" look to `8px` (cards) / `6px` (buttons/inputs) — Intuit-style small, consistent radii, not large marketing-site radii.
- Shadow: remove glow/blur box-shadows; keep only a single flat `0 1px 2px rgba(16,24,40,0.06)` for card elevation.
- Typography: keep Inter (already loaded as a variable font with a correct CLS-safe fallback — no reason to change the font, the *usage* was the problem, not the typeface). Headline scale becomes a disciplined type ramp (e.g. 40/32/24/18/16px) at weight 600, not the current oversized/thin/gradient treatment.

**Deliverable before any code**: a palette/typography reference artifact (see §7) so this table is approved visually, not just as hex codes in a doc.

## 5. Integration logos

- Add the `simple-icons` npm package to `artifacts/quote-ai` (MIT-licensed SVG path data for official brand marks) — covers Google, Gmail, Meta/Facebook, WhatsApp, Microsoft/Outlook, Stripe, QuickBooks out of the box.
- **Not covered by simple-icons** (need the user to source official assets from each vendor's own brand/press-kit page, since I won't fabricate or scrape logos without checking each vendor's usage terms): Wave, Financeit, Flinks, HomeStars. Flag these as a small manual task for the user, or ship the logo strip with only the simple-icons-covered set first and add the rest once sourced.
- Only list integrations that are actually live/reachable today (Google Calendar, Gmail send, QuickBooks, Meta Lead Ads once `META_APP_ID` is set) — not the ones still gated on an unregistered developer app (Wave, Financeit, Flinks, Google LSA) until those are reachable, per `[[deferred-work-post-launch]]`.

## 6. Homepage rebuild — section by section

New `home.tsx` structure (delete the 3D parallax scene and `handleHeroMove`/`handleHeroLeave` entirely):

1. **Top utility bar** (optional, thin): language switch (EN/FR — already exists elsewhere in the app, just needs to move up), sign-in link.
2. **Nav**: logo, Features / Pricing / Integrations anchor links, "Sign in", primary "Start free" CTA. Ink background or clean white with border — pick one in the palette review, not both.
3. **Hero**: headline (one clear sentence: what QuoteAI is, for whom), one-line subhead, primary CTA, a **real screenshot** of the quote builder or job dashboard (static image or a simple browser-chrome-framed screenshot, no 3D/parallax). No gradient text.
4. **Trust strip**: factual claims only (province coverage, CASL-compliant, bilingual EN/FR) — no fabricated logos/numbers until real ones exist.
5. **Feature grid** (icon + heading + 2-line description + "Learn more" anchor), grouped to cover the whole product: **AI Quoting**, **Contracts & e-sign**, **Job & crew tracking (GPS time)**, **Invoicing & payments**, **Team & permissions**, **Integrations** (QuickBooks/Wave/Google/Meta), **Analytics & assistant**. Copy sourced from the actual phase docs, not invented.
6. **Product deep-dive section(s)**: 1–2 sections with a real screenshot + supporting copy for the highest-value features (quote builder, job dashboard) — this is where the *existing* quote-builder demo content in home.tsx gets kept and repositioned, not deleted.
7. **Testimonial**: real, or omitted (see §1).
8. **Pricing**: 3-tier cards (Free/Pro/Elite — matches `lib/db/src/schema/plans.ts`'s actual tiers and `hasFeature`/`minimumPlanFor` gating) with a feature-comparison table below, mirroring the Intuit pattern but with QuoteAI's real plan features pulled from the plans schema (no invented feature names).
9. **Integrations logo strip**: see §5.
10. **Final CTA + footer**: standard SaaS footer (product links, legal, language switch, social if any real accounts exist).

## 7. Execution order (with review checkpoints — don't skip ahead)

1. **Palette/typography approval** — build a static HTML reference artifact showing the token table from §4 as actual swatches + typographic scale + button/card/badge examples side-by-side with the *current* look, so the user approves before any component code changes. *(This is the artifact I'm publishing alongside this doc.)*
2. **Token migration** — replace `index.css`'s `:root`/`.dark` blocks with the approved tokens. This alone, with zero component changes, will already remove most of the "AI toy" feeling app-wide (dashboard included), since every shadcn component reads from these tokens.
3. **Hero mock approval** — build the new hero section alone (headline, real screenshot, CTA) as a second checkpoint, since it's the highest-visibility change and worth approving before building the other 9 sections around it.
4. **Full section-by-section rebuild** of `home.tsx` per §6, reusing existing shadcn primitives (`Button`, `Card`, `Badge` etc. — already in the codebase) restyled by the new tokens, not new bespoke components where an existing one fits.
5. **Integration logo strip** — once `simple-icons` is added and the user has sourced the non-covered vendor logos (§5).
6. **Pricing section** — pull real tier/feature data from `lib/db/src/schema/plans.ts` rather than hardcoding copy that can drift from the actual gating logic.
7. **Cross-check dark mode** (Phase 24) still reads correctly against the new tokens (it inherits automatically from the token migration in step 2, but verify visually).
8. **Mobile pass** — the plan carries the same "check narrow viewport" discipline already used in Phase 6/24 for the rest of the app.

Each step ships as its own commit, typechecked, with a browser screenshot shown to the user before moving to the next step — not one giant redesign commit.

## 8. Explicitly out of scope for this plan

- Rewriting the dashboard/app UI beyond what the token migration (step 2) naturally improves — this plan is homepage + design tokens, not a full app redesign. A follow-up pass on dashboard-specific layouts can come after, once the tokens are validated on the highest-visibility surface (the homepage).
- Inventing testimonials, customer counts, or star ratings.
- Any new marketing copy claims not traceable to a real, shipped feature in the phase docs.
