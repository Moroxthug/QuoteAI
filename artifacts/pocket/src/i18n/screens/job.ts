// Job.dc.html and JobFR.dc.html. The boards show sample people and amounts; lines that name real ones take them as values.
// French follows JobFR; // owner = my own wording, to review. (new) = not on the board.
export const en = {
  back: "Back",
  more: "More actions",
  rename: "Rename job",
  renameTitle: "Rename job",
  renamePlaceholder: "Job name",
  renameSave: "Save",
  map: "Map",
  noClient: "No client yet", // (new)
  status: { planning: "Planning", active: "Active", suspended: "On hold", completed: "Completed", setup: "Review setup" },
  milestonesDone: "Milestones · {{done}} of {{total}} done",
  noMilestones: "No milestones yet", // (new)
  cells: {
    contract: "Contract value", inclCo_one: "incl. {{amount}} change order", inclCo_other: "incl. {{amount}} in change orders", taxIncluded: "Tax included",
    invoiced: "Invoiced", invoicedIn: "{{amount}} in", invoicedLate: "{{amount}} late", nothingInvoiced: "Nothing invoiced yet",
    costs: "Costs", costsOfBudget: "{{pct}} of budget", costsNoBudget: "No budget set", toReview_one: "{{count}} to review", toReview_other: "{{count}} to review",
    margin: "Projected margin", onTarget: "{{amount}} · on target", offTarget: "{{amount}} · below target",
  },
  quick: {
    omw: "On my way", omwSent: "ETA sent", photo: "Add photo", voice: "Voice note", listening: "Tap to stop", writing: "Writing it down…", voiceSaved: "Voice note saved", voiceFailed: "Couldn’t catch that. Try again.", photoAdded: "Photo added",
    noClient: "This job has no client to text.", noPhone: "This client has no phone number on file.", omwFailed: "Couldn’t send the text. Try again.", optedOut: "This client asked not to get texts.",
    photoFailed: "Couldn’t add the photo. Try again.", unavailable: "This isn’t available on this phone yet.", denied: "Allow the camera or microphone to do this.",
  },
  menu: { hold: "Put on hold", resume: "Resume the job", complete: "Mark as complete", archive: "Archive the job" }, // (new)
  tabsLabel: "Job sections",
  tabs: { overview: "Overview", schedule: "Schedule", co: "Change orders", costs: "Costs", inv: "Invoices", team: "Team", photos: "Photos", msg: "Messages", docs: "Documents", ask: "Assistant" },
  primary: {
    overview: "Record progress", schedule: "Record progress", co: "New change order", costs: "Scan a receipt", team: "Log hours", photos: "Take a photo", photosShare: "Share {{count}} with the client",
    msg: "Message the client", docs: "Share a document", ask: "Ask the assistant", invCreate: "Create term {{n}} invoice", invSend: "Send {{number}}", invNone: "New invoice",
  },
  loadFailed: { title: "Couldn’t load this job", body: "Check your connection and try again.", retry: "Try again" },
  notFound: { title: "This job isn’t here", body: "It may have been archived or removed.", action: "Back to jobs" },
  offline: "You’re offline. Showing the last this phone saw.",
  failed: "Couldn’t do that. Try again.",
  saving: "Saving…",
  field: {
    title: "From the field", open_one: "{{count}} open", open_other: "{{count}} open", allSorted: "All sorted",
    clearLead: "Nothing blocking the crew.", clearBody: "New questions from the site land here.",
    kind: { blocker: "Question", materials: "Material", note: "Note" },
    answer: "Answer", sorted: "Mark sorted", answerTitle: "Answer {{name}}", answerPlaceholder: "Write your answer", answerSend: "Send answer", answerSub: "{{name}} sees this on the crew page.",
    crewMember: "the crew",
  },
  today: { title: "On it today", schedule: "Schedule", onSite: "On site", notIn: "Not in yet", booked: "Booked", empty: "Nobody is booked on this job today.", allDay: "All day" },
  next: {
    title: "Up next", due: "Due {{date}} · {{left}} of {{total}} tasks left", dueNoTasks: "Due {{date}}", noDate: "{{left}} of {{total}} tasks left", noTasks: "No tasks yet",
    inProgress: "In progress", planned: "Upcoming", releases: "Releases payment", term: "{{label}} · {{pct}} of contract", termNoPct: "{{label}}", invoiceWhenDone: "Invoice when done", invoiced: "Invoiced",
    allDone: "Every milestone is done", // (new)
  },
  budget: { title: "Budget vs actual", of: "{{spent}} of {{planned}}", mark: "Work done, {{pct}}", empty: "No budget set. Add one in the job setup.", categories: { materials: "Materials", labour: "Labour", subcontractor: "Subcontractors", permits_fees: "Permits and fees", equipment: "Equipment", misc: "Misc" } },
  permits: {
    title: "Permits and inspections", add: "Add", empty: "No permits on this job yet.",
    status: { needed: "To apply", applied: "Applied", issued: "Issued", closed: "Closed", not_required: "Not required" },
    inspection: "Inspection {{date}}", metaAuthority: "{{authority}} · {{ref}}", kinds: { building: "Building permit", demolition: "Demolition permit", electrical: "Electrical permit", plumbing: "Plumbing permit", gas: "Gas permit", hvac: "HVAC permit", other: "Other" },
    sheetTitle: "Add a permit", name: "Permit or inspection", namePlaceholder: "Plumbing permit", authority: "Who issues it", authorityPlaceholder: "City of Toronto", save: "Add", saved: "Added",
  },
  notes: { title: "Notes", add: "Add note", empty: "No notes yet.", source: { manual: "Typed", voice: "Dictated", photo: "From a photo", assistant: "Assistant" }, sheetTitle: "Add a note", placeholder: "What should the team know?", save: "Save note", saved: "Note added", line: "{{source}} · {{who}} · {{when}}" },
  schedule: {
    milestones: "Milestones", editDates: "Edit dates", done: "Done", inProgress: "In progress", upcoming: "Upcoming", skipped: "Skipped",
    dates: "{{dates}} · {{tasks}}", tasksOf: "{{done}} of {{total}} tasks", tasks_one: "{{count}} task", tasks_other: "{{count}} tasks", fromSite: "From the site · {{name}}",
    addTask: "Add task", taskPlaceholder: "What needs doing?", complete: "Complete milestone", completed: "Milestone done", start: "Start milestone", reopen: "Reopen", skip: "Skip",
    crew: "Crew, next 4 weeks", openSchedule: "Open schedule", thisJob: "This job", otherJobs: "Other jobs", clash: "Clash", noCrew: "Nobody is booked on this job in the next four weeks.", // (new)
    clashBanner_one: "{{name}} is booked twice on {{day}}", clashBanner_other: "{{count}} double bookings in the next four weeks", clashFix: "Fix",
  },
  co: { title: "Change orders", signedAdd: "Signed: {{amount}} · {{days}}", signedNone: "Nothing signed yet", days_one: "+{{count}} day", days_other: "+{{count}} days", daysLess: "{{count}} days",
    status: { draft: "Draft", sent: "Waiting", signed: "Signed", declined: "Declined", voided: "Voided", toSign: "To sign" }, meta: "{{number}} · {{days}} · {{when}}", signedOn: "signed {{date}}", sentOn: "sent {{date}}", draftOn: "drafted {{date}}", new: "New change order", empty: "No change orders yet." },
  costs: {
    scan: "Scan a receipt", scanSub: "Vendor, tax and category read for you", review: "To review", receipts_one: "{{count}} receipt", receipts_other: "{{count}} receipts", doneLead: "All receipts confirmed.", doneBody: "Costs are up to date.",
    confirm: "Confirm", confirmed: "Confirmed", entries: "Entries", byCategory: "By category", budget: "Budget vs actual", used: "{{pct}} used", confidence: { high: "sure", medium: "fairly sure", low: "check it" }, takePhoto: "Take a photo", choosePhoto: "Choose a photo", scanTitle: "Scan a receipt", reading: "Reading the receipt…", noEntries: "No costs yet.",
    entryMeta: "{{category}} · {{source}} · {{date}}", source: { receipt: "Receipt", time: "Time", bank: "Bank line", manual: "Manual", equipment: "Equipment use", travel: "Travel", other: "Other" },
    scanned: "Receipt added. Check it under To review.", scanFailed: "Couldn’t read that receipt. Try again.",
  },
  inv: {
    invoiced: "Invoiced", invoices_one: "{{count}} invoice", invoices_other: "{{count}} invoices", collected: "Collected", paid_one: "{{count}} paid", paid_other: "{{count}} paid", outstanding: "Outstanding", lateBy_one: "{{number}} · {{count}} day late", lateBy_other: "{{number}} · {{count}} days late", none: "Nothing owed",
    term: "Term {{n}}", toInvoice: "Still to invoice", termsLeft_one: "{{count}} term left", termsLeft_other: "{{count}} terms left", plan: "Billing plan", fromContract: "From the contract", create: "Create", manual: "Manual invoice",
    status: { paid: "Paid", late: "Late", draft: "Draft", open: "Open", held: "Held", sent: "Sent", partial: "Partly paid" }, dueWhenDone: "{{pct}} · due when the milestone is done", paidOn: "{{pct}} · {{number}} · paid {{date}}", dueOn: "{{pct}} · {{number}} · due {{date}}", draftMeta: "{{pct}} · {{number}} draft", daysLate_one: "{{count}} day late", daysLate_other: "{{count}} days late",
    holdback: "Holdback release", created: "Invoice drafted", createFailed: "Couldn’t create it. Try again.", noPlan: "No billing plan yet. It comes from a signed contract.",
  },
  team: {
    hours: "Hours to approve", approveAll: "Approve all", approve: "Approve", approved: "Approved", hoursNone: "No hours waiting.", log: "Log hours", assigned: "Assigned", assign: "Assign", onThisJob: "on this job", noCrew: "Nobody is assigned yet.",
    location: "Job-site location", locationSub: "{{address}} · {{radius}} m radius for clock-in", locationNone: "Not set yet", locationNoAddress: "No address",
    logTitle: "Log hours", who: "Who worked", hoursField: "Hours", dateField: "Date", noteField: "Note (optional)", saveHours: "Save hours", hoursSaved: "Hours saved", assignTitle: "Assign to this job", assignNone: "Everyone is already on this job.", assigned2: "Added to the job", removeFrom: "Remove {{name}} from this job", radiusTitle: "Clock-in radius", radiusSub: "The crew can clock in within this distance of the site.", radiusSave: "Save radius", radiusNoPin: "The site pin isn’t set yet. Set it on the website to turn on clock-in checks.", radiusSaved: "Radius saved", planNeeded: "Time tracking comes with a higher plan.",
    hoursMeta: "{{date}} · {{from}} – {{to}}", hoursMetaNoClock: "{{date}} · typed in", offSite: "{{date}} · outside the site radius", hoursUnit: "{{count}} h",
  },
  photos: { count_one: "{{count}} photo", count_other: "{{count}} photos", selected: "{{count}} of {{total}} selected", select: "Select", clear: "Clear", deleteSelected: "Delete selected", empty: "No photos yet.", share: "Share {{count}} with the client", shared: "Sent to the client", shareFailed: "Couldn’t send them. Try again.", photoFrom: "Photo from {{date}}", deleted: "Deleted" },
  msg: { portal: "Client portal", portalSub: "Your client sees quotes, invoices and photos here", copy: "Copy link", copied: "Copied", opened: "{{name}} opened it {{when}}", notOpened: "Not opened yet", noPortal: "The client portal isn’t on for this job.", composeLabel: "Message", composePlaceholder: "Message {{name}}", send: "Send", empty: "No messages yet.", read: "Read", yesterday: "Yesterday", today: "Today" },
  docs: { empty: "No documents on this job yet.", contract: "Contract {{number}}", signedBy: "Signed by {{name}} · {{date}}", changeOrder: "Change order {{number}}", signedOn: "Signed {{date}}", quote: "Quote {{number}}", acceptedOn: "Accepted {{date}}", invoices: "Invoices", invoicesMeta_one: "{{count}} invoice", invoicesMeta_other: "{{count}} invoices", receipts: "Receipts", filesMeta_one: "{{count}} file", filesMeta_other: "{{count}} files", permit: "Permit" },
  ask: { title: "The assistant", body: "Ask about this job, get a client update drafted, check the budget. It arrives in a later update.", placeholder: "Ask about this job", chips: { budget: "Where are we on budget?", update: "Write a client update", inspection: "Book the final inspection" } },
};

