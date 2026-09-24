{/*
  TODO: This page is a template drafted by an AI assistant during the PrevAI -> QuoteAI
  migration. It has NOT been reviewed by a Canadian lawyer. Have qualified legal counsel
  review these Terms of Service (consumer protection law in the applicable province,
  refund/cancellation rules, governing law and venue selection, and accuracy of the
  pricing listed below) before this page goes live for real users.

  Phase 95: the French version (/fr/conditions) is a translation of the English one,
  section for section, and needs the same review (owner item L-3), including the
  language clause added to section 1 (Charter of the French Language, contracts of
  adhesion). Change both together.
*/}
import { LEGAL_ENTITY, isLegalEntityConfigured, addressLine, provinceName, inProvince, taxNumbersLine } from "@workspace/legal-entity";
import { LegalPageShell, LegalH2, Mail } from "@/components/legal-page-shell";
import { useLanguage } from "@/i18n/LanguageContext";

export default function TermsPage() {
  // /terms is English and /fr/conditions French, whatever the stored preference (LanguageContext).
  const { lang } = useLanguage();
  return lang === "fr" ? <TermsFr /> : <TermsEn />;
}

function TermsEn() {
  // Phase 73: the registered entity comes from lib/legal-entity (owner track O5).
  const entityConfigured = isLegalEntityConfigured();
  const provinceLabel = provinceName(LEGAL_ENTITY.province, "en");
  return (
    <LegalPageShell
      lang="en"
      title="Terms of Service"
      description="Terms and conditions for using the QuoteAI platform to generate AI-powered quotes."
      updated="September 23, 2026"
      path="/terms/"
      altPath="/fr/conditions/"
    >
      <section>
        <LegalH2>1. Acceptance of terms</LegalH2>
        <p>
          By using the <strong>QuoteAI</strong> platform (the "Service"), available at <strong>quoteai.ca</strong>,
          you agree to be bound by these Terms of Service in full. If you do not agree to these terms,
          you may not use the Service.
        </p>
        {entityConfigured ? (
          <p className="mt-2">
            The Service is operated by <strong>{LEGAL_ENTITY.legalName}</strong> ("QuoteAI", "the Company", "we"),
            a business registered in {provinceLabel}, Canada, with its mailing address at {addressLine()}.
            {taxNumbersLine("en") ? <> Tax registration: {taxNumbersLine("en")}.</> : null}
          </p>
        ) : (
          <p className="mt-2">
            The Service is operated by <strong>QuoteAI</strong> ("the Company", "we"), a business operating from {provinceLabel}, Canada.
          </p>
        )}
        <p className="mt-2">
          These Terms are available in English and in French (<a href="/fr/conditions/" className="text-navy-600 hover:underline" hrefLang="fr-CA" lang="fr">version française</a>).
          You chose the language you read them in; both versions have the same effect.
        </p>
      </section>

      <section>
        <LegalH2>2. Description of the service</LegalH2>
        <p>
          QuoteAI is a SaaS platform that helps tradespeople, contractors, and businesses generate
          professional quotes using artificial intelligence. The Service includes:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>AI-generated quotes from a text description of the work.</li>
          <li>Creation and download of professional PDF documents.</li>
          <li>Business profile management and quote storage.</li>
          <li>Monthly subscription plans and one-time purchases.</li>
        </ul>
      </section>

      <section>
        <LegalH2>3. User accounts</LegalH2>
        <p>
          To access the Service you must create an account and provide accurate, up-to-date information.
          You are responsible for keeping your credentials confidential and for all activity that occurs
          under your account. If you become aware of any unauthorized access, notify us immediately at{" "}
          <Mail to="support@quoteai.ca" />.
        </p>
      </section>

      <section>
        <LegalH2>4. Plans and payment</LegalH2>
        <div className="space-y-3">
          <div>
            <p className="font-medium">4.1 Available plans</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><strong>Starter ($19 CAD/month or $190 CAD/year):</strong> up to 10 quotes per month, PDFs with the QuoteAI watermark.</li>
              <li><strong>Pro ($49 CAD/month or $490 CAD/year):</strong> up to 60 quotes per month, PDFs without a watermark, custom branding, contracts, job sites, costs and invoicing.</li>
              <li><strong>Elite ($59 CAD/month or $590 CAD/year):</strong> unlimited quotes, everything in Pro, team time tracking, the AI assistant, advanced analytics and integrations (online card payments, accounting sync, public API).</li>
              <li><strong>Single with Watermark ($5 CAD):</strong> one PDF quote with the QuoteAI watermark.</li>
              <li><strong>Single Clean ($13 CAD):</strong> one PDF quote without a watermark.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">4.2 Billing</p>
            <p className="mt-1">
              Monthly plans renew automatically each month; annual plans renew automatically each year and are
              billed once, up front, at ten times the monthly price (two months free). Payments are processed by
              Stripe Inc. and are subject to Stripe's own terms of service. Prices are listed in Canadian dollars
              (CAD) and are exclusive of applicable GST/HST (and QST in Québec), which is added at checkout based
              on your billing address. You may switch tier or billing cadence at any time from Settings → Billing;
              the change takes effect immediately and the unused portion of the current period is prorated —
              charged or credited on the same receipt.
            </p>
          </div>
          <div>
            <p className="font-medium">4.3 Refunds and cancellation</p>
            <p className="mt-1">
              Digital content that has been delivered immediately upon purchase (such as a completed PDF quote)
              is generally non-refundable once downloaded, consistent with standard practice for digital goods.
              For monthly and annual plans, you may cancel at any time; the Service remains active until the end of
              the period already paid for. No pro-rated refunds are provided for unused portions of a billing period
              on cancellation (proration applies only when switching between plans, as described in 4.2).
              Nothing in this section limits any non-waivable rights you may have under applicable provincial
              consumer protection legislation.
            </p>
          </div>
        </div>
      </section>

      <section>
        <LegalH2>5. Acceptable use</LegalH2>
        <p>You may not use the Service to:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Generate false, fraudulent, or misleading documents.</li>
          <li>Infringe the rights of third parties, violate applicable law, or violate this policy.</li>
          <li>Attempt to access other users' data or compromise the security of the platform.</li>
          <li>Engage in large-scale automated use (scraping, bots) without written authorization.</li>
          <li>Resell or sublicense access to the Service to third parties.</li>
        </ul>
      </section>

      <section>
        <LegalH2>6. Intellectual property</LegalH2>
        <p>
          QuoteAI and its associated logos, trademarks, interfaces, and source code are the exclusive
          property of the Company. Quotes generated through the Service belong to the user who created them.
          The user grants QuoteAI a limited, non-exclusive licence to process submitted data solely for the
          purpose of providing the Service.
        </p>
      </section>

      <section>
        <LegalH2>7. Limitation of liability</LegalH2>
        <p>
          Quotes generated by the AI are estimates based on statistical data. <strong>QuoteAI does not
          guarantee the accuracy, completeness, or suitability of quotes for any specific contractual
          context.</strong> You are responsible for reviewing and validating all content before presenting
          it to your own clients. To the extent permitted by applicable law, QuoteAI is not liable for
          indirect damages, data loss, lost profits, or damages arising from errors in AI output.
        </p>
      </section>

      <section>
        <LegalH2>8. Suspension and termination</LegalH2>
        <p>
          QuoteAI reserves the right to suspend or terminate access to the Service in the event of a breach
          of these Terms, with notice by email except in cases of serious violations. You may cancel your
          account at any time from the Settings page or by contacting{" "}
          <Mail to="support@quoteai.ca" />.
        </p>
      </section>

      <section>
        <LegalH2>9. Changes to these terms</LegalH2>
        <p>
          We reserve the right to modify these Terms with at least 14 days' notice by email. Continued use
          of the Service after the effective date of any changes constitutes acceptance of the new Terms.
        </p>
      </section>

      <section>
        <LegalH2>10. Governing law and jurisdiction</LegalH2>
        <p>
          These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada
          applicable therein. Any dispute arising from these Terms is subject to the exclusive jurisdiction
          of the courts of Ontario, except where the user is a consumer under applicable provincial consumer
          protection legislation, in which case any mandatory statutory consumer protections will apply.
        </p>
      </section>

      <section>
        <LegalH2>11. Contact us</LegalH2>
        <p>
          For any questions about these Terms: <Mail to="support@quoteai.ca" />
          {entityConfigured && <><br />{LEGAL_ENTITY.legalName}, {addressLine()}</>}
        </p>
      </section>
    </LegalPageShell>
  );
}

