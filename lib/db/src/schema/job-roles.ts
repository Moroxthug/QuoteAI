import { pgTable, text, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

// Pocket 128.7 (SetRoles, CustomizeHome, RoleHomes): what each person does in the company (a job role) on top of the access role they sign in with, and the four sensitive
// switches (see pay rates, see margins and costs, approve time, send invoices) where the person differs from their job role's default. The roles themselves (their home sections,
// tabs and defaults) are fixed in code; only who has which role, and the exceptions, are kept here.
export const JOB_ROLES = ["owner", "officeManager", "estimator", "projectManager", "dispatcher", "bookkeeper", "safety", "foreman", "crew"] as const;
export type JobRole = (typeof JOB_ROLES)[number];
export const SENSITIVE_KEYS = ["payRates", "margins", "approveTime", "sendInvoices"] as const;
export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];
export type SensitiveOverrides = Partial<Record<SensitiveKey, boolean>>;

export const memberJobRolesTable = pgTable("member_job_roles", {
  orgId: text("org_id").notNull(),
  memberUserId: text("member_user_id").notNull(),
  jobRole: text("job_role", { enum: JOB_ROLES }).notNull(),
  sensitive: jsonb("sensitive").$type<SensitiveOverrides>().notNull().default({}),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [primaryKey({ columns: [t.orgId, t.memberUserId] })]);
export type MemberJobRole = typeof memberJobRolesTable.$inferSelect;
