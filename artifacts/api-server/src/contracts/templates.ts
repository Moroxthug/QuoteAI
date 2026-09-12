import type { ContractDocument, ContractSection, ContractVariables } from "@workspace/db";
import { PROVINCE_NAMES, normalizeProvince } from "@workspace/db";

// ── Contract template library ────────────────────────────────────────────────
// Residential/small-commercial construction & renovation services agreement.
// One base template; province-specific clauses swapped in for ON, BC, AB, QC;
// everything else uses the generic Canadian variant ("CA").
//
// LEGAL REVIEW GATE: this text is a starting point informed by the statutes
// named in docs/JOB-LIFECYCLE-PLAN.md §5. It must be reviewed by a Canadian
// lawyer before the product markets the contracts as "compliant". Bump
// TEMPLATE_VERSION whenever clause text changes so signed contracts keep a
// record of which wording they were signed under.

export const TEMPLATE_VERSION = 1;

export type Lang = "en" | "fr";
type L = { en: string; fr: string };

export type TemplateKey = "ON" | "BC" | "AB" | "QC" | "CA";

export function templateKeyForProvince(province: string | null | undefined): TemplateKey {
  const code = normalizeProvince(province);
  if (code === "ON" || code === "BC" || code === "AB" || code === "QC") return code;
  return "CA";
}

const pick = (l: L, lang: Lang) => l[lang];

function provinceName(code: string, lang: Lang): string {
  const c = normalizeProvince(code);
  return c ? PROVINCE_NAMES[c][lang] : code;
}

function money(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(n);
}

// ── Clause texts ─────────────────────────────────────────────────────────────

const TITLE: L = {
  en: "Construction & Renovation Services Agreement",
  fr: "Contrat d'entreprise – Travaux de construction et de rénovation",
};

const HEADINGS: Record<string, L> = {
  parties: { en: "1. Parties", fr: "1. Parties" },
  scope: { en: "2. Scope of Work", fr: "2. Description des travaux" },
  price: { en: "3. Contract Price", fr: "3. Prix du contrat" },
  payment: { en: "4. Payment Terms", fr: "4. Modalités de paiement" },
  schedule: { en: "5. Schedule", fr: "5. Échéancier des travaux" },
  changes: { en: "6. Changes to the Work", fr: "6. Modifications aux travaux" },
  permits: { en: "7. Permits, Codes and Compliance", fr: "7. Permis, codes et conformité" },
  materials: { en: "8. Materials, Workmanship and Warranty", fr: "8. Matériaux, exécution et garantie" },
  site: { en: "9. Site Conditions and Access", fr: "9. Conditions du chantier et accès" },
  insurance: { en: "10. Insurance and Workers' Compensation", fr: "10. Assurances et indemnisation des travailleurs" },
  holdback: { en: "11. Holdback and Liens", fr: "11. Retenue et privilèges" },
  consumer: { en: "12. Cancellation Rights", fr: "12. Droit de résolution" },
  termination: { en: "13. Termination", fr: "13. Résiliation" },
  disputes: { en: "14. Disputes and Governing Law", fr: "14. Différends et droit applicable" },
  general: { en: "15. General", fr: "15. Dispositions générales" },
  signatures: { en: "16. Signatures", fr: "16. Signatures" },
};

