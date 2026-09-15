import { pgTable, text, uuid, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";

// ── Phase 28: Meta (Facebook/Instagram) Lead Ads ────────────────────────────
// A company connects one Facebook Page via OAuth; QuoteAI subscribes that
// Page to the `leadgen` webhook field and every new Lead Ads submission is
// imported into the existing `leads` pipeline (Phase 9) with source
// "meta_lead_ads" — reuses lead follow-up, CRM, and CASL consent-logging
// entirely. v1 auto-connects the first Page the OAuth grant returns (mirrors
// Wave's `getFirstBusiness` single-business assumption) — a company managing
// several Pages can disconnect and reconnect after granting access to only
// the one they want leads from.

export const metaLeadAdsConnectionsTable = pgTable("meta_lead_ads_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  pageId: text("page_id").notNull(),
  pageName: text("page_name").notNull().default(""),
  /** AES-256-GCM ciphertext (lib/crypto.ts) — the Page access token, never stored in plaintext. */
  pageAccessTokenEnc: text("page_access_token_enc").notNull(),
  /**
   * Meta long-lived Page tokens have no fixed OAuth refresh grant (unlike Wave/QBO) — they stay
   * valid indefinitely as long as the underlying user token isn't revoked. We track the long-lived
   * user token's expiry (~60 days) so a background check can flag reconnection before it lapses.
   */
  userTokenExpiresAt: timestamp("user_token_expires_at", { withTimezone: true }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastLeadAt: timestamp("last_lead_at", { withTimezone: true }),
});

/** Append-only log: every leadgen webhook event received, imported or not, so a failure is visible. */
export const metaLeadAdsImportLogTable = pgTable(
  "meta_lead_ads_import_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    metaLeadId: text("meta_lead_id").notNull(),
    formId: text("form_id"),
    status: text("status", { enum: ["imported", "duplicate", "failed"] }).notNull(),
    error: text("error"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("meta_lead_ads_import_log_user_idx").on(t.userId, t.createdAt),
    index("meta_lead_ads_import_log_lead_idx").on(t.metaLeadId),
  ],
);

export type MetaLeadAdsConnection = typeof metaLeadAdsConnectionsTable.$inferSelect;
export type MetaLeadAdsImportLogEntry = typeof metaLeadAdsImportLogTable.$inferSelect;
