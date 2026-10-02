import { Router } from "express";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, authUsersTable, businessProfilesTable, collaboratorsTable, memberJobRolesTable, organizationMembersTable, effectivePlan, JOB_ROLES, SENSITIVE_KEYS, type JobRole, type SensitiveOverrides } from "@workspace/db";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { recordSecurityAuditEvent } from "../lib/auditLog.js";
import { cleanOverrides, defaultJobRole, effectiveSensitive, isJobRole, roleHomesIncluded } from "../roles/rules.js";

const router = Router();

type Own = Partial<Record<JobRole, boolean>>;
const ownHomeOf = (pocket: unknown): Own => {
  const v = (pocket as { roles?: { ownHome?: Own } } | null | undefined)?.roles?.ownHome;
  return v && typeof v === "object" ? v : {};
};
/** A person may reorder their own home unless the owner turned it off for their role (crew have no home to arrange by default). */
const mayChangeHome = (role: JobRole, own: Own): boolean => own[role] ?? role !== "crew";

async function profileOf(orgId: string) {
  const [p] = await db.select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus, featureFlags: businessProfilesTable.featureFlags, pocketSettings: businessProfilesTable.pocketSettings, companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
  return p ?? null;
}

// GET /api/job-roles — Settings → Roles: who has which job role (people who sign in, and the crew), the switches each one has with what differs from the role's start, whether
// people may change their own home, and whether the plan includes role homes.
router.get("/job-roles", requireAuth, requirePermission("team", "view"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const [profile, members, owners, crew, saved] = await Promise.all([
      profileOf(orgId),
      db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.status, "active"))).orderBy(asc(organizationMembersTable.invitedAt)),
      db.select({ id: authUsersTable.id, name: authUsersTable.name, email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, orgId)),
      db.select({ id: collaboratorsTable.id, name: collaboratorsTable.name }).from(collaboratorsTable).where(and(eq(collaboratorsTable.userId, orgId), eq(collaboratorsTable.active, true))).orderBy(asc(collaboratorsTable.name)),
      db.select().from(memberJobRolesTable).where(eq(memberJobRolesTable.orgId, orgId)),
    ]);
    const ids = members.map((m) => m.userId).filter((x): x is string => !!x);
    const users = ids.length ? await db.select({ id: authUsersTable.id, name: authUsersTable.name, email: authUsersTable.email }).from(authUsersTable).where(inArray(authUsersTable.id, ids)) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const mine = new Map(saved.map((r) => [r.memberUserId, r]));
    const people = [
      ...(owners[0] ? [{ id: owners[0].id, name: owners[0].name, email: owners[0].email, access: "owner" as const }] : []),
      ...members.filter((m) => m.userId).map((m) => ({ id: m.userId!, name: byId.get(m.userId!)?.name ?? m.invitedEmail, email: m.invitedEmail, access: m.role })),
    ].map((p) => {
      const row = mine.get(p.id);
      const role: JobRole = row?.jobRole && isJobRole(row.jobRole) ? row.jobRole : defaultJobRole(p.access);
      const overrides = row?.sensitive ?? {};
      return { id: p.id, name: p.name, email: p.email, access: p.access, jobRole: role, assigned: !!row, overrides, sensitive: effectiveSensitive(role, overrides, p.access === "owner") };
    });
    res.json({
      included: roleHomesIncluded(effectivePlan(profile)),
      companyName: profile?.companyName ?? "",
      people,
      crew: crew.map((c) => ({ id: c.id, name: c.name })),
      ownHome: Object.fromEntries(JOB_ROLES.map((r) => [r, mayChangeHome(r, ownHomeOf(profile?.pocketSettings))])),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing job roles");
    res.status(500).json({ error: "Internal server error" });
  }
});

const PersonBody = z.object({
  jobRole: z.enum(JOB_ROLES).optional(),
  sensitive: z.object(Object.fromEntries(SENSITIVE_KEYS.map((k) => [k, z.boolean().optional()])) as Record<(typeof SENSITIVE_KEYS)[number], z.ZodOptional<z.ZodBoolean>>).strict().optional(),
});

