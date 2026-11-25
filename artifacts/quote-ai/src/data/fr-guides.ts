// French-only guides for Québec contractors (/fr/guides). Written in French
// first, not translated: there is little good French content on these
// subjects, which is the point.
//
// Every rule stated here comes from the official source listed in `sources`
// (checked on `updatedAt`). We describe rules and what the product does; we
// never claim a document is "compliant", and each guide carries the
// not-legal-advice line.

export interface GuideBlock {
  h2: string;
  paragraphs?: readonly string[];
  list?: readonly string[];
  /** A small worked example, shown as label → value rows. */
  example?: { title: string; rows: ReadonlyArray<[string, string]> };
}

export interface FrGuide {
  slug: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  short: string;
  updatedAt: string;
  blocks: readonly GuideBlock[];
  faq: ReadonlyArray<{ q: string; a: string }>;
  sources: ReadonlyArray<{ label: string; url: string }>;
  /** Internal links shown under the guide. */
  related: ReadonlyArray<{ label: string; href: string }>;
}

export const FR_GUIDES: readonly FrGuide[] = [
  {
    slug: "tps-tvq-soumissions-factures-entrepreneur",
    title: "TPS et TVQ sur vos soumissions et factures | quoteai",
    description: "Taux de TPS et de TVQ, seuil d'inscription de 30 000 $, calcul de la TVQ, et ce qui doit figurer sur une facture selon son montant (100 $ et 500 $).",
    h1: "TPS et TVQ sur vos soumissions et factures.",
    lead: "Les taux, le moment où vous devez vous inscrire, la bonne façon de calculer la TVQ et les renseignements qu'une facture doit contenir pour que votre client puisse récupérer ses taxes.",
    short: "Taux, inscription, calcul de la TVQ et mentions obligatoires sur une facture selon son montant.",
    updatedAt: "2026-11-13",
    blocks: [
      {
        h2: "Les taux en 2026",
        paragraphs: [
          "Au Québec, deux taxes s'appliquent à la plupart des travaux de construction et de rénovation, main-d'œuvre comprise : la TPS fédérale de 5 % et la TVQ de 9,975 %. Les deux se calculent sur le prix avant taxes. Depuis le 1er janvier 2013, la TVQ ne se calcule plus sur la TPS : les deux montants s'additionnent simplement.",
          "Pour un chantier situé dans une autre province, c'est en général la taxe de la province où se trouve l'immeuble qui s'applique, par exemple la TVH de 13 % pour une maison à Ottawa, même si votre entreprise est à Gatineau.",
        ],
        example: {
          title: "Exemple : 10 000 $ de travaux à Laval",
          rows: [
            ["Prix avant taxes", "10 000,00 $"],
            ["TPS (5 %)", "500,00 $"],
            ["TVQ (9,975 %)", "997,50 $"],
            ["Total", "11 497,50 $"],
          ],
        },
      },
      {
        h2: "Quand devez-vous vous inscrire?",
        paragraphs: [
          "Tant que vos ventes taxables ne dépassent pas 30 000 $ sur quatre trimestres civils consécutifs, vous êtes un petit fournisseur : l'inscription est facultative et vous ne percevez pas de taxes. Dès que vous dépassez ce seuil, vous devez vous inscrire et percevoir la TPS et la TVQ. Le seuil est le même pour les deux taxes.",
          "Au Québec, c'est Revenu Québec qui administre la TPS et la TVQ pour la plupart des entreprises. Vous pouvez produire une seule déclaration pour les deux.",
          "S'inscrire avant le seuil peut valoir la peine : vous récupérez alors les taxes payées sur vos matériaux, vos outils et votre camion (crédits et remboursements de taxe sur les intrants). En contrepartie, vos prix taxes incluses augmentent pour les clients particuliers.",
        ],
      },
      {
        h2: "Ce qui doit figurer sur la facture",
        paragraphs: [
          "Votre client d'affaires ne peut demander ses crédits de taxe sur les intrants que si votre facture contient certains renseignements. Ce qui est exigé dépend du montant total de la facture (règlement fédéral sur les renseignements nécessaires à une demande de crédit de taxe sur les intrants; Revenu Québec applique des exigences semblables pour la TVQ, avec votre numéro de TVQ) :",
        ],
        list: [
          "Moins de 100 $ : votre nom ou votre nom commercial, la date de la facture et le montant total.",
          "De 100 $ à 499,99 $ : en plus, votre numéro d'inscription à la TPS (et à la TVQ), et le montant de chaque taxe, ou une mention que le prix comprend les taxes avec leur taux.",
          "500 $ et plus : en plus, le nom du client (ou son nom commercial), les modalités de paiement et une description suffisante de chaque fourniture.",
        ],
      },
      {
        h2: "Sur la soumission aussi",
        paragraphs: [
          "Une soumission n'est pas une pièce justificative, mais elle devient la base du contrat et de la facture. Présentez-y déjà la TPS et la TVQ sur des lignes distinctes, avec un total taxes incluses : le client sait exactement ce qu'il paiera, et vous n'avez pas à refaire les calculs au moment de facturer. Une seule ligne « taxes 14,975 % » complique le travail du comptable de votre client et peut retarder votre paiement.",
        ],
      },
      {
        h2: "Erreurs fréquentes",
        list: [
          "Calculer la TVQ sur le prix plus la TPS (règle abolie en 2013).",
          "Oublier les numéros de TPS et de TVQ sur une facture de 100 $ ou plus.",
          "Mettre une seule ligne de taxes combinées au lieu de deux.",
          "Appliquer la TPS et la TVQ à un chantier situé en Ontario, où c'est la TVH.",
          "Percevoir des taxes sans être inscrit, ou ne pas s'inscrire après avoir dépassé 30 000 $.",
        ],
      },
    ],
    faq: [
      {
        q: "La TPS et la TVQ s'appliquent-elles à la main-d'œuvre?",
        a: "Oui. Si vous êtes inscrit, les deux taxes s'appliquent à la plupart des services de construction et de rénovation, main-d'œuvre comprise, et pas seulement aux matériaux.",
      },
      {
        q: "Comment retirer les taxes d'un montant taxes incluses?",
        a: "Divisez le total par 1,14975. Par exemple, 1 149,75 $ ÷ 1,14975 = 1 000 $ avant taxes, soit 50 $ de TPS et 99,75 $ de TVQ. Notre calculateur de taxes gratuit le fait pour vous.",
      },
      {
        q: "Mon numéro de TVQ doit-il figurer sur mes factures?",
        a: "Oui, dès que la facture atteint 100 $, avec votre numéro de TPS, pour que votre client puisse récupérer les taxes.",
      },
    ],
    sources: [
      { label: "Règlement sur les renseignements nécessaires à une demande de crédit de taxe sur les intrants (TPS/TVH), art. 3", url: "https://laws-lois.justice.gc.ca/fra/reglements/DORS-91-45/page-1.html" },
      { label: "Revenu Québec : préparation des factures", url: "https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/perception-de-la-tps-et-de-la-tvq/preparation-des-factures/" },
      { label: "Revenu Québec : crédit et remboursement de la taxe sur les intrants", url: "https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/credit-de-taxe-sur-les-intrants-et-remboursement-de-la-taxe-sur-les-intrants/" },
    ],
    related: [
      { label: "Calculateur de TPS, TVH, TVP et TVQ", href: "/fr/outils/calculateur-taxes-de-vente/" },
      { label: "Logiciel de soumission au Québec", href: "/fr/provinces/quebec/" },
      { label: "Logiciel de facturation pour entrepreneurs", href: "/fr/logiciel-facturation/" },
    ],
  },

  {
    slug: "numero-licence-rbq-soumission-contrat",
    title: "Numéro de licence RBQ sur vos soumissions et contrats | quoteai",
    description: "Où la Loi sur le bâtiment exige votre numéro de licence RBQ (soumissions, contrats, factures, publicité, site Web, véhicules), dans quel format, et les exceptions.",
    h1: "Votre numéro de licence RBQ : où l'inscrire.",
    lead: "Soumissions, contrats, factures, publicité, site Web, réseaux sociaux, véhicules : la liste des endroits où votre numéro de licence de la Régie du bâtiment du Québec doit apparaître, et le format exigé.",
    short: "Les documents, publicités et véhicules où votre numéro RBQ doit figurer, le format et les exceptions.",
    updatedAt: "2026-11-13",
    blocks: [
      {
        h2: "Le format",
        paragraphs: [
          "Votre numéro de licence compte 10 chiffres. La RBQ demande de l'écrire sous cette forme : « Licence RBQ : XXXX-XXXX-XX ».",
        ],
      },
      {
        h2: "Sur tous vos documents d'affaires",
        paragraphs: [
          "La Loi sur le bâtiment vous oblige à inscrire votre numéro de licence sur vos estimations, vos soumissions, vos contrats, vos états de compte et vos factures. Le plus simple est de l'ajouter une fois pour toutes à votre modèle ou à votre profil d'entreprise, pour qu'il apparaisse automatiquement sur chaque document.",
        ],
      },
      {
        h2: "Dans votre publicité",
        list: [
          "Toute forme de publicité, y compris vos cartes professionnelles.",
          "Votre site Web et les comptes de réseaux sociaux de l'entreprise, ainsi que vos comptes personnels si vous y annoncez vos services.",
          "Les annuaires, lorsque l'annonce mentionne votre type de travaux (rénovation, construction) ou votre secteur (résidentiel, commercial). Une simple inscription avec nom, adresse et téléphone n'est pas visée.",
          "Les pancartes de chantier qui portent le nom de votre entreprise.",
          "Les véhicules qui affichent le nom de l'entreprise et circulent sur la voie publique ou sur un chantier : camionnettes, camions, machinerie. Une inscription par véhicule ou élément de véhicule suffit.",
        ],
      },
      {
        h2: "Les exceptions",
        list: [
          "Les articles promotionnels (stylos, tasses, porte-clés, vêtements) n'ont pas à porter le numéro.",
          "Les membres de la Corporation des maîtres électriciens du Québec et de la Corporation des maîtres mécaniciens en tuyauterie du Québec sont identifiés par le logo de leur corporation.",
          "Les entrepreneurs établis hors Québec ne sont pas visés par cette obligation d'affichage.",
        ],
        paragraphs: [
          "À l'inverse, il est interdit d'afficher le drapeau du gouvernement du Québec ou le logo de la RBQ.",
        ],
      },
      {
        h2: "Pourquoi vos clients le cherchent",
        paragraphs: [
          "La RBQ invite les propriétaires à vérifier la licence d'un entrepreneur avant de signer, dans son registre en ligne des détenteurs de licence. Un numéro bien visible sur la soumission rassure le client et lui évite une recherche; c'est aussi un des premiers éléments que vérifient les inspecteurs de la RBQ.",
        ],
      },
    ],
    faq: [
      {
        q: "Dois-je mettre mon numéro RBQ sur une simple estimation?",
        a: "Oui. La RBQ inclut les estimations dans la liste, avec les soumissions, contrats, états de compte et factures.",
      },
      {
        q: "Et sur Facebook ou Instagram?",
        a: "Oui, sur les comptes de l'entreprise, et sur vos comptes personnels si vous y faites la promotion de vos services.",
      },
      {
        q: "Où vérifier la licence d'un sous-traitant?",
        a: "Dans le registre des détenteurs de licence sur le site de la RBQ, qui indique aussi les licences restreintes, suspendues ou annulées.",
      },
    ],
    sources: [
      { label: "RBQ : afficher votre licence", url: "https://www.rbq.gouv.qc.ca/vous-etes/entrepreneur/vos-obligations/la-licence/afficher-votre-licence/" },
      { label: "RBQ : vérifier la licence d'un entrepreneur", url: "https://www.rbq.gouv.qc.ca/vous-etes/citoyen/verifier-la-licence-dun-entrepreneur" },
    ],
    related: [
      { label: "Logiciel de soumission au Québec", href: "/fr/provinces/quebec/" },
      { label: "Calculateur de retenue de construction", href: "/fr/outils/calculateur-retenue/" },
      { label: "Contrats et signature électronique", href: "/fr/contrats-signature-electronique/" },
    ],
  },

  {
    slug: "soumission-contrat-en-francais-charte",
    title: "Soumissions et contrats en français : la Charte | quoteai",
    description: "Factures, bons de commande, contrats d'adhésion : ce que la Charte (loi 96) exige des entrepreneurs depuis 2023, et comment offrir une version anglaise.",
    h1: "Soumissions, contrats et factures en français.",
    lead: "Depuis la réforme de la Charte de la langue française (loi 96), les règles sont plus strictes pour les contrats types. Ce que cela change pour vos factures, vos soumissions et vos contrats de rénovation.",
    short: "Ce que la Charte de la langue française exige pour vos factures et contrats types, et quand l'anglais est permis.",
    updatedAt: "2026-11-13",
    blocks: [
      {
        h2: "Factures, reçus et bons de commande",
        paragraphs: [
          "La Charte de la langue française exige que les documents commerciaux, notamment les factures, reçus, bons de commande et documents de garantie, soient rédigés en français, quel que soit leur support. Une autre langue peut les accompagner : une facture bilingue reste possible, à condition que le français y soit.",
        ],
      },
      {
        h2: "Vos contrats types : les contrats d'adhésion",
        paragraphs: [
          "Un contrat d'adhésion est un contrat dont les clauses essentielles sont fixées d'avance par une partie et ne sont pas négociées. Le contrat de rénovation que vous faites signer tel quel à tous vos clients en est souvent un.",
          "Depuis le 1er juin 2023, un contrat d'adhésion et les documents qui s'y rattachent doivent être présentés au client d'abord en français. Les parties ne peuvent être liées par une version dans une autre langue que si le client l'a demandée expressément, après avoir reçu la version française.",
          "Un contrat réellement négocié de gré à gré, clause par clause, n'est pas un contrat d'adhésion : les parties peuvent alors choisir de le rédiger dans une autre langue, si c'est leur volonté expresse.",
        ],
      },
      {
        h2: "En pratique pour un entrepreneur",
        list: [
          "Préparez votre modèle de contrat et vos conditions générales en français d'abord.",
          "À un client anglophone, remettez la version française, puis la version anglaise s'il la demande; gardez une trace de sa demande (courriel ou mention signée).",
          "Rédigez vos factures en français; ajoutez l'anglais si vous le souhaitez.",
          "Utilisez les formats québécois : 4 131,05 $, 29 sept. 2026, 14 h 30, et les sigles TPS et TVQ.",
          "Employez « soumission » plutôt que « devis » au Québec, et « acompte » pour le dépôt demandé à la signature.",
        ],
      },
      {
        h2: "Ce que risque une entreprise",
        paragraphs: [
          "L'Office québécois de la langue française (OQLF) traite les plaintes. Il peut mettre une entreprise en demeure de se conformer à la Charte et, si le manquement persiste, lui ordonner de le faire. Mieux vaut régler la question une fois, dans vos modèles.",
        ],
      },
    ],
    faq: [
      {
        q: "Puis-je envoyer seulement une soumission en anglais à un client anglophone?",
        a: "Si votre soumission et votre contrat sont des documents types non négociés, remettez d'abord la version française; la version anglaise peut suivre si le client la demande expressément. Une facture doit au moins exister en français.",
      },
      {
        q: "Une facture bilingue est-elle permise?",
        a: "Oui, une autre langue peut accompagner le français sur une facture.",
      },
      {
        q: "Ces règles s'appliquent-elles aux petites entreprises?",
        a: "Oui. Les obligations sur les documents commerciaux et les contrats d'adhésion visent toutes les entreprises, quelle que soit leur taille.",
      },
    ],
    sources: [
      { label: "Charte de la langue française (RLRQ, c. C-11)", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/c-11" },
      { label: "OQLF, Vitrine linguistique : présentation de la facture", url: "https://vitrinelinguistique.oqlf.gouv.qc.ca/22875/la-redaction-et-la-communication/redaction-administrative-et-commerciale/formulaires-administratifs-et-commerciaux/presentation-de-la-facture" },
    ],
    related: [
      { label: "TPS et TVQ sur vos soumissions et factures", href: "/fr/guides/tps-tvq-soumissions-factures-entrepreneur/" },
      { label: "Logiciel de soumission au Québec", href: "/fr/provinces/quebec/" },
      { label: "Calculateur de TPS, TVH, TVP et TVQ", href: "/fr/outils/calculateur-taxes-de-vente/" },
      { label: "Logiciel de soumission", href: "/fr/logiciel-soumission/" },
    ],
  },
  {
    slug: "permis-renovation-montreal-arrondissement",
    title: "Permis de rénovation à Montréal : l'arrondissement | quoteai",
    description: "Permis de rénovation à Montréal : travaux visés, demande par mandataire, frais de 9,80 $ par 1 000 $, délais, secteurs patrimoniaux et clause de soumission.",
    h1: "Permis de rénovation à Montréal : ce que l'entrepreneur doit savoir.",
    lead: "À Montréal, le permis se demande au comptoir des permis de l'arrondissement où se trouve l'immeuble. Les travaux visés, le calcul des frais, les délais et la façon d'en parler dans votre soumission.",
    short: "Travaux visés, mandat du propriétaire, frais, délais et clause de permis dans la soumission.",
    updatedAt: "2026-11-24",
    blocks: [
      {
        h2: "Un permis par arrondissement",
        paragraphs: [
          "La Ville de Montréal compte 19 arrondissements, et chacun a son propre comptoir des permis. La Ville demande de respecter les normes établies dans l'arrondissement concerné et de communiquer avec son comptoir des permis avant de faire la demande, d'acheter les matériaux ou de commencer les travaux. Sur montreal.ca, la fiche « Rénover l'intérieur d'un bâtiment » affiche d'ailleurs un contenu différent selon l'arrondissement choisi : documents exigés, délais et adresse du comptoir.",
          "La demande peut se faire en ligne avec un compte montreal.ca, payée par carte de crédit. Une seule demande peut regrouper l'intérieur, la toiture, les portes et fenêtres, le revêtement extérieur et les éléments en saillie comme les escaliers, les balcons et les terrasses. Pour un agrandissement, la plupart des arrondissements demandent de passer au comptoir.",
        ],
      },
      {
        h2: "Quels travaux exigent un permis",
        paragraphs: [
          "Selon montreal.ca, un permis est requis dès que les travaux touchent les fondations, modifient la structure du logement, modifient un mur, porteur ou non, ou augmentent la surface de plancher. Il en faut un aussi pour modifier les dimensions, la division ou l'usage des pièces. Ajouter des portes et fenêtres, ou les remplacer par des modèles de dimensions différentes, fait l'objet de sa propre démarche de permis.",
          "Certains travaux esthétiques mineurs n'en demandent pas. La Ville donne ces exemples :",
        ],
        list: [
          "changer le revêtement de sol (tapis, plancher);",
          "repeindre les murs;",
          "remplacer des armoires ou des comptoirs;",
          "remplacer un évier ou un bain.",
        ],
      },
      {
        h2: "Plomberie, électricité, certificats et domaine public",
        paragraphs: [
          "La Ville ne délivre plus de permis pour la plomberie, l'électricité et le chauffage électrique ou au gaz. Ces travaux restent soumis à la réglementation provinciale; la Ville renvoie à la Régie du bâtiment du Québec.",
          "Certaines interventions demandent un certificat d'autorisation plutôt qu'un permis de construction. L'arrondissement de Verdun, par exemple, précise qu'un certificat d'autorisation est indispensable pour abattre un arbre. Et si vous devez installer un conteneur, de l'équipement ou un échafaudage sur la chaussée, le trottoir ou dans la ruelle, il faut un permis d'occupation temporaire du domaine public, distinct du permis de rénovation.",
        ],
      },
      {
        h2: "Qui fait la demande",
        paragraphs: [
          "Le permis est demandé au nom du propriétaire. Vous pouvez faire la démarche à sa place comme mandataire : montreal.ca exige alors une procuration qui vous autorise à agir au nom du propriétaire. Dans une copropriété, il faut aussi la lettre d'autorisation des copropriétaires ou une résolution du syndicat; certains arrondissements précisent les règles pour les parties communes et pour la copropriété indivise.",
          "Le dossier comprend en général le certificat de localisation, la fiche bâtiment, la soumission ou une grille d'estimation des coûts des travaux, taxes comprises, et les plans, élévations et coupes du projet. Si la structure est touchée, il faut des plans de structure signés et scellés par un ingénieur. Votre soumission sert donc directement au dossier de permis : une soumission détaillée, avec les taxes sur des lignes distinctes, évite d'avoir à refaire une estimation pour la Ville.",
        ],
      },
      {
        h2: "Combien coûte le permis",
        paragraphs: [
          "Les frais d'analyse se calculent sur le coût estimé des travaux : 9,80 $ par tranche de 1 000 $, avec un minimum de 167,40 $ pour un immeuble strictement résidentiel et de 491,70 $ pour un immeuble commercial, industriel, institutionnel ou mixte. La fiche de chacun des 19 arrondissements affiche la même règle de base. Le coût déclaré doit tout inclure : plans, main-d'œuvre, honoraires professionnels, matériaux et équipements, et les taxes. Sous 17 081,60 $ de travaux résidentiels, c'est le minimum de 167,40 $ qui s'applique.",
          "Les frais ne sont pas remboursables, même si la demande est annulée ou refusée. Le renouvellement d'un permis coûte 25 % du prix du permis original, avec les mêmes minimums, et doit être demandé avant la date de fin du permis.",
        ],
        example: {
          title: "Exemple : cuisine avec un mur non porteur déplacé, maison unifamiliale",
          rows: [
            ["Travaux avant taxes", "42 000,00 $"],
            ["TPS (5 %)", "2 100,00 $"],
            ["TVQ (9,975 %)", "4 189,50 $"],
            ["Coût déclaré à l'arrondissement, taxes comprises", "48 289,50 $"],
            ["Frais d'analyse : 48 289,50 $ ÷ 1 000 × 9,80 $", "473,24 $"],
          ],
        },
      },
      {
        h2: "Bâtiments patrimoniaux et secteurs protégés",
        paragraphs: [
          "Certains bâtiments ont un statut patrimonial ou se trouvent dans un secteur significatif, et plusieurs quartiers sont soumis à un programme particulier d'urbanisme (PPU). La demande est alors étudiée par un comité qui vérifie des normes supplémentaires. Des frais d'analyse additionnels, qui varient selon l'arrondissement, s'ajoutent aux frais de base, et le délai peut être plus long, surtout si le projet passe devant le comité consultatif d'urbanisme. Certains arrondissements mentionnent aussi qu'une demande de PIIA (plan d'implantation et d'intégration architecturale) peut être exigée pour certains travaux.",
          "Avant de promettre une date de début sur une façade ou des fenêtres, vérifiez donc le statut du bâtiment auprès du comptoir des permis.",
        ],
      },
      {
        h2: "Délais et validité",
        paragraphs: [
          "Le délai dépend de la nature de la demande, de sa complexité et de la saison. L'arrondissement de Rosemont–La Petite-Patrie, par exemple, indique un délai moyen de 8 à 10 semaines pour l'analyse d'une demande de rénovation intérieure, à partir du moment où tous les documents ont été transmis, sans garantie. Dans certains arrondissements, une demande incomplète est suspendue jusqu'à ce que les documents manquants arrivent.",
          "La validité varie aussi : à Saint-Léonard, pour les portes et fenêtres, les travaux doivent commencer au plus tard 3 mois après la délivrance, et le permis est valide 6 mois à partir du début des travaux. Une fois le permis obtenu, il doit être affiché pendant toute la durée du chantier, visible de la rue.",
          "À titre de comparaison, la Ville de Québec annonce environ 30 jours pour une première réponse, et de 30 à 60 jours de plus si le projet relève d'un PIIA ou de la Commission d'urbanisme et de conservation de Québec.",
        ],
      },
      {
        h2: "Ce que la soumission devrait dire sur le permis",
        list: [
          "L'arrondissement où se trouve l'immeuble et les travaux qui exigent un permis.",
          "Qui obtient le permis : le propriétaire, ou vous comme mandataire avec sa procuration.",
          "Les frais de permis, refacturés au coût et sur une ligne distincte, ou payés directement par le client.",
          "Les plans ou documents professionnels requis (plans à l'échelle, plans d'ingénieur) et qui les paie.",
          "Une date de début conditionnelle à la délivrance du permis, plutôt qu'une date ferme.",
          "Ce qui arrive si le permis est refusé ou exige des modifications : ordre de changement ou fin du contrat.",
        ],
        paragraphs: [
          "Dans quoteai, la soumission détaille les travaux avec la TPS et la TVQ sur des lignes distinctes; vous ajoutez la clause de permis dans vos conditions, puis le contrat, la facture et le paiement suivent.",
        ],
      },
      {
        h2: "Commencer sans permis",
        paragraphs: [
          "L'arrondissement de Verdun énumère les risques : des amendes de 350 $ à 4 000 $ selon la gravité de l'infraction, qui peuvent s'accumuler si les travaux continuent; l'arrêt immédiat des travaux; la démolition ou la modification des travaux non conformes; des inspections sans préavis, souvent après une plainte de voisin. Il note aussi que des travaux non autorisés peuvent compliquer une vente et poser problème avec l'assureur. C'est le propriétaire qui reçoit l'avis, mais c'est votre chantier qui s'arrête et votre calendrier qui glisse.",
          "Information générale, pas un avis juridique; vérifiée le 24 novembre 2026.",
        ],
      },
    ],
    faq: [
      { q: "Le permis est-il le même dans tous les arrondissements?", a: "La règle de base des frais est la même (9,80 $ par tranche de 1 000 $, minimum 167,40 $ en résidentiel), mais les documents exigés, les délais, les règles de zonage et les frais additionnels pour les secteurs patrimoniaux varient. Consultez la fiche de l'arrondissement sur montreal.ca." },
      { q: "Puis-je demander le permis au nom de mon client?", a: "Oui, comme mandataire, avec une procuration qui vous autorise à agir au nom du propriétaire." },
      { q: "Faut-il un permis pour refaire une salle de bain?", a: "Pas pour remplacer le bain, l'évier, les armoires ou le revêtement de sol. Oui si vous déplacez ou modifiez un mur, touchez la structure ou changez les dimensions ou l'usage des pièces." },
      { q: "Le coût déclaré comprend-il les taxes?", a: "Oui. Montréal demande un coût total des travaux qui inclut les plans, la main-d'œuvre, les honoraires, les matériaux et les taxes." },
      { q: "Et les travaux d'électricité ou de plomberie?", a: "La Ville ne délivre plus de permis pour ces travaux, mais la réglementation provinciale s'applique; la Ville renvoie à la Régie du bâtiment du Québec." },
    ],
    sources: [
      { label: "Ville de Montréal : rénover l'intérieur d'un bâtiment (fiches par arrondissement)", url: "https://montreal.ca/demarches/renover-linterieur-dun-batiment" },
      { label: "Ville de Montréal : rénovations, combien coûte un permis", url: "https://montreal.ca/articles/renovations-combien-coute-un-permis" },
      { label: "Ville de Montréal : rénovations, quoi faire avant, pendant et après vos travaux", url: "https://montreal.ca/articles/renovations-quoi-faire-avant-pendant-et-apres-vos-travaux" },
      { label: "Ville de Montréal : ajouter des portes et fenêtres ou les remplacer par des modèles de différentes dimensions", url: "https://montreal.ca/demarches/ajouter-des-portes-et-fenetres-ou-les-remplacer-par-des-modeles-de-differentes-dimensions" },
      { label: "Arrondissement de Verdun : besoin d'un permis?", url: "https://montreal.ca/articles/besoin-dun-permis-verdun-83388" },
      { label: "Ville de Québec : travaux sur la propriété", url: "https://www.ville.quebec.qc.ca/citoyens/reglements_permis/travaux-propriete.aspx" },
    ],
    related: [
      { label: "Calculateur de TPS, TVH, TVP et TVQ", href: "/fr/outils/calculateur-taxes-de-vente/" },
      { label: "Logiciel de soumission", href: "/fr/logiciel-soumission/" },
      { label: "Numéro de licence RBQ sur vos soumissions et contrats", href: "/fr/guides/numero-licence-rbq-soumission-contrat/" },
      { label: "Soumission d'entrepreneur en rénovation", href: "/fr/soumissions/entrepreneur-renovation/" },
    ],
  },

  {
    slug: "cnesst-entrepreneur-construction",
    title: "CNESST pour entrepreneurs en construction | quoteai",
    description: "CNESST en construction : inscription en 60 jours, taux par 100 $ de salaires, déclaration avant le 15 mars, attestation de conformité des sous-traitants.",
    h1: "La CNESST pour l'entrepreneur en construction.",
    lead: "Inscription, prime calculée sur vos salaires, déclaration annuelle, attestation de conformité de vos sous-traitants, avis d'ouverture de chantier et protection du travailleur autonome : les obligations qui touchent vos prix et vos contrats.",
    short: "Inscription, taux de prime, déclaration des salaires, attestation de conformité des sous-traitants et avis de chantier.",
    updatedAt: "2026-11-24",
    blocks: [
      {
        h2: "Quand devez-vous vous inscrire",
        paragraphs: [
          "Selon la CNESST, vous devez vous inscrire dès que vous embauchez au moins une travailleuse ou un travailleur, à temps plein ou à temps partiel, et que vous avez un établissement au Québec. L'inscription est aussi obligatoire si vous faites travailler un travailleur autonome que la CNESST considère comme un travailleur (voir plus bas).",
          "Vous avez 60 jours à partir de la première journée de travail de votre premier employé pour vous inscrire, et vous pouvez le faire jusqu'à 30 jours avant son arrivée. Après 60 jours, des frais de retard d'inscription s'appliquent. Les dirigeants et les travailleurs autonomes ne sont pas couverts automatiquement; ils peuvent demander une protection facultative au moment de l'inscription.",
        ],
      },
      {
        h2: "Comment la prime est calculée",
        paragraphs: [
          "La CNESST classe votre entreprise dans une ou plusieurs unités de classification selon la nature de vos activités; les unités de la construction vont de 80030 à 80250. Les travaux que vous donnez en sous-traitance ne comptent pas dans votre classification. Chaque unité a un taux de prime, exprimé en dollars par 100 $ de masse salariale assurable.",
          "En octobre, la CNESST envoie la décision de classification pour l'année qui commence le 1er janvier : vos unités, vos taux de prime, votre taux de versement périodique et l'association sectorielle paritaire à laquelle vous êtes lié, s'il y en a une. Vous pouvez contester la classification, mais pas le taux de prime ni le taux de versement.",
          "La prime se paie en cours d'année par versements périodiques à Revenu Québec, qui les perçoit pour la CNESST, au taux de versement indiqué sur la décision.",
        ],
      },
      {
        h2: "La déclaration des salaires, chaque année avant le 15 mars",
        paragraphs: [
          "Tous les employeurs doivent transmettre leur déclaration des salaires avant le 15 mars, même s'ils font des versements périodiques et même s'ils n'ont versé aucun salaire pendant l'année. La CNESST y calcule la prime réelle et la compare aux versements faits, puis envoie un avis de cotisation avec le solde à payer ou le trop-payé. Conservez les documents qui ont servi au calcul pendant 6 ans.",
          "La Loi sur les accidents du travail et les maladies professionnelles (article 319) prévoit une pénalité de 25 $ par jour de retard, jusqu'à 2 500 $, pour l'employeur qui ne transmet pas sa déclaration dans le délai.",
        ],
        example: {
          title: "Exemple : prime estimée d'une petite équipe (taux hypothétique)",
          rows: [
            ["Salaires assurables, compagnon", "58 000,00 $"],
            ["Salaires assurables, apprenti", "46 500,00 $"],
            ["Masse salariale assurable", "104 500,00 $"],
            ["Taux hypothétique, par 100 $ de masse salariale", "7,00 $"],
            ["Prime annuelle estimée : 104 500 $ ÷ 100 × 7,00 $", "7 315,00 $"],
          ],
        },
      },
      {
        h2: "Lire l'exemple et l'utiliser dans vos prix",
        paragraphs: [
          "Le taux de 7,00 $ est hypothétique : c'est le chiffre que la CNESST utilise elle-même dans un exemple de calcul, en précisant qu'il ne s'agit pas d'un taux réel. Votre vrai taux figure sur votre décision de classification, et la CNESST publie chaque année sa Table des taux par unité. Les salaires assurables sont aussi plafonnés par travailleur selon un salaire maximum annuel assurable révisé chaque année.",
          "La prime est un coût de main-d'œuvre, pas une dépense générale à oublier. Avec ce même taux, un chantier qui compte 9 600 $ de salaires porte 672,00 $ de prime (9 600 $ ÷ 100 × 7,00 $). Intégrez-la à votre taux horaire chargé.",
        ],
      },
      {
        h2: "Vos sous-traitants : l'attestation de conformité",
        paragraphs: [
          "L'article 316 de la Loi sur les accidents du travail et les maladies professionnelles permet à la CNESST d'exiger de l'employeur qui retient les services d'un entrepreneur le paiement de la cotisation que cet entrepreneur n'a pas payée. Le montant peut être établi d'après la part du prix convenu qui correspond au coût de la main-d'œuvre. L'employeur qui paie a le droit d'être remboursé par l'entrepreneur et peut retenir ce montant sur les sommes qu'il lui doit.",
          "La CNESST illustre la chaîne ainsi : un entrepreneur général (le donneur d'ouvrage) confie la plomberie à une entreprise (l'entrepreneur), qui confie l'installation des baignoires à une troisième (le sous-entrepreneur). L'entrepreneur général peut être tenu responsable de la cotisation de l'entreprise de plomberie, calculée sur le coût de la main-d'œuvre de tout le contrat, y compris la portion sous-traitée, sauf si une attestation de conformité couvre cette portion.",
          "La CNESST offre trois services dans MonEspace CNESST :",
        ],
        list: [
          "Avant le contrat, la validation de conformité : le sous-traitant seul peut la demander et reçoit immédiatement une preuve, utilisable avec sa soumission.",
          "Pendant le contrat, le suivi de l'état de conformité : vous êtes informé des changements tout au long du contrat.",
          "À la fin du contrat, l'attestation de conformité : c'est elle qui libère le donneur d'ouvrage de la cotisation due par l'entrepreneur. Si c'est vous qui la demandez, le sous-traitant a 14 jours pour approuver les détails du contrat ou s'y opposer; sans réponse, ils sont considérés comme validés.",
        ],
      },
      {
        h2: "Ce que la CNESST vérifie avant de délivrer l'attestation",
        paragraphs: [
          "Le dossier du sous-traitant doit être conforme : déclaration des salaires transmise avant le 15 mars, versements périodiques faits et cotisation payée ou entente de paiement respectée. Pour l'attestation de fin de contrat, il doit aussi pouvoir prouver la valeur du contrat et son coût de main-d'œuvre, et la répartition de ces coûts s'il a plusieurs unités. Si le sous-traitant doit de l'argent à la CNESST, elle peut exiger un paiement avant de produire l'attestation.",
          "En pratique, prévoyez-le dans votre contrat de sous-traitance : preuve de conformité avant le début, attestation de fin de contrat avant le paiement final, et droit de retenir la cotisation réclamée. Dans quoteai, ce genre de clause va dans vos conditions; la soumission, le contrat, la facture et le paiement suivent ensuite.",
        ],
      },
      {
        h2: "L'avis d'ouverture de chantier",
        paragraphs: [
          "La Loi sur la santé et la sécurité du travail (article 197) oblige le maître d'œuvre à transmettre à la CNESST un avis d'ouverture et un avis de fermeture du chantier. Le maître d'œuvre est le propriétaire ou la personne qui a la responsabilité de l'exécution de l'ensemble des travaux sur le chantier : souvent l'entrepreneur général.",
          "Selon la CNESST, l'avis d'ouverture doit être transmis au moins 10 jours avant le début des activités, et au moins 180 jours avant pour un chantier qui emploiera à un moment au moins 500 travailleurs en même temps. Si le chantier dure un mois ou moins, la date de fermeture s'inscrit sur l'avis d'ouverture; sinon, l'avis de fermeture se transmet au moins 10 jours avant la fin. Un chantier qui comptera au même moment au moins 10 travailleurs exige aussi un programme de prévention.",
        ],
      },
      {
        h2: "Le travailleur autonome",
        paragraphs: [
          "La CNESST décide du statut d'après les faits (subordination, outils, risque de perte, intégration). Un travailleur autonome sans employé qui exerce pour vous des activités similaires ou connexes aux vôtres est considéré comme votre travailleur (article 9 de la loi), sauf exceptions : il travaille pour plusieurs clients en même temps, ou pour plusieurs à tour de rôle sur des travaux de courte durée (moins de 420 heures par année) avec son propre équipement, ou ses services ne sont requis qu'occasionnellement. Dans ce cas, vous déclarez sa rémunération à la ligne 2 de votre déclaration des salaires. Un travailleur autonome qui a des employés est lui-même un employeur.",
          "Le travailleur autonome qui n'est pas couvert peut demander une protection personnelle, qui n'est pas obligatoire. Il doit d'abord s'inscrire à la CNESST et prouver sa capacité de gain (relevé 1, T4, états financiers). Le montant de protection se situe entre 34 700 $ et 103 000 $, et la protection se renouvelle chaque 1er janvier.",
        ],
      },
      {
        h2: "La CCQ, une obligation distincte",
        paragraphs: [
          "La Commission de la construction du Québec n'a rien à voir avec votre prime CNESST. Si vous travaillez sur des chantiers assujettis à la loi R-20, la CCQ exige un rapport mensuel, même pour un mois sans travaux, produit électroniquement et accompagné du paiement des remises prévues aux conventions collectives.",
          "Information générale, pas un avis juridique ou fiscal; vérifiée le 24 novembre 2026.",
        ],
      },
    ],
    faq: [
      { q: "Je travaille seul, sans employé : dois-je m'inscrire à la CNESST?", a: "L'obligation vise l'employeur qui embauche au moins un travailleur. Seul, vous n'êtes pas couvert automatiquement, mais vous pouvez demander une protection personnelle après vous être inscrit. Vérifiez aussi si un de vos donneurs d'ouvrage doit vous considérer comme son travailleur." },
      { q: "Où trouver mon vrai taux de prime?", a: "Sur la décision de classification envoyée en octobre pour l'année suivante, et dans la Table des taux publiée par la CNESST pour chaque unité de classification." },
      { q: "La preuve de conformité remise avec la soumission me protège-t-elle?", a: "Elle montre que le dossier était conforme à ce moment-là. C'est l'attestation de conformité de fin de contrat qui libère le donneur d'ouvrage de la cotisation due par l'entrepreneur." },
      { q: "Qui envoie l'avis d'ouverture de chantier?", a: "Le maître d'œuvre, c'est-à-dire le propriétaire ou la personne responsable de l'exécution de l'ensemble des travaux, au moins 10 jours avant le début des activités." },
      { q: "Que se passe-t-il si je produis ma déclaration des salaires en retard?", a: "La loi prévoit une pénalité de 25 $ par jour de retard, jusqu'à 2 500 $, et la CNESST mentionne aussi des intérêts. Un dossier en retard n'est pas conforme, ce qui bloque vos propres attestations." },
    ],
    sources: [
      { label: "CNESST : s'inscrire à la CNESST", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/inscription-cnesst" },
      { label: "CNESST : classification de l'employeur", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/obligations-annuelles-prime-assurance/classification-employeur" },
      { label: "CNESST : taux de versement", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/obligations-annuelles-prime-assurance/versements-periodiques/taux-versement" },
      { label: "CNESST : obligation de déclarer les salaires", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/obligations-annuelles-prime-assurance/declaration-salaires/obligation-declarer-salaires" },
      { label: "CNESST : comment nous calculons votre taux (exemple de taux par 100 $)", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/obligations-annuelles-prime-assurance/declaration-salaires/repartition-salaires/dossier-travailleurs-auxiliaires/comment-nous-calculons-votre-taux" },
      { label: "CNESST : paiement de la cotisation due par un autre employeur", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/dossier-dassurance-lemployeur/conformite/paiement-cotisation-due-autre-employeur" },
      { label: "CNESST : services de vérification de conformité", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/gestion-dossier-dassurance/conformite/services-verification-conformite" },
      { label: "CNESST : être conforme", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/gestion-dossier-dassurance/conformite/etre-conforme" },
      { label: "CNESST : ouvrir et fermer un chantier de construction", url: "https://www.cnesst.gouv.qc.ca/fr/prevention-securite/organiser-prevention/mesures-chantiers-construction/ouvrir-fermer-chantier-construction" },
      { label: "CNESST : distinction entre travailleur et travailleur autonome", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/obligations-annuelles-prime-assurance/declaration-salaires/montants-declarer/distinction-entre-travailleur-travailleur-autonome" },
      { label: "CNESST : protection personnelle", url: "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/employeurs/assurance-sante-securite-travail/types-protection/protection-personnelle" },
      { label: "Loi sur les accidents du travail et les maladies professionnelles (RLRQ, c. A-3.001), art. 9, 316 et 319", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/A-3.001" },
      { label: "Loi sur la santé et la sécurité du travail (RLRQ, c. S-2.1), art. 1 et 197", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/S-2.1" },
      { label: "CCQ : transmettre un rapport mensuel et payer les sommes dues", url: "https://www.ccq.org/rapportmensuel" },
    ],
    related: [
      { label: "Calculateur de taux horaire", href: "/fr/outils/calculateur-taux-horaire/" },
      { label: "Logiciel de coût de revient", href: "/fr/logiciel-cout-de-revient/" },
      { label: "Retenue contractuelle et hypothèque légale", href: "/fr/guides/retenue-contractuelle-hypotheque-legale/" },
      { label: "Soumission d'entrepreneur général", href: "/fr/soumissions/entrepreneur-general/" },
    ],
  },

  {
    slug: "retenue-contractuelle-hypotheque-legale",
    title: "Retenue et hypothèque légale au Québec | quoteai",
    description: "Retenue prévue au contrat, droits de retenue du Code civil (art. 2111 et 2123), hypothèque légale de la construction, dénonciation et délais à respecter.",
    h1: "Retenue contractuelle et hypothèque légale au Québec.",
    lead: "Au Québec, aucune loi ne fixe un pourcentage à retenir sur chaque paiement d'un contrat privé. Ce que le Code civil permet au client de garder, comment l'hypothèque légale protège ceux qui travaillent sur l'immeuble, et comment écrire la retenue dans votre contrat.",
    short: "Retenue prévue au contrat, droits du Code civil, hypothèque légale, dénonciation et délais de 30 jours et 6 mois.",
    updatedAt: "2026-11-24",
    blocks: [
      {
        h2: "La retenue vient du contrat, pas de la loi",
        paragraphs: [
          "Le Code civil du Québec ne prévoit aucun pourcentage de retenue sur les paiements d'un contrat de construction ou de rénovation entre particuliers ou entreprises privées. La retenue de 10 % que vous inscrivez dans une soumission ou un contrat est une clause convenue entre vous et votre client : elle s'applique au taux, sur la base et jusqu'à la date que le contrat fixe, et seulement si le contrat la prévoit.",
          "Le Code donne toutefois au client trois règles qui jouent le même rôle, et il vaut mieux les connaître avant de négocier la clause.",
        ],
        list: [
          "Article 2111 : le client n'est pas tenu de payer le prix avant la réception de l'ouvrage. Au moment du paiement, il peut retenir une somme suffisante pour couvrir les réserves faites à la réception sur les vices ou malfaçons apparents, jusqu'à ce que les corrections soient faites. Il perd ce droit si vous lui fournissez une sûreté suffisante. S'il n'y a pas d'entente sur la somme, un expert la fixe (article 2112).",
          "Article 2122 : pendant les travaux, vous ne pouvez exiger des acomptes pour la valeur des travaux faits et des matériaux nécessaires que si le contrat le prévoit, et vous devez d'abord remettre au client un état des sommes payées et encore dues à vos sous-traitants, fournisseurs et autres participants.",
          "Article 2123 : au moment du paiement, le client peut retenir de quoi payer les créances des ouvriers et des personnes qui lui ont dénoncé leur contrat avec vous. Cette retenue vaut tant que vous ne lui avez pas remis une quittance de ces créances, sauf si vous fournissez une sûreté suffisante.",
        ],
      },
      {
        h2: "L'hypothèque légale de la construction",
        paragraphs: [
          "L'article 2726 du Code civil accorde une hypothèque légale à l'architecte, à l'ingénieur, au fournisseur de matériaux, à l'ouvrier, à l'entrepreneur et au sous-entrepreneur, pour les travaux demandés par le propriétaire de l'immeuble ou pour les matériaux et services fournis ou préparés pour ces travaux. Elle ne grève que l'immeuble visé par les travaux et existe sans qu'il soit nécessaire de la publier.",
          "Elle garantit la plus-value donnée à l'immeuble par les travaux (article 2728). Pour cette plus-value, elle prend rang avant toute autre hypothèque publiée, y compris celle de la banque du propriétaire; entre elles, les hypothèques de la construction se partagent la plus-value en proportion de chaque créance (article 2952).",
        ],
      },
      {
        h2: "La dénonciation du contrat au propriétaire",
        paragraphs: [
          "Un sous-traitant ou un fournisseur qui n'a pas de contrat avec le propriétaire n'est protégé que pour les travaux, matériaux ou services fournis après la dénonciation écrite de son contrat au propriétaire (article 2728). Ce qui a été livré avant la dénonciation n'est pas couvert. L'ouvrier, lui, n'a pas à dénoncer son contrat.",
          "Si vous êtes sous-traitant, envoyez la dénonciation par écrit au propriétaire avant de commencer, avec une preuve de réception. Si vous êtes l'entrepreneur général, attendez-vous à ce que chaque dénonciation reçue par votre client lui permette de retenir sur vos paiements, selon l'article 2123, jusqu'à ce que vous lui remettiez la quittance du sous-traitant concerné.",
        ],
      },
      {
        h2: "Les deux délais : 30 jours et six mois",
        paragraphs: [
          "L'article 2727 fixe deux délais qui courent tous deux à partir de la fin des travaux. Notez cette date par écrit, par exemple dans le document de réception signé par le client : l'article 2110 lie la réception à la fin des travaux, lorsque l'ouvrage est exécuté et en état de servir à l'usage prévu.",
        ],
        list: [
          "Pendant les 30 jours qui suivent la fin des travaux, l'hypothèque existe même si elle n'a pas été publiée.",
          "Pour la conserver, il faut, avant la fin de ces 30 jours, inscrire au registre foncier un avis qui désigne l'immeuble et indique le montant de la créance, et signifier cet avis au propriétaire.",
          "L'hypothèque s'éteint six mois après la fin des travaux, à moins que le créancier n'ait, dans ce délai, publié une action contre le propriétaire ou inscrit un préavis d'exercice d'un droit hypothécaire.",
        ],
      },
      {
        h2: "Écrire la retenue dans votre contrat",
        paragraphs: [
          "Puisque la retenue est contractuelle, tout se joue dans la clause. Une clause claire évite de discuter, à la fin du chantier, de ce qui est retenu et du moment où il devient payable. Pour un client consommateur, l'Office de la protection du consommateur conseille d'ailleurs de payer une rénovation en plusieurs versements selon l'avancement des travaux et de garder un dernier paiement de 10 à 15 % du coût total jusqu'à la fin des travaux.",
        ],
        list: [
          "Le taux et sa base : par exemple 10 % de la valeur des travaux de chaque facture, avant taxes.",
          "Le moment de la libération : à la réception, ou après la fin du délai de 30 jours prévu à l'article 2727, sur remise des quittances des sous-traitants qui ont dénoncé leur contrat.",
          "Le sort des réserves : la somme gardée pour les réserves de la réception suit l'article 2111 et se libère quand les corrections sont faites.",
          "La sûreté de remplacement : si vous préférez fournir une sûreté plutôt que de subir une retenue, prévoyez-le.",
          "L'état des sommes payées aux sous-traitants et fournisseurs, remis avec chaque demande d'acompte, comme l'exige l'article 2122.",
        ],
      },
      {
        h2: "Les taxes sur la retenue",
        paragraphs: [
          "Selon l'article 168 de la Loi sur la taxe d'accise et l'article 90 de la Loi sur la taxe de vente du Québec, la TPS et la TVQ sur une partie du prix retenue en vertu d'une loi ou d'une convention écrite de construction ou de rénovation ne sont payables qu'au premier en date du jour où cette partie est payée et du jour où elle devient payable. Revenu Québec le confirme pour les contrats de construction. Chaque facture progressive taxe donc la partie payable maintenant, et la facture de libération taxe la retenue. C'est aussi ce que fait notre calculateur de retenue.",
          "quoteai prépare la soumission détaillée avec la TPS et la TVQ sur des lignes distinctes; le contrat, les factures et le paiement suivent à partir de celle-ci.",
        ],
        example: {
          title: "Exemple : rénovation de 60 000 $ avec retenue contractuelle de 10 %",
          rows: [
            ["Prix du contrat avant taxes", "60 000,00 $"],
            ["Facture 1 : travaux de 16 000,00 $ moins retenue de 1 600,00 $", "14 400,00 $"],
            ["Facture 1 : TPS (5 %) 720,00 $ et TVQ (9,975 %) 1 436,40 $, montant payable", "16 556,40 $"],
            ["Facture 2 : travaux de 26 000,00 $ moins retenue de 2 600,00 $", "23 400,00 $"],
            ["Facture 2 : TPS 1 170,00 $ et TVQ 2 334,15 $, montant payable", "26 904,15 $"],
            ["Facture 3 : travaux de 18 000,00 $ moins retenue de 1 800,00 $", "16 200,00 $"],
            ["Facture 3 : TPS 810,00 $ et TVQ 1 615,95 $, montant payable", "18 625,95 $"],
            ["Retenue accumulée, libérée après la réception", "6 000,00 $"],
            ["Facture de libération : TPS 300,00 $ et TVQ 598,50 $, montant payable", "6 898,50 $"],
            ["Total payé sur le contrat : 60 000,00 $ + TPS 3 000,00 $ + TVQ 5 985,00 $", "68 985,00 $"],
          ],
        },
      },
      {
        h2: "Contrats publics : le régime de paiements rapides",
        paragraphs: [
          "Pour les contrats de travaux de construction des organismes publics, le Règlement sur les paiements et le règlement rapides des différends en matière de travaux de construction est en vigueur depuis le 8 septembre 2025, selon le gouvernement du Québec. Il impose un calendrier de paiement obligatoire et un mécanisme de règlement rapide des différends par un tiers décideur, et il touche aussi les sous-traitants de la chaîne. Si vous travaillez sur un tel chantier, lisez les conditions de paiement des documents d'appel d'offres : ce régime ne s'applique pas aux contrats privés.",
          "Information générale, pas un avis juridique ou fiscal, vérifiée le 24 novembre 2026.",
        ],
      },
    ],
    faq: [
      { q: "La retenue de 10 % est-elle obligatoire au Québec?", a: "Non. Pour un contrat privé, elle n'existe que si le contrat la prévoit. Le Code civil permet toutefois au client de retenir des sommes pour les réserves faites à la réception (article 2111) et pour les créances dénoncées (article 2123)." },
      { q: "Mon client peut-il retenir plus que la retenue prévue au contrat?", a: "Il peut retenir en plus une somme suffisante pour les vices ou malfaçons apparents notés à la réception, et de quoi payer les ouvriers et les sous-traitants qui lui ont dénoncé leur contrat, tant que vous ne remettez pas de quittance. Fournir une sûreté suffisante met fin à ces deux droits." },
      { q: "Je suis sous-traitant : comment être protégé par l'hypothèque légale?", a: "Dénoncez votre contrat par écrit au propriétaire avant de commencer : seuls les travaux et matériaux fournis après la dénonciation sont couverts. Puis surveillez la fin des travaux, qui fait courir le délai de 30 jours pour inscrire l'avis et celui de six mois pour agir." },
      { q: "Le propriétaire peut-il faire radier l'hypothèque?", a: "Oui. Selon l'article 2731 du Code civil, il peut demander au tribunal de lui permettre de remplacer l'hypothèque par une autre sûreté suffisante, et le tribunal peut alors ordonner la radiation de l'inscription." },
      { q: "Quand dois-je facturer les taxes sur la retenue?", a: "Sur la facture de libération, au moment où la retenue est payée ou devient payable selon le contrat, et non sur la facture progressive." },
    ],
    sources: [
      { label: "Code civil du Québec (RLRQ, c. CCQ-1991), art. 2110 à 2123, 2726 à 2731 et 2952", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/CCQ-1991" },
      { label: "Loi sur la taxe d'accise, art. 168 (contrepartie retenue)", url: "https://laws-lois.justice.gc.ca/fra/lois/E-15/section-168.html" },
      { label: "Loi sur la taxe de vente du Québec (RLRQ, c. T-0.1), art. 90", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/T-0.1" },
      { label: "Revenu Québec : moment où la TPS/TVH et la TVQ doivent être perçues", url: "https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/perception-de-la-tps-et-de-la-tvq/moment-ou-la-tps-et-la-tvq-doivent-etre-percues/" },
      { label: "Office de la protection du consommateur : conseils sur la vente itinérante (conditions de paiement)", url: "https://www.opc.gouv.qc.ca/consommateur/sujet/vente-itinerante/conseils" },
      { label: "Gouvernement du Québec : paiements et règlement rapides des différends", url: "https://www.quebec.ca/gouvernement/faire-affaire-gouvernement/gestion-contrats-gouvernementaux/reglements-paiements-rapides-differends-travaux-construction" },
    ],
    related: [
      { label: "Calculateur de retenue de construction", href: "/fr/outils/calculateur-retenue/" },
      { label: "Contrats et signature électronique", href: "/fr/contrats-signature-electronique/" },
      { label: "TPS et TVQ sur l'acompte d'un entrepreneur", href: "/fr/guides/tps-tvq-acompte-entrepreneur/" },
      { label: "Modèle de soumission pour entrepreneur en rénovation", href: "/fr/soumissions/entrepreneur-renovation/" },
    ],
  },

  {
    slug: "tps-tvq-acompte-entrepreneur",
    title: "TPS et TVQ sur l'acompte d'un entrepreneur | quoteai",
    description: "Acompte ou dépôt, moment où la TPS et la TVQ deviennent exigibles, facturation progressive et facture finale sans taxer deux fois, avec un exemple de 20 000 $.",
    h1: "TPS et TVQ sur un acompte : quand les percevoir.",
    lead: "L'argent reçu à la signature n'est pas toujours taxé au même moment : tout dépend s'il s'agit d'un acompte sur le prix ou d'un dépôt. Les règles de Revenu Québec et des deux lois sur les taxes, puis une façon de facturer qui ne taxe jamais deux fois le même montant.",
    short: "Acompte ou dépôt, date où les taxes sont exigibles, factures progressives et facture finale sans double taxe.",
    updatedAt: "2026-11-24",
    blocks: [
      {
        h2: "Acompte ou dépôt : le mot change la taxe",
        paragraphs: [
          "Revenu Québec distingue deux situations. Un acompte est une partie du prix : les taxes sur un acompte doivent être perçues au premier en date du jour où il est versé et du jour où il est dû. Un dépôt, remboursable ou non, n'est pas une contrepartie tant que vous ne l'appliquez pas au prix : la TPS et la TVQ ne s'appliquent pas à son versement, seulement au moment où vous l'imputez au paiement du prix. C'est la règle de l'article 168 de la Loi sur la taxe d'accise (paragraphe 9) et de l'article 92 de la Loi sur la taxe de vente du Québec.",
          "En pratique, la somme que votre contrat de rénovation demande à la signature, à valoir sur le prix des travaux, est un acompte. Écrivez-le ainsi au contrat et taxez-la dès qu'elle est payée ou due. Un vrai dépôt, lui, est gardé en garantie sans être appliqué au prix tant que vous ne décidez pas de l'imputer.",
          "Si un client renonce à son achat et que vous conservez son dépôt, Revenu Québec considère que ce dépôt inclut la TPS et la TVQ, et vous devez les déclarer : 5/105 du dépôt pour la TPS et 9,975/109,975 pour la TVQ, selon les fractions qu'il publie.",
        ],
      },
      {
        h2: "La date où les taxes deviennent exigibles",
        paragraphs: [
          "La TPS et la TVQ sont payables au premier en date du jour où la contrepartie est payée et du jour où elle devient due (article 168 de la Loi sur la taxe d'accise, article 82 de la Loi sur la taxe de vente du Québec). Quand le prix est payé en plusieurs fois, la taxe est exigible sur chaque partie, à la première de ces deux dates pour cette partie. Une somme devient due à la première des dates suivantes (article 152 de la loi fédérale, article 83 de la loi québécoise) :",
        ],
        list: [
          "le jour où vous délivrez une facture pour la première fois, ou la date inscrite sur la facture, si elle est antérieure;",
          "le jour où vous auriez délivré la facture, n'eût été un retard injustifié;",
          "le jour où le client doit payer selon une convention écrite.",
        ],
      },
      {
        h2: "Ce que cela change pour vous",
        list: [
          "Une facture datée du 3 mars et payée le 28 avril : les taxes appartiennent à la période de déclaration qui comprend le 3 mars, même si l'argent arrive plus tard.",
          "Un contrat qui rend l'acompte payable à la signature : les taxes sur l'acompte sont exigibles ce jour-là, même si vous n'avez pas encore envoyé de facture.",
          "Des travaux presque achevés mais pas encore facturés : pour une convention écrite de construction ou de rénovation, la taxe sur le prix qui n'est ni payé ni dû devient payable le dernier jour du mois qui suit celui où les travaux sont presque achevés (article 168, paragraphe 3, de la loi fédérale et article 86 de la loi québécoise). Tarder à facturer ne repousse donc pas la taxe indéfiniment.",
          "Une retenue prévue au contrat : la taxe sur la partie retenue n'est payable que lorsqu'elle est payée ou devient payable (article 168, paragraphe 7, et article 90). Notre guide sur la retenue contractuelle l'explique.",
        ],
      },
      {
        h2: "Sur la soumission : prévoir chaque versement",
        paragraphs: [
          "La soumission devient la base du contrat. Indiquez le prix avant taxes, la TPS et la TVQ sur des lignes distinctes et le total, puis le calendrier de paiement : chaque versement exprimé en pourcentage ou en montant du prix avant taxes, avec ses propres taxes. Précisez que l'acompte est imputé au prix. Le client sait alors exactement ce qu'il paiera à chaque étape, et chaque facture reprend une ligne du calendrier. Les taux, l'inscription et les mentions obligatoires d'une facture sont expliqués dans notre guide sur la TPS et la TVQ.",
          "Au Québec, le Code civil ajoute une condition aux acomptes pendant les travaux : l'article 2122 ne vous permet de les exiger que si le contrat le prévoit, et vous devez d'abord remettre au client un état des sommes payées et encore dues à vos sous-traitants et fournisseurs.",
          "quoteai écrit une soumission détaillée avec la TPS et la TVQ sur des lignes distinctes; le contrat, les factures et le paiement suivent à partir de celle-ci.",
        ],
      },
      {
        h2: "Sur la facture finale : ne taxer que le solde",
        paragraphs: [
          "Chaque facture taxe seulement la partie du prix qu'elle facture. La facture finale reprend le prix total avant taxes, soustrait les montants déjà facturés avant taxes, et calcule la TPS et la TVQ uniquement sur le solde. Les paiements reçus peuvent y figurer à titre d'information, mais jamais comme base d'une nouvelle taxe. Une erreur à éviter : recalculer les taxes sur le prix total et à soustraire ensuite l'acompte taxes comprises : le client paie le bon total, mais vos factures déclarent deux fois les taxes sur l'acompte.",
          "Si vous avez reçu un vrai dépôt, c'est l'inverse : il n'a jamais été taxé. Sur la facture où vous l'appliquez, calculez les taxes sur le prix facturé, puis déduisez le dépôt du total taxes comprises, comme un paiement.",
        ],
        example: {
          title: "Exemple : cuisine de 20 000 $, acompte, facture progressive et facture finale",
          rows: [
            ["Prix des travaux avant taxes", "20 000,00 $"],
            ["Acompte de 30 % payable à la signature", "6 000,00 $"],
            ["Acompte : TPS (5 %) 300,00 $ et TVQ (9,975 %) 598,50 $, montant payable", "6 898,50 $"],
            ["Facture progressive : armoires installées, 50 % du prix", "10 000,00 $"],
            ["Facture progressive : TPS 500,00 $ et TVQ 997,50 $, montant payable", "11 497,50 $"],
            ["Facture finale : 20 000,00 $ moins 16 000,00 $ déjà facturés", "4 000,00 $"],
            ["Facture finale : TPS 200,00 $ et TVQ 399,00 $, montant payable", "4 599,00 $"],
            ["Total payé : 20 000,00 $ + TPS 1 000,00 $ + TVQ 1 995,00 $", "22 995,00 $"],
          ],
        },
      },
      {
        h2: "Vente à domicile : la règle de l'OPC",
        paragraphs: [
          "Si le contrat est conclu chez le client par un commerçant itinérant, la Loi sur la protection du consommateur interdit de percevoir un paiement partiel ou total avant la fin du délai de résolution de 10 jours, tant que le consommateur n'a pas reçu le bien (article 60), et de fournir un service prévu au contrat, installation comprise, avant la fin de ce délai (article 60.1). Si le client résout le contrat, vous devez le rembourser dans les 15 jours (article 63).",
          "Selon l'Office de la protection du consommateur, un entrepreneur en rénovation qui se présente chez le client à sa demande a quand même besoin d'un permis de commerçant itinérant pour un contrat de vente, d'installation ou de réparation de portes et fenêtres, d'isolants thermiques, ou de couvertures et revêtements extérieurs. L'OPC signale aussi que certains contrats, comme ceux de thermopompe, de climatiseur, de décontamination ou d'isolation, sont interdits aux commerçants itinérants depuis le 7 novembre 2024. Pour ces travaux, ne demandez donc aucun acompte à la signature à domicile.",
          "Information générale, pas un avis juridique ou fiscal, vérifiée le 24 novembre 2026.",
        ],
      },
    ],
    faq: [
      { q: "Dois-je facturer la TPS et la TVQ sur l'acompte demandé à la signature?", a: "Oui, si la somme est une partie du prix des travaux. Les taxes sont exigibles le jour où l'acompte est payé ou dû, au premier en date." },
      { q: "Le client annule et je garde son dépôt : y a-t-il des taxes?", a: "Oui. Revenu Québec considère que le dépôt conservé inclut la TPS et la TVQ. Vous déclarez 5/105 du montant en TPS et 9,975/109,975 en TVQ." },
      { q: "Mon client paie ma facture deux mois plus tard : quand dois-je déclarer les taxes?", a: "Dans la période qui comprend la date de la facture. La taxe nette d'une période comprend les taxes devenues percevables au cours de cette période, pas seulement celles encaissées (article 225 de la Loi sur la taxe d'accise, article 428 de la Loi sur la taxe de vente du Québec)." },
      { q: "Comment présenter l'acompte sur la facture finale?", a: "Soustrayez les montants déjà facturés avant taxes, calculez la TPS et la TVQ sur le solde seulement, et indiquez à part les paiements reçus." },
    ],
    sources: [
      { label: "Revenu Québec : moment où la TPS/TVH et la TVQ doivent être perçues", url: "https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/perception-de-la-tps-et-de-la-tvq/moment-ou-la-tps-et-la-tvq-doivent-etre-percues/" },
      { label: "Revenu Québec : dépôts", url: "https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/situations-particulieres-liees-a-la-tpstvh-et-a-la-tvq/depots/" },
      { label: "Loi sur la taxe d'accise, art. 152 (contrepartie due)", url: "https://laws-lois.justice.gc.ca/fra/lois/E-15/section-152.html" },
      { label: "Loi sur la taxe d'accise, art. 168 (moment où la taxe est payable, dépôts, retenues)", url: "https://laws-lois.justice.gc.ca/fra/lois/E-15/section-168.html" },
      { label: "Loi sur la taxe d'accise, art. 225 (taxe nette)", url: "https://laws-lois.justice.gc.ca/fra/lois/E-15/section-225.html" },
      { label: "Loi sur la taxe de vente du Québec (RLRQ, c. T-0.1), art. 82 à 92 et 428", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/T-0.1" },
      { label: "Code civil du Québec, art. 2122", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/CCQ-1991" },
      { label: "Loi sur la protection du consommateur (RLRQ, c. P-40.1), art. 59 à 63", url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-40.1" },
      { label: "Office de la protection du consommateur : conseils sur la vente itinérante", url: "https://www.opc.gouv.qc.ca/consommateur/sujet/vente-itinerante/conseils" },
      { label: "Office de la protection du consommateur : délai d'annulation", url: "https://www.opc.gouv.qc.ca/consommateur/sujet/vente-itinerante/annulation" },
    ],
    related: [
      { label: "Calculateur de TPS, TVH, TVP et TVQ", href: "/fr/outils/calculateur-taxes-de-vente/" },
      { label: "Logiciel de facturation", href: "/fr/logiciel-facturation/" },
      { label: "TPS et TVQ sur vos soumissions et factures", href: "/fr/guides/tps-tvq-soumissions-factures-entrepreneur/" },
      { label: "Retenue contractuelle et hypothèque légale", href: "/fr/guides/retenue-contractuelle-hypotheque-legale/" },
    ],
  },
];

export const FR_GUIDES_HUB = {
  title: "Guides pour entrepreneurs du Québec : taxes, RBQ | quoteai",
  description: "Guides pratiques pour les entrepreneurs et gens de métier du Québec : TPS et TVQ sur les factures, numéro de licence RBQ, soumissions et contrats en français.",
  h1: "Guides pour les entrepreneurs du Québec.",
  lead: "Les règles qui touchent chaque soumission et chaque facture au Québec, expliquées simplement, avec les sources officielles.",
  eyebrow: "Guides",
  updated: "Mis à jour le",
  sourcesTitle: "Sources officielles",
  relatedTitle: "À lire aussi",
  faqTitle: "Questions fréquentes",
  read: "Lire le guide",
  all: "Tous les guides",
  disclaimer: "Ce guide résume des règles publiques à la date indiquée. Ce n'est pas un avis juridique ou fiscal; vérifiez votre situation auprès de l'organisme concerné, de votre comptable ou d'un avocat.",
  ctaTitle: "Des soumissions en français, avec les bonnes taxes.",
  ctaBody: "quoteai prépare la soumission à partir de quelques mots, avec la TPS et la TVQ sur des lignes distinctes, puis le contrat (avec votre numéro de licence RBQ), la facture et le paiement suivent.",
  ctaButton: "Essayer quoteai gratuitement",
  ctaNote: "7 jours gratuits, sans carte de crédit.",
} as const;
