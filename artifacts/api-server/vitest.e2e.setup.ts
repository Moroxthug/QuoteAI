import { vi } from "vitest";

// Refuse to run without a real database — and refuse the linked production
// project unless explicitly allowed (Phase 63 ran against it once because no
// staging project existed yet; see docs/QA-VERIFICATION-PLAN.md §3).
if (!process.env.DATABASE_URL) {
  throw new Error("E2E: DATABASE_URL is not set. Create .env.staging (see vitest.e2e.config.ts) or export the variables.");
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("E2E: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required (PDFs are written to storage).");
}

process.env.BETTER_AUTH_SECRET ??= "e2e-secret-not-for-production-use-0000";
process.env.TOKEN_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.CRON_SECRET ??= "e2e-cron-secret";
process.env.LOG_LEVEL ??= "warn";

// Phase 64: the inbound-webhook tests sign requests with these. Real values
// from .env.staging win (`??=`); the tests read process.env, so either works.
// The Stripe key only has to exist — constructEvent is local HMAC math.
process.env.STRIPE_SECRET_KEY ??= "sk_test_e2e_not_a_real_key";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_e2e_platform_secret";
process.env.STRIPE_CONNECT_WEBHOOK_SECRET ??= "whsec_e2e_connect_secret";
// Phase 65: the WhatsApp client reads these at import time; with them set the
// template/OTP sends actually hit graph.facebook.com — which integrations.e2e
// answers from a stub (src/e2e/vendorStub.ts). Real values from .env.staging win.
process.env.WHATSAPP_ACCESS_TOKEN ??= "e2e-whatsapp-token";
process.env.WHATSAPP_PHONE_NUMBER_ID ??= "e2e-phone-id";
process.env.WHATSAPP_REVIEW_REQUEST_TEMPLATE ??= "quoteai_review_request";
process.env.WHATSAPP_LEAD_FOLLOWUP_TEMPLATE ??= "quoteai_lead_followup";
process.env.WHATSAPP_PHOTO_SHARE_TEMPLATE ??= "quoteai_photo_share";
process.env.QUICKBOOKS_ENVIRONMENT ??= "sandbox";
// Phase 74: the SMS client reads these live; sms.e2e answers api.twilio.com from the stub. The webhook URL is
// what the signature is computed over, so the test signs with the same fixed value.
process.env.TWILIO_ACCOUNT_SID ??= "ACe2e0000000000000000000000000000";
process.env.TWILIO_AUTH_TOKEN ??= "e2e-twilio-auth-token";
process.env.TWILIO_FROM_NUMBER ??= "+18005550199";
process.env.TWILIO_WEBHOOK_URL ??= "https://e2e.quoteai.test/api/sms/webhook";
process.env.WHATSAPP_APP_SECRET ??= "e2e-whatsapp-app-secret";
process.env.META_APP_SECRET ??= "e2e-meta-app-secret";
process.env.FINANCEIT_WEBHOOK_SECRET ??= "e2e-financeit-webhook-secret";
process.env.RESEND_WEBHOOK_SECRET ??= "whsec_" + Buffer.from("e2e-resend-webhook-secret-bytes").toString("base64");

// Deterministic by default: every AI call path has a fallback on error, and
// we want to exercise the fallback, not pay for (and wait on) real models.
// The client is built at import time and refuses to exist without a key, so
// point it at a closed local port: every call fails instantly with
// ECONNREFUSED and the caller takes its fallback branch.
if (!process.env.E2E_REAL_AI) {
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "e2e-no-ai";
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "http://127.0.0.1:9/v1";
}

// Outbound email is mocked at the SDK boundary so the send paths run (and
// the code that gates on RESEND_API_KEY being present runs too) without a
// single real email leaving. `sentEmails` lets tests assert on what would
// have gone out.
process.env.RESEND_API_KEY = "re_e2e_mock";
vi.mock("resend", async () => {
  const { sentEmails } = await import("./src/e2e/mailbox.ts");
  class Resend {
    emails = {
      send: async (msg: { to: string | string[]; subject: string; from: string; html?: string; text?: string }) => {
        sentEmails.push({ to: Array.isArray(msg.to) ? msg.to : [msg.to], subject: msg.subject, from: msg.from, html: msg.html ?? msg.text ?? "" });
        return { data: { id: `e2e-${sentEmails.length}` }, error: null };
      },
    };
  }
  return { Resend };
});

// Phase 65: no request may leave the suite toward a vendor API. Every known
// vendor host is answered by src/e2e/vendorStub.ts — by default with a 599
// that the clients treat as a failure — and integrations.e2e.test.ts swaps in
// scripted answers per test. Our own server and Supabase pass through.
{
  const { installVendorStubs, stubHost, json } = await import("./src/e2e/vendorStub.ts");
  installVendorStubs();
  for (const host of [
    "https://graph.facebook.com/",
    "https://gmail.googleapis.com/",
    "https://www.googleapis.com/",
    "https://oauth2.googleapis.com/",
    "https://graph.microsoft.com/",
    "https://login.microsoftonline.com/",
    "https://sandbox-quickbooks.api.intuit.com/",
    "https://quickbooks.api.intuit.com/",
    "https://oauth.platform.intuit.com/",
    "https://developer.api.intuit.com/",
    "https://api.waveapps.com/",
    "https://gql.waveapps.com/",
    "https://googleads.googleapis.com/",
    "https://sandbox.financeit.ca/",
    "https://financeit.ca/",
    "https://api.twilio.com/",
  ]) {
    stubHost(host, (req) => json(599, { error: "e2e: unscripted vendor call", url: req.url }));
  }
}
