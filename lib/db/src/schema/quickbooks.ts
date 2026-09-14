import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";
import { COST_CATEGORIES } from "./jobs";

// ── Phase 11: QuickBooks Online integration ─────────────────────────────────
// One-way sync (QuoteAI → QuickBooks): paid invoices become QBO sales
// receipts, confirmed cost entries become QBO expenses. Tokens are stored
// encrypted (see lib/crypto.ts); a company also picks the funding account
// for expenses and maps each cost category to a QBO expense account, since
// every company's chart of accounts differs.

export type QuickbooksAccountRef = { id: string; name: string };
export type QuickbooksCategoryMap = Partial<Record<(typeof COST_CATEGORIES)[number], QuickbooksAccountRef>>;

export const quickbooksConnectionsTable = pgTable("quickbooks_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  realmId: text("realm_id").notNull(),
  environment: text("environment", { enum: ["sandbox", "production"] }).notNull().default("production"),
  companyName: text("company_name").notNull().default(""),
  /** AES-256-GCM ciphertext (lib/crypto.ts), never stored in plaintext. */
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  /** Bank/credit-card account expense syncs are posted from (QBO "source of funds"). */
  paymentAccount: jsonb("payment_account").$type<QuickbooksAccountRef | null>(),
  /** Cost category → QBO expense account, set per company in Settings → Integrations. */
  categoryMap: jsonb("category_map").$type<QuickbooksCategoryMap>().notNull().default({}),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const QUICKBOOKS_SYNC_ENTITY_TYPES = ["invoice", "cost_entry"] as const;
export type QuickbooksSyncEntityType = (typeof QUICKBOOKS_SYNC_ENTITY_TYPES)[number];

/** Append-only log: every sync attempt, success or failure, so a failed sync is visible and retryable. */
export const quickbooksSyncLogTable = pgTable(
  "quickbooks_sync_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    entityType: text("entity_type", { enum: QUICKBOOKS_SYNC_ENTITY_TYPES }).notNull(),
    entityId: text("entity_id").notNull(),
    qboId: text("qbo_id"),
    qboType: text("qbo_type"), // SalesReceipt | Purchase
    status: text("status", { enum: ["synced", "failed"] }).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quickbooks_sync_log_user_idx").on(t.userId, t.createdAt),
    index("quickbooks_sync_log_entity_idx").on(t.entityType, t.entityId, t.createdAt),
  ],
);

export type QuickbooksConnection = typeof quickbooksConnectionsTable.$inferSelect;
export type QuickbooksSyncLogEntry = typeof quickbooksSyncLogTable.$inferSelect;
