// Phase 68: the light sector index. seo-data.ts is ~150 kB of landing-page
// copy; the public entry bundle (public-layout's language toggle, the
// homepage trade chips) only needs slugs and labels, so those live here and
// seo-data.ts asserts it stays in sync (build fails on drift — the prerender
// and sitemap scripts import seo-data).
export interface SectorSlugEntry {
  /** French URL slug under /fr/soumissions/. */
  frSlug: string;
  label: string;
  frLabel: string;
}

export const SECTOR_SLUGS: Record<string, SectorSlugEntry> = {
  painter: { frSlug: "peintre", label: "Painter", frLabel: "Peintre" },
  electrician: { frSlug: "electricien", label: "Electrician", frLabel: "Électricien" },
  plumber: { frSlug: "plombier", label: "Plumber", frLabel: "Plombier" },
  "general-contractor": { frSlug: "entrepreneur-general", label: "General Contractor", frLabel: "Entrepreneur général" },
  "renovation-contractor": { frSlug: "entrepreneur-renovation", label: "Renovation Contractor", frLabel: "Entrepreneur en rénovation" },
  "welder-fabricator": { frSlug: "soudeur-metallier", label: "Welder & Metal Fabricator", frLabel: "Soudeur-métallier" },
  "carpenter-cabinetmaker": { frSlug: "menuisier-ebeniste", label: "Carpenter & Cabinetmaker", frLabel: "Menuisier-ébéniste" },
  "hvac-technician": { frSlug: "technicien-cvc", label: "HVAC & Heating Technician", frLabel: "Technicien CVC" },
  freelance: { frSlug: "travailleur-autonome", label: "Freelancer", frLabel: "Travailleur autonome" },
  "building-consultant": { frSlug: "expert-batiment", label: "Building Consultant", frLabel: "Expert en bâtiment" },
  mason: { frSlug: "macon", label: "Mason & Concrete Contractor", frLabel: "Maçon" },
  landscaper: { frSlug: "paysagiste", label: "Landscaper", frLabel: "Paysagiste" },
  "tile-installer": { frSlug: "poseur-de-ceramique", label: "Tile Installer", frLabel: "Poseur de céramique" },
  "window-door-installer": { frSlug: "poseur-portes-fenetres", label: "Window & Door Installer", frLabel: "Poseur de portes et fenêtres" },
  roofer: { frSlug: "couvreur", label: "Roofer", frLabel: "Couvreur" },
  "air-conditioning-installer": { frSlug: "installateur-climatisation", label: "Air Conditioning Installer", frLabel: "Installateur de climatisation" },
  "decorative-painter": { frSlug: "peintre-decorateur", label: "Painter & Decorative Finisher", frLabel: "Peintre-décorateur" },
  "flooring-installer": { frSlug: "poseur-de-plancher", label: "Flooring Installer", frLabel: "Poseur de revêtements de sol" },
  "excel-template": { frSlug: "modele-soumission-excel", label: "Excel Quote Template", frLabel: "Modèle Excel" },
  "word-template": { frSlug: "modele-soumission-word", label: "Word Quote Template", frLabel: "Modèle Word" },
  "how-to-quote": { frSlug: "comment-faire-une-soumission", label: "Professional Quote", frLabel: "Comment faire une soumission" },
  "free-quote": { frSlug: "soumission-gratuite", label: "Free Quotes", frLabel: "Soumission gratuite" },
};

export const SECTOR_KEY_BY_FR_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SECTOR_SLUGS).map(([key, s]) => [s.frSlug, key]),
);

/**
 * Phase 81 — static public pages that have a real French URL (a prerendered
 * page of their own, in the sitemap, claimed by hreflang). Everything not
 * listed here — the blog, the help centre, /whatsapp — is
 * English-only for now: the language toggle on those just flips the chrome.
 *
 * This list lives in this module (rather than beside each page) because it is
 * the one file the public entry bundle can afford to load eagerly: the header,
 * the footer and the language toggle all read it.
 */
/** Free calculator pages: English slug under /tools/ ↔ French slug under /fr/outils/. */
export const TOOL_SLUG_PAIRS = [
  { id: "salesTax", en: "sales-tax-calculator", fr: "calculateur-taxes-de-vente" },
  { id: "holdback", en: "holdback-calculator", fr: "calculateur-retenue" },
  { id: "markup", en: "markup-margin-calculator", fr: "calculateur-majoration-marge" },
  { id: "labourRate", en: "labour-rate-calculator", fr: "calculateur-taux-horaire" },
] as const;
export type ToolId = (typeof TOOL_SLUG_PAIRS)[number]["id"];

/** /tools/<slug>/ or /fr/outils/<slug>/ for a tool (the hub when id is omitted). */
export function toolPath(lang: "en" | "fr", id?: ToolId): string {
  const base = lang === "fr" ? "/fr/outils/" : "/tools/";
  if (!id) return base;
  const pair = TOOL_SLUG_PAIRS.find((p) => p.id === id)!;
  return `${base}${pair[lang]}/`;
}

/** Comparison pages: /compare/<slug>/ ↔ /fr/comparer/<slug>/. */
export const COMPARE_SLUG_PAIRS = [
  { id: "jobber", en: "quoteai-vs-jobber", fr: "quoteai-ou-jobber" },
  { id: "joist", en: "quoteai-vs-joist", fr: "quoteai-ou-joist" },
  { id: "housecallPro", en: "quoteai-vs-housecall-pro", fr: "quoteai-ou-housecall-pro" },
] as const;
export type CompetitorId = (typeof COMPARE_SLUG_PAIRS)[number]["id"];

