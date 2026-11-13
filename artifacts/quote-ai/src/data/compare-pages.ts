// Comparison pages (/compare, /fr/comparer): quoteai next to Jobber, Joist
// and Housecall Pro, for Canadian contractors.
//
// Rules for this file (Competition Act: comparative claims must be true and
// not misleading):
// - Every competitor fact comes from that company's own public page, checked
//   on CHECKED_AT; the source URL is printed on the page.
// - Where we could not confirm something from their public pages, the cell
//   says so ("Not confirmed"), never "No".
// - quoteai facts come from data/pricing.ts and lib/plans.ts, including where
//   we cost more or include less.
// - Re-check prices before changing CHECKED_AT; they change often.
import type { CompetitorId } from "./seo-slugs";
import { MARKETING_PLANS, ONE_SHOT_OPTIONS } from "./pricing";
import { SEATS_INCLUDED } from "@/lib/plans";

type L = { en: string; fr: string };

export const CHECKED_AT = "2026-11-13";

const plan = (id: string) => MARKETING_PLANS.find((p) => p.id === id)!;
const STARTER = plan("monthly_starter");
const PRO = plan("monthly_pro");
const BUSINESS = plan("monthly_business");
const SINGLE = Math.min(...ONE_SHOT_OPTIONS.map((o) => o.price));

/** The rows every table shares, in order. */
export const ROWS = ["currency", "entry", "invoicing", "cardPayments", "trial", "quoteBuilding", "tax", "french", "singleQuote"] as const;
export type RowId = (typeof ROWS)[number];

export const ROW_LABELS: Record<RowId, L> = {
  currency: { en: "Billed in", fr: "Facturé en" },
  entry: { en: "Lowest monthly plan", fr: "Forfait mensuel le moins cher" },
  invoicing: { en: "Cheapest plan with quotes and invoices", fr: "Forfait le moins cher avec soumissions et factures" },
  cardPayments: { en: "Customers pay by card online", fr: "Paiement par carte en ligne" },
  trial: { en: "Free trial", fr: "Essai gratuit" },
  quoteBuilding: { en: "How a quote is built", fr: "Comment la soumission est préparée" },
  tax: { en: "Canadian sales tax (GST/HST/PST/QST)", fr: "Taxes canadiennes (TPS/TVH/TVP/TVQ)" },
  french: { en: "French (Canada) quotes, invoices and client pages", fr: "Soumissions, factures et pages client en français" },
  singleQuote: { en: "Pay for one quote, no subscription", fr: "Payer une seule soumission, sans abonnement" },
};

const NOT_CONFIRMED: L = { en: "Not confirmed from their public pages", fr: "Non confirmé dans leurs pages publiques" };
const NOT_LISTED: L = { en: "Not listed on their pricing page", fr: "Non indiqué sur leur page de prix" };

export const QUOTEAI_CELLS: Record<RowId, L> = {
  currency: { en: "Canadian dollars", fr: "Dollars canadiens" },
  entry: {
    en: `Starter: CA$${STARTER.monthly}/mo, ${STARTER.quotaPerMonth} AI quotes a month, quotes only, ${SEATS_INCLUDED.monthly_starter} user`,
    fr: `Starter : ${STARTER.monthly} $ CA/mois, ${STARTER.quotaPerMonth} soumissions IA par mois, soumissions seulement, ${SEATS_INCLUDED.monthly_starter} utilisateur`,
  },
  invoicing: {
    en: `Pro: CA$${PRO.monthly}/mo, ${PRO.quotaPerMonth} AI quotes a month, contracts and e-signature, invoicing, ${SEATS_INCLUDED.monthly_pro} users`,
    fr: `Pro : ${PRO.monthly} $ CA/mois, ${PRO.quotaPerMonth} soumissions IA par mois, contrats et signature électronique, facturation, ${SEATS_INCLUDED.monthly_pro} utilisateurs`,
  },
  cardPayments: {
    en: `From Business (CA$${BUSINESS.monthly}/mo), paid into your own Stripe account`,
    fr: `À partir de Business (${BUSINESS.monthly} $ CA/mois), versé dans votre propre compte Stripe`,
  },
  trial: { en: "7 days, no credit card", fr: "7 jours, sans carte de crédit" },
  quoteBuilding: {
    en: "Describe the job in plain words (typed or spoken); the AI drafts line items, quantities and prices in about 30 seconds, and you edit before sending",
    fr: "Décrivez le travail en mots simples (écrit ou dicté); l'IA rédige postes, quantités et prix en environ 30 secondes, et vous corrigez avant l'envoi",
  },
  tax: {
    en: "Set by the customer's province automatically; each tax on its own line",
    fr: "Selon la province du client, automatiquement; chaque taxe sur sa propre ligne",
  },
  french: { en: "Yes: the app, documents and client pages", fr: "Oui : l'application, les documents et les pages client" },
  singleQuote: { en: `Yes, from CA$${SINGLE}`, fr: `Oui, à partir de ${SINGLE} $ CA` },
};

