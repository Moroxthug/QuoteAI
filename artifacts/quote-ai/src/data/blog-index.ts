// Phase 68: article metadata only (title, dates, category…) — what the
// homepage, sitemap page, blog list/category pages and the sector landing
// pages need. The article bodies live in ./blog-data.ts, which only the
// article page and the prerender script import, so the ~55 kB of HTML never
// reaches the public entry bundle.
export interface BlogArticleMeta {
  slug: string;
  title: string;
  /** Shorter title for the <title> tag (≤61 chars so the " | quoteai" suffix stays within 70). Falls back to title. */
  seoTitle?: string;
  metaDescription: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
  readingTimeMin: number;
  relatedSectors: string[];
}

export const BLOG_INDEX: BlogArticleMeta[] = [
  {
    slug: "how-much-does-it-cost-to-paint-an-apartment-in-canada-2026",
    title: "How Much Does It Cost to Paint an Apartment in Canada in 2026?",
    seoTitle: "Cost to Paint an Apartment in Canada (2026)",
    metaDescription: "Updated 2026 CAD pricing to paint an apartment in Canada: cost per square foot, per room, labour vs. materials, and how Toronto and Vancouver compare to smaller markets.",
    category: "Pricing",
    publishedAt: "2026-03-04",
    readingTimeMin: 5,
    relatedSectors: ["painter", "decorative-painter"],
  },
  {
    slug: "bathroom-renovation-cost-toronto-2026",
    title: "How Much Does It Cost to Renovate a Bathroom in Toronto in 2026?",
    seoTitle: "Bathroom Renovation Cost in Toronto (2026)",
    metaDescription: "Real 2026 CAD price ranges for a bathroom renovation in Toronto: full gut renovations, mid-range refreshes, plumbing and tiling costs, and how Toronto compares to the rest of Ontario.",
    category: "Pricing",
    publishedAt: "2026-03-18",
    readingTimeMin: 6,
    relatedSectors: ["plumber", "tile-installer", "renovation-contractor"],
  },
  {
    slug: "cost-to-rewire-a-house-canada",
    title: "Cost to Rewire a House in Canada: 2026 Electrical Pricing Guide",
    seoTitle: "Cost to Rewire a House in Canada (2026)",
    metaDescription: "What it costs to rewire a house in Canada in 2026: full rewiring, panel upgrades, cost per square foot, knob-and-tube removal, and regional price differences.",
    category: "Pricing",
    publishedAt: "2026-04-02",
    readingTimeMin: 5,
    relatedSectors: ["electrician", "hvac-technician"],
  },
  {
    slug: "cost-to-reroof-a-home-canada",
    title: "Cost to Re-Roof a Home in Canada in 2026 (With Snow Load Considerations)",
    seoTitle: "Cost to Re-Roof a Home in Canada (2026)",
    metaDescription: "2026 CAD pricing to re-roof a home in Canada, including asphalt shingle and metal roofing costs, per-square pricing, and how snow load requirements affect price in colder regions.",
    category: "Pricing",
    publishedAt: "2026-04-16",
    readingTimeMin: 5,
    relatedSectors: ["roofer", "mason"],
  },
  {
    slug: "deck-installation-cost-canada-2026",
    title: "Deck Installation Cost in Canada: 2026 Price Guide by Material",
    seoTitle: "Deck Installation Cost in Canada (2026)",
    metaDescription: "2026 CAD pricing for building a deck in Canada: pressure-treated wood vs. composite decking, cost per square foot, permits, and regional price differences.",
    category: "Pricing",
    publishedAt: "2026-05-05",
    readingTimeMin: 4,
    relatedSectors: ["carpenter-cabinetmaker", "welder-fabricator"],
  },
  {
    slug: "basement-finishing-cost-canada",
    title: "Basement Finishing Cost in Canada: 2026 Pricing and What to Expect",
    seoTitle: "Basement Finishing Cost in Canada (2026)",
    metaDescription: "What it costs to finish a basement in Canada in 2026: framing, insulation, electrical, drywall, flooring, and why waterproofing should be budgeted first.",
    category: "Pricing",
    publishedAt: "2026-05-20",
    readingTimeMin: 5,
    relatedSectors: ["renovation-contractor", "general-contractor"],
  },
  {
    slug: "how-to-write-a-professional-quote-that-wins-jobs",
    title: "How to Write a Professional Quote That Actually Wins Jobs",
    seoTitle: "How to Write a Quote That Wins Jobs",
    metaDescription: "A practical guide for Canadian contractors on writing quotes that convert: what to include, how to structure pricing, and why speed matters more than most tradespeople think.",
    category: "Advice",
    publishedAt: "2026-03-10",
    readingTimeMin: 5,
    relatedSectors: ["freelance", "how-to-quote"],
  },
  {
    slug: "common-quoting-mistakes-contractors-make",
    title: "7 Quoting Mistakes That Are Costing Canadian Contractors Jobs",
    seoTitle: "7 Quoting Mistakes Costing You Jobs",
    metaDescription: "The most common quoting mistakes Canadian tradespeople make — from vague pricing to slow turnaround — and how to fix each one to win more work.",
    category: "Advice",
    publishedAt: "2026-04-08",
    readingTimeMin: 4,
    relatedSectors: ["how-to-quote", "freelance"],
  },
  {
    slug: "how-to-price-a-job-labour-materials-markup",
    title: "How to Price a Job: Labour, Materials, and Markup Explained",
    seoTitle: "How to Price a Job as a Contractor",
    metaDescription: "A practical breakdown of how Canadian tradespeople should price jobs — labour rates, material markup, overhead, and profit — so quotes are profitable, not just competitive.",
    category: "Advice",
    publishedAt: "2026-05-12",
    readingTimeMin: 6,
    relatedSectors: ["freelance", "general-contractor"],
  },
  {
    slug: "mobile-quoting-on-the-go-for-contractors",
    title: "Mobile Quoting: How to Send Professional Quotes From the Job Site",
    seoTitle: "Mobile Quoting for Contractors",
    metaDescription: "Why sending a quote from your phone before you leave the job site wins more work, and what to look for in mobile quoting tools built for Canadian tradespeople.",
    category: "Tools",
    publishedAt: "2026-06-02",
    readingTimeMin: 4,
    relatedSectors: ["free-quote", "how-to-quote"],
  },
  {
    slug: "winterizing-your-home-contractor-checklist",
    title: "Winterization Work: A Contractor's Checklist for Canadian Homes",
    seoTitle: "Winterization Checklist for Contractors",
    metaDescription: "A practical winterization checklist for Canadian contractors and homeowners: insulation, weatherstripping, pipe protection, and the jobs that prevent costly winter damage.",
    category: "Trades",
    publishedAt: "2026-09-02",
    readingTimeMin: 5,
    relatedSectors: ["general-contractor", "hvac-technician"],
  },
  {
    slug: "snow-load-roofing-eavestrough-considerations-canada",
    title: "Snow Load Roofing and Eavestrough Considerations for Canadian Homes",
    seoTitle: "Snow Load Roofing Considerations in Canada",
    metaDescription: "What Canadian roofers and homeowners need to know about snow load ratings, ice damming, and eavestrough design for roofs built to handle a real Canadian winter.",
    category: "Trades",
    publishedAt: "2026-09-08",
    readingTimeMin: 5,
    relatedSectors: ["roofer", "mason"],
  },
  {
    slug: "basement-waterproofing-guide-canadian-homes",
    title: "Basement Waterproofing: A Complete Guide for Canadian Homes",
    seoTitle: "Basement Waterproofing Guide for Canada",
    metaDescription: "Interior vs. exterior basement waterproofing methods, costs, and warning signs for Canadian homes — and why it matters before finishing a basement.",
    category: "Trades",
    publishedAt: "2026-06-20",
    readingTimeMin: 6,
    relatedSectors: ["plumber", "renovation-contractor"],
  },
  {
    slug: "canada-greener-homes-grant-rebates-contractors-guide-2026",
    title: "Canadian Energy-Efficiency Rebates for Contractors: A 2026 Guide",
    seoTitle: "Canadian Energy Rebates for Contractors (2026)",
    metaDescription: "An overview of Canadian federal and provincial rebate programs for energy-efficient renovations — Greener Homes, Hydro-Québec Rénoclimat, BC Hydro, FortisBC, and Enbridge programs — for contractors to reference when quoting jobs.",
    category: "Business",
    publishedAt: "2026-07-14",
    readingTimeMin: 6,
    relatedSectors: ["hvac-technician", "general-contractor", "renovation-contractor"],
  },
  {
    slug: "google-business-profile-guide-for-tradespeople",
    title: "Google Business Profile for Tradespeople: A Complete Setup Guide",
    seoTitle: "Google Business Profile Guide for Tradespeople",
    metaDescription: "How Canadian tradespeople can set up and optimize a Google Business Profile to show up in local search results and win more calls from nearby customers.",
    category: "Business",
    publishedAt: "2026-08-05",
    readingTimeMin: 5,
    relatedSectors: ["freelance", "general-contractor"],
  },
  {
    slug: "how-to-get-more-reviews-as-a-contractor",
    title: "How to Get More Reviews as a Contractor (Without Being Pushy)",
    seoTitle: "How to Get More Contractor Reviews",
    metaDescription: "Practical, non-awkward ways for Canadian tradespeople to get more Google reviews from happy clients — and why review volume directly affects how much work you win.",
    category: "Business",
    publishedAt: "2026-08-22",
    readingTimeMin: 4,
    relatedSectors: ["freelance"],
  },
];

