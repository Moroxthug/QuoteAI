// Clients.dc.html, Client.dc.html and their FR boards. The boards show sample people; the sentences that name
// real figures take them as values. French follows the boards (// owner = mine, to review).
export const en = {
  title: "Clients",
  add: "Add client",
  more: "More actions",
  glance: "Clients at a glance",
  kpi: { active: "Active", lifetime: "Lifetime value", owed: "Owed", jobsRunning_one: "{{count}} job running", jobsRunning_other: "{{count}} jobs running", thisYear: "↑ {{pct}}% this year", lastYear: "↓ {{pct}}% this year", overdue_one: "{{count}} overdue", overdue_other: "{{count}} overdue" },
  owedToYou: "Owed to you",
  topClients: "Top clients",
  nudge: "Nudge",
  nudged: "Nudged",
  searchLabel: "Search clients",
  searchPlaceholder: "Search by name, phone or area",
  filter: "Filter",
  filters: { all: "All", active: "Active", prospect: "Prospects" },
  count_one: "{{count}} client",
  count_other: "{{count}} clients",
  recent: "Recent activity first",
  status: { active: "Active", prospect: "Prospect" },
  noJobs: "No jobs yet",
  meta: { quotes_one: "{{count}} quote", quotes_other: "{{count}} quotes" },
  activity: {
    quote_drafted: "Quote drafted {{when}}",
    quote_sent: "Quote sent {{when}}",
    quote_viewed: "Viewed a quote {{when}}",
    quote_accepted: "Accepted a quote {{when}}",
    quote_declined: "Declined a quote {{when}}",
    invoice_sent: "Invoice sent {{when}}",
    invoice_reminded: "Reminder sent {{when}}",
    invoice_paid: "Paid an invoice {{when}}",
    job_started: "Job booked {{when}}",
    none: "Nothing yet",
  },
  contact: { call: "Call", text: "Text", email: "Email", map: "Map" },
  stats: { lifetime: "Lifetime", owed: "Owed", quotes: "Quotes" },
  open: "Open client",
  newQuote: "New quote",
  empty: { title: "No clients match", body: "Try another name or number, or clear the filter.", clear: "Clear search" },
  none: { title: "No clients yet", body: "Clients are added when you write a quote, or here.", action: "Add client" },
  loadFailed: { title: "Couldn’t load your clients", body: "Check your connection and try again.", retry: "Try again" },
  offline: "You’re offline. Showing the last clients this phone saw.",
  addSheet: {
    title: "New client",
    name: "Full name", namePlaceholder: "e.g. Jordan Leblanc", phone: "Phone", email: "Email", optional: "Optional", address: "Site address", addressPlaceholder: "Street, city",
    save: "Add client", saving: "Adding…", done: "Client added", failed: "Couldn’t add the client. Try again.", close: "Close",
  },
  detail: {
    back: "Back",
    more: "More actions",
    since: "Client since {{date}}",
    notFound: { title: "Client not found", body: "They may have been removed." },
    stats: { won: "Quotes won", wonOf: "{{won}} of {{of}}", rate: "{{pct}}% win rate", noRate: "Nothing sent yet", total: "Total value", since: "Since {{date}}", owed: "Owed", late_one: "{{count}} day overdue", late_other: "{{count}} days overdue", none: "All paid", jobs: "Jobs", running_one: "{{count}} running", running_other: "{{count}} running", noJobs: "None yet", done: "{{pct}}% done" },
    banner_other: "{{number}} is {{count}} days overdue.", banner_one: "{{number}} is {{count}} day overdue.", bannerAmount: "{{amount}} owed on it.",
    remind: "Send reminder", reminded: "Reminder sent", remindFailed: "Couldn’t send the reminder. Try again.",
    details: "Details", edit: "Edit",
    rows: { address: "Address", phone: "Phone", email: "Email", language: "Language", business: "Business number", notes: "Notes", none: "None" },
    language: { en: "English", fr: "French" },
    tabs: { quotes: "Quotes", jobs: "Jobs", invoices: "Invoices", messages: "Messages" },
    tabsLabel: "Client records",
    noQuotes: "No quotes yet", noJobs: "No jobs yet", noInvoices: "No invoices yet", noMessages: "No messages yet",
    progress: "Progress", jobValue: "Job value",
    invoiceStatus: { draft: "Draft", sent: "Sent", viewed: "Viewed", partially_paid: "Partly paid", paid: "Paid", late: "Overdue", pending_confirmation: "To confirm", void: "Void" },
    invoiced: "Invoiced", owedLabel: "Owed",
    when: { accepted: "Accepted {{date}}", declined: "Declined {{date}}", sent: "Sent {{date}}", drafted: "Drafted {{date}}", expired: "Expired {{date}}", due: "Due {{date}}", paid: "Paid {{date}}", overdue_other: "Due {{date}} · {{count}} days overdue", overdue_one: "Due {{date}} · {{count}} day overdue" },
    jobDates: "{{from}} to {{to}}",
    jobOnTrack: "On track", jobDone: "Done", jobPlanning: "Planning", jobPaused: "Paused",
    messagePlaceholder: "Message {{name}}",
    messageLabel: "Message {{name}}",
    send: "Send message",
    sendFailed: "Couldn’t send the message. Try again.",
    you: "You",
    portal: { title: "Client portal", sub: "Quotes, invoices, photos and schedule", opened: "Opened {{when}}", notOpened: "Not opened yet", copy: "Copy link", copied: "Link copied", invite: "Invite {{name}}", invited: "Invite sent", noEmail: "Add an email address to invite them.", last: "{{name}} last opened it {{when}}.", never: "{{name}} hasn’t opened it yet." },
    newQuoteFor: "New quote for {{name}}",
    editTitle: "Edit details",
    fields: { name: "Name", email: "Email", phone: "Phone", address: "Address", city: "City", province: "Province", postalCode: "Postal code", notes: "Notes" },
    save: "Save", saving: "Saving…", saved: "Saved", saveFailed: "Couldn’t save. Try again.", invalidEmail: "That email address doesn’t look right.",
    loadFailed: { title: "Couldn’t load this client", body: "Check your connection and try again.", retry: "Try again" },
  },
};

