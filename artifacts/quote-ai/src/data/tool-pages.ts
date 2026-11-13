// Copy for the free calculators (/tools, /fr/outils), both languages.
//
// These pages exist to be useful on their own (and to be linked to and cited),
// so the words explain the rule behind each number. Same line as the province
// pages: we describe arithmetic and well-known rules, and say "check with" the
// authority rather than claiming to give tax or legal advice.
import type { ToolId } from "./seo-slugs";

type L = { en: string; fr: string };

export interface ToolPage {
  id: ToolId;
  title: L;
  description: L;
  eyebrow: L;
  h1: L;
  lead: L;
  /** One line for the hub card and the "more tools" links. */
  short: L;
  sections: ReadonlyArray<{ h2: L; body: ReadonlyArray<L> }>;
  faq: ReadonlyArray<{ q: L; a: L }>;
  /** Content date, for the sitemap lastmod and the "updated" line. */
  updatedAt: string;
}

export const TOOLS_HUB = {
  title: {
    en: "Free calculators for Canadian contractors | quoteai",
    fr: "Calculateurs gratuits pour entrepreneurs canadiens | quoteai",
  },
  description: {
    en: "Free calculators for Canadian trades: GST/HST/PST/QST sales tax by province, construction holdback, markup vs margin and your hourly labour rate. No sign-up.",
    fr: "Calculateurs gratuits pour les gens de métier au Canada : taxes de vente TPS/TVH/TVP/TVQ par province, retenue de construction, majoration ou marge et taux horaire. Sans inscription.",
  },
  eyebrow: { en: "Free tools", fr: "Outils gratuits" },
  h1: { en: "Free calculators for Canadian contractors.", fr: "Calculateurs gratuits pour les entrepreneurs canadiens." },
  lead: {
    en: "The numbers every quote and invoice depends on: the right sales tax for the province, the holdback on a progress bill, the markup that gives the margin you want, and the hourly rate that actually pays you. Free, no sign-up, in English and French.",
    fr: "Les chiffres dont dépend chaque soumission et chaque facture : la bonne taxe de vente selon la province, la retenue sur une facture progressive, la majoration qui donne la marge voulue et le taux horaire qui vous paie vraiment. Gratuit, sans inscription, en français et en anglais.",
  },
} as const;

