// Dunning (Dunning.dc.html and DunningFR). French follows the board. The board draws calendar dates for one example; the phone has no failed payment to date them from, so the steps are
// counted in days from the failure.
export const en = {
  back: "Back", title: "When a payment doesn’t go through",
  intro: { owner: "What you and your team see, step by step. You can fix it at any point on quoteai.ca.", member: "What you see when the company’s payment fails. Only the owner can fix it." },
  greeting: "Good morning, {{name}}",
  s1: {
    title: "Payment failed", day: "Day 1", cap: "A banner on Home for everyone who can see billing.", mini: "Home screen with a payment failed banner", later: "Later", late: "9 days late", viewed: "Viewed",
    owner: { lead: "Your payment didn’t go through.", body: "Update your card on quoteai.ca to keep everything running.", action: "Open quoteai.ca" },
    member: { lead: "The company’s payment didn’t go through.", body: "The owner can update it on quoteai.ca.", action: "Message the owner" },
  },
  s2: {
    title: "Grace period", end: "Ends after the last try", cap: "Everything keeps working. We try the card again a few times.",
    owner: { lead: "Update your payment method on quoteai.ca soon", body: "Your card was declined. Nothing changes for your team or clients while we try again." },
    member: { lead: "The owner needs to update the payment method soon", body: "Nothing changes for you while we try again. We’ve emailed them too." }, meter: "Trying the card again", from: "Day 1", to: "Last try",
  },
  s3: {
    title: "Plan ended", day: "After the last try", cap: "Nothing is lost. Your clients and crew aren’t blocked.", lead: "Your plan has ended.", owner: "Update payment on quoteai.ca to start your plan again.", member: "Ask the owner to update the payment method.",
    works: "Still works", paused: "Paused until payment is fixed",
    w: ["See every quote, job and invoice", "Clients can pay open invoices", "Crew links, clock-in and photos", "Export your data"], p: ["Features of your old plan", "Teammates’ logins", "Assistant and automatic reminders"],
  },
  s4: {
    title: "Moved to Free", day: "Right away", cap: "Quotes only. Everything else is kept.", lead: "You’re on Free now.", body: "Jobs, invoices and crew are kept. Plans can’t be changed in the app.", link: "quoteai.ca",
    quotes: ["Quotes", "Up to the Free limit", "Available"], jobs: ["Jobs and invoices", "View and export only", "Saved"], team: "Teammates", teamPaused: "Paused", teamOwner: "Teammates’ logins pause", teamMember: "Your login pauses until it’s fixed",
  },
  s5: { title: "Payment fixed", day: "Any time", cap: "Back to normal within a minute, from any step.", lead: "Payment updated.", body: "Everything is back, just as you left it." },
  foot: "Payment and plans are managed on quoteai.ca.",
};

export const fr: typeof en = {
  back: "Retour", title: "Quand un paiement ne passe pas",
  intro: { owner: "Ce que vous et votre équipe voyez, étape par étape. Vous pouvez régler le tout en tout temps sur quoteai.ca.", member: "Ce que vous voyez quand le paiement de l’entreprise échoue. Seul le propriétaire peut le régler." },
  greeting: "Bonjour, {{name}}",
  s1: {
    title: "Paiement refusé", day: "Jour 1", cap: "Une bannière à l’Accueil pour tous ceux qui ont accès à la facturation.", mini: "Écran d’accueil avec une bannière de paiement refusé", later: "Plus tard", late: "9 j de retard", viewed: "Consultée",
    owner: { lead: "Votre paiement n’est pas passé.", body: "Mettez votre carte à jour sur quoteai.ca pour que tout continue de fonctionner.", action: "Ouvrir quoteai.ca" },
    member: { lead: "Le paiement de l’entreprise n’est pas passé.", body: "Le propriétaire peut le mettre à jour sur quoteai.ca.", action: "Écrire au propriétaire" },
  },
  s2: {
    title: "Période de grâce", end: "Fin après le dernier essai", cap: "Tout continue de fonctionner. Nous réessayons la carte quelques fois.",
    owner: { lead: "Mettez à jour votre mode de paiement sur quoteai.ca bientôt", body: "Votre carte a été refusée. Rien ne change pour votre équipe ni vos clients pendant les nouvelles tentatives." },
    member: { lead: "Le propriétaire doit bientôt mettre à jour le mode de paiement", body: "Rien ne change pour vous pendant les nouvelles tentatives. Nous lui avons aussi écrit par courriel." }, meter: "Nouvelles tentatives", from: "Jour 1", to: "Dernier essai",
  },
  s3: {
    title: "Forfait terminé", day: "Après le dernier essai", cap: "Rien n’est perdu. Vos clients et votre équipe ne sont pas bloqués.", lead: "Votre forfait est terminé.", owner: "Mettez à jour le paiement sur quoteai.ca pour redémarrer votre forfait.", member: "Demandez au propriétaire de mettre à jour le mode de paiement.",
    works: "Fonctionne toujours", paused: "En pause jusqu’au règlement du paiement",
    w: ["Voir chaque soumission, chantier et facture", "Les clients peuvent payer les factures ouvertes", "Liens d’équipe, pointage et photos", "Exporter vos données"], p: ["Fonctions de votre ancien forfait", "Accès des coéquipiers", "Assistant et rappels automatiques"],
  },
  s4: {
    title: "Passage au forfait Gratuit", day: "Tout de suite", cap: "Soumissions seulement. Tout le reste est conservé.", lead: "Vous êtes maintenant au forfait Gratuit.", body: "Chantiers, factures et équipe sont conservés. Le forfait ne se change pas dans l’appli.", link: "quoteai.ca",
    quotes: ["Soumissions", "Limite du forfait Gratuit", "Disponibles"], jobs: ["Chantiers et factures", "Consulter et exporter", "Conservés"], team: "Coéquipiers", teamPaused: "En pause", teamOwner: "Les accès de l’équipe sont suspendus", teamMember: "Votre accès est suspendu",
  },
  s5: { title: "Paiement réglé", day: "En tout temps", cap: "Retour à la normale en une minute, à n’importe quelle étape.", lead: "Paiement mis à jour.", body: "Tout est revenu, comme vous l’aviez laissé." },
  foot: "Le paiement et les forfaits se gèrent sur quoteai.ca.",
};
