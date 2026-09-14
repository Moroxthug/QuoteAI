import { pgTable, text, uuid, timestamp, jsonb, boolean, integer, index } from "drizzle-orm/pg-core";
import type { TeamMemberRole } from "./organization-members";
import type { AutomationEvent } from "./automation";

// ── Phase 19: public API + webhooks ─────────────────────────────────────────
// A per-company API key (bearer token, hashed like every other token in this
// codebase — see contracts/invoices `tokenHash`) that inherits the role of
// whoever created it, so the exact same Phase 7 permission matrix
// (requirePermission) governs what it can reach. Webhooks reuse the existing
// AUTOMATION_EVENTS names 1:1 — no separate event taxonomy.

export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    name: text("name").notNull(),
    /** Short, non-secret prefix shown in the UI so a company can tell keys apart (e.g. "qak_live_ab12"). */
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    /** Role the key acts as — snapshotted at creation from the creator's role, same as any team member. */
    role: text("role").$type<TeamMemberRole>().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("api_keys_user_idx").on(t.userId, t.createdAt),
    index("api_keys_hash_idx").on(t.keyHash),
  ],
);

export const webhookEndpointsTable = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    url: text("url").notNull(),
    /** Subset of AUTOMATION_EVENTS this endpoint wants to receive. */
    events: jsonb("events").$type<AutomationEvent[]>().notNull().default([]),
    /** HMAC signing secret, shown once at creation — needs to be readable to sign each delivery, so it's stored as-is (server-generated, never user-supplied, never rendered again after creation). */
    secret: text("secret").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoints_user_idx").on(t.userId, t.createdAt)],
);

export const webhookDeliveriesTable = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webhookId: uuid("webhook_id").notNull().references(() => webhookEndpointsTable.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    entityId: text("entity_id").notNull(),
    responseStatus: integer("response_status"),
    success: boolean("success").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_webhook_idx").on(t.webhookId, t.createdAt)],
);

export type ApiKey = typeof apiKeysTable.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpointsTable.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