export const TOOL_UI = {
  updated: { en: "Rates and rules checked", fr: "Taux et règles vérifiés le" },
  openTool: { en: "Open the calculator", fr: "Ouvrir le calculateur" },
  moreTools: { en: "More free calculators", fr: "Autres calculateurs gratuits" },
  allTools: { en: "All calculators", fr: "Tous les calculateurs" },
  faqTitle: { en: "Questions contractors ask", fr: "Questions fréquentes" },
  ctaTitle: { en: "Stop doing this math by hand.", fr: "Arrêtez de faire ces calculs à la main." },
  ctaBody: {
    en: "quoteai writes the whole quote from a few words: line items, your markup, the right taxes for the customer's province, deposits and progress billing. Then the contract, the invoice and the payment use the same numbers.",
    fr: "quoteai rédige toute la soumission à partir de quelques mots : postes, votre majoration, les bonnes taxes selon la province du client, acomptes et facturation progressive. Le contrat, la facture et le paiement reprennent ensuite les mêmes chiffres.",
  },
  ctaButton: { en: "Try quoteai free", fr: "Essayer quoteai gratuitement" },
  ctaNote: { en: "7 days free, no credit card.", fr: "7 jours gratuits, sans carte de crédit." },
  disclaimer: {
    en: "This calculator does arithmetic on the numbers you enter. It is not tax or legal advice; check your situation with the CRA, your provincial tax office or your accountant.",
    fr: "Ce calculateur fait des calculs à partir des chiffres saisis. Ce n'est pas un avis fiscal ou juridique; vérifiez votre situation auprès de l'ARC, de Revenu Québec ou de votre province, ou de votre comptable.",
  },
  // Calculator labels
  province: { en: "Province or territory", fr: "Province ou territoire" },
  amountBefore: { en: "Price before tax", fr: "Prix avant taxes" },
  amountAfter: { en: "Total with tax included", fr: "Total taxes incluses" },
  modeAdd: { en: "Add tax", fr: "Ajouter les taxes" },
  modeExtract: { en: "Remove tax from a total", fr: "Retirer les taxes d'un total" },
  subtotal: { en: "Before tax", fr: "Avant taxes" },
  taxTotal: { en: "Total tax", fr: "Total des taxes" },
  total: { en: "Total", fr: "Total" },
  billed: { en: "Work done this billing period", fr: "Travaux réalisés pour cette période" },
  holdbackPct: { en: "Holdback", fr: "Retenue" },
  holdbackKept: { en: "Holdback kept back", fr: "Retenue conservée" },
  netNow: { en: "Billed now, before tax", fr: "Facturé maintenant, avant taxes" },
  taxNow: { en: "Tax on this invoice", fr: "Taxes sur cette facture" },
  payableNow: { en: "Payable now", fr: "À payer maintenant" },
  onRelease: { en: "When the holdback is released", fr: "À la libération de la retenue" },
  releaseTotal: { en: "Holdback + its tax", fr: "Retenue + ses taxes" },
  cost: { en: "Your cost (labour + materials)", fr: "Votre coût (main-d'œuvre + matériaux)" },
  modeMarkup: { en: "I know my markup", fr: "Je connais ma majoration" },
  modeMargin: { en: "I want a margin", fr: "Je vise une marge" },
  markup: { en: "Markup", fr: "Majoration" },
  margin: { en: "Margin", fr: "Marge" },
  price: { en: "Price to quote", fr: "Prix à soumettre" },
  profit: { en: "Gross profit", fr: "Profit brut" },
  marginTooHigh: { en: "A margin must be under 100 %.", fr: "La marge doit être inférieure à 100 %." },
  tableMarkup: { en: "Markup on cost", fr: "Majoration sur le coût" },
  tableMargin: { en: "Margin on price", fr: "Marge sur le prix" },
  tablePrice: { en: "Price for $1,000 of cost", fr: "Prix pour 1 000 $ de coût" },
  salary: { en: "What you want to pay yourself per year", fr: "Ce que vous voulez vous verser par année" },
  overhead: { en: "Yearly overhead (truck, insurance, tools, phone, software)", fr: "Frais généraux annuels (camion, assurances, outils, téléphone, logiciels)" },
  hoursPerWeek: { en: "Billable hours per week", fr: "Heures facturables par semaine" },
  weeks: { en: "Weeks worked per year", fr: "Semaines travaillées par année" },
  profitMargin: { en: "Profit margin on top", fr: "Marge de profit en plus" },
  billableHours: { en: "Billable hours per year", fr: "Heures facturables par année" },
  breakEven: { en: "Break-even rate", fr: "Taux d'équilibre" },
  hourlyRate: { en: "Hourly rate to charge", fr: "Taux horaire à facturer" },
  perHour: { en: "/ h", fr: "/ h" },
  yearlyRevenue: { en: "Labour revenue per year", fr: "Revenus de main-d'œuvre par année" },
  invalid: { en: "Enter a number.", fr: "Entrez un nombre." },
  tableProvince: { en: "Province or territory", fr: "Province ou territoire" },
  tableTaxes: { en: "Taxes to charge", fr: "Taxes à percevoir" },
  tableTotalRate: { en: "Combined rate", fr: "Taux combiné" },
  ratesTitle: { en: "Sales tax rates by province (2026)", fr: "Taux de taxes de vente par province (2026)" },
  marginTableTitle: { en: "Markup to margin, at a glance", fr: "De la majoration à la marge, en un coup d'œil" },
} as const;

