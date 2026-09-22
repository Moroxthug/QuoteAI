{/*
  TODO: This page is a template drafted by an AI assistant during the PrevAI -> QuoteAI
  migration. It has NOT been reviewed by a Canadian lawyer. Have qualified legal counsel
  review this Privacy Policy (PIPEDA / provincial privacy law compliance, accuracy of the
  vendor/sub-processor list, retention periods, and registered business jurisdiction)
  before this page goes live for real users.
*/}
import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { breadcrumbJsonLd, webPageJsonLd } from "@/data/json-ld";
import { Link } from "wouter";
import { LEGAL_ENTITY, isLegalEntityConfigured, addressLine, provinceName } from "@workspace/legal-entity";

export default function PrivacyPage() {
  // Phase 73: the registered entity comes from lib/legal-entity (owner track O5).
  const entityConfigured = isLegalEntityConfigured();
  const provinceLabel = provinceName(LEGAL_ENTITY.province, "en");
  return (
    <PublicLayout>
      <SeoHead
        title="Privacy Policy | QuoteAI"
        description="QuoteAI's privacy policy — how we collect, use, and protect your personal information."
        canonical="https://quoteai.ca/privacy-policy/"
        jsonLd={[
          webPageJsonLd("Privacy Policy", "QuoteAI's privacy policy — how we collect, use, and protect your personal information.", "/privacy-policy/"),
          breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Privacy Policy", path: "/privacy-policy/" }]),
        ]}
      />
      <div className="wrap">
        <nav aria-label="Breadcrumb" className="crumbs">
          <Link href="/">Home</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">Privacy Policy</span>
        </nav>
      </div>

      <header className="wrap" style={{ maxWidth: 780, paddingTop: "clamp(12px, 2vw, 24px)", paddingBottom: "clamp(24px, 3vw, 36px)" }}>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.5rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 10 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: "var(--faint)" }}>Last updated: September 21, 2026</p>
      </header>

      <div className="wrap" style={{ maxWidth: 780, paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="prose blog-prose max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Who we are</h2>
            <p>
              This Privacy Policy is issued by{" "}
              {entityConfigured ? (
                <><strong>{LEGAL_ENTITY.legalName}</strong>, operating as QuoteAI (referred to as "the Company", "we", or "us"),
                a business registered in {provinceLabel}, Canada, with its mailing address at {addressLine()},</>
              ) : (
                <><strong>QuoteAI</strong> (referred to as "the Company", "we", or "us"),
                a business operating from {provinceLabel}, Canada,</>
              )}{" "}
              reachable at <a href="mailto:privacy@quoteai.ca" className="text-navy-600 hover:underline">privacy@quoteai.ca</a>.
              The person in charge of the protection of personal information (Québec Law 25) can be reached at the same address.
              We are committed to protecting your personal information in accordance with the
              Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable
              provincial privacy legislation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Information we collect</h2>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Purposes and grounds for collection</h2>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Data retention</h2>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Who we share information with</h2>
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
            </ul>
            <p className="mt-3">
              We do not sell personal information to third parties. Where information is processed or
              stored outside Canada (including in the United States), we take reasonable steps to ensure
              a comparable level of protection through contractual safeguards, consistent with PIPEDA
              principle 4.1.3 (accountability for information transferred to third parties).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Your rights</h2>
            <p>Under PIPEDA and applicable provincial privacy laws, you have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Access</strong> — request a copy of the personal information we hold about you. Account owners can download everything at once from Settings → Security → Export my data (one export per day, link valid 7 days).</li>
              <li><strong>Correction</strong> — request correction of inaccurate or incomplete information.</li>
              <li><strong>Withdrawal of consent</strong> — withdraw consent at any time, subject to legal or contractual restrictions.</li>
              <li><strong>Deletion</strong> — delete your account yourself from Settings → Security → Delete account, subject to the legal retention obligations in section 4.</li>
              <li><strong>Complaint</strong> — file a complaint about how we handle your information.</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at <a href="mailto:privacy@quoteai.ca" className="text-navy-600 hover:underline">privacy@quoteai.ca</a>.
              We will respond within 30 days. You also have the right to file a complaint with the{" "}
              <a href="https://www.priv.gc.ca" target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:underline">Office of the Privacy Commissioner of Canada</a>,
              or with your provincial privacy regulator where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Cookies and tracking technologies</h2>
            <p>
              We use only strictly necessary cookies required for the service to function (authentication, session management).
              We do not use profiling or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Security</h2>
            <p>
              We use appropriate technical and organizational safeguards to protect personal information against
              unauthorized access, loss, or alteration: encrypted connections (TLS/HTTPS), access controls, and
              hashed credential storage on our own infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated by
              email or via an in-platform notice at least 14 days in advance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contact us</h2>
            <p>
              For any questions about this Privacy Policy: <a href="mailto:privacy@quoteai.ca" className="text-navy-600 hover:underline">privacy@quoteai.ca</a>
              {entityConfigured && <><br />{LEGAL_ENTITY.legalName}, {addressLine()}</>}
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
