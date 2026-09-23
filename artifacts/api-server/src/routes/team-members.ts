import { Router } from "express";
import { z } from "zod";
import {
  db,
  businessProfilesTable,
  organizationMembersTable,
  companyGroupMembersTable,
  hasFeature,
  minimumPlanFor,
  effectivePlan,
  seatsIncluded,
  TEAM_MEMBER_ROLES,
  type TeamMemberRole,
} from "@workspace/db";
import { and, asc, eq, ne } from "drizzle-orm";
import { requireAuth, getUserId, getUserEmail, getActorUserId, ACTIVE_ORG_COOKIE, resolveActingOrg } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { hashToken, newRawToken } from "../contracts/service.js";
import { sendTeamMemberInviteEmail } from "../lib/emailTeam.js";
import { logger } from "../lib/logger.js";
import { ipRateLimiter } from "../lib/rateLimit.js";

// ── Phase 7: team accounts — invite/accept, role management, org switcher ──
// "Organization" = the owner's own business_profiles.userId; members are
// other auth_user rows granted access via organization_members. The owner
// itself never appears as a row in this table.

const router = Router();
const INVITE_LINK_DAYS = 7;
const ORG_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // ~400 days, matches common cookie caps

const INVITABLE_ROLES = TEAM_MEMBER_ROLES.filter((r) => r !== "owner") as Exclude<TeamMemberRole, "owner">[];

function cookieOpts(): { httpOnly: true; sameSite: "lax"; secure: boolean; path: "/"; maxAge: number } {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ORG_COOKIE_MAX_AGE_MS };
}

function serializeMember(m: typeof organizationMembersTable.$inferSelect) {
  return {
    id: m.id,
    email: m.invitedEmail,
    role: m.role,
    status: m.status,
    invitedAt: m.invitedAt.toISOString(),
    joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    inviteExpiresAt: m.inviteTokenExpiresAt ? m.inviteTokenExpiresAt.toISOString() : null,
  };
}

async function loadProfile(userId: string) {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return profile;
}

// GET /api/team/members — everyone in the org can see who else has access
router.get("/team/members", requireAuth, requirePermission("team", "view"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const members = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.ownerId, orgId)).orderBy(asc(organizationMembersTable.invitedAt));
    const profile = await loadProfile(orgId);
    const plan = effectivePlan(profile);
    res.json({
      items: members.map(serializeMember),
      seats: { used: members.filter((m) => m.status !== "suspended").length + 1, included: seatsIncluded(plan) },
    });
  } catch (err) {
    req.log.error({ err }, "Error listing team members");
    res.status(500).json({ error: "Internal server error" });
  }
});

const InviteBody = z.object({
  email: z.string().email().max(200),
  role: z.enum(INVITABLE_ROLES as [Exclude<TeamMemberRole, "owner">, ...Exclude<TeamMemberRole, "owner">[]]),
  send: z.boolean().optional(),
});

