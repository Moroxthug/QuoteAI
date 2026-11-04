// Tablet.dc.html: the rail and the quote shown beside the list at tablet width. French from TabletFR.dc.html; lines the board doesn't show are marked.
export const en = {
  rail: { menu: "Menu", profile: "{{name}}, profile" },
  pane: {
    duplicate: "Duplicate", pdf: "PDF", more: "More actions",
    scope: "Scope, as understood", edit: "Edit", lines: "Line items", subtotal: "Subtotal", total: "Total",
    call: "Call", message: "Message",
    deposit: "{{pct}} deposit", depositHow: "Card or Interac e-Transfer",
    validUntil: "Valid until", notSent: "Not sent yet · valid until {{date}}",
    activity: "Activity",
    // not on the board: nothing picked yet (the board always has one open)
    pick: "Pick a quote", pickBody: "Its lines, client and activity show here.",
    duplicated: "Duplicated.", failed: "That didn’t work. Try again.", won: "Marked as won.", archived: "Archived.",
  },
  act: {
    send: "Send quote", preview: "Preview", followUp: "Follow up", markWon: "Mark won", openJob: "Open job", startJob: "Start job", invoiceDeposit: "Invoice deposit",
    revive: "Revive quote", archive: "Archive",
  },
  event: {
    created: "Created", createdSub: "Drafted in quoteAI",
    sent: "Sent", sentSub: "By email or text",
    viewed: "Viewed by {{name}}", viewedSub: "Opened the link",
    accepted: "Accepted and signed", acceptedSub: "Signed online",
    declined: "Declined", declinedSub: "No reason given",
    expired: "Expired", expiredSub: "No reply before it ran out",
  },
};

export const fr: typeof en = {
  rail: { menu: "Menu", profile: "{{name}}, profil" },
  pane: {
    duplicate: "Dupliquer", pdf: "PDF", more: "Plus d’actions",
    scope: "Portée des travaux, telle que comprise", edit: "Modifier", lines: "Lignes", subtotal: "Sous-total", total: "Total",
    call: "Appeler", message: "Écrire",
    deposit: "Dépôt de {{pct}}", depositHow: "Carte ou virement Interac",
    validUntil: "Valide jusqu’au", notSent: "Pas encore envoyée · valide jusqu’au {{date}}",
    activity: "Activité",
    pick: "Choisissez une soumission", pickBody: "Ses lignes, son client et son activité s’affichent ici.",
    duplicated: "Dupliquée.", failed: "Ça n’a pas fonctionné. Réessayez.", won: "Marquée gagnée.", archived: "Archivée.",
  },
  act: {
    send: "Envoyer la soumission", preview: "Aperçu", followUp: "Relancer", markWon: "Marquer gagnée", openJob: "Ouvrir le chantier", startJob: "Démarrer le chantier", invoiceDeposit: "Facturer le dépôt",
    revive: "Réactiver", archive: "Archiver",
  },
  event: {
    created: "Créée", createdSub: "Rédigée dans quoteAI",
    sent: "Envoyée", sentSub: "Par courriel ou texto",
    viewed: "Consultée par {{name}}", viewedSub: "A ouvert le lien",
    accepted: "Acceptée et signée", acceptedSub: "Signée en ligne",
    declined: "Refusée", declinedSub: "Aucune raison donnée",
    expired: "Expirée", expiredSub: "Pas de réponse avant l’échéance",
  },
};
