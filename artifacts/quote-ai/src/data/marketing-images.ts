// Phase 81 — the marketing site's image slots.
//
// Until now the 14 image slots on the public pages pointed at
// `https://picsum.photos/seed/…`: a third-party host serving a *random*
// photograph at request time. That is wrong for a site about to take pilot
// customers — the picture changed between two visits, it leaked every
// visitor's IP to another domain, and nothing in it had anything to do with
// contracting.
//
// This file is the single registry of those slots. Each one says what the
// photograph should show (in both languages, so the alt text is real when a
// photograph lands) and what to draw *until* one does. `src` is the only
// field the owner edits: drop a file in `public/marketing/` and name it here.
// Nothing else changes — <MarketingImage> swaps the fallback for the
// photograph, the aspect ratio is fixed per shape, so the layout is identical
// either way.
//
// See docs/PILOT-LAUNCH-PLAN.md owner track O12 for the shopping list.

type MarketingShape =
  /** 10 / 7 panel beside a body of copy (homepage stories). */
  | "split"
  /** 16 / 10 card thumbnail (newsroom, guides, blog grids). */
  | "card"
  /** Full-bleed band behind a dark CTA, always decorative (84 % navy scrim over it). */
  | "band";

/** What <MarketingImage> draws while `src` is null. Never a stand-in photograph. */
type MarketingFallback =
  /** A small quote document, the same vocabulary as the homepage hero's .doc-mock. */
  | "quote"
  /** A job site's task list with its budget line. */
  | "job"
  /** An invoice with its payment state. */
  | "invoice"
  /** A phone showing the WhatsApp quote thread. */
  | "phone"
  /** A flat brand-tinted cover for a card thumbnail (tint derived from the seed). */
  | "cover"
  /** Nothing but the band's own dark mesh — these slots are decorative. */
  | "mesh";

export interface MarketingSlot {
  /**
   * Path of the owner's photograph under `public/` (e.g. "/marketing/crew-on-site.jpg"),
   * or null while there is none. This is the only field that changes when
   * real photography arrives.
   */
  src: string | null;
  shape: MarketingShape;
  fallback: MarketingFallback;
  /**
   * What the photograph must show, and the alt text it gets. Omitted for
   * decorative slots (`shape: "band"`), which render `alt=""` either way.
   */
  alt?: { en: string; fr: string };
}

export const MARKETING_SLOTS = {
  // ── Homepage stories (10 / 7, beside copy) ──────────────────────────────
  "home-quotes": {
    src: null,
    shape: "split",
    fallback: "quote",
    alt: {
      en: "A contractor reviewing a quote on site",
      fr: "Un entrepreneur consultant une soumission sur le chantier",
    },
  },
  "home-jobs": {
    src: null,
    shape: "split",
    fallback: "job",
    alt: {
      en: "A crew working on a job site",
      fr: "Une équipe qui travaille sur un chantier",
    },
  },
  "home-invoicing": {
    src: null,
    shape: "split",
    fallback: "invoice",
    alt: {
      en: "A business owner reviewing an invoice",
      fr: "Une propriétaire d'entreprise consultant une facture",
    },
  },
  "home-whatsapp": {
    src: null,
    shape: "split",
    fallback: "phone",
    alt: {
      en: "A tradesperson sending a voice note from a phone",
      fr: "Un artisan envoyant une note vocale depuis son téléphone",
    },
  },

  // ── Card thumbnails (16 / 10) ───────────────────────────────────────────
  // One slot per grid; the seed passed at the call site keeps each card in a
  // grid visually distinct without inventing a photograph for any of them.
  "news-card": { src: null, shape: "card", fallback: "cover" },
  "guide-card": { src: null, shape: "card", fallback: "cover" },
  "blog-card": { src: null, shape: "card", fallback: "cover" },

  // ── Dark CTA bands (decorative — an 84 % navy scrim sits on top) ─────────
  "cta-home": { src: null, shape: "band", fallback: "mesh" },
  "cta-whatsapp": { src: null, shape: "band", fallback: "mesh" },
  "cta-blog": { src: null, shape: "band", fallback: "mesh" },
  "cta-blog-article": { src: null, shape: "band", fallback: "mesh" },
  "cta-blog-category": { src: null, shape: "band", fallback: "mesh" },
  "cta-sector": { src: null, shape: "band", fallback: "mesh" },
  "cta-pricing": { src: null, shape: "band", fallback: "mesh" },
} as const satisfies Record<string, MarketingSlot>;

export type MarketingSlotId = keyof typeof MARKETING_SLOTS;

/** The tints a "cover" fallback picks from — the four accent families already in the design tokens. */
const COVER_TINTS = ["green", "teal", "purple", "yellow"] as const;
type CoverTint = (typeof COVER_TINTS)[number];

/** Deterministic so the build-time render and the hydrated page agree. */
export function coverTint(seed: string): CoverTint {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_TINTS[hash % COVER_TINTS.length]!;
}

/** Slots still waiting on a photograph — used by the Phase 81 test and the owner checklist. */
export function slotsAwaitingPhotography(): MarketingSlotId[] {
  return (Object.keys(MARKETING_SLOTS) as MarketingSlotId[]).filter((id) => MARKETING_SLOTS[id].src === null);
}
