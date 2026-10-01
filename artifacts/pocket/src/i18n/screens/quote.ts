// Quote.dc.html / QuoteFR.dc.html (the draft a contractor reviews and sends). The board's French is used where it has
// the words; the rest is marked // owner.
export const en = {
  back: "Back",
  more: "More options",
  status: { draft: "Draft", sent: "Sent", viewed: "Viewed", expiring: "Expiring", accepted: "Accepted", declined: "Declined", expired: "Expired" },
  validUntil: "Valid until {{date}}",
  acceptedOn: "Accepted {{date}}",
  untitled: "Untitled quote",
  change: "Change",
  scope: "Scope, as understood",
  edit: "Edit",
  lineItems: "Line items",
  addItem: "Add item",
  fixed: "fixed",
  less: "Less {{what}}",
  moreOf: "More {{what}}",
  subtotal: "Subtotal",
  discount: "Discount ({{pct}}%)",
  tax: "Tax",
  taxLine: "{{name}} {{rate}}%",
  taxLineProvince: "{{name}}, {{province}} {{rate}}%",
  total: "Total",
  deposit: "{{pct}}% deposit on acceptance",
  depositSub: "Card or Interac e-Transfer",
  depositLabel: "Deposit on acceptance",
  dueOnAcceptance: "Due on acceptance",
  sendBy: "Send by",
  sendChannel: "Send channel",
  channels: { email: "Email", sms: "SMS", wa: "WhatsApp" },
  notSetUp: "Not set up",
  addAddress: "Add address",
  addNumber: "Add number",
  preview: "Preview",
  send: "Send {{total}}",
  sentTo: "Sent to {{name}}",
  sentToClient: "Sent",
  sending: "Sending…",
  startJob: "Start job",
  openJob: "Open job",
  accepted: { by: "Accepted by {{name}}" },
  ask: { titleEmail: "Where should it go?", titleSms: "Which number?", email: "Client’s email", phone: "Client’s mobile", send: "Send", cancel: "Cancel", invalidEmail: "That email address doesn’t look right.", invalidPhone: "Enter a 10-digit mobile number." },
  scopeSheet: { title: "Scope", label: "What the work includes", save: "Save" },
  clientSheet: { title: "Change client", search: "Search clients", none: "No clients match", add: "Add a new client" },
  actions: { markWon: "Mark as won", editor: "Open the editor", copyLink: "Copy link", linkCopied: "Link copied", duplicate: "Duplicate", archive: "Archive", priceCheck: "Check prices", openPdf: "Download PDF", delete: "Delete" },
  toast: { saved: "Saved", saveFailed: "Couldn’t save the change. Try again.", sendFailed: "Couldn’t send it. Try again.", smsFailed: "The text didn’t go out. Check the number.", unlock: "This quote needs your plan to be active before it can be sent.", duplicated: "Duplicated as a draft", archived: "Archived", offline: "You’re offline. Your change is kept on this screen: try again with signal.", noAccess: "Your role can’t edit quotes." },
  loadFailed: { title: "Couldn’t load this quote", body: "Check your connection and try again.", retry: "Try again" },
  notFound: { title: "Quote not found", body: "It may have been archived or removed." },
  confirmWon: { title: "Mark this quote as won?", body: "Use this when the client said yes outside the page: a call, a text, or a paper contract. No signature is needed. Follow-ups stop.", confirm: "Mark as won", done: "Marked as won", failed: "Couldn’t mark it as won. Open the quote and try again." },
  confirmSend: { title: "Send this quote?", body: "The client gets a link to read, accept and sign it.", confirm: "Send" },
};

