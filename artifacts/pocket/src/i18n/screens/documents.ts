// Documents (Documents.dc.html, DocumentsFR). French follows the board; (owner) = my own wording, to review. (new) = not on the board.
export const en = {
  back: "Back", more: "More actions", retry: "Try again", close: "Close", title: "Documents", upload: "Upload",
  empty: { title: "Teach quoteAI your prices", body: "Upload 3 supplier invoices or past quotes and we’ll track what materials really cost you.", action: "Upload a document" },
  trend: {
    up: "{{name}} is up {{pct}}", down: "{{name}} is down {{pct}}", flat: "{{name}} hasn’t moved",
    sub_one: "from {{count}} invoice since {{month}}", sub_other: "from {{count}} invoices since {{month}}",
    pillUp: "Up {{pct}}", pillDown: "Down {{pct}}", pillFlat: "Steady", chart: "Price from {{from}} to {{to}}",
    update: "Update price book", keep: "Keep {{price}}", updated: "Price book updated to {{price}}", kept: "Kept {{price}} · we’ll remind you next month", undo: "Undo",
  },
  almost: { title: "{{name}} prices almost ready", sub: "{{have}} of {{need}} invoices in" },
  key: { title: "Key materials", link: "Price book", same: "Same", sub_one: "{{store}} · {{count}} invoice", sub_other: "{{store}} · {{count}} invoices", subNone: "{{count}} invoices" },
  read: {
    title: "Read by AI", count: "{{count}} this month", Read: "Read", Reading: "Reading", Check: "Check",
    prices_one: "{{count}} price", prices_other: "{{count}} prices", pricesRead_other: "{{count}} prices read", pricesRead_one: "{{count}} price read", changed: "{{count}} changed", unread_one: "{{count}} line we couldn’t read", unread_other: "{{count}} lines we couldn’t read",
    none: "No prices found", failed: "Couldn’t be read", filed: "Filed under {{job}}",
  },
  jobs: { title: "By job", files_one: "{{count}} file", files_other: "{{count}} files", company: "Company", companySub: "Not filed under a job · {{count}}", sub: "{{client}} · {{count}}", subNone: "{{count}}" },
  sheet: { title: "Upload", sub: "Invoices, receipts, price sheets, old quotes", photo: "Take a photo", photoSub: "Invoice or receipt on paper", file: "Choose a file", fileSub: "PDF or photo", under: "File it under", jobs: "Job", company: "Company" },
  toast: {
    reading: "Reading {{name}}", read: "{{name}} read", failed: "Couldn’t read that file. Try a clearer photo.", plan: "Reading invoices comes with a higher plan.", noAccess: "Your role can’t upload documents.",
    offline: "You’re offline. Try again when you’re back online.", denied: "Allow photos in Settings to upload.", unavailable: "Photos aren’t available on this phone.", saved: "Price book updated", undone: "Put back", priceFailed: "Couldn’t update the price book.",
  },
  loadFailed: { title: "Couldn’t load your documents", body: "Check your connection and try again." },
  offline: { lead: "You’re offline.", body: "Showing what was read on your last visit." },
  readOnly: { lead: "View only.", body: "Your role can see documents but not upload them." },
};

export const fr: typeof en = {
  back: "Retour", more: "Plus d’actions", retry: "Réessayer", close: "Fermer", title: "Documents", upload: "Téléverser",
  empty: { title: "Apprenez vos prix à quoteAI", body: "Téléversez 3 factures de fournisseurs ou anciennes soumissions et on suivra ce que les matériaux vous coûtent vraiment.", action: "Téléverser un document" },
  trend: {
    up: "{{name}} a pris {{pct}}", down: "{{name}} a baissé de {{pct}}", flat: "{{name}} n’a pas bougé",
    sub_one: "selon {{count}} facture depuis {{month}}", sub_other: "selon {{count}} factures depuis {{month}}",
    pillUp: "+{{pct}}", pillDown: "−{{pct}}", pillFlat: "Stable", chart: "Prix de {{from}} à {{to}}",
    update: "Adopter {{price}}", keep: "Garder {{price}}", updated: "Liste de prix mise à jour à {{price}}", kept: "{{price}} gardé · rappel le mois prochain", undo: "Annuler",
  },
  almost: { title: "{{name}} : prix presque prêts", sub: "{{have}} factures sur {{need}} reçues" },
  key: { title: "Matériaux clés", link: "Liste de prix", same: "Stable", sub_one: "{{store}} · {{count}} facture", sub_other: "{{store}} · {{count}} factures", subNone: "{{count}} factures" },
  read: {
    title: "Lus par l’IA", count: "{{count}} ce mois-ci", Read: "Lu", Reading: "Lecture", Check: "À vérifier",
    prices_one: "{{count}} prix", prices_other: "{{count}} prix", pricesRead_other: "{{count}} prix lus", pricesRead_one: "{{count}} prix lu", changed: "{{count}} changés", unread_one: "{{count}} ligne illisible", unread_other: "{{count}} lignes illisibles",
    none: "Aucun prix trouvé", failed: "Lecture impossible", filed: "Classé sous {{job}}",
  },
  jobs: { title: "Par chantier", files_one: "{{count}} fichier", files_other: "{{count}} fichiers", company: "Entreprise", companySub: "Sans chantier · {{count}}", sub: "{{client}} · {{count}}", subNone: "{{count}}" },
  sheet: { title: "Téléverser", sub: "Factures, reçus, listes de prix, anciennes soumissions", photo: "Prendre une photo", photoSub: "Facture ou reçu papier", file: "Choisir un fichier", fileSub: "PDF ou photo", under: "Classer sous", jobs: "Chantier", company: "Entreprise" },
  toast: {
    reading: "Lecture de {{name}}", read: "{{name}} lu", failed: "Impossible de lire ce fichier. Essayez une photo plus nette.", plan: "La lecture des factures est offerte avec un forfait supérieur.", noAccess: "Votre rôle ne peut pas téléverser de documents.",
    offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", denied: "Autorisez les photos dans les réglages pour téléverser.", unavailable: "Les photos ne sont pas disponibles sur ce téléphone.", saved: "Liste de prix mise à jour", undone: "Rétabli", priceFailed: "Impossible de mettre à jour la liste de prix.",
  },
  loadFailed: { title: "Impossible de charger vos documents", body: "Vérifiez votre connexion et réessayez." },
  offline: { lead: "Vous êtes hors ligne.", body: "Voici ce qui a été lu à votre dernière visite." },
  readOnly: { lead: "Lecture seule.", body: "Votre rôle peut voir les documents, mais pas en téléverser." },
};
