// Notifications and Search (Notifications.dc.html, Search.dc.html and their FR boards). French follows the boards; (owner) = my own wording, to review.
export const en = {
  nt: {
    back: "Back", retry: "Try again", close: "Close", title: "Notifications", markAll: "Mark all read", filterLabel: "Filter", filter: { all: "All", unread: "Unread" }, today: "Today", earlier: "Earlier",
    unreadLabel: "Unread. {{title}}", action: { confirm: "Confirm", review: "Review hours", remind: "Send a reminder" },
    empty: { title: "You’re all caught up", body: "New quotes viewed, payments and crew updates show up here.", action: "See all" },
    loadFailed: { title: "Couldn’t load your notifications", body: "Check your connection and try again." },
    ask: {
      label: "Turn on notifications", title: "Know the moment they accept?", body: "We’ll tell you when a quote is viewed, signed or paid. You choose the rest in Settings.", on: "Turn on notifications", later: "Not now",
      app: "quoteAI", now: "now", sampleTitle: "Dana Whitfield accepted your quote", sampleBody: "Bedrooms and bath ceiling ·",
      denied: "Notifications are off for quoteAI. Turn them on in your phone’s settings.", unavailable: "This phone can’t show notifications from the app yet.",
    },
    toast: { failed: "Couldn’t mark them read.", openFailed: "Couldn’t open that." },
  },
  sr: {
    back: "Back", retry: "Try again", placeholder: "Quotes, clients, jobs, invoices", label: "Search everything", clear: "Clear search", cancel: "Cancel", typeLabel: "Type",
    types: { all: "All", quotes: "Quotes", clients: "Clients", jobs: "Jobs", invoices: "Invoices", pages: "Pages" },
    recentSearches: "Recent searches", clearRecent: "Clear", opened: "Recently opened", seeAll: "See all",
    kind: { quotes: "Quote", clients: "Client", jobs: "Job", invoices: "Invoice" },
    none: { title: "Nothing matches “{{q}}”", body: "Try a client name, an address, or a number like Q-2026-118.", action: "Clear search" },
    loadFailed: { title: "Couldn’t load everything to search", body: "Check your connection and try again." },
    partial: { lead: "Some of your lists didn’t load.", body: "Results may be missing." },
    quoteSub: "{{number}} · {{job}}", jobSub: "{{client}} · {{detail}}", jobProgress: "{{pct}}", jobFinished: "finished {{date}}", jobStarts: "starts {{date}}", jobWaiting: "waiting on the weather",
    invoiceOverdue_one: "{{count}} day overdue", invoiceOverdue_other: "{{count}} days overdue",
    quoteState: { draft: "Draft", sent: "Sent", viewed: "Viewed", expiring: "Expiring", accepted: "Accepted", declined: "Declined", expired: "Expired" },
    jobState: { setup: "Review setup", planning: "Planning", active: "Active", hold: "On hold", done: "Completed" },
    invState: { draft: "Draft", sent: "Sent", viewed: "Viewed", partially_paid: "Partly paid", pending_confirmation: "To confirm", paid: "Paid", void: "Void", overdue: "Overdue" },
    pages: {
      settings: { t: "Settings", s: "Language, appearance, notifications" }, notifications: { t: "Notifications", s: "{{count}} unread" }, notificationsNone: { t: "Notifications", s: "Nothing unread" },
      menu: { t: "Menu", s: "Profile, company, plan" }, team: { t: "Team", s: "People who sign in and field crew" }, priceBook: { t: "Price list", s: "Your items and rates" },
      compliance: { t: "Compliance", s: "Tax and licence deadlines" }, integrations: { t: "Connected apps", s: "QuickBooks, Google Calendar, Gmail" }, home: { t: "Home", s: "Today, money and the field" },
    },
  },
};