export interface GuideCard {
  slug: string;
  title: string;
  description: string;
  href: string;
  icon: string;
}

export const GUIDE_CARDS: GuideCard[] = [
  {
    slug: "how-to-quote",
    title: "How to Write a Professional Quote",
    description: "A step-by-step guide: structure, line items, tax, and how to send a quote that clients actually sign. Everything you need to build a quote that converts.",
    href: "/quotes/how-to-quote",
    icon: "📋",
  },
  {
    slug: "free-quote",
    title: "Free Quoting: Get Started Risk-Free",
    description: "Free and low-cost ways to start generating professional quotes. See how to get going without investing anything upfront.",
    href: "/quotes/free-quote",
    icon: "🎁",
  },
  {
    slug: "excel-template",
    title: "A Better Alternative to Excel Templates",
    description: "Why the classic Excel quote template no longer cuts it — a direct comparison with modern AI-powered software for tradespeople.",
    href: "/quotes/excel-template",
    icon: "📊",
  },
  {
    slug: "word-template",
    title: "A Better Alternative to Word Templates",
    description: "From a Word document to an automatic, professional PDF — how to make the switch without the hassle.",
    href: "/quotes/word-template",
    icon: "📄",
  },
];

export const BLOG_LIST_TITLE = "quoteai Blog — Guides and Advice for Canadian Tradespeople";
export const BLOG_LIST_DESCRIPTION = "Practical guides, real Canadian market pricing, and professional advice for tradespeople and small businesses: how to write quotes, win more jobs, and grow.";

