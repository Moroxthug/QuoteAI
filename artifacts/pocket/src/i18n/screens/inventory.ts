// Inventory, "Materials" (Inventory.dc.html, InventoryFR). French follows the board; (owner) = my own wording, to review. The board's "Count stock" button
// goes nowhere; the count and add sheets are (new).
export const en = {
  back: "Back", more: "More actions", retry: "Try again", close: "Close",
  title: "Materials", sub: "Stock in the shop, the truck and on site",
  offline: { lead: "You’re offline.", body: "Counts are from {{time}}. Changes need a connection." },
  readOnly: { lead: "View only.", body: "Your role can see stock but not reorder or change counts." },
  locked: { title: "Track stock and reorder", body: "Know what’s in the shop, the truck and on each site, and reorder before you run out.", tag: "Included in {{plan}}", compare: "Compare plans", note: "Plans can’t be changed in the app" },
  empty: { title: "Nothing tracked yet", body: "Add the materials you keep on hand. Scanned receipts can fill in the counts for you.", add: "Add materials", receipts: "Start from my receipts" },
  loadFailed: { title: "Couldn’t load your materials", body: "Check your connection and try again." },
  kpi: {
    tracked: "Items tracked", places_one: "{{count}} location", places_other: "{{count}} locations",
    low: "Running low", onOrder_one: "{{count}} on order", onOrder_other: "{{count}} on order", short_one: "{{count}} short for a job", short_other: "{{count}} short for a job", shortNone: "Nothing short",
    reserved: "Reserved", forJobs_one: "For {{count}} job", forJobs_other: "For {{count}} jobs",
  },
  where: "Location", loc: { all: "All", shop: "Shop", truck: "Truck", sites: "Sites" },
  low: {
    title: "Running low", link: "{{n}} of {{total}}", left: "{{unit}} left · reorder at {{par}}", status: { low: "Low", short: "Short", ordered: "On order" },
    order: "Order {{qty}} {{unit}} from {{supplier}}", ordered: "{{qty}} {{unit}} from {{supplier}}",
    needed: "{{qty}} {{unit}} set aside for {{job}}", price: "{{price}} each · last price", noPrice: "No price from a supplier yet", noSupplier: "Add a supplier to reorder",
    onList: "On the order list · {{dest}}", sent: "Ordered · {{dest}}", reorder: "Reorder", edit: "Edit", reorderLabel: "Reorder {{name}}", editLabel: "Edit the order for {{name}}",
  },
  stock: { all: "All stock", shop: "In the shop", truck: "On the truck", sites: "On sites", count: "{{count}} items", nowhere: "Nowhere", reserved: "{{qty}} {{unit}} reserved for {{job}}", none: "Nothing here yet" },
  fab: { count: "Count stock", review: "Review order list · {{n}}" },
  dest: { shop: "Shop", pickup: "Pick up" },
  sheet: {
    title: "Reorder", sub: "{{name}} · {{n}} left", quantity: "Quantity", why: "Suggested to bring you back to twice the reorder level", whyOther: "Suggested {{n}}",
    supplier: "Supplier", deliver: "Deliver to", fewer: "Fewer", more: "More", add: "Add {{total}} to order list", addNoPrice: "Add to order list", update: "Save changes", saving: "Saving…",
    tag: { best: "Best price", up: "Up {{pct}}%", last: "Last price" }, optionSub: "{{delivers}} · {{terms}}", counter: "Pay at the counter", noPrice: "No price yet", noSuppliers: "No suppliers yet. Add one in Suppliers.",
    priceEach: "{{price}} each",
  },
  count: {
    title: "Count stock", pick: "Choose what to count", add: "Add material", addSub: "Something new to keep track of", rowSub: "{{n}} {{unit}}", shop: "In the shop", truck: "On the truck",
    save: "Save count", all: "All items", fewer: "Fewer in {{place}}", more: "More in {{place}}", noItems: "Nothing to count yet.",
  },
  add: { title: "Add material", name: "Name", namePh: "For example, Drywall 1/2 in", unit: "Unit, plural", unitPh: "sheets", par: "Reorder at", shop: "In the shop now", save: "Add material", saving: "Adding…" },
  menu: { suppliers: "Suppliers", suppliersSub: "Who you buy from", count: "Count stock", countSub: "Update what is in each place", add: "Add material", addSub: "Something new to keep track of" },
  toast: {
    ordered: "Added to the order list", changed: "Order changed", counted: "Count saved", added: "Material added", failed: "Couldn’t save. Try again.", noAccess: "Your role can’t change stock.",
    found_one: "Started with {{count}} material from your receipts", found_other: "Started with {{count}} materials from your receipts", foundNone: "No new materials in your receipts",
  },
  soon: { setPlan: "Plans", suppliers: "Suppliers" },
};

