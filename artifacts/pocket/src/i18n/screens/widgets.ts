// Home's widgets (SmartHome.dc.html / SmartHomeFR.dc.html, HOME-WIDGETS-SPEC.md). The board shows sample
// figures, so the sentences that carry them take them as values; French follows the board's wording
// (// owner = mine, to review).
export const en = {
  rows: { today: "Today", money: "Money", sales: "Sales", field: "Field" },
  more: "Open {{name}}",
  collected: {
    name: "Collected",
    inMonth: "Collected in {{month}}",
    thisWeek: "Collected this week",
    thisQuarter: "Collected this quarter",
    up: "↑ {{pct}}%",
    down: "↓ {{pct}}%",
    periods: ["Week", "Month", "Quarter"],
    periodLabel: "Period",
    won: "Quotes won",
    outstanding: "Outstanding",
    margin: "Margin",
    quarter: "Q{{n}}",
    open: "Open Books",
    nothingYet: "Nothing collected yet",
    nothingBody: "Payments you record show up here.",
  },
  owed: {
    name: "Outstanding",
    count_one: "{{count}} invoice",
    count_other: "{{count}} invoices",
    notDue: "Not yet due",
    overdue: "Overdue",
    worst: "{{client}} · {{number}}",
    worstRight: "{{amount}} · {{days}} days",
    unpaid: "Unpaid invoices",
    due: "Due {{date}}",
    dueIn_one: "Due in {{count}} day",
    dueIn_other: "Due in {{count}} days",
    late_one: "{{count}} day late",
    late_other: "{{count}} days late",
    remind: "Remind",
    reminded: "Reminded",
    remindAll: "Remind {{count}} overdue",
    open: "Open invoices",
    allPaid: "Nothing owed",
    allPaidBody: "Every invoice is paid.",
    remindFailed: "Couldn’t send the reminder. Try again.",
  },
  quotes: {
    name: "Quotes",
    won: "{{pct}}% won",
    drafts: "Drafts",
    sent: "Sent",
    viewed: "Viewed",
    wonCol: "Won",
    viewedAgo: "{{client}} viewed their quote {{ago}}",
    acceptedAgo: "{{client}} accepted {{ago}}",
    declinedAgo: "{{client}} declined {{ago}}",
    agoMin: "{{n}} min ago",
    agoH: "{{n}} h ago",
    agoD_one: "{{count}} day ago",
    agoD_other: "{{count}} days ago",
    noActivity: "Nothing from clients yet",
    waiting: "Waiting on clients",
    open: "Open quotes",
    nothing: "No quotes yet",
  },
  followups: {
    name: "Follow-ups",
    due: "{{count}} today",
    waitingFor: "Sent {{count}} days ago",
    call: "Call",
    openIt: "Open",
    called: "Calling",
    caption: "Who to nudge today",
    open: "Open leads",
    nothing: "No follow-ups due",
    nothingBody: "People to call back show up here.",
  },
  tasks: {
    name: "Today’s list",
    of: "{{done}} of {{total}}",
    nothing: "Nothing on today’s list",
    nothingBody: "Tasks and things due today show up here.",
    mark: "Mark done: {{text}}",
    unmark: "Mark not done: {{text}}",
    all: "All tasks",
    failed: "Couldn’t update the list. Try again.",
  },
  weather: {
    name: "Site weather",
    dry: "Dry all day",
    note: "Plan exterior work before {{time}}",
    noteNone: "Good conditions for outdoor work",
    feels: "Where your crews work",
  },
};

export const fr: typeof en = {
  rows: { today: "Aujourd’hui", money: "Argent", sales: "Ventes", field: "Terrain" },
  more: "Ouvrir {{name}}",
  collected: {
    name: "Encaissé",
    inMonth: "Encaissé en {{month}}",
    thisWeek: "Encaissé cette semaine", // owner
    thisQuarter: "Encaissé ce trimestre", // owner
    up: "↑ {{pct}} %",
    down: "↓ {{pct}} %",
    periods: ["Semaine", "Mois", "Trimestre"],
    periodLabel: "Période",
    won: "Soumissions gagnées",
    outstanding: "À recevoir",
    margin: "Marge",
    quarter: "T{{n}}",
    open: "Ouvrir la comptabilité",
    nothingYet: "Rien d’encaissé pour l’instant", // owner
    nothingBody: "Les paiements que vous enregistrez apparaissent ici.", // owner
  },
  owed: {
    name: "À recevoir",
    count_one: "{{count}} facture",
    count_other: "{{count}} factures",
    notDue: "Pas encore dues", // owner
    overdue: "En retard",
    worst: "{{client}} · {{number}}",
    worstRight: "{{amount}} · {{days}} jours",
    unpaid: "Factures impayées",
    due: "Échéance le {{date}}",
    dueIn_one: "Échéance dans {{count}} jour",
    dueIn_other: "Échéance dans {{count}} jours",
    late_one: "{{count}} jour de retard",
    late_other: "{{count}} jours de retard",
    remind: "Relancer",
    reminded: "Relancé",
    remindAll: "Relancer {{count}} en retard", // owner
    open: "Ouvrir les factures",
    allPaid: "Rien à recevoir", // owner
    allPaidBody: "Toutes les factures sont payées.", // owner
    remindFailed: "Impossible d’envoyer le rappel. Réessayez.", // owner
  },
  quotes: {
    name: "Soumissions",
    won: "{{pct}} % gagnées",
    drafts: "Brouillons",
    sent: "Envoyées",
    viewed: "Consultées",
    wonCol: "Gagnées",
    viewedAgo: "{{client}} a consulté sa soumission {{ago}}",
    acceptedAgo: "{{client}} a accepté {{ago}}", // owner
    declinedAgo: "{{client}} a refusé {{ago}}", // owner
    agoMin: "il y a {{n}} min",
    agoH: "il y a {{n}} h",
    agoD_one: "il y a {{count}} jour",
    agoD_other: "il y a {{count}} jours",
    noActivity: "Rien des clients pour l’instant", // owner
    waiting: "En attente des clients",
    open: "Ouvrir les soumissions", // owner
    nothing: "Aucune soumission pour l’instant", // owner
  },
  followups: {
    name: "Relances",
    due: "{{count}} aujourd’hui",
    waitingFor: "Envoyée il y a {{count}} jours",
    call: "Appeler",
    openIt: "Ouvrir",
    called: "Appel en cours",
    caption: "Qui relancer aujourd’hui", // owner
    open: "Ouvrir les prospects", // owner
    nothing: "Aucune relance à faire", // owner
    nothingBody: "Les personnes à rappeler apparaissent ici.", // owner
  },
  tasks: {
    name: "Liste du jour",
    of: "{{done}} sur {{total}}",
    nothing: "Rien sur la liste du jour", // owner
    nothingBody: "Les tâches et échéances du jour apparaissent ici.", // owner
    mark: "Marquer fait : {{text}}", // owner
    unmark: "Marquer non fait : {{text}}", // owner
    all: "Toutes les tâches", // owner
    failed: "Impossible de mettre la liste à jour. Réessayez.", // owner
  },
  weather: {
    name: "Météo des chantiers",
    dry: "Sec toute la journée", // owner
    note: "Prévoyez les travaux extérieurs avant {{time}}",
    noteNone: "Bonnes conditions pour le travail à l’extérieur", // owner
    feels: "Là où travaillent vos équipes", // owner
  },
};
