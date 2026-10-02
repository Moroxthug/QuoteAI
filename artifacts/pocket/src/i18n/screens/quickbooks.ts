// QuickBooks Online (Integration.dc.html and IntegrationFR). French follows the board; the rest is my own wording, to review.
export const en = {
  back: "Back", close: "Close", title: "QuickBooks Online", kind: "Accounting",
  state: { on: "Connected", attention: "Needs attention", paused: "Paused", off: "Not connected" },
  failed: { lead_one: "{{count}} item didn’t reach QuickBooks.", lead_other: "{{count}} items didn’t reach QuickBooks.", tax: "{{tax}} isn’t matched to a QuickBooks tax code yet.", match: "Match tax code" },
  sync: { title: "Sync", on: "Every 15 minutes, and right after a payment", off: "Paused. Nothing is sent until you turn it back on", company: "Company", last: "Last sync", never: "Not yet", now: "Run now", running: "Syncing…", ran: "Checked QuickBooks for payments." },
  what: {
    title: "What syncs", invoices: ["Invoices", "Sent invoices go to QuickBooks with their tax codes"], payments: ["Payments", "Both ways. Payments recorded in QuickBooks come back here"],
    clients: ["Clients", "New clients become QuickBooks customers"], expenses: ["Expenses", "Confirmed job costs go in as expenses"], on: "On", needsAccount: "Needs an account",
  },
  match: { title: "Matching", sub: "quoteAI → QuickBooks", none: "Not matched", tax: "Tax", income: ["Job income", "Income account"], deposit: ["Deposits", "Deposit account"], payment: ["Paid from", "Bank or card account for expenses"], materials: ["Materials", "Expense account"], pick: "Choose in QuickBooks", pickTax: "Tax codes in your QuickBooks company", pickAccounts: "Accounts in your QuickBooks company", loading: "Loading from QuickBooks…", loadFailed: "Couldn’t reach QuickBooks. Try again in a moment.", saved: "Matched.", clear: "Not matched" },
  log: { title: "Recent syncs", none: "Nothing has synced yet.", invoice: "Invoice", payment: "Payment", expense: "Expense", other: "Sync", sent: "Sent", failed: "Failed", retry: "Retry", retrying: "Retrying…", retried: "Sent it again.", ok: "Sent to QuickBooks" },
  back2: { title: "Send older invoices", sub: "Invoices that were already out before you connected", button: "Send", sending: "Sending…", done: "Sent.", result: "{{count}} invoices sent." },
  disconnect: { button: "Disconnect QuickBooks", note: "Nothing already in QuickBooks is deleted.", title: "Disconnect QuickBooks Online?", body: "New invoices, payments and expenses stop going to QuickBooks. Everything already there stays.", go: "Disconnect", keep: "Stay connected", done: "QuickBooks is disconnected." },
  does: [
    ["Invoices go to your books", "With the right tax code, so HST lines up at filing time"], ["Payments go both ways", "Mark an invoice paid in either place and the other one knows"], ["Job costs become expenses", "Only the ones you confirm, filed to the account you pick"],
  ],
  steps: { title: "How connecting works", about: "About 2 min", list: [["Sign in to QuickBooks", "On Intuit’s own page"], ["Pick your company", "If you have more than one"], ["Match tax codes and accounts", "We suggest a match for each one"]], safe: "You sign in on Intuit’s page. quoteAI never sees your password." },
  can: { title: "What quoteAI can do", yes: ["Read your tax codes and chart of accounts", "Add customers, invoices and payments", "Add expenses for confirmed costs", "Read payments you record in QuickBooks"], no: ["See your bank login or run payroll", "Delete or change past entries"] },
  connect: { button: "Connect QuickBooks", opening: "Opening QuickBooks…", back: "Come back here when you’re done, then pull down to refresh.", unavailable: "QuickBooks isn’t switched on yet.", plan: "QuickBooks sync is included from Business. Plans can’t be changed in the app." },
  readOnly: { lead: "View only.", body: "Your role can see QuickBooks but not change it." },
  loadFailed: { title: "Couldn’t load QuickBooks", body: "Check your connection and try again.", retry: "Try again" },
  toast: { failed: "Couldn’t do that.", offline: "You’re offline. Try again when you’re back online.", noAccess: "Only the owner can change this." },
};