export const fr: typeof en = {
  nt: {
    back: "Retour", retry: "Réessayer", close: "Fermer", title: "Notifications", markAll: "Tout marquer lu", filterLabel: "Filtrer", filter: { all: "Toutes", unread: "Non lues" }, today: "Aujourd’hui", earlier: "Plus tôt",
    unreadLabel: "Non lue. {{title}}", action: { confirm: "Confirmer", review: "Voir les heures", remind: "Envoyer un rappel" },
    empty: { title: "Vous êtes à jour", body: "Les soumissions consultées, les paiements et les nouvelles de l’équipe s’affichent ici.", action: "Tout voir" },
    loadFailed: { title: "Impossible de charger vos notifications", body: "Vérifiez votre connexion et réessayez." },
    ask: {
      label: "Activer les notifications", title: "Savoir dès qu’ils acceptent ?", body: "Nous vous avertissons quand une soumission est consultée, signée ou payée. Le reste se choisit dans les réglages.", on: "Activer les notifications", later: "Plus tard",
      app: "quoteAI", now: "maintenant", sampleTitle: "Dana Whitfield a accepté votre soumission", sampleBody: "Chambres et plafond de salle de bain ·",
      denied: "Les notifications sont désactivées pour quoteAI. Activez-les dans les réglages de votre téléphone.", unavailable: "Ce téléphone ne peut pas encore afficher les notifications de l’app.",
    },
    toast: { failed: "Impossible de les marquer comme lues.", openFailed: "Impossible d’ouvrir ceci." },
  },
  sr: {
    back: "Retour", retry: "Réessayer", placeholder: "Soumissions, clients, chantiers, factures", label: "Tout rechercher", clear: "Effacer la recherche", cancel: "Annuler", typeLabel: "Type",
    types: { all: "Tout", quotes: "Soumissions", clients: "Clients", jobs: "Chantiers", invoices: "Factures", pages: "Pages" },
    recentSearches: "Recherches récentes", clearRecent: "Effacer", opened: "Ouverts récemment", seeAll: "Tout voir",
    kind: { quotes: "Soumission", clients: "Client", jobs: "Chantier", invoices: "Facture" },
    none: { title: "Aucun résultat pour « {{q}} »", body: "Essayez un nom de client, une adresse ou un numéro comme Q-2026-118.", action: "Effacer la recherche" },
    loadFailed: { title: "Impossible de tout charger pour la recherche", body: "Vérifiez votre connexion et réessayez." },
    partial: { lead: "Certaines listes n’ont pas pu se charger.", body: "Des résultats peuvent manquer." },
    quoteSub: "{{number}} · {{job}}", jobSub: "{{client}} · {{detail}}", jobProgress: "{{pct}}", jobFinished: "terminé le {{date}}", jobStarts: "débute le {{date}}", jobWaiting: "en attente de la météo",
    invoiceOverdue_one: "{{count}} jour de retard", invoiceOverdue_other: "{{count}} jours de retard",
    quoteState: { draft: "Brouillon", sent: "Envoyée", viewed: "Consultée", expiring: "Expire bientôt", accepted: "Acceptée", declined: "Refusée", expired: "Expirée" },
    jobState: { setup: "À valider", planning: "En planification", active: "Actif", hold: "En pause", done: "Terminé" },
    invState: { draft: "Brouillon", sent: "Envoyée", viewed: "Consultée", partially_paid: "Payée en partie", pending_confirmation: "À confirmer", paid: "Payée", void: "Annulée", overdue: "En retard" },
    pages: {
      settings: { t: "Réglages", s: "Langue, apparence, notifications" }, notifications: { t: "Notifications", s: "{{count}} non lues" }, notificationsNone: { t: "Notifications", s: "Rien de non lu" },
      menu: { t: "Menu", s: "Profil, entreprise, forfait" }, team: { t: "Équipe", s: "Utilisateurs et équipe de chantier" }, priceBook: { t: "Liste de prix", s: "Vos articles et tarifs" },
      compliance: { t: "Conformité", s: "Échéances fiscales et de licences" }, integrations: { t: "Applications connectées", s: "QuickBooks, Google Agenda, Gmail" }, home: { t: "Accueil", s: "Aujourd’hui, finances et chantiers" },
    },
  },
};
