import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";

// Pocket 127.3 (AccountantView): the thread between the company's accountant and the company, one per month of books.
// The accountant reads the books read-only; this is the one thing they can write.
export const accountantCommentsTable = pgTable(
  "accountant_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (business_profiles.user_id). */
    userId: text("user_id").notNull(),
    /** The month of books it is about, `YYYY-MM`. */
    month: text("month").notNull(),
    authorUserId: text("author_user_id").notNull(),
    authorName: text("author_name").notNull().default(""),
    /** The author's role in the company when they wrote it ("accountant", "owner", "office"...). */
    authorRole: text("author_role").notNull().default("accountant"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accountant_comments_user_month_idx").on(t.userId, t.month, t.createdAt)],
);

export type AccountantComment = typeof accountantCommentsTable.$inferSelect;
