// Trade × city facts for the city landing pages (2026-11-12).
//
// The city pages used to share ~70 % of their text, and the only "local"
// numbers on them (a price index, a demand level, a lead time) were editorial
// estimates. This module replaces those with things that are true and that a
// contractor actually needs on a quote in that city: who licenses the trade in
// the province, which office issues permits, how the tax lines read, what the
// consumer-protection law says about contracts signed at the customer's home,
// and what the city's climate and housing stock do to the job.
//
// Every rule here names its regulator so a reader can check it. Keep it to
// rules that are stable; when one changes, fix it here and bump
// SEO_TEMPLATE_UPDATED in scripts/generate-sitemap.ts.
//
// English is complete for the six active cities. French is written for Québec
// (the only French city pages are Montréal's) and for every trade; anything
// without a French string falls back to English.

import type { SectorData } from "./seo-data";

type T = { en: string; fr?: string };
type Lang = "en-CA" | "fr-CA";
const pick = (t: T, lang: Lang) => (lang === "fr-CA" ? (t.fr ?? t.en) : t.en);

export type ProvinceCode = "ON" | "BC" | "AB" | "QC";

export type TradeGroup = "electrical" | "plumbing" | "hvac" | "roofing" | "exterior" | "finish" | "build" | "office";

export const TRADE_GROUP: Record<string, TradeGroup> = {
  electrician: "electrical",
  plumber: "plumbing",
  "hvac-technician": "hvac",
  "air-conditioning-installer": "hvac",
  roofer: "roofing",
  landscaper: "exterior",
  mason: "exterior",
  "window-door-installer": "exterior",
  "welder-fabricator": "exterior",
  painter: "finish",
  "decorative-painter": "finish",
  "flooring-installer": "finish",
  "tile-installer": "finish",
  "carpenter-cabinetmaker": "finish",
  "general-contractor": "build",
  "renovation-contractor": "build",
  "building-consultant": "build",
  freelance: "office",
};

// ─── What goes on the quote, per trade ───────────────────────────────────
// Three line items a customer expects to see, with the unit they're priced in.

