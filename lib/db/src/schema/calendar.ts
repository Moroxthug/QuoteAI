import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  index,
  primaryKey,
  uniqueIndex,
  integer,
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
    /** Phase 85: when this account was last *read* (the push above is `lastSyncedAt`). */
    lastInboundSyncAt: timestamp("last_inbound_sync_at", { withTimezone: true }),
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

// ── Phase 85: the other direction ────────────────────────────────────────────
// Everything above pushes QuoteAI *into* someone's calendar. None of it ever
// read anything back, so the product never knew the owner was at a dentist on
// Thursday. These three tables are the inbound half:
//
//   calendar_external_events  a read-only mirror of what a connected calendar
//                             (or a subscribed ICS feed) says is happening
//   calendar_feeds            ICS subscriptions — the honest answer to
//                             "and Calendly, and Apple, and…", since every one
//                             of them publishes an .ics URL
//   calendar_publish_tokens   the reverse: one private URL per company that
//                             serves QuoteAI's own schedule as .ics, so any
//                             calendar app can subscribe without an OAuth app

/** Where a mirrored event came from: a connected account, or a subscribed URL. */
export const EXTERNAL_EVENT_SOURCES = ["google", "outlook", "ics"] as const;
export type ExternalEventSource = (typeof EXTERNAL_EVENT_SOURCES)[number];

export const calendarFeedsTable = pgTable(
  "calendar_feeds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" }),
    /** What the person calls it ("Calendly", "Site inspections"). */
    name: text("name").notNull(),
    /** https:// or webcal:// — normalised to https on save. */
    url: text("url").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    /** Reported back to the UI so a feed that has stopped working is visible. */
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastStatus: text("last_status", { enum: ["ok", "failed"] }),
    lastError: text("last_error"),
    eventCount: integer("event_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("calendar_feeds_user_idx").on(t.userId)],
);

export const calendarExternalEventsTable = pgTable(
  "calendar_external_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    source: text("source", { enum: EXTERNAL_EVENT_SOURCES }).notNull(),
    /** The ICS feed this came from; null for a connected account. */
    feedId: uuid("feed_id").references(() => calendarFeedsTable.id, { onDelete: "cascade" }),
    /** The provider's own id (Google/Graph event id, or the ICS UID + occurrence). */
    externalId: text("external_id").notNull(),
    title: text("title").notNull().default(""),
    location: text("location").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    /** "busy" darkens the day in the widget; "free"/"tentative" do not. */
    busy: boolean("busy").notNull().default(true),
    /** Deep link back to the event in its own calendar, when the provider gives one. */
    htmlLink: text("html_link"),
    /**
     * An event QuoteAI itself pushed (a schedule block that became a Google
     * event) — mirrored back by the inbound sync and hidden in the agenda, so
     * one block is never two rows on the same day.
     */
    isOurs: boolean("is_ours").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("calendar_external_events_identity_idx").on(t.userId, t.source, t.externalId),
    index("calendar_external_events_window_idx").on(t.userId, t.startsAt),
  ],
);

export const calendarPublishTokensTable = pgTable(
  "calendar_publish_tokens",
  {
    userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
    /** sha256 of the token in the URL — the plaintext is shown once, on creation. */
    tokenHash: text("token_hash").notNull(),
    /** Last four characters, so the UI can show which link is live without holding the secret. */
    hint: text("hint").notNull().default(""),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("calendar_publish_tokens_hash_idx").on(t.tokenHash)],
);

export type CalendarFeed = typeof calendarFeedsTable.$inferSelect;
export type CalendarExternalEvent = typeof calendarExternalEventsTable.$inferSelect;
