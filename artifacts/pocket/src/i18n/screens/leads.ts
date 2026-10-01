// Leads.dc.html and LeadsFR.dc.html. The boards show sample people; the sentences that name real people or dates
// take them as values. French follows LeadsFR; // owner = my own wording, to review.
export const en = {
  title: "Leads",
  back: "Back",
  more: "More actions",
  due_one: "{{open}} open lead · {{due}} follow-ups due today",
  due_other: "{{open}} open leads · {{due}} follow-ups due today",
  dueNone_one: "{{open}} open lead · no follow-ups due today",
  dueNone_other: "{{open}} open leads · no follow-ups due today",
  dueOne_one: "{{open}} open lead · 1 follow-up due today",
  dueOne_other: "{{open}} open leads · 1 follow-up due today",
  add: "New lead",
  stageLabel: "Pipeline stage",
  stages: { new: "New", contacted: "Contacted", quoted: "Quoted", won: "Won", lost: "Lost" },
  won: "Won",
  followUp: "Follow up",
  follow: { today: "Today, {{time}}", tomorrow: "Tomorrow, {{time}}", yesterday: "Yesterday, missed", date: "{{date}}", dateMissed: "{{date}}, missed" },
  source: { website: "Website form", google: "Google Local Services", meta: "Meta lead ads", manual: "Added by you", import: "Imported list" },
  detail: {
    more: "More from {{name}}",
    details: "Details",
    source: "Source",
    plan: "Follow-up plan",
    channel: "Follow-up channel",
    sentNone: "None sent yet",
    sent_one: "{{count}} follow-up sent",
    sent_other: "{{count}} follow-ups sent",
    lastSent: "Last sent {{when}}",
    wonTitle: "Marked won",
    lostTitle: "Marked lost",
    lostSub: "Reach out again next season",
    unsubTitle: "Unsubscribed",
    unsubSub: "No messages will be sent",
    status: { late: "Missed", due: "Due today", plain: "Planned", none: "Not planned" },
  },
  channels: { sms: "Text", email: "Email", whatsapp: "WhatsApp" },
  via: { sms: "by text", email: "by email", whatsapp: "by WhatsApp" },
  viaShort: { sms: "text", email: "email", whatsapp: "WhatsApp" },
  reply: {
    caption: "Suggested reply · {{via}}",
    tag: "Drafted",
    hi: "Hi {{name}},",
    body0: "Just checking in. We'd love to help bring your project to life. Reply here or reach out any time.",
    body1: "We haven't heard back and wanted to make sure your request didn't slip through the cracks. Happy to answer any questions.",
    body2: "This is our last follow-up for now. If timing wasn't right, no worries. We're here whenever you're ready.",
    send: { sms: "Send text", email: "Send email", whatsapp: "Send WhatsApp" },
    sending: "Sending",
    noContact: "No phone or email on file",
  },
  actions: { call: "Call", text: "Text", email: "Email", makeQuote: "Make quote", openQuote: "Open quote", openClient: "Open client", reopen: "Reopen", markLost: "Mark lost" },
  notice: {
    sentMoved: "Sent {{via}}. {{name}} moved to {{stage}}.",
    sent: "Follow-up sent to {{name}} {{via}}.",
    lost: "{{name}} moved to Lost.",
    reopened: "{{name}} moved back to {{stage}}.",
    added: "{{name}} added to New. First follow-up goes out {{when}}.",
    addedNoFollow: "{{name}} added to New.",
    undo: "Undo",
    at: "{{day}} at {{time}}",
    today: "today",
    tomorrow: "tomorrow",
    sendFailed: "Couldn't send to {{name}}. Try again.",
    unsubscribed: "{{name}} unsubscribed and can't be messaged.",
    saveFailed: "Couldn't save that. Try again.",
  },
  form: {
    title: "New lead",
    close: "Close",
    name: "Name",
    namePlaceholder: "Full name",
    email: "Email",
    emailPlaceholder: "name@email.com",
    emailInvalid: "That email doesn't look right.",
    phone: "Phone",
    phonePlaceholder: "(416) 555-0100",
    by: "Follow up by",
    notes: "Notes",
    notesPlaceholder: "What they asked for, where, when",
    cancel: "Cancel",
    save: "Save lead",
    saving: "Saving",
  },
  connect: { title: "Bring leads in on their own", sub: "Website form, Facebook, Instagram, Google Local Services", action: "Connect" },
  empty: {
    new: { title: "No new leads", body: "New requests from your website, ads or a call land here." },
    contacted: { title: "No leads waiting on a reply", body: "Leads you've followed up with show here." },
    quoted: { title: "No quoted leads", body: "Leads you've sent a quote to show here." },
    won: { title: "No won leads yet", body: "Leads that become jobs stay here." },
    lost: { title: "No lost leads", body: "Leads you mark lost stay here, so you can reach out again next season." },
  },
  none: { title: "No leads yet", body: "Requests from your website and ads land here, or add one you got by phone.", action: "New lead" },
  offline: "You're offline. Showing the leads from your last visit.",
  loadFailed: { title: "Couldn't load your leads", body: "Check your connection and try again.", retry: "Try again" },
};