export const TRADE_QUOTE_LINES: Record<string, { en: string[]; fr: string[] }> = {
  painter: {
    en: ["walls and ceilings by square foot, with the number of coats", "prep: patching, sanding and priming as its own line", "trim, doors and baseboards by linear foot or by piece"],
    fr: ["murs et plafonds au pied carré, avec le nombre de couches", "la préparation (réparations, sablage, apprêt) sur sa propre ligne", "moulures, portes et plinthes au pied linéaire ou à l'unité"],
  },
  "decorative-painter": {
    en: ["the finish system (plaster, limewash, faux finish) by square foot", "surface prep and primer as a separate line", "samples or a test panel the client approves before work starts"],
    fr: ["le système de finition (plâtre, chaux, faux-fini) au pied carré", "la préparation et l'apprêt sur une ligne distincte", "les échantillons ou le panneau d'essai approuvé avant le début des travaux"],
  },
  electrician: {
    en: ["each circuit, device or fixture as its own line", "the panel or service upgrade with its amperage (100 A to 200 A, for example)", "the permit and inspection fee"],
    fr: ["chaque circuit, prise ou luminaire sur sa propre ligne", "le remplacement du panneau ou de l'entrée électrique avec son ampérage (100 A à 200 A, par exemple)", "les frais de permis et d'inspection"],
  },
  plumber: {
    en: ["fixtures supplied versus installed only", "pipe runs by material (PEX, copper, ABS) and length", "the permit, shut-off and any drywall opening and repair"],
    fr: ["les appareils fournis ou seulement installés", "la tuyauterie par matériau (PEX, cuivre, ABS) et par longueur", "le permis, la fermeture d'eau et l'ouverture et la réparation du gypse"],
  },
  "hvac-technician": {
    en: ["the equipment by model, capacity (BTU or tons) and efficiency rating", "ductwork, venting and gas-line changes as separate lines", "removal of the old unit and the warranty terms"],
    fr: ["l'équipement par modèle, capacité (BTU ou tonnes) et rendement", "les conduits, l'évacuation et la conduite de gaz sur des lignes distinctes", "le retrait de l'ancien appareil et les conditions de garantie"],
  },
  "air-conditioning-installer": {
    en: ["the unit by model and capacity (BTU or tons), and the number of indoor heads", "line-set length, electrical circuit and condensate drain", "refrigerant charge and the warranty registration"],
    fr: ["l'appareil par modèle et capacité (BTU ou tonnes), et le nombre de têtes intérieures", "la longueur des conduites, le circuit électrique et le drain de condensat", "la charge de réfrigérant et l'enregistrement de la garantie"],
  },
  roofer: {
    en: ["roof area in squares (100 sq ft), with the pitch", "tear-off layers, disposal bin and deck repairs priced per sheet", "underlayment, ice-and-water shield, flashing and vents"],
    fr: ["la surface du toit en carrés (100 pi²), avec la pente", "les couches à arracher, le conteneur et les réparations du pontage à la feuille", "la sous-couche, la membrane autocollante, les solins et les évents"],
  },
  landscaper: {
    en: ["the area by square foot or the job by visit for maintenance", "materials by volume: soil, mulch and gravel by the cubic yard", "plants and trees by size, with the guarantee period"],
    fr: ["la surface au pied carré, ou l'entretien à la visite", "les matériaux au volume : terre, paillis et gravier à la verge cube", "les végétaux par format, avec la période de garantie"],
  },
  mason: {
    en: ["the wall or slab by square foot, with thickness and reinforcement", "excavation, base and forming as separate lines", "repointing or parging by square foot, and the cure time"],
    fr: ["le mur ou la dalle au pied carré, avec l'épaisseur et l'armature", "l'excavation, la fondation et le coffrage sur des lignes distinctes", "le rejointoiement ou le crépi au pied carré, et le temps de cure"],
  },
  "window-door-installer": {
    en: ["each unit by size, frame material and glazing (double or triple pane)", "removal, disposal and any trim or capping", "insulation and sealing around the frame"],
    fr: ["chaque unité par dimension, matériau du cadre et vitrage (double ou triple)", "le retrait, la disposition et les moulures ou le revêtement", "l'isolation et le scellement autour du cadre"],
  },
  "welder-fabricator": {
    en: ["the piece by weight or linear foot, with the steel or aluminum grade", "finish: galvanizing, powder coat or paint", "site measurement, delivery and installation"],
    fr: ["la pièce au poids ou au pied linéaire, avec la nuance d'acier ou d'aluminium", "la finition : galvanisation, peinture en poudre ou peinture", "la prise de mesures, la livraison et l'installation"],
  },
  "carpenter-cabinetmaker": {
    en: ["cabinets or built-ins by linear foot, with the box and door material", "hardware (hinges, slides) and countertops as separate lines", "delivery, installation and scribing to walls"],
    fr: ["armoires ou meubles intégrés au pied linéaire, avec le matériau des caissons et des portes", "la quincaillerie et les comptoirs sur des lignes distinctes", "la livraison, l'installation et l'ajustement aux murs"],
  },
  "flooring-installer": {
    en: ["floor area by square foot plus a waste allowance (often 5 to 10 %)", "removal of the old floor and subfloor levelling", "underlay, transitions and baseboard reinstallation"],
    fr: ["la surface au pied carré, plus une marge de perte (souvent 5 à 10 %)", "le retrait de l'ancien revêtement et le nivellement du sous-plancher", "la sous-couche, les seuils et la réinstallation des plinthes"],
  },
  "tile-installer": {
    en: ["tile area by square foot, with the tile size and pattern", "waterproofing membrane and backer board in wet areas", "demolition, trim pieces and grout or caulk"],
    fr: ["la surface de céramique au pied carré, avec le format et le motif", "la membrane d'étanchéité et le panneau de support dans les zones humides", "la démolition, les profilés et le coulis ou le scellant"],
  },
  "general-contractor": {
    en: ["the job broken into phases or trades, each priced", "permits, drawings and engineering as their own lines", "a payment schedule tied to milestones, and an allowance for unknowns"],
    fr: ["le projet découpé par étapes ou par corps de métier, chacun chiffré", "les permis, les plans et l'ingénierie sur leurs propres lignes", "un échéancier de paiements lié aux étapes, et une provision pour imprévus"],
  },
  "renovation-contractor": {
    en: ["demolition, rough-in and finishing priced separately", "allowances for finishes the client hasn't chosen yet (tile, fixtures)", "a change-order clause and a payment schedule"],
    fr: ["la démolition, la plomberie et l'électricité brutes et la finition chiffrées séparément", "des allocations pour les finis que le client n'a pas encore choisis", "une clause d'avenant et un échéancier de paiements"],
  },
  "building-consultant": {
    en: ["the scope: inspection, drawings or permit application", "site visits by number and hours, and report delivery date", "third-party fees (engineer, permit) passed through at cost"],
    fr: ["le mandat : inspection, plans ou demande de permis", "les visites par nombre et par heure, et la date de remise du rapport", "les frais de tiers (ingénieur, permis) refacturés au coût"],
  },
  freelance: {
    en: ["deliverables with a clear scope, priced by project or by hour", "the number of revision rounds included", "payment terms: deposit, milestones and due dates"],
    fr: ["les livrables avec une portée claire, au forfait ou à l'heure", "le nombre de rondes de révision incluses", "les modalités de paiement : acompte, étapes et échéances"],
  },
};

