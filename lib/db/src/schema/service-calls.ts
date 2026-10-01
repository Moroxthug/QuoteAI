import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";
import { projectsTable, collaboratorsTable } from "./crm";

// Pocket 126: a call or visit on a finished job (ServiceCalls): what the client reported, whether it is under warranty (no charge) or billable, and the visit booked for it.
export const SERVICE_CALL_STATUSES = ["open", "booked", "done"] as const;
export type ServiceCallStatus = (typeof SERVICE_CALL_STATUSES)[number];
export const SERVICE_CALL_BILLING = ["warranty", "billable"] as const;
export const SERVICE_CALL_CHANNELS = ["phone", "email", "portal", "text", "in_person"] as const;

export const serviceCallsTable = pgTable(
  "service_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    issue: text("issue").notNull(),
    note: text("note").notNull().default(""),
    reportedBy: text("reported_by").notNull().default(""),
    channel: text("channel", { enum: SERVICE_CALL_CHANNELS }).notNull().default("phone"),
    status: text("status", { enum: SERVICE_CALL_STATUSES }).notNull().default("open"),
    billing: text("billing", { enum: SERVICE_CALL_BILLING }).notNull().default("warranty"),
    amountCents: integer("amount_cents").notNull().default(0),
    visitStartsAt: timestamp("visit_starts_at", { withTimezone: true }),
    visitEndsAt: timestamp("visit_ends_at", { withTimezone: true }),
    workerId: uuid("worker_id").references(() => collaboratorsTable.id, { onDelete: "set null" }),
    scheduleBlockId: uuid("schedule_block_id"),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    firstVisitAt: timestamp("first_visit_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("service_calls_user_idx").on(t.userId, t.status), index("service_calls_project_idx").on(t.projectId)],
);

export type ServiceCall = typeof serviceCallsTable.$inferSelect;