export const fr: typeof en = {
  title: "Pistes",
  back: "Retour",
  more: "Plus d’actions",
  due_one: "{{open}} piste ouverte · {{due}} suivis aujourd’hui",
  due_other: "{{open}} pistes ouvertes · {{due}} suivis aujourd’hui",
  dueNone_one: "{{open}} piste ouverte · aucun suivi aujourd’hui", // owner
  dueNone_other: "{{open}} pistes ouvertes · aucun suivi aujourd’hui", // owner
  dueOne_one: "{{open}} piste ouverte · 1 suivi aujourd’hui", // owner
  dueOne_other: "{{open}} pistes ouvertes · 1 suivi aujourd’hui", // owner
  add: "Nouvelle piste",
  stageLabel: "Étape de la piste",
  stages: { new: "Nouvelles", contacted: "Contactées", quoted: "En soumission", won: "Gagnées", lost: "Perdues" },
  won: "Gagnée",
  followUp: "Suivi",
  follow: { today: "Aujourd’hui, {{time}}", tomorrow: "Demain, {{time}}", yesterday: "Hier, manqué", date: "{{date}}", dateMissed: "{{date}}, manqué" },
  source: { website: "Formulaire du site", google: "Google Services locaux", meta: "Publicités Meta", manual: "Ajoutée par vous", import: "Liste importée" }, // owner: Meta
  detail: {
    more: "Demande {{name}}",
    details: "Détails",
    source: "Provenance",
    plan: "Plan de suivi",
    channel: "Canal de suivi",
    sentNone: "Aucun envoyé pour l’instant", // owner
    sent_one: "{{count}} suivi envoyé", // owner
    sent_other: "{{count}} suivis envoyés", // owner
    lastSent: "Dernier envoi {{when}}", // owner
    wonTitle: "Marquée gagnée", // owner
    lostTitle: "Marquée perdue",
    lostSub: "À relancer la saison prochaine",
    unsubTitle: "Désabonnée", // owner
    unsubSub: "Aucun message ne sera envoyé", // owner
    status: { late: "Manqué", due: "Aujourd’hui", plain: "Planifié", none: "Non planifié" }, // owner: none
  },
  channels: { sms: "Texto", email: "Courriel", whatsapp: "WhatsApp" },
  via: { sms: "par texto", email: "par courriel", whatsapp: "par WhatsApp" },
  viaShort: { sms: "texto", email: "courriel", whatsapp: "WhatsApp" },
  reply: {
    caption: "Réponse suggérée · {{via}}",
    tag: "Rédigée",
    hi: "Bonjour {{name}},", // owner
    body0: "On voulait juste prendre des nouvelles. On serait ravis de vous aider à réaliser votre projet. Répondez ici ou contactez-nous en tout temps.", // owner
    body1: "On n’a pas eu de nouvelles et on voulait s’assurer que votre demande ne soit pas passée inaperçue. On répond avec plaisir à vos questions.", // owner
    body2: "Ceci est notre dernier suivi pour l’instant. Si le moment n’était pas idéal, pas de souci. On reste disponibles quand vous serez prêt.", // owner
    send: { sms: "Envoyer le texto", email: "Envoyer le courriel", whatsapp: "Envoyer sur WhatsApp" },
    sending: "Envoi en cours", // owner
    noContact: "Ni téléphone ni courriel au dossier", // owner
  },
  actions: { call: "Appeler", text: "Texto", email: "Courriel", makeQuote: "Soumissionner", openQuote: "Voir la soumission", openClient: "Voir le client", reopen: "Réactiver", markLost: "Marquer comme perdue" },
  notice: {
    sentMoved: "Envoyé {{via}}. {{name}} passe à {{stage}}.",
    sent: "Suivi envoyé à {{name}} {{via}}.",
    lost: "{{name}} : piste déplacée dans Perdues.",
    reopened: "{{name}} : piste remise dans {{stage}}.", // owner
    added: "{{name}} : piste ajoutée aux Nouvelles. Premier suivi {{when}}.",
    addedNoFollow: "{{name}} : piste ajoutée aux Nouvelles.", // owner
    undo: "Annuler",
    at: "{{day}} à {{time}}",
    today: "aujourd’hui",
    tomorrow: "demain",
    sendFailed: "Envoi impossible à {{name}}. Réessayez.", // owner
    unsubscribed: "{{name}} s’est désabonnée et ne peut pas être jointe.", // owner
    saveFailed: "Enregistrement impossible. Réessayez.", // owner
  },
  form: {
    title: "Nouvelle piste",
    close: "Fermer",
    name: "Nom",
    namePlaceholder: "Nom complet",
    email: "Courriel",
    emailPlaceholder: "nom@courriel.com",
    emailInvalid: "Ce courriel ne semble pas valide.", // owner
    phone: "Téléphone",
    phonePlaceholder: "416 555-0100",
    by: "Faire le suivi par",
    notes: "Notes",
    notesPlaceholder: "Ce qu’on demande, où, quand",
    cancel: "Annuler",
    save: "Enregistrer",
    saving: "Enregistrement", // owner
  },
  connect: { title: "Recevez vos pistes automatiquement", sub: "Formulaire du site, Facebook, Instagram, Google Services locaux", action: "Connecter" },
  empty: {
    new: { title: "Aucune nouvelle piste", body: "Les nouvelles demandes de votre site, de vos publicités ou d’un appel arrivent ici." }, // owner
    contacted: { title: "Aucune piste en attente de réponse", body: "Les pistes que vous avez relancées s’affichent ici." }, // owner
    quoted: { title: "Aucune piste en soumission", body: "Les pistes à qui vous avez envoyé une soumission s’affichent ici." }, // owner
    won: { title: "Aucune piste gagnée", body: "Les pistes devenues des chantiers restent ici." }, // owner
    lost: { title: "Aucune piste perdue", body: "Les pistes marquées perdues restent ici, pour les relancer la saison prochaine." },
  },
  none: { title: "Aucune piste pour l’instant", body: "Les demandes de votre site et de vos publicités arrivent ici, ou ajoutez-en une reçue par téléphone.", action: "Nouvelle piste" }, // owner
  offline: "Vous êtes hors ligne. Voici les pistes de votre dernière visite.", // owner
  loadFailed: { title: "Impossible de charger vos pistes", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
};
