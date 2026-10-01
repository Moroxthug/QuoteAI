// AccountantView (AccountantView.dc.html and AccountantViewFR.dc.html). // owner = my own wording, to review.
export const en = {
  back: "Back", retry: "Try again", kicker: "Accountant access", title: "Books and compliance",
  share: "{{you}} · shared by {{owner}}", shareAlone: "{{you}}", switchAria: "{{name}}, switch company",
  banner: { lead: "Read only.", body: "You can view, download and comment. Nothing here can be changed." },
  loadFailed: { title: "Couldn’t load the books", body: "Check your connection and try again." },
  locked: { title: "The books are on a bigger plan", body: "Month-end and bank matching come with invoicing. Manage plans at quoteai.ca." },
  ended: { title: "Your access has ended", body: "{{company}} turned off accountant access. Files you downloaded stay with you.", other: "Choose another company" },
  month: "Month", monthLabel: "Month", fiscal: "Fiscal year ends {{date}}",
  state: { closed: "Closed", inProgress: "In progress" },
  sub: { closedBy: "Closed by {{name}}, {{date}}", closed: "Closed {{date}}", open: "Not closed yet" },
  of: "{{done}} of {{total}}",
  checks: {
    bank: { title: "Bank lines matched", left_one: "{{count}} left to match", left_other: "{{count}} left to match", done: "Every line is matched" },
    receipts: { title: "Receipts attached", missing_one: "{{count}} receipt missing", missing_other: "{{count}} receipts missing", done: "Every expense of {{amount}} or more" },
    invoices: { title: "Invoices issued", count_one: "{{count}} invoice", count_other: "{{count}} invoices", drafts_one: "{{count}} invoice", drafts_other: "{{count}} invoices", withDrafts: "{{issued}} · {{drafts}} still a draft" },
    payroll: { title: "Pay periods exported", ends: "Ending {{dates}}" },
    empty: "Nothing to check in {{month}} yet.",
  },
  exports: {
    title: "Exports", transactions: { title: "Transactions", sub: "CSV · money in and out" },
    tax: { title: "Sales tax worksheet", sub: "CSV · invoices and purchases" }, payroll: { title: "Payroll summary", sub: "CSV · hours, gross, cost" },
    download: "Download", downloadAria: "Download {{file}}, {{month}}", downloaded: "Downloaded", failed: "Couldn’t download that file. Try again.",
  },
  tax: {
    link: "Compliance", deadlines: "Deadlines", period: "{{period}} · {{range}}", quarter: "Q{{n}}", freq: { monthly: "Monthly", quarterly: "Quarterly", semiannual: "Twice a year", annual: "Yearly" },
    collected: "{{tax}} collected", credits: "Input tax credits", previous: "{{period}} · filed {{date}}", none: "The company hasn’t set up its filing calendar yet.",
    due: "Due {{date}}", late_one: "{{count}} day late", late_other: "{{count}} days late", filed: "Filed {{date}}",
  },
  comments: {
    title: "Comments", placeholder: "Write a comment", send: "Send comment", note: "{{company}} gets your comments.", empty: "No comments yet. Ask {{owner}} anything about {{month}}.", readOnly: "You can read this thread but not write in it.",
    failed: "Couldn’t send that comment. Try again.", sending: "Sending", you: "You",
  },
};
export const fr = {
  back: "Retour", retry: "Réessayer", kicker: "Accès comptable", title: "Comptabilité et conformité",
  share: "{{you}} · partagé par {{owner}}", shareAlone: "{{you}}", switchAria: "{{name}}, changer d’entreprise",
  banner: { lead: "Lecture seule.", body: "Vous pouvez consulter, télécharger et commenter. Rien ne peut être modifié ici." },
  loadFailed: { title: "Impossible de charger les livres", body: "Vérifiez votre connexion et réessayez." },
  locked: { title: "Les livres sont sur un forfait supérieur", body: "La fin de mois et le rapprochement bancaire viennent avec la facturation. Gérez les forfaits sur quoteai.ca." },
  ended: { title: "Votre accès a pris fin", body: "{{company}} a désactivé l’accès comptable. Les fichiers téléchargés restent à vous.", other: "Choisir une autre entreprise" },
  month: "Mois", monthLabel: "Mois", fiscal: "Exercice terminé le {{date}}",
  state: { closed: "Fermé", inProgress: "En cours" },
  sub: { closedBy: "Fermé par {{name}} le {{date}}", closed: "Fermé le {{date}}", open: "Pas encore fermé" },
  of: "{{done}} sur {{total}}",
  checks: {
    bank: { title: "Lignes bancaires liées", left_one: "Il en reste {{count}} à lier", left_other: "Il en reste {{count}} à lier", done: "Toutes les lignes sont liées" },
    receipts: { title: "Reçus joints", missing_one: "{{count}} reçu manquant", missing_other: "{{count}} reçus manquants", done: "Toutes les dépenses de {{amount}} ou plus" },
    invoices: { title: "Factures émises", count_one: "{{count}} facture", count_other: "{{count}} factures", drafts_one: "{{count}} facture", drafts_other: "{{count}} factures", withDrafts: "{{issued}} · {{drafts}} encore en brouillon" },
    payroll: { title: "Périodes de paie exportées", ends: "Se terminent le {{dates}}" },
    empty: "Rien à vérifier pour {{month}} pour l’instant.",
  },
  exports: {
    title: "Exportations", transactions: { title: "Transactions", sub: "CSV · entrées et sorties" },
    tax: { title: "Feuille de calcul des taxes", sub: "CSV · factures et achats" }, payroll: { title: "Sommaire de la paie", sub: "CSV · heures, brut, coût" },
    download: "Télécharger", downloadAria: "Télécharger {{file}}, {{month}}", downloaded: "Téléchargé", failed: "Impossible de télécharger ce fichier. Réessayez.",
  },
  tax: {
    link: "Conformité", deadlines: "Échéances", period: "{{period}} · {{range}}", quarter: "T{{n}}", freq: { monthly: "Mensuelle", quarterly: "Trimestrielle", semiannual: "Deux fois par année", annual: "Annuelle" },
    collected: "{{tax}} perçue", credits: "Crédits de taxe sur les intrants", previous: "{{period}} · produite le {{date}}", none: "L’entreprise n’a pas encore réglé son calendrier de déclarations.",
    due: "Dû le {{date}}", late_one: "{{count}} j de retard", late_other: "{{count}} j de retard", filed: "Produite le {{date}}",
  },
  comments: {
    title: "Commentaires", placeholder: "Écrire un commentaire", send: "Envoyer le commentaire", note: "{{company}} reçoit vos commentaires.", empty: "Aucun commentaire pour l’instant. Posez une question à {{owner}} sur {{month}}.", readOnly: "Vous pouvez lire cette discussion, mais pas y écrire.",
    failed: "Impossible d’envoyer ce commentaire. Réessayez.", sending: "Envoi", you: "Vous",
  },
};
