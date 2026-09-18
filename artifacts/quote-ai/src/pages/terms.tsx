{/*
  TODO: This page is a template drafted by an AI assistant during the PrevAI -> QuoteAI
  migration. It has NOT been reviewed by a Canadian lawyer. Have qualified legal counsel
  review these Terms of Service (consumer protection law in the applicable province,
  refund/cancellation rules, governing law and venue selection, and accuracy of the
  pricing listed below) before this page goes live for real users.
*/}
import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";

export default function TermsPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Terms of Service | QuoteAI"
        description="Terms and conditions for using the QuoteAI platform to generate AI-powered quotes."
        canonical="https://quoteai.ca/terms/"
      />
      <div className="wrap">
        <nav aria-label="Breadcrumb" className="crumbs">
          <Link href="/">Home</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">Terms of Service</span>
        </nav>
      </div>

      <header className="wrap" style={{ maxWidth: 780, padding: "clamp(12px, 2vw, 24px) 0 clamp(24px, 3vw, 36px)" }}>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.5rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 10 }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: "var(--faint)" }}>Last updated: May 6, 2025</p>
      </header>

      <div className="wrap" style={{ maxWidth: 780, paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="prose blog-prose max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of terms</h2>
            <p>
              By using the <strong>QuoteAI</strong> platform (the "Service"), available at <strong>quoteai.ca</strong>,
              you agree to be bound by these Terms of Service in full. If you do not agree to these terms,
              you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Description of the service</h2>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. User accounts</h2>
            <p>
              To access the Service you must create an account and provide accurate, up-to-date information.
              You are responsible for keeping your credentials confidential and for all activity that occurs
              under your account. If you become aware of any unauthorized access, notify us immediately at{" "}
              <a href="mailto:support@quoteai.ca" className="text-navy-600 hover:underline">support@quoteai.ca</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Plans and payment</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium">4.1 Available plans</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Starter ($29 CAD/month):</strong> up to 10 quotes per month, PDFs with the QuoteAI watermark.</li>
                  <li><strong>Pro ($69 CAD/month):</strong> up to 60 quotes per month, PDFs without a watermark, custom branding.</li>
                  <li><strong>Elite ($79 CAD/month):</strong> unlimited quotes, no watermark, custom branding, priority AI generation.</li>
                  <li><strong>Single with Watermark ($5 CAD):</strong> one PDF quote with the QuoteAI watermark.</li>
                  <li><strong>Single Clean ($13 CAD):</strong> one PDF quote without a watermark.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">4.2 Billing</p>
                <p className="mt-1">
                  Monthly plans renew automatically each month. Payments are processed by Stripe Inc. and are
                  subject to Stripe's own terms of service. Prices are listed in Canadian dollars (CAD) and are
                  exclusive of applicable GST/HST, which is added at checkout based on your billing location.
                </p>
              </div>
              <div>
                <p className="font-medium">4.3 Refunds and cancellation</p>
                <p className="mt-1">
                  Digital content that has been delivered immediately upon purchase (such as a completed PDF quote)
                  is generally non-refundable once downloaded, consistent with standard practice for digital goods.
                  For monthly plans, you may cancel at any time; the Service remains active until the end of the
                  period already paid for. No pro-rated refunds are provided for unused portions of a billing period.
                  Nothing in this section limits any non-waivable rights you may have under applicable provincial
                  consumer protection legislation.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Acceptable use</h2>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Intellectual property</h2>
            <p>
              QuoteAI and its associated logos, trademarks, interfaces, and source code are the exclusive
              property of the Company. Quotes generated through the Service belong to the user who created them.
              The user grants QuoteAI a limited, non-exclusive licence to process submitted data solely for the
              purpose of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Limitation of liability</h2>
            <p>
              Quotes generated by the AI are estimates based on statistical data. <strong>QuoteAI does not
              guarantee the accuracy, completeness, or suitability of quotes for any specific contractual
              context.</strong> You are responsible for reviewing and validating all content before presenting
              it to your own clients. To the extent permitted by applicable law, QuoteAI is not liable for
              indirect damages, data loss, lost profits, or damages arising from errors in AI output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Suspension and termination</h2>
            <p>
              QuoteAI reserves the right to suspend or terminate access to the Service in the event of a breach
              of these Terms, with notice by email except in cases of serious violations. You may cancel your
              account at any time from the Settings page or by contacting{" "}
              <a href="mailto:support@quoteai.ca" className="text-navy-600 hover:underline">support@quoteai.ca</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to these terms</h2>
            <p>
              We reserve the right to modify these Terms with at least 14 days' notice by email. Continued use
              of the Service after the effective date of any changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Governing law and jurisdiction</h2>
            <p>
              These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada
              applicable therein. Any dispute arising from these Terms is subject to the exclusive jurisdiction
              of the courts of Ontario, except where the user is a consumer under applicable provincial consumer
              protection legislation, in which case any mandatory statutory consumer protections will apply.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contact us</h2>
            <p>
              For any questions about these Terms: <a href="mailto:support@quoteai.ca" className="text-navy-600 hover:underline">support@quoteai.ca</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