export const fr: typeof en = {
  back: "Retour",
  more: "Plus d’options",
  status: { draft: "Brouillon", sent: "Envoyée", viewed: "Consultée", expiring: "Expire bientôt", accepted: "Acceptée", declined: "Refusée", expired: "Expirée" },
  validUntil: "Valide jusqu’au {{date}}",
  acceptedOn: "Acceptée le {{date}}",
  untitled: "Soumission sans titre", // owner
  change: "Changer",
  scope: "Portée des travaux, telle que comprise",
  edit: "Modifier",
  lineItems: "Postes",
  addItem: "Ajouter un poste",
  fixed: "fixe",
  less: "Moins : {{what}}", // owner
  moreOf: "Plus : {{what}}", // owner
  subtotal: "Sous-total",
  discount: "Remise ({{pct}} %)", // owner
  tax: "Taxes", // owner
  taxLine: "{{name}} {{rate}} %",
  taxLineProvince: "{{name}}, {{province}} {{rate}} %",
  total: "Total",
  deposit: "Dépôt de {{pct}} % à l’acceptation",
  depositSub: "Carte ou virement Interac",
  depositLabel: "Dépôt à l’acceptation", // owner
  dueOnAcceptance: "Dû à l’acceptation",
  sendBy: "Envoyer par",
  sendChannel: "Mode d’envoi", // owner
  channels: { email: "Courriel", sms: "Texto", wa: "WhatsApp" },
  notSetUp: "Non configuré", // owner
  addAddress: "Ajouter l’adresse", // owner
  addNumber: "Ajouter le numéro", // owner
  preview: "Aperçu",
  send: "Envoyer {{total}}",
  sentTo: "Envoyée à {{name}}",
  sentToClient: "Envoyée",
  sending: "Envoi…", // owner
  startJob: "Lancer les travaux",
  openJob: "Ouvrir le chantier", // owner
  accepted: { by: "Acceptée par {{name}}" }, // owner
  ask: { titleEmail: "Où l’envoyer ?", titleSms: "Quel numéro ?", email: "Courriel du client", phone: "Cellulaire du client", send: "Envoyer", cancel: "Annuler", invalidEmail: "Cette adresse courriel semble incorrecte.", invalidPhone: "Entrez un numéro de cellulaire à 10 chiffres." }, // owner
  scopeSheet: { title: "Portée", label: "Ce que comprend le travail", save: "Enregistrer" }, // owner
  clientSheet: { title: "Changer de client", search: "Rechercher un client", none: "Aucun client trouvé", add: "Ajouter un nouveau client" }, // owner
  actions: { markWon: "Marquer comme gagnée", editor: "Ouvrir l’éditeur", copyLink: "Copier le lien", linkCopied: "Lien copié", duplicate: "Dupliquer", archive: "Archiver", priceCheck: "Vérifier les prix", openPdf: "Télécharger le PDF", delete: "Supprimer" }, // owner
  toast: { saved: "Enregistré", saveFailed: "Impossible d’enregistrer la modification. Réessayez.", sendFailed: "Impossible de l’envoyer. Réessayez.", smsFailed: "Le texto n’est pas parti. Vérifiez le numéro.", unlock: "Cette soumission demande un forfait actif avant d’être envoyée.", duplicated: "Dupliquée en brouillon", archived: "Archivée", offline: "Vous êtes hors ligne. Votre changement reste sur cet écran : réessayez avec du signal.", noAccess: "Votre rôle ne permet pas de modifier les soumissions." }, // owner
  loadFailed: { title: "Impossible de charger cette soumission", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
  notFound: { title: "Soumission introuvable", body: "Elle a peut-être été archivée ou retirée." }, // owner
  confirmWon: { title: "Marquer cette soumission comme gagnée ?", body: "À utiliser quand le client a dit oui hors de la page : appel, texto ou contrat papier. Aucune signature n’est requise. Les relances s’arrêtent.", confirm: "Marquer comme gagnée", done: "Marquée comme gagnée", failed: "Impossible de la marquer comme gagnée. Ouvrez la soumission et réessayez." }, // owner
  confirmSend: { title: "Envoyer cette soumission ?", body: "Le client reçoit un lien pour la lire, l’accepter et la signer.", confirm: "Envoyer" }, // owner
};
