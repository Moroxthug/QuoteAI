import type { Response } from "express";

// ── Phase 65: which third-party integrations are actually configured ────────
// Every OAuth/API integration reads its credentials from the environment at
// import time. Before this module, a company on the right plan saw a live
// "Connect" button for an integration whose app registration did not exist
// yet (Wave, Meta, Google LSA, Outlook, Gmail send, WhatsApp…) and was bounced
// to the vendor's error page with an empty client_id. Each `/status` route now
// reports `available`, and each `/connect` route refuses with 503
// NOT_CONFIGURED, so the UI can say "not available yet" instead.
//
// This is deliberately a plain env-presence check — it says nothing about
// whether the credentials are *valid*; that is what the live smoke is for.

export const INTEGRATION_ENV: Record<IntegrationName, readonly string[]> = {
  stripe: ["STRIPE_SECRET_KEY"],
  quickbooks: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_REDIRECT_URI"],
  wave: ["WAVE_CLIENT_ID", "WAVE_CLIENT_SECRET", "WAVE_REDIRECT_URI"],
  google_calendar: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_REDIRECT_URI"],
  outlook_calendar: ["OUTLOOK_CALENDAR_CLIENT_ID", "OUTLOOK_CALENDAR_CLIENT_SECRET", "OUTLOOK_CALENDAR_REDIRECT_URI"],
  gmail_send: ["GMAIL_SEND_CLIENT_ID", "GMAIL_SEND_CLIENT_SECRET", "GMAIL_SEND_REDIRECT_URI"],
  whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  meta_lead_ads: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],
  google_lsa: ["GOOGLE_LSA_CLIENT_ID", "GOOGLE_LSA_CLIENT_SECRET", "GOOGLE_LSA_REDIRECT_URI", "GOOGLE_ADS_DEVELOPER_TOKEN"],
  flinks: ["FLINKS_CUSTOMER_ID", "FLINKS_INSTANCE"],
  financeit: ["FINANCEIT_APP_ID", "FINANCEIT_APP_SECRET"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
};

export type IntegrationName =
  | "stripe"
  | "quickbooks"
  | "wave"
  | "google_calendar"
  | "outlook_calendar"
  | "gmail_send"
  | "whatsapp"
  | "meta_lead_ads"
  | "google_lsa"
  | "flinks"
  | "financeit"
  | "twilio";

/** True when every env var the integration's client reads is non-empty. Read live (not cached) so tests can flip it. */
export function isIntegrationConfigured(name: IntegrationName): boolean {
  return INTEGRATION_ENV[name].every((key) => !!process.env[key]?.trim());
}

/** 503 + a stable error code the frontend can key on. Returns true when the response was sent (caller must `return`). */
export function refuseIfNotConfigured(res: Response, name: IntegrationName, label: string): boolean {
  if (isIntegrationConfigured(name)) return false;
  res.status(503).json({ error: "NOT_CONFIGURED", integration: name, message: `${label} isn't available yet — the app registration has not been completed.` });
  return true;
}