// PUT /api/job-roles/members/:userId — give a person a job role and/or set their sensitive switches (what differs from the role's start is kept). The owner's own are fixed.
router.put("/job-roles/members/:userId", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const target = String(req.params.userId ?? "");
    const body = PersonBody.safeParse(req.body ?? {});
    if (!body.success || !target) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const profile = await profileOf(orgId);
    if (!roleHomesIncluded(effectivePlan(profile))) { res.status(403).json({ error: "PLAN_REQUIRED", message: "Role homes are included in Business." }); return; }
    if (target === orgId) { res.status(409).json({ error: "OWNER_FIXED", message: "The owner always has every switch." }); return; }
    const [member] = await db.select({ role: organizationMembersTable.role }).from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.userId, target), eq(organizationMembersTable.status, "active")));
    if (!member) { res.status(404).json({ error: "Not found" }); return; }
    const [row] = await db.select().from(memberJobRolesTable).where(and(eq(memberJobRolesTable.orgId, orgId), eq(memberJobRolesTable.memberUserId, target)));
    const role: JobRole = body.data.jobRole ?? (row?.jobRole && isJobRole(row.jobRole) ? row.jobRole : defaultJobRole(member.role));
    const wanted: SensitiveOverrides = { ...(row?.sensitive ?? {}), ...(body.data.sensitive ?? {}) };
    // Changing the role keeps no old exception that now matches the new role's start.
    const overrides = cleanOverrides(role, role === row?.jobRole || !body.data.jobRole ? wanted : body.data.sensitive ?? {});
    await db.insert(memberJobRolesTable).values({ orgId, memberUserId: target, jobRole: role, sensitive: overrides, updatedBy: getActorUserId(res) })
      .onConflictDoUpdate({ target: [memberJobRolesTable.orgId, memberJobRolesTable.memberUserId], set: { jobRole: role, sensitive: overrides, updatedBy: getActorUserId(res), updatedAt: new Date() } });
    await recordSecurityAuditEvent({ orgId, actorUserId: getActorUserId(res), action: "job_role.changed", entityType: "member", entityId: target });
    res.json({ jobRole: role, overrides, sensitive: effectiveSensitive(role, overrides) });
  } catch (err) {
    req.log.error({ err }, "Error saving a job role");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/job-roles/settings — { ownHome: { estimator: false } }: whether people of a role may hide and reorder their own home.
router.put("/job-roles/settings", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ ownHome: z.record(z.enum(JOB_ROLES), z.boolean()) }).safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const profile = await profileOf(orgId);
    const pocket = { ...((profile?.pocketSettings ?? {}) as Record<string, Record<string, unknown>>) };
    const roles = { ...(pocket.roles ?? {}) } as { ownHome?: Own };
    roles.ownHome = { ...ownHomeOf(pocket), ...body.data.ownHome };
    pocket.roles = roles as Record<string, unknown>;
    await db.update(businessProfilesTable).set({ pocketSettings: pocket }).where(eq(businessProfilesTable.userId, orgId));
    await recordSecurityAuditEvent({ orgId, actorUserId: getActorUserId(res), action: "job_role.settings_changed", entityType: "settings" });
    res.json({ ownHome: Object.fromEntries(JOB_ROLES.map((r) => [r, mayChangeHome(r, roles.ownHome ?? {})])) });
  } catch (err) {
    req.log.error({ err }, "Error saving job role settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/me/job-role — the signed-in person's job role, their switches, whether they may arrange their own home, and whether the plan has role homes (below Business everyone has the
// owner's home).
router.get("/me/job-role", requireAuth, async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actor = getActorUserId(res);
    const access = getActorRole(res);
    const [profile, [row]] = await Promise.all([profileOf(orgId), db.select().from(memberJobRolesTable).where(and(eq(memberJobRolesTable.orgId, orgId), eq(memberJobRolesTable.memberUserId, actor)))]);
    const included = roleHomesIncluded(effectivePlan(profile));
    const role: JobRole = !included ? "owner" : row?.jobRole && isJobRole(row.jobRole) ? row.jobRole : defaultJobRole(access);
    res.json({ included, jobRole: role, access, sensitive: effectiveSensitive(included ? role : "owner", row?.sensitive ?? {}, access === "owner"), mayChangeHome: included ? mayChangeHome(role, ownHomeOf(profile?.pocketSettings)) : false });
  } catch (err) {
    req.log.error({ err }, "Error reading the job role");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