export const fr: typeof en = {
  title: "Clients",
  add: "Ajouter un client", // owner
  more: "Plus d’actions",
  glance: "Clients en un coup d’œil", // owner
  kpi: { active: "Actifs", lifetime: "Valeur totale", owed: "À recevoir", jobsRunning_one: "{{count}} chantier en cours", jobsRunning_other: "{{count}} chantiers en cours", thisYear: "↑ {{pct}} % cette année", lastYear: "↓ {{pct}} % cette année", overdue_one: "{{count}} en retard", overdue_other: "{{count}} en retard" },
  owedToYou: "À recevoir", // owner
  topClients: "Meilleurs clients", // owner
  nudge: "Relancer", // owner
  nudged: "Relancé", // owner
  searchLabel: "Rechercher des clients",
  searchPlaceholder: "Nom, téléphone ou secteur", // owner
  filter: "Filtrer",
  filters: { all: "Tous", active: "Actifs", prospect: "Prospects" },
  count_one: "{{count}} client",
  count_other: "{{count}} clients",
  recent: "Activité récente en premier",
  status: { active: "Actif", prospect: "Prospect" },
  noJobs: "Aucun chantier",
  meta: { quotes_one: "{{count}} soumission", quotes_other: "{{count}} soumissions" },
  activity: {
    quote_drafted: "Soumission rédigée {{when}}",
    quote_sent: "Soumission envoyée {{when}}",
    quote_viewed: "A consulté une soumission {{when}}",
    quote_accepted: "A accepté une soumission {{when}}", // owner
    quote_declined: "A refusé une soumission {{when}}",
    invoice_sent: "Facture envoyée {{when}}", // owner
    invoice_reminded: "Rappel envoyé {{when}}", // owner
    invoice_paid: "A payé une facture {{when}}", // owner
    job_started: "Chantier réservé {{when}}",
    none: "Rien pour l’instant", // owner
  },
  contact: { call: "Appeler", text: "Texto", email: "Courriel", map: "Carte" },
  stats: { lifetime: "Valeur", owed: "Dû", quotes: "Soumissions" }, // owner
  open: "Ouvrir le client", // owner
  newQuote: "Nouvelle soumission",
  empty: { title: "Aucun client trouvé", body: "Essayez un autre nom ou numéro, ou retirez le filtre.", clear: "Effacer la recherche" }, // owner: body
  none: { title: "Aucun client pour l’instant", body: "Les clients s’ajoutent quand vous rédigez une soumission, ou ici.", action: "Ajouter un client" }, // owner
  loadFailed: { title: "Impossible de charger vos clients", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  offline: "Hors ligne. Les derniers clients vus sur ce téléphone s’affichent.", // owner
  addSheet: {
    title: "Nouveau client",
    name: "Nom complet", namePlaceholder: "ex. Jordan Leblanc", phone: "Téléphone", email: "Courriel", optional: "Facultatif", address: "Adresse du chantier", addressPlaceholder: "Rue, ville",
    save: "Ajouter le client", saving: "Ajout…", done: "Client ajouté", failed: "Impossible d’ajouter le client. Réessayez.", close: "Fermer", // owner
  },
  detail: {
    back: "Retour",
    more: "Plus d’actions",
    since: "Client depuis {{date}}",
    notFound: { title: "Client introuvable", body: "Il a peut-être été retiré." }, // owner
    stats: { won: "Soumissions gagnées", wonOf: "{{won}} sur {{of}}", rate: "{{pct}} % de réussite", noRate: "Rien d’envoyé", total: "Valeur totale", since: "Depuis {{date}}", owed: "Dû", late_one: "{{count}} jour de retard", late_other: "{{count}} jours de retard", none: "Tout est payé", jobs: "Chantiers", running_one: "{{count}} en cours", running_other: "{{count}} en cours", noJobs: "Aucun", done: "{{pct}} % terminé" },
    banner_other: "{{number}} a {{count}} jours de retard.", banner_one: "{{number}} a {{count}} jour de retard.", bannerAmount: "{{amount}} à recevoir.",
    remind: "Envoyer un rappel", reminded: "Rappel envoyé", remindFailed: "Impossible d’envoyer le rappel. Réessayez.", // owner
    details: "Détails", edit: "Modifier",
    rows: { address: "Adresse", phone: "Téléphone", email: "Courriel", language: "Langue", business: "Numéro d’entreprise", notes: "Notes", none: "Aucun" },
    language: { en: "Anglais", fr: "Français" },
    tabs: { quotes: "Soumissions", jobs: "Chantiers", invoices: "Factures", messages: "Messages" },
    tabsLabel: "Dossiers du client", // owner
    noQuotes: "Aucune soumission", noJobs: "Aucun chantier", noInvoices: "Aucune facture", noMessages: "Aucun message", // owner
    progress: "Avancement", jobValue: "Valeur du chantier", // owner
    invoiceStatus: { draft: "Brouillon", sent: "Envoyée", viewed: "Consultée", partially_paid: "Payée en partie", paid: "Payée", late: "En retard", pending_confirmation: "À confirmer", void: "Annulée" },
    invoiced: "Facturé", owedLabel: "Dû", // owner
    when: { accepted: "Acceptée le {{date}}", declined: "Refusée le {{date}}", sent: "Envoyée le {{date}}", drafted: "Rédigée le {{date}}", expired: "Expirée le {{date}}", due: "Échéance le {{date}}", paid: "Payée le {{date}}", overdue_other: "Échue le {{date}} · {{count}} jours de retard", overdue_one: "Échue le {{date}} · {{count}} jour de retard" },
    jobDates: "{{from}} au {{to}}",
    jobOnTrack: "Dans les temps", jobDone: "Terminé", jobPlanning: "En préparation", jobPaused: "En pause", // owner
    messagePlaceholder: "Message à {{name}}", // owner
    messageLabel: "Message à {{name}}",
    send: "Envoyer le message", // owner
    sendFailed: "Impossible d’envoyer le message. Réessayez.", // owner
    you: "Vous",
    portal: { title: "Portail client", sub: "Soumissions, factures, photos et horaire", opened: "Ouvert {{when}}", notOpened: "Pas encore ouvert", copy: "Copier le lien", copied: "Lien copié", invite: "Inviter {{name}}", invited: "Invitation envoyée", noEmail: "Ajoutez un courriel pour l’inviter.", last: "{{name}} l’a ouvert {{when}}.", never: "{{name}} ne l’a pas encore ouvert." }, // owner
    newQuoteFor: "Nouvelle soumission pour {{name}}",
    editTitle: "Modifier les détails", // owner
    fields: { name: "Nom", email: "Courriel", phone: "Téléphone", address: "Adresse", city: "Ville", province: "Province", postalCode: "Code postal", notes: "Notes" },
    save: "Enregistrer", saving: "Enregistrement…", saved: "Enregistré", saveFailed: "Impossible d’enregistrer. Réessayez.", invalidEmail: "Cette adresse courriel semble incorrecte.", // owner
    loadFailed: { title: "Impossible de charger ce client", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  },
};
