// JobSetup.dc.html and JobSetupFR.dc.html. The board's milestone titles, tasks and budget notes come from the signed quote
// and the server's plan, so here are only the words around them. // owner = my own wording, to review.
export const en = {
  title: "Job setup",
  back: "Back",
  more: "More actions",
  signed: "Signed {{date}} · {{number}}",
  won: "Won {{date}} · {{number}}", // (new) a quote won without a contract
  started: "Started {{date}}", // (new) a job that is already running
  heading: "Review the plan",
  headingRunning: "Plan and budget", // (new)
  intro: "Drafted from the signed quote. Nothing reaches the crew until you start the job.",
  introRunning: "Change the stages, dates and budget. Changes show on the job straight away.", // (new)
  name: "Job name",
  contractValue: "Contract value",
  depositPaid: "Deposit {{amount}} paid",
  noDeposit: "Tax included", // (new)
  window: "Schedule window",
  windowSub_one: "{{count}} working day",
  windowSub_other: "{{count}} working days",
  noWindow: "No dates yet", // (new)
  milestones: "Milestones",
  milestonesCount_one: "{{count}} milestone",
  milestonesCount_other: "{{count}} milestones",
  ofWork: "100% of work",
  tasks_one: "{{count}} task",
  tasks_other: "{{count}} tasks",
  shareOfWork: "{{pct}} of work",
  noPayment: "No payment linked",
  moveUp: "Move {{title}} up",
  delete: "Delete {{title}}",
  add: "Add milestone",
  newMilestone: "New milestone",
  undo: "Undo",
  shift: "Shift everything to start on",
  shiftSub: "Weekends skipped, order kept",
  pickDate: "Pick a date",
  pickTitle: "Start on",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  budget: "Cost budget",
  budgetFrom: "From the quote’s line items",
  categories: { materials: "Materials", labour: "Labour", subcontractor: "Subcontractors", permits_fees: "Permits and fees", equipment: "Equipment", misc: "Misc" },
  noneYet: { subcontractor: "None planned", permits_fees: "None needed" },
  less: "Less {{name}}",
  more2: "More {{name}}",
  expected: "Expected costs",
  margin: "Projected margin",
  above: "Above your {{pct}} target",
  below: "Below your {{pct}} target",
  start: "Looks good, start the job",
  save: "Save changes", // (new)
  saving: "Saving…",
  started2: "Job started",
  saved: "Saved", // (new)
  loadFailed: { title: "Couldn’t load this job", body: "Check your connection and try again.", retry: "Try again" },
  notFound: { title: "This job isn’t here", body: "It may have been archived or removed.", action: "Back to jobs" },
  saveFailed: "Couldn’t save. Try again.",
  limit: "Your plan runs {{limit}} jobs at a time. Finish or archive one first.", // (new)
  menu: { title: "Job setup", regenerate: "Rebuild the plan from the contract", regenerateSub: "Throws away your edits to the stages and budget", openJob: "Open the job" },
  regenerated: "Plan rebuilt",
};

export const fr: typeof en = {
  title: "Préparation du chantier",
  back: "Retour",
  more: "Plus d’actions",
  signed: "Signé le {{date}} · {{number}}",
  won: "Gagné le {{date}} · {{number}}", // owner
  started: "Lancé le {{date}}", // owner
  heading: "Vérifiez le plan",
  headingRunning: "Plan et budget", // owner
  intro: "Préparé à partir de la soumission signée. Rien n’est envoyé à l’équipe avant le lancement du chantier.",
  introRunning: "Modifiez les étapes, les dates et le budget. Les changements paraissent tout de suite dans le chantier.", // owner
  name: "Nom du chantier",
  contractValue: "Valeur du contrat",
  depositPaid: "Dépôt de {{amount}} payé",
  noDeposit: "Taxes comprises", // owner
  window: "Période prévue",
  windowSub_one: "{{count}} jour ouvrable",
  windowSub_other: "{{count}} jours ouvrables",
  noWindow: "Pas encore de dates", // owner
  milestones: "Étapes",
  milestonesCount_one: "{{count}} étape",
  milestonesCount_other: "{{count}} étapes",
  ofWork: "100 % du travail",
  tasks_one: "{{count}} tâche",
  tasks_other: "{{count}} tâches",
  shareOfWork: "{{pct}} du travail",
  noPayment: "Aucun paiement lié",
  moveUp: "Monter : {{title}}",
  delete: "Supprimer : {{title}}",
  add: "Ajouter une étape",
  newMilestone: "Nouvelle étape",
  undo: "Annuler",
  shift: "Tout décaler pour commencer le",
  shiftSub: "Fins de semaine sautées, ordre gardé",
  pickDate: "Choisir une date",
  pickTitle: "Commencer le", // owner
  prevMonth: "Mois précédent", // owner
  nextMonth: "Mois suivant", // owner
  budget: "Budget des coûts",
  budgetFrom: "Tiré des lignes de la soumission",
  categories: { materials: "Matériaux", labour: "Main-d’œuvre", subcontractor: "Sous-traitants", permits_fees: "Permis et frais", equipment: "Équipement", misc: "Divers" },
  noneYet: { subcontractor: "Aucun prévu", permits_fees: "Aucun requis" },
  less: "Moins : {{name}}",
  more2: "Plus : {{name}}",
  expected: "Coûts prévus",
  margin: "Marge prévue",
  above: "Au-dessus de votre cible de {{pct}}",
  below: "Sous votre cible de {{pct}}",
  start: "C’est bon, lancer le chantier",
  save: "Enregistrer les changements", // owner
  saving: "Enregistrement…", // owner
  started2: "Chantier lancé",
  saved: "Enregistré", // owner
  loadFailed: { title: "Impossible de charger ce chantier", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  notFound: { title: "Ce chantier n’est plus là", body: "Il a peut-être été archivé ou supprimé.", action: "Retour aux chantiers" }, // owner
  saveFailed: "Impossible d’enregistrer. Réessayez.", // owner
  limit: "Votre forfait permet {{limit}} chantiers à la fois. Terminez ou archivez-en un d’abord.", // owner
  menu: { title: "Préparation du chantier", regenerate: "Refaire le plan à partir du contrat", regenerateSub: "Efface vos changements aux étapes et au budget", openJob: "Ouvrir le chantier" }, // owner
  regenerated: "Plan refait", // owner
};
