// Imports (Imports.dc.html and ImportsFR). French follows the board; the rest is my own wording, to review.
export const en = {
  back: "Back", close: "Close", title: "Imports", importTitle: "Import {{kind}}", steps: "Step {{n}} of 3",
  kinds: ["Clients", "Price items", "Jobs"], kindsLower: ["clients", "price items", "jobs"], what: "What to import",
  from: "From", template: "Get the CSV template", templateCopied: "Template copied. Paste it into a spreadsheet.",
  sources: {
    file: ["CSV or Excel file", "Any spreadsheet, we match the columns"], qbo: ["QuickBooks Online", "Last sync {{date}}", "Connected", "Not connected"], jobber: ["Jobber", "Clients, quotes and jobs", "Not connected"], pdf: ["Old quotes as PDFs", "AI reads clients and prices"],
  },
  history: { title: "History", none: "Nothing imported yet.", old: "Old quotes · {{file}}", rows_one: "{{date}} · {{count}} row", rows_other: "{{date}} · {{count}} rows", done: "Done", failed: "Failed", working: "Working" },
  map: { title: "Match the columns", sub: "{{file}} · {{count}} rows", inFile: "In your file", inApp: "In quoteAI", preview: "Preview", firstOf: "First 3 of {{total}}", goesTo: "{{col}} goes to {{field}}", importN: "Import {{count}} {{kind}}", noRows: "Nothing to import with these matches. Match at least the name.", needName: "Match a column to the name first." },
  fields: {
    clients: { name: "Client name", phone: "Phone", email: "Email", address: "Address", notes: "Notes", skip: "Don’t import" },
    prices: { name: "Item name", unit: "Unit", price: "Unit price", category: "Category", notes: "Notes", skip: "Don’t import" },
  },
  run: { title: "Bringing in your {{kind}}", sub: "Keep this screen open until it’s done.", of: "of", read: "Reading the file", readSub: "{{rows}} rows, {{cols}} columns", dupes: "Checking for duplicates", dupesSub: "Against what you have", adding: "Adding {{kind}}", addingSub: "{{count}} added so far", done: "Done", working: "In progress", waiting: "Waiting", cancel: "Stop", failed: "The import stopped. What was added stays." },
  done: { title: "{{count}} {{kind}} added", none: "Nothing was added", fileLine: "{{file}} · today, {{time}}", added: "Added", toCheck: "To check", skipped: "Skipped", same: "Same client?", left: "{{count}} left", allDone: "All done", merge: "Merge", keep: "Keep both", merged: "Merged", newClient: "New client", matched: "Matched", mergedSub: "Merged into your existing client", newSub: "Added as a new client", whyEmail: "Same email as {{name}}", whyPhone: "Same phone as {{name}}", errors: "Rows we skipped", rowsCount_one: "{{count}} row", rowsCount_other: "{{count}} rows", noneLeft: "None left", row: "Row {{n}}", skip: "Skip", fix: "Fix", fixedWord: "Added", skippedFor: "Skipped for good", seeClients: "See clients", seePrices: "See the price book", other: "Import something else" },
  why: { no_name: "No name in this row", short_phone: "Phone is too short: add without it", bad_email: "Email doesn’t look right: add without it", bad_price: "No price we can read" },
  soon: "That import isn’t in this build yet.",
  fileFailed: "Couldn’t read that file. Use a CSV or Excel file with a header row.", fileTooBig: "That file is too big. Use one under 8 MB.", offline: "You’re offline. Try again when you’re back online.", noAccess: "Your role can’t import.", failed: "Couldn’t do that.", noFile: "No file chosen.",
  readOnly: { lead: "View only.", body: "Your role can’t import data. Ask the owner." },
  loadFailed: { title: "Couldn’t load your imports", body: "Check your connection and try again.", retry: "Try again" },
};

