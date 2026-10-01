// QuoteEditor.dc.html / QuoteEditorFR.dc.html. French from the board where it has the words; the rest // owner.
export const en = {
  back: "Back",
  more: "More actions",
  titleLabel: "Quote title",
  untitled: "Untitled quote",
  viewedAgo: "{{when}} · valid until {{date}}",
  statusLine: "Valid until {{date}}",
  change: "Change",
  banner: {
    readOnly: "Your role can view this but not change it.",
    readOnlyBody: "Ask {{name}} to edit prices.",
    locked: "This quote is final.",
    lockedBody: "It was accepted or its PDF was downloaded, so it can’t be changed.",
    seen: "{{name}} has seen this.",
    seenBody: "Changes you save show on the same link.",
  },
  priceCheck: { title: "Price check", against: "Against your price book and receipts", inRange: "Every line in range", toCheck_one: "{{count}} to check", toCheck_other: "{{count}} to check", ok: "In range", none: "No price data yet" },
  lineItems: "Line items",
  items_one: "{{count}} item",
  items_other: "{{count}} items",
  moveUp: "Move {{name}} up",
  quantity: "Quantity",
  rate: "Rate",
  name: "Description",
  flag: { low: "Low", high: "High" },
  priceBook: "Price book",
  blank: "Blank line",
  newLine: "New line",
  book: { search: "Search the price book", used: "{{unit}}", none: "Nothing in your price book matches.", empty: "Your price book is empty.", open: "Open the price book", add: "Add {{name}}", perUnit: "per {{unit}}" },
  subtotal: "Subtotal",
  discount: "Discount ({{pct}}%)",
  tax: "Tax",
  taxTag: "{{rate}}%",
  total: "Total",
  same: "Same as when it was first sent",
  deltaUp: "+{{amount}} since it was first sent",
  deltaDown: "−{{amount}} since it was first sent",
  notes: "Notes for {{name}}",
  notesLabel: "Notes",
  notIncluded: "Not included",
  addExclusion: "Add something not included",
  addExclusionLabel: "Add an exclusion",
  add: "Add",
  remove: "Remove: {{text}}",
  options: { title: "Good, better, best", offer: "Offer three options", one: "One price only. Turn on to offer up to three.", pick: "{{name}} picks one when they accept. Better uses the lines above.", recommended: "Recommended", recommend: "Recommend", edit: "Edit", linesAbove: "Lines above", good: "Good", better: "Better", best: "Best", add: "Add an option", editLines: "Edit lines", name: "Name", sub: "One line about it", save: "Save", maxThree: "Three options at most.", removeOne: "Remove option", turnOffTitle: "Go back to one price?", turnOffBody: "The extra options are removed. The quote keeps its own lines.", turnOff: "Remove options", keep: "Keep options" },
  schedule: { title: "Payment schedule", addsUp: "Schedule adds up to", ok: "Adds up", over: "Over 100%", overBy: "Over by {{pct}}%.", overBody: "Lower the deposit or the milestone.", lower: "Lower {{what}}", raise: "Raise {{what}}", holdback: "Hold back {{pct}}%", holdbackSub: "Under the Construction Act", holdbackLabel: "Holdback {{pct}}%", rest: "Whatever is left, to the cent", foot: "Card or Interac e-Transfer · due in {{days}} days",
    when: { on_signing: "On signing", milestone: "At the milestone", on_completion: "On completion", days_after_signing: "{{n}} days after signing", holdback_release: "After the holdback period" }, deposit: "Deposit", completion: "On completion" },
  extras: { pdf: "PDF layout", pdfSub: "Standard", pdfPro: "Professional", pdfLocked: "Locked once the PDF is downloaded", redo: "Redo with AI", redoSub: "New instructions, your prices are kept", contract: "Draft the contract with AI", contractSub: "Reuses these terms and the schedule", redoTitle: "What should change?", redoLabel: "New instructions", redoGo: "Redo the quote", redoBusy: "Redoing…", redoFailed: "Couldn’t redo the quote. Try again." },
  preview: "Preview",
  send: "Send {{total}}",
  sentTo: "Sent to {{name}}",
  fixSchedule: "Fix the schedule",
  save: { saving: "Saving…", saved: "Saved", failed: "Couldn’t save. Try again.", offline: "You’re offline. Your changes stay on this screen: try again with signal." },
  loadFailed: { title: "Couldn’t load this quote", body: "Check your connection and try again.", retry: "Try again" },
  notFound: { title: "Quote not found", body: "It may have been archived or removed." },
};