export interface BlogCategory {
  slug: string;
  name: string;
  description: string;
  color: string;
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    slug: "trades",
    name: "Trades",
    description: "Practical guides for painters, electricians, plumbers, roofers, and other trades — including Canada-specific work like winterization and snow load roofing.",
    color: "bg-navy-50 text-navy-700 border-navy-200 hover:border-navy-400",
  },
  {
    slug: "pricing",
    name: "Pricing",
    description: "Up-to-date Canadian pricing for the most common jobs: cost per square foot, per room, and per project, with regional differences called out.",
    color: "bg-teal-50 text-teal-700 border-teal-200 hover:border-teal-400",
  },
  {
    slug: "advice",
    name: "Advice",
    description: "Practical advice for winning more jobs, improving your quotes, and pricing work profitably as a contractor.",
    color: "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400",
  },
  {
    slug: "tools",
    name: "Tools",
    description: "Reviews and comparisons of the best digital tools for tradespeople — software, apps, and AI-powered solutions.",
    color: "bg-green-50 text-green-700 border-green-200 hover:border-green-400",
  },
  {
    slug: "innovation",
    name: "Innovation",
    description: "How AI and new technology are changing the way tradespeople quote, manage, and grow their businesses.",
    color: "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400",
  },
  {
    slug: "business",
    name: "Business",
    description: "Business management, local marketing, and growth strategies for Canadian tradespeople and small businesses.",
    color: "bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-400",
  },
];

export function getCategoryBySlug(slug: string): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((c) => c.slug === slug);
}

export function getArticlesByCategory(categoryName: string): BlogArticleMeta[] {
  return BLOG_INDEX.filter((a) => a.category.toLowerCase() === categoryName.toLowerCase());
}

