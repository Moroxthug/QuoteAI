import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { quotesTable } from "./quotes";
import { clientsTable } from "./clients";

export const PROJECT_STATUSES = ["planning", "active", "suspended", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_SETUP_STATUSES = ["pending_review", "confirmed"] as const;
export type ProjectSetupStatus = (typeof PROJECT_SETUP_STATUSES)[number];

/** How the job setup was proposed; shown on the "review job setup" screen. */
export type ProjectSetupProposal = {
  source: "ai" | "fallback";
  model?: string;
  rationale?: string;
  generatedAt: string;
  /** Working days assumed for the whole job. */
  durationWorkingDays: number;
  /** Expected cost ÷ pre-tax price used to size the cost budget. */
  costRatio: number;
};

export const projectsTable = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  quoteId: uuid("quote_id").references(() => quotesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: PROJECT_STATUSES }).notNull().default("planning"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  budget: integer("budget").notNull().default(0), // in cents — legacy; mirrors contractValueCents for jobs created from a contract
  // ── Phase 2: jobs created from a signed contract ─────────────────────────
  clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  /** Plain uuid (no drizzle FK) to avoid a schema cycle with contracts.ts; the SQL migration adds the FK. */
  contractId: uuid("contract_id"),
  address: text("address").notNull().default(""),
  province: text("province"),
  /** Signed contract value incl. tax (cents), before change orders. */
  contractValueCents: integer("contract_value_cents").notNull().default(0),
  /** Sum of signed change orders incl. tax (cents); can be negative. */
  changeOrdersCents: integer("change_orders_cents").notNull().default(0),
  setupStatus: text("setup_status", { enum: PROJECT_SETUP_STATUSES }).notNull().default("confirmed"),
  setupProposal: jsonb("setup_proposal").$type<ProjectSetupProposal | null>(),
  setupConfirmedAt: timestamp("setup_confirmed_at", { withTimezone: true }),
  plannedStart: timestamp("planned_start", { withTimezone: true }),
  plannedEnd: timestamp("planned_end", { withTimezone: true }),
  progressPercent: integer("progress_percent").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projectTasksTable = pgTable("project_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("todo"), // todo, in_progress, done
  dueDate: timestamp("due_date", { withTimezone: true }),
  /** Phase 2: tasks hang off a milestone (plain uuid; jobs.ts imports this file, so the FK lives in SQL). */
  milestoneId: uuid("milestone_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const collaboratorsTable = pgTable("collaborators", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("collaboratore"), // dipendente, collaboratore
  email: text("email"),
  phone: text("phone"),
  hourlyRate: integer("hourly_rate").notNull().default(0), // in cents
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projectAssignmentsTable = pgTable("project_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  roleInProject: text("role_in_project").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const extraCostsTable = pgTable("extra_costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: integer("amount").notNull().default(0), // in cents
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suppliersTable = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default(""), // materiali, noleggio, consulenza, ecc.
  contactInfo: text("contact_info").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Zod schemas for inserts
export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectTaskSchema = createInsertSchema(projectTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCollaboratorSchema = createInsertSchema(collaboratorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectAssignmentSchema = createInsertSchema(projectAssignmentsTable).omit({ id: true, createdAt: true });
export const insertExtraCostSchema = createInsertSchema(extraCostsTable).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type Project = typeof projectsTable.$inferSelect;
export type ProjectTask = typeof projectTasksTable.$inferSelect;
export type Collaborator = typeof collaboratorsTable.$inferSelect;
export type ProjectAssignment = typeof projectAssignmentsTable.$inferSelect;
export type ExtraCost = typeof extraCostsTable.$inferSelect;
export type Supplier = typeof suppliersTable.$inferSelect;
