{/*
  TODO: This page is a template drafted by an AI assistant during the PrevAI -> QuoteAI
  migration. It has NOT been reviewed by a Canadian lawyer. Have qualified legal counsel
  review this Privacy Policy (PIPEDA / provincial privacy law compliance, accuracy of the
  vendor/sub-processor list, retention periods, and registered business jurisdiction)
  before this page goes live for real users.

  Phase 95: the French version (/fr/confidentialite) is a translation of the English one,
  section for section, and needs the same review (owner item L-3). Change both together.
*/}
import { LEGAL_ENTITY, isLegalEntityConfigured, addressLine, provinceName, inProvince } from "@workspace/legal-entity";
import { LegalPageShell, LegalH2, Mail } from "@/components/legal-page-shell";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PrivacyPage() {
  // /privacy-policy is English and /fr/confidentialite French, whatever the stored preference (LanguageContext).
  const { lang } = useLanguage();
  return lang === "fr" ? <PrivacyFr /> : <PrivacyEn />;
}

function PrivacyEn() {
  // Phase 73: the registered entity comes from lib/legal-entity (owner track O5).
  const entityConfigured = isLegalEntityConfigured();
  const provinceLabel = provinceName(LEGAL_ENTITY.province, "en");
  return (
    <LegalPageShell
      lang="en"
      title="Privacy Policy"
      description="QuoteAI's privacy policy — how we collect, use, and protect your personal information."
      updated="September 23, 2026"
      path="/privacy-policy/"
      altPath="/fr/confidentialite/"
    >
      <section>
        <LegalH2>1. Who we are</LegalH2>
        <p>
          This Privacy Policy is issued by{" "}
          {entityConfigured ? (
            <><strong>{LEGAL_ENTITY.legalName}</strong>, operating as QuoteAI (referred to as "the Company", "we", or "us"),
            a business registered in {provinceLabel}, Canada, with its mailing address at {addressLine()},</>
          ) : (
            <><strong>QuoteAI</strong> (referred to as "the Company", "we", or "us"),
            a business operating from {provinceLabel}, Canada,</>
          )}{" "}
          reachable at <Mail to="privacy@quoteai.ca" />.
          The person in charge of the protection of personal information (Québec Law 25) can be reached at the same address.
          We are committed to protecting your personal information in accordance with the
          Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable
          provincial privacy legislation.
        </p>
      </section>

      <section>
        <LegalH2>2. Information we collect</LegalH2>
        <p>We collect the following categories of personal information:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Account information:</strong> first name, last name, and email address, provided when you create an account.</li>
          <li><strong>Business profile information:</strong> company name, Business Number / GST-HST number, address, phone number, business email, and company logo.</li>
          <li><strong>Quote data:</strong> job descriptions, client (customer) information, amounts, and line items on quotes you generate.</li>
          <li><strong>Payment information:</strong> handled directly by Stripe Inc. — we never access your full credit card details.</li>
          <li><strong>Authentication credentials:</strong> your password is stored as a salted hash on our own servers; we do not send it to any third-party identity provider.</li>
          <li><strong>Technical information:</strong> IP address, browser type, pages visited, and session duration (via system logs).</li>
        </ul>
      </section>

      <section>
        <LegalH2>3. Purposes and grounds for collection</LegalH2>
        <div className="space-y-3">
          <div>
            <p className="font-medium">a) Providing the service</p>
            <p className="mt-1">Processing necessary to create your account, generate quotes using AI, and manage subscriptions and payments.</p>
          </div>
          <div>
            <p className="font-medium">b) Legal and tax obligations</p>
            <p className="mt-1">Retention of billing records to meet obligations under the Income Tax Act and applicable GST/HST legislation.</p>
          </div>
          <div>
            <p className="font-medium">c) Legitimate business interests</p>
            <p className="mt-1">Aggregate analysis to improve the service, fraud prevention, and platform security.</p>
          </div>
          <div>
            <p className="font-medium">d) Consent</p>
            <p className="mt-1">Sending promotional communications and newsletters, only after your explicit opt-in.</p>
          </div>
        </div>
      </section>

      <section>
        <LegalH2>4. Data retention</LegalH2>
        <p>We retain personal information only for as long as necessary for the purposes described above:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>
            <strong>Account data</strong> — until you delete your account. Deletion is self-serve (Settings → Security → Delete account)
            and takes effect after a 7-day grace period during which you can cancel from the confirmation email; your login is
            blocked, your subscription cancelled and connected services disconnected as soon as you request it. At the end of the
            grace period every quote, client, job, cost, photo, document and setting is permanently erased, including files in storage.
          </li>
          <li>
            <strong>Signed contracts and issued invoices</strong> — kept for 7 years after deletion, as required by the Income Tax Act,
            the Excise Tax Act (GST/HST) and Revenu Québec for books and records. They are unlinked from the deleted profile and held
            under an anonymous record that keeps only the business name and tax registration numbers needed to identify them;
            they are then deleted automatically.
          </li>
          <li><strong>Subscription billing records</strong> — 7 years, per CRA requirements for GST/HST and income tax records (held by Stripe and in our accounting).</li>
          <li><strong>Data exports</strong> — the ZIP file you request from Settings → Security is deleted 7 days after it is produced.</li>
          <li><strong>Technical logs</strong> — 90 days. <strong>Encrypted database backups</strong> — 30 days, so deleted data can persist in a backup for up to 30 days after the purge.</li>
        </ul>
      </section>

      <section>
        <LegalH2>5. Who we share information with</LegalH2>
        <p>Personal information may be shared with the following categories of recipients:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Stripe Inc.</strong> — payment processing and payouts (Stripe Connect).</li>
          <li><strong>AI providers (Groq, Inc. or OpenAI, LLC)</strong> — quote, contract and document generation. The job description, the photos and documents you attach, your price catalogue and the client details on the quote are sent under their API terms of service.</li>
          <li><strong>Vercel Inc. and Supabase Inc.</strong> — application hosting, database and file storage.</li>
          <li><strong>Resend Inc.</strong> — transactional email delivery; Gmail (Google LLC) or Outlook (Microsoft Corporation) when you connect your own mailbox to send from it.</li>
          <li><strong>Meta Platforms, Inc.</strong> — WhatsApp Business messages you choose to send to clients, and Meta Lead Ads if you connect an ad account.</li>
          <li><strong>Google LLC and Microsoft Corporation</strong> — calendar sync (Google Calendar, Outlook) when you connect a calendar.</li>
          <li><strong>Intuit Inc. (QuickBooks) and Wave Financial Inc.</strong> — accounting sync when you connect them.</li>
          <li><strong>Financeit Canada Inc. and Flinks Technology Inc.</strong> — client financing offers and bank-transaction matching when you enable them.</li>
          <li><strong>PostHog, Inc. and Google LLC (Google Analytics)</strong> — product analytics and website traffic measurement.</li>
          <li><strong>Twilio Inc.</strong> — text messages (SMS) you choose to send to clients and crew, and the replies they send back.</li>
          <li><strong>Functional Software, Inc. (Sentry)</strong> — error reports when something fails in the app; they carry the technical context of the error (page, browser, account identifier), not the content of your quotes.</li>
          <li><strong>Apple Inc., Google LLC and Mozilla Corporation</strong> — delivery of the push notifications you turn on, through your browser's own push service.</li>
        </ul>
        <p className="mt-3">
          We do not sell personal information to third parties. Where information is processed or
          stored outside Canada (including in the United States), we take reasonable steps to ensure
          a comparable level of protection through contractual safeguards, consistent with PIPEDA
          principle 4.1.3 (accountability for information transferred to third parties).
        </p>
      </section>

      <section>
        <LegalH2>6. Your rights</LegalH2>
        <p>Under PIPEDA and applicable provincial privacy laws, you have the right to:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Access</strong> — request a copy of the personal information we hold about you. Account owners can download everything at once from Settings → Security → Export my data (one export per day, link valid 7 days).</li>
          <li><strong>Correction</strong> — request correction of inaccurate or incomplete information.</li>
          <li><strong>Withdrawal of consent</strong> — withdraw consent at any time, subject to legal or contractual restrictions.</li>
          <li><strong>Deletion</strong> — delete your account yourself from Settings → Security → Delete account, subject to the legal retention obligations in section 4.</li>
          <li><strong>Complaint</strong> — file a complaint about how we handle your information.</li>
        </ul>
        <p className="mt-3">
          To exercise these rights, contact us at <Mail to="privacy@quoteai.ca" />.
          We will respond within 30 days. You also have the right to file a complaint with the{" "}
          <a href="https://www.priv.gc.ca" target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:underline">Office of the Privacy Commissioner of Canada</a>,
          or with your provincial privacy regulator where applicable.
        </p>
      </section>

      <section>
        <LegalH2>7. Cookies and tracking technologies</LegalH2>
        <p>
          We use only strictly necessary cookies required for the service to function (authentication, session management).
          We do not use profiling or third-party advertising cookies.
        </p>
      </section>

      <section>
        <LegalH2>8. Security</LegalH2>
        <p>
          We use appropriate technical and organizational safeguards to protect personal information against
          unauthorized access, loss, or alteration: encrypted connections (TLS/HTTPS), access controls, and
          hashed credential storage on our own infrastructure.
        </p>
      </section>

      <section>
        <LegalH2>9. Changes to this policy</LegalH2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated by
          email or via an in-platform notice at least 14 days in advance.
        </p>
      </section>

      <section>
        <LegalH2>10. Contact us</LegalH2>
        <p>
          For any questions about this Privacy Policy: <Mail to="privacy@quoteai.ca" />
          {entityConfigured && <><br />{LEGAL_ENTITY.legalName}, {addressLine()}</>}
        </p>
      </section>
    </LegalPageShell>
  );
}

