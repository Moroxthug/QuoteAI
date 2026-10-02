// VideoPlayer (VideoPlayer.dc.html and VideoPlayerFR). Two walkthroughs, as the board draws them: a scene, captions that change with the chapter, and chapters to jump between.
export const en = {
  close: "Close video", offline: "This video needs a connection", offlineSub: "The steps in Help work offline.", retry: "Try again", loading: "Loading", play: "Play", pause: "Pause", back10: "Back 10 seconds", fwd10: "Forward 10 seconds",
  position: "Position", captions: "Captions", speed: "Playback speed {{speed}}", speedTitle: "Speed", ccOn: "English (Canada) · Français available", ccOff: "Off", chapters: "Chapters", playing: "Playing", paused: "Paused", watched: "Watched", chapter: "Chapter {{n}}: {{title}}",
  v: {
    quotes: {
      head: "Watch how", title: "Your first quote", topic: "Quotes", sub: "Talk through a job and send an itemized quote with HST, start to finish.", cta: "Try it now",
      scene: ["Describing the job", "Line 3 of 7", "Drywall, 3 rooms", "$2,480.00", "HST 13% added"],
      ch: [["Tap New quote", "Tap New quote on the Quotes tab."], ["Describe the job", "Say it the way you’d tell the client: three bedrooms, ceilings too."], ["Check the lines", "Every line is itemized. Tap one to change the price."], ["Send it", "Send by text or email, and see when they open it."]],
    },
    overview: {
      head: "quoteAI in 60 seconds", title: "quoteAI in 60 seconds", topic: "Overview", sub: "From a voice note to a paid invoice, in one minute.", cta: "Get started",
      scene: ["Dana Whitfield", "Signed today, 9:12 am", "Bedrooms and bath ceiling", "$4,131.05", "Accepted and signed"],
      ch: [["Talk, and it quotes", "Describe the job. quoteAI writes the quote."], ["The client signs", "Your client accepts and signs from their phone."], ["The job runs", "Crew, schedule, photos and costs in one place."], ["You get paid", "Invoices go out on schedule. Card or e-Transfer."]],
    },
  },
};

export const fr: typeof en = {
  close: "Fermer la vidéo", offline: "Cette vidéo exige une connexion", offlineSub: "Les étapes de l’aide fonctionnent hors ligne.", retry: "Réessayer", loading: "Chargement", play: "Lecture", pause: "Pause", back10: "Reculer de 10 secondes", fwd10: "Avancer de 10 secondes",
  position: "Position", captions: "Sous-titres", speed: "Vitesse de lecture {{speed}}", speedTitle: "Vitesse", ccOn: "Français · English disponible", ccOff: "Désactivés", chapters: "Chapitres", playing: "En lecture", paused: "En pause", watched: "Vu", chapter: "Chapitre {{n}} : {{title}}",
  v: {
    quotes: {
      head: "Voir comment", title: "Votre première soumission", topic: "Soumissions", sub: "Décrivez les travaux de vive voix et envoyez une soumission détaillée avec TVH, du début à la fin.", cta: "Essayer maintenant",
      scene: ["Description des travaux", "Ligne 3 sur 7", "Gypse, 3 pièces", "2 480,00 $", "TVH de 13 % ajoutée"],
      ch: [["Nouvelle soumission", "Touchez Nouvelle soumission dans l’onglet Soumissions."], ["Décrire les travaux", "Dites-le comme au client : trois chambres, les plafonds aussi."], ["Vérifier les lignes", "Chaque ligne est détaillée. Touchez-en une pour changer le prix."], ["L’envoyer", "Envoyez par texto ou par courriel, et voyez quand le client l’ouvre."]],
    },
    overview: {
      head: "quoteAI en 60 secondes", title: "quoteAI en 60 secondes", topic: "Aperçu", sub: "D’une note vocale à une facture payée, en une minute.", cta: "Commencer",
      scene: ["Dana Whitfield", "Signée aujourd’hui, 9 h 12", "Chambres et plafond de salle de bain", "4 131,05 $", "Acceptée et signée"],
      ch: [["Parlez, la soumission suit", "Décrivez les travaux. quoteAI rédige la soumission."], ["Le client signe", "Votre client accepte et signe depuis son téléphone."], ["Le chantier avance", "Équipe, horaire, photos et coûts au même endroit."], ["Vous êtes payé", "Les factures partent à temps. Carte ou virement Interac."]],
    },
  },
};
