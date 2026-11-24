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
  /** Homeowner-only post kept live but out of the index and the lists (SEO-RECOVERY-PLAN S3.1). */
  noindex?: boolean;
}

export const BLOG_INDEX: BlogArticleMeta[] = [
  {
    slug: "how-much-does-it-cost-to-paint-an-apartment-in-canada-2026",
    noindex: true,
    title: "How Much Does It Cost to Paint an Apartment in Canada in 2026?",
    seoTitle: "Cost to Paint an Apartment in Canada (2026)",
    metaDescription: "2026 CAD pricing to paint an apartment in Canada: cost per square foot, per room, labour vs. materials, and how Toronto and Vancouver compare to smaller markets.",
    category: "Pricing",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["painter", "decorative-painter"],
  },
  {
    slug: "bathroom-renovation-cost-toronto-2026",
    noindex: true,
    title: "How Much Does It Cost to Renovate a Bathroom in Toronto in 2026?",
    seoTitle: "Bathroom Renovation Cost in Toronto (2026)",
    metaDescription: "2026 CAD price ranges for a Toronto bathroom renovation: full gut jobs, mid-range refreshes, plumbing and tiling, and how Toronto compares to the rest of Ontario.",
    category: "Pricing",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["plumber", "tile-installer", "renovation-contractor"],
  },
  {
    slug: "deck-installation-cost-canada-2026",
    noindex: true,
    title: "Deck Installation Cost in Canada: 2026 Price Guide by Material",
    seoTitle: "Deck Installation Cost in Canada (2026)",
    metaDescription: "2026 CAD pricing for building a deck in Canada: pressure-treated wood vs. composite decking, cost per square foot, permits, and regional price differences.",
    category: "Pricing",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["carpenter-cabinetmaker", "welder-fabricator"],
  },
  {
    slug: "basement-finishing-cost-canada",
    noindex: true,
    title: "Basement Finishing Cost in Canada: 2026 Pricing and What to Expect",
    seoTitle: "Basement Finishing Cost in Canada (2026)",
    metaDescription: "What it costs to finish a basement in Canada in 2026: framing, insulation, electrical, drywall, flooring, and why waterproofing should be budgeted first.",
    category: "Pricing",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["renovation-contractor", "general-contractor"],
  },
  {
    slug: "how-to-write-a-professional-quote-that-wins-jobs",
    title: "How to Write a Professional Quote That Wins Jobs",
    seoTitle: "How to Write a Contractor Quote That Wins Jobs",
    metaDescription: "What a Canadian contractor quote needs: GST/HST and licence numbers, scope and exclusions, taxes, deposit, cooling-off rules, plus a sample Ontario quote.",
    category: "Advice",
    publishedAt: "2026-09-21",
    updatedAt: "2026-11-24",
    readingTimeMin: 7,
    relatedSectors: ["freelance", "how-to-quote"],
  },
  {
    slug: "how-to-price-a-job-labour-materials-markup",
    title: "How to Price a Job: Labour, Materials, and Markup Explained",
    seoTitle: "How to Price a Job as a Contractor",
    metaDescription: "How Canadian tradespeople should price jobs — labour rates, material markup, overhead and profit — so quotes are profitable, not just competitive.",
    category: "Advice",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["freelance", "general-contractor"],
  },
  {
    slug: "winterizing-your-home-contractor-checklist",
    noindex: true,
    title: "Winterization Work: A Contractor's Checklist for Canadian Homes",
    seoTitle: "Winterization Checklist for Contractors",
    metaDescription: "A winterization checklist for Canadian contractors and homeowners: insulation, weatherstripping, pipe protection, and the jobs that prevent costly winter damage.",
    category: "Trades",
    publishedAt: "2026-09-21",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "hvac-technician"],
  },
  {
    slug: "basement-waterproofing-guide-canadian-homes",
    noindex: true,
    title: "Basement Waterproofing: A Complete Guide for Canadian Homes",
    seoTitle: "Basement Waterproofing Guide for Canada",
    metaDescription: "Interior vs. exterior basement waterproofing methods, costs, and warning signs for Canadian homes — and why it matters before finishing a basement.",
    category: "Trades",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["plumber", "renovation-contractor"],
  },
  {
    slug: "canada-greener-homes-grant-rebates-contractors-guide-2026",
    title: "Home Energy Rebates in Canada: A Contractor's Guide to Current Programs",
    seoTitle: "Home Energy Rebates in Canada: Contractor's Guide",
    metaDescription: "Which home energy rebates are open in Ontario, BC and Quebec (checked November 2026), what closed federally, and what contractors must put on the invoice.",
    category: "Business",
    publishedAt: "2026-09-21",
    updatedAt: "2026-11-24",
    readingTimeMin: 6,
    relatedSectors: ["hvac-technician", "general-contractor", "renovation-contractor"],
  },
  {
    slug: "google-business-profile-guide-for-tradespeople",
    title: "Google Business Profile for Tradespeople: A Complete Setup Guide",
    seoTitle: "Google Business Profile Guide for Tradespeople",
    metaDescription: "How Canadian tradespeople can set up and optimize a Google Business Profile to show up in local search results and win more calls from nearby customers.",
    category: "Business",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["freelance", "general-contractor"],
  },
  {
    slug: "how-to-get-more-reviews-as-a-contractor",
    title: "How to Get More Reviews as a Contractor (Without Being Pushy)",
    seoTitle: "How to Get More Contractor Reviews",
    metaDescription: "Practical, non-awkward ways for Canadian tradespeople to get more Google reviews from happy clients — and why review volume directly affects how much work you win.",
    category: "Business",
    publishedAt: "2026-09-21",
    readingTimeMin: 2,
    relatedSectors: ["freelance"],
  },
  {
    slug: "free-quote-template-for-contractors-canada",
    title: "Free Quote Template for Contractors in Canada (GST/HST/QST Included)",
    seoTitle: "Free Contractor Quote Template for Canada",
    metaDescription: "What a Canadian contractor quote must include: scope, line items, GST/HST/QST, deposit, validity and signature. Copy the structure, then see how to automate it.",
    category: "Tools",
    publishedAt: "2026-10-31",
    readingTimeMin: 3,
    relatedSectors: ["general-contractor", "renovation-contractor", "freelance"],
  },
  {
    slug: "how-to-get-more-plumbing-jobs-canada",
    title: "How to Get More Plumbing Jobs in Canada: 9 Ways That Actually Work",
    seoTitle: "How to Get More Plumbing Jobs in Canada",
    metaDescription: "Practical ways for Canadian plumbers to get more jobs: Google Business Profile, fast quotes, reviews, service pages, referrals and repeat work.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 2,
    relatedSectors: ["plumber"],
  },
  {
    slug: "how-to-get-more-electrical-jobs-canada",
    title: "How Electricians Can Get More Jobs in Canada (Without Paying for Leads)",
    seoTitle: "How Electricians Get More Jobs in Canada",
    metaDescription: "A practical marketing and quoting playbook for Canadian electricians: local search, reviews, quick estimates, panel upgrade offers and referral partners.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["electrician"],
  },
  {
    slug: "how-to-collect-payment-from-clients-contractor-canada",
    title: "How to Get Paid on Time as a Contractor in Canada (Deposits, Invoices, Late Payment)",
    seoTitle: "How Contractors Get Paid on Time in Canada",
    metaDescription: "Deposits, progress billing, clear invoices and friendly follow-ups: how Canadian contractors stop chasing money and get paid faster.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 2,
    relatedSectors: ["general-contractor", "renovation-contractor", "painter"],
  },
  {
    slug: "contractor-insurance-canada-what-you-need",
    title: "Contractor Insurance in Canada: What Coverage You Actually Need",
    seoTitle: "Contractor Insurance in Canada: What You Need",
    metaDescription: "General liability, tools and equipment, commercial vehicle, workers' compensation and more: a plain-language guide to insurance for Canadian contractors.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 2,
    relatedSectors: ["general-contractor", "electrician", "plumber"],
  },
  {
    slug: "kitchen-renovation-cost-canada-2026",
    noindex: true,
    title: "Kitchen Renovation Cost in Canada in 2026: Budget, Mid-Range and High-End",
    seoTitle: "Kitchen Renovation Cost in Canada (2026)",
    metaDescription: "2026 CAD price ranges for a kitchen renovation in Canada: cabinets, countertops, labour, plumbing and electrical, plus where budgets blow up.",
    category: "Pricing",
    publishedAt: "2026-10-31",
    readingTimeMin: 2,
    relatedSectors: ["renovation-contractor", "carpenter-cabinetmaker", "general-contractor"],
  },
  {
    slug: "fence-installation-cost-canada-2026",
    noindex: true,
    title: "Cost to Install a Fence in Canada in 2026 (Wood, Vinyl, Chain Link, Aluminum)",
    seoTitle: "Fence Installation Cost in Canada (2026)",
    metaDescription: "2026 CAD cost per linear foot to install a fence in Canada by material, plus gates, frost depth, permits and how to quote fence jobs.",
    category: "Pricing",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["landscaper", "carpenter-cabinetmaker", "mason"],
  },
  {
    slug: "flooring-installation-cost-canada-2026",
    noindex: true,
    title: "Flooring Installation Cost in Canada in 2026: Hardwood, Vinyl Plank, Laminate and Tile",
    seoTitle: "Flooring Installation Cost in Canada (2026)",
    metaDescription: "2026 CAD cost per square foot for hardwood, engineered, vinyl plank, laminate and tile flooring installed in Canada, plus prep and removal costs.",
    category: "Pricing",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["flooring-installer", "tile-installer", "renovation-contractor"],
  },
  {
    slug: "how-to-write-a-contractor-contract-canada",
    title: "How to Write a Contractor Contract in Canada: Clauses Every Job Needs",
    seoTitle: "Contractor Contract in Canada: Clauses You Need",
    metaDescription: "The clauses a Canadian contractor's contract should include: scope, price, payments, changes, delays, warranty and disputes. Not legal advice; a practical checklist.",
    category: "Advice",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "electrician"],
  },
  {
    slug: "how-to-handle-change-orders-contractors",
    title: "Change Orders for Contractors: How to Handle Extras and Get Paid for Them",
    seoTitle: "Change Orders: How Contractors Get Paid for Extras",
    metaDescription: "A simple change order process for contractors: why extras go unpaid, what to put in writing, how to price them, and a template wording.",
    category: "Advice",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "painter"],
  },
  {
    slug: "how-to-hire-and-pay-subcontractors-canada",
    title: "How to Hire and Pay Subcontractors in Canada: Contracts, Insurance and Tax Basics",
    seoTitle: "Hiring Subcontractors in Canada: A Contractor's Guide",
    metaDescription: "How Canadian contractors can hire subcontractors safely: contractor vs employee, insurance, WCB clearance, written agreements and paying on time.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "building-consultant"],
  },
  {
    slug: "how-to-scale-a-contracting-business-canada",
    title: "How to Scale a Contracting Business in Canada: From Solo to a Crew",
    seoTitle: "How to Scale a Contracting Business in Canada",
    metaDescription: "A practical roadmap for growing a trade business in Canada: pricing, systems, hiring, cash flow and when to say no, from solo operator to a profitable crew.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "electrician", "plumber"],
  },
  {
    slug: "how-to-track-job-costs-contractors",
    title: "How to Track Job Costs as a Contractor (and Find Out Which Jobs Actually Make Money)",
    seoTitle: "How to Track Job Costs as a Contractor",
    metaDescription: "Learn how to track labour, materials and overhead per job, compare estimates to actuals, and discover which work is truly profitable.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "plumber"],
  },
  {
    slug: "reduce-material-costs-contractors-canada",
    noindex: true,
    title: "10 Ways Canadian Contractors Can Reduce Material Costs Without Cutting Quality",
    seoTitle: "Reduce Material Costs as a Contractor (10 Ways)",
    metaDescription: "Practical ways to lower material costs on every job: supplier accounts, bulk buying, waste control, price-lock clauses and accurate takeoffs.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "carpenter-cabinetmaker"],
  },
  {
    slug: "construction-project-management-small-contractors",
    title: "Job Site Management for Small Contractors: A Simple System That Works",
    seoTitle: "Job Site Management for Small Contractors",
    metaDescription: "How small trade businesses can run job sites better: scheduling, daily logs, photos, communication and punch lists, without heavy construction software.",
    category: "Business",
    publishedAt: "2026-10-31",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "building-consultant"],
  },
  {
    slug: "contractor-cash-flow-management-canada",
    title: "Contractor Cash Flow: How to Stop Running Out of Money Between Jobs",
    seoTitle: "Contractor Cash Flow Management in Canada",
    metaDescription: "Profitable contractors still run out of cash. How to forecast, bill faster, handle GST/HST remittances and holdbacks, and build a buffer for slow months.",
    category: "Business",
    publishedAt: "2026-11-01",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "plumber", "electrician"],
  },
  {
    slug: "how-to-quote-a-painting-job",
    title: "How to Quote a Painting Job: Pricing Method, Line Items and Example",
    seoTitle: "How to Quote a Painting Job (With Example)",
    metaDescription: "A step-by-step method for pricing a painting job: measuring, prep, coats, labour, materials, markup and a worked example for Canadian painters.",
    category: "Advice",
    publishedAt: "2026-11-01",
    readingTimeMin: 1,
    relatedSectors: ["painter", "decorative-painter"],
  },
  {
    slug: "how-to-quote-a-roofing-job",
    title: "How to Quote a Roofing Job in Canada: Squares, Decking, Eave Protection and Fall Protection",
    seoTitle: "How to Quote a Roofing Job in Canada",
    metaDescription: "Price a reroof from squares, pitch and waste, with a per-sheet decking rate, code eave protection, permits and fall protection, plus an Ontario sample quote.",
    category: "Advice",
    publishedAt: "2026-11-01",
    updatedAt: "2026-11-24",
    readingTimeMin: 6,
    relatedSectors: ["roofer", "mason"],
  },
  {
    slug: "how-to-quote-an-electrical-job",
    title: "How to Quote an Electrical Job in Canada: Service Calls, Rewires and Panel Upgrades",
    seoTitle: "How to Quote an Electrical Job in Canada",
    metaDescription: "How Canadian electricians price service calls, rewires and 200A panel upgrades: licensing, ESA and Technical Safety BC permits, cost drivers and a sample quote.",
    category: "Advice",
    publishedAt: "2026-11-01",
    updatedAt: "2026-11-24",
    readingTimeMin: 6,
    relatedSectors: ["electrician", "hvac-technician"],
  },
  {
    slug: "how-to-quote-a-plumbing-job",
    title: "How to Quote a Plumbing Job: Flat-Rate vs Hourly Pricing for Canadian Plumbers",
    seoTitle: "How to Quote a Plumbing Job: Flat-Rate vs Hourly",
    metaDescription: "Flat-rate or hourly? How plumbers can price repairs, water heaters, renovations and emergencies, with line items, markup and a clear client quote.",
    category: "Advice",
    publishedAt: "2026-11-01",
    readingTimeMin: 1,
    relatedSectors: ["plumber"],
  },
  {
    slug: "quote-vs-estimate-vs-invoice-difference",
    title: "Quote vs Estimate vs Invoice: What's the Difference for Contractors?",
    seoTitle: "Quote vs Estimate vs Invoice for Contractors",
    metaDescription: "Quote, estimate, bid, proposal, invoice: what each means, when to use them, and how the wrong one can cost a contractor money.",
    category: "Advice",
    publishedAt: "2026-11-01",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "freelance", "renovation-contractor"],
  },
  {
    slug: "siding-replacement-cost-canada-2026",
    noindex: true,
    title: "Siding Replacement Cost in Canada in 2026 (Vinyl, Fibre Cement, Wood and Metal)",
    seoTitle: "Siding Replacement Cost in Canada (2026)",
    metaDescription: "2026 CAD cost to replace siding on a Canadian home by material, including insulation, house wrap, removal and what drives the price.",
    category: "Pricing",
    publishedAt: "2026-11-02",
    readingTimeMin: 1,
    relatedSectors: ["renovation-contractor", "carpenter-cabinetmaker", "general-contractor"],
  },
  {
    slug: "how-to-quote-a-landscaping-job",
    title: "How to Quote a Landscaping Job: Pricing Lawn, Hardscape and Seasonal Contracts",
    seoTitle: "How to Quote a Landscaping Job",
    metaDescription: "How landscapers can price one-time projects and recurring maintenance contracts: measuring, labour rates, equipment, materials and a clear quote.",
    category: "Advice",
    publishedAt: "2026-11-03",
    readingTimeMin: 1,
    relatedSectors: ["landscaper"],
  },
  {
    slug: "how-to-quote-an-hvac-job",
    title: "How to Quote an HVAC Job in Canada: Sizing, Licensing and Line Items",
    seoTitle: "How to Quote an HVAC Job in Canada",
    metaDescription: "Quote heat pump and furnace jobs that hold up: CSA F280 sizing, separate equipment and labour lines, refrigerant and gas licensing, permits and rebate notes.",
    category: "Advice",
    publishedAt: "2026-11-03",
    updatedAt: "2026-11-24",
    readingTimeMin: 7,
    relatedSectors: ["hvac-technician", "air-conditioning-installer"],
  },
  {
    slug: "how-to-quote-a-tiling-job",
    title: "How to Quote a Tiling Job: Square Footage, Prep, Waste and Labour Rates",
    seoTitle: "How to Quote a Tiling Job",
    metaDescription: "How tile installers can price floors, showers and backsplashes: prep, waterproofing, waste factors, pattern complexity and a sample quote structure.",
    category: "Advice",
    publishedAt: "2026-11-03",
    readingTimeMin: 1,
    relatedSectors: ["tile-installer", "renovation-contractor"],
  },
  {
    slug: "how-to-raise-your-prices-contractors-without-losing-clients",
    title: "How to Raise Your Prices as a Contractor Without Losing Clients",
    seoTitle: "How to Raise Prices as a Contractor",
    metaDescription: "Costs rise every year. How trade businesses can raise rates confidently: when to do it, how to tell existing and new clients, and what to say.",
    category: "Business",
    publishedAt: "2026-11-03",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "plumber", "electrician"],
  },
  {
    slug: "how-to-hire-your-first-employee-contractor-canada",
    title: "Hiring Your First Employee as a Contractor in Canada: What to Know",
    seoTitle: "Hiring Your First Employee as a Contractor",
    metaDescription: "What a Canadian contractor must set up before hiring a first employee: payroll account, deductions, workers' compensation, safety, pay rates and training.",
    category: "Business",
    publishedAt: "2026-11-03",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "renovation-contractor", "electrician", "painter"],
  },
  {
    slug: "how-to-follow-up-on-quotes-contractors",
    title: "How to Follow Up on a Quote Without Being Pushy (Templates Included)",
    seoTitle: "How to Follow Up on a Quote (With Templates)",
    metaDescription: "Most quotes are not rejected, they are ignored. When and how to follow up by text and email, with ready-to-use templates for contractors.",
    category: "Advice",
    publishedAt: "2026-11-03",
    readingTimeMin: 1,
    relatedSectors: ["general-contractor", "painter", "renovation-contractor"],
  },
  {
    slug: "how-to-quote-a-carpentry-job",
    title: "How to Quote a Carpentry or Cabinetmaking Job: Pricing Custom Work Properly",
    seoTitle: "How to Quote a Carpentry or Cabinet Job",
    metaDescription: "How carpenters and cabinetmakers can price custom work: material takeoffs, shop time, finishing, installation, deposits and design changes.",
    category: "Advice",
    publishedAt: "2026-11-03",
    readingTimeMin: 1,
    relatedSectors: ["carpenter-cabinetmaker"],
  },
  {
    slug: "how-to-quote-a-welding-or-metal-fabrication-job",
    title: "How to Quote a Welding or Metal Fabrication Job in Canada",
    seoTitle: "How to Quote a Welding or Fabrication Job",
    metaDescription: "How welders and fabricators can price jobs: material weights, labour rates, consumables, shop overhead, finishing and delivery for custom and repair work.",
    category: "Advice",
    publishedAt: "2026-11-03",
    readingTimeMin: 1,
    relatedSectors: ["welder-fabricator"],
  },
  {
    slug: "how-to-quote-a-masonry-job",
    title: "How to Quote a Masonry or Concrete Job in Canada",
    seoTitle: "How to Quote a Masonry or Concrete Job in Canada",
    metaDescription: "Quote repointing, veneer, chimney, driveway and interlock work: the right units, freeze-thaw specs, locates, permits, BC PST rules and a sample driveway quote.",
    category: "Advice",
    publishedAt: "2026-11-03",
    updatedAt: "2026-11-24",
    readingTimeMin: 7,
    relatedSectors: ["mason"],
  },
  {
    slug: "how-to-quote-a-window-or-door-installation-job",
    title: "How to Quote a Window or Door Installation Job",
    seoTitle: "How to Quote Window and Door Installation Jobs",
    metaDescription: "Measuring, retrofit vs full-frame, egress, ENERGY STAR, deposits on custom units, capping, rot and warranty, plus a Québec sample quote with GST and QST.",
    category: "Advice",
    publishedAt: "2026-11-03",
    updatedAt: "2026-11-24",
    readingTimeMin: 6,
    relatedSectors: ["window-door-installer"],
  },
];

