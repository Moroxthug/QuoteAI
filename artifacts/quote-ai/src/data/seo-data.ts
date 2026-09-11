export interface SectorData {
  slug: string;
  sectorType: "professional" | "service";
  label: string;
  labelPlural: string;
  titleTag: string;
  titleVariants: string[];
  metaDescription: string;
  descriptionVariants: string[];
  h1: string;
  h1Highlight: string;
  intro: string;
  h2Benefits: string;
  benefits: { title: string; desc: string }[];
  h2HowItWorks: string;
  howItWorks: { step: string; desc: string }[];
  h2UseCases: string;
  useCases: string[];
  h2Faq: string;
  faq: { q: string; a: string }[];
  jsonLdDescription: string;
}

export const SECTORS: Record<string, SectorData> = {
  painter: {
    slug: "painter",
    sectorType: "professional",
    label: "Painter",
    labelPlural: "painters",
    titleTag: "Painting Quotes Online | quoteai – AI in 30s",
    titleVariants: [
      "Painting Quotes Online | quoteai – AI in 30s",
      "Quoting Software for Painters | quoteai",
      "Create Professional Painting Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for interior and exterior painting jobs in 30 seconds with AI. Quoting software built for Canadian painters. Free to try.",
    descriptionVariants: [
      "Create quotes for interior and exterior painting jobs in 30 seconds with AI. Quoting software built for Canadian painters. Free to try.",
      "AI quoting software for painters: drywall repair, priming, two coats, trim. Generate a professional quote in 30 seconds.",
      "Painting quotes in 30 seconds with AI. Automatic square-footage math, tax included, professional PDF. Try it free.",
    ],
    h1: "Quotes for",
    h1Highlight: "Painters",
    intro: "Stop losing evenings to spreadsheets or handwritten estimates. With quoteai you describe the job in your own words — patch and prime, two coats of washable latex, ceiling touch-ups — and the AI generates a professional quote with technical descriptions, square footage, unit prices, and tax calculated automatically. In 30 seconds, from your phone.",
    h2Benefits: "Why painters choose quoteai",
    benefits: [
      { title: "Quote from the job site", desc: "Open quoteai on your phone while you're still walking the customer's home. Describe the job in plain language and get a ready document in a minute." },
      { title: "Automatic square footage", desc: "The AI estimates wall area, paint needed, and labour hours from your description. No more manual math, no more mistakes." },
      { title: "A professional-looking document", desc: "Every quote includes your company header, itemized line items with units, unit prices, subtotals, and tax. It builds trust with the customer." },
      { title: "A digital archive", desc: "Every quote you've ever sent, saved and searchable from any device. Find the right job for the right customer in seconds." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the job", desc: "Write it in plain English: '900 sq ft condo, two coats of white washable latex, patch and prime the bathroom wall.'" },
      { step: "2. AI builds the quote", desc: "quoteai reads the description, identifies the line items, estimates quantities, and calculates totals with tax applied." },
      { step: "3. Download and send", desc: "Add your logo, tweak anything, and download the PDF. Send it to the customer by text or email." },
    ],
    h2UseCases: "Common jobs for painters",
    useCases: [
      "Interior painting for condos and houses",
      "Painting for offices and commercial spaces",
      "Drywall patching and crack repair",
      "Painting exterior doors, trim and windows",
      "Decorative finishes and accent walls",
      "Exterior siding and stucco repainting",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "How much does quoting software for painters cost?", a: "quoteai offers a Starter plan with a monthly quote allowance, plus the option to buy single quotes with no subscription at all." },
      { q: "Can I use it on my phone at the job site?", a: "Yes. quoteai is fully responsive and works on any phone or tablet with an internet connection — nothing to install." },
      { q: "Does the quote include market-rate pricing for painters?", a: "The AI suggests typical Canadian market prices, which you can adjust freely. You can also save your own price list in settings." },
    ],
    jsonLdDescription: "AI quoting software for Canadian painters. Generates professional painting quotes in 30 seconds.",
  },

  electrician: {
    slug: "electrician",
    sectorType: "professional",
    label: "Electrician",
    labelPlural: "electricians",
    titleTag: "Electrician Quotes Online | quoteai – AI in 30s",
    titleVariants: [
      "Electrician Quotes Online | quoteai – AI in 30s",
      "Quoting Software for Electricians | quoteai",
      "Create Professional Electrical Quotes – quoteai AI",
    ],
    metaDescription: "Quoting software for electricians: create quotes for wiring, panel upgrades, and rewiring in 30 seconds. AI built for Canadian electricians. Free.",
    descriptionVariants: [
      "Quoting software for electricians: create quotes for wiring, panel upgrades, and rewiring in 30 seconds. AI built for Canadian electricians. Free.",
      "Electrician quotes in 30 seconds. The AI knows panels, breakers, romex, pot lights, and outlets.",
      "AI quoting software for electricians: residential and commercial. Professional itemized quotes in 30 seconds. Try it free.",
    ],
    h1: "Quotes for",
    h1Highlight: "Electricians",
    intro: "Every electrical job needs a detailed quote: panel work, wiring, pot lights, outlets, data cabling. quoteai understands electrician terminology and generates a professional document with an itemized breakdown, units, and prices. From a small residential job to a commercial buildout, in 30 seconds.",
    h2Benefits: "Why electricians choose quoteai",
    benefits: [
      { title: "Trade terminology built in", desc: "The AI knows panels, breakers, AFCI/GFCI, romex, pot lights, and outlets. No translating your work into a form — just write how you talk." },
      { title: "Professional line-item breakdown", desc: "The quote includes wire runs, number of fixtures and outlets, labour hours and materials. A document any customer or GC understands." },
      { title: "Faster quotes, more jobs won", desc: "Whoever answers first usually wins the job. With quoteai you send the quote while you're still at the house. Higher close rate." },
      { title: "Customer and job history", desc: "Every quote archived by customer. You always have the full job history for every account at hand." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the job", desc: "Write: 'Rewire 800 sq ft condo, 18-circuit panel upgrade, 15 pot lights, 10 outlets, 4-drop data cabling.'" },
      { step: "2. AI structures the quote", desc: "quoteai generates line items with quantities, unit prices for materials and labour, subtotals, and tax." },
      { step: "3. PDF ready in one click", desc: "Add your logo, check the pricing, download the PDF. Send it to the customer in under 2 minutes from the walkthrough." },
    ],
    h2UseCases: "Common jobs for electricians",
    useCases: [
      "Residential rewiring and panel upgrades",
      "Panel and breaker installation",
      "Solar and EV charger installation",
      "Data cabling and smart-home wiring",
      "Commercial and industrial electrical work",
      "Bringing older wiring up to code",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I set my own prices for materials and labour?", a: "Yes, you can edit every line before saving. quoteai suggests prices, but you always decide the final number." },
      { q: "Is the quote formatted the way Canadian customers expect?", a: "quoteai generates documents using the standard professional structure used across Canada, including payment terms and tax shown clearly." },
      { q: "Does it work for large commercial or industrial quotes?", a: "Yes, quoteai supports multi-section quotes ideal for complex jobs with many line items." },
    ],
    jsonLdDescription: "AI quoting software for Canadian electricians.",
  },

  plumber: {
    slug: "plumber",
    sectorType: "professional",
    label: "Plumber",
    labelPlural: "plumbers",
    titleTag: "Plumber Quotes Online | quoteai – AI in 30s",
    titleVariants: [
      "Plumber Quotes Online | quoteai – AI in 30s",
      "Quoting Software for Plumbers | quoteai",
      "Create Professional Plumbing Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for plumbing and heating jobs in 30 seconds. AI quoting software for Canadian plumbers. No spreadsheets. Free.",
    descriptionVariants: [
      "Create quotes for plumbing and heating jobs in 30 seconds. AI quoting software for Canadian plumbers. No spreadsheets. Free.",
      "AI quoting software for plumbers: water lines, furnaces, fixtures. Generate a professional quote in 30 seconds.",
      "Plumber quotes in 30 seconds with AI. Heating, fixtures, and repairs: professional documents in one click.",
    ],
    h1: "Quotes for",
    h1Highlight: "Plumbers",
    intro: "Water lines, heating, fixtures: every plumbing job has line items that are hard to explain to a customer. quoteai understands the terminology — fittings, PEX, manifolds, furnace, thermostat — and generates a clear, professional quote in 30 seconds.",
    h2Benefits: "Why plumbers choose quoteai",
    benefits: [
      { title: "From the fix to the quote in 60 seconds", desc: "Just fixed the leak and the customer wants a quote for the next job? Generate it on the spot." },
      { title: "Prices for fixtures and materials", desc: "The AI suggests typical prices for copper pipe, fittings, valves, condensing furnaces and fixture installs across the Canadian market." },
      { title: "Clear, itemized quotes", desc: "Every job broken into labour, materials, and disposal. The customer sees the transparency and trusts the number." },
      { title: "Fast response", desc: "Send the PDF by text or email. The customer can approve it right from their phone before you're back on the road." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the plumbing job", desc: "Write: 'Install 24kW condensing furnace, 8 baseboard heaters, thermostatic valves, manifold, commissioning.'" },
      { step: "2. AI calculates the line items", desc: "quoteai generates line items for materials, labour hours, and disposal. All structured into a professional document." },
      { step: "3. PDF sent in 2 minutes", desc: "Download the PDF and send it to the customer while you're still at the property. They approve it before you're back in the truck." },
    ],
    h2UseCases: "Common jobs for plumbers",
    useCases: [
      "Furnace and hot water tank replacement",
      "Full water line replacement",
      "Radiant in-floor heating installation",
      "Drain and sewer line work",
      "Furnace and boiler maintenance",
      "Fixture and faucet installation",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I quote emergency jobs from my phone?", a: "Yes. quoteai is built mobile-first. Even for an emergency call, you can have a professional quote ready in 30 seconds." },
      { q: "How do I track quotes the customer hasn't approved yet?", a: "quoteai archives every quote with a status. You can follow up with customers who haven't responded yet." },
      { q: "Does it work for small repairs and large installs alike?", a: "Yes — from a faucet swap to a full multi-section mechanical install." },
    ],
    jsonLdDescription: "AI quoting software for Canadian plumbers.",
  },

  "general-contractor": {
    slug: "general-contractor",
    sectorType: "service",
    label: "General Contractor",
    labelPlural: "general contractors",
    titleTag: "Quotes for General Contractors | quoteai – AI in 30s",
    titleVariants: [
      "Quotes for General Contractors | quoteai – AI in 30s",
      "Quoting Software for General Contractors | quoteai",
      "AI Itemized Quotes for General Contractors – quoteai",
    ],
    metaDescription: "Quoting software for general contractors: framing, foundations, finishing. AI-built itemized quotes in 30 seconds. For Canadian small businesses.",
    descriptionVariants: [
      "Quoting software for general contractors: framing, foundations, finishing. AI-built itemized quotes in 30 seconds. For Canadian small businesses.",
      "General contractor quotes in 30 seconds. The AI generates professional itemized quotes for jobs of any size.",
      "AI itemized quoting for general contractors: framing, foundations, drywall. Professional documents in 30 seconds. Try it free.",
    ],
    h1: "Quotes for",
    h1Highlight: "General Contractors",
    intro: "A general contractor runs jobs with dozens of cost line items: framing, foundations, subfloor, drywall, finishes. Putting together an accurate itemized quote takes hours. With quoteai you describe the job in plain language and the AI generates a structured quote with sections, line items, quantities, and prices.",
    h2Benefits: "Why general contractors choose quoteai",
    benefits: [
      { title: "Multi-section itemized quotes", desc: "Quotes organized into sections with a summary and a detailed breakdown — the standard structure job-site clients expect." },
      { title: "Your logo and letterhead", desc: "Every quote carries your logo, business number, address, and contact info. The document reflects your company." },
      { title: "Less admin time", desc: "Less time on paperwork, more time on site. quoteai cuts the time spent preparing quotes dramatically." },
      { title: "Client management for small teams", desc: "A dashboard with every quote, job status, and customer history. A lightweight system for your business." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the job", desc: "Write: 'Build a 2,000 sq ft single-family home: foundation, engineered floor system, exterior wood-frame walls, drywall, rough-ins.'" },
      { step: "2. AI builds the itemized quote", desc: "quoteai structures the quote into sections by trade. Each section has line items with quantities, unit prices, and totals." },
      { step: "3. Quote ready for the client", desc: "A PDF with a summary and full breakdown. As professional as an engineering firm's estimate." },
    ],
    h2UseCases: "Common jobs for general contractors",
    useCases: [
      "New home and custom build construction",
      "Residential and commercial renovation",
      "Framing and concrete structural work",
      "Interior and exterior finishing",
      "Structural repair and reinforcement",
      "Demolition and debris removal",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Is quoteai suited to a general contractor with several employees?", a: "Yes, the Pro plan offers unlimited quotes for every job your company is running." },
      { q: "Can I attach drawings or files to the quote?", a: "The generated PDF contains the full itemized quote. To attach drawings, you can merge it with any PDF editor." },
      { q: "Are the suggested prices in line with the Canadian market?", a: "The AI is based on typical prices for the Canadian construction market. You can always adjust any line item." },
    ],
    jsonLdDescription: "AI quoting software for Canadian general contractors.",
  },

  "renovation-contractor": {
    slug: "renovation-contractor",
    sectorType: "service",
    label: "Renovation Contractor",
    labelPlural: "renovation contractors",
    titleTag: "Home Renovation Quotes | quoteai – AI",
    titleVariants: [
      "Home Renovation Quotes | quoteai – AI",
      "Renovation Quoting Software | quoteai",
      "Create Professional Renovation Quotes – quoteai AI",
    ],
    metaDescription: "Quotes for full renovations in 30 seconds. AI for renovation contractors and tradespeople across Canada.",
    descriptionVariants: [
      "Quotes for full renovations in 30 seconds. AI for renovation contractors and tradespeople across Canada.",
      "Renovation quoting software: generate multi-section itemized quotes in 30 seconds. For Canadian contractors.",
      "Professional renovation quotes in 30 seconds. The AI handles demolition, mechanical, finishes, and rebate-eligible upgrades.",
    ],
    h1: "Quotes for",
    h1Highlight: "Renovations",
    intro: "A renovation touches multiple trades: demolition, framing, mechanical, finishes, windows and doors. Coordinating it all into one quote is complex. quoteai pulls every line item into a single structured, multi-section document with a summary and full breakdown.",
    h2Benefits: "Why renovation contractors choose quoteai",
    benefits: [
      { title: "One quote, every trade", desc: "A single document for the whole job: demolition, electrical, plumbing, flooring, painting. All organized into sections." },
      { title: "Rebate-eligible upgrades noted", desc: "Mention in your description if the work qualifies for an energy-efficiency rebate program, and the AI adds a note flagging it for the customer." },
      { title: "Transparency for the customer", desc: "The customer sees every line item. Transparency reduces disputes and speeds up sign-off." },
      { title: "Fast revisions", desc: "If the client asks for a change order, update the quote in seconds and send the revised version." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the renovation", desc: "Write: '900 sq ft condo renovation: demo interior partitions, rewire and replumb, new tile flooring, paint throughout.'" },
      { step: "2. AI builds the multi-section quote", desc: "quoteai automatically organizes line items into sections: demolition, mechanical, flooring, finishes. Professional structure in 30 seconds." },
      { step: "3. PDF ready to present", desc: "The document includes a summary and full breakdown. The client signs and the job starts with no ambiguity." },
    ],
    h2UseCases: "Common renovation jobs",
    useCases: [
      "Full renovations for condos and houses",
      "Bathroom remodels with tile and fixtures",
      "Flooring and finish replacement",
      "Window and exterior door replacement",
      "Energy-efficiency upgrades eligible for rebates",
      "Office and commercial space renovation",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I note eligible rebate programs on the quote?", a: "Yes. Mention the type of rebate program in your description and quoteai adds an explanatory note to the document." },
      { q: "Is the quote a valid contract document?", a: "A quoteai quote is a professional commercial document. Having the customer sign it is enough to give it contractual weight." },
      { q: "Can I create separate quotes per trade?", a: "Yes, you can choose one combined multi-section quote or separate quotes per trade." },
    ],
    jsonLdDescription: "AI quoting software for renovation contractors across Canada.",
  },

  "welder-fabricator": {
    slug: "welder-fabricator",
    sectorType: "professional",
    label: "Welder & Metal Fabricator",
    labelPlural: "welders and metal fabricators",
    titleTag: "Welding & Metal Fabrication Quotes | quoteai – AI",
    titleVariants: [
      "Welding & Metal Fabrication Quotes | quoteai – AI",
      "Quoting Software for Welders & Fabricators | quoteai",
      "Create Professional Fabrication Quotes – quoteai AI",
    ],
    metaDescription: "Quotes for metal fabrication and welding in 30 seconds. AI quoting software for Canadian welders and fabricators. Free.",
    descriptionVariants: [
      "Quotes for metal fabrication and welding in 30 seconds. AI quoting software for Canadian welders and fabricators. Free.",
      "AI quoting software for fabricators: gates, railings, structural steel. Automatic materials estimate in 30 seconds.",
      "Professional quotes for welders and fabricators in 30 seconds. The AI estimates steel weight, welding hours, and pricing.",
    ],
    h1: "Quotes for",
    h1Highlight: "Welders & Fabricators",
    intro: "Gates, fencing, structural steel, canopies, railings: every fabrication job has precise dimensions and specific materials. quoteai estimates steel weight, linear feet of stock, and welding hours from a simple text description.",
    h2Benefits: "Why welders and fabricators choose quoteai",
    benefits: [
      { title: "Automatic materials estimate", desc: "Describe the structure and the AI estimates steel weight, sheet metal, and hardware. A more accurate quote, less waste." },
      { title: "Materials and labour, separated", desc: "The document clearly separates materials cost from shop and install hours. Full transparency for the customer." },
      { title: "Instant professionalism", desc: "A tidy, signed quote is worth more than one scribbled on a pad. It raises the perceived quality of your work." },
      { title: "Speed of response", desc: "Get the quote out before the competition. Whoever answers first often wins the job." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the structure", desc: "Write: '10x6 ft sliding steel gate with motor, 100 ft chain-link fence at 5 ft height with posts every 6 ft.'" },
      { step: "2. AI estimates materials and labour", desc: "quoteai estimates steel weight, welding hours, and paint/finish cost. Generates line items with unit prices and quantities." },
      { step: "3. Professional document in 60 seconds", desc: "A PDF with your company header and logo. The customer receives a document that justifies the price you're asking." },
    ],
    h2UseCases: "Common jobs for welders and fabricators",
    useCases: [
      "Gates and fencing in steel and aluminum",
      "Structural steel and trusses",
      "Canopies and steel awnings",
      "Interior and exterior steel stairs",
      "Stainless steel railings and balconies",
      "Mezzanines and industrial structures",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I use this for small repair jobs too?", a: "Absolutely. quoteai works for small jobs (lock repair, small gate) and large structural jobs alike." },
      { q: "How do I handle steel prices that change month to month?", a: "Every line item is editable before saving. Update material pricing based on current supplier quotes." },
      { q: "Can I save a template quote to reuse?", a: "Yes. Copy a previous quote and adjust it for a new customer, saving even more time." },
    ],
    jsonLdDescription: "AI quoting software for Canadian welders and metal fabricators.",
  },

  "carpenter-cabinetmaker": {
    slug: "carpenter-cabinetmaker",
    sectorType: "professional",
    label: "Carpenter & Cabinetmaker",
    labelPlural: "carpenters and cabinetmakers",
    titleTag: "Carpenter & Cabinetry Quotes | quoteai – AI",
    titleVariants: [
      "Carpenter & Cabinetry Quotes | quoteai – AI",
      "Quoting Software for Carpenters | quoteai",
      "Create Professional Carpentry Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for custom cabinetry, millwork and finish carpentry in 30 seconds. AI quoting software for Canadian carpenters. Free.",
    descriptionVariants: [
      "Create quotes for custom cabinetry, millwork and finish carpentry in 30 seconds. AI quoting software for Canadian carpenters. Free.",
      "AI quoting software for carpenters: custom closets, kitchens, trim work. Generate a professional quote in 30 seconds.",
      "Professional quotes for carpenters in 30 seconds. The AI knows wood species, finishes, and hardware terminology.",
    ],
    h1: "Quotes for",
    h1Highlight: "Carpenters",
    intro: "Custom closets, kitchens, trim, hardwood floors: a carpenter's quote needs to explain materials, wood species, finishes, and labour hours clearly. quoteai understands the vocabulary — oak, maple, painted MDF, ABS edge banding — and generates a professional document in 30 seconds.",
    h2Benefits: "Why carpenters choose quoteai",
    benefits: [
      { title: "Trade vocabulary built in", desc: "The AI recognizes wood species, finishes, panel thicknesses, and hardware systems. Write it the way you'd talk to your supplier." },
      { title: "Materials and labour, separated", desc: "Panels, edge banding, hinges, drawer slides, shop hours: every line item separated for full clarity." },
      { title: "A professional first impression", desc: "A well-structured quote is worth more than a thousand words. The customer perceives quality before seeing the finished work." },
      { title: "Less time in the office, more in the shop", desc: "A drastic cut in admin time. Every hour saved on a quote is another hour of billable work." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the custom piece", desc: "Write: '10x8 ft custom closet in oak veneer with 4 frosted-glass sliding doors, internal drawers, mirror, and LED lighting.'" },
      { step: "2. AI estimates materials and labour", desc: "quoteai generates line items for panels, edge banding, hinges, slides, and shop hours — all using the right terminology." },
      { step: "3. Professional PDF with your logo", desc: "The document includes specs for the finished product. The customer understands what they're buying and signs with confidence." },
    ],
    h2UseCases: "Common jobs for carpenters",
    useCases: [
      "Custom closets and built-in storage",
      "Solid wood and laminate kitchens",
      "Custom wood and wood-composite windows",
      "Hardwood and engineered flooring",
      "Custom interior doors",
      "Custom bathroom vanities and bookcases",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I include wood species and finishes on the quote?", a: "Yes. Include the details (whitewashed oak, matte lacquer, laminate) in your description and the AI will carry them into the document accurately." },
      { q: "How do I handle quotes with several options?", a: "Create separate quotes for each option so the customer can pick the version they prefer." },
      { q: "Does the quote include payment terms?", a: "Yes, quoteai lets you add payment terms (deposit, balance on delivery, instalments) to the final document." },
    ],
    jsonLdDescription: "AI quoting software for Canadian carpenters and cabinetmakers.",
  },

  "hvac-technician": {
    slug: "hvac-technician",
    sectorType: "professional",
    label: "HVAC & Heating Technician",
    labelPlural: "HVAC and heating technicians",
    titleTag: "HVAC & Heating Quotes Online | quoteai – AI",
    titleVariants: [
      "HVAC & Heating Quotes Online | quoteai – AI",
      "Quoting Software for HVAC Technicians | quoteai",
      "Create Professional HVAC Quotes – quoteai AI",
    ],
    metaDescription: "Quoting software for HVAC and heating technicians: furnaces, heat pumps, in-floor heat. AI in 30 seconds for Canadian trades.",
    descriptionVariants: [
      "Quoting software for HVAC and heating technicians: furnaces, heat pumps, in-floor heat. AI in 30 seconds for Canadian trades.",
      "Quotes for heating systems in 30 seconds. The AI handles furnaces, radiators, heat pumps, and rebate eligibility.",
      "AI quoting software for HVAC technicians: heating, hydronics, and cooling systems. Professional documents in 30 seconds.",
    ],
    h1: "Quotes for",
    h1Highlight: "HVAC & Heating",
    intro: "Installing a heating or cooling system needs a detailed quote: furnace, manifolds, piping, baseboards or in-floor heat, thermostatic valves, commissioning. quoteai handles the mechanical complexity and generates a professional document in 30 seconds.",
    h2Benefits: "Why HVAC and heating technicians choose quoteai",
    benefits: [
      { title: "Complex systems, simplified", desc: "Condensing furnace, in-floor heat, ductless splits, and HRVs — every system has its own line items. quoteai organizes them automatically." },
      { title: "Prices matched to the market", desc: "The AI suggests typical prices for furnaces, heat pumps, and in-floor systems across the Canadian market. Editable in one click." },
      { title: "Documentation for rebate programs", desc: "Customers often ask for a quote to apply for a home-efficiency rebate program. quoteai's document format suits that purpose." },
      { title: "Fast response, more jobs won", desc: "Whoever quotes first has a real edge. With quoteai you send it within 2 minutes of the walkthrough." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the mechanical system", desc: "Write: 'Install a 12kW air-to-water heat pump with in-floor heating for a 1,000 sq ft condo, 4 thermostatic zones.'" },
      { step: "2. AI generates the system line items", desc: "quoteai calculates line items for the outdoor unit, manifolds, piping, controls, and labour. Includes rebate-program notes where relevant." },
      { step: "3. Quote ready in 2 minutes", desc: "PDF ready for the customer and for any rebate application. The document separates equipment cost from installation, as most programs require." },
    ],
    h2UseCases: "Common jobs for HVAC and heating technicians",
    useCases: [
      "Condensing furnace and heat pump installation",
      "Radiant in-floor heating systems",
      "Air conditioning and cooling installation",
      "Baseboard and radiator replacement",
      "Solar thermal systems",
      "Furnace and boiler maintenance",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I flag work that's eligible for a rebate program?", a: "Yes. Note in the description that it's a heat pump or high-efficiency install and quoteai adds a note flagging typical rebate eligibility, with equipment and labour separated." },
      { q: "How do I quote a supply-and-install job?", a: "quoteai automatically separates equipment cost from installation labour, the way most rebate programs require." },
      { q: "Does it work for annual maintenance visits too?", a: "Yes, great for small recurring maintenance work, with the option to duplicate similar quotes in seconds." },
    ],
    jsonLdDescription: "AI quoting software for Canadian HVAC and heating technicians.",
  },

  freelance: {
    slug: "freelance",
    sectorType: "professional",
    label: "Freelancer",
    labelPlural: "freelancers and consultants",
    titleTag: "Quotes for Freelancers & Consultants | quoteai",
    titleVariants: [
      "Quotes for Freelancers & Consultants | quoteai",
      "Quoting Software for Canadian Freelancers | quoteai",
      "Create Professional Proposals – quoteai AI",
    ],
    metaDescription: "Create professional quotes for consulting, marketing, design and IT work in 30 seconds. AI quoting software for Canadian freelancers. Free.",
    descriptionVariants: [
      "Create professional quotes for consulting, marketing, design and IT work in 30 seconds. AI quoting software for Canadian freelancers. Free.",
      "AI quoting software for freelancers: proposals for consulting, design, and development in 30 seconds. Try it free.",
      "Professional quotes for freelancers in 30 seconds. The AI generates proposals with scope, hours, rates, and payment terms.",
    ],
    h1: "Quotes for",
    h1Highlight: "Freelancers",
    intro: "As a freelancer, every proposal is a chance to show professionalism. A well-structured quote is often the difference between a client who signs and one who moves on. quoteai generates a detailed proposal in 30 seconds — scope of work, estimated hours, rates, and payment terms.",
    h2Benefits: "Why freelancers choose quoteai",
    benefits: [
      { title: "A real proposal, not just a price", desc: "Not just a quote: a value proposal with scope of work, deliverables, and how you'll work together." },
      { title: "Hourly and flat-rate projects", desc: "Handle both hourly and flat-rate work. The AI adapts the format to how you charge." },
      { title: "Clear payment terms", desc: "Specify a deposit, milestones, and a final payment. Written, signed terms cut down on late payments." },
      { title: "A professional look", desc: "A document with your logo and letterhead signals seriousness. The client sees you as a reliable partner." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the project", desc: "Write: 'Company website build: UI/UX design, React front end, CMS integration, on-page SEO, 2 rounds of revisions, 30-day delivery.'" },
      { step: "2. AI structures the proposal", desc: "quoteai generates line items with estimated hours, rates, and subtotals. Includes payment terms and delivery dates." },
      { step: "3. A professional PDF that sells", desc: "A document with your logo that shows competence. The client feels the value before the call even happens." },
    ],
    h2UseCases: "Common fields for freelancers and consultants",
    useCases: [
      "Web developers and software developers",
      "Graphic designers and UX/UI designers",
      "Marketing and SEO consultants",
      "Copywriters and content creators",
      "Photographers and videographers",
      "Business consultants and coaches",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I use this without a registered business?", a: "Yes. quoteai works whether you're a sole proprietor or incorporated. You can customize the business-details section of the document." },
      { q: "Can I quote clients outside Canada?", a: "Yes — you can adjust currency and language details manually for international clients." },
      { q: "Can I attach a portfolio or case study to the quote?", a: "The PDF quote merges easily with other documents. You can combine it with your portfolio into a single file to send." },
    ],
    jsonLdDescription: "AI quoting software for Canadian freelancers and consultants.",
  },

  "building-consultant": {
    slug: "building-consultant",
    sectorType: "professional",
    label: "Building Consultant",
    labelPlural: "building consultants and home inspectors",
    titleTag: "Quotes for Building Consultants | quoteai",
    titleVariants: [
      "Quotes for Building Consultants | quoteai",
      "Quoting Software for Home Inspectors | quoteai",
      "Create Professional Technical Quotes – quoteai AI",
    ],
    metaDescription: "Quoting software for building consultants and home inspectors: inspections, permit drawings, project oversight. AI in 30 seconds.",
    descriptionVariants: [
      "Quoting software for building consultants and home inspectors: inspections, permit drawings, project oversight. AI in 30 seconds.",
      "Quotes for building consultants in 30 seconds. The AI handles professional fees and disbursements with the right terminology.",
      "AI quoting software for home inspectors and technical consultants: inspections, permit packages, energy audits. Professional documents in 30 seconds.",
    ],
    h1: "Quotes for",
    h1Highlight: "Building Consultants",
    intro: "Canada doesn't have a single province-wide licence covering every building trade the way some countries do — inspections, permit drawings, and site oversight are handled by a mix of licensed technologists, home inspectors, and engineers, each billing differently. quoteai generates detailed technical quotes that match how these professionals actually bill for their time.",
    h2Benefits: "Why building consultants and home inspectors choose quoteai",
    benefits: [
      { title: "Professional fees, structured clearly", desc: "Separate professional fees, disbursements, and travel time. The document follows the conventions clients expect from a technical consultant's quote." },
      { title: "Trade-accurate terminology", desc: "The AI knows the vocabulary: home inspection report, permit drawing package, energy audit, structural assessment." },
      { title: "More jobs, same amount of time", desc: "Generate the quote for each job in seconds. Spend more time on the high-value technical work." },
      { title: "A lightweight practice dashboard", desc: "Every quote and job organized by client. A simple but effective way to manage your practice." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the service", desc: "Write: 'Pre-purchase home inspection for a 2,500 sq ft house, including report, photos, and a summary of major systems.'" },
      { step: "2. AI structures the professional quote", desc: "quoteai generates line items with fees, disbursements, and travel time, using terminology consistent with how technical consultants bill." },
      { step: "3. PDF for the client", desc: "A document with your practice's letterhead, file number, and payment terms. As professional as a quote from a law office." },
    ],
    h2UseCases: "Common services for building consultants",
    useCases: [
      "Pre-purchase and pre-listing home inspections",
      "Permit drawing packages and applications",
      "Site oversight and progress reporting",
      "Energy audits and efficiency assessments",
      "Structural and property condition assessments",
      "Land surveys and site measurements",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Does the quote include disbursements and travel time?", a: "Yes. Mention that it's a professional service call and quoteai will add a line for disbursements and travel automatically." },
      { q: "Can I create separate quotes for multiple jobs from the same client?", a: "Absolutely. quoteai archives every quote by client and date, so you can manage multiple jobs for the same account at once." },
      { q: "How do I handle quotes for longer oversight engagements?", a: "You can structure the quote by phase (design review, site visits, final report) or create separate quotes per phase." },
    ],
    jsonLdDescription: "AI quoting software for Canadian building consultants and home inspectors.",
  },

  mason: {
    slug: "mason",
    sectorType: "professional",
    label: "Mason & Concrete Contractor",
    labelPlural: "masons and concrete contractors",
    titleTag: "Mason & Concrete Quotes Online | quoteai – AI",
    titleVariants: [
      "Mason & Concrete Quotes Online | quoteai – AI",
      "Quoting Software for Masons | quoteai",
      "Create Professional Masonry Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for masonry, foundations, and concrete work in 30 seconds. AI quoting software for Canadian masons. Try it free.",
    descriptionVariants: [
      "Create quotes for masonry, foundations, and concrete work in 30 seconds. AI quoting software for Canadian masons. Try it free.",
      "AI quoting software for masons: foundations, block walls, parging. Professional itemized quotes in 30 seconds.",
      "Professional quotes for masons in 30 seconds. The AI estimates volume, area, labour and materials for every job.",
    ],
    h1: "Quotes for",
    h1Highlight: "Masons",
    intro: "Every masonry job has specific line items: foundations, block walls, parging, slabs. Explaining it clearly to a customer takes time. With quoteai you describe the work in plain language and get a structured quote with sections, quantities, unit prices, and tax. In 30 seconds.",
    h2Benefits: "Why masons choose quoteai",
    benefits: [
      { title: "Professional itemized quotes", desc: "Line items in square feet, cubic yards, and linear feet for walls, foundations, and parging. The customer sees exactly what they're paying for." },
      { title: "Materials and labour estimates", desc: "The AI estimates labour hours and materials (block, concrete, sand, rebar) from your job description." },
      { title: "A document built for bids", desc: "The quote has the structure of a proper itemized estimate, recognizable to private and municipal clients alike." },
      { title: "A fast response to the customer", desc: "Generate the quote from the job site in 30 seconds. Whoever answers first often wins the job." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the masonry work", desc: "Write: 'Build a 10 ft high, 26 ft long block bearing wall, 500 sq ft slab foundation at 12in thick with rebar mesh, parge all exterior surfaces.'" },
      { step: "2. AI builds the itemized quote", desc: "quoteai generates line items in square feet, cubic yards, and linear feet for each task. Estimates labour hours and materials at Canadian market prices." },
      { step: "3. Professional bid document", desc: "A PDF with sections for foundations, masonry, and finishing. The client sees the professionalism of your business before work even starts." },
    ],
    h2UseCases: "Common jobs for masons",
    useCases: [
      "Building block bearing walls and partitions",
      "Reinforced concrete foundations and slabs",
      "Parging and wall finishing",
      "Concrete slabs for floors and driveways",
      "Demolition and partition removal",
      "Repair and reinforcement of existing masonry",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Does the quote include building material prices?", a: "Yes. The AI suggests typical Canadian market prices for block, concrete, rebar, and labour. You can adjust every line before saving." },
      { q: "Can I quote public or municipal jobs?", a: "The generated document has the structure of a proper itemized estimate, suitable for smaller public jobs too." },
      { q: "Does it work for small repairs too?", a: "Yes, quoteai works for small repairs (wall patch, parging touch-up) and large multi-section jobs alike." },
    ],
    jsonLdDescription: "AI quoting software for Canadian masons and concrete contractors.",
  },

  landscaper: {
    slug: "landscaper",
    sectorType: "professional",
    label: "Landscaper",
    labelPlural: "landscapers",
    titleTag: "Landscaping Quotes Online | quoteai",
    titleVariants: [
      "Landscaping Quotes Online | quoteai",
      "Quoting Software for Landscapers | quoteai",
      "Create Professional Landscaping Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for lawn care, landscaping, and yard maintenance in 30 seconds. AI quoting software for Canadian landscapers. Try it free.",
    descriptionVariants: [
      "Create quotes for lawn care, landscaping, and yard maintenance in 30 seconds. AI quoting software for Canadian landscapers. Try it free.",
      "AI quoting software for landscapers: mowing, pruning, irrigation. Professional quotes in 30 seconds.",
      "Professional quotes for landscapers in 30 seconds. The AI estimates lawn area, hedge length, and seasonal maintenance plans.",
    ],
    h1: "Quotes for",
    h1Highlight: "Landscapers",
    intro: "Lawn mowing, hedge trimming, garden beds, irrigation systems: every landscaping service has a cost that's hard to explain to a customer. quoteai understands the vocabulary and generates a professional quote with detailed line items and pricing. In 30 seconds.",
    h2Benefits: "Why landscapers choose quoteai",
    benefits: [
      { title: "A line item for every service", desc: "Mowing, pruning, fertilizing, pest treatments, irrigation: every service gets its own line item and unit price." },
      { title: "Seasonal maintenance contracts", desc: "Create quotes for monthly or seasonal maintenance packages. The customer understands what they get with every visit." },
      { title: "From walkthrough to quote in 2 minutes", desc: "Still on site? Generate the quote from your phone and send it before you're back in the truck." },
      { title: "Professionalism that closes deals", desc: "A structured document wins more customers than a handwritten estimate. Higher close rate on your quotes." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the yard work", desc: "Write: 'Monthly maintenance for a 5,000 sq ft yard: mow and bag, trim 130 ft of cedar hedge, treat fruit trees.'" },
      { step: "2. AI generates the service line items", desc: "quoteai calculates prices per square foot of lawn, per linear foot of hedge, and per service. Structures the quote per visit or as a monthly plan." },
      { step: "3. PDF sent from the yard", desc: "Still on site? Describe the job, generate the PDF, and text it to the customer in 2 minutes." },
    ],
    h2UseCases: "Common services for landscapers",
    useCases: [
      "Regular lawn and garden maintenance",
      "Hedge, shrub, and fruit tree pruning",
      "New landscape design and installation",
      "Automatic irrigation system installation",
      "Pest treatments and fertilizing",
      "Garden beds, planters, and rooftop gardens",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Can I create quotes for annual maintenance contracts?", a: "Yes. Describe it in the text (e.g., 'monthly maintenance April to October') and quoteai structures the quote with the fee and included visits." },
      { q: "Does the quote work for condo or HOA landscaping too?", a: "Perfect for condo and HOA properties. You can create multi-line quotes with different frequencies per service, addressed to the property manager." },
      { q: "Can I add a separate summer and winter price list?", a: "Yes, create separate quotes per season, or include seasonal work in the description and quoteai will distinguish them automatically." },
    ],
    jsonLdDescription: "AI quoting software for Canadian landscapers.",
  },

  "tile-installer": {
    slug: "tile-installer",
    sectorType: "professional",
    label: "Tile Installer",
    labelPlural: "tile installers",
    titleTag: "Tile Installation Quotes | quoteai",
    titleVariants: [
      "Tile Installation Quotes | quoteai",
      "Quoting Software for Tile Installers | quoteai",
      "Create Professional Tile Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for tile, porcelain, and mosaic installation in 30 seconds. AI quoting software for Canadian tile installers. Try it free.",
    descriptionVariants: [
      "Create quotes for tile, porcelain, and mosaic installation in 30 seconds. AI quoting software for Canadian tile installers. Try it free.",
      "AI quoting software for tile installers: square footage math, layout, and subfloor prep in 30 seconds.",
      "Professional quotes for tile installers in 30 seconds. The AI calculates square footage, waste, and subfloor prep.",
    ],
    h1: "Quotes for",
    h1Highlight: "Tile Installers",
    intro: "Porcelain tile, bathroom surrounds, natural stone floors, mosaics: every tile job has specific line items. quoteai turns your technical description into a professional quote with square footage, unit prices, and totals. In 30 seconds, straight from the job site.",
    h2Benefits: "Why tile installers choose quoteai",
    benefits: [
      { title: "Automatic square footage", desc: "Describe the areas and the AI calculates the square footage to order, including typical waste for the format and layout." },
      { title: "A line item per material", desc: "Porcelain, natural stone, mosaic: every material with its own price. The customer sees exactly what they're buying." },
      { title: "Subfloor prep included", desc: "The AI recognizes prep line items: self-levelling, waterproofing membrane, old-floor removal. Nothing gets missed." },
      { title: "Quote from the customer's home in 60 seconds", desc: "Walk the space, describe the job, send the PDF. All in under two minutes before you leave." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the install", desc: "Write: 'Install 20x120 wood-look porcelain tile in a 450 sq ft living room, remove old flooring, self-level the subfloor, matching baseboard.'" },
      { step: "2. AI calculates square footage and cost", desc: "quoteai estimates the square footage with waste, the subfloor-prep line items, and old-material removal. Unit prices for every task." },
      { step: "3. PDF from the job site in 60 seconds", desc: "Still at the customer's home: describe the job, generate the PDF, send it. Whoever answers first wins the job." },
    ],
    h2UseCases: "Common jobs for tile installers",
    useCases: [
      "Large-format porcelain tile in living areas",
      "Bathroom and shower tile and mosaic surrounds",
      "Floor replacement with old-material removal",
      "Natural stone flooring",
      "Shower and wet-area waterproofing",
      "Wood-look tile flooring",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Does the quote include supplying materials?", a: "You choose: specify if material supply is included and quoteai will separate labour cost from material cost." },
      { q: "How do I handle quotes with multiple rooms?", a: "Describe each room in the text ('bathroom 90 sq ft, living room 450 sq ft') and quoteai creates separate line items for each." },
      { q: "Can I use it for stairs or patio tiling too?", a: "Yes. Stairs, patios, balconies, and exterior walls are all line items quoteai recognizes and quantifies automatically." },
    ],
    jsonLdDescription: "AI quoting software for Canadian tile installers.",
  },

  "window-door-installer": {
    slug: "window-door-installer",
    sectorType: "professional",
    label: "Window & Door Installer",
    labelPlural: "window and door installers",
    titleTag: "Window & Door Installation Quotes | quoteai",
    titleVariants: [
      "Window & Door Installation Quotes | quoteai",
      "Quoting Software for Window & Door Installers | quoteai",
      "Create Professional Window Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for windows, doors, and exterior openings in vinyl, fibreglass, and wood in 30 seconds. AI quoting software for Canadian installers.",
    descriptionVariants: [
      "Create quotes for windows, doors, and exterior openings in vinyl, fibreglass, and wood in 30 seconds. AI quoting software for Canadian installers.",
      "AI quoting software for window and door installers: vinyl windows, steel entry doors, garage doors. Professional quotes in 30 seconds.",
      "Professional quotes for window and door installers in 30 seconds. The AI includes technical specs and energy-rebate notes.",
    ],
    h1: "Quotes for",
    h1Highlight: "Window & Door Installers",
    intro: "Vinyl windows, steel entry doors, sectional garage doors, thermally broken aluminum: every product has precise technical specs. quoteai translates the specs into a clear, professional quote with descriptions, quantities, prices, and installation included. In 30 seconds.",
    h2Benefits: "Why window and door installers choose quoteai",
    benefits: [
      { title: "Technical specs on the document", desc: "Energy rating, glass type, colour, and hardware: quoteai includes every technical detail the customer wants to see." },
      { title: "Supply and install, separated", desc: "The quote clearly separates product cost from installation. Transparency that builds trust and cuts down on back-and-forth." },
      { title: "Rebate-eligible upgrades noted", desc: "If the job qualifies for an energy-efficiency window rebate, note it in the description and quoteai adds an explanatory note." },
      { title: "More quotes, more jobs", desc: "With quoteai you respond to more requests in the same amount of time. More quotes sent means more jobs won." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the windows and doors", desc: "Write: '4 vinyl casement windows 40x56, ENERGY STAR rated, dark bronze exterior, 1 steel entry door 36x80 with multi-point lock, installation included.'" },
      { step: "2. AI generates the technical quote", desc: "quoteai includes the technical specs on the document: material, energy rating, security rating, dimensions. Everything the customer wants to know." },
      { step: "3. Professional PDF in 2 minutes", desc: "The document is already formatted with supply and installation separated. The customer gets a professional quote that justifies the price." },
    ],
    h2UseCases: "Common products and jobs for window and door installers",
    useCases: [
      "Vinyl and thermally broken aluminum window replacement",
      "Steel entry doors and front-door installation",
      "Sectional and roll-up garage doors",
      "Custom fixed, retractable, and pleated screens",
      "Motorized rolling shutters and aluminum blinds",
      "Sliding glass doors and glass walls",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Is the quote suitable for an energy-rebate application?", a: "Yes. quoteai generates a document with the required structure, separating supply and installation. It should be paired with the product's spec sheet." },
      { q: "Can I include technical certifications on the quote?", a: "In the description you can mention certifications (energy rating, U-value, sound rating) and quoteai will list them as technical specs." },
      { q: "Does it handle custom-sized openings too?", a: "Perfect for custom sizing. Describe the exact dimensions and features and quoteai generates the line item with a custom price." },
    ],
    jsonLdDescription: "AI quoting software for Canadian window and door installers.",
  },

  roofer: {
    slug: "roofer",
    sectorType: "service",
    label: "Roofer",
    labelPlural: "roofing companies",
    titleTag: "Roof Replacement Quotes | quoteai",
    titleVariants: [
      "Roof Replacement Quotes | quoteai",
      "Quoting Software for Roofers | quoteai",
      "Create Professional Roofing Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for roof replacement, shingles, and flashing in 30 seconds. AI quoting software for Canadian roofers. Try it free.",
    descriptionVariants: [
      "Create quotes for roof replacement, shingles, and flashing in 30 seconds. AI quoting software for Canadian roofers. Try it free.",
      "AI quoting software for roofers: shingles, membranes, flashing, insulation. Professional itemized quotes in 30 seconds.",
      "Professional quotes for roof replacement in 30 seconds. The AI calculates roof area, flashing, and materials.",
    ],
    h1: "Quotes for",
    h1Highlight: "Roofers",
    intro: "Reshingling, deck repair, flashing, attic insulation: every roofing job has high material costs and complex technical line items. quoteai generates a professional itemized quote for roofing work with square footage, unit prices, and separate sections for materials and labour. In 30 seconds.",
    h2Benefits: "Why roofers choose quoteai",
    benefits: [
      { title: "Roofing-specific line items", desc: "Asphalt shingles, ice-and-water shield, underlayment, flashing: quoteai knows the materials and current Canadian market prices." },
      { title: "Separate sections for each phase", desc: "Tear-off, insulation, new roofing, flashing and eavestroughs: every phase in its own section with a distinct cost." },
      { title: "Built for winter-load and code considerations", desc: "Roof work in Canada means accounting for snow load and ice damming. quoteai's line items reflect that reality." },
      { title: "Speed wins jobs", desc: "Whoever does the walkthrough and sends a same-day quote has a huge edge over the competition. With quoteai it takes a minute." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the roofing job", desc: "Write: 'Reshingle a 1,600 sq ft gable roof: tear off old shingles, new underlayment and ice-and-water shield, architectural shingles, aluminum flashing.'" },
      { step: "2. AI calculates the roofing estimate", desc: "quoteai estimates roof area, flashing length, and labour hours. Generates separate sections for tear-off, install, and flashing." },
      { step: "3. PDF with a full breakdown", desc: "A document with a summary and detailed line items. The customer sees the professionalism of your company before work even starts." },
    ],
    h2UseCases: "Common jobs for roofers",
    useCases: [
      "Asphalt shingle roof replacement",
      "Flat-roof and deck waterproofing membranes",
      "Insulation and attic upgrades",
      "Eavestroughs, downspouts, and flashing",
      "Skylight and roof-window installation",
      "Metal roofing and industrial panel systems",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Is the quote suitable for insulation upgrades tied to a rebate program?", a: "Yes. Mention the type of work (attic insulation, air sealing) and quoteai generates the document with materials and labour separated for the application." },
      { q: "How do I handle quotes that include scaffolding or a lift?", a: "Add it to the description and quoteai includes it as a separate line item, priced by area or by day based on your input." },
      { q: "Does it work for routine roof maintenance too?", a: "Great for small maintenance jobs too: replacing a few shingles, sealing flashing, cleaning eavestroughs. Quick line items in 30 seconds." },
    ],
    jsonLdDescription: "AI quoting software for Canadian roofing companies.",
  },

  "air-conditioning-installer": {
    slug: "air-conditioning-installer",
    sectorType: "service",
    label: "Air Conditioning Installer",
    labelPlural: "air conditioning and HVAC installers",
    titleTag: "Air Conditioning Installation Quotes | quoteai – AI",
    titleVariants: [
      "Air Conditioning Installation Quotes | quoteai – AI",
      "Quoting Software for AC Installers | quoteai",
      "Create Professional AC Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for AC, ductless heat pumps, and ventilation installs in 30 seconds. AI quoting software for Canadian installers. Free.",
    descriptionVariants: [
      "Create quotes for AC, ductless heat pumps, and ventilation installs in 30 seconds. AI quoting software for Canadian installers. Free.",
      "AI quoting software for AC installers: ductless splits, heat pumps, HRVs. Professional quotes in 30 seconds.",
      "Professional quotes for air conditioning systems in 30 seconds. The AI includes technical specs and rebate notes.",
    ],
    h1: "Quotes for",
    h1Highlight: "Air Conditioning Installers",
    intro: "Ductless split installs, heat pumps, HRVs, multi-zone systems: every cooling job has precise technical specs and costs that scale with capacity and install complexity. quoteai generates professional cooling and ventilation quotes in 30 seconds.",
    h2Benefits: "Why AC installers choose quoteai",
    benefits: [
      { title: "Spec sheets on the quote", desc: "Capacity in BTU, energy rating, brand and model: every unit described with the specs a customer wants before deciding." },
      { title: "Supply and installation, separated", desc: "The document separates unit cost from installation labour. Transparency that reduces price haggling." },
      { title: "Heat pump rebates noted", desc: "Air-to-water heat pumps often qualify for provincial or utility rebate programs. quoteai adds a note when you mention the install type." },
      { title: "From walkthrough to quote in 2 minutes", desc: "Do the technical assessment, describe the job, and send the PDF before you're even back in the truck." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the cooling system", desc: "Write: 'Install 3 ductless mini-split heads (9,000 BTU each) in living room and 2 bedrooms, 28,000 BTU multi-zone outdoor unit, 10 ft line sets per head, condensate drain.'" },
      { step: "2. AI generates the technical quote", desc: "quoteai includes unit specs (BTU, energy rating, brand) and line items for install and accessories. Adds rebate notes where applicable." },
      { step: "3. PDF with supply and install separated", desc: "The document separates equipment cost from installation. The customer understands what they're paying and can verify the unit price." },
    ],
    h2UseCases: "Common jobs for AC installers",
    useCases: [
      "Single and multi-zone ductless split installation",
      "Air-to-water heat pumps for heating and cooling",
      "VRF and ducted systems for offices and commercial spaces",
      "Heat recovery ventilators (HRVs) and ERVs",
      "Maintenance and refrigerant recharge for existing systems",
      "Industrial evaporative cooling systems",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Does the quote flag rebate eligibility for heat pumps?", a: "Yes. Specify that it's a heat pump and quoteai adds a note flagging typical rebate-program eligibility, with equipment and labour separated." },
      { q: "Can I include an annual maintenance plan on the quote?", a: "Yes. Add the maintenance plan to the description and quoteai creates a separate line item for the annual fee." },
      { q: "Does it work for large commercial cooling systems too?", a: "Absolutely. quoteai supports multi-section quotes for complex systems with multiple units, ductwork, and dedicated electrical." },
    ],
    jsonLdDescription: "AI quoting software for Canadian air conditioning and HVAC installers.",
  },

  "decorative-painter": {
    slug: "decorative-painter",
    sectorType: "professional",
    label: "Painter & Decorative Finisher",
    labelPlural: "painters and decorative finishers",
    titleTag: "Painting & Decorative Finish Quotes | quoteai",
    titleVariants: [
      "Painting & Decorative Finish Quotes | quoteai",
      "Quoting Software for Decorative Painters | quoteai",
      "Create Professional Finishing Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for painting, decorative finishes, and exterior coatings in 30 seconds. AI quoting software for Canadian painters. Free.",
    descriptionVariants: [
      "Create quotes for painting, decorative finishes, and exterior coatings in 30 seconds. AI quoting software for Canadian painters. Free.",
      "AI quoting software for decorative painters: accent finishes, exterior coatings, faux finishes. In 30 seconds.",
      "Professional quotes for decorative painters in 30 seconds. The AI calculates square footage for every surface and finish type.",
    ],
    h1: "Quotes for",
    h1Highlight: "Painters & Finishers",
    intro: "Interior painting, exterior coatings, trim finishing, decorative plaster: this kind of painting work needs detailed quotes with square footage, product type, and number of coats. quoteai generates a professional proposal with distinct line items for each task. In 30 seconds.",
    h2Benefits: "Why painters and decorative finishers choose quoteai",
    benefits: [
      { title: "Automatic square footage for every surface", desc: "Walls, ceilings, exterior siding, trim: the AI estimates area from your description and calculates the square footage to treat." },
      { title: "Product type on the document", desc: "Primer, washable latex, elastomeric coating, enamel: every product named explicitly with number of coats. The customer sees the quality." },
      { title: "Quote on site from your phone", desc: "Walk the job, open quoteai, describe the work, send the PDF. All before the customer calls the next painter." },
      { title: "Interior and exterior work", desc: "From painting a condo to coating a building's exterior: quoteai handles both with the right line items." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the painting job", desc: "Write: '900 sq ft interior repaint: prime all walls, 2 coats white washable latex, ceilings with flat white, interior doors with satin enamel.'" },
      { step: "2. AI calculates the line items", desc: "quoteai identifies surfaces, products, number of coats, and labour hours. Generates a quote with square footage for each task." },
      { step: "3. Professional PDF with your logo", desc: "A document that conveys professional quality. The customer understands what they're getting and trusts your work before even seeing it." },
    ],
    h2UseCases: "Common jobs for painters and decorative finishers",
    useCases: [
      "Interior painting for condos and houses",
      "Exterior coatings with elastomeric or masonry paint",
      "High-end decorative plaster and accent finishes",
      "Painting wood and steel doors and windows",
      "Mould treatment and breathable coatings",
      "Repainting condo and apartment building exteriors",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Does the quote distinguish interior from exterior products?", a: "Yes. The AI reads the context (interior/exterior) and uses the right products: washable latex for interiors, elastomeric or masonry coatings for exteriors." },
      { q: "Can I include the number of coats and primer type on the quote?", a: "Absolutely. Include those details in your description and quoteai will carry them accurately into the document." },
      { q: "How do I handle quotes for buildings needing scaffolding or a lift?", a: "Add the scaffolding or lift cost to the description and quoteai includes it as a separate line item." },
    ],
    jsonLdDescription: "AI quoting software for Canadian painters and decorative finishers.",
  },

  "flooring-installer": {
    slug: "flooring-installer",
    sectorType: "professional",
    label: "Flooring Installer",
    labelPlural: "flooring installers",
    titleTag: "Flooring Installation Quotes | quoteai",
    titleVariants: [
      "Flooring Installation Quotes | quoteai",
      "Quoting Software for Flooring Installers | quoteai",
      "Create Professional Flooring Quotes – quoteai AI",
    ],
    metaDescription: "Create quotes for hardwood, laminate, epoxy, and carpet installation in 30 seconds. AI quoting software for Canadian flooring installers. Try it free.",
    descriptionVariants: [
      "Create quotes for hardwood, laminate, epoxy, and carpet installation in 30 seconds. AI quoting software for Canadian flooring installers. Try it free.",
      "AI quoting software for flooring installers: hardwood, laminate, epoxy. Automatic square footage and subfloor prep in 30 seconds.",
      "Professional quotes for flooring installers in 30 seconds. The AI calculates square footage, waste, subfloor prep, and supply costs.",
    ],
    h1: "Quotes for",
    h1Highlight: "Flooring Installers",
    intro: "Prefinished hardwood, laminate, epoxy coatings, vinyl plank, carpet: every flooring type has different supply and install costs. quoteai generates professional flooring quotes with square footage, product type, subfloor prep, and finish. In 30 seconds.",
    h2Benefits: "Why flooring installers choose quoteai",
    benefits: [
      { title: "Supply and install, separated", desc: "The document separates material cost from installation and subfloor prep. Full transparency." },
      { title: "Subfloor prep included", desc: "The AI automatically includes prep line items — self-levelling, underlayment, primer — when they're needed. Nothing gets missed." },
      { title: "Square footage with a waste allowance", desc: "The AI estimates the square footage to order, including typical waste for the format and layout. Order the right amount, no waste." },
      { title: "From walkthrough to PDF in 60 seconds", desc: "Measure, describe, send. The customer gets the quote before you're back in the truck." },
    ],
    h2HowItWorks: "How it works: 3 steps",
    howItWorks: [
      { step: "1. Describe the flooring job", desc: "Write: 'Install prefinished oak hardwood, 5-inch plank, 500 sq ft living room, with underlayment, self-level the subfloor, matching wood baseboard on all walls.'" },
      { step: "2. AI generates the quote", desc: "quoteai calculates square footage, material type, subfloor prep, and finish. Adds line items for old-flooring removal if requested." },
      { step: "3. PDF ready to send", desc: "A document with a professional header and your company logo. The customer approves it by text and the job starts." },
    ],
    h2UseCases: "Common jobs for flooring installers",
    useCases: [
      "Prefinished hardwood and solid wood floor installation",
      "Laminate and vinyl (LVT/SPC) flooring installation",
      "Epoxy and microcement floor coatings",
      "Carpet and commercial textile flooring",
      "Self-levelling and subfloor prep",
      "Sanding, refinishing, and maintenance of existing hardwood",
    ],
    h2Faq: "Frequently asked questions",
    faq: [
      { q: "Does the quote include removing the old flooring?", a: "If you mention it in the description, yes. quoteai adds a removal-and-disposal line with cost separated from the new install." },
      { q: "Can I quote large epoxy floor jobs?", a: "Yes, great for epoxy coatings in industrial, commercial, or residential settings. quoteai handles any square footage." },
      { q: "Is the quote suited to refinishing existing hardwood too?", a: "Absolutely. Describe the type of work (sanding, refinishing, oil treatment) and quoteai generates line items with per-square-foot pricing." },
    ],
    jsonLdDescription: "AI quoting software for Canadian flooring installers.",
  },

  "excel-template": {
    slug: "excel-template",
    sectorType: "service",
    label: "Excel Quote Template",
    labelPlural: "Excel users",
    titleTag: "Free Excel Quote Template | Better Alternative – quoteai",
    titleVariants: [
      "Free Excel Quote Template | Better Alternative – quoteai",
      "Alternative to the Excel Quote Template | quoteai AI",
      "Quotes Without Excel: Free AI Software – quoteai",
    ],
    metaDescription: "Looking for a free Excel quote template? quoteai is better: generate professional quotes in 30 seconds with AI, no formulas, no mistakes. Try it free.",
    descriptionVariants: [
      "Looking for a free Excel quote template? quoteai is better: generate professional quotes in 30 seconds with AI, no formulas, no mistakes. Try it free.",
      "Alternative to the Excel quote: quoteai generates professional quotes in 30 seconds with AI. No formulas, no mistakes.",
      "Stop using Excel templates for quotes. quoteai's AI generates professional documents in 30 seconds, with tax and totals calculated automatically.",
    ],
    h1: "Done with the",
    h1Highlight: "Excel Quote Template",
    intro: "You download an Excel quote template, spend half an hour setting up formulas, type in the numbers one by one, double-check the math, save it as a PDF — and the document still looks amateur. With quoteai you describe the job in words and in 30 seconds you have a professional quote.",
    h2Benefits: "Why quoteai beats a spreadsheet",
    benefits: [
      { title: "No formulas to set up", desc: "With Excel you have to build or fix the template every time. With quoteai you describe the job and the quote is already structured and calculated." },
      { title: "A professional PDF in one click", desc: "No converting from .xlsx to PDF. The document is already formatted as a professional quote, ready to send to the customer." },
      { title: "Math that's always right", desc: "Excel formulas break. quoteai's AI calculates tax, subtotals, and totals without ever making a mistake." },
      { title: "An automatic digital archive", desc: "With Excel you save files into folders you forget about. With quoteai every quote lives in your digital archive, accessible from any device." },
    ],
    h2HowItWorks: "From description to PDF: 3 steps",
    howItWorks: [
      { step: "1. Write the job in words", desc: "No spreadsheets, no formulas. Write in plain English: 'Bathroom renovation, 80 sq ft: remove old tile, install 24x48 porcelain, replace fixtures.'" },
      { step: "2. AI generates the full quote", desc: "In 30 seconds you have line items, quantities, unit prices, subtotals, and tax. Structured like a proper itemized quote, not a spreadsheet." },
      { step: "3. Download the PDF and send it", desc: "One click to download. The customer receives a professional document with your company letterhead, logo, and payment terms." },
    ],
    h2UseCases: "Who uses quoteai instead of Excel",
    useCases: [
      "Painters and decorators tired of fixing formulas",
      "Plumbers who want to quote from the job site",
      "General contractors with complex multi-section quotes",
      "Carpenters and fabricators tracking materials and labour",
      "Electricians who need to respond to customers fast",
      "Freelancers and consultants sending proposals",
    ],
    h2Faq: "Frequently asked questions about Excel quotes vs. quoteai",
    faq: [
      { q: "Are free Excel quote templates really free?", a: "Yes, but they cost time. Every template needs adapting, formulas need checking, formatting needs fixing. With quoteai you have the PDF in 30 seconds." },
      { q: "Can I import my old Excel quote into quoteai?", a: "No need to import anything. Describe the job in plain language and quoteai builds the quote from scratch, faster than copying from Excel." },
      { q: "Does quoteai work offline like Excel does?", a: "quoteai needs an internet connection. But it works from any device — phone, tablet, laptop — with nothing to install." },
    ],
    jsonLdDescription: "AI alternative to Excel quote templates. Generates professional quotes in 30 seconds, no formulas and no mistakes.",
  },

  "word-template": {
    slug: "word-template",
    sectorType: "service",
    label: "Word Quote Template",
    labelPlural: "Word users",
    titleTag: "Free Word Quote Template | Online AI Quotes – quoteai",
    titleVariants: [
      "Free Word Quote Template | Online AI Quotes – quoteai",
      "Alternative to the Word Quote Template | quoteai AI",
      "Quotes Without Word: Professional AI Software – quoteai",
    ],
    metaDescription: "Looking for a Word quote template to download? quoteai generates professional quotes in 30 seconds with AI. No Word template, no manual formatting.",
    descriptionVariants: [
      "Looking for a Word quote template to download? quoteai generates professional quotes in 30 seconds with AI. No Word template, no manual formatting.",
      "Alternative to a Word quote: quoteai generates professional quotes in 30 seconds with AI. No formatting, no mistakes.",
      "Stop using Word templates for quotes. quoteai's AI generates professional documents in 30 seconds, already formatted and ready to send.",
    ],
    h1: "Forget the",
    h1Highlight: "Word Quote Template",
    intro: "You downloaded a Word quote template, spent half an hour fixing the table formatting, typed the numbers in by hand, and the document still doesn't look as professional as you'd like. With quoteai there's no template to find and nothing to format: describe the job in words and in 30 seconds you have a laid-out, calculated quote ready for the customer.",
    h2Benefits: "Why quoteai beats a Word template",
    benefits: [
      { title: "No template to download", desc: "With Word you have to find the right template, adapt it, and make sure the formatting didn't break. With quoteai you type the job and the quote is done." },
      { title: "Automatic math included", desc: "Word doesn't calculate anything. With quoteai, tax, subtotals, and totals are calculated by the AI automatically — no mistakes, no calculator." },
      { title: "A professional structure by default", desc: "Every quote has a company header, document number, customer details, itemized line items with units, and totals. Structured like an accounting firm's." },
      { title: "Your logo and branding included", desc: "Your logo appears automatically on every quote. With Word you'd have to add it manually to every file." },
    ],
    h2HowItWorks: "How to create a quote without Word",
    howItWorks: [
      { step: "1. Describe the job in plain English", desc: "Write: 'Rewire a 750 sq ft condo: 12 pot lights, 8 outlets, 12-circuit panel with AFCI, 4-drop data cabling.'" },
      { step: "2. AI structures the quote", desc: "In 30 seconds you have an itemized quote with technical descriptions, units, unit prices, and tax calculated. Better than any Word template." },
      { step: "3. Download the PDF and send it right away", desc: "A professional PDF, not a .docx the customer can't open. Send it by text, email, or print it on the spot." },
    ],
    h2UseCases: "Who searches for a Word quote and finds quoteai instead",
    useCases: [
      "Tradespeople searching for 'free Word quote template'",
      "Plumbers and electricians new to writing quotes",
      "General contractors who want a professional standard",
      "Freelancers sending proposals to clients",
      "Renovation contractors and consultants with multi-line quotes",
      "Small businesses without dedicated software",
    ],
    h2Faq: "Questions about Word quotes vs. quoteai",
    faq: [
      { q: "Where can I find a free Word quote template?", a: "There are plenty of free templates online, but they need manual formatting and don't calculate totals. With quoteai it takes a minute and the result is far more professional." },
      { q: "Is the quoteai PDF compatible with every device?", a: "Yes. The PDF opens on any phone, tablet, or computer without needing Microsoft Office or any other program." },
      { q: "Can I customize the quote after the AI generates it?", a: "Yes. You can edit every line item, price, description, and payment term before downloading the final PDF." },
    ],
    jsonLdDescription: "AI alternative to Word quote templates. Generates professional quotes in 30 seconds with no manual formatting.",
  },

  "how-to-quote": {
    slug: "how-to-quote",
    sectorType: "service",
    label: "Professional Quote",
    labelPlural: "contractors",
    titleTag: "How to Write a Professional Quote Online | quoteai Guide",
    titleVariants: [
      "How to Write a Professional Quote Online | quoteai Guide",
      "Guide: How to Write Professional Quotes | quoteai",
      "How to Create an Online Quote in 30 Seconds – quoteai",
    ],
    metaDescription: "Learn how to write a professional quote for your business in 30 seconds. A practical guide for Canadian tradespeople and small businesses. No Excel, no mistakes.",
    descriptionVariants: [
      "Learn how to write a professional quote for your business in 30 seconds. A practical guide for Canadian tradespeople and small businesses. No Excel, no mistakes.",
      "A practical guide to writing professional quotes in 30 seconds. AI software for Canadian tradespeople and small businesses. No Excel, no mistakes.",
      "How to write a professional quote. quoteai's AI generates quotes for tradespeople in 30 seconds. Try it free.",
    ],
    h1: "How to Write a",
    h1Highlight: "Professional Quote",
    intro: "A professional quote isn't just a list of items and prices: it's a sales document that builds trust, justifies the price, and speeds up the customer's decision. To do it right you need: a company header, itemized line items with units, unit prices, subtotals, tax calculated correctly, and clear payment terms. With quoteai, all of this is generated automatically in 30 seconds.",
    h2Benefits: "What a professional quote is and why it matters",
    benefits: [
      { title: "An itemized structure", desc: "A professional quote has distinct line items with a description, unit, quantity, and unit price — not a single number scribbled at the bottom." },
      { title: "Tax always calculated correctly", desc: "GST/HST (and provincial sales tax where it applies) needs to be right. A mistake costs money and credibility. quoteai applies the correct rate automatically." },
      { title: "Clear payment terms", desc: "Deposit, balance on completion, instalments: terms written into the quote reduce disputes and speed up payment." },
      { title: "A fast response wins more jobs", desc: "Whoever sends the quote first often wins the job. With quoteai you respond in 30 seconds instead of the next day." },
    ],
    h2HowItWorks: "How to create a quote in 3 steps",
    howItWorks: [
      { step: "1. Describe the job in words", desc: "You don't need to know the 'right' structure. Write in plain English what needs to be done: quoteai's AI understands and structures everything." },
      { step: "2. Review and customize", desc: "The AI generates the quote in 30 seconds. Check the pricing, adjust line items if you want, add payment terms." },
      { step: "3. Download the PDF and send it", desc: "The document is already formatted with your company header and logo. Send it by text, email, or print it for the customer." },
    ],
    h2UseCases: "Who uses quoteai to write professional quotes",
    useCases: [
      "Tradespeople who want to stop quoting by hand",
      "General contractors looking for fast quoting software",
      "Plumbers and electricians who quote from the job site",
      "Freelancers sending proposals to clients",
      "Renovation contractors who need to justify higher prices",
      "Small businesses that want a professional-looking quote",
    ],
    h2Faq: "Questions about how to write a quote",
    faq: [
      { q: "What's the right structure for a professional quote?", a: "A good quote includes: a header with your business number and contact info, a document number and date, customer details, line items with description/unit/quantity/price, totals with tax, and payment terms. quoteai generates all of this automatically." },
      { q: "What's the difference between a quote, an estimate, and a proposal?", a: "They're mostly different names for a similar document. A 'quote' is common for trades work, a 'proposal' for professional services, an 'estimate' when final costs may vary. quoteai generates all three formats." },
      { q: "How should I price a quote? How do I set my rates?", a: "quoteai suggests typical Canadian market prices for each type of job. You can adjust them freely based on your own price list, region, and job complexity." },
    ],
    jsonLdDescription: "A practical guide on how to write a professional quote. AI software for Canadian tradespeople and small businesses: quotes in 30 seconds.",
  },

  "free-quote": {
    slug: "free-quote",
    sectorType: "service",
    label: "Free Quotes",
    labelPlural: "contractors and small businesses",
    titleTag: "Free Online Quotes | Free Quoting Software – quoteai",
    titleVariants: [
      "Free Online Quotes | Free Quoting Software – quoteai",
      "Free Quoting Software for Contractors | quoteai",
      "Create Online Quotes for Free with AI – quoteai",
    ],
    metaDescription: "Create quotes online for free with quoteai. Free quoting software for Canadian contractors and small businesses. Get started with no credit card.",
    descriptionVariants: [
      "Create quotes online for free with quoteai. Free quoting software for Canadian contractors and small businesses. Get started with no credit card.",
      "Free quoting software for Canadian tradespeople. Get started with no credit card. Starter plan with a monthly quote allowance.",
      "Free online quotes for contractors and small businesses. quoteai's AI generates professional quotes in 30 seconds. No credit card.",
    ],
    h1: "Free Online",
    h1Highlight: "Quotes to Get Started",
    intro: "Looking for software to create quotes online for free? quoteai lets you get started with no credit card: create your account, describe the job in words, and generate your first professional quote in 30 seconds. The Starter plan includes a monthly quote allowance — plenty for most small businesses.",
    h2Benefits: "Why quoteai is the best free quoting software",
    benefits: [
      { title: "Free trial, no credit card", desc: "Sign up, create your first quote, and see the result before any payment. No commitment, no surprises." },
      { title: "An affordable Starter plan", desc: "The Starter plan includes a monthly quote allowance. For most tradespeople it's more than enough to get going." },
      { title: "Unlimited quotes with Pro", desc: "For anyone with a high quote volume, the Pro plan offers unlimited quotes with no restrictions." },
      { title: "Nothing to install", desc: "quoteai runs right in the browser, from a phone or a computer. No installation, no manual updates." },
    ],
    h2HowItWorks: "Get started free in 3 minutes",
    howItWorks: [
      { step: "1. Create your free account", desc: "Sign up in 30 seconds with your email or a Google account. No credit card required to get started." },
      { step: "2. Set up your business profile", desc: "Enter your company name, business number, address, and upload your logo. This information shows up on every quote you generate." },
      { step: "3. Generate your first quote for free", desc: "Describe the job in plain English and the AI generates the quote in 30 seconds. Download the PDF and send it to the customer." },
    ],
    h2UseCases: "Who's looking for free quoting software",
    useCases: [
      "Tradespeople new to writing professional quotes",
      "Small businesses digitizing their quoting process",
      "Freelancers looking for a free alternative to Word and Excel",
      "Electricians and plumbers who want to try before they pay",
      "Building consultants and professionals testing new tools",
      "General contractors considering switching software",
    ],
    h2Faq: "Questions about quoteai's free plan",
    faq: [
      { q: "Is quoteai really free?", a: "Signing up is free, and you can create your first quote without paying. The Starter plan is affordable and includes a monthly quote allowance. No credit card required to get started." },
      { q: "How many quotes can I create for free?", a: "You can preview a generated quote for free. To download the PDF you'll need a paid plan or a single quote purchase." },
      { q: "What happens if I go over my Starter plan's monthly quote allowance?", a: "The system notifies you as you approach the limit. You can upgrade to the Pro plan (unlimited) or purchase additional single quotes." },
    ],
    jsonLdDescription: "Free online quoting software for Canadian contractors and small businesses. Get started for free, no credit card.",
  },
};

export interface SectorReview {
  authorName: string;
  ratingValue: "4" | "5";
  reviewBody: string;
  datePublished: string;
}

export const SECTOR_REVIEWS: Record<string, SectorReview[]> = {
  painter: [
    { authorName: "Mark R.", ratingValue: "5", reviewBody: "Finally software that gets what painting work actually involves. I describe 'two coats white washable latex on 900 sq ft plus ceilings' and in 30 seconds I have a quote ready with quantities and prices. Customers sign it right away.", datePublished: "2024-10-12" },
    { authorName: "Lucy F.", ratingValue: "5", reviewBody: "I used to lose an hour to a spreadsheet for every quote. With quoteai I do it from my phone while I'm still on site. I send it to the customer by text before I'm out the door. Great tool.", datePublished: "2024-11-03" },
  ],
  electrician: [
    { authorName: "John M.", ratingValue: "5", reviewBody: "The AI knows electrical terminology: panels, breakers, pot lights. I described a condo rewire and the quote was better structured than the ones I used to make by hand. Impressive.", datePublished: "2024-09-20" },
    { authorName: "Steve C.", ratingValue: "5", reviewBody: "I expected trouble with large commercial jobs, but it handles multi-section quotes well. Started on the Starter plan, upgraded to Pro right away.", datePublished: "2024-11-18" },
  ],
  plumber: [
    { authorName: "Rob V.", ratingValue: "5", reviewBody: "I've been a plumber for 20 years and never made a quote this fast. I describe a furnace replacement and quoteai builds it all: furnace, fittings, commissioning, disposal. Nailed it.", datePublished: "2024-10-08" },
    { authorName: "Andrew P.", ratingValue: "4", reviewBody: "Really useful for emergency calls: I get to the customer, see the issue, write the description, and send the quote before I'm back in the truck. Customers appreciate the speed.", datePublished: "2024-11-22" },
  ],
  "general-contractor": [
    { authorName: "Luke B.", ratingValue: "5", reviewBody: "As a general contractor I needed a multi-section itemized quote. quoteai generates foundations, framing, drywall, and finishes as separate sections. As professional as an engineering firm's.", datePublished: "2024-09-30" },
    { authorName: "Simon T.", ratingValue: "5", reviewBody: "We cut the time spent on quotes drastically. It used to take two hours, now it's five minutes. The PDF has a structure clients respect.", datePublished: "2024-10-25" },
  ],
  "renovation-contractor": [
    { authorName: "Helen C.", ratingValue: "5", reviewBody: "I run full renovations and need to coordinate demolition, mechanical, flooring, and finishes into one document. quoteai organizes it all into sections automatically. Incredible.", datePublished: "2024-10-14" },
    { authorName: "Frank N.", ratingValue: "5", reviewBody: "I mentioned an energy-efficiency upgrade in the text and quoteai automatically added a note flagging it in the quote. Didn't expect that. Huge time saver.", datePublished: "2024-11-10" },
  ],
  "welder-fabricator": [
    { authorName: "Dave A.", ratingValue: "5", reviewBody: "For fabrication jobs I always struggled to explain the cost breakdown to customers. Now quoteai calculates steel weight, welding hours, and paint automatically. The customer immediately gets the pricing.", datePublished: "2024-10-03" },
    { authorName: "Mike G.", ratingValue: "5", reviewBody: "I do gates and fencing. I described a 10x6 ft sliding gate with a motor and the quote structure was already right, with materials and labour separated. Excellent.", datePublished: "2024-11-15" },
  ],
  "carpenter-cabinetmaker": [
    { authorName: "George L.", ratingValue: "5", reviewBody: "I build custom furniture and closets. With quoteai I describe the wood species, finishes, and dimensions and the quote includes everything correctly. Customers get professional documents.", datePublished: "2024-09-25" },
    { authorName: "Carla M.", ratingValue: "5", reviewBody: "Finally software that knows carpentry terms: solid wood, veneer, matte lacquer. I don't have to explain every term to the AI. It just gets it.", datePublished: "2024-11-07" },
  ],
  "hvac-technician": [
    { authorName: "Peter R.", ratingValue: "5", reviewBody: "As an HVAC tech I handle both plumbing and heating systems. quoteai understands both without issue. In 30 seconds I have a full quote for a furnace, solar panels, and water lines.", datePublished: "2024-10-19" },
    { authorName: "Nick S.", ratingValue: "5", reviewBody: "I tried other software but it was complicated. quoteai is simple: I write what I'm doing in plain English and it generates the document. Works well even if you're not techy.", datePublished: "2024-11-01" },
  ],
  freelance: [
    { authorName: "Anna V.", ratingValue: "5", reviewBody: "As a freelancer I send quotes every week. With quoteai it takes 5 minutes instead of half an hour. The document is already professionally formatted and the client can't tell an AI made it.", datePublished: "2024-10-06" },
    { authorName: "Paul F.", ratingValue: "4", reviewBody: "Great for anyone working solo who doesn't want to lose time to admin. The PDF looks professional and clients take the quote more seriously than the ones I used to send in Word.", datePublished: "2024-11-20" },
  ],
  "building-consultant": [
    { authorName: "Matt D.", ratingValue: "5", reviewBody: "As a building consultant I quote complex renovation oversight jobs. quoteai generates multi-section itemized quotes I can customize. Saves me two hours per quote.", datePublished: "2024-09-15" },
    { authorName: "Sarah L.", ratingValue: "5", reviewBody: "The format of quotes generated by quoteai is as professional as a technical firm's. Private clients are always impressed by the quality of the document.", datePublished: "2024-10-28" },
  ],
  mason: [
    { authorName: "Claude B.", ratingValue: "5", reviewBody: "I do masonry and parging. I used to write quotes by hand on a pad. Now with quoteai I have a professional PDF in 30 seconds. Customers take me a lot more seriously.", datePublished: "2024-10-11" },
    { authorName: "Richard P.", ratingValue: "5", reviewBody: "I described a job with partition demolition, new block wall, and parging, and quoteai correctly separated the line items with per-square-foot pricing. Exactly what I wanted.", datePublished: "2024-11-13" },
  ],
  landscaper: [
    { authorName: "Val C.", ratingValue: "5", reviewBody: "For landscaping jobs I always struggled to price things out. quoteai understands pruning hours, lawn square footage, and materials, and generates a clear quote. Customers understand what they're paying for right away.", datePublished: "2024-10-07" },
    { authorName: "Tony R.", ratingValue: "4", reviewBody: "Great for maintenance quotes and irrigation systems. I write the yard description and the system correctly estimates labour hours and materials needed.", datePublished: "2024-11-16" },
  ],
  "tile-installer": [
    { authorName: "Emil G.", ratingValue: "5", reviewBody: "As a tile installer I need to calculate square footage, thinset, grout, and surrounds separately. quoteai does it all automatically from the description. I don't make pricing mistakes anymore.", datePublished: "2024-10-09" },
    { authorName: "Fiona A.", ratingValue: "5", reviewBody: "I described a 24x24 porcelain tile install over 270 sq ft plus a bathroom surround, and quoteai calculated everything with separate pricing for materials and labour. Perfect.", datePublished: "2024-11-08" },
  ],
  "window-door-installer": [
    { authorName: "Bruce N.", ratingValue: "5", reviewBody: "Window and door quotes always have a lot of line items: sizes, glass, hardware, installation. quoteai handles all that complexity automatically. Saves me an hour per quote.", datePublished: "2024-10-17" },
    { authorName: "Teresa M.", ratingValue: "5", reviewBody: "I can finally quote while I'm still taking measurements at the customer's home. I describe the windows and doors and the document is ready by the time I leave.", datePublished: "2024-11-05" },
  ],
  roofer: [
    { authorName: "Frank L.", ratingValue: "5", reviewBody: "Roofing quotes are always complex: shingles, insulation, flashing. quoteai splits it all correctly into line items with per-square-foot pricing. Customers understand every line.", datePublished: "2024-10-22" },
    { authorName: "Gina C.", ratingValue: "4", reviewBody: "I described a full reshingle and the quote included tear-off, ice-and-water shield, shingles, flashing, and disposal. All correct and in 30 seconds.", datePublished: "2024-11-11" },
  ],
  "air-conditioning-installer": [
    { authorName: "Mark P.", ratingValue: "5", reviewBody: "I've installed AC units for years. With quoteai I describe the capacity, the type (single or multi-zone), and the outdoor unit distance and the quote already includes labour, line sets, and testing. Great.", datePublished: "2024-10-05" },
    { authorName: "Rose F.", ratingValue: "5", reviewBody: "Customers always ask for written quotes. I used to make them in Word and it took too long. With quoteai it's instant and the PDF looks professional enough to close the deal.", datePublished: "2024-11-19" },
  ],
  "decorative-painter": [
    { authorName: "Andrew L.", ratingValue: "5", reviewBody: "As a painter I do repaints, exterior coatings, and decorative finishes. quoteai knows decorative plaster, breathable coatings, priming. Generates the right line items without me having to explain every technique.", datePublished: "2024-10-16" },
    { authorName: "Monica B.", ratingValue: "5", reviewBody: "I was worried the AI wouldn't understand painting work, but it nails the difference between a primer coat and a finish coat. Per-square-foot pricing is right in line with the market.", datePublished: "2024-11-04" },
  ],
  "flooring-installer": [
    { authorName: "Serge C.", ratingValue: "5", reviewBody: "I install hardwood, laminate, and tile. quoteai understands the install differences and generates separate line items for material, adhesive, baseboard, and old-floor removal. Finally, software that knows the trade.", datePublished: "2024-10-13" },
    { authorName: "Irene V.", ratingValue: "5", reviewBody: "I tried other software but it was too generic. quoteai uses the right terminology for flooring installers and the result is a professional document customers understand and sign without hesitation.", datePublished: "2024-11-14" },
  ],
  "excel-template": [
    { authorName: "Christine M.", ratingValue: "5", reviewBody: "I used a template I downloaded online. Formatting to fix every time, manual math, wrong tax. With quoteai I stopped using Excel for good. Everything's automatic now.", datePublished: "2024-10-21" },
    { authorName: "Ed R.", ratingValue: "5", reviewBody: "My Excel template used to break every time I sent it to a customer on a Mac. With quoteai I send a PDF that opens on any device. Finally, no more compatibility headaches.", datePublished: "2024-11-09" },
  ],
  "word-template": [
    { authorName: "Beth F.", ratingValue: "5", reviewBody: "I spent months looking for the right Word template. They all had formatting issues. With quoteai I don't need a template anymore: the document is already perfect once it's generated.", datePublished: "2024-10-18" },
    { authorName: "Sam P.", ratingValue: "4", reviewBody: "quoteai's PDF opens on any phone with no need for Word or Office. My customers don't need to install anything to open it. Much more practical than a .docx file.", datePublished: "2024-11-02" },
  ],
  "how-to-quote": [
    { authorName: "Dan A.", ratingValue: "5", reviewBody: "I didn't know how to structure a professional quote. The guide explained what to include and quoteai generates it automatically with the whole correct structure: header, line items, tax, payment terms.", datePublished: "2024-10-02" },
    { authorName: "Nadia C.", ratingValue: "5", reviewBody: "I started from zero as a tradesperson. With quoteai my first quote already looked as professional as the big companies'. Customers have no idea it took 30 seconds.", datePublished: "2024-11-17" },
  ],
  "free-quote": [
    { authorName: "Gino F.", ratingValue: "5", reviewBody: "I tried quoteai for free and after the first quote I signed up for the Starter plan. Worth every dollar. The time I save is worth way more than the monthly cost.", datePublished: "2024-10-24" },
    { authorName: "Carmen R.", ratingValue: "5", reviewBody: "No credit card to try it, no commitment. I created my first quote for free and the result already looked professional. Then I picked the monthly plan without hesitating.", datePublished: "2024-11-06" },
  ],
  professionista: [
    { authorName: "Lawrence B.", ratingValue: "5", reviewBody: "I use quoteai every day for my small business's quotes. Cut prep time from an hour to under five minutes. Customers get professional documents and sign a lot more often.", datePublished: "2024-10-27" },
    { authorName: "Alicia D.", ratingValue: "5", reviewBody: "The AI understands my trade's technical language without me needing to use formal terms. I describe the job like I'd explain it to a friend and the quote comes out perfect.", datePublished: "2024-11-12" },
  ],
};

export const SECTOR_RATINGS: Record<string, { ratingValue: number; reviewCount: number }> = {
  painter: { ratingValue: 4.8, reviewCount: 127 },
  electrician: { ratingValue: 4.9, reviewCount: 143 },
  plumber: { ratingValue: 4.8, reviewCount: 118 },
  "general-contractor": { ratingValue: 4.7, reviewCount: 96 },
  "renovation-contractor": { ratingValue: 4.8, reviewCount: 134 },
  "welder-fabricator": { ratingValue: 4.8, reviewCount: 89 },
  "carpenter-cabinetmaker": { ratingValue: 4.9, reviewCount: 76 },
  "hvac-technician": { ratingValue: 4.8, reviewCount: 104 },
  freelance: { ratingValue: 4.7, reviewCount: 81 },
  "building-consultant": { ratingValue: 4.8, reviewCount: 92 },
  mason: { ratingValue: 4.7, reviewCount: 88 },
  landscaper: { ratingValue: 4.8, reviewCount: 73 },
  "tile-installer": { ratingValue: 4.9, reviewCount: 71 },
  "window-door-installer": { ratingValue: 4.8, reviewCount: 79 },
  roofer: { ratingValue: 4.7, reviewCount: 67 },
  "air-conditioning-installer": { ratingValue: 4.8, reviewCount: 84 },
  "decorative-painter": { ratingValue: 4.8, reviewCount: 83 },
  "flooring-installer": { ratingValue: 4.9, reviewCount: 68 },
  "excel-template": { ratingValue: 4.7, reviewCount: 156 },
  "word-template": { ratingValue: 4.7, reviewCount: 138 },
  "how-to-quote": { ratingValue: 4.8, reviewCount: 201 },
  "free-quote": { ratingValue: 4.8, reviewCount: 178 },
  professionista: { ratingValue: 4.8, reviewCount: 312 },
};

export const DEFAULT_SECTOR: SectorData = {
  slug: "professionista",
  sectorType: "professional",
  label: "Contractor",
  labelPlural: "contractors",
  titleTag: "Online Quotes for Contractors | quoteai – AI",
  titleVariants: [
    "Online Quotes for Contractors | quoteai – AI",
    "Quoting Software for Tradespeople & Small Business | quoteai",
    "Create Professional Quotes Online – quoteai AI",
  ],
  metaDescription: "Create professional quotes in 30 seconds with AI. Digital quoting software for Canadian contractors, small businesses, and tradespeople. Free.",
  descriptionVariants: [
    "Create professional quotes in 30 seconds with AI. Digital quoting software for Canadian contractors, small businesses, and tradespeople. Free.",
    "AI quoting software for Canadian tradespeople and small businesses. Generate professional quotes in 30 seconds. No Excel, no mistakes.",
    "Professional quotes in 30 seconds with AI. For contractors, general contractors, freelancers, and Canadian professionals. Try it free.",
  ],
  h1: "Quotes for",
  h1Highlight: "Contractors",
  intro: "quoteai is the AI quoting software built for Canadian contractors, tradespeople, and small businesses. Describe the job in plain language and get a complete professional quote in 30 seconds. No Excel, no handwritten sheets, no mistakes.",
  h2Benefits: "Why choose quoteai",
  benefits: [
    { title: "Speed", desc: "30 seconds for a complete quote. Send it to the customer while you're still on site." },
    { title: "Professionalism", desc: "A document with your header, itemized line items, tax, and payment terms." },
    { title: "Zero mistakes", desc: "Automatic calculations. The AI never gets the totals wrong." },
    { title: "Digital archive", desc: "Every quote you've made, always accessible, from any device." },
  ],
  h2HowItWorks: "How it works",
  howItWorks: [
    { step: "1. Describe the job", desc: "Write in plain English what needs to be done." },
    { step: "2. AI generates the quote", desc: "Line items, quantities, prices, and tax calculated automatically." },
    { step: "3. Download and send", desc: "A ready PDF with your logo. Send it by text or email." },
  ],
  h2UseCases: "Who quoteai is for",
  useCases: ["Tradespeople", "General contractors", "Painters", "Electricians", "Plumbers", "Freelancers and consultants"],
  h2Faq: "Frequently asked questions",
  faq: [
    { q: "How much does quoteai cost?", a: "The Starter plan and the Pro plan (unlimited quotes) are both available as monthly subscriptions. Single-quote purchases are also available." },
    { q: "Do I need a credit card to try it?", a: "No. You can sign up for free and create your first quote without entering any payment details." },
  ],
  jsonLdDescription: "AI quoting software for Canadian contractors and tradespeople.",
};

export interface CityData {
  name: string;
  slug: string;
  region: string;
  regionSlug: string;
  nearbySlug: string[];
}

/**
 * Launch city list for the Canadian market. Chosen for national coverage
 * across the major metro areas, with proper French-Canadian coverage for
 * Quebec: Montreal, Quebec City, Gatineau and Laval are the French-primary
 * markets (their CITY_CONTEXT copy and, once locale routing exists, their
 * default served language should be fr-CA) — every other city here is
 * English-primary. The site is bilingual end to end, so BOTH language
 * versions should eventually exist for every city; see the note on
 * ACTIVE_CITY_SLUGS below and the lang-aware CITY_CONTEXT shape for what's
 * already wired vs. what the follow-up i18n/routing pass still needs to add.
 */
export const CITIES: CityData[] = [
  // Ontario
  { name: "Toronto", slug: "toronto", region: "Ontario", regionSlug: "ontario", nearbySlug: ["mississauga", "hamilton", "ottawa", "vancouver", "montreal"] },
  { name: "Ottawa", slug: "ottawa", region: "Ontario", regionSlug: "ontario", nearbySlug: ["toronto", "gatineau", "montreal", "mississauga", "hamilton"] },
  { name: "Mississauga", slug: "mississauga", region: "Ontario", regionSlug: "ontario", nearbySlug: ["toronto", "hamilton", "ottawa", "vancouver", "calgary"] },
  { name: "Hamilton", slug: "hamilton", region: "Ontario", regionSlug: "ontario", nearbySlug: ["toronto", "mississauga", "ottawa", "vancouver", "calgary"] },
  // British Columbia
  { name: "Vancouver", slug: "vancouver", region: "British Columbia", regionSlug: "british-columbia", nearbySlug: ["surrey", "victoria", "calgary", "edmonton", "toronto"] },
  { name: "Surrey", slug: "surrey", region: "British Columbia", regionSlug: "british-columbia", nearbySlug: ["vancouver", "victoria", "calgary", "edmonton", "toronto"] },
  { name: "Victoria", slug: "victoria", region: "British Columbia", regionSlug: "british-columbia", nearbySlug: ["vancouver", "surrey", "calgary", "edmonton", "toronto"] },
  // Alberta
  { name: "Calgary", slug: "calgary", region: "Alberta", regionSlug: "alberta", nearbySlug: ["edmonton", "vancouver", "winnipeg", "surrey", "toronto"] },
  { name: "Edmonton", slug: "edmonton", region: "Alberta", regionSlug: "alberta", nearbySlug: ["calgary", "vancouver", "winnipeg", "surrey", "toronto"] },
  // Manitoba
  { name: "Winnipeg", slug: "winnipeg", region: "Manitoba", regionSlug: "manitoba", nearbySlug: ["calgary", "edmonton", "toronto", "ottawa", "vancouver"] },
  // Quebec (French-primary markets)
  { name: "Montreal", slug: "montreal", region: "Quebec", regionSlug: "quebec", nearbySlug: ["laval", "gatineau", "quebec-city", "ottawa", "toronto"] },
  { name: "Quebec City", slug: "quebec-city", region: "Quebec", regionSlug: "quebec", nearbySlug: ["montreal", "laval", "gatineau", "ottawa", "toronto"] },
  { name: "Gatineau", slug: "gatineau", region: "Quebec", regionSlug: "quebec", nearbySlug: ["ottawa", "montreal", "laval", "quebec-city", "toronto"] },
  { name: "Laval", slug: "laval", region: "Quebec", regionSlug: "quebec", nearbySlug: ["montreal", "gatineau", "quebec-city", "ottawa", "toronto"] },
  // Nova Scotia
  { name: "Halifax", slug: "halifax", region: "Nova Scotia", regionSlug: "nova-scotia", nearbySlug: ["ottawa", "montreal", "toronto", "quebec-city", "gatineau"] },
];

/** Quebec cities where French is the primary/default language once locale routing exists. */
export const FRENCH_PRIMARY_CITY_SLUGS: readonly string[] = ["montreal", "quebec-city", "gatineau", "laval"];

export const CITIES_BY_SLUG: Record<string, CityData> = Object.fromEntries(
  CITIES.map((c) => [c.slug, c])
);

// A few SECTORS entries are generic guides/tools, not geo-localizable trades —
// "quote using an Excel template in Halifax" makes no sense as a distinct page.
const NON_LOCAL_SECTOR_SLUGS = new Set([
  "how-to-quote",
  "excel-template",
  "word-template",
  "free-quote",
]);

export const CITY_SECTORS: readonly string[] = Object.keys(SECTORS).filter(
  (slug) => !NON_LOCAL_SECTOR_SLUGS.has(slug),
);

/**
 * Active/indexable city set. The original Italian build restricted this to a
 * single region ("Lombardia") to contain crawl budget on a brand-new,
 * low-authority domain that once listed 1000+ near-duplicate city pages —
 * Google was leaving almost all of them "Discovered – currently not indexed".
 *
 * For the Canadian launch we start from a small, deliberately curated
 * national list (see CITIES above) rather than every city in the country, so
 * that containment problem doesn't apply the same way: all of CITIES is the
 * active set. ACTIVE_CITY_SLUGS is kept as an explicit allowlist (rather than
 * just aliasing CITIES) so that if a larger reserve pool of inactive cities
 * is added later, gating sitemap/prerender/internal-links generation is a
 * one-line change here, matching the pattern the Italian build used.
 */
export const ACTIVE_CITY_SLUGS: ReadonlySet<string> = new Set(CITIES.map((c) => c.slug));

export const ACTIVE_CITIES: CityData[] = CITIES.filter((c) => ACTIVE_CITY_SLUGS.has(c.slug));

export const SECTOR_CITIES: Record<string, string[]> = Object.fromEntries(
  Object.keys(SECTORS).map((s) => [s, CITIES.map((c) => c.slug)])
);

function strHash(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

const CITY_TITLE_FORMULAS: Array<(label: string, labelPlural: string, city: string) => string> = [
  (label, _lp, city) => `${label} Quote in ${city} | quoteai – AI in 30s`,
  (_l, labelPlural, city) => `Quoting Software for ${labelPlural} in ${city} | quoteai`,
  (label, _lp, city) => `Professional ${label} Quotes in ${city} – quoteai`,
  (label, _lp, city) => `${label} in ${city}: Online Quote in 30 Seconds | quoteai`,
  (_l, labelPlural, city) => `Quotes for ${labelPlural} in ${city} | quoteai AI Software`,
];

const CITY_DESC_FORMULAS: Array<(label: string, labelPlural: string, city: string, region: string) => string> = [
  (_l, labelPlural, city, region) => `AI quoting software for ${labelPlural} in ${city}. Create professional quotes in 30 seconds. No credit card. Used across ${region}.`,
  (_l, labelPlural, city) => `${labelPlural} in ${city} generate professional quotes with quoteai in 30 seconds. No Excel, no mistakes. Try it free.`,
  (_l, labelPlural, city) => `${labelPlural} in ${city} use quoteai to create quotes in 30 seconds. Professional, fast, error-free. Try it free.`,
  (label, _lp, city, region) => `${label} quote in ${city} in 30 seconds with AI. Professional software for tradespeople in ${region}. No commitment.`,
  (_l, labelPlural, city) => `Quotes for ${labelPlural} in ${city} in 30 seconds with AI. Nothing to install. Try it free.`,
];

// Google truncates titles at ~70 chars; Semrush flags anything longer.
const MAX_TITLE_LENGTH = 70;

export function getCityTitle(sector: SectorData, cityName: string, citySlug: string): string {
  const hash = strHash(sector.slug + citySlug);
  const formula = CITY_TITLE_FORMULAS[hash % CITY_TITLE_FORMULAS.length];
  const title = formula(sector.label, sector.labelPlural, cityName);
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return `Quotes for ${sector.labelPlural} in ${cityName} | quoteai`;
}

export function getCityDesc(sector: SectorData, cityName: string, citySlug: string, region: string): string {
  const hash = strHash(sector.slug + citySlug + "d");
  const formula = CITY_DESC_FORMULAS[hash % CITY_DESC_FORMULAS.length];
  return formula(sector.label, sector.labelPlural, cityName, region);
}

export const RELATED_SECTORS: Record<string, { slug: string; label: string }[]> = {
  painter: [
    { slug: "decorative-painter", label: "Painters & Finishers" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "tile-installer", label: "Tile Installers" },
    { slug: "mason", label: "Masons" },
    { slug: "flooring-installer", label: "Flooring Installers" },
    { slug: "excel-template", label: "Excel Alternative" },
  ],
  "decorative-painter": [
    { slug: "painter", label: "Painters" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "tile-installer", label: "Tile Installers" },
    { slug: "mason", label: "Masons" },
    { slug: "window-door-installer", label: "Window & Door Installers" },
    { slug: "word-template", label: "Word Alternative" },
  ],
  electrician: [
    { slug: "plumber", label: "Plumbers" },
    { slug: "hvac-technician", label: "HVAC & Heating" },
    { slug: "air-conditioning-installer", label: "AC Installers" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "general-contractor", label: "General Contractors" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
  ],
  plumber: [
    { slug: "hvac-technician", label: "HVAC & Heating" },
    { slug: "electrician", label: "Electricians" },
    { slug: "air-conditioning-installer", label: "AC Installers" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "mason", label: "Masons" },
    { slug: "free-quote", label: "Free Quotes" },
  ],
  "general-contractor": [
    { slug: "mason", label: "Masons" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "roofer", label: "Roofers" },
    { slug: "building-consultant", label: "Building Consultants" },
    { slug: "tile-installer", label: "Tile Installers" },
    { slug: "excel-template", label: "Excel Alternative" },
  ],
  "renovation-contractor": [
    { slug: "general-contractor", label: "General Contractors" },
    { slug: "mason", label: "Masons" },
    { slug: "plumber", label: "Plumbers" },
    { slug: "electrician", label: "Electricians" },
    { slug: "window-door-installer", label: "Window & Door Installers" },
    { slug: "tile-installer", label: "Tile Installers" },
  ],
  "welder-fabricator": [
    { slug: "carpenter-cabinetmaker", label: "Carpenters" },
    { slug: "mason", label: "Masons" },
    { slug: "window-door-installer", label: "Window & Door Installers" },
    { slug: "roofer", label: "Roofers" },
    { slug: "general-contractor", label: "General Contractors" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
  ],
  "carpenter-cabinetmaker": [
    { slug: "welder-fabricator", label: "Welders & Fabricators" },
    { slug: "window-door-installer", label: "Window & Door Installers" },
    { slug: "flooring-installer", label: "Flooring Installers" },
    { slug: "tile-installer", label: "Tile Installers" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "word-template", label: "Word Alternative" },
  ],
  "hvac-technician": [
    { slug: "plumber", label: "Plumbers" },
    { slug: "electrician", label: "Electricians" },
    { slug: "air-conditioning-installer", label: "AC Installers" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "free-quote", label: "Free Quotes" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
  ],
  freelance: [
    { slug: "building-consultant", label: "Building Consultants" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
    { slug: "word-template", label: "Word Alternative" },
    { slug: "excel-template", label: "Excel Alternative" },
    { slug: "free-quote", label: "Free Quotes" },
    { slug: "decorative-painter", label: "Painters & Finishers" },
  ],
  "building-consultant": [
    { slug: "general-contractor", label: "General Contractors" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "freelance", label: "Freelancers" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
    { slug: "mason", label: "Masons" },
    { slug: "roofer", label: "Roofers" },
  ],
  mason: [
    { slug: "general-contractor", label: "General Contractors" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "tile-installer", label: "Tile Installers" },
    { slug: "painter", label: "Painters" },
    { slug: "roofer", label: "Roofers" },
    { slug: "building-consultant", label: "Building Consultants" },
  ],
  landscaper: [
    { slug: "free-quote", label: "Free Quotes" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
    { slug: "excel-template", label: "Excel Alternative" },
    { slug: "freelance", label: "Freelancers" },
    { slug: "flooring-installer", label: "Flooring Installers" },
    { slug: "decorative-painter", label: "Painters & Finishers" },
  ],
  "tile-installer": [
    { slug: "flooring-installer", label: "Flooring Installers" },
    { slug: "mason", label: "Masons" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "painter", label: "Painters" },
    { slug: "carpenter-cabinetmaker", label: "Carpenters" },
    { slug: "excel-template", label: "Excel Alternative" },
  ],
  "window-door-installer": [
    { slug: "carpenter-cabinetmaker", label: "Carpenters" },
    { slug: "welder-fabricator", label: "Welders & Fabricators" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "roofer", label: "Roofers" },
    { slug: "mason", label: "Masons" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
  ],
  roofer: [
    { slug: "general-contractor", label: "General Contractors" },
    { slug: "mason", label: "Masons" },
    { slug: "window-door-installer", label: "Window & Door Installers" },
    { slug: "welder-fabricator", label: "Welders & Fabricators" },
    { slug: "building-consultant", label: "Building Consultants" },
    { slug: "excel-template", label: "Excel Alternative" },
  ],
  "air-conditioning-installer": [
    { slug: "hvac-technician", label: "HVAC & Heating" },
    { slug: "plumber", label: "Plumbers" },
    { slug: "electrician", label: "Electricians" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "free-quote", label: "Free Quotes" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
  ],
  "flooring-installer": [
    { slug: "tile-installer", label: "Tile Installers" },
    { slug: "carpenter-cabinetmaker", label: "Carpenters" },
    { slug: "renovation-contractor", label: "Renovations" },
    { slug: "painter", label: "Painters" },
    { slug: "mason", label: "Masons" },
    { slug: "word-template", label: "Word Alternative" },
  ],
  "excel-template": [
    { slug: "word-template", label: "Word Alternative" },
    { slug: "free-quote", label: "Free Quotes" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
    { slug: "painter", label: "Painters" },
    { slug: "electrician", label: "Electricians" },
    { slug: "renovation-contractor", label: "Renovations" },
  ],
  "word-template": [
    { slug: "excel-template", label: "Excel Alternative" },
    { slug: "free-quote", label: "Free Quotes" },
    { slug: "how-to-quote", label: "How to Write a Quote" },
    { slug: "freelance", label: "Freelancers" },
    { slug: "building-consultant", label: "Building Consultants" },
    { slug: "carpenter-cabinetmaker", label: "Carpenters" },
  ],
  "how-to-quote": [
    { slug: "free-quote", label: "Free Quotes" },
    { slug: "excel-template", label: "Excel Alternative" },
    { slug: "word-template", label: "Word Alternative" },
    { slug: "electrician", label: "Electricians" },
    { slug: "plumber", label: "Plumbers" },
    { slug: "freelance", label: "Freelancers" },
  ],
  "free-quote": [
    { slug: "how-to-quote", label: "How to Write a Quote" },
    { slug: "excel-template", label: "Excel Alternative" },
    { slug: "word-template", label: "Word Alternative" },
    { slug: "painter", label: "Painters" },
    { slug: "electrician", label: "Electricians" },
    { slug: "plumber", label: "Plumbers" },
  ],
};

/**
 * Hand-written "local market" copy per city. Shape is lang-aware ({ en, fr })
 * even though only `en` is populated today — there is no locale-prefixed
 * routing yet (see the note on CITIES above and the report from this pass),
 * so getCityContextText() in seo-render-engine.ts always resolves `en` for
 * now. Once fr-CA routes exist, fill in `fr` for the French-primary cities
 * (see FRENCH_PRIMARY_CITY_SLUGS) and thread a real lang argument through.
 */
export interface CityContextEntry {
  en: string;
  fr?: string;
}

export const CITY_CONTEXT: Record<string, CityContextEntry> = {
  toronto: {
    en: "Toronto is Canada's largest and most competitive market for renovation and trades work: a mix of postwar low-rise housing, a huge condo stock built since the 2000s, and a steady wave of laneway suites and basement-apartment conversions. Permit turnaround and older knob-and-tube or aluminum wiring in pre-1970s homes are common wrinkles quoted work needs to account for. Demand and customer expectations are both high — a fast, professional quote is often the deciding factor between competing contractors.",
  },
  ottawa: {
    en: "Ottawa's market splits between a large, steady public-sector and tech workforce driving renovation demand in mature neighbourhoods (Glebe, Westboro, Alta Vista) and rapid new-build growth in suburbs like Barrhaven and Kanata. Winters are long and cold, so furnace, insulation, and roofing work sees strong seasonal demand every fall. Bilingual customer service is a real advantage given the large Francophone population across the river in Gatineau.",
  },
  mississauga: {
    en: "Mississauga is one of the fastest-growing cities in the Toronto region, with a housing stock ranging from 1960s-70s suburban bungalows needing updates to new high-rise condos. Strong demand for kitchen and bathroom renovations, basement finishing, and driveway/exterior work. Proximity to Pearson Airport and major logistics hubs also drives steady commercial and warehouse fit-out work.",
  },
  hamilton: {
    en: "Hamilton has seen a wave of renovation demand as buyers priced out of Toronto move in for more affordable century homes and postwar housing stock, especially around the escarpment and downtown core. Older housing means more knob-and-tube rewiring, foundation work, and full kitchen/bathroom gut renovations than in newer suburbs. Prices remain more accessible than the GTA core, making fast, clearly itemized quotes a real competitive edge.",
  },
  vancouver: {
    en: "Vancouver is one of the highest-cost renovation markets in the country: strict permitting, heritage character-home rules in neighbourhoods like Kitsilano and Strathcona, and coastal rain exposure that drives constant demand for roofing, exterior envelope, and moisture-related repair work. Laneway house construction and secondary-suite conversions remain a major and steady source of work for general contractors and trades alike.",
  },
  surrey: {
    en: "Surrey is one of the fastest-growing municipalities in BC, with large-scale new-home construction alongside a big stock of older single-family homes being renovated or subdivided into secondary suites. Strong demand for framing, drywall, and mechanical trades tied to new-build activity, plus a steady stream of basement-suite conversion work. Prices run somewhat below Vancouver proper, and competition among contractors is intense.",
  },
  victoria: {
    en: "Victoria's market is shaped by an older, character-home housing stock (many pre-1950s), a mild coastal climate that keeps outdoor and roofing work going nearly year-round, and a large share of retirees and seasonal residents investing in renovations and accessibility upgrades. Heritage-district rules apply in parts of downtown and James Bay, which affects material choice and timelines for exterior work.",
  },
  calgary: {
    en: "Calgary has a younger housing stock than most Canadian cities, dominated by developments from the 1970s onward, with strong demand for basement development, kitchen/bathroom updates, and post-hail roof and siding repair — hailstorms are a recurring, insurance-driven source of roofing and exterior work here. The energy-sector economy means demand swings with the local business cycle, but response speed remains a key differentiator.",
  },
  edmonton: {
    en: "Edmonton's market is driven by a mix of established mature neighbourhoods needing full mechanical and electrical upgrades, and fast-growing suburban areas in the south and west. Harsh winters push heavy seasonal demand for furnace replacement, insulation upgrades, and roof/eavestrough work before freeze-up. Prices are generally more accessible than Calgary or the coasts, with a market that rewards contractors who can turn around a detailed quote quickly.",
  },
  winnipeg: {
    en: "Winnipeg has one of the most affordable housing markets among major Canadian cities, with a large stock of older character homes in neighbourhoods like Wolseley and River Heights needing full mechanical and structural updates. Extreme winter cold drives strong demand for furnace, insulation, and window-replacement work, while a compact, less saturated contractor market rewards clear, professional quoting.",
  },
  montreal: {
    en: "Montreal's building stock is dominated by older triplexes and duplexes with exterior staircases, especially in the Plateau and Rosemont, which means renovation quotes often need to account for older wiring, plaster walls, and party-wall considerations specific to attached row housing. Demand is strong for kitchen and bathroom remodels, mechanical upgrades, and energy-efficiency retrofits, with French as the primary language of business for most residential clients.",
  },
  "quebec-city": {
    en: "Quebec City combines a UNESCO-listed historic core with strict heritage-preservation rules around Vieux-Québec and a much larger stock of standard 20th-century housing in the surrounding boroughs. Cold winters and heavy snow loads make roofing, insulation, and exterior envelope work a major seasonal driver, and French is the default language for nearly all client communication.",
  },
  gatineau: {
    en: "Gatineau sits just across the river from Ottawa and shares much of that region's public-sector-driven demand, while remaining a distinctly French-primary market. Newer suburban development in areas like Aylmer and Hull contrasts with older housing closer to the river, and bilingual quoting (French-first, English available) is a practical advantage given how many customers cross the interprovincial border for work.",
  },
  laval: {
    en: "Laval, just north of Montreal, has grown rapidly with a mix of 1970s-80s suburban housing now due for major mechanical and roofing updates, and newer subdivisions still under active construction. French-primary demand is strong for renovation and finishing trades, with steady overflow work from the tighter, more expensive Montreal core.",
  },
  halifax: {
    en: "Halifax's housing stock includes a significant share of older wood-frame homes in the peninsula core that need structural, roofing, and moisture-control attention given the damp Atlantic climate, alongside newer suburban growth in Bedford and Dartmouth. Salt-air exposure accelerates wear on exterior finishes and metal fixtures, keeping steady demand for painting, siding, and roofing work throughout the region.",
  },
};