export interface Competitor {
  id: CompetitorId;
  name: string;
  pricingUrl: string;
  /** One line about who they are, for the page intro. */
  about: L;
  cells: Record<RowId, L>;
  /** When they are the better pick. Honest, specific. */
  chooseThem: ReadonlyArray<L>;
  chooseUs: ReadonlyArray<L>;
  sections: ReadonlyArray<{ h2: L; body: ReadonlyArray<L> }>;
  faq: ReadonlyArray<{ q: L; a: L }>;
}

const SWITCHING: { h2: L; body: ReadonlyArray<L> } = {
  h2: { en: "Switching without retyping", fr: "Changer sans tout ressaisir" },
  body: [
    {
      en: "If your current app can export clients or quotes to a CSV or Excel file, quoteai imports that spreadsheet: it matches the usual column names (client, email, phone, address, description, quantity, price, total) without a template. Run both for a week if you like; the trial needs no credit card.",
      fr: "Si votre application actuelle peut exporter vos clients ou soumissions en fichier CSV ou Excel, quoteai importe ce fichier : il reconnaît les noms de colonnes habituels (client, courriel, téléphone, adresse, description, quantité, prix, total) sans modèle imposé. Utilisez les deux pendant une semaine si vous voulez; l'essai ne demande pas de carte de crédit.",
    },
  ],
};