// POST /api/team/members/invite
router.post("/team/members/invite", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const body = InviteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const profile = await loadProfile(orgId);
    if (!hasFeature(profile, "team_accounts")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("team_accounts"), message: "Team accounts require the Pro plan" });
      return;
    }
    const email = body.data.email.toLowerCase().trim();

    const existingActive = await db
      .select({ n: organizationMembersTable.id })
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.ownerId, orgId), ne(organizationMembersTable.status, "suspended")));
    const [existingRow] = await db
      .select()
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.invitedEmail, email)));
    if (existingRow?.status === "active") {
      res.status(409).json({ error: "ALREADY_MEMBER", message: "This person already has access." });
      return;
    }

    const plan = effectivePlan(profile);
    const seatsUsed = existingActive.length + 1; // +1 for the owner
    const willAddSeat = !existingRow; // reissuing an invite/suspended row doesn't add a new seat
    if (willAddSeat && seatsUsed >= seatsIncluded(plan)) {
      res.status(403).json({ error: "SEAT_LIMIT", message: `Your plan includes ${seatsIncluded(plan)} seat(s). Upgrade or remove a member to invite someone new.`, seatsIncluded: seatsIncluded(plan) });
      return;
    }

    const raw = newRawToken();
    const expiresAt = new Date(Date.now() + INVITE_LINK_DAYS * 86_400_000);
    let memberId: string;
    if (existingRow) {
      const [updated] = await db
        .update(organizationMembersTable)
        .set({ role: body.data.role, status: "invited", inviteTokenHash: hashToken(raw), inviteTokenExpiresAt: expiresAt, invitedByUserId: actorId, joinedAt: null, userId: null })
        .where(eq(organizationMembersTable.id, existingRow.id))
        .returning();
      memberId = updated!.id;
    } else {
      const [created] = await db
        .insert(organizationMembersTable)
        .values({ ownerId: orgId, invitedEmail: email, role: body.data.role, status: "invited", invitedByUserId: actorId, inviteTokenHash: hashToken(raw), inviteTokenExpiresAt: expiresAt })
        .returning();
      memberId = created!.id;
    }

    const url = `${getBaseUrl()}/team-invite/${raw}`;
    let emailed = false;
    if (body.data.send !== false) {
      try {
        await sendTeamMemberInviteEmail({ toEmail: email, companyName: profile?.companyName || "your contractor", inviterName: getUserEmail(res) || "a teammate", role: body.data.role, url, language: profile?.province === "QC" ? "fr" : "en" });
        emailed = true;
      } catch (err) {
        logger.warn({ err, email }, "Team invite email failed; link returned to the dashboard");
      }
    }
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: memberId, action: "invite_issued", diff: { email, role: body.data.role, emailed } });
    res.status(201).json({ url, expiresAt: expiresAt.toISOString(), emailed });
  } catch (err) {
    req.log.error({ err }, "Error inviting team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/members/:id/resend
router.post("/team/members/:id/resend", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const [member] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.id, req.params.id as string), eq(organizationMembersTable.ownerId, orgId)));
    if (!member || member.status === "active") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const profile = await loadProfile(orgId);
    const raw = newRawToken();
    const expiresAt = new Date(Date.now() + INVITE_LINK_DAYS * 86_400_000);
    await db.update(organizationMembersTable).set({ status: "invited", inviteTokenHash: hashToken(raw), inviteTokenExpiresAt: expiresAt }).where(eq(organizationMembersTable.id, member.id));
    const url = `${getBaseUrl()}/team-invite/${raw}`;
    let emailed = false;
    try {
      await sendTeamMemberInviteEmail({ toEmail: member.invitedEmail, companyName: profile?.companyName || "your contractor", inviterName: getUserEmail(res) || "a teammate", role: member.role, url, language: profile?.province === "QC" ? "fr" : "en" });
      emailed = true;
    } catch (err) {
      logger.warn({ err, memberId: member.id }, "Team invite resend failed; link returned to the dashboard");
    }
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "invite_reissued", diff: { emailed } });
    res.json({ url, expiresAt: expiresAt.toISOString(), emailed });
  } catch (err) {
    req.log.error({ err }, "Error resending team invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

const UpdateMemberBody = z.object({
  role: z.enum(INVITABLE_ROLES as [Exclude<TeamMemberRole, "owner">, ...Exclude<TeamMemberRole, "owner">[]]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

// PUT /api/team/members/:id — change role, suspend/reactivate
router.put("/team/members/:id", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const [member] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.id, req.params.id as string), eq(organizationMembersTable.ownerId, orgId)));
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = UpdateMemberBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    if (body.data.status === "active" && member.status !== "active") {
      res.status(409).json({ error: "NOT_JOINED", message: "This person hasn't accepted their invite yet." });
      return;
    }
    const updates: Partial<typeof organizationMembersTable.$inferInsert> = {};
    if (body.data.role !== undefined) updates.role = body.data.role;
    if (body.data.status !== undefined) updates.status = body.data.status;
    const [updated] = await db.update(organizationMembersTable).set(updates).where(eq(organizationMembersTable.id, member.id)).returning();
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "updated", diff: updates });
    res.json({ member: serializeMember(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error updating team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/team/members/:id — revoke an invite or remove an active member
router.delete("/team/members/:id", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const [member] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.id, req.params.id as string), eq(organizationMembersTable.ownerId, orgId)));
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(organizationMembersTable).where(eq(organizationMembersTable.id, member.id));
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "removed", diff: { email: member.invitedEmail } });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error removing team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public invite lookup + accept ───────────────────────────────────────────

// Token-guessing budget for the unauthenticated invite preview (Phase 62) — same shape as the other public token routes.
const invitePreviewLimiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Too many requests" });

