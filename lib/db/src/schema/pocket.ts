import { pgTable, text, uuid, timestamp, date, index, uniqueIndex } from "drizzle-orm/pg-core";

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
