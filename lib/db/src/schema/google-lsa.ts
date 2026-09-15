import { pgTable, text, uuid, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";

// ── Phase 29: Google Local Services Ads (LSA) lead capture ─────────────────
// The Google half of Phase 28's ad-lead-capture plan (Meta/Facebook was built
// in Phase 28; this was deliberately deferred — see docs/EDGE-FEATURES-PLAN.md
// §15). Unlike Meta's Graph API, Google LSA leads have NO webhook/push
// mechanism — they're only readable by querying the `local_services_lead`
// resource via the Google Ads API (GAQL), which additionally requires:
//   1. A developer token (`GOOGLE_ADS_DEVELOPER_TOKEN`) — Google approval gate,
//      not self-serve instant signup.
//   2. A manager (MCC) account — QuoteAI's own Google Ads manager account each
//      customer's LSA account gets linked under (`GOOGLE_ADS_LOGIN_CUSTOMER_ID`).
//   3. Standard per-customer OAuth2 consent (scope `.../auth/adwords`) — same
//      pattern as googleCalendarClient.ts, via a dedicated OAuth app.
// Given that gate, this is engineering-track scaffolding — same shape as
// Phase 16 (Financeit) and Phase 27 (Flinks): fully built, but it no-ops
// safely (`google_lsa_connections` empty) until the developer token + manager
// account are approved. Leads are pulled by a polling cron sweep
// (googleLsa/maintenance.ts), not pushed by a webhook.

export const googleLsaConnectionsTable = pgTable("google_lsa_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  /** The customer's Google Ads/LSA account id (10-digit, no dashes) that GAQL queries run against. */
  lsaCustomerId: text("lsa_customer_id").notNull(),
  /** AES-256-GCM ciphertext (lib/crypto.ts) — the OAuth refresh token, never stored in plaintext. */
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  /** Last time the polling sweep queried this connection, regardless of whether new leads were found. */
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastLeadAt: timestamp("last_lead_at", { withTimezone: true }),
});

/** Append-only log: every lead the polling sweep saw, imported or not, so a failure is visible. */
export const googleLsaImportLogTable = pgTable(
  "google_lsa_import_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    googleLsaLeadId: text("google_lsa_lead_id").notNull(),
    leadType: text("lead_type"),
    status: text("status", { enum: ["imported", "duplicate", "failed"] }).notNull(),
    error: text("error"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("google_lsa_import_log_user_idx").on(t.userId, t.createdAt),
    index("google_lsa_import_log_lead_idx").on(t.googleLsaLeadId),
  ],
);

export type GoogleLsaConnection = typeof googleLsaConnectionsTable.$inferSelect;
export type GoogleLsaImportLogEntry = typeof googleLsaImportLogTable.$inferSelect;
