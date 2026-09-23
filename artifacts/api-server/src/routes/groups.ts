import { Router, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, businessProfilesTable, companyGroupsTable, companyGroupMembersTable, collaboratorsTable, organizationMembersTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { roleCan } from "@workspace/permissions";
import { and, eq, inArray, ne } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { createNotification, writeAudit } from "../lib/notifications.js";
import { toIsoDate } from "../jobs/dates.js";
import {
  GroupError,
  activeMembers,
  applyCoverage,
  billingStatus,
  chargeFor,
  groupCrew,
  groupOverview,
  groupStateFor,
  removeFromGroup,
  roleIn,
  setCovered,
  unlinkWorker,
  type GroupState,
} from "../groups/service.js";

// ── Phase 90: company groups ─────────────────────────────────────────────────
// Everything here is decided by the owner of the company it touches: a group
// is created by one company's owner, another company joins only when *its*
// owner accepts, a company paying for another is that paying company's call,
// and each company chooses whether to read the group's catalog.

const router = Router();

async function profileOf(orgId: string) {
  const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
  return p ?? null;
}

function fail(res: Response, err: unknown, log: { error: (o: object, m: string) => void }, what: string) {
  if (err instanceof GroupError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  log.error({ err }, what);
  res.status(500).json({ error: "Internal server error" });
}

async function requireGroupFeature(res: Response): Promise<boolean> {
  const profile = await profileOf(getUserId(res));
  if (hasFeature(profile, "multi_entity")) return true;
  res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("multi_entity"), message: "Company groups require the Elite plan" });
  return false;
}

/** The acting company's group, active — or a 404 the caller returns. */
async function activeState(res: Response): Promise<GroupState | null> {
  const state = await groupStateFor(getUserId(res));
  if (!state || state.self.status !== "active") {
    res.status(404).json({ error: "NO_GROUP", message: "This company is not in a group." });
    return null;
  }
  return state;
}

function isManager(state: GroupState, orgId: string) {
  return state.group.userId === orgId;
}

async function serializeState(state: GroupState | null, actorId: string, orgId: string) {
  if (!state) return null;
  const companies = [];
  for (const m of state.members) {
    const role = await roleIn(actorId, m.userId);
    companies.push({
      orgId: m.userId,
      companyName: m.companyName,
      province: m.province,
      status: m.status,
      covered: m.covered,
      useGroupCatalog: m.useGroupCatalog,
      isManager: m.userId === state.group.userId,
      isBilling: m.userId === state.group.billingOrgId,
      isCatalog: m.userId === state.group.catalogOrgId,
      isCurrent: m.userId === orgId,
      yourRole: role,
    });
  }
  return {
    id: state.group.id,
    name: state.group.name,
    managerOrgId: state.group.userId,
    catalogOrgId: state.group.catalogOrgId,
    billingOrgId: state.group.billingOrgId,
    self: { status: state.self.status, useGroupCatalog: state.self.useGroupCatalog, covered: state.self.covered },
    companies,
  };
}

// GET /api/group — the acting company's group (or an invitation into one), and what the person can do with it.
router.get("/group", requireAuth, async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const role = getActorRole(res);
    const [state, profile] = await Promise.all([groupStateFor(orgId), profileOf(orgId)]);
    const group = await serializeState(state, actorId, orgId);
    // Companies this person could bring in: ones they own or administer, not already in a group.
    let candidates: { orgId: string; companyName: string }[] = [];
    const canManage = roleCan(role, "settings", "full") && (!state || (state.self.status === "active" && isManager(state, orgId)));
    if (canManage) {
      const memberships = await db.select({ ownerId: organizationMembersTable.ownerId, role: organizationMembersTable.role }).from(organizationMembersTable).where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.status, "active"), ne(organizationMembersTable.ownerId, orgId)));
      const ids = [...new Set([...(actorId !== orgId ? [actorId] : []), ...memberships.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.ownerId)])];
      if (ids.length) {
        const taken = new Set((await db.select({ userId: companyGroupMembersTable.userId }).from(companyGroupMembersTable).where(inArray(companyGroupMembersTable.userId, ids))).map((r) => r.userId));
        const profiles = await db.select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(inArray(businessProfilesTable.userId, ids));
        candidates = profiles.filter((p) => !taken.has(p.userId)).map((p) => ({ orgId: p.userId, companyName: p.companyName || "Company" }));
      }
    }
    res.json({
      available: hasFeature(profile, "multi_entity"),
      requiredPlan: minimumPlanFor("multi_entity"),
      canManage,
      canDecide: roleCan(role, "settings", "full"),
      group,
      billing: state?.group.billingOrgId ? await billingStatus(state.group.billingOrgId) : null,
      coveredBy: profile?.planCoveredBy ? { orgId: profile.planCoveredBy, companyName: state?.members.find((m) => m.userId === profile.planCoveredBy)?.companyName ?? null } : null,
      candidates,
    });
  } catch (err) {
    fail(res, err, req.log, "Error loading group");
  }
});

