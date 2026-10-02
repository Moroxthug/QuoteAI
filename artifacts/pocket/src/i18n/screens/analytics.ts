// Analytics (Analytics.dc.html, AnalyticsFR). French follows the board; (owner) = my own wording, to review. (new) = not on the board.
export const en = {
  back: "Back", more: "More actions", retry: "Try again", title: "Analytics", heading: "How the business is doing", sub: "{{company}} · {{period}}",
  periods: { m: "Month", q: "Quarter", y: "Year", label: "Period" },
  label: { m: "{{month}} {{year}}", q: "Q{{q}} {{year}}, {{from}} to {{to}}", y: "{{year}} so far" },
  kpi: {
    invoiced: "Invoiced", collected: "Collected", costs: "Costs", margin: "Margin", owed: "Outstanding", toInvoice: "To invoice",
    up: "Up {{pct}}", down: "Down {{pct}}", upYear: "Up {{pct}} on this time last year", downYear: "Down {{pct}} on this time last year", same: "About the same",
    ofInvoiced: "{{pct}} of invoiced", costsSub: "Materials, labour, subs", kept: "{{amount}} kept", lost: "{{amount}} lost", overdue: "{{amount}} overdue", noneOverdue: "Nothing overdue", notBilled: "Not billed yet",
  },
  revenue: {
    title: "Revenue", by: { m: "By month", q: "By quarter", y: "By year" }, label: { m: "Invoiced in {{month}}", q: "Invoiced in Q{{q}}", y: "Invoiced in {{year}} so far" },
    up: "Up {{pct}} on {{prev}}", down: "Down {{pct}} on {{prev}}", prevYear: "this time last year", prevQuarter: "Q{{q}}", bestMonth: "Your best month this year.", bestQuarter: "Your best quarter so far.",
    aria: "Invoiced {{list}}", quarter: "Q{{q}}", none: "Nothing invoiced yet",
  },
  jobs: {
    title: "Jobs to look at", link: "All jobs",
    over_budget: "Over budget", budget_burn: "Budget", behind_schedule: "Behind", overdue_invoices: "Late", unbilled_completion: "To invoice", billing_gap: "To invoice",
    overPct: "{{pct}} of budget", overAmt: "{{amount}} over budget", burn: "{{pct}} of budget used", behind_one: "{{count}} day behind", behind_other: "{{count}} days behind", overdue: "{{amount}} overdue", unbilled: "{{amount}} not billed",
  },
  win: { title: "Win rate", link: "Quotes", of: "{{won}} won of {{decided}} quotes decided", none: "No quotes decided in this period" },
  avg: { title: "Average quote", upFrom: "Up from {{amount}} in {{label}}", downFrom: "Down from {{amount}} in {{label}}", none: "No quotes sent in this period", aria: "Average quote by month, from {{from}} to {{to}}" },
  cash: { title: "Quote to cash", label: "From sending a quote to money in the bank", days: "days", d: "{{n}} d", accept: "To accept", invoice: "To invoice", paid: "To get paid", aria: "{{a}} to accept, {{i}} to invoice, {{p}} to get paid" },
  clients: { title: "Top clients", link: "Clients", sub_one: "{{count}} invoice", sub_other: "{{count}} invoices", share: "{{pct}} of {{label}}", top: "Your top three bring in {{pct}} of the work." },
  leads: {
    title: "Where leads come from", link: "Leads", source: "Source", share: "Share of leads", won: "Won",
    sources: { widget: "Website form", manual: "Added by hand", import: "Imported", meta_lead_ads: "Facebook and Instagram", google_lsa: "Google" },
  },
  locked: {
    title: "Analytics comes with {{plan}}", body: "Revenue, win rate, margins and crew time, in one place. Your company is on {{current}}.",
    feats: { money: "Revenue, costs and margin by month", win: "Win rate and average quote", margin: "Margin by job type", crew: "Crew time and lead sources" },
    plans: "See plans on quoteai.ca", note: "Plans can’t be changed in the app.", soon: "Plan",
  },
  loading: "Loading analytics", loadFailed: { title: "Couldn’t load your analytics", body: "Check your connection and try again." },
  offline: { lead: "You’re offline.", body: "Showing the figures from your last visit." }, noAccess: "Your role can’t see the company’s figures.",
};

