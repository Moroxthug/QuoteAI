import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projectsTable, collaboratorsTable, suppliersTable } from "./crm";
import { milestonesTable, COST_CATEGORIES } from "./jobs";
import { uploadedDocumentsTable } from "./documents";

// ── Phase 3: actual costs, time & equipment ──────────────────────────────────
// Every dollar spent on a job lands in `cost_entries`, whatever its origin:
// a receipt the AI read, a supplier invoice, an approved time entry (labour),
// an equipment usage log, or a line typed by hand. Budget-vs-actual on the
// job page compares these rows with `cost_budget_lines` by category.

export const COST_ENTRY_STATUSES = ["pending_review", "confirmed"] as const;
export type CostEntryStatus = (typeof COST_ENTRY_STATUSES)[number];

export const COST_ENTRY_SOURCES = ["manual", "receipt", "time_entry", "equipment", "legacy", "bank_feed"] as const;
export type CostEntrySource = (typeof COST_ENTRY_SOURCES)[number];

/** GST/HST/PST/QST split in cents, as read from the receipt (or computed). */
export type TaxBreakdown = { GST?: number; HST?: number; PST?: number; QST?: number; RST?: number };

/** Raw AI reading of a receipt, kept so the review card can show what the model saw. */
export type ReceiptExtraction = {
  vendor: string | null;
  date: string | null;
  currency: string | null;
  lines: { description: string; quantity: number | null; unitPrice: number | null; total: number | null }[];
  subtotal: number | null;
  taxes: { GST?: number | null; HST?: number | null; PST?: number | null; QST?: number | null };
  total: number | null;
  suggestedCategory: (typeof COST_CATEGORIES)[number] | null;
  suggestedProjectId: string | null;
  confidence: "high" | "medium" | "low";
  note: string | null;
  model: string;
};

