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
    title: "TPS et TVQ sur vos soumissions et factures : guide de l'entrepreneur | quoteai",
    description: "Taux de TPS et de TVQ, seuil d'inscription de 30 000 $, calcul de la TVQ, et ce qui doit figurer sur une facture selon son montant (100 $ et 500 $). Guide pour les entrepreneurs du Québec.",
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
    ],
  },

  {
    slug: "numero-licence-rbq-soumission-contrat",
    title: "Numéro de licence RBQ : où l'inscrire sur vos soumissions et contrats | quoteai",
    description: "Où la Loi sur le bâtiment vous oblige à afficher votre numéro de licence RBQ (soumissions, contrats, factures, publicité, site Web, véhicules), dans quel format, et les exceptions.",
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
    ],
  },

  {
    slug: "soumission-contrat-en-francais-charte",
    title: "Soumissions, contrats et factures en français : ce que la Charte exige | quoteai",
    description: "Factures, bons de commande et contrats d'adhésion en français : ce que la Charte de la langue française, modifiée par la loi 96, exige des entrepreneurs depuis 2023, et comment offrir une version anglaise.",
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
    ],
  },
];

export const FR_GUIDES_HUB = {
  title: "Guides pour les entrepreneurs du Québec : taxes, RBQ, contrats en français | quoteai",
  description: "Guides pratiques en français pour les entrepreneurs et gens de métier du Québec : TPS et TVQ sur les factures, numéro de licence RBQ, soumissions et contrats en français.",
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
  ctaBody: "quoteai rédige la soumission à partir de quelques mots, en français, avec la TPS et la TVQ sur des lignes distinctes et votre numéro de licence RBQ, puis le contrat, la facture et le paiement suivent.",
  ctaButton: "Essayer quoteai gratuitement",
  ctaNote: "7 jours gratuits, sans carte de crédit.",
} as const;