export const fr: typeof en = {
  back: "Retour", close: "Fermer", title: "QuickBooks Online", kind: "Comptabilité",
  state: { on: "Connecté", attention: "Action requise", paused: "En pause", off: "Non connecté" },
  failed: { lead_one: "{{count}} élément n’est pas arrivé dans QuickBooks.", lead_other: "{{count}} éléments ne sont pas arrivés dans QuickBooks.", tax: "{{tax}} n’est encore associé à aucun code de taxe QuickBooks.", match: "Associer le code" },
  sync: { title: "Synchronisation", on: "Aux 15 minutes, et juste après un paiement", off: "En pause. Rien n’est envoyé avant la réactivation", company: "Entreprise", last: "Dernière synchro", never: "Pas encore", now: "Lancer", running: "Synchro…", ran: "Paiements vérifiés dans QuickBooks." },
  what: {
    title: "Ce qui est synchronisé", invoices: ["Factures", "Les factures envoyées vont dans QuickBooks avec leurs codes de taxe"], payments: ["Paiements", "Dans les deux sens. Les paiements saisis dans QuickBooks reviennent ici"],
    clients: ["Clients", "Les nouveaux clients deviennent des clients QuickBooks"], expenses: ["Dépenses", "Les coûts de chantier confirmés entrent comme dépenses"], on: "Activé", needsAccount: "Compte requis",
  },
  match: { title: "Correspondances", sub: "quoteAI → QuickBooks", none: "Non associé", tax: "Taxe", income: ["Revenus de chantier", "Compte de revenus"], deposit: ["Dépôts", "Compte de dépôt"], payment: ["Payé depuis", "Compte bancaire ou carte pour les dépenses"], materials: ["Matériaux", "Compte de dépenses"], pick: "Choisir dans QuickBooks", pickTax: "Codes de taxe de votre entreprise QuickBooks", pickAccounts: "Comptes de votre entreprise QuickBooks", loading: "Chargement depuis QuickBooks…", loadFailed: "Impossible de joindre QuickBooks. Réessayez dans un instant.", saved: "Associé.", clear: "Non associé" },
  log: { title: "Dernières synchros", none: "Rien n’a encore été synchronisé.", invoice: "Facture", payment: "Paiement", expense: "Dépense", other: "Synchro", sent: "Envoyé", failed: "Échec", retry: "Réessayer", retrying: "Nouvel essai…", retried: "Renvoyé.", ok: "Envoyé à QuickBooks" },
  back2: { title: "Anciennes factures", sub: "Les factures déjà envoyées avant votre connexion", button: "Envoyer", sending: "Envoi…", done: "Envoyé.", result: "{{count}} factures envoyées." },
  disconnect: { button: "Déconnecter QuickBooks", note: "Rien de ce qui est déjà dans QuickBooks n’est supprimé.", title: "Déconnecter QuickBooks Online ?", body: "Les nouvelles factures, paiements et dépenses ne vont plus dans QuickBooks. Tout ce qui y est déjà reste.", go: "Déconnecter", keep: "Rester connecté", done: "QuickBooks est déconnecté." },
  does: [
    ["Les factures vont dans vos livres", "Avec le bon code de taxe, pour une TVH juste à la déclaration"], ["Paiements dans les deux sens", "Marquez une facture payée d’un côté, l’autre le sait"], ["Les coûts deviennent des dépenses", "Seulement ceux que vous confirmez, dans le compte choisi"],
  ],
  steps: { title: "Comment se connecter", about: "Environ 2 min", list: [["Connectez-vous à QuickBooks", "Sur la page d’Intuit"], ["Choisissez votre entreprise", "Si vous en avez plus d’une"], ["Associez codes de taxe et comptes", "Nous suggérons une correspondance pour chacun"]], safe: "Vous vous connectez sur la page d’Intuit. quoteAI ne voit jamais votre mot de passe." },
  can: { title: "Ce que quoteAI peut faire", yes: ["Lire vos codes de taxe et votre plan comptable", "Ajouter des clients, factures et paiements", "Ajouter des dépenses pour les coûts confirmés", "Lire les paiements saisis dans QuickBooks"], no: ["Voir vos accès bancaires ou faire la paie", "Supprimer ou modifier des écritures passées"] },
  connect: { button: "Connecter QuickBooks", opening: "Ouverture de QuickBooks…", back: "Revenez ici quand c’est fait, puis tirez pour actualiser.", unavailable: "QuickBooks n’est pas encore activé.", plan: "La synchro QuickBooks est incluse à partir de Business. Le forfait ne peut pas être modifié dans l’app." },
  readOnly: { lead: "Consultation seulement.", body: "Votre rôle permet de voir QuickBooks, mais pas de le modifier." },
  loadFailed: { title: "Impossible de charger QuickBooks", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
  toast: { failed: "Impossible de le faire.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", noAccess: "Seul le propriétaire peut changer cela." },
};
