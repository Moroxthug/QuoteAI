import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ── Phase 91: a profile for every person ─────────────────────────────────────
// auth_user holds the name, email and photo (image); this row holds the rest of
// what a person says about themselves. One per login, across every company
// they work in — the company-specific part (role, joined) stays on
// organization_members.

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  phone: text("phone"),
  jobTitle: text("job_title"),
  bio: text("bio"),
  /** Set when the person finished the first-login setup (name, photo, title). */
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
