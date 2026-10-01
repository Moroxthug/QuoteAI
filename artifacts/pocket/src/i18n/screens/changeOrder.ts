// ChangeOrder.dc.html and ChangeOrderFR.dc.html. French follows ChangeOrderFR; // owner = my own wording, to review. (new) = not on the board.
export const en = {
  back: "Back",
  stepsLabel: "Change order steps",
  steps: { describe: "Describe", review: "Review", sent: "Sent", signed: "Signed" },
  describe: {
    title: "What’s changing?", how: "How to describe it", talk: "Talk", type: "Type",
    tapToTalk: "Tap to talk", listening: "Listening…", gotIt: "Got it", sayIt: "Say what the client asked for", addMore: "Tap the mic to add more",
    start: "Start recording", stop: "Stop recording", describeLabel: "Describe the change", titleLabel: "Title the client sees", titlePlaceholder: "Four pot lights, family room",
    write: "Write the change order", writing: "Writing it…",
    noMic: "The microphone isn’t available here. Type it instead.", micDenied: "Allow the microphone to talk.", heardNothing: "Couldn’t catch that. Try again or type it.",
    needText: "Say or type what’s changing first.", // (new)
  },
  review: {
    draft: "Draft", addsTo: "Adds to {{number}}", thisChange: "This change, incl. tax", contractNow: "Contract now", newTotal: "New total", schedule: "Schedule",
    days_one: "+{{count}} day", days_other: "+{{count}} days", noDays: "No change", daysLess_one: "{{count}} day", daysLess_other: "{{count}} days",
    lines: "Lines", addLine: "Add line", subtotal: "Subtotal", tax: "Tax", total: "Change order total",
    lineSheet: "Line", lineDescription: "What it is", lineQty: "Quantity", lineUnit: "Unit", linePrice: "Price each", lineSave: "Save line", lineDelete: "Remove this line",
    scheduleTitle: "Schedule", addsDays_one: "Adds {{count}} working day", addsDays_other: "Adds {{count}} working days", addsNone: "Doesn’t change the schedule", lessDay: "Less", moreDay: "More",
    billed: "How it’s billed", billNext: "Add to the next progress bill", billNextSub: "With the next progress invoice",
    sendTo: "Send to", noEmail: "This client has no email address. Add one on the client first.", email: "Email",
    signNote: "Sending signs this change order for you as {{name}}.", // (new)
    edit: "Edit", send: "Send for signature", sending: "Sending…",
    noLines: "No lines yet. Add what the change costs.", draftedBy: "Drafted from what you said. Check each price.", draftFailed: "Couldn’t draft the lines. Add them by hand.", // (new)
    saveFailed: "Couldn’t save the draft. Try again.", noContract: "Change orders need a signed contract behind the job.",
  },
  sent: {
    sentTo: "Sent to {{name}}", at: "Today at {{time}} by email", atDate: "{{date}} at {{time}} by email", awaiting: "Awaiting signature", ifSigned: "If signed", finish: "Finish", adds: "adds {{days}}", addsNone: "no change to the schedule",
    progress: "Progress", sentRow: "Sent to {{name}}", sentSub: "Email, with the signing link", opens: "Opens the link", opened: "Opened the link", openedSub: "{{name}} has seen it", waiting: "Waiting", notify: "You’ll get a notification",
    signs: "Signs", signsSub: "Budget, schedule and billing update on their own", reminder: "Reminder sent", reminderSub: "Email with the signing link",
    remind: "Remind {{name}}", reminded: "Reminder sent", remindFailed: "Couldn’t send it. Try again.",
    declined: "Declined", voided: "Voided", declinedLead: "{{name}} declined this change order.", voidedLead: "This change order was voided.", // (new)
  },
  signed: {
    by: "Signed by {{name}}", at: "Today at {{time}}", atDate: "{{date}} at {{time}}", pill: "Signed", pdf: "Signed PDF saved to the job’s documents", updated: "Updated for you",
    contractValue: "Contract value", contractSub: "{{number}} with the signed change orders", schedule: "Schedule", scheduleSub_one: "Finish moves {{count}} working day", scheduleSub_other: "Finish moves {{count}} working days",
    back: "Back to the job",
  },
  loadFailed: { title: "Couldn’t load this change order", body: "Check your connection and try again.", retry: "Try again" },
  notFound: { title: "This change order isn’t here", body: "It may have been removed.", action: "Back to the job" },
  more: "More actions", menu: { delete: "Delete this draft", void: "Void this change order" }, deleteFailed: "Couldn’t delete it.",
};