// ─── Province rules ──────────────────────────────────────────────────────

interface ProvinceFacts {
  /** The tax lines a quote shows, as written on the document. */
  taxLine: T;
  /** Short regulator name per trade group, for the facts card. */
  regulator: Record<TradeGroup, T>;
  /** One sentence per trade group: who licenses the work. */
  licence: Record<TradeGroup, T>;
  /** Consumer-protection rule that touches quotes and deposits. */
  contract: T;
}

export const PROVINCE_FACTS: Record<ProvinceCode, ProvinceFacts> = {
  ON: {
    taxLine: { en: "HST 13 %" },
    regulator: {
      electrical: { en: "ESA" },
      plumbing: { en: "Skilled Trades Ontario" },
      hvac: { en: "TSSA" },
      roofing: { en: "WSIB" },
      exterior: { en: "Ontario Building Code" },
      finish: { en: "Ontario Building Code" },
      build: { en: "HCRA · Tarion" },
      office: { en: "CRA" },
    },
    licence: {
      electrical: { en: "Electrical work for customers in Ontario must be done by a Licensed Electrical Contractor registered with the Electrical Safety Authority (ESA), and most jobs need an ESA notification and inspection; put your ECRA/ESA licence number on the quote." },
      plumbing: { en: "Plumber is a compulsory trade in Ontario: the people doing the work need a Certificate of Qualification from Skilled Trades Ontario or must be registered apprentices." },
      hvac: { en: "Gas work in Ontario needs a contractor registered with the Technical Standards and Safety Authority (TSSA) and certified gas technicians, and handling refrigerant requires an Ozone Depletion Prevention (ODP) card." },
      roofing: { en: "Most roofing businesses in Ontario must carry WSIB coverage, and workers using fall protection need the province's Working at Heights training." },
      exterior: { en: "Under the Ontario Building Code, raised decks, retaining walls over 1 m, new or enlarged openings and structural steel normally need a building permit; replacing a window in the same opening usually doesn't." },
      finish: { en: "Painting, flooring, tiling and cabinetry rarely need a permit in Ontario unless walls, plumbing or wiring move. Older homes may contain asbestos in floor tiles, plaster or joint compound, and Ontario Regulation 278/05 sets the rules for disturbing it, so price testing or removal as its own line." },
      build: { en: "Structural work, additions and new basement units need a building permit under the Ontario Building Code. Builders of new homes must be licensed by the Home Construction Regulatory Authority (HCRA) and enrol the home with Tarion." },
      office: { en: "Ontario freelancers add 13 % HST once their taxable revenue passes $30,000 over four consecutive quarters (the CRA small-supplier threshold)." },
    },
    contract: { en: "Ontario's Consumer Protection Act gives homeowners 10 days to cancel a contract signed at their home, and a final bill can't exceed your estimate by more than 10 % without the customer's consent, so a detailed, itemized quote protects you as much as them." },
  },
  BC: {
    taxLine: { en: "GST 5 % + PST 7 %" },
    regulator: {
      electrical: { en: "SkilledTradesBC" },
      plumbing: { en: "SkilledTradesBC" },
      hvac: { en: "Gas permit · CleanBC" },
      roofing: { en: "WorkSafeBC" },
      exterior: { en: "Building by-law" },
      finish: { en: "WorkSafeBC" },
      build: { en: "BC Housing" },
      office: { en: "CRA" },
    },
    licence: {
      electrical: { en: "Electrician is a compulsory trade in British Columbia: the work must be done by certified electricians or registered apprentices (SkilledTradesBC), under a licensed electrical contractor and an electrical permit." },
      plumbing: { en: "Plumber is a compulsory trade in British Columbia (SkilledTradesBC), so the crew needs certification or apprentice registration, and new or altered plumbing needs a plumbing permit." },
      hvac: { en: "Gas fitting in British Columbia needs a licensed gas contractor and a gas permit. Heat pumps suit the mild coast climate, and rebate programs such as CleanBC Better Homes are often part of the quote conversation." },
      roofing: { en: "Roofing businesses in British Columbia need WorkSafeBC coverage, and its fall-protection rules apply on every roof." },
      exterior: { en: "Decks, retaining walls, new openings and structural steel normally need a building permit; replacing a window in the same opening usually doesn't." },
      finish: { en: "WorkSafeBC requires a hazardous-materials survey before renovation or demolition that could disturb asbestos in a building from before 1990, so price the survey and any abatement as their own lines." },
      build: { en: "New homes in British Columbia must be built by a residential builder licensed by BC Housing, with third-party home warranty insurance." },
      office: { en: "Most professional services in British Columbia carry 5 % GST only; the 7 % PST applies to a short list of services and to goods, so check what you sell before adding it." },
    },
    contract: { en: "British Columbia's Business Practices and Consumer Protection Act gives customers 10 days to cancel a contract signed at their home, and the contract must spell out the price and the work, so an itemized quote is the place to start." },
  },
  AB: {
    taxLine: { en: "GST 5 % only (no PST)" },
    regulator: {
      electrical: { en: "Safety Codes Act" },
      plumbing: { en: "Safety Codes Act" },
      hvac: { en: "Safety Codes Act" },
      roofing: { en: "WCB-Alberta" },
      exterior: { en: "Safety Codes Act" },
      finish: { en: "Alberta OHS Code" },
      build: { en: "New Home Buyer Protection" },
      office: { en: "CRA" },
    },
    licence: {
      electrical: { en: "Electrician is a compulsory trade in Alberta, and electrical permits are issued under the Safety Codes Act; in Calgary and Edmonton the City issues them." },
      plumbing: { en: "Plumber is a compulsory trade in Alberta, and plumbing permits are issued under the Safety Codes Act; in Calgary and Edmonton the City issues them." },
      hvac: { en: "Gasfitter is a compulsory trade in Alberta, and furnace, heat-pump and gas-line work needs a gas or mechanical permit under the Safety Codes Act, issued by the City in Calgary and Edmonton." },
      roofing: { en: "Roofing businesses in Alberta generally need WCB-Alberta coverage, and the Alberta OHS Code requires fall protection above 3 m." },
      exterior: { en: "Decks more than 0.6 m (2 ft) above grade, retaining walls, new openings and structural steel normally need a building permit under the Safety Codes Act." },
      finish: { en: "Under the Alberta OHS Code, asbestos has to be identified before work that could disturb it in an older building, so price testing or removal as its own line." },
      build: { en: "Builders of new homes in Alberta must be licensed under the New Home Buyer Protection Act and provide warranty coverage." },
      office: { en: "Alberta has no provincial sales tax, so a freelancer's quote carries 5 % GST once revenue passes the $30,000 small-supplier threshold." },
    },
    contract: { en: "In Alberta, a contractor who takes a deposit or any payment before the work on a home is finished needs a prepaid contractor licence (Consumer Protection Act, administered by Service Alberta), and the contract must include the details the Act lists." },
  },
  QC: {
    taxLine: { en: "GST 5 % + QST 9.975 %", fr: "TPS 5 % + TVQ 9,975 %" },
    regulator: {
      electrical: { en: "RBQ · CMEQ", fr: "RBQ · CMEQ" },
      plumbing: { en: "RBQ · CMMTQ", fr: "RBQ · CMMTQ" },
      hvac: { en: "RBQ · CMMTQ", fr: "RBQ · CMMTQ" },
      roofing: { en: "RBQ · CNESST", fr: "RBQ · CNESST" },
      exterior: { en: "RBQ", fr: "RBQ" },
      finish: { en: "RBQ · CNESST", fr: "RBQ · CNESST" },
      build: { en: "RBQ · GCR", fr: "RBQ · GCR" },
      office: { en: "Revenu Québec", fr: "Revenu Québec" },
    },
    licence: {
      electrical: {
        en: "Electrical contractors in Quebec need an RBQ licence and membership in the Corporation des maîtres électriciens du Québec (CMEQ); the RBQ licence number must appear on the quote and the contract.",
        fr: "Au Québec, l'entrepreneur électricien doit détenir une licence de la RBQ et être membre de la Corporation des maîtres électriciens du Québec (CMEQ); le numéro de licence RBQ doit figurer sur la soumission et le contrat.",
      },
      plumbing: {
        en: "Plumbing contractors in Quebec need an RBQ licence and membership in the Corporation des maîtres mécaniciens en tuyauterie du Québec (CMMTQ); the RBQ licence number must appear on the quote and the contract.",
        fr: "Au Québec, l'entrepreneur en plomberie doit détenir une licence de la RBQ et être membre de la Corporation des maîtres mécaniciens en tuyauterie du Québec (CMMTQ); le numéro de licence RBQ doit figurer sur la soumission et le contrat.",
      },
      hvac: {
        en: "Heating, gas and refrigeration contractors in Quebec need an RBQ licence and CMMTQ membership. Heat-pump quotes often mention Hydro-Québec's LogisVert rebates.",
        fr: "Au Québec, les entrepreneurs en chauffage, gaz et réfrigération doivent détenir une licence RBQ et être membres de la CMMTQ. Les soumissions de thermopompes mentionnent souvent les subventions LogisVert d'Hydro-Québec.",
      },
      roofing: {
        en: "Roofing contractors in Quebec need an RBQ licence, and CNESST rules require fall protection; the RBQ licence number must appear on the quote.",
        fr: "Au Québec, le couvreur doit détenir une licence RBQ, et les règles de la CNESST exigent une protection contre les chutes; le numéro de licence RBQ doit figurer sur la soumission.",
      },
      exterior: {
        en: "Almost every construction contractor in Quebec, including masonry, windows, landscaping structures and metalwork, needs a licence from the Régie du bâtiment du Québec (RBQ), and the licence number must appear on the quote.",
        fr: "Au Québec, presque tout entrepreneur en construction, y compris en maçonnerie, en portes et fenêtres, en aménagement et en métal ouvré, doit détenir une licence de la Régie du bâtiment du Québec (RBQ), et le numéro doit figurer sur la soumission.",
      },
      finish: {
        en: "Renovation contractors in Quebec, including flooring, tiling, carpentry and painting done as part of construction work, generally need an RBQ licence. CNESST rules require asbestos to be identified before work in older buildings, so price testing or removal as its own line.",
        fr: "Au Québec, les entrepreneurs en rénovation, y compris en revêtements de sol, céramique, menuiserie et peinture faite dans le cadre de travaux de construction, doivent généralement détenir une licence RBQ. La CNESST exige de repérer l'amiante avant des travaux dans un bâtiment ancien : chiffrez l'analyse ou le retrait sur une ligne distincte.",
      },
      build: {
        en: "General contractors in Quebec need an RBQ licence, and builders of new homes must be accredited with the Garantie de construction résidentielle (GCR) plan.",
        fr: "Au Québec, l'entrepreneur général doit détenir une licence RBQ, et le constructeur d'une maison neuve doit être accrédité auprès de la Garantie de construction résidentielle (GCR).",
      },
      office: {
        en: "Quebec freelancers add 5 % GST and 9.975 % QST once revenue passes the $30,000 small-supplier threshold.",
        fr: "Au Québec, le travailleur autonome ajoute la TPS de 5 % et la TVQ de 9,975 % dès que ses revenus dépassent le seuil de petit fournisseur de 30 000 $.",
      },
    },
    contract: {
      en: "Under the Charter of the French language, quotes, invoices and contracts for Quebec customers must be available in French. Contracts signed at the customer's home fall under the Consumer Protection Act's itinerant-merchant rules, with a 10-day cancellation right.",
      fr: "En vertu de la Charte de la langue française, les soumissions, factures et contrats destinés aux clients québécois doivent être offerts en français. Un contrat signé au domicile du client relève des règles du commerçant itinérant de la Loi sur la protection du consommateur, avec un droit d'annulation de 10 jours.",
    },
  },
};

