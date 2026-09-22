import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── Phase 77: Web Push subscriptions (docs/PILOT-LAUNCH-PLAN.md) ────────────
// One row per browser that opted in to push on the notifications page. The
// row belongs to the acting company (`userId`, like every tenant table) and
// remembers which team member's browser it is (`memberUserId`) so a member who
// leaves the org takes their subscription with them. Delivery goes through
// api-server/src/lib/webPush.ts; a 404/410 from the push service deletes the
// row, other failures are counted and the row is dropped after a streak.

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (business_profiles.user_id) whose notifications this browser receives. */
    userId: text("user_id").notNull(),
    /** The signed-in person who subscribed (auth user id) — the owner or a team member. */
    memberUserId: text("member_user_id").notNull(),
    /** Push-service URL from PushSubscription.endpoint — unique per browser profile. */
    endpoint: text("endpoint").notNull(),
    /** Subscriber's ECDH public key (base64url, 65 bytes uncompressed). */
    p256dh: text("p256dh").notNull(),
    /** 16-byte auth secret (base64url). */
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    language: text("language", { enum: ["en", "fr"] }).notNull().default("en"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint), index("push_subscriptions_user_idx").on(t.userId)],
);

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
