// NewQuote.dc.html / NewQuoteFR.dc.html: three ways to build a quote (write with AI, manual, from the price list).
// French from the board where it has the words; every line marked // owner is ours (the board has no word for it).
export const en = {
  back: "Back",
  title: "New quote",
  modeLabel: "How to build the quote",
  modes: { ai: "Write with AI", manual: "Manual", priceList: "Price list" },
  ai: {
    describeLabel: "Describe the job",
    placeholder: "Describe the job. Rooms, sizes, materials, what’s included.",
    photos: "Photos", photosLabel: "Add photos",
    pdf: "PDF", pdfLabel: "Add a PDF", pdfSoon: "Attach a PDF",
    sheet: "Sheet", sheetLabel: "Add a spreadsheet", sheetSoon: "Attach a spreadsheet",
    photosCount_one: "{{count}} photo", photosCount_other: "{{count}} photos",
    photosAttached_one: "{{count}} photo goes with the job.", photosAttached_other: "{{count}} photos go with the job.",
    photosRemove: "Remove",
    photosDenied: "Allow photos in your phone’s settings to attach pictures.",
    photosFailed: "Couldn’t open your photos. Try again.",
    mic: "Describe it out loud", micStop: "Stop and write it down", micBusy: "Writing down what you said",
    micNote: {
      unavailable: "Speaking the job isn’t available on this phone yet. Type it for now.",
      denied: "Allow the microphone in your phone’s settings to describe the job out loud.",
      failed: "Couldn’t write that down. Try again, or type it.",
      offline: "You’re offline. Type the job for now.",
      empty: "Didn’t catch anything. Try again.",
    },
    examples: "Start from an example", examplesLabel: "Examples by trade",
    example: {
      painting: { name: "Painting", text: "Repaint 3 bedrooms and the hallway, about 1,120 sq ft of walls and ceilings, two coats. Bath ceiling has water damage, cut out and patch. We supply paint." },
      drywall: { name: "Drywall", text: "Board, tape and mud a 600 sq ft basement rec room, level 4 finish, one bulkhead around the duct." },
      flooring: { name: "Flooring", text: "Remove carpet in 2 bedrooms (320 sq ft) and install click vinyl plank with new baseboards." },
      decks: { name: "Decks", text: "Power wash and stain a 14 by 16 ft cedar deck with 30 ft of railing, two coats semi-transparent." },
      bathrooms: { name: "Bathrooms", text: "Gut and redo a 5 by 8 ft main bath: tub to walk-in shower, tile floor and walls, new vanity and toilet." },
      kitchens: { name: "Kitchens", text: "Paint 24 cabinet doors and boxes, new hardware, and a subway tile backsplash, about 30 sq ft." },
      basements: { name: "Basements", text: "Finish 750 sq ft basement: framing, insulation, drywall, pot lights, LVP floor and a 3-piece bath rough-in." },
    },
    options: "Options", layout: "PDF layout", layouts: { standard: "Standard", professional: "Professional", elegant: "Elegant" },
    target: "Target total", targetHelp: "The AI prices toward it", targetPlaceholder: "Optional",
    client: "Client", recent: "Recent", newClient: "New client", newClientSub: "Add their details",
    clientsLoading: "Loading your clients", clientsFailed: "Couldn’t load your clients. You can still add a new one.", clientsRetry: "Try again", clientsNone: "No clients yet. Add the first one below.",
    form: {
      name: "Name", namePlaceholder: "Full name or company", address: "Address", addressPlaceholder: "Street and unit", city: "City", cityPlaceholder: "Toronto",
      province: "Province", postal: "Postal code", postalPlaceholder: "M4W 2Z9", phone: "Phone", phonePlaceholder: "(416) 555-0100", email: "Email", emailPlaceholder: "name@email.com",
      remember: "Remember this client", chooseProvince: "Choose",
    },
    write: "Write my quote", writingBtn: "Writing…", open: "Open the quote",
  },
  writing: {
    title: "Writing your quote", ready: "Your quote is ready",
    sub: "For {{client}} · {{layout}} layout", subNoClient: "{{layout}} layout", newClientName: "a new client",
    steps: { reading: "Reading your description", measuring: "Measuring rooms and quantities", pricing: "Pricing from your price list", tax: "Adding {{tax}}, {{province}} {{rate}}%", taxGeneric: "Adding your sales tax", layout: "Laying out the PDF" },
    lines_one: "{{count}} line", lines_other: "{{count}} lines", chapters_one: "{{count}} chapter", chapters_other: "{{count}} chapters", summary: "{{lines}} in {{chapters}}",
    untitled: "Your new quote", restart: "Start over", stepDone: "Done", stepNow: "In progress", stepLater: "Later",
  },
  problem: {
    offline: { lead: "You’re offline.", text: "Your description is kept. Try again when you have signal." },
    quota: { lead: "That’s the limit for this month.", text: "Your plan’s quotes are used up. Check your plan on quoteai.ca." },
    cannot: { lead: "That wasn’t enough to price.", text: "Add what, where and how big." },
    unlock: { lead: "This needs your plan to be active.", text: "Check it on quoteai.ca." },
    role: { lead: "Your role can’t create quotes.", text: "Ask the owner of the company to give you access." },
    failed: { lead: "That didn’t go through.", text: "Nothing was lost. Try again in a moment." },
    retry: "Try again",
  },
  manual: {
    title: "Title", titlePlaceholder: "What the job is",
    change: "Change", noClient: "No client yet", noClientSub: "Choose who it is for", choose: "Choose",
    chapterDefault: "Work", rename: "Rename", renameDone: "Done", chapterLabel: "Chapter name",
    descLabel: "What the work is", descPlaceholder: "Describe the line",
    improve: "Improve", improveLabel: "Improve this line with AI", improveSoon: "Improve a line with AI",
    unit: "Unit", qty: "Qty", unitPrice: "Unit price", total: "Total",
    addLine: "Add a line", addChapter: "Add a chapter", subtotal: "Subtotal",
    taxes: "Taxes and totals", province: "Province", exempt: "Tax-exempt", exemptSub: "Needs the client’s exemption number", exemptWord: "Exempt", taxWord: "Tax",
    terms: "Payment terms", termsLabel: "Payment terms",
    term: { deposit30: "30% deposit, rest on completion", half: "50% now, 50% on completion", completion: "All on completion", net15: "Net 15" },
    notes: "Notes for the client", notesPlaceholder: "Anything they should know: access, parking, pets, colours to pick",
    save: "Save and preview", saving: "Saving…", needLine: "Add at least one line to save.",
  },
  sheets: { clientSearch: "Search your clients", clientTitle: "Choose a client", noClient: "No client yet", noClientSub: "You can add one later", provinceTitle: "Province" },
  pb: {
    searchLabel: "Search your price list", categoryLabel: "Category", all: "All",
    add: "Add", added: "Added", remove: "Remove",
    rate: "{{price}} / {{unit}}",
    none: { title: "Nothing in your price list matches", body: "Try another word, or add it as a manual line." },
    emptyList: { title: "Your price list is empty", body: "Add items on quoteai.ca to build quotes from them, or write the quote by hand.", action: "Write it by hand" },
    loading: "Loading your price list",
    loadFailed: { title: "Couldn’t load your price list", body: "Check your connection and try again.", retry: "Try again" },
    selection: "Your selection", items_one: "{{count}} item", items_other: "{{count}} items", nothing: "Tap Add on any item to start the quote.", beforeTax: "Before tax",
    less: "Less {{name}}", more: "More {{name}}",
    build_one: "Build quote from {{count}} item", build_other: "Build quote from {{count}} items", addToStart: "Add items to start", chapter: "Scope of work",
  },
  tax: { hst: "HST", gst: "GST", gstQst: "GST + QST", gstPst: "GST + PST", gstRst: "GST + RST" },
  taxLine: "{{tax}}, {{province}} {{rate}}%",
  provinceValue: "{{province}} · {{tax}}",
};

