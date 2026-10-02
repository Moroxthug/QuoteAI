// SetMessaging (SetMessaging.dc.html and SetMessagingFR). French follows the board; the rest is my own wording, to review.
export const en = {
  back: "Back", close: "Close", title: "SMS and WhatsApp", lede: "Texts to clients, leads and crew",
  readOnly: { lead: "View only.", body: "Your role can see these settings but not change them. Ask the owner." },
  usedUp: { lead: "Texts used up until {{date}}.", body: "Quotes and reminders go out by email until then. Change plans on quoteai.ca." },
  unavailable: { lead: "Texting isn’t switched on yet.", body: "We’ll tell you here when your business number is ready." },
  loadFailed: { title: "Couldn’t load your messaging settings", body: "Check your connection and try again.", retry: "Try again" },
  number: { label: "Your business number", none: "Not set up yet", active: "Active", paused: "Paused", off: "Off" },
  meters: { texts: "Texts this month", wa: "WhatsApp messages", resets: "Resets {{date}}", usedUp: "Used up · resets {{date}}", unlimited: "No limit this month" },
  of: "of",
  texts: {
    title: "Texts", sms: { label: "Text messages", sub: "Quote and invoice links, reminders", paused: "Paused until {{date}}" },
    leadFu: { label: "Lead follow-ups", sub: "When a new lead waits for a reply" }, crew: { label: "Crew reminders", sub: "Tomorrow’s site, the night before at 7 pm" },
    test: { label: "Send a test", sub: "To your phone, {{phone}}", noPhone: "Add your phone in Company details first", button: "Send", sent: "Sent" },
  },
  wa: {
    title: "WhatsApp", label: "WhatsApp Business", on: "Connected", off: "Not connected", subOn: "{{phone}}", subOff: "Clients get quotes and replies in WhatsApp",
    pref: { label: "Use it when clients prefer it", sub: "Otherwise we send a text" }, disconnect: { label: "Disconnect", sub: "Messages go back to text and email", button: "Disconnect" },
    connect: { label: "Connect your number", sub: "We send a 6-digit code to WhatsApp", button: "Connect" }, foot: "Needs a WhatsApp Business account on a number you own. Takes about 5 minutes.",
    sheet: { title: "Connect WhatsApp", numberSub: "The number of your WhatsApp Business account.", number: "WhatsApp number", send: "Send the code", codeSub: "We sent a 6-digit code to {{phone}} on WhatsApp.", code: "6-digit code", verify: "Connect", back: "Use another number", sentAgain: "Code sent." },
    unavailable: "WhatsApp isn’t available yet.", planOnly: "WhatsApp is included from Pro.", taken: "That number is already linked to another account.", badNumber: "Check the number and try again.", badCode: "That code isn’t right.", expired: "That code expired. Ask for a new one.", connected: "WhatsApp is connected.", disconnected: "WhatsApp is disconnected.",
  },
  templates: { title: "WhatsApp templates", foot: "Edit the wording in Message templates.", quote: ["Quote ready", "Link to the quote"], invoice: ["Invoice reminder", "Balance and pay link"], way: ["On my way", "Arrival time for the client"], review: ["Review request", "Google and HomeStars links"], lead: ["Lead follow-up", "A first reply to a new lead"] },
  quiet: { title: "Quiet hours", label: "Quiet hours", sub: "Messages wait until morning", from: "From", fromSub: "Every day", until: "Until", untilSub: "Crew reminders too" },
  optOut: { title: "Opt-outs", stop: "Reply STOP to opt out", stopSub: "Added to each client’s first message", always: "Always on", list: "Opted out", listSub: "They get email only", count_one: "{{count}} client", count_other: "{{count}} clients", foot: "Canada’s anti-spam law (CASL) needs consent and an easy way out. We handle both.", sheet: "Opted out", sheetSub: "These numbers don’t get texts from you.", none: "Nobody has opted out.", stopWord: "Replied STOP", manual: "Asked by hand" },
  log: {
    title: "Recent messages", none: "No messages yet.", states: { sent: "Sent", received: "Received", failed: "Failed", skipped: "Skipped" },
    purpose: { lead_followup: "Lead follow-up", quote_followup: "Follow-up", quote_send: "Quote link", contract_reminder: "Contract reminder", invoice_reminder: "Invoice reminder", on_my_way: "On my way", appointment_reminder: "Appointment reminder", test: "Test", reply: "Reply", opt_out: "Opted out", opt_in: "Opted in", other: "Message" },
  },
  toast: { failed: "Couldn’t save that.", offline: "You’re offline. Try again when you’re back online.", noAccess: "Only the owner can change this.", testSent: "Test text sent to {{phone}}.", testFailed: "The test text didn’t go out.", testNoPhone: "Add your business phone first.", testOff: "Texting isn’t available yet.", testUsedUp: "No texts left this month." },
};

