import { pgTable, text, uuid, timestamp, integer, boolean, jsonb, serial, index } from "drizzle-orm/pg-core";

// Pocket 128.6 (Feedback): a note a person sends from the phone, with an optional screenshot and what they drew on it. `ref` is the short reference they are shown (FB-1001).
export const FEEDBACK_KINDS = ["wrong", "idea", "question"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const appFeedbackTable = pgTable("app_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  ref: serial("ref").notNull(),
  userId: text("user_id").notNull(),
  authorEmail: text("author_email"),
  kind: text("kind", { enum: FEEDBACK_KINDS }).notNull().default("wrong"),
  note: text("note").notNull().default(""),
  replyOk: boolean("reply_ok").notNull().default(true),
  includeLogs: boolean("include_logs").notNull().default(true),
  appVersion: text("app_version"),
  device: text("device"),
  /** The screen the person was on. */
  screen: text("screen"),
  screenshotPath: text("screenshot_path"),
  /** What was drawn on the screenshot: strokes as lists of [x, y] in 0 to 1. */
  markup: jsonb("markup").$type<number[][][] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("app_feedback_user_idx").on(t.userId, t.createdAt)]);
export type AppFeedback = typeof appFeedbackTable.$inferSelect;