export const fr: typeof en = {
  back: "Retour",
  more: "Plus d’actions",
  titleLabel: "Titre de la soumission",
  untitled: "Soumission sans titre", // owner
  viewedAgo: "{{when}} · valide jusqu’au {{date}}",
  statusLine: "Valide jusqu’au {{date}}",
  change: "Changer",
  banner: {
    readOnly: "Votre rôle permet de consulter, mais pas de modifier.",
    readOnlyBody: "Demandez à {{name}} de modifier les prix.",
    locked: "Cette soumission est définitive.", // owner
    lockedBody: "Elle a été acceptée ou son PDF a été téléchargé : elle ne peut plus être modifiée.", // owner
    seen: "{{name}} l’a déjà vue.",
    seenBody: "Les changements enregistrés s’affichent sur le même lien.", // owner
  },
  priceCheck: { title: "Vérification des prix", against: "D’après votre liste de prix et vos reçus", inRange: "Toutes les lignes dans la norme", toCheck_one: "{{count}} à vérifier", toCheck_other: "{{count}} à vérifier", ok: "Dans la norme", none: "Aucune donnée de prix pour l’instant" }, // owner: against, none
  lineItems: "Lignes de la soumission",
  items_one: "{{count}} poste",
  items_other: "{{count}} postes",
  moveUp: "Monter {{name}}",
  quantity: "Quantité",
  rate: "Prix unitaire",
  name: "Description",
  flag: { low: "Bas", high: "Haut" },
  priceBook: "Liste de prix",
  blank: "Ligne vide",
  newLine: "Nouvelle ligne",
  book: { search: "Rechercher dans la liste de prix", used: "{{unit}}", none: "Rien dans votre liste de prix ne correspond.", empty: "Votre liste de prix est vide.", open: "Ouvrir la liste de prix", add: "Ajouter {{name}}", perUnit: "par {{unit}}" },
  subtotal: "Sous-total",
  discount: "Remise ({{pct}} %)",
  tax: "Taxes",
  taxTag: "{{rate}} %",
  total: "Total",
  same: "Identique à l’envoi initial", // owner
  deltaUp: "+{{amount}} depuis l’envoi initial", // owner
  deltaDown: "−{{amount}} depuis l’envoi initial", // owner
  notes: "Notes pour {{name}}",
  notesLabel: "Notes",
  notIncluded: "Non inclus",
  addExclusion: "Ajouter un élément non inclus",
  addExclusionLabel: "Ajouter une exclusion",
  add: "Ajouter",
  remove: "Retirer : {{text}}", // owner
  options: { title: "Bon, meilleur, excellent", offer: "Offrir trois options", one: "Un seul prix. Activez pour offrir jusqu’à trois options.", pick: "{{name}} en choisit une en acceptant. Meilleur reprend les lignes ci-dessus.", recommended: "Recommandée", recommend: "Recommander", edit: "Modifier", linesAbove: "Lignes ci-dessus", good: "Bon", better: "Meilleur", best: "Excellent", add: "Ajouter une option", editLines: "Modifier les lignes", name: "Nom", sub: "Une ligne à son sujet", save: "Enregistrer", maxThree: "Trois options au maximum.", removeOne: "Retirer l’option", turnOffTitle: "Revenir à un seul prix ?", turnOffBody: "Les autres options sont retirées. La soumission garde ses propres lignes.", turnOff: "Retirer les options", keep: "Garder les options" }, // owner (from add)
  schedule: { title: "Calendrier des paiements", addsUp: "Total du calendrier", ok: "Correct", over: "Plus de 100 %", overBy: "Dépassement de {{pct}} %.", overBody: "Réduisez le dépôt ou l’étape.", lower: "Réduire : {{what}}", raise: "Augmenter : {{what}}", holdback: "Retenir {{pct}} %", holdbackSub: "Selon la Loi sur la construction", holdbackLabel: "Retenue de {{pct}} %", rest: "Le reste, au cent près", foot: "Carte ou virement Interac · payable dans {{days}} jours",
    when: { on_signing: "À la signature", milestone: "À l’étape", on_completion: "À la fin des travaux", days_after_signing: "{{n}} jours après la signature", holdback_release: "Après la période de retenue" }, deposit: "Dépôt", completion: "À la fin des travaux" }, // owner: when.*
  extras: { pdf: "Mise en page du PDF", pdfSub: "Standard", pdfPro: "Professionnelle", pdfLocked: "Verrouillée après le téléchargement du PDF", redo: "Refaire avec l’IA", redoSub: "Nouvelles consignes, vos prix sont conservés", contract: "Rédiger le contrat avec l’IA", contractSub: "Reprend ces conditions et le calendrier", redoTitle: "Qu’est-ce qui doit changer ?", redoLabel: "Nouvelles consignes", redoGo: "Refaire la soumission", redoBusy: "Refonte…", redoFailed: "Impossible de refaire la soumission. Réessayez." }, // owner: after contractSub
  preview: "Aperçu",
  send: "Envoyer {{total}}",
  sentTo: "Envoyée à {{name}}",
  fixSchedule: "Corriger les paiements",
  save: { saving: "Enregistrement…", saved: "Enregistré", failed: "Impossible d’enregistrer. Réessayez.", offline: "Vous êtes hors ligne. Vos changements restent sur cet écran : réessayez avec du signal." }, // owner
  loadFailed: { title: "Impossible de charger cette soumission", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  notFound: { title: "Soumission introuvable", body: "Elle a peut-être été archivée ou retirée." }, // owner
};
