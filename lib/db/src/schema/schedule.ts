import { pgTable, text, uuid, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { projectsTable, collaboratorsTable } from "./crm";
import { milestonesTable } from "./jobs";

// ── Phase 75: schedule board (docs/PILOT-LAUNCH-PLAN.md) ────────────────────
// A schedule block is "this worker is on this job from 8:00 to 16:00 on
// Tuesday" — the crew-level plan that milestones (job-level, whole days) are
// too coarse for. Blocks are what the in-app calendar draws, what the worker
// sees on their /t page, what the evening-before reminder is about, and (with
// calendar_sync) what gets pushed to Google/Outlook as timed events.
//
// A block can be unassigned (collaborator_id null → the "Unassigned" lane)
// and, rarely, not tied to a job (project_id null → shop day, training). The
// job's own name is the default label; `title` only overrides it.

export const scheduleBlocksTable = pgTable(
  "schedule_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** business_profiles.user_id — the company that owns the board. */
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    collaboratorId: uuid("collaborator_id").references(() => collaboratorsTable.id, { onDelete: "set null" }),
    /** Optional label; empty → the job name (or "Block" when there is no job either). */
    title: text("title").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** All-day blocks span whole local days; starts_at/ends_at still hold the exact instants (local midnight → next local midnight). */
    allDay: boolean("all_day").notNull().default(false),
    notes: text("notes").notNull().default(""),
    /** When the evening-before (or same-morning) reminder went to the worker — null until sent; reset when the block moves. */
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("schedule_blocks_user_start_idx").on(t.userId, t.startsAt),
    index("schedule_blocks_worker_start_idx").on(t.collaboratorId, t.startsAt),
    index("schedule_blocks_project_idx").on(t.projectId),
  ],
);

export type ScheduleBlock = typeof scheduleBlocksTable.$inferSelect;
