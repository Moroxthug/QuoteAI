// SmartHome.dc.html / SmartHomeFR.dc.html. Lines marked (new) are not on the board: the board shows
// sample data, so the sentences that name real figures are written to take them; the French follows
// the board's wording (// owner = mine, to review).
export const en = {
  greeting: { morning: "Good morning, {{name}}", afternoon: "Good afternoon, {{name}}", evening: "Good evening, {{name}}" },
  greetingNoName: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
  quickAdd: "Quick add",
  openMenu: "Open menu",
  notifications: "Notifications",
  bar: {
    pillLabel: "Start a quote. Describe the job.",
    placeholder: "Describe a job to quote…",
    describeLabel: "Describe the job",
    describePlaceholder: "Describe the job the way you’d say it on site",
    collapse: "Collapse",
    client: "Client",
    clientSet: "Client: {{name}}",
    budget: "Budget",
    budgetSet: "Budget: {{amount}}",
    photos: "Add photos",
    dictate: "Dictate",
    stopDictation: "Stop dictation",
    build: "Build the quote",
    searchClients: "Search clients",
    newClient: "New client",
    existing: "Existing clients",
    fullName: "Full name",
    namePlaceholder: "e.g. Jordan Leblanc",
    phone: "Phone",
    email: "Email",
    optional: "Optional",
    address: "Site address",
    addressPlaceholder: "Street, city",
    addClient: "Add client",
    budgetLabel: "Budget, tax included",
    budgetHint: "Tax included. The quote is shaped to land near it.",
    noBudget: "No budget",
    setBudget: "Set budget",
    clientToConfirm: "Client to confirm",
    totalIncl: "Total incl. {{tax}}",
    tax: "tax",
    fitting: "Fitting to your {{budget}} budget",
    within: "Within your {{budget}} budget · {{diff}} under",
    over: "Over budget by {{diff}}",
    review: "Review and send",
    edit: "Edit",
    problem: {
      offline: "You’re offline. Your description is kept: try again when you have signal.",
      quota: "You’ve used this month’s quotes. More are on quoteai.ca.",
      cannot: "That wasn’t enough to price. Add what, where and how big.",
      unlock: "This quote needs your plan to be active. Check it on quoteai.ca.",
      failed: "Couldn’t write the quote. Try again.",
    },
  },
  needs: {
    title: "Needs you",
    hint: "Swipe for more",
    hintDone: "Done",
    allClear: "All caught up",
    allClearBody: "New things that need you show up here.",
    hours: { title: "Approve {{hours}} h", sub_one: "{{count}} time entry from {{people}} person", sub_other: "{{count}} time entries from {{people}} people", status: "Before payroll", button: "Approve", done: "Approved" },
    etransfer: { title: "Confirm {{amount}}", sub: "{{customer}} e-Transfer, matches {{number}}", status: "Check your bank", button: "Confirm", done: "Confirmed" },
    lead: { titleCall: "Call {{name}}", titleOpen: "Follow up {{name}}", sub: "Lead to answer today", status: "Due today", button: "Call", buttonOpen: "Open", done: "Called" },
    remind: { title: "Remind {{customer}}", sub: "{{number}} · {{amount}}", status_one: "{{count}} day late", status_other: "{{count}} days late", button: "Remind", done: "Reminded" },
    blocker: { title: "Answer {{who}}", titleNoName: "Answer the crew", status: "{{job}}", button: "Open", done: "Opened" },
    waiting: { titleCall: "Call {{name}}", titleOpen: "Follow up with {{name}}", sub: "{{job}} · {{amount}}", status_one: "Sent {{count}} day ago", status_other: "Sent {{count}} days ago", button: "Call", buttonOpen: "Open", done: "Done" },
    remindFailed: "Couldn’t send the reminder. Try again.",
  },
  weather: { rain: "rain after {{time}}", snow: "snow after {{time}}", storm: "storm after {{time}}" },
  edit: "Edit Home",
  quickTiles: {
    receipt: { label: "Receipt", sub: "Snap it, we file it" },
    photo: { label: "Site photo", sub: "Goes to the job" },
    clockIn: { label: "Clock in", sub: "You or the crew" },
    payment: { label: "Payment", sub: "Cash, cheque, e-Transfer" },
    lead: { label: "Lead", sub: "From a call or visit" },
    note: { label: "Voice note", sub: "Turned into tasks" },
  },
  loadFailed: "Couldn’t refresh Home. Showing what this phone last saw.",
};

