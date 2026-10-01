// Quotes.dc.html / QuotesFR.dc.html. The board's Viewed and Declined need the server to record them
// and are not shown yet; Expired and "Expires ..." are worked out from the 30 days a quote is valid
// (lib/quotes.ts). Lines marked (new) are not on the board.
export const en = {
  title: "Quotes",
  newQuote: "New quote",
  more: "More actions",
  glance: "Quotes at a glance",
  kpi: { waiting: "Waiting", won: "Won this month", rate: "Win rate", quotes_one: "{{count}} quote", quotes_other: "{{count}} quotes", accepted_one: "{{count}} accepted", accepted_other: "{{count}} accepted", last90: "Last 90 days" },
  waitingLongest: "Waiting longest first",
  stats: { sent: "Sent in {{month}}", days: "Avg. days", expiring: "Expiring" },
  searchLabel: "Search quotes",
  searchPlaceholder: "Search by client or job",
  filter: "Filter",
  filters: { all: "All", draft: "Drafts", waiting: "Waiting", accepted: "Accepted", closed: "Closed" },
  groups: { week: "This week", earlier: "Earlier" },
  status: { draft: "Draft", sent: "Sent", expiring: "Expires {{day}}", accepted: "Accepted", expired: "Expired" },
  jobMeta: { today: "Today", sent: "Sent {{date}}", accepted: "Accepted {{date}}", expired: "Expired {{date}}", drafted: "Drafted {{date}}" },
  swipeHint: "Swipe a row left for quick actions",
  empty: { title: "No quotes match", body: "Try another name, or clear the filter to see every quote.", clear: "Clear search" },
  none: { title: "No quotes yet", body: "Describe a job and the quote is written for you.", action: "New quote" },
  detail: {
    drafted: "Drafted {{date}}", draftedSub: "Not sent yet", notSent: "Not sent",
    items_one: "{{count}} line item", items_other: "{{count}} line items", itemsSub: "Subtotal {{amount}}",
    valid: "Valid for 30 days", validSub: "Starts counting when you send it",
    sent: "Sent {{date}}", sentTo: "To {{email}}", sentBy: "By email",
    until: "Valid until {{date}}", left_one: "{{count}} day left", left_other: "{{count}} days left",
    expires: "Expires {{date}}",
    signed: "Signed by {{name}}", acceptedOn: "Accepted {{date}}",
    expiredOn: "Expired {{date}}", expiredSub: "No reply in 30 days",
    total: "Total {{amount}}", totalSub: "Tax included",
  },
  actions: { send: "Send", duplicate: "Duplicate", followUp: "Follow up", archive: "Archive", invoiceDeposit: "Invoice deposit", startJob: "Start job", renew: "Renew", openQuote: "Open quote" },
  done: { duplicated: "Duplicated as a draft", archived: "Archived", undo: "Undo", restored: "Restored", failed: "Couldn’t do that. Try again." },
  loadFailed: { title: "Couldn’t load your quotes", body: "Check your connection and try again.", retry: "Try again" },
  offline: "You’re offline. Showing the last quotes this phone saw.",
};

export const fr: typeof en = {
  title: "Soumissions",
  newQuote: "Nouvelle soumission",
  more: "Plus d’actions",
  glance: "Soumissions en un coup d’œil",
  kpi: { waiting: "En attente", won: "Gagné ce mois‑ci", rate: "Taux de réussite", quotes_one: "{{count}} soumission", quotes_other: "{{count}} soumissions", accepted_one: "{{count}} acceptée", accepted_other: "{{count}} acceptées", last90: "90 derniers jours" }, // owner: last90
  waitingLongest: "En attente depuis le plus longtemps",
  stats: { sent: "Envoyées en {{month}}", days: "Délai moyen", expiring: "À expirer" },
  searchLabel: "Chercher des soumissions",
  searchPlaceholder: "Client ou type de travaux",
  filter: "Filtrer",
  filters: { all: "Toutes", draft: "Brouillons", waiting: "En attente", accepted: "Acceptées", closed: "Fermées" },
  groups: { week: "Cette semaine", earlier: "Plus tôt" }, // owner
  status: { draft: "Brouillon", sent: "Envoyée", expiring: "Expire {{day}}", accepted: "Acceptée", expired: "Expirée" },
  jobMeta: { today: "Aujourd’hui", sent: "Envoyée le {{date}}", accepted: "Acceptée le {{date}}", expired: "Expirée le {{date}}", drafted: "Rédigée le {{date}}" },
  swipeHint: "Glissez une ligne vers la gauche pour les actions rapides",
  empty: { title: "Aucune soumission trouvée", body: "Essayez un autre nom, ou retirez le filtre pour voir toutes les soumissions.", clear: "Effacer la recherche" },
  none: { title: "Aucune soumission pour l’instant", body: "Décrivez un chantier et la soumission est rédigée pour vous.", action: "Nouvelle soumission" }, // owner
  detail: {
    drafted: "Rédigée le {{date}}", draftedSub: "Pas encore envoyée", notSent: "Non envoyée",
    items_one: "{{count}} ligne", items_other: "{{count}} lignes", itemsSub: "Sous-total {{amount}}",
    valid: "Valide 30 jours", validSub: "À compter de l’envoi",
    sent: "Envoyée le {{date}}", sentTo: "À {{email}}", sentBy: "Par courriel",
    until: "Valide jusqu’au {{date}}", left_one: "Encore {{count}} jour", left_other: "Encore {{count}} jours",
    expires: "Expire le {{date}}",
    signed: "Signée par {{name}}", acceptedOn: "Acceptée le {{date}}",
    expiredOn: "Expirée le {{date}}", expiredSub: "Aucune réponse en 30 jours", // owner
    total: "Total {{amount}}", totalSub: "Taxes comprises", // owner
  },
  actions: { send: "Envoyer", duplicate: "Dupliquer", followUp: "Relancer", archive: "Archiver", invoiceDeposit: "Facturer l’acompte", startJob: "Lancer les travaux", renew: "Renouveler", openQuote: "Ouvrir la soumission" }, // owner: openQuote
  done: { duplicated: "Dupliquée en brouillon", archived: "Archivée", undo: "Annuler", restored: "Rétablie", failed: "Impossible. Réessayez." }, // owner
  loadFailed: { title: "Impossible de charger vos soumissions", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  offline: "Hors ligne. Les dernières soumissions vues sur ce téléphone s’affichent.", // owner
};