export const COMPETITORS: Record<CompetitorId, Competitor> = {
  jobber: {
    id: "jobber",
    name: "Jobber",
    pricingUrl: "https://www.getjobber.com/pricing/",
    about: {
      en: "Jobber is field service software from Edmonton, used by home service companies across North America for quoting, scheduling, dispatch, invoicing and payments.",
      fr: "Jobber est un logiciel de gestion de services sur le terrain conçu à Edmonton, utilisé par des entreprises de services résidentiels partout en Amérique du Nord pour les soumissions, l'horaire, la répartition, la facturation et les paiements.",
    },
    cells: {
      currency: { en: "US dollars", fr: "Dollars américains" },
      entry: { en: "Core: US$49/mo month-to-month (US$29/mo billed yearly), 1 user", fr: "Core : 49 $ US/mois sans engagement (29 $ US/mois facturé à l'année), 1 utilisateur" },
      invoicing: { en: "Core includes quotes, invoicing and online payments", fr: "Core comprend soumissions, facturation et paiements en ligne" },
      cardPayments: { en: "Included from Core", fr: "Inclus dès Core" },
      trial: { en: "14 days, no credit card", fr: "14 jours, sans carte de crédit" },
      quoteBuilding: { en: "Line items from your saved products and services; Jobber also lists AI tools", fr: "Postes tirés de vos produits et services enregistrés; Jobber offre aussi des outils d'IA" },
      tax: { en: "You create tax rates and combine them into tax groups (Jobber help centre)", fr: "Vous créez les taux et les regroupez en groupes de taxes (centre d'aide Jobber)" },
      french: NOT_CONFIRMED,
      singleQuote: NOT_LISTED,
    },
    chooseThem: [
      { en: "You run several crews and need scheduling, dispatch and route planning every day.", fr: "Vous gérez plusieurs équipes et avez besoin chaque jour d'horaire, de répartition et de planification des trajets." },
      { en: "You want a large ecosystem of integrations and a long track record.", fr: "Vous voulez un grand écosystème d'intégrations et une entreprise bien établie." },
      { en: "You need card payments on the cheapest plan.", fr: "Vous voulez le paiement par carte dès le forfait le moins cher." },
    ],
    chooseUs: [
      { en: "Quoting is your bottleneck and you want a full quote drafted from a few words, on site.", fr: "Les soumissions sont votre goulot d'étranglement et vous voulez une soumission complète rédigée à partir de quelques mots, sur le chantier." },
      { en: "You want to pay in Canadian dollars, with Canadian taxes set for you.", fr: "Vous voulez payer en dollars canadiens, avec les taxes canadiennes réglées pour vous." },
      { en: "You work in French, or for French-speaking customers.", fr: "Vous travaillez en français ou pour des clients francophones." },
    ],
    sections: [
      {
        h2: { en: "Price: compare the plan you would really use", fr: "Prix : comparez le forfait que vous utiliseriez vraiment" },
        body: [
          {
            en: `Jobber's Core plan (US$49 a month, month to month) already includes quotes, invoices and online payments for one user. quoteai's Starter (CA$${STARTER.monthly}) covers quotes only; the plan that matches Core on paperwork is Pro at CA$${PRO.monthly}, which adds contracts and e-signature and a second user, and card payments come with Business at CA$${BUSINESS.monthly}. Jobber bills in US dollars, so its price in Canadian dollars moves with the exchange rate; quoteai bills in Canadian dollars.`,
            fr: `Le forfait Core de Jobber (49 $ US par mois, sans engagement) comprend déjà soumissions, factures et paiements en ligne pour un utilisateur. Le forfait Starter de quoteai (${STARTER.monthly} $ CA) couvre les soumissions seulement; le forfait équivalent pour la paperasse est Pro à ${PRO.monthly} $ CA, qui ajoute contrats, signature électronique et un deuxième utilisateur, et le paiement par carte vient avec Business à ${BUSINESS.monthly} $ CA. Jobber facture en dollars américains, donc son prix en dollars canadiens varie avec le taux de change; quoteai facture en dollars canadiens.`,
          },
        ],
      },
      {
        h2: { en: "Quoting speed versus running the whole operation", fr: "Rapidité des soumissions ou gestion de toute l'entreprise" },
        body: [
          {
            en: "Jobber is built around the schedule: crews, visits, routes and recurring work. quoteai is built around the quote: you say what the job is and the AI writes the line items, then the same numbers carry into the contract, deposit, job and invoice. Owner-operators and small crews who lose evenings to estimates tend to feel the difference most; larger crews who live in a dispatch board may be better served by Jobber.",
            fr: "Jobber est conçu autour de l'horaire : équipes, visites, trajets et travaux récurrents. quoteai est conçu autour de la soumission : vous dites quel est le travail et l'IA rédige les postes, puis les mêmes chiffres passent au contrat, à l'acompte, au chantier et à la facture. Les entrepreneurs seuls et les petites équipes qui perdent leurs soirées aux soumissions sentent le plus la différence; les grandes équipes qui vivent dans un tableau de répartition seront peut-être mieux servies par Jobber.",
          },
        ],
      },
      SWITCHING,
    ],
    faq: [
      {
        q: { en: "Is Jobber Canadian?", fr: "Jobber est-elle une entreprise canadienne?" },
        a: { en: "Yes, Jobber was founded in Edmonton. Its published prices are in US dollars.", fr: "Oui, Jobber a été fondée à Edmonton. Ses prix publiés sont en dollars américains." },
      },
      {
        q: { en: "Is quoteai cheaper than Jobber?", fr: "quoteai coûte-t-il moins cher que Jobber?" },
        a: {
          en: `For quoting alone, yes: CA$${STARTER.monthly} a month against US$49. For quotes plus invoicing it is close (CA$${PRO.monthly} against US$49), and if you need card payments Jobber's Core is cheaper. Compare the plan you would actually use.`,
          fr: `Pour les soumissions seulement, oui : ${STARTER.monthly} $ CA par mois contre 49 $ US. Pour soumissions et facturation, c'est comparable (${PRO.monthly} $ CA contre 49 $ US), et si vous avez besoin du paiement par carte, Core de Jobber est moins cher. Comparez le forfait que vous utiliseriez vraiment.`,
        },
      },
    ],
  },

  joist: {
    id: "joist",
    name: "Joist",
    pricingUrl: "https://www.joist.com/pricing/",
    about: {
      en: "Joist is an estimating and invoicing app from Toronto, popular with renovators and small contractors who want simple estimate and invoice templates on their phone.",
      fr: "Joist est une application d'estimation et de facturation de Toronto, populaire auprès des rénovateurs et petits entrepreneurs qui veulent des modèles simples d'estimation et de facture sur leur téléphone.",
    },
    cells: {
      currency: { en: "Not stated on their pricing page", fr: "Non précisé sur leur page de prix" },
      entry: { en: "Basics: $12/mo, 5 documents a month", fr: "Basics : 12 $/mois, 5 documents par mois" },
      invoicing: { en: "Basics includes estimates to invoices (5 documents a month); Pro, $17/mo, is unlimited", fr: "Basics comprend estimations et factures (5 documents par mois); Pro, 17 $/mois, est illimité" },
      cardPayments: { en: "Online payments listed from Basics", fr: "Paiements en ligne indiqués dès Basics" },
      trial: { en: "14 days, no credit card", fr: "14 jours, sans carte de crédit" },
      quoteBuilding: { en: "Estimate templates with your line items; Joist also lists built-in AI tools", fr: "Modèles d'estimation avec vos postes; Joist indique aussi des outils d'IA intégrés" },
      tax: NOT_CONFIRMED,
      french: NOT_CONFIRMED,
      singleQuote: NOT_LISTED,
    },
    chooseThem: [
      { en: "You send a handful of estimates a month and want the lowest monthly price.", fr: "Vous envoyez quelques estimations par mois et voulez le prix mensuel le plus bas." },
      { en: "You want homeowner financing offered on your estimates.", fr: "Vous voulez offrir du financement aux propriétaires sur vos estimations." },
    ],
    chooseUs: [
      { en: "You want the quote written for you from a description, not a blank template.", fr: "Vous voulez que la soumission soit rédigée pour vous à partir d'une description, pas un modèle vide." },
      { en: "You need contracts, e-signature, deposits and job tracking from the same numbers.", fr: "Vous avez besoin de contrats, de signature électronique, d'acomptes et de suivi de chantier à partir des mêmes chiffres." },
      { en: "You work in French or in Québec, with GST and QST on separate lines.", fr: "Vous travaillez en français ou au Québec, avec TPS et TVQ sur des lignes distinctes." },
    ],
    sections: [
      {
        h2: { en: "Templates versus a drafted quote", fr: "Modèle ou soumission rédigée" },
        body: [
          {
            en: "Joist gives you a clean estimate template and you fill it in. quoteai starts from what you would say to the customer (\"tear out and replace 40 feet of fence, pressure-treated, two gates\") and drafts the lines and prices for you to correct. If your estimates are short and repetitive, a template is fast enough; if each job is different, drafting saves the most time.",
            fr: "Joist vous donne un modèle d'estimation propre que vous remplissez. quoteai part de ce que vous diriez au client (« enlever et remplacer 40 pieds de clôture en bois traité, deux barrières ») et rédige les lignes et les prix, que vous corrigez. Si vos estimations sont courtes et répétitives, un modèle suffit; si chaque travail est différent, la rédaction automatique fait gagner le plus de temps.",
          },
        ],
      },
      {
        h2: { en: "Price", fr: "Prix" },
        body: [
          {
            en: `Joist is the cheaper subscription: Pro at $17 a month for unlimited documents, against quoteai's Starter at CA$${STARTER.monthly} for ${STARTER.quotaPerMonth} AI quotes. quoteai also sells a single quote from CA$${SINGLE} with no subscription, for contractors who quote only now and then.`,
            fr: `Joist est l'abonnement le moins cher : Pro à 17 $ par mois pour des documents illimités, contre Starter de quoteai à ${STARTER.monthly} $ CA pour ${STARTER.quotaPerMonth} soumissions IA. quoteai vend aussi une soumission à l'unité à partir de ${SINGLE} $ CA, sans abonnement, pour ceux qui font des soumissions de temps en temps.`,
          },
        ],
      },
      SWITCHING,
    ],
    faq: [
      {
        q: { en: "Does Joist still have a free plan?", fr: "Joist a-t-il encore un forfait gratuit?" },
        a: { en: "No. Its pricing page says the free plan is no longer available; there is a 14-day trial.", fr: "Non. Sa page de prix indique que le forfait gratuit n'est plus offert; il y a un essai de 14 jours." },
      },
      {
        q: { en: "Is quoteai a Joist alternative for renovators?", fr: "quoteai est-il une option pour les rénovateurs qui utilisent Joist?" },
        a: {
          en: "Yes, if you want the estimate drafted for you and the contract, deposit and invoice to follow from it. If you only need a cheap template, Joist costs less.",
          fr: "Oui, si vous voulez que l'estimation soit rédigée pour vous et que le contrat, l'acompte et la facture en découlent. Si vous n'avez besoin que d'un modèle peu coûteux, Joist coûte moins cher.",
        },
      },
    ],
  },

  housecallPro: {
    id: "housecallPro",
    name: "Housecall Pro",
    pricingUrl: "https://www.housecallpro.com/pricing/",
    about: {
      en: "Housecall Pro is US field service software for home service businesses, with scheduling, dispatch, estimates, invoicing, payments and marketing tools.",
      fr: "Housecall Pro est un logiciel américain de gestion de services sur le terrain pour les entreprises de services résidentiels : horaire, répartition, estimations, facturation, paiements et outils de marketing.",
    },
    cells: {
      currency: { en: "US dollars", fr: "Dollars américains" },
      entry: { en: "Basic: US$79/mo month-to-month (US$59/mo billed yearly), 1 user", fr: "Basic : 79 $ US/mois sans engagement (59 $ US/mois facturé à l'année), 1 utilisateur" },
      invoicing: { en: "Basic includes estimates, invoicing and payments", fr: "Basic comprend estimations, facturation et paiements" },
      cardPayments: { en: "Included from Basic", fr: "Inclus dès Basic" },
      trial: { en: "14 days, no credit card", fr: "14 jours, sans carte de crédit" },
      quoteBuilding: { en: "Estimates from your price book; a Sales Proposal Tool on the Max plan", fr: "Estimations à partir de votre liste de prix; outil de propositions de vente avec le forfait Max" },
      tax: NOT_CONFIRMED,
      french: NOT_CONFIRMED,
      singleQuote: NOT_LISTED,
    },
    chooseThem: [
      { en: "You run a growing home service team and want scheduling, dispatch and marketing tools in one place.", fr: "Vous dirigez une équipe de services résidentiels en croissance et voulez horaire, répartition et marketing au même endroit." },
      { en: "You need card payments and consumer financing on the entry plan.", fr: "Vous voulez le paiement par carte et le financement aux consommateurs dès le forfait de base." },
    ],
    chooseUs: [
      { en: "You want to pay less, in Canadian dollars.", fr: "Vous voulez payer moins, en dollars canadiens." },
      { en: "Quotes take you too long and you want them drafted from a description.", fr: "Vos soumissions prennent trop de temps et vous voulez qu'elles soient rédigées à partir d'une description." },
      { en: "You need French documents and Canadian taxes handled for you.", fr: "Vous avez besoin de documents en français et de taxes canadiennes gérées pour vous." },
    ],
    sections: [
      {
        h2: { en: "Price", fr: "Prix" },
        body: [
          {
            en: `Housecall Pro's Basic plan is US$79 a month month to month (US$59 billed yearly) for one user, and includes estimates, invoices and payments. quoteai's Pro, with quotes, contracts, e-signature and invoicing for ${SEATS_INCLUDED.monthly_pro} users, is CA$${PRO.monthly}; card payments come with Business at CA$${BUSINESS.monthly}. Housecall Pro bills in US dollars.`,
            fr: `Le forfait Basic de Housecall Pro coûte 79 $ US par mois sans engagement (59 $ US facturé à l'année) pour un utilisateur, et comprend estimations, factures et paiements. Le forfait Pro de quoteai, avec soumissions, contrats, signature électronique et facturation pour ${SEATS_INCLUDED.monthly_pro} utilisateurs, coûte ${PRO.monthly} $ CA; le paiement par carte vient avec Business à ${BUSINESS.monthly} $ CA. Housecall Pro facture en dollars américains.`,
          },
        ],
      },
      {
        h2: { en: "Built for the US home service market", fr: "Conçu pour le marché américain des services résidentiels" },
        body: [
          {
            en: "Housecall Pro is a strong, broad tool aimed first at US home service companies. quoteai is narrower and Canadian: it starts with the quote, sets GST, HST, PST or QST by province, and works in English and French. If you mostly need fast, correct quotes and paperwork in Canada, the narrower tool may fit better; if you need a full dispatch and marketing suite, Housecall Pro does more.",
            fr: "Housecall Pro est un outil solide et complet, pensé d'abord pour les entreprises américaines de services résidentiels. quoteai est plus ciblé et canadien : il part de la soumission, applique la TPS, la TVH, la TVP ou la TVQ selon la province et fonctionne en français et en anglais. Si vous avez surtout besoin de soumissions et de paperasse rapides et exactes au Canada, l'outil ciblé convient peut-être mieux; s'il vous faut une suite complète de répartition et de marketing, Housecall Pro en fait plus.",
          },
        ],
      },
      SWITCHING,
    ],
    faq: [
      {
        q: { en: "Does Housecall Pro work in Canada?", fr: "Housecall Pro fonctionne-t-il au Canada?" },
        a: { en: "Its published prices are in US dollars. Check with Housecall Pro for Canadian billing, taxes and payment processing before you sign up.", fr: "Ses prix publiés sont en dollars américains. Vérifiez auprès de Housecall Pro la facturation, les taxes et le traitement des paiements au Canada avant de vous inscrire." },
      },
      {
        q: { en: "Is quoteai cheaper than Housecall Pro?", fr: "quoteai coûte-t-il moins cher que Housecall Pro?" },
        a: {
          en: `For quotes and invoicing, yes: CA$${PRO.monthly} a month against US$79. With card payments, quoteai's Business plan (CA$${BUSINESS.monthly}) costs more than Housecall Pro's Basic.`,
          fr: `Pour les soumissions et la facturation, oui : ${PRO.monthly} $ CA par mois contre 79 $ US. Avec le paiement par carte, le forfait Business de quoteai (${BUSINESS.monthly} $ CA) coûte plus que Basic de Housecall Pro.`,
        },
      },
    ],
  },
};

