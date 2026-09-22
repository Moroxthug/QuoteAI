import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";

// ── Phase 78: job notes ──────────────────────────────────────────────────────
// Free-text notes against a job ("client wants the trim white"). They come
// from the Overview card, from a dictation ("note: …") or from a photo the
// assistant looked at; `source` keeps that provenance visible on the card.

export const JOB_NOTE_SOURCES = ["manual", "voice", "photo", "assistant"] as const;
export type JobNoteSource = (typeof JOB_NOTE_SOURCES)[number];

export const jobNotesTable = pgTable(
  "job_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Plain uuid (no drizzle FK) to avoid a schema cycle with crm.ts; the SQL migration adds the FK. */
    projectId: uuid("project_id").notNull(),
    /** Plain uuid; null = not tied to a milestone. */
    milestoneId: uuid("milestone_id"),
    /** The job photo the note was taken from (photo → assistant path). Plain uuid. */
    photoId: uuid("photo_id"),
    body: text("body").notNull(),
    source: text("source", { enum: JOB_NOTE_SOURCES }).notNull().default("manual"),
    /** Display name of the member who saved it ("" for the owner). */
    authorName: text("author_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("job_notes_project_idx").on(t.projectId, t.createdAt)],
);

export type JobNote = typeof jobNotesTable.$inferSelect;
