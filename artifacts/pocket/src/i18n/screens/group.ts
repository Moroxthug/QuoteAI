// Group (Group.dc.html, GroupFR). French follows the board; (owner) = my own wording, to review. (new) = not on the board.
export const en = {
  back: "Back", more: "More actions", retry: "Try again", close: "Close", cancel: "Cancel", title: "Group",
  locked: {
    title: "Run more than one company", body: "Money, crew and one bill for every company you own, in one place.", tag: "Included in {{plan}}",
    feats: { money: "Combined money across companies", crew: "Crew hours on every crew", book: "One shared price book", bill: "One bill for all of them" },
    thisCompany: "{{province}} · this company", second: "Your second company", secondSub: "Add it once you’re on {{plan}}",
    bannerLead: "Plans can’t be changed in the app.", bannerBody: "Your owner account can do it on the website.", plans: "See plans on quoteai.ca", soon: "Plan",
  },
  scope: { showing: "Showing", all: "All companies", allSub_one: "{{count}} company · combined", allSub_other: "{{count}} companies · combined", pick: "Company" },
  month: { left: "{{amount}} between companies left out", only: "This company only" },
  kpi: {
    invoiced: "Invoiced", costs: "Costs", margin: "Margin", owed: "Outstanding",
    up: "↑ {{pct}} on {{month}}", down: "↓ {{pct}} on {{month}}", same: "Same as {{month}}", costsSub: "Labour, materials, subs", profit: "{{amount}} profit", loss: "{{amount}} loss", overdue: "{{amount}} overdue", none: "Nothing overdue",
  },
  bars: { title: "Invoiced by month" },
  companies: {
    title: "Companies", count_one: "{{count}} company", count_other: "{{count}} companies", sub: "{{province}} · {{jobs}}", jobs_one: "{{count}} active job", jobs_other: "{{count}} active jobs",
    margin: "{{pct}} margin", invited: "Invitation sent", hidden: "Figures hidden", hiddenSub: "You’re not an owner or admin there",
    add: "Add a company", addSub: "Bring in one you own", addNone: "Add the company on quoteai.ca first, then invite it here.", invitedToast: "Invitation sent to {{name}}", pickTitle: "Add a company", pickSub: "Companies you own that aren’t in a group",
  },
  shared: {
    title: "Shared", bill: "One bill", billPays_one: "{{name}} pays for {{count}} company", billPays_other: "{{name}} pays for {{count}} companies", billNone: "Each company pays its own",
    book: "Shared price book", bookOn: "Using {{name}}’s price book", bookOff: "Each company keeps its own", bookNone: "No company is sharing its book yet", members: "Members and roles", membersSub_one: "{{count}} person on the crews", membersSub_other: "{{count}} people on the crews",
  },
  crew: {
    title: "Crew on both", week: "This week", over: "Over {{limit}} h", under: "Under {{limit}} h", hours: "{{name}} {{hours}} h",
    dup: "{{a}} and {{b}} look like the same person", link: "Link", linked: "Linked as one person · hours combined",
  },
  leave: { button: "Leave this group", title: "Leave this group?", body: "{{name}} stops sharing money, crew hours and the price book with the group. Nothing is deleted.", confirm: "Leave group", left: "You left the group" },
  start: { title: "Start a group", body: "Put the companies you own side by side: combined money, one crew list, a shared price book.", action: "Start a group", name: "Group name", save: "Start group" },
  invite: { lead: "{{name}} invited this company to “{{group}}”.", join: "Join", decline: "Decline", joined: "You joined the group", declined: "Invitation declined" },
  loadFailed: { title: "Couldn’t load the group", body: "Check your connection and try again." },
  offline: { lead: "You’re offline.", body: "Showing the group as of your last visit." },
  noAccess: "Only an owner or admin can change the group.", failed: "Couldn’t save. Try again.", denied: "You need to be an owner or admin of a company to see its figures.",
};