export const COMPARE_ORDER: readonly CompetitorId[] = ["jobber", "joist", "housecallPro"];

export const COMPARE_UI = {
  hubTitle: { en: "Quoting software for Canadian contractors, compared (2026) | quoteai", fr: "Logiciels de soumission pour entrepreneurs canadiens, comparés (2026) | quoteai" },
  hubDescription: {
    en: "quoteai, Jobber, Joist and Housecall Pro side by side for Canadian trades: prices and currency, free trials, Canadian sales tax, French, and how each builds a quote.",
    fr: "quoteai, Jobber, Joist et Housecall Pro côte à côte pour les métiers au Canada : prix et devise, essais gratuits, taxes canadiennes, français et préparation des soumissions.",
  },
  hubEyebrow: { en: "Compare", fr: "Comparer" },
  hubH1: { en: "Quoting software for Canadian contractors, compared.", fr: "Logiciels de soumission pour entrepreneurs canadiens, comparés." },
  hubLead: {
    en: "Four tools Canadian trades ask us about, side by side, with each company's own published prices. Where one of them is the better pick, we say so.",
    fr: "Quatre outils dont les gens de métier canadiens nous parlent, côte à côte, avec les prix publiés par chaque entreprise. Quand l'un d'eux est le meilleur choix, nous le disons.",
  },
  pageTitle: { en: "quoteai vs {name} for Canadian contractors (2026) | quoteai", fr: "quoteai ou {name} pour les entrepreneurs canadiens (2026) | quoteai" },
  pageDescription: {
    en: "quoteai and {name} compared for Canadian trades: prices and currency, free trial, GST/HST/PST/QST, French, and when {name} is the better choice. Prices checked {date}.",
    fr: "quoteai et {name} comparés pour les métiers au Canada : prix et devise, essai gratuit, TPS/TVH/TVP/TVQ, français, et quand {name} est le meilleur choix. Prix vérifiés le {date}.",
  },
  pageEyebrow: { en: "{name} alternative for Canada", fr: "Option à {name} au Canada" },
  pageH1: { en: "quoteai vs {name} for Canadian contractors.", fr: "quoteai ou {name} pour les entrepreneurs canadiens." },
  checked: { en: "Prices checked {date} on each company's own pricing page.", fr: "Prix vérifiés le {date} sur la page de prix de chaque entreprise." },
  tableTitle: { en: "Side by side", fr: "Côte à côte" },
  chooseThem: { en: "Choose {name} if", fr: "Choisissez {name} si" },
  chooseUs: { en: "Choose quoteai if", fr: "Choisissez quoteai si" },
  faqTitle: { en: "Questions", fr: "Questions" },
  source: { en: "Source: {name} pricing page", fr: "Source : page de prix de {name}" },
  other: { en: "Other comparisons", fr: "Autres comparaisons" },
  all: { en: "All comparisons", fr: "Toutes les comparaisons" },
  readFull: { en: "Read the full comparison", fr: "Lire la comparaison complète" },
  fine: {
    en: "Jobber, Joist and Housecall Pro are trademarks of their owners; quoteai is not affiliated with them. Their prices and features change, so check their sites before you decide. If something here is out of date or wrong, write to info@quoteai.ca and we will correct it.",
    fr: "Jobber, Joist et Housecall Pro sont des marques de leurs propriétaires; quoteai n'est pas affilié à ces entreprises. Leurs prix et fonctions changent : vérifiez leurs sites avant de décider. Si une information ici est périmée ou inexacte, écrivez à info@quoteai.ca et nous la corrigerons.",
  },
  ctaTitle: { en: "Try it on your next quote.", fr: "Essayez-le sur votre prochaine soumission." },
  ctaBody: {
    en: "Describe a real job and see the quote quoteai drafts, with your province's taxes, before you decide anything.",
    fr: "Décrivez un vrai travail et voyez la soumission que quoteai rédige, avec les taxes de votre province, avant de décider quoi que ce soit.",
  },
  ctaButton: { en: "Try quoteai free", fr: "Essayer quoteai gratuitement" },
  ctaNote: { en: "7 days free, no credit card.", fr: "7 jours gratuits, sans carte de crédit." },
} as const;
