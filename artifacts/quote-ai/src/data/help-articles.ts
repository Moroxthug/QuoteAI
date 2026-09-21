// Phase 70: help-centre content — the ten flows a new company goes through,
// in the order they happen (JOB-LIFECYCLE-PLAN §3). Bilingual like the
// contract templates. Rendered by src/pages/help/*, prerendered by
// scripts/prerender-seo.ts, listed by generate-sitemap.ts and the site map.
//
// Keep every statement here true to the product: numbers (follow-up cadence
// 2/5/10 days, reminders 3/7/14, worker links 6 months, seats per plan) are
// the same constants the server uses. When one of those changes, change it
// here too — and bump `updatedAt` so the sitemap lastmod moves.

type HelpLang = "en" | "fr";
export type L = { [K in HelpLang]: string };

export type HelpBlock =
  | { type: "p"; text: L }
  | { type: "h"; text: L }
  | { type: "steps"; items: L[] }
  | { type: "bullets"; items: L[] }
  | { type: "note"; text: L };

export interface HelpArticle {
  slug: string;
  category: HelpCategory;
  title: L;
  summary: L;
  /** ISO date of the last content change — the sitemap lastmod. */
  updatedAt: string;
  readingTimeMin: number;
  blocks: HelpBlock[];
}

export type HelpCategory = "start" | "quotes" | "contracts" | "jobs" | "money" | "team" | "growth";

export const HELP_CATEGORIES: Record<HelpCategory, L> = {
  start: { en: "Getting started", fr: "Premiers pas" },
  quotes: { en: "Quotes", fr: "Soumissions" },
  contracts: { en: "Contracts & e-signature", fr: "Contrats et signature électronique" },
  jobs: { en: "Jobs", fr: "Chantiers" },
  money: { en: "Invoices & payments", fr: "Factures et paiements" },
  team: { en: "Team", fr: "Équipe" },
  growth: { en: "Leads & integrations", fr: "Prospects et intégrations" },
};

