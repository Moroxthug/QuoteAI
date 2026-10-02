import { pgTable, text, uuid, timestamp, date, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

// ── Pocket (docs/POCKET-DESIGN-PLAN.md, Phase 146): the Home's "Today" list ──
// The list is made of what already needs the person (api-server today/service.ts
// needsYou) and the job tasks due; a job task is done in its own table. For the
// rest, a tick here says "dealt with today": it clears at the company's midnight,
// and the row comes back tomorrow if the thing (an invoice still unpaid) is still true.

export const todayChecksTable = pgTable(
  "today_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (business_profiles.user_id). */
    userId: text("user_id").notNull(),
    /** Who ticked it (auth user id): each person has their own list. */
    memberUserId: text("member_user_id").notNull(),
    /** The company's local day it was ticked on. */
    day: date("day").notNull(),
    /** The list item's id ("overdue:<invoice id>", "hours", "visit:<block id>"…). */
    itemId: text("item_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("today_checks_member_day_item_idx").on(t.memberUserId, t.day, t.itemId),
    index("today_checks_user_idx").on(t.userId),
  ],
);

export type TodayCheck = typeof todayChecksTable.$inferSelect;

// ── Pocket (Phase 149): a person's own app choices, per company and person ──
export type MemberPrefs = {
  /** The assistant's voice (Settings → Assistant → Voice). */
  voice?: "ember" | "tide" | "stone";
  /** Speak the assistant's replies aloud. Default on. */
  speak?: boolean;
  /** The assistant asks before sending quotes, invoices and messages to clients. Default on. */
  confirmSend?: boolean;
  /** The app's language, when chosen here. */
  language?: "en" | "fr";
  /** Pocket 128.3 (Profile): the person's job title and mobile, and the signature they drew (SVG path data in a 330 x 92 box) for quotes and contracts. */
  /** Pocket 128.7 (CustomizeHome): the person's own arrangement of their home: the order of its sections, which are shown, their three tabs and the density. */
  home?: { order?: string[]; on?: Record<string, boolean>; tabs?: string[]; density?: 0 | 1 };
  jobTitle?: string;
  mobile?: string;
  signature?: string;
};

export const memberPreferencesTable = pgTable(
  "member_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    memberUserId: text("member_user_id").notNull(),
    prefs: jsonb("prefs").$type<MemberPrefs>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("member_preferences_member_idx").on(t.userId, t.memberUserId)],
);