// POST /api/group — { name } — start a group with this company in it.
router.post("/group", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    if (!(await requireGroupFeature(res))) return;
    if (await groupStateFor(orgId)) {
      res.status(409).json({ error: "ALREADY_IN_GROUP", message: "This company is already in a group." });
      return;
    }
    const actorId = getActorUserId(res);
    const group = await db.transaction(async (tx) => {
      const [g] = await tx.insert(companyGroupsTable).values({ userId: orgId, name: body.data.name, createdByUserId: actorId }).returning();
      await tx.insert(companyGroupMembersTable).values({ groupId: g!.id, userId: orgId, status: "active", invitedByUserId: actorId, joinedAt: new Date() });
      return g!;
    });
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "company_group", entityId: group.id, action: "group_created", diff: { name: group.name } });
    res.status(201).json({ group: await serializeState(await groupStateFor(orgId), actorId, orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error creating group");
  }
});

// PUT /api/group — { name?, catalogOrgId? } — the managing company's owner.
router.put("/group", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ name: z.string().trim().min(1).max(120).optional(), catalogOrgId: z.string().min(1).nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const state = await activeState(res);
    if (!state) return;
    if (!isManager(state, orgId)) {
      res.status(403).json({ error: "NOT_MANAGER", message: "Only the company that manages the group can change it." });
      return;
    }
    const patch: Partial<typeof companyGroupsTable.$inferInsert> = {};
    if (body.data.name !== undefined) patch.name = body.data.name;
    if (body.data.catalogOrgId !== undefined) {
      if (body.data.catalogOrgId && !activeMembers(state).some((m) => m.userId === body.data.catalogOrgId)) {
        res.status(400).json({ error: "NOT_IN_GROUP", message: "The catalog has to come from a company in the group." });
        return;
      }
      patch.catalogOrgId = body.data.catalogOrgId;
    }
    if (Object.keys(patch).length) await db.update(companyGroupsTable).set(patch).where(eq(companyGroupsTable.id, state.group.id));
    res.json({ group: await serializeState(await groupStateFor(orgId), getActorUserId(res), orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error updating group");
  }
});

// POST /api/group/companies — { orgId } — invite a company the person owns or administers. Its owner accepts.
router.post("/group/companies", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const body = z.object({ orgId: z.string().min(1) }).safeParse(req.body);
    if (!body.success || body.data.orgId === orgId) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const state = await activeState(res);
    if (!state) return;
    if (!isManager(state, orgId)) {
      res.status(403).json({ error: "NOT_MANAGER", message: "Only the company that manages the group can invite." });
      return;
    }
    const role = await roleIn(actorId, body.data.orgId);
    if (role !== "owner" && role !== "admin") {
      res.status(403).json({ error: "FORBIDDEN", message: "You can only invite a company you own or administer." });
      return;
    }
    const [taken] = await db.select({ id: companyGroupMembersTable.id }).from(companyGroupMembersTable).where(eq(companyGroupMembersTable.userId, body.data.orgId));
    if (taken) {
      res.status(409).json({ error: "ALREADY_IN_GROUP", message: "That company is already in a group." });
      return;
    }
    await db.insert(companyGroupMembersTable).values({ groupId: state.group.id, userId: body.data.orgId, status: "pending", invitedByUserId: actorId });
    await createNotification({ userId: body.data.orgId, type: "group_invite", title: `${state.members.find((m) => m.userId === orgId)?.companyName ?? "A company"} invited this company into the group "${state.group.name}"`, link: "/dashboard/group", entityType: "company_group", entityId: state.group.id });
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "company_group", entityId: state.group.id, action: "group_company_invited", diff: { orgId: body.data.orgId } });
    res.status(201).json({ group: await serializeState(await groupStateFor(orgId), actorId, orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error inviting company to group");
  }
});

