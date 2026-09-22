import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Phase 10: job photo galleries ────────────────────────────────────────────
// Photos uploaded against a job (optionally tied to a milestone), reusing the
// same Supabase private-object-storage pipeline as receipts. `sharedAt` is set
// once a photo has been included in a "share progress photos" send to the
// customer — sharing doesn't move the file, it just emails/WhatsApps a
// time-limited signed link (see lib/jobMessaging.ts).

export const jobPhotosTable = pgTable(
  "job_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Plain uuid (no drizzle FK) to avoid a schema cycle with crm.ts; the SQL migration adds the FK. */
    projectId: uuid("project_id").notNull(),
    /** Plain uuid (no drizzle FK) to avoid a schema cycle with jobs.ts; null = not tied to a specific milestone. */
    milestoneId: uuid("milestone_id"),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    fileUrl: text("file_url").notNull(),
    caption: text("caption").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    /** Phase 77: id of the offline outbox op that uploaded the photo — a replay returns the existing row. */
    clientRef: text("client_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("job_photos_project_idx").on(t.projectId, t.sortOrder), uniqueIndex("job_photos_client_ref_idx").on(t.userId, t.clientRef).where(sql`client_ref is not null`)],
);

export const insertJobPhotoSchema = createInsertSchema(jobPhotosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type JobPhoto = typeof jobPhotosTable.$inferSelect;