export const fr: typeof en = {
  back: "Retour", more: "Plus d’actions", retry: "Réessayer", close: "Fermer",
  title: "Matériaux", sub: "Stock à l’atelier, dans le camion et sur les chantiers",
  offline: { lead: "Vous êtes hors ligne.", body: "Quantités de {{time}}. Les changements demandent une connexion." },
  readOnly: { lead: "Consultation seulement.", body: "Votre rôle peut voir le stock, mais pas commander ni modifier les quantités." },
  locked: { title: "Suivez le stock et recommandez", body: "Sachez ce qu’il y a à l’atelier, dans le camion et sur chaque chantier, et recommandez avant d’en manquer.", tag: "Inclus dans {{plan}}", compare: "Comparer les forfaits", note: "Les forfaits ne se modifient pas dans l’app" },
  empty: { title: "Rien de suivi pour l’instant", body: "Ajoutez les matériaux que vous gardez en stock. Vos reçus numérisés peuvent remplir les quantités pour vous.", add: "Ajouter des matériaux", receipts: "Partir de mes reçus" },
  loadFailed: { title: "Impossible de charger vos matériaux", body: "Vérifiez votre connexion et réessayez." },
  kpi: {
    tracked: "Articles suivis", places_one: "{{count}} emplacement", places_other: "{{count}} emplacements",
    low: "Stock bas", onOrder_one: "{{count}} commandé", onOrder_other: "{{count}} commandés", short_one: "{{count}} en manque", short_other: "{{count}} en manque", shortNone: "Aucun manque",
    reserved: "Réservé", forJobs_one: "Pour {{count}} chantier", forJobs_other: "Pour {{count}} chantiers",
  },
  where: "Emplacement", loc: { all: "Tout", shop: "Atelier", truck: "Camion", sites: "Chantiers" },
  low: {
    title: "Stock bas", link: "{{n}} sur {{total}}", left: "{{unit}} restant · commander sous {{par}}", status: { low: "Bas", short: "Manque", ordered: "Commandé" },
    order: "{{qty}} {{unit}} chez {{supplier}}", ordered: "{{qty}} {{unit}} chez {{supplier}}",
    needed: "{{qty}} {{unit}} réservé pour {{job}}", price: "{{price}} l’unité · dernier prix", noPrice: "Pas encore de prix d’un fournisseur", noSupplier: "Ajoutez un fournisseur pour commander",
    onList: "À la commande · {{dest}}", sent: "Commandé · {{dest}}", reorder: "Commander", edit: "Modifier", reorderLabel: "Commander {{name}}", editLabel: "Modifier la commande de {{name}}",
  },
  stock: { all: "Tout le stock", shop: "À l’atelier", truck: "Dans le camion", sites: "Sur les chantiers", count: "{{count}} articles", nowhere: "Nulle part", reserved: "{{qty}} {{unit}} réservé pour {{job}}", none: "Rien ici pour l’instant" },
  fab: { count: "Compter le stock", review: "Revoir la commande · {{n}}" },
  dest: { shop: "Atelier", pickup: "Cueillette" },
  sheet: {
    title: "Recommander", sub: "{{name}} · {{n}} restant", quantity: "Quantité", why: "Suggéré pour revenir à deux fois le seuil de commande", whyOther: "Suggéré : {{n}}",
    supplier: "Fournisseur", deliver: "Livrer à", fewer: "Moins", more: "Plus", add: "Ajouter {{total}} à la commande", addNoPrice: "Ajouter à la commande", update: "Enregistrer", saving: "Enregistrement…",
    tag: { best: "Meilleur prix", up: "Hausse {{pct}} %", last: "Dernier prix" }, optionSub: "{{delivers}} · {{terms}}", counter: "Payé au comptoir", noPrice: "Pas encore de prix", noSuppliers: "Aucun fournisseur. Ajoutez-en un dans Fournisseurs.",
    priceEach: "{{price}} l’unité",
  },
  count: {
    title: "Compter le stock", pick: "Choisissez quoi compter", add: "Ajouter un matériau", addSub: "Quelque chose de nouveau à suivre", rowSub: "{{n}} {{unit}}", shop: "À l’atelier", truck: "Dans le camion",
    save: "Enregistrer le compte", all: "Tous les articles", fewer: "Moins : {{place}}", more: "Plus : {{place}}", noItems: "Rien à compter pour l’instant.",
  },
  add: { title: "Ajouter un matériau", name: "Nom", namePh: "Par exemple, gypse ½ po", unit: "Unité, au pluriel", unitPh: "feuilles", par: "Commander sous", shop: "À l’atelier maintenant", save: "Ajouter", saving: "Ajout…" },
  menu: { suppliers: "Fournisseurs", suppliersSub: "Où vous achetez", count: "Compter le stock", countSub: "Mettre à jour chaque emplacement", add: "Ajouter un matériau", addSub: "Quelque chose de nouveau à suivre" },
  toast: {
    ordered: "Ajouté à la commande", changed: "Commande modifiée", counted: "Compte enregistré", added: "Matériau ajouté", failed: "Impossible d’enregistrer. Réessayez.", noAccess: "Votre rôle ne peut pas modifier le stock.",
    found_one: "{{count}} matériau d’après vos reçus", found_other: "{{count}} matériaux d’après vos reçus", foundNone: "Aucun nouveau matériau dans vos reçus",
  },
  soon: { setPlan: "Forfaits", suppliers: "Fournisseurs" },
};