// POST /api/group/accept · /api/group/decline — the invited company's owner.
router.post("/group/accept", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const state = await groupStateFor(orgId);
    if (!state || state.self.status !== "pending") {
      res.status(404).json({ error: "NO_INVITATION" });
      return;
    }
    await db.update(companyGroupMembersTable).set({ status: "active", joinedAt: new Date() }).where(eq(companyGroupMembersTable.id, state.self.id));
    await writeAudit({ userId: orgId, actorType: "user", actorId: getActorUserId(res), entityType: "company_group", entityId: state.group.id, action: "group_joined", diff: {} });
    await createNotification({ userId: state.group.userId, type: "group_joined", title: `${state.members.find((m) => m.userId === orgId)?.companyName ?? "A company"} joined "${state.group.name}"`, link: "/dashboard/group", entityType: "company_group", entityId: state.group.id });
    res.json({ group: await serializeState(await groupStateFor(orgId), getActorUserId(res), orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error accepting group invitation");
  }
});

router.post("/group/decline", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const state = await groupStateFor(orgId);
    if (!state || state.self.status !== "pending") {
      res.status(404).json({ error: "NO_INVITATION" });
      return;
    }
    await db.delete(companyGroupMembersTable).where(eq(companyGroupMembersTable.id, state.self.id));
    res.json({ group: null });
  } catch (err) {
    fail(res, err, req.log, "Error declining group invitation");
  }
});

