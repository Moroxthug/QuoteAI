// CrewMap and its French board. // owner = my own wording, to review. Not on the board: updated-ago on a row (there is no travel time to show).
export const en = {
  title: "Crew map", back: "Back", mapLabel: "Map of the crew", live: "{{count}} live", noneLive: "None live", off: "Off",
  sheet: "Crew today", meta: "{{count}} on site", metaNone: "Nobody on the clock", more: "Show more", less: "Show less",
  filter: "Filter crew", chips: { all: "All", site: "On site", off: "Off" },
  status: { site: "On site", off: "Off" },
  rowSite: "{{job}} · updated {{when}}", rowOff: "Location off", rowOffJob: "Location off · {{job}}",
  call: "Call {{name}}", text: "Text {{name}}",
  empty: { title: "Nobody here right now", body: "People show up when they clock in and share where they are." },
  foot: "Location is shared only while someone is on the clock, and only by people who allowed it.",
  locked: { title: "Live crew location is in Business", body: "See who is on site. Plans can’t be changed in the app.", action: "See plans" },
  loadFailed: { title: "Couldn’t load the map", body: "Check your connection and try again.", retry: "Try again" },
};
export const fr = {
  title: "Carte de l’équipe", back: "Retour", mapLabel: "Carte de l’équipe", live: "{{count}} en direct", noneLive: "Aucun en direct", off: "Désactivé",
  sheet: "Équipe aujourd’hui", meta: "{{count}} sur place", metaNone: "Personne n’est pointé", more: "Voir plus", less: "Voir moins",
  filter: "Filtrer l’équipe", chips: { all: "Tous", site: "Sur place", off: "Hors ligne" },
  status: { site: "Sur place", off: "Hors ligne" },
  rowSite: "{{job}} · mis à jour {{when}}", rowOff: "Position désactivée", rowOffJob: "Position désactivée · {{job}}",
  call: "Appeler {{name}}", text: "Écrire à {{name}}",
  empty: { title: "Personne ici pour l’instant", body: "Les gens s’affichent quand ils pointent et partagent leur position." },
  foot: "La position n’est partagée que pendant le pointage, et seulement par ceux qui l’ont permis.",
  locked: { title: "La position en direct de l’équipe est dans Affaires", body: "Voyez qui est sur place. Les forfaits ne se changent pas dans l’app.", action: "Voir les forfaits" },
  loadFailed: { title: "Impossible de charger la carte", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
};