/**
 * Posts merged into a stronger page (SEO-RECOVERY-PLAN S3.2): each 301s in
 * vercel.json (generate-sitemap.ts fails the build if one is missing) and its
 * body is gone from blog-data.ts.
 */
export const BLOG_REDIRECTS: Record<string, string> = {
  "cost-to-rewire-a-house-canada": "/blog/how-to-quote-an-electrical-job/",
  "cost-to-reroof-a-home-canada": "/blog/how-to-quote-a-roofing-job/",
  "snow-load-roofing-eavestrough-considerations-canada": "/blog/how-to-quote-a-roofing-job/",
  "cost-to-install-a-heat-pump-canada": "/blog/how-to-quote-an-hvac-job/",
  "furnace-replacement-cost-canada-2026": "/blog/how-to-quote-an-hvac-job/",
  "cost-to-install-windows-and-doors-canada": "/blog/how-to-quote-a-window-or-door-installation-job/",
  "concrete-driveway-cost-canada-2026": "/blog/how-to-quote-a-masonry-job/",
  "attic-insulation-cost-canada-2026": "/blog/canada-greener-homes-grant-rebates-contractors-guide-2026/",
  "common-quoting-mistakes-contractors-make": "/blog/how-to-write-a-professional-quote-that-wins-jobs/",
  "how-to-win-more-bids-contractors-canada": "/blog/how-to-write-a-professional-quote-that-wins-jobs/",
  "how-to-send-a-quote-in-5-minutes-contractors": "/blog/how-to-write-a-professional-quote-that-wins-jobs/",
  "mobile-quoting-on-the-go-for-contractors": "/blog/how-to-write-a-professional-quote-that-wins-jobs/",
  "how-to-price-a-job-labour-materials-markup-canada-guide": "/tools/markup-margin-calculator/",
  "best-quoting-software-for-contractors-canada": "/compare/",
  "quoteai-vs-spreadsheet-quotes-contractors": "/compare/",
  "how-to-survive-slow-season-contractors-canada": "/blog/how-to-scale-a-contracting-business-canada/"
};

