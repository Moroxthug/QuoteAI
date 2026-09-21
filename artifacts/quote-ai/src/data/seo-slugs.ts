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

export function sectorLabel(slug: string, lang: "en" | "fr"): string {
  const s = SECTOR_SLUGS[slug];
  return (lang === "fr" ? s?.frLabel : s?.label) ?? slug;
}

/** /quotes/… ↔ /fr/soumissions/… counterpart of a sector or city landing URL (null when there is none). */
export function getLanguageCounterpartPath(pathname: string): string | null {
  if (pathname === "/") return "/fr";
  if (pathname === "/fr" || pathname === "/fr/") return "/";

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
