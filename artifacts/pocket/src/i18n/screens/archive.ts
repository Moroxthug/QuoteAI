// Archive (Archive.dc.html and ArchiveFR). French follows the board; the rest is my own wording, to review.
export const en = {
  back: "Back", title: "Archive", searchLabel: "Search the archive", searchPlaceholder: "Search by client, job or number", clear: "Clear",
  filter: "Type", filters: { all: "All", quote: "Quotes", job: "Jobs", client: "Clients", invoice: "Invoices", contract: "Contracts" },
  kind: { quote: "Quote", job: "Job", client: "Client", invoice: "Invoice", contract: "Contract" },
  plural: { quote: "quotes", job: "jobs", client: "clients", invoice: "invoices", contract: "contracts" },
  state: {
    declined: "declined", accepted: "accepted", expired: "expired", sent: "sent", draft: "draft", viewed: "viewed", pending_confirmation: "payment to confirm", partially_paid: "part paid", paid: "paid", overdue: "overdue", void: "void",
    finished: "finished", paused: "paused", open: "open", signed: "signed", not_signed: "not signed",
  },
  untitled: "Untitled", month: { one: "1 item", other: "{{count}} items" },
  swipeHint: "Swipe a row left to restore or delete", restore: "Restore", delete: "Delete", rowLabel: "{{kind}}, {{title}}, {{detail}}",
  noMatch: { title: "Nothing in the archive matches", body: "Try a client name or a number like Q-2026-110.", clear: "Clear search" },
  none: { title: "Nothing archived", body: "Quotes, jobs and clients you archive wait here until you bring them back.", action: "Go to quotes" },
  loadFailed: { title: "Couldn’t load the archive", body: "Check your connection and try again.", retry: "Try again" },
  toast: { restored: "is back in {{plural}}", deleted: "deleted for good", undo: "Undo", failed: "Couldn’t do that.", offline: "You’re offline. Try again when you’re back online.", noAccess: "Your role can’t do that.", cantDelete: "That one can’t be deleted: it has payments or history." },
};

export const fr: typeof en = {
  back: "Retour", title: "Archives", searchLabel: "Rechercher dans les archives", searchPlaceholder: "Client, chantier ou numéro", clear: "Effacer",
  filter: "Type", filters: { all: "Tout", quote: "Soumissions", job: "Chantiers", client: "Clients", invoice: "Factures", contract: "Contrats" },
  kind: { quote: "Soumission", job: "Chantier", client: "Client", invoice: "Facture", contract: "Contrat" },
  plural: { quote: "soumissions", job: "chantiers", client: "clients", invoice: "factures", contract: "contrats" },
  state: {
    declined: "refusée", accepted: "acceptée", expired: "expirée", sent: "envoyée", draft: "brouillon", viewed: "vue", pending_confirmation: "paiement à confirmer", partially_paid: "payée en partie", paid: "payée", overdue: "en retard", void: "annulée",
    finished: "terminé", paused: "en pause", open: "ouvert", signed: "signé", not_signed: "non signé",
  },
  untitled: "Sans titre", month: { one: "1 élément", other: "{{count}} éléments" },
  swipeHint: "Glissez vers la gauche pour restaurer ou supprimer", restore: "Restaurer", delete: "Supprimer", rowLabel: "{{kind}}, {{title}}, {{detail}}",
  noMatch: { title: "Aucun résultat dans les archives", body: "Essayez un nom de client ou un numéro comme Q-2026-110.", clear: "Effacer la recherche" },
  none: { title: "Rien d’archivé", body: "Les soumissions, chantiers et clients archivés attendent ici jusqu’à ce que vous les rameniez.", action: "Aller aux soumissions" },
  loadFailed: { title: "Impossible de charger les archives", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
  toast: { restored: "est de retour dans les {{plural}}", deleted: "supprimé pour de bon", undo: "Annuler", failed: "Impossible de le faire.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", noAccess: "Votre rôle ne le permet pas.", cantDelete: "Celui-ci ne peut pas être supprimé : il a des paiements ou un historique." },
};
