import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Phase 86: reports from the field ─────────────────────────────────────────
// What a crew member sends from /t/:token without an account: a photo with a
// note, a "blocked" flag the office has to act on, or materials they used.
// The photo lands in the job's gallery (job_photos) and the materials in the
// cost review queue (cost_entries, pending_review) — this row is the thread
// that ties them to who sent them and, for a blocker, whether anyone answered.

export const FIELD_REPORT_KINDS = ["note", "blocker", "materials"] as const;
export type FieldReportKind = (typeof FIELD_REPORT_KINDS)[number];

export const fieldReportsTable = pgTable(
  "field_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Plain uuids (no drizzle FKs, to stay out of the crm.ts/jobs.ts cycle); the SQL migration adds them. */
    projectId: uuid("project_id").notNull(),
    milestoneId: uuid("milestone_id"),
    workerId: uuid("worker_id"),
    /** The worker's name when they sent it — survives the worker being deleted. */
    authorName: text("author_name").notNull().default(""),
    kind: text("kind", { enum: FIELD_REPORT_KINDS }).notNull().default("note"),
    body: text("body").notNull().default(""),
    photoId: uuid("photo_id"),
    /** Materials reports: what they said it cost, and the pending cost entry made from it. */
    materialsCents: integer("materials_cents"),
    costEntryId: uuid("cost_entry_id"),
    /** Blockers stay open until someone in the office answers them. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByName: text("resolved_by_name"),
    resolutionNote: text("resolution_note"),
    /** Offline outbox op id — a replay returns the row it already created. */
    clientRef: text("client_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("field_reports_project_idx").on(t.projectId, t.createdAt),
    index("field_reports_user_open_idx").on(t.userId, t.kind, t.resolvedAt),
    uniqueIndex("field_reports_client_ref_idx").on(t.workerId, t.clientRef).where(sql`client_ref is not null`),
  ],
);

export type FieldReport = typeof fieldReportsTable.$inferSelect;
