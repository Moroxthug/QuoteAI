import { pgTable, text, uuid, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── Phase 90: multi-entity ───────────────────────────────────────────────────
// A company is still a business_profiles row keyed by its owner's user id, and
// one login still owns one company. A *group* ties several of those together
// for the four things a person with two numbered companies actually needs:
// a consolidated view, one price catalog, one crew member on both payrolls,
// and one bill. Nothing is merged — every row stays in its own company, each
// company keeps its own books, tax numbers and filings.

export const GROUP_MEMBER_STATUSES = ["pending", "active"] as const;
export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUSES)[number];

export const companyGroupsTable = pgTable(
  "company_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company that created the group and manages it (name, catalog, who is in it). */
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    /** The company whose price catalog the others read (null = no shared catalog). */
    catalogOrgId: text("catalog_org_id"),
    /** The company whose subscription pays for the covered companies (null = everyone pays their own). */
    billingOrgId: text("billing_org_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("company_groups_user_id_idx").on(t.userId)],
);

export const companyGroupMembersTable = pgTable(
  "company_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => companyGroupsTable.id, { onDelete: "cascade" }),
    /** The member company (business_profiles.user_id). A company is in at most one group. */
    userId: text("user_id").notNull(),
    status: text("status", { enum: GROUP_MEMBER_STATUSES }).notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id").notNull(),
    /** Reads the group's catalog alongside its own. The company decides, not the group. */
    useGroupCatalog: boolean("use_group_catalog").notNull().default(true),
    /** Its plan is paid by the group's billing company. */
    covered: boolean("covered").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("company_group_members_user_idx").on(t.userId), index("company_group_members_group_idx").on(t.groupId)],
);

export type CompanyGroup = typeof companyGroupsTable.$inferSelect;
export type CompanyGroupMember = typeof companyGroupMembersTable.$inferSelect;
