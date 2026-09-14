import { pgTable, text, timestamp, integer, numeric, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Phase 8: per-org cost/usage observability ──────────────────────────────
// See docs/GROWTH-PLATFORM-PLAN.md §4a. Raw events are for debugging/audits;
// usage_daily_summary is what powers the margin dashboard and the
// company-facing usage panel.

export const USAGE_EVENT_KINDS = [
  "ai_text",
  "ai_vision",
  "whatsapp_message",
  "email",
  "storage_bytes",
  "sms",
] as const;
export type UsageEventKind = (typeof USAGE_EVENT_KINDS)[number];

export const usageEventsTable = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<UsageEventKind>().notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    /** Cost per unit in USD cents, snapshotted at time of use since provider prices change. */
    unitCostCents: numeric("unit_cost_cents", { precision: 10, scale: 6 }).notNull().default("0"),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("usage_events_user_id_idx").on(table.userId),
    index("usage_events_user_id_kind_created_at_idx").on(table.userId, table.kind, table.createdAt),
  ],
);

export const insertUsageEventSchema = createInsertSchema(usageEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;
export type UsageEvent = typeof usageEventsTable.$inferSelect;

export const usageDailySummaryTable = pgTable(
  "usage_daily_summary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(), // 'YYYY-MM-DD', UTC day bucket
    kind: text("kind").$type<UsageEventKind>().notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("0"),
    costCents: numeric("cost_cents", { precision: 12, scale: 4 }).notNull().default("0"),
    eventCount: integer("event_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("usage_daily_summary_user_date_kind_idx").on(table.userId, table.date, table.kind),
    index("usage_daily_summary_date_kind_idx").on(table.date, table.kind),
  ],
);

export const insertUsageDailySummarySchema = createInsertSchema(usageDailySummaryTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUsageDailySummary = z.infer<typeof insertUsageDailySummarySchema>;
export type UsageDailySummary = typeof usageDailySummaryTable.$inferSelect;