// GET /api/team/invite/:token — no auth required, just previews the invite
router.get("/team/invite/:token", invitePreviewLimiter, async (req, res) => {
  try {
    const tokenHash = hashToken(req.params.token as string);
    const [member] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.inviteTokenHash, tokenHash));
    if (!member) {
      res.status(404).json({ error: "NOT_FOUND", message: "This invite link is invalid." });
      return;
    }
    if (member.status === "active") {
      res.status(409).json({ error: "ALREADY_ACCEPTED", message: "This invite has already been accepted." });
      return;
    }
    if (!member.inviteTokenExpiresAt || member.inviteTokenExpiresAt.getTime() < Date.now()) {
      res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Ask for a new one." });
      return;
    }
    const profile = await loadProfile(member.ownerId);
    res.json({ companyName: profile?.companyName || "", email: member.invitedEmail, role: member.role });
  } catch (err) {
    req.log.error({ err }, "Error looking up team invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/invite/:token/accept — the invitee must be logged in already (sign up/sign in first)
router.post("/team/invite/:token/accept", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const tokenHash = hashToken(req.params.token as string);
    const [member] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.inviteTokenHash, tokenHash));
    if (!member) {
      res.status(404).json({ error: "NOT_FOUND", message: "This invite link is invalid." });
      return;
    }
    if (member.status === "active") {
      res.status(409).json({ error: "ALREADY_ACCEPTED", message: "This invite has already been accepted." });
      return;
    }
    if (!member.inviteTokenExpiresAt || member.inviteTokenExpiresAt.getTime() < Date.now()) {
      res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Ask for a new one." });
      return;
    }
    const actorEmail = (res.locals.userEmail ?? "").toLowerCase().trim();
    if (actorEmail && actorEmail !== member.invitedEmail) {
      res.status(403).json({ error: "EMAIL_MISMATCH", message: `This invite was sent to ${member.invitedEmail}. Sign in with that email to accept it.` });
      return;
    }
    const [updated] = await db
      .update(organizationMembersTable)
      .set({ status: "active", userId: actorId, joinedAt: new Date(), inviteTokenHash: null, inviteTokenExpiresAt: null })
      .where(eq(organizationMembersTable.id, member.id))
      .returning();
    await writeAudit({ userId: member.ownerId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "invite_accepted" });
    res.cookie(ACTIVE_ORG_COOKIE, member.ownerId, cookieOpts());
    res.json({ member: serializeMember(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error accepting team invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Org switcher ─────────────────────────────────────────────────────────────

// GET /api/team/orgs — every org this person can act as: their own (if they own one) + active memberships
router.get("/team/orgs", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const currentOrgId = getUserId(res);
    const orgs: { orgId: string; companyName: string; role: TeamMemberRole; isOwn: boolean }[] = [];
    const ownProfile = await loadProfile(actorId);
    if (ownProfile) orgs.push({ orgId: actorId, companyName: ownProfile.companyName || "My company", role: "owner", isOwn: true });
    const memberships = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.status, "active"), ne(organizationMembersTable.ownerId, actorId)));
    for (const m of memberships) {
      const p = await loadProfile(m.ownerId);
      orgs.push({ orgId: m.ownerId, companyName: p?.companyName || "Company", role: m.role, isOwn: false });
    }
    // Phase 90: whether the acting company is in a group (or invited into one) — the sidebar shows Group when it is.
    const [grouped] = await db.select({ status: companyGroupMembersTable.status }).from(companyGroupMembersTable).where(eq(companyGroupMembersTable.userId, currentOrgId));
    res.json({ items: orgs, activeOrgId: currentOrgId, group: grouped ? { status: grouped.status } : null });
  } catch (err) {
    req.log.error({ err }, "Error listing orgs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/switch — { orgId } — set the active org cookie
router.post("/team/switch", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const body = z.object({ orgId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const { orgId, role } = await resolveActingOrg(actorId, body.data.orgId);
    if (orgId !== body.data.orgId) {
      res.status(403).json({ error: "FORBIDDEN", message: "You don't have access to that organization." });
      return;
    }
    res.cookie(ACTIVE_ORG_COOKIE, orgId, cookieOpts());
    res.json({ orgId, role });
  } catch (err) {
    req.log.error({ err }, "Error switching org");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/members/leave — { orgId } — Phase 72: a member removes
// themself from a company they were invited to (the owner-only DELETE above
// is for removing others). Clears the active-org cookie if it pointed there.
router.post("/team/members/leave", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const body = z.object({ orgId: z.string().min(1) }).safeParse(req.body);
    if (!body.success || body.data.orgId === actorId) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const [member] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, body.data.orgId), eq(organizationMembersTable.userId, actorId)));
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(organizationMembersTable).where(eq(organizationMembersTable.id, member.id));
    await writeAudit({ userId: body.data.orgId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "left", diff: { email: member.invitedEmail } });
    if (getUserId(res) === body.data.orgId) res.clearCookie(ACTIVE_ORG_COOKIE, cookieOpts());
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error leaving team");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
