// SetWidget (SetWidget.dc.html and SetWidgetFR). French follows the board; the rest is my own wording, to review.
export const en = {
  back: "Back", close: "Close", title: "Website widget", lede: "A lead form on {{site}} that gives an instant estimate", siteFallback: "your site",
  readOnly: { lead: "View only.", body: "Your role can see these settings but not change them. Ask the owner." },
  waiting: { lead: "No leads from your site yet.", body: "Paste the code below on {{site}}. The first lead from the form shows up here." },
  loadFailed: { title: "Couldn’t load your widget", body: "Check your connection and try again.", retry: "Try again" },
  preview: { title: "Get a free estimate", lede: "Tell us about the job. You’ll see a price range right away.", kinds: ["Kitchen", "Bathroom", "Basement"], name: "Your name", phone: "Phone", email: "Email", postal: "Postal code", estimate: "See my estimate", send: "Send request" },
  status: { live: "Live", waiting: "Waiting", lastLead: "Last lead {{date}}", noLead: "No leads yet", leads: "Leads from your site", leadsSub: "This month" },
  look: { title: "Look", brand: "Widget colour", names: { violet: "Violet", harbour: "Harbour blue", forest: "Forest", brick: "Brick", teal: "Teal", charcoal: "Charcoal" }, background: "Background", backgrounds: ["Light", "Dark", "Match site"], shows: "Shows as", shownAs: ["Form on the page", "Floating button"] },
  fields: {
    title: "What it asks", name: { label: "Name", sub: "Always asked", value: "Required" }, phone: { label: "Phone", sub: "Needed for text follow-ups" }, email: { label: "Email", sub: "" },
    postal: { label: "Postal code", sub: "Skips jobs outside your area" }, photos: { label: "Photos", sub: "Up to 5 from their phone" }, budget: { label: "Budget range", sub: "" }, instant: { label: "Instant estimate", sub: "A price range from your price book" },
  },
  add: { title: "Add it to your site", copy: "Copy code", copied: "Copied", mail: "Email to web person", mailed: "Sent", mailSubject: "Add our quote form to the website", mailIntro: "Please paste this code where the form should appear:" },
  key: { label: "Widget key", sub: "Anyone with it can send you requests", none: "No key yet", create: "Create a key", renew: "New key", sheetTitle: "Make a new key?", sheetBody: "The code on your site stops working until you paste the new one.", go: "Make a new key", keep: "Keep this one" },
  leads: { title: "Where leads go", open: { label: "Leads", sub: "Tagged “Website”", value: "Open" }, notify: { label: "Notify me", sub: "On this phone, right away" }, reply: { label: "Auto-reply", sub: "Texts the lead within a minute" } },
  toast: { failed: "Couldn’t save that.", offline: "You’re offline. Try again when you’re back online.", noAccess: "Only the owner can change this.", copied: "Code copied.", keyMade: "New key made. Paste the new code on your site." },
};

export const fr: typeof en = {
  back: "Retour", close: "Fermer", title: "Widget pour votre site", lede: "Un formulaire sur {{site}} qui donne une estimation immédiate", siteFallback: "votre site",
  readOnly: { lead: "Consultation seulement.", body: "Votre rôle permet de voir ces réglages, mais pas de les modifier. Demandez au propriétaire." },
  waiting: { lead: "Aucune demande de votre site pour l’instant.", body: "Collez le code ci-dessous sur {{site}}. La première demande du formulaire apparaîtra ici." },
  loadFailed: { title: "Impossible de charger votre widget", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
  preview: { title: "Estimation gratuite", lede: "Décrivez vos travaux. Vous verrez tout de suite une fourchette de prix.", kinds: ["Cuisine", "Salle de bain", "Sous-sol"], name: "Votre nom", phone: "Téléphone", email: "Courriel", postal: "Code postal", estimate: "Voir mon estimation", send: "Envoyer la demande" },
  status: { live: "En ligne", waiting: "En attente", lastLead: "Dernière demande {{date}}", noLead: "Aucune demande", leads: "Demandes du site", leadsSub: "Ce mois-ci" },
  look: { title: "Apparence", brand: "Couleur du widget", names: { violet: "Violet", harbour: "Bleu port", forest: "Forêt", brick: "Brique", teal: "Sarcelle", charcoal: "Anthracite" }, background: "Arrière-plan", backgrounds: ["Clair", "Sombre", "Automatique"], shows: "Affichage", shownAs: ["Formulaire dans la page", "Bouton flottant"] },
  fields: {
    title: "Champs demandés", name: { label: "Nom", sub: "Toujours demandé", value: "Obligatoire" }, phone: { label: "Téléphone", sub: "Requis pour les relances par texto" }, email: { label: "Courriel", sub: "" },
    postal: { label: "Code postal", sub: "Écarte les chantiers hors de votre zone" }, photos: { label: "Photos", sub: "Jusqu’à 5 depuis leur téléphone" }, budget: { label: "Fourchette de budget", sub: "" }, instant: { label: "Estimation immédiate", sub: "Une fourchette tirée de votre liste de prix" },
  },
  add: { title: "Ajoutez-le à votre site", copy: "Copier le code", copied: "Copié", mail: "Au webmestre", mailed: "Envoyé", mailSubject: "Ajouter notre formulaire de soumission au site", mailIntro: "Merci de coller ce code là où le formulaire doit apparaître :" },
  key: { label: "Clé du widget", sub: "Quiconque l’a peut vous envoyer des demandes", none: "Pas encore de clé", create: "Créer une clé", renew: "Nouvelle clé", sheetTitle: "Créer une nouvelle clé?", sheetBody: "Le code sur votre site cessera de fonctionner jusqu’à ce que vous colliez le nouveau.", go: "Créer une nouvelle clé", keep: "Garder celle-ci" },
  leads: { title: "Destination des demandes", open: { label: "Demandes", sub: "Étiquette « Site Web »", value: "Ouvrir" }, notify: { label: "M’aviser", sub: "Sur ce téléphone, tout de suite" }, reply: { label: "Réponse automatique", sub: "Texto au client en moins d’une minute" } },
  toast: { failed: "Impossible d’enregistrer.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", noAccess: "Seul le propriétaire peut changer cela.", copied: "Code copié.", keyMade: "Nouvelle clé créée. Collez le nouveau code sur votre site." },
};