const p = (en: string, fr: string): HelpBlock => ({ type: "p", text: { en, fr } });
const h = (en: string, fr: string): HelpBlock => ({ type: "h", text: { en, fr } });
const note = (en: string, fr: string): HelpBlock => ({ type: "note", text: { en, fr } });
const steps = (items: Array<[string, string]>): HelpBlock => ({ type: "steps", items: items.map(([en, fr]) => ({ en, fr })) });
const bullets = (items: Array<[string, string]>): HelpBlock => ({ type: "bullets", items: items.map(([en, fr]) => ({ en, fr })) });

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    category: "start",
    title: { en: "Set up your business in 10 minutes", fr: "Configurez votre entreprise en 10 minutes" },
    summary: {
      en: "Create your account, fill in the business profile that appears on every quote, contract and invoice, and pick a plan.",
      fr: "Créez votre compte, remplissez le profil d'entreprise qui apparaît sur chaque soumission, contrat et facture, puis choisissez un forfait.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 4,
    blocks: [
      p(
        "Everything QuoteAI produces — quotes, contracts, invoices, customer emails — is built from your business profile. Ten minutes here saves you retyping the same details on every document.",
        "Tout ce que QuoteAI produit — soumissions, contrats, factures, courriels aux clients — est construit à partir de votre profil d'entreprise. Dix minutes ici vous évitent de retaper les mêmes informations sur chaque document.",
      ),
      h("1. Create your account", "1. Créez votre compte"),
      steps([
        ["Go to Sign up, enter your name, email and a password.", "Allez à Inscription, entrez votre nom, votre courriel et un mot de passe."],
        ["The onboarding wizard asks for your company name, trade, province and language. Pick the province where you do most of your work — it sets your default sales taxes and the contract template you get later.", "L'assistant de démarrage demande le nom de votre entreprise, votre métier, votre province et votre langue. Choisissez la province où vous travaillez le plus — elle détermine vos taxes de vente par défaut et le modèle de contrat que vous obtiendrez plus tard."],
        ["You land on the dashboard with a free plan. Nothing is charged until you upgrade.", "Vous arrivez sur le tableau de bord avec un forfait gratuit. Rien n'est facturé tant que vous ne passez pas à un forfait supérieur."],
      ]),
      h("2. Complete the business profile", "2. Complétez le profil d'entreprise"),
      p(
        "Open Settings → Business Account. The fields that matter most:",
        "Ouvrez Paramètres → Compte d'entreprise. Les champs les plus importants :",
      ),
      bullets([
        ["Legal name, address and phone — printed on every document and required on invoices by the CRA.", "Nom légal, adresse et téléphone — imprimés sur chaque document et exigés sur les factures par l'ARC."],
        ["GST/HST (and QST) registration number — must appear on any invoice of $30 or more.", "Numéro d'inscription TPS/TVH (et TVQ) — obligatoire sur toute facture de 30 $ ou plus."],
        ["Licence number — for example your RBQ number in Québec; it is inserted into the contract where the law requires it.", "Numéro de licence — par exemple votre numéro RBQ au Québec; il est inséré dans le contrat là où la loi l'exige."],
        ["Interac e-Transfer email — shown on invoices so customers know where to send payment. Most Canadian customers pay contractors this way.", "Courriel Virement Interac — affiché sur les factures pour que les clients sachent où envoyer le paiement. La plupart des clients canadiens paient les entrepreneurs ainsi."],
        ["Logo — appears on PDFs and on the customer-facing quote, signing and invoice pages.", "Logo — apparaît sur les PDF et sur les pages client de soumission, de signature et de facture."],
        ["Default payment terms and deposit — the payment schedule proposed on each new quote (you can change it per quote).", "Conditions de paiement et dépôt par défaut — l'échéancier de paiement proposé sur chaque nouvelle soumission (modifiable par soumission)."],
      ]),
      h("3. Choose a plan", "3. Choisissez un forfait"),
      p(
        "Settings → Plan & Billing. Starter covers quotes, emailing them and acceptance notifications. Pro adds the price catalog, contracts and e-signature, jobs, costs, invoicing and team accounts (2 seats included). Elite adds worker time tracking, the AI assistant, advanced analytics and 5 seats. Billing is handled by Stripe; you can cancel any time and keep access until the end of the period you paid for.",
        "Paramètres → Forfait et facturation. Starter couvre les soumissions, leur envoi par courriel et les notifications d'acceptation. Pro ajoute le catalogue de prix, les contrats et la signature électronique, les chantiers, les coûts, la facturation et les comptes d'équipe (2 sièges inclus). Elite ajoute le suivi du temps des travailleurs, l'assistant IA, les analyses avancées et 5 sièges. La facturation est gérée par Stripe; vous pouvez annuler à tout moment et conserver l'accès jusqu'à la fin de la période payée.",
      ),
      note(
        "Usage (quotes generated, photos analysed, WhatsApp messages) resets on the 1st of each month and is visible under Settings → Usage. Going over your allowance never blocks you — it is there to tell you when to upgrade.",
        "L'utilisation (soumissions générées, photos analysées, messages WhatsApp) est réinitialisée le 1er de chaque mois et visible sous Paramètres → Utilisation. Dépasser votre allocation ne vous bloque jamais — c'est là pour vous indiquer quand passer à un forfait supérieur.",
      ),
    ],
  },
  {
    slug: "create-a-quote",
    category: "quotes",
    title: { en: "Create a quote from a description, a voice memo or photos", fr: "Créer une soumission à partir d'une description, d'un mémo vocal ou de photos" },
    summary: {
      en: "Describe the job in plain language and get an itemized, taxed quote in about 30 seconds. Then edit it, offer Good/Better/Best options and pick a PDF template.",
      fr: "Décrivez le travail en langage courant et obtenez une soumission détaillée et taxée en environ 30 secondes. Ensuite, modifiez-la, offrez des options Bon/Meilleur/Excellent et choisissez un modèle de PDF.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("Describe the job", "Décrivez le travail"),
      steps([
        ["Click New quote in the sidebar.", "Cliquez sur Nouvelle soumission dans la barre latérale."],
        ["Type what you would tell a colleague: \"Repaint a 3-bedroom bungalow in Oakville, two coats, ceilings included, minor drywall repair in the hallway.\" The more measurements, materials and constraints you give, the better the line items.", "Écrivez ce que vous diriez à un collègue : « Repeindre un bungalow de 3 chambres à Oakville, deux couches, plafonds inclus, petites réparations de gypse dans le couloir. » Plus vous donnez de mesures, de matériaux et de contraintes, meilleurs seront les articles."],
        ["Prefer talking? Press the microphone button and dictate. The transcription appears in the box and you can correct it before generating.", "Vous préférez parler? Appuyez sur le bouton micro et dictez. La transcription apparaît dans la zone et vous pouvez la corriger avant de générer."],
        ["Attach photos of the site or documents (PDF, Excel, Word) with the paperclip. The AI reads them for quantities and scope. Starter allows 1 photo per quote, Pro 3, Elite 5.", "Joignez des photos du site ou des documents (PDF, Excel, Word) avec le trombone. L'IA les lit pour en tirer quantités et portée. Starter permet 1 photo par soumission, Pro 3, Elite 5."],
        ["Click Generate. The quote opens with chapters, line items, quantities, unit prices, subtotals and the taxes for your province.", "Cliquez sur Générer. La soumission s'ouvre avec ses chapitres, articles, quantités, prix unitaires, sous-totaux et les taxes de votre province."],
      ]),
      h("Edit the result", "Modifiez le résultat"),
      p(
        "Click any field to edit it — descriptions, quantities, prices, the client's details, the payment terms. Add or remove lines and chapters. Totals and taxes recalculate as you type. Items you price often belong in the Catalog (Pro and up): the AI reuses your catalog prices instead of estimating, and you can import your price list from an existing quote, a photo or a PDF.",
        "Cliquez sur n'importe quel champ pour le modifier — descriptions, quantités, prix, coordonnées du client, conditions de paiement. Ajoutez ou retirez des lignes et des chapitres. Les totaux et taxes se recalculent au fur et à mesure. Les articles que vous vendez souvent ont leur place dans le Catalogue (Pro et plus) : l'IA réutilise vos prix de catalogue au lieu d'estimer, et vous pouvez importer votre liste de prix depuis une soumission existante, une photo ou un PDF.",
      ),
      h("Good / Better / Best", "Bon / Meilleur / Excellent"),
      p(
        "In the quote's Good / Better / Best panel, add up to three pricing options with their own description and total. The customer picks one on the acceptance page, and the chosen option becomes the contract value.",
        "Dans le panneau Bon / Meilleur / Excellent de la soumission, ajoutez jusqu'à trois options de prix avec leur description et leur total. Le client en choisit une sur la page d'acceptation, et l'option retenue devient la valeur du contrat.",
      ),
      h("Pick a PDF template", "Choisissez un modèle de PDF"),
      p(
        "Three layouts are available — Standard (itemized with a signature block), Professional (numbered specification with chapter subtotals) and Elegant (numbered list with an offer header). The preview updates live and the emailed PDF mirrors it. The PDF is bilingual-aware: a client whose language is French gets French labels and tax names.",
        "Trois mises en page sont offertes — Standard (détaillée avec bloc de signature), Professionnel (devis numéroté avec sous-totaux par chapitre) et Élégant (liste numérotée avec en-tête OFFRE). L'aperçu se met à jour en direct et le PDF envoyé par courriel lui est identique. Le PDF tient compte de la langue : un client francophone reçoit des libellés et des noms de taxes en français.",
      ),
      note(
        "The AI is a starting point, not a pricing authority. Check quantities against your own take-off before sending — you are responsible for the price you commit to.",
        "L'IA est un point de départ, pas une autorité en matière de prix. Vérifiez les quantités avec votre propre relevé avant d'envoyer — vous êtes responsable du prix auquel vous vous engagez.",
      ),
    ],
  },
  {
    slug: "send-a-quote-and-get-it-accepted",
    category: "quotes",
    title: { en: "Send a quote and get it accepted online", fr: "Envoyer une soumission et la faire accepter en ligne" },
    summary: {
      en: "Email the quote or share its link. The customer reviews and accepts on a secure page; automatic follow-ups nudge them on days 2, 5 and 10 until they answer.",
      fr: "Envoyez la soumission par courriel ou partagez son lien. Le client la consulte et l'accepte sur une page sécurisée; des relances automatiques le rappellent aux jours 2, 5 et 10 jusqu'à sa réponse.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 4,
    blocks: [
      h("Two ways to send", "Deux façons d'envoyer"),
      bullets([
        ["Send by email — enter the client's address; the PDF is attached and the email carries a button to the online quote. If you connected Gmail (Settings → Integrations), it goes out from your own inbox and replies land there.", "Envoyer par courriel — entrez l'adresse du client; le PDF est joint et le courriel contient un bouton vers la soumission en ligne. Si vous avez connecté Gmail (Paramètres → Intégrations), il part de votre propre boîte et les réponses y arrivent."],
        ["Copy link — paste it into WhatsApp, a text message or your own email. The link opens the same page.", "Copier le lien — collez-le dans WhatsApp, un texto ou votre propre courriel. Le lien ouvre la même page."],
      ]),
      h("What the customer sees", "Ce que voit le client"),
      p(
        "A page with your logo, the full quote, the payment schedule and — if you added them — the Good / Better / Best options. To accept, they type their name and confirm. QuoteAI records the name, time and IP address of the acceptance, marks the quote Accepted and notifies you by email and in the notification bell. If the customer has questions, the page shows your contact details.",
        "Une page avec votre logo, la soumission complète, l'échéancier de paiement et — si vous les avez ajoutées — les options Bon / Meilleur / Excellent. Pour accepter, le client entre son nom et confirme. QuoteAI enregistre le nom, l'heure et l'adresse IP de l'acceptation, marque la soumission Acceptée et vous avise par courriel et dans la cloche de notifications. Si le client a des questions, la page affiche vos coordonnées.",
      ),
      h("Automatic follow-ups", "Relances automatiques"),
      p(
        "When you email a quote, a reminder sequence starts: a polite nudge 2 days later, another after 5 days, a last one after 10. The sequence stops on its own the moment the quote is accepted or declined, or if the customer clicks the unsubscribe link every reminder carries. You never have to remember to chase.",
        "Quand vous envoyez une soumission par courriel, une séquence de rappels démarre : un rappel courtois 2 jours plus tard, un autre après 5 jours, un dernier après 10. La séquence s'arrête d'elle-même dès que la soumission est acceptée ou refusée, ou si le client clique sur le lien de désabonnement que chaque rappel contient. Vous n'avez jamais à penser à relancer.",
      ),
      h("After acceptance", "Après l'acceptation"),
      p(
        "On Pro and Elite, an accepted quote automatically drafts a contract from the province template (see the contracts article). On Starter, the acceptance is your signed-off go-ahead — you can still download the PDF and start work.",
        "Sur Pro et Elite, une soumission acceptée génère automatiquement un projet de contrat à partir du modèle provincial (voir l'article sur les contrats). Sur Starter, l'acceptation est votre feu vert signé — vous pouvez toujours télécharger le PDF et commencer les travaux.",
      ),
      note(
        "Sent quotes are locked so the customer always sees the version they accepted. To change a price after sending, duplicate the quote and send the new one.",
        "Les soumissions envoyées sont verrouillées pour que le client voie toujours la version qu'il a acceptée. Pour modifier un prix après l'envoi, dupliquez la soumission et envoyez la nouvelle.",
      ),
    ],
  },
  {
    slug: "contracts-and-e-signature",
    category: "contracts",
    title: { en: "Contracts and e-signature", fr: "Contrats et signature électronique" },
    summary: {
      en: "An accepted quote becomes a contract built on your province's template. The customer signs online with an email verification code; both of you get the signed PDF and its audit certificate.",
      fr: "Une soumission acceptée devient un contrat bâti sur le modèle de votre province. Le client signe en ligne avec un code de vérification par courriel; vous recevez tous deux le PDF signé et son certificat d'audit.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 6,
    blocks: [
      h("How the contract is built", "Comment le contrat est construit"),
      p(
        "QuoteAI ships one residential/small-commercial services agreement with province-specific clauses for Ontario, British Columbia, Alberta and Québec, plus a generic Canadian version for everywhere else. The template is merged with your quote: scope from the line items, price and payment schedule, your business details and licence number, the customer's name and address. Clauses that depend on the province — the statutory cancellation notice for contracts signed at the customer's home, the construction-lien holdback, workers'-compensation coverage — are inserted automatically. In Québec the contract is issued in French; English only if the customer expressly asks for it, which QuoteAI records.",
        "QuoteAI fournit un contrat de services résidentiel/petit commercial avec des clauses propres à l'Ontario, à la Colombie-Britannique, à l'Alberta et au Québec, plus une version canadienne générique pour les autres provinces. Le modèle est fusionné avec votre soumission : la portée d'après les articles, le prix et l'échéancier de paiement, vos coordonnées et votre numéro de licence, le nom et l'adresse du client. Les clauses qui dépendent de la province — l'avis légal d'annulation pour les contrats conclus au domicile du client, la retenue de garantie (hypothèque légale de la construction), la couverture d'indemnisation des travailleurs — sont insérées automatiquement. Au Québec, le contrat est produit en français; en anglais seulement si le client le demande expressément, ce que QuoteAI enregistre.",
      ),
      p(
        "You can also upload your own template with {{variables}} such as {{clientName}} or {{total}} if you already have wording your lawyer approved.",
        "Vous pouvez aussi téléverser votre propre modèle avec des {{variables}} comme {{clientName}} ou {{total}} si vous avez déjà un texte approuvé par votre avocat.",
      ),
      h("Review and send", "Réviser et envoyer"),
      steps([
        ["Open Contracts. A draft appears the moment a quote is accepted (or click New contract from an accepted quote).", "Ouvrez Contrats. Un brouillon apparaît dès qu'une soumission est acceptée (ou cliquez sur Nouveau contrat depuis une soumission acceptée)."],
        ["Read every section. Edit the scope, dates, schedule or any clause. Toggle the holdback on or off and set its percentage — the clause text adapts.", "Lisez chaque section. Modifiez la portée, les dates, l'échéancier ou toute clause. Activez ou désactivez la retenue et fixez son pourcentage — le texte de la clause s'adapte."],
        ["Click Send for signature. The customer receives an email with a personal signing link. If the quote had no email on file, you will be asked for one and it is saved to the client record.", "Cliquez sur Envoyer pour signature. Le client reçoit un courriel avec un lien de signature personnel. Si la soumission n'avait pas de courriel, on vous en demandera un et il sera enregistré dans la fiche client."],
        ["Reminders go out automatically after 3, 7 and 14 days while the contract is unsigned.", "Des rappels partent automatiquement après 3, 7 et 14 jours tant que le contrat n'est pas signé."],
      ]),
      h("How the customer signs", "Comment le client signe"),
      steps([
        ["They open the link and read the contract in full.", "Il ouvre le lien et lit le contrat au complet."],
        ["They request a 6-digit code, which is emailed to the address you sent the contract to — this is how QuoteAI verifies who is signing.", "Il demande un code à 6 chiffres, envoyé à l'adresse à laquelle vous avez envoyé le contrat — c'est ainsi que QuoteAI vérifie l'identité du signataire."],
        ["They type their full name, tick the consent statement and sign. They can also decline with a reason, which you see immediately.", "Il entre son nom complet, coche la déclaration de consentement et signe. Il peut aussi refuser en donnant une raison, que vous voyez immédiatement."],
        ["You countersign from the contract page. Once both signatures are in, the final PDF and an audit certificate (names, emails, timestamps, IP addresses, SHA-256 hashes of the unsigned and signed documents) are generated, stored and emailed to both parties.", "Vous contresignez depuis la page du contrat. Une fois les deux signatures reçues, le PDF final et un certificat d'audit (noms, courriels, horodatages, adresses IP, empreintes SHA-256 des documents non signé et signé) sont générés, conservés et envoyés aux deux parties."],
      ]),
      h("What happens next", "Et ensuite"),
      p(
        "A signed contract automatically sets up the job (milestones, schedule, cost budget) and drafts the deposit invoice. You get one notification — \"Review job setup\" — and confirm everything with a click. Signed contracts are never deleted: archiving a job keeps them, because they are financial records you must keep for seven years.",
        "Un contrat signé crée automatiquement le chantier (jalons, calendrier, budget de coûts) et prépare la facture de dépôt. Vous recevez une seule notification — « Réviser la configuration du chantier » — et confirmez le tout en un clic. Les contrats signés ne sont jamais supprimés : archiver un chantier les conserve, car ce sont des documents financiers à garder sept ans.",
      ),
      note(
        "The templates are informed by the consumer-protection and construction-lien statutes of each province, but they are not legal advice and QuoteAI is not a law firm. Have your lawyer read the template once before you rely on it, and again when your business changes.",
        "Les modèles s'appuient sur les lois de protection du consommateur et sur les lois relatives aux privilèges de construction de chaque province, mais ils ne constituent pas un avis juridique et QuoteAI n'est pas un cabinet d'avocats. Faites lire le modèle par votre avocat une fois avant de vous y fier, et de nouveau lorsque votre entreprise change.",
      ),
    ],
  },
  {
    slug: "jobs-milestones-and-change-orders",
    category: "jobs",
    title: { en: "Jobs: setup review, milestones and change orders", fr: "Chantiers : révision de la configuration, jalons et avenants" },
    summary: {
      en: "Every signed contract becomes a job with milestones, a schedule and a budget proposed by the AI. Confirm it in one click, track progress, and handle extras with change orders the customer signs.",
      fr: "Chaque contrat signé devient un chantier avec des jalons, un calendrier et un budget proposés par l'IA. Confirmez-le en un clic, suivez l'avancement et gérez les extras avec des avenants que le client signe.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("The setup review", "La révision de la configuration"),
      p(
        "You never fill a form to create a job. When a contract is signed, QuoteAI reads the scope and proposes milestones (for a kitchen: demolition, rough-in, cabinets, finishing), a schedule with an end date, and a cost budget split into labour, materials, subcontractors and equipment. The Review job setup page shows all of it. Rename, reorder, add or delete milestones, drag dates, adjust the budget, then click Confirm — the job goes Active and the deposit invoice is ready.",
        "Vous ne remplissez jamais de formulaire pour créer un chantier. Quand un contrat est signé, QuoteAI lit la portée et propose des jalons (pour une cuisine : démolition, plomberie et électricité brutes, armoires, finition), un calendrier avec une date de fin, et un budget réparti entre main-d'œuvre, matériaux, sous-traitants et équipement. La page Réviser la configuration du chantier montre tout cela. Renommez, réordonnez, ajoutez ou supprimez des jalons, déplacez les dates, ajustez le budget, puis cliquez sur Confirmer — le chantier devient Actif et la facture de dépôt est prête.",
      ),
      h("Working the job", "Pendant les travaux"),
      bullets([
        ["The job page shows the timeline, the budget against actual costs, time logged, documents and every invoice on the job.", "La page du chantier montre la ligne du temps, le budget par rapport aux coûts réels, le temps enregistré, les documents et chaque facture du chantier."],
        ["Mark a milestone complete when the work is done. If the payment schedule ties a payment to that milestone, the progress invoice is generated (with the holdback deducted when it is on) and sent, or left as a draft — your choice in Settings → Business Account → Automation.", "Marquez un jalon terminé quand le travail est fait. Si l'échéancier de paiement lie un paiement à ce jalon, la facture d'étape est générée (retenue déduite si elle est activée) et envoyée, ou laissée en brouillon — votre choix dans Paramètres → Compte d'entreprise → Automatisation."],
        ["Connect Google Calendar or Outlook (Settings → Integrations) and milestones appear in your calendar; moving a date in QuoteAI moves the event.", "Connectez Google Agenda ou Outlook (Paramètres → Intégrations) et les jalons apparaissent dans votre calendrier; déplacer une date dans QuoteAI déplace l'événement."],
        ["Set the job-site location on the Team tab so workers' clock-ins are checked against it.", "Définissez l'emplacement du chantier dans l'onglet Équipe pour que les pointages des travailleurs y soient comparés."],
      ]),
      h("Change orders", "Avenants (ordres de changement)"),
      steps([
        ["On the job page, click Change order and describe the extra (or the credit). Add line items the same way as on a quote.", "Sur la page du chantier, cliquez sur Avenant et décrivez l'extra (ou le crédit). Ajoutez des articles comme sur une soumission."],
        ["Send it. The customer signs it online exactly like the contract.", "Envoyez-le. Le client le signe en ligne exactement comme le contrat."],
        ["Once signed, the contract value, the payment schedule and the budget update automatically, and the change order is attached to the contract record.", "Une fois signé, la valeur du contrat, l'échéancier de paiement et le budget se mettent à jour automatiquement, et l'avenant est rattaché au dossier du contrat."],
      ]),
      h("Finishing", "Clôture"),
      p(
        "Mark the job complete to generate the final invoice. If a holdback applies, QuoteAI schedules its release invoice after the lien period of your province (for example 60 days after substantial performance in Ontario, 55 days in British Columbia) and reminds you when it is due. Completed jobs move to the Archive, where everything stays searchable.",
        "Marquez le chantier terminé pour générer la facture finale. Si une retenue s'applique, QuoteAI planifie la facture de libération après le délai de privilège de votre province (par exemple 60 jours après l'exécution substantielle en Ontario, 55 jours en Colombie-Britannique) et vous rappelle son échéance. Les chantiers terminés passent aux Archives, où tout reste consultable.",
      ),
    ],
  },
  {
    slug: "invoices-and-getting-paid",
    category: "money",
    title: { en: "Invoices, e-Transfer and card payments", fr: "Factures, Virement Interac et paiements par carte" },
    summary: {
      en: "Deposit, progress and final invoices are generated from the contract's payment schedule. Customers pay by Interac e-Transfer or by card; reminders go out at 3, 7 and 14 days past due.",
      fr: "Les factures de dépôt, d'étape et finale sont générées à partir de l'échéancier du contrat. Les clients paient par Virement Interac ou par carte; des rappels partent 3, 7 et 14 jours après l'échéance.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("Where invoices come from", "D'où viennent les factures"),
      p(
        "The payment schedule you set on the quote (for example 30% deposit, 40% after rough-in, 30% on completion) is copied to the contract, and each line becomes an invoice at the right moment: the deposit when the contract is signed, progress invoices when their milestone is completed, the final invoice when the job is marked complete. You can also create a manual invoice from the Invoices page for anything outside a job.",
        "L'échéancier de paiement défini sur la soumission (par exemple 30 % de dépôt, 40 % après les travaux bruts, 30 % à la fin) est copié dans le contrat, et chaque ligne devient une facture au bon moment : le dépôt à la signature du contrat, les factures d'étape à l'achèvement de leur jalon, la facture finale quand le chantier est marqué terminé. Vous pouvez aussi créer une facture manuelle depuis la page Factures pour tout ce qui sort d'un chantier.",
      ),
      p(
        "Every invoice carries a sequential number that is never reused, your GST/HST number, the customer's name, taxes shown separately and the due date — what the CRA requires. Voiding an invoice keeps its number in the sequence and lets you reissue a corrected one.",
        "Chaque facture porte un numéro séquentiel jamais réutilisé, votre numéro de TPS/TVH, le nom du client, les taxes affichées séparément et la date d'échéance — ce que l'ARC exige. Annuler une facture conserve son numéro dans la séquence et vous permet d'en réémettre une corrigée.",
      ),
      h("Send and get paid", "Envoyer et se faire payer"),
      p(
        "Under Settings → Business Account → Automation, choose whether invoices are sent automatically (after a delay you set) or left as drafts for you to send. The customer receives an email with the PDF and a link to their invoice page, which shows the balance due and how to pay:",
        "Sous Paramètres → Compte d'entreprise → Automatisation, choisissez si les factures sont envoyées automatiquement (après un délai que vous fixez) ou laissées en brouillon pour que vous les envoyiez. Le client reçoit un courriel avec le PDF et un lien vers sa page de facture, qui montre le solde dû et comment payer :",
      ),
      bullets([
        ["Interac e-Transfer to the email from your profile, with the invoice number as the reference. The customer clicks \"I sent it\" and you get a notification to confirm once the money lands.", "Virement Interac au courriel de votre profil, avec le numéro de facture comme référence. Le client clique sur « Je l'ai envoyé » et vous recevez une notification pour confirmer une fois l'argent reçu."],
        ["Card payment, if you connected Stripe (Settings → Integrations → Stripe Connect). The money goes straight to your own bank account; QuoteAI never holds it. The invoice is marked paid automatically.", "Paiement par carte, si vous avez connecté Stripe (Paramètres → Intégrations → Stripe Connect). L'argent va directement dans votre propre compte bancaire; QuoteAI ne le détient jamais. La facture est marquée payée automatiquement."],
        ["Cheque, with your mailing address.", "Chèque, à votre adresse postale."],
      ]),
      h("Recording payments and reminders", "Enregistrer les paiements et les rappels"),
      p(
        "Click Record payment on the invoice to log an amount, date, method and reference, and optionally email a receipt. Partial payments are fine — the balance updates. While an invoice is past due, reminders go out automatically 3, 7 and 14 days after the due date (turn this off in Automation). The dashboard's accounts-receivable card shows who owes what.",
        "Cliquez sur Enregistrer un paiement sur la facture pour consigner un montant, une date, un mode et une référence, et envoyer un reçu par courriel si vous le souhaitez. Les paiements partiels sont acceptés — le solde se met à jour. Tant qu'une facture est en retard, des rappels partent automatiquement 3, 7 et 14 jours après l'échéance (désactivable dans Automatisation). La carte Comptes clients du tableau de bord montre qui doit quoi.",
      ),
      h("Holdback", "Retenue de garantie"),
      p(
        "When the contract has a holdback, each progress invoice shows the amount retained and the release invoice is created for you after the statutory lien period. The reminder tells you when you can bill it.",
        "Quand le contrat prévoit une retenue, chaque facture d'étape indique le montant retenu et la facture de libération est créée pour vous après le délai légal de privilège. Le rappel vous indique quand vous pouvez la facturer.",
      ),
      note(
        "Paid invoices sync to QuickBooks Online or Wave if you connected one (Elite). Nothing is posted twice: each sync is logged under Settings → Integrations with a Retry button if your accounting software was unreachable.",
        "Les factures payées se synchronisent avec QuickBooks en ligne ou Wave si vous en avez connecté un (Elite). Rien n'est comptabilisé deux fois : chaque synchronisation est journalisée sous Paramètres → Intégrations avec un bouton Réessayer si votre logiciel comptable était injoignable.",
      ),
    ],
  },
  {
    slug: "costs-receipts-and-time",
    category: "jobs",
    title: { en: "Track costs, scan receipts and log time", fr: "Suivre les coûts, numériser les reçus et enregistrer le temps" },
    summary: {
      en: "Photograph a receipt and the AI files it against the job. Workers clock in and out from a personal link — no app, no login — and the job's margin updates in real time.",
      fr: "Photographiez un reçu et l'IA le classe dans le chantier. Les travailleurs pointent depuis un lien personnel — sans application ni connexion — et la marge du chantier se met à jour en temps réel.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 4,
    blocks: [
      h("Receipts and costs", "Reçus et coûts"),
      steps([
        ["On the job page, open Costs and click Add receipt. Take a photo or upload the PDF from the supplier.", "Sur la page du chantier, ouvrez Coûts et cliquez sur Ajouter un reçu. Prenez une photo ou téléversez le PDF du fournisseur."],
        ["The AI reads the vendor, date, line items, taxes and total, and proposes a category (materials, equipment, subcontractor, other). Check it, fix anything, save.", "L'IA lit le fournisseur, la date, les articles, les taxes et le total, et propose une catégorie (matériaux, équipement, sous-traitant, autre). Vérifiez, corrigez au besoin, enregistrez."],
        ["Enter costs without a receipt by hand — a subcontractor's invoice, a dump fee, a rental.", "Entrez à la main les coûts sans reçu — la facture d'un sous-traitant, des frais de dépotoir, une location."],
      ]),
      p(
        "Each cost is charged against the budget line from the setup review, so the job page shows budget vs. actual per category and the projected margin. Confirmed costs sync to QuickBooks or Wave when connected.",
        "Chaque coût est imputé à la ligne budgétaire de la révision de configuration, de sorte que la page du chantier montre le budget par rapport au réel par catégorie et la marge projetée. Les coûts confirmés se synchronisent avec QuickBooks ou Wave si connecté.",
      ),
      h("Worker time (Elite)", "Temps des travailleurs (Elite)"),
      steps([
        ["Open Team and add a worker with their hourly cost. Click Time-entry link: a personal link is emailed to them, or copy it and send it by text.", "Ouvrez Équipe et ajoutez un travailleur avec son coût horaire. Cliquez sur Lien de saisie du temps : un lien personnel lui est envoyé par courriel, ou copiez-le et envoyez-le par texto."],
        ["The worker opens the link on their phone, picks the job and taps Clock in. No account, no app to install. The link is valid for 6 months; issue a new one to replace it or revoke it from the worker's row.", "Le travailleur ouvre le lien sur son téléphone, choisit le chantier et appuie sur Pointer l'arrivée. Aucun compte, aucune application à installer. Le lien est valide 6 mois; émettez-en un nouveau pour le remplacer ou révoquez-le depuis la ligne du travailleur."],
        ["If the job has a site location, the clock-in records how far from the site the worker was, so you can spot entries made from home. Nothing is tracked between clock-in and clock-out.", "Si le chantier a un emplacement, le pointage enregistre la distance entre le travailleur et le site, pour repérer les entrées faites depuis la maison. Rien n'est suivi entre l'arrivée et le départ."],
        ["Time entries appear on the job as labour cost at the worker's rate. You can add or correct entries yourself.", "Les entrées de temps apparaissent sur le chantier comme coût de main-d'œuvre au taux du travailleur. Vous pouvez ajouter ou corriger des entrées vous-même."],
      ]),
      h("Payroll export", "Export de paie"),
      p(
        "Team → Export gives you a CSV of hours per worker per period for your payroll provider. QuoteAI does not run payroll itself.",
        "Équipe → Exporter produit un CSV des heures par travailleur par période pour votre fournisseur de paie. QuoteAI ne fait pas la paie elle-même.",
      ),
    ],
  },
  {
    slug: "team-accounts-and-roles",
    category: "team",
    title: { en: "Invite your team and set roles", fr: "Inviter votre équipe et définir les rôles" },
    summary: {
      en: "Give office staff, foremen or your accountant their own login with a role that limits what they can see and do. Pro includes 2 seats, Elite 5.",
      fr: "Donnez au personnel de bureau, aux contremaîtres ou à votre comptable leur propre connexion avec un rôle qui limite ce qu'ils peuvent voir et faire. Pro inclut 2 sièges, Elite 5.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 3,
    blocks: [
      h("Two kinds of people", "Deux types de personnes"),
      bullets([
        ["Team members log in to QuoteAI with their own email and password and see the parts of the account their role allows. They use a seat.", "Les membres de l'équipe se connectent à QuoteAI avec leur propre courriel et mot de passe et voient les parties du compte que leur rôle permet. Ils occupent un siège."],
        ["Workers only clock time from a personal link (see the costs and time article). They never log in and do not use a seat.", "Les travailleurs pointent seulement leur temps depuis un lien personnel (voir l'article sur les coûts et le temps). Ils ne se connectent jamais et n'occupent pas de siège."],
      ]),
      h("Roles", "Rôles"),
      bullets([
        ["Admin — full access except billing.", "Admin — accès complet sauf la facturation."],
        ["Office — quotes, clients, contracts, jobs and invoicing.", "Bureau — soumissions, clients, contrats, chantiers et facturation."],
        ["Foreman — jobs and time entries; read-only everywhere else.", "Contremaître — chantiers et entrées de temps; lecture seule ailleurs."],
        ["Viewer — read-only everywhere. Good for an accountant or a partner.", "Lecteur — lecture seule partout. Idéal pour un comptable ou un associé."],
      ]),
      p(
        "Only the owner sees Plan & Billing and can change the company's legal details.",
        "Seul le propriétaire voit Forfait et facturation et peut modifier les informations légales de l'entreprise.",
      ),
      h("Inviting someone", "Inviter quelqu'un"),
      steps([
        ["Go to Team → Members and click Invite member. Enter their email and pick a role.", "Allez à Équipe → Membres et cliquez sur Inviter un membre. Entrez son courriel et choisissez un rôle."],
        ["They receive an email with a link to set up their own login. If the email does not arrive, copy the invite link from the member row and send it yourself.", "La personne reçoit un courriel avec un lien pour créer sa propre connexion. Si le courriel n'arrive pas, copiez le lien d'invitation depuis la ligne du membre et envoyez-le vous-même."],
        ["Change a role at any time. Suspend someone to block access without losing their history; Remove them when they leave.", "Changez un rôle à tout moment. Suspendez quelqu'un pour bloquer l'accès sans perdre son historique; Retirez-le quand il quitte."],
      ]),
      note(
        "Pro includes 2 seats and Elite 5 (the owner counts as one). When every seat is used, the invite button tells you; add seats from Plan & Billing.",
        "Pro inclut 2 sièges et Elite 5 (le propriétaire compte pour un). Quand tous les sièges sont utilisés, le bouton d'invitation vous l'indique; ajoutez des sièges depuis Forfait et facturation.",
      ),
    ],
  },
  {
    slug: "leads-and-follow-ups",
    category: "growth",
    title: { en: "Leads, follow-ups and review requests", fr: "Prospects, relances et demandes d'avis" },
    summary: {
      en: "Every quote request lands in the Leads pipeline — from your website widget, WhatsApp, Meta Lead Ads or Google Local Services Ads. Follow up until it is won or lost, within Canada's anti-spam rules.",
      fr: "Chaque demande de soumission arrive dans le pipeline Prospects — depuis votre widget de site web, WhatsApp, Meta Lead Ads ou Google Local Services Ads. Relancez jusqu'à ce qu'elle soit gagnée ou perdue, dans le respect de la loi anti-pourriel canadienne.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("Where leads come from", "D'où viennent les prospects"),
      bullets([
        ["Website widget — Settings → Website Integration gives you a snippet for your site; visitors describe their job and become a lead with a draft quote.", "Widget de site web — Paramètres → Intégration au site web vous donne un extrait de code; les visiteurs décrivent leur travail et deviennent un prospect avec une soumission brouillon."],
        ["WhatsApp — connect your WhatsApp Business number (Settings → WhatsApp Bot) and customers can send a text, voice memo or photo; the bot answers with a quote and creates the lead.", "WhatsApp — connectez votre numéro WhatsApp Business (Paramètres → Robot WhatsApp) et les clients peuvent envoyer un texto, un mémo vocal ou une photo; le robot répond avec une soumission et crée le prospect."],
        ["Meta Lead Ads and Google Local Services Ads — connect them under Settings → Integrations and new leads are imported automatically, with the source recorded.", "Meta Lead Ads et Google Local Services Ads — connectez-les sous Paramètres → Intégrations et les nouveaux prospects sont importés automatiquement, avec leur source enregistrée."],
        ["By hand — New lead on the Leads page, or from a phone call.", "À la main — Nouveau prospect sur la page Prospects, ou après un appel téléphonique."],
      ]),
      h("Working the pipeline", "Travailler le pipeline"),
      p(
        "Leads move through New → Contacted → Quoted → Won or Lost. Each lead shows its next follow-up date; the dashboard's Follow-ups due card lists today's. Send now sends the next message immediately. When you email a quote from a lead, the quote's own reminder sequence (days 2, 5, 10) takes over, and the lead is marked Won when the quote is accepted.",
        "Les prospects passent par Nouveau → Contacté → Soumission envoyée → Gagné ou Perdu. Chaque prospect affiche sa prochaine date de relance; la carte Relances à faire du tableau de bord liste celles du jour. Envoyer maintenant expédie le prochain message tout de suite. Quand vous envoyez une soumission par courriel depuis un prospect, la séquence de rappels de la soumission (jours 2, 5, 10) prend le relais, et le prospect est marqué Gagné quand la soumission est acceptée.",
      ),
      h("Staying inside CASL", "Respecter la LCAP"),
      p(
        "Canada's anti-spam law lets you message someone who asked you for a quote (implied consent) or an existing customer. QuoteAI records how consent was obtained on every lead, includes your legal name, address and an unsubscribe link in every automated message, and stops all sequences the instant someone unsubscribes. A lead that replies is marked Contacted and its sequence pauses so you never talk over a customer who already answered. You remain responsible for what you send by hand.",
        "La loi canadienne anti-pourriel vous permet d'écrire à une personne qui vous a demandé une soumission (consentement tacite) ou à un client existant. QuoteAI enregistre comment le consentement a été obtenu pour chaque prospect, inclut votre nom légal, votre adresse et un lien de désabonnement dans chaque message automatisé, et arrête toutes les séquences dès qu'une personne se désabonne. Un prospect qui répond est marqué Contacté et sa séquence est mise en pause pour ne jamais parler par-dessus un client qui a déjà répondu. Vous restez responsable de ce que vous envoyez à la main.",
      ),
      h("Review requests", "Demandes d'avis"),
      p(
        "Settings → Business Account → Reviews & reachout: paste your Google review link and leave the toggle on. Three days after a job is marked complete, the customer gets one message asking for a review — once per job, never to a client who has unsubscribed, and only if the link is set.",
        "Paramètres → Compte d'entreprise → Avis et relance : collez votre lien d'avis Google et laissez l'option activée. Trois jours après qu'un chantier est marqué terminé, le client reçoit un seul message lui demandant un avis — une fois par chantier, jamais à un client désabonné, et seulement si le lien est défini.",
      ),
    ],
  },
  {
    slug: "integrations-and-imports",
    category: "growth",
    title: { en: "Integrations and importing your old quotes", fr: "Intégrations et importation de vos anciennes soumissions" },
    summary: {
      en: "Send from your own Gmail, sync milestones to Google Calendar or Outlook, post paid invoices to QuickBooks or Wave, take card payments with Stripe, and import years of past quotes from a spreadsheet or old PDFs.",
      fr: "Envoyez depuis votre propre Gmail, synchronisez les jalons avec Google Agenda ou Outlook, comptabilisez les factures payées dans QuickBooks ou Wave, acceptez les paiements par carte avec Stripe, et importez des années de soumissions depuis un tableur ou d'anciens PDF.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      p(
        "All integrations live under Settings → Integrations. Each one is connected with a Connect button that sends you to the provider to approve access; QuoteAI stores the resulting token encrypted and never sees your password. Disconnect at any time from the same place.",
        "Toutes les intégrations se trouvent sous Paramètres → Intégrations. Chacune se connecte avec un bouton Connecter qui vous envoie chez le fournisseur pour approuver l'accès; QuoteAI conserve le jeton obtenu chiffré et ne voit jamais votre mot de passe. Déconnectez à tout moment au même endroit.",
      ),
      h("Email from your own inbox", "Courriel depuis votre propre boîte"),
      p(
        "Connect Gmail and quotes, contracts and invoices go out from your address instead of no-reply@quoteai.ca — replies land in your inbox, and the message sits in your Sent folder. If a send fails (for example after you change your Google password) the Integrations page tells you to reconnect. Outlook sending is planned; Outlook calendar already works.",
        "Connectez Gmail et vos soumissions, contrats et factures partent de votre adresse plutôt que de no-reply@quoteai.ca — les réponses arrivent dans votre boîte et le message figure dans vos Éléments envoyés. Si un envoi échoue (par exemple après un changement de mot de passe Google), la page Intégrations vous invite à reconnecter. L'envoi via Outlook est prévu; le calendrier Outlook fonctionne déjà.",
      ),
      h("Calendars", "Calendriers"),
      p(
        "Connect Google Calendar or Outlook and every job milestone becomes an event. Move the date in QuoteAI and the event moves; complete the milestone and the event is marked done.",
        "Connectez Google Agenda ou Outlook et chaque jalon de chantier devient un événement. Déplacez la date dans QuoteAI et l'événement se déplace; terminez le jalon et l'événement est marqué comme fait.",
      ),
      h("Accounting: QuickBooks Online and Wave (Elite)", "Comptabilité : QuickBooks en ligne et Wave (Elite)"),
      steps([
        ["Click Connect QuickBooks (or Connect Wave) and approve access.", "Cliquez sur Connecter QuickBooks (ou Connecter Wave) et approuvez l'accès."],
        ["In Account mapping, pick which income account invoices post to, which account expenses are paid from, and an expense account per cost category. Save.", "Dans Correspondance des comptes, choisissez à quel compte de revenus les factures sont comptabilisées, depuis quel compte les dépenses sont payées, et un compte de dépenses par catégorie de coût. Enregistrez."],
        ["From then on, every paid invoice and every confirmed job cost is posted automatically. Recent syncs lists each one with a Retry button if the provider was down.", "Dès lors, chaque facture payée et chaque coût de chantier confirmé sont comptabilisés automatiquement. Synchronisations récentes liste chacune avec un bouton Réessayer si le fournisseur était indisponible."],
      ]),
      h("Card payments with Stripe", "Paiements par carte avec Stripe"),
      p(
        "Connect Stripe and a Pay by card button appears on your customers' invoice pages. Payouts go to your own bank account on Stripe's schedule; QuoteAI never holds the money. Stripe's card fee applies; e-Transfer stays free.",
        "Connectez Stripe et un bouton Payer par carte apparaît sur les pages de facture de vos clients. Les versements vont dans votre propre compte bancaire selon le calendrier de Stripe; QuoteAI ne détient jamais l'argent. Les frais de carte de Stripe s'appliquent; le Virement Interac reste gratuit.",
      ),
      h("Import your history", "Importer votre historique"),
      steps([
        ["Open Imports. Choose Spreadsheet (a CSV or Excel export from your previous tool, one quote per row — download the template to see the columns) or Old PDFs (up to 20 at a time; the AI reads each one).", "Ouvrez Importations. Choisissez Tableur (un export CSV ou Excel de votre ancien outil, une soumission par ligne — téléchargez le modèle pour voir les colonnes) ou Anciens PDF (jusqu'à 20 à la fois; l'IA lit chacun)."],
        ["Every row or PDF lands in the Review queue with the client, date, total and status it found, and whether it matches an existing client.", "Chaque ligne ou PDF arrive dans la File de révision avec le client, la date, le total et le statut trouvés, et indique s'il correspond à un client existant."],
        ["Confirm the ones that look right (or Confirm all in this batch) and reject the rest. Nothing becomes a real quote or client until you confirm it.", "Confirmez ceux qui semblent corrects (ou Tout confirmer dans ce lot) et rejetez le reste. Rien ne devient une vraie soumission ou un vrai client tant que vous ne l'avez pas confirmé."],
      ]),
      h("Public API and Zapier", "API publique et Zapier"),
      p(
        "Settings → Integrations → API keys creates a key for the QuoteAI REST API (quotes, clients, leads, invoices, plus webhooks for the events that matter to you). Use it directly or through Zapier and Make to connect tools we do not integrate natively.",
        "Paramètres → Intégrations → Clés API crée une clé pour l'API REST de QuoteAI (soumissions, clients, prospects, factures, plus des webhooks pour les événements qui vous importent). Utilisez-la directement ou via Zapier et Make pour connecter les outils que nous n'intégrons pas nativement.",
      ),
    ],
  },
];

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