function PrivacyFr() {
  const entityConfigured = isLegalEntityConfigured();
  return (
    <LegalPageShell
      lang="fr"
      title="Politique de confidentialité"
      description="Politique de confidentialité de QuoteAI : comment nous recueillons, utilisons et protégeons vos renseignements personnels."
      updated="23 septembre 2026"
      path="/fr/confidentialite/"
      altPath="/privacy-policy/"
    >
      <section>
        <LegalH2>1. Qui nous sommes</LegalH2>
        <p>
          La présente politique de confidentialité est publiée par{" "}
          {entityConfigured ? (
            <><strong>{LEGAL_ENTITY.legalName}</strong>, exerçant ses activités sous le nom de QuoteAI (« l'Entreprise », « nous »),
            une entreprise immatriculée {inProvince(LEGAL_ENTITY.province, "fr")}, Canada, dont l'adresse postale est {addressLine()},</>
          ) : (
            <><strong>QuoteAI</strong> (« l'Entreprise », « nous »),
            une entreprise exerçant ses activités {inProvince(LEGAL_ENTITY.province, "fr")}, Canada,</>
          )}{" "}
          joignable à <Mail to="privacy@quoteai.ca" />.
          La personne responsable de la protection des renseignements personnels (Loi 25 du Québec) peut être jointe à la même adresse.
          Nous nous engageons à protéger vos renseignements personnels conformément à la
          Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) et aux lois
          provinciales applicables en matière de protection des renseignements personnels.
        </p>
      </section>

      <section>
        <LegalH2>2. Renseignements que nous recueillons</LegalH2>
        <p>Nous recueillons les catégories de renseignements personnels suivantes :</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Renseignements de compte :</strong> prénom, nom et adresse courriel, fournis à la création du compte.</li>
          <li><strong>Profil d'entreprise :</strong> nom de l'entreprise, numéro d'entreprise / numéro de TPS-TVH, adresse, numéro de téléphone, courriel professionnel et logo.</li>
          <li><strong>Données des soumissions :</strong> descriptions des travaux, renseignements sur vos clients, montants et postes des soumissions que vous produisez.</li>
          <li><strong>Renseignements de paiement :</strong> traités directement par Stripe Inc. — nous n'avons jamais accès au numéro complet de votre carte de crédit.</li>
          <li><strong>Identifiants de connexion :</strong> votre mot de passe est conservé sous forme de hachage salé sur nos propres serveurs; nous ne le transmettons à aucun fournisseur d'identité tiers.</li>
          <li><strong>Renseignements techniques :</strong> adresse IP, type de navigateur, pages consultées et durée des sessions (au moyen des journaux système).</li>
        </ul>
      </section>

      <section>
        <LegalH2>3. Fins et fondements de la collecte</LegalH2>
        <div className="space-y-3">
          <div>
            <p className="font-medium">a) Fournir le service</p>
            <p className="mt-1">Traitements nécessaires pour créer votre compte, produire des soumissions au moyen de l'IA et gérer les abonnements et les paiements.</p>
          </div>
          <div>
            <p className="font-medium">b) Obligations légales et fiscales</p>
            <p className="mt-1">Conservation des registres de facturation pour respecter la Loi de l'impôt sur le revenu et la législation applicable en matière de TPS/TVH.</p>
          </div>
          <div>
            <p className="font-medium">c) Intérêts commerciaux légitimes</p>
            <p className="mt-1">Analyses agrégées pour améliorer le service, prévention de la fraude et sécurité de la plateforme.</p>
          </div>
          <div>
            <p className="font-medium">d) Consentement</p>
            <p className="mt-1">Envoi de communications promotionnelles et d'infolettres, uniquement après votre consentement exprès.</p>
          </div>
        </div>
      </section>

      <section>
        <LegalH2>4. Conservation des renseignements</LegalH2>
        <p>Nous conservons les renseignements personnels uniquement le temps nécessaire aux fins décrites ci-dessus :</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>
            <strong>Données du compte</strong> — jusqu'à la suppression de votre compte. Vous pouvez le supprimer vous-même (Paramètres → Sécurité → Supprimer le compte);
            la suppression prend effet après un délai de grâce de 7 jours pendant lequel vous pouvez l'annuler depuis le courriel de confirmation. Dès votre demande,
            votre connexion est bloquée, votre abonnement annulé et les services connectés déconnectés. À la fin du délai de grâce, l'ensemble des soumissions,
            clients, chantiers, coûts, photos, documents et paramètres est effacé définitivement, y compris les fichiers stockés.
          </li>
          <li>
            <strong>Contrats signés et factures émises</strong> — conservés 7 ans après la suppression, comme l'exigent la Loi de l'impôt sur le revenu,
            la Loi sur la taxe d'accise (TPS/TVH) et Revenu Québec pour les livres et registres. Ils sont dissociés du profil supprimé et rattachés à un
            dossier anonyme qui ne garde que le nom de l'entreprise et les numéros d'inscription aux taxes nécessaires pour les identifier;
            ils sont ensuite supprimés automatiquement.
          </li>
          <li><strong>Registres de facturation des abonnements</strong> — 7 ans, selon les exigences de l'ARC en matière de TPS/TVH et d'impôt sur le revenu (détenus par Stripe et dans notre comptabilité).</li>
          <li><strong>Exportations de données</strong> — le fichier ZIP demandé depuis Paramètres → Sécurité est supprimé 7 jours après sa production.</li>
          <li><strong>Journaux techniques</strong> — 90 jours. <strong>Sauvegardes chiffrées de la base de données</strong> — 30 jours; des données supprimées peuvent donc subsister dans une sauvegarde jusqu'à 30 jours après la purge.</li>
        </ul>
      </section>

      <section>
        <LegalH2>5. Avec qui nous communiquons les renseignements</LegalH2>
        <p>Des renseignements personnels peuvent être communiqués aux catégories de destinataires suivantes :</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Stripe Inc.</strong> — traitement des paiements et versements (Stripe Connect).</li>
          <li><strong>Fournisseurs d'IA (Groq, Inc. ou OpenAI, LLC)</strong> — production des soumissions, contrats et documents. La description des travaux, les photos et documents que vous joignez, votre catalogue de prix et les coordonnées du client figurant sur la soumission leur sont transmis selon les conditions d'utilisation de leur API.</li>
          <li><strong>Vercel Inc. et Supabase Inc.</strong> — hébergement de l'application, base de données et stockage des fichiers.</li>
          <li><strong>Resend Inc.</strong> — envoi des courriels transactionnels; Gmail (Google LLC) ou Outlook (Microsoft Corporation) lorsque vous connectez votre propre boîte de courriel pour envoyer depuis celle-ci.</li>
          <li><strong>Meta Platforms, Inc.</strong> — messages WhatsApp Business que vous choisissez d'envoyer à vos clients, et Meta Lead Ads si vous connectez un compte publicitaire.</li>
          <li><strong>Google LLC et Microsoft Corporation</strong> — synchronisation d'agenda (Google Agenda, Outlook) lorsque vous connectez un agenda.</li>
          <li><strong>Intuit Inc. (QuickBooks) et Wave Financial Inc.</strong> — synchronisation comptable lorsque vous les connectez.</li>
          <li><strong>Financeit Canada Inc. et Flinks Technology Inc.</strong> — offres de financement aux clients et rapprochement des transactions bancaires lorsque vous les activez.</li>
          <li><strong>PostHog, Inc. et Google LLC (Google Analytics)</strong> — analyse de l'utilisation du produit et mesure de la fréquentation du site.</li>
          <li><strong>Twilio Inc.</strong> — textos (SMS) que vous choisissez d'envoyer à vos clients et à votre équipe, et les réponses qu'ils vous renvoient.</li>
          <li><strong>Functional Software, Inc. (Sentry)</strong> — rapports d'erreur lorsqu'une fonction de l'application échoue; ils contiennent le contexte technique de l'erreur (page, navigateur, identifiant du compte), et non le contenu de vos soumissions.</li>
          <li><strong>Apple Inc., Google LLC et Mozilla Corporation</strong> — acheminement des notifications que vous activez, par le service de notifications de votre navigateur.</li>
        </ul>
        <p className="mt-3">
          Nous ne vendons pas de renseignements personnels à des tiers. Lorsque des renseignements sont traités ou
          conservés à l'extérieur du Canada (y compris aux États-Unis), nous prenons des mesures raisonnables pour assurer
          un niveau de protection comparable au moyen de garanties contractuelles, conformément au principe 4.1.3
          de la LPRPDE (responsabilité à l'égard des renseignements transférés à des tiers).
        </p>
      </section>

      <section>
        <LegalH2>6. Vos droits</LegalH2>
        <p>En vertu de la LPRPDE et des lois provinciales applicables, vous avez le droit :</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>d'accès</strong> — obtenir une copie des renseignements personnels que nous détenons à votre sujet. Le titulaire du compte peut tout télécharger en une fois depuis Paramètres → Sécurité → Exporter mes données (une exportation par jour, lien valide 7 jours);</li>
          <li><strong>de rectification</strong> — faire corriger des renseignements inexacts ou incomplets;</li>
          <li><strong>de retrait du consentement</strong> — retirer votre consentement en tout temps, sous réserve des restrictions légales ou contractuelles;</li>
          <li><strong>de suppression</strong> — supprimer vous-même votre compte depuis Paramètres → Sécurité → Supprimer le compte, sous réserve des obligations légales de conservation décrites à la section 4;</li>
          <li><strong>de porter plainte</strong> — au sujet de la façon dont nous traitons vos renseignements.</li>
        </ul>
        <p className="mt-3">
          Pour exercer ces droits, écrivez-nous à <Mail to="privacy@quoteai.ca" />.
          Nous répondrons dans un délai de 30 jours. Vous pouvez aussi porter plainte auprès du{" "}
          <a href="https://www.priv.gc.ca/fr/" target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:underline">Commissariat à la protection de la vie privée du Canada</a>{" "}
          ou, s'il y a lieu, de l'organisme provincial de protection des renseignements personnels (au Québec, la{" "}
          <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:underline">Commission d'accès à l'information</a>).
        </p>
      </section>

      <section>
        <LegalH2>7. Témoins et technologies de suivi</LegalH2>
        <p>
          Nous utilisons uniquement les témoins (cookies) strictement nécessaires au fonctionnement du service (authentification, gestion de session).
          Nous n'utilisons aucun témoin de profilage ni aucun témoin publicitaire de tiers.
        </p>
      </section>

      <section>
        <LegalH2>8. Sécurité</LegalH2>
        <p>
          Nous appliquons des mesures de sécurité techniques et organisationnelles appropriées pour protéger les renseignements
          personnels contre l'accès non autorisé, la perte ou l'altération : connexions chiffrées (TLS/HTTPS), contrôle des accès
          et stockage haché des identifiants sur notre propre infrastructure.
        </p>
      </section>

      <section>
        <LegalH2>9. Modifications de la présente politique</LegalH2>
        <p>
          Nous pouvons mettre à jour la présente politique de temps à autre. Toute modification importante vous sera communiquée
          par courriel ou par un avis dans la plateforme au moins 14 jours à l'avance.
        </p>
      </section>

      <section>
        <LegalH2>10. Nous joindre</LegalH2>
        <p>
          Pour toute question sur la présente politique : <Mail to="privacy@quoteai.ca" />
          {entityConfigured && <><br />{LEGAL_ENTITY.legalName}, {addressLine()}</>}
        </p>
      </section>
    </LegalPageShell>
  );
}
