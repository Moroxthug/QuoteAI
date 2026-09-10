{/*
  TODO: This page is a template drafted by an AI assistant during the PrevAI -> QuoteAI
  migration. It has NOT been reviewed by a Canadian lawyer. Have qualified legal counsel
  review this Privacy Policy (PIPEDA / provincial privacy law compliance, accuracy of the
  vendor/sub-processor list, retention periods, and registered business jurisdiction)
  before this page goes live for real users.
*/}
import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Privacy Policy | QuoteAI"
        description="QuoteAI's privacy policy — how we collect, use, and protect your personal information."
        canonical="https://quoteai.ca/privacy-policy/"
      />
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: May 6, 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Who we are</h2>
            <p>
              This Privacy Policy is issued by <strong>QuoteAI</strong> (referred to as "the Company", "we", or "us"),
              a business operating from Ontario, Canada, reachable at <a href="mailto:privacy@quoteai.ca" className="text-violet-600 hover:underline">privacy@quoteai.ca</a>.
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
              <li>Account data: until account deletion, then 30 additional days for security purposes.</li>
              <li>Quote data: 7 years from issuance, in line with Canada Revenue Agency (CRA) record-keeping requirements.</li>
              <li>Billing records: 7 years, per CRA requirements for GST/HST and income tax records.</li>
              <li>Technical logs: 90 days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Who we share information with</h2>
            <p>Personal information may be shared with the following categories of recipients:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Stripe Inc.</strong> — payment processing.</li>
              <li><strong>OpenAI, LLC</strong> — AI-generated quotes. Only the job description text is sent.</li>
              <li><strong>Cloud hosting providers</strong> — infrastructure and hosting.</li>
              <li><strong>Resend Inc.</strong> — transactional email delivery.</li>
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
              <li><strong>Access</strong> — request a copy of the personal information we hold about you.</li>
              <li><strong>Correction</strong> — request correction of inaccurate or incomplete information.</li>
              <li><strong>Withdrawal of consent</strong> — withdraw consent at any time, subject to legal or contractual restrictions.</li>
              <li><strong>Deletion</strong> — request deletion of your information, subject to legal retention obligations.</li>
              <li><strong>Complaint</strong> — file a complaint about how we handle your information.</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at <a href="mailto:privacy@quoteai.ca" className="text-violet-600 hover:underline">privacy@quoteai.ca</a>.
              We will respond within 30 days. You also have the right to file a complaint with the{" "}
              <a href="https://www.priv.gc.ca" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Office of the Privacy Commissioner of Canada</a>,
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
              For any questions about this Privacy Policy: <a href="mailto:privacy@quoteai.ca" className="text-violet-600 hover:underline">privacy@quoteai.ca</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