export const fr: typeof en = {
  back: "Retour", more: "Plus d’actions", retry: "Réessayer", close: "Fermer", cancel: "Annuler", title: "Groupe",
  locked: {
    title: "Gérez plus d’une entreprise", body: "Finances, équipes et une seule facture pour toutes vos entreprises, au même endroit.", tag: "Inclus dans {{plan}}",
    feats: { money: "Finances combinées des entreprises", crew: "Heures de toutes les équipes", book: "Une liste de prix commune", bill: "Une seule facture pour toutes" },
    thisCompany: "{{province}} · cette entreprise", second: "Votre deuxième entreprise", secondSub: "Ajoutez-la une fois passé à {{plan}}",
    bannerLead: "Le forfait ne se change pas dans l’appli.", bannerBody: "Le compte propriétaire peut le faire sur le site Web.", plans: "Voir les forfaits sur quoteai.ca", soon: "Forfait",
  },
  scope: { showing: "Affichage", all: "Toutes les entreprises", allSub_one: "{{count}} entreprise · combinée", allSub_other: "{{count}} entreprises · combinées", pick: "Entreprise" },
  month: { left: "{{amount}} entre entreprises exclus", only: "Cette entreprise seulement" },
  kpi: {
    invoiced: "Facturé", costs: "Coûts", margin: "Marge", owed: "À recevoir",
    up: "↑ {{pct}} sur {{month}}", down: "↓ {{pct}} sur {{month}}", same: "Comme en {{month}}", costsSub: "Main-d’œuvre, matériaux, sous-traitants", profit: "{{amount}} de profit", loss: "{{amount}} de perte", overdue: "{{amount}} en retard", none: "Rien en retard",
  },
  bars: { title: "Facturé par mois" },
  companies: {
    title: "Entreprises", count_one: "{{count}} entreprise", count_other: "{{count}} entreprises", sub: "{{province}} · {{jobs}}", jobs_one: "{{count}} chantier actif", jobs_other: "{{count}} chantiers actifs",
    margin: "Marge {{pct}}", invited: "Invitation envoyée", hidden: "Chiffres masqués", hiddenSub: "Vous n’êtes ni propriétaire ni administrateur là-bas",
    add: "Ajouter une entreprise", addSub: "Ajoutez-en une qui vous appartient", addNone: "Ajoutez d’abord l’entreprise sur quoteai.ca, puis invitez-la ici.", invitedToast: "Invitation envoyée à {{name}}", pickTitle: "Ajouter une entreprise", pickSub: "Vos entreprises qui ne sont dans aucun groupe",
  },
  shared: {
    title: "En commun", bill: "Une seule facture", billPays_one: "{{name}} paie pour {{count}} entreprise", billPays_other: "{{name}} paie pour {{count}} entreprises", billNone: "Chaque entreprise paie la sienne",
    book: "Liste de prix commune", bookOn: "Utilise la liste de prix de {{name}}", bookOff: "Chaque entreprise a la sienne", bookNone: "Aucune entreprise ne partage encore sa liste", members: "Membres et rôles", membersSub_one: "{{count}} personne dans les équipes", membersSub_other: "{{count}} personnes dans les équipes",
  },
  crew: {
    title: "Équipe des deux", week: "Cette semaine", over: "Plus de {{limit}} h", under: "Moins de {{limit}} h", hours: "{{name}} {{hours}} h",
    dup: "{{a}} et {{b}} semblent être la même personne", link: "Lier", linked: "Liés en une personne · heures combinées",
  },
  leave: { button: "Quitter ce groupe", title: "Quitter ce groupe ?", body: "{{name}} cesse de partager les finances, les heures et la liste de prix avec le groupe. Rien n’est supprimé.", confirm: "Quitter le groupe", left: "Vous avez quitté le groupe" },
  start: { title: "Créer un groupe", body: "Réunissez vos entreprises : finances combinées, une seule liste d’équipe, une liste de prix commune.", action: "Créer un groupe", name: "Nom du groupe", save: "Créer le groupe" },
  invite: { lead: "{{name}} a invité cette entreprise dans « {{group}} ».", join: "Joindre", decline: "Refuser", joined: "Vous avez joint le groupe", declined: "Invitation refusée" },
  loadFailed: { title: "Impossible de charger le groupe", body: "Vérifiez votre connexion et réessayez." },
  offline: { lead: "Vous êtes hors ligne.", body: "Voici le groupe à votre dernière visite." },
  noAccess: "Seul un propriétaire ou un administrateur peut modifier le groupe.", failed: "Impossible d’enregistrer. Réessayez.", denied: "Vous devez être propriétaire ou administrateur d’une entreprise pour voir ses chiffres.",
};