export const SECTOR_ARTICLES: Record<string, string[]> = {
  painter: ["how-much-does-it-cost-to-paint-an-apartment-in-canada-2026", "how-to-write-a-professional-quote-that-wins-jobs", "common-quoting-mistakes-contractors-make", "mobile-quoting-on-the-go-for-contractors", "google-business-profile-guide-for-tradespeople"],
  "decorative-painter": ["how-much-does-it-cost-to-paint-an-apartment-in-canada-2026", "how-to-write-a-professional-quote-that-wins-jobs", "common-quoting-mistakes-contractors-make", "how-to-get-more-reviews-as-a-contractor"],
  electrician: ["cost-to-rewire-a-house-canada", "how-to-price-a-job-labour-materials-markup", "common-quoting-mistakes-contractors-make", "mobile-quoting-on-the-go-for-contractors", "google-business-profile-guide-for-tradespeople"],
  plumber: ["bathroom-renovation-cost-toronto-2026", "basement-waterproofing-guide-canadian-homes", "how-to-price-a-job-labour-materials-markup", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-get-more-reviews-as-a-contractor"],
  "hvac-technician": ["cost-to-rewire-a-house-canada", "winterizing-your-home-contractor-checklist", "canada-greener-homes-grant-rebates-contractors-guide-2026", "how-to-price-a-job-labour-materials-markup"],
  mason: ["cost-to-reroof-a-home-canada", "snow-load-roofing-eavestrough-considerations-canada", "basement-finishing-cost-canada", "how-to-price-a-job-labour-materials-markup"],
  "general-contractor": ["basement-finishing-cost-canada", "winterizing-your-home-contractor-checklist", "canada-greener-homes-grant-rebates-contractors-guide-2026", "google-business-profile-guide-for-tradespeople", "how-to-price-a-job-labour-materials-markup"],
  "renovation-contractor": ["bathroom-renovation-cost-toronto-2026", "basement-finishing-cost-canada", "basement-waterproofing-guide-canadian-homes", "canada-greener-homes-grant-rebates-contractors-guide-2026"],
  "carpenter-cabinetmaker": ["deck-installation-cost-canada-2026", "how-to-price-a-job-labour-materials-markup", "how-to-write-a-professional-quote-that-wins-jobs"],
  "welder-fabricator": ["deck-installation-cost-canada-2026", "how-to-price-a-job-labour-materials-markup", "common-quoting-mistakes-contractors-make"],
  "tile-installer": ["bathroom-renovation-cost-toronto-2026", "basement-finishing-cost-canada", "common-quoting-mistakes-contractors-make"],
  landscaper: ["deck-installation-cost-canada-2026", "google-business-profile-guide-for-tradespeople", "how-to-get-more-reviews-as-a-contractor"],
  freelance: ["how-to-write-a-professional-quote-that-wins-jobs", "common-quoting-mistakes-contractors-make", "how-to-price-a-job-labour-materials-markup", "mobile-quoting-on-the-go-for-contractors", "google-business-profile-guide-for-tradespeople", "how-to-get-more-reviews-as-a-contractor"],
  "building-consultant": ["basement-finishing-cost-canada", "canada-greener-homes-grant-rebates-contractors-guide-2026", "how-to-price-a-job-labour-materials-markup"],
  "window-door-installer": ["cost-to-reroof-a-home-canada", "how-to-price-a-job-labour-materials-markup", "canada-greener-homes-grant-rebates-contractors-guide-2026"],
  roofer: ["cost-to-reroof-a-home-canada", "snow-load-roofing-eavestrough-considerations-canada", "winterizing-your-home-contractor-checklist"],
  "air-conditioning-installer": ["canada-greener-homes-grant-rebates-contractors-guide-2026", "how-to-price-a-job-labour-materials-markup"],
  "flooring-installer": ["bathroom-renovation-cost-toronto-2026", "basement-finishing-cost-canada", "common-quoting-mistakes-contractors-make"],
  "excel-template": ["mobile-quoting-on-the-go-for-contractors", "common-quoting-mistakes-contractors-make", "how-to-write-a-professional-quote-that-wins-jobs"],
  "word-template": ["mobile-quoting-on-the-go-for-contractors", "common-quoting-mistakes-contractors-make", "how-to-write-a-professional-quote-that-wins-jobs"],
  "how-to-quote": ["how-to-write-a-professional-quote-that-wins-jobs", "common-quoting-mistakes-contractors-make", "mobile-quoting-on-the-go-for-contractors"],
  "free-quote": ["mobile-quoting-on-the-go-for-contractors", "how-to-write-a-professional-quote-that-wins-jobs"],
};