export const fr: typeof en = {
  back: "Retour",
  stepsLabel: "Étapes de l’ordre de changement",
  steps: { describe: "Description", review: "Révision", sent: "Envoi", signed: "Signature" },
  describe: {
    title: "Qu’est-ce qui change ?", how: "Comment le décrire", talk: "Dicter", type: "Écrire",
    tapToTalk: "Touchez pour parler", listening: "J’écoute…", gotIt: "Compris", sayIt: "Dites ce que le client a demandé", addMore: "Touchez le micro pour en ajouter",
    start: "Commencer l’enregistrement", stop: "Arrêter l’enregistrement", describeLabel: "Décrivez le changement", titleLabel: "Titre vu par le client", titlePlaceholder: "4 encastrés, salle familiale",
    write: "Rédiger l’ordre de changement", writing: "Rédaction…", // owner
    noMic: "Le micro n’est pas disponible ici. Écrivez-le plutôt.", micDenied: "Autorisez le micro pour dicter.", heardNothing: "Je n’ai pas compris. Réessayez ou écrivez-le.", // owner
    needText: "Dites ou écrivez d’abord ce qui change.", // owner
  },
  review: {
    draft: "Brouillon", addsTo: "S’ajoute à {{number}}", thisChange: "Ce changement, taxes incl.", contractNow: "Contrat actuel", newTotal: "Nouveau total", schedule: "Échéancier",
    days_one: "+{{count}} jour", days_other: "+{{count}} jours", noDays: "Aucun changement", daysLess_one: "{{count}} jour", daysLess_other: "{{count}} jours",
    lines: "Lignes", addLine: "Ajouter une ligne", subtotal: "Sous-total", tax: "Taxes", // owner (the board names the province tax, TVH 13 %)
    total: "Total de l’ordre de changement",
    lineSheet: "Ligne", lineDescription: "De quoi s’agit-il", lineQty: "Quantité", lineUnit: "Unité", linePrice: "Prix l’unité", lineSave: "Enregistrer la ligne", lineDelete: "Retirer cette ligne", // owner
    scheduleTitle: "Échéancier", addsDays_one: "Ajoute {{count}} jour ouvrable", addsDays_other: "Ajoute {{count}} jours ouvrables", addsNone: "Ne change pas l’échéancier", lessDay: "Moins", moreDay: "Plus", // owner (last three)
    billed: "Facturation", billNext: "Ajouter à la prochaine facture d’étape", billNextSub: "Avec la prochaine facture d’étape",
    sendTo: "Envoyer à", noEmail: "Ce client n’a pas de courriel. Ajoutez-en un sur sa fiche d’abord.", email: "Courriel", // owner (noEmail)
    signNote: "L’envoi signe cet ordre de changement à votre place, au nom de {{name}}.", // owner
    edit: "Modifier", send: "Envoyer pour signature", sending: "Envoi…", // owner
    noLines: "Pas encore de lignes. Ajoutez ce que coûte le changement.", draftedBy: "Rédigé d’après vos mots. Vérifiez chaque prix.", draftFailed: "Impossible de rédiger les lignes. Ajoutez-les à la main.", // owner
    saveFailed: "Impossible d’enregistrer le brouillon. Réessayez.", noContract: "Un ordre de changement exige un contrat signé derrière le chantier.", // owner
  },
  sent: {
    sentTo: "Envoyé à {{name}}", at: "Aujourd’hui à {{time}}, par courriel", atDate: "{{date}} à {{time}}, par courriel", awaiting: "En attente de signature", ifSigned: "Si signé", finish: "Fin", adds: "ajoute {{days}}", addsNone: "aucun changement à l’échéancier",
    progress: "Suivi", sentRow: "Envoyé à {{name}}", sentSub: "Courriel, avec le lien de signature", opens: "Ouvre le lien", opened: "A ouvert le lien", openedSub: "{{name}} l’a vu", waiting: "En attente", notify: "Vous recevrez une notification",
    signs: "Signe", signsSub: "Budget, échéancier et facturation se mettent à jour automatiquement", reminder: "Rappel envoyé", reminderSub: "Courriel avec le lien de signature",
    remind: "Relancer {{name}}", reminded: "Rappel envoyé", remindFailed: "Impossible de l’envoyer. Réessayez.", // owner (last)
    declined: "Refusé", voided: "Annulé", declinedLead: "{{name}} a refusé cet ordre de changement.", voidedLead: "Cet ordre de changement a été annulé.", // owner
  },
  signed: {
    by: "Signé par {{name}}", at: "Aujourd’hui à {{time}}", atDate: "{{date}} à {{time}}", pill: "Signé", pdf: "PDF signé enregistré dans les documents du chantier", updated: "Mis à jour pour vous",
    contractValue: "Valeur du contrat", contractSub: "{{number}} avec les ordres de changement signés", schedule: "Échéancier", scheduleSub_one: "La fin recule d’{{count}} jour ouvrable", scheduleSub_other: "La fin recule de {{count}} jours ouvrables", // owner (sub)
    back: "Retour au chantier",
  },
  loadFailed: { title: "Impossible de charger cet ordre de changement", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  notFound: { title: "Cet ordre de changement n’est plus là", body: "Il a peut-être été supprimé.", action: "Retour au chantier" }, // owner
  more: "Plus d’actions", menu: { delete: "Supprimer ce brouillon", void: "Annuler cet ordre de changement" }, deleteFailed: "Impossible de le supprimer.", // owner
};
