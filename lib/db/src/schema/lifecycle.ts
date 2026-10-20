import { pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";

// Phase 134 (docs/GROWTH-PLAN.md): which lifecycle email went to whom. UNIQUE (user_id, message_key) = each message at most once per user, ever.
export const LIFECYCLE_MESSAGE_KEYS = ["welcome", "day1_no_quote", "first_quote_done", "free_quotes_low", "free_quotes_used", "day7_inactive", "win_back"] as const;
export type LifecycleMessageKey = (typeof LIFECYCLE_MESSAGE_KEYS)[number];

export const lifecycleSendsTable = pgTable(
  "lifecycle_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    messageKey: text("message_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    providerId: text("provider_id"),
  },
  (t) => [unique("lifecycle_sends_user_key_unique").on(t.userId, t.messageKey), index("lifecycle_sends_sent_at_idx").on(t.sentAt)],
);

export type LifecycleSend = typeof lifecycleSendsTable.$inferSelect;
