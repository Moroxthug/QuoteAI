// SetPlan (SetPlan.dc.html and SetPlanFR). French follows the board; the rest is my own wording, to review. Plans are never bought in the app.
export const en = {
  back: "Back", title: "Plan and billing", yourPlan: "Your plan", usage: "Usage this month", of: "of", billing: "Billing",
  loadFailed: { title: "Couldn’t load your plan", body: "Check your connection and try again.", retry: "Try again" },
  member: { lead: "Usage only.", body: "Your role can see how much of the plan is used." },
  covered: { lead: "Paid by another company.", body: "Your plan is covered by your group’s main company." },
  state: { active: "Active", none: "No plan", ended: "Not active" },
  renews: "Renews", ends: "Plan ends", logins: "Logins", loginsOf: "{{used}} of {{limit}}",
  meters: {
    logins: "Logins", quotes: "Quotes", openJobs: "Active jobs", scans: "Receipt scans", texts: "Texts",
    resets: "Resets {{date}}", almost: "Almost used · resets {{date}}", full: "All used · resets {{date}}", jobsFull: "Finish one to start another", jobsNear: "Almost at the limit",
    loginsSub_one: "{{count}} login in use", loginsSub_other: "{{count}} logins in use", loginsFull: "Every login is in use",
  },
  included: "Included in {{plan}}", on: "On {{plan}}",
  row: {
    unlimited: "Unlimited quotes and jobs", quotes: "{{count}} quotes a month", jobs: "{{count}} active jobs", contracts: "Contracts and e-signature", costs: "Costs and invoicing",
    teamTime: "Team time and crew links", assistant: "Assistant", analytics: "Analytics", books: "QuickBooks and Wave sync", calendar: "Calendar sync", cards: "Card payments", gmail: "Send from Gmail",
    logins: "{{count}} logins",
  },
  tier: { pro: "Pro", business: "Business" },
  bill: { method: "Payment method", methodSub: "On file at quoteai.ca", receipts: "Receipts", receiptsSub: "Emailed to {{email}}", monthly: "Monthly", yearly: "Yearly" },
  web: { title: "Plans and billing are managed on quoteai.ca", sub: "Plans can’t be changed in the app.", subMember: "Only the owner can manage the plan and billing.", open: "Open quoteai.ca" },
  toast: { offline: "You’re offline. Try again when you’re back online.", failed: "Couldn’t open quoteai.ca." },
};

export const fr: typeof en = {
  back: "Retour", title: "Forfait et facturation", yourPlan: "Votre forfait", usage: "Utilisation ce mois-ci", of: "sur", billing: "Facturation",
  loadFailed: { title: "Impossible de charger votre forfait", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
  member: { lead: "Utilisation seulement.", body: "Votre rôle permet de voir l’utilisation du forfait." },
  covered: { lead: "Payé par une autre entreprise.", body: "Votre forfait est couvert par l’entreprise principale de votre groupe." },
  state: { active: "Actif", none: "Aucun forfait", ended: "Inactif" },
  renews: "Renouvellement", ends: "Fin du forfait", logins: "Accès", loginsOf: "{{used}} sur {{limit}}",
  meters: {
    logins: "Accès", quotes: "Soumissions", openJobs: "Chantiers actifs", scans: "Reçus numérisés", texts: "Textos",
    resets: "Remise à zéro le {{date}}", almost: "Presque épuisé · remise à zéro le {{date}}", full: "Tout est utilisé · remise à zéro le {{date}}", jobsFull: "Terminez-en un pour en lancer un autre", jobsNear: "Près de la limite",
    loginsSub_one: "{{count}} accès utilisé", loginsSub_other: "{{count}} accès utilisés", loginsFull: "Tous les accès sont utilisés",
  },
  included: "Inclus avec {{plan}}", on: "Avec {{plan}}",
  row: {
    unlimited: "Soumissions et chantiers illimités", quotes: "{{count}} soumissions par mois", jobs: "{{count}} chantiers actifs", contracts: "Contrats et signature électronique", costs: "Coûts et facturation",
    teamTime: "Heures et liens d’équipe", assistant: "Assistant", analytics: "Analyses", books: "Synchro QuickBooks et Wave", calendar: "Synchro du calendrier", cards: "Paiement par carte", gmail: "Envoi depuis Gmail",
    logins: "{{count}} accès",
  },
  tier: { pro: "Pro", business: "Business" },
  bill: { method: "Mode de paiement", methodSub: "Enregistré sur quoteai.ca", receipts: "Reçus", receiptsSub: "Envoyés à {{email}}", monthly: "Mensuels", yearly: "Annuels" },
  web: { title: "Le forfait et la facturation se gèrent sur quoteai.ca", sub: "Le forfait ne peut pas être modifié dans l’app.", subMember: "Seul le propriétaire peut gérer le forfait et la facturation.", open: "Ouvrir quoteai.ca" },
  toast: { offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", failed: "Impossible d’ouvrir quoteai.ca." },
};