export const TOOL_PAGES: Record<ToolId, ToolPage> = {
  salesTax: {
    id: "salesTax",
    updatedAt: "2026-11-13",
    title: {
      en: "GST/HST, PST & QST calculator for contractors (2026) | quoteai",
      fr: "Calculateur TPS/TVH, TVP et TVQ pour entrepreneurs (2026) | quoteai",
    },
    description: {
      en: "Add or remove Canadian sales tax for any province: GST, HST, PST and QST as separate lines, the way your quote and invoice should show them. 2026 rates, free.",
      fr: "Ajoutez ou retirez les taxes de vente canadiennes pour toute province : TPS, TVH, TVP et TVQ en lignes distinctes, comme sur vos soumissions et factures. Taux 2026, gratuit.",
    },
    eyebrow: { en: "Free sales tax calculator", fr: "Calculateur de taxes gratuit" },
    h1: { en: "GST, HST, PST and QST calculator for contractors.", fr: "Calculateur de TPS, TVH, TVP et TVQ pour entrepreneurs." },
    lead: {
      en: "Pick the province where the job is, enter a price, and get each tax as its own line, ready to copy onto a quote or invoice. Or start from a tax-included total and work back to the price.",
      fr: "Choisissez la province du chantier, entrez un prix et obtenez chaque taxe sur sa propre ligne, prête à copier dans une soumission ou une facture. Ou partez d'un total taxes incluses pour retrouver le prix.",
    },
    short: {
      en: "Add or remove GST, HST, PST and QST for any province, each tax on its own line.",
      fr: "Ajoutez ou retirez la TPS, la TVH, la TVP et la TVQ pour toute province, chaque taxe sur sa ligne.",
    },
    sections: [
      {
        h2: { en: "Which province's tax goes on the quote?", fr: "Quelle taxe provinciale mettre sur la soumission?" },
        body: [
          {
            en: "For work on a building or land, the general rule for GST/HST is that the tax follows the property: a renovation in Gatineau is taxed at Québec's GST + QST even if your shop is in Ottawa, and a kitchen in Ottawa is taxed at Ontario's 13 % HST even if you live in Gatineau. When in doubt, use the province where the job site is and confirm with the CRA's place-of-supply rules.",
            fr: "Pour des travaux sur un bâtiment ou un terrain, la règle générale pour la TPS/TVH est que la taxe suit l'immeuble : une rénovation à Gatineau est taxée à la TPS + TVQ du Québec même si votre atelier est à Ottawa, et une cuisine à Ottawa est taxée à la TVH de 13 % de l'Ontario même si vous habitez Gatineau. En cas de doute, utilisez la province du chantier et confirmez avec les règles de lieu de fourniture de l'ARC.",
          },
        ],
      },
      {
        h2: { en: "Show each tax on its own line", fr: "Chaque taxe sur sa propre ligne" },
        body: [
          {
            en: "A commercial customer needs your GST/HST number and the tax amount on the invoice to claim input tax credits, and in Québec the same goes for your QST number. One blended \"tax 14.975 %\" line makes their bookkeeper's job harder and can delay your payment. Show GST and QST (or GST and PST) separately, each with its rate.",
            fr: "Un client commercial a besoin de votre numéro de TPS/TVH et du montant de la taxe sur la facture pour demander ses crédits de taxe sur les intrants, et au Québec, il lui faut aussi votre numéro de TVQ. Une seule ligne « taxes 14,975 % » complique le travail de son comptable et peut retarder votre paiement. Présentez la TPS et la TVQ (ou la TPS et la TVP) séparément, chacune avec son taux.",
          },
          {
            en: "In Québec, the QST is calculated on the price before GST, not on price plus GST. That has been the rule since 2013, which is why $10,000 of work comes to $500 GST + $997.50 QST = $11,497.50.",
            fr: "Au Québec, la TVQ se calcule sur le prix avant la TPS, et non sur le prix plus la TPS. C'est la règle depuis 2013 : 10 000 $ de travaux donnent 500 $ de TPS + 997,50 $ de TVQ = 11 497,50 $.",
          },
        ],
      },
      {
        h2: { en: "PST and RST on installed work: check first", fr: "TVP et TVD sur les travaux installés : vérifiez d'abord" },
        body: [
          {
            en: "In British Columbia, Saskatchewan and Manitoba, whether you charge PST/RST to the customer or pay it yourself on the materials depends on the kind of contract (for example, supply-and-install work on a home versus selling goods). The calculator shows the provincial tax the way it applies to a sale; check your trade's rules with the provincial tax office before you leave the PST line on a renovation quote.",
            fr: "En Colombie-Britannique, en Saskatchewan et au Manitoba, le fait de facturer la TVP/TVD au client ou de la payer vous-même sur les matériaux dépend du type de contrat (par exemple, fourniture et installation dans une maison par rapport à la vente de biens). Le calculateur applique la taxe provinciale comme sur une vente; vérifiez les règles de votre métier auprès du ministère des Finances de la province avant de garder la ligne TVP sur une soumission de rénovation.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { en: "Do I charge GST/HST on labour as well as materials?", fr: "Dois-je facturer la TPS/TVH sur la main-d'œuvre et les matériaux?" },
        a: {
          en: "Yes. If you are registered, GST/HST applies to most construction and renovation services, labour included, not only to the materials.",
          fr: "Oui. Si vous êtes inscrit, la TPS/TVH s'applique à la plupart des services de construction et de rénovation, main-d'œuvre comprise, et pas seulement aux matériaux.",
        },
      },
      {
        q: { en: "When do I have to register for GST/HST?", fr: "Quand dois-je m'inscrire à la TPS/TVH?" },
        a: {
          en: "Once your taxable sales pass $30,000 over four consecutive calendar quarters, you are no longer a small supplier and must register and charge tax. Below that, registering is optional. Québec's QST uses the same $30,000 threshold.",
          fr: "Dès que vos ventes taxables dépassent 30 000 $ sur quatre trimestres civils consécutifs, vous n'êtes plus un petit fournisseur et devez vous inscrire et percevoir les taxes. En dessous, l'inscription est facultative. La TVQ utilise le même seuil de 30 000 $.",
        },
      },
      {
        q: { en: "How do I take the tax out of a total?", fr: "Comment retirer les taxes d'un total?" },
        a: {
          en: "Divide the total by 1 plus the combined rate. In Ontario: $1,130 ÷ 1.13 = $1,000 before HST. Choose \"Remove tax from a total\" above and the calculator splits the tax into its lines for you.",
          fr: "Divisez le total par 1 plus le taux combiné. Au Québec : 1 149,75 $ ÷ 1,14975 = 1 000 $ avant taxes. Choisissez « Retirer les taxes d'un total » ci-dessus et le calculateur répartit les taxes ligne par ligne.",
        },
      },
      {
        q: { en: "Is QST charged on top of GST?", fr: "La TVQ s'applique-t-elle sur la TPS?" },
        a: {
          en: "No. Since January 1, 2013, QST is calculated on the selling price excluding GST, so the two taxes are simply added side by side.",
          fr: "Non. Depuis le 1er janvier 2013, la TVQ se calcule sur le prix de vente excluant la TPS; les deux taxes s'additionnent simplement.",
        },
      },
    ],
  },

  holdback: {
    id: "holdback",
    updatedAt: "2026-11-13",
    title: {
      en: "Construction holdback calculator (10 %), with HST | quoteai",
      fr: "Calculateur de retenue de construction (10 %), avec taxes | quoteai",
    },
    description: {
      en: "Work out the 10 % holdback on a progress invoice, what is payable now, and the GST/HST due when the holdback is released. For Ontario, BC, Alberta and other provinces.",
      fr: "Calculez la retenue de 10 % sur une facture progressive, le montant à payer maintenant et les taxes dues à la libération de la retenue. Ontario, C.-B., Alberta et autres provinces.",
    },
    eyebrow: { en: "Free holdback calculator", fr: "Calculateur de retenue gratuit" },
    h1: { en: "Construction holdback calculator.", fr: "Calculateur de retenue de construction." },
    lead: {
      en: "Enter the value of work done this billing period. See the holdback kept back, the amount payable now with its tax, and what you will invoice when the holdback is released.",
      fr: "Entrez la valeur des travaux réalisés pendant la période de facturation. Voyez la retenue conservée, le montant à payer maintenant avec ses taxes et ce que vous facturerez à la libération de la retenue.",
    },
    short: {
      en: "The 10 % holdback on a progress bill, what is payable now, and the tax when it is released.",
      fr: "La retenue de 10 % sur une facture progressive, le montant payable maintenant et les taxes à la libération.",
    },
    sections: [
      {
        h2: { en: "What a holdback is", fr: "Qu'est-ce qu'une retenue?" },
        body: [
          {
            en: "On most construction contracts, the owner (and every contractor who pays a subcontractor) keeps back part of each payment until the lien period is over. That money protects everyone below in the chain: if a supplier or sub isn't paid, they can claim against the holdback instead of the property.",
            fr: "Sur la plupart des contrats de construction, le propriétaire (et chaque entrepreneur qui paie un sous-traitant) garde une partie de chaque paiement jusqu'à la fin de la période d'hypothèque ou de privilège. Cet argent protège toute la chaîne : si un fournisseur ou un sous-traitant n'est pas payé, il peut réclamer sur la retenue plutôt que sur l'immeuble.",
          },
          {
            en: "Ontario's Construction Act sets the basic holdback at 10 % of the value of the work and materials supplied. British Columbia's Builders Lien Act and Alberta's Prompt Payment and Construction Lien Act also use 10 %. Other provinces set their own rules, and in Québec, where there is no statutory holdback, a retention (often 10 %) is written into the contract itself.",
            fr: "En Ontario, la Loi sur la construction fixe la retenue de base à 10 % de la valeur des services et matériaux fournis. La Builders Lien Act de la Colombie-Britannique et la Prompt Payment and Construction Lien Act de l'Alberta prévoient aussi 10 %. Les autres provinces ont leurs propres règles; au Québec, où il n'y a pas de retenue prévue par la loi, une retenue contractuelle (souvent 10 %) est inscrite au contrat.",
          },
        ],
      },
      {
        h2: { en: "Tax on the holdback", fr: "Les taxes sur la retenue" },
        body: [
          {
            en: "Under the Excise Tax Act's holdback rule, the GST/HST on a holdback isn't payable until the holdback is paid or becomes due. So a progress invoice charges tax on the part paid now, and the release invoice charges tax on the holdback. That is what the calculator shows. Ask your accountant how you report it, especially if you file quarterly.",
            fr: "Selon la règle sur les retenues de la Loi sur la taxe d'accise, la TPS/TVH sur une retenue n'est payable que lorsque la retenue est payée ou devient exigible. La facture progressive taxe donc la partie payée maintenant, et la facture de libération taxe la retenue. C'est ce qu'affiche le calculateur. Demandez à votre comptable comment le déclarer, surtout si vous produisez vos déclarations chaque trimestre.",
          },
        ],
      },
      {
        h2: { en: "Prompt payment in Ontario", fr: "Le paiement rapide en Ontario" },
        body: [
          {
            en: "Since the 2019 prompt-payment rules, an Ontario owner has 28 days to pay a proper invoice, and a contractor has 7 days after being paid to pay its subcontractors. Holdback still comes off each payment; the clock only changes when the rest must be paid.",
            fr: "Depuis les règles de paiement rapide de 2019, un propriétaire ontarien a 28 jours pour payer une facture en bonne et due forme, et un entrepreneur a 7 jours après avoir été payé pour payer ses sous-traitants. La retenue est toujours déduite de chaque paiement; seul le délai pour payer le reste change.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { en: "Is the holdback 10 % of the whole contract or of each invoice?", fr: "La retenue est-elle de 10 % du contrat entier ou de chaque facture?" },
        a: {
          en: "Of each payment, as the work is billed. Add up the holdback on every progress invoice and you get 10 % of the work done so far.",
          fr: "De chaque paiement, au fur et à mesure de la facturation. En additionnant la retenue de chaque facture progressive, on obtient 10 % des travaux réalisés à ce jour.",
        },
      },
      {
        q: { en: "Do I charge HST on the holdback amount?", fr: "Dois-je facturer la TVH sur la retenue?" },
        a: {
          en: "Yes, but when the holdback is released, not on the progress invoice. The calculator shows both amounts.",
          fr: "Oui, mais à la libération de la retenue, pas sur la facture progressive. Le calculateur affiche les deux montants.",
        },
      },
      {
        q: { en: "Does holdback apply to small residential jobs?", fr: "La retenue s'applique-t-elle aux petits travaux résidentiels?" },
        a: {
          en: "The lien acts generally apply to residential work too, but many small renovation contracts are paid in a deposit and a final payment and nobody tracks holdback. Check your province's act and your contract before you deduct it or bill it.",
          fr: "Les lois sur les privilèges s'appliquent généralement aussi aux travaux résidentiels, mais beaucoup de petits contrats de rénovation se paient en un acompte et un paiement final, sans suivi de retenue. Vérifiez la loi de votre province et votre contrat avant de la déduire ou de la facturer.",
        },
      },
    ],
  },

  markup: {
    id: "markup",
    updatedAt: "2026-11-13",
    title: {
      en: "Markup vs margin calculator for contractors | quoteai",
      fr: "Calculateur majoration ou marge pour entrepreneurs | quoteai",
    },
    description: {
      en: "Turn your cost into a price: enter a markup or the margin you want and see the price, the profit and the other percentage. With a markup-to-margin table for contractors.",
      fr: "Passez du coût au prix : entrez une majoration ou la marge visée et voyez le prix, le profit et l'autre pourcentage. Avec un tableau majoration-marge pour entrepreneurs.",
    },
    eyebrow: { en: "Free markup calculator", fr: "Calculateur de majoration gratuit" },
    h1: { en: "Markup vs margin calculator.", fr: "Calculateur majoration ou marge." },
    lead: {
      en: "A 25 % markup is not a 25 % margin. Enter your cost and either the markup you add or the margin you want to keep, and see the price to quote.",
      fr: "Une majoration de 25 % n'est pas une marge de 25 %. Entrez votre coût et la majoration que vous ajoutez ou la marge que vous voulez garder, et voyez le prix à soumettre.",
    },
    short: {
      en: "Cost to price with a markup or a target margin, and why 25 % markup is only 20 % margin.",
      fr: "Du coût au prix avec une majoration ou une marge visée, et pourquoi 25 % de majoration ne font que 20 % de marge.",
    },
    sections: [
      {
        h2: { en: "Markup and margin are not the same number", fr: "Majoration et marge ne sont pas le même chiffre" },
        body: [
          {
            en: "Markup is profit as a percent of your cost. Margin is profit as a percent of the price. On a $1,000 job with a 25 % markup you quote $1,250 and keep $250, which is 20 % of the price. If your accountant says you need a 25 % margin, you need a 33.3 % markup.",
            fr: "La majoration est le profit en pourcentage du coût. La marge est le profit en pourcentage du prix. Sur un travail de 1 000 $ majoré de 25 %, vous soumettez 1 250 $ et gardez 250 $, soit 20 % du prix. Si votre comptable dit qu'il vous faut une marge de 25 %, il vous faut une majoration de 33,3 %.",
          },
          {
            en: "Mixing the two is one of the most common ways contractors underprice: the job looks profitable on the quote and comes out short at year end.",
            fr: "Confondre les deux est l'une des façons les plus courantes de sous-évaluer un prix : le travail semble rentable sur la soumission et finit en manque à gagner en fin d'année.",
          },
        ],
      },
      {
        h2: { en: "What goes into cost", fr: "Ce qui entre dans le coût" },
        body: [
          {
            en: "Use the full cost of the job: materials with delivery and waste, labour at what it really costs you (wages plus CPP, EI, WSIB or CNESST and vacation pay), equipment rentals, permits, disposal. Overhead such as your truck, insurance and office can go into the cost or be covered by the markup; just don't count it twice or forget it.",
            fr: "Utilisez le coût complet du travail : matériaux avec livraison et pertes, main-d'œuvre à son coût réel (salaires plus RRQ ou RPC, AE, CNESST ou WSIB et vacances), location d'équipement, permis, élimination des déchets. Les frais généraux comme le camion, les assurances et le bureau peuvent entrer dans le coût ou être couverts par la majoration; il suffit de ne pas les compter deux fois ni les oublier.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { en: "How do I convert markup to margin?", fr: "Comment convertir une majoration en marge?" },
        a: {
          en: "Margin = markup ÷ (1 + markup). A 50 % markup is 0.5 ÷ 1.5 = 33.3 % margin.",
          fr: "Marge = majoration ÷ (1 + majoration). Une majoration de 50 % donne 0,5 ÷ 1,5 = 33,3 % de marge.",
        },
      },
      {
        q: { en: "How do I convert margin to markup?", fr: "Comment convertir une marge en majoration?" },
        a: {
          en: "Markup = margin ÷ (1 − margin). A 20 % margin needs 0.2 ÷ 0.8 = 25 % markup.",
          fr: "Majoration = marge ÷ (1 − marge). Une marge de 20 % demande 0,2 ÷ 0,8 = 25 % de majoration.",
        },
      },
      {
        q: { en: "Do I add the markup before or after tax?", fr: "La majoration s'ajoute-t-elle avant ou après les taxes?" },
        a: {
          en: "Before. Mark up your cost to get the price, then add GST/HST, PST or QST on that price.",
          fr: "Avant. Majorez votre coût pour obtenir le prix, puis ajoutez la TPS/TVH, la TVP ou la TVQ sur ce prix.",
        },
      },
    ],
  },

  labourRate: {
    id: "labourRate",
    updatedAt: "2026-11-13",
    title: {
      en: "Contractor hourly rate calculator: what to charge per hour | quoteai",
      fr: "Calculateur de taux horaire pour entrepreneurs : combien facturer | quoteai",
    },
    description: {
      en: "Work out the hourly rate a self-employed tradesperson needs to charge in Canada: your pay, your overhead, the hours you can really bill, and a profit margin. Free.",
      fr: "Calculez le taux horaire qu'un travailleur autonome des métiers doit facturer au Canada : votre salaire, vos frais généraux, les heures vraiment facturables et une marge de profit. Gratuit.",
    },
    eyebrow: { en: "Free hourly rate calculator", fr: "Calculateur de taux horaire gratuit" },
    h1: { en: "What should I charge per hour?", fr: "Combien facturer de l'heure?" },
    lead: {
      en: "Start from what you want to earn and what your business costs to run, divide by the hours you can actually bill, and add a profit margin. That is your floor, before you look at what others charge.",
      fr: "Partez de ce que vous voulez gagner et de ce que coûte votre entreprise, divisez par les heures réellement facturables et ajoutez une marge de profit. C'est votre plancher, avant de regarder les prix des autres.",
    },
    short: {
      en: "The hourly rate that covers your pay, your overhead and a profit, from the hours you can really bill.",
      fr: "Le taux horaire qui couvre votre salaire, vos frais généraux et un profit, selon vos heures vraiment facturables.",
    },
    sections: [
      {
        h2: { en: "Billable hours are fewer than you think", fr: "Les heures facturables sont moins nombreuses qu'on pense" },
        body: [
          {
            en: "Driving between jobs, picking up materials, quoting, invoicing and chasing payments are all work, but nobody pays for them by the hour. If you work 45 hours a week and bill 30, your rate has to cover all 45. Count weeks honestly too: holidays, weather, slow months and sick days.",
            fr: "Les déplacements entre chantiers, l'achat de matériaux, les soumissions, la facturation et les relances de paiement sont du travail, mais personne ne les paie à l'heure. Si vous travaillez 45 heures par semaine et en facturez 30, votre taux doit couvrir les 45. Comptez aussi vos semaines honnêtement : vacances, météo, mois creux et congés de maladie.",
          },
        ],
      },
      {
        h2: { en: "What to put in overhead", fr: "Quoi mettre dans les frais généraux" },
        body: [
          {
            en: "Everything the business pays for that isn't billed to a specific job: truck payments, fuel and insurance, liability insurance, WSIB or CNESST, tools and their replacement, phone, software, accounting, licences and association fees, advertising. As a self-employed person you also pay both the employee and employer share of CPP (or QPP in Québec), so leave room for it in your pay or your overhead.",
            fr: "Tout ce que l'entreprise paie sans le facturer à un chantier précis : paiements, essence et assurance du camion, assurance responsabilité, CNESST ou WSIB, outils et leur remplacement, téléphone, logiciels, comptabilité, licences et cotisations, publicité. Comme travailleur autonome, vous payez aussi les parts employé et employeur du RRQ (ou du RPC hors Québec); prévoyez-les dans votre salaire ou vos frais généraux.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { en: "Is this the rate I should quote every job at?", fr: "Est-ce le taux à utiliser pour chaque soumission?" },
        a: {
          en: "It is your minimum for labour. Materials, subcontractors and equipment get their own markup on top, and a fixed-price quote should still be built from this rate times a realistic number of hours.",
          fr: "C'est votre minimum pour la main-d'œuvre. Les matériaux, la sous-traitance et l'équipement reçoivent leur propre majoration, et une soumission à prix fixe devrait quand même partir de ce taux multiplié par un nombre d'heures réaliste.",
        },
      },
      {
        q: { en: "Should I include employees?", fr: "Dois-je inclure mes employés?" },
        a: {
          en: "This calculator is for your own time. For an employee, start from their wage plus payroll costs (CPP/QPP, EI, workers' compensation, vacation pay) and divide by their billable hours the same way.",
          fr: "Ce calculateur vise votre propre temps. Pour un employé, partez de son salaire plus les charges sociales (RRQ ou RPC, AE, CNESST ou WSIB, vacances) et divisez par ses heures facturables de la même façon.",
        },
      },
    ],
  },
};

export const TOOL_ORDER: readonly ToolId[] = ["salesTax", "holdback", "markup", "labourRate"];