export const fr: typeof en = {
  back: "Retour",
  title: "Nouvelle soumission",
  modeLabel: "Comment créer la soumission",
  modes: { ai: "Rédiger avec l’IA", manual: "Manuelle", priceList: "Liste de prix" }, // owner (the mode names)
  ai: {
    describeLabel: "Décrivez les travaux",
    placeholder: "Décrivez les travaux : pièces, dimensions, matériaux, ce qui est inclus.",
    photos: "Photos", photosLabel: "Ajouter des photos",
    pdf: "PDF", pdfLabel: "Ajouter un PDF", pdfSoon: "Joindre un PDF", // owner (pdfSoon)
    sheet: "Tableur", sheetLabel: "Ajouter un tableur", sheetSoon: "Joindre un tableur", // owner (sheet, sheetSoon)
    photosCount_one: "{{count}} photo", photosCount_other: "{{count}} photos",
    photosAttached_one: "{{count}} photo accompagne les travaux.", photosAttached_other: "{{count}} photos accompagnent les travaux.", // owner
    photosRemove: "Retirer", // owner
    photosDenied: "Autorisez les photos dans les réglages de votre téléphone pour joindre des images.", // owner
    photosFailed: "Impossible d’ouvrir vos photos. Réessayez.", // owner
    mic: "Décrire à voix haute", micStop: "Arrêter et écrire", micBusy: "Transcription en cours", // owner (micStop, micBusy)
    micNote: {
      unavailable: "Décrire les travaux à voix haute n’est pas encore possible sur ce téléphone. Écrivez-les pour l’instant.", // owner
      denied: "Autorisez le microphone dans les réglages de votre téléphone pour décrire les travaux à voix haute.", // owner
      failed: "Impossible de transcrire. Réessayez, ou écrivez-les.", // owner
      offline: "Vous êtes hors ligne. Écrivez les travaux pour l’instant.", // owner
      empty: "Rien n’a été entendu. Réessayez.", // owner
    },
    examples: "Partir d’un exemple", examplesLabel: "Exemples par métier",
    example: {
      painting: { name: "Peinture", text: "Repeindre 3 chambres et le corridor, environ 1 120 pi² de murs et plafonds, deux couches. Le plafond de la salle de bain a un dégât d’eau : découper et réparer. Peinture fournie." },
      drywall: { name: "Gypse", text: "Poser, tirer les joints et plâtrer une salle familiale de 600 pi² au sous-sol, finition niveau 4, un caisson autour du conduit." },
      flooring: { name: "Planchers", text: "Enlever le tapis dans 2 chambres (320 pi²) et poser des lattes de vinyle à clic avec de nouvelles plinthes." },
      decks: { name: "Patios", text: "Laver à pression et teindre un patio en cèdre de 14 pi sur 16 pi avec 30 pi de garde-corps, deux couches semi-transparentes." },
      bathrooms: { name: "Salles de bain", text: "Refaire au complet une salle de bain de 5 pi sur 8 pi : bain remplacé par une douche ouverte, céramique au sol et aux murs, nouvelle vanité et toilette." },
      kitchens: { name: "Cuisines", text: "Peindre 24 portes et caissons d’armoires, nouvelles poignées et un dosseret en céramique métro d’environ 30 pi²." },
      basements: { name: "Sous-sols", text: "Finir un sous-sol de 750 pi² : charpente, isolation, gypse, lumières encastrées, plancher de vinyle et préparation pour une salle de bain 3 pièces." },
    },
    options: "Options", layout: "Mise en page du PDF", layouts: { standard: "Standard", professional: "Professionnelle", elegant: "Élégante" },
    target: "Montant visé", targetHelp: "L’IA établit ses prix en fonction", targetPlaceholder: "Facultatif",
    client: "Client", recent: "Récents", newClient: "Nouveau client", newClientSub: "Ajouter ses coordonnées",
    clientsLoading: "Chargement de vos clients", clientsFailed: "Impossible de charger vos clients. Vous pouvez quand même en ajouter un.", clientsRetry: "Réessayer", clientsNone: "Aucun client pour l’instant. Ajoutez le premier ci-dessous.", // owner
    form: {
      name: "Nom", namePlaceholder: "Nom complet ou entreprise", address: "Adresse", addressPlaceholder: "Rue et numéro d’unité", city: "Ville", cityPlaceholder: "Toronto",
      province: "Province", postal: "Code postal", postalPlaceholder: "M4W 2Z9", phone: "Téléphone", phonePlaceholder: "(416) 555-0100", email: "Courriel", emailPlaceholder: "nom@courriel.com",
      remember: "Mémoriser ce client", chooseProvince: "Choisir", // owner (chooseProvince)
    },
    write: "Rédiger ma soumission", writingBtn: "Rédaction…", open: "Ouvrir la soumission", // owner (write, writingBtn)
  },
  writing: {
    title: "Rédaction de votre soumission", ready: "Votre soumission est prête",
    sub: "Pour {{client}} · mise en page {{layout}}", subNoClient: "Mise en page {{layout}}", newClientName: "un nouveau client",
    steps: { reading: "Lecture de votre description", measuring: "Mesure des pièces et des quantités", pricing: "Prix tirés de votre liste de prix", tax: "Ajout de la {{tax}}, {{province}} {{rate}} %", taxGeneric: "Ajout de vos taxes de vente", layout: "Mise en page du PDF" },
    lines_one: "{{count}} ligne", lines_other: "{{count}} lignes", chapters_one: "{{count}} section", chapters_other: "{{count}} sections", summary: "{{lines}} en {{chapters}}",
    untitled: "Votre nouvelle soumission", restart: "Recommencer", stepDone: "Terminé", stepNow: "En cours", stepLater: "À venir", // owner
  },
  problem: {
    offline: { lead: "Vous êtes hors ligne.", text: "Votre description est conservée. Réessayez quand vous aurez du signal." },
    quota: { lead: "Vous avez atteint la limite du mois.", text: "Les soumissions de votre forfait sont épuisées. Vérifiez votre forfait sur quoteai.ca." },
    cannot: { lead: "Ce n’est pas assez pour établir un prix.", text: "Ajoutez quoi, où et quelle taille." },
    unlock: { lead: "Cela demande un forfait actif.", text: "Vérifiez-le sur quoteai.ca." },
    role: { lead: "Votre rôle ne permet pas de créer des soumissions.", text: "Demandez au propriétaire de l’entreprise de vous donner accès." },
    failed: { lead: "Ça n’a pas fonctionné.", text: "Rien n’est perdu. Réessayez dans un instant." },
    retry: "Réessayer",
  }, // owner (all of problem; the first two lines of quota/cannot/unlock follow the Home quote bar)
  manual: {
    title: "Titre", titlePlaceholder: "En quoi consistent les travaux", // owner (titlePlaceholder)
    change: "Modifier", noClient: "Aucun client pour l’instant", noClientSub: "Choisissez pour qui", choose: "Choisir", // owner
    chapterDefault: "Travaux", rename: "Renommer", renameDone: "Terminé", chapterLabel: "Nom de la section", // owner (chapterDefault, renameDone, chapterLabel)
    descLabel: "En quoi consistent les travaux", descPlaceholder: "Décrivez la ligne", // owner
    improve: "Améliorer", improveLabel: "Améliorer cette ligne avec l’IA", improveSoon: "Améliorer une ligne avec l’IA", // owner (improveSoon)
    unit: "Unité", qty: "Qté", unitPrice: "Prix unitaire", total: "Total",
    addLine: "Ajouter une ligne", addChapter: "Ajouter une section", subtotal: "Sous-total",
    taxes: "Taxes et totaux", province: "Province", exempt: "Exonéré de taxes", exemptSub: "Nécessite le numéro d’exemption du client", exemptWord: "Exonéré", taxWord: "Taxe",
    terms: "Modalités de paiement", termsLabel: "Modalités de paiement",
    term: { deposit30: "Acompte de 30 %, solde à la fin des travaux", half: "50 % maintenant, 50 % à la fin", completion: "Tout à la fin des travaux", net15: "Net 15 jours" },
    notes: "Notes pour le client", notesPlaceholder: "Ce qu’il faut savoir : accès, stationnement, animaux, couleurs à choisir",
    save: "Enregistrer et prévisualiser", saving: "Enregistrement…", needLine: "Ajoutez au moins une ligne pour enregistrer.", // owner (saving, needLine)
  },
  sheets: { clientSearch: "Rechercher dans vos clients", clientTitle: "Choisir un client", noClient: "Aucun client pour l’instant", noClientSub: "Vous pourrez en ajouter un plus tard", provinceTitle: "Province" }, // owner
  pb: {
    searchLabel: "Rechercher dans votre liste de prix", categoryLabel: "Catégorie", all: "Tout",
    add: "Ajouter", added: "Ajouté", remove: "Retirer",
    rate: "{{price}} / {{unit}}",
    none: { title: "Rien ne correspond dans votre liste de prix", body: "Essayez un autre mot, ou ajoutez-le comme ligne manuelle." },
    emptyList: { title: "Votre liste de prix est vide", body: "Ajoutez des articles sur quoteai.ca pour créer des soumissions à partir de ceux-ci, ou rédigez la soumission à la main.", action: "La rédiger à la main" }, // owner
    loading: "Chargement de votre liste de prix", // owner
    loadFailed: { title: "Impossible de charger votre liste de prix", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" }, // owner
    selection: "Votre sélection", items_one: "{{count}} article", items_other: "{{count}} articles", nothing: "Touchez Ajouter sur un article pour commencer la soumission.", beforeTax: "Avant taxes",
    less: "Moins de {{name}}", more: "Plus de {{name}}", // owner
    build_one: "Créer avec {{count}} article", build_other: "Créer avec {{count}} articles", addToStart: "Ajoutez des articles", chapter: "Portée des travaux", // owner (chapter)
  },
  tax: { hst: "TVH", gst: "TPS", gstQst: "TPS + TVQ", gstPst: "TPS + TVP", gstRst: "TPS + TVD" }, // owner (all but TVH)
  taxLine: "{{tax}}, {{province}} {{rate}} %",
  provinceValue: "{{province}} · {{tax}}",
};