const CLAUSES = {
  price: (v: ContractVariables, lang: Lang): L => ({
    en: `The Customer agrees to pay the Contractor the Contract Price of **${money(v.total, lang)}** (${money(v.subtotal, lang)} before applicable taxes) for the Work, as detailed in the price table below. The Contract Price is a fixed price for the Work described in Section 2 and may only be changed by a written change order under Section 6.`,
    fr: `Le Client s'engage à payer à l'Entrepreneur le prix du contrat de **${money(v.total, lang)}** (${money(v.subtotal, lang)} avant taxes applicables) pour les Travaux, tel que détaillé dans le tableau ci-dessous. Le prix du contrat est un prix forfaitaire pour les Travaux décrits à l'article 2 et ne peut être modifié que par un avenant écrit conformément à l'article 6.`,
  }),
  payment: (v: ContractVariables, lang: Lang): L => {
    const holdback = v.paymentSchedule.holdback.enabled
      ? {
          en: ` A statutory holdback of ${v.paymentSchedule.holdback.percent}% will be retained from each progress payment and released in accordance with Section 11.`,
          fr: ` Une retenue légale de ${v.paymentSchedule.holdback.percent} % sera prélevée sur chaque paiement progressif et libérée conformément à l'article 11.`,
        }
      : { en: "", fr: "" };
    return {
      en: `Payments are due according to the payment schedule below. Each invoice is payable within the number of days shown from the invoice date. Amounts unpaid after the due date bear interest at 1.5% per month (19.56% per year). The Contractor may suspend the Work while any invoice is more than 10 days overdue, and the schedule will be extended accordingly.${holdback.en}\n\nAccepted payment methods: Interac e-Transfer, cheque, or any other method agreed in writing.`,
      fr: `Les paiements sont exigibles selon l'échéancier ci-dessous. Chaque facture est payable dans le nombre de jours indiqué à compter de sa date. Les sommes impayées à l'échéance portent intérêt au taux de 1,5 % par mois (19,56 % par année). L'Entrepreneur peut suspendre les Travaux lorsqu'une facture est en souffrance depuis plus de 10 jours, et l'échéancier est prolongé en conséquence.${holdback.fr}\n\nModes de paiement acceptés : Virement Interac, chèque ou tout autre mode convenu par écrit.`,
    };
  },
  changes: {
    en: `Any change to the Work (additions, deletions, substitutions, or changes requested by the Customer or required by unforeseen conditions or authorities) must be documented in a written change order stating the change, its price and any effect on the schedule. The Contractor is not obliged to perform changed work until the change order is approved in writing (including electronically) by the Customer. The Contract Price and schedule are adjusted by each approved change order.`,
    fr: `Toute modification aux Travaux (ajouts, retraits, substitutions ou changements demandés par le Client ou exigés par des conditions imprévues ou par les autorités) doit faire l'objet d'un avenant écrit précisant la modification, son prix et son effet sur l'échéancier. L'Entrepreneur n'est pas tenu d'exécuter les travaux modifiés tant que l'avenant n'a pas été approuvé par écrit (y compris par voie électronique) par le Client. Le prix du contrat et l'échéancier sont ajustés par chaque avenant approuvé.`,
  },
  permits: {
    en: `Unless stated otherwise in Section 2, the Contractor will apply for the building permits required for the Work, and the cost of permits and inspection fees is not included in the Contract Price and will be invoiced at cost. The Work will be performed in accordance with the applicable building code and municipal by-laws. The Customer is responsible for obtaining any approvals required from a condominium corporation, landlord or homeowners' association.`,
    fr: `Sauf indication contraire à l'article 2, l'Entrepreneur présente les demandes de permis de construction requis pour les Travaux; le coût des permis et des frais d'inspection n'est pas compris dans le prix du contrat et sera facturé au prix coûtant. Les Travaux sont exécutés conformément au code du bâtiment applicable et aux règlements municipaux. Le Client est responsable d'obtenir toute approbation requise d'un syndicat de copropriété, d'un propriétaire ou d'une association de propriétaires.`,
  },
  materials: (v: ContractVariables): L => ({
    en: `The Contractor will supply new materials of the quality described in Section 2 and perform the Work in a good and workmanlike manner. The Contractor warrants its workmanship for **${v.warrantyMonths} months** from substantial completion and will correct defective workmanship reported in writing during that period at no charge. Manufacturers' warranties on materials, fixtures and equipment are passed on to the Customer. This warranty does not cover normal wear, damage caused by others, misuse, lack of maintenance, or materials supplied by the Customer.`,
    fr: `L'Entrepreneur fournit des matériaux neufs de la qualité décrite à l'article 2 et exécute les Travaux selon les règles de l'art. L'Entrepreneur garantit la qualité de son exécution pendant **${v.warrantyMonths} mois** à compter de la fin substantielle des Travaux et corrigera sans frais tout vice d'exécution signalé par écrit pendant cette période. Les garanties des fabricants sur les matériaux, appareils et équipements sont transférées au Client. La présente garantie ne couvre pas l'usure normale, les dommages causés par des tiers, le mauvais usage, le défaut d'entretien ni les matériaux fournis par le Client. Les garanties légales prévues par le Code civil du Québec et la Loi sur la protection du consommateur, lorsqu'elles s'appliquent, demeurent en vigueur.`,
  }),
  site: {
    en: `The Customer will give the Contractor reasonable access to the site during working hours, provide water and electricity, and remove or protect personal property in the work area. If the Contractor discovers conditions that could not reasonably have been anticipated (including hidden damage, asbestos, mould, structural deficiencies, or non-compliant existing work), the Contractor will notify the Customer, and any additional work will be handled as a change order under Section 6. The Contractor will keep the site reasonably clean and remove construction debris at completion.`,
    fr: `Le Client donne à l'Entrepreneur un accès raisonnable au chantier pendant les heures de travail, fournit l'eau et l'électricité et retire ou protège ses biens dans la zone des travaux. Si l'Entrepreneur découvre des conditions qui ne pouvaient raisonnablement être prévues (notamment des dommages cachés, de l'amiante, de la moisissure, des déficiences structurales ou des ouvrages existants non conformes), il en avise le Client et tout travail additionnel est traité par avenant conformément à l'article 6. L'Entrepreneur maintient le chantier raisonnablement propre et enlève les débris de construction à la fin des Travaux.`,
  },
  insurance: (key: TemplateKey): L => {
    const wcb: Record<TemplateKey, L> = {
      ON: { en: "WSIB", fr: "la CSPAAT (WSIB)" },
      BC: { en: "WorkSafeBC", fr: "WorkSafeBC" },
      AB: { en: "the WCB-Alberta", fr: "la WCB-Alberta" },
      QC: { en: "the CNESST", fr: "la CNESST" },
      CA: { en: "the applicable provincial workers' compensation board", fr: "l'organisme provincial d'indemnisation des travailleurs applicable" },
    };
    return {
      en: `The Contractor maintains commercial general liability insurance of at least $2,000,000 per occurrence and is registered in good standing with ${wcb[key].en} (or covers its workers as required by law) and will provide proof on request. The Customer is responsible for insuring the property and its contents. Neither party is liable to the other for indirect or consequential losses.`,
      fr: `L'Entrepreneur maintient une assurance responsabilité civile générale d'au moins 2 000 000 $ par sinistre, est inscrit en règle auprès de ${wcb[key].fr} (ou couvre ses travailleurs comme l'exige la loi) et en fournira la preuve sur demande. Le Client est responsable d'assurer l'immeuble et son contenu. Aucune partie n'est responsable envers l'autre des pertes indirectes ou consécutives.`,
    };
  },
  holdback: (key: TemplateKey, v: ContractVariables): L => {
    const pct = v.paymentSchedule.holdback.percent;
    const on = v.paymentSchedule.holdback.enabled;
    const texts: Record<TemplateKey, L> = {
      ON: {
        en: on
          ? `In accordance with the *Construction Act* (Ontario), the Customer will retain a holdback of ${pct}% of the value of the Work from each payment. The holdback becomes payable 60 days after publication of the certificate of substantial performance (or completion of the Work if no certificate is published), provided no liens have been preserved. The Contractor's rights under the *Construction Act*, including the right to register a lien, are not waived by this Agreement.`
          : `The parties have agreed that no holdback will be deducted from progress payments. The Contractor's rights under the *Construction Act* (Ontario), including the right to register a lien for unpaid amounts, are not waived by this Agreement.`,
        fr: on
          ? `Conformément à la *Loi sur la construction* (Ontario), le Client retient ${pct} % de la valeur des Travaux sur chaque paiement. La retenue devient exigible 60 jours après la publication du certificat d'exécution substantielle (ou l'achèvement des Travaux si aucun certificat n'est publié), à condition qu'aucun privilège n'ait été conservé. Les droits de l'Entrepreneur en vertu de la *Loi sur la construction*, y compris le droit d'enregistrer un privilège, ne sont pas abandonnés par le présent contrat.`
          : `Les parties conviennent qu'aucune retenue ne sera déduite des paiements progressifs. Les droits de l'Entrepreneur en vertu de la *Loi sur la construction* (Ontario), y compris le droit d'enregistrer un privilège pour les sommes impayées, ne sont pas abandonnés par le présent contrat.`,
      },
      BC: {
        en: on
          ? `In accordance with the *Builders Lien Act* (British Columbia), the Customer will retain a holdback of ${pct}% of the value of the Work from each payment, to be paid 55 days after the Work is completed or abandoned, provided no claims of lien have been filed. The Contractor's lien rights under the Act are not waived by this Agreement.`
          : `The parties have agreed that no holdback will be deducted from progress payments. The Contractor's rights under the *Builders Lien Act* (British Columbia), including the right to file a claim of lien for unpaid amounts, are not waived by this Agreement.`,
        fr: on
          ? `Conformément à la *Builders Lien Act* (Colombie-Britannique), le Client retient ${pct} % de la valeur des Travaux sur chaque paiement; la retenue est payable 55 jours après l'achèvement ou l'abandon des Travaux, à condition qu'aucune réclamation de privilège n'ait été déposée. Les droits de privilège de l'Entrepreneur en vertu de cette loi ne sont pas abandonnés par le présent contrat.`
          : `Les parties conviennent qu'aucune retenue ne sera déduite des paiements progressifs. Les droits de l'Entrepreneur en vertu de la *Builders Lien Act* (Colombie-Britannique), y compris le droit de déposer une réclamation de privilège pour les sommes impayées, ne sont pas abandonnés par le présent contrat.`,
      },
      AB: {
        en: on
          ? `In accordance with the *Prompt Payment and Construction Lien Act* (Alberta), the Customer will retain a holdback of ${pct}% of the value of the Work from each payment, released after the applicable lien period has expired without any lien being registered. Invoices are proper invoices under the Act and are payable within 28 days unless disputed in writing within 14 days. The Contractor's lien rights are not waived by this Agreement.`
          : `The parties have agreed that no holdback will be deducted from progress payments. Invoices are proper invoices under the *Prompt Payment and Construction Lien Act* (Alberta) and are payable within 28 days unless disputed in writing within 14 days. The Contractor's lien rights are not waived by this Agreement.`,
        fr: on
          ? `Conformément à la *Prompt Payment and Construction Lien Act* (Alberta), le Client retient ${pct} % de la valeur des Travaux sur chaque paiement; la retenue est libérée à l'expiration du délai de privilège applicable sans qu'aucun privilège n'ait été enregistré. Les factures constituent des factures conformes au sens de la loi et sont payables dans les 28 jours, sauf contestation écrite dans les 14 jours. Les droits de privilège de l'Entrepreneur ne sont pas abandonnés par le présent contrat.`
          : `Les parties conviennent qu'aucune retenue ne sera déduite des paiements progressifs. Les factures constituent des factures conformes au sens de la *Prompt Payment and Construction Lien Act* (Alberta) et sont payables dans les 28 jours, sauf contestation écrite dans les 14 jours. Les droits de privilège de l'Entrepreneur ne sont pas abandonnés par le présent contrat.`,
      },
      QC: {
        en: on
          ? `The Customer will retain ${pct}% of the value of the Work from each payment, payable 35 days after the end of the Work provided no legal hypothec has been registered. The Contractor's rights under the *Civil Code of Québec*, including the legal hypothec of persons having taken part in the construction (arts. 2724 ff.), are not waived by this Agreement.`
          : `The parties have agreed that no holdback will be deducted from progress payments. The Contractor's rights under the *Civil Code of Québec*, including the legal hypothec of persons having taken part in the construction (arts. 2724 ff.), are not waived by this Agreement.`,
        fr: on
          ? `Le Client retient ${pct} % de la valeur des Travaux sur chaque paiement; la retenue est payable 35 jours après la fin des Travaux, à condition qu'aucune hypothèque légale n'ait été inscrite. Les droits de l'Entrepreneur en vertu du *Code civil du Québec*, y compris l'hypothèque légale des personnes ayant participé à la construction (art. 2724 et s.), ne sont pas abandonnés par le présent contrat.`
          : `Les parties conviennent qu'aucune retenue ne sera déduite des paiements progressifs. Les droits de l'Entrepreneur en vertu du *Code civil du Québec*, y compris l'hypothèque légale des personnes ayant participé à la construction (art. 2724 et s.), ne sont pas abandonnés par le présent contrat.`,
      },
      CA: {
        en: on
          ? `The Customer will retain a holdback of ${pct}% of the value of the Work from each payment, to be released in accordance with the construction lien legislation of ${provinceName(v.province, "en")} once the applicable lien period has expired without any lien being registered. The Contractor's lien rights under that legislation are not waived by this Agreement.`
          : `The parties have agreed that no holdback will be deducted from progress payments. The Contractor's rights under the construction lien legislation of ${provinceName(v.province, "en")} are not waived by this Agreement.`,
        fr: on
          ? `Le Client retient ${pct} % de la valeur des Travaux sur chaque paiement; la retenue est libérée conformément à la législation sur les privilèges de construction de ${provinceName(v.province, "fr")} une fois le délai de privilège applicable expiré sans qu'aucun privilège n'ait été enregistré. Les droits de privilège de l'Entrepreneur en vertu de cette législation ne sont pas abandonnés par le présent contrat.`
          : `Les parties conviennent qu'aucune retenue ne sera déduite des paiements progressifs. Les droits de l'Entrepreneur en vertu de la législation sur les privilèges de construction de ${provinceName(v.province, "fr")} ne sont pas abandonnés par le présent contrat.`,
      },
    };
    return texts[key];
  },
  consumer: (key: TemplateKey, v: ContractVariables): L => {
    // Cooling-off notices apply to agreements made away from the supplier's
    // place of business (typically at the customer's home). The notice is
    // included whenever the contractor marks the agreement as "direct".
    if (!v.directAgreement) {
      return {
        en: `This Agreement was not entered into at the Customer's residence or away from the Contractor's place of business. Nothing in this Agreement limits any right the Customer may have under the consumer protection legislation of ${provinceName(v.province, "en")}.`,
        fr: `Le présent contrat n'a pas été conclu à la résidence du Client ni ailleurs qu'à l'établissement de l'Entrepreneur. Aucune disposition du présent contrat ne limite les droits que le Client peut avoir en vertu de la législation sur la protection du consommateur de ${provinceName(v.province, "fr")}.`,
      };
    }
    const texts: Record<TemplateKey, L> = {
      ON: {
        en: `**Your rights under the Consumer Protection Act, 2002 (Ontario).** You may cancel this agreement at any time during the period that ends ten (10) days after the day you receive a written copy of the agreement. You do not need to give the Contractor a reason for cancelling. If the Contractor does not deliver the goods or services within 30 days of the date stated in the agreement, you may cancel within one year of the date the agreement was made. To cancel, you must give notice of cancellation to the Contractor at the address set out in this agreement by any means that allows you to prove the date on which you gave notice. If the agreement is cancelled, the Contractor has fifteen (15) days to refund any payment you have made and return to you all goods delivered under a trade-in arrangement (or refund an amount equal to the trade-in allowance).`,
        fr: `**Vos droits en vertu de la Loi de 2002 sur la protection du consommateur (Ontario).** Vous pouvez résilier la présente convention à tout moment au cours de la période qui se termine dix (10) jours après le jour où vous en recevez une copie écrite. Vous n'avez pas à donner de motif à l'Entrepreneur. Si l'Entrepreneur ne livre pas les marchandises ou ne fournit pas les services dans les 30 jours suivant la date indiquée dans la convention, vous pouvez la résilier dans l'année qui suit sa conclusion. Pour résilier, vous devez donner un avis de résiliation à l'Entrepreneur, à l'adresse indiquée dans la présente convention, par tout moyen vous permettant de prouver la date de l'avis. En cas de résiliation, l'Entrepreneur dispose de quinze (15) jours pour rembourser tout paiement que vous avez effectué.`,
      },
      BC: {
        en: `**Your rights under the Business Practices and Consumer Protection Act (British Columbia).** This is a direct sales contract. You may cancel this contract by giving written notice of cancellation to the Contractor within ten (10) days after you receive a copy of it. You do not need a reason to cancel. You may also cancel within one (1) year if the contract does not contain the information required by the Act, or if the services are not supplied within 30 days of the supply date stated in the contract. Notice of cancellation may be given by any method that provides proof of the date it was given. Within fifteen (15) days of receiving your notice, the Contractor must refund all money paid under the contract.`,
        fr: `**Vos droits en vertu de la Business Practices and Consumer Protection Act (Colombie-Britannique).** Le présent contrat est un contrat de vente directe. Vous pouvez l'annuler en donnant un avis écrit à l'Entrepreneur dans les dix (10) jours suivant la réception de votre copie. Aucun motif n'est requis. Vous pouvez aussi l'annuler dans un délai d'un (1) an si le contrat ne contient pas les renseignements exigés par la loi ou si les services ne sont pas fournis dans les 30 jours suivant la date indiquée. L'avis peut être donné par tout moyen permettant de prouver sa date. Dans les quinze (15) jours suivant la réception de l'avis, l'Entrepreneur doit rembourser toutes les sommes versées.`,
      },
      AB: {
        en: `**Your rights under the Consumer Protection Act (Alberta).** This is a direct sales contract. You may cancel this contract from the day you enter into it until ten (10) days after you receive a copy of it. You do not need a reason to cancel. You may also cancel within one (1) year if the Contractor does not hold the licence required by the Act, if the contract does not contain the information the Act requires, or if the services are not provided within 30 days of the date stated in the contract. Give your cancellation notice in writing to the Contractor at the address in this contract by a method that lets you prove the date it was sent. Within fifteen (15) days of cancellation the Contractor must refund all money paid.`,
        fr: `**Vos droits en vertu de la Consumer Protection Act (Alberta).** Le présent contrat est un contrat de vente directe. Vous pouvez l'annuler à compter du jour de sa conclusion jusqu'à dix (10) jours après la réception de votre copie, sans motif. Vous pouvez aussi l'annuler dans un délai d'un (1) an si l'Entrepreneur ne détient pas la licence exigée par la loi, si le contrat ne contient pas les renseignements requis ou si les services ne sont pas fournis dans les 30 jours suivant la date indiquée. Transmettez votre avis d'annulation par écrit à l'Entrepreneur, à l'adresse indiquée au contrat, par un moyen permettant d'en prouver la date d'envoi. Dans les quinze (15) jours suivant l'annulation, l'Entrepreneur doit rembourser toutes les sommes versées.`,
      },
      QC: {
        en: `**Your rights under the Consumer Protection Act (Québec).** Where this contract was made by an itinerant merchant (away from the Contractor's establishment), you may cancel it, without reason, within ten (10) days after you receive a copy of it, by sending a notice of cancellation to the Contractor at the address shown in this contract. This period is extended to one (1) year in the cases provided by the Act (for example if the Contractor does not hold the required permit or the contract does not contain the required information). The Contractor must, within fifteen (15) days of cancellation, refund all sums paid. The Contractor holds Régie du bâtiment du Québec licence no. **${v.contractor.licenceNumber || "________"}**.`,
        fr: `**Vos droits en vertu de la Loi sur la protection du consommateur (Québec).** Lorsque le présent contrat a été conclu par un commerçant itinérant (ailleurs qu'à l'établissement de l'Entrepreneur), vous pouvez le résoudre, sans motif, dans les dix (10) jours suivant celui où vous en recevez une copie, en transmettant un avis de résolution à l'Entrepreneur à l'adresse indiquée au contrat. Ce délai est porté à un (1) an dans les cas prévus par la Loi (par exemple si l'Entrepreneur ne détient pas le permis requis ou si le contrat ne contient pas les mentions obligatoires). L'Entrepreneur doit, dans les quinze (15) jours suivant la résolution, rembourser toutes les sommes versées. L'Entrepreneur est titulaire de la licence de la Régie du bâtiment du Québec n° **${v.contractor.licenceNumber || "________"}**.`,
      },
      CA: {
        en: `**Your cancellation rights.** This agreement was entered into away from the Contractor's place of business. Under the consumer protection legislation of ${provinceName(v.province, "en")}, you may cancel this agreement, without reason, within ten (10) days after you receive a copy of it by giving written notice to the Contractor at the address in this agreement by any method that lets you prove the date the notice was given. Longer cancellation periods may apply where the legislation so provides. Within fifteen (15) days of cancellation the Contractor will refund all money paid.`,
        fr: `**Votre droit de résolution.** Le présent contrat a été conclu ailleurs qu'à l'établissement de l'Entrepreneur. En vertu de la législation sur la protection du consommateur de ${provinceName(v.province, "fr")}, vous pouvez le résoudre, sans motif, dans les dix (10) jours suivant la réception de votre copie en donnant un avis écrit à l'Entrepreneur, à l'adresse indiquée au contrat, par tout moyen permettant de prouver la date de l'avis. Des délais plus longs peuvent s'appliquer lorsque la loi le prévoit. Dans les quinze (15) jours suivant la résolution, l'Entrepreneur rembourse toutes les sommes versées.`,
      },
    };
    return texts[key];
  },
  termination: {
    en: `Either party may terminate this Agreement by written notice if the other party materially breaches it and fails to remedy the breach within ten (10) days of written notice. If the Customer terminates for convenience or without cause, the Customer will pay for all Work performed and materials ordered up to the termination date, plus reasonable demobilization costs. On termination the Contractor will leave the site in a safe condition.`,
    fr: `Chaque partie peut résilier le présent contrat par avis écrit si l'autre partie commet un manquement important et n'y remédie pas dans les dix (10) jours suivant un avis écrit. Si le Client résilie sans motif, il paie les Travaux exécutés et les matériaux commandés jusqu'à la date de résiliation, plus les frais raisonnables de démobilisation. À la résiliation, l'Entrepreneur laisse le chantier dans un état sécuritaire.`,
  },
  disputes: (v: ContractVariables): L => ({
    en: `The parties will first try to resolve any dispute through good-faith discussion. If unresolved within 30 days, either party may refer the dispute to mediation before commencing court proceedings, except for lien or urgent injunctive matters. This Agreement is governed by the laws of ${provinceName(v.province, "en")} and the federal laws of Canada applicable therein, and the courts of ${provinceName(v.province, "en")} have jurisdiction.`,
    fr: `Les parties tentent d'abord de régler tout différend par discussion de bonne foi. À défaut de règlement dans les 30 jours, chaque partie peut soumettre le différend à la médiation avant d'entreprendre des procédures judiciaires, sauf pour les questions de privilège ou d'injonction urgente. Le présent contrat est régi par les lois de ${provinceName(v.province, "fr")} et les lois fédérales du Canada qui y sont applicables, et les tribunaux de ${provinceName(v.province, "fr")} sont compétents.`,
  }),
  general: (key: TemplateKey, v: ContractVariables): L => {
    const quebecLanguage: L =
      key === "QC" && v.englishRequestedInQuebec
        ? {
            en: `\n\n**Language.** The parties confirm that it is their express wish that this Agreement and all related documents be drawn up in English. *Les parties confirment leur volonté expresse que le présent contrat et tous les documents s'y rattachant soient rédigés en anglais.*`,
            fr: ``,
          }
        : { en: "", fr: "" };
    return {
      en: `This Agreement, including the quote it is based on (No. ${v.quoteNumber}) and any approved change orders, is the entire agreement between the parties and replaces all prior discussions. It may be amended only in writing. If any provision is unenforceable, the rest remains in effect. The Customer may not assign this Agreement without the Contractor's consent. Notices may be given by email to the addresses in Section 1.\n\n**Electronic signature.** The parties agree that this Agreement may be signed electronically and that electronic signatures, and copies of this Agreement, have the same legal effect as original handwritten signatures and paper documents, in accordance with applicable electronic commerce legislation.${quebecLanguage.en}`,
      fr: `Le présent contrat, y compris la soumission sur laquelle il repose (n° ${v.quoteNumber}) et tout avenant approuvé, constitue l'entente complète entre les parties et remplace toutes discussions antérieures. Il ne peut être modifié que par écrit. Si une disposition est inexécutoire, les autres demeurent en vigueur. Le Client ne peut céder le présent contrat sans le consentement de l'Entrepreneur. Les avis peuvent être transmis par courriel aux adresses indiquées à l'article 1.\n\n**Signature électronique.** Les parties conviennent que le présent contrat peut être signé électroniquement et que les signatures électroniques ainsi que les copies du contrat ont la même valeur juridique que les signatures manuscrites originales et les documents papier, conformément à la législation applicable sur le commerce électronique.`,
    };
  },
  signatures: {
    en: `By signing below, each party confirms that it has read and understood this Agreement, including the cancellation rights in Section 12, and agrees to be bound by it.`,
    fr: `En signant ci-dessous, chaque partie confirme avoir lu et compris le présent contrat, y compris le droit de résolution prévu à l'article 12, et accepte d'y être liée.`,
  },
};

