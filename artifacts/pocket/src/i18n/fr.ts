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
  },
  dev: {
    session: "Connecté : {{company}}",
    noSession: "Non connecté",
  },
};