// ─── City facts ──────────────────────────────────────────────────────────

interface CityFacts {
  province: ProvinceCode;
  /** Who issues building and trade permits. */
  permitOffice: T;
  permitNote: T;
  /** Short climate figure for the facts card. */
  climateShort: T;
  climate: T;
  housing: T;
}

export const CITY_FACTS: Record<string, CityFacts> = {
  toronto: {
    province: "ON",
    permitOffice: { en: "Toronto Building" },
    permitNote: { en: "In Toronto, building permits come from Toronto Building, and the zoning review is part of the same application; garden suites and laneway suites are now allowed on many lots." },
    climateShort: { en: "≈ 120 cm of snow a year" },
    climate: { en: "Toronto gets about 120 cm of snow a year and plenty of freeze-thaw cycles, so exterior work clusters between April and November and winter jobs need heating and protection priced in." },
    housing: { en: "Much of Toronto's older core is Victorian and Edwardian semis and row houses, where knob-and-tube wiring, galvanized pipes and lead water service lines still turn up, so an allowance for what's behind the walls belongs on the quote." },
  },
  ottawa: {
    province: "ON",
    permitOffice: { en: "City of Ottawa Building Code Services" },
    permitNote: { en: "In Ottawa, permits come from the City's Building Code Services; many customers are French-speaking, and Gatineau sits across the river, so a bilingual quote is a real advantage." },
    climateShort: { en: "≈ 220 cm of snow a year" },
    climate: { en: "Ottawa is one of the coldest capitals in the world, with about 220 cm of snow and January averages near −10 °C, so heating capacity, ice protection and a short outdoor season shape every exterior quote." },
    housing: { en: "Ottawa mixes post-war bungalows and 1960s–70s split-levels, older brick homes in the Glebe and Centretown, and newer suburbs such as Barrhaven, Kanata and Orléans, so the age of the house changes what the quote has to allow for." },
  },
  vancouver: {
    province: "BC",
    permitOffice: { en: "City of Vancouver (Development, Buildings & Licensing)" },
    permitNote: { en: "Vancouver has its own Vancouver Building By-law instead of the BC Building Code, and the City issues its own building, electrical, plumbing and gas permits; laneway houses have been allowed since 2009." },
    climateShort: { en: "> 1,100 mm of rain a year" },
    climate: { en: "Vancouver gets more than 1,100 mm of precipitation a year, mostly from October to March, while snow is rare, so roofing, exterior and envelope work is scheduled around the rain and water management is priced in detail." },
    housing: { en: "After the 1990s leaky-condo crisis, Vancouver requires rainscreen walls on new construction, and many older houses carry a secondary suite or a laneway house, so suites and envelope details come up on a lot of quotes." },
  },
  calgary: {
    province: "AB",
    permitOffice: { en: "City of Calgary (Planning & Development)" },
    permitNote: { en: "In Calgary, the City issues building, electrical, gas and plumbing permits under Alberta's Safety Codes Act; secondary suites are allowed in most residential districts." },
    climateShort: { en: "Hail and chinooks" },
    climate: { en: "Calgary sits in Canada's hail alley: the June 2020 hailstorm was one of the costliest insured disasters in Canadian history, and chinook winds swing winter temperatures by 20 °C in a day, so impact-rated roofing and siding and insurance-claim paperwork are common on quotes." },
    housing: { en: "Most of Calgary's homes were built after 1970 in suburban communities, and many now add a basement suite, so suite conversions, egress windows and separate mechanical systems show up often." },
  },
  edmonton: {
    province: "AB",
    permitOffice: { en: "City of Edmonton" },
    permitNote: { en: "In Edmonton, the City issues building, electrical, gas, plumbing and HVAC permits under Alberta's Safety Codes Act; the zoning bylaw that took effect in 2024 opened most residential lots to infill, garden suites and secondary suites." },
    climateShort: { en: "January ≈ −10 °C" },
    climate: { en: "Edmonton has the coldest winters of Canada's large cities, with January averages around −10 °C and cold snaps far below that, so heating capacity, frost-protected footings and a short pouring and painting season drive the schedule and the price." },
    housing: { en: "Edmonton pairs mature neighbourhoods of post-war bungalows, now being replaced by infill and garden suites, with large newer suburbs, so the same trade can quote a teardown rebuild and a new-build finish in the same week." },
  },
  montreal: {
    province: "QC",
    permitOffice: { en: "your borough (arrondissement)", fr: "votre arrondissement" },
    permitNote: {
      en: "In Montréal, permits are issued by each of the city's 19 boroughs, each with its own rules and fees, so the quote should name the borough and say who applies for the permit.",
      fr: "À Montréal, les permis sont délivrés par chacun des 19 arrondissements, chacun avec ses règles et ses frais : la soumission devrait nommer l'arrondissement et préciser qui demande le permis.",
    },
    climateShort: { en: "≈ 210 cm of snow a year", fr: "≈ 210 cm de neige par année" },
    climate: {
      en: "Montréal gets about 210 cm of snow a year and January averages near −10 °C, so flat-roof membranes, snow loads and the short outdoor season shape exterior quotes.",
      fr: "Montréal reçoit environ 210 cm de neige par année et janvier tourne autour de −10 °C : les membranes de toits plats, les charges de neige et la courte saison extérieure façonnent les soumissions.",
    },
    housing: {
      en: "Montréal is a city of plexes, duplexes and triplexes with flat roofs and outdoor staircases, and most households rent, so landlord customers, multi-unit work and jobs timed around July 1 moving day are common.",
      fr: "Montréal est une ville de plex, duplex et triplex aux toits plats et aux escaliers extérieurs, et la majorité des ménages sont locataires : les clients propriétaires de plex, les travaux multilogements et les chantiers calés sur le 1er juillet sont fréquents.",
    },
  },
};