// ── Fallbacks for AI-drafted sections ────────────────────────────────────────

export function fallbackScope(v: ContractVariables, lang: Lang): string {
  const intro = lang === "fr"
    ? `L'Entrepreneur exécutera les travaux suivants à l'adresse du chantier (${v.siteAddress}) conformément à la soumission n° ${v.quoteNumber} :`
    : `The Contractor will perform the following work at the site address (${v.siteAddress}) in accordance with Quote No. ${v.quoteNumber}:`;
  const lines = v.priceLines.map((l) => `- ${l.label}`).join("\n");
  const outro = lang === "fr"
    ? `Tout élément non expressément décrit ci-dessus est exclu du prix du contrat.`
    : `Anything not expressly described above is excluded from the Contract Price.`;
  return `${intro}\n\n${lines}\n\n${outro}`;
}

export function fallbackSchedule(v: ContractVariables, lang: Lang): string {
  const start = v.startDate
    ? new Date(v.startDate + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" })
    : null;
  if (lang === "fr") {
    return `Les Travaux débuteront ${start ? `le ${start}` : "à une date convenue par écrit entre les parties"}${v.estimatedDurationWeeks ? ` et devraient durer environ ${v.estimatedDurationWeeks} semaine(s)` : ""}, sous réserve de l'obtention des permis, de la livraison des matériaux et des conditions météorologiques. Les dates sont des estimations de bonne foi; l'Entrepreneur avisera le Client de tout retard important et l'échéancier sera prolongé en conséquence.`;
  }
  return `The Work will begin ${start ? `on ${start}` : "on a date agreed in writing between the parties"}${v.estimatedDurationWeeks ? ` and is expected to take approximately ${v.estimatedDurationWeeks} week(s)` : ""}, subject to permit approvals, material lead times and weather. Dates are good-faith estimates; the Contractor will notify the Customer of any significant delay and the schedule will be extended accordingly.`;
}

// ── Document assembly ────────────────────────────────────────────────────────

export function buildContractDocument(params: {
  templateKey: TemplateKey;
  language: Lang;
  variables: ContractVariables;
  scopeBody: string;
  scheduleBody: string;
}): ContractDocument {
  const { templateKey: key, language: lang, variables: v } = params;
  const h = (k: string) => pick(HEADINGS[k], lang);

  const sections: ContractSection[] = [
    { key: "parties", heading: h("parties"), body: "", kind: "data", editable: false },
    { key: "scope", heading: h("scope"), body: params.scopeBody, kind: "ai", editable: true },
    { key: "price", heading: h("price"), body: pick(CLAUSES.price(v, lang), lang), kind: "data", editable: false },
    { key: "payment", heading: h("payment"), body: pick(CLAUSES.payment(v, lang), lang), kind: "data", editable: false },
    { key: "schedule", heading: h("schedule"), body: params.scheduleBody, kind: "ai", editable: true },
    { key: "changes", heading: h("changes"), body: pick(CLAUSES.changes, lang), kind: "legal", editable: false },
    { key: "permits", heading: h("permits"), body: pick(CLAUSES.permits, lang), kind: "legal", editable: false },
    { key: "materials", heading: h("materials"), body: pick(CLAUSES.materials(v), lang), kind: "legal", editable: false },
    { key: "site", heading: h("site"), body: pick(CLAUSES.site, lang), kind: "legal", editable: false },
    { key: "insurance", heading: h("insurance"), body: pick(CLAUSES.insurance(key), lang), kind: "legal", editable: false },
    { key: "holdback", heading: h("holdback"), body: pick(CLAUSES.holdback(key, v), lang), kind: "legal", editable: false },
    { key: "consumer", heading: h("consumer"), body: pick(CLAUSES.consumer(key, v), lang), kind: "legal", editable: false },
    { key: "termination", heading: h("termination"), body: pick(CLAUSES.termination, lang), kind: "legal", editable: false },
    { key: "disputes", heading: h("disputes"), body: pick(CLAUSES.disputes(v), lang), kind: "legal", editable: false },
    { key: "general", heading: h("general"), body: pick(CLAUSES.general(key, v), lang), kind: "legal", editable: false },
    { key: "signatures", heading: h("signatures"), body: pick(CLAUSES.signatures, lang), kind: "data", editable: false },
  ];

  return {
    templateKey: key,
    templateVersion: TEMPLATE_VERSION,
    language: lang,
    title: pick(TITLE, lang),
    sections,
  };
}

/**
 * Re-renders every non-editable section from the current variables while
 * keeping the AI/editable bodies the user may have changed. Used after the
 * contractor edits variables (start date, holdback, direct agreement…).
 */
export function refreshLockedSections(doc: ContractDocument, variables: ContractVariables): ContractDocument {
  const key = doc.templateKey as TemplateKey;
  const lang = doc.language;
  const scope = doc.sections.find((s) => s.key === "scope")?.body ?? fallbackScope(variables, lang);
  const schedule = doc.sections.find((s) => s.key === "schedule")?.body ?? fallbackSchedule(variables, lang);
  return buildContractDocument({ templateKey: key, language: lang, variables, scopeBody: scope, scheduleBody: schedule });
}
