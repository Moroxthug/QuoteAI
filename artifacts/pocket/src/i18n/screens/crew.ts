// CrewNow, CrewHours, CrewTravel, LiveLocation, CrewExpired and their French boards (…FR.dc.html). The crew's phone runs on a pairing code the admin makes.
// // owner = my own wording, to review. (new) = not on the board.
export const en = {
  back: "Back", close: "Close", switchCompany: "Switch company", more: "More: hours by hand, travel", photo: "Take a photo", report: "Report",
  greet: "Hello {{name}}", greetNight: "Hello {{name}}", dateRole: "{{date}} · {{role}}",
  changes: { title: "What changed", gotIt: "Got it", shiftAdded: "New shift", shiftChanged: "A shift changed", shiftRemoved: "A shift was removed", taskAdded: "New task today", taskChanged: "A task changed", taskDone: "A task was ticked", answer: "{{by}} answered your blocker",
    shiftSub: "{{label}}, {{when}}", taskSub: "{{title}} · {{job}}", answerSub: "{{answer}}", someone: "The office" },
  clock: {
    onTheClock: "On the clock", offTheClock: "Off the clock", today: "Today", timerOn: "Since {{time}} · on site", timerOff: "Clocked out at {{time}} · {{dur}} today", timerNone: "Not clocked in today",
    clockIn: "Clock in", clockOut: "Clock out", clockInSub: "At {{job}}", clockOutSub: "Tap when you leave the site", locating: "Locating…", locatingSub: "Checking you are at {{place}}",
    clockedIn: "Clocked in", clockedOut: "Clocked out", matched: "{{time}} · location matched", noFix: "{{time}} · location not checked", offSite: "{{time}} · outside the site radius", queued: "{{time}} · saved on your phone",
    locationNote: "Location is checked only when you clock in or out", noJob: "No job to clock in on yet", alreadyIn: "You are already clocked in", failed: "Couldn’t do that. Try again.", noSignal: "No signal. It’s saved on your phone and sends later.",
    gate: "Gate code", gateSub: "Tap to show", phase: "Phase", change: "Change", directions: "Directions", call: "Call {{name}}", siteLead: "Site lead", noPhone: "No phone number",
    pickJob: "Pick a job", pickJobSub: "Which job are you on?",
  },
  tasks: { title: "Today’s tasks", add: "Add a task", addTitle: "Add a task", addPlaceholder: "What needs doing?", addSave: "Add", new: "New", none: "No tasks today", done: "Done", fromSite: "Added by {{name}}", allDone: "All done. Nice work." },
  upcoming: { title: "Coming up", thisWeek: "This week", none: "Nothing booked in the next two weeks", allDay: "All day" },
  reports: { title: "Your reports", today: "Today", none: "Nothing sent today",
    update: "Update", blocker: "Blocker", materials: "Materials", kindLabel: "Report type",
    updateLabel: "What did you get done?", blockerLabel: "What is stopping you?", materialsLabel: "Anything to note?",
    updatePh: "Back wall hung, starting tape in the bedroom", blockerPh: "Short 4 sheets of 1/2\" board for the hallway", materialsPh: "Picked up at Home Depot, Warden Ave",
    sendUpdate: "Send update", sendBlocker: "Send blocker", sendMaterials: "Send materials", what: "What", whatPh: "Mesh tape, 2 rolls", spent: "Spent", job: "Job",
    addPhoto: "Add a photo", removePhoto: "Remove photo", answered: "Answered", sent: "Sent", pending: "Pending sync", failed: "Failed", sentSub: "Sent to the office", pendingSub: "Saved on your phone, sends when you have signal", failedSub: "Did not send. Tap to try again",
    kind: { blocker: "Blocker", note: "Update", materials: "Materials" }, sheetTitle: "Report", needText: "Write a line first", sending: "Sending…" },
  hours: {
    title: "Hours by hand", sub: "For a day you forgot to clock", dayLabel: "Day", today: "Today", job: "Job", change: "Change", hoursLabel: "Hours", start: "Start", finish: "Finish", break: "Break", none: "None", min: "{{count}} min",
    startEarlier: "Start earlier", startLater: "Start later", finishEarlier: "Finish earlier", finishLater: "Finish later",
    quickUsual: "Usual day", quickHalf: "Half day", quickLong: "Long day", why: "Why by hand", reasons: { forgot: "Forgot to clock", phoneDied: "Phone died", noSignal: "No signal", other: "Something else" },
    note: "Note for {{name}}", pickReason: "Pick a reason first", send: "Send {{dur}} for approval", save: "Save {{dur}}", approves: "{{name}} approves hours added by hand", the: "the office",
    sentTitle: "Sent to {{name}}", sentSub: "They’ll approve it or ask you about it.", savedTitle: "Saved on your phone", savedSub: "It goes to the office as soon as you have signal. Keep this page open or come back later.", another: "Add another day", done: "Done",
    week: "Your hours this week", range: "{{from}}–{{to}}", byHand: "Added by hand · {{reason}}", approved: "Approved", toApprove: "To approve", offSite: "Off site at clock-in", rejected: "Sent back", saved: "Saved on phone", clocked: "Clocked in and out",
    dur: "{{h}}h {{m}}m", failed: "Couldn’t send it. Try again.", future: "Pick a day that has passed",
  },
  travel: {
    title: "Travel", period: "Pay period {{from}} – {{to}}", distance: "Distance", daysAway: "Days away", waiting: "Waiting", perPeriod: "this period", perDiemWord: "per diem", onOffice: "on the office",
    mileage: "Mileage", perDiem: "Per diem", day: "Day", earlier: "Earlier", job: "Job", change: "Change", route: "Route", from: "From", to: "To", fromPh: "Home Depot, Warden Ave", toPh: "Where you drove to",
    km: "{{count}} km", thereBack: "there and back", oneWay: "one way", roundTrip: "Round trip", roundTripSub: "Doubles the distance", kmLess: "Fewer km", kmMore: "More km",
    daysAwayCount_one: "{{count}} day away from home", daysAwayCount_other: "{{count}} days away from home", overnight: "Stayed overnight", overnightSub: "Motel or rental near the site", daysLess: "Fewer days", daysMore: "More days",
    receipt: "Receipt", receiptKm: "Parking or toll receipt", receiptOptional: "If you have one", photo: "Photo", note: "Note", notePhKm: "Picked up board for the hallway", notePhDiem: "Cottage job, two nights in Barrie",
    sendKm: "Send {{count}} km", sendDays_one: "Send {{count}} day", sendDays_other: "Send {{count}} days", saveKm: "Save {{count}} km", saveDays_one: "Save {{count}} day", saveDays_other: "Save {{count}} days",
    checks: "{{name}} checks travel before it goes to pay", sent: "Sent to the office.", sentSub: "You’ll see it here once it’s checked.", savedMsg: "Saved on your phone.", savedSub: "It sends when you have signal.",
    claimed: "Claimed this period", none: "Nothing claimed yet", kmRound: "{{count}} km · round trip", kmOne: "{{count}} km", away_one: "{{count}} day away", away_other: "{{count}} days away", overnightTag: "overnight",
    status: { approved: "Approved", paid: "Paid", submitted: "To approve", rejected: "Sent back", saved: "Saved on phone" }, notForSubs: "Subcontractors bill travel on their own invoice.", notOffered: "Travel isn’t set up for this company yet.", failed: "Couldn’t send it. Try again.",
    fromNeeded: "Say where you drove from",
  },
  location: {
    title: "Location", ask: "Share where you are while you work", on: "Your location is on", off: "Location is off", sharing: "Sharing now", notSharing: "Not sharing",
    askLede: "Only while you are on the clock. The office sees which job you are on, so they can plan the day. It stops the moment you clock out.", onLede: "The office sees On site · {{job}}. It stops at clock out.", offLede: "Nothing is shared. You can turn it on again any time.",
    since: "Sharing since", stopsAt: "Stops at clock out", seeSub: "{{names}} see On site · {{job}}", allow: "Allow while on the clock", turning: "Turning on…", notNow: "Not now", stop: "Stop sharing", shareAgain: "Share again", back: "Back to today",
    note: "Clock in and out still check where you are, once.", denied: "Location is blocked for quoteAI. Turn it on in your phone’s settings.", unavailable: "Location isn’t available on this phone yet.", failed: "Couldn’t find you. Try again outside.", the: "the office",
  },
  expired: {
    expired: { title: "This link has expired", sub: "Links stop working after a while to keep the site details safe. {{who}} can send you a new one." },
    replaced: { title: "You have a newer link", sub: "{{who}} sent a new link to your phone, so this one stopped working. Use the latest one from {{company}}." },
    invalid: { title: "This link doesn’t work", sub: "Part of it may be missing. Open it again, or ask {{who}} for a new one." },
    offline: { title: "No connection", sub: "Your link is fine. The page needs signal to load today’s work." },
    tryAgain: "Try again", trying: "Trying again…", ask: "Ask {{who}} for a new link", asking: "Sending…", asked: "{{who}} has your request", askedSub: "The new link comes with a new code.", askSub: "They get a note with your name",
    or: "or join with a code", codeHint: "6-character code from {{who}}", codeBad: "That code didn’t work. Check it with {{who}}, it may have changed.", codeExpired: "That code has expired. Ask {{who}} for a new one.", join: "Join", joining: "Joining…",
    call: "Call {{who}}", saved: "Your hours, photos and reports are saved with the company. Nothing is lost.", theOffice: "the office", yourCompany: "your company", unknownCompany: "your company",
  },
  pair: { title: "Join your crew", sub: "Type the code your boss gave you. It works once and lasts a week.", found: "Hello {{name}}", foundSub: "You’re joining {{company}}.", joinAs: "Join {{company}}", noAccount: "No password. This phone stays signed in.", other: "Not you?", back: "Back",
    link: "On a crew? Enter your crew code", foremanLink: "Have a team code instead?" },
  offline: "You’re offline. Showing what this phone saw last.",
  queued_one: "{{count}} thing waits to send", queued_other: "{{count}} things wait to send",
  loadFailed: { title: "Couldn’t load today’s work", body: "Check your connection and try again.", retry: "Try again" },
  company: { title: "Switch company", sub: "You’re on more than one crew.", current: "Here now" },
};

