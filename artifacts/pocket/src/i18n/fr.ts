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
  dev: {
    session: "Connecté : {{company}}",
    noSession: "Non connecté",
  },
};
