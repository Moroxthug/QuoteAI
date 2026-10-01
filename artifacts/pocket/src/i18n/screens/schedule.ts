// Schedule.dc.html and ScheduleFR.dc.html. French follows ScheduleFR; // owner = my own wording, to review. (new) = not on the board.
export const en = {
  back: "Back", more: "More actions", today: "Today", prevWeek: "Previous week", nextWeek: "Next week", weekOf: "Week of {{date}}",
  daySub: "{{blocks}} · {{hours}}", blocks_one: "{{count}} block", blocks_other: "{{count}} blocks", withClash: " · {{clash}}", clash_one: "{{count}} clash", clash_other: "{{count}} clashes", nothing: "Nothing booked",
  groupBy: "Group by", byPerson: "By person", byJob: "By job",
  clashTitle: "{{name}} is double-booked.", clashText: "{{a}} and {{b}} overlap.",
  clashLabel: "Clash {{hours}} h", free: "Free", book: "Book", nothingBooked: "Nothing booked", addBlock: "Add block",
  hoursOf: "{{count}} h",
  open: { directions: "Directions", call: "Call", move: "Move", bring: "Bring", clashes: "Clashes with {{job}}", openJob: "Open job", messageCrew: "Message crew", messaged: "Messaged", opened: "Opened", calling: "Calling" },
  noAddress: "No address on the job", // (new)
  sheet: { newBlock: "New block", editBlock: "Edit block", worker: "Worker", job: "Job", milestone: "Milestone", from: "From", to: "To", hours: "Hours", allDay: "All day", startEarlier: "Start earlier", startLater: "Start later", endEarlier: "End earlier", endLater: "End later",
    notes: "Notes for the worker", notesPlaceholder: "Anything the worker should know", delete: "Delete", save: "Save block", saveAnyway: "Save anyway", saving: "Saving…",
    clashLead: "Clashes with {{job}},", clashTime: "{{from}} – {{to}}.", fix: "Start {{time}}", free: "{{name}} is free for this block.", reminder: "A reminder goes out the evening before.", reminderSent: "Reminder already sent to {{name}} at {{time}}. Saving sends an update.",
    pickWorker: "Pick a worker", pickJob: "Pick a job", pickMilestone: "Pick a milestone", noMilestone: "No milestone", noJob: "No job", noWorker: "Nobody yet", start: "Start", end: "End",
    deleteFailed: "Couldn’t delete it.", saveFailed: "Couldn’t save the block. Try again." },
  loadFailed: { title: "Couldn’t load the schedule", body: "Check your connection and try again.", retry: "Try again" },
  offline: "You’re offline. Showing the last week this phone saw.",
  planNeeded: "The schedule board comes with the Pro plan.",
};

export const fr: typeof en = {
  back: "Retour", more: "Plus d’actions", today: "Aujourd’hui", prevWeek: "Semaine précédente", nextWeek: "Semaine suivante", weekOf: "Semaine du {{date}}",
  daySub: "{{blocks}} · {{hours}}", blocks_one: "{{count}} bloc", blocks_other: "{{count}} blocs", withClash: " · {{clash}}", clash_one: "{{count}} conflit", clash_other: "{{count}} conflits", nothing: "Rien de prévu",
  groupBy: "Regrouper", byPerson: "Par personne", byJob: "Par chantier",
  clashTitle: "{{name}} est prévu à deux endroits.", clashText: "{{a}} et {{b}} se chevauchent.",
  clashLabel: "Conflit {{hours}} h", free: "Libre", book: "Réserver", nothingBooked: "Rien de prévu", addBlock: "Ajouter un bloc",
  hoursOf: "{{count}} h",
  open: { directions: "Itinéraire", call: "Appeler", move: "Déplacer", bring: "Apporter", clashes: "Conflit avec {{job}}", openJob: "Voir le chantier", messageCrew: "Écrire à l’équipe", messaged: "Écrit", opened: "Ouvert", calling: "Appel en cours" },
  noAddress: "Pas d’adresse sur le chantier", // owner
  sheet: { newBlock: "Nouveau bloc", editBlock: "Modifier le bloc", worker: "Travailleur", job: "Chantier", milestone: "Étape", from: "Du", to: "Au", hours: "Heures", allDay: "Toute la journée", startEarlier: "Commencer plus tôt", startLater: "Commencer plus tard", endEarlier: "Finir plus tôt", endLater: "Finir plus tard", // owner (steppers)
    notes: "Notes pour le travailleur", notesPlaceholder: "Tout ce que le travailleur doit savoir", delete: "Supprimer", save: "Enregistrer le bloc", saveAnyway: "Enregistrer quand même", saving: "Enregistrement…", // owner (placeholder, saving)
    clashLead: "Conflit avec {{job}},", clashTime: "{{from}} – {{to}}.", fix: "Début à {{time}}", free: "{{name}} est libre pour ce bloc.", reminder: "Un rappel est envoyé la veille au soir.", reminderSent: "Rappel déjà envoyé à {{name}} à {{time}}. Enregistrer envoie une mise à jour.",
    pickWorker: "Choisir un travailleur", pickJob: "Choisir un chantier", pickMilestone: "Choisir une étape", noMilestone: "Aucune étape", noJob: "Aucun chantier", noWorker: "Personne pour l’instant", start: "Début", end: "Fin", // owner
    deleteFailed: "Impossible de le supprimer.", saveFailed: "Impossible d’enregistrer le bloc. Réessayez." }, // owner
  loadFailed: { title: "Impossible de charger l’horaire", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  offline: "Vous êtes hors ligne. Voici la dernière semaine vue sur ce téléphone.", // owner
  planNeeded: "L’horaire vient avec le forfait Pro.", // owner
};
