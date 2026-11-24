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
<p>Every price you quote is built from four numbers: what an hour of labour really costs you, what the materials cost you to get on site, what it costs to keep the business open, and the profit you want left over. Get the first one wrong and nothing below it can save the job, so that is where to start.</p>

<h2>Labour: the wage is only the first line</h2>
<p>An employee paid $32 an hour costs you more than $32 for every hour on the payroll, and a good deal more for every hour you can actually bill. Add these to the wage:</p>
<ul>
  <li><strong>Vacation pay.</strong> In Ontario it must be at least 4% of gross wages for employees with less than five years of service, and 6% after five years (<a href="https://www.ontario.ca/document/your-guide-employment-standards-act-0/vacation" rel="noopener">Ontario: your guide to the Employment Standards Act, vacation</a>). The same guide lists special rules for some industries, construction included, so check which apply to your crew.</li>
  <li><strong>CPP, employer share.</strong> For 2026 the employer matches the employee's 5.95% on pensionable earnings up to $74,600, after a $3,500 basic exemption (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html" rel="noopener">CRA: CPP contribution rates, maximums and exemptions</a>).</li>
  <li><strong>EI, employer share.</strong> The 2026 employee rate outside Québec is 1.63% of insurable earnings up to $68,900, and the employer pays 1.4 times the employee premium, which works out to 2.282% (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html" rel="noopener">CRA: EI premium rates and maximums</a>). The same page lists a lower rate for Québec, where parental benefits are handled by the province.</li>
  <li><strong>Workers' compensation.</strong> Premiums are charged per $100 of payroll, and the rate depends on the class your work falls in and, over time, on your own claims record. Look up yours rather than borrowing someone else's: <a href="https://www.wsib.ca/en/2026premiumrates" rel="noopener">WSIB 2026 premium rates</a> in Ontario, <a href="https://www.worksafebc.com/en/insurance/know-coverage-costs/industry-premium-rates/2026-rates" rel="noopener">WorkSafeBC 2026 rates</a> in British Columbia, and the <a href="https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/tarification/taux-prime" rel="noopener">CNESST taux de prime</a> in Québec. WSIB's 2026 construction class rates alone run from $1.54 to $3.55 per $100.</li>
</ul>

<h3>Billable hours, not paid hours</h3>
<p>Nobody bills every hour they are paid. Driving between jobs, supply runs, loading the truck, quoting, rain days and statutory holidays are paid but not billable. Track a few months of timesheets and work out your real ratio of billable to paid hours. Then spread the full payroll cost over the billable hours only.</p>

<h2>Overhead: what the business costs before any job starts</h2>
<p>List a year of costs that are not tied to one job: truck payments, fuel and insurance, liability insurance, tools and their replacement, phone, software, accounting, advertising, shop or storage rent, licences and association fees, and the admin time nobody bills for. Divide the total by the billable hours the whole crew will sell in a year. That gives you an overhead cost per billable hour, and every hour you quote has to carry it.</p>

<h2>Worked example: from wage to hourly rate</h2>
<p>Example only: the wage, hours, overhead and profit target below are assumptions for a small Ontario carpentry outfit (owner plus one employee), not market figures. The WSIB figure uses the 2026 class rate for specialty trades construction (G5, $2.15 per $100); your class and rate may differ.</p>
<table>
  <thead>
    <tr><th>Cost per paid hour (employee)</th><th>Basis</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Wage</td><td>assumed</td><td>$32.00</td></tr>
    <tr><td>Vacation pay</td><td>4% of wage</td><td>$1.28</td></tr>
    <tr><td>CPP, employer</td><td>5.95% of $33.28</td><td>$1.98</td></tr>
    <tr><td>EI, employer</td><td>2.282% of $33.28</td><td>$0.76</td></tr>
    <tr><td>WSIB</td><td>$2.15 per $100 of $33.28</td><td>$0.72</td></tr>
    <tr><td><strong>Payroll cost per paid hour</strong></td><td></td><td><strong>$36.74</strong></td></tr>
  </tbody>
</table>
<p>CPP comes out slightly lower in practice because of the basic exemption; rounding up keeps a small cushion. Then:</p>
<ol>
  <li><strong>Billable ratio.</strong> 2,000 paid hours a year, 1,500 billable. $36.74 &times; 2,000 &divide; 1,500 = <strong>$48.99</strong> per billable hour.</li>
  <li><strong>Overhead.</strong> $60,000 a year spread over 2,900 crew billable hours (owner and employee) = <strong>$20.69</strong> per billable hour.</li>
  <li><strong>Break-even rate.</strong> $48.99 + $20.69 = <strong>$69.68</strong>.</li>
  <li><strong>Profit.</strong> For a 20% margin, divide by 0.80: $69.68 &divide; 0.80 = $87.10. Round to <strong>$88 an hour</strong>.</li>
</ol>
<p>Price the owner's hours the same way, using the wage you would have to pay someone to replace you. The <a href="/tools/labour-rate-calculator/">labour rate calculator</a> runs these steps with your own numbers.</p>

<h2>Markup and margin are not the same percentage</h2>
<p>Markup is what you add to cost; margin is the share of the selling price that is left after cost. Selling price = cost &times; (1 + markup). Margin = (price &minus; cost) &divide; price.</p>
<p>If a job costs you $1,000 and you add 25%, you charge $1,250. Your $250 is 25% of cost but only 20% of the price. Confusing the two is how a contractor who "adds 20%" ends up with a 16.7% margin. Work backwards from the margin you need: a 30% margin takes a markup of 0.30 &divide; 0.70, or about 42.9%. In the example above, $88 on a $69.68 cost is a markup of about 26% and a margin of about 21%. The <a href="/tools/markup-margin-calculator/">markup and margin calculator</a> converts either way.</p>

<h2>Materials: price the handling, not just the receipt</h2>
<p>Passing materials through at cost means you finance them, pick them up, store them, carry the offcuts and the returns and stand behind them if something is defective. Put a handling markup on materials and set it per job: higher on small orders where the trip is most of the cost, lower on a large single item where the dollar amount is already big. Check whatever percentage you choose against your margin target.</p>
<p>Name the product and grade on the quote, so a cheaper bid built on a lower grade is visibly a different job.</p>

<h2>Contingency and allowances</h2>
<p>They solve different problems, and mixing them up causes arguments.</p>
<ul>
  <li><strong>Contingency</strong> is your money for your risk: the extra hour that old houses always need, a bit of waste above the plan. It sits inside your prices. It is not a fund for work the client adds; that is a change order.</li>
  <li><strong>An allowance</strong> is a stated amount for something the client has not chosen yet, such as a door or a light fixture. Write it as a line ("Allowance: entry door hardware, $250"), and say on the quote that the final price is adjusted up or down to what the client picks.</li>
</ul>
<p>In Ontario this matters for another reason: if an estimate is part of a contract, you cannot charge more than 10% above it unless the customer asks for additional or different goods or services and you sign a change to the contract (<a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">Ontario: a guide for home renovation and roofing businesses</a>). Build contingency in up front and handle extras as written changes; our guide to <a href="/blog/how-to-handle-change-orders-contractors/">handling change orders</a> covers the paperwork.</p>

<h2>Small jobs need a minimum charge</h2>
<p>A one-hour repair still costs the drive, the setup, the supply run and the clean-up. Set a minimum charge that covers them, such as a set number of hours at your rate, and say so before you book the visit. In the example, a three-hour minimum at $88 is $264.</p>

<h2>Worked example: pricing a small repair in Ontario</h2>
<p>Example only: hours and material costs are assumptions. Job: replace a damaged interior door slab and the casing on one side in an Ontario house, using the $88 rate above and a 15% handling markup on materials.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Labour: remove old slab and casing, mortise hinges and bore lock on new slab</td><td>2</td><td>hr</td><td>$88.00</td><td>$176.00</td></tr>
    <tr><td>Labour: hang and adjust door, transfer hardware, install casing</td><td>2</td><td>hr</td><td>$88.00</td><td>$176.00</td></tr>
    <tr><td>Labour: material pickup, setup and clean-up</td><td>1</td><td>hr</td><td>$88.00</td><td>$88.00</td></tr>
    <tr><td>Primed interior door slab, 30 x 80 in, to match existing</td><td>1</td><td>ea</td><td>$161.00</td><td>$161.00</td></tr>
    <tr><td>Primed casing, 7 ft lengths</td><td>3</td><td>ea</td><td>$20.70</td><td>$62.10</td></tr>
    <tr><td>Finishing nails, filler, caulk</td><td>1</td><td>lot</td><td>$17.25</td><td>$17.25</td></tr>
    <tr><td>Disposal of old door and trim</td><td>1</td><td>lot</td><td>$25.00</td><td>$25.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$705.35</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$91.70</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$797.05</strong></td></tr>
  </tbody>
</table>
<p>Why it is built this way:</p>
<ul>
  <li>The pickup and setup hour is on its own line: it is real time, and showing it is fairer than hiding it. Five hours of labour puts the job above the three-hour minimum.</li>
  <li>Material prices already include the 15% handling markup (a $140.00 slab becomes $161.00). The client sees one price per item, not your supplier invoice.</li>
  <li>Below the table, the quote excludes painting and any jamb repair if the frame is out of square, which would be priced as a change at the same rate.</li>
  <li>Ontario's HST is 13% (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA: GST/HST rates by province</a>), shown on its own line after the subtotal.</li>
</ul>
<p>For trade-specific line items, see <a href="/blog/how-to-quote-a-carpentry-job/">how to quote a carpentry job</a>, and for how to lay out the whole document, the guide to <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">writing a professional quote</a>.</p>

<h2>Keep the rate honest over time</h2>
<p>Redo the calculation each January, when CPP and EI rates and your workers' compensation premium change, and whenever you add a truck, a crew member or a new insurance policy. Compare quoted with actual hours on finished jobs: if one kind of work keeps running over, fix the hour estimates, not the rate. Once the rate and markups are set, apply them the same way on every quote. quoteai writes an itemized quote with the province's taxes and sends it as a PDF, so the lines the client sees can carry the rate you worked out here.</p>
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
<p>The profile is free, but Google sets the rules, and a profile that breaks them can be suspended. Every rule below links to Google's own Business Profile Help page, which is the final word when Google changes something.</p>

<h2>Check that you qualify, and pick the right profile type</h2>
<p>Google's guidelines allow a profile for a business that <a href="https://support.google.com/business/answer/3038177" rel="noopener">either has a physical location customers can visit or travels to customers where they are</a>. Most trades are the second kind: a service-area business. The same guidelines rule out a virtual office (a rented address you don't work from) and P.O. boxes, and allow one profile per business.</p>
<p>If clients don't come to you, don't show your address. The guidelines say a service-area business <a href="https://support.google.com/business/answer/3038177" rel="noopener">should hide its business address from customers</a>, and Google's service-area page goes further: if you don't serve customers at your business address, <a href="https://support.google.com/business/answer/9157481" rel="noopener">remove the address from your profile</a>. Show an address only if the location is staffed and receives customers during your stated hours.</p>

<h2>Business name: what's on your truck, nothing more</h2>
<p>The name must match the name you use in the real world: on signage, invoices and your website. Google states that adding <a href="https://support.google.com/business/answer/3038177" rel="noopener">unnecessary information to the name isn't permitted and could result in suspension</a>. The banned extras include marketing taglines, phone numbers, service descriptions and location details. "Lantern Creek Plumbing" is fine; "Lantern Creek Plumbing | 24/7 Emergency Plumber Ottawa" is not.</p>

<h2>Categories: one accurate primary, a few extras at most</h2>
<p>Google asks you to choose a <a href="https://support.google.com/business/answer/7249669" rel="noopener">primary category that best describes your business</a>, using a specific category from its list; you can't create your own. Additional categories are for distinct departments or services, and Google says not to select a category for every product or service. The same page warns that adding or editing a category can trigger a new verification, so settle categories before you verify.</p>

<h2>Service areas: up to 20, by place</h2>
<p>You can list <a href="https://support.google.com/business/answer/9157481" rel="noopener">up to 20 service areas by city, postal code or other area</a>. You can't set a radius, and the boundary of your overall area shouldn't be more than about 2 hours of driving from where the business is based. List the places you want work in, not every town you could reach.</p>

<h2>Verification: Google picks the method</h2>
<p>Your photos and videos only appear on Google <a href="https://support.google.com/business/answer/6103862" rel="noopener">after the profile is verified</a>. Google lists phone or text codes, email, a live video call, a video recording and a mailed postcard as methods, and states that <a href="https://support.google.com/business/answer/7107242" rel="noopener">verification methods are automatically determined by Google and can't be changed</a>. Postcard codes expire after 30 days, and verification reviews can take up to 5 business days. For a video, be ready to show the lettered van, tools and stock, and proof that you manage the business.</p>

<h2>Hours, phone and website</h2>
<ul>
  <li><strong>Hours.</strong> List the <a href="https://support.google.com/business/answer/3038177" rel="noopener">regular hours you are available to customers</a>, and use <a href="https://support.google.com/business/answer/7032839" rel="noopener">special hours</a> for holidays and shutdowns rather than editing your regular hours.</li>
  <li><strong>Phone.</strong> A number that reaches your business directly, under your control, preferably local rather than a call centre. Premium-rate numbers aren't accepted.</li>
  <li><strong>Website.</strong> Your own site, not a page that redirects elsewhere. Google's guidelines don't accept a social media page as the website link.</li>
  <li><strong>Description.</strong> Plain facts about what you do and where, with no links or promotions, and <a href="https://support.google.com/business/answer/7032839" rel="noopener">under 750 characters</a>.</li>
</ul>

<h2>Services, photos and posts</h2>
<p>Service businesses can list <a href="https://support.google.com/business/answer/9455399" rel="noopener">services with descriptions and prices</a>, picking from Google's suggestions or adding custom ones. Custom service names must not include prices, phone numbers or personal information, and ones that break the policy are rejected automatically. Name services the way clients describe the problem: "Water heater replacement", "Sump pump installation", "Drain camera inspection". If you list prices, keep them current.</p>
<p>For photos, Google asks for <a href="https://support.google.com/business/answer/6103862" rel="noopener">JPG or PNG files between 10 KB and 5 MB, ideally 720 by 720 pixels</a>, in focus and without heavy filters, showing what the business really looks like. Real job photos (a finished mechanical room, a neat copper run) tell a client more than stock images. Ask before photographing inside a home, and keep addresses and faces out of frame.</p>
<p><a href="https://support.google.com/business/answer/7342169" rel="noopener">Posts</a> come in three types: updates, offers and events. Google reviews each post against its content policy after you publish, and a post with a phone number that can't be tied to your business may be rejected. Posts older than 6 months are archived unless they have a date range.</p>

<h2>Features that changed: messages and Q&amp;A</h2>
<p>Don't plan around the chat button. Google ended it: <a href="https://support.google.com/business/answer/14919056" rel="noopener">as of July 31, 2024, chat and call history are no longer available in Business Profile</a>. Clients reach you by the phone number and website you list.</p>
<p>Q&amp;A is also in flux. Google <a href="https://developers.google.com/my-business/content/qanda/change-log" rel="noopener">discontinued the Q&amp;A API on November 3, 2025</a>, and its Maps help page now says answering questions about places is <a href="https://support.google.com/maps/answer/7421661" rel="noopener">only available in certain countries and regions</a>. If questions appear on your profile, answer them; either way, put the common answers (areas served, emergency calls) in your description and services.</p>

<h2>Reviews and replies</h2>
<p>Google's tips are short: <a href="https://support.google.com/business/answer/3474122" rel="noopener">be professional and polite, keep it short, don't use replies to offer deals, and never share a reviewer's private information</a>. Incentives for reviews are prohibited. Asking, wording and handling bad reviews are covered in <a href="/blog/how-to-get-more-reviews-as-a-contractor/">how to get more reviews as a contractor</a>.</p>

<h2>Owners, managers and who holds the keys</h2>
<p>Create the profile under a Google account the business controls, not an employee's personal account. Google allows <a href="https://support.google.com/business/answer/3403100" rel="noopener">several owners but one primary owner</a>; managers can edit the profile, reply to reviews and post, but can't add or remove users or delete the profile. If a web designer or marketing firm sets up the profile, make sure you are the primary owner and they are a manager.</p>

<h2>If the profile is suspended</h2>
<p>Google may <a href="https://support.google.com/business/answer/4569145" rel="noopener">suspend or disable profiles that don't follow its guidelines</a>. The fix is an appeal through Google's appeals tool, signed in to the account that manages the profile. Evidence that helps includes business registration, a business licence, tax certificates and utility bills, with the name and address matching the profile. An appeal can be submitted only once, so fix the cause (often the name, the address or a duplicate profile) first. And Google is explicit: <strong>do not create a new profile for the same business</strong>.</p>

<h2>Local Services Ads are a separate product</h2>
<p>Local Services Ads are a paid Google program, separate from your free profile. You <a href="https://support.google.com/localservices/answer/6224841" rel="noopener">pay for leads related to your business</a>, they are offered in Canada, and only certain service categories are eligible, with an eligibility check on that page. Screening can include more than the profile does: Google says <a href="https://support.google.com/localservices/answer/6226575" rel="noopener">insurance checks and background checks are required for select users in Canada</a>, and for insurance a signed certificate of insurance is the best document. Judge it like any paid lead source, as in <a href="/blog/how-to-get-more-jobs-as-a-contractor-canada/">how to get more jobs as a contractor</a>.</p>

<h2>Example: a filled profile for a two-person plumbing company in Ottawa</h2>
<p>Example only. "Lantern Creek Plumbing" is fictional: an owner who is a licensed plumber, one apprentice, one van, working from the owner's home in Ottawa's west end.</p>
<table>
  <thead>
    <tr><th>Field</th><th>What to enter</th><th>Why</th></tr>
  </thead>
  <tbody>
    <tr><td>Business name</td><td>Lantern Creek Plumbing</td><td>Matches the van, invoices and website; no city or keywords added</td></tr>
    <tr><td>Business type</td><td>Service-area business, address removed</td><td>Clients don't visit the home office</td></tr>
    <tr><td>Primary category</td><td>Plumber</td><td>The most specific category for the core business</td></tr>
    <tr><td>Additional categories</td><td>None at first</td><td>Only for a distinct line of work; edits can trigger re-verification</td></tr>
    <tr><td>Service areas</td><td>Kanata, Stittsville, Nepean, Barrhaven, Orléans, Gloucester, Manotick</td><td>Places the crew wants work in, under 2 hours' drive and 20 areas</td></tr>
    <tr><td>Hours</td><td>Mon to Fri 7:30 a.m. to 5:00 p.m.; special hours for statutory holidays</td><td>The hours someone actually answers the phone</td></tr>
    <tr><td>Phone</td><td>The business mobile, a 613 number</td><td>A local number the owner controls</td></tr>
    <tr><td>Website</td><td>The company's own site</td><td>Not a Facebook page or a directory listing</td></tr>
    <tr><td>Description</td><td>Residential repairs and replacements across Ottawa; licensed and insured; written itemized quotes</td><td>Plain facts, no links or promotions, under 750 characters</td></tr>
    <tr><td>Services</td><td>Water heater replacement; Drain clearing; Sump pump installation; Fixture and faucet replacement; Backflow preventer installation</td><td>Clients' own words; no prices or phone numbers in service names</td></tr>
    <tr><td>Photos</td><td>Logo, cover photo of the lettered van, 10 to 15 finished-job photos</td><td>Real work in focus, no addresses or faces visible</td></tr>
    <tr><td>Posts</td><td>One update after a notable job, with a photo</td><td>Keeps the profile current; posts archive after 6 months</td></tr>
    <tr><td>People and access</td><td>Owner as primary owner; office or marketing help as manager</td><td>The business keeps control if a helper leaves</td></tr>
  </tbody>
</table>
<p>When the profile brings calls, the next step is a fast, clear quote. The <a href="/blog/how-to-quote-a-plumbing-job/">guide to quoting a plumbing job</a> covers that for this trade, and quoteai writes the itemized quote with Ontario's HST and sends it as a PDF from the phone.</p>
`,
  "how-to-get-more-reviews-as-a-contractor": `
<p>Getting reviews is mostly a habit: ask clearly, at the right time, with a link that opens the review box, and do it on every job. The rest of the job is staying inside the rules: Google's review policies, the Competition Act, and Canada's anti-spam law for the emails and texts you send.</p>

<h2>Ask at handover, not weeks later</h2>
<p>The best moment is the final walkthrough, when the client has just seen the finished work, signed off any deficiencies and confirmed they're satisfied. Ask in person first ("Would you be willing to write a short review? I'll text you the link tonight"), then send the link the same day.</p>
<p>Two times not to ask: while a deficiency or a change-order dispute is still open, and as a condition of anything. If the final payment is outstanding, settle it first; asking for a review and payment in the same message muddles both. The <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">guide to collecting payment from clients</a> covers that sequence, and open extras belong in a <a href="/blog/how-to-handle-change-orders-contractors/">signed change order</a> before anyone writes a review about them.</p>

<h2>Send a direct link</h2>
<p>Google gives every verified profile a review link and QR code. From your Business Profile, choose <a href="https://support.google.com/business/answer/16816815" rel="noopener">Read reviews, then Get more reviews</a>, and copy the link. The QR code can currently only be generated in a computer browser, not on a phone, so download it once and print it on a leave-behind card or the back of your invoice. Setting up the profile itself is covered in our <a href="/blog/google-business-profile-guide-for-tradespeople/">Google Business Profile guide for tradespeople</a>.</p>

<h2>What Google prohibits</h2>
<p>Google's contribution policy sets three rules that catch contractors most often:</p>
<ul>
  <li><strong>No incentives.</strong> You can't <a href="https://support.google.com/contributionpolicy/answer/7400114" rel="noopener">offer payment, discounts, or free goods or services in exchange for posting any review</a>, or in exchange for changing or removing one. "Ten percent off your next service call for a review" is out, and so is a draw for a gift card among reviewers.</li>
  <li><strong>No cherry-picking.</strong> The same policy bars businesses from trying to <a href="https://support.google.com/contributionpolicy/answer/7400114" rel="noopener">discourage or prohibit negative reviews, or selectively solicit positive reviews</a>. This is what marketers call "review gating": sending a satisfaction survey first and passing the Google link only to people who answer "very satisfied". The fix is simple: send the same request to every client on every finished job.</li>
  <li><strong>No conflicts of interest.</strong> Google removes content based on a conflict of interest, and notes that this <a href="https://support.google.com/contributionpolicy/answer/7400114" rel="noopener">may include current or former employment</a>. Your apprentice, your spouse and your supplier rep should not be reviewing the business. The policy also bars reviews posted from several accounts by or at the request of one person.</li>
</ul>

<h2>Canadian law applies too</h2>
<p>Breaking Google's rules can cost you the reviews. Misleading reviews can also be a legal problem. The Competition Bureau has said that <a href="https://www.canada.ca/en/competition-bureau/news/2024/01/online-reviews-posted-by-employees-businesses-could-be-liable.html" rel="noopener">anyone who writes or permits writing reviews that give a false or misleading impression could be liable under the Competition Act</a>. Employees who review their employer or its competitors must disclose the connection, and if they can't disclose it, they shouldn't post. The Bureau recommends that businesses train staff on this and keep a compliance program to catch misleading employee reviews.</p>
<p>The Bureau's <a href="https://competition-bureau.canada.ca/en/deceptive-marketing-practices-digest-volume-1" rel="noopener">Deceptive Marketing Practices Digest on online reviews</a> adds that a review can mislead when there is an undisclosed material connection between the reviewer and the business, even if the review is honest, and it warns about reputation or "SEO" firms that pay third parties to post fake reviews.</p>

<h2>Emails and texts: Canada's Anti-Spam Legislation</h2>
<p>Review requests usually go by email or text, so think about CASL (<a href="https://laws-lois.justice.gc.ca/eng/acts/E-1.6/index.html" rel="noopener">S.C. 2010, c. 23</a>). The law covers commercial electronic messages, which the federal anti-spam site describes as messages that <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en" rel="noopener">encourage participation in a commercial activity</a>. The guidance doesn't single out review requests, but a request that also promotes your services ("book your spring tune-up") plainly fits, so the simplest habit is to send review requests the way the rules require for commercial messages:</p>
<ul>
  <li><strong>Consent.</strong> Express consent is a yes, verbal or written, and lasts until withdrawn. Implied consent from a business relationship <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email" rel="noopener">may be valid for up to 2 years, or 6 months for an inquiry</a>. A client whose job you just finished is in that window; a line on your quote or contract asking permission to send follow-ups gives you express consent as well. Record when.</li>
  <li><strong>Identification.</strong> The guidance says to <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email" rel="noopener">clearly identify yourself and your business</a> in the message; include the business name and how to reach you.</li>
  <li><strong>Unsubscribe.</strong> Include a way to opt out and act on it <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email" rel="noopener">within 10 business days, at no cost to the recipient</a>.</li>
  <li><strong>Texts count.</strong> The rules are <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/texting-good-client-relations" rel="noopener">technology neutral</a>, so they apply to texts as well as email, and a client who replies STOP must not get another reminder.</li>
</ul>
<p>Send one request and at most one reminder. A client who ignores both has answered.</p>

<h2>Replying to reviews, including the bad ones</h2>
<p>Google's advice for replies: <a href="https://support.google.com/business/answer/3474122" rel="noopener">be professional and polite, keep it short, don't use the reply to offer deals, never share a reviewer's private information, and apologize when appropriate</a>. Write for the next client reading it.</p>
<p>For a negative review: read it twice, check the job file, and wait until you're calm. Acknowledge the specific complaint, state the facts briefly without quoting prices, addresses or private details, and offer a direct way to resolve it. If the review breaks Google's policies (it's about a different business, it's abusive, or it came from a competitor), you can flag it. Google is clear that you <a href="https://support.google.com/business/answer/4596773" rel="noopener">shouldn't report a review just because you disagree with it</a>, that it doesn't get involved in disputes between businesses and customers, and that only reviews that violate policy are removed. If a flagged review stays up, there is a one-time appeal through the Reviews Management Tool.</p>

<h2>Other platforms</h2>
<p>Your Google profile is not the only place a client may read about you.</p>
<ul>
  <li><strong>HomeStars.</strong> Reviews are generally tied to a job posted and hired through the platform. HomeStars also <a href="https://homestars.com/review-guidelines" rel="noopener">accepts reviews from up to five customers hired outside the platform</a>, requested through your account and published only after you provide a copy of the paid invoice. Incentivised reviews are removed, and replies must stay factual and leave out the homeowner's personal information.</li>
  <li><strong>Facebook.</strong> Business Pages can <a href="https://www.facebook.com/help/548274415377576" rel="noopener">turn Recommendations on or off</a>; turning them off removes the rating and reviews from your Page. Recommendations follow Facebook's Community Standards, and you can <a href="https://www.facebook.com/help/439579999521224" rel="noopener">report one that doesn't</a>.</li>
</ul>
<p>Send clients one link, not three, so reviews build up in one place.</p>

<h2>Example: a review-request flow for a renovation crew</h2>
<p>Example only. Adjust the timing to your trade; a service call wraps up in an hour, a basement renovation over months.</p>
<table>
  <thead>
    <tr><th>When</th><th>Channel</th><th>Message</th></tr>
  </thead>
  <tbody>
    <tr><td>At signing</td><td>Quote or contract</td><td>A checkbox: "You may email or text us about this job, including follow-ups and a review request." Record the date.</td></tr>
    <tr><td>Final walkthrough</td><td>In person</td><td>"We ask every client for a short review. Would you be willing? I'll send the link tonight."</td></tr>
    <tr><td>Same evening</td><td>Text</td><td>"Hi, thanks for having us on the basement. If you have a minute, here is the link for a Google review: [link]. Honest feedback helps us, good or bad. Lantern Creek Renovations, 613-555-0100. Reply STOP to opt out."</td></tr>
    <tr><td>5 to 7 days later, only if no review</td><td>Email</td><td>One short reminder with the same link, the business name, contact details and an unsubscribe line. No offer or discount attached.</td></tr>
    <tr><td>Within a few days of any review</td><td>Google reply</td><td>A short, personal reply (samples below).</td></tr>
  </tbody>
</table>
<p>The text names the business and offers an opt-out because of CASL, says "good or bad" because selective requests break Google's policy, and offers nothing in return because incentives are prohibited.</p>
<p><strong>Example reply to a positive review:</strong></p>
<blockquote>Thanks for the review. The low ceiling around the ductwork made the drywall slow going, so we're glad the bulkheads turned out the way you pictured. Enjoy the new space.</blockquote>
<p><strong>Example reply to a negative review:</strong></p>
<blockquote>We're sorry the cleanup on your last day fell short. You're right that drywall dust was left in the laundry room, and that isn't our standard. We've changed our end-of-job checklist so the last walkthrough covers every room we worked in. We'd like to come back and clean it properly at no charge; please call the office at the number on your invoice so we can book a time.</blockquote>
<p>The positive reply is specific to the job, so it reads as written by a person. The negative one admits what was true, says what changed, and moves the conversation off the review page without sharing any of the client's details.</p>
<p>A job that starts from a clear, itemized quote is less likely to end in an argument about extras; quoteai writes that quote with your province's taxes and sends it as a PDF. For where reviews fit among your lead sources, see <a href="/blog/how-to-get-more-jobs-as-a-contractor-canada/">how to get more jobs as a contractor</a>.</p>
<p>This is general information, not legal advice.</p>
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
  "how-to-collect-payment-from-clients-contractor-canada": `
<p>Collecting money is decided mostly before the first tool comes off the truck. The deposit, the billing schedule, what counts as a complete invoice and what happens when a payment is late should all be written into the quote and contract the client signs. After that, getting paid is a matter of following your own paperwork.</p>

<h2>Deposits: what each province lets you take</h2>
<p>A deposit pays for special-order materials and holds the slot on your schedule. How much you can ask for, and when, depends on where you work and how the contract was signed.</p>
<ul>
  <li><strong>Ontario.</strong> The province's <a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">guide for home renovation and roofing businesses</a> recommends that deposits be no more than 10% of the total project cost. The same guide explains the 10-day cooling-off period for contracts signed at the customer's home: if the customer cancels in that window, you must refund the deposit within 15 days of their notice.</li>
  <li><strong>Québec.</strong> A contractor who sells, installs or repairs doors and windows, thermal insulation, or roofing or exterior wall covering at the client's home is treated as an itinerant merchant, even when the client asked for the visit (<a href="https://www.opc.gouv.qc.ca/en/consumer/topic/itinerant-sale/cancelling/doing-business-renovation-contractor" rel="noopener">Office de la protection du consommateur</a>). The client then has 10 days to cancel, and the RBQ's page on <a href="https://www.rbq.gouv.qc.ca/en/vous-etes/citoyen/travaux-de-renovation/signing-a-renovation-contract/" rel="noopener">signing a renovation contract</a> notes that the merchant cannot ask for a deposit during that period. Plan your material orders around it.</li>
  <li><strong>Alberta.</strong> If you sign home renovation contracts away from your place of business and accept money before the work is finished, you need a <a href="https://www.alberta.ca/prepaid-contracting-licence" rel="noopener">prepaid contracting business licence</a> from the province. Contracts between contractors and subcontractors are exempt.</li>
</ul>
<p>Wherever you work, tie the deposit to something concrete ("covers the vanity and tile, ordered on receipt") and credit it on a named invoice, so the client can see where it went.</p>

<h2>Progress billing that matches the work</h2>
<p>On anything longer than a few days, bill at milestones the client can see and an inspector can confirm: demolition done, rough-ins passed, drywall closed, substantial completion. Avoid calendar dates alone, because a delay that is not your fault then becomes an argument about money. Put the schedule in the contract (see <a href="/blog/how-to-write-a-contractor-contract-canada/">how to write a contractor contract</a>), and when scope changes, bill the extra on its own signed change order rather than folding it into the next stage (<a href="/blog/how-to-handle-change-orders-contractors/">handling change orders</a>).</p>

<h2>Prompt payment: where the law sets the deadline</h2>
<p>Several jurisdictions now set payment deadlines for construction work by statute, built around a "proper invoice".</p>
<ul>
  <li><strong>Ontario.</strong> Under the <a href="https://www.ontario.ca/laws/statute/90c30" rel="noopener">Construction Act</a>, proper invoices go to the owner monthly unless the contract says otherwise (s. 6.3). The owner must pay within 28 days of receiving a proper invoice, unless within 14 days it gives you a notice of non-payment in the prescribed form, stating the amount it won't pay and all of its reasons; the undisputed part is still due on day 28 (s. 6.4). A proper invoice must include your name and address, the invoice date and the period or milestone it covers, the contract or purchase order it relates to, a description of the work with quantities where appropriate, the amount and payment terms, and who to pay (s. 6.1). Unpaid amounts bear interest at the prejudgment rate, or the contract rate if that is higher (s. 6.9).</li>
  <li><strong>Alberta.</strong> The <a href="https://www.alberta.ca/prompt-payment-rules-for-construction-industry" rel="noopener">Prompt Payment and Construction Lien Act</a> applies the same 28-day and 14-day timelines to contracts made since August 29, 2022, and its proper invoice must include a statement that it is intended to be a proper invoice.</li>
  <li><strong>Saskatchewan.</strong> Prompt payment took effect on <a href="https://www.saskatchewan.ca/government/news-and-media/2022/march/01/legislation-to-protect-contractors-takes-effect-today" rel="noopener">March 1, 2022</a> for new contracts, with owners paying within 28 days of a proper invoice.</li>
  <li><strong>Federal projects.</strong> The <a href="https://laws-lois.justice.gc.ca/eng/acts/F-7.7/page-1.html" rel="noopener">Federal Prompt Payment for Construction Work Act</a> (in force December 9, 2023) covers work on federal construction projects: payment within 28 days of a proper invoice, with a 21-day window for a notice of non-payment.</li>
  <li><strong>British Columbia.</strong> The Construction Prompt Payment Act received Royal Assent on November 27, 2025 but, according to the <a href="https://www2.gov.bc.ca/gov/content/governments/infrastructure/prompt-payment-legislation" rel="noopener">province's prompt payment page</a>, is not yet in force.</li>
</ul>
<p>Even where you are not sure the statute applies to a small residential job, writing every invoice as if it were a proper invoice costs nothing and removes the easiest excuse for paying late.</p>

<h2>Example: billing a $40,000 renovation in Ontario</h2>
<p>Example only, with assumed figures: a $40,000 (before tax) basement bathroom and laundry renovation in Toronto, signed at the contractor's office. Deposit of 10% on signing, credited on the last stage invoice. The owner retains the 10% holdback that the <a href="https://www.ontario.ca/laws/statute/90c30" rel="noopener">Construction Act</a> requires (s. 22). HST is 13% in Ontario (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA GST/HST rates</a>).</p>
<table>
  <thead>
    <tr><th>Invoice</th><th>Work value</th><th>Less holdback 10%</th><th>Less deposit</th><th>Net before HST</th><th>HST 13%</th><th>Amount due</th></tr>
  </thead>
  <tbody>
    <tr><td>Deposit, on signing</td><td>$4,000.00</td><td></td><td></td><td>$4,000.00</td><td>$520.00</td><td>$4,520.00</td></tr>
    <tr><td>1. Demolition and framing complete</td><td>$10,000.00</td><td>$1,000.00</td><td></td><td>$9,000.00</td><td>$1,170.00</td><td>$10,170.00</td></tr>
    <tr><td>2. Plumbing and electrical rough-ins passed inspection</td><td>$12,000.00</td><td>$1,200.00</td><td></td><td>$10,800.00</td><td>$1,404.00</td><td>$12,204.00</td></tr>
    <tr><td>3. Drywall, waterproofing and tile complete</td><td>$10,000.00</td><td>$1,000.00</td><td></td><td>$9,000.00</td><td>$1,170.00</td><td>$10,170.00</td></tr>
    <tr><td>4. Fixtures, trim, substantial completion</td><td>$8,000.00</td><td>$800.00</td><td>$4,000.00</td><td>$3,200.00</td><td>$416.00</td><td>$3,616.00</td></tr>
    <tr><td>Holdback release</td><td></td><td></td><td></td><td>$4,000.00</td><td>$520.00</td><td>$4,520.00</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>$40,000.00</strong></td><td></td><td></td><td><strong>$40,000.00</strong></td><td><strong>$5,200.00</strong></td><td><strong>$45,200.00</strong></td></tr>
  </tbody>
</table>
<p>Why it is set up this way:</p>
<ul>
  <li>The deposit stays inside Ontario's recommended 10% and is credited on a named invoice, so there is no argument at the end about whether it was "extra".</li>
  <li>Stage 2 is triggered by a passed inspection, which a client cannot dispute the way they can dispute "about half done".</li>
  <li>The holdback is shown on every invoice so the client sees exactly what they are keeping and why. On a job with no certificate of substantial performance, your lien expires 60 days after the contract is completed or abandoned unless you preserve it (s. 31), and the owner can release the holdback once lien rights have expired. Ask your accountant how HST on the deposit and the holdback should be recorded; the table simply charges it as each amount is billed.</li>
</ul>
<p>The <a href="/tools/holdback-calculator/">holdback calculator</a> and the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> will check figures like these for your own job.</p>

<h2>Interest on overdue accounts</h2>
<p>If you intend to charge interest, it has to be in the signed contract and on the invoice. Write it as a yearly rate. Under section 4 of the federal <a href="https://laws-lois.justice.gc.ca/eng/acts/I-15/page-1.html" rel="noopener">Interest Act</a>, a written contract that states interest only as a rate per month (or any period under a year) cannot recover more than 5% a year unless it also states the equivalent yearly rate. "Overdue balances bear interest at X% per year, calculated monthly" is the safe form.</p>

<h2>When a client stops paying</h2>
<ol>
  <li><strong>Check the clock.</strong> Lien deadlines are short and they do not wait for negotiations. In Ontario, a contractor's lien must be preserved within 60 days (s. 31) and then perfected, by starting an action and registering a certificate of action, within 90 days after the last day it could have been preserved (s. 36). In British Columbia, the <a href="https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/97045_01" rel="noopener">Builders Lien Act</a> allows a claim of lien to be filed no later than 45 days after the certificate of completion, or after the contract or improvement is completed or abandoned (s. 20), and also requires a 10% holdback (s. 4). Write the dates down the day the work stops.</li>
  <li><strong>Send a written demand</strong> with the invoice, the contract clause, the amount, a date to pay and what you will do if it is not paid.</li>
  <li><strong>Pick the forum by amount.</strong> Ontario's Small Claims Court hears claims up to <a href="https://www.ontariocourts.ca/scj/areas-of-law/small-claims-court/" rel="noopener">$50,000</a>. In British Columbia, the <a href="https://civilresolutionbc.ca/solution-explorer/small-claims/" rel="noopener">Civil Resolution Tribunal</a> handles most small claims up to $5,000 and Provincial Court small claims cover cases up to <a href="https://www2.gov.bc.ca/gov/content/justice/courthouse-services/small-claims" rel="noopener">$35,000</a>. Above those limits, or when a lien is in play, talk to a construction lawyer early.</li>
</ol>

<h2>Make the invoice easy to pay</h2>
<p>Send each stage invoice the day the milestone is reached, with the contract reference, the milestone, the holdback, the tax and the due date, and offer a payment method the client can use from their phone. Keep a fixed reminder routine (a note before the due date, another the day after, then a call) so chasing money is a habit and not a mood. The same discipline keeps your cash forecast honest: see <a href="/blog/contractor-cash-flow-management-canada/">contractor cash flow management</a>. quoteai turns an accepted quote into itemized invoices with the province's taxes and sends them as PDFs, which keeps the quote, the stages and the invoices in step.</p>

<p><em>This is general information, not legal or tax advice. Check the Act for your province and get advice on your specific contract.</em></p>
`,
  "contractor-insurance-canada-what-you-need": `
<p>Two different things get called "insurance" on a job site. One is private: the liability, tools and vehicle policies you buy through a broker. The other is public: workers' compensation, run by a provincial board, which construction businesses must carry by law in most cases. GCs and property managers will ask for proof of both before you start.</p>

<h2>Commercial general liability: the policy every client asks about</h2>
<p>Commercial general liability (CGL) responds when your work injures someone who is not your worker, or damages property that is not yours: the drill bit that finds a water line, the ladder that marks a hardwood floor, the visitor who trips over your cords. Three questions matter more than the brochure:</p>
<ul>
  <li><strong>Does it include completed operations?</strong> A fitting can weep for a month before the ceiling stains. Ask whether claims that arise after the job is finished are covered.</li>
  <li><strong>What does it do about your own work?</strong> Many wordings exclude the cost of redoing your own faulty work and cover only the damage it causes to other property. Know which side of that line you are on before you promise a warranty.</li>
  <li><strong>What limit do your contracts require?</strong> The insurance clause in the subcontract or vendor agreement sets it. Read that clause before you quote: raising a limit or adding an additional insured takes time.</li>
</ul>
<p>The certificate of insurance a client receives is a summary, not the policy: named insured, insurer, dates, limits and any additional insured. If the name on it does not match the name on your contract, expect it back.</p>

<h2>Tools, equipment and the truck</h2>
<p>CGL covers damage to other people's property, not your own. A tools and equipment policy (often called a floater) covers theft and damage to your gear; ask how it treats tools left in a locked vehicle overnight, tools stored on site, and rented equipment. For the truck, tell your insurer how it is really used: tools and materials aboard, driving between sites, employees at the wheel. Find out before a claim whether the policy matches.</p>

<h2>Professional liability and bonds</h2>
<p>If you are paid for advice or design, not only installation, look at professional liability (errors and omissions): design-build renovators, contractors who size HVAC systems, anyone who inspects and reports for a fee.</p>
<p>A bond is not insurance for you. A surety guarantees your performance or your payments to the owner, and if it pays out, it looks to you to repay it under the indemnity agreement you signed. In Ontario, a contractor on a public contract (with the Crown, a municipality or a broader public sector organization) above the prescribed amount must furnish both a performance bond and a labour and material payment bond (<a href="https://www.ontario.ca/laws/statute/90c30" rel="noopener">Ontario Construction Act, s. 85.1</a>). In Québec, a licensed contractor must provide licence security to the Régie du bâtiment: the RBQ lists $20,000 for specialized subclasses and $40,000 for general subclasses (<a href="https://www.rbq.gouv.qc.ca/en/licence/offering-financial-guarantees/licence-security/obtain-licence-security/" rel="noopener">RBQ: obtain licence security</a>), and in February 2026 it published draft regulations that would raise those amounts to $30,000 and $60,000 (<a href="https://www.rbq.gouv.qc.ca/salle-de-presse/les-nouvelles/nouvelles-detail/item/2026-02-25-qualification-professionnelle-des-entrepreneurs-publication-pour-commentaires-de-deux-projets-de-reglement" rel="noopener">RBQ news release, 2026-02-25</a>). Check the current amount before you renew.</p>

<h2>Workers' compensation: who has to be covered</h2>
<h3>Ontario (WSIB)</h3>
<p>Construction has expanded compulsory coverage: independent operators, sole proprietors, some partners and some executive officers working in construction must have WSIB coverage, with or without employees, and a business has 10 calendar days from hiring its first employee to register (<a href="https://www.wsib.ca/en/businesses/registration-and-coverage/expanded-compulsory-coverage-construction-industry" rel="noopener">WSIB: expanded compulsory coverage in construction</a>). There is an exemption for home renovation work done directly for the person who lives in an existing private residence, or their family member, but it does not apply to subcontractors hired by a contractor (<a href="https://www.wsib.ca/en/operational-policy-manual/expanded-compulsory-coverage-construction" rel="noopener">WSIB policy: expanded compulsory coverage in construction</a>). In practice, the day you take work from a GC, you need coverage.</p>
<h3>British Columbia (WorkSafeBC)</h3>
<p>All employers must have WorkSafeBC coverage unless exempt, and an employer includes anyone who hires workers or unregistered subcontractors (<a href="https://www.worksafebc.com/en/insurance/need-coverage/who-needs-coverage" rel="noopener">WorkSafeBC: who needs coverage</a>). Proprietors and partners can be registered for their workers but decline Personal Coverage for themselves, and WorkSafeBC warns that whoever hires them may then be open to a lawsuit if that owner is hurt (<a href="https://www.worksafebc.com/en/insurance/need-coverage/who-needs-coverage/contractors-subcontractors" rel="noopener">WorkSafeBC: contractors and subcontractors</a>). Expect GCs to ask.</p>
<h3>Québec (CNESST)</h3>
<p>You must register with the CNESST if you hire at least one worker, full or part time, and have an establishment in Québec, and you have 60 days from your first worker's first day to do it (<a href="https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/inscription-cnesst" rel="noopener">CNESST: inscription</a>). Construction work in Québec also brings the RBQ licence and the construction industry's own rules, covered on our <a href="/provinces/quebec/">Québec page</a>.</p>
<h3>Alberta (WCB-Alberta)</h3>
<p>For most industries, coverage is required by law. Owners and directors can add optional personal coverage, and WCB-Alberta notes that without it the owner is not protected from a lawsuit if a worker, contractor or subcontractor is injured (<a href="https://www.wcb.ab.ca/insurance-and-premiums/types-of-coverage/coverage-for-contractors-and-subcontractors.html" rel="noopener">WCB-Alberta: coverage for contractors and subcontractors</a>).</p>

<h2>Why GCs ask for clearances</h2>
<p>A clearance is the board's confirmation that your account is in good standing. GCs want it because, without one, your unpaid premiums can become theirs:</p>
<ul>
  <li><strong>Ontario:</strong> a principal must get a clearance before construction work begins and keep one in effect for the whole job, and starting without one is an offence for both the principal and the contractor. Without a clearance, the principal may be liable for the contractor's obligations to the WSIB up to the labour portion of the contract. A clearance is valid for up to 90 days and is renewable (<a href="https://www.wsib.ca/en/operational-policy-manual/clearance-certificate-construction" rel="noopener">WSIB policy: clearance certificate in construction</a>).</li>
  <li><strong>British Columbia:</strong> to be relieved of a subcontractor's unpaid premiums, the hiring firm needs a clearance letter addressed to it, showing the sub was active and in good standing for the entire contract (<a href="https://www.worksafebc.com/en/insurance/why-clearance-letter" rel="noopener">WorkSafeBC: why do I need a clearance letter</a>).</li>
  <li><strong>Québec:</strong> the donneur d'ouvrage can be held responsible for a contractor's unpaid CNESST premiums, calculated on the labour cost of the contract (<a href="https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/gestion-dossier-dassurance/conformite/paiement-cotisation-due-autre-employeur" rel="noopener">CNESST: paiement de la cotisation due par un autre employeur</a>). The Attestation de conformité, requested at the end of each contract, releases them, and if they request it you have 14 days to approve or contest the contract details (<a href="https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/gestion-dossier-dassurance/conformite/services-verification-conformite" rel="noopener">CNESST: services de vérification de conformité</a>).</li>
  <li><strong>Alberta:</strong> a hirer without a clearance letter may be liable for an unpaid contractor's premiums, and WCB-Alberta advises getting one before hiring and before releasing payment (<a href="https://www.wcb.ab.ca/insurance-and-premiums/clearance-letters/" rel="noopener">WCB-Alberta: clearance letters</a>).</li>
</ul>
<p>That is why a GC may hold your final payment until a fresh clearance comes through. If you are the one hiring, the same rules run in your direction: see <a href="/blog/how-to-hire-and-pay-subcontractors-canada/">how to hire and pay subcontractors</a>.</p>

<h2>Example: the compliance file a GC or property manager will ask for</h2>
<p>Example only: which documents a client asks for, and the limits it requires, come from its own contract. Keep current copies in one folder so you can answer the same day.</p>
<table>
  <thead>
    <tr><th>Document</th><th>Issued by</th><th>What the other side checks</th><th>Keep it current</th></tr>
  </thead>
  <tbody>
    <tr><td>Certificate of insurance (CGL)</td><td>Your broker or insurer</td><td>Legal name matches the contract; limits meet the contract; dates cover the job; client named as additional insured if required</td><td>New certificate at each renewal and for each client that must be named</td></tr>
    <tr><td>WSIB clearance certificate (Ontario)</td><td>WSIB</td><td>Valid before work starts and for the whole job</td><td>Valid up to 90 days; renew before it lapses</td></tr>
    <tr><td>WorkSafeBC clearance letter (BC)</td><td>WorkSafeBC, addressed to the hirer</td><td>Active and in good standing for the contract period</td><td>Hirer requests before start and after the work</td></tr>
    <tr><td>Attestation de conformité (Québec)</td><td>CNESST</td><td>Releases the donneur d'ouvrage from your unpaid premiums</td><td>End of each contract; answer within 14 days if asked to validate</td></tr>
    <tr><td>WCB-Alberta clearance letter</td><td>WCB-Alberta</td><td>Who is covered and whether the account is in good standing</td><td>Before hiring and before final payment</td></tr>
    <tr><td>RBQ licence number and licence security (Québec)</td><td>RBQ; your surety</td><td>Licence subclass covers the work</td><td>Keep the security in force; notify the RBQ if you change surety</td></tr>
    <tr><td>Bond (when the contract calls for one)</td><td>Your surety</td><td>Bond form and amount match the contract</td><td>Per project</td></tr>
  </tbody>
</table>
<p>Why it is built this way:</p>
<ul>
  <li>The clearance rows have dates, not a yes or no: an expired clearance protects no one, so a lapsed one counts as none.</li>
  <li>Tools and vehicle policies are left off because they protect you, not the client. They belong in your own file.</li>
</ul>

<h2>Put it on the quote, and in the price</h2>
<p>Showing your insurer, your WSIB or WorkSafeBC account and, in Québec, your RBQ licence number on the quote answers the first question a careful client asks; the guide to <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">writing a professional quote</a> shows where it fits, and <a href="/blog/how-to-write-a-contractor-contract-canada/">how to write a contractor contract</a> covers the insurance clause itself. quoteai keeps those details on every itemized quote it sends as a PDF.</p>
<p>Premiums, bonds and board assessments are overhead. Spread them over your billable hours the same way as the truck and the phone; <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a> walks through the calculation, and <a href="/blog/how-to-hire-your-first-employee-contractor-canada/">hiring your first employee</a> covers what changes when the payroll is no longer only you.</p>
<p>This is general information, not legal or insurance advice. Confirm coverage with a licensed broker and registration with your provincial board.</p>
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
<p>Most renovation disputes are not about workmanship. They are about what was agreed: whether the extra outlet was included, when the second payment was due, whether the client could walk away after the cabinets were ordered. A written contract settles those questions before they come up, and in several provinces the law decides part of what it has to say.</p>

<h2>What every residential contract should cover</h2>
<ul>
  <li><strong>Parties and site:</strong> your legal business name exactly as licensed, street address, the client's name and the job address.</li>
  <li><strong>Scope:</strong> the work, materials by grade or product, and exclusions. If you wrote an itemized quote, attach it and refer to it by number.</li>
  <li><strong>Price and taxes:</strong> the total with GST/HST (and QST in Québec), with any allowances marked.</li>
  <li><strong>Payment schedule:</strong> deposit, milestones tied to events you can point to, final payment.</li>
  <li><strong>Schedule, changes, permits and subtrades:</strong> dates and what moves them, how extras get approved (see <a href="/blog/how-to-handle-change-orders-contractors/">handling change orders</a>), who pulls permits and which work is subcontracted.</li>
  <li><strong>Warranty, cancellation, disputes and insurance:</strong> see <a href="/blog/contractor-insurance-canada-what-you-need/">contractor insurance in Canada</a> for what to carry.</li>
</ul>
<p>The provincial rules below add to that list for homeowner contracts.</p>

<h2>Ontario: Consumer Protection Act, 2002</h2>
<p>Ontario's <a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">guide for home renovation and roofing businesses</a> explains how the <a href="https://www.ontario.ca/laws/statute/02c30" rel="noopener">Consumer Protection Act, 2002</a> applies to contractors. The points that change how you write a contract:</p>
<ul>
  <li>Any contract worth more than $50 must be in writing.</li>
  <li>The contract must generally include your business name, address and contact details; a fair description of the work with materials and an itemized list of products and services; warranties; the total cost and payment terms with all taxes; a work schedule with start and completion dates; any subtrades, who they are and who pays them; a payment schedule including the deposit; and who prepares the work area and cleans up.</li>
  <li>The province recommends deposits of no more than 10% of the total project cost.</li>
  <li>If an estimate is part of the contract, you cannot charge more than 10% above it unless the client asks for added or different work and you both sign a change to the contract.</li>
  <li>A contract signed at the client's home carries a 10-day cooling-off period. The client can cancel for any reason, and you must refund any deposit within 15 days of their notice. If you started work during that period because the client asked you to, you are entitled to reasonable payment for work and materials that cannot be returned.</li>
  <li>A client who never received a copy of the contract meeting the Act's requirements can cancel most contracts within one year.</li>
  <li>Section 11 of the Act says any ambiguity in a consumer agreement you provide is interpreted to the client's benefit. Vague scope wording costs you, not them.</li>
</ul>
<p>In practice: hand over a signed copy the same day, and hold special orders until the cooling-off period ends unless the client asks in writing to start. More Ontario specifics are on our <a href="/provinces/ontario/">Ontario page</a>.</p>

<h2>British Columbia: direct sales contracts</h2>
<p>In BC, the <a href="https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/04002_00" rel="noopener">Business Practices and Consumer Protection Act</a> sets rules for direct sales contracts. Consumer Protection BC's <a href="https://www.consumerprotectionbc.ca/consumer-help/consumer-information-door-door-sales/" rel="noopener">door-to-door sales page</a> describes them as contracts over $50 before taxes signed during a visit from a door-to-door sales agent. For those contracts:</p>
<ul>
  <li>The client has 10 days after receiving a copy to cancel for any reason, in writing. Without a copy, the contract is not binding.</li>
  <li>The deposit should not exceed $100 or 10% of the total price, whichever is smaller. A larger down payment, or missing required information, lets the client cancel within one year.</li>
  <li>Since August 1, 2026, door-to-door sales of furnaces, heat pumps and air conditioners, water heaters and water treatment systems, solar panel systems, duct cleaning, home security systems, and energy or window audits are banned, subject to exceptions such as an invitation from the homeowner.</li>
</ul>

<h2>Québec: RBQ licence and itinerant merchants</h2>
<p>The RBQ's page on <a href="https://www.rbq.gouv.qc.ca/en/vous-etes/citoyen/travaux-de-renovation/signing-a-renovation-contract/" rel="noopener">signing a renovation contract</a> tells homeowners to check that the name on the contract matches the company holding the RBQ licence exactly, and that the licence number is shown. It also recommends showing your NEQ and your GST and QST numbers, and breaking the price down by labour, materials, subcontractors and other costs.</p>
<p>A contractor who signs at the client's home a contract to sell, install or repair doors and windows, thermal insulation, or roofing or exterior wall covering is an itinerant merchant under the Consumer Protection Act, even when the client invited them. The Office de la protection du consommateur says the client can then cancel <a href="https://www.opc.gouv.qc.ca/en/consumer/topic/itinerant-sale/cancelling/doing-business-renovation-contractor" rel="noopener">within 10 days of receiving a signed copy</a>, even if work has started, and any payment must be refunded <a href="https://www.opc.gouv.qc.ca/en/consumer/good-service/housing-renovation/home-renovations/renovation-work/cancelling-contract/in-person-contract" rel="noopener">within 15 days of the notice</a>. The RBQ adds that the contract must be in writing, that you need an OPC itinerant merchant permit, and that you must wait 10 days before starting work and cannot ask for a deposit in that period, with some exceptions. See our <a href="/provinces/quebec/">Québec page</a> for licensing details.</p>

<h2>Alberta: prepaid contracting licence</h2>
<p>Alberta requires a <a href="https://www.alberta.ca/prepaid-contracting-licence" rel="noopener">prepaid contracting business licence</a> if you solicit, negotiate or conclude contracts for work on private dwellings in person away from your place of business and take money before the work is done. The application includes a security and a copy of your standard contract.</p>
<p>Alberta's fact sheet on <a href="https://open.alberta.ca/publications/writing-a-pre-paid-or-direct-sales-contract" rel="noopener">writing a prepaid or direct sales contract</a> lists what section 35 of the Consumer Protection Act requires: the parties, the date and place signed, a description of the work, itemized prices, a total at least as prominent as the item prices, payment terms, the start date, both signatures, the quality or type of materials, and a Buyer's Right to Cancel statement copied exactly from the regulation, with the 10-day cancellation right in at least 12-point type. The contract cannot stop the client from posting online reviews, waive their rights under the Act, or let you enforce an arbitration clause.</p>

<h2>Holdback belongs in the payment schedule</h2>
<p>Ontario's <a href="https://www.ontario.ca/laws/statute/90c30" rel="noopener">Construction Act</a> requires each payer on a contract under which a lien may arise to retain a basic holdback of 10% of the price of the services or materials supplied (section 22). BC's <a href="https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/97045_01" rel="noopener">Builders Lien Act</a> requires a 10% holdback of the greater of the value of the work provided and the payments made (section 4). Write it into the schedule so the last payment surprises no one, and check the release timing in the Act before promising a date. The <a href="/tools/holdback-calculator/">holdback calculator</a> does the arithmetic per payment.</p>

<h2>Example wording: an annotated clause set</h2>
<p>The following is example wording for an Ontario bathroom renovation signed at the client's home, to show what each clause needs to pin down. It is not a legal template; have a lawyer review your own contract before you use it.</p>
<ol>
  <li><strong>Scope.</strong> "The work is described in Quote Q-1042 dated 3 March, attached and forming part of this contract. Work not listed in Q-1042 is excluded." <em>Why: one version of the scope, not two.</em></li>
  <li><strong>Price and taxes.</strong> "Contract price $18,400.00 plus HST at 13% ($2,392.00), total $20,792.00. The vanity is an allowance of $1,200.00 before tax; the client pays or is credited the difference." <em>Why: Ontario expects the total with all taxes, and an allowance tells the client which number can move. The HST rate is from the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA's GST/HST rates page</a>.</em></li>
  <li><strong>Payment schedule.</strong> "Deposit $2,079.20 (10%) on signing. $9,356.40 when the plumbing and electrical rough-in pass inspection. $7,277.20 on substantial completion. Holdback of $2,079.20 retained under the Construction Act and paid when the holdback period ends." <em>Why: each payment is tied to an event, and the four amounts add up to the total.</em></li>
  <li><strong>Changes.</strong> "No work outside the scope will be done without a written change order stating the work, price, tax and effect on the completion date, signed by both parties." <em>Why: this is how you charge for extras without running into the 10% estimate rule.</em></li>
  <li><strong>Delays.</strong> "Start 14 April; completion 16 May. Dates move by the length of any delay caused by permit or inspection scheduling, material back-orders outside the contractor's control, or concealed conditions requiring a change order. The contractor will notify the client in writing within two business days of such a delay." <em>Why: named causes plus a notice duty beat "subject to delays".</em></li>
  <li><strong>Warranty.</strong> "Workmanship warranted for one year from completion. Manufacturer warranties pass to the client. The warranty does not cover damage from misuse or alterations by others." <em>Why: the term is your choice; state it and its limits.</em></li>
  <li><strong>Cancellation.</strong> "You may cancel this contract within 10 days of receiving a signed copy, for any reason, by written notice to the address above. Any deposit will be refunded within 15 days of your notice." <em>Why: it restates the Ontario cooling-off right in plain words. In Alberta, use the regulation's exact statement instead.</em></li>
</ol>
<p>For the quote the scope clause points to, see <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a>; quoteai writes it itemized, with the province's taxes, as a PDF you can attach.</p>

<p><em>This is general information about Ontario, British Columbia, Québec and Alberta rules, not legal advice.</em></p>
`,
  "how-to-handle-change-orders-contractors": `
<p>Extras rarely go unpaid because the client refuses to pay. They go unpaid because nobody wrote down the price before the work was done, and by the final invoice the client remembers a favour and you remember a day of labour. A change order is the page that stops that conversation from happening.</p>

<h2>When you need one</h2>
<p>Write a change order any time the signed scope, price or completion date is about to move. In practice that means:</p>
<ul>
  <li><strong>The client asks for added or different work:</strong> another pot light, a niche in the shower, a different tile.</li>
  <li><strong>The client deletes work.</strong> A credit is a change too, and writing it down protects you when they later ask why the hallway was not painted.</li>
  <li><strong>You open a wall or floor and find something the contract did not price:</strong> rot, unsupported framing, old wiring that cannot be reconnected.</li>
  <li><strong>The client's decision moves the schedule:</strong> a late selection, a product they want that is back-ordered.</li>
</ul>
<p>What does not need one: work that was in the scope all along, and fixing your own estimating miss. If you under-measured the tile, that is your cost, not the client's change.</p>

<h2>What the form must state</h2>
<p>Ontario's <a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">guide for home renovation and roofing businesses</a> tells contractors that changes in the middle of a project must be documented and communicated in writing, showing how they affect the price, scheduling and completion dates, and that both you and the client sign the changed contract. Alberta's advice to homeowners on <a href="https://www.alberta.ca/hiring-contractor" rel="noopener">hiring a contractor</a> says the same thing from the other side: any change should have the client's written approval and a signed statement from the contractor giving the increase or reduction in cost. A form that meets both reads like this:</p>
<ul>
  <li><strong>Reference:</strong> the contract or quote number, the change order number, and the date.</li>
  <li><strong>Reason:</strong> client request, or the condition found, with a pointer to the photos.</li>
  <li><strong>Scope delta:</strong> exactly what is added and what is removed, in the same itemized style as the original quote.</li>
  <li><strong>Price:</strong> each line, the subtotal, the tax line at the province's rate, and the change total.</li>
  <li><strong>Revised contract total:</strong> the previous total plus or minus this change, so nobody has to add up five change orders at the end.</li>
  <li><strong>Time impact:</strong> working days added, and the new completion date. If there is no impact, say "none".</li>
  <li><strong>Payment:</strong> when this amount is due, usually with the next progress payment.</li>
  <li><strong>Signatures and dates</strong> from both parties, before the work starts.</li>
</ul>
<p>The tax line matters. A change order is part of the contract price, and the GST/HST or QST applies to it the same way it applies to the original work. The <a href="/tools/sales-tax-calculator/">sales tax calculator</a> gives you the line for any province.</p>

<h2>The Ontario 10% rule</h2>
<p>Section 10 of Ontario's <a href="https://www.ontario.ca/laws/statute/02c30" rel="noopener">Consumer Protection Act, 2002</a> says that if a consumer agreement includes an estimate, you cannot charge more than 10% above it. If you do, the client can require you to do the work at the estimated price. The same section lets you and the client amend the price when the client requires additional or different goods or services.</p>
<p>That is the whole case for change orders in Ontario. A renovation that grows by 15% through signed change orders is fine: each change amended the agreement. A renovation that grows by 15% through extras agreed in the driveway and added to the final invoice puts the whole overrun at risk: charge more than 10% over the estimate and the client can insist on the estimated price. The rule also means a concealed condition is safest handled as a written change, signed before you fix it, rather than absorbed into an overrun you plan to explain later. For how an estimate differs from a fixed quote in the first place, see <a href="/blog/quote-vs-estimate-vs-invoice-difference/">quote vs estimate vs invoice</a>.</p>

<h2>Make the contract do half the work</h2>
<p>A change order is easier to ask for when the contract already says you will. The changes clause in your contract should state that no work outside the scope is done without a written change order showing the work, price, tax and time impact, signed by both parties. Our guide to <a href="/blog/how-to-write-a-contractor-contract-canada/">writing a contractor contract</a> has example wording. With that clause signed, "let me write that up before I start" is not a negotiating move; it is the procedure the client already agreed to.</p>
<p>Add a concealed-conditions sentence too: that conditions hidden behind finished surfaces are not included in the price, and that if found, you will stop, show the client, and price the remedy as a change order.</p>

<h2>Allowances are not change orders</h2>
<p>An allowance is a placeholder amount in the contract for something the client has not chosen yet: a vanity, light fixtures, tile. When the client picks a $1,650 vanity against a $1,200 allowance, the $450 difference is an allowance adjustment that the contract already provides for. It does not change the scope.</p>
<p>Record it anyway, on a short adjustment line or the next progress invoice, with the tax on the difference. Where allowances turn into changes is when the selection changes the work: a vessel sink that needs a different drain height, a heavy fixture that needs blocking. The product cost is an adjustment; the extra labour is a change order.</p>

<h2>Concealed conditions: document before you fix</h2>
<p>When you open up a floor and find rot, the client was not there when you found it. Your photos are their only view, so take them as if someone will question them later:</p>
<ol>
  <li>Photograph the area before you start demolition, then again as soon as the condition is exposed, before you remove anything more.</li>
  <li>Include a tape measure or a known object in the frame so the size is clear.</li>
  <li>Take a wide shot that shows where in the house it is, and close-ups of the damage.</li>
  <li>Keep the photos with their date and time, in the job file, and reference them on the change order.</li>
  <li>If you can, show the client in person or by video call before you write the price.</li>
</ol>
<p>Then stop work in that area until the change order is signed. Waiting half a day costs less than a dispute over the final payment. Track the hours separately too, so your <a href="/blog/how-to-track-job-costs-contractors/">job costing</a> shows what the surprise actually cost.</p>

<h2>Example: a filled change-order form</h2>
<p>Example only, with assumed prices. Contract C-1042 (Ontario bathroom renovation, original total $20,792.00 including HST). Change order 2, dated 22 April. Reason: water-damaged subfloor and two damaged joists found under the old tub after removal; photos 14 to 19 in the job file.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Cut out and dispose of water-damaged subfloor</td><td>32</td><td>sq ft</td><td>$6.50</td><td>$208.00</td></tr>
    <tr><td>Sister damaged floor joists with new 2x8, glued and bolted</td><td>2</td><td>each</td><td>$185.00</td><td>$370.00</td></tr>
    <tr><td>Install 3/4 in. tongue-and-groove plywood subfloor, glued and screwed</td><td>32</td><td>sq ft</td><td>$9.00</td><td>$288.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$866.00</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$112.58</td></tr>
    <tr><td><strong>Change order total</strong></td><td></td><td></td><td></td><td><strong>$978.58</strong></td></tr>
  </tbody>
</table>
<p>Below the table: revised contract total $21,770.58. Time impact: 2 working days; completion moves from 16 May to 20 May. Payment: due with the substantial-completion payment. Signed and dated by both parties before the repair starts.</p>
<p>The HST rate is from the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA's GST/HST rates page</a>. Why it is written this way:</p>
<ul>
  <li>Each line is priced by quantity, the same way the original quote was, so the client can see the subfloor area matches the photos.</li>
  <li>The reason and photo numbers sit above the table, because "why is this extra" is the first question the client will ask.</li>
  <li>The revised total and new completion date are stated outright, so the next progress invoice matches what was signed.</li>
</ul>
<p>Price change-order work with the same markup logic as the original job; interrupted work usually carries more setup per hour, not less. See <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a> for the method. quoteai can write a change like this as an itemized quote with the province's tax and send it as a PDF for the client to accept before you start.</p>

<p><em>This is general information about Ontario and Alberta guidance, not legal advice.</em></p>
`,
  "how-to-hire-and-pay-subcontractors-canada": `
<p>Bringing in another trade solves a scheduling problem and creates four paperwork problems: whether the person is really a subcontractor, whether their workers' compensation is in good standing, how the payment flows down with holdback and sales tax, and the year-end T5018 slip. Each one is cheaper to settle before the sub starts than after.</p>

<h2>Is this person a subcontractor at all?</h2>
<p>The label in your agreement does not decide it. The CRA looks at the actual working relationship, and a payer's wish that a worker be self-employed does not make it so (<a href="https://www.canada.ca/en/revenue-agency/services/tax/canada-pension-plan-cpp-employment-insurance-ei-rulings/employee-self-employed.html" rel="noopener">CRA: employment status, employee or self-employed</a>). The longer CRA guide <a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4110/employee-self-employed.html" rel="noopener">Employee or Self-employed (RC4110)</a> walks through each factor, and the CRA also publishes guidance specific to construction workers (<a href="https://www.canada.ca/en/revenue-agency/services/tax/canada-pension-plan-cpp-employment-insurance-ei-rulings/cpp-ei-explained/canada-pension-plan-employment-insurance-explained-1.html" rel="noopener">CRA: construction workers</a>). The points that come up on real jobs:</p>
<ul>
  <li><strong>Control.</strong> Giving a sub the drawings and specifications does not by itself mean you control how the work is done. Telling them which hours to work, in what order, under your supervision, points the other way.</li>
  <li><strong>Tools.</strong> Bringing small hand tools is not a strong sign either way. Owning and maintaining the major equipment is.</li>
  <li><strong>Helpers.</strong> A self-employed sub can hire helpers or send someone else. An employee has to do the work personally.</li>
  <li><strong>Pay and risk.</strong> A self-employed worker is usually paid by the job and can make or lose money on it. Hourly or daily pay with no risk looks like employment.</li>
  <li><strong>A business of their own.</strong> A business licence, a separate bank account, liability insurance and supplier accounts all point to self-employment.</li>
</ul>
<p>If the contract is formed in Québec, the Civil Code applies and the CRA uses a different, three-step approach (<a href="https://www.canada.ca/en/revenue-agency/services/tax/canada-pension-plan-cpp-employment-insurance-ei-rulings/employee-self-employed/determine-employment-status.html" rel="noopener">CRA: determine the employment status</a>). Either you or the worker can ask the CRA for a CPP/EI ruling when it is unclear.</p>
<p>Workers' compensation boards apply their own tests. WorkSafeBC, for example, says a contractor who supplies only labour, or labour and minor materials such as nails or drywall tape, or works regular hours for you on an ongoing basis, is likely your worker, and you would owe their premiums (<a href="https://www.worksafebc.com/en/insurance/need-coverage/who-needs-coverage/contractors-subcontractors" rel="noopener">WorkSafeBC: contractors and subcontractors</a>). If the answer is "employee", read <a href="/blog/how-to-hire-your-first-employee-contractor-canada/">hiring your first employee</a> instead.</p>

<h2>What the subcontract should say</h2>
<p>It can be two pages, but it should exist before the sub's first day. Cover:</p>
<ul>
  <li><strong>Scope</strong> tied to the drawings or your quote to the owner, with what is excluded, and who supplies which materials.</li>
  <li><strong>Price and payment terms</strong>: how often they invoice, what an invoice must show (business name, GST/HST number, description), how much you hold back and when it is released.</li>
  <li><strong>Changes</strong> only on a signed change order, priced before the work; the <a href="/blog/how-to-handle-change-orders-contractors/">change order guide</a> has the form.</li>
  <li><strong>Insurance and workers' compensation</strong>: the liability certificate you need, a valid clearance before the start date, and a fresh one before final payment.</li>
  <li><strong>Schedule, site rules, safety, clean-up and warranty</strong> on their portion, so defects come back to them, not only to you.</li>
  <li><strong>Information for the T5018</strong>: their legal name, address and business number or SIN, collected up front.</li>
</ul>
<p>For the clauses themselves, see <a href="/blog/how-to-write-a-contractor-contract-canada/">how to write a contractor contract</a>.</p>

<h2>Clearance before day one</h2>
<p>If your sub does not pay its workers' compensation premiums, the board can come to you. In Ontario, the principal who hires a contractor for construction work must obtain a WSIB clearance before the work begins and keep one in effect throughout; starting without it is an offence for both of you, and without one you may be liable for the sub's unpaid amounts up to the labour portion of the subcontract (<a href="https://www.wsib.ca/en/operational-policy-manual/clearance-certificate-construction" rel="noopener">WSIB policy: clearance certificate in construction</a>). WSIB clearances are valid for up to 90 days, and the maximum fine for a conviction under the Act is $100,000 (<a href="https://www.wsib.ca/en/clearancefaqs" rel="noopener">WSIB: questions and answers on clearances</a>).</p>
<p>In British Columbia, protection from a sub's unpaid premiums requires a clearance letter addressed to you, confirming the sub was active and in good standing for the entire contract; WorkSafeBC says to get one before and after the work (<a href="https://www.worksafebc.com/en/insurance/why-clearance-letter" rel="noopener">WorkSafeBC: why do I need a clearance letter</a>). Québec and Alberta work the same way in principle; the <a href="/blog/contractor-insurance-canada-what-you-need/">contractor insurance guide</a> covers the CNESST attestation and WCB-Alberta clearances.</p>

<h2>Holdback and prompt payment flow down</h2>
<p>In Ontario, every payer on a contract or subcontract under which a lien may arise must retain a holdback of 10% of the price of the services or materials as they are supplied (<a href="https://www.ontario.ca/laws/statute/90c30" rel="noopener">Ontario Construction Act, s. 22</a>). The owner holds back from you, and you hold back from your sub. The same Act sets the clock: the owner pays a proper invoice within 28 days of receiving it unless it gives a notice of non-payment (s. 6.4), and a contractor who is paid must pay each sub whose work was in that invoice within seven days (s. 6.5). If you dispute part of a sub's work, the Act's notice of non-payment is how you do it. Other provinces have their own lien and holdback statutes; the <a href="/tools/holdback-calculator/">holdback calculator</a> handles the arithmetic.</p>

<h2>GST/HST on sub invoices</h2>
<p>Before you claim input tax credits on a sub's invoice, check the GST/HST number they gave you in the CRA's <a href="https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/confirming-a-gst-hst-account-number.html" rel="noopener">GST/HST Registry</a>. The CRA's documentation rules scale with the invoice: from $100 the invoice must show the supplier's registration number and the tax charged, and from $500 it must also show your name, a brief description and the payment terms (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html" rel="noopener">CRA: input tax credits</a>). A sub who is not registered charges no GST/HST, so there is no credit to claim.</p>
<p>Holdback has a tax wrinkle: when a holdback is required by law or by the written contract, the tax on the held-back amount is payable on the earlier of the day it is paid out and the day the holdback period expires (<a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/19-1/real-property-gst-hst.html" rel="noopener">CRA GST/HST Memorandum 19-1, para. 82</a>). Agree with your subs and your accountant how invoices will show it.</p>

<h2>The T5018 slip</h2>
<p>The Contract Payment Reporting System applies to you if all three conditions hold: more than 50% of your business income comes from construction, you paid Canadian-resident subcontractors for construction services, and your payments to a sub in the year were more than $500, not counting GST/HST (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/completing-filing-information-returns/t5018-slip-statement-contract-payments.html" rel="noopener">CRA: T5018 slip</a>). The same page says:</p>
<ul>
  <li>Payments for goods only are not reported.</li>
  <li>The amount you report includes GST/HST and PST, and it goes in the year it is paid, so a holdback released in March is next year's number.</li>
  <li>You can report on a calendar year or on your fiscal period.</li>
  <li>The slip carries the sub's business number or SIN; your own account number goes only on the CRA's copy.</li>
</ul>
<p>The return is due six months after the end of the reporting period you chose (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/file-information-returns-slip-summaries/when-to-file.html" rel="noopener">CRA: when to file information returns</a>).</p>

<h2>Example: one month of sub payments, with the T5018 fields</h2>
<p>Example only: an Ontario renovation contractor's November record. Names are placeholders and amounts are assumptions. HST is 13% in Ontario (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA: GST/HST rates by province</a>). Holdback here is 10% of the pre-tax value of work.</p>
<table>
  <thead>
    <tr><th>Subcontractor</th><th>BN or SIN on file</th><th>GST/HST # checked</th><th>Clearance valid to</th><th>Value of work</th><th>HST</th><th>Holdback</th><th>Paid in Nov.</th><th>Paid this year, incl. tax</th><th>T5018</th></tr>
  </thead>
  <tbody>
    <tr><td>Drywall sub (corporation)</td><td>BN</td><td>Yes</td><td>Jan. 20</td><td>$8,000.00</td><td>$1,040.00</td><td>$800.00</td><td>$8,240.00</td><td>$31,240.00</td><td>Yes</td></tr>
    <tr><td>Electrical sub (sole proprietor)</td><td>BN</td><td>Yes</td><td>Dec. 15</td><td>$3,200.00</td><td>$416.00</td><td>$320.00</td><td>$3,296.00</td><td>$3,296.00</td><td>Yes</td></tr>
    <tr><td>Caulking sub (not GST/HST registered)</td><td>SIN</td><td>Not registered</td><td>Dec. 2</td><td>$400.00</td><td>$0.00</td><td>$40.00</td><td>$360.00</td><td>$360.00</td><td>Not yet</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$11,600.00</strong></td><td><strong>$1,456.00</strong></td><td><strong>$1,160.00</strong></td><td><strong>$11,896.00</strong></td><td></td><td></td></tr>
  </tbody>
</table>
<p>How to read it:</p>
<ul>
  <li>"Paid in Nov." is value of work plus HST, minus holdback ($8,000 + $1,040 &minus; $800 = $8,240). The holdback goes on a separate list with its release date.</li>
  <li>The caulking sub is under the $500 test so far this year, but the column runs all year: one more visit and the slip is required.</li>
  <li>Only the HST on the two registered subs' invoices can be claimed as an input tax credit.</li>
  <li>The clearance column is a date, because a lapsed clearance protects no one. The electrical sub's runs out mid-December, so a fresh one is needed before the next payment.</li>
</ul>

<h2>Price subs into your own quote</h2>
<p>A sub's price is your cost, not your price. You coordinate them, carry the holdback, finance the gap between paying them and being paid, and stand behind their work under your warranty. Mark it up like any other cost; the <a href="/tools/markup-margin-calculator/">markup and margin calculator</a> shows what a given markup leaves you. On the quote to the owner, show the sub's work as its own priced lines so a change to their scope is easy to trace; quoteai lays those lines out with the province's taxes in the PDF it sends.</p>
<p>This is general information, not legal or tax advice. Confirm your situation with an accountant, your provincial workers' compensation board and, for holdback disputes, a construction lawyer.</p>
`,
  "how-to-scale-a-contracting-business-canada": `
<p>Growing a trade business means selling more hours than one person can work. The hard part is not finding those hours: it is making sure each new one pays for itself plus the overhead it drags in. The stages below follow the usual path from owner on the tools to owner running crews, with the decisions that come up at each step.</p>

<h2>The trap: revenue without margin</h2>
<p>Before adding anyone, look at what each job leaves you after labour, materials and overhead. A business that loses a little on every job does not fix that by doing more jobs: it loses more, and needs more cash to do it, because wages and materials are paid before clients pay you. Growth widens that gap. A bigger crew means a bigger payroll every two weeks, more materials bought on account and more invoices waiting to be paid.</p>
<p>So the first growth step is knowing your numbers per job. If you don't yet compare estimate against actual on every job, start with <a href="/blog/how-to-track-job-costs-contractors/">how to track job costs</a>, and plan the cash side with the <a href="/blog/contractor-cash-flow-management-canada/">cash flow guide</a>. The capacity example at the end of this article shows how revenue can double while the owner's share shrinks.</p>

<h2>Stage 1: solo, with the office in the truck</h2>
<p>At this stage you are estimator, crew and bookkeeper. Two habits make the next stage possible: a quoting routine that produces the same itemized format every time, so someone else can learn it later (see <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a>), and a job record for every job: address, scope, hours, materials, photos, invoice. quoteai writes the itemized quote with your province's taxes and sends it as a PDF, which keeps that record in one place from the first job.</p>

<h2>Stage 2: first help, subcontractor or employee</h2>
<p>The first extra pair of hands is usually either a subcontractor for specific work or an employee who works under your direction. The label you choose doesn't decide it. The Canada Revenue Agency's guide <a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4110/employee-self-employed.html" rel="noopener">Employee or Self-employed (RC4110)</a> explains that the CRA looks at the parties' intent and then at the facts: the level of control the payer has, who provides the tools and equipment, whether the worker can subcontract or hire assistants, the worker's financial risk, responsibility for investment and management, and opportunity for profit. In Québec, the same guide describes a different set of factors. A "sub" who works only for you, on your schedule, with your tools, may be an employee in the CRA's eyes.</p>
<ul>
  <li><strong>Subcontractors</strong> suit work outside your trade or peaks you can't predict. You pay per job, they carry their own tools, insurance and workers' compensation account. Setting them up properly is covered in <a href="/blog/how-to-hire-and-pay-subcontractors-canada/">how to hire and pay subcontractors</a>.</li>
  <li><strong>An employee</strong> suits steady work in your own trade, where you want control over how and when it is done and someone you can train. Payroll account, source deductions, workers' compensation and the real hourly cost are in <a href="/blog/how-to-hire-your-first-employee-contractor-canada/">how to hire your first employee</a>.</li>
</ul>

<h2>Stage 3: systems before the second crew</h2>
<p>With two or three people, the business stops fitting in your head. Before adding a second crew, three systems need to work without you:</p>
<ul>
  <li><strong>Quoting:</strong> a price list with current labour rates, standard line items for your common jobs and a validity period on every quote, so a lead hand could price a simple job the way you would.</li>
  <li><strong>Scheduling:</strong> a shared calendar that shows who is where, what materials are due and which inspections are booked. The <a href="/blog/construction-project-management-small-contractors/">job site management guide</a> covers sequencing, daily logs and closeout.</li>
  <li><strong>Job costing:</strong> hours logged against each job daily, materials receipts attached to the job, and a weekly look at jobs running over.</li>
</ul>

<h2>Business structure: sole proprietor or corporation</h2>
<p>Ontario's business guide on <a href="https://www.ontario.ca/page/business/start/decide-ownership-structure" rel="noopener">deciding on an ownership structure</a> calls the sole proprietorship the easiest and most common way to start a business, and sets out the trade-off. It is easy and inexpensive to set up and its income is taxed at your personal rate, but you are responsible for all debts and losses, and creditors can take personal assets. A corporation is a legal entity separate from you, with limited liability, but it costs more to set up, its tax rules are more complex and it requires annual filings and corporate records. You can incorporate federally or provincially, and the same page notes that a sole proprietorship not using the owner's own name has to register that name.</p>
<p>Limited liability has limits in practice: lenders and suppliers can ask owners of small corporations for personal guarantees, and insurance still matters. Ontario's guide says to consult a lawyer or professional advisor before incorporating, and the decision usually turns on income level and tax planning, which is a question for an accountant.</p>

<h2>GST/HST registration</h2>
<p>Growth often pushes a solo operator past the small-supplier limit. The CRA's page on <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html" rel="noopener">when to register for and start charging the GST/HST</a> says you stay a small supplier while you don't exceed $30,000 in taxable sales over four consecutive calendar quarters. If you exceed $30,000 in a single quarter, you must charge tax on the sale that took you over and register. If you exceed it over four quarters but not in one, you stop being a small supplier at the end of the month after that quarter. One large job in a busy quarter can trigger the single-quarter rule.</p>

<h2>Licensing as the work grows</h2>
<p>Taking on bigger or different work can need a different licence. In Québec, the Régie du bâtiment du Québec issues licences by subclass, and a general contractor's licence covers work in one or more of <a href="https://www.rbq.gouv.qc.ca/en/licence/determining-your-licence-subclasses/general-contractor-subclasses/" rel="noopener">11 general contractor subclasses</a>, including 1.2 (small buildings), 1.3 (all buildings) and 1.9 (building mechanicals). A contractor licensed for small buildings who starts bidding larger ones needs to check the subclass first. <a href="https://www.rbq.gouv.qc.ca/en/licence-6/modifying-a-licence/adding-a-class-or-a-subclass/" rel="noopener">Adding a subclass</a> means applying to modify the licence, writing examinations for subclasses in Schedules I and II, and allowing processing time: the RBQ says it processes a complete application within 60 days. Plumbing and electrical subclasses go through the Corporation des maîtres mécaniciens en tuyauterie du Québec and the Corporation des maîtres électriciens du Québec.</p>
<p>Other provinces license by trade rather than by subclass. In Ontario, for example, the Electrical Safety Authority states that anyone hired to do electrical work in a home <a href="https://esasafe.com/compliance/what-you-need-to-know/" rel="noopener">must by law be a Licensed Electrical Contractor</a>. If growth means adding a service outside your trade, check who is allowed to do it before you quote it.</p>

<h2>Seasonal work and winter planning</h2>
<p>Exterior trades lose months to winter, and some interior and HVAC trades see their own lulls. A crew makes this sharper: an employee's wage keeps running when the work stops. Plan the slow months during the busy ones:</p>
<ul>
  <li><strong>Sell slow-season work in advance.</strong> Book interior painting, bathrooms or basements for the quiet months while clients are already talking to you.</li>
  <li><strong>Add recurring work.</strong> Annual inspections, tune-ups, maintenance visits and, where it fits, snow-related services.</li>
  <li><strong>Add a related service you are qualified for</strong>, such as a roofer adding eavestrough repair or a painter adding drywall repair.</li>
  <li><strong>Market before demand comes back.</strong> Update photos and your profile, ask recent clients for reviews and follow up on quotes that went quiet.</li>
  <li><strong>Use quiet weeks on the business:</strong> update the price list, review job costs, service equipment, train the crew.</li>
  <li><strong>Hold cash back</strong> from busy months to cover payroll and overhead through the slow ones.</li>
</ul>

<h2>Example: crew size, billable hours and what is left</h2>
<p>Example only. Assumptions: 1,800 paid hours a year per person; the owner bills 60% of their hours while working on the tools, 50% when also running a crew and none when running two crews; employees bill 75%; a blended billing rate of $85 an hour; each employee costs $35 an hour with payroll costs; part-time office help costs $30,000 a year; materials are left out because they pass through. Change any of these to your own figures.</p>
<table>
  <thead>
    <tr><th>Crew</th><th>Billable hours per year</th><th>Labour revenue at $85/h</th><th>Employee cost</th><th>Overhead</th><th>Left for owner pay and profit</th></tr>
  </thead>
  <tbody>
    <tr><td>Owner alone</td><td>1,080</td><td>$91,800</td><td>$0</td><td>$30,000</td><td>$61,800</td></tr>
    <tr><td>Owner + 1 employee</td><td>2,430</td><td>$206,550</td><td>$63,000</td><td>$40,000</td><td>$103,550</td></tr>
    <tr><td>Owner + 2 employees</td><td>3,600</td><td>$306,000</td><td>$126,000</td><td>$50,000</td><td>$130,000</td></tr>
    <tr><td>Owner off the tools, 4 employees in two crews, part-time office help</td><td>5,400</td><td>$459,000</td><td>$282,000</td><td>$70,000</td><td>$107,000</td></tr>
  </tbody>
</table>
<p>The last row is the trap in numbers. Revenue is more than double the second row, yet less is left than with two employees, because the owner's own billable hours disappear and office help and overhead arrive. The step only pays if the rate rises, utilisation stays up or the owner's time goes into selling better-margin work. Utilisation is the sensitive figure: in the last row, each 5 points of lost utilisation across four employees is 360 hours, or $30,600 of revenue at the same cost.</p>
<p>This is general information, not legal or tax advice. For your structure, registration and licensing, check the official sources linked above and talk to an accountant or lawyer in your province.</p>
`,
  "how-to-track-job-costs-contractors": `
<p>The bank balance at year end tells you whether the business made money. It does not tell you which jobs made it, which lost it, or which line of your estimate is wrong every time. Job costing answers those questions by recording every cost against the job and the estimate line it belongs to, then comparing the two while the job is still running and again when it closes.</p>

<h2>Start with cost codes that match your estimate</h2>
<p>A cost code is just a short label for a type of work or cost: 01 Demolition, 02 Disposal, 08 Tile labour. Their only job is to let you put the estimate and the actual cost side by side, so the codes must be the same ones your estimate is built from. If you quote a bathroom as twelve lines, track it on the same twelve lines.</p>
<ul>
  <li><strong>Keep the list short.</strong> Short enough that the crew can pick the right code without asking. If a code is never used, delete it; if people keep guessing, merge two.</li>
  <li><strong>Split labour from materials</strong> on the lines where both happen, because they go wrong for different reasons: hours overrun on site, materials overrun at the counter.</li>
  <li><strong>Give subcontractors their own codes.</strong> A fixed-price sub should land exactly on estimate; when it doesn't, you want to see why.</li>
  <li><strong>Add a code for each change order</strong> so extra work and its cost stay out of the original lines.</li>
</ul>

<h2>Capture labour the day it happens</h2>
<p>Hours written up from memory on a Friday are guesses, and labour is the line where guesses cost the most. Have each person log hours by job and cost code every day, on a phone or a paper sheet in the truck. Price the hours at your loaded rate (wage plus vacation pay, CPP, EI, workers' compensation and non-billable time), not the bare wage; the <a href="/tools/labour-rate-calculator/">labour rate calculator</a> works that rate out. Count your own hours too. An owner's unpaid evening on site is still a cost of the job, and leaving it out makes a job look better than it was.</p>

<h2>Record committed costs, not only paid ones</h2>
<p>A cost is committed when you have agreed to it: a purchase order to the supplier, a signed subcontract, a special order. It hits the job before the invoice arrives. If you only count bills already paid, the job looks healthy right up to the month the plumber's invoice lands. For each open job keep three figures per cost code:</p>
<ol>
  <li><strong>Cost to date:</strong> labour logged plus invoices received.</li>
  <li><strong>Committed:</strong> purchase orders and subcontracts agreed but not yet invoiced.</li>
  <li><strong>Estimate to complete:</strong> your honest view of what is still to be spent.</li>
</ol>
<p>Their sum is the forecast final cost. Compare it to the estimate every week on a running job, not at the end.</p>

<h2>Know when to stop and write a change order</h2>
<p>A variance is either your estimate being wrong or the job changing. They need different responses. If tile labour runs long on a standard layout, that is your estimate, and the lesson goes into the next quote. If the floor comes up and the subfloor is rotten, the scope has changed. The moment a line's forecast passes its estimate because of something that was not in the quote, stop work on that item, write it up and get it signed before you go on. Costs spent before the client agrees are the hardest to recover. See <a href="/blog/how-to-handle-change-orders-contractors/">how to handle change orders</a> for the form and the wording.</p>

<h2>Example: job-cost sheet for a bathroom renovation</h2>
<p>Example only, with assumed figures. A full bathroom renovation quoted at $19,500 before tax, with one signed change order for $900 to replace a rotten section of subfloor. Labour is costed at an assumed loaded rate of $55 an hour. The job is closed, so committed costs and estimate to complete are zero.</p>
<table>
  <thead>
    <tr><th>Code</th><th>Item</th><th>Estimate</th><th>Actual</th><th>Variance</th><th>Note</th></tr>
  </thead>
  <tbody>
    <tr><td>01</td><td>Demolition labour</td><td>$880 (16 h)</td><td>$1,100 (20 h)</td><td>+$220</td><td>Tile set on mortar bed, slower removal</td></tr>
    <tr><td>02</td><td>Disposal bin</td><td>$450</td><td>$450</td><td>$0</td><td></td></tr>
    <tr><td>03</td><td>Plumbing subcontract</td><td>$3,200</td><td>$3,200</td><td>$0</td><td>Fixed price</td></tr>
    <tr><td>04</td><td>Electrical subcontract</td><td>$1,400</td><td>$1,400</td><td>$0</td><td>Fixed price</td></tr>
    <tr><td>05</td><td>Waterproofing and backer materials</td><td>$620</td><td>$690</td><td>+$70</td><td>Extra membrane roll</td></tr>
    <tr><td>06</td><td>Tile materials</td><td>$1,850</td><td>$1,980</td><td>+$130</td><td>Waste on large-format cuts</td></tr>
    <tr><td>07</td><td>Tile labour</td><td>$2,200 (40 h)</td><td>$2,860 (52 h)</td><td>+$660</td><td>Niche and large-format leveling</td></tr>
    <tr><td>08</td><td>Fixtures (vanity, toilet, valve trim)</td><td>$2,400</td><td>$2,400</td><td>$0</td><td></td></tr>
    <tr><td>09</td><td>Drywall and paint labour</td><td>$660 (12 h)</td><td>$770 (14 h)</td><td>+$110</td><td></td></tr>
    <tr><td>10</td><td>Drywall and paint materials</td><td>$280</td><td>$260</td><td>-$20</td><td></td></tr>
    <tr><td>11</td><td>Consumables</td><td>$150</td><td>$210</td><td>+$60</td><td>Blades, thinset top-up</td></tr>
    <tr><td>CO-1</td><td>Subfloor repair (change order)</td><td>$0</td><td>$640</td><td>+$640</td><td>Billed at $900, signed before work</td></tr>
    <tr><td></td><td><strong>Total cost</strong></td><td><strong>$14,090</strong></td><td><strong>$15,960</strong></td><td><strong>+$1,870</strong></td><td></td></tr>
    <tr><td></td><td><strong>Revenue before tax</strong></td><td><strong>$19,500</strong></td><td><strong>$20,400</strong></td><td><strong>+$900</strong></td><td>Contract plus CO-1</td></tr>
    <tr><td></td><td><strong>Gross margin</strong></td><td><strong>$5,410 (27.7%)</strong></td><td><strong>$4,440 (21.8%)</strong></td><td><strong>-$970</strong></td><td></td></tr>
  </tbody>
</table>
<p>What the sheet says:</p>
<ul>
  <li>The change order did its job: the subfloor cost $640 and was billed at $900, so the surprise added margin instead of eating it.</li>
  <li>Almost all of the loss is labour on the original scope: 18 more hours than estimated, 12 of them in tile. That is an estimating problem. Next time, price large-format tile and niches from your actual hours per square foot on this job, not from a general bathroom figure. The <a href="/blog/how-to-quote-a-tiling-job/">tiling quote guide</a> covers how to build those lines.</li>
  <li>Material variances are small and explainable. They do not need a price change, just a slightly larger waste allowance on large-format tile.</li>
</ul>

<h2>WIP and over- or under-billing, in plain terms</h2>
<p>On longer jobs, compare what you have billed with what you have actually earned. A simple way to measure earned value is by cost: if you have spent 60% of the estimated cost, treat the job as 60% complete.</p>
<p>Example: a $40,000 job with an estimated cost of $30,000 and $18,000 spent so far is 60% complete, so it has earned $24,000. If you have billed $30,000, you are <strong>over-billed</strong> by $6,000: the cash is ahead of the work, and that money is already owed back to the job as labour and materials. If you have billed only $18,000, you are <strong>under-billed</strong> by $6,000: you are financing the client, and the next invoice is late. A schedule of open jobs showing contract, estimated cost, cost to date, percent complete, earned, billed and the difference is all a work-in-progress (WIP) report is. Under-billing across several jobs at once is one of the quickest ways to run short of cash; see <a href="/blog/contractor-cash-flow-management-canada/">contractor cash flow management</a>.</p>

<h2>Keep the records</h2>
<p>Timesheets, supplier invoices, subcontractor bills, purchase orders and change orders are also your tax records. The CRA's general rule is that you keep required records and supporting documents for six years from the end of the last tax year they relate to (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/keeping-records/where-keep-your-records-long-request-permission-destroy-them-early.html" rel="noopener">CRA: where to keep your records and for how long</a>). Filing them by job and cost code serves both purposes at once.</p>

<h2>Use the history to price the next job</h2>
<p>After every job, spend fifteen minutes on the sheet: what ran over, why, and what the quote should have said. Update your production rates (hours per fixture, per square foot of tile, per sheet of drywall) and material allowances from the actuals, then rebuild your price from the corrected costs, overhead and margin, as in <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a>. Check the result with the <a href="/tools/markup-margin-calculator/">markup and margin calculator</a> so a 21.8% job is not mistaken for a 27.7% one. When each quote in quoteai is itemized on the same lines you track, comparing quoted to actual is a matter of reading two columns.</p>

<p><em>This is general information, not tax or accounting advice. Ask your accountant how job costs and work in progress should be reported for your business.</em></p>
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
<p>On a small renovation, delays often come from a vanity that is still on back order after demolition, a plumber booked the day before the rough-in is ready, an inspection nobody requested, or a client who didn't know a decision was due. A light system that a two- or three-person crew can keep up from a phone handles all of these.</p>

<h2>Build the schedule around inspections and lead times</h2>
<p>Start with what you don't control, inspections and deliveries. Treat every required inspection as a milestone on the schedule, with the work before it as a deadline. The City of Toronto's page on <a href="https://www.toronto.ca/services-payments/building-construction/building-permit/after-you-apply-for-a-building-permit/building-inspections/about-building-inspections/when-to-call-for-inspection-of-small-buildings/" rel="noopener">when to call for inspections of small buildings</a> is a good model of what a municipality expects on a house or small commercial job under Part 9 of the Ontario Building Code:</p>
<ul>
  <li>you notify the inspector when the project is ready for each required inspection, and inspections take place within the next two business days of the date you request;</li>
  <li>plumbing rough-in (water supply, drains, waste and vents) is inspected at completion and ready for testing, and there is a final plumbing inspection when fixtures are installed;</li>
  <li>the stamped permit plans must be on site, and anything covered before it has passed inspection has to be uncovered;</li>
  <li>property owners must book a final inspection to close the permit, and the page warns that open permits can complicate a future sale or permit application.</li>
</ul>
<p>Your municipality's list will differ in detail, so read it when the permit is issued and put each inspection on the calendar. Electrical work runs on a separate track in Ontario: the Electrical Safety Authority says that <a href="https://esasafe.com/compliance/what-you-need-to-know/" rel="noopener">having a building permit isn't the same as filing an electrical notification</a>, that you may need both; the Licensed Electrical Contractor files the notification and requests the inspection.</p>
<p>For materials, make one list with a "needed on site by" date for each item, and confirm stock or a delivery date before you set the start date. On a bathroom, that means the vanity, toilet, shower valve and trim, tile, membrane and any glass that is measured after tile. Don't open walls until the long-lead items are in hand or confirmed.</p>

<h2>Sequence trades by ready conditions, not dates alone</h2>
<p>Give each trade a date and the condition that must be true before they arrive: "plumber Thursday, once the floor is open and new blocking is in." Confirm the day before, by text, with the address, the time and what is ready. If the condition isn't met, move the trade before they drive over rather than paying for a wasted visit or losing their next open day.</p>
<p>Keep one sequence for the job and share it with everyone on it: protection and demolition, framing, rough-ins, rough-in inspections, close-up, finishes, fixtures, final inspections.</p>

<h2>Site meetings that take fifteen minutes</h2>
<p>Hold a pre-start meeting with the homeowner before day one. Cover access and keys, parking, work hours, dust protection, which washroom the crew may use, where materials are stored and, most important, the dates by which the client must make each remaining decision (tile, paint colour, fixture finish). Write the answers down and send them the same day.</p>
<p>On jobs longer than a week, a short weekly meeting on site with the lead hand and any trade starting that week keeps everyone on the same sequence. Write down what was decided and who does what by when.</p>

<h2>Daily logs and photos</h2>
<p>A daily log takes two minutes at the end of the day and answers questions months later: date, who was on site and for how long, work done, deliveries received, inspections and results, problems, and anything the client asked for. Log hours against the job so the same record feeds your job costing.</p>
<p>Photograph before work starts (including existing damage), every rough-in before it is covered, every inspection sticker or report, and the finished work. Tag photos by date and room; rough-in photos settle later questions about what is behind the wall.</p>

<h2>Safety obligations are a project task</h2>
<p>Some safety paperwork is due before work begins, so it goes on the schedule. In Ontario, the Regulation for Construction Projects, <a href="https://www.ontario.ca/laws/regulation/910213" rel="noopener">O. Reg. 213/91</a>, sets several requirements a small contractor can trip over:</p>
<ul>
  <li><strong>Registration (section 5).</strong> Before beginning work at a project, each constructor and employer engaged in construction completes an approved registration form, and the constructor keeps each employer's form at the project while that employer is working there.</li>
  <li><strong>Notice of project (section 6).</strong> The constructor must notify the Ministry before beginning work if, among other conditions, the total cost of labour and materials is expected to exceed $50,000, or the work is the erection or structural alteration of a building more than two storeys or more than 7.5 metres high, or a trench a person may enter is more than 1.2 metres deep and over 30 metres long. The form can be filed at the nearest Ministry office or electronically, and if the work will take no more than 14 days, the information can be given to an inspector by fax or phone. The completed form must be posted conspicuously at the project or be available there for an inspector.</li>
  <li><strong>Trenches (section 7).</strong> Where section 6 does not apply but there is a trench more than 1.2 metres deep that a worker may enter, the constructor must notify the nearest Ministry office before work begins.</li>
</ul>
<p>Add up labour and materials at the quote stage, not on start day: a larger renovation package or an addition can cross the $50,000 line. Other provinces have their own occupational health and safety rules.</p>

<h2>Keep the homeowner informed</h2>
<p>Silence causes a lot of friction on a renovation. Send a short update at a regular time, such as every Friday afternoon: what got done, what happens next week, any inspection booked, and any decision or payment due from the client. When the client asks for something different, put it through a written change order before the work is done; see <a href="/blog/how-to-handle-change-orders-contractors/">how to handle change orders</a>. The <a href="/blog/how-to-write-a-contractor-contract-canada/">contractor contract guide</a> covers the clauses that set this up.</p>

<h2>Closing out the job</h2>
<ul>
  <li><strong>Deficiency list.</strong> Walk the finished work with the client, write down every item, agree a date to fix them and get a signature or written confirmation when they are done.</li>
  <li><strong>Permits and certificates.</strong> Book the final inspections so the permit is closed, and give the client the ESA Certificate of Acceptance or your province's equivalent where electrical work was done.</li>
  <li><strong>Warranty package.</strong> Your own workmanship warranty in writing (what it covers, for how long, how to reach you), manufacturer warranties and registration cards, and care instructions for finishes such as grout sealer or a glass shower.</li>
  <li><strong>Final invoice.</strong> Send it the day the deficiencies are signed off, matching the contract and any change orders. Where holdback applies, the <a href="/tools/holdback-calculator/">holdback calculator</a> works out the amount. For chasing late payment, see <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">how to collect payment from clients</a>.</li>
</ul>
<p>Price the work in the same itemized format from the start, and the final invoice is easy to check against it: quoteai writes the itemized quote with your province's taxes and sends it as a PDF.</p>

<h2>Example: a two-week bathroom renovation schedule</h2>
<p>Example only. Assumptions: a main-floor bathroom in a house in Toronto; the tub is replaced with a tiled shower and the drain is relocated, so a building permit with plumbing inspections has been issued; a Licensed Electrical Contractor adds a fan and new lighting and files the ESA notification; every fixture and the tile are on site before day 1; ten working days, Monday to Friday. Actual inspection dates depend on when the inspector can attend.</p>
<table>
  <thead>
    <tr><th>Day</th><th>Task</th><th>Trade</th><th>Inspection / milestone</th></tr>
  </thead>
  <tbody>
    <tr><td>1 (Mon)</td><td>Floor and hallway protection, dust barrier, demolition to studs, remove tub</td><td>Own crew</td><td>Pre-start walk with homeowner; all materials checked against the order list</td></tr>
    <tr><td>2 (Tue)</td><td>Framing changes, blocking for vanity and grab bar, subfloor repair</td><td>Carpenter</td><td>Photos of existing conditions logged</td></tr>
    <tr><td>3 (Wed)</td><td>Drain relocation, supply lines, shower valve rough-in</td><td>Plumber</td><td>Plumbing rough-in ready for testing; inspection requested</td></tr>
    <tr><td>4 (Thu)</td><td>Fan, lighting and receptacle rough-in, fan duct to exterior</td><td>Electrician (LEC)</td><td>Electrician requests ESA inspection</td></tr>
    <tr><td>5 (Fri)</td><td>Clean-up; no close-up work</td><td>Own crew</td><td>City plumbing rough-in inspection (target); rough-in photos of every wall; Friday update to homeowner</td></tr>
    <tr><td>6 (Mon)</td><td>Insulation where an exterior wall was opened, cement board, shower pan</td><td>Own crew</td><td>Close-up only after rough-in inspections are passed</td></tr>
    <tr><td>7 (Tue)</td><td>Waterproofing membrane, drywall on ceiling and dry walls</td><td>Own crew</td><td>Shower flood test before tile</td></tr>
    <tr><td>8 (Wed)</td><td>Floor and shower wall tile</td><td>Tile setter</td><td>Homeowner confirms grout colour (decision due by day 6)</td></tr>
    <tr><td>9 (Thu)</td><td>Grout and sealer, drywall finishing, prime and paint</td><td>Tile setter, painter</td><td>Glass shower door measured</td></tr>
    <tr><td>10 (Fri)</td><td>Set toilet and vanity, shower trim, fan, fixtures and devices</td><td>Plumber, electrician</td><td>Final plumbing inspection requested; deficiency walk-through with homeowner</td></tr>
  </tbody>
</table>
<p>Why it is built this way: day 5 is kept free of close-up work because the walls can't be closed until the rough-ins pass, so an inspection that slips a day costs a morning, not a reopened wall. The grout decision is due before tile starts. The glass is measured after tile to fit the finished opening, so the shower door arrives after the two weeks; say so at the pre-start meeting.</p>
<p>This is general information, not legal advice. Check the current regulation and your municipality's inspection requirements for each project.</p>
`,
  "contractor-cash-flow-management-canada": `
<p>Profit and cash are different numbers. Profit is what a job leaves you once every bill is counted. Cash is what is in the account on the Thursday payroll goes out. A contracting business pays wages every two weeks, pays its supplier at month end and remits payroll deductions on a fixed date, while clients pay on milestones and the holdback arrives weeks after the last day on site. Managing cash flow means seeing those dates in advance and arranging them so the account never goes below zero.</p>

<h2>Where the gap comes from</h2>
<ul>
  <li><strong>Labour is paid first.</strong> Your crew is paid for the hours of a stage before you can invoice that stage.</li>
  <li><strong>Materials are bought before they are installed.</strong> Special orders are often paid before the job starts.</li>
  <li><strong>Clients pay on their schedule.</strong> In Ontario, Alberta and Saskatchewan, prompt payment law gives an owner 28 days after a proper invoice to pay, so a stage finished on the 1st may not be paid until the end of the month. The details are in <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">how to get paid on time</a>.</li>
  <li><strong>The holdback comes last.</strong> On Ontario jobs the owner keeps 10% of the value of work done (<a href="https://www.ontario.ca/laws/statute/90c30" rel="noopener">Construction Act</a>, s. 22) until lien rights expire, which for a contractor is 60 days after completion if no certificate of substantial performance is published (s. 31). That is part of your margin sitting in someone else's account for two months or more.</li>
  <li><strong>Taxes leave in lumps.</strong> HST collected over a quarter or a year goes out in one payment, and payroll deductions go out monthly.</li>
</ul>

<h2>Know your tax dates and keep the tax money apart</h2>
<p>The GST/HST you collect belongs to the government from the moment the client pays. The CRA assigns your filing period from your annual taxable supplies: annual at $1,500,000 or less, quarterly above that up to $6,000,000, and monthly above $6,000,000, and you can elect to file more often (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-account/change-account.html" rel="noopener">CRA: change your GST/HST account</a>). Monthly and quarterly returns and payments are due one month after the period ends. Most annual filers must file and pay three months after their fiscal year-end; a sole proprietor with a December 31 year-end pays by April 30 and files by June 15 (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/file-gst-hst-return/reporting-requirements-deadlines.html" rel="noopener">CRA: reporting requirements and deadlines</a>). An annual filer whose net tax for the previous year was $3,000 or more may also have to pay quarterly instalments (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/pay-instalment/need-to-pay-by-instalments.html" rel="noopener">CRA: GST/HST instalments</a>).</p>
<p>Annual filing is the trap. It feels like a year of extra cash, and then one large cheque falls due in the spring, often just before the busy season starts. The fix is mechanical: open a second business account and move the tax portion of every client payment into it the day the payment lands. In Ontario that is 13/113 of each HST-included payment (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA GST/HST rates</a>); the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> will split any amount for your province. BDC makes the same point about keeping a separate business account for business money (<a href="https://www.bdc.ca/en/articles-tools/money-finance/manage-finances/making-most-working-capital" rel="noopener">BDC: making the most of working capital</a>).</p>
<p>If you have employees, source deductions are another fixed date. For a regular remitter, the CRA's due date is the 15th day of the month after the month you paid your employees (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/remitting-source-deductions/how-when-remit-due-dates.html" rel="noopener">CRA: when to remit</a>). Put it in the forecast as a line of its own, not as part of payroll.</p>

<h2>Build a rolling forecast</h2>
<p>BDC recommends a 13-week rolling cash flow forecast, updated at the start of every week, because it gives much tighter visibility than the cash line in a monthly budget (<a href="https://www.bdc.ca/en/articles-tools/money-finance/manage-finances/making-projection-coming-year" rel="noopener">BDC: plan your cash flow in the coming year</a>). For a contractor, it needs only a few rows:</p>
<ul>
  <li><strong>Cash in:</strong> each invoice by the week you realistically expect payment, not the week you send it. Deposits, stage payments and holdback releases on their own lines.</li>
  <li><strong>Tax set-aside:</strong> the GST/HST portion of each receipt, moved to the tax account.</li>
  <li><strong>Cash out:</strong> net payroll on pay weeks, source deductions on the 15th, supplier statements on their due date, subcontractors, and fixed costs (truck, insurance, phone, software, rent).</li>
  <li><strong>Closing balance:</strong> the only number that matters. Any week it goes negative is a problem you can still fix.</li>
</ul>

<h2>Example: an eight-week forecast</h2>
<p>Example only, with assumed figures. A three-person renovation company in Ontario with three jobs on the go, operating account only (HST is moved to a separate tax account as it arrives). Assumptions: payroll of $7,200 net every second week; source deductions of $3,900 due the week of the 15th; a supplier statement of $9,500 due at month end in week 5; an electrical sub of $4,000 in week 6; fixed costs averaged at $900 a week; client payments shown HST-included at 13%.</p>
<table>
  <thead>
    <tr><th>Week</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th></tr>
  </thead>
  <tbody>
    <tr><td>Opening balance</td><td>14,000</td><td>23,100</td><td>15,000</td><td>15,200</td><td>7,100</td><td>11,700</td><td>-400</td><td>-1,200</td></tr>
    <tr><td>Client payments (incl. HST)</td><td>11,300</td><td>0</td><td>5,650</td><td>0</td><td>16,950</td><td>0</td><td>4,520</td><td>11,300</td></tr>
    <tr><td>HST moved to tax account</td><td>-1,300</td><td>0</td><td>-650</td><td>0</td><td>-1,950</td><td>0</td><td>-520</td><td>-1,300</td></tr>
    <tr><td>Payroll (net)</td><td>0</td><td>-7,200</td><td>0</td><td>-7,200</td><td>0</td><td>-7,200</td><td>0</td><td>-7,200</td></tr>
    <tr><td>Source deductions</td><td>0</td><td>0</td><td>-3,900</td><td>0</td><td>0</td><td>0</td><td>-3,900</td><td>0</td></tr>
    <tr><td>Supplier statement</td><td>0</td><td>0</td><td>0</td><td>0</td><td>-9,500</td><td>0</td><td>0</td><td>0</td></tr>
    <tr><td>Subcontractor</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>-4,000</td><td>0</td><td>0</td></tr>
    <tr><td>Fixed costs</td><td>-900</td><td>-900</td><td>-900</td><td>-900</td><td>-900</td><td>-900</td><td>-900</td><td>-900</td></tr>
    <tr><td><strong>Closing balance</strong></td><td><strong>23,100</strong></td><td><strong>15,000</strong></td><td><strong>15,200</strong></td><td><strong>7,100</strong></td><td><strong>11,700</strong></td><td><strong>-400</strong></td><td><strong>-1,200</strong></td><td><strong>700</strong></td></tr>
  </tbody>
</table>
<p>Every job in this example is profitable, and the account still goes negative in weeks 6 and 7 because the supplier statement, a sub and two payrolls land between client payments. Seen five weeks ahead, the fixes are simple: invoice the week 8 stage the day it is reached and ask for payment on receipt, move the subcontractor's payment to its contract date if it was early, or draw on a line of credit arranged while the numbers were good. If the week 5 payment slipped by two weeks, the balance would fall below -$15,000 in week 6, which is why receipts go in on the date you expect, not the date you hope.</p>

<h2>Supplier terms and credit</h2>
<p>A trade account with 30-day terms lets you buy materials for a stage, install them, invoice and often be paid before the statement is due. Pay those statements on time to keep the terms. BDC notes that a supplier that won't move on price may still offer better payment terms, so ask (<a href="https://www.bdc.ca/en/articles-tools/money-finance/manage-finances/making-most-working-capital" rel="noopener">BDC</a>). For the gaps that remain, BDC describes a line of credit as the usual tool to bridge payables and receivables, and suggests asking your lender for repayment terms that put more principal in the high season and less in the low season (<a href="https://www.bdc.ca/en/articles-tools/money-finance/manage-finances/seasonal-business-cash-flow" rel="noopener">BDC: managing cash flow in a seasonal business</a>). Arrange credit before you need it; lenders are more comfortable when you can show a forecast.</p>

<h2>Plan the slow season in the busy one</h2>
<p>BDC's seasonal guide points out that construction companies often slow down in winter while equipment and overhead costs stay the same. Whatever your slow months are, use the forecast to see the slow stretch coming, then:</p>
<ul>
  <li><strong>Book slow-season work while you are busy.</strong> Interior jobs such as basements and bathrooms can be sold in the fall for a winter start, with a confirmed date as the incentive.</li>
  <li><strong>Add recurring or complementary work.</strong> Maintenance visits, inspections, snow clearing for landscapers, eavestrough and winterizing work for roofers, drywall repair for painters.</li>
  <li><strong>Go back to quotes that did not close.</strong> A spring quote that stalled can be the winter job; see <a href="/blog/how-to-follow-up-on-quotes-contractors/">following up on quotes</a>.</li>
  <li><strong>Market before demand arrives.</strong> Update your Google profile and photos ahead of the season (<a href="/blog/google-business-profile-guide-for-tradespeople/">Google Business Profile guide</a>).</li>
  <li><strong>Set aside cash from every busy-season payment</strong> to cover fixed costs through the slow months, and use the quiet weeks to review job costs and update your prices.</li>
</ul>

<h2>Find the leak behind a recurring shortfall</h2>
<p>If the forecast keeps turning negative even when invoices are paid on time, the problem is usually margin, not timing. Compare what each job was quoted at against what it actually cost (<a href="/blog/how-to-track-job-costs-contractors/">tracking job costs</a>), then fix the rates in your next quote (<a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job</a>). quoteai puts the province's tax on every itemized quote and invoice, which makes the tax set-aside a figure you can read off the invoice rather than work out.</p>

<p><em>This is general information, not tax or financial advice. Confirm your filing period and remittance dates in your CRA account and with your accountant.</em></p>
`,
  "how-to-quote-a-painting-job": `
<p>A painting quote is mostly a labour estimate with a materials list attached. The labour is where jobs get lost: prep nobody looked at, a sheen that shows every roller mark, a building that only allows work after six. Price those openly and the paint itself is the easy part.</p>

<h2>Area or rooms: choose a unit the client can check</h2>
<p>Per-room pricing is fast and clients understand it, but rooms vary too much to price blind. A bedroom with a vaulted ceiling and four windows is not the same job as a square one. Use room prices only when you have measured enough similar rooms to trust them, and say what a "room" includes: walls only, or walls, ceiling, trim and door.</p>
<p>For anything larger, measure wall area. Perimeter times height gives the gross area; subtract large openings such as garage doors, storefront glazing or walls of built-ins, and ignore ordinary doors and windows, which you will paint around anyway (doors and frames get their own line). Count separately:</p>
<ul>
  <li>Ceilings, in square feet, with their height, because a 3.6 m ceiling needs different equipment than a 2.4 m one.</li>
  <li>Trim, in linear feet: baseboard, casing, crown, chair rail.</li>
  <li>Doors and frames, each, noting panel doors versus flat slabs.</li>
  <li>Anything special: stairwells, radiators, exposed ductwork, accent walls with a separate colour.</li>
</ul>
<p>Write the measured quantities on the quote. A client comparing three bids can then see whether the other painters measured the same building.</p>

<h2>Prep is its own line</h2>
<p>Prep is the part of the job that varies most and that clients see least. Walk every surface with a light and note what it needs: nail pops, drywall cracks, water stains that will bleed through, glossy enamel that needs scuff-sanding or a bonding primer, failing caulk, peeling or chalking exterior paint, mildew. Price it as hours or as a lot, separate from painting labour, and describe it in words: "patch and sand all holes and cracks, spot-prime repairs, stain-block water marks in boardroom."</p>
<p>A separate prep line does two things. It shows the client why your number differs from the bid that skipped it, and it gives you a clean basis for a <a href="/blog/how-to-handle-change-orders-contractors/">change order</a> when the wallpaper comes off and the drywall underneath is torn.</p>

<h2>Coats and products: name them</h2>
<p>"Two coats of paint" is not a specification. Name the product line, the sheen and the number of coats for each surface: for example, two coats of a commercial-grade eggshell on walls, semi-gloss on doors and frames, flat on ceilings. Add a primer coat where the surface needs one (new drywall, repairs, a strong colour change, stains, bare wood) and say where. If the client picks a premium line or a deep colour that needs extra coats, it is visible on the quote rather than a surprise on the invoice.</p>
<p>Product choice also has a legal side. The federal <a href="https://laws-lois.justice.gc.ca/eng/regulations/SOR-2009-264/FullText.html" rel="noopener">VOC Concentration Limits for Architectural Coatings Regulations</a> prohibit manufacturing, importing, selling or offering for sale architectural coatings above set VOC limits, by category: 100 g/L for flat coatings, 150 g/L for non-flat coatings and 250 g/L for high-gloss coatings not listed elsewhere, with separate limits for primers, stains, floor coatings and specialty products. The limits fall on manufacturers, importers and sellers, but they explain why some solvent-based products are no longer on the shelf and why a "low-VOC" request from a client is usually easy to meet. Read the label and data sheet for the category.</p>

<h2>Production rates: use your own</h2>
<p>Labour hours come from production rates: how many square feet of wall your crew cuts and rolls per hour, how many doors per day, how many linear feet of baseboard per hour. There is no reliable public table of Canadian painting rates, and a rate from someone else's crew on someone else's walls will be wrong for yours. Build your own from timesheets on finished jobs, split by surface and by conditions: empty versus furnished rooms, standard versus tall ceilings, smooth versus textured walls, one colour versus several.</p>
<p>Then cost the hours at a loaded rate that covers wages, payroll costs, vehicles, insurance and unbilled time. The <a href="/tools/labour-rate-calculator/">labour rate calculator</a> works it out, and the guide to <a href="/blog/how-to-price-a-job-labour-materials-markup/">pricing labour, materials and markup</a> covers the rest.</p>

<h2>Older buildings: assume lead until tested</h2>
<p>Health Canada's <a href="https://www.canada.ca/en/health-canada/services/home-safety/lead-based-paint.html" rel="noopener">lead-based paint guidance</a> says a home built before 1960 probably contains lead-based paint, and that the exterior of one built between 1960 and 1990 may too. It advises against sanders, heat guns and blowlamps for removing it, because they create dust and fumes with lead, suggests testing paint chips at a lab, and says to keep children and pregnant women away from the work area.</p>
<p>For the quote: on any older building where you will sand or scrape, either price testing first or write the job around methods that do not create dust, with containment, cleanup and disposal as their own lines. If the client declines testing, record that on the quote.</p>

<h2>Exterior work: weather and height</h2>
<p>Exterior paint has minimum application and overnight temperatures, dew-point and rain-free windows set by each manufacturer on the product data sheet, and they differ between lines. Quote the product, then write the condition: work proceeds only within the manufacturer's application limits, and the schedule moves with the weather while the price does not. In shoulder seasons that clause protects both sides.</p>
<p>Height changes the equipment line. On Ontario construction projects, <a href="https://www.ontario.ca/laws/regulation/910213" rel="noopener">O. Reg. 213/91</a> requires fall protection where a worker may fall more than 3 metres, with a guardrail system first and, where that is not practicable, travel restraint, a fall restricting system, fall arrest or a safety net, in that order. A two-storey wall or a stairwell over 3 m means scaffold, a lift or harness and anchors, and the setup time that goes with them. Price it as a line.</p>

<h2>Commercial suites: hours, access and holdback</h2>
<p>Commercial work adds conditions a house does not have: building rules on working hours, freight elevator bookings, protection for carpets and furniture that stay in place, certificates of insurance, and tenants who need some rooms usable every morning. Ask for the building rules before pricing, and put an after-hours premium on its own line if the work has to happen evenings or weekends.</p>
<p>In Ontario, payment terms are set by the <a href="https://www.ontario.ca/laws/statute/90c30" rel="noopener">Construction Act</a>. The payer retains a holdback of 10 per cent of the value of work supplied, and an owner must pay a proper invoice within 28 days of receiving it unless it gives a notice of non-payment. Build that 10 per cent into your cash flow; the <a href="/tools/holdback-calculator/">holdback calculator</a> shows what each draw actually pays.</p>

<h2>Sample quote: office suite repaint in Ontario</h2>
<p>Example only. Quantities and prices are illustrative assumptions for a furnished office suite with 2.7 m ceilings (ceilings excluded), 5,600 sq ft of measured wall area, 18 doors with frames, and building rules that require noisy or smelly work after hours. Ontario HST is 13% according to the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA rate table</a>.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Protection: move and cover furniture, mask floors and fixtures</td><td>1</td><td>lot</td><td>$480.00</td><td>$480.00</td></tr>
    <tr><td>Prep: patch and sand holes and cracks, spot-prime repairs, stain-block water marks</td><td>14</td><td>hr</td><td>$68.00</td><td>$952.00</td></tr>
    <tr><td>Walls, 2 coats eggshell, labour (measured area)</td><td>5,600</td><td>sq ft</td><td>$0.62</td><td>$3,472.00</td></tr>
    <tr><td>Doors and frames, 2 coats semi-gloss, labour</td><td>18</td><td>each</td><td>$95.00</td><td>$1,710.00</td></tr>
    <tr><td>Wall paint, commercial eggshell, low-VOC, 3.78 L</td><td>32</td><td>can</td><td>$62.00</td><td>$1,984.00</td></tr>
    <tr><td>Door and frame paint, semi-gloss, 3.78 L</td><td>4</td><td>can</td><td>$68.00</td><td>$272.00</td></tr>
    <tr><td>Primer, filler, tape, plastic, roller covers</td><td>1</td><td>lot</td><td>$340.00</td><td>$340.00</td></tr>
    <tr><td>After-hours premium (building rules)</td><td>20</td><td>hr</td><td>$22.00</td><td>$440.00</td></tr>
    <tr><td>Final clean, walkthrough and touch-ups</td><td>1</td><td>lot</td><td>$260.00</td><td>$260.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$9,910.00</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$1,288.30</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$11,198.30</strong></td></tr>
  </tbody>
</table>
<p>Why it is written this way:</p>
<ul>
  <li>Prep is priced in hours and described, so torn drywall or wallpaper found later is clearly outside it.</li>
  <li>Wall labour uses the measured area; the paint quantity (two coats over 5,600 sq ft at an assumed spread rate from the data sheet) is shown separately, so the client can see coats and product.</li>
  <li>The after-hours premium is visible. If the property manager relaxes the rules, it comes off without reopening the whole price.</li>
  <li>The payment terms under the table should state progress invoicing, the 10% holdback and its release, and that ceilings, wallcoverings and lead abatement are excluded.</li>
</ul>
<p>The same structure works for a house: drop the premium, add ceilings and trim lines, and quote a deposit and balance instead of progress draws. More on quoting in the province is on the <a href="/provinces/ontario/">Ontario page</a>. If you would rather not build the table by hand, <a href="/quotes/painter/">quoteai for painters</a> writes an itemized quote with the province's taxes and sends it as a PDF.</p>
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
<p>A plumbing quote goes wrong in one of two ways. Either a client sees a big number for a dripping tap because you priced it like a renovation, or you give a fixed price on a bathroom and then find cast iron rotted through behind the tile. Both come from the same mistake: the quote doesn't match the kind of work. Sort that out first and the numbers mostly follow.</p>

<h2>Service calls and project work are priced differently</h2>
<p><strong>Service calls</strong> are leaks, clogs, no hot water, a running toilet. You don't know what you're facing until you're in the house, so a fixed price on the phone is a guess. The usual structure is a trip or diagnostic charge that covers getting there and finding the fault, then either a flat price for the repair or time and materials from that point on. Tell the client the trip charge before you book the visit, and say whether it gets credited against the repair if they go ahead.</p>
<p><strong>Project work</strong> is a bathroom, a basement rough-in, a repipe, a water heater swap. You can see most of it before you price it, so the client gets an itemized quote with quantities, a stated scope and a list of what isn't included.</p>
<p>Either way, the hourly rate behind your prices has to carry your truck, insurance, licence and registration fees, stock you carry, and the hours you spend driving and estimating without billing. The <a href="/tools/labour-rate-calculator/">labour rate calculator</a> turns those costs into a billable rate, and <a href="/blog/how-to-price-a-job-labour-materials-markup/">how to price a job: labour, materials and markup</a> covers markup on parts.</p>

<h3>When flat-rate pays and when it doesn't</h3>
<p>Flat-rate pricing works for jobs you have done enough times to know the spread: a toilet swap, a faucet replacement, a like-for-like water heater with the venting and connections already in place. Build each price from your real average time, the parts, a disposal charge and travel, and check it against job records every few months.</p>
<p>It stops working when the job isn't repeatable. A faucet on a 1960s vanity with seized shut-off valves is not the same job as one on a vanity installed five years ago. Either write the conditions into the flat-rate ("price assumes working shut-off valves and accessible supply lines") or switch to time and materials and say so before you start.</p>

<h2>Who supplies the fixtures, and who warrants them</h2>
<p>Clients often buy their own toilet, faucet or vanity and ask you to install it. That's fine, as long as the quote says what it changes:</p>
<ul>
  <li><strong>Contractor-supplied fixtures</strong> carry your markup and your warranty on both the part and the labour.</li>
  <li><strong>Client-supplied fixtures</strong> are installed for labour only. Write that your warranty covers your workmanship, not the product, and that a defective or missing part is a return trip at your service rate. Ask for the model number before the visit so you can check rough-in dimensions and valve compatibility.</li>
</ul>
<p>Put the model number of every fixture you supply on the quote.</p>

<h2>Rough-in and finish are separate stages</h2>
<p>On renovation and new-build work, split the price into rough-in (drain, waste and vent piping, supply lines, valve bodies, test) and finish (setting fixtures, trims, final connections). The two stages happen weeks apart, with other trades and an inspection in between. They also help the tile or drywall trade see what they're waiting on; the <a href="/blog/how-to-quote-a-tiling-job/">tiling guide</a> shows the same sequence from the other side.</p>

<h2>Licences, gas work and permits</h2>
<h3>Ontario</h3>
<p>Plumber is a compulsory trade. Skilled Trades Ontario states that to <a href="https://www.skilledtradesontario.ca/trade-information/plumber/" rel="noopener">practise the trade legally a person must hold a Certificate of Qualification, a Provisional Certificate or a registered training agreement</a>, and appear on its public register. Gas work is a separate authorization. TSSA treats certification of the individual and registration of the company as two legal requirements, and it has prosecuted the owner of a plumbing company after <a href="https://tssa.org/individual-fined-6000-employing-unlicensed-worker-install-natural-gas-water-heater" rel="noopener">an uncertified employee was sent to install a natural gas water heater</a>. If you quote a gas water heater, the quote should show that the gas side is done by a TSSA-registered contractor with a certified gas technician, whether that is you or a sub.</p>
<h3>British Columbia</h3>
<p>Gasfitter Class A and Class B are on SkilledTradesBC's list of <a href="https://skilledtradesbc.ca/skilled-trades-certification" rel="noopener">compulsory trades</a>; plumber is not on that list. A certified plumber may do gas work within the scope of the plumbing trade, and beyond that a gasfitter certificate is needed. Technical Safety BC lists installing or replacing a water heater among the gas work that <a href="https://technicalsafetybc.ca/apply-for/permits/homeowner-permits/homeowner-gas-permits" rel="noopener">needs a permit, which the licensed contractor applies for</a>; depending on the address, the permit comes from Technical Safety BC or the municipality.</p>
<h3>Québec</h3>
<p>Plumbing work requires an RBQ licence, including <a href="https://www.rbq.gouv.qc.ca/en/areas-of-intervention/plumbing/your-obligations-toward-the-rbq/licence/" rel="noopener">subclass 15.5, Contractor - plumbing</a>. The Corporation des maîtres mécaniciens en tuyauterie du Québec (CMMTQ) issues plumbing and heating licences on the RBQ's behalf. Put the licence number on every quote.</p>
<h3>Permits and backflow: a Toronto example</h3>
<p>Permit rules are municipal, so check the city you're working in. In Toronto, the city's permit list says you need a building permit to <a href="https://www.toronto.ca/services-payments/building-construction/apply-for-a-building-permit/when-do-i-need-a-building-permit/" rel="noopener">install or modify plumbing systems, install a backwater valve or install a backflow prevention device</a>, while repairing and replacing plumbing fixtures does not. A bathroom where you move a drain needs a permit; swapping a toilet in place does not. Put the permit as its own line, state who applies, and allow time for each inspection visit.</p>
<p>Backflow is mostly commercial work. Toronto's Water Supply By-law requires owners of industrial, commercial, institutional and Part 3 residential properties, and construction sites, to install devices and have them <a href="https://www.toronto.ca/services-payments/water-environment/how-to-use-less-water/backflow-prevention-program/" rel="noopener">tested at installation and at least once a year</a> by a certified Cross Connection Control Specialist. If you hold that certification, annual testing is recurring work worth quoting as a yearly agreement.</p>

<h2>Sample quote: bathroom rough-in and fixture set, Toronto, Ontario</h2>
<p>Example only: every price below is an assumption for illustration, not a market rate. The job moves the toilet and vanity drains in a gutted main-floor bathroom, adds a tub-shower valve and sets the fixtures after tile. The client is supplying their own vanity faucet. Ontario charges <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">13% HST</a>; the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> runs the same sum for other provinces.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Site visit, layout check against fixture specs</td><td>1</td><td>lot</td><td>$150.00</td><td>$150.00</td></tr>
    <tr><td>Plumbing permit: application and city fee (allowance, billed at actual cost)</td><td>1</td><td>lot</td><td>$300.00</td><td>$300.00</td></tr>
    <tr><td>Rough-in labour: drain, waste and vent, supply lines, pressure test</td><td>16</td><td>hour</td><td>$110.00</td><td>$1,760.00</td></tr>
    <tr><td>Rough-in materials: ABS pipe and fittings, PEX, stops, hangers</td><td>1</td><td>lot</td><td>$780.00</td><td>$780.00</td></tr>
    <tr><td>Pressure-balance tub-shower valve, supply and install at rough-in</td><td>1</td><td>each</td><td>$285.00</td><td>$285.00</td></tr>
    <tr><td>Finish labour: set toilet, tub-shower trim, final connections, test</td><td>5</td><td>hour</td><td>$110.00</td><td>$550.00</td></tr>
    <tr><td>Toilet, supplied (model number on quote)</td><td>1</td><td>each</td><td>$420.00</td><td>$420.00</td></tr>
    <tr><td>Install client-supplied vanity faucet (labour only, workmanship warranty only)</td><td>1</td><td>each</td><td>$95.00</td><td>$95.00</td></tr>
    <tr><td>Return visits for inspections</td><td>2</td><td>visit</td><td>$95.00</td><td>$190.00</td></tr>
    <tr><td>Disposal of old fixtures and offcuts</td><td>1</td><td>lot</td><td>$80.00</td><td>$80.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$4,610.00</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$599.30</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$5,209.30</strong></td></tr>
  </tbody>
</table>
<p>Why it is written this way:</p>
<ul>
  <li>Rough-in and finish are separate labour lines, so rough-in can be invoiced when it passes inspection, weeks before the fixtures go in.</li>
  <li>The permit is an allowance at cost, replaced with the real fee once you apply. Inspections get their own line because each one is a trip.</li>
  <li>The client's faucet is priced and worded so nobody expects you to warrant a part you didn't choose.</li>
  <li>The "Not included" section names tile, drywall, the vanity itself, and any replacement of existing stack or main drain beyond the bathroom.</li>
</ul>

<h2>Concealed conditions and after-hours rates</h2>
<p>Opening a floor in an older house can show galvanized supply, a cracked cast-iron stack or an old repair that won't pass. You can't price what you can't see, but you can price how you'll handle it. Name the likely conditions in the quote, state the hourly rate and the parts markup that apply to extra work, and say that nothing beyond the scope starts until the client signs a change. The <a href="/blog/how-to-handle-change-orders-contractors/">change orders guide</a> covers the paperwork. In Ontario this also protects you under the province's consumer rules: when an estimate is part of a home renovation contract, the <a href="https://www.ontario.ca/page/your-rights-when-starting-home-renovations-or-repairs" rel="noopener">final price can't exceed it by more than 10% unless the client agrees to new work or a new price</a>.</p>
<p>Emergency work needs its rates agreed before you roll. Put your after-hours, weekend and holiday rates on your standard terms, state when each applies, and read the number to the client on the phone before you book.</p>
<p>quoteai writes this kind of itemized quote, with separate rough-in and finish lines and the province's tax, and sends it as a PDF from the job. See <a href="/quotes/plumber/">quoting for plumbers</a> for how it handles service and renovation work. Whatever you use, finish every quote with your licence or certificate numbers, how long the price holds, and the warranty on parts and labour.</p>
`,
  "quote-vs-estimate-vs-invoice-difference": `
<p>The three documents answer different questions. An estimate answers "roughly what will this cost?", a quote answers "what exactly will you do, and for how much?", and an invoice answers "what do I owe you now?". Mixing them up is how a contractor ends up bound to a number they meant as a ballpark, or sends an invoice a business client cannot use for its tax claim.</p>

<h2>Estimate: a best guess, until it is in the contract</h2>
<p>In everyday Canadian trade practice, an estimate is your informed opinion of the cost before the scope is fully known: the walls are not open yet, the client has not picked fixtures, or you have only seen photos. It signals that the final price may move.</p>
<p>In Ontario, "may move" has a legal limit. Section 10 of the <a href="https://www.ontario.ca/laws/statute/02c30" rel="noopener">Consumer Protection Act, 2002</a> says that if a consumer agreement includes an estimate, you cannot charge more than 10% above it; if you do, the client can require you to provide the work at the estimated price. The province tells homeowners to <a href="https://www.ontario.ca/page/your-rights-when-starting-home-renovations-or-repairs" rel="noopener">make sure the estimate is included in the contract</a> for exactly that reason. The only way above the cap is a signed change for added or different work, which is what <a href="/blog/how-to-handle-change-orders-contractors/">change orders</a> are for.</p>
<p>So in Ontario, an estimate that ends up in the signed agreement is a price with a 10% margin, not a guess. Two habits follow:</p>
<ul>
  <li>Say on the document what the estimate depends on ("assumes drywall is sound behind existing tile"), so a hidden condition is clearly a change, not an overrun.</li>
  <li>If you cannot price within 10%, do not sign on an estimate. Visit again, open up an inspection hole, or quote the known work and list the unknown as a separate item to be priced when exposed.</li>
</ul>

<h2>Quote: a fixed offer that becomes the contract</h2>
<p>A quote is a firm price for a defined scope, valid until a stated date. Until the client accepts, it is an offer you can let expire. Once the client signs it, it is the agreement, and everything written on it binds you both.</p>
<p>That has consequences people overlook:</p>
<ul>
  <li><strong>Provincial contract rules apply to it.</strong> Ontario requires home renovation contracts worth more than $50 to be in writing and to include specific information: an itemized description, warranties, taxes, a schedule and the deposit, among others (<a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">Ontario: a guide for home renovation and roofing businesses</a>). A one-line quote that a client signs at their kitchen table can be a non-compliant contract.</li>
  <li><strong>Where it is signed matters.</strong> The same Ontario guide gives clients who sign at home a 10-day cooling-off period. Québec, BC and Alberta have their own cancellation rules for contracts signed at the client's home; our <a href="/blog/how-to-write-a-contractor-contract-canada/">contractor contract guide</a> covers each.</li>
  <li><strong>The scope is the limit.</strong> What is not on the quote is not in the price. That is why itemized scope and an exclusions list matter more than the total; see <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote</a>.</li>
</ul>
<p>A bid is a quote submitted in competition against the owner's documents and deadline; a proposal wraps a quote in method, schedule and credentials. Legally, both work like a quote once accepted.</p>

<h2>Invoice: what the CRA expects to see</h2>
<p>An invoice asks for payment for a deposit, a milestone or finished work. If you are registered for the GST/HST, you have to tell customers when the tax applies, by showing the tax amount, the rate, or that the total includes it. If you are a small supplier under the $30,000 threshold and not registered (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html" rel="noopener">CRA: when to register</a>), you do not collect GST/HST, so the invoice has no tax line.</p>
<p>Your business clients, such as property managers and general contractors, claim input tax credits for the tax you charge, and they need specific information on your invoice to do it. The CRA sets it by the total of the invoice (<a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html#H3_305" rel="noopener">RC4022: input tax credit information requirements</a>; the rules are in the <a href="https://laws-lois.justice.gc.ca/eng/regulations/SOR-91-45/section-3.html" rel="noopener">Input Tax Credit Information (GST/HST) Regulations</a>):</p>
<table>
  <thead>
    <tr><th>Invoice total</th><th>Information required</th></tr>
  </thead>
  <tbody>
    <tr><td>Under $100</td><td>Your business or trading name, the invoice date, the total amount</td></tr>
    <tr><td>$100 to $499.99</td><td>All of the above, plus the GST/HST charged (or a statement that the price includes it, with the rate) and your GST/HST registration number</td></tr>
    <tr><td>$500 or more</td><td>All of the above, plus the customer's name, a brief description of the work, and the terms of payment</td></tr>
  </tbody>
</table>
<p>Nearly every trade invoice is over $500, so in practice every field applies. Homeowners do not claim input tax credits, but there is no reason to keep two invoice formats.</p>

<h2>Québec: the QST equivalent</h2>
<p>Revenu Québec applies the same three bands to the QST (<a href="https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/collecting-gst-and-qst/preparing-invoices/" rel="noopener">Revenu Québec: preparing invoices</a>). From $100, the invoice needs both your GST and QST registration numbers; from $500, the customer's name and the terms of payment. Revenu Québec also asks for the QST amount and a description of the work at every level, and where one amount covers both taxes, the invoice must say it includes GST and QST. The QST rate is 9.975% on top of the 5% GST (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA: GST/HST rates by province</a>). Show the two taxes on separate lines; it satisfies both lists without thinking about it.</p>

<h2>Example: one job, three documents</h2>
<p>Example only, with assumed prices: repainting a 12 x 14 ft bedroom in Ontario, where HST is 13% (CRA rates page above).</p>
<p><strong>The estimate, after a phone call and photos:</strong> "Repaint bedroom walls, ceiling and trim, two coats: estimated $1,250 plus HST. Assumes no plaster repair beyond small nail holes; final price confirmed after a site visit."</p>
<p><strong>The quote, after the site visit</strong> (Q-2210, valid 30 days):</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Prep: fill, sand, spot-prime patches; protect floor and furniture</td><td>1</td><td>room</td><td>$220.00</td><td>$220.00</td></tr>
    <tr><td>Walls, two coats premium acrylic eggshell</td><td>400</td><td>sq ft</td><td>$1.60</td><td>$640.00</td></tr>
    <tr><td>Ceiling, two coats flat ceiling white</td><td>168</td><td>sq ft</td><td>$1.25</td><td>$210.00</td></tr>
    <tr><td>Baseboard, casing and one door, semi-gloss</td><td>1</td><td>room</td><td>$180.00</td><td>$180.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$1,250.00</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$162.50</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$1,412.50</strong></td></tr>
  </tbody>
</table>
<p><strong>The invoice, on completion</strong> (INV-2210), with the CRA fields for a total of $500 or more:</p>
<ul>
  <li>Business name and address, and GST/HST registration number: required from $100.</li>
  <li>Invoice number and date: the date is required at every level.</li>
  <li>Customer: the client's name, required from $500.</li>
  <li>Description: "Bedroom repaint per quote Q-2210: prep, walls, ceiling, trim and door, two coats", required from $500.</li>
  <li>Amounts: subtotal $1,250.00, HST 13% $162.50, total $1,412.50.</li>
  <li>Terms: "Due within 15 days of the invoice date; e-Transfer or cheque", required from $500.</li>
</ul>
<p>Why it works: the estimate states its assumption, so the quote can differ without an argument. The quote is itemized, so the invoice can describe the work by pointing to it. And the invoice carries the tax line and registration number, so a landlord or property manager client can claim the tax back. quoteai keeps the three in one record, turning an accepted quote into the invoice with the province's taxes. For getting that invoice paid, see <a href="/blog/how-to-collect-payment-from-clients-contractor-canada/">collecting payment from clients</a>, and the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> for any province's tax lines.</p>

<p><em>This is general information about Ontario consumer rules and federal and Québec sales tax requirements, not legal or tax advice.</em></p>
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
<p>Landscaping quotes lose money in the ground. The sod and the pavers are easy to count; the excavation, the haul-away, the base that has to go under a patio and the grade that has to carry water away from the house are where a low price comes from. A good quote measures those first and makes them visible to the client.</p>

<h2>Split softscape from hardscape</h2>
<p>Softscape is living or loose material: sod, seed, topsoil, mulch, plants. It is quick to install and the risk is mostly after you leave, when the client stops watering. Hardscape is built: interlock patios, walkways, retaining walls, steps, edging. It is slow, heavy, equipment-dependent, and the risk is in what goes under it.</p>
<p>Price them as separate sections of the quote. The labour rates may differ (a hardscape crew with a plate compactor and a skid steer costs more per hour than a planting crew), the warranty terms differ, and clients often want to phase the work: patio this year, plantings next spring. Separate sections let them say yes to one without re-quoting the other. Work your crew-hour rate out from real costs, including trailer, equipment, fuel and insurance, with the <a href="/tools/labour-rate-calculator/">labour rate calculator</a>.</p>

<h2>Measure in the units you buy in</h2>
<p>Suppliers sell sod by the square foot or roll, soil, mulch and aggregate by the cubic yard, edging by the linear foot, and pavers by the square foot or pallet. Measure the site the same way so your takeoff turns straight into an order:</p>
<ul>
  <li><strong>Area</strong> in square feet for sod, pavers, landscape fabric and bed preparation.</li>
  <li><strong>Volume</strong> in cubic yards for excavation, base, topsoil and mulch. Area in square feet times depth in inches, divided by 324, gives cubic yards. A 200 sq ft patio dug 9 inches deep is about 5.6 cubic yards of material to remove.</li>
  <li><strong>Length</strong> in linear feet for edging, edge restraint and drainage pipe.</li>
</ul>
<p>Add your own allowance for cuts, compaction and waste, from what your past jobs actually used, and show the quantity on the quote. A client who can see "6 cu yd excavation and disposal" understands why the patio costs more than the pavers.</p>

<h2>Before anyone digs: locates</h2>
<p>Every quote that includes digging should include the locate request as a step, and the schedule should allow for it.</p>
<ul>
  <li><strong>Ontario:</strong> Ontario One Call is now the <a href="https://ontariodigauthority.ca/" rel="noopener">Ontario Dig Authority</a>. Requests are free and required by law, and should go in at least 5 business days before you dig.</li>
  <li><strong>British Columbia:</strong> <a href="https://www.bc1c.ca/" rel="noopener">BC 1 Call</a> takes free locate requests online or by phone. Its members respond within 3 business days of notification, or 5 for large projects.</li>
  <li><strong>Québec:</strong> <a href="https://www.info-ex.com/en/" rel="noopener">Info-Excavation</a> processes locate requests free of charge for anyone planning to dig.</li>
</ul>
<p>Locates come from the members that own buried lines. Lines the property owner installed, such as a gas line to a barbecue, a cable to a garage or irrigation pipe, aren't theirs to mark, so ask the client about them and write the answer on the quote.</p>

<h2>Grade and drainage around the house</h2>
<p>Whatever you build next to a house has to move water away from the foundation, not toward it. A patio laid flat against a wall, or a garden bed built up above the siding, can send water into a basement, and the client will blame the last contractor who changed the grade.</p>
<p>Check grade before you price. On newer homes there may be an approved grading plan: the City of Waterloo, for example, says subdivision grading plans are <a href="https://www.waterloo.ca/water-utilities/manage-drainage-and-stormwater/how-grading-and-drainage-work/" rel="noopener">designed by engineers and approved by the city, and the builder maintains the grading for 2 years</a>, during which homeowners shouldn't alter it. On older lots, settled soil may need to be built back up before anything goes on top. Price that regrading as its own line, and pitch hard surfaces away from the house in the quote's description.</p>

<h2>Trees, walls and permits: a Toronto example</h2>
<p>Municipal rules decide what you can cut, dig near or build, so check the city you're working in. In Toronto, a permit is needed for any activity that can injure or remove <a href="https://www.toronto.ca/services-payments/building-construction/tree-ravine-protection-permits/when-to-apply-for-a-tree-or-ravine-permit" rel="noopener">a private tree 30 cm or more in diameter, measured 1.4 metres above ground</a>, and street trees are protected at any size. Excavation and trenching count as injury, so a patio or a trench inside a protected tree's root zone can need a permit even if the tree stays. If a tree is in the way, the permit and any arborist report are conditions of the quote, not something to sort out on the day.</p>
<p>Toronto's building permit list also requires a permit for a <a href="https://www.toronto.ca/services-payments/building-construction/apply-for-a-building-permit/when-do-i-need-a-building-permit/" rel="noopener">retaining wall more than one metre high</a> where it is on or next to public property, building entrances or private property the public can access. For any wall near that height, check the local rules before you quote a price, since design and drawings may become part of the job.</p>

<h2>Sample quote: sod, interlock patio and garden bed, Ontario</h2>
<p>Example only: every price below is an assumption for illustration, not a market rate. The backyard gets a 200 sq ft interlock patio off the back door, 600 sq ft of new sod and a 120 sq ft planted bed along the fence. Ontario charges <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">13% HST</a>; the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> works it out for other provinces.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Locate request, site layout and grade check</td><td>1</td><td>lot</td><td>$120.00</td><td>$120.00</td></tr>
    <tr><td>Patio: excavate to 9 in and haul away</td><td>6</td><td>cu yd</td><td>$85.00</td><td>$510.00</td></tr>
    <tr><td>Patio: granular base, 6 in compacted in lifts</td><td>5</td><td>cu yd</td><td>$65.00</td><td>$325.00</td></tr>
    <tr><td>Patio: bedding layer, 1 in</td><td>1</td><td>cu yd</td><td>$75.00</td><td>$75.00</td></tr>
    <tr><td>Interlock pavers, 200 sq ft plus 5% for cuts</td><td>210</td><td>sq ft</td><td>$6.50</td><td>$1,365.00</td></tr>
    <tr><td>Edge restraint</td><td>60</td><td>lin ft</td><td>$4.00</td><td>$240.00</td></tr>
    <tr><td>Patio labour: lay, cut, compact, joint sand, pitched away from house</td><td>24</td><td>hour</td><td>$75.00</td><td>$1,800.00</td></tr>
    <tr><td>Lawn: remove old turf, grade, topsoil 4 in</td><td>8</td><td>cu yd</td><td>$55.00</td><td>$440.00</td></tr>
    <tr><td>Sod, supply and lay</td><td>600</td><td>sq ft</td><td>$1.10</td><td>$660.00</td></tr>
    <tr><td>Bed: planting mix, 6 in</td><td>2.5</td><td>cu yd</td><td>$60.00</td><td>$150.00</td></tr>
    <tr><td>Bed: shredded mulch, 3 in</td><td>1.5</td><td>cu yd</td><td>$55.00</td><td>$82.50</td></tr>
    <tr><td>Perennials, 1 gal (plant list attached)</td><td>15</td><td>each</td><td>$18.00</td><td>$270.00</td></tr>
    <tr><td>Shrubs, 2 gal (plant list attached)</td><td>3</td><td>each</td><td>$65.00</td><td>$195.00</td></tr>
    <tr><td>Steel bed edging</td><td>45</td><td>lin ft</td><td>$6.00</td><td>$270.00</td></tr>
    <tr><td>Bed labour: prepare, plant, edge, mulch</td><td>8</td><td>hour</td><td>$75.00</td><td>$600.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$7,102.50</strong></td></tr>
    <tr><td>HST (Ontario, 13%)</td><td></td><td></td><td></td><td>$923.33</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$8,025.83</strong></td></tr>
  </tbody>
</table>
<p>Why it is written this way:</p>
<ul>
  <li>Excavation, base and bedding are separate lines with depths, so the client sees what they're paying for under the pavers and a cheaper quote that skips base is easy to compare.</li>
  <li>Quantities are in the units the supplier sells, with the cut allowance shown, so the takeoff becomes the order.</li>
  <li>Plants are counted and tied to an attached list with sizes, which is also what the plant warranty refers to.</li>
  <li>The "Not included" section names irrigation, removal of protected trees, private utility relocation and any regrading beyond the work area.</li>
</ul>

<h2>Plant warranties need conditions</h2>
<p>If you guarantee plants, write the terms down: how long, which plants (the attached list), replacement only or replacement and labour, and what voids it. Watering is the obvious one. Give the client written watering instructions for new sod and plantings, and state that the warranty doesn't cover drought, pests, animal damage, de-icing salt or plants the client moved. Nursery stock you didn't supply carries no warranty from you.</p>

<h2>Maintenance and snow are separate contracts</h2>
<p>Recurring work needs its own agreement, not a line on the project quote. Price it per visit when the scope varies (spring clean-up, fall clean-up, one-off cuts) and per season when it's predictable (weekly cutting from a start week to an end week, a fixed number of visits). A per-season price should state the visit count or the date range it covers, and what happens with extra visits or a short season.</p>
<p>Snow clearing is a different job with different risk: night work, equipment on call and slip-and-fall exposure. Quote it as its own contract with a trigger depth, response times, areas cleared, whether salting is included, and per-event or per-season pricing.</p>
<p>If your client is an Ontario homeowner, read the province's guidance on home renovation and repair contracts. It says a home renovation or repair contract worth more than $50 <a href="https://www.ontario.ca/page/your-rights-when-starting-home-renovations-or-repairs" rel="noopener">must be in writing</a>, a contract of $50 or more signed in the client's home carries a 10-day cooling-off period, and the province recommends deposits of no more than 10%. The <a href="/blog/how-to-write-a-contractor-contract-canada/">contractor contract guide</a> covers the rest.</p>
<p>quoteai writes an itemized quote like the one above, with the province's tax, and sends it as a PDF from the client's driveway; <a href="/quotes/landscaper/">quoting for landscapers</a> shows how it handles projects and seasonal work.</p>
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
<p>The tile is the visible part of the job and the smallest part of the risk. What decides whether a tiling quote makes money is underneath: how flat and stiff the floor is, what the shower walls are built from, whether water is stopped behind the tile, and who supplied the boxes stacked in the garage.</p>

<h2>Area plus a waste factor you can defend</h2>
<p>Measure each surface separately: floor, each shower wall to the height you are tiling, backsplash runs, niches and curbs. Floors are length times width less fixed cabinets; shower walls are width times height for each wall, plus returns. Keep them as separate lines, because a wall in a shower and a floor in a hallway take different labour, different setting materials and often different tile.</p>
<p>Waste depends on the layout and tile size, and there is no published standard for it, so use your own records from finished jobs and write the assumption down. Example: "quantities include 10% for cuts on a straight lay." A diagonal, herringbone or offset pattern, small rooms with many cuts, and large tiles where one broken piece is a big share of a box all push it higher. Showing the factor stops the argument when the client compares your tile count to a store's calculator.</p>

<h2>The floor under the floor</h2>
<p>Tile does not bend. Before you price anything else, check the substrate:</p>
<ul>
  <li><strong>Joist spacing and subfloor.</strong> The <a href="https://publications.gc.ca/site/eng/9.897526/publication.html" rel="noopener">National Building Code of Canada 2020</a>, which provinces adopt with their own amendments, requires a panel-type underlay under ceramic tile applied with adhesive (Article 9.30.2.1), at least 6 mm thick where supports are up to 300 mm on centre and at least 11 mm where they are wider (Article 9.30.2.2). Panel subfloor under adhesive-set tile needs its edges supported (Article 9.30.6.1).</li>
  <li><strong>Flatness.</strong> Check with a long straightedge. Humps get ground, dips get filled or the whole floor gets a self-levelling pour, and each of those is its own line with its own material.</li>
  <li><strong>Stiffness.</strong> A bouncy floor cracks grout and tile no matter how well it is set. Deflection limits come from the tile and setting-material manufacturers and from the installation details in the TTMAC guide below; if the floor fails them, the fix is framing, and that belongs in the quote or in a written exclusion.</li>
</ul>
<p>Large-format tile makes all three stricter. Longer tiles show every high spot as lippage, so the levelling line grows with tile size.</p>

<h2>Showers: the code sets the minimum, the system sets the method</h2>
<p>The National Building Code's rule for showers is short. Article 9.29.2.1 requires a waterproof finish to at least 1.8 m above the floor in shower stalls and 1.2 m above the rim of a bathtub with a shower, and Article 9.29.2.2 lists ceramic tile among acceptable finishes. Tile and grout on their own, however, are not what keeps water out of the wall in practice. That is the job of the membrane behind them, whether a sheet or liquid membrane over backer board or a complete foam board system, and each comes with the manufacturer's installation instructions and warranty conditions.</p>
<p>For the quote, name the system: "backer board with sheet membrane, seams and corners banded, membrane sealed to the drain and shower base per manufacturer's instructions." Then follow those instructions exactly, because a membrane warranty usually depends on it. Waterproofing is a separate line from tile setting; if the client's other bid has no such line, they can ask why.</p>
<p>Plumbing stays with the plumber. Write that the drain connection, valve and trim are by others, and coordinate dates so the drain body is set before your pan goes in. The <a href="/blog/how-to-quote-a-plumbing-job/">plumbing quote guide</a> covers the plumber's side.</p>

<h2>Use the Canadian installation details</h2>
<p>The Terrazzo, Tile and Marble Association of Canada publishes the <a href="https://www.ttmac.com/en/technical/specifications" rel="noopener">Tile Installation Manual, Specifications Guide 09 30 00</a>, with numbered installation details, including 301MJ for movement joints, 313F for tile over a wood subfloor in dry areas, 314F for tile over heated floor systems, 319SR for shower receptors and 329LFT for large-format tile on interior floors. Writing the detail number on the quote ("floor per TTMAC 313F") tells the client and any inspector which method you priced, and it settles disputes about whether a step was included.</p>

<h2>Heated floors need an electrician and an inspection</h2>
<p>In Ontario, the Electrical Safety Authority's <a href="https://esasafe.com/assets/files/esasafe/pdf/Electrical_Safety_Products/Flash_Notices/25-08-FL.pdf" rel="noopener">Flash 25-08-FL</a> says a flooring contractor may install heating cables or mats up to the first junction box for the cold leads, without branch circuit wiring. A notification of work must be filed with ESA and the heating components inspected before they are covered, and the branch circuit wiring is to be done by a licensed electrical contractor. The flash also warns that the floor sensor must be installed and the supply voltage must match the mat.</p>
<p>So the quote needs three things: your line for laying the mat and testing it, the electrician's work shown as by others or as a subcontract line, and a schedule that leaves a gap for the inspection before you pour or set. Elsewhere, check the electrical permit rules of the province. The <a href="/blog/how-to-quote-an-electrical-job/">electrical quote guide</a> shows how electricians price their part.</p>

<h2>Demolition and disposal</h2>
<p>Price tear-out by what is coming off, not by area alone: tile on mortar bed over lath is a different day from tile on drywall. Note what you expect behind it and say that rot, mould or failed framing found after demo is priced as a change at stated rates. Disposal is a separate line built from your actual bin or hauler costs. See the <a href="/blog/how-to-handle-change-orders-contractors/">change order guide</a> for the paperwork when the wall comes open.</p>

<h2>Client-supplied tile: put the terms in writing</h2>
<p>Many clients buy their own tile. That is fine if the quote says:</p>
<ul>
  <li>The exact quantity to buy, including your waste allowance, and that shortfalls stop work until more arrives.</li>
  <li>That tile is inspected on delivery and you are not responsible for manufacturing defects, shade variation between lots, or breakage before it reaches you.</li>
  <li>That lead time is the client's risk: if the tile is backordered, the schedule moves.</li>
  <li>Who keeps the leftover boxes. Keeping a few for future repairs is worth recommending.</li>
</ul>

<h2>Sample quote: shower and bathroom floor in Québec</h2>
<p>Example only. Quantities and prices are illustrative assumptions for a tub replaced with a walk-in shower: 96 sq ft of shower walls in 12 x 24 in. porcelain to the ceiling, a 55 sq ft floor in 12 x 12 in. porcelain on a straight lay, no heated floor, tile supplied by the client. Québec applies GST at 5% and QST at 9.975%, according to the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA rate table</a> and <a href="https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/collecting-gst-and-qst/calculating-the-taxes/" rel="noopener">Revenu Québec</a>.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Demolition: tub surround and floor tile, haul and disposal</td><td>1</td><td>lot</td><td>$1,150.00</td><td>$1,150.00</td></tr>
    <tr><td>Floor prep: level, install underlay and uncoupling membrane</td><td>55</td><td>sq ft</td><td>$6.50</td><td>$357.50</td></tr>
    <tr><td>Shower walls: backer board and sheet membrane, seams and corners banded</td><td>96</td><td>sq ft</td><td>$9.00</td><td>$864.00</td></tr>
    <tr><td>Shower base: sloped tray, membrane, drain flange (drain connection by plumber)</td><td>1</td><td>each</td><td>$1,450.00</td><td>$1,450.00</td></tr>
    <tr><td>Wall tile setting, 12 x 24 in., stacked</td><td>96</td><td>sq ft</td><td>$14.00</td><td>$1,344.00</td></tr>
    <tr><td>Recessed niche, 12 x 24 in., waterproofed and tiled</td><td>1</td><td>each</td><td>$325.00</td><td>$325.00</td></tr>
    <tr><td>Floor tile setting, 12 x 12 in., straight lay</td><td>55</td><td>sq ft</td><td>$11.00</td><td>$605.00</td></tr>
    <tr><td>Thinset, grout, edge and corner profiles</td><td>1</td><td>lot</td><td>$520.00</td><td>$520.00</td></tr>
    <tr><td>Tile: client-supplied, 106 sq ft wall and 61 sq ft floor (10% waste included)</td><td>1</td><td>lot</td><td>$0.00</td><td>$0.00</td></tr>
    <tr><td>Grout sealing and final clean</td><td>1</td><td>lot</td><td>$180.00</td><td>$180.00</td></tr>
    <tr><td><strong>Subtotal</strong></td><td></td><td></td><td></td><td><strong>$6,795.50</strong></td></tr>
    <tr><td>GST (5%)</td><td></td><td></td><td></td><td>$339.78</td></tr>
    <tr><td>QST (9.975%)</td><td></td><td></td><td></td><td>$677.85</td></tr>
    <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>$7,813.13</strong></td></tr>
  </tbody>
</table>
<p>Why it is written this way:</p>
<ul>
  <li>Waterproofing and the shower base are separate from tile setting, so the client sees what keeps water out of the wall.</li>
  <li>The tile line is at zero but still on the quote: it tells the client exactly how much to buy and where the waste figure came from.</li>
  <li>Labour is priced on measured area; the waste is only in the purchase quantity.</li>
  <li>Both tax lines are calculated on the subtotal, and the header carries your GST and QST registration numbers.</li>
</ul>
<p>In Québec, the <a href="https://www.rbq.gouv.qc.ca/en/licence/fulfilling-your-obligations/displaying-your-licence/" rel="noopener">Régie du bâtiment</a> requires contractors to show their RBQ licence number on estimates, bids, contracts, account statements and invoices, written as "RBQ licence: XXXX-XXXX-XX". Put it in the quote header next to your registration numbers. On consumer contracts signed at the client's home, check the Office de la protection du consommateur's <a href="https://www.opc.gouv.qc.ca/en/consumer/topic/itinerant-sale/cancelling/doing-business-renovation-contractor" rel="noopener">itinerant merchant rules</a>: a renovation contractor invited to the home is treated as an itinerant merchant when the work is doors and windows, insulation, or roofing or exterior wall covering. A bathroom tile job is not on that list, but read the page if you sell door to door. The <a href="/provinces/quebec/">Québec page</a> has more on quoting there.</p>
<p>Check the tax lines with the <a href="/tools/sales-tax-calculator/">sales tax calculator</a>. If you would rather not build the table by hand, <a href="/quotes/tile-installer/">quoteai for tile installers</a> writes an itemized quote with the province's taxes and sends it as a PDF.</p>
`,
  "how-to-raise-your-prices-contractors-without-losing-clients": `
<p>A price increase goes wrong in one of two ways: it comes too late, after a year of jobs that quietly lost money, or it lands as a surprise on a client who had already budgeted for the old rate. Both are avoidable. Decide from your own numbers, give clients a clear date, and protect the quotes and contracts already in play.</p>

<h2>Know when: your own numbers come first</h2>
<p>Inflation headlines tell you the direction of costs in general. They don't tell you whether your rates are wrong. Three things in your own records do.</p>
<ul>
  <li><strong>Job-cost results.</strong> Compare estimated and actual hours and materials on your last ten or twenty finished jobs. If actual cost keeps creeping toward the quoted price on the same kind of work, your rate is behind your costs, not your estimating. The method is in <a href="/blog/how-to-track-job-costs-contractors/">how to track job costs</a>.</li>
  <li><strong>Utilisation.</strong> Divide the hours you billed by the hours you paid for, your own included. If that share is dropping because of driving, quoting and callbacks, the hours you do bill have to carry more overhead, and the rate has to reflect it.</li>
  <li><strong>Backlog and win rate.</strong> If you are booked well ahead and accept almost everything you quote, demand is telling you the price is low for the market you serve. If the calendar is thin and you lose most quotes, a rate increase is still possible, but fix how you sell first.</li>
</ul>
<p>Rebuild the rate from the bottom: wage, burden, overhead per billable hour, then margin. The <a href="/tools/labour-rate-calculator/">labour rate calculator</a> does the arithmetic, and the <a href="/tools/markup-margin-calculator/">markup and margin calculator</a> keeps you from confusing a 20% markup with a 20% margin.</p>

<h2>Use official price data as context, not as your increase</h2>
<p>Statistics Canada publishes two series worth knowing when you explain a change to a client.</p>
<p>The Consumer Price Index measures what households pay. In its <a href="https://www150.statcan.gc.ca/n1/daily-quotidien/261116/dq261116a-eng.htm" rel="noopener">release for October 2026</a>, the CPI rose 3.1% year over year, the same as in September; excluding energy, it rose 2.0%. That is the number your residential clients hear on the news.</p>
<p>The Building Construction Price Index is closer to your world. It measures the change in prices that contractors charge to build a set of new residential and non-residential buildings in 15 census metropolitan areas. For the <a href="https://www150.statcan.gc.ca/n1/daily-quotidien/261029/dq261029e-eng.htm" rel="noopener">third quarter of 2026</a>, residential construction costs rose 0.8% from the previous quarter and 2.7% year over year across the 15 areas, and non-residential costs rose 4.3% year over year. Builders told Statistics Canada the increases were driven by higher material, fuel, transportation and labour expenses, and the release notes that metal and steel products led cost growth under retaliatory tariffs.</p>
<p>Two cautions. The index covers new construction in large cities, not renovation or service work in your town. And a national average is not your cost structure: an electrician whose wage rates went up and a painter whose paint price did not will see different numbers. Use these figures to show a client that costs are moving across the industry; set your own increase from your job costs.</p>

<h2>Raise each line, not just the hourly rate</h2>
<p>Look at every price you charge, not only the headline rate: helper or apprentice rate, after-hours rate, materials markup, flat-rate items such as a unit turnover or a standard fixture swap, and your minimum charge.</p>
<p>The minimum charge deserves its own look. A short service call costs you travel, set-up and paperwork no matter how small the task, and when your hourly rate rises the minimum often lags behind. The <a href="/blog/how-to-price-a-job-labour-materials-markup/">pricing guide</a> shows how to build a minimum charge from the cost of a call-out. State it plainly on quotes and invoices ("minimum service call, includes the first hour on site") so it is not a surprise.</p>

<h2>Honour open quotes and signed work</h2>
<p>New rates apply to new quotes. A quote you have sent is an offer, and if the client accepts it within its validity period, that is the price. Re-pricing it after acceptance damages trust more than any increase.</p>
<ul>
  <li><strong>Put a validity period on every quote</strong> (for example, 30 days) and honour it. When a quote expires, re-issue it at current rates with one line saying so.</li>
  <li><strong>Watch estimates with homeowners.</strong> In Ontario, the <a href="https://www.ontario.ca/laws/statute/02c30" rel="noopener">Consumer Protection Act, 2002</a> says that if a consumer agreement includes an estimate, the supplier can't charge more than 10% above it, and the consumer can require the work at the estimated price. Other provinces have their own consumer rules, so check yours before you send a revised price on accepted work.</li>
  <li><strong>Changes in scope are different.</strong> Extra work the client asks for is priced at current rates through a written change order. See <a href="/blog/how-to-handle-change-orders-contractors/">how to handle change orders</a>.</li>
</ul>

<h2>Escalation clauses for long jobs</h2>
<p>On a job that runs for months, or one priced now and built next season, a fixed price carries your risk on materials you haven't bought yet. An escalation clause shares that risk in a way both sides can check. A workable clause names:</p>
<ul>
  <li>the materials it covers (for example lumber, steel, copper wire or pipe), not "all costs";</li>
  <li>the baseline: the supplier quote and its date that your price is built on;</li>
  <li>the trigger: a change above a stated percentage before you buy;</li>
  <li>the proof: the new supplier invoice, shared with the client;</li>
  <li>that it works both ways, so a price drop is credited;</li>
  <li>notice before you buy, and the client's option to approve, substitute or pre-pay materials at the quoted price.</li>
</ul>
<p>Put the clause in the contract before signing, in plain language. Adding it mid-job is a renegotiation. The <a href="/blog/how-to-write-a-contractor-contract-canada/">contractor contract guide</a> covers where it sits among the other clauses.</p>

<h2>Telling repeat and commercial clients</h2>
<p>One-off homeowners see your new rates on their next quote. Clients who buy from you regularly deserve notice, and commercial clients often need it:</p>
<ul>
  <li><strong>Ask about their budget cycle.</strong> Property managers and condo boards set budgets for the year. Notice that reaches them before budgeting is far easier to absorb than a mid-year change.</li>
  <li><strong>Give a date, not a vague "soon".</strong> Sixty days is a reasonable notice period for a regular commercial client. Check any service agreement first: if it fixes rates for a term, the new rates start when the term renews.</li>
  <li><strong>Say what changes and what doesn't.</strong> A short table of old and new rates removes guesswork.</li>
  <li><strong>Explain once, briefly, without apologising.</strong> Costs rose; here is the new rate; here is when it starts.</li>
  <li><strong>Offer a way to lock in.</strong> Work orders issued before the effective date are done at current rates.</li>
</ul>

<h2>Example: a price-change letter and rate table</h2>
<p>Example only. The business, client and rates are invented to show the format; the figures are not a recommendation.</p>
<blockquote>
  <p>Subject: Rate update effective March 1</p>
  <p>Hello, thank you for another year of work on your buildings. Our labour, insurance and vehicle costs have risen, and our rates will change on March 1. The table below shows each rate before and after.</p>
  <p>Work orders you issue before March 1 will be completed at current rates, even if the work is scheduled later. Quotes already sent remain valid until the expiry date shown on each one. Materials continue to be billed at cost plus the same markup as today.</p>
  <p>If you'd like to discuss the change or plan larger work before your budget is finalised, reply to this email or call the office.</p>
</blockquote>
<table>
  <thead>
    <tr><th>Item</th><th>Current rate</th><th>From March 1</th><th>Change</th></tr>
  </thead>
  <tbody>
    <tr><td>Labour, lead hand (per hour)</td><td>$95.00</td><td>$102.00</td><td>+7.4%</td></tr>
    <tr><td>Labour, helper (per hour)</td><td>$60.00</td><td>$64.00</td><td>+6.7%</td></tr>
    <tr><td>Minimum service call (includes first hour)</td><td>$150.00</td><td>$165.00</td><td>+10.0%</td></tr>
    <tr><td>After-hours and emergency (1.5 times lead hand rate)</td><td>$142.50</td><td>$153.00</td><td>+7.4%</td></tr>
    <tr><td>Unit turnover repaint, one-bedroom, walls only (flat rate)</td><td>$1,150.00</td><td>$1,225.00</td><td>+6.5%</td></tr>
    <tr><td>Materials markup on cost</td><td>15%</td><td>15%</td><td>No change</td></tr>
  </tbody>
</table>
<p>All rates are before sales tax. Why it is built this way: the letter leads with the date and the protections (work orders before the date, quotes to their expiry) because those are the questions a property manager asks first. The minimum call rises more than the hourly rate because it had fallen behind the real cost of a short visit. Showing the unchanged markup is as useful as showing the increases: it tells the client exactly where the change is.</p>

<h2>After the change</h2>
<p>Update your price list the day the change takes effect so every new quote uses it; quoteai builds each itemized quote from your saved rates with your province's taxes, which keeps the rate the same on every quote. Then watch the same numbers you started with: win rate, backlog and job-cost results over the next few months. Review rates once a year, at the same time, so the next change is routine for you and expected by your clients.</p>
<p>This is general information, not legal advice. For questions about a specific contract, consult a lawyer in your province.</p>
`,
  "how-to-hire-your-first-employee-contractor-canada": `
<p>The first hire changes three things at once. You become a payroll agent for the CRA, holding back tax, CPP and EI and remitting them on a deadline. You take on your province's employment standards and its health and safety law for someone else. And your workers' compensation account starts to count real payroll. None of it is hard once it is set up, but most of it has to be in place before the first pay, not after.</p>

<h2>Confirm it is an employee</h2>
<p>If you set the hours, supervise the work, supply the major equipment and pay by the hour, the person is very likely an employee, whatever your agreement calls them. The tests, and what happens when a "sub" is really a worker, are in <a href="/blog/how-to-hire-and-pay-subcontractors-canada/">how to hire and pay subcontractors</a>.</p>

<h2>Before the first pay: CRA set-up</h2>
<ul>
  <li><strong>Payroll account.</strong> You add a payroll (RP) program account to your business number, and you must register for it before the first remittance due date (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/set-up-new-employee.html" rel="noopener">CRA: set up a new employee</a>; <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/open-manage-payroll-account.html" rel="noopener">CRA: open or manage a payroll account</a>).</li>
  <li><strong>SIN and TD1 forms.</strong> Get the employee's social insurance number and the completed federal and provincial TD1 forms before you pay them. Keep the forms with the employee's records and do not send them to the CRA. If an employee does not give you a TD1, deductions are based on the basic personal amount only (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/set-up-new-employee/filing-form-td1.html" rel="noopener">CRA: TD1 forms</a>).</li>
  <li><strong>Québec.</strong> Québec runs its own income tax, pension plan (QPP) and parental insurance plan, so Québec payroll is calculated with Revenu Québec's WebRAS, not the CRA calculator (<a href="https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/payroll-deductions-online-calculator.html" rel="noopener">CRA: Payroll Deductions Online Calculator</a>).</li>
</ul>

<h2>Deductions and your share</h2>
<p>For 2026, outside Québec:</p>
<ul>
  <li><strong>CPP:</strong> 5.95% from the employee and the same 5.95% from you, on pensionable earnings up to $74,600, after a $3,500 annual basic exemption (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html" rel="noopener">CRA: CPP rates, maximums and exemptions</a>). The exemption is prorated per pay; the CRA's chart gives $134.61 for 26 biweekly pays, and its manual-calculation page confirms that you remit both your employee's share and your matching share (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums.html" rel="noopener">CRA: calculate CPP contributions</a>).</li>
  <li><strong>EI:</strong> 1.63% from the employee on insurable earnings up to $68,900, and you pay 1.4 times the employee's premium. In Québec the employee rate is 1.30% (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html" rel="noopener">CRA: EI premium rates and maximums</a>).</li>
  <li><strong>Income tax:</strong> depends on the employee's TD1 claims, province and pay. Use the CRA's <a href="https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/payroll-deductions-online-calculator.html" rel="noopener">Payroll Deductions Online Calculator (PDOC)</a> rather than working it by hand.</li>
</ul>
<p>As a regular remitter, your remittance is due by the 15th of the following month. A new employer (payroll account open less than 12 months) can remit quarterly if its monthly withholding is under $1,000 and its payroll and GST/HST compliance record is perfect (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/remitting-source-deductions/how-when-remit-due-dates.html" rel="noopener">CRA: when to remit</a>). T4 slips are due by the last day of February for the previous year (<a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/file-information-returns-slip-summaries/when-to-file.html" rel="noopener">CRA: when to file</a>).</p>

<h2>Workers' compensation registration</h2>
<p>In Ontario construction, you have 10 calendar days from hiring your first employee to register with the WSIB (<a href="https://www.wsib.ca/en/businesses/registration-and-coverage/expanded-compulsory-coverage-construction-industry" rel="noopener">WSIB: expanded compulsory coverage in construction</a>). In British Columbia, all employers must have WorkSafeBC coverage unless exempt (<a href="https://www.worksafebc.com/en/insurance/need-coverage/who-needs-coverage" rel="noopener">WorkSafeBC: who needs coverage</a>). In Québec, you have 60 days from your first worker's first day to register with the CNESST (<a href="https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/inscription-cnesst" rel="noopener">CNESST: inscription</a>). Your premium is charged on payroll, so it changes the moment you have one; the <a href="/blog/contractor-insurance-canada-what-you-need/">contractor insurance guide</a> covers the rest of the coverage picture.</p>

<h2>Employment standards: the construction rules</h2>
<h3>Ontario</h3>
<p>Vacation pay is at least 4% of gross wages for employees with under five years of employment, and 6% after that (<a href="https://www.ontario.ca/document/your-guide-employment-standards-act-0/vacation" rel="noopener">Ontario ESA guide: vacation</a>). Overtime for most employees starts after 44 hours in a week, at 1&frac12; times the regular rate (<a href="https://www.ontario.ca/document/your-guide-employment-standards-act-0/overtime-pay" rel="noopener">Ontario ESA guide: overtime pay</a>).</p>
<p>Construction employees (on a construction site, other than maintenance, road building and sewer and watermain work) have special rules under O. Reg. 285/01 and 288/01. They are not entitled to daily or weekly limits on hours, the various rest periods, notice of termination or termination pay, or severance pay. They are also not entitled to public holidays or public holiday pay if they receive at least 7.7% of hourly wages as vacation or holiday pay (under five years of employment) or at least 9.7% (five years or more) (<a href="https://www.ontario.ca/document/industries-and-jobs-exemptions-or-special-rules/manufacturing-construction-and-mining" rel="noopener">Ontario: manufacturing, construction and mining special rules</a>). Decide which way you will handle holidays and write it in the offer letter. More on the province on our <a href="/provinces/ontario/">Ontario page</a>.</p>
<h3>British Columbia</h3>
<p>Employees earn two weeks of vacation after 12 months and three weeks after five years. Vacation pay is at least 4% of wages, rising to 6% after five years, and employees employed five calendar days or less are not entitled to it (<a href="https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/time-off/vacation" rel="noopener">BC: vacation under the Employment Standards Act</a>).</p>

<h2>Safety from the first day (Ontario)</h2>
<ul>
  <li><strong>Awareness training.</strong> Every worker must complete basic occupational health and safety awareness training as soon as practicable (<a href="https://www.ontario.ca/laws/regulation/130297" rel="noopener">O. Reg. 297/13, s. 1</a>); the ministry says to do it within the first few days, before the worker is exposed to hazards, and a signed workbook is the record (<a href="https://www.ontario.ca/page/worker-health-and-safety-awareness-four-steps" rel="noopener">Ontario: worker health and safety awareness in four steps</a>).</li>
  <li><strong>Working at heights.</strong> A worker who may use a travel restraint, fall restricting or fall arrest system, safety net, work belt or safety belt must have completed a working at heights program approved by the Chief Prevention Officer, from an approved provider. The training is valid for three years, and you keep a record of it (O. Reg. 297/13, ss. 6 to 10).</li>
  <li><strong>Posters and policies.</strong> Post the Health and Safety at Work: Prevention Starts Here poster and a copy of the Occupational Health and Safety Act, and give each employee the employment standards poster (<a href="https://www.ontario.ca/page/posters-required-workplace" rel="noopener">Ontario: posters required in the workplace</a>). Written health and safety, violence and harassment policies, and a health and safety representative, come in at six or more regularly employed workers (<a href="https://www.ontario.ca/page/health-and-safety-small-businesses" rel="noopener">Ontario: health and safety for small businesses</a>). Below that, the policies need not be written, but the same page describes the program that carries them out: training, inspections, protective equipment and procedures for the hazards of the work you actually do.</li>
</ul>

<h2>Example: first pay period</h2>
<p>Example only. Assumptions: Ontario carpentry business, employee paid $30.00 an hour, 80 hours in a biweekly period (26 pays a year), no taxable benefits, vacation pay accrued and paid separately, 2026 CPP and EI rates from the CRA pages above. Income tax is not shown: enter the same pay in PDOC with the employee's TD1 claims to get it.</p>
<table>
  <thead>
    <tr><th>Line</th><th>Calculation</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Gross pay</td><td>80 h &times; $30.00</td><td>$2,400.00</td></tr>
    <tr><td>CPP, employee</td><td>($2,400.00 &minus; $134.61) &times; 5.95%</td><td>&minus;$134.79</td></tr>
    <tr><td>EI, employee</td><td>$2,400.00 &times; 1.63%</td><td>&minus;$39.12</td></tr>
    <tr><td>Income tax</td><td>from PDOC</td><td>&minus;(PDOC)</td></tr>
    <tr><td><strong>Net pay before income tax</strong></td><td></td><td><strong>$2,226.09</strong></td></tr>
    <tr><td>CPP, employer</td><td>matches employee</td><td>$134.79</td></tr>
    <tr><td>EI, employer</td><td>$39.12 &times; 1.4</td><td>$54.77</td></tr>
    <tr><td><strong>To remit for this pay</strong></td><td>both CPP shares + both EI shares + income tax withheld</td><td><strong>$363.47 + tax</strong></td></tr>
  </tbody>
</table>
<p>At $62,400 a year this employee stays under both the CPP and EI maximums, so nothing stops partway through the year. The employer's cost per pay is $2,400.00 + $134.79 + $54.77 = $2,589.56 before vacation pay and the WSIB premium.</p>
<p>The checklist for that first pay:</p>
<ol>
  <li>Payroll account added to your business number.</li>
  <li>SIN, federal and Ontario TD1 forms on file.</li>
  <li>WSIB registration within 10 calendar days of the hire.</li>
  <li>Awareness training done; working at heights certificate copied if the work needs it.</li>
  <li>Posters up, employment standards poster handed over, offer letter signed with wage and holiday pay method.</li>
  <li>Pay run in PDOC, pay stub issued, remittance diarized for the 15th of next month.</li>
  <li>Calendar entries for T4s (end of February) and, if the job ends, the Record of Employment.</li>
</ol>

<h2>When the job ends: the Record of Employment</h2>
<p>Issue a Record of Employment whenever an employee has, or will have, seven consecutive calendar days with no work and no insurable earnings, even if they don't plan to claim EI. Filed electronically, it is due within five calendar days after the end of the pay period in which that happens for weekly, biweekly or semi-monthly pay (<a href="https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/reports/roe-guide/understand.html" rel="noopener">Service Canada: understanding the ROE</a>). In seasonal construction that can be every winter.</p>

<h2>Price the hire before you make it</h2>
<p>The table shows the employer's share of CPP and EI; add vacation pay, the workers' compensation premium, tools and the hours you pay but cannot bill. <a href="/blog/how-to-price-a-job-labour-materials-markup/">How to price a job</a> turns those into an hourly rate, and the <a href="/tools/labour-rate-calculator/">labour rate calculator</a> runs it with your numbers.</p>
<p>This is general information, not legal, tax or payroll advice. Confirm the rules for your province with the CRA, your provincial employment standards office and your workers' compensation board.</p>
`,
  "how-to-follow-up-on-quotes-contractors": `
<p>Silence after a quote rarely means no. The client may be waiting on a second price, a spouse, a bank, or simply a free evening to read it properly. A follow-up gives them an easy moment to ask what they were going to ask anyway, and it tells you where the job really stands, so you can plan your schedule around facts instead of hope.</p>

<h2>Set up the follow-up before you send the quote</h2>
<p>The best follow-up is planned into the quote itself. Three things make every later message easier:</p>
<ul>
  <li><strong>An expiry date.</strong> "Valid until 15 December" gives you an honest reason to get back in touch and protects you when material prices move. The guide to <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">writing a professional quote</a> covers what else belongs on the page.</li>
  <li><strong>A clear next step.</strong> Say how to accept: sign and return, pay the deposit, pick a start date. A follow-up can then point to that step instead of asking a vague "any thoughts?"</li>
  <li><strong>The client's preferred channel.</strong> Ask at the walkthrough whether they would rather get a text, an email or a call. Use what they say.</li>
</ul>

<h2>A follow-up schedule you can reuse</h2>
<p>Example only: adjust the days to the size of the job. A small repair can close in a few days; a kitchen or a roof may take weeks of decision-making, so space the messages out.</p>
<table>
  <thead>
    <tr><th>Day</th><th>Channel</th><th>Message</th></tr>
  </thead>
  <tbody>
    <tr><td>0 (quote sent)</td><td>Email with PDF, plus a short text</td><td>Quote attached, the two or three things it includes that matter most to this client, and how to accept.</td></tr>
    <tr><td>2</td><td>Text, or email if that is what they asked for</td><td>Confirm it arrived and offer to answer questions. One or two sentences.</td></tr>
    <tr><td>6</td><td>Phone call</td><td>Ask what they are weighing. Offer to walk through the scope or show an option with one line removed.</td></tr>
    <tr><td>12</td><td>Email</td><td>Something useful: an opening in your schedule, a product choice to confirm, or an answer to a question they raised.</td></tr>
    <tr><td>3 to 5 days before expiry</td><td>Text or email</td><td>The quote's end date, and that after it you would re-price with current material costs.</td></tr>
    <tr><td>After expiry</td><td>Email</td><td>Close the file politely and ask whether they would like you to check back later.</td></tr>
  </tbody>
</table>
<p>That is five or six touches spread over a few weeks, each with a reason. Stop as soon as the client answers either way, and never send two messages in a row without a reply in between unless one of them is the expiry notice.</p>

<h2>What to say at each step</h2>
<p><strong>Day 0.</strong> Don't just attach the PDF. Name what you heard at the walkthrough ("two coats on the trim, as you wanted", "the old tank removed and disposed of"). It shows you listened and gives the client something to compare when the other quotes arrive.</p>
<p><strong>Day 2.</strong> Keep it short and easy to answer. A question with a yes or no answer is the easiest kind to reply to.</p>
<p><strong>The call.</strong> Ask, don't pitch: "What are you weighing?" or "Is there anything in the quote that doesn't fit what you had in mind?" Then listen. The answer is usually timing, budget, or a doubt about scope, and each has a different fix.</p>
<p><strong>The useful email.</strong> Bring something new. A confirmed start date, a photo of the product you specified, or a note about a permit step is worth sending. "Just checking in again" is not.</p>
<p><strong>The expiry notice.</strong> This is a fact, not a pressure tactic. Your price was built on today's material costs and your current schedule, and both change. Say so plainly and offer to re-quote if they need more time.</p>

<h3>Two sample messages</h3>
<p>Example only, adjust to your voice and the job.</p>
<blockquote>Day 2 text: "Hi [client name], it's [your name] from [company]. Just making sure the deck repair quote came through. Happy to answer any questions about the boards or the stair treads. Reply STOP if you'd rather not get texts from us."</blockquote>
<blockquote>Expiry email: "Hi [client name], a quick note that the deck repair quote we sent on [date] is valid until [date]. After that I'd need to re-check lumber prices before confirming the total. If you'd like to go ahead, reply here and I'll send the deposit details and two possible start dates. If now isn't the right time, just let me know and I'll close the file."</blockquote>

<h2>When the answer is "too expensive"</h2>
<p>Don't drop the price by reflex. A discount offered before you know the reason teaches the client that your first number was padded, and it comes straight out of your margin. Ask what they are comparing against. Sometimes the other quote is missing something: prep work, disposal, a better grade of material, or a permit. Go through it line by line.</p>
<p>If the budget really is the limit, change the scope, not the rate: remove a room, switch a product line, split the work into two phases. Every line you take out should take its own cost with it. If you do lower a price, know first what it does to your margin; the guide to <a href="/blog/how-to-price-a-job-labour-materials-markup/">pricing a job</a> and the <a href="/tools/markup-margin-calculator/">markup and margin calculator</a> show how quickly a small discount eats a large share of the profit.</p>

<h2>When they went with someone else</h2>
<p>Reply once, briefly and graciously. Thank them, wish them a good job, and ask one question if they are willing to answer it: was it price, timing or something in the quote? Write the answer down. Then ask whether they would like to hear from you for future work. A clear yes is express consent, which matters for the next section. Clients who chose someone else sometimes come back when that contractor cannot start, and a polite last message leaves the door open.</p>

<h2>CASL: the rules for follow-up emails and texts</h2>
<p>Canada's Anti-Spam Legislation covers commercial electronic messages, and the federal guidance names both email and text messages (<a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email" rel="noopener">Government of Canada: getting consent to send email</a>). What it means for quote follow-ups:</p>
<ul>
  <li><strong>The quote itself.</strong> The Act exempts from the consent requirement a message that solely provides a quote or estimate the recipient asked for. It still has to identify you and include a way to unsubscribe (<a href="https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html" rel="noopener">Canada's Anti-Spam Legislation, section 6</a>).</li>
  <li><strong>An inquiry gives implied consent for six months.</strong> When someone contacts you about a job, the guidance says implied consent from an inquiry lasts six months; after a purchase it can last up to two years. A follow-up that goes beyond the quote, such as a seasonal offer or another service, needs that consent.</li>
  <li><strong>Every message identifies you</strong> with your business name and a mailing address plus a phone number, email or website, and offers a working unsubscribe. Requests must be honoured within 10 business days, at no cost to the client.</li>
  <li><strong>Keep records.</strong> The guidance tells senders to be ready to prove consent. Note the date of the first inquiry and any "yes, keep me posted".</li>
  <li><strong>Phone calls</strong> are live two-way voice communication, which section 6 leaves out of these message rules.</li>
</ul>
<p>This is a summary, not legal advice; if you send marketing to past clients in bulk, read the full guidance. For one-to-one follow-ups on a quote someone asked for within the last few months, the practical rules are simple: say who you are, make it easy to opt out, and stop when asked.</p>

<h2>Keep a note on every quote</h2>
<p>A few lines per quote turn follow-up from memory work into a routine:</p>
<ul>
  <li>Date of the first inquiry (it starts the six-month consent clock) and the date the quote was sent.</li>
  <li>Expiry date and the next planned follow-up.</li>
  <li>Preferred channel and anyone else involved in the decision.</li>
  <li>Questions or objections raised, and what you answered.</li>
  <li>Outcome and reason: won, lost on price, lost on timing, postponed.</li>
</ul>
<p>After a season, read the outcomes together. If you lose on timing, your lead times may be the issue; if you lose on price against quotes that turn out to be missing scope, your exclusions need to be clearer. Won jobs also deserve a last message once the work is done: our guide to <a href="/blog/how-to-get-more-reviews-as-a-contractor/">getting more reviews</a> covers when and how to ask.</p>
<p>A quote that arrives quickly and reads clearly makes every follow-up shorter. quoteai writes an itemized quote with the province's taxes and sends it as a PDF, so the first message on day 0 can go out the same afternoon as the walkthrough. When the client says yes, the next document is the contract; see <a href="/blog/how-to-write-a-contractor-contract-canada/">how to write a contractor contract in Canada</a>.</p>
`,
  "how-to-quote-a-carpentry-job": `
<p>Carpentry covers two very different businesses under one name. Finish work (trim, doors, built-ins, cabinets) is judged by the eye and paid for in hours of careful fitting. Rough work (framing, decks) is judged by the inspector and paid for in material and production. A good quote keeps the two apart, states the assumptions behind every quantity, and is honest about when money for custom material has to change hands.</p>

<h2>Pick a unit the client can check</h2>
<p>A unit price shows your thinking and makes "what if we add the hallway too" easy to answer. Units that track real production:</p>
<ul>
  <li><strong>Baseboard, casing and crown</strong>: linear feet, priced separately by profile. Crown and anything coped costs more per foot than square-cut base, and every outside corner, return and scribe to a wavy wall is time. Count corners as their own line if the room is busy.</li>
  <li><strong>Interior doors</strong>: per door, split by type. Hanging a pre-hung slab, installing a slab in an existing jamb (mortising hinges, boring hardware), bifolds, pocket doors and barn doors are different jobs. Casing both sides is per door or folded into the trim footage, but say which.</li>
  <li><strong>Cabinets and built-ins</strong>: per box for installation (base, upper, tall), plus linear feet of filler, scribe and crown. For units you build, price per box or per section from your own shop records, never a per-foot number borrowed from someone else.</li>
  <li><strong>Solid stock</strong>: board feet for hardwood and thick stock, since that is how lumberyards sell it. One board foot is 1 in by 12 in by 12 in of rough lumber, so a 1 in by 6 in board 8 ft long is 4 board feet before milling losses.</li>
  <li><strong>Framing and decks</strong>: square feet works for a quick budget, but the firm quote should break out footings (per pier), ledger (linear feet), framing and decking (square feet), guards (linear feet) and stairs (per flight). Those are the pieces clients change.</li>
</ul>

<h2>Write the takeoff assumptions on the quote</h2>
<p>Waste is not a fixed percentage you look up; it depends on lengths available, layout and how picky the finish is. Whatever allowance you use, put it in writing so a client comparing bids can see that yours is a complete quantity, not a hopeful one. Examples of the kind of note that helps:</p>
<ul>
  <li>"Trim quantity measured on site plus a 10% cutting allowance; paint-grade MDF, one profile throughout." (Our example figure. Stain-grade hardwood with matched grain needs more.)</li>
  <li>"Decking at 192 sq ft plus a straight-lay waste allowance; a picture-frame border or diagonal pattern is priced separately."</li>
  <li>"Sheet goods for built-ins nested from approved shop drawings; extra sheets due to design changes after approval are charged at cost plus handling."</li>
</ul>
<p>The last note matters. Once drawings are signed, every change touches material already cut. Price that through a written change order, as the <a href="/blog/how-to-handle-change-orders-contractors/">change order guide</a> describes.</p>

<h2>Built-ins: shop hours and site hours are separate lines</h2>
<p>A bookcase wall or a mudroom bench is really two jobs. In the shop you design, draw, cut, assemble, sand and finish, with your machines, your dust collection and no client watching. On site you protect floors, carry in, level, scribe to walls that are never flat, fasten, fill and touch up. The hourly cost of each is different (shop rent and machines on one side; travel, parking and slower working conditions on the other), so build the two rates separately. The <a href="/tools/labour-rate-calculator/">labour rate calculator</a> helps you work each one out from your own overhead.</p>
<p>Keep the lines separate on the quote too: your job records then show where the hours actually went. Design and drawing time deserves its own line: it is real work, and if the client walks away after three revisions you want it to have been paid for.</p>
<p>If you send doors out for finishing or buy them from a door shop, show that as a separate purchased line with its own lead time; finish drying time stretches the calendar even when the labour hours are modest.</p>

<h2>Deposits and custom-order material in Ontario</h2>
<p>Ontario's <a href="https://www.ontario.ca/page/guide-home-renovation-and-roofing-businesses" rel="noopener">guide for home renovation and roofing businesses</a> lists what a home renovation contract must include, including a payment schedule with the deposit amount, and says the ministry recommends that deposits are not more than 10% of the total project cost. That is a recommendation, not a cap in law, but a custom millwork job with a large up-front payment can look wrong to a client who has read it.</p>
<p>The honest way to fund custom material without a large deposit is to tie payments to milestones the client can see:</p>
<ul>
  <li>a deposit of no more than 10% on signing;</li>
  <li>a progress payment when shop drawings are approved and the material order is placed, with the supplier's order confirmation shown to the client;</li>
  <li>a payment on delivery of finished units to site, and the balance on completion.</li>
</ul>
<p>Two other rules from the same guide shape how you order. If the client signs at home, they have a 10-day cooling-off period and can cancel without a fee; if they asked you to start during that period and then cancel, you are entitled to reasonable payment for work and materials that cannot be returned. So don't place a non-returnable order in the first ten days unless the client has asked you, in writing, to proceed. And if your price is an estimate, the guide says you cannot charge more than 10% above it without a signed change. The <a href="/blog/how-to-write-a-contractor-contract-canada/">contractor contract guide</a> covers the rest of the paperwork.</p>

<h2>Decks: permit, ledger, guards, inspections</h2>
<p>Deck rules are municipal in application, so read the page for the city you are working in. Kingston, Ontario is a clear example. The City says you <a href="https://www.cityofkingston.ca/building-and-renovating/building-permits/deck-permits/" rel="noopener">need a permit if your deck is higher than 600 mm above ground level</a>, and its deck guidance sets out:</p>
<ul>
  <li>a ledger fastened with 12.7 mm lag bolts at most 800 mm apart, reaching the rim joist, and not relying on masonry veneer for support;</li>
  <li>guards at least 900 mm high for decks less than 1.8 m above the ground, with pickets at a maximum 100 mm spacing;</li>
  <li>three inspections: post holes before concrete, framing before deck boards and guards, and final, booked at least 24 hours ahead.</li>
</ul>
<p>Each of those is a quote item. A brick-veneer house means a freestanding beam or through-veneer connection to structure, not a ledger on the brick. Inspections mean return trips and a crew that may wait, so schedule them into the price. Say who prepares the drawings and applies for the permit, and carry the City's fee as an allowance at cost. The <a href="/provinces/ontario/">Ontario page</a> collects the province's other contracting rules.</p>

<h2>Pressure-treated lumber: price the handling</h2>
<p>Health Canada's guidance on <a href="https://www.canada.ca/en/health-canada/services/consumer-product-safety/reports-publications/pesticides-pest-management/fact-sheets-other-resources/staying-safe-around-treated-wood.html" rel="noopener">staying safe around treated wood</a> says to wear a dust mask, eye protection, gloves and long sleeves when sawing or sanding, to work with it outdoors, to clean up cut ends and sawdust, and never to burn treated wood. Offcuts go out with construction waste under local rules, not into a client's firepit. That means a cutting station outside, cleanup time at the end of each day and a disposal line on the quote.</p>

<h2>Worked example: 12 x 16 ft deck in Kingston, Ontario</h2>
<p>Example only: quantities and prices are assumptions for illustration. The job is a new 12 x 16 ft pressure-treated deck about 1.2 m above grade at the back of a house with vinyl siding over a wood-framed wall, one 4 ft stair to grade, guards on three sides.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Permit drawings (site plan, framing plan, guard details) and application</td><td>1</td><td>lot</td><td>$450.00</td><td>$450.00</td></tr>
    <tr><td>Building permit fee (allowance, billed at cost)</td><td>1</td><td>allowance</td><td>$200.00</td><td>$200.00</td></tr>
    <tr><td>Layout and utility locate request</td><td>1</td><td>lot</td><td>$150.00</td><td>$150.00</td></tr>
    <tr><td>Pier footings, dug and poured, inspected before concrete</td><td>6</td><td>each</td><td>$275.00</td><td>$1,650.00</td></tr>
    <tr><td>Ledger: remove siding strip, flash, lag-bolt to rim joist</td><td>16</td><td>lin ft</td><td>$38.00</td><td>$608.00</td></tr>
    <tr><td>Posts, beam and joist framing, pressure-treated</td><td>192</td><td>sq ft</td><td>$14.00</td><td>$2,688.00</td></tr>
    <tr><td>Pressure-treated 5/4 decking, straight lay</td><td>192</td><td>sq ft</td><td>$9.50</td><td>$1,824.00</td></tr>
    <tr><td>Guards, 900 mm high, pickets at 100 mm max spacing</td><td>36</td><td>lin ft</td><td>$65.00</td><td>$2,340.00</td></tr>
    <tr><td>Stair, 4 ft wide, with guards both sides</td><td>1</td><td>flight</td><td>$1,350.00</td><td>$1,350.00</td></tr>
    <tr><td>Treated-wood offcut cleanup and disposal</td><td>1</td><td>lot</td><td>$250.00</td><td>$250.00</td></tr>
  </tbody>
  <tbody>
    <tr><td>Subtotal</td><td></td><td></td><td></td><td>$11,510.00</td></tr>
    <tr><td>HST (13%)</td><td></td><td></td><td></td><td>$1,496.30</td></tr>
    <tr><td>Total</td><td></td><td></td><td></td><td>$13,006.30</td></tr>
  </tbody>
</table>
<p>Why it is built this way:</p>
<ul>
  <li><strong>HST at 13%</strong> is Ontario's rate in the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA rate table</a>; the <a href="/tools/sales-tax-calculator/">sales tax calculator</a> handles other provinces.</li>
  <li><strong>The guard line names the height and picket spacing</strong>, so a cheaper bid with a lower rail is visibly a different product.</li>
  <li><strong>Footings and framing are separate</strong> because they pass separate inspections; if the client adds a second level, only the affected lines move.</li>
  <li><strong>Payments follow the job</strong>: about 10% on signing, then on passed footing inspection, framing inspection and final, with no large up-front payment.</li>
</ul>
<p>quoteAI builds this kind of itemized quote with the province's tax applied and sends it as a PDF. Carpenters and cabinetmakers can start from the <a href="/quotes/carpenter-cabinetmaker/">carpentry quote page</a>.</p>
`,
  "how-to-quote-a-welding-or-metal-fabrication-job": `
<p>Fabrication quotes lose money in the gaps between the obvious lines: the hour spent squaring up a fixture, the grinding nobody counted, the extra trip because the powder coater ran late, the steel that went up between the quote and the order. The weld itself is rarely the problem. A quote that separates shop from field, names the steel price it relies on and treats finishing and installation as their own jobs closes most of those gaps.</p>

<h2>Shop fabrication and field welding are different jobs</h2>
<p>In the shop you control everything: fixtures, positioning, lighting, the right process for the joint, and the next job waiting on the table. In the field you are working out of position, on a client's schedule, with travel, setup, fire precautions and weather. The same weld costs more on site, so the two need separate hourly rates. Build each from your real costs (shop rent and equipment on one side; truck, generator or portable welder and travel time on the other); the <a href="/tools/labour-rate-calculator/">labour rate calculator</a> helps.</p>
<p>The practical rule for quoting: do as much as possible in the shop and say so. A railing fabricated in sections and bolted or field-welded at a few connection points is cheaper and better than one built in place, and the quote should show the shop hours and the site hours as separate lines.</p>

<h2>Choosing the unit: weight, length or hours</h2>
<ul>
  <li><strong>Per pound or kilogram</strong> works for repetitive structural work and plate, where your history links weight to hours. Take weights from your supplier's catalogue for the exact section and wall thickness, add cut loss and drops, and keep the material and labour parts visible even if the client sees one rate.</li>
  <li><strong>Per linear foot</strong> is what clients understand for railings and fences. It is a fine way to present a price, but build it bottom-up first: posts, corners, gates, returns and stair rakes all take more time per foot than a straight run.</li>
  <li><strong>Hours plus materials</strong> suits repairs and one-off work. Repairs have unknowns (hidden cracks, previous bad welds, contaminated metal), so quote an hourly rate with a not-to-exceed amount and a stop to call the client before going over it.</li>
</ul>
<p>Consumables (wire, gas, rod, discs, blades) are real costs. Recover them as a percentage of labour hours or as a per-job line; either works if it is applied consistently. Set a minimum charge for small jobs so setup and travel are covered. The <a href="/blog/how-to-price-a-job-labour-materials-markup/">guide to pricing labour, materials and markup</a> covers building the rates, and the <a href="/tools/markup-margin-calculator/">markup and margin calculator</a> checks the result.</p>

<h2>Steel prices: validity and an escalation clause</h2>
<p>Steel and aluminum prices move, and a fabricator who quotes in spring and orders in autumn carries that risk unless the quote says otherwise. Three pieces of wording help:</p>
<ul>
  <li><strong>A short validity period</strong>, stated in days, for the whole quote.</li>
  <li><strong>The basis of the material price</strong>: "Material priced from supplier quotation dated (date)."</li>
  <li><strong>An escalation clause</strong> for longer jobs, for example: "If supplier pricing for the steel in this quote has increased when the order is placed, the material line will be adjusted to the supplier's invoiced cost, and the invoice will be shown to the client before work proceeds." That wording is an example, not a legal template; have your contract reviewed for your province.</li>
</ul>
<p>Ordering material as soon as the quote is signed, and timing the deposit to cover it, is the simplest protection. If the price changes because the client changes the design, that is a change order, not escalation: see the <a href="/blog/how-to-handle-change-orders-contractors/">change order guide</a>.</p>

<h2>Drawings, engineering and CWB certification</h2>
<p>For anything beyond a simple residential railing, decide early who produces the drawings and who is responsible for the design. Shop drawings that the client signs before cutting protect you on dimensions and details. Where structural work (beams, columns, connections, platforms, stairs carrying real loads) comes with drawings from the client's engineer, you price to those drawings, not to your own interpretation. If the client expects you to supply engineering, carry the engineer's fee as its own line.</p>
<p>Structural specifications may require the fabricator to hold company certification under CSA W47.1, which the CWB Group administers. The <a href="https://www.cwbgroup.org/services/certification/company-certification/csa-w471-fusion-welding-of-steel" rel="noopener">CWB's page on CSA W47.1</a> explains that certified companies must qualify their welding supervisors and have their welders tested, and that certification comes in three divisions: Division 1 requires a professional engineer employed full time, Division 2 one retained part time, Division 3 none. Read the specification before you bid; if it calls for a division you don't hold, the job is not yours to quote alone.</p>

<h2>Railings and guards: quote to the code</h2>
<p>A residential railing is usually a guard under the building code, and an inspector can reject one that doesn't meet it. Municipal guidance is the clearest place to read the rules for your area. St. Albert, Alberta, for example, sets out in its <a href="https://stalbert.ca/city/approvals/development/decks/" rel="noopener">deck permit requirements</a> that a guard at least 900 mm high is required on decks, balconies and stairs where the drop exceeds 600 mm, a 42 in guard where it exceeds 1800 mm, that openings must prevent the passage of a 100 mm sphere, and that glass in guards must be laminated or tempered. Write the guard height and picket spacing on the quote, so the client can see that the cheaper bid with horizontal bars or wide gaps is a different product.</p>

<h2>Finishing as its own line</h2>
<p>Primer and paint can be done in-house; powder coating and hot-dip galvanizing are usually subcontracted. Show them as separate lines with the subcontractor's lead time, and add the trips to drop off and pick up. Say what preparation is included (sandblast, phosphate wash) and the colour. If the client wants powder coat over galvanizing, confirm with the coater that they accept galvanized parts and price both steps. Damage to finished parts during installation needs touch-up material on the truck.</p>

<h2>Delivery, installation and hot work on occupied sites</h2>
<p>Delivery is a line, and so is anything needed to get the piece in place: a second installer, a lift, a crane, a core drill for posts set in concrete. Field welding on an occupied building means fire precautions: clearing or covering combustibles, a fire extinguisher at hand and someone watching after the work stops. Commercial property managers and general contractors may require their own hot-work permit and fire watch; ask at the walk-through and price the watch time. In Alberta, the OHS Code's <a href="https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-code/part-10-fire-and-explosion-hazards/" rel="noopener">Part 10, section 169</a> requires a hot work permit before hot work begins in a hazardous location or where an explosive atmosphere may exist.</p>
<p>Taking deposits for work on someone's home in Alberta has its own licensing rule. The province says a business that solicits or concludes contracts for improving private dwellings away from its own premises and accepts money before the work is done needs a <a href="https://www.alberta.ca/prepaid-contracting-licence" rel="noopener">prepaid contracting licence</a>; contracts between contractors and sub-trades, and commercial buildings, are exempt.</p>

<h2>Worked example: exterior stair railing in St. Albert, Alberta</h2>
<p>Example only: quantities and prices are assumptions for illustration. The job is a pair of steel guards for a concrete front stair and landing about 1 m above grade, roughly 26 lin ft in total, square-tube posts and rails with square pickets, powder-coated black, surface-mounted to the concrete.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th></tr>
  </thead>
  <tbody>
    <tr><td>Site measure and shop drawing for client approval</td><td>1</td><td>lot</td><td>$350.00</td><td>$350.00</td></tr>
    <tr><td>Steel tube, bar and base plates, incl. cut loss</td><td>260</td><td>lb</td><td>$1.85</td><td>$481.00</td></tr>
    <tr><td>Shop fabrication: cut, fit, weld, grind</td><td>14</td><td>hr</td><td>$105.00</td><td>$1,470.00</td></tr>
    <tr><td>Consumables (wire, gas, discs)</td><td>1</td><td>lot</td><td>$120.00</td><td>$120.00</td></tr>
    <tr><td>Sandblast and powder coat, black (subcontracted)</td><td>1</td><td>lot</td><td>$680.00</td><td>$680.00</td></tr>
    <tr><td>Delivery to site</td><td>1</td><td>trip</td><td>$150.00</td><td>$150.00</td></tr>
    <tr><td>Installation, two installers, anchored to concrete</td><td>8</td><td>hr</td><td>$95.00</td><td>$760.00</td></tr>
    <tr><td>Anchors, fasteners and touch-up paint</td><td>1</td><td>lot</td><td>$95.00</td><td>$95.00</td></tr>
  </tbody>
  <tbody>
    <tr><td>Subtotal</td><td></td><td></td><td></td><td>$4,106.00</td></tr>
    <tr><td>GST (5%)</td><td></td><td></td><td></td><td>$205.30</td></tr>
    <tr><td>Total</td><td></td><td></td><td></td><td>$4,311.30</td></tr>
  </tbody>
</table>
<p>Why it is built this way:</p>
<ul>
  <li><strong>Only GST appears</strong>: Alberta has 5% GST and no provincial sales tax, per the <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" rel="noopener">CRA rate table</a>. The <a href="/tools/sales-tax-calculator/">sales tax calculator</a> handles HST provinces.</li>
  <li><strong>Shop and site hours have different rates</strong>, and the per-foot equivalent (about $158 per lin ft before tax) is a check on the build-up, not the starting point.</li>
  <li><strong>Material is by weight</strong> with the supplier quote date stated, so an escalation adjustment is traceable to an invoice.</li>
  <li><strong>Powder coating is its own line</strong> because its lead time sets the install date.</li>
</ul>
<p>quoteAI writes this kind of itemized quote with the province's tax applied and sends it as a PDF. Welders and fabricators can start from the <a href="/quotes/welder-fabricator/">fabrication quote page</a>.</p>
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
  "how-to-get-more-jobs-as-a-contractor-canada": `
<p>More enquiries only help if they turn into work you want. A crew that doubles its leads but still sends quotes a week late has mostly doubled its unpaid estimating time. So start from the other end: decide which jobs you want, then fix the steps between a client finding you and saying yes.</p>

<h2>Decide what a good job looks like</h2>
<p>Write down the three or four job types that pay you best for the time they take, and the areas you can reach without losing half a day in traffic: panel upgrades and EV charger circuits for an electrician, water heater replacements for a plumber, interior repaints for a painter. Every channel below should point at that list. Knowing your real hourly cost makes this easier: the <a href="/blog/how-to-price-a-job-labour-materials-markup/">guide to pricing labour, materials and markup</a> shows how to work it out.</p>

<h2>Google Business Profile: get the basics exactly right</h2>
<p>For local trade searches, your Business Profile is often the first thing a client sees, so it should describe the jobs on your list in plain words, with photos of finished work. The full setup is in our <a href="/blog/google-business-profile-guide-for-tradespeople/">Google Business Profile guide for tradespeople</a>. Three rules from Google itself trip up contractors most often:</p>
<ul>
  <li><strong>Hide your home address.</strong> Google's guidelines say a service-area business <a href="https://support.google.com/business/answer/3038177" rel="noopener">should hide its business address from customers</a>. Show it only if the location is staffed and receives customers during your stated hours.</li>
  <li><strong>Set service areas by place, not radius.</strong> Google lets you list <a href="https://support.google.com/business/answer/9157481" rel="noopener">up to 20 service areas by city, postal code or similar area</a>, not a distance around your shop, and the overall boundary should be within about two hours of driving from your base. List the places you want work in, not every town you could reach.</li>
  <li><strong>Use your real business name.</strong> Adding "Best Plumber Toronto" to the name breaks the <a href="https://support.google.com/business/answer/3038177" rel="noopener">guideline that the name reflect your real-world business name</a>, as used on your signage, website and stationery.</li>
</ul>

<h2>Reviews: ask every client, the same way, without bribes</h2>
<p>Reviews matter because the next client reads them before calling. The habit that works is boring: ask every client at handover, then text the direct review link the same day. Our post on <a href="/blog/how-to-get-more-reviews-as-a-contractor/">how to get more reviews as a contractor</a> has wording you can copy.</p>
<p>Two lines you can't cross. First, Google's policy prohibits offering <a href="https://support.google.com/contributionpolicy/answer/7400114" rel="noopener">payment, discounts or free goods or services in exchange for a review</a>, and it also bars businesses from discouraging negative reviews or asking only happy clients. "Ten percent off your next service call for a five-star review" breaks both. Second, Canadian law applies on top of Google's rules. The Competition Bureau has warned that <a href="https://www.canada.ca/en/competition-bureau/news/2024/01/online-reviews-posted-by-employees-businesses-could-be-liable.html" rel="noopener">anyone who writes or permits reviews that give a false or misleading impression could be liable under the Competition Act</a>, and that employees who post about their employer must disclose the connection. That covers your apprentice's five stars, your spouse's account and any firm offering to "boost" your rating.</p>
<p>Reply to reviews, good and bad. Google's own advice is to keep replies short and professional, <a href="https://support.google.com/business/answer/3474122" rel="noopener">not to use them for promotions, and never to share a reviewer's private information</a>.</p>

<h2>Answer and quote faster than the next crew</h2>
<p>The gap between a client's first call and your quote is where a small crew has the most control. A few fixes cost nothing:</p>
<ul>
  <li><strong>Make missed calls recoverable.</strong> A voicemail greeting that gives a callback window ("we return calls by 6 p.m. the same day") is better than silence. Then keep the promise.</li>
  <li><strong>Qualify on the first call.</strong> Ask the address, the job, the timeline and how the client heard of you. If the job isn't on your list or is outside your areas, say so politely and refer it on.</li>
  <li><strong>Quote while the visit is fresh.</strong> A clear itemized quote sent the same day or the next morning beats a lump sum sent a week later. The structure is in <a href="/blog/how-to-write-a-professional-quote-that-wins-jobs/">how to write a professional quote that wins jobs</a>. quoteai writes the itemized quote with your province's taxes and sends it as a PDF from your phone, which helps when the "office" is the truck.</li>
  <li><strong>Follow up once or twice, then stop.</strong> A short message a few days after the quote, and one more a week later, recovers jobs that were simply forgotten. See <a href="/blog/how-to-follow-up-on-quotes-contractors/">how to follow up on quotes</a> for timing and wording.</li>
</ul>

<h2>Referrals and repeat clients</h2>
<p>Past clients already trust you, so they are the cheapest source of the next job. Keep a list of every completed job with the date, address and what you did, and note what will need doing later: a deck due for re-staining, a furnace due for service, the second bathroom the client mentioned "for next year." At handover, say plainly that you'd be glad to help their neighbours and friends.</p>

<h2>Trade clients: property managers, general contractors and builders</h2>
<p>Homeowners are one-off buyers. Some of the steadiest work for a small crew comes from businesses that hire trades over and over:</p>
<ul>
  <li><strong>Property managers and condo boards</strong> need reliable people for turnovers, repairs and emergencies. Have your certificate of insurance and workers' compensation clearance ready before you introduce yourself.</li>
  <li><strong>General contractors and renovation firms</strong> hire subtrades for every job. They value crews that show up on the scheduled day, price change orders in writing and leave the site clean for the next trade. Expect to work under their contract and payment terms, including holdback on larger jobs.</li>
  <li><strong>Builders and developers</strong> buy in volume and negotiate hard. A builder can fill a season, but price it carefully and watch how much of your calendar depends on one client.</li>
  <li><strong>Other trades</strong> meet your clients every day. Two or three you trust, sending work both ways, beat a directory listing.</li>
</ul>

<h2>Paid lead platforms: test before you commit</h2>
<p>Lead-selling sites and paid search ads can fill gaps, but they cost money whether or not the lead becomes a job, and the same request may be sent to several contractors. Before signing up, check how the platform charges (per lead, per month or per booked job), whether you can dispute a bad lead, which areas and job types you can filter, and whether there is a minimum term. Then track every paid lead to a signed quote for a few months and work out what each booked job really cost.</p>

<h2>Email and text follow-ups: what Canada's Anti-Spam Legislation requires</h2>
<p>Quote follow-ups, seasonal reminders and newsletters sent by email or text can fall under Canada's Anti-Spam Legislation (CASL), which requires consent before sending a commercial electronic message. The federal anti-spam guidance explains the two kinds of consent: <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email" rel="noopener">express consent</a> (the client said yes, verbally or in writing, and it lasts until they withdraw it) and implied consent from an existing business relationship, which <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email" rel="noopener">may be valid for up to 2 years, or just 6 months in the case of an inquiry</a>. The same page says each message must carry your business name, a mailing address and a phone, email or website, and an unsubscribe mechanism, and that unsubscribe requests must be actioned within 10 business days at no cost to the recipient.</p>
<p>In practice: add a consent checkbox or a line on your quote ("May we send you seasonal maintenance reminders?"), record the date and how consent was given, and drop people who said no. The rules are <a href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/texting-good-client-relations" rel="noopener">technology neutral, so they apply to text messages too</a>, and a "STOP" reply has to be respected. This is general information, not legal advice; for detailed questions, the CRTC publishes the official CASL guidance.</p>

<h2>Example: a weekly lead plan for a two-person crew</h2>
<p>Example only. This assumes an owner who works on the tools with one helper and handles sales in the evenings. The times are planning assumptions; adjust them to your season and trade.</p>
<table>
  <thead>
    <tr><th>Day</th><th>Task</th><th>Time</th><th>Tool</th></tr>
  </thead>
  <tbody>
    <tr><td>Monday</td><td>Return weekend calls and messages; book site visits for the week</td><td>30 min</td><td>Phone, calendar</td></tr>
    <tr><td>Monday</td><td>Send quotes from last week's visits still outstanding</td><td>45 min</td><td>Quoting app</td></tr>
    <tr><td>Tuesday</td><td>Follow up on quotes sent 3 to 7 days ago (one message each)</td><td>20 min</td><td>Email or text</td></tr>
    <tr><td>Wednesday</td><td>Send review link to clients whose jobs finished this week; reply to new reviews</td><td>15 min</td><td>Google Business Profile</td></tr>
    <tr><td>Wednesday</td><td>Post 3 to 5 photos of a finished job with a one-line description</td><td>15 min</td><td>Google Business Profile</td></tr>
    <tr><td>Thursday</td><td>Call or email one property manager, general contractor or trade partner</td><td>30 min</td><td>Phone, email with insurance and WSIB/WCB documents attached</td></tr>
    <tr><td>Friday</td><td>Check past-client list for reminders due next month; message only those who consented</td><td>20 min</td><td>Client list or CRM</td></tr>
    <tr><td>Friday</td><td>Log the week: new leads, source, quotes sent, jobs booked, cost of any paid leads</td><td>15 min</td><td>Spreadsheet or CRM</td></tr>
  </tbody>
</table>
<p>The last row ends the guessing. After a few months, the log shows which sources bring the jobs on your list, so you can move time and money to them.</p>
`,
};

export const BLOG_ARTICLES: BlogArticle[] = BLOG_INDEX.map((meta) => {
  const contentHtml = BLOG_CONTENT[meta.slug];
  if (contentHtml === undefined) throw new Error(`blog-data.ts: no contentHtml for article "${meta.slug}"`);
  return { ...meta, contentHtml };
});
