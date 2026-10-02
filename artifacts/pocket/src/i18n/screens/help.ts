// HelpCentre (HelpCentre.dc.html and HelpCentreFR). French follows the board; the rest is my own wording, to review. The articles themselves are the web help centre's (content/helpArticles.ts).
export const en = {
  back: "Back", title: "Help", chatOnline: "Chat online", chatOffline: "Chat offline",
  offline: { lead: "You’re offline.", body: "Articles you’ve opened before still work. Videos and chat need a connection." },
  searchLabel: "Search help", searchPlaceholder: "Search help, e.g. deposit", clear: "Clear search",
  results: "Results", found_one: "{{count}} found", found_other: "{{count}} found",
  none: { title: "Nothing on “{{q}}” yet", body: "Ask us and we’ll answer here, usually within a few minutes.", action: "Ask support" },
  popular: "Popular", topics: "Topics", articles_one: "{{count}} article", articles_other: "{{count}} articles", videos: "Videos", videoCount: "{{count}} short videos",
  topic: { start: "Getting started", quotes: "Quotes", contracts: "Contracts & e-signature", jobs: "Jobs", money: "Invoices & payments", team: "Team", growth: "Leads & integrations" },
  video: {
    quotes: ["Your first quote", "Quotes"], overview: ["quoteAI in 60 seconds", "Overview"], jobs: ["Start a job from a quote", "Jobs"], crew: ["Your crew’s first day", "Crew"], etransfer: ["Get paid by e-Transfer", "Invoices"], qbo: ["Connect QuickBooks", "Integrations"],
    watch: "Watch {{title}}, {{dur}}", offline: "Offline",
  },
  talk: { title: "Talk to us", chat: ["Chat with us", "Usually replies in 5 min", "Needs a connection", "Online", "Offline"], email: ["Email", "support@quoteai.ca · replies within a day"], call: ["Call", "1-855-786-8324"], problem: ["Report a problem", "Send a screenshot and a note"], hours: "Phone lines Mon–Fri, 8 am–8 pm ET. Français aussi." },
  article: { back: "Back to Help", read: "{{count}} min read · Updated {{date}}", helpful: "Was this helpful?", yes: "Yes", no: "No", thanks: "Thanks for telling us.", sorry: "Sorry about that. Want a person?", chat: "Chat with support", missing: "Tell us what’s missing", related: "Related", gone: "That article isn’t here." },
  failed: "Couldn’t open that.",
};

export const fr: typeof en = {
  back: "Retour", title: "Aide", chatOnline: "Clavardage ouvert", chatOffline: "Clavardage fermé",
  offline: { lead: "Vous êtes hors ligne.", body: "Les articles déjà ouverts restent accessibles. Les vidéos et le clavardage exigent une connexion." },
  searchLabel: "Rechercher dans l’aide", searchPlaceholder: "Rechercher, p. ex. dépôt", clear: "Effacer la recherche",
  results: "Résultats", found_one: "{{count}} trouvé", found_other: "{{count}} trouvés",
  none: { title: "Rien sur « {{q}} » pour l’instant", body: "Posez-nous la question, nous répondrons ici, souvent en quelques minutes.", action: "Demander au soutien" },
  popular: "Populaires", topics: "Sujets", articles_one: "{{count}} article", articles_other: "{{count}} articles", videos: "Vidéos", videoCount: "{{count}} courtes vidéos",
  topic: { start: "Premiers pas", quotes: "Soumissions", contracts: "Contrats et signature électronique", jobs: "Travaux", money: "Factures et paiements", team: "Équipe", growth: "Prospects et intégrations" },
  video: {
    quotes: ["Votre première soumission", "Soumissions"], overview: ["quoteAI en 60 secondes", "Aperçu"], jobs: ["Lancer un chantier depuis une soumission", "Travaux"], crew: ["Le premier jour de votre équipe", "Équipe"], etransfer: ["Être payé par virement Interac", "Factures"], qbo: ["Connecter QuickBooks", "Intégrations"],
    watch: "Regarder : {{title}}, {{dur}}", offline: "Hors ligne",
  },
  talk: { title: "Nous joindre", chat: ["Clavarder avec nous", "Répond en général en 5 min", "Connexion requise", "En ligne", "Hors ligne"], email: ["Courriel", "support@quoteai.ca · réponse en 1 jour"], call: ["Téléphone", "1-855-786-8324"], problem: ["Signaler un problème", "Envoyez une capture d’écran et une note"], hours: "Lignes ouvertes du lun. au ven., 8 h à 20 h HE. English too." },
  article: { back: "Retour à l’aide", read: "{{count}} min de lecture · Mis à jour le {{date}}", helpful: "Cet article vous a-t-il aidé ?", yes: "Oui", no: "Non", thanks: "Merci de nous l’avoir dit.", sorry: "Désolé. Voulez-vous parler à quelqu’un ?", chat: "Clavarder avec le soutien", missing: "Dites-nous ce qui manque", related: "Articles connexes", gone: "Cet article n’est plus là." },
  failed: "Impossible de l’ouvrir.",
};
