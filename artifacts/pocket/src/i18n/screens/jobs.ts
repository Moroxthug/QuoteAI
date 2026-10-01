// Jobs.dc.html and JobsFR.dc.html. The boards show sample people and jobs; the lines that name real ones take them as values.
// French follows JobsFR; // owner = my own wording, to review.
export const en = {
  title: "Jobs",
  newJob: "New job",
  more: "More actions",
  glance: "Jobs at a glance",
  filter: "Filter",
  kpi: {
    progress: "In progress", jobs_one: "{{count}} job", jobs_other: "{{count}} jobs",
    toInvoice: "To invoice", onSite: "On site today",
    clash_one: "{{count}} clash", clash_other: "{{count}} clashes",
    clear: "No clashes", // (new)
  },
  glanceRows: {
    done: "{{pct}} done",
    ready: "Ready to invoice: {{name}}", readySub: "{{pct}} done · {{invoiced}} invoiced",
    toInvoice: "To invoice", invoice: "Invoice",
    clash: "{{name}} is booked twice, {{from}} to {{to}}", clashSub: "{{a}} and {{b}}", clashWord: "Clash", fix: "Fix",
  },
  filters: { all: "Open", setup: "Setup", planning: "Planning", active: "Active", hold: "On hold", done: "Completed" },
  groups: { setup: "Needs your review", active: "In progress", planning: "Planning", hold: "On hold", done: "Completed" },
  status: { setup: "Review setup", planning: "Planning", active: "Active", hold: "On hold", done: "Completed" },
  receipts: { title_one: "{{count}} receipt to review", title_other: "{{count}} receipts to review", sub: "{{job}} · {{amount}}" },
  setup: { meta: "AI plan ready to review", action: "Review" },
  meta: {
    next: "Next: {{title}}, {{date}}", nextNoDate: "Next: {{title}}", running: "In progress",
    starts: "Starts {{start}} · ends {{end}}", startsOnly: "Starts {{start}}", noDates: "No dates yet",
    onHold: "On hold", finished: "Finished {{date}}",
  },
  crew: { onSite: "{{count}} on site" },
  caps: { onSite: "Today on site", today: "Today", before: "Before it starts", waiting: "Why it’s waiting", after: "After the job" },
  row: {
    onSite: "On site", since: "Since {{time}}", onTrack: "On track", late: "Late", next: "Next: {{title}}",
    blocker: "Blocker", flagged: "Flagged by {{name}} · {{time}}", flaggedNoName: "Flagged at {{time}}", resolve: "Resolve", resolved: "Resolved",
    booked: "Crew booked", bookedSub: "{{names}}", noCrew: "No crew yet", noCrewSub: "Add people on the job",
    waiting: "Waiting", waitingSub: "On hold since {{date}}",
    finished: "Finished {{date}}", finishedSub: "Final {{amount}}",
  },
  stats: { invoiced: "Invoiced", costs: "Costs", margin: "Margin", final: "Final", days: "Days" },
  message: "Message {{name}}", messageClient: "Message client", openJob: "Open job",
  empty: { title: "No jobs here yet", body: "An accepted quote becomes a job, with its plan drafted for you.", action: "Go to quotes" },
  plan: "{{open}} of {{limit}} open jobs on your plan",
  loadFailed: { title: "Couldn’t load your jobs", body: "Check your connection and try again.", retry: "Try again" },
  offline: "You’re offline. Showing the last jobs this phone saw.",
  resolveFailed: "Couldn’t do that. Try again.",
};

export const fr: typeof en = {
  title: "Chantiers",
  newJob: "Nouveau chantier",
  more: "Plus d’actions",
  glance: "Aujourd’hui en un coup d’œil",
  filter: "Filtrer",
  kpi: {
    progress: "En cours", jobs_one: "{{count}} chantier", jobs_other: "{{count}} chantiers",
    toInvoice: "À facturer", onSite: "Sur place aujourd’hui",
    clash_one: "{{count}} conflit", clash_other: "{{count}} conflits",
    clear: "Aucun conflit", // owner
  },
  glanceRows: {
    done: "{{pct}} d’avancement",
    ready: "Prêt à facturer : {{name}}", readySub: "{{pct}} d’avancement · {{invoiced}} facturé", // owner
    toInvoice: "À facturer", invoice: "Facturer",
    clash: "{{name}} est réservé deux fois, de {{from}} à {{to}}", clashSub: "{{a}} et {{b}}", clashWord: "Conflit", fix: "Corriger",
  },
  filters: { all: "Ouverts", setup: "À valider", planning: "Planification", active: "Actifs", hold: "En pause", done: "Terminés" },
  groups: { setup: "À vérifier", active: "En cours", planning: "En planification", hold: "En pause", done: "Terminés" },
  status: { setup: "À valider", planning: "En planification", active: "Actif", hold: "En pause", done: "Terminé" },
  receipts: { title_one: "{{count}} reçu à vérifier", title_other: "{{count}} reçus à vérifier", sub: "{{job}} · {{amount}}" },
  setup: { meta: "Plan IA prêt à vérifier", action: "Vérifier" }, // owner
  meta: {
    next: "Ensuite : {{title}}, {{date}}", nextNoDate: "Ensuite : {{title}}", running: "En cours", // owner
    starts: "Du {{start}} au {{end}}", startsOnly: "Début le {{start}}", noDates: "Pas encore de dates", // owner
    onHold: "En pause", finished: "Terminé le {{date}}",
  },
  crew: { onSite: "{{count}} sur place" },
  caps: { onSite: "Aujourd’hui sur le chantier", today: "Aujourd’hui", before: "Avant le début", waiting: "Pourquoi c’est en attente", after: "Après les travaux" },
  row: {
    onSite: "Sur place", since: "Depuis {{time}}", onTrack: "Dans les temps", late: "En retard", next: "Ensuite : {{title}}", // owner (late, since)
    blocker: "Bloquant", flagged: "Signalé par {{name}} à {{time}}", flaggedNoName: "Signalé à {{time}}", resolve: "Régler", resolved: "Réglé", // owner
    booked: "Équipe réservée", bookedSub: "{{names}}", noCrew: "Pas encore d’équipe", noCrewSub: "Ajoutez des gens dans le chantier", // owner
    waiting: "En attente", waitingSub: "En pause depuis le {{date}}", // owner
    finished: "Terminé le {{date}}", finishedSub: "Total final {{amount}}",
  },
  stats: { invoiced: "Facturé", costs: "Coûts", margin: "Marge", final: "Total final", days: "Jours" },
  message: "Écrire à {{name}}", messageClient: "Écrire au client", openJob: "Ouvrir le chantier",
  empty: { title: "Aucun chantier pour l’instant", body: "Une soumission acceptée devient un chantier, avec son plan déjà préparé.", action: "Voir les soumissions" },
  plan: "{{open}} chantiers ouverts sur les {{limit}} de votre forfait",
  loadFailed: { title: "Impossible de charger vos chantiers", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  offline: "Vous êtes hors ligne. Voici les derniers chantiers vus sur ce téléphone.", // owner
  resolveFailed: "Impossible de le faire. Réessayez.", // owner
};