export const fr: typeof en = {
  greeting: { morning: "Bonjour, {{name}}", afternoon: "Bon après-midi, {{name}}", evening: "Bonsoir, {{name}}" }, // owner: afternoon, evening
  greetingNoName: { morning: "Bonjour", afternoon: "Bon après-midi", evening: "Bonsoir" }, // owner
  quickAdd: "Ajout rapide",
  openMenu: "Ouvrir le menu",
  notifications: "Notifications",
  bar: {
    pillLabel: "Commencer une soumission. Décrivez les travaux.",
    placeholder: "Décrivez les travaux…",
    describeLabel: "Décrivez les travaux",
    describePlaceholder: "Décrivez les travaux comme vous le diriez sur le chantier",
    collapse: "Réduire",
    client: "Client",
    clientSet: "Client : {{name}}",
    budget: "Budget",
    budgetSet: "Budget : {{amount}}",
    photos: "Ajouter des photos",
    dictate: "Dicter",
    stopDictation: "Arrêter la dictée", // owner
    build: "Préparer la soumission",
    searchClients: "Rechercher un client",
    newClient: "Nouveau client",
    existing: "Clients existants",
    fullName: "Nom complet", // owner
    namePlaceholder: "ex. Jordan Leblanc",
    phone: "Téléphone", // owner
    email: "Courriel", // owner
    optional: "Facultatif",
    address: "Adresse du chantier", // owner
    addressPlaceholder: "Rue, ville",
    addClient: "Ajouter le client",
    budgetLabel: "Budget, taxes incluses",
    budgetHint: "Taxes incluses. La soumission est ajustée pour s’en approcher.",
    noBudget: "Sans budget",
    setBudget: "Fixer le budget",
    clientToConfirm: "Client à confirmer",
    totalIncl: "Total {{tax}} incluse",
    tax: "taxes",
    fitting: "Ajustement à votre budget de {{budget}}",
    within: "Dans votre budget de {{budget}} · {{diff}} de moins",
    over: "Dépasse le budget de {{diff}}",
    review: "Vérifier et envoyer",
    edit: "Modifier",
    problem: {
      offline: "Vous êtes hors ligne. Votre description est conservée : réessayez avec du signal.", // owner
      quota: "Vous avez utilisé les soumissions du mois. Il y en a d’autres sur quoteai.ca.", // owner
      cannot: "Ce n’est pas assez pour établir un prix. Ajoutez quoi, où et quelle taille.", // owner
      unlock: "Cette soumission demande un forfait actif. Vérifiez-le sur quoteai.ca.", // owner
      failed: "Impossible de rédiger la soumission. Réessayez.", // owner
    },
  },
  needs: {
    title: "À traiter", // owner
    hint: "Balayez pour en voir plus", // owner
    hintDone: "Terminé",
    allClear: "Tout est à jour",
    allClearBody: "Les nouveaux éléments à traiter apparaissent ici.",
    hours: { title: "Approuver {{hours}} h", sub_one: "{{count}} entrée de temps de {{people}} personne", sub_other: "{{count}} entrées de temps de {{people}} personnes", status: "Avant la paie", button: "Approuver", done: "Approuvé" },
    etransfer: { title: "Confirmer {{amount}}", sub: "Virement Interac de {{customer}}, correspond à {{number}}", status: "Vérifiez votre compte", button: "Confirmer", done: "Confirmé" },
    lead: { titleCall: "Appeler {{name}}", titleOpen: "Relancer {{name}}", sub: "Prospect à rappeler aujourd’hui", status: "Pour aujourd’hui", button: "Appeler", buttonOpen: "Ouvrir", done: "Appelé" }, // owner
    remind: { title: "Relancer {{customer}}", sub: "{{number}} · {{amount}}", status_one: "{{count}} jour de retard", status_other: "{{count}} jours de retard", button: "Relancer", done: "Relancé" },
    blocker: { title: "Répondre à {{who}}", titleNoName: "Répondre à l’équipe", status: "{{job}}", button: "Ouvrir", done: "Ouvert" }, // owner
    waiting: { titleCall: "Appeler {{name}}", titleOpen: "Relancer {{name}}", sub: "{{job}} · {{amount}}", status_one: "Envoyée il y a {{count}} jour", status_other: "Envoyée il y a {{count}} jours", button: "Appeler", buttonOpen: "Ouvrir", done: "Fait" }, // owner
    remindFailed: "Impossible d’envoyer le rappel. Réessayez.", // owner
  },
  weather: { rain: "pluie après {{time}}", snow: "neige après {{time}}", storm: "orage après {{time}}" }, // owner
  edit: "Modifier l’accueil",
  quickTiles: {
    receipt: { label: "Reçu", sub: "Une photo, on le classe" },
    photo: { label: "Photo de chantier", sub: "Va au dossier du chantier" },
    clockIn: { label: "Pointer", sub: "Vous ou l’équipe" },
    payment: { label: "Paiement", sub: "Comptant, chèque, virement Interac" },
    lead: { label: "Prospect", sub: "D’un appel ou d’une visite" },
    note: { label: "Note vocale", sub: "Transformée en tâches" },
  },
  loadFailed: "Impossible d’actualiser l’accueil. Les dernières données de ce téléphone s’affichent.", // owner
};
