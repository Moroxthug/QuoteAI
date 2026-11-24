// Article bodies, keyed by slug. Metadata is in ./blog-index.ts (see the
// note there); `BLOG_ARTICLES` below joins the two for the article page and
// the build scripts. Every slug in BLOG_INDEX must have a body here — the
// join throws at module load (i.e. at build time) if one is missing.
import { BLOG_INDEX, type BlogArticleMeta } from "./blog-index.js";

export * from "./blog-index.js";

export interface BlogArticle extends BlogArticleMeta {
  contentHtml: string;
}

const BLOG_CONTENT: Record<string, string> = {
  "how-much-does-it-cost-to-paint-an-apartment-in-canada-2026": `
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
  "bathroom-renovation-cost-toronto-2026": `
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
  "deck-installation-cost-canada-2026": `
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
  "basement-finishing-cost-canada": `
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
  "how-to-write-a-professional-quote-that-wins-jobs": `
<p>A client reading your quote is asking three questions: what exactly am I getting, what will it cost me all-in, and what happens if I say yes. A quote that answers all three on one page, without a phone call, is the one that gets signed.</p>

<h2>The header: who you are, in a way the client can check</h2>
<p>The top of the quote is where a careful client decides whether you are a real business. Put these there, every time:</p>
<ul>
  <li><strong>Legal business name and operating name</strong>, a street address (not only a phone number), phone and email.</li>
  <li><strong>Your GST/HST number once you are registered.</strong> You must register once your taxable sales pass $30,000 in a single calendar quarter or over four consecutive quarters; below that you are a small supplier and registration is optional (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge" rel="noopener">CRA: when to register and start charging the GST/HST</a>). If you are not registered, do not show a tax line at all.</li>
  <li><strong>Licence numbers where your trade or province expects them.</strong> In Québec, the RBQ tells homeowners that a renovation contract should show the contractor's RBQ licence number, Québec enterprise number (NEQ), and GST and QST numbers (<a href="https://www.rbq.gouv.qc.ca/en/vous-etes/citoyen/travaux-de-renovation/signing-a-renovation-contract/" rel="noopener">RBQ: signing a renovation contract</a>). In Ontario, the province tells homeowners hiring an electrical contractor to get a written estimate that includes the ESA/ECRA licence number and ESA permit fees (<a href="https://www.ontario.ca/page/your-rights-when-starting-home-renovations-or-repairs" rel="noopener">Ontario: your rights when starting home renovations or repairs</a>). Clients are being told to look for these numbers, so a quote without them reads as a warning sign.</li>
  <li><strong>Client name, job address, quote number and date.</strong></li>
</ul>

<h2>Scope and exclusions: the part that wins or loses the comparison</h2>
<p>When a client lays your quote next to someone else's, they compare what is written. If yours says "Paint main floor, $3,600" and a competitor's says the same at a lower number, you lose, even if the cheaper one skips primer and trim.</p>
<p>Write scope by area or task, with the method and the product named:</p>
<ul>
  <li><strong>Where:</strong> living room, hallway, two bedrooms; or "ensuite only, tub surround and floor".</li>
  <li><strong>What gets done:</strong> fill, sand, spot-prime, two finish coats. "Two coats" is a commitment the client can see you keep.</li>
  <li><strong>With what:</strong> brand and line, or at least the grade and sheen. "Premium acrylic eggshell" tells the client more than "paint".</li>
  <li><strong>Exclusions, in their own list:</strong> things a client might reasonably assume are included. Moving heavy furniture, repairing plaster beyond small patches, rot behind trim, permit fees, disposal of old fixtures, anything behind a wall you have not opened.</li>
</ul>
<p>The exclusions list is not small print. It is what stops a dispute three weeks in, and it is what turns an unexpected find into a priced change order instead of an argument. Our guide to <a href="/blog/how-to-handle-change-orders-contractors/">handling change orders</a> covers the paperwork for when that happens.</p>

<h2>Labour and materials on separate lines</h2>
<p>Show labour as hours or units times a rate, and materials as quantities times a price. Separate lines let the client see that the number is built from something, and they let you adjust one part (a cheaper paint line, one fewer room) without re-quoting from scratch. For how to build the rate and the markup behind those lines, see <a href="/blog/how-to-price-a-job-labour-materials-markup/">pricing a job: labour, materials and markup</a>.</p>

<h2>Taxes by province</h2>
<p>Show the subtotal, each tax on its own line, then the total. The rate depends on where the work is done: HST provinces charge one combined rate, while British Columbia, Manitoba, Saskatchewan and Québec charge the 5% GST plus a separate provincial tax. Ontario's HST is 13%. Check the current rates on the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA's GST/HST rates page</a> rather than relying on memory, since rates do change (Nova Scotia's HST dropped to 14% on April 1, 2025). The <a href="/tools/sales-tax-calculator/">sales tax calculator</a> does the arithmetic for any province.</p>

<h2>Worked example: interior repaint in Ontario</h2>
<p>Example only: the hours, rate and paint prices below are assumptions for illustration, not market figures. Job: repaint living room, hallway and two bedrooms in an occupied house in Ontario. Walls two coats, ceilings one coat, baseboards and five doors.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Labour: protect floors and furniture, fill holes and cracks, sand, caulk trim</td><td>6</td><td>hr</td><td>$65.00</td><td>$390.00</td></tr>
    <tr><td>Labour: spot-prime patches and stains</td><td>2</td><td>hr</td><td>$65.00</td><td>$130.00</td></tr>
    <tr><td>Labour: walls, two finish coats, 4 areas</td><td>16</td><td>hr</td><td>$65.00</td><td>$1,040.00</td></tr>
    <tr><td>Labour: ceilings, one coat, 3 rooms</td><td>6</td><td>hr</td><td>$65.00</td><td>$390.00</td></tr>
    <tr><td>Labour: baseboards, 5 doors and frames, semi-gloss</td><td>8</td><td>hr</td><td>$65.00</td><td>$520.00</td></tr>
    <tr><td>Wall paint, premium acrylic eggshell</td><td>6</td><td>can (3.78 L)</td><td>$72.00</td><td>$432.00</td></tr>
    <tr><td>Ceiling paint, flat white</td><td>2</td><td>can (3.78 L)</td><td>$55.00</td><td>$110.00</td></tr>
    <tr><td>Trim and door paint, semi-gloss</td><td>1</td><td>can (3.78 L)</td><td>$78.00</td><td>$78.00</td></tr>
    <tr><td>Primer, filler, caulk, tape, plastic</td><td>1</td><td>lot</td><td>$95.00</td><td>$95.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$3,185.00</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$414.05</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$3,599.05</strong></td></tr>
  </tbody>
</table>
<p>Why it is written this way:</p>
<ul>
  <li>Prep gets its own line because it is the work a cheaper quote skips. When a client asks why you are higher, you point at it.</li>
  <li>Walls, ceilings and trim are split because clients often drop one of them to hit a budget, and you can remove a line without redoing the quote.</li>
  <li>Paint is named by grade and sheen, so a competitor using contractor-grade flat is visibly not the same job.</li>
  <li>Below the table: valid 30 days; deposit $350 on signing, balance on completion; excludes plaster repair beyond small patches and moving pianos or built-ins.</li>
</ul>
<p>For trade-specific line items, see <a href="/blog/how-to-quote-a-painting-job/">how to quote a painting job</a>.</p>

<h2>Validity, deposit and payment terms</h2>
<p><strong>Validity.</strong> Put an expiry date on every quote. Material prices and your schedule both move; a client who comes back months later should get a fresh price, and the date makes that a non-conversation. Pick a window you can honour for the materials in the job.</p>
<p><strong>Deposit.</strong> State the amount, when it is due, and what it covers. Ontario recommends to contractors that deposits be no more than 10% of the total project cost (<a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">Ontario: a guide for home renovation and roofing businesses</a>), which is why the example asks for $350 on a $3,599.05 job.</p>
<p><strong>Payment.</strong> List the milestones, the methods you accept, and when the final payment is due. If you have to chase money later, clear terms written into the signed quote are your starting point.</p>

<h2>When the quote becomes a contract</h2>
<p>Once a client signs, the quote is a contract, and provincial consumer law applies to it.</p>
<p><strong>Ontario.</strong> A contract worth more than $50 must be in writing. If an estimate is part of the contract, you cannot charge more than 10% above it unless the client asked for added or different work and signed a change. If the client signs at their home, they have a 10-day cooling-off period to cancel for any reason, and you must refund any deposit within 15 days of their notice. If you started work during that period because they asked you to, you are entitled to reasonable payment for work and materials already provided that cannot be returned. All of this is in the province's <a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">guide for home renovation and roofing businesses</a>.</p>
<p><strong>Québec.</strong> A contractor who sells, installs or repairs doors and windows, thermal insulation, or roofing and exterior wall covering is treated as an itinerant merchant, even when the homeowner invited them. The client can cancel within 10 days of receiving a signed copy of the contract (<a href="https://www.opc.gouv.qc.ca/en/consumer/topic/itinerant-sale/cancelling/doing-business-renovation-contractor" rel="noopener">OPC: doing business with a renovation contractor</a>), and any payment must be refunded within 15 days of their cancellation notice (<a href="https://www.opc.gouv.qc.ca/en/consumer/good-service/housing-renovation/home-renovations/renovation-work/cancelling-contract/in-person-contract" rel="noopener">OPC: cancelling a contract concluded in person</a>).</p>
<p>The practical point: plan your start date and material orders around the cooling-off window for jobs signed at the kitchen table. For the full contract checklist, read <a href="/blog/how-to-write-a-contractor-contract-canada/">how to write a contractor contract in Canada</a>.</p>

<h2>Mistakes that cost signatures</h2>
<ul>
  <li><strong>One lump-sum line.</strong> It gives the client nothing to compare except the total.</li>
  <li><strong>"Materials" with no spec.</strong> Name the product or grade, or the client will assume yours is the same as the cheapest bid.</li>
  <li><strong>No exclusions.</strong> Whatever you did not exclude, the client will believe was included.</li>
  <li><strong>Tax buried in the total.</strong> Or worse, a tax line on a quote from an unregistered business.</li>
  <li><strong>No deposit or payment terms.</strong> Money conversations are easier before the job than during it.</li>
  <li><strong>No expiry date.</strong> You end up honouring an old price on a new materials bill.</li>
  <li><strong>An editable file.</strong> Send a PDF. Word and spreadsheet files look unfinished and can be changed after they leave you.</li>
  <li><strong>No clear next step.</strong> Say how to accept: sign and return, pay the deposit, pick a start date.</li>
</ul>

<h2>Send it quickly, then follow up</h2>
<p>The client's interest is highest right after the walkthrough, while they still remember what you pointed out. The fastest way to keep it is to finish the quote before you leave the driveway: measure and photograph during the visit, keep your standard rates and common line items saved so you never start from a blank page, and check scope, exclusions and totals before sending. Fast never means skipping a section above. quoteai is built for this step: you describe the job, it writes an itemized quote with the province's taxes and sends it as a PDF from your phone.</p>
<p>Then follow up. A short, polite check-in a couple of days later, asking if the client has questions, gives them an easy way to say yes or tell you what is holding them back. Our guide to <a href="/blog/how-to-follow-up-on-quotes-contractors/">following up on quotes</a> has timing and wording you can reuse.</p>
`,
  "how-to-price-a-job-labour-materials-markup": `
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
  "winterizing-your-home-contractor-checklist": `
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
  "basement-waterproofing-guide-canadian-homes": `
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
  "canada-greener-homes-grant-rebates-contractors-guide-2026": `
<p>Every program below was checked on its official page in November 2026; open the linked page again before you put a program name on a quote. The rule does not change: a rebate goes on your quote as a note with the details the program needs, never as a deduction from your price.</p>

<h2>What has closed</h2>
<p>Clients still ask about the Canada Greener Homes Grant. It is closed. The federal government announced on February 5, 2024 that it would stop accepting new applications within two weeks (<a href="https://www.canada.ca/en/natural-resources-canada/news/2024/02/government-of-canada-to-establish-next-phase-of-canada-greener-homes-initiative-to-help-more-canadians-save-on-their-energy-bills.html" rel="noopener">Government of Canada</a>), and December 31, 2025 was the last day for existing participants to submit documents (<a href="https://www.canada.ca/en/environment-climate-change/services/energy-efficiency/home-energy-efficiency/canada-greener-homes-initiative.html" rel="noopener">Canada Greener Homes Initiative</a>).</p>
<ul>
<li><strong>Canada Greener Homes Loan</strong>: closed; funding is fully committed and new applications cannot be approved, though approved loans remain available (<a href="https://www.canada.ca/en/environment-climate-change/services/energy-efficiency/home-energy-efficiency/canada-greener-homes-initiative/canada-greener-homes-loan.html" rel="noopener">Government of Canada</a>). CMHC dates the portal closure to October 2, 2025 (<a href="https://www.cmhc-schl.gc.ca/professionals/project-funding-and-mortgage-financing/funding-programs/all-funding-programs/canada-greener-homes?lang=en" rel="noopener">CMHC</a>).</li>
<li><strong>Oil to Heat Pump Affordability</strong>: closed to new applications on July 31, 2026 for Alberta, Manitoba, the Northwest Territories, Quebec and Saskatchewan. Clients already in the program must upload final receipts and a contractor-signed attestation form by January 31, 2027, with all work completed and paid by then (<a href="https://www.canada.ca/en/environment-climate-change/services/energy-efficiency/home-energy-efficiency/canada-greener-homes-initiative/oil-heat-pump-affordability-program.html" rel="noopener">Government of Canada</a>). If you have one of these jobs on the schedule, that date is your deadline too.</li>
</ul>

<h2>Federal: what is open or coming</h2>
<p><strong>Canada Greener Homes Affordability Program.</strong> This is a no-cost, direct-install program for low- to median-income homeowners and tenants, delivered by provincial partners: BC Hydro or FortisBC in British Columbia, plus Manitoba, Newfoundland and Labrador, Nova Scotia, Prince Edward Island and Quebec. The federal government does not take applications from households (<a href="https://www.canada.ca/en/environment-climate-change/services/energy-efficiency/home-energy-efficiency/canada-greener-homes-initiative/canada-greener-homes-affordability-program.html" rel="noopener">Government of Canada</a>). You don't quote into it; work comes through the delivery organization.</p>
<p><strong>National Heat Pump Rebate.</strong> Announced October 8, 2026: up to $10,000 for households below the median income and $2,000 for other eligible homeowners, one rebate per person, for cold-climate air-source heat pumps on an Eligible Products List. The client applies online for pre-approval, then submits receipts after installation; no energy audit is required (<a href="https://www.canada.ca/en/environment-climate-change/news/2026/10/prime-minister-carney-announces-landmark-investment-to-retrofit-one-million-homes-cutting-energy-costs-and-emissions.html" rel="noopener">Government of Canada</a>). Hydro-Québec reports that this funding begins in 2027 and that details are not yet known (<a href="https://www.hydroquebec.com/residential/energy-wise/financial-assistance/logisvert/residential.html" rel="noopener">Hydro-Québec</a>). Until the portal opens, do not promise it on a quote.</p>

<h2>Ontario: Home Renovation Savings Program</h2>
<p>Delivered jointly by Save on Energy and Enbridge Gas. There are two paths: single upgrades with no assessment, and a bundle that starts with a home energy assessment (rebated at $600) followed by two or more upgrades, with insulation in the bundle worth up to $7,700. Heat pumps must be on NRCan's qualified products list; windows, doors and heat pump water heaters must be ENERGY STAR certified (<a href="https://saveonenergy.ca/homerenovationsavings" rel="noopener">Save on Energy</a>).</p>
<p>For heat pumps, the rebate is per ton of rated heating capacity at 8.3°C: $1,250 per ton up to $7,500 for homes heated with electricity, oil, propane or wood, or $500 per ton up to $2,000 for Enbridge Gas customers heating with gas. A participating HVAC contractor submits the pre-installation and post-installation applications, and installations done before approval are not eligible (<a href="https://www.homerenovationsavings.ca/without-assessment/heat-pumps" rel="noopener">Home Renovation Savings</a>). The full quoting approach for that job is in <a href="/blog/how-to-quote-an-hvac-job/">how to quote an HVAC job</a>.</p>

<h2>British Columbia: CleanBC Better Homes</h2>
<p>For invoices dated on or after October 15, 2026, the Home Renovation Rebate program requires a licensed contractor with a GST number and a B.C. business licence; heat pump and insulation work must be done by a Home Performance Contractor Network member, and self-installs are not eligible. The invoice must itemize equipment and labour separately and show a zero balance owing, and most applications are due within six months of the invoice date. Selected amounts: $4,000 for a whole-home air-source heat pump converting from electric heat, and insulation paid on the R-value added, capped at $900 for attics. A bonus of $20 per percentage point of EnerGuide improvement (minimum $750, maximum $2,000) requires pre- and post-upgrade evaluations by a program-qualified energy advisor and at least three bonus-eligible upgrades (<a href="https://betterhomesbc.ca/learn-about-programs/home-renovation-rebate-program/home-renovation-rebate-program-requirements/" rel="noopener">CleanBC Better Homes</a>).</p>

<h2>Quebec: Rénoclimat and LogisVert</h2>
<p><strong>Rénoclimat</strong> is run by the Quebec government's environment ministry, not Hydro-Québec (<a href="https://www.quebec.ca/habitation-territoire/chauffage-consommation-energie/aide-financiere-renovation-ecoenergetique/renoclimat/a-propos" rel="noopener">Québec.ca</a>). New rules took effect October 1, 2026: the pre-work energy evaluation is no longer mandatory but is recommended (with up to $500 of aid for it), renovations must be done after October 1, 2026, and the work must be done by a contractor holding the RBQ licences for that type of work. The application will need an attestation form completed and signed by the contractor, plus invoices; the online portal is still in development, so clients should keep their documents (<a href="https://www.quebec.ca/habitation-territoire/chauffage-consommation-energie/aide-financiere-renovation-ecoenergetique/renoclimat/nouveautes-adaptation-inondations" rel="noopener">Québec.ca, Rénoclimat changes</a>). Homes evaluated under the old rules have until March 31, 2027 to finish under them (<a href="https://www.quebec.ca/habitation-territoire/chauffage-consommation-energie/aide-financiere-renovation-ecoenergetique/renoclimat/conditions" rel="noopener">Québec.ca, eligibility</a>).</p>
<p><strong>LogisVert</strong> is Hydro-Québec's own program, still open, with heat pump grants of up to $6,700 calculated per 1,000 BTU/h of capacity at -8°C. Its invoice requirements are the most specific of any program here: invoice number and date, installation date, client name and installation address, company name, GST and QST numbers, RBQ licence number, product and work description, AHRI or ENERGY STAR number, and cost. Requests are due within nine months of installation (<a href="https://www.hydroquebec.com/residential/energy-wise/financial-assistance/logisvert/residential.html" rel="noopener">Hydro-Québec</a>).</p>

<h2>What your quote and invoice must carry</h2>
<p>Across these programs, the same details decide whether a client's claim goes through:</p>
<ul>
<li><strong>Model and certification numbers</strong> (AHRI, ENERGY STAR, or the listing on NRCan's qualified products list) for every piece of equipment.</li>
<li><strong>Your registrations</strong>: GST/HST (and QST) numbers, RBQ licence number in Quebec, HPCN membership in B.C., participating-contractor status in Ontario.</li>
<li><strong>Equipment and labour as separate lines</strong>, and for insulation, the area, starting R-value and final R-value.</li>
<li><strong>Dates</strong>: installation date on the invoice, and pre-approval obtained before work where the program requires it.</li>
<li><strong>A paid-in-full invoice</strong>, since B.C. requires a zero balance owing.</li>
</ul>
<p>Tax is charged on your full price. The rebate is paid to the homeowner by the program, so it does not reduce your taxable amount; the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> handles the provincial rates.</p>

<h2>Attic insulation: targets and what qualifies</h2>
<p>Ontario's single-upgrade attic rebate requires reaching R-50, and pays $1,250 when starting at R-12 or less, $1,000 from above R-12 to R-25, and $800 from above R-25 to R-35. The whole roof assembly must be insulated, the client must own the home, and the work must be done by a participating contractor; the program notes that contractor registration for this stream is closed (<a href="https://www.homerenovationsavings.ca/without-assessment/attic" rel="noopener">Home Renovation Savings</a>). If you are not on the list, tell the client before they sign. Quebec recommends attic insulation of R-50 or more and pairing insulation with adequate ventilation to prevent condensation (<a href="https://www.quebec.ca/en/housing-territory/heating-energy-consumption/reducing-energy-consumption-at-home/building-insulation-management/insulation" rel="noopener">Québec.ca</a>).</p>
<p>Two site conditions change the scope. Vermiculite may contain asbestos and must not be disturbed (<a href="https://www.canada.ca/en/employment-social-development/services/health-safety/prevention/vermiculite.html" rel="noopener">Government of Canada</a>), so exclude it from your quote until it is dealt with. In B.C., pest infestations in the insulation area must be resolved or the application will not be processed (<a href="https://betterhomesbc.ca/learn-about-programs/home-renovation-rebate-program/home-renovation-rebate-program-requirements/" rel="noopener">CleanBC Better Homes</a>).</p>

<h2>Worked example: attic insulation quote, Ontario</h2>
<p>Example: a 1,200 sq ft attic in a gas-heated detached house, measured at roughly R-12 of old fibreglass, brought to R-50 by a participating contractor. Prices are assumptions for illustration. Ontario HST is 13% (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA</a>).</p>
<table>
<thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr></thead>
<tbody>
<tr><td>Pre-work inspection: measure existing depth and R-value, dated photos</td><td>1</td><td>job</td><td>$150.00</td><td>$150.00</td></tr>
<tr><td>Air sealing: top plates, plumbing stack, wiring and fixture penetrations</td><td>1</td><td>job</td><td>$650.00</td><td>$650.00</td></tr>
<tr><td>Rafter baffles at soffits to keep ventilation open</td><td>40</td><td>ea</td><td>$9.00</td><td>$360.00</td></tr>
<tr><td>Attic hatch: insulation dam, weatherstripping, rigid insulation on hatch</td><td>1</td><td>ea</td><td>$180.00</td><td>$180.00</td></tr>
<tr><td>Blown fibreglass loose-fill added to reach R-50, full attic area</td><td>1,200</td><td>sq ft</td><td>$1.85</td><td>$2,220.00</td></tr>
<tr><td>Depth markers and attic insulation certificate card</td><td>1</td><td>set</td><td>$40.00</td><td>$40.00</td></tr>
<tr><td>Cleanup and post-install photos for the rebate file</td><td>1</td><td>job</td><td>$100.00</td><td>$100.00</td></tr>
<tr><td colspan="4"><strong>Subtotal</strong></td><td><strong>$3,700.00</strong></td></tr>
<tr><td colspan="4">HST (13%)</td><td>$481.00</td></tr>
<tr><td colspan="4"><strong>Total</strong></td><td><strong>$4,181.00</strong></td></tr>
</tbody>
</table>
<p><strong>Note on the quote:</strong> "Starting R-value measured at R-12; final R-value R-50 over 100% of the attic area. You may qualify for the Home Renovation Savings attic rebate (up to $1,250 at this starting level). We will submit the application as a participating contractor. The rebate is paid to you by the program and is not deducted above. Excludes vermiculite and any mould or moisture repair."</p>
<ul>
<li>Starting and final R-values appear twice, in the line items and the note, because they set the rebate tier.</li>
<li>Air sealing and baffles are separate lines so the client sees why this quote is higher than a blow-in-only price.</li>
<li>Dated before-and-after photos are priced as work because they are the evidence if the program asks.</li>
</ul>
<p>quoteai writes an itemized quote like this with Ontario HST applied and sends it as a PDF, keeping the rebate as a note. For the wider structure of a winning quote, see <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a>, and for heat pump jobs, <a href="/quotes/hvac-technician/">HVAC quote templates</a>.</p>
`,
  "google-business-profile-guide-for-tradespeople": `
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
  "how-to-get-more-reviews-as-a-contractor": `
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
  "free-quote-template-for-contractors-canada": `
<p>If you search for a "free quote template" you'll find hundreds of generic US documents with no mention of GST, HST or QST. A Canadian contractor quote has to do more: show the right tax for your province, protect you on scope, and be clear enough that the client can say yes without calling you three times. Here is the structure that works, section by section.</p>

<h2>What every contractor quote should include</h2>
<ul>
  <li><strong>Your business details</strong>: legal or trade name, phone, email, address, and your GST/HST number (plus QST number if you operate in Quebec). Once you are registered, tax numbers on documents are expected.</li>
  <li><strong>Client details and job address</strong>: the billing party and the site, which are often different.</li>
  <li><strong>Quote number and date</strong>: so you and the client can both refer to it later.</li>
  <li><strong>Scope of work</strong>: what is included and, just as important, what is not.</li>
  <li><strong>Line items</strong>: labour, materials, equipment, subcontractors, permits, disposal.</li>
  <li><strong>Taxes</strong>: shown as a separate line, not buried in the price.</li>
  <li><strong>Payment terms</strong>: deposit, progress payments, balance due.</li>
  <li><strong>Validity period</strong>: how long the price holds (30 days is common; shorten it when material prices are moving).</li>
  <li><strong>Acceptance</strong>: a signature or electronic acceptance line.</li>
</ul>

<h2>Getting Canadian taxes right</h2>
<p>Tax depends on where the work is performed. In general: Alberta, Saskatchewan (GST plus PST rules), Manitoba and BC have different structures from the HST provinces, and Quebec charges GST plus QST. A few examples of the combined rates in force at the time of writing:</p>
<ul>
  <li><strong>Ontario</strong>: 13% HST</li>
  <li><strong>Quebec</strong>: 5% GST + 9.975% QST</li>
  <li><strong>Alberta</strong>: 5% GST only</li>
  <li><strong>BC</strong>: 5% GST, with PST applying to some goods</li>
  <li><strong>Atlantic provinces</strong>: 15% HST</li>
</ul>
<p>Rates and rules change, so confirm with the Canada Revenue Agency or Revenu Québec, or your accountant, before you fix a template. The point is that a template with one hard-coded tax rate will be wrong the moment you work across a provincial border.</p>

<h2>Scope of work: where most disputes start</h2>
<p>Most quote disputes are not about price, they are about what the price covered. Write the scope as a short list of outcomes ("Supply and install 3 interior doors, including trim and paint-ready finish") and add an explicit exclusions list ("Drywall repair, painting and electrical are not included"). One extra sentence on how changes are handled ("Work outside this scope will be quoted separately and approved before it starts") saves many arguments.</p>

<h2>Deposits and payment schedule</h2>
<p>For anything beyond a small repair, ask for a deposit before ordering materials or booking your crew. Common patterns are 10–30% on acceptance, a progress payment at a milestone, and the balance on completion. Whatever you choose, put it on the quote in plain numbers, not a vague "deposit required". Check provincial consumer protection rules, because some provinces cap deposits on home renovation contracts.</p>

<h2>Where a static template falls short</h2>
<p>A Word or Excel template looks free, but you pay for it in time: retyping client details, recalculating taxes, fixing formatting, exporting to PDF, then chasing the client. Mistakes creep in, and the quote reaches the client hours or days after the visit, when other contractors may have already replied.</p>
<p>That is the gap <a href="/pricing/">quoteai's free quoting</a> is built for: you describe the job, it builds the itemized quote with the right Canadian taxes, and you send a professional PDF from your phone. If you are comparing approaches, see <a href="/compare/">how quoteai compares with other quoting software</a>, or read the full guide on <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a>.</p>
`,
  "how-to-get-more-plumbing-jobs-canada": `
<p>Plumbing is a trade where demand is steady but competition for the good jobs is real. Emergency calls go to whoever picks up first, and renovation work goes to whoever looks most credible and replies fastest. These nine steps do not need a big marketing budget.</p>

<h2>1. Own your Google Business Profile</h2>
<p>For "plumber near me" searches, your profile is often more important than your website. Pick the right categories, list specific services (drain cleaning, water heater replacement, rough-in plumbing), and add job photos regularly. Our <a href="/blog/google-business-profile-guide-for-tradespeople/">Google Business Profile guide</a> walks through it.</p>

<h2>2. Answer fast, every time</h2>
<p>Homeowners usually contact two or three plumbers and hire whoever replies first with a clear next step. A missed call that goes to voicemail is often a lost job. Use a missed-call text-back or a short voicemail that promises a callback time.</p>

<h2>3. Send quotes the same day</h2>
<p>A quote that arrives a week later competes against someone who sent theirs from the driveway. Itemized, PDF-ready estimates built with <a href="/quotes/plumber/">quoting software for plumbers</a> let you send it before you start the truck.</p>

<h2>4. Collect reviews on purpose</h2>
<p>Reviews influence both trust and local ranking. Ask at completion, send the direct link by text, and reply to every review. See <a href="/blog/how-to-get-more-reviews-as-a-contractor/">how to get more reviews</a>.</p>

<h2>5. Build a page for each service and city</h2>
<p>One page that says "plumbing services" ranks for little. A page for "water heater replacement in [your city]" with real prices, photos and a clear call to action ranks for what customers actually type.</p>

<h2>6. Offer fixed-price options on common jobs</h2>
<p>Customers fear open-ended hourly billing. Fixed prices on repeat jobs (faucet replacement, toilet install, drain clearing) reduce friction and make quoting nearly instant.</p>

<h2>7. Partner with trades that refer you</h2>
<p>Property managers, realtors, general contractors, electricians and HVAC companies all meet plumbing needs. A short, reliable relationship with two or three of them can fill your calendar.</p>

<h2>8. Follow up on every quote</h2>
<p>Many quotes are lost not because of price, but silence. A friendly follow-up after two or three days, and again at a week, recovers jobs most plumbers never knew they were still in.</p>

<h2>9. Turn one-time clients into maintenance clients</h2>
<p>Water heater flushes, annual inspections and backflow checks create recurring revenue and make you the first call when something breaks.</p>

<h2>Where to start</h2>
<p>If you only do two things this week, fix your Google profile and shorten the time between site visit and quote. Both cost almost nothing and compound. For help with the second, see <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a>.</p>
`,
  "how-to-get-more-electrical-jobs-canada": `
<p>Electrical work has strong demand: panel upgrades, EV charger installs, renovations, and service calls. The electricians who grow fastest are rarely the cheapest. They are the ones who look reliable, respond quickly and explain the price clearly.</p>

<h2>Start with the jobs customers are searching for</h2>
<p>Right now, high-intent searches in Canada include panel upgrades, EV charger installation, knob-and-tube replacement, and pot light installs. Build a service page for each, with a typical price range, what is included, and how long it takes. Pages that answer the price question tend to earn the click.</p>

<h2>Be visible in your service area</h2>
<ul>
  <li>Complete your Google Business Profile with accurate categories and your real service area. See our <a href="/blog/google-business-profile-guide-for-tradespeople/">guide for tradespeople</a>.</li>
  <li>Post job photos (clean panels, tidy runs) monthly.</li>
  <li>Keep your name, address and phone consistent everywhere you are listed.</li>
</ul>

<h2>Show your credentials</h2>
<p>Licence, insurance and WSIB or provincial coverage are real decision factors for electrical work. Mention them on your site and on every quote. Homeowners fear unlicensed work, so being clearly licensed is a selling point.</p>

<h2>Quote like a professional</h2>
<p>A vague "$3,500 panel upgrade" invites price comparison. A quote that lists panel size, breakers, permit and ESA or inspection fees, utility coordination and what happens to drywall patching communicates competence. For a deeper look at pricing a big job, read the <a href="/blog/how-to-quote-an-electrical-job/">cost to rewire a house in Canada</a>. Electricians using <a href="/quotes/electrician/">quoting software built for the trade</a> can send this level of detail the same day.</p>

<h2>Offer packages, not just hourly rates</h2>
<p>Bundles such as "EV charger install, supplied and installed" or "Panel upgrade with permit" are simpler to buy, simpler to compare, and easier for you to price consistently.</p>

<h2>Build referral partnerships</h2>
<p>General contractors, HVAC companies, home inspectors and realtors regularly need an electrician they can trust. Be the one who shows up, communicates and finishes cleanly.</p>

<h2>Follow up</h2>
<p>If a quote has not been answered in three days, follow up. Many customers need a reminder, not a discount.</p>
`,
  "how-to-collect-payment-from-clients-contractor-canada": `
<p>Doing the work is only half the job. Waiting 45 days for the last 30% of a project drains cash and wastes your evenings. Most late payment is preventable with better terms set before the job starts.</p>

<h2>Set payment terms in the quote</h2>
<p>Put the deposit, the schedule and the due date on the quote, so the client agrees to them when they accept. A line such as "20% deposit on acceptance, 40% at rough-in completion, 40% on completion; invoices due on receipt" removes ambiguity.</p>

<h2>Always take a deposit</h2>
<p>A deposit covers materials, books your crew and shows commitment. For small repairs it can be modest. For custom or special-order work it should cover the order. Check your province's rules on deposits for home renovation contracts.</p>

<h2>Bill in stages on larger jobs</h2>
<p>Progress billing ties payments to visible milestones (demolition done, rough-in inspected, drywall complete). It keeps your cash flow healthy and gives the client a clear sense of progress.</p>

<h2>Send the invoice the same day</h2>
<p>Invoices sent late get paid late. Send the invoice at the moment the work is accepted, with the amount, taxes, due date and ways to pay. Make paying easy: e-transfer, card or bank payment with a link they can tap.</p>

<h2>Follow up politely and on schedule</h2>
<ul>
  <li><strong>Day before due</strong>: a friendly reminder.</li>
  <li><strong>Day after due</strong>: a short text or email with the invoice attached.</li>
  <li><strong>Seven days late</strong>: a call.</li>
  <li><strong>Beyond that</strong>: a written notice, then your formal options.</li>
</ul>

<h2>Know your lien rights</h2>
<p>Construction lien rules differ by province, with strict deadlines that vary (for example Ontario's Construction Act and Quebec's legal hypothec regime). If a client stops paying, check your province's deadlines quickly and consider legal advice, because missing the window can cost you the right.</p>

<h2>Make it routine</h2>
<p>Contractors who get paid on time do the same steps every time. Tools such as <a href="/quotes/general-contractor/">quoting and invoicing software built for contractors</a> keep the quote, the invoice and the follow-up in one place, so nothing relies on memory. If you are starting from scratch, see <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a> with payment terms included.</p>
`,
  "contractor-insurance-canada-what-you-need": `
<p>This is general information, not insurance or legal advice. Requirements differ by province, trade and client, so confirm details with a licensed broker. But every Canadian contractor should understand the main types of coverage, because clients, general contractors and property managers increasingly ask for proof of insurance before you start.</p>

<h2>Commercial general liability (CGL)</h2>
<p>CGL covers third-party injury and property damage caused by your work, such as a water leak damaging a client's floor. Many clients and general contractors require limits of $2 million, and commonly ask to be named as an additional insured. It is the baseline policy for most trades.</p>

<h2>Tools and equipment coverage</h2>
<p>Tools are expensive and are a frequent theft target. Standard CGL does not cover them. Tools and equipment coverage handles theft, damage and loss, including from vehicles and job sites.</p>

<h2>Commercial vehicle insurance</h2>
<p>Using a personal auto policy for business driving can create a denied claim. If you drive to job sites with tools and materials, ask your broker whether you need commercial coverage.</p>

<h2>Workers' compensation (WSIB, WorkSafeBC, CNESST and others)</h2>
<p>Provincial workers' compensation boards cover workplace injuries, and in many provinces it is mandatory for construction firms with employees, and sometimes for subcontractors. Penalties and unexpected assessments for being unregistered can be steep. Check your provincial board.</p>

<h2>Professional liability / errors and omissions</h2>
<p>If you design, inspect or advise, such as building consultants and some renovation firms, professional liability covers claims that your advice or design caused a loss.</p>

<h2>Builder's risk, surety bonds and others</h2>
<p>Larger projects may require builder's risk, performance bonds or bid bonds. Ask early when bidding on commercial or public work.</p>

<h2>Show proof on your quotes</h2>
<p>Including "Fully insured and licensed" along with your licence number and insurer on a quote reassures homeowners and speeds up approval on commercial jobs. It also helps justify a price above the cheapest bid. See <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a> for where credentials fit.</p>

<h2>Budget it as overhead</h2>
<p>Insurance, vehicle costs and tools are part of your overhead and must be recovered in your pricing. If you are unsure how, read <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a>.</p>
`,
  "kitchen-renovation-cost-canada-2026": `
<p>The kitchen is the most requested and most misquoted renovation in Canada. Homeowners often set a budget from a TV show, then meet reality at the first quote. These are typical 2026 ranges. Your market, the size of the room and the finishes will move them.</p>

<h2>Typical total cost by level</h2>
<ul>
  <li><strong>Refresh</strong> (paint, new hardware, backsplash, faucet, some appliances): about $5,000–$15,000</li>
  <li><strong>Mid-range remodel</strong> (new cabinets and counters, same layout): about $25,000–$60,000</li>
  <li><strong>High-end or layout change</strong> (custom cabinets, stone counters, moved plumbing and gas): about $60,000–$120,000+</li>
</ul>

<h2>Where the money goes</h2>
<ul>
  <li><strong>Cabinets</strong>: 25–35% of the total. Stock, semi-custom and custom prices differ by several times.</li>
  <li><strong>Labour and installation</strong>: 20–35%</li>
  <li><strong>Countertops</strong>: laminate is cheapest, quartz and granite sit mid to high, and natural stone costs most. Installed prices of roughly $50–$200+ per square foot are common.</li>
  <li><strong>Appliances</strong>: from a few thousand to well over $15,000 for a premium package</li>
  <li><strong>Flooring, lighting and backsplash</strong>: often forgotten at the first budget</li>
  <li><strong>Plumbing and electrical</strong>: code updates, new circuits and venting add up, especially in older homes</li>
</ul>

<h2>What makes a kitchen budget blow up</h2>
<h3>Moving things</h3>
<p>Keeping the sink, stove and fridge in place saves a lot. Relocating plumbing, gas lines or ductwork adds labour, permits and drywall and floor repairs.</p>
<h3>Surprises behind the walls</h3>
<p>Old wiring, asbestos-containing materials in older homes, out-of-level floors and hidden water damage are common. A contingency of 10–15% is realistic.</p>
<h3>Lead times</h3>
<p>Custom cabinets and special-order appliances can take many weeks. Delays mean extended time without a kitchen, a cost clients rarely plan for.</p>

<h2>How contractors should quote a kitchen</h2>
<p>Split the quote into demolition, structural, plumbing, electrical, cabinets supply and install, counters, backsplash, flooring, painting, permits and disposal. State what the client supplies, which allowances apply to finishes they have not yet chosen, and how change orders work. Renovators using <a href="/quotes/renovation-contractor/">quoting software for renovation contractors</a> can assemble this list from a site visit in minutes, and cabinetmakers can do the same with <a href="/quotes/carpenter-cabinetmaker/">tools built for carpentry</a>. For other big-ticket jobs, see the <a href="/blog/basement-finishing-cost-canada/">cost to finish a basement</a>.</p>
`,
  "fence-installation-cost-canada-2026": `
<p>Fences look simple, but the quote depends on material, length, terrain and our climate. Frost heave is the main reason a cheap install fails in Canada. Here are typical 2026 installed ranges.</p>

<h2>Cost per linear foot, installed</h2>
<ul>
  <li><strong>Chain link</strong>: about $20–$45</li>
  <li><strong>Pressure-treated wood</strong> (privacy, 6 ft): about $35–$70</li>
  <li><strong>Cedar</strong>: about $50–$100</li>
  <li><strong>Vinyl</strong>: about $45–$90</li>
  <li><strong>Aluminum or wrought-iron style</strong>: about $50–$120</li>
</ul>
<p>A typical 150 linear foot backyard in pressure-treated wood often lands between $5,000 and $10,000 including a gate.</p>

<h2>Gates</h2>
<p>A walk gate usually adds $300–$900 depending on material and hardware. Wide drive gates and automated gates cost significantly more.</p>

<h2>What changes the price</h2>
<ul>
  <li><strong>Frost depth</strong>: posts must go below the frost line in most of Canada, often 4 feet or more, which means deeper holes and more concrete.</li>
  <li><strong>Terrain and soil</strong>: slopes, rock and roots slow down digging.</li>
  <li><strong>Removal of an old fence</strong>: often $5–$15 per linear foot extra.</li>
  <li><strong>Access</strong>: tight backyards without equipment access mean hand work.</li>
  <li><strong>Permits and property lines</strong>: many municipalities set maximum heights and require permits or a survey. Confirm before quoting.</li>
</ul>

<h2>Quoting a fence job</h2>
<p>State total footage, height, material and grade, post size and depth, number and type of gates, removal, and a warranty. Note the client is responsible for confirming property lines and locating utilities (call before you dig). Landscapers using <a href="/quotes/landscaper/">quoting software for landscapers</a> can measure on site and send the quote within the hour. For help with price structure, see <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a>.</p>
`,
  "flooring-installation-cost-canada-2026": `
<p>Flooring prices vary widely because the material and the prep are separate costs. Here are typical 2026 installed ranges, then the extras that move a quote.</p>

<h2>Installed cost per square foot</h2>
<ul>
  <li><strong>Laminate</strong>: about $3–$8</li>
  <li><strong>Vinyl plank (luxury vinyl)</strong>: about $4–$10</li>
  <li><strong>Engineered hardwood</strong>: about $8–$18</li>
  <li><strong>Solid hardwood</strong>: about $10–$25</li>
  <li><strong>Porcelain or ceramic tile</strong>: about $10–$25, more for large formats or patterns</li>
  <li><strong>Carpet</strong>: about $3–$8</li>
</ul>
<p>A 1,000 square foot main floor with mid-range engineered hardwood often lands around $10,000–$18,000 once removal, underlay and trim are included.</p>

<h2>Extras that change the total</h2>
<ul>
  <li><strong>Old flooring removal and disposal</strong>: about $1–$3 per square foot</li>
  <li><strong>Subfloor repair and levelling</strong>: can be minor, or several thousand dollars on uneven floors</li>
  <li><strong>Baseboards and transitions</strong>: often forgotten</li>
  <li><strong>Stairs</strong>: priced per step, usually far higher than flat floor</li>
  <li><strong>Furniture moving</strong>: sometimes included, sometimes extra</li>
</ul>

<h2>Moisture and basements</h2>
<p>Below-grade floors need moisture-aware choices (vinyl plank or engineered products rated for it, with a proper vapour barrier). Tell clients when a moisture issue should be solved first. See <a href="/blog/basement-waterproofing-guide-canadian-homes/">our basement waterproofing guide</a>.</p>

<h2>Acclimation and timing</h2>
<p>Hardwood needs time to acclimate to the home's humidity, especially in our dry winters. Build that into the schedule you quote.</p>

<h2>Quoting flooring jobs</h2>
<p>Measure each room, add a waste factor (usually 5–10%, more for diagonal or patterned layouts), and list material, labour, underlay, removal, trim and levelling as separate lines. Installers using <a href="/quotes/flooring-installer/">quoting software for flooring installers</a> can do the square-footage maths and taxes automatically.</p>
`,
  "how-to-write-a-contractor-contract-canada": `
<p>This is general information, not legal advice. Contract rules differ by province, and home renovation contracts are regulated in some provinces, so ask a lawyer to review your template. Still, most disputes come from the same handful of missing clauses.</p>

<h2>Quote or contract?</h2>
<p>A quote is a price offer. Once accepted it can function as a contract, but a written contract adds the detail that protects both sides. Small jobs may only need a clear, signed quote; larger renovation jobs deserve a full contract.</p>

<h2>Clauses to include</h2>
<ul>
  <li><strong>Parties and site</strong>: legal names, addresses, the property.</li>
  <li><strong>Scope of work</strong>: detailed, with exclusions.</li>
  <li><strong>Price and taxes</strong>: total, GST/HST/QST, and what is fixed vs allowance.</li>
  <li><strong>Payment schedule</strong>: deposit, milestones, due dates and late-payment interest. See <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">how to get paid on time</a>.</li>
  <li><strong>Start and completion dates</strong>: with allowance for weather and material delays.</li>
  <li><strong>Change orders</strong>: no extra work without written approval and price.</li>
  <li><strong>Permits and inspections</strong>: who obtains and pays.</li>
  <li><strong>Insurance and licensing</strong>: see our <a href="/blog/contractor-insurance-canada-what-you-need/">insurance guide</a>.</li>
  <li><strong>Warranty</strong>: duration and what is not covered.</li>
  <li><strong>Cancellation</strong>: some provinces give consumers cooling-off rights for home contracts, so check yours.</li>
  <li><strong>Dispute resolution</strong>: a process before court, such as mediation.</li>
  <li><strong>Site access, cleanup, and hidden conditions</strong>: who is responsible for what.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
  <li>Verbal agreements on extras</li>
  <li>Fixed price with no clause for hidden conditions</li>
  <li>No end date or no consequences for delays</li>
  <li>No signature, or a signature from only one spouse or owner</li>
</ul>

<h2>Make it part of your process</h2>
<p>A quote that includes terms and an electronic acceptance, produced with <a href="/quotes/general-contractor/">quoting software for general contractors</a>, gives you a consistent, signed record every time. For the quote itself, read <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a>.</p>
`,
  "how-to-handle-change-orders-contractors": `
<p>Scope creep is one of the biggest quiet profit killers in contracting. "Can you just also..." turns into two days of unpaid work. A change order process fixes it without making you sound difficult.</p>

<h2>What is a change order?</h2>
<p>A change order is a short written agreement that changes the scope, price or schedule of an accepted job. It records what changed, what it costs and how it affects the end date.</p>

<h2>Why extras go unpaid</h2>
<ul>
  <li>The request was verbal and memories differ later.</li>
  <li>You did not want to bring up money in the moment.</li>
  <li>The original scope was vague, so nobody agrees what counts as extra.</li>
  <li>The price was only calculated at the end.</li>
</ul>

<h2>A simple process</h2>
<ol>
  <li><strong>Pause</strong>: "Happy to do that, let me send you a quick price."</li>
  <li><strong>Price it</strong>: labour, materials, markup and any schedule impact.</li>
  <li><strong>Send it in writing</strong>: text, email or PDF with a clear description and total including tax.</li>
  <li><strong>Get approval</strong>: a reply, signature or electronic acceptance.</li>
  <li><strong>Do the work, then invoice it</strong>: as its own line or on the next progress invoice.</li>
</ol>

<h2>Sample wording</h2>
<p><em>"Change order #2: Add two pot lights in the hallway, including drywall patching and paint touch-up. Additional cost: $640 plus tax. Adds one day to the schedule. Approved by: ______ Date: ______"</em></p>

<h2>Price extras properly</h2>
<p>Extras are often interrupted work with setup time, so apply at least the same markup as the original job, and often more. For the arithmetic, see <a href="/tools/markup-margin-calculator/">markup vs margin</a> and <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a>.</p>

<h2>Put the rule in your contract and quote</h2>
<p>One sentence handles most arguments: "Work outside the scope described will be quoted separately and approved in writing before it begins." Painters, renovators and electricians can generate change quotes in seconds using <a href="/quotes/painter/">quoting software for painters</a> and similar tools, then keep everything in one history. See also <a href="/blog/how-to-write-a-contractor-contract-canada/">how to write a contractor contract</a>.</p>
`,
  "how-to-hire-and-pay-subcontractors-canada": `
<p>This is general information, not legal or tax advice. Rules on employment status, workers' compensation and holdbacks vary by province, so confirm with your accountant and your provincial board. Here are the practical basics for contractors who bring in other trades.</p>

<h2>Subcontractor or employee?</h2>
<p>The Canada Revenue Agency looks at the real working relationship: who controls how and when the work is done, who supplies tools, whether the person can hire helpers, and whether they take financial risk. Calling someone a subcontractor does not make them one. Misclassification can lead to back payroll deductions, EI and CPP assessments and penalties.</p>

<h2>Before you hire</h2>
<ul>
  <li><strong>Proof of liability insurance</strong>: ask for a certificate and be named as additional insured where possible.</li>
  <li><strong>Workers' compensation clearance</strong>: in many provinces you can be liable if a sub is not registered. Ask for a clearance certificate.</li>
  <li><strong>Licences and certifications</strong>: especially for electrical, gas and plumbing work.</li>
  <li><strong>GST/HST registration</strong>: so you can claim input tax credits where eligible.</li>
  <li><strong>References and past work</strong>: call two previous customers.</li>
</ul>

<h2>Put it in writing</h2>
<p>A subcontract should cover scope, price, schedule, payment terms, change orders, insurance, warranty on their work and how defects are fixed. It does not need to be long, but it must exist. Use the same change-order discipline you use with clients: <a href="/blog/how-to-handle-change-orders-contractors/">our change order guide</a> explains how.</p>

<h2>Paying subs</h2>
<ul>
  <li>Pay on the agreed schedule. Reliable payment is how you keep good subs.</li>
  <li>Check holdback rules in your province, since some require withholding a percentage until completion.</li>
  <li>Track payments by job so you know your true margin.</li>
  <li>Issue year-end slips where required, such as T5018 for construction subcontractor payments in many cases.</li>
</ul>

<h2>Price subs into your quote</h2>
<p>Sub costs should carry markup for coordination, risk and your warranty on the whole job. Include them as clear line items in the quote, which quoting software for <a href="/quotes/general-contractor/">general contractors</a> handles together with materials and labour. See also <a href="/tools/markup-margin-calculator/">markup vs margin</a>.</p>
`,
  "how-to-scale-a-contracting-business-canada": `
<p>Many contractors reach a ceiling: more work than they can do alone, but hiring feels risky. Scaling is not about working more hours. It is about building a business that makes money when you are not holding the tool. Here is a realistic path.</p>

<h2>1. Fix your pricing first</h2>
<p>Growing an unprofitable business just creates a larger unprofitable business. Know your true hourly cost including overhead, apply a margin, and stop underpricing. See <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a> and <a href="/tools/markup-margin-calculator/">markup vs margin</a>.</p>

<h2>2. Systemize the office work</h2>
<p>If you are the only one who can quote, invoice, schedule and chase payments, you cannot step away. Standardize:</p>
<ul>
  <li>A repeatable quoting process (see <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">sending quotes in 5 minutes</a>)</li>
  <li>Invoice and deposit rules</li>
  <li>Job checklists and photo requirements</li>
  <li>A single place for client and job information</li>
</ul>

<h2>3. Hire for the constraint</h2>
<p>Hire where you are the bottleneck. For many, the first hire is a helper or apprentice who frees up your billable hours. Next may be a lead hand, then admin help. Understand payroll, source deductions, WSIB or provincial coverage before you start. If you use subs, read <a href="/blog/how-to-hire-and-pay-subcontractors-canada/">hiring subcontractors</a>.</p>

<h2>4. Protect cash flow</h2>
<p>Growth eats cash: more materials, more payroll, slower receivables. Take deposits, bill in stages and invoice fast. See <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">how to get paid on time</a>.</p>

<h2>5. Create lead flow you control</h2>
<p>Referrals are great but unpredictable. Add a Google Business Profile, reviews, and service pages. See the <a href="/blog/google-business-profile-guide-for-tradespeople/">Google profile guide</a> and <a href="/blog/how-to-get-more-reviews-as-a-contractor/">review guide</a>.</p>

<h2>6. Choose your jobs</h2>
<p>Not every job is worth taking. Track margin by job type and say no (or price higher) to low-margin, high-stress work. Specialize where you win.</p>

<h2>7. Manage risk</h2>
<p>Bigger crews mean bigger exposure. Keep contracts, insurance and change orders tight: <a href="/blog/how-to-write-a-contractor-contract-canada/">contract checklist</a>, <a href="/blog/contractor-insurance-canada-what-you-need/">insurance guide</a>.</p>

<h2>Tools that scale with you</h2>
<p>The right software keeps quotes, jobs, crew and invoices in one place so growth does not mean more paperwork. See quoteai for <a href="/quotes/general-contractor/">general contractors</a>.</p>
`,
  "how-to-track-job-costs-contractors": `
<p>Many contractors know their bank balance but not which jobs made money. Job costing means comparing what you quoted to what you actually spent. It is the fastest way to improve your next quote.</p>

<h2>What to track on every job</h2>
<ul>
  <li><strong>Labour hours</strong> by person (including your own)</li>
  <li><strong>Materials</strong> with receipts, returns and waste</li>
  <li><strong>Subcontractor costs</strong></li>
  <li><strong>Equipment and rentals</strong></li>
  <li><strong>Travel, disposal and permits</strong></li>
  <li><strong>Change orders</strong> and approved extras (see <a href="/blog/how-to-handle-change-orders-contractors/">our guide</a>)</li>
</ul>

<h2>Estimate vs actual</h2>
<p>For each job, put the quoted number next to the actual cost in the same categories. The difference is where you learn. If painting prep always runs 30% over, your quote is wrong, not your crew.</p>

<h2>Allocate overhead honestly</h2>
<p>Insurance, vehicles, software, admin and your own unpaid time belong in the cost of doing business. Spread them across jobs as a percentage or hourly rate so a "profitable" job is actually profitable.</p>

<h2>Simple tracking system</h2>
<ol>
  <li>Create a job file or folder for every accepted quote.</li>
  <li>Log hours daily on a phone, not on Friday from memory.</li>
  <li>Photograph receipts on the spot and tag them to the job.</li>
  <li>Review each job at completion: quoted vs actual, margin and notes.</li>
</ol>

<h2>Warning signs</h2>
<ul>
  <li>Materials cost creeping above your estimate</li>
  <li>Labour hours consistently exceeding the plan</li>
  <li>Many unbilled extras</li>
  <li>Jobs that finish late and tie up crews</li>
</ul>

<h2>Use the results</h2>
<p>Update your price list and markup using real data. See <a href="/tools/markup-margin-calculator/">markup vs margin</a>. Software that links the quote to the job and invoice, like quoteai for <a href="/quotes/general-contractor/">general contractors</a>, makes the comparison automatic instead of a weekend project.</p>
`,
  "reduce-material-costs-contractors-canada": `
<p>Materials commonly make up a third to half of a job's cost, and their prices move. Small improvements here go straight to profit. These ten habits help without compromising the finished work.</p>

<h2>1. Open contractor accounts</h2>
<p>Most lumber yards, electrical, plumbing and paint suppliers offer contractor pricing, sometimes with volume rebates and net terms. Ask what the tiers are.</p>

<h2>2. Compare at least two suppliers on big orders</h2>
<p>Loyalty is fine, blind loyalty is expensive. For a large order, a ten-minute call can save hundreds.</p>

<h2>3. Do accurate takeoffs</h2>
<p>Over-ordering wastes money, under-ordering wastes time and delivery fees. Measure carefully and add a sensible waste factor, usually 5–10%.</p>

<h2>4. Control waste on site</h2>
<p>Plan cuts, store materials dry and protected, and track leftovers for the next job.</p>

<h2>5. Buy ahead when prices are rising</h2>
<p>For long jobs, buy key materials early if storage and cash flow allow, or ask your supplier to hold pricing.</p>

<h2>6. Add price-validity and escalation language to quotes</h2>
<p>When prices are volatile, shorten the quote validity and add a clause that significant supplier increases may be passed on with notice. See <a href="/blog/how-to-write-a-contractor-contract-canada/">contract clauses</a>.</p>

<h2>7. Mark up materials properly</h2>
<p>Handling, delivery, returns and price risk are real costs. See <a href="/blog/how-to-price-a-job-labour-materials-markup/">pricing labour, materials and markup</a>.</p>

<h2>8. Reduce returns and trips</h2>
<p>Prepare a materials list the night before and confirm availability. Fewer trips mean more billable hours.</p>

<h2>9. Offer client-supplied options carefully</h2>
<p>Clients sometimes want to buy their own fixtures. State that you do not warranty client-supplied materials and may charge a handling fee.</p>

<h2>10. Review actuals</h2>
<p>Track estimated vs actual material costs per job to correct your price list. See <a href="/blog/how-to-track-job-costs-contractors/">job cost tracking</a>.</p>

<h2>Keep your price list current</h2>
<p>Outdated unit prices quietly erode margin. Tools like <a href="/pricing/">quoteai</a> let you update your rates once and have every new quote use them.</p>
`,
  "construction-project-management-small-contractors": `
<p>Big construction firms have project managers and expensive software. Small contractors have a phone and a truck. You do not need enterprise tools, but you do need a simple system, because most delays and disputes come from missing information, not bad work.</p>

<h2>1. A clear plan before day one</h2>
<ul>
  <li>Scope and exclusions agreed in writing</li>
  <li>Start date, milestones and target finish</li>
  <li>Materials ordered with lead times confirmed</li>
  <li>Permits and inspections booked</li>
</ul>

<h2>2. Schedule the crew and trades</h2>
<p>Overlapping trades are the top cause of idle time. Sequence work so the next trade arrives when the last one finishes, and confirm the day before by text.</p>

<h2>3. Keep a daily log</h2>
<p>Two minutes at the end of the day: who worked, what was done, what was delivered, any issues. When a client or inspector asks "when did that happen?" you have the answer.</p>

<h2>4. Photograph everything</h2>
<p>Before, during and after, especially anything that will be covered by drywall or flooring. Photos protect you in disputes and build trust.</p>

<h2>5. Communicate proactively</h2>
<p>Clients get anxious when they hear nothing. A short update every couple of days (what is done, what is next, anything needed from them) prevents most complaints.</p>

<h2>6. Handle changes in writing</h2>
<p>Every change goes through a short written approval. See <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a>.</p>

<h2>7. Safety and compliance</h2>
<p>Know your province's occupational health and safety requirements, keep toolbox talk records and make sure insurance and coverage are in order: <a href="/blog/contractor-insurance-canada-what-you-need/">insurance guide</a>.</p>

<h2>8. Finish with a punch list</h2>
<p>Walk the site with the client, list remaining items, fix them, and get sign-off. Then invoice and ask for a review: <a href="/blog/how-to-get-more-reviews-as-a-contractor/">review guide</a>.</p>

<h2>Keep it in one place</h2>
<p>The more your quotes, jobs, crew schedule and invoices are connected, the less you retype and forget. See <a href="/quotes/general-contractor/">quoteai for general contractors</a> and <a href="/quotes/renovation-contractor/">for renovation contractors</a>.</p>
`,
  "contractor-cash-flow-management-canada": `
<p>A job can be profitable on paper and still leave you short on payday. Contractors pay for materials and crews up front and get paid later. That gap is cash flow, and it is the most common reason otherwise good trade businesses fail.</p>

<h2>Why cash runs short</h2>
<ul>
  <li>Materials and payroll go out before the client pays</li>
  <li>Final payments and holdbacks are delayed</li>
  <li>Taxes (GST/HST/QST remittances, payroll deductions) arrive in lumps</li>
  <li>Seasonal slowdowns reduce income while fixed costs continue</li>
</ul>

<h2>1. Forecast 13 weeks ahead</h2>
<p>A simple spreadsheet is enough: expected payments in, known bills out, week by week. It shows a shortfall weeks before it hurts.</p>

<h2>2. Get paid sooner</h2>
<p>Take deposits, bill in stages and invoice the same day. See <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">how to get paid on time</a>.</p>

<h2>3. Set tax money aside</h2>
<p>GST/HST and QST collected is not your money. Move it to a separate account when each payment arrives, along with an estimate for income tax and payroll remittances. Confirm filing frequency and deadlines with your accountant and the CRA or Revenu Québec.</p>

<h2>4. Understand holdbacks</h2>
<p>On many construction contracts a percentage is held back until a statutory period passes. Plan for that money to arrive late and check your province's rules.</p>

<h2>5. Negotiate supplier terms</h2>
<p>Net-30 terms on contractor accounts let you buy materials and get paid before the bill is due. Pay on time to keep the privilege.</p>

<h2>6. Watch your quote validity and pricing</h2>
<p>Underpriced jobs drain cash faster than anything else. See <a href="/tools/markup-margin-calculator/">markup vs margin</a>.</p>

<h2>7. Build a buffer</h2>
<p>Aim for one to three months of fixed costs in reserve, built gradually from a small percentage of every invoice.</p>

<h2>8. Track jobs, not just the bank balance</h2>
<p>Knowing which jobs are tying up cash helps you chase the right invoices: <a href="/blog/how-to-track-job-costs-contractors/">job cost tracking</a>.</p>

<h2>Keep invoicing automatic</h2>
<p>Software that turns an accepted quote into a deposit request and invoice removes delays. See quoteai for <a href="/quotes/general-contractor/">general contractors</a>.</p>
`,
  "how-to-quote-a-painting-job": `
<p>Underpriced painting jobs usually fail for one reason: prep takes longer than expected. Here is a repeatable way to quote painting work so you earn what the job is worth.</p>

<h2>Step 1: Measure</h2>
<p>Measure wall area, ceiling area, trim length and the number of doors and windows. Rule of thumb: floor area times about 3 gives approximate wall area for a typical room, but measuring is better.</p>

<h2>Step 2: Assess prep</h2>
<p>Note holes, cracks, water stains, wallpaper, glossy surfaces, mould, lead paint risk in older homes and furniture to move. Prep is often 30–50% of the time.</p>

<h2>Step 3: Decide coats and products</h2>
<p>Primer if colour changes are drastic or surfaces are bare; two finish coats on most walls. Choose paint tier and note it on the quote.</p>

<h2>Step 4: Estimate labour</h2>
<p>Use your own production rates, such as square feet per hour for cutting in, rolling and trim, and adjust for ceiling height and access. Multiply by your hourly rate including overhead.</p>

<h2>Step 5: Add materials</h2>
<p>Paint (coverage divided into total coats), primer, tape, drop sheets, filler, sundries. Mark up materials.</p>

<h2>Worked example</h2>
<ul>
  <li>Labour: 28 hours at $65 = $1,820</li>
  <li>Paint and primer: $310</li>
  <li>Supplies: $90</li>
  <li>Materials markup 15%: about $60</li>
  <li>Subtotal: about $2,280</li>
  <li>Tax at 13% (Ontario example): about $296</li>
  <li><strong>Total: about $2,576</strong></li>
</ul>
<p>Your rates will differ. The structure is the point.</p>

<h2>Step 6: Write the scope</h2>
<p>List rooms, surfaces, coats, products, colours, exclusions and the payment terms. For market prices, see <a href="/blog/how-much-does-it-cost-to-paint-an-apartment-in-canada-2026/">how much it costs to paint an apartment in Canada</a>.</p>

<h2>Speed it up</h2>
<p>Painters using <a href="/quotes/painter/">quoting software for painters</a> can reuse rates, apply taxes and send a PDF on site. See also <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a> for extra requests mid-job.</p>
`,
  "how-to-quote-a-roofing-job": `
<p>Roofing quotes usually go wrong in three places: the area is off because pitch or waste was guessed, the deck turns out to be rotten with no agreed price for fixing it, or the crew loses days to weather and access nobody priced. Deal with each before the client signs.</p>

<h2>Measure in squares, then correct for pitch and waste</h2>
<p>A square is 100 sq ft of roof surface. Take the plan area (footprint including overhangs, from a site measurement, drawings or an aerial report) and multiply by the pitch factor. For a rise of R inches per 12 of run, the factor is the square root of (1 + (R/12)²): 1.054 at 4/12, 1.118 at 6/12, 1.202 at 8/12, 1.414 at 12/12. Work plane by plane if pitches differ.</p>
<p>Waste depends on the roof: a simple gable loses little, while hips, valleys and dormers lose a piece of shingle at every cut. Set the allowance from your own reorder history on similar roofs and put it on the material line only. Labour is paid on the measured area.</p>
<p>Take linear measurements too: eaves and rakes (drip edge, starter), hips and ridges (cap, ridge vent), valleys, and every wall and chimney intersection (step and counter flashing). Each becomes its own line item.</p>

<h2>Tear-off: count the layers</h2>
<p>Lift a shingle at the eave and at a rake and count the layers. Each extra layer adds weight to the bin and time for the crew, so price tear-off per square, state the number of layers you found, and say that any extra layer is billed at a stated rate. Disposal is its own line: bin rental and landfill or transfer-station fees, priced from your actual hauler.</p>

<h2>Decking: a unit price, not a surprise</h2>
<p>Rotten or delaminated sheathing usually shows only once the shingles are off. Quote it as a per-sheet unit price (remove, supply and install one 4x8 sheet of a stated thickness, with fasteners and disposal), include a small allowance in the total, and state that the actual count is billed at that rate.</p>
<p>In Ontario there is a legal reason as well. The province's <a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">guide for home renovation and roofing businesses</a> says that if an estimate is included in a contract, you cannot charge more than 10% above it unless the customer requires additional or different goods or services and you have signed a change to the contract. When the count runs past the allowance, photograph the bad sheets, write up the extra quantity at the agreed unit price and get it signed before closing the deck. The <a href="/blog/how-to-handle-change-orders-contractors/">change order guide</a> covers the paperwork.</p>

<h2>Eave protection: what the code asks for</h2>
<p>Ontario's building code, <a href="https://www.ontario.ca/laws/regulation/r24163" rel="noopener">O. Reg. 163/24</a>, adopts the <a href="https://publications.gc.ca/site/eng/9.897526/publication.html" rel="noopener">National Building Code of Canada 2020</a> with Ontario amendments. In the NBC text, Article 9.26.5.1 requires eave protection on shingle, shake or tile roofs, extending at least 900 mm up the slope from the edge to a line at least 300 mm inside the inner face of the exterior wall. It is not required over unheated garages, carports and porches, where the overhang exceeds 900 mm along the slope, on low-slope asphalt shingle roofs installed under Subsection 9.26.8, on slopes of 1 in 1.5 or steeper, or in regions with 3,500 or fewer degree-days. Article 9.26.5.2 lists accepted materials, including self-sealing modified bitumen membranes laid beneath the starter strip.</p>
<p>For the quote: measure the overhang, not just the eave length, because a deep overhang can need two courses to reach 300 mm past the wall line. Membrane in valleys and around penetrations goes beyond that article, so if you include it, say so; it is your specification, and clients comparing bids should see it. Check local amendments and the location's degree-days in the code's climatic tables.</p>

<h2>Snow load is a structural question</h2>
<p>Under NBC Article 9.4.2.2, house roof framing is sized for a specified snow load based on the location's 1-in-50-year ground snow load and rain load, and Subsection 9.4.2 covers only light-frame roofs within set limits, such as members no more than 600 mm on centre and clear spans no more than 12.2 m.</p>
<p>Price an engineer's review, or exclude structural work in writing and recommend one, when you see a sagging ridge or rafters, cracked or notched framing, old fire or water damage, a switch to a heavier covering than the roof was built for, or a request to alter framing (skylights, dormers, a new slope). Structural work also changes the permit answer.</p>

<h2>Permits: ask the municipality</h2>
<p>Reroofing permits are a local rule. The City of Toronto, for example, lists <a href="https://www.toronto.ca/services-payments/building-construction/apply-for-a-building-permit/when-do-i-need-a-building-permit/" rel="noopener">replacing existing roofing material provided no structural work is required</a> among work that does not need a building permit; add framing repairs and that exemption is gone. Ontario's guide says permits are the customer's responsibility, that many contractors handle them, and that who does it belongs in the contract. Put the answer in the quote either way.</p>

<h2>Fall protection and access are real costs</h2>
<p>On Ontario construction projects, the fall protection rules in <a href="https://www.ontario.ca/laws/regulation/910213" rel="noopener">O. Reg. 213/91</a> apply where a worker could fall more than 3 metres. Guardrails come first; where they are not practicable, the regulation ranks travel restraint, fall restricting, fall arrest, then safety nets. Workers using fall protection need <a href="https://www.ontario.ca/laws/regulation/130297" rel="noopener">working at heights training</a> from an approved provider, valid for three years. In British Columbia, <a href="https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/ohs-regulation/part-11-fall-protection" rel="noopener">Part 11 of the WorkSafeBC OHS Regulation</a> requires a fall protection system from 3 m (10 ft) and a written fall protection plan where workers without permanent guardrails could fall 7.5 m (25 ft) or more.</p>
<p>Anchors, roof brackets, guardrail kits, setup and teardown time, and a steep-roof labour premium belong on a visible line. Leaving them out moves them into your margin; the <a href="/tools/markup-margin-calculator/">markup and margin calculator</a> shows what is left.</p>

<h2>Weather and warranty terms</h2>
<p>State that the start date moves for rain, high wind or cold below the manufacturer's application limits, that an open roof is dried in each night, and that delays do not change the price. Name the shingle brand and line so the client can look up the manufacturer's warranty, and read its conditions yourself, since they can include installation and ventilation requirements. State your workmanship warranty separately, with its length and coverage; Ontario's guide lists a clear description of warranties on goods and labour among what a contract must include.</p>

<h2>Sample quote: asphalt reroof in Toronto, Ontario</h2>
<p>Example only. The quantities and prices below are illustrative assumptions for a gable-and-hip house with a 6/12 pitch, a plan area of 1,810 sq ft (2,024 sq ft of roof, or 20.2 squares after the 1.118 pitch factor), two existing layers and one chimney. Ontario HST is 13% according to the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA rate table</a>.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Tear-off, 2 layers asphalt, to deck</td><td>20.2</td><td>SQ</td><td>$95.00</td><td>$1,919.00</td></tr>
    <tr><td>Bin rental and landfill fees</td><td>1</td><td>each</td><td>$650.00</td><td>$650.00</td></tr>
    <tr><td>Decking allowance: replace 7/16 in. OSB, per sheet (actual count billed at this rate)</td><td>6</td><td>sheet</td><td>$95.00</td><td>$570.00</td></tr>
    <tr><td>Eave protection membrane at eaves (code) and valleys</td><td>6</td><td>roll</td><td>$135.00</td><td>$810.00</td></tr>
    <tr><td>Synthetic underlayment, field</td><td>2</td><td>roll</td><td>$210.00</td><td>$420.00</td></tr>
    <tr><td>Architectural shingles, supply (20.2 SQ plus 10% waste)</td><td>22.3</td><td>SQ</td><td>$150.00</td><td>$3,345.00</td></tr>
    <tr><td>Shingle installation labour</td><td>20.2</td><td>SQ</td><td>$140.00</td><td>$2,828.00</td></tr>
    <tr><td>Starter strip and hip/ridge cap</td><td>140</td><td>LF</td><td>$4.50</td><td>$630.00</td></tr>
    <tr><td>Drip edge, eaves and rakes</td><td>160</td><td>LF</td><td>$3.25</td><td>$520.00</td></tr>
    <tr><td>Chimney step and counter flashing</td><td>1</td><td>each</td><td>$450.00</td><td>$450.00</td></tr>
    <tr><td>Ridge vent</td><td>40</td><td>LF</td><td>$12.00</td><td>$480.00</td></tr>
    <tr><td>Pipe boots</td><td>3</td><td>each</td><td>$65.00</td><td>$195.00</td></tr>
    <tr><td>Fall protection setup and teardown</td><td>1</td><td>lot</td><td>$600.00</td><td>$600.00</td></tr>
    <tr><td>Building permit: not required (like-for-like, no structural work)</td><td>1</td><td>each</td><td>$0.00</td><td>$0.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$13,417.00</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$1,744.21</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$15,161.21</strong></td></tr>
  </tbody>
</table>
<p>Why it is written this way:</p>
<ul>
  <li>Tear-off and labour use the measured 20.2 squares; only shingle supply carries waste, so nobody can say the area was padded.</li>
  <li>Decking is a unit price with an allowance. If 11 sheets are bad, the extra 5 go on a signed change at $95.00 each, inside Ontario's estimate rule.</li>
  <li>"Eaves (code) and valleys" tells the client which membrane is required and which is your standard.</li>
  <li>The permit line records the answer, and it changes if structural repairs are added.</li>
</ul>
<p>Check the tax line with the <a href="/tools/sales-tax-calculator/">sales tax calculator</a>, and see the <a href="/provinces/ontario/">Ontario page</a> for more on quoting there. If you would rather not build the table by hand, <a href="/quotes/roofer/">quoteai for roofers</a> writes an itemized quote with the province's taxes and sends it as a PDF.</p>

<h2>What clients expect to pay</h2>
<p>We have not found a government or industry-association source that publishes current Canadian reroofing prices, so this guide gives no range. What moves your number is in the quote above: true area after pitch, layers coming off, complexity and waste, membrane coverage, deck condition, access and fall protection, local disposal fees and the shingle line. When a client holds up a lower bid, compare it line by line against yours; an itemized quote makes any missing line easy to point out.</p>
`,
  "how-to-quote-an-electrical-job": `
<p>Most electrical quoting trouble starts before any numbers go down: the job gets priced in the wrong format. A receptacle swap priced like a renovation looks expensive, and a service upgrade priced like a receptacle swap leaves you paying for the utility delay, the extra inspection visit and the plaster you had to open. Sort the call first, then price it.</p>

<h2>Sort the call before you price it</h2>
<ul>
  <li><strong>Service calls and troubleshooting.</strong> You can't see the fault until you're there, so quote a call-out or diagnostic charge plus an hourly rate, and give a firm price for the repair once you've found it.</li>
  <li><strong>Unit installs.</strong> Pot lights, receptacles, fans, EV charger circuits. Price per unit with a stated condition: open ceiling or finished, distance from the panel, attic access. When the condition changes, the price changes, and the quote says so.</li>
  <li><strong>Circuit and renovation work.</strong> Price by circuit or by room after you've counted devices and walked the cable routes. Fishing cable through finished walls belongs in the labour hours, not in a contingency you hope covers it.</li>
  <li><strong>Service upgrades and rewires.</strong> Always a site visit, a load assessment and an itemized quote with written exclusions. This is where most of the money and most of the disputes are, so the rest of this article focuses on it.</li>
</ul>
<p>Whatever the format, your labour figure has to carry your real overhead: truck, insurance, licence fees, unbilled travel and estimating time. The <a href="/tools/labour-rate-calculator/">labour rate calculator</a> works out a billable hourly rate from those costs, and <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job: labour, materials and markup</a> covers markup on parts.</p>

<h2>Who can do the work, and who files the paperwork</h2>
<p>Licensing decides who may quote electrical work for hire, and the notification or permit is part of the job you are pricing. It is not something the client sorts out on their own.</p>
<h3>Ontario</h3>
<p>The Electrical Safety Authority states that <a href="https://esasafe.com/contractors/" rel="noopener">only electrical contractors licensed by ESA may do electrical work for hire</a> in Ontario. The contractor licence requires a Master Electrician on staff, and a Master Electrician <a href="https://www.esasafe.com/contractors/get-your-me-licence/" rel="noopener">may not offer electrical services to the public without an Electrical Contractor licence</a>. Before the work starts, whoever does it files a notification with ESA. The installation has to be <a href="https://www.esasafe.com/compliance/what-you-need-to-know/" rel="noopener">inspected before it is concealed or buried</a>, and once it passes, ESA issues a Certificate of Acceptance to the person who filed. Put that certificate on your quote as a deliverable: ESA notes it matters to the homeowner for insurance and resale. ESA's fees are set out in guides on its <a href="https://www.esasafe.com/fees-and-forms/fees/" rel="noopener">fees page</a>, which went up 1.9% on April 1, 2026, so take the figure from the current guide rather than last year's job file.</p>
<h3>British Columbia</h3>
<p>Technical Safety BC issues electrical installation permits everywhere except Burnaby, Maple Ridge, North Vancouver, Surrey, Victoria, Vancouver and West Vancouver, where the <a href="https://www.technicalsafetybc.ca/electrical-permits" rel="noopener">municipality handles them</a>. Every application names a Field Safety Representative, who declares compliance and requests an inspection after each phase, with at least one request within 180 days of the permit being issued. On a long rewire, schedule those declarations into the job.</p>
<h3>Québec</h3>
<p>Electrical installation work requires a licence with <a href="https://www.rbq.gouv.qc.ca/domaines-dintervention/electricite/vos-obligations-envers-la-rbq/licence/" rel="noopener">subclass 16, Entrepreneur en électricité</a>. The RBQ sends contractors to the Corporation des maîtres électriciens du Québec for it, and the CMEQ states that <a href="https://www.cmeq.org/english/about-cmeq/mission-and-historic/" rel="noopener">master electricians in Québec are required to be members</a>. Show the licence number on every quote.</p>
<h3>The code you are quoting to</h3>
<p>Each province adopts the Canadian Electrical Code, Part I (CSA C22.1) with its own amendments. Ontario's current code, the 29th edition, is <a href="https://esasafe.com/role/oesc/" rel="noopener">the CEC Part I plus Ontario amendments, in force since May 1, 2025</a>. Québec's Chapter V, Électricité, is <a href="https://www.rbq.gouv.qc.ca/domaines-dintervention/electricite/la-rbq-et-lelectricite/reglementation/ce-qui-sapplique" rel="noopener">the 25th edition of the CEC with Québec amendments</a>, updated on March 26, 2026. A quote that says "all work to the current provincial electrical code" is a commitment you can be held to, so price what that code requires on the circuits you touch, not just what is there today.</p>

<h2>What drives the price of a rewire or panel upgrade</h2>
<p>Clients usually arrive with a number they found online. We don't publish price ranges, because no official source gives one that holds across provinces and housing stock. What you can do is show the client what moves the number, line by line, so the total makes sense to them.</p>
<ul>
  <li><strong>Existing wiring.</strong> Knob-and-tube changes the job. ESA notes that <a href="https://esasafe.com/home-renovation-buying-and-selling/knob-and-tube/" rel="noopener">many insurers won't cover or renew homes with knob-and-tube, and some require it replaced first</a>, so these clients often have a deadline. Plaster walls, blocked bays and no attic access slow every run. Count circuits during the visit and price the removal per circuit, or as a lump sum after a proper walk-through.</li>
  <li><strong>Panel capacity.</strong> Going from 100A to 200A usually means a new panel, new service entrance conductors and often a new meter base and mast. Do the load calculation on site. If a heat pump, EV charger or electric range is coming later, size for it now and say so on the quote.</li>
  <li><strong>Utility work.</strong> A service upgrade needs the local distribution company to disconnect and reconnect, and sometimes to change its own equipment. Its lead time sets your schedule. Find out from the utility what it charges and who pays, and quote it as a separate line or a named exclusion.</li>
  <li><strong>Notification, permit and inspections.</strong> The fee, plus your time for each inspection visit. A rewire can need inspections at several stages, and every return trip costs you labour and travel.</li>
  <li><strong>Opening and closing walls.</strong> Most electricians don't do drywall or plaster repair. Either price it with a trade you trust, or write "patching, drywall and paint by others" in plain words. Clients rarely assume holes are their problem.</li>
  <li><strong>Things you can't see.</strong> Undersized grounding, aluminum branch wiring, asbestos-containing materials. Name them as conditions that trigger a change order, with your hourly rate stated, and handle them the way <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a> should be handled: priced and signed before the extra work starts.</li>
</ul>

<h2>Sample quote: 200A service upgrade, detached house, Ontario</h2>
<p>Example only: every price below is an assumption for illustration, not a market rate. The house has a 100A panel, overhead service and no knob-and-tube. Ontario charges <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">13% HST</a>, and the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> runs the same sum for other provinces.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Site assessment and load calculation</td><td>1</td><td>lot</td><td>$180.00</td><td>$180.00</td></tr>
    <tr><td>Remove 100A panel; supply and install 200A meter base, mast and service entrance conductors</td><td>1</td><td>lot</td><td>$1,450.00</td><td>$1,450.00</td></tr>
    <tr><td>Supply 200A main-breaker panel, 40 spaces</td><td>1</td><td>each</td><td>$620.00</td><td>$620.00</td></tr>
    <tr><td>Replacement breakers where existing ones don't fit the new panel</td><td>6</td><td>each</td><td>$95.00</td><td>$570.00</td></tr>
    <tr><td>Grounding and bonding upgrade to current code</td><td>1</td><td>lot</td><td>$340.00</td><td>$340.00</td></tr>
    <tr><td>Labour: transfer and label existing circuits, install and test</td><td>14</td><td>hour</td><td>$115.00</td><td>$1,610.00</td></tr>
    <tr><td>ESA notification fee (allowance, billed at actual cost)</td><td>1</td><td>lot</td><td>$350.00</td><td>$350.00</td></tr>
    <tr><td>Utility disconnect and reconnect coordination</td><td>1</td><td>lot</td><td>$150.00</td><td>$150.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$5,270.00</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$685.10</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$5,955.10</strong></td></tr>
  </tbody>
</table>
<p>Why it is written this way:</p>
<ul>
  <li>The assessment is its own line, so a client who doesn't go ahead still understands what the visit covered.</li>
  <li>The ESA fee is an allowance billed at cost, not a figure baked into labour. Replace it with the amount from ESA's current fee guide when you file. This example charges HST on the whole subtotal; confirm the treatment of pass-through fees with your accountant.</li>
  <li>Breakers are counted, not lumped. If the panel opens up and needs more, the unit price is already agreed.</li>
  <li>The quote leaves out utility charges, drywall and paint, and any work on existing branch circuits. Each sits under "Not included" in plain words, with the Certificate of Acceptance listed as a deliverable.</li>
</ul>

<h2>Offer options, not pressure</h2>
<p>A service upgrade is a good moment to offer extras the client may want anyway: a whole-home surge protector, a conduit or spare breaker space for a future EV charger, a sub-panel for a garage. Put each one on the quote as an optional line with its own price, so the client can tick it without reopening the conversation. quoteai can build that kind of itemized quote with optional lines and the province's tax, and send it as a PDF before you leave the driveway. See <a href="/quotes/electrician/">quoting for electricians</a> for how it handles panel and rewire jobs.</p>
<p>Finally, put your licence number, insurance and warranty terms on every quote, along with how long the price holds. Copper and equipment prices move, and a 200A quote that sits unsigned for three months shouldn't bind you to old material costs.</p>
`,
  "how-to-quote-a-plumbing-job": `
<p>Plumbing customers want certainty, and plumbers want to be paid for hidden problems. Choosing the right pricing model for each type of job solves both.</p>

<h2>Flat-rate vs hourly</h2>
<ul>
  <li><strong>Flat-rate</strong>: one price for a defined task (toilet install, faucet replacement, water heater swap). Customers like it, efficient plumbers profit from it.</li>
  <li><strong>Hourly (time and materials)</strong>: suits diagnostics, emergencies and unknown conditions. Needs a clear hourly rate, minimum call-out and materials markup.</li>
  <li><strong>Hybrid</strong>: flat diagnostic fee, then a fixed quote for the repair.</li>
</ul>

<h2>Build a flat-rate price book</h2>
<p>For each common job, record average time, parts, travel and disposal, then add overhead and margin. Review prices every few months as costs move: <a href="/tools/markup-margin-calculator/">markup vs margin</a>.</p>

<h2>Quoting renovation plumbing</h2>
<p>Separate rough-in, fixtures, finish plumbing, permits, drywall access and disposal. See <a href="/blog/bathroom-renovation-cost-toronto-2026/">bathroom renovation costs</a> for market context.</p>

<h2>Emergency work</h2>
<p>State after-hours rates upfront and get approval before starting. Document what you found with photos.</p>

<h2>Exclusions and unknowns</h2>
<ul>
  <li>Hidden pipe condition (galvanized, polybutylene, lead service lines)</li>
  <li>Access repair of walls and ceilings</li>
  <li>Code upgrades required when opening walls</li>
</ul>
<p>Add a clause for discovered conditions and handle extras through <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a>.</p>

<h2>Present options</h2>
<p>For water heaters, give standard, high-efficiency and tankless options with clear differences in price and operating cost.</p>

<h2>Speed and professionalism</h2>
<p>Plumbers using <a href="/quotes/plumber/">quoting software for plumbers</a> can present itemized options on a tablet at the door and get acceptance on the spot. For more leads, see <a href="/blog/how-to-get-more-plumbing-jobs-canada/">how to get more plumbing jobs</a>.</p>
`,
  "quote-vs-estimate-vs-invoice-difference": `
<p>Clients and contractors use these words loosely, and the confusion causes real disputes. Here is a plain guide.</p>

<h2>Estimate</h2>
<p>An approximate price based on available information. It may change, and it is usually not binding. Good for early conversations when the scope is unclear.</p>

<h2>Quote</h2>
<p>A fixed price for a defined scope, valid for a set period. Once accepted it is typically binding on both sides, which is why scope and exclusions must be exact.</p>

<h2>Bid</h2>
<p>A formal price offer submitted in competition, often for commercial or public projects, following the client's documents and deadlines.</p>

<h2>Proposal</h2>
<p>A fuller document combining price with a description of the approach, schedule, credentials and terms.</p>

<h2>Invoice</h2>
<p>A request for payment for work done or a deposit due. It shows amounts, taxes, due date and payment methods, and it is the document the CRA expects to see for GST/HST purposes.</p>

<h2>Which should you send?</h2>
<ul>
  <li>Unknown conditions: <strong>estimate</strong> with a range and a note on what could change it</li>
  <li>Defined work: <strong>quote</strong></li>
  <li>Competitive or large project: <strong>bid or proposal</strong></li>
  <li>When work is accepted or complete: <strong>invoice</strong></li>
</ul>

<h2>Protecting yourself</h2>
<p>If you give an estimate, say it is an estimate. If you give a fixed quote, list exclusions and handle changes in writing: <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a>. Add terms from a <a href="/blog/how-to-write-a-contractor-contract-canada/">contract</a> when the job is big.</p>

<h2>One flow, not four documents</h2>
<p>The cleanest approach is a single record that moves from quote to accepted job to invoice. See <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a> and <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a quote that wins jobs</a>, or try <a href="/pricing/">free quoting</a>.</p>
`,
  "siding-replacement-cost-canada-2026": `
<p>New siding changes how a house looks, performs and sells. It also costs enough that homeowners compare quotes carefully. Typical 2026 installed ranges:</p>

<h2>Cost per square foot of wall, installed</h2>
<ul>
  <li><strong>Vinyl</strong>: about $6–$12</li>
  <li><strong>Engineered wood</strong>: about $8–$15</li>
  <li><strong>Fibre cement (such as Hardie-style boards)</strong>: about $10–$20</li>
  <li><strong>Aluminum or steel</strong>: about $9–$18</li>
  <li><strong>Cedar</strong>: about $12–$25+</li>
</ul>
<p>A typical detached home with 1,800 square feet of wall area often totals roughly $12,000 to $35,000 depending on the material and complexity.</p>

<h2>What affects the price</h2>
<ul>
  <li><strong>Removal</strong> of old siding and disposal; asbestos-containing products in older homes need special handling.</li>
  <li><strong>Sheathing and house wrap</strong>: damaged sheathing is replaced; modern wrap and flashing improve moisture control.</li>
  <li><strong>Insulation</strong>: adding rigid exterior insulation improves comfort and may qualify for programs. See <a href="/blog/canada-greener-homes-grant-rebates-contractors-guide-2026/">rebates guide</a>.</li>
  <li><strong>Trim, soffit, fascia and corners</strong></li>
  <li><strong>Windows and doors</strong>: flashing around them is critical: <a href="/blog/how-to-quote-a-window-or-door-installation-job/">window and door costs</a>.</li>
  <li><strong>Height and access</strong>: scaffolding on multi-storey homes.</li>
</ul>

<h2>Quote like a pro</h2>
<p>Measure wall area minus openings, add waste, and list removal, wrap, insulation, siding, trim, flashing and clean-up separately. Add an allowance for hidden rot with a per-sheet price. See <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a>. Renovators can build these quotes quickly with <a href="/quotes/renovation-contractor/">quoting software for renovation contractors</a>.</p>
`,
  "how-to-quote-a-landscaping-job": `
<p>Landscaping quotes cover two very different businesses: one-time projects like patios and planting, and recurring work like lawn care and snow removal. Each needs its own pricing logic.</p>

<h2>Recurring maintenance</h2>
<ul>
  <li>Measure lawn area and note obstacles, slopes and gates.</li>
  <li>Estimate time per visit based on crew size and equipment.</li>
  <li>Add travel, fuel, equipment wear, disposal and overhead.</li>
  <li>Set a minimum per-visit price so small lots are still worth the trip.</li>
  <li>Offer seasonal contracts with monthly payments to smooth cash flow: <a href="/blog/contractor-cash-flow-management-canada/">cash flow guide</a>.</li>
</ul>

<h2>One-time projects</h2>
<p>Break them into labour, materials, equipment rental, delivery, disposal and a contingency for soil and ground surprises. Common materials such as aggregate, soil, sod, pavers and plants should be itemized with quantities.</p>

<h2>Hardscape specifics</h2>
<p>Excavation depth, base compaction, drainage, edge restraint and frost considerations separate a lasting patio from a heaving one. See <a href="/blog/how-to-quote-a-masonry-job/">driveway cost guide</a> and <a href="/blog/fence-installation-cost-canada-2026/">fence cost guide</a>.</p>

<h2>Winter work</h2>
<p>Snow removal contracts need clear terms: trigger depth, service times, liability and salting. Check insurance coverage: <a href="/blog/contractor-insurance-canada-what-you-need/">insurance guide</a>.</p>

<h2>Common pricing mistakes</h2>
<ul>
  <li>Underestimating haul and disposal</li>
  <li>Forgetting machine time and fuel</li>
  <li>No weather clause</li>
  <li>Not marking up plants and materials: <a href="/tools/markup-margin-calculator/">markup vs margin</a></li>
</ul>

<h2>Send quotes quickly</h2>
<p>Landscape clients usually request several quotes at once. <a href="/quotes/landscaper/">Quoting software for landscapers</a> lets you measure, price and send from the property.</p>
`,
  "how-to-quote-an-hvac-job": `
<p>On an HVAC job the sizing decides comfort for years, three regulators can have a say in one install, and the client has often read about a rebate before you arrive. A good quote settles each of those on paper, so the client can compare you line by line with the other quotes.</p>

<h2>Size it before you price it</h2>
<p>Do not copy the nameplate of the old unit. In Ontario, the Building Code requires that heating capacity be based on a calculated heating load, that cooling capacity be based on a calculated cooling load, and that oversizing and undersizing be judged against CSA F280, "Determining the required capacity of residential space heating and cooling appliances" (<a href="https://www.ontario.ca/document/2024-building-code-compendium/part-9-housing-and-small-buildings" rel="noopener">Ontario Building Code compendium, Article 9.33.5.1</a>). British Columbia's 2024 code also points to F280 for peak cooling loads, and the province's own bulletin notes that software verified under Section 8 of F280 may be used for the calculation (<a href="https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/construction-industry/building-codes-and-standards/bulletins/2024-code/b24-08_overheating.pdf" rel="noopener">BC Building Code bulletin B24-08</a>).</p>
<p>Price the load calculation as its own line. It is real work (measuring windows, walls, ceilings and duct runs), and it is the document a building department may ask for. Toronto's application guide for a stand-alone HVAC permit lists heat loss and heat gain calculations and duct design calculations among the required drawings (<a href="https://www.toronto.ca/services-payments/building-construction/apply-for-a-building-permit/building-permit-application-guides/standalone-plumbing-mechanical-and-drains/standalone-mechanical-hvac/" rel="noopener">City of Toronto</a>).</p>
<p>For a heat pump, write the unit's capacity at your design temperature, not just nominal tonnage, and say whether backup heat stays. Against a cheaper unit with less low-temperature capacity, the load numbers are your argument.</p>

<h2>Split equipment, labour and ductwork</h2>
<p>Clients compare the equipment line first. Give the brand, model numbers for every matched component, capacity and efficiency ratings. Then separate:</p>
<ul>
<li><strong>Installation labour</strong>: crew size and hours, including brazing, pressure testing, evacuation and charging.</li>
<li><strong>Materials</strong>: line set, pad or wall brackets, condensate drain, venting, thermostat and controls.</li>
<li><strong>Ductwork</strong>: returns added, trunk sealing, transitions. Ducts sized for an old furnace may not move the airflow a heat pump needs, and this is where most cost surprises hide.</li>
<li><strong>Electrical</strong>: new circuit and disconnect, and a panel review. If a service upgrade is needed, price it separately or exclude it in writing.</li>
<li><strong>Removal</strong>: old equipment, refrigerant recovery and disposal.</li>
</ul>
<p>Some rebate programs require this split. BC's Home Renovation Rebate program asks for an invoice that itemizes equipment and labour separately and shows a zero balance owing (<a href="https://betterhomesbc.ca/learn-about-programs/home-renovation-rebate-program/home-renovation-rebate-program-requirements/" rel="noopener">CleanBC Better Homes</a>). To set the hourly figure, see <a href="/blog/how-to-price-a-job-labour-materials-markup/">pricing labour, materials and markup</a>.</p>

<h2>Who is allowed to do each part</h2>
<p>Refrigerant, gas and electrical work are regulated separately. Name the licence holders on the quote.</p>
<h3>Refrigerant</h3>
<p>In Ontario, buying and handling refrigerants requires an Ozone Depletion Prevention (ODP) certificate card, earned through a one-day approved course and valid for five years. The card alone does not let someone work on or fix refrigeration equipment: that needs a Certificate of Qualification in a trade such as refrigeration and air conditioning mechanic. Card holders must also keep records of refrigerant use for at least two years (<a href="https://www.ontario.ca/page/certificate-handle-refrigerants" rel="noopener">ontario.ca</a>). Your removal line should say the old system's refrigerant will be recovered, not vented.</p>
<h3>Gas</h3>
<ul>
<li><strong>Ontario</strong>: most fuels regulations require contractors to be registered with TSSA, and natural gas is one of the fields covered; registered contractors must make sure the technicians they employ hold the right certificates (<a href="https://www.tssa.org/contractor-registration-and-certification" rel="noopener">TSSA</a>).</li>
<li><strong>British Columbia</strong>: regulated gas work requires a Technical Safety BC licence or employment by a licensed contractor (<a href="https://www.technicalsafetybc.ca/gas-licences" rel="noopener">Technical Safety BC</a>), and licensed contractors take out gas installation permits; some cities, including Vancouver, issue their own (<a href="https://www.technicalsafetybc.ca/permits/gas-installation" rel="noopener">Technical Safety BC permits</a>).</li>
<li><strong>Québec</strong>: gas appliance work requires a mandatory qualification certificate from the TAG series (<a href="https://www.quebec.ca/emploi/informer-metier-profession/profession-metier-reglemente/connaitre-certificats-qualification-obligatoire/technique-appareils-gaz-classe-1" rel="noopener">Québec.ca</a>), and the contractor needs the matching RBQ licence subclass. For a heat pump, Hydro-Québec's LogisVert program lists RBQ subclasses 15.1, 15.7 or 15.8 plus 15.9 or 15.10, and subclass 16 for the electrical work (<a href="https://www.hydroquebec.com/residential/energy-wise/financial-assistance/logisvert/residential.html" rel="noopener">Hydro-Québec</a>). Plumbing and heating licences can be checked with the CMMTQ (<a href="https://www.quebec.ca/habitation-territoire/chauffage-consommation-energie/aide-financiere-renovation-ecoenergetique/renoclimat/nouveautes-adaptation-inondations" rel="noopener">Rénoclimat changes page</a>).</li>
</ul>
<h3>Electrical and permits</h3>
<p>In Ontario, almost all electrical work needs a notification of work filed with the Electrical Safety Authority before it starts, by whoever does the work, and it is separate from any building permit (<a href="https://esasafe.com/notifications-and-inspections/" rel="noopener">ESA</a>). If you sub the circuit to a licensed electrical contractor, say so on the quote; see <a href="/blog/how-to-quote-an-electrical-job/">how to quote an electrical job</a> for how they will price it. Building permits vary by municipality. Toronto, for example, lists replacing a furnace in a house as work that does not need a building permit, but installing or modifying a heating system does (<a href="https://www.toronto.ca/services-payments/building-construction/apply-for-a-building-permit/when-do-i-need-a-building-permit/" rel="noopener">City of Toronto</a>). Check the municipality and show the permit as its own line at cost.</p>

<h2>Selling in the client's home in Ontario</h2>
<p>Furnaces, air conditioners and any HVAC system are restricted products under Ontario's Consumer Protection Act rules. You can only sign a contract for them at the client's home if the client initiated the visit (or you have an existing contract and they agreed in advance to hear an offer). The contract needs the mandatory cover page, signed before work begins, and the client gets a 10-day cooling-off period from receiving a written copy. You must keep records showing who initiated the transaction for three years (<a href="https://www.ontario.ca/page/rules-businesses-entering-contracts-consumers-home" rel="noopener">ontario.ca</a>).</p>

<h2>What clients expect to pay</h2>
<p>No government body publishes installed prices for heat pumps or furnaces, so the figures clients arrive with are usually rebate amounts. Ontario's Home Renovation Savings Program pays $1,250 per ton, up to $7,500, for a qualifying cold-climate heat pump in homes heated with electricity, oil, propane or wood, but $500 per ton, up to $2,000, for Enbridge Gas customers heating with gas. The work needs a participating contractor, the unit must be on NRCan's qualified products list, and installations done before approval are not eligible (<a href="https://www.homerenovationsavings.ca/without-assessment/heat-pumps" rel="noopener">Home Renovation Savings</a>). Federally, a national heat pump rebate announced on October 8, 2026 would pay up to $10,000 for households below the median income and $2,000 for other eligible homeowners, through an online portal with pre-approval and no energy audit (<a href="https://www.canada.ca/en/environment-climate-change/news/2026/10/prime-minister-carney-announces-landmark-investment-to-retrofit-one-million-homes-cutting-energy-costs-and-emissions.html" rel="noopener">Government of Canada</a>); Hydro-Québec says the funding begins in 2027 and details are not yet known (<a href="https://www.hydroquebec.com/residential/energy-wise/financial-assistance/logisvert/residential.html" rel="noopener">Hydro-Québec</a>). Our <a href="/blog/canada-greener-homes-grant-rebates-contractors-guide-2026/">guide to current home energy rebates</a> tracks the rest.</p>
<p>Show the rebate as a note, never as a discount: you are not paying it, and the client may not qualify.</p>

<h2>Worked example: cold-climate heat pump with furnace backup, Ontario</h2>
<p>Example: a two-storey house heated with gas, a 2019 furnace in good condition and a failing central air conditioner. The client wants a cold-climate ducted heat pump with the furnace kept as backup. All prices below are assumptions for illustration. Ontario charges 13% HST (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA</a>).</p>
<table>
<thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr></thead>
<tbody>
<tr><td>Room-by-room heat loss and gain calculation (CSA F280), duct check</td><td>1</td><td>job</td><td>$450.00</td><td>$450.00</td></tr>
<tr><td>Cold-climate variable-speed heat pump, 3-ton outdoor unit (model no., on NRCan qualified list)</td><td>1</td><td>ea</td><td>$6,800.00</td><td>$6,800.00</td></tr>
<tr><td>Matched cased indoor coil on existing furnace (model no.)</td><td>1</td><td>ea</td><td>$1,250.00</td><td>$1,250.00</td></tr>
<tr><td>Insulated line set, 25 ft, wall penetration sealed</td><td>1</td><td>ea</td><td>$420.00</td><td>$420.00</td></tr>
<tr><td>Wall brackets and vibration isolators</td><td>1</td><td>set</td><td>$260.00</td><td>$260.00</td></tr>
<tr><td>Dual-fuel thermostat with outdoor sensor, switchover set at commissioning</td><td>1</td><td>ea</td><td>$480.00</td><td>$480.00</td></tr>
<tr><td>Installation labour, 2-person crew (braze, pressure test, evacuate, charge)</td><td>16</td><td>hr</td><td>$125.00</td><td>$2,000.00</td></tr>
<tr><td>Electrical: 240 V circuit and disconnect, by licensed electrical contractor, ESA notification</td><td>1</td><td>job</td><td>$950.00</td><td>$950.00</td></tr>
<tr><td>Add one return-air run to upstairs bedrooms</td><td>1</td><td>job</td><td>$780.00</td><td>$780.00</td></tr>
<tr><td>Remove old A/C, recover refrigerant by certified technician, dispose</td><td>1</td><td>job</td><td>$350.00</td><td>$350.00</td></tr>
<tr><td>Municipal HVAC permit (at cost, if required)</td><td>1</td><td>ea</td><td>$250.00</td><td>$250.00</td></tr>
<tr><td>Commissioning report and manufacturer warranty registration</td><td>1</td><td>job</td><td>$250.00</td><td>$250.00</td></tr>
<tr><td colspan="4"><strong>Subtotal</strong></td><td><strong>$14,240.00</strong></td></tr>
<tr><td colspan="4">HST (13%)</td><td>$1,851.20</td></tr>
<tr><td colspan="4"><strong>Total</strong></td><td><strong>$16,091.20</strong></td></tr>
</tbody>
</table>
<p><strong>Note on the quote:</strong> "As an Enbridge Gas customer heating with gas, you may qualify for the Home Renovation Savings Program cold-climate heat pump rebate ($500 per ton of rated heating capacity at 8.3°C, up to $2,000). Pre-approval is required before installation; we will submit it as a participating contractor. The rebate is paid to you by the program and is not deducted above."</p>
<ul>
<li>The load calculation comes first because it justifies the 3-ton size and the return-air line; without it, the return looks like an upsell.</li>
<li>Model numbers on the outdoor unit and coil let the client and the rebate program check the matched system against the qualified list.</li>
<li>HST is charged on the full subtotal because the rebate is a separate payment to the homeowner, not a price reduction you give. Run the figures through the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> if you quote across provinces.</li>
<li>Warranty registration is a priced line because it is a real task; check the manufacturer's terms and register the day you commission.</li>
</ul>
<p>quoteai builds this kind of itemized quote with Ontario HST applied and sends it to the client as a PDF, with the rebate note kept as text rather than a deduction. For HVAC-specific templates, see <a href="/quotes/hvac-technician/">HVAC quotes</a>.</p>
`,
  "how-to-quote-a-tiling-job": `
<p>Tile pricing is less about the tile and more about everything under it. A flat floor on a solid subfloor and a custom shower on bare studs are completely different jobs.</p>

<h2>Measure and add waste</h2>
<p>Calculate area and add waste: about 10% for straight lay, 15% or more for diagonal, herringbone or large-format tile with cuts. Note the tile size, because large formats need flatter surfaces.</p>

<h2>Assess the substrate</h2>
<ul>
  <li>Levelness and deflection of the subfloor</li>
  <li>Need for backer board or an uncoupling membrane</li>
  <li>Heated floor installation</li>
  <li>Waterproofing in showers and wet areas</li>
</ul>

<h2>Price labour by complexity</h2>
<p>Use rates per square foot for standard layouts and higher for mosaics, patterns, niches, benches and curved walls. Setting a minimum job price protects small jobs like backsplashes.</p>

<h2>Line items</h2>
<ul>
  <li>Demolition and disposal</li>
  <li>Substrate prep and levelling</li>
  <li>Waterproofing</li>
  <li>Thinset, grout, sealer, trim and edge profiles</li>
  <li>Tile supply (or client-supplied, without warranty)</li>
  <li>Labour for floor, wall and details</li>
</ul>

<h2>Know the market</h2>
<p>Installed tile costs commonly fall around $10–$25 per square foot for floors, and more for complex work. For a full-room context see <a href="/blog/bathroom-renovation-cost-toronto-2026/">bathroom renovation costs</a> and <a href="/blog/flooring-installation-cost-canada-2026/">flooring costs</a>.</p>

<h2>Clauses that save money</h2>
<p>Include cure and grout times, who supplies extra tiles, and how hidden subfloor problems are priced: <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a>.</p>

<h2>Speed</h2>
<p>Tile installers can use <a href="/quotes/tile-installer/">quoting software for tile installers</a> to measure, add waste and itemize in one visit.</p>
`,
  "how-to-raise-your-prices-contractors-without-losing-clients": `
<p>Material, fuel, insurance and wages go up, but many contractors keep their rates frozen for years because they fear losing work. The result is shrinking margin and burnout. A planned price increase is usually less risky than it feels.</p>

<h2>Signs it is time</h2>
<ul>
  <li>You win almost every quote you send</li>
  <li>You are booked weeks ahead</li>
  <li>Your costs rose and your rates did not</li>
  <li>Your profit per job is shrinking: <a href="/blog/how-to-track-job-costs-contractors/">job cost tracking</a></li>
</ul>
<p>If nobody ever says "that's expensive", you are probably too cheap.</p>

<h2>Work out the number</h2>
<p>Start from your real costs and target margin, not from competitors. See <a href="/tools/markup-margin-calculator/">markup vs margin</a>. A common approach is a modest increase, often 5–10%, once or twice a year, rather than a big jump after years of nothing.</p>

<h2>Raise prices on new quotes first</h2>
<p>New leads have no reference price, so the increase is invisible. Update your price list and quoting software so every new quote uses current rates.</p>

<h2>Tell existing clients properly</h2>
<ul>
  <li>Give notice, often 30 days, before the change.</li>
  <li>Explain briefly: "Material and insurance costs have increased, so rates go up on [date]."</li>
  <li>Thank them and offer to book before the change if they have pending work.</li>
</ul>

<h2>Protect quotes in progress</h2>
<p>Keep a validity period on quotes and honour it. For long jobs, add clauses for major supplier increases: <a href="/blog/reduce-material-costs-contractors-canada/">material cost guide</a>.</p>

<h2>Justify with value, not apology</h2>
<p>Better communication, reliable scheduling, clean sites and a clear warranty support higher prices. See <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to win more bids</a>.</p>

<h2>Expect some pushback</h2>
<p>You may lose a few price-sensitive clients, and that is normal. If you lose them and keep the rest, your income usually rises while your workload falls.</p>
`,
  "how-to-hire-your-first-employee-contractor-canada": `
<p>This is general information, not legal or tax advice. Employment rules vary by province, so confirm details with your accountant and provincial authorities. Hiring is the step that turns a self-employed tradesperson into a business owner, and it comes with obligations you cannot skip.</p>

<h2>Employee or subcontractor?</h2>
<p>If you control when, where and how the person works, they are likely an employee regardless of what you call them. See <a href="/blog/how-to-hire-and-pay-subcontractors-canada/">hiring subcontractors</a> for the difference.</p>

<h2>Set-up checklist</h2>
<ul>
  <li><strong>Payroll account with the CRA</strong> for source deductions (income tax, CPP, EI). In Quebec you also deal with Revenu Québec and the QPP, QPIP and related programs.</li>
  <li><strong>Workers' compensation registration</strong> (WSIB, WorkSafeBC, CNESST and others)</li>
  <li><strong>Employment agreement</strong> covering pay, hours, probation, duties and termination</li>
  <li><strong>Minimum standards</strong>: overtime, vacation pay, statutory holidays and breaks per your province</li>
  <li><strong>Health and safety</strong>: orientation, required training and records</li>
  <li><strong>Insurance</strong> updates: <a href="/blog/contractor-insurance-canada-what-you-need/">insurance guide</a></li>
  <li><strong>Record of employment (ROE)</strong> and year-end slips (T4)</li>
</ul>

<h2>Know the true cost</h2>
<p>An employee costs more than their hourly wage: employer CPP/EI contributions, vacation pay, workers' compensation premiums, tools, vehicle, training and unproductive time. Many contractors estimate 20–30% on top of wages. Build it into your hourly rate and quotes.</p>

<h2>Make sure there is work</h2>
<p>Before hiring, confirm you have enough booked jobs and healthy cash flow: <a href="/blog/contractor-cash-flow-management-canada/">cash flow guide</a>.</p>

<h2>Train and delegate</h2>
<p>Write down how you do the job (checklists, photos, standards) so the new hire does not rely on your memory. See <a href="/blog/construction-project-management-small-contractors/">job site management</a>.</p>

<h2>Where it fits in growth</h2>
<p>Hiring is one step of a bigger plan: <a href="/blog/how-to-scale-a-contracting-business-canada/">how to scale a contracting business</a>.</p>
`,
  "how-to-follow-up-on-quotes-contractors": `
<p>A surprising share of lost quotes are simply forgotten. The client was busy, got three quotes, and the one who followed up won. Following up is not pushy, it is service.</p>

<h2>The timing</h2>
<ul>
  <li><strong>Same day</strong>: confirm the quote was received.</li>
  <li><strong>Day 2–3</strong>: a short check-in.</li>
  <li><strong>Day 7</strong>: a second follow-up with value (an option, a date, a question).</li>
  <li><strong>Day 14–30</strong>: a final message before the quote expires.</li>
</ul>

<h2>Templates</h2>
<h3>Day 1 (text)</h3>
<p><em>"Hi [Name], it's [You] from [Company]. I just sent your quote for [job]. Let me know if anything is unclear."</em></p>
<h3>Day 3 (text or email)</h3>
<p><em>"Hi [Name], just checking you received the quote for [job] and whether you have questions. Happy to adjust the scope if needed."</em></p>
<h3>Day 7 (email)</h3>
<p><em>"Hi [Name], I have an opening on [date] and can hold it for you until [date]. If budget is a concern, I can suggest a few ways to adjust the scope."</em></p>
<h3>Final (text)</h3>
<p><em>"Hi [Name], your quote for [job] is valid until [date]. After that I would need to re-price it as material costs change. Would you like to go ahead or should I close this file?"</em></p>

<h2>What not to do</h2>
<ul>
  <li>Do not discount at the first sign of silence.</li>
  <li>Do not send daily messages.</li>
  <li>Do not blame the client for not replying.</li>
</ul>

<h2>Learn from the answers</h2>
<p>"Too expensive", "went with someone else", and "not now" each tell you something. Track them: <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to win more bids</a>.</p>

<h2>Automate it</h2>
<p>Quoting software that shows when a client opened the quote and reminds you to follow up turns this into a habit. See <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">sending quotes in 5 minutes</a> and <a href="/pricing/">free quoting</a>.</p>
`,
  "how-to-quote-a-carpentry-job": `
<p>Custom woodwork is hard to price because every job is different and the client often changes their mind. A consistent method helps you stay profitable without scaring people away.</p>

<h2>Separate shop work from site work</h2>
<p>Shop time (cutting, assembly, finishing) and installation time carry different costs and rates. Track each separately so you learn where hours go.</p>

<h2>Material takeoff</h2>
<ul>
  <li>Sheet goods and solid lumber with waste (often 10–20%)</li>
  <li>Hardware: hinges, slides, pulls, fasteners</li>
  <li>Finishing materials: stain, paint, lacquer</li>
  <li>Countertops and outsourced parts</li>
  <li>Delivery and consumables</li>
</ul>

<h2>Labour</h2>
<p>Estimate hours per component (a cabinet box, a door, a drawer, a trim run) based on your past jobs. Add time for design, drawings, client meetings and sourcing.</p>

<h2>Overhead and margin</h2>
<p>Shop rent, tools, machine wear, insurance and software need to be recovered: <a href="/tools/markup-margin-calculator/">markup vs margin</a>.</p>

<h2>Protect yourself</h2>
<ul>
  <li><strong>Deposit</strong> large enough to cover materials and special orders</li>
  <li><strong>Approved drawings</strong> before cutting</li>
  <li><strong>Change policy</strong> after approval: <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a></li>
  <li><strong>Lead time</strong> stated clearly</li>
</ul>

<h2>Compare with the market</h2>
<p>Clients benchmark against typical project budgets. See <a href="/blog/kitchen-renovation-cost-canada-2026/">kitchen renovation costs</a> and <a href="/blog/deck-installation-cost-canada-2026/">deck installation costs</a>.</p>

<h2>Quote efficiently</h2>
<p>Carpenters and cabinetmakers can use <a href="/quotes/carpenter-cabinetmaker/">quoting software built for the trade</a> to reuse component prices and send clear PDFs.</p>
`,
  "how-to-quote-a-welding-or-metal-fabrication-job": `
<p>Welding and fabrication pricing combines material, shop time, consumables and finishing. Underquoting is common because the small things (grinding, setup, handling) add up quickly.</p>

<h2>Material</h2>
<p>Price steel, stainless or aluminum by weight or length, with waste and cutting allowances. Material prices change often, so state quote validity and consider a supplier-increase clause: <a href="/blog/reduce-material-costs-contractors-canada/">material cost guide</a>.</p>

<h2>Labour</h2>
<p>Break time into layout, cutting, fit-up, welding, grinding and finishing, plus assembly and installation if on site. Include time for drawings, programming or engineering where needed.</p>

<h2>Consumables and equipment</h2>
<p>Wire, gas, discs, electrodes, PPE and machine wear. A flat consumables percentage on labour is a common shortcut.</p>

<h2>Finishing and outside services</h2>
<ul>
  <li>Powder coating, galvanizing or painting</li>
  <li>Machining or laser cutting</li>
  <li>Inspection or certification where required</li>
</ul>

<h2>Delivery and installation</h2>
<p>Transport, crane or lift rental and site access can change the price dramatically.</p>

<h2>Repair vs new fabrication</h2>
<p>Repairs have unknowns. Offer a diagnostic or hourly rate with a not-to-exceed amount, and approve extras before starting: <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a>.</p>

<h2>Set minimums</h2>
<p>A minimum charge covers setup and travel for small jobs.</p>

<h2>Margin and speed</h2>
<p>Apply overhead and margin consistently: <a href="/tools/markup-margin-calculator/">markup vs margin</a>. Welders and fabricators can build itemized quotes quickly with <a href="/quotes/welder-fabricator/">quoting software for welders and metal fabricators</a>.</p>
`,
  "how-to-quote-a-masonry-job": `
<p>Masonry and concrete quotes go wrong in two places: the part of the job you cannot see when you walk the site (rotten mortar behind a sound face, a soft subgrade under an old slab), and the calendar. A quote that names its unknowns, prices them separately and states when the work can physically be done protects your margin far better than a sharper unit price.</p>

<h2>Pick the unit that matches how the work is actually done</h2>
<p>Use units the client can check and that track your real production:</p>
<ul>
  <li><strong>Repointing</strong>: square feet of wall face, split by elevation or height band. Joint width and depth matter more than area, so note them.</li>
  <li><strong>Brick or stone veneer repair</strong>: per unit replaced (per brick, per stone) for spot repairs, square feet once you are rebuilding a section. Price sourcing matching units on its own line.</li>
  <li><strong>Chimney work</strong>: by task rather than area: rebuild above the roofline (per course or lump sum), crown, cap, flashing. Access is often the biggest cost, so price staging or roof anchors on their own line.</li>
  <li><strong>Concrete flatwork</strong> (driveways, walkways, pads): square feet for removal, base and finishing; cubic yards or cubic metres for ready-mix, since that is how the plant bills you; linear feet for forms, edges and saw cuts.</li>
  <li><strong>Interlock</strong>: square feet of paving plus linear feet of edge restraint and cut borders. Patterns with many cuts deserve a higher rate than a straight running bond.</li>
</ul>
<p>Converting area to concrete volume is where small errors compound. Square feet times thickness in feet gives cubic feet; divide by 27 for cubic yards. Add an allowance for uneven subgrade and spillage, and round up. If your rates feel thin once you have counted everything, the <a href="/blog/how-to-price-a-job-labour-materials-markup/">guide to pricing labour, materials and markup</a> walks through building them from cost.</p>

<h2>Repointing older homes: price the investigation and the mortar</h2>
<p>On pre-war brick, the wrong mortar does more damage than no repair at all. The City of Hamilton's <a href="https://www.hamilton.ca/media/11051" rel="noopener">Masonry Restoration Guidelines</a> say repointing mortar should be softer or more permeable than the masonry units and no harder than the historic mortar, warn against modern formulations with ordinary Portland cement on historic walls, and recommend cutting joints out by hand to a depth of 2 to 2&frac12; times the joint width. Hand raking is slower than grinding, and your labour line has to reflect that.</p>
<p>Practical consequences for the quote:</p>
<ul>
  <li>Include a line for a mortar test patch or sample, and say the colour and texture match is approved on that patch before full production.</li>
  <li>If the home is designated or in a heritage district, say who is responsible for any municipal heritage approval and that the mortar specification may change if the municipality requires it.</li>
  <li>Limit the scope to joints that are actually failing, and write down how you will handle joints that turn out to be loose once neighbouring mortar is removed: a per-square-foot rate for additional area is cleaner than an argument later.</li>
</ul>

<h2>Freeze-thaw: what to specify, not just what to charge</h2>
<p>Exterior flatwork in most of Canada is wet, frozen, thawed and salted every winter. The National Research Council's Canadian Building Digest <a href="https://nrc-publications.canada.ca/eng/view/object/?id=080c21f9-9875-42e3-814e-64d1fd99561c" rel="noopener">Durability of Concrete under Winter Conditions</a> (CBD-116) identifies horizontal surfaces exposed to freezing while wet and to de-icing salts as the most severe exposure, and calls air entrainment the key defence. It is an older digest; the current mix requirements sit in CSA A23.1, which your ready-mix supplier works to. On the quote, the useful thing is to state the mix in words a client can hold you to: air-entrained exterior concrete ordered for freeze-thaw and de-icing salt exposure, and the slab thickness.</p>
<p>Name the base as well. The granular base depth, compaction and slope away from the house are what keep a driveway flat through frost. Write the depth you are pricing and say that soft or wet subgrade found after removal will be dug out and replaced at a stated rate per cubic yard.</p>
<p>Cold-weather placement needs blankets, heat or accelerating admixtures, and concrete must not freeze while it is gaining early strength. Price protection as its own line or allowance rather than hiding it in the concrete rate, so a client choosing a November pour can see what it costs.</p>

<h2>Before anyone digs: locates and permits</h2>
<p>Every flatwork or interlock job involves excavation, so the locate request belongs in your process and on your schedule:</p>
<ul>
  <li><strong>Ontario</strong>: <a href="https://ontariodigauthority.ca/" rel="noopener">Ontario Dig Authority</a> (formerly Ontario One Call) says locate requests are free and required by law for any project that breaks ground, and asks for the request at least 5 business days before digging.</li>
  <li><strong>British Columbia</strong>: <a href="https://www.bc1c.ca/" rel="noopener">BC 1 Call</a> takes free locate requests online or by phone; members respond within 3 business days of notification (5 for large projects).</li>
  <li><strong>Quebec</strong>: <a href="https://www.info-ex.com/en/" rel="noopener">Info-Excavation</a> runs the free locate service for citizens, companies and municipalities.</li>
</ul>
<p>Widening a driveway or changing where it meets the street is usually a municipal matter, not just a private one. In Burnaby, for example, the City says <a href="https://burnaby.ca/services-and-payments/roads-and-traffic/traffic-requests/driveway-crossing" rel="noopener">you need a permit to build or widen a driveway</a>, property owners pay for new crossings, and the City charges for its own portion of the work and the final inspection. Check the specific city, and write into the quote who applies, who pays the fees and that boulevard work waits for approval.</p>
<p>For chimneys and other work at height in BC, WorkSafeBC requires a fall protection system where a <a href="https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/ohs-regulation/part-11-fall-protection" rel="noopener">fall of 3&nbsp;m or more may occur</a>. That setup time is real labour; quote it.</p>

<h2>Season, validity and the unknowns clause</h2>
<p>Ready-mix, aggregate and disposal prices move, and a spring quote accepted in October is a different job. Three terms cover most of it:</p>
<ul>
  <li><strong>Price validity</strong>: a fixed number of days, and a statement that the price assumes work within a named season. Work pushed into cold weather adds the protection allowance.</li>
  <li><strong>Weather</strong>: you set the pour or repointing date, and reschedule without penalty for rain or temperatures outside what the materials allow.</li>
  <li><strong>Concealed conditions</strong>: unit rates for extra base excavation, extra brick replacement and extra repointing area, applied through a signed change order. The <a href="/blog/how-to-handle-change-orders-contractors/">change order guide</a> covers the paperwork.</li>
</ul>
<p>On what clients expect to pay: we have not found a government or industry-association source that publishes current Canadian prices for driveways or repointing, so this guide gives none. Your price is driven by removal and disposal, access for the truck and pump, base depth, slab thickness, finish (broom, exposed, stamped), joint count and season.</p>

<h2>Worked example: concrete driveway replacement in British Columbia</h2>
<p>Example only: all quantities and prices below are assumptions for illustration. The job is a 600 sq ft single-car-width driveway in Burnaby, removing the cracked slab and pouring a new 5 in slab on a 6 in compacted granular base, same footprint, no widening.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Utility locate request, layout and site protection</td><td>1</td><td>lot</td><td>$150.00</td><td>$150.00</td></tr>
    <tr><td>Remove existing concrete, haul and disposal</td><td>600</td><td>sq ft</td><td>$3.25</td><td>$1,950.00</td></tr>
    <tr><td>Excavate and grade subgrade, slope away from house</td><td>600</td><td>sq ft</td><td>$1.50</td><td>$900.00</td></tr>
    <tr><td>Supply, place and compact 6 in crushed granular base</td><td>12</td><td>cu yd</td><td>$85.00</td><td>$1,020.00</td></tr>
    <tr><td>Forms and edges</td><td>110</td><td>lin ft</td><td>$4.50</td><td>$495.00</td></tr>
    <tr><td>Rebar grid on chairs</td><td>600</td><td>sq ft</td><td>$1.25</td><td>$750.00</td></tr>
    <tr><td>Ready-mix, air-entrained exterior concrete, 5 in slab</td><td>10</td><td>cu yd</td><td>$260.00</td><td>$2,600.00</td></tr>
    <tr><td>Place, broom finish, saw-cut control joints</td><td>600</td><td>sq ft</td><td>$4.00</td><td>$2,400.00</td></tr>
    <tr><td>Curing compound and early-age protection</td><td>1</td><td>lot</td><td>$350.00</td><td>$350.00</td></tr>
    <tr><td>Municipal permit and inspection fees (allowance, billed at cost)</td><td>1</td><td>allowance</td><td>$250.00</td><td>$250.00</td></tr>
  </tbody>
  <tbody>
    <tr><td>Subtotal</td><td></td><td></td><td></td><td>$10,865.00</td></tr>
    <tr><td>GST (5%)</td><td></td><td></td><td></td><td>$543.25</td></tr>
    <tr><td>Total</td><td></td><td></td><td></td><td>$11,408.25</td></tr>
  </tbody>
</table>
<p>Why it is built this way:</p>
<ul>
  <li><strong>Only GST appears.</strong> BC is a 5% GST province with a separate 7% PST, per the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA rate table</a>. But a real property contractor <a href="https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/charge-collect/pst-real-property-contractors/contractors-paying-pst" rel="noopener">pays PST on the taxable goods it acquires</a> for the contract, whether lump sum or time and materials, and generally <a href="https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/charge-collect/pst-real-property-contractors/contractors-charging-pst" rel="noopener">does not charge PST</a> on goods that become part of real property. So PST paid on the base, rebar and forms is a cost already inside those unit prices, not a line on the client's bill. The <a href="/tools/sales-tax-calculator/">sales tax calculator</a> handles other provinces.</li>
  <li><strong>Concrete is in cubic yards</strong> because the plant bills that way: 600 sq ft at 5 in is about 9.3 cu yd, rounded up to 10 for subgrade variation and waste.</li>
  <li><strong>The mix and base are named</strong>, so a cheaper bid on a thinner slab or unstated base is visibly a different product.</li>
  <li><strong>Fees are an allowance at cost</strong>, because the City sets them and they may not apply to a same-footprint replacement.</li>
</ul>
<p>BC's Builders Lien Act requires the owner to <a href="https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/97045_01" rel="noopener">retain a 10% holdback</a>, and the holdback period runs until 55 days after completion (or after a certificate of completion is issued), so plan your cash flow for it; the <a href="/tools/holdback-calculator/">holdback calculator</a> does the arithmetic, and the <a href="/provinces/british-columbia/">British Columbia page</a> collects the other provincial rules.</p>
<p>quoteAI builds this kind of itemized quote, with the province's taxes applied, and sends it to the client as a PDF. Masons and concrete crews can start from the <a href="/quotes/mason/">masonry quote page</a>.</p>
`,
  "how-to-quote-a-window-or-door-installation-job": `
<p>Most money lost on window and door jobs is lost before the first unit is ordered: a wrong measurement on a custom unit that cannot be returned, a quote that said "install" without saying retrofit or full-frame, or a rotten sill that nobody priced. The quote is where you close those gaps.</p>

<h2>Measure for the order, not just the quote</h2>
<p>A custom unit built to your numbers does not forgive a sloppy tape. Measure every opening as if the order goes in tomorrow, and number each one (W1, W2, D1) so the quote, the order form and the crew all use the same label.</p>
<ul>
  <li><strong>Retrofit (insert):</strong> measure the existing frame from jamb to jamb at the top, middle and bottom, and from head to sill at the left, centre and right. Use the smallest of each, then apply the deduction your manufacturer specifies. Check both diagonals: a frame that is out of square will not take a square insert without a gap you will have to hide.</li>
  <li><strong>Full-frame:</strong> the number that matters is the rough opening in the wall. You often cannot see it until the interior casing comes off, so either pull one casing on site or quote the unit size as provisional until a check measure.</li>
  <li><strong>Doors:</strong> note swing (inswing or outswing, left or right hand), sill height relative to the floor finish, and whether the existing threshold sits on rotten subfloor.</li>
</ul>
<p>Put it in writing: units are ordered from your final check measure. If the client insists on their own sizes, say so on the quote.</p>

<h2>Retrofit or full-frame: quote the choice, not just the price</h2>
<p>A retrofit leaves the old frame in the wall and sets a new unit inside it. It is faster and cheaper, but the glass area shrinks and any problem behind the old frame (missing flashing, wet sheathing, rot) stays there. Full-frame replacement strips the opening to the rough framing, so you can flash it properly and inspect the structure, at the cost of more labour and more interior and exterior finishing.</p>
<p>When the condition of the existing frames is uncertain, write two options on the same quote: retrofit as the base price, full-frame as an alternate per opening. The client chooses with both numbers in front of them. If the choice changes after work starts, handle it as a <a href="/blog/how-to-handle-change-orders-contractors/">change order</a>, not a verbal adjustment.</p>

<h2>Bedroom windows and egress</h2>
<p>Replacing a bedroom window can shrink its clear opening below what the building code requires for escape. In Ontario, article 9.9.10.1 of the Building Code requires an egress window in a fully open position to give an unobstructed opening of at least 0.35 m² with no dimension less than 380 mm, openable from inside without tools, as set out in the <a href="https://documents.ottawa.ca/sites/default/files/egress_windows_advsory_en.pdf" rel="noopener">City of Ottawa's building code advisory on egress windows</a>. Other provinces adopt their own version of the code, so confirm with the municipality where the job is.</p>
<p>In practice: check the manufacturer's clear-opening figure for the exact size and style you are quoting, and flag on the quote which openings serve bedrooms. Enlarging an opening to meet egress, common in basement conversions, is structural work and normally needs a permit; quote it as its own line, never as part of "installation".</p>

<h2>Spell out the energy performance</h2>
<p>Clients often ask whether a unit is "ENERGY STAR for our zone". Older brochures still describe Canadian climate zones, but the current ENERGY STAR Canada specification for windows, doors and skylights, Version 5.0, effective January 1, 2020, sets one requirement: a maximum U-factor of 1.22 W/m²·K, or alternatively a minimum Energy Rating of 34, plus air-leakage limits, according to <a href="https://canada.ca/en/environment-climate-change/services/energy-efficiency/windows-doors-skylights-energy-star-canada-technical-specification.html" rel="noopener">Natural Resources Canada's technical specification</a>. Put the certified U-factor or ER of each model on the quote; a rebate program or energy advisor will ask for it.</p>
<p>Programs change often, so do not promise a rebate in the quote. Point the client to the current program and keep your paperwork ready; our guide to <a href="/blog/canada-greener-homes-grant-rebates-contractors-guide-2026/">rebates for energy upgrades</a> covers what contractors typically need to supply.</p>

<h2>Custom units, lead time and a larger deposit</h2>
<p>Custom windows and doors are made to your measurements and generally cannot be returned or resold. Your supplier usually wants payment when the order is placed, weeks before you install. That is why the deposit on a window job is larger than on most service work: it should at least cover the product you are committing to. State on the quote the expected lead time, that it is the manufacturer's estimate, what happens if the manufacturer is late, and that a cancelled order after it is placed is not refundable for the product portion. For the wider payment schedule, see <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">how to collect payment from clients</a>.</p>
<p>One Québec caution: if you sign the contract at the client's home, you are likely an itinerant merchant under the Consumer Protection Act. The <a href="https://www.rbq.gouv.qc.ca/en/vous-etes/citoyen/travaux-de-renovation/signing-a-renovation-contract/" rel="noopener">RBQ's guide to renovation contracts</a> notes that the contract must then be in writing, the client has a 10-day cancellation period, and you cannot ask for a deposit during it. Build those 10 days into your ordering timeline.</p>

<h2>The lines that get forgotten</h2>
<ul>
  <li><strong>Exterior capping:</strong> aluminum capping over the old frame and brickmould on a retrofit, or new brickmould and flashing on a full-frame. Price it per opening; it is real labour on a ladder.</li>
  <li><strong>Interior finishing:</strong> new casing or extension jambs, caulking, and whether you leave it primed, painted or ready for the client's painter. Say which.</li>
  <li><strong>Disposal:</strong> hauling old units and paying tipping fees is a real cost. Make it a line.</li>
  <li><strong>Rot repair:</strong> price it as a unit rate (per linear foot of sill or jamb, or per opening), with zero quantity included and a note that it is billed only after you show the client the damage.</li>
  <li><strong>Access:</strong> second-storey openings over a deck or a slope may need scaffolding or a lift. If so, it is a line, not a surprise.</li>
</ul>

<h2>Warranty: say whose is whose</h2>
<p>There are two warranties on every window job and clients rarely know the difference. The manufacturer covers the product: sealed glass units, frames, hardware, according to its own written terms, which you should attach or reference by name. You cover the installation: leaks at the perimeter, operation and adjustment, your trim and capping work. State your installation period on the quote, and what voids it. When a sealed unit fogs years later, this paragraph decides who answers the call.</p>

<h2>Québec specifics on the quote itself</h2>
<p>In Québec, the <a href="https://www.rbq.gouv.qc.ca/en/frequently-asked-questions-faq/citizen/the-contractor-and-the-licence/" rel="noopener">Régie du bâtiment du Québec tells clients</a> that the contractor they hire for new construction or renovation should hold a contractor's licence, and the <a href="https://www.rbq.gouv.qc.ca/en/licence/fulfilling-your-obligations/displaying-your-licence/" rel="noopener">RBQ requires your licence number on estimates, bids, contracts, account statements and invoices</a>, in the form "RBQ licence: XXXX-XXXX-XX". Taxes are GST at 5% and QST at 9.975%, as listed on the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA's GST/HST rates page</a>, with <a href="https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/collecting-gst-and-qst/calculating-the-taxes/" rel="noopener">Revenu Québec</a> confirming that QST is calculated on the price before GST. More on the province is on our <a href="/provinces/quebec/">Québec page</a>.</p>

<h2>Sample quote: 6 vinyl retrofit windows and 1 entry door, Québec</h2>
<p>Example only: the prices below are illustrative assumptions for a two-storey house with brick cladding, not market rates.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Vinyl casement window, custom size, ENERGY STAR certified (U-factor on each label), openings W1 to W6</td><td>6</td><td>each</td><td>$850.00</td><td>$5,100.00</td></tr>
    <tr><td>Insulated steel entry door, pre-hung, 36 x 80 in., opening D1</td><td>1</td><td>each</td><td>$1,650.00</td><td>$1,650.00</td></tr>
    <tr><td>Retrofit installation: remove sashes and stops, set, shim and foam new unit</td><td>6</td><td>opening</td><td>$225.00</td><td>$1,350.00</td></tr>
    <tr><td>Entry door removal and full-frame installation, new threshold flashing</td><td>1</td><td>opening</td><td>$650.00</td><td>$650.00</td></tr>
    <tr><td>Exterior aluminum capping, windows</td><td>6</td><td>opening</td><td>$140.00</td><td>$840.00</td></tr>
    <tr><td>Exterior aluminum capping and brickmould, door</td><td>1</td><td>opening</td><td>$160.00</td><td>$160.00</td></tr>
    <tr><td>Interior casing, windows, caulked and ready for paint</td><td>6</td><td>opening</td><td>$95.00</td><td>$570.00</td></tr>
    <tr><td>Exterior perimeter sealant and backer rod</td><td>1</td><td>lot</td><td>$180.00</td><td>$180.00</td></tr>
    <tr><td>Removal and disposal of old units</td><td>1</td><td>lot</td><td>$250.00</td><td>$250.00</td></tr>
    <tr><td>Rot repair to sill or jamb, if found, billed only on client approval</td><td>0</td><td>lin. ft.</td><td>$28.00</td><td>$0.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$10,750.00</strong></td></tr>
    <tr><td>GST (5%)</td><td></td><td></td><td></td><td>$537.50</td></tr>
    <tr><td>QST (9.975%)</td><td></td><td></td><td></td><td>$1,072.31</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$12,359.81</strong></td></tr>
  </tbody>
</table>
<p>Why it is built this way:</p>
<ul>
  <li>Product and labour are separate lines, so the deposit can be tied to the product total ($6,750 plus taxes in this example) and the client can see what is non-returnable.</li>
  <li>The door is full-frame while the windows are retrofit; each line says which, so there is no argument about scope on installation day.</li>
  <li>Rot repair sits at zero with a unit price, which tells the client the risk exists and what it costs without inflating the total.</li>
  <li>Both taxes are calculated on the $10,750 subtotal, and the RBQ licence number goes in the quote header with your GST and QST numbers.</li>
</ul>
<p>quoteai builds this kind of opening-by-opening quote with the province's taxes and sends it as a PDF; the <a href="/quotes/window-door-installer/">window and door installer page</a> shows how. The <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">guide to writing a professional quote</a> covers scope, exclusions and terms.</p>
`,
};

export const BLOG_ARTICLES: BlogArticle[] = BLOG_INDEX.map((meta) => {
  const contentHtml = BLOG_CONTENT[meta.slug];
  if (contentHtml === undefined) throw new Error(`blog-data.ts: no contentHtml for article "${meta.slug}"`);
  return { ...meta, contentHtml };
});
