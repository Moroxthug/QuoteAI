export interface BlogArticle {
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
  contentHtml: string;
}

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "how-much-does-it-cost-to-paint-an-apartment-in-canada-2026",
    title: "How Much Does It Cost to Paint an Apartment in Canada in 2026?",
    seoTitle: "Cost to Paint an Apartment in Canada (2026)",
    metaDescription: "Updated 2026 CAD pricing to paint an apartment in Canada: cost per square foot, per room, labour vs. materials, and how Toronto and Vancouver compare to smaller markets.",
    category: "Pricing",
    publishedAt: "2026-03-04",
    readingTimeMin: 5,
    relatedSectors: ["painter", "decorative-painter"],
    contentHtml: `
<p>Painting is one of the most common renovation jobs booked in Canada every year — and one of the easiest to get a wildly inaccurate quote for. Prices swing a lot depending on the city, the condition of the walls, and the finish you choose. Here's what painting an apartment actually costs across Canada in 2026.</p>

<h2>Average painting costs in Canada in 2026</h2>
<p>Most painters price by the square foot of wall area or by the room. As a rule of thumb:</p>
<ul>
  <li><strong>Budget job</strong> (one coat, builder-grade paint, walls in good shape): $1.50–$2.50/sq ft</li>
  <li><strong>Standard job</strong> (two coats, mid-grade paint, minor patching): $2.50–$4.00/sq ft</li>
  <li><strong>Premium job</strong> (three coats, low-VOC or designer paint, full wall prep): $4.00–$6.50/sq ft</li>
</ul>
<p>For a typical 850 sq ft one-bedroom apartment, that works out to roughly <strong>$1,800 to $4,500</strong> including labour and materials, depending on finish and wall condition.</p>

<h2>Cost by room</h2>
<ul>
  <li><strong>Bedroom</strong> (10x12 ft): $250–$550</li>
  <li><strong>Living room</strong> (14x16 ft): $450–$950</li>
  <li><strong>Kitchen</strong> (with cabinets excluded): $300–$650</li>
  <li><strong>Bathroom</strong> (moisture-resistant paint): $200–$450</li>
  <li><strong>Hallway/entry</strong>: $200–$400</li>
</ul>

<h2>What drives the price up or down</h2>
<h3>Wall condition</h3>
<p>Nail holes, drywall patching, and skim-coating add time before a single coat goes on. A unit that needs significant prep can add $500–$1,500 to the total compared to walls that are already smooth and clean.</p>
<h3>Ceiling height</h3>
<p>Standard 8–9 ft ceilings are priced into most quotes. Anything above 10 ft usually requires scaffolding or extension equipment, which can add 15–25% to labour costs.</p>
<h3>Paint quality</h3>
<p>Builder-grade paint runs $30–$45/gallon (covering roughly 350–400 sq ft with one coat), while premium low-VOC or designer lines run $60–$110/gallon. On an average apartment, upgrading paint quality alone can add $200–$500 to the job.</p>
<h3>City and region</h3>
<p>Labour rates vary significantly across the country. Toronto and Vancouver typically run 20–35% above the national average due to higher labour and overhead costs. Calgary, Edmonton, and Ottawa sit closer to the middle. Quebec markets, including Montreal, tend to run somewhat lower than Ontario and BC for comparable work — often 10–15% below Toronto pricing for the same scope.</p>

<h2>Labour vs. materials</h2>
<p>On a typical painting quote, the split looks like this:</p>
<ul>
  <li><strong>Labour</strong>: 65–75% of the total</li>
  <li><strong>Materials</strong> (paint, primer, tape, drop sheets, supplies): 25–35%</li>
</ul>
<p>This is why buying your own paint and hiring someone only for the labour rarely saves much — materials are a relatively small share of the total bill.</p>

<h2>How to get an accurate quote</h2>
<p>To get a precise number from a painter, have this ready before the estimate:</p>
<ul>
  <li>Square footage of each room (or let the painter measure on-site)</li>
  <li>Condition of the walls (patched holes, water stains, old wallpaper)</li>
  <li>Whether ceilings and trim are included</li>
  <li>Desired finish (flat, eggshell, satin) and colour changes (dark-to-light colour changes can require an extra coat)</li>
</ul>
<p>With this information, a professional painter using <a href="/quotes/painter/">AI-assisted quoting software</a> can turn around a detailed, itemized PDF estimate on-site — often before they've even left the apartment.</p>
`,
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
    contentHtml: `
<p>Bathroom renovations are consistently one of the highest-value projects homeowners take on, and one of the widest-ranging in price. In Toronto specifically, labour costs and permit requirements push totals higher than the national average. Here's a realistic breakdown for 2026.</p>

<h2>Toronto bathroom renovation costs by tier</h2>
<ul>
  <li><strong>Cosmetic refresh</strong> (new vanity, toilet, fixtures, paint — no plumbing moves): $8,000–$14,000</li>
  <li><strong>Mid-range renovation</strong> (new tile, tub-to-shower conversion, vanity, lighting): $18,000–$32,000</li>
  <li><strong>Full gut renovation</strong> (moved plumbing, custom shower, heated floors, premium finishes): $35,000–$60,000+</li>
</ul>
<p>For a standard 5x8 ft bathroom, most Toronto homeowners land between <strong>$16,000 and $28,000</strong> for a genuine mid-range renovation that touches plumbing, tile, and fixtures.</p>

<h2>Where the money goes</h2>
<ul>
  <li><strong>Plumbing</strong> (rough-in changes, new supply lines, drain work): $2,500–$8,000</li>
  <li><strong>Tiling</strong> (floor and shower walls, labour and materials): $3,500–$9,000</li>
  <li><strong>Vanity and countertop</strong>: $800–$4,500</li>
  <li><strong>Shower/tub</strong>: $1,500–$8,000 depending on custom glass and tile work</li>
  <li><strong>Electrical</strong> (potlights, exhaust fan, GFCI outlets): $800–$2,500</li>
  <li><strong>Permits and inspections</strong>: $200–$800 in most Toronto-area municipalities when plumbing or electrical is altered</li>
</ul>

<h2>Toronto vs. the rest of Ontario and Canada</h2>
<p>Toronto and the GTA typically run 20–30% above smaller Ontario markets like London, Kitchener-Waterloo, or Windsor for comparable scope, driven largely by trade labour rates and permit turnaround. Compared nationally, Vancouver runs similarly high to Toronto, while Calgary, Edmonton, and Winnipeg tend to be 10–20% lower. Quebec markets, including Montreal, are often the most affordable of Canada's major metros for the same renovation scope.</p>

<h2>Common cost surprises</h2>
<h3>Hidden water damage</h3>
<p>Older Toronto homes (especially pre-1980s builds) often reveal subfloor rot or outdated plumbing once tile comes up. Budget a 10–15% contingency for this — it's one of the most common reasons a bathroom renovation quote changes mid-project.</p>
<h3>Moving the toilet or shower drain</h3>
<p>Relocating a drain, even by a foot, can add $1,500–$4,000 depending on whether the home is on a concrete slab or has an accessible basement below.</p>
<h3>Custom glass showers</h3>
<p>Frameless glass enclosures look great but run $1,200–$3,500 installed, compared to $300–$700 for a standard sliding door or curtain setup.</p>

<h2>How to compare quotes properly</h2>
<p>A trustworthy bathroom renovation quote should break out plumbing, tiling, electrical, fixtures, and labour as separate line items — not one lump sum. It should also state whether permits are included and who is responsible for pulling them. Contractors using <a href="/quotes/plumber/">AI quoting tools built for tradespeople</a> can generate this level of detail directly from a site visit, which makes comparing multiple quotes far easier for homeowners.</p>
`,
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
    contentHtml: `
<p>Rewiring a house is one of the more disruptive — and expensive — renovation jobs, but it's often non-negotiable for older homes with outdated or unsafe wiring. Here's what it realistically costs across Canada in 2026.</p>

<h2>Full house rewiring costs</h2>
<ul>
  <li><strong>Small home</strong> (under 1,200 sq ft): $9,000–$16,000</li>
  <li><strong>Mid-size home</strong> (1,200–2,200 sq ft): $16,000–$28,000</li>
  <li><strong>Large home</strong> (2,200+ sq ft): $28,000–$45,000+</li>
</ul>
<p>Most electricians price full rewiring at <strong>$8–$14 per square foot</strong>, which includes new wiring throughout, updated outlets and switches, and a panel upgrade.</p>

<h2>Common electrical jobs and their price ranges</h2>
<ul>
  <li><strong>Panel upgrade</strong> (100A to 200A service): $2,500–$5,500</li>
  <li><strong>Knob-and-tube or aluminum wiring removal</strong> (per circuit): $150–$400</li>
  <li><strong>New outlet or switch installation</strong>: $120–$250 each</li>
  <li><strong>Whole-home smoke/CO detector interconnection</strong>: $600–$1,500</li>
  <li><strong>EV charger circuit installation</strong>: $800–$2,200 depending on panel capacity and distance from the panel</li>
</ul>

<h2>Why older homes cost more</h2>
<p>Homes built before the 1970s often have knob-and-tube or aluminum wiring, which many insurance companies now flag or refuse to cover. Removing and replacing this wiring is more labour-intensive than a straightforward rewire because walls and plaster need to be opened and patched. This can add 20–40% to the total cost compared to rewiring a home with modern drywall construction.</p>

<h2>Regional pricing differences</h2>
<p>Electrical labour rates in Toronto and Vancouver typically run 15–30% higher than the national average. Calgary and Edmonton sit closer to average, while Quebec markets tend to run somewhat lower — partly due to lower average labour rates and partly due to differences in typical housing stock. Rural and northern regions can see higher costs due to travel time and materials logistics, even where hourly labour rates are lower.</p>

<h2>Permits and inspections</h2>
<p>Electrical work in Canada almost always requires a permit and inspection through the provincial electrical safety authority (e.g., ESA in Ontario, Technical Safety BC, or equivalent). Permit fees typically run $150–$600 depending on scope, and a licensed electrician should always include this in the quote — unpermitted electrical work can void home insurance and complicate a future sale.</p>

<h2>Getting an accurate electrical quote</h2>
<p>A proper rewiring quote should specify the number of circuits, panel size, wiring type being removed, and whether drywall patching is included after the work (most electricians do not include drywall repair — confirm this upfront). Electricians using <a href="/quotes/electrician/">quoting software built for the trade</a> can produce a detailed, circuit-by-circuit estimate on the spot rather than a vague lump-sum number.</p>
`,
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
    contentHtml: `
<p>A roof is one of the biggest single expenses a homeowner faces, and Canada's climate — heavy snow loads, freeze-thaw cycles, and ice damming — makes roofing specs a bit different than in milder climates. Here's what re-roofing costs across Canada in 2026.</p>

<h2>Re-roofing costs by material</h2>
<p>Roofers typically price by the "square" (100 sq ft of roof area):</p>
<ul>
  <li><strong>Asphalt shingles (standard 3-tab or architectural)</strong>: $400–$650/square installed</li>
  <li><strong>Premium architectural/designer shingles</strong>: $650–$950/square installed</li>
  <li><strong>Standing seam metal roofing</strong>: $1,000–$1,800/square installed</li>
  <li><strong>Cedar shake</strong>: $1,200–$2,000/square installed</li>
</ul>
<p>For a typical 2,000 sq ft roof (20 squares), that's roughly <strong>$8,000–$13,000</strong> for a standard asphalt shingle re-roof, or $20,000+ for standing seam metal.</p>

<h2>What adds to roofing costs in Canada specifically</h2>
<h3>Ice and water shield</h3>
<p>Most Canadian building codes require ice and water membrane along eaves, valleys, and around penetrations to prevent ice damming — a much bigger concern here than in warmer climates. This typically adds $500–$1,500 to the total depending on roof complexity.</p>
<h3>Snow load and structural requirements</h3>
<p>In regions with heavy snow loads (much of the Prairies, Quebec, and parts of Ontario and Atlantic Canada), roofs need to meet higher structural load ratings under the National Building Code. If an inspection reveals the existing structure doesn't meet current snow load requirements, additional framing or sheathing reinforcement can add $2,000–$6,000 to a project.</p>
<h3>Eavestrough and downspout upgrades</h3>
<p>Many homeowners upgrade eavestroughs at the same time as a re-roof, especially in areas prone to ice damming, since a roof replacement is the easiest time to install heated cable channels or larger-capacity gutters. Standard eavestrough replacement runs $8–$14 per linear foot; heated gutter cable adds $6–$10 per linear foot.</p>
<h3>Tear-off and disposal</h3>
<p>Removing one layer of old shingles typically costs $100–$150/square; removing two or more layers (common on older homes) can add another $50–$100/square for disposal and extra labour.</p>

<h2>Regional pricing</h2>
<p>Roofing labour in Toronto and Vancouver tends to run 15–25% above the national average. Calgary and Edmonton pricing is generally close to the national midpoint, while Atlantic Canada and Quebec can run somewhat lower — though harsher winter climates in Quebec and the Prairies often mean higher-spec materials are standard, which can offset lower labour costs.</p>

<h2>What a proper roofing quote should include</h2>
<p>A complete roofing estimate should specify shingle brand/line, ice and water shield coverage area, ventilation (ridge vents, soffit vents), flashing replacement, and disposal. Roofers using <a href="/quotes/roofer/">AI-powered quoting tools</a> can generate this level of line-item detail immediately after a roof measurement, which makes it much easier for homeowners to compare bids apples-to-apples.</p>
`,
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
    contentHtml: `
<p>Decks are one of the most requested outdoor projects across Canada, especially as homeowners look to extend their living space through the warmer months. Costs vary significantly based on material choice and deck complexity.</p>

<h2>Deck cost by material (installed, per square foot)</h2>
<ul>
  <li><strong>Pressure-treated wood</strong>: $25–$40/sq ft</li>
  <li><strong>Cedar</strong>: $35–$55/sq ft</li>
  <li><strong>Composite decking (e.g., Trex-style)</strong>: $45–$70/sq ft</li>
  <li><strong>PVC decking</strong>: $55–$80/sq ft</li>
</ul>
<p>A standard 300 sq ft deck typically runs <strong>$8,000–$14,000</strong> in pressure-treated wood, or <strong>$15,000–$21,000</strong> in composite, including railings and standard footings.</p>

<h2>What affects the price</h2>
<ul>
  <li><strong>Height off the ground</strong> — second-storey or elevated decks require additional structural support and railings, adding 15–30% to cost</li>
  <li><strong>Railings</strong> — glass or metal cable railings run $80–$180 per linear foot versus $40–$70 for standard wood or composite railing</li>
  <li><strong>Footings</strong> — frost depth requirements in Canada mean footings typically need to go 4–6 feet deep in most regions, which is more labour-intensive than in milder climates</li>
  <li><strong>Stairs and multi-level design</strong> — each additional level or staircase adds $1,500–$4,000</li>
</ul>

<h2>Permits</h2>
<p>Most Canadian municipalities require a permit for any deck attached to the house or elevated more than about 24 inches off grade — rules vary by province and municipality, so this is always worth confirming locally. Permit fees typically run $75–$350, and skipping this step can create problems at resale or with insurance if there's ever a structural issue.</p>

<h2>Regional pricing</h2>
<p>Deck-building labour in Toronto, Vancouver, and Calgary tends to run above the national average, largely due to higher framing labour costs and, in BC and Ontario, higher lumber transport costs. Quebec and Atlantic Canada markets are often somewhat more affordable for comparable wood decks, though composite material pricing is fairly consistent nationwide since it's typically sourced from the same handful of manufacturers.</p>

<h2>Getting a proper deck quote</h2>
<p>A solid deck quote should specify footing depth and spacing, joist material and spacing, decking material and fastening method, and railing type — not just a total square footage price. Contractors using <a href="/quotes/carpenter-cabinetmaker/">quoting software for carpenters and builders</a> can put this together with accurate material takeoffs directly from a site visit.</p>
`,
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
    contentHtml: `
<p>Because most Canadian homes have full basements, finishing one is among the most common ways to add livable square footage without an addition. Here's what a realistic basement finishing budget looks like in 2026.</p>

<h2>Basement finishing costs by scope</h2>
<ul>
  <li><strong>Basic finish</strong> (framing, insulation, drywall, basic flooring and lighting): $30–$45/sq ft</li>
  <li><strong>Mid-range finish</strong> (adds a bathroom rough-in, better flooring, pot lights): $45–$65/sq ft</li>
  <li><strong>High-end finish</strong> (full bathroom, wet bar or kitchenette, custom millwork, premium flooring): $65–$100+/sq ft</li>
</ul>
<p>For an 800 sq ft basement, that's roughly <strong>$24,000–$36,000</strong> for a basic-to-mid-range finish, and $50,000+ for a high-end finish with a full bathroom.</p>

<h2>Where the budget goes</h2>
<ul>
  <li><strong>Framing and insulation</strong>: $6–$10/sq ft</li>
  <li><strong>Electrical (outlets, lighting, panel capacity check)</strong>: $3,500–$8,000 for a typical basement</li>
  <li><strong>Drywall and paint</strong>: $4–$7/sq ft</li>
  <li><strong>Flooring</strong> (vinyl plank, engineered hardwood, or carpet): $4–$12/sq ft</li>
  <li><strong>Bathroom addition</strong> (if plumbing rough-in already exists): $12,000–$22,000</li>
  <li><strong>Egress window</strong> (required if adding a bedroom): $3,500–$8,000</li>
</ul>

<h2>Waterproof it before you finish it</h2>
<p>This is the step homeowners most often skip — and regret. Basements are below grade year-round, and in most of Canada, spring thaw and heavy rain events put real pressure on foundations. Finishing a basement without addressing water issues first is one of the most common causes of expensive rework, since drywall, insulation, and flooring all need to come back out if moisture shows up later. A proper waterproofing assessment before framing begins typically costs $150–$500, and can save tens of thousands of dollars in redone finishing work down the line.</p>

<h2>Regional pricing</h2>
<p>Basement finishing costs in Toronto and Vancouver typically run 15–25% above the national average due to higher trade labour rates. Prairie cities like Calgary, Edmonton, and Winnipeg tend to be closer to the national average, while Quebec markets are often somewhat lower — though colder regions across the country may require additional attention to insulation specs (higher R-value requirements) that can offset some of that savings.</p>

<h2>Getting a complete basement quote</h2>
<p>A thorough basement finishing quote should separate framing, electrical, plumbing (if applicable), drywall, flooring, and any egress window work as individual line items, along with a note on whether waterproofing was assessed. Contractors using <a href="/quotes/renovation-contractor/">AI-assisted quoting tools</a> can build this structure quickly from a walkthrough, which gives homeowners a much clearer picture of where their money is going.</p>
`,
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
    contentHtml: `
<p>A well-built quote is often the difference between a client who signs on the spot and one who quietly goes with a competitor. For tradespeople, the quote is usually the first real "document" a client sees from you — it needs to communicate professionalism and value, not just a number.</p>

<h2>What a professional quote needs to include</h2>
<ul>
  <li><strong>Business header</strong> — company name, licence/insurance info if applicable, contact details</li>
  <li><strong>Client and job details</strong> — name, property address, and a short description of the job</li>
  <li><strong>Itemized scope of work</strong> — broken down by area or task, not lumped into one line</li>
  <li><strong>Materials specified</strong> — brand or grade where relevant, not just "materials"</li>
  <li><strong>Labour and materials shown separately</strong> — builds trust and makes the price easier to justify</li>
  <li><strong>Taxes clearly shown</strong> — GST/HST (and PST or QST where applicable) broken out, not buried in the total</li>
  <li><strong>Terms and validity</strong> — payment schedule, estimated timeline, and how long the quote is valid</li>
</ul>

<h2>How to price the job so the numbers hold up</h2>
<p>Vague line items ("bathroom renovation — $18,000") don't give a client anything to evaluate — they can only compare it to the total number on someone else's quote. Break the job into the actual tasks involved (demo, rough-in, tiling, fixtures, paint) so the client can see exactly what they're paying for, and so you have a clear paper trail if the scope changes mid-job.</p>

<h2>Common mistakes that cost jobs</h2>
<h3>Vague scope</h3>
<p>If a client can't tell what's included just from reading the quote, they'll assume the cheapest-looking competitor's quote covers the same thing — even if it doesn't.</p>
<h3>No expiry date</h3>
<p>Always include a validity period (typically 30 days). It protects you from material price swings and creates a gentle sense of urgency for the client to decide.</p>
<h3>Slow turnaround</h3>
<p>Speed matters more than most tradespeople realize. Jobs are frequently awarded to whichever contractor sends a complete, professional quote first — sometimes within hours of the site visit. A quote that takes a week to arrive is competing against nothing; a quote sent the same day is often the only one the client seriously considers.</p>

<h2>Format matters</h2>
<p>Always send quotes as a PDF, never an editable Word or Excel file. It's harder to accidentally alter, looks more professional on a phone screen, and signals that you run your business like, well, a business. Tools built for <a href="/quotes/how-to-quote/">generating professional quotes</a> can produce a polished PDF with your branding automatically, right from a job site visit.</p>
`,
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
    contentHtml: `
<p>Most contractors lose jobs not because their pricing is too high, but because of how the quote itself is put together and delivered. Here are the mistakes that show up most often — and what to do instead.</p>

<h2>1. Sending a single lump-sum number</h2>
<p>A one-line total gives the client nothing to evaluate except "is this more or less than the other guy." Break the job into line items so they can see the value in what they're paying for.</p>

<h2>2. Leaving out materials specs</h2>
<p>Writing "flooring — $2,400" tells the client nothing. Naming the product or at least the grade ("engineered hardwood, 3/4in, oak") signals expertise and justifies the price.</p>

<h2>3. No payment terms</h2>
<p>Every quote should state the deposit required, payment milestones, and accepted payment methods upfront. Ambiguity here creates awkward conversations later — or worse, payment disputes.</p>

<h2>4. Taking too long to send it</h2>
<p>The contractor who sends a complete, professional quote within hours of the site visit wins a disproportionate share of jobs — clients tend to book with whoever responds first with something credible, especially for smaller residential jobs.</p>

<h2>5. Sending an editable file</h2>
<p>Word docs and spreadsheets look unfinished and can be accidentally (or not-so-accidentally) altered. Always send a PDF.</p>

<h2>6. No expiry date on the quote</h2>
<p>Without a validity window, clients can sit on a quote indefinitely — and then expect the original price months later after material costs have shifted. Thirty days is standard.</p>

<h2>7. Not following up</h2>
<p>Most jobs aren't booked from the first quote alone. A short follow-up message two or three days later ("just checking if you had any questions about the estimate") closes a meaningful share of jobs that would otherwise go quiet.</p>

<h2>The fix: build a repeatable process</h2>
<p>The contractors who win the most work aren't necessarily the cheapest — they're the ones with a consistent, fast, professional quoting process. Tools like <a href="/quotes/free-quote/">AI-assisted quote generators</a> help standardize this so every quote goes out itemized, priced correctly, and fast, regardless of how busy the week gets.</p>
`,
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
    contentHtml: `
<p>A lot of tradespeople price jobs by gut feel, or by matching whatever a competitor seems to charge. That approach works fine until a busy season quietly turns into a break-even one. Here's a straightforward way to price a job so the number on the quote actually protects your margin.</p>

<h2>Start with your true labour cost</h2>
<p>Your hourly labour rate needs to cover more than just take-home pay. It should include:</p>
<ul>
  <li>Wages (yours and any crew)</li>
  <li>CPP/EI contributions and any WSIB or provincial workers' compensation premiums</li>
  <li>Vehicle and fuel costs</li>
  <li>Tools, equipment depreciation, and insurance</li>
  <li>Non-billable time (quoting, driving, admin)</li>
</ul>
<p>Many tradespeople underestimate this by 20–30% because they only count wages, not the overhead sitting behind every billable hour.</p>

<h2>Materials: mark them up, don't just pass them through</h2>
<p>Charging clients exactly what materials cost you means you're financing the purchase, storage, and any waste or returns for free. A standard materials markup in most trades runs <strong>15–25%</strong> over your cost — higher for smaller specialty items, sometimes lower for large-ticket items like appliances or windows where the base cost is already high.</p>

<h2>Overhead and profit — don't skip these</h2>
<p>Overhead (insurance, vehicle, software, marketing, admin time) and profit margin should be built into every quote, not treated as whatever's left over. A common structure:</p>
<ul>
  <li><strong>Direct costs</strong> (labour + materials): the baseline</li>
  <li><strong>Overhead</strong>: typically 10–20% added on top</li>
  <li><strong>Profit margin</strong>: typically 10–20% added after overhead</li>
</ul>
<p>Skipping the overhead and profit steps is the single most common reason contractors feel "busy but broke" — the jobs are covering costs but not actually generating a return.</p>

<h2>Watch for scope creep</h2>
<p>Verbal add-ons during a job ("while you're here, can you also...") are one of the fastest ways to erode margin. Any change to scope should generate a quick written change order with updated pricing — even a one-line text message confirmation is better than nothing.</p>

<h2>Putting it into a quote</h2>
<p>None of this needs to be visible to the client line-by-line — most quotes just show labour and materials totals per task. But pricing it this way internally, rather than guessing, is what keeps a full calendar profitable instead of just busy. Quoting software built for tradespeople can apply consistent markup and overhead rules automatically, so every job gets priced the same disciplined way — see how it works for <a href="/quotes/general-contractor/">general contractors and builders</a>.</p>
`,
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
    contentHtml: `
<p>For a lot of trades, the biggest bottleneck isn't finding work — it's the hours spent every week turning site visits into finished quotes. Mobile quoting tools are changing that math, and contractors who adopt them tend to close more jobs simply by being first to respond.</p>

<h2>Why speed wins jobs</h2>
<p>Homeowners and property managers typically request quotes from two or three contractors for the same job. Whoever sends a complete, professional, itemized quote first has a real edge — not because they're necessarily cheaper, but because they've removed the friction of waiting. A quote sent from the driveway, minutes after the walkthrough, beats one that arrives three days later almost every time.</p>

<h2>What to look for in a mobile quoting tool</h2>
<ul>
  <li><strong>Works from a phone or tablet</strong> — no need to be back at a desk or laptop</li>
  <li><strong>Generates itemized line items automatically</strong> — not just a blank template you have to fill in manually</li>
  <li><strong>Applies the correct tax automatically</strong> — GST/HST, and PST or QST where applicable, calculated without manual lookup</li>
  <li><strong>Outputs a clean PDF</strong> — with your logo and business details already formatted</li>
  <li><strong>Keeps a searchable history</strong> — so past quotes and pricing are easy to reference for similar future jobs</li>
</ul>

<h2>How AI-assisted quoting fits in</h2>
<p>The newer generation of quoting tools use AI to turn a plain-language job description — spoken or typed on-site — directly into a structured, priced quote. Instead of manually building a spreadsheet formula for every job type, a contractor can describe the scope in normal language and get a properly formatted estimate back in under a minute.</p>

<h2>What this replaces</h2>
<p>Most tradespeople still quoting from Excel or Word spend 45–90 minutes per quote once formatting, tax calculation, and PDF conversion are factored in. At even 10 quotes a month, that's close to a full working day spent on paperwork instead of billable work. Moving that process to a mobile-first, AI-assisted tool — like the <a href="/quotes/free-quote/">quote generator built for tradespeople</a> — typically cuts that down to a couple of minutes per quote.</p>
`,
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
    contentHtml: `
<p>Winterization work is a category almost unique to climates like Canada's — and it's a genuine seasonal revenue stream for contractors who offer it proactively rather than waiting for a burst pipe call in January. Here's what belongs on a proper winterization checklist, and roughly what each job costs.</p>

<h2>Exterior and envelope</h2>
<ul>
  <li><strong>Weatherstripping and door/window sealing</strong>: $150–$500 for a typical home, and one of the highest-ROI jobs for reducing heat loss</li>
  <li><strong>Attic insulation top-up</strong>: $1.50–$3.00/sq ft, often eligible for provincial or federal energy rebates</li>
  <li><strong>Eavestrough cleaning and inspection</strong>: $150–$350, critical for preventing ice damming</li>
  <li><strong>Exterior caulking around windows, doors, and siding penetrations</strong>: $300–$800</li>
</ul>

<h2>Plumbing and mechanical</h2>
<ul>
  <li><strong>Exterior hose bib shutoff and insulation</strong>: $80–$200, and one of the most commonly skipped jobs that leads to frozen and burst pipes</li>
  <li><strong>Pipe insulation in unheated spaces</strong> (crawlspaces, garages): $200–$600</li>
  <li><strong>Furnace inspection and filter service</strong>: $150–$350</li>
  <li><strong>Sump pump check</strong> (critical before spring thaw, but worth confirming in fall): $100–$250</li>
</ul>

<h2>Why this matters more in Canada</h2>
<p>Freeze-thaw cycles are one of the leading causes of structural and plumbing damage across most of the country. A single frozen and burst pipe can cause $5,000–$25,000+ in water damage — far more than the cost of preventive winterization. This makes winterization one of the easier "add-on" services for contractors to pitch to existing clients each fall, since the value proposition (a few hundred dollars now vs. a potential five-figure repair) is easy to explain.</p>

<h2>Building winterization into your service offering</h2>
<p>Contractors who run winterization as a standalone seasonal package — rather than a one-off ad hoc request — tend to see strong repeat business, since it's a natural annual touchpoint with past clients. Bundling a few of the checklist items above into a fixed-price fall package (e.g., "Winter-Ready Home Check") gives clients a simple, low-commitment way to book, and gives contractors a predictable quoting template to reuse every season. Tools built for <a href="/quotes/general-contractor/">general contractors</a> make it easy to save a standard winterization package as a reusable quote template.</p>
`,
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
    contentHtml: `
<p>Roofing in Canada isn't just about shingles and flashing — snow load and ice management are structural and design considerations that don't come up the same way in most other markets. Here's what matters.</p>

<h2>Understanding snow load ratings</h2>
<p>The National Building Code of Canada sets minimum ground snow load values by region, which local building codes use to determine the structural snow load a roof must be engineered to support. These values vary significantly across the country — parts of the Prairies, Quebec, and Atlantic Canada see substantially higher design snow loads than milder coastal regions like southern Vancouver Island. Any roof replacement or structural roof work should confirm the home's framing still meets current local requirements, especially on older homes where the original design predates current code values.</p>

<h2>Signs a roof structure may be under-built for its snow load</h2>
<ul>
  <li>Visible sagging in the roofline, especially after a heavy snow event</li>
  <li>Doors and windows sticking on upper floors after winter</li>
  <li>Cracking sounds during or after significant snowfall</li>
  <li>Water stains suggesting the roof deck is flexing enough to compromise the membrane</li>
</ul>
<p>If any of these show up, a structural assessment before re-roofing is worth the $300–$800 cost — reinforcing framing during a re-roof is far cheaper than an emergency repair after a collapse or partial failure.</p>

<h2>Ice damming and eavestrough design</h2>
<p>Ice damming happens when heat escaping through the roof melts snow, which then refreezes at the colder eaves, backing water up under shingles. This is one of the most common sources of winter water damage in Canadian homes. The fixes that actually address the cause (rather than just the symptom) include:</p>
<ul>
  <li><strong>Ice and water shield membrane</strong> at eaves and valleys — now standard in most Canadian roofing codes</li>
  <li><strong>Adequate attic ventilation and insulation</strong> — keeps the roof deck cold and uniform, which prevents uneven melting</li>
  <li><strong>Properly sized eavestroughs and downspouts</strong> — undersized systems back up and contribute to ice buildup at the fascia</li>
  <li><strong>Heated cable systems</strong> in chronic problem areas — a targeted fix rather than a full solution, best used alongside proper ventilation</li>
</ul>

<h2>What this means for a roofing quote</h2>
<p>A roofing quote for a Canadian home should account for ice and water shield coverage, confirm whether ventilation upgrades are included, and flag if eavestrough capacity needs to be increased. Roofers using <a href="/quotes/roofer/">quoting tools built for the trade</a> can include these Canada-specific line items automatically rather than relying on generic templates.</p>
`,
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
    contentHtml: `
<p>Because the vast majority of Canadian homes have full basements, waterproofing is one of the most consistently requested services in the country — and one of the most misunderstood by homeowners comparing quotes.</p>

<h2>Signs a basement needs waterproofing</h2>
<ul>
  <li>Musty smell or visible mould, especially after rain or spring thaw</li>
  <li>Efflorescence (white chalky residue) on foundation walls</li>
  <li>Visible cracks in the foundation, especially horizontal ones</li>
  <li>Water pooling near the foundation after rain, or a damp floor without an obvious leak source</li>
  <li>Peeling paint or bubbling on basement walls</li>
</ul>

<h2>Interior vs. exterior waterproofing</h2>
<h3>Interior waterproofing</h3>
<p>Involves installing a drainage system (weeping tile) inside the basement along the footing, connected to a sump pump, along with a vapour barrier on the walls. This is less invasive and less expensive, typically running <strong>$60–$120 per linear foot</strong>, but it manages water rather than fully stopping it from entering the foundation wall.</p>
<h3>Exterior waterproofing</h3>
<p>Involves excavating around the foundation, applying a waterproof membrane directly to the exterior wall, and installing new exterior weeping tile. This addresses the source of the water intrusion directly and is generally considered the more thorough fix, but is significantly more disruptive and costly — typically <strong>$150–$300 per linear foot</strong>, and higher again if landscaping, decks, or driveways need to be removed and restored.</p>

<h2>Sump pump systems</h2>
<p>A sump pump is central to most Canadian basement waterproofing systems, particularly given spring snowmelt. Costs run:</p>
<ul>
  <li><strong>Standard sump pump installation</strong>: $1,200–$2,800</li>
  <li><strong>Battery backup system</strong> (recommended given the risk of power outages during storms): $600–$1,500 additional</li>
  <li><strong>Annual maintenance/inspection</strong>: $100–$200</li>
</ul>

<h2>Why waterproof before finishing a basement</h2>
<p>This is worth repeating from a cost perspective: finishing a basement (drywall, flooring, framing) before addressing water issues is one of the most expensive mistakes homeowners make, because all of that finishing work often has to be torn out again if moisture problems surface later. A waterproofing assessment before finishing typically costs a few hundred dollars — a small fraction of the tens of thousands a redo can cost.</p>

<h2>Getting a proper waterproofing quote</h2>
<p>A trustworthy waterproofing quote should specify whether the approach is interior, exterior, or a hybrid, the linear footage being treated, sump pump specs, and warranty terms — waterproofing warranties vary widely between contractors and are worth comparing directly. Contractors using <a href="/quotes/plumber/">quoting software for tradespeople</a> can document this scope clearly so homeowners know exactly what they're paying for.</p>
`,
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
    contentHtml: `
<p><strong>Editorial note:</strong> Rebate programs, amounts, and eligibility rules change frequently — sometimes year to year, and sometimes mid-year as program funding is renewed or exhausted. Always verify current amounts and eligibility directly with the relevant program before quoting a client, and treat the figures below as a general orientation rather than guaranteed numbers.</p>

<h2>Why this matters for contractors</h2>
<p>Being able to speak knowledgeably about available rebates — even in general terms — is a genuine differentiator when quoting energy-efficiency-related work like insulation, heat pumps, windows, or high-efficiency furnaces. Clients often decide whether to proceed with upgraded (and pricier) equipment based on whether a rebate offsets part of the cost, so contractors who can point clients in the right direction tend to close more of these upgraded-scope jobs.</p>

<h2>Federal programs</h2>
<p>The <strong>Canada Greener Homes</strong> initiative (which has included both grant and loan components at various points) has historically supported upgrades such as home insulation, air sealing, heat pumps, and window/door replacements, usually requiring an EnerGuide energy evaluation before and after the work. Program structure, funding availability, and specific eligible upgrades have shifted over time, so contractors should check the current federal program status before referencing specific dollar amounts to a client.</p>

<h2>Provincial and utility programs</h2>
<h3>Quebec — Hydro-Québec Rénoclimat</h3>
<p>Quebec's Rénoclimat program has offered rebates tied to an energy evaluation, covering upgrades like insulation, air sealing, and heating system replacements. As with federal programs, specific rebate amounts and eligible measures are updated periodically.</p>
<h3>British Columbia — BC Hydro and FortisBC</h3>
<p>BC Hydro and FortisBC have both run rebate programs for homeowners upgrading insulation, heat pumps, and efficient water heating, sometimes layered with federal programs for a larger combined rebate. Program specifics differ between the two utilities and by fuel type (electric vs. natural gas), so it's worth checking both if a home has access to either.</p>
<h3>Ontario — Enbridge Gas programs</h3>
<p>Enbridge Gas has offered home efficiency programs in Ontario covering insulation, smart thermostats, and high-efficiency furnace or water heater upgrades for eligible customers. Eligibility and rebate amounts vary by program year.</p>

<h2>How to use this in a quote without overpromising</h2>
<p>Rather than quoting a specific rebate dollar amount directly on an invoice (which can create liability if the program has changed), it's safer to reference the program by name and direct the client to confirm current details and apply directly. A line like "this upgrade may qualify for [program name] — client to confirm current eligibility and amount" keeps the quote accurate without the contractor being on the hook for a rebate figure that changes.</p>

<h2>Building this into your quoting process</h2>
<p>For contractors who frequently quote insulation, heat pump, or high-efficiency HVAC work, it's worth keeping a running note of which programs are currently active in your service area and reviewing it seasonally, since these programs are one of the more effective ways to help a client justify a higher-efficiency (and higher-margin) upgrade. Tools built for <a href="/quotes/hvac-technician/">HVAC and heating contractors</a> make it easy to add a standard rebate-reference note to any quote involving eligible upgrades.</p>
`,
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
    contentHtml: `
<p>For local trades — electricians, plumbers, painters, landscapers — a well-optimized Google Business Profile is often the single highest-return marketing asset available, and it's free. Here's how to set one up properly.</p>

<h2>Getting the basics right</h2>
<ul>
  <li><strong>Business name</strong> — use your actual registered business name, not a keyword-stuffed version (Google penalizes this)</li>
  <li><strong>Category</strong> — choose the most accurate primary category (e.g., "Electrician," "Plumber," "General contractor") and add relevant secondary categories</li>
  <li><strong>Service area</strong> — define this accurately; if you don't have a public storefront, set up a service-area business rather than a fixed address</li>
  <li><strong>Phone number and website</strong> — make sure both are current and match what's on your website and invoices exactly</li>
  <li><strong>Hours</strong> — keep these updated, especially around holidays; inaccurate hours are a common source of lost calls</li>
</ul>

<h2>Photos matter more than most trades think</h2>
<p>Profiles with regularly updated photos — completed jobs, before/afters, your crew and vehicles — consistently get more engagement than text-only profiles. Aim to add new photos monthly, not just once at setup. Before/after project photos in particular tend to perform well and give potential clients a concrete sense of your work quality.</p>

<h2>Services and descriptions</h2>
<p>Fill out the services section in detail rather than leaving it generic. Instead of just "Plumbing," list specific services like "Drain cleaning," "Water heater installation," "Bathroom rough-in plumbing" — this helps your profile surface for more specific searches, which tend to convert better than broad ones.</p>

<h2>Posts and updates</h2>
<p>Google Business Profile allows periodic posts (offers, updates, project highlights). Profiles that post at least a few times a month tend to see better visibility than dormant ones. This doesn't need to be elaborate — a photo from a recent job with a short caption is enough.</p>

<h2>Why this connects to your quoting process</h2>
<p>A strong Google Business Profile generates more inbound calls and requests — which means more quotes going out. If your quoting process is still slow or manual, an increase in leads from local search can quickly turn into a bottleneck rather than a win. Pairing a strong local presence with fast, professional quoting tools ensures the extra leads actually convert into booked jobs — see how this works for <a href="/quotes/general-contractor/">contractors and tradespeople</a>.</p>
`,
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
    contentHtml: `
<p>Reviews are one of the strongest trust signals a potential client evaluates before hiring a tradesperson — often more influential than the price on the quote itself. Yet most contractors do finish-quality work and simply never ask for a review. Here's how to fix that without it feeling awkward.</p>

<h2>Ask at the right moment</h2>
<p>The best time to ask for a review is immediately after the client has expressed satisfaction — right at project completion, when the value of the work is freshest and most visible. Waiting weeks after the job wraps up dramatically lowers response rates, simply because the moment has passed and it's no longer top of mind.</p>

<h2>Make it as easy as possible</h2>
<p>Friction kills review requests. Rather than saying "please leave us a review," send a direct link to your Google Business Profile review page via text or email — most clients are happy to leave a quick review but won't go searching for where to do it. A short message like: <em>"Thanks again for having us out — if you have a minute, a quick review here would really help us out: [link]"</em> performs far better than a vague request.</p>

<h2>Timing tools that help</h2>
<p>Some contractors build a review request into their standard invoice or final-payment message, so it becomes a routine step rather than something to remember separately. Automating this — even something as simple as a saved text template sent after final payment clears — noticeably increases the number of reviews collected over time.</p>

<h2>Responding to reviews (including negative ones)</h2>
<p>Responding to reviews, positive or negative, signals to future clients that you're actively engaged with your business reputation. For a negative review, a calm, professional response addressing the specific concern (without getting defensive) often does more for your credibility with future clients than the negative review itself does damage.</p>

<h2>Why review volume compounds</h2>
<p>Beyond trust-building, review count and recency are factors in local search visibility — profiles with a steady stream of recent reviews tend to be favoured over ones with a handful of old reviews, even if the older reviews are excellent. Treating review collection as an ongoing part of your workflow (rather than a one-time push) pays off steadily over time, especially when paired with fast, professional quoting that gets clients to "yes" in the first place — see tools built for <a href="/quotes/freelance/">independent tradespeople and freelancers</a>.</p>
`,
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
    color: "bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-400",
  },
  {
    slug: "pricing",
    name: "Pricing",
    description: "Up-to-date Canadian pricing for the most common jobs: cost per square foot, per room, and per project, with regional differences called out.",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:border-cyan-400",
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

export function getArticlesByCategory(categoryName: string): BlogArticle[] {
  return BLOG_ARTICLES.filter((a) => a.category.toLowerCase() === categoryName.toLowerCase());
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
