import { pgTable, text, timestamp, jsonb, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Phase 7: team accounts ────────────────────────────────────────────────
// "Organization" is not a new first-class table — the owner's existing
// business_profiles.userId doubles as the org id (see docs/GROWTH-PLATFORM-PLAN.md
// §3). This table just maps other auth_user rows onto that owner id with a
// role, so every existing userId-keyed table and query stays untouched.

export const TEAM_MEMBER_ROLES = ["owner", "admin", "office", "foreman", "viewer"] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

export const TEAM_MEMBER_STATUSES = ["invited", "active", "suspended"] as const;
export type TeamMemberStatus = (typeof TEAM_MEMBER_STATUSES)[number];

export const organizationMembersTable = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** business_profiles.userId — the "org" this membership grants access to. */
    ownerId: text("owner_id").notNull(),
    /** auth_user.id of the invitee, once they accept. Null while only invited. */
    userId: text("user_id"),
    role: text("role").$type<TeamMemberRole>().notNull().default("viewer"),
    status: text("status").$type<TeamMemberStatus>().notNull().default("invited"),
    invitedEmail: text("invited_email").notNull(),
    invitedByUserId: text("invited_by_user_id").notNull(),
    inviteTokenHash: text("invite_token_hash"),
    inviteTokenExpiresAt: timestamp("invite_token_expires_at", { withTimezone: true }),
    /** Rare per-member exceptions to the role's default permission matrix. */
    permissions: jsonb("permissions").$type<Record<string, boolean>>().notNull().default({}),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("organization_members_owner_id_idx").on(table.ownerId),
    index("organization_members_user_id_idx").on(table.userId),
    uniqueIndex("organization_members_owner_email_idx").on(table.ownerId, table.invitedEmail),
  ],
);

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