export const fr: typeof en = {
  back: "Retour", close: "Fermer", switchCompany: "Changer d’entreprise", more: "Plus : heures à la main, déplacements", photo: "Prendre une photo", report: "Rapport",
  greet: "Bonjour {{name}}", greetNight: "Bonjour {{name}}", dateRole: "{{date}} · {{role}}",
  changes: { title: "Ce qui a changé", gotIt: "Compris", shiftAdded: "Nouveau quart", shiftChanged: "Un quart a changé", shiftRemoved: "Un quart a été retiré", taskAdded: "Nouvelle tâche aujourd’hui", taskChanged: "Une tâche a changé", taskDone: "Une tâche a été cochée", answer: "{{by}} a répondu à votre blocage",
    shiftSub: "{{label}}, {{when}}", taskSub: "{{title}} · {{job}}", answerSub: "{{answer}}", someone: "Le bureau" },
  clock: {
    onTheClock: "Au travail", offTheClock: "Hors quart", today: "Aujourd’hui", timerOn: "Depuis {{time}} · sur place", timerOff: "Départ pointé à {{time}} · {{dur}} aujourd’hui", timerNone: "Pas pointé aujourd’hui",
    clockIn: "Pointer l’arrivée", clockOut: "Pointer le départ", clockInSub: "Au {{job}}", clockOutSub: "Appuyez en quittant le chantier", locating: "Localisation…", locatingSub: "On vérifie que vous êtes au {{place}}",
    clockedIn: "Arrivée pointée", clockedOut: "Départ pointé", matched: "{{time}} · position confirmée", noFix: "{{time}} · position non vérifiée", offSite: "{{time}} · hors du rayon du chantier", queued: "{{time}} · gardé sur votre téléphone", // owner (last three)
    locationNote: "La position est vérifiée seulement à l’arrivée et au départ", noJob: "Pas encore de chantier où pointer", alreadyIn: "Vous êtes déjà pointé", failed: "Impossible de le faire. Réessayez.", noSignal: "Pas de réseau. C’est gardé sur votre téléphone et part plus tard.", // owner
    gate: "Code de la barrière", gateSub: "Touchez pour afficher", phase: "Étape", change: "Changer", directions: "Itinéraire", call: "Appeler {{name}}", siteLead: "Chef de chantier", noPhone: "Pas de numéro",
    pickJob: "Choisir un chantier", pickJobSub: "Sur quel chantier êtes-vous?", // owner
  },
  tasks: { title: "Tâches du jour", add: "Ajouter une tâche", addTitle: "Ajouter une tâche", addPlaceholder: "Qu’y a-t-il à faire?", addSave: "Ajouter", new: "Nouveau", none: "Aucune tâche aujourd’hui", done: "Fait", fromSite: "Ajoutée par {{name}}", allDone: "Tout est fait. Beau travail." }, // owner (several)
  upcoming: { title: "À venir", thisWeek: "Cette semaine", none: "Rien de prévu dans les deux prochaines semaines", allDay: "Toute la journée" },
  reports: { title: "Vos rapports", today: "Aujourd’hui", none: "Rien d’envoyé aujourd’hui",
    update: "Suivi", blocker: "Blocage", materials: "Matériaux", kindLabel: "Type de rapport",
    updateLabel: "Qu’avez-vous fait?", blockerLabel: "Qu’est-ce qui vous bloque?", materialsLabel: "Autre chose à noter?",
    updatePh: "Mur du fond posé, je commence les joints dans la chambre", blockerPh: "Il manque 4 feuilles de gypse ½ po pour le corridor", materialsPh: "Acheté au Home Depot, Warden Ave",
    sendUpdate: "Envoyer le suivi", sendBlocker: "Envoyer le blocage", sendMaterials: "Envoyer les matériaux", what: "Quoi", whatPh: "Ruban treillis, 2 rouleaux", spent: "Dépensé", job: "Chantier",
    addPhoto: "Ajouter une photo", removePhoto: "Retirer la photo", answered: "Répondu", sent: "Envoyé", pending: "À synchroniser", failed: "Échec", sentSub: "Envoyé au bureau", pendingSub: "Gardée sur votre téléphone, part dès qu’il y a du réseau", failedSub: "Pas envoyé. Touchez pour réessayer",
    kind: { blocker: "Blocage", note: "Suivi", materials: "Matériaux" }, sheetTitle: "Rapport", needText: "Écrivez d’abord une ligne", sending: "Envoi…" }, // owner (last two)
  hours: {
    title: "Heures à la main", sub: "Pour une journée non pointée", dayLabel: "Jour", today: "Aujourd’hui", job: "Chantier", change: "Changer", hoursLabel: "Heures", start: "Début", finish: "Fin", break: "Pause", none: "Aucune", min: "{{count}} min",
    startEarlier: "Commencer plus tôt", startLater: "Commencer plus tard", finishEarlier: "Finir plus tôt", finishLater: "Finir plus tard", // owner (four)
    quickUsual: "Journée normale", quickHalf: "Demi-journée", quickLong: "Longue journée", why: "Pourquoi à la main", reasons: { forgot: "Oublié de pointer", phoneDied: "Téléphone à plat", noSignal: "Pas de réseau", other: "Autre chose" },
    note: "Note pour {{name}}", pickReason: "Choisissez d’abord une raison", send: "Envoyer {{dur}} pour approbation", save: "Garder {{dur}}", approves: "{{name}} approuve les heures ajoutées à la main", the: "le bureau",
    sentTitle: "Envoyé à {{name}}", sentSub: "Il l’approuvera ou vous posera une question.", savedTitle: "Gardé sur votre téléphone", savedSub: "Ça part au bureau dès qu’il y a du réseau. Gardez cette page ouverte ou revenez plus tard.", another: "Ajouter un autre jour", done: "Terminé",
    week: "Vos heures cette semaine", range: "{{from}}–{{to}}", byHand: "Ajouté à la main · {{reason}}", approved: "Approuvé", toApprove: "À approuver", offSite: "Hors chantier au pointage", rejected: "Renvoyé", saved: "Gardé sur le téléphone", clocked: "Pointé à l’arrivée et au départ",
    dur: "{{h}} h {{m}} min", failed: "Impossible de l’envoyer. Réessayez.", future: "Choisissez un jour déjà passé", // owner (last three)
  },
  travel: {
    title: "Déplacements", period: "Période de paie du {{from}} au {{to}}", distance: "Distance", daysAway: "Jours d’absence", waiting: "En attente", perPeriod: "cette période", perDiemWord: "indemnité", onOffice: "sur le bureau", // owner (last four)
    mileage: "Kilométrage", perDiem: "Indemnité journalière", day: "Jour", earlier: "Plus tôt", job: "Chantier", change: "Changer", route: "Trajet", from: "De", to: "À", fromPh: "Home Depot, Warden Ave", toPh: "Où vous êtes allé",
    km: "{{count}} km", thereBack: "aller-retour", oneWay: "aller simple", roundTrip: "Aller-retour", roundTripSub: "Double la distance", kmLess: "Moins de km", kmMore: "Plus de km",
    daysAwayCount_one: "{{count}} jour loin de la maison", daysAwayCount_other: "{{count}} jours loin de la maison", overnight: "Nuit sur place", overnightSub: "Motel ou location près du chantier", daysLess: "Moins de jours", daysMore: "Plus de jours",
    receipt: "Reçu", receiptKm: "Reçu de stationnement ou de péage", receiptOptional: "Si vous en avez un", photo: "Photo", note: "Note", notePhKm: "Cherché du gypse pour le corridor", notePhDiem: "Chalet, deux nuits à Barrie",
    sendKm: "Envoyer {{count}} km", sendDays_one: "Envoyer {{count}} jour", sendDays_other: "Envoyer {{count}} jours", saveKm: "Garder {{count}} km", saveDays_one: "Garder {{count}} jour", saveDays_other: "Garder {{count}} jours",
    checks: "{{name}} vérifie les déplacements avant la paie", sent: "Envoyé au bureau.", sentSub: "Vous le verrez ici une fois vérifié.", savedMsg: "Gardé sur votre téléphone.", savedSub: "Ça part dès qu’il y a du réseau.",
    claimed: "Demandés cette période", none: "Rien de demandé", kmRound: "{{count}} km · aller-retour", kmOne: "{{count}} km", away_one: "{{count}} jour d’absence", away_other: "{{count}} jours d’absence", overnightTag: "nuit sur place",
    status: { approved: "Approuvé", paid: "Payé", submitted: "À approuver", rejected: "Renvoyé", saved: "Gardé sur le téléphone" }, notForSubs: "Les sous-traitants facturent leurs déplacements sur leur propre facture.", notOffered: "Les déplacements ne sont pas encore configurés pour cette entreprise.", failed: "Impossible de l’envoyer. Réessayez.", // owner (last three)
    fromNeeded: "Dites d’où vous êtes parti", // owner
  },
  location: {
    title: "Position", ask: "Partagez où vous êtes pendant que vous travaillez", on: "Votre position est activée", off: "Position désactivée", sharing: "Partage actif", notSharing: "Pas de partage",
    askLede: "Seulement quand vous êtes au travail. Le bureau voit sur quel chantier vous êtes, pour planifier la journée. Ça s’arrête dès que vous pointez le départ.", onLede: "Le bureau voit Sur place · {{job}}. Ça s’arrête au départ.", offLede: "Rien n’est partagé. Vous pouvez le réactiver quand vous voulez.", // owner (ledes)
    since: "Partagée depuis", stopsAt: "Arrêt à la fin du quart", seeSub: "{{names}} voient Sur place · {{job}}", allow: "Autoriser pendant le quart", turning: "Activation…", notNow: "Pas maintenant", stop: "Arrêter le partage", shareAgain: "Partager à nouveau", back: "Retour à aujourd’hui",
    note: "Le pointage d’arrivée et de départ vérifie quand même votre position, une fois.", denied: "La position est bloquée pour quoteAI. Activez-la dans les réglages du téléphone.", unavailable: "La position n’est pas encore disponible sur ce téléphone.", failed: "Impossible de vous trouver. Réessayez dehors.", the: "le bureau", // owner (last four)
  },
  expired: {
    expired: { title: "Ce lien a expiré", sub: "Les liens cessent de fonctionner après un moment pour protéger les infos du chantier. {{who}} peut vous en envoyer un nouveau." },
    replaced: { title: "Vous avez un lien plus récent", sub: "{{who}} a envoyé un nouveau lien sur votre téléphone, alors celui-ci ne fonctionne plus. Utilisez le dernier de {{company}}." },
    invalid: { title: "Ce lien ne fonctionne pas", sub: "Il manque peut-être une partie. Rouvrez-le ou demandez-en un nouveau à {{who}}." },
    offline: { title: "Pas de connexion", sub: "Votre lien est bon. La page a besoin de réseau pour charger le travail du jour." },
    tryAgain: "Réessayer", trying: "Nouvel essai…", ask: "Demander un nouveau lien à {{who}}", asking: "Envoi…", asked: "{{who}} a votre demande", askedSub: "Le nouveau lien vient avec un nouveau code.", askSub: "Il reçoit une note avec votre nom", // owner (askedSub, askSub)
    or: "ou entrer avec un code", codeHint: "Code de 6 caractères de {{who}}", codeBad: "Ce code n’a pas fonctionné. Vérifiez avec {{who}}, il a peut-être changé.", codeExpired: "Ce code a expiré. Demandez-en un nouveau à {{who}}.", join: "Entrer", joining: "Connexion…",
    call: "Appeler {{who}}", saved: "Vos heures, photos et rapports sont gardés par l’entreprise. Rien n’est perdu.", theOffice: "le bureau", yourCompany: "votre entreprise", unknownCompany: "votre entreprise",
  },
  pair: { title: "Rejoignez votre équipe", sub: "Entrez le code que votre patron vous a donné. Il sert une fois et dure une semaine.", found: "Bonjour {{name}}", foundSub: "Vous rejoignez {{company}}.", joinAs: "Rejoindre {{company}}", noAccount: "Pas de mot de passe. Ce téléphone reste connecté.", other: "Ce n’est pas vous?", back: "Retour", // owner (all)
    link: "Dans une équipe? Entrez votre code d’équipe", foremanLink: "Un code d’équipe plutôt?" },
  offline: "Vous êtes hors ligne. Voici ce que ce téléphone a vu en dernier.", // owner
  queued_one: "{{count}} chose attend d’être envoyée", queued_other: "{{count}} choses attendent d’être envoyées", // owner
  loadFailed: { title: "Impossible de charger le travail du jour", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  company: { title: "Changer d’entreprise", sub: "Vous êtes dans plus d’une équipe.", current: "Ici maintenant" }, // owner
};