function TermsFr() {
  const entityConfigured = isLegalEntityConfigured();
  const where = inProvince(LEGAL_ENTITY.province, "fr");
  return (
    <LegalPageShell
      lang="fr"
      title="Conditions d'utilisation"
      description="Conditions d'utilisation de la plateforme QuoteAI pour produire des soumissions au moyen de l'IA."
      updated="23 septembre 2026"
      path="/fr/conditions/"
      altPath="/terms/"
    >
      <section>
        <LegalH2>1. Acceptation des conditions</LegalH2>
        <p>
          En utilisant la plateforme <strong>QuoteAI</strong> (le « Service »), accessible à l'adresse <strong>quoteai.ca</strong>,
          vous acceptez d'être lié par l'ensemble des présentes conditions d'utilisation. Si vous ne les acceptez pas,
          vous ne pouvez pas utiliser le Service.
        </p>
        {entityConfigured ? (
          <p className="mt-2">
            Le Service est exploité par <strong>{LEGAL_ENTITY.legalName}</strong> (« QuoteAI », « l'Entreprise », « nous »),
            une entreprise immatriculée {where}, Canada, dont l'adresse postale est {addressLine()}.
            {taxNumbersLine("fr") ? <> Inscription aux taxes : {taxNumbersLine("fr")}.</> : null}
          </p>
        ) : (
          <p className="mt-2">
            Le Service est exploité par <strong>QuoteAI</strong> (« l'Entreprise », « nous »), une entreprise exerçant ses activités {where}, Canada.
          </p>
        )}
        <p className="mt-2">
          Les présentes conditions sont offertes en français et en anglais (<a href="/terms/" className="text-navy-600 hover:underline" hrefLang="en-CA" lang="en">English version</a>).
          Vous avez choisi la langue dans laquelle vous les lisez; les deux versions ont le même effet.
        </p>
      </section>

      <section>
        <LegalH2>2. Description du service</LegalH2>
        <p>
          QuoteAI est une plateforme SaaS qui aide les gens de métier, les entrepreneurs et les entreprises à produire
          des soumissions professionnelles au moyen de l'intelligence artificielle. Le Service comprend :
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>des soumissions produites par l'IA à partir d'une description écrite des travaux;</li>
          <li>la création et le téléchargement de documents PDF professionnels;</li>
          <li>la gestion du profil d'entreprise et la conservation des soumissions;</li>
          <li>des forfaits d'abonnement mensuels et des achats à l'unité.</li>
        </ul>
      </section>

      <section>
        <LegalH2>3. Comptes d'utilisateur</LegalH2>
        <p>
          Pour accéder au Service, vous devez créer un compte et fournir des renseignements exacts et à jour.
          Vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée
          dans votre compte. Si vous constatez un accès non autorisé, avisez-nous immédiatement à{" "}
          <Mail to="support@quoteai.ca" />.
        </p>
      </section>

      <section>
        <LegalH2>4. Forfaits et paiement</LegalH2>
        <div className="space-y-3">
          <div>
            <p className="font-medium">4.1 Forfaits offerts</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><strong>Starter (19 $ CA par mois ou 190 $ CA par année) :</strong> jusqu'à 10 soumissions par mois, PDF avec le filigrane QuoteAI.</li>
              <li><strong>Pro (49 $ CA par mois ou 490 $ CA par année) :</strong> jusqu'à 60 soumissions par mois, PDF sans filigrane, image de marque personnalisée, contrats, chantiers, coûts et facturation.</li>
              <li><strong>Elite (59 $ CA par mois ou 590 $ CA par année) :</strong> soumissions illimitées, tout ce qu'offre Pro, suivi du temps de l'équipe, assistant IA, analyses avancées et intégrations (paiement par carte en ligne, synchronisation comptable, API publique).</li>
              <li><strong>Soumission à l'unité (5 $ CA) :</strong> une soumission PDF avec le filigrane QuoteAI.</li>
              <li><strong>Soumission à l'unité, épurée (13 $ CA) :</strong> une soumission PDF sans filigrane.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">4.2 Facturation</p>
            <p className="mt-1">
              Les forfaits mensuels se renouvellent automatiquement chaque mois; les forfaits annuels se renouvellent automatiquement
              chaque année et sont facturés en une fois, d'avance, à dix fois le prix mensuel (deux mois gratuits). Les paiements sont
              traités par Stripe Inc. et soumis à ses propres conditions d'utilisation. Les prix sont indiqués en dollars canadiens
              et excluent la TPS/TVH applicable (et la TVQ au Québec), ajoutée au paiement selon votre adresse de facturation.
              Vous pouvez changer de forfait ou de cadence de facturation en tout temps depuis Paramètres → Facturation;
              le changement s'applique immédiatement et la partie inutilisée de la période en cours est calculée au prorata —
              facturée ou créditée sur le même reçu.
            </p>
          </div>
          <div>
            <p className="font-medium">4.3 Remboursements et annulation</p>
            <p className="mt-1">
              Le contenu numérique livré immédiatement à l'achat (comme une soumission PDF terminée) n'est généralement
              pas remboursable une fois téléchargé, conformément à la pratique courante pour les biens numériques.
              Vous pouvez annuler un forfait mensuel ou annuel en tout temps; le Service reste actif jusqu'à la fin de
              la période déjà payée. Aucun remboursement au prorata n'est accordé pour la partie inutilisée d'une période
              en cas d'annulation (le prorata ne s'applique qu'au changement de forfait, comme décrit à l'article 4.2).
              Rien dans le présent article ne limite les droits auxquels vous ne pouvez renoncer en vertu des lois
              provinciales applicables sur la protection du consommateur.
            </p>
          </div>
        </div>
      </section>

      <section>
        <LegalH2>5. Utilisation acceptable</LegalH2>
        <p>Vous ne pouvez pas utiliser le Service pour :</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>produire des documents faux, frauduleux ou trompeurs;</li>
          <li>porter atteinte aux droits de tiers, enfreindre la loi applicable ou enfreindre les présentes conditions;</li>
          <li>tenter d'accéder aux données d'autres utilisateurs ou de compromettre la sécurité de la plateforme;</li>
          <li>faire un usage automatisé à grande échelle (moissonnage, robots) sans autorisation écrite;</li>
          <li>revendre l'accès au Service ou en octroyer une sous-licence à des tiers.</li>
        </ul>
      </section>

      <section>
        <LegalH2>6. Propriété intellectuelle</LegalH2>
        <p>
          QuoteAI ainsi que ses logos, marques de commerce, interfaces et code source sont la propriété exclusive
          de l'Entreprise. Les soumissions produites au moyen du Service appartiennent à l'utilisateur qui les a créées.
          L'utilisateur accorde à QuoteAI une licence limitée et non exclusive lui permettant de traiter les données
          soumises uniquement pour fournir le Service.
        </p>
      </section>

      <section>
        <LegalH2>7. Limitation de responsabilité</LegalH2>
        <p>
          Les soumissions produites par l'IA sont des estimations fondées sur des données statistiques. <strong>QuoteAI ne
          garantit pas l'exactitude, l'exhaustivité ni la pertinence des soumissions dans un contexte contractuel
          particulier.</strong> Il vous revient de vérifier et de valider tout le contenu avant de le présenter à vos
          propres clients. Dans la mesure permise par la loi applicable, QuoteAI n'est pas responsable des dommages
          indirects, de la perte de données, du manque à gagner ni des dommages découlant d'erreurs dans les résultats de l'IA.
        </p>
      </section>

      <section>
        <LegalH2>8. Suspension et résiliation</LegalH2>
        <p>
          QuoteAI se réserve le droit de suspendre ou de résilier l'accès au Service en cas de manquement aux présentes
          conditions, avec préavis par courriel sauf en cas de violation grave. Vous pouvez fermer votre compte en tout
          temps depuis la page Paramètres ou en écrivant à{" "}
          <Mail to="support@quoteai.ca" />.
        </p>
      </section>

      <section>
        <LegalH2>9. Modification des conditions</LegalH2>
        <p>
          Nous nous réservons le droit de modifier les présentes conditions moyennant un préavis d'au moins 14 jours par courriel.
          L'utilisation continue du Service après la date d'entrée en vigueur des modifications vaut acceptation des nouvelles conditions.
        </p>
      </section>

      <section>
        <LegalH2>10. Droit applicable et compétence</LegalH2>
        <p>
          Les présentes conditions sont régies par les lois de la province de l'Ontario et les lois fédérales du Canada
          qui s'y appliquent. Tout différend découlant des présentes conditions relève de la compétence exclusive des
          tribunaux de l'Ontario, sauf si l'utilisateur est un consommateur au sens des lois provinciales applicables sur
          la protection du consommateur, auquel cas les protections légales impératives s'appliquent.
        </p>
      </section>

      <section>
        <LegalH2>11. Nous joindre</LegalH2>
        <p>
          Pour toute question sur les présentes conditions : <Mail to="support@quoteai.ca" />
          {entityConfigured && <><br />{LEGAL_ENTITY.legalName}, {addressLine()}</>}
        </p>
      </section>
    </LegalPageShell>
  );
}
