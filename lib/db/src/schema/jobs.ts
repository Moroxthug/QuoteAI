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
import { z } from "zod/v4";
import { projectsTable } from "./crm";
import { contractsTable } from "./contracts";

// ── Phase 2: milestones, cost budget, change orders ──────────────────────────
// A job (projects row) is created automatically when the contract is signed.
// Its milestones are imported from the quote chapters and linked to the
// payment schedule so that completing a milestone can release the matching
// progress invoice (Phase 4). Everything here is proposed by the setup
// automation and confirmed/edited by the company on the review screen.

export const MILESTONE_STATUSES = ["planned", "in_progress", "completed", "skipped"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const milestonesTable = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    /** Stable key referenced by payment terms (`milestoneKey`), e.g. "chapter-A", "completion". */
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    plannedStart: timestamp("planned_start", { withTimezone: true }),
    plannedEnd: timestamp("planned_end", { withTimezone: true }),
    actualStart: timestamp("actual_start", { withTimezone: true }),
    actualEnd: timestamp("actual_end", { withTimezone: true }),
    status: text("status", { enum: MILESTONE_STATUSES }).notNull().default("planned"),
    /** Payment term (from the contract's payment schedule) released when this milestone completes. */
    paymentTermId: text("payment_term_id"),
    paymentTermLabel: text("payment_term_label"),
    /** Amount of that payment term incl. tax, in cents (snapshot at setup time). */
    paymentAmountCents: integer("payment_amount_cents"),
    /** Quote chapter letter this milestone was imported from ("A", "B"…). */
    sourceChapter: text("source_chapter"),
    /** Pre-tax value of the work in this milestone (cents) — drives progress %. */
    valueCents: integer("value_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("milestones_project_idx").on(t.projectId, t.sortOrder),
    uniqueIndex("milestones_project_key_idx").on(t.projectId, t.key),
  ],
);

export const COST_CATEGORIES = ["materials", "labour", "subcontractor", "permits_fees", "equipment", "misc"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const costBudgetLinesTable = pgTable(
  "cost_budget_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    category: text("category", { enum: COST_CATEGORIES }).notNull(),
    /** Quote chapter letter, or null for a job-wide line. */
    chapterRef: text("chapter_ref"),
    label: text("label").notNull().default(""),
    plannedCents: integer("planned_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("cost_budget_lines_project_idx").on(t.projectId, t.sortOrder)],
);

// ── Change orders ────────────────────────────────────────────────────────────
// A change order is the business record; the signable document is a
// `contracts` row with kind = "change_order" so it reuses the whole Phase 1
// machinery (contractor sign → send → OTP → customer sign → PDF + audit).

export const changeOrderItemSchema = z.object({
  descrizione: z.string().min(1).max(500),
  um: z.string().max(20).default(""),
  quantita: z.number().default(1),
  prezzoUnitario: z.number(),
  totale: z.number(),
});
export type ChangeOrderItem = z.infer<typeof changeOrderItemSchema>;

export const CHANGE_ORDER_STATUSES = ["draft", "sent", "signed", "declined", "voided"] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export const changeOrdersTable = pgTable(
  "change_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    /** The signed agreement being amended. */
    contractId: uuid("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
    /** The signable change-order document (contracts row, kind = change_order). */
    documentContractId: uuid("document_contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
    number: text("number").notNull(), // CO-01, CO-02… per job
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    items: jsonb("items").$type<ChangeOrderItem[]>().notNull().default([]),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    /** Calendar days added to (or removed from) the remaining schedule. */
    scheduleDeltaDays: integer("schedule_delta_days").notNull().default(0),
    status: text("status", { enum: CHANGE_ORDER_STATUSES }).notNull().default("draft"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    /** Set once the signed change order has been applied to the job (value + schedule). */
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("change_orders_project_idx").on(t.projectId, t.createdAt),
    index("change_orders_document_idx").on(t.documentContractId),
  ],
);

export type Milestone = typeof milestonesTable.$inferSelect;
export type CostBudgetLine = typeof costBudgetLinesTable.$inferSelect;
export type ChangeOrder = typeof changeOrdersTable.$inferSelect;