/** Articles shown in lists, related links and the sitemap: everything indexable. */
export const BLOG_LISTED: BlogArticleMeta[] = BLOG_INDEX.filter((a) => !a.noindex);

export interface GuideCard {
  slug: string;
  title: string;
  description: string;
  href: string;
  icon: string;
}

export const GUIDE_CARDS: GuideCard[] = [
  {
    slug: "quote-guide",
    title: "How to Write a Professional Quote",
    description: "Structure, line items, taxes and payment terms: how to write a quote that clients read, understand and sign.",
    href: "/blog/how-to-write-a-professional-quote-that-wins-jobs/",
    icon: "",
  },
  {
    slug: "calculators",
    title: "Free Contractor Calculators",
    description: "GST/HST and QST, holdback, markup and margin, and labour rate calculators built for Canadian contractors.",
    href: "/tools/",
    icon: "",
  },
  {
    slug: "compare",
    title: "Compare Quoting Software",
    description: "quoteai side by side with Jobber, Joist and Housecall Pro, using each company's own published prices and features.",
    href: "/compare/",
    icon: "",
  },
  {
    slug: "pricing",
    title: "Plans and Pricing",
    description: "What each quoteai plan includes, in Canadian dollars, and how the free quotes work.",
    href: "/pricing/",
    icon: "",
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

const ALL_BLOG_CATEGORIES: BlogCategory[] = [
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

// Only categories with at least one article get a page, a link or a sitemap entry
// (an empty "Innovation" page was in the sitemap: SEO-RECOVERY-PLAN S2).
export const BLOG_CATEGORIES: BlogCategory[] = ALL_BLOG_CATEGORIES.filter((c) =>
  BLOG_LISTED.some((a) => a.category.toLowerCase() === c.name.toLowerCase() || a.category === c.slug),
);

export function getCategoryBySlug(slug: string): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((c) => c.slug === slug);
}

export function getArticlesByCategory(categoryName: string): BlogArticleMeta[] {
  return BLOG_LISTED.filter((a) => a.category.toLowerCase() === categoryName.toLowerCase());
}

export const SECTOR_ARTICLES: Record<string, string[]> = {
  painter: ["how-to-quote-a-painting-job", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup", "how-to-get-more-reviews-as-a-contractor"],
  electrician: ["how-to-quote-an-electrical-job", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup", "google-business-profile-guide-for-tradespeople"],
  plumber: ["how-to-quote-a-plumbing-job", "how-to-get-more-plumbing-jobs-canada", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup"],
  "hvac-technician": ["how-to-quote-an-hvac-job", "canada-greener-homes-grant-rebates-contractors-guide-2026", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup"],
  "air-conditioning-installer": ["how-to-quote-an-hvac-job", "canada-greener-homes-grant-rebates-contractors-guide-2026", "how-to-price-a-job-labour-materials-markup"],
  mason: ["how-to-quote-a-masonry-job", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup", "how-to-write-a-contractor-contract-canada"],
  roofer: ["how-to-quote-a-roofing-job", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup", "how-to-write-a-contractor-contract-canada"],
  "window-door-installer": ["how-to-quote-a-window-or-door-installation-job", "canada-greener-homes-grant-rebates-contractors-guide-2026", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup"],
  "general-contractor": ["how-to-write-a-professional-quote-that-wins-jobs", "how-to-write-a-contractor-contract-canada", "how-to-handle-change-orders-contractors", "how-to-hire-and-pay-subcontractors-canada"],
  "renovation-contractor": ["how-to-write-a-professional-quote-that-wins-jobs", "how-to-write-a-contractor-contract-canada", "how-to-handle-change-orders-contractors", "canada-greener-homes-grant-rebates-contractors-guide-2026"],
  "carpenter-cabinetmaker": ["how-to-quote-a-carpentry-job", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup"],
  "welder-fabricator": ["how-to-quote-a-welding-or-metal-fabrication-job", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup"],
  "tile-installer": ["how-to-quote-a-tiling-job", "how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup"],
  "flooring-installer": ["how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup", "how-to-handle-change-orders-contractors"],
  landscaper: ["how-to-quote-a-landscaping-job", "google-business-profile-guide-for-tradespeople", "how-to-get-more-reviews-as-a-contractor"],
  freelance: ["how-to-write-a-professional-quote-that-wins-jobs", "how-to-price-a-job-labour-materials-markup", "how-to-collect-payment-from-clients-contractor-canada", "google-business-profile-guide-for-tradespeople"],
  "word-template": ["how-to-write-a-professional-quote-that-wins-jobs", "quote-vs-estimate-vs-invoice-difference", "how-to-price-a-job-labour-materials-markup"],
};