export const costEntriesTable = pgTable(
  "cost_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Null while a receipt has not been matched to a job yet. */
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    category: text("category", { enum: COST_CATEGORIES }).notNull().default("misc"),
    vendor: text("vendor").notNull().default(""),
    supplierId: uuid("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
    description: text("description").notNull().default(""),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    taxBreakdown: jsonb("tax_breakdown").$type<TaxBreakdown>().notNull().default({}),
    totalCents: integer("total_cents").notNull().default(0),
    status: text("status", { enum: COST_ENTRY_STATUSES }).notNull().default("confirmed"),
    source: text("source", { enum: COST_ENTRY_SOURCES }).notNull().default("manual"),
    createdBy: text("created_by", { enum: ["user", "ai", "system"] }).notNull().default("user"),
    /** Receipt / supplier invoice this entry was read from. */
    sourceDocumentId: uuid("source_document_id").references(() => uploadedDocumentsTable.id, { onDelete: "set null" }),
    /** Plain uuids (the referenced tables live below in this file; SQL adds the FKs). */
    timeEntryId: uuid("time_entry_id"),
    equipmentUsageId: uuid("equipment_usage_id"),
    aiExtraction: jsonb("ai_extraction").$type<ReceiptExtraction | null>(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Phase 77: id of the offline outbox op that created the row — a replayed request returns the existing entry instead of inserting twice. */
    clientRef: text("client_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("cost_entries_project_idx").on(t.projectId, t.date),
    index("cost_entries_user_status_idx").on(t.userId, t.status),
    uniqueIndex("cost_entries_client_ref_idx").on(t.userId, t.clientRef).where(sql`client_ref is not null`),
  ],
);

// ── Time entries ─────────────────────────────────────────────────────────────
// Workers are `collaborators` rows (evolved in Phase 3 with type, burden and a
// magic-link token). Hours are logged by the worker from /t/:token or by the
// company; approval snapshots rate + burden and materialises a labour cost.

export const TIME_ENTRY_STATUSES = ["submitted", "approved", "rejected"] as const;
export type TimeEntryStatus = (typeof TIME_ENTRY_STATUSES)[number];

export const timeEntriesTable = pgTable(
  "time_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    workerId: uuid("worker_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    /** Hours worked, 2 decimals (e.g. 7.50). */
    hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
    rateCentsSnapshot: integer("rate_cents_snapshot").notNull().default(0),
    burdenPercentSnapshot: numeric("burden_percent_snapshot", { precision: 5, scale: 2 }).notNull().default("0"),
    note: text("note").notNull().default(""),
    status: text("status", { enum: TIME_ENTRY_STATUSES }).notNull().default("submitted"),
    /** worker = logged from the magic-link page; company = typed in the dashboard. */
    enteredBy: text("entered_by", { enum: ["worker", "company"] }).notNull().default("company"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),
    costEntryId: uuid("cost_entry_id").references(() => costEntriesTable.id, { onDelete: "set null" }),
    /** Phase 23: GPS clock-in/out. Null on manually-logged (self-reported) entries. */
    clockInAt: timestamp("clock_in_at", { withTimezone: true }),
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
    clockInLat: numeric("clock_in_lat", { precision: 9, scale: 6 }),
    clockInLng: numeric("clock_in_lng", { precision: 9, scale: 6 }),
    clockOutLat: numeric("clock_out_lat", { precision: 9, scale: 6 }),
    clockOutLng: numeric("clock_out_lng", { precision: 9, scale: 6 }),
    /** Set when a clock-in/out location falls outside the job's geofence radius. Never blocks — flags for review only. */
    geofenceFlagged: boolean("geofence_flagged").notNull().default(false),
    /** Phase 77: id of the offline outbox op that created the row (worker page or dashboard) — a replay finds the entry instead of inserting twice. */
    clientRef: text("client_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("time_entries_project_idx").on(t.projectId, t.date),
    index("time_entries_worker_idx").on(t.workerId, t.date),
    index("time_entries_user_status_idx").on(t.userId, t.status),
    uniqueIndex("time_entries_client_ref_idx").on(t.workerId, t.clientRef).where(sql`client_ref is not null`),
  ],
);

// ── Equipment ────────────────────────────────────────────────────────────────
// Company-level register. Loan payments are overhead; jobs are charged a
// usage rate per hour/day so margins stay honest.

export const EQUIPMENT_OWNERSHIP = ["owned", "rented", "financed"] as const;
export type EquipmentOwnership = (typeof EQUIPMENT_OWNERSHIP)[number];
export const USAGE_UNITS = ["hour", "day"] as const;
export type UsageUnit = (typeof USAGE_UNITS)[number];

export type EquipmentFinancing = { lender?: string; monthlyPaymentCents?: number; remainingMonths?: number };

export const equipmentTable = pgTable(
  "equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    ownership: text("ownership", { enum: EQUIPMENT_OWNERSHIP }).notNull().default("owned"),
    purchaseCents: integer("purchase_cents").notNull().default(0),
    financing: jsonb("financing").$type<EquipmentFinancing>().notNull().default({}),
    usageRateCents: integer("usage_rate_cents").notNull().default(0),
    usageUnit: text("usage_unit", { enum: USAGE_UNITS }).notNull().default("day"),
    notes: text("notes").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("equipment_user_idx").on(t.userId, t.active)],
);

export const equipmentUsageTable = pgTable(
  "equipment_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    equipmentId: uuid("equipment_id").notNull().references(() => equipmentTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    quantity: numeric("quantity", { precision: 8, scale: 2 }).notNull(),
    unit: text("unit", { enum: USAGE_UNITS }).notNull().default("day"),
    rateCentsSnapshot: integer("rate_cents_snapshot").notNull().default(0),
    note: text("note").notNull().default(""),
    costEntryId: uuid("cost_entry_id").references(() => costEntriesTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("equipment_usage_project_idx").on(t.projectId, t.date)],
);

export type CostEntry = typeof costEntriesTable.$inferSelect;
export type TimeEntry = typeof timeEntriesTable.$inferSelect;
export type Equipment = typeof equipmentTable.$inferSelect;
export type EquipmentUsage = typeof equipmentUsageTable.$inferSelect;

/** Labour cost of a time entry in cents: hours × rate × (1 + burden %). */
export function labourCostCents(hours: number, rateCents: number, burdenPercent: number): number {
  return Math.round(hours * rateCents * (1 + burdenPercent / 100));
}
