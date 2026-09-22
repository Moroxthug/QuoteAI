// Phase 81 — the three pilot provinces (docs/PILOT-LAUNCH-PLAN.md: BC, ON, QC).
//
// One landing page per province, in both languages. Everything on those pages
// is either (a) computed from TAX_PROFILES — the same table the quote,
// contract and invoice documents use, so the rates on the marketing page and
// the rates on a customer's PDF cannot disagree — or (b) a statement about
// what the *product* does in that province.
//
// What is deliberately absent: legal advice. The product says "informed by
// provincial law", never "compliant" (owner track O8, LAUNCH-GO-NO-GO §2), so
// the copy below describes fields the software carries and documents it
// produces, and names licensing bodies only as the name of a field the
// contractor fills in themselves.

import { TAX_PROFILES, PROVINCE_NAMES, type ProvinceCode, type TaxComponent } from "@/lib/tax-profiles";
import { PROVINCE_SLUG_PAIRS } from "./seo-slugs";

/** Slug pairs live in seo-slugs.ts (the light module the public chrome loads); this page module reads them. */
const slugsFor = (code: "BC" | "ON" | "QC") => PROVINCE_SLUG_PAIRS.find((p) => p.code === code)!;
const SLUGS = { BC: slugsFor("BC"), ON: slugsFor("ON"), QC: slugsFor("QC") };

export interface ProvincePageData {
  code: ProvinceCode;
  /** English URL slug under /provinces/. */
  slug: string;
  /** French URL slug under /fr/provinces/. */
  frSlug: string;
  /** Cities in seo-data.ts CITIES that sit in this province, for the local-page links. */
  citySlugs: readonly string[];
  /** The province's default document language in the product (QC quotes default to French). */
  defaultDocumentLang: "en" | "fr";
  /** Two or three sentences of intro, under the H1. */
  intro: { en: string; fr: string };
  /** What the product does about this province's paperwork. Three to five bullets. */
  productNotes: readonly { en: string; fr: string }[];
  /** The licence/registration number field the contractor fills in, if the province has a well-known one. */
  licenceField?: { en: string; fr: string };
}

