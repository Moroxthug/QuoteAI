import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";
import { milestonesTable } from "./jobs";
import { scheduleBlocksTable } from "./schedule";

// ── Phase 12: calendar sync ──────────────────────────────────────────────────
// One-way push (QuoteAI → calendar) of job milestones as all-day events on
// Google Calendar and/or Outlook (Microsoft Graph). A company can connect
// either or both providers; every enabled connection gets its own copy of
// each milestone event. Tokens are stored encrypted, same pattern as Phase
// 11's QuickBooks connection (lib/crypto.ts).

export const CALENDAR_PROVIDERS = ["google", "outlook"] as const;
export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];

export const calendarConnectionsTable = pgTable(
  "calendar_connections",
  {
    userId: text("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: CALENDAR_PROVIDERS }).notNull(),
    accountEmail: text("account_email").notNull().default(""),
    /** AES-256-GCM ciphertext (lib/crypto.ts), never stored in plaintext. */
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    /** The calendar milestones are pushed into. v1 always writes to the account's primary calendar. */
    calendarId: text("calendar_id").notNull().default("primary"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

/**
 * Current sync state per (milestone, provider) — not append-only like
 * `quickbooks_sync_log`, since we need the live `externalEventId` to know
 * whether to create or update on the next push, and to delete it later.
 */
export const calendarSyncedEventsTable = pgTable(
  "calendar_synced_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider", { enum: CALENDAR_PROVIDERS }).notNull(),
    /** Exactly one of milestone_id / schedule_block_id is set: the row is the sync state of that one thing. */
    milestoneId: uuid("milestone_id").references(() => milestonesTable.id, { onDelete: "cascade" }),
    /** Phase 75: timed per-worker events pushed from the schedule board. */
    scheduleBlockId: uuid("schedule_block_id").references(() => scheduleBlocksTable.id, { onDelete: "cascade" }),
    externalEventId: text("external_event_id"),
    status: text("status", { enum: ["synced", "failed"] }).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("calendar_synced_events_milestone_provider_idx").on(t.milestoneId, t.provider),
    uniqueIndex("calendar_synced_events_block_provider_idx").on(t.scheduleBlockId, t.provider),
    index("calendar_synced_events_user_idx").on(t.userId, t.updatedAt),
  ],
);

export type CalendarConnection = typeof calendarConnectionsTable.$inferSelect;
export type CalendarSyncedEvent = typeof calendarSyncedEventsTable.$inferSelect;