/** /compare/<slug>/ or /fr/comparer/<slug>/ (the hub when id is omitted). */
export function comparePath(lang: "en" | "fr", id?: CompetitorId): string {
  const base = lang === "fr" ? "/fr/comparer/" : "/compare/";
  if (!id) return base;
  const pair = COMPARE_SLUG_PAIRS.find((p) => p.id === id)!;
  return `${base}${pair[lang]}/`;
}

const LOCALE_PAGE_PAIRS: ReadonlyArray<{ en: string; fr: string }> = [
  { en: "/pricing", fr: "/fr/tarifs" },
  { en: "/pilot", fr: "/fr/pilote" },
  // Phase 95: the legal pages.
  { en: "/privacy-policy", fr: "/fr/confidentialite" },
  { en: "/terms", fr: "/fr/conditions" },
  // Free calculators: the hub and every tool page.
  { en: "/tools", fr: "/fr/outils" },
  ...TOOL_SLUG_PAIRS.map((p) => ({ en: `/tools/${p.en}`, fr: `/fr/outils/${p.fr}` })),
  { en: "/compare", fr: "/fr/comparer" },
  ...COMPARE_SLUG_PAIRS.map((p) => ({ en: `/compare/${p.en}`, fr: `/fr/comparer/${p.fr}` })),
];

/** Phase 81 — province landing pages: English slug ↔ French slug. */
export const PROVINCE_SLUG_PAIRS: ReadonlyArray<{ code: "BC" | "ON" | "QC"; en: string; fr: string }> = [
  { code: "BC", en: "british-columbia", fr: "colombie-britannique" },
  { code: "ON", en: "ontario", fr: "ontario" },
  { code: "QC", en: "quebec", fr: "quebec" },
];

export function sectorLabel(slug: string, lang: "en" | "fr"): string {
  const s = SECTOR_SLUGS[slug];
  return (lang === "fr" ? s?.frLabel : s?.label) ?? slug;
}

/**
 * Phase 81 — the version of a public path in `lang`, when one is built.
 *
 * The French homepage used to send its trade marquee, its footer trade list
 * and its guide cards to `/quotes/…` — English pages — even though every
 * sector has had a French twin at `/fr/soumissions/…` since Phase 80. Any
 * link in the public chrome or on the homepage goes through here now, so a
 * French visitor stays in French wherever a French page exists, and falls
 * back to the English one (unchanged) where none does.
 */
export function localizedPath(path: string, lang: "en" | "fr"): string {
  // "/#trades" is the homepage plus an anchor: localize the page, keep the anchor.
  const hashAt = path.indexOf("#");
  const hash = hashAt === -1 ? "" : path.slice(hashAt);
  const base = hashAt === -1 ? path : path.slice(0, hashAt) || "/";
  const baseIsFrench = base === "/fr" || base.startsWith("/fr/");
  if ((lang === "fr") === baseIsFrench) return path;
  const counterpart = getLanguageCounterpartPath(base);
  return counterpart ? `${counterpart}${hash}` : path;
}

/** /quotes/… ↔ /fr/soumissions/… counterpart of a sector or city landing URL (null when there is none). */
export function getLanguageCounterpartPath(pathname: string): string | null {
  if (pathname === "/") return "/fr";
  if (pathname === "/fr" || pathname === "/fr/") return "/";

  // Phase 81 — the static pages with a French twin.
  const bare = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  for (const pair of LOCALE_PAGE_PAIRS) {
    if (bare === pair.en) return `${pair.fr}/`;
    if (bare === pair.fr) return `${pair.en}/`;
  }
  const enProvince = /^\/provinces\/([a-z0-9-]+)$/.exec(bare);
  if (enProvince) {
    const pair = PROVINCE_SLUG_PAIRS.find((p) => p.en === enProvince[1]);
    if (pair) return `/fr/provinces/${pair.fr}/`;
  }
  const frProvince = /^\/fr\/provinces\/([a-z0-9-]+)$/.exec(bare);
  if (frProvince) {
    const pair = PROVINCE_SLUG_PAIRS.find((p) => p.fr === frProvince[1]);
    if (pair) return `/provinces/${pair.en}/`;
  }

  const enCity = pathname.match(/^\/quotes\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  if (enCity) {
    const sector = SECTOR_SLUGS[enCity[1]!];
    if (sector) return `/fr/soumissions/${sector.frSlug}/${enCity[2]}/`;
  }
  const enSector = pathname.match(/^\/quotes\/([a-z0-9-]+)\/?$/);
  if (enSector) {
    const sector = SECTOR_SLUGS[enSector[1]!];
    if (sector) return `/fr/soumissions/${sector.frSlug}/`;
  }
  const frCity = pathname.match(/^\/fr\/soumissions\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  if (frCity) {
    const key = SECTOR_KEY_BY_FR_SLUG[frCity[1]!];
    if (key) return `/quotes/${key}/${frCity[2]}/`;
  }
  const frSector = pathname.match(/^\/fr\/soumissions\/([a-z0-9-]+)\/?$/);
  if (frSector) {
    const key = SECTOR_KEY_BY_FR_SLUG[frSector[1]!];
    if (key) return `/quotes/${key}/`;
  }
  return null;
}
