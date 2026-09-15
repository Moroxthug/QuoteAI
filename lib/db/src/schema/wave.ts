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

// ── Phase 25: Wave accounting integration ───────────────────────────────────
// One-way sync (QuoteAI → Wave): paid invoices become Wave money-in
// transactions, confirmed cost entries become Wave money-out transactions.
// Mirrors Phase 11's QuickBooks pattern exactly (same encrypted-token,
// funding-account, category-map, sync-log shape) — Wave's public API is
// GraphQL rather than REST, so the client differs, but the connection/sync
// data model doesn't need to.

export type WaveAccountRef = { id: string; name: string };
export type WaveCategoryMap = Partial<Record<(typeof COST_CATEGORIES)[number], WaveAccountRef>>;

export const waveConnectionsTable = pgTable("wave_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  businessId: text("business_id").notNull(),
  businessName: text("business_name").notNull().default(""),
  /** AES-256-GCM ciphertext (lib/crypto.ts), never stored in plaintext. */
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  /** Bank/cash account revenue + expense transactions are posted from/to (the transaction "anchor"). */
  paymentAccount: jsonb("payment_account").$type<WaveAccountRef | null>(),
  /** Income account synced invoice revenue is booked against. */
  incomeAccount: jsonb("income_account").$type<WaveAccountRef | null>(),
  /** Cost category → Wave expense account, set per company in Settings → Integrations. */
  categoryMap: jsonb("category_map").$type<WaveCategoryMap>().notNull().default({}),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const WAVE_SYNC_ENTITY_TYPES = ["invoice", "cost_entry"] as const;
export type WaveSyncEntityType = (typeof WAVE_SYNC_ENTITY_TYPES)[number];

/** Append-only log: every sync attempt, success or failure, so a failed sync is visible and retryable. */
export const waveSyncLogTable = pgTable(
  "wave_sync_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    entityType: text("entity_type", { enum: WAVE_SYNC_ENTITY_TYPES }).notNull(),
    entityId: text("entity_id").notNull(),
    waveId: text("wave_id"),
    waveType: text("wave_type"), // MoneyTransaction
    status: text("status", { enum: ["synced", "failed"] }).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("wave_sync_log_user_idx").on(t.userId, t.createdAt),
    index("wave_sync_log_entity_idx").on(t.entityType, t.entityId, t.createdAt),
  ],
);

export type WaveConnection = typeof waveConnectionsTable.$inferSelect;
export type WaveSyncLogEntry = typeof waveSyncLogTable.$inferSelect;