export const fr: typeof en = {
  back: "Retour", close: "Fermer", title: "Textos et WhatsApp", lede: "Textos aux clients, aux demandes et à l’équipe",
  readOnly: { lead: "Consultation seulement.", body: "Votre rôle permet de voir ces réglages, mais pas de les modifier. Demandez au propriétaire." },
  usedUp: { lead: "Textos épuisés jusqu’au {{date}}.", body: "Soumissions et rappels partent par courriel d’ici là. Changez de forfait sur quoteai.ca." },
  unavailable: { lead: "Les textos ne sont pas encore activés.", body: "Nous vous le dirons ici quand votre numéro d’entreprise sera prêt." },
  loadFailed: { title: "Impossible de charger vos réglages de messagerie", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
  number: { label: "Votre numéro d’entreprise", none: "Pas encore configuré", active: "Actif", paused: "En pause", off: "Désactivé" },
  meters: { texts: "Textos ce mois-ci", wa: "Messages WhatsApp", resets: "Remise à zéro le {{date}}", usedUp: "Épuisé · remise à zéro le {{date}}", unlimited: "Sans limite ce mois-ci" },
  of: "sur",
  texts: {
    title: "Textos", sms: { label: "Envoi de textos", sub: "Liens de soumission et de facture, rappels", paused: "En pause jusqu’au {{date}}" },
    leadFu: { label: "Suivi des demandes", sub: "Quand une demande attend une réponse" }, crew: { label: "Rappels à l’équipe", sub: "Chantier du lendemain, la veille à 19 h" },
    test: { label: "Envoyer un test", sub: "À votre téléphone, {{phone}}", noPhone: "Ajoutez d’abord votre téléphone dans les coordonnées", button: "Envoyer", sent: "Envoyé" },
  },
  wa: {
    title: "WhatsApp", label: "WhatsApp Business", on: "Connecté", off: "Non connecté", subOn: "{{phone}}", subOff: "Soumissions et réponses dans WhatsApp",
    pref: { label: "Si le client le préfère", sub: "Sinon, on envoie un texto" }, disconnect: { label: "Déconnecter", sub: "Retour aux textos et courriels", button: "Déconnecter" },
    connect: { label: "Connecter votre numéro", sub: "Code à 6 chiffres envoyé par WhatsApp", button: "Connecter" }, foot: "Requiert un compte WhatsApp Business sur un numéro à vous. Environ 5 minutes.",
    sheet: { title: "Connecter WhatsApp", numberSub: "Le numéro de votre compte WhatsApp Business.", number: "Numéro WhatsApp", send: "Envoyer le code", codeSub: "Nous avons envoyé un code à 6 chiffres au {{phone}} sur WhatsApp.", code: "Code à 6 chiffres", verify: "Connecter", back: "Utiliser un autre numéro", sentAgain: "Code envoyé." },
    unavailable: "WhatsApp n’est pas encore offert.", planOnly: "WhatsApp est inclus à partir de Pro.", taken: "Ce numéro est déjà lié à un autre compte.", badNumber: "Vérifiez le numéro et réessayez.", badCode: "Ce code n’est pas le bon.", expired: "Ce code a expiré. Demandez-en un nouveau.", connected: "WhatsApp est connecté.", disconnected: "WhatsApp est déconnecté.",
  },
  templates: { title: "Modèles WhatsApp", foot: "Modifiez le texte dans Modèles de messages.", quote: ["Soumission prête", "Lien vers la soumission"], invoice: ["Rappel de facture", "Solde et lien de paiement"], way: ["En route", "Heure d’arrivée pour le client"], review: ["Demande d’avis", "Liens Google et HomeStars"], lead: ["Suivi de demande", "Une première réponse à une nouvelle demande"] },
  quiet: { title: "Heures de silence", label: "Heures de silence", sub: "Les messages attendent le matin", from: "De", fromSub: "Tous les jours", until: "Jusqu’à", untilSub: "Rappels d’équipe inclus" },
  optOut: { title: "Désabonnements", stop: "Répondre STOP", stopSub: "Ajouté au 1er message de chaque client", always: "Toujours actif", list: "Désabonnés", listSub: "Courriel seulement", count_one: "{{count}} client", count_other: "{{count}} clients", foot: "La loi anti-pourriel (LCAP) exige un consentement et un moyen simple de se désabonner. On s’occupe des deux.", sheet: "Désabonnés", sheetSub: "Ces numéros ne reçoivent pas vos textos.", none: "Personne ne s’est désabonné.", stopWord: "A répondu STOP", manual: "Demandé à la main" },
  log: {
    title: "Messages récents", none: "Aucun message pour l’instant.", states: { sent: "Envoyé", received: "Reçu", failed: "Échec", skipped: "Ignoré" },
    purpose: { lead_followup: "Suivi de demande", quote_followup: "Suivi", quote_send: "Lien de soumission", contract_reminder: "Rappel de contrat", invoice_reminder: "Rappel de facture", on_my_way: "En route", appointment_reminder: "Rappel de rendez-vous", test: "Test", reply: "Réponse", opt_out: "Désabonnement", opt_in: "Réabonnement", other: "Message" },
  },
  toast: { failed: "Impossible d’enregistrer.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", noAccess: "Seul le propriétaire peut changer cela.", testSent: "Texto de test envoyé au {{phone}}.", testFailed: "Le texto de test n’est pas parti.", testNoPhone: "Ajoutez d’abord le téléphone de l’entreprise.", testOff: "Les textos ne sont pas encore offerts.", testUsedUp: "Plus de textos ce mois-ci." },
};
