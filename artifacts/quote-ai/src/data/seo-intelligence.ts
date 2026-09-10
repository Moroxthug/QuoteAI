import { CITIES } from "./seo-data.js";
import type { CityData } from "./seo-data.js";

export interface CityIntelligence {
  priceIndex: number;
  demandLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  topServices: [string, string, string];
  localInsight: string;
  avgLeadTime: string;
}

// NOTE: with only 15 curated launch cities (see CITIES in seo-data.ts) every
// one of them gets hand-authored intelligence below — there's no generic
// cluster-based fallback generator like the original Italian build had for
// its 100+ inactive cities. If the city list grows significantly, reintroduce
// a fallback generator here (province-clustered, same idea as before) rather
// than requiring a hand-written entry for every new city.

export const DEMAND_TEXT: Record<CityIntelligence["demandLevel"], string> = {
  LOW: "moderate",
  MEDIUM: "average",
  HIGH: "high",
  CRITICAL: "very high",
};

// ─── Hand-authored intelligence for the 15 launch cities ──────────────────
// Matches the bespoke CITY_CONTEXT copy in seo-data.ts. priceIndex is
// relative to the Canadian national average (1.0 = average); topServices are
// the 3 most commonly quoted service types for that market; avgLeadTime is a
// typical quote-to-response window used in FAQ copy.
export const CITY_INTELLIGENCE: Record<string, CityIntelligence> = {
  toronto: {
    priceIndex: 1.22,
    demandLevel: "CRITICAL",
    topServices: ["Kitchen and bathroom renovation", "Basement and laneway suite conversion", "Electrical panel upgrades"],
    avgLeadTime: "1–2 days",
    localInsight:
      "Toronto is Canada's most competitive and highest-priced market for trades and renovation work. High demand for condo renovations and basement/laneway suite conversions keeps skilled contractors booked out for weeks, and older pre-1970s housing stock drives steady electrical and plumbing upgrade work. Responding with a professional quote within hours, not days, is often the only way to land the job before a competitor does.",
  },
  ottawa: {
    priceIndex: 1.05,
    demandLevel: "HIGH",
    topServices: ["Furnace and heating replacement", "Roofing and eavestrough work", "Kitchen and bathroom renovation"],
    avgLeadTime: "2–4 days",
    localInsight:
      "Ottawa's steady public-sector and tech employment base supports consistent renovation demand in established neighbourhoods, while new-build suburbs like Barrhaven and Kanata drive framing and finishing work. Long, cold winters push heavy seasonal demand for furnace and insulation work every fall. A bilingual quote is a genuine edge given the large Francophone customer base nearby.",
  },
  mississauga: {
    priceIndex: 1.15,
    demandLevel: "HIGH",
    topServices: ["Kitchen and bathroom renovation", "Basement finishing", "Driveway and exterior work"],
    avgLeadTime: "2–3 days",
    localInsight:
      "Mississauga's mix of aging 1960s-70s suburban housing and newer high-rise condos keeps demand high for kitchen, bathroom, and basement renovation work. Proximity to Pearson Airport also supports steady commercial and warehouse fit-out demand. Competition among contractors is fierce, and fast, professional quotes stand out.",
  },
  hamilton: {
    priceIndex: 0.95,
    demandLevel: "HIGH",
    topServices: ["Full kitchen and bathroom gut renovation", "Electrical rewiring", "Foundation and structural work"],
    avgLeadTime: "2–4 days",
    localInsight:
      "Hamilton has seen a wave of buyers priced out of Toronto move in for more affordable century homes, driving strong demand for full renovations of older housing stock. Knob-and-tube rewiring, foundation repair, and full kitchen/bathroom gut jobs are common. Prices remain below the Toronto core, and a clearly itemized quote is a real differentiator.",
  },
  vancouver: {
    priceIndex: 1.28,
    demandLevel: "CRITICAL",
    topServices: ["Roofing and exterior envelope repair", "Laneway house construction", "Heritage character-home renovation"],
    avgLeadTime: "1–3 days",
    localInsight:
      "Vancouver is one of the highest-cost renovation markets in the country, driven by strict permitting, heritage character-home rules, and constant coastal-rain exposure that keeps roofing and exterior envelope work in steady demand. Laneway house construction and secondary-suite conversions remain a major, reliable source of work. Buyers expect a polished, professional quote given the price point.",
  },
  surrey: {
    priceIndex: 1.08,
    demandLevel: "HIGH",
    topServices: ["New-home framing and finishing", "Basement suite conversion", "Mechanical rough-ins"],
    avgLeadTime: "2–4 days",
    localInsight:
      "Surrey is one of the fastest-growing municipalities in BC, with large-scale new-home construction driving strong demand for framing, drywall, and mechanical trades, alongside a steady stream of basement-suite conversions in older housing. Prices run somewhat below Vancouver proper, and competition among contractors is intense — speed of response matters.",
  },
  victoria: {
    priceIndex: 1.1,
    demandLevel: "MEDIUM",
    topServices: ["Heritage and character-home renovation", "Roofing and exterior repair", "Accessibility upgrades"],
    avgLeadTime: "3–5 days",
    localInsight:
      "Victoria's older, character-home housing stock and mild coastal climate keep roofing and exterior work going nearly year-round. A large share of retirees and seasonal residents invest in renovations and accessibility upgrades. Heritage-district rules apply downtown and in James Bay, affecting material choice and timelines.",
  },
  calgary: {
    priceIndex: 1.02,
    demandLevel: "HIGH",
    topServices: ["Basement development", "Post-hail roof and siding repair", "Kitchen and bathroom updates"],
    avgLeadTime: "2–4 days",
    localInsight:
      "Calgary's younger housing stock supports strong demand for basement development and kitchen/bathroom updates, while recurring hailstorms drive a steady, insurance-backed stream of roofing and siding repair work. Demand swings somewhat with the energy-sector business cycle, but fast, professional quotes remain a key differentiator.",
  },
  edmonton: {
    priceIndex: 0.92,
    demandLevel: "MEDIUM",
    topServices: ["Furnace replacement", "Insulation upgrades", "Roof and eavestrough work"],
    avgLeadTime: "3–5 days",
    localInsight:
      "Edmonton's mix of mature neighbourhoods needing mechanical and electrical upgrades and fast-growing suburbs in the south and west keeps renovation demand steady. Harsh winters push heavy seasonal demand for furnace replacement and insulation work before freeze-up. Prices are generally more accessible than Calgary or the coasts.",
  },
  winnipeg: {
    priceIndex: 0.8,
    demandLevel: "MEDIUM",
    topServices: ["Furnace and window replacement", "Mechanical and structural updates", "Insulation upgrades"],
    avgLeadTime: "4–6 days",
    localInsight:
      "Winnipeg has one of the most affordable housing markets among major Canadian cities, with a large stock of older character homes needing full mechanical and structural updates. Extreme winter cold drives strong demand for furnace, insulation, and window-replacement work, and a less saturated contractor market rewards clear, professional quoting.",
  },
  montreal: {
    priceIndex: 1.0,
    demandLevel: "HIGH",
    topServices: ["Kitchen and bathroom remodel", "Mechanical (electrical/plumbing) upgrades", "Energy-efficiency retrofits"],
    avgLeadTime: "2–4 days",
    localInsight:
      "Montreal's building stock is dominated by older triplexes and duplexes with exterior staircases, especially in the Plateau and Rosemont, meaning quotes often need to account for older wiring, plaster walls, and party-wall considerations. Demand is strong for kitchen/bathroom remodels and energy-efficiency retrofits, and French is the primary language of business for most residential clients.",
  },
  "quebec-city": {
    priceIndex: 0.88,
    demandLevel: "MEDIUM",
    topServices: ["Roofing and exterior envelope work", "Heritage-compliant renovation", "Insulation upgrades"],
    avgLeadTime: "3–6 days",
    localInsight:
      "Quebec City combines a UNESCO-listed historic core with strict heritage rules around Vieux-Québec and a much larger stock of standard 20th-century housing in the surrounding boroughs. Cold winters and heavy snow loads make roofing and exterior envelope work a major seasonal driver, and French is the default language for nearly all client communication.",
  },
  gatineau: {
    priceIndex: 0.94,
    demandLevel: "MEDIUM",
    topServices: ["Kitchen and bathroom renovation", "New-suburb framing and finishing", "Roofing and insulation work"],
    avgLeadTime: "3–5 days",
    localInsight:
      "Gatineau sits just across the river from Ottawa and shares much of that region's public-sector-driven demand, while remaining a distinctly French-primary market. Newer suburban development in Aylmer and Hull contrasts with older housing closer to the river, and bilingual quoting is a practical advantage.",
  },
  laval: {
    priceIndex: 0.98,
    demandLevel: "MEDIUM",
    topServices: ["Mechanical and roofing updates", "New-subdivision finishing work", "Kitchen and bathroom renovation"],
    avgLeadTime: "3–5 days",
    localInsight:
      "Laval, just north of Montreal, combines 1970s-80s suburban housing now due for major mechanical and roofing updates with newer subdivisions still under active construction. French-primary demand is strong for renovation and finishing trades, with steady overflow work from the tighter, more expensive Montreal core.",
  },
  halifax: {
    priceIndex: 0.9,
    demandLevel: "MEDIUM",
    topServices: ["Roofing and moisture-control repair", "Exterior painting and siding", "Structural upgrades"],
    avgLeadTime: "4–6 days",
    localInsight:
      "Halifax's older wood-frame homes in the peninsula core need structural, roofing, and moisture-control attention given the damp Atlantic climate, alongside newer suburban growth in Bedford and Dartmouth. Salt-air exposure accelerates wear on exterior finishes and metal fixtures, keeping steady demand for painting, siding, and roofing work.",
  },
};

// Sanity check kept from the original build: every active city should have a
// hand-authored entry above. If CITIES grows, this throws in dev rather than
// silently falling back to nothing.
for (const city of CITIES as CityData[]) {
  if (!CITY_INTELLIGENCE[city.slug] && typeof console !== "undefined") {
    console.warn(`[seo-intelligence] Missing CITY_INTELLIGENCE entry for city "${city.slug}" — add one to seo-intelligence.ts.`);
  }
}
