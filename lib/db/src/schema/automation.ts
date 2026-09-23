import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Automation runs ──────────────────────────────────────────────────────────
// Every domain event that triggers side effects (quote.accepted → notify the
// company, contract.signed → create the job, milestone.completed → invoice…)
// is recorded here with an idempotency key. Handlers run inline in the
// request that raised the event; failures are retried by the cron tick.
// There is no queue on Vercel, so this table *is* the queue.

export const AUTOMATION_EVENTS = [
  "quote.accepted",
  "contract.signed",
  "contract.declined",
  "milestone.completed",
  "job.completed",
  "invoice.overdue",
  "lead.followup_due",
  "job.review_request_due",
  "invoice.paid",
  "cost.confirmed",
  "quote.followup_due",
  "account.export_requested",
] as const;
export type AutomationEvent = (typeof AUTOMATION_EVENTS)[number];

export const automationRunsTable = pgTable(
  "automation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    event: text("event").notNull(),
    entityType: text("entity_type").notNull(), // quote | contract | project | milestone | invoice
    entityId: text("entity_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status", { enum: ["pending", "running", "succeeded", "failed", "dead"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("automation_runs_idempotency_idx").on(t.idempotencyKey),
    index("automation_runs_status_next_idx").on(t.status, t.nextAttemptAt),
    index("automation_runs_user_idx").on(t.userId, t.createdAt),
  ],
);

// ── In-app notifications ─────────────────────────────────────────────────────

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(), // quote_accepted | contract_signed | invoice_paid | ...
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"), // in-app path, e.g. /dashboard/quotes/<id>
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_unread_idx").on(t.userId, t.readAt, t.createdAt)],
);

// ── Audit log ────────────────────────────────────────────────────────────────
// Who changed what on money/legal documents. Populated by the automation
// handlers and, from Phase 1 on, by the contract/invoice routes.

export const auditLogTable = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(), // tenant
    actorType: text("actor_type", { enum: ["user", "customer", "system", "ai"] }).notNull(),
    actorId: text("actor_id"), // user id, signer id, or null for system
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // created | updated | sent | signed | voided | ...
    diff: jsonb("diff").$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    // Phase 86b: the worker's "what changed" reads schedule changes by tenant and type.
    index("audit_log_user_type_created_idx").on(t.userId, t.entityType, t.createdAt),
  ],
);

export type AutomationRun = typeof automationRunsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type AuditLogEntry = typeof auditLogTable.$inferSelect;