// ─── What the page shows ─────────────────────────────────────────────────

/** The quote lines and tax for a trade in a city — used by the how-it-works copy. */
export function getTradeQuoteLines(sectorSlug: string, citySlug: string, lang: Lang): { lines: string[]; tax: string } | null {
  const lines = TRADE_QUOTE_LINES[sectorSlug];
  const city = CITY_FACTS[citySlug];
  if (!lines || !city) return null;
  return { lines: lang === "fr-CA" ? lines.fr : lines.en, tax: pick(PROVINCE_FACTS[city.province].taxLine, lang) };
}

export interface CityTradeFacts {
  /** Tiles for the facts card. */
  tiles: { tax: string; permits: string; regulator: string; climate: string };
  /** The "what a quote here includes" section. */
  heading: string;
  definition: string;
  items: string[];
  footnote: string;
  /** Two FAQ answers built from the same facts. */
  faq: { q: string; a: string }[];
}

const groupUsesClimate = (g: TradeGroup) => g === "roofing" || g === "exterior" || g === "hvac";
/** Trades whose jobs routinely need a permit — the city's permit note is shown only for these. */
const groupNeedsPermits = (g: TradeGroup) => g === "electrical" || g === "plumbing" || g === "hvac" || g === "exterior" || g === "build";

export function getCityTradeFacts(sector: SectorData, citySlug: string, cityName: string, lang: Lang): CityTradeFacts | null {
  const city = CITY_FACTS[citySlug];
  const group = TRADE_GROUP[sector.slug];
  const lines = TRADE_QUOTE_LINES[sector.slug];
  if (!city || !group || !lines) return null;
  const prov = PROVINCE_FACTS[city.province];
  const fr = lang === "fr-CA";
  const label = (fr ? sector.fr.label : sector.label).toLowerCase();
  const tax = pick(prov.taxLine, lang);
  const office = pick(city.permitOffice, lang);
  const quoteLines = fr ? lines.fr : lines.en;
  const local = pick(groupUsesClimate(group) ? city.climate : city.housing, lang);
  const licence = pick(prov.licence[group], lang);
  const contract = pick(prov.contract, lang);
  const permitNote = pick(city.permitNote, lang);

  const definition = fr
    ? `Une soumission de ${label} à ${cityName} détaille ${quoteLines[0]}, ${quoteLines[1]} et ${quoteLines[2]}; elle affiche les taxes (${tax}) à part du sous-total et indique qui obtient le permis auprès de ${office}.`
    : `A ${label} quote in ${cityName} itemizes ${quoteLines[0]}, ${quoteLines[1]}, and ${quoteLines[2]}; it shows the tax (${tax}) apart from the subtotal and says who gets any permit from ${office}.`;

  const faq = fr
    ? [
        { q: `Faut-il une licence ou un permis pour des travaux de ${label} à ${cityName}?`, a: `${licence} Les permis à ${cityName} : ${office}.` },
        { q: `Quelles taxes figurent sur une soumission de ${label} à ${cityName}?`, a: `${tax}, affichées à part et calculées sur le total avant taxes. quoteai applique automatiquement les taux de la province du client et imprime vos numéros d'inscription aux taxes sur chaque soumission et facture.` },
      ]
    : [
        { q: `Do you need a licence or permit for ${label} work in ${cityName}?`, a: `${licence} Permits in ${cityName}: ${office}.` },
        { q: `What tax goes on a ${label} quote in ${cityName}?`, a: `${tax}, shown apart from and calculated on the pre-tax total. quoteai applies the rates for the customer's province automatically and prints your tax registration numbers on every quote and invoice.` },
      ];

  return {
    tiles: { tax, permits: office, regulator: pick(prov.regulator[group], lang), climate: pick(city.climateShort, lang) },
    heading: fr ? `Ce que doit contenir une soumission de ${label} à ${cityName}` : `What a ${label} quote in ${cityName} should include`,
    definition,
    items: [licence, ...(groupNeedsPermits(group) ? [permitNote] : []), local, ...(group === "office" ? [] : [contract])],
    footnote: fr
      ? "Résumé des règles à jour en novembre 2026, à titre informatif. Vérifiez auprès de l'organisme nommé avant de commencer les travaux."
      : "A summary of the rules as of November 2026, for information. Check with the named regulator before you start work.",
    faq,
  };
}
