import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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

// ── Phase 119: the phone app's push tokens (docs/APP-PLAN.md) ───────────────
// Beside the browser subscriptions: one row per installed app, holding the
// Firebase Cloud Messaging token (FCM relays to APNs for iPhones). Same
// ownership as push_subscriptions — the acting company plus the person — and
// the same clean-up: an UNREGISTERED answer deletes the row, a failure streak
// drops it. `installId` is the app's own id for itself, so a token that
// rotates replaces its row instead of adding a second one.
export const deviceTokensTable = pgTable(
  "device_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    memberUserId: text("member_user_id").notNull(),
    token: text("token").notNull(),
    installId: text("install_id").notNull(),
    platform: text("platform", { enum: ["android", "ios"] }).notNull(),
    appVersion: text("app_version"),
    language: text("language", { enum: ["en", "fr"] }).notNull().default("en"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("device_tokens_install_idx").on(t.installId), uniqueIndex("device_tokens_token_idx").on(t.token), index("device_tokens_user_idx").on(t.userId)],
);

export type DeviceToken = typeof deviceTokensTable.$inferSelect;

// Phase 119: what each person wants on their phone. Per company and person
// (like the rows above), a list of the push categories they turned off
// (api-server lib/push.ts PUSH_CATEGORIES). No row = everything on. The bell
// keeps every notification either way.
export const pushPreferencesTable = pgTable(
  "push_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    memberUserId: text("member_user_id").notNull(),
    muted: text("muted").array().notNull().default(sql`'{}'::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_preferences_member_idx").on(t.userId, t.memberUserId)],
);