export const fr: typeof en = {
  back: "Retour", more: "Plus d’actions", retry: "Réessayer", title: "Analyses", heading: "La santé de l’entreprise", sub: "{{company}} · {{period}}",
  periods: { m: "Mois", q: "Trimestre", y: "Année", label: "Période" },
  label: { m: "{{month}} {{year}}", q: "T{{q}} {{year}}, {{from}} à {{to}}", y: "{{year}} à ce jour" },
  kpi: {
    invoiced: "Facturé", collected: "Encaissé", costs: "Coûts", margin: "Marge", owed: "À recevoir", toInvoice: "À facturer",
    up: "Hausse de {{pct}}", down: "Baisse de {{pct}}", upYear: "Hausse de {{pct}} sur l’an dernier à pareille date", downYear: "Baisse de {{pct}} sur l’an dernier à pareille date", same: "À peu près pareil",
    ofInvoiced: "{{pct}} du facturé", costsSub: "Matériaux, main-d’œuvre, sous-traitants", kept: "{{amount}} gardés", lost: "{{amount}} perdus", overdue: "{{amount}} en retard", noneOverdue: "Rien en retard", notBilled: "Pas encore facturé",
  },
  revenue: {
    title: "Revenus", by: { m: "Par mois", q: "Par trimestre", y: "Par année" }, label: { m: "Facturé en {{month}}", q: "Facturé au T{{q}}", y: "Facturé en {{year}} à ce jour" },
    up: "Hausse de {{pct}} sur {{prev}}", down: "Baisse de {{pct}} sur {{prev}}", prevYear: "l’an dernier à pareille date", prevQuarter: "le T{{q}}", bestMonth: "Votre meilleur mois de l’année.", bestQuarter: "Votre meilleur trimestre à ce jour.",
    aria: "Facturé {{list}}", quarter: "T{{q}}", none: "Rien de facturé pour l’instant",
  },
  jobs: {
    title: "Chantiers à surveiller", link: "Tous les chantiers",
    over_budget: "Hors budget", budget_burn: "Budget", behind_schedule: "En retard", overdue_invoices: "En retard", unbilled_completion: "À facturer", billing_gap: "À facturer",
    overPct: "{{pct}} du budget", overAmt: "{{amount}} au-dessus du budget", burn: "{{pct}} du budget utilisé", behind_one: "{{count}} jour de retard", behind_other: "{{count}} jours de retard", overdue: "{{amount}} en retard", unbilled: "{{amount}} non facturés",
  },
  win: { title: "Taux de réussite", link: "Soumissions", of: "{{won}} gagnées sur {{decided}} soumissions tranchées", none: "Aucune soumission tranchée pour cette période" },
  avg: { title: "Soumission moyenne", upFrom: "Contre {{amount}} en {{label}}", downFrom: "Contre {{amount}} en {{label}}", none: "Aucune soumission envoyée pour cette période", aria: "Soumission moyenne par mois, de {{from}} à {{to}}" },
  cash: { title: "De la soumission au paiement", label: "De l’envoi de la soumission à l’argent en banque", days: "jours", d: "{{n}} j", accept: "Acceptation", invoice: "Facturation", paid: "Paiement", aria: "{{a}} pour l’acceptation, {{i}} pour la facturation, {{p}} pour le paiement" },
  clients: { title: "Meilleurs clients", link: "Clients", sub_one: "{{count}} facture", sub_other: "{{count}} factures", share: "{{pct}} de {{label}}", top: "Vos trois premiers clients représentent {{pct}} du travail." },
  leads: {
    title: "D’où viennent les demandes", link: "Demandes", source: "Source", share: "Part des demandes", won: "Gagnées",
    sources: { widget: "Formulaire Web", manual: "Ajoutées à la main", import: "Importées", meta_lead_ads: "Facebook et Instagram", google_lsa: "Google" },
  },
  locked: {
    title: "Les analyses viennent avec {{plan}}", body: "Revenus, taux de réussite, marges et heures de l’équipe, au même endroit. Votre entreprise est sur {{current}}.",
    feats: { money: "Revenus, coûts et marge par mois", win: "Taux de réussite et soumission moyenne", margin: "Marge par type de chantier", crew: "Heures de l’équipe et sources des demandes" },
    plans: "Voir les forfaits sur quoteai.ca", note: "Impossible de changer de forfait dans l’app.", soon: "Forfait",
  },
  loading: "Chargement des analyses", loadFailed: { title: "Impossible de charger vos analyses", body: "Vérifiez votre connexion et réessayez." },
  offline: { lead: "Vous êtes hors ligne.", body: "Voici les chiffres de votre dernière visite." }, noAccess: "Votre rôle ne peut pas voir les chiffres de l’entreprise.",
};
