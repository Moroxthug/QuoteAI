// Weather on Home (WEATHER.md): the header line, the Site weather widget, This week. The strings of the summary and the practical line are SmartHome.dc.html's and SmartHomeFR.dc.html's; the server sends
// keys, so English and French always match. `exterior_after`, "snowing until" and the no-rain week footer are not on a board (the table has no row for them); they are marked in the plan.
export const en = {
  name: "Site weather", unavailable: "Weather unavailable", retry: "Try again", updated: "Updated {{time}}", loadingA11y: "Loading the weather",
  sum: {
    rain_after: "rain after {{time}}", rain_now: "raining until {{time}}", rain_all_day: "rain all day", snow_after: "snow after {{time}}", snow_now: "snowing until {{time}}", dry_all_day: "dry all day", freezing: "freezing",
  },
  adv: { exterior_before: "Plan exterior work before {{time}}", exterior_after: "Exterior work fits after {{time}}", inside_only: "Inside work only today", good_exterior: "Good day for exterior work" },
  card: "Site weather, {{place}}, {{temp}}, {{summary}}", bar: "{{hour}}, {{prob}} percent chance of precipitation",
  site: { crew_one: "{{count}} person on site", crew_other: "{{count}} people on site", slot: "{{hour}} h, {{temp}}, {{prob}} percent", feelsOpen: "Open", open: "Open schedule" },
  attribution: { legal: "Weather data sources", eccc: "Weather data: {{name}}" },
  about: { label: "Weather data", sub: "Where the forecast comes from" },
  week: {
    name: "This week", visits_one: "{{count}} visit", visits_other: "{{count}} visits", rain: "Rain {{days}}.", and: " and ", fits: "Exterior work fits best on {{day}}.", noRain: "No rain this week.", plan: "Weather to plan around",
    row: "{{date}} · rain", rowVisits_one: "{{count}} visit planned", rowVisits_other: "{{count}} visits planned", rowNone: "Nothing planned", open: "Open schedule", dayA11y: "{{date}}, {{visits}}, rain likely",
    dayDry: "{{date}}, {{visits}}",
  },
};

export const fr: typeof en = {
  name: "Météo des chantiers", unavailable: "Météo indisponible", retry: "Réessayer", updated: "Mis à jour {{time}}", loadingA11y: "Chargement de la météo",
  sum: {
    rain_after: "pluie après {{time}}", rain_now: "pluie jusqu’à {{time}}", rain_all_day: "pluie toute la journée", snow_after: "neige après {{time}}", snow_now: "neige jusqu’à {{time}}", dry_all_day: "sec toute la journée", freezing: "gel",
  },
  adv: { exterior_before: "Prévoyez les travaux extérieurs avant {{time}}", exterior_after: "Les travaux extérieurs passent mieux après {{time}}", inside_only: "Travail intérieur seulement aujourd’hui", good_exterior: "Bonne journée pour les travaux extérieurs" },
  card: "Météo des chantiers, {{place}}, {{temp}}, {{summary}}", bar: "{{hour}} h, {{prob}} pour cent de probabilité de précipitations",
  site: { crew_one: "{{count}} personne sur place", crew_other: "{{count}} personnes sur place", slot: "{{hour}} h, {{temp}}, {{prob}} pour cent", feelsOpen: "Ouvrir", open: "Ouvrir l’horaire" },
  attribution: { legal: "Sources des données météo", eccc: "Données météo : {{name}}" },
  about: { label: "Données météo", sub: "D’où viennent les prévisions" },
  week: {
    name: "Cette semaine", visits_one: "{{count}} visite", visits_other: "{{count}} visites", rain: "Pluie {{days}}.", and: " et ", fits: "L’extérieur passe mieux {{day}}.", noRain: "Pas de pluie cette semaine.", plan: "Météo à prévoir",
    row: "{{date}} · pluie", rowVisits_one: "{{count}} visite prévue", rowVisits_other: "{{count}} visites prévues", rowNone: "Rien de prévu", open: "Ouvrir l’horaire", dayA11y: "{{date}}, {{visits}}, pluie probable",
    dayDry: "{{date}}, {{visits}}",
  },
};
