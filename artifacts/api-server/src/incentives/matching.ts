import type { IncentiveCatalogItem } from "@workspace/db";

// Keyword → categoriaIntervento mapping. Deliberately simple and
// deterministic (no AI call) — good enough to narrow a quote's free-text
// description down to the intervention categories the catalog uses, without
// adding cost/latency to quote generation. Order doesn't matter; a quote can
// match more than one category (e.g. "new windows and attic insulation").
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  heat_pump: ["heat pump", "heatpump", "geothermal", "hvac", "furnace", "air conditioning", "mini-split", "ductless"],
  insulation: ["insulation", "insulate", "attic", "basement", "spray foam", "batt insulation", "vapour barrier", "air sealing", "weatherization", "weatherproofing"],
  windows_doors: ["window", "windows", "door", "doors", "patio door", "glazing"],
  accessibility: ["accessibility", "wheelchair", "ramp", "grab bar", "stairlift", "walk-in tub", "barrier-free", "mobility"],
  energy_efficiency: ["energy efficien", "energy audit", "solar panel", "solar pv", "ev charger", "electric vehicle charger", "tankless water heater", "energy star", "net zero", "led lighting", "smart thermostat"],
  general_renovation: ["renovation", "remodel", "addition", "basement finishing", "kitchen", "bathroom", "roofing", "roof", "siding", "deck", "flooring"],
};

/**
 * Infers which `categoriaIntervento` values a quote's work matches, from its
 * free-text description and chapter/line-item titles. Returns [] (no match
 * beyond "all") when nothing recognizable is found — callers should still
 * include category:"all" incentives in that case.
 */
export function inferInterventionCategories(text: string): string[] {
  const haystack = text.toLowerCase();
  const matched: string[] = [];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(kw))) matched.push(category);
  }
  return matched;
}

export interface IncentiveMatchCriteria {
  province: string | null;
  city?: string | null;
  categories: string[];
}

/**
 * Filters an incentives catalog down to programs relevant to a quote: not
 * closed, region-eligible (federal programs have province=null and match
 * everywhere; provincial/utility programs must match the quote's province;
 * municipal programs additionally need a city match), and category-eligible
 * (catalog entries tagged "all" always match; others need a category overlap
 * with the quote's inferred categories).
 */
export function matchIncentivesForQuote(
  catalog: IncentiveCatalogItem[],
  criteria: IncentiveMatchCriteria,
): IncentiveCatalogItem[] {
  const province = criteria.province?.trim().toUpperCase() || null;
  const city = criteria.city?.trim().toLowerCase() || null;
  const categories = new Set(criteria.categories);

  return catalog.filter((item) => {
    if (item.stato === "closed") return false;

    const itemProvince = item.province?.trim().toUpperCase() || null;
    if (itemProvince && itemProvince !== province) return false;

    const itemCity = item.city?.trim().toLowerCase() || null;
    if (itemCity && itemCity !== city) return false;

    if (item.categoriaIntervento !== "all" && !categories.has(item.categoriaIntervento)) return false;

    return true;
  });
}