// DELETE /api/group/companies/:orgId — the managing company removes one, or a company leaves.
router.delete("/group/companies/:orgId", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const target = req.params.orgId as string;
    const state = await groupStateFor(orgId);
    if (!state || (state.self.status !== "active" && target !== orgId)) {
      res.status(404).json({ error: "NO_GROUP" });
      return;
    }
    if (target !== orgId && !isManager(state, orgId)) {
      res.status(403).json({ error: "NOT_MANAGER", message: "Only the company that manages the group can remove another company." });
      return;
    }
    if (!state.members.some((m) => m.userId === target)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await removeFromGroup(state, target);
    await writeAudit({ userId: orgId, actorType: "user", actorId: getActorUserId(res), entityType: "company_group", entityId: state.group.id, action: target === orgId ? "group_left" : "group_company_removed", diff: { orgId: target } });
    res.json({ group: await serializeState(await groupStateFor(orgId), getActorUserId(res), orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error removing company from group");
  }
});

// PUT /api/group/me — { useGroupCatalog } — this company's own choice.
router.put("/group/me", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ useGroupCatalog: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const state = await activeState(res);
    if (!state) return;
    await db.update(companyGroupMembersTable).set({ useGroupCatalog: body.data.useGroupCatalog }).where(eq(companyGroupMembersTable.id, state.self.id));
    res.json({ group: await serializeState(await groupStateFor(orgId), getActorUserId(res), orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error updating group preferences");
  }
});

// PUT /api/group/billing — { pays: boolean } — this company pays for the group (or stops).
router.put("/group/billing", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ pays: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const state = await activeState(res);
    if (!state) return;
    const current = state.group.billingOrgId;
    if (body.data.pays) {
      if (current && current !== orgId && activeMembers(state).some((m) => m.covered && m.userId !== current)) {
        res.status(409).json({ error: "BILLING_IN_USE", message: "Another company already pays for companies in this group." });
        return;
      }
      await db.update(companyGroupsTable).set({ billingOrgId: orgId }).where(eq(companyGroupsTable.id, state.group.id));
    } else {
      if (current !== orgId) {
        res.status(403).json({ error: "NOT_BILLING", message: "Only the paying company can stop paying." });
        return;
      }
      if (activeMembers(state).some((m) => m.covered)) await chargeFor(state.group.id, orgId, 0);
      await db.update(companyGroupMembersTable).set({ covered: false }).where(eq(companyGroupMembersTable.groupId, state.group.id));
      await db.update(companyGroupsTable).set({ billingOrgId: null }).where(eq(companyGroupsTable.id, state.group.id));
      await applyCoverage(state.group.id);
    }
    await writeAudit({ userId: orgId, actorType: "user", actorId: getActorUserId(res), entityType: "company_group", entityId: state.group.id, action: body.data.pays ? "group_billing_set" : "group_billing_cleared", diff: {} });
    const next = await groupStateFor(orgId);
    res.json({ group: await serializeState(next, getActorUserId(res), orgId), billing: next?.group.billingOrgId ? await billingStatus(next.group.billingOrgId) : null });
  } catch (err) {
    fail(res, err, req.log, "Error updating group billing");
  }
});

// PUT /api/group/companies/:orgId/coverage — { covered } — the paying company adds or drops a company from its bill.
router.put("/group/companies/:orgId/coverage", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ covered: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const state = await activeState(res);
    if (!state) return;
    if (state.group.billingOrgId !== orgId) {
      res.status(403).json({ error: "NOT_BILLING", message: "Only the paying company can change who it pays for." });
      return;
    }
    await setCovered(state, req.params.orgId as string, body.data.covered);
    await writeAudit({ userId: orgId, actorType: "user", actorId: getActorUserId(res), entityType: "company_group", entityId: state.group.id, action: body.data.covered ? "group_coverage_on" : "group_coverage_off", diff: { orgId: req.params.orgId } });
    const next = await groupStateFor(orgId);
    res.json({ group: await serializeState(next, getActorUserId(res), orgId), billing: await billingStatus(orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error changing group coverage");
  }
});

// GET /api/group/overview?months=6 — the consolidated view.
router.get("/group/overview", requireAuth, requirePermission("analytics", "view"), async (req, res) => {
  try {
    if (!(await requireGroupFeature(res))) return;
    const state = await activeState(res);
    if (!state) return;
    const months = Number.parseInt(String(req.query.months ?? "6"), 10);
    res.json(await groupOverview(getActorUserId(res), state, { months: Number.isFinite(months) ? months : 6 }));
  } catch (err) {
    fail(res, err, req.log, "Error computing group overview");
  }
});

// GET /api/group/crew?day=YYYY-MM-DD — everyone on the group's crews; people on more than one, with this week's hours.
router.get("/group/crew", requireAuth, requirePermission("team", "view"), async (req, res) => {
  try {
    if (!(await requireGroupFeature(res))) return;
    const state = await activeState(res);
    if (!state) return;
    const day = typeof req.query.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day) ? req.query.day : toIsoDate(new Date())!;
    res.json(await groupCrew(getActorUserId(res), state, day));
  } catch (err) {
    fail(res, err, req.log, "Error loading group crew");
  }
});

// POST /api/group/crew/link — { workerIds } — the same person on two or more companies' crews.
router.post("/group/crew/link", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const body = z.object({ workerIds: z.array(z.string().uuid()).min(2).max(6) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    if (!(await requireGroupFeature(res))) return;
    const state = await activeState(res);
    if (!state) return;
    const actorId = getActorUserId(res);
    const workers = await db.select().from(collaboratorsTable).where(inArray(collaboratorsTable.id, [...new Set(body.data.workerIds)]));
    const orgIds = new Set(activeMembers(state).map((m) => m.userId));
    if (workers.length !== new Set(body.data.workerIds).size || workers.some((w) => !orgIds.has(w.userId))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (new Set(workers.map((w) => w.userId)).size !== workers.length) {
      res.status(400).json({ error: "SAME_COMPANY", message: "Link one record per company — these are in the same company." });
      return;
    }
    for (const w of workers) {
      const role = await roleIn(actorId, w.userId);
      if (!role || !roleCan(role, "team", "full")) {
        res.status(403).json({ error: "FORBIDDEN", message: "You need full team access in every company you link." });
        return;
      }
    }
    // One person id for all of them, merging any links they already had.
    const existing = [...new Set(workers.map((w) => w.groupPersonId).filter((x): x is string => !!x))];
    const personId = existing[0] ?? randomUUID();
    if (existing.length > 1) await db.update(collaboratorsTable).set({ groupPersonId: personId }).where(and(inArray(collaboratorsTable.groupPersonId, existing), inArray(collaboratorsTable.userId, [...orgIds])));
    await db.update(collaboratorsTable).set({ groupPersonId: personId }).where(inArray(collaboratorsTable.id, workers.map((w) => w.id)));
    await writeAudit({ userId: getUserId(res), actorType: "user", actorId, entityType: "company_group", entityId: state.group.id, action: "group_crew_linked", diff: { workerIds: workers.map((w) => w.id) } });
    res.json({ personId });
  } catch (err) {
    fail(res, err, req.log, "Error linking crew");
  }
});

// DELETE /api/group/crew/link/:workerId
router.delete("/group/crew/link/:workerId", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const state = await activeState(res);
    if (!state) return;
    const parsed = z.string().uuid().safeParse(req.params.workerId);
    const [worker] = parsed.success ? await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, parsed.data)) : [];
    if (!worker || !activeMembers(state).some((m) => m.userId === worker.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const role = await roleIn(getActorUserId(res), worker.userId);
    if (!role || !roleCan(role, "team", "full")) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    await unlinkWorker(state, worker.id);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, req.log, "Error unlinking crew");
  }
});

export default router;
