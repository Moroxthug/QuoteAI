// French (fr-CA). Copy wording from the NAMEFR.dc.html boards; don't retranslate.
// The Components board has no French version: the sandbox strings marked "owner" wait for
// the owner's wording (appearance labels come from SettingsFR.dc.html).
import type { Dict } from "./en";

export const fr: Dict = {
  sandbox: {
    title: "Composants", // owner
    intro: "Chaque pièce de l’app, avec ses états. Touchez les contrôles pour les essayer.", // owner
    appearance: { light: "Clair", dark: "Sombre", auto: "Auto" },
    foundations: "Fondations", // owner
    typeScale: "Échelle typographique", // owner
    icons: "Icônes", // owner
    grounds: "Arrière-plans", // owner
    digits: "Envoyée il y a 6 jours · 4 131,05 $ · 13 % · 14 h 30", // owner
  },
  // board: owner review (no ComponentsFR board; Aperçu, Modifier, Envoyer, Nouvelle soumission, Mot de passe oublié come from FR boards)
  board: {
    buttons: {
      title: "Boutons",
      default: "Par défaut",
      pressed: "Appuyé",
      disabled: "Désactivé",
      loading: "Chargement",
      primary: {
        name: "Principal",
        label: "Envoyer la soumission",
        busy: "Envoi"
      },
      secondary: {
        name: "Secondaire",
        label: "Aperçu",
        busy: "Chargement"
      },
      destructive: {
        name: "Destructif",
        label: "Supprimer le brouillon",
        busy: "Suppression"
      },
      accent: {
        name: "Accent",
        label: "Demander à quoteAI",
        busy: "Réflexion"
      },
      link: {
        name: "Lien",
        label: "Mot de passe oublié ?",
        busy: "Ouverture"
      },
      sizes: "Tailles : petit 36, moyen 44, par défaut 50, grand 54",
      small: "Petit",
      medium: "Moyen",
      defaultSize: "Par défaut",
      large: "Grand, pleine largeur",
      smallGroup: "Petits",
      send: "Envoyer",
      edit: "Modifier",
      remove: "Retirer",
      reload: "Recharger",
      newQuote: "Nouvelle soumission",
      fab: "Barre d’action flottante",
      more: "Plus d’actions"
    },
    // Filters from QuotesFR, tabs from JobFR (Aperçu, Horaire, Équipe, Coûts, Photos, Permis),
    // Peinture from NewQuoteFR; the rest is owner.
    chips: {
      title: "Puces", // owner
      withCounts: "Filtres avec compteurs", // owner
      filter: "Filtrer", // owner
      f: { all: "Toutes", draft: "Brouillons", waiting: "En attente", accepted: "Acceptées", closed: "Fermées" },
      states: "États des puces", // owner
      default: "Par défaut",
      selected: "Sélectionnée", // owner
      painting: "Peinture",
      disabled: "Désactivée", // owner
      addTrade: "Ajouter un métier", // owner
      tabStrip: "Onglets internes", // owner
      tabs: { overview: "Aperçu", schedule: "Horaire", crew: "Équipe", costs: "Coûts", photos: "Photos", reports: "Rapports", money: "Argent", permits: "Permis" }, // Rapports, Argent: owner
    },
    // Appearance from SettingsFR; "Tout à la fin" from NewQuoteFR; the rest is owner.
    controls: {
      title: "Contrôles", // owner
      group1: "Interrupteur, compteur, segments", // owner
      deposit: "Rappels d’acompte", // owner
      on: "Activé", // owner
      text: "Texter le client", // owner
      off: "Désactivé", // owner
      card: "Paiements par carte", // owner
      disabled: "Désactivé", // owner
      valid: "Soumission valide pendant", // owner (SetQuotesFR: Valide pendant)
      stepper: "Compteur", // owner
      days_one: "{{count}} jour",
      days_other: "{{count}} jours",
      fewer: "Moins de jours", // owner
      more: "Plus de jours", // owner
      appearance: "Apparence",
      segmented: "Segments", // owner
      group2: "Case à cocher et coche ronde", // owner
      checks: {
        a: { label: "Inclure les matériaux", sub: "Case à cocher · cochée" }, // owner
        b: { label: "Afficher les heures sur la soumission", sub: "Case à cocher · non cochée" }, // owner
        t: { label: "Gypse tiré", sub: "Coche ronde · tâche faite" }, // owner
        z: { label: "Visite finale", sub: "Désactivée" }, // Visite finale: SmartHomeFR
      },
      group3: "Liste à choix unique", // owner
      schedule: "Calendrier de paiement", // owner
      radios: [
        { label: "50 % d’acompte, 50 % à la fin", sub: "Le plus courant pour les petits travaux" }, // owner
        { label: "30 / 40 / 30", sub: "Acompte, mi-parcours, fin des travaux" }, // owner
        { label: "Tout à la fin", sub: "Une facture à la fin des travaux" }, // owner
      ],
    },
    inputs: {
      title: "Champs", // owner
      text: "Texte · actif", // owner
      company: "Rossi Renovations",
      email: "Courriel",
      emailValue: "marco@rossireno.ca",
      phone: "Téléphone",
      phoneHint: "(416) 555-0100",
      money: "Montant", // owner
      currency: "$",
      cad: "CAD",
      unit: "Nombre avec unité", // owner
      sqft: "pi²", // FR-BRIEF glossary
      multi: "Plusieurs lignes", // owner
      note: "Deux couches aux plafonds, réparer d’abord la fissure au-dessus du bain.", // owner
      select: "Liste", // owner
      foreman: "Contremaître",
      date: "Date",
      time: "Heure",
      code: "Code à 6 chiffres", // VerifyFR
      emailError: "Courriel · erreur", // owner
      badEmail: "marco@rossireno",
      badEmailMsg: "Ajoutez la fin de l’adresse, comme .ca ou .com", // owner
      disabled: "Désactivé", // owner
      hst: "TVH 13 %",
      search: "Rechercher",
      searchHint: "Rechercher par client ou chantier", // TabletFR
    },
    status: {
      title: "Statuts", // owner
      shapesLabel: "Formes : l’icône dit où on en est, la couleur dit comment ça va", // owner
      shapes: { notSent: "Pas encore envoyé", onItsWay: "En route", seen: "Vu, à mi-chemin", nearly: "Presque fini", done: "Fait", now: "En cours", waiting: "En attente", paused: "En pause", needsYou: "À traiter", stopped: "Arrêté", inactive: "Plus actif" }, // owner
      plainLabel: "Simple, pour les rangées denses et les en-têtes · Étiquettes, pour les rôles", // owner
      viewedAgo: "Consultée il y a 2 h", // owner
      expiresFri: "Expire ven.", // owner
      onSite: "Sur place", // CrewMapFR
      foreman: "Contremaître",
      admin: "Admin", // owner
      hst: "TVH 13 %",
      groups: {
        // QuotesFR / ClientsFR
        quotes: { name: "Soumissions", draft: "Brouillon", sent: "Envoyée", viewed: "Consultée", accepted: "Acceptée", declined: "Refusée", expired: "Expirée" },
        // InvoicesFR; awaiting and void: owner
        invoices: { name: "Factures", draft: "Brouillon", scheduled: "Planifiée", sent: "Envoyée", viewed: "Consultée", awaiting: "En attente de confirmation", partial: "Payée en partie", paid: "Payée", overdue: "En retard", void: "Annulée" },
        // JobsFR
        jobs: { name: "Travaux", planning: "En planification", active: "En cours", hold: "En pause", completed: "Terminé" },
        // ContractsFR; declined and expired: owner
        contracts: { name: "Contrats", draft: "Brouillon", sent: "Envoyé", viewed: "Consulté", signed: "Signé", declined: "Refusé", voided: "Annulé", expired: "Expiré" },
        // SmartHomeFR / LeadsFR (Contacté, Gagnée); the rest: owner
        leads: { name: "Demandes", new: "Nouvelle", contacted: "Contactée", quoted: "Soumission envoyée", won: "Gagnée", lost: "Perdue", unsubscribed: "Désabonnée" },
        // CrewMapFR / CrewHoursFR / SmartHomeFR; rejected: owner
        crew: { name: "Équipe et heures", onSite: "Sur place", enRoute: "En route", off: "Congé", toApprove: "À approuver", approved: "Approuvées", rejected: "Refusées" },
        // JobFR (Délivré); the rest: owner
        permits: { name: "Permis", needed: "À demander", applied: "Demandé", issued: "Délivré", closed: "Fermé", notRequired: "Non requis" },
      },
    },
  },
  dev: {
    session: "Connecté : {{company}}",
    noSession: "Non connecté",
  },
};