export const fr: typeof en = {
  back: "Retour", close: "Fermer", title: "Importations", importTitle: "Importer {{kind}}", steps: "Étape {{n}} sur 3",
  kinds: ["Clients", "Prix", "Chantiers"], kindsLower: ["clients", "prix", "chantiers"], what: "Quoi importer",
  from: "Source", template: "Obtenir le modèle CSV", templateCopied: "Modèle copié. Collez-le dans un tableur.",
  sources: {
    file: ["Fichier CSV ou Excel", "Tout tableur, on associe les colonnes"], qbo: ["QuickBooks Online", "Dernière synchro le {{date}}", "Connecté", "Non connecté"], jobber: ["Jobber", "Clients, soumissions et chantiers", "Non connecté"], pdf: ["Anciennes soumissions PDF", "L’IA lit les clients et les prix"],
  },
  history: { title: "Historique", none: "Rien d’importé pour l’instant.", old: "Anciennes soumissions · {{file}}", rows_one: "{{date}} · {{count}} ligne", rows_other: "{{date}} · {{count}} lignes", done: "Terminé", failed: "Échec", working: "En cours" },
  map: { title: "Associez les colonnes", sub: "{{file}} · {{count}} lignes", inFile: "Dans votre fichier", inApp: "Dans quoteAI", preview: "Aperçu", firstOf: "3 premières sur {{total}}", goesTo: "{{col}} va dans {{field}}", importN: "Importer {{count}} {{kind}}", noRows: "Rien à importer avec ces associations. Associez au moins le nom.", needName: "Associez d’abord une colonne au nom." },
  fields: {
    clients: { name: "Nom du client", phone: "Téléphone", email: "Courriel", address: "Adresse", notes: "Notes", skip: "Ne pas importer" },
    prices: { name: "Nom de l’article", unit: "Unité", price: "Prix unitaire", category: "Catégorie", notes: "Notes", skip: "Ne pas importer" },
  },
  run: { title: "Importation de vos {{kind}}", sub: "Gardez cet écran ouvert jusqu’à la fin.", of: "sur", read: "Lecture du fichier", readSub: "{{rows}} lignes, {{cols}} colonnes", dupes: "Recherche de doublons", dupesSub: "Parmi ce que vous avez", adding: "Ajout des {{kind}}", addingSub: "{{count}} ajoutés jusqu’ici", done: "Terminé", working: "En cours", waiting: "En attente", cancel: "Arrêter", failed: "L’importation s’est arrêtée. Ce qui a été ajouté reste." },
  done: { title: "{{count}} {{kind}} ajoutés", none: "Rien n’a été ajouté", fileLine: "{{file}} · aujourd’hui, {{time}}", added: "Ajoutés", toCheck: "À vérifier", skipped: "Ignorés", same: "Même client ?", left: "{{count}} restants", allDone: "Tout est fait", merge: "Fusionner", keep: "Garder les deux", merged: "Fusionné", newClient: "Nouveau client", matched: "Ressemble", mergedSub: "Fusionné avec votre client existant", newSub: "Ajouté comme nouveau client", whyEmail: "Même courriel que {{name}}", whyPhone: "Même téléphone que {{name}}", errors: "Lignes ignorées", rowsCount_one: "{{count}} ligne", rowsCount_other: "{{count}} lignes", noneLeft: "Aucune restante", row: "Ligne {{n}}", skip: "Ignorer", fix: "Corriger", fixedWord: "Ajouté", skippedFor: "Ignorée pour de bon", seeClients: "Voir les clients", seePrices: "Voir la liste de prix", other: "Importer autre chose" },
  why: { no_name: "Pas de nom dans cette ligne", short_phone: "Téléphone trop court : ajouter sans lui", bad_email: "Courriel invalide : ajouter sans lui", bad_price: "Aucun prix lisible" },
  soon: "Cette importation n’est pas encore dans cette version.",
  fileFailed: "Impossible de lire ce fichier. Utilisez un fichier CSV ou Excel avec une ligne d’en-tête.", fileTooBig: "Ce fichier est trop gros. Utilisez-en un de moins de 8 Mo.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", noAccess: "Votre rôle ne permet pas d’importer.", failed: "Impossible de le faire.", noFile: "Aucun fichier choisi.",
  readOnly: { lead: "Consultation seulement.", body: "Votre rôle ne permet pas d’importer. Demandez au propriétaire." },
  loadFailed: { title: "Impossible de charger vos importations", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
};