export const PILOT_PROVINCES: readonly ProvincePageData[] = [
  {
    code: "BC",
    slug: SLUGS.BC.en,
    frSlug: SLUGS.BC.fr,
    citySlugs: ["vancouver", "surrey", "victoria"],
    defaultDocumentLang: "en",
    intro: {
      en: "British Columbia is one of the three provinces in the quoteai pilot. Quotes, contracts and invoices you send from BC carry the province's two-part sales tax as two separate lines — the 5 % federal GST and the 7 % provincial PST — because that is how your customer's accountant expects to see it, and how the CRA and the BC Ministry of Finance ask you to show it.",
      fr: "La Colombie-Britannique est l'une des trois provinces du projet pilote quoteai. Les soumissions, contrats et factures envoyés depuis la C.-B. présentent la taxe de vente en deux lignes distinctes — la TPS fédérale de 5 % et la TVP provinciale de 7 % — parce que c'est ainsi que le comptable de votre client s'attend à la voir.",
    },
    productNotes: [
      {
        en: "Every money document splits the tax into GST and PST lines that add up to the stored total to the cent — no single blended \"12 % tax\" line.",
        fr: "Chaque document d'argent sépare la taxe en lignes TPS et TVP dont la somme correspond au total enregistré au cent près — pas une seule ligne « taxe de 12 % ».",
      },
      {
        en: "Your GST/HST and PST registration numbers are saved once in your business profile and printed on every quote, contract and invoice.",
        fr: "Vos numéros d'inscription à la TPS/TVH et à la TVP sont enregistrés une fois dans votre profil et imprimés sur chaque soumission, contrat et facture.",
      },
      {
        en: "Deposits and progress payments are set up as a payment schedule on the quote, so the contract and the invoices that follow come from the same numbers.",
        fr: "Les acomptes et paiements progressifs sont définis comme un échéancier sur la soumission, de sorte que le contrat et les factures qui suivent viennent des mêmes chiffres.",
      },
      {
        en: "Customers pay by Interac e-Transfer, cheque or card — card payments land in your own Stripe account, not ours.",
        fr: "Les clients paient par virement Interac, par chèque ou par carte — les paiements par carte vont dans votre propre compte Stripe, pas le nôtre.",
      },
    ],
    licenceField: {
      en: "Licence number (e.g. your BC Housing licensed-residential-builder number, if you hold one)",
      fr: "Numéro de licence (p. ex. votre numéro de constructeur résidentiel agréé BC Housing, si vous en avez un)",
    },
  },
  {
    code: "ON",
    slug: SLUGS.ON.en,
    frSlug: SLUGS.ON.fr,
    citySlugs: ["toronto", "ottawa", "mississauga", "hamilton"],
    defaultDocumentLang: "en",
    intro: {
      en: "Ontario is the largest market in the quoteai pilot. Ontario uses a single harmonized tax, so a quote generated here shows one HST line at 13 % — calculated on the taxable subtotal after any discount, and carried unchanged from the quote through to the contract and the final invoice.",
      fr: "L'Ontario est le plus grand marché du projet pilote quoteai. L'Ontario applique une taxe harmonisée unique : une soumission générée ici affiche une seule ligne de TVH à 13 % — calculée sur le sous-total taxable après remise, et reportée telle quelle de la soumission au contrat puis à la facture finale.",
    },
    productNotes: [
      {
        en: "One HST line at 13 %, computed after discounts, identical on the quote, the signed contract and every invoice drawn from them.",
        fr: "Une ligne de TVH à 13 %, calculée après les remises, identique sur la soumission, le contrat signé et chaque facture qui en découle.",
      },
      {
        en: "Holdback on a job is tracked as its own amount: the final invoice the job draws up shows what is billed now and what is held back.",
        fr: "La retenue sur un chantier est suivie comme un montant distinct : la facture finale indique ce qui est facturé maintenant et ce qui est retenu.",
      },
      {
        en: "Change orders are numbered, priced with the same tax rule and attached to the signed contract, so the paper trail matches the work.",
        fr: "Les ordres de changement sont numérotés, chiffrés selon la même règle fiscale et rattachés au contrat signé, pour que la trace écrite corresponde aux travaux.",
      },
      {
        en: "E-signature captures the customer's name, the time and the IP address on the signed PDF; both sides get a copy by email.",
        fr: "La signature électronique inscrit le nom du client, l'heure et l'adresse IP sur le PDF signé; les deux parties en reçoivent une copie par courriel.",
      },
    ],
    licenceField: {
      en: "Licence number (e.g. your ECRA/ESA or HCRA registration, if your trade carries one)",
      fr: "Numéro de licence (p. ex. votre inscription ECRA/ESA ou HCRA, si votre métier en exige une)",
    },
  },
  {
    code: "QC",
    slug: SLUGS.QC.en,
    frSlug: SLUGS.QC.fr,
    citySlugs: ["montreal", "quebec-city", "gatineau", "laval"],
    defaultDocumentLang: "fr",
    intro: {
      en: "Québec is in the pilot with its own defaults. A quote written for a Québec customer is produced in French unless the customer has asked in writing for English, and its tax block shows the two statutory lines — TPS 5 % and TVQ 9,975 % — with amounts that add up to the stored total to the cent.",
      fr: "Le Québec fait partie du projet pilote avec ses propres réglages par défaut. Une soumission destinée à un client québécois est produite en français, à moins que le client n'ait demandé l'anglais par écrit, et son bloc de taxes affiche les deux lignes prévues par la loi — TPS 5 % et TVQ 9,975 % — dont les montants totalisent exactement le total enregistré.",
    },
    productNotes: [
      {
        en: "French is the default document language for a Québec customer; choosing English records that the customer asked for it.",
        fr: "Le français est la langue par défaut des documents destinés à un client québécois; choisir l'anglais enregistre que le client en a fait la demande.",
      },
      {
        en: "TPS and TVQ are two separate lines. The rate is stored to three decimals, so 9,975 % is 9,975 % — not 9,98 % rounded on every document.",
        fr: "La TPS et la TVQ sont deux lignes distinctes. Le taux est enregistré à trois décimales : 9,975 % reste 9,975 % — et non 9,98 % arrondi sur chaque document.",
      },
      {
        en: "Your GST/HST and QST registration numbers print on every document, and dates and amounts are formatted the Québec way.",
        fr: "Vos numéros d'inscription à la TPS/TVH et à la TVQ figurent sur chaque document, et les dates et montants sont formatés à la québécoise.",
      },
      {
        en: "Your RBQ licence number is a field on your business profile and appears on the quotes and contracts you send.",
        fr: "Votre numéro de licence RBQ est un champ de votre profil d'entreprise et apparaît sur les soumissions et contrats que vous envoyez.",
      },
    ],
    licenceField: {
      en: "RBQ licence number",
      fr: "Numéro de licence RBQ",
    },
  },
];

export const PROVINCE_BY_SLUG: Record<string, ProvincePageData> = Object.fromEntries(
  PILOT_PROVINCES.flatMap((p) => (p.slug === p.frSlug ? [[p.slug, p]] : [[p.slug, p], [p.frSlug, p]])),
);

/** English page path ↔ French page path, for the language toggle and hreflang. */
export function provincePath(p: ProvincePageData, lang: "en" | "fr"): string {
  return lang === "fr" ? `/fr/provinces/${p.frSlug}/` : `/provinces/${p.slug}/`;
}

export function provinceName(p: ProvincePageData, lang: "en" | "fr"): string {
  return PROVINCE_NAMES[p.code][lang];
}

/** The province's statutory tax components, straight from the table the documents use. */
export function provinceTaxComponents(p: ProvincePageData): readonly TaxComponent[] {
  return TAX_PROFILES[p.code].components;
}

export function provinceTotalRate(p: ProvincePageData): number {
  return TAX_PROFILES[p.code].totalRate;
}
