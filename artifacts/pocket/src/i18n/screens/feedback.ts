// Feedback (Feedback.dc.html and FeedbackFR). French follows the board; the rest is my own wording, to review.
export const en = {
  title: "Send feedback", close: "Close", offline: { lead: "You’re offline.", body: "We’ll keep it on this phone and send it when you’re back." },
  shotLabel: "Screenshot with your marks", noShot: "No screenshot", markUp: "Mark up", undoMark: "Undo mark", addShot: "Add screenshot", removeShot: "Remove screenshot",
  hintOn: "Draw with your finger. Tap Mark up again when you’re done.", hint: "Circle anything that looks off.", hintNoShot: "Add a screenshot of what you mean.",
  kinds: ["Something’s wrong", "Idea", "Question"], kind: "Kind of feedback", noteLabel: "What happened?",
  placeholders: ["What happened, and what did you expect?", "What would make this easier?", "What are you trying to do?"],
  logs: { label: "Include logs", sub: "App version, phone model and the screen you were on. No client details." }, reply: { label: "OK to email me back" },
  from: "From {{screen}} · {{version}}",
  send: "Send", sending: "Sending…", saveLater: "Save and send later",
  done: { sent: "Thanks, sent", saved: "Saved, sends later", textReply: "We read every note. If we need more, we’ll email {{email}}.", text: "We read every note. Thanks for helping us fix it.", textSaved: "It’s on this phone and goes out as soon as you’re back online.", ref: "Reference", shot: "Screenshot", logs: "Logs", attached: "Attached", none: "None", notIncluded: "Not included", back: "Back", another: "Send another", waiting: "Waiting" },
  needNote: "Write a note or add a screenshot first.", noPhotos: "Allow photos in your phone’s settings to add a screenshot.", failed: "Couldn’t send that. Try again.", tooMany: "That’s a lot of notes this hour. Try again later.",
  screens: { default: "Quote" },
};

export const fr: typeof en = {
  title: "Envoyer un commentaire", close: "Fermer", offline: { lead: "Vous êtes hors ligne.", body: "Nous le gardons sur ce téléphone et l’enverrons à votre retour en ligne." },
  shotLabel: "Capture d’écran avec vos annotations", noShot: "Aucune capture", markUp: "Annoter", undoMark: "Effacer", addShot: "Ajouter une capture", removeShot: "Retirer la capture",
  hintOn: "Dessinez avec le doigt. Touchez Annoter de nouveau pour terminer.", hint: "Encerclez ce qui semble anormal.", hintNoShot: "Ajoutez une capture de ce dont vous parlez.",
  kinds: ["Un problème", "Idée", "Question"], kind: "Type de commentaire", noteLabel: "Que s’est-il passé ?",
  placeholders: ["Que s’est-il passé, et à quoi vous attendiez-vous ?", "Qu’est-ce qui vous simplifierait la tâche ?", "Qu’essayez-vous de faire ?"],
  logs: { label: "Joindre les journaux", sub: "Version de l’app, modèle du téléphone et l’écran où vous étiez. Aucune donnée client." }, reply: { label: "Me répondre par courriel" },
  from: "Depuis {{screen}} · {{version}}",
  send: "Envoyer", sending: "Envoi…", saveLater: "Enregistrer, envoyer plus tard",
  done: { sent: "Merci, c’est envoyé", saved: "Enregistré, envoi plus tard", textReply: "Nous lisons chaque message. S’il nous faut plus de détails, nous écrirons à {{email}}.", text: "Nous lisons chaque message. Merci de nous aider à corriger le problème.", textSaved: "Il est sur ce téléphone et partira dès votre retour en ligne.", ref: "Référence", shot: "Capture d’écran", logs: "Journaux", attached: "Jointe", none: "Aucune", notIncluded: "Non inclus", back: "Retour", another: "En envoyer un autre", waiting: "En attente" },
  needNote: "Écrivez d’abord un message ou ajoutez une capture.", noPhotos: "Autorisez les photos dans les réglages du téléphone pour ajouter une capture.", failed: "Impossible d’envoyer. Réessayez.", tooMany: "Beaucoup de messages cette heure. Réessayez plus tard.",
  screens: { default: "Soumission" },
};