export const fr: typeof en = {
  back: "Retour",
  more: "Plus d’actions",
  rename: "Renommer le chantier",
  renameTitle: "Renommer le chantier",
  renamePlaceholder: "Nom du chantier",
  renameSave: "Enregistrer",
  map: "Carte",
  noClient: "Pas encore de client", // owner
  status: { planning: "En planification", active: "Actif", suspended: "En pause", completed: "Terminé", setup: "À valider" },
  milestonesDone: "Étapes · {{done}} sur {{total}} terminées",
  noMilestones: "Pas encore d’étapes", // owner
  cells: {
    contract: "Valeur du contrat", inclCo_one: "dont {{amount}} d’ordre de changement", inclCo_other: "dont {{amount}} d’ordres de changement", taxIncluded: "Taxes comprises",
    invoiced: "Facturé", invoicedIn: "{{amount}} reçus", invoicedLate: "{{amount}} en retard", nothingInvoiced: "Rien de facturé", // owner (last)
    costs: "Coûts", costsOfBudget: "{{pct}} du budget", costsNoBudget: "Aucun budget", toReview_one: "{{count}} à vérifier", toReview_other: "{{count}} à vérifier",
    margin: "Marge prévue", onTarget: "{{amount}} · dans la cible", offTarget: "{{amount}} · sous la cible", // owner (last)
  },
  quick: {
    omw: "En route", omwSent: "Heure envoyée", photo: "Ajouter une photo", voice: "Note vocale", listening: "Touchez pour arrêter", writing: "Je note…", voiceSaved: "Note vocale enregistrée", voiceFailed: "Je n’ai pas compris. Réessayez.", photoAdded: "Photo ajoutée", // owner (last five)
   
    noClient: "Ce chantier n’a pas de client à texter.", noPhone: "Ce client n’a pas de numéro de téléphone.", omwFailed: "Impossible d’envoyer le texto. Réessayez.", optedOut: "Ce client a demandé de ne plus recevoir de textos.", // owner
    photoFailed: "Impossible d’ajouter la photo. Réessayez.", unavailable: "Pas encore disponible sur ce téléphone.", denied: "Autorisez la caméra ou le micro pour le faire.", // owner
  },
  menu: { hold: "Mettre en pause", resume: "Reprendre le chantier", complete: "Marquer comme terminé", archive: "Archiver le chantier" }, // owner
  tabsLabel: "Sections du chantier",
  tabs: { overview: "Aperçu", schedule: "Horaire", co: "Ordres de changement", costs: "Coûts", inv: "Factures", team: "Équipe", photos: "Photos", msg: "Messages", docs: "Documents", ask: "Assistant" },
  primary: {
    overview: "Noter l’avancement", schedule: "Noter l’avancement", co: "Nouvel ordre de changement", costs: "Numériser un reçu", team: "Saisir des heures", photos: "Prendre une photo", photosShare: "Partager {{count}} avec le client",
    msg: "Écrire au client", docs: "Partager un document", ask: "Demander à l’assistant", invCreate: "Facturer l’étape {{n}}", invSend: "Envoyer {{number}}", invNone: "Nouvelle facture", // owner (last)
  },
  loadFailed: { title: "Impossible de charger ce chantier", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  notFound: { title: "Ce chantier n’est plus là", body: "Il a peut-être été archivé ou supprimé.", action: "Retour aux chantiers" }, // owner
  offline: "Vous êtes hors ligne. Voici les dernières données vues sur ce téléphone.", // owner
  failed: "Impossible de le faire. Réessayez.", // owner
  saving: "Enregistrement…", // owner
  field: {
    title: "Du terrain", open_one: "{{count}} ouvert", open_other: "{{count}} ouverts", allSorted: "Tout est réglé",
    clearLead: "Rien ne bloque l’équipe.", clearBody: "Les nouvelles questions du chantier arrivent ici.",
    kind: { blocker: "Question", materials: "Matériel", note: "Note" },
    answer: "Répondre", sorted: "Marquer réglé", answerTitle: "Répondre à {{name}}", answerPlaceholder: "Écrivez votre réponse", answerSend: "Envoyer la réponse", answerSub: "{{name}} le voit sur la page de l’équipe.", // owner
    crewMember: "l’équipe",
  },
  today: { title: "Aujourd’hui sur place", schedule: "Horaire", onSite: "Sur place", notIn: "Pas encore arrivé", booked: "Réservé", empty: "Personne n’est réservé sur ce chantier aujourd’hui.", allDay: "Toute la journée" }, // owner (last three)
  next: {
    title: "Ensuite", due: "{{date}} · reste {{left}} tâches sur {{total}}", dueNoTasks: "{{date}}", noDate: "Reste {{left}} tâches sur {{total}}", noTasks: "Pas encore de tâches", // owner
    inProgress: "En cours", planned: "À venir", releases: "Débloque un paiement", term: "{{label}} · {{pct}} du contrat", termNoPct: "{{label}}", invoiceWhenDone: "Facturer une fois fini", invoiced: "Facturé",
    allDone: "Toutes les étapes sont terminées", // owner
  },
  budget: { title: "Budget et réel", of: "{{spent}} sur {{planned}}", mark: "Travail fait, {{pct}}", empty: "Aucun budget. Ajoutez-en un dans la préparation du chantier.", categories: { materials: "Matériaux", labour: "Main-d’œuvre", subcontractor: "Sous-traitants", permits_fees: "Permis et frais", equipment: "Équipement", misc: "Divers" } },
  permits: {
    title: "Permis et inspections", add: "Ajouter", empty: "Aucun permis sur ce chantier.",
    status: { needed: "À demander", applied: "Demandé", issued: "Délivré", closed: "Fermé", not_required: "Non requis" },
    inspection: "Inspection le {{date}}", metaAuthority: "{{authority}} · {{ref}}", kinds: { building: "Permis de construction", demolition: "Permis de démolition", electrical: "Permis d’électricité", plumbing: "Permis de plomberie", gas: "Permis de gaz", hvac: "Permis CVC", other: "Autre" },
    sheetTitle: "Ajouter un permis", name: "Permis ou inspection", namePlaceholder: "Permis de plomberie", authority: "Qui le délivre", authorityPlaceholder: "Ville de Toronto", save: "Ajouter", saved: "Ajouté", // owner
  },
  notes: { title: "Notes", add: "Ajouter une note", empty: "Aucune note.", source: { manual: "Tapé", voice: "Dicté", photo: "D’après une photo", assistant: "Assistant" }, sheetTitle: "Ajouter une note", placeholder: "Que doit savoir l’équipe?", save: "Enregistrer la note", saved: "Note ajoutée", line: "{{source}} · {{who}} · {{when}}" },
  schedule: {
    milestones: "Étapes", editDates: "Modifier les dates", done: "Terminée", inProgress: "En cours", upcoming: "À venir", skipped: "Sautée",
    dates: "{{dates}} · {{tasks}}", tasksOf: "{{done}} tâches sur {{total}}", tasks_one: "{{count}} tâche", tasks_other: "{{count}} tâches", fromSite: "Du chantier · {{name}}",
    addTask: "Ajouter une tâche", taskPlaceholder: "Qu’y a-t-il à faire?", complete: "Terminer l’étape", completed: "Étape terminée", start: "Commencer l’étape", reopen: "Rouvrir", skip: "Sauter", // owner (several)
    crew: "Équipe, 4 prochaines semaines", openSchedule: "Ouvrir l’horaire", thisJob: "Ce chantier", otherJobs: "Autres chantiers", clash: "Conflit", noCrew: "Personne n’est réservé sur ce chantier dans les quatre prochaines semaines.", // owner (last)
    clashBanner_one: "{{name}} est réservé deux fois le {{day}}", clashBanner_other: "{{count}} doubles réservations dans les quatre prochaines semaines", clashFix: "Corriger", // owner
  },
  co: { title: "Ordres de changement", signedAdd: "Signés : {{amount}} · {{days}}", signedNone: "Aucun signé pour l’instant", days_one: "+{{count}} jour", days_other: "+{{count}} jours", daysLess: "{{count}} jours",
    status: { draft: "Brouillon", sent: "En attente", signed: "Signé", declined: "Refusé", voided: "Annulé", toSign: "À signer" }, meta: "{{number}} · {{days}} · {{when}}", signedOn: "signé le {{date}}", sentOn: "envoyé le {{date}}", draftOn: "préparé le {{date}}", new: "Nouvel ordre de changement", empty: "Aucun ordre de changement." },
  costs: {
    scan: "Numériser un reçu", scanSub: "Fournisseur, taxes et catégorie lus pour vous", review: "À vérifier", receipts_one: "{{count}} reçu", receipts_other: "{{count}} reçus", doneLead: "Tous les reçus sont confirmés.", doneBody: "Les coûts sont à jour.",
    confirm: "Confirmer", confirmed: "Confirmé", entries: "Entrées", byCategory: "Par catégorie", budget: "Budget et réel", used: "{{pct}} utilisé", confidence: { high: "sûr", medium: "assez sûr", low: "à vérifier" }, takePhoto: "Prendre une photo", choosePhoto: "Choisir une photo", scanTitle: "Numériser un reçu", reading: "Lecture du reçu…", noEntries: "Aucun coût pour l’instant.",
    entryMeta: "{{category}} · {{source}} · {{date}}", source: { receipt: "Reçu", time: "Temps", bank: "Relevé bancaire", manual: "Manuel", equipment: "Utilisation", travel: "Déplacements", other: "Autre" },
    scanned: "Reçu ajouté. Vérifiez-le sous À vérifier.", scanFailed: "Impossible de lire ce reçu. Réessayez.", // owner
  },
  inv: {
    invoiced: "Facturé", invoices_one: "{{count}} facture", invoices_other: "{{count}} factures", collected: "Encaissé", paid_one: "{{count}} payée", paid_other: "{{count}} payées", outstanding: "Solde dû", lateBy_one: "{{number}} · {{count}} jour de retard", lateBy_other: "{{number}} · {{count}} jours de retard", none: "Rien à payer", // owner (last)
    term: "Étape {{n}}", toInvoice: "Reste à facturer", termsLeft_one: "{{count}} étape restante", termsLeft_other: "{{count}} étapes restantes", plan: "Plan de facturation", fromContract: "Tiré du contrat", create: "Créer", manual: "Facture manuelle",
    status: { paid: "Payée", late: "En retard", draft: "Brouillon", open: "Ouverte", held: "Retenue", sent: "Envoyée", partial: "Partiellement payée" }, dueWhenDone: "{{pct}} · due à la fin de l’étape", paidOn: "{{pct}} · {{number}} · payée le {{date}}", dueOn: "{{pct}} · {{number}} · due le {{date}}", draftMeta: "{{pct}} · {{number}} brouillon", daysLate_one: "{{count}} j de retard", daysLate_other: "{{count}} j de retard",
    holdback: "Libération de la retenue", created: "Facture préparée", createFailed: "Impossible de la créer. Réessayez.", noPlan: "Pas encore de plan de facturation. Il vient d’un contrat signé.", // owner
  },
  team: {
    hours: "Heures à approuver", approveAll: "Tout approuver", approve: "Approuver", approved: "Approuvées", hoursNone: "Aucune heure en attente.", log: "Saisir des heures", assigned: "Affectés", assign: "Affecter", onThisJob: "sur ce chantier", noCrew: "Personne n’est affecté pour l’instant.",
    logTitle: "Saisir des heures", who: "Qui a travaillé", hoursField: "Heures", dateField: "Date", noteField: "Note (facultatif)", saveHours: "Enregistrer les heures", hoursSaved: "Heures enregistrées", assignTitle: "Affecter à ce chantier", assignNone: "Tout le monde est déjà sur ce chantier.", assigned2: "Ajouté au chantier", removeFrom: "Retirer {{name}} de ce chantier", radiusTitle: "Rayon de pointage", radiusSub: "L’équipe peut pointer à cette distance du chantier.", radiusSave: "Enregistrer le rayon", radiusNoPin: "L’emplacement du chantier n’est pas défini. Définissez-le sur le site web pour activer la vérification du pointage.", radiusSaved: "Rayon enregistré", planNeeded: "Le suivi du temps vient avec un forfait supérieur.", // owner
    location: "Emplacement du chantier", locationSub: "{{address}} · rayon de {{radius}} m pour pointer", locationNone: "Pas encore défini", locationNoAddress: "Aucune adresse",
    hoursMeta: "{{date}} · {{from}} – {{to}}", hoursMetaNoClock: "{{date}} · saisi à la main", offSite: "{{date}} · hors du rayon du chantier", hoursUnit: "{{count}} h",
  },
  photos: { count_one: "{{count}} photo", count_other: "{{count}} photos", selected: "{{count}} sur {{total}} sélectionnées", select: "Sélectionner", clear: "Effacer", deleteSelected: "Supprimer la sélection", empty: "Aucune photo.", share: "Partager {{count}} avec le client", shared: "Envoyé au client", shareFailed: "Impossible de les envoyer. Réessayez.", photoFrom: "Photo du {{date}}", deleted: "Supprimé" },
  msg: { portal: "Portail client", portalSub: "Votre client y voit soumissions, factures et photos", copy: "Copier le lien", copied: "Copié", opened: "{{name}} l’a ouvert {{when}}", notOpened: "Pas encore ouvert", noPortal: "Le portail client n’est pas activé pour ce chantier.", composeLabel: "Message", composePlaceholder: "Écrire à {{name}}", send: "Envoyer", empty: "Aucun message.", read: "Lu", yesterday: "Hier", today: "Aujourd’hui" },
  docs: { empty: "Aucun document pour ce chantier.", contract: "Contrat {{number}}", signedBy: "Signé par {{name}} · {{date}}", changeOrder: "Ordre de changement {{number}}", signedOn: "Signé le {{date}}", quote: "Soumission {{number}}", acceptedOn: "Acceptée le {{date}}", invoices: "Factures", invoicesMeta_one: "{{count}} facture", invoicesMeta_other: "{{count}} factures", receipts: "Reçus", filesMeta_one: "{{count}} fichier", filesMeta_other: "{{count}} fichiers", permit: "Permis" },
  ask: { title: "L’assistant", body: "Posez une question sur ce chantier, faites rédiger un suivi au client, vérifiez le budget. Il arrive dans une prochaine mise à jour.", placeholder: "Question sur ce chantier", chips: { budget: "Où en est le budget?", update: "Écrire un suivi au client", inspection: "Réserver l’inspection finale" } },
};
