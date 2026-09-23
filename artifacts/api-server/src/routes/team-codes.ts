import { Router } from "express";
import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { db, businessProfilesTable, organizationMembersTable, hasFeature, minimumPlanFor, TEAM_MEMBER_ROLES, type TeamMemberRole } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, ACTIVE_ORG_COOKIE } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit, createNotification } from "../lib/notifications.js";
import { hashToken } from "../contracts/service.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { seatCount } from "../team/seats.js";
import { CODE_EMAIL_DOMAIN, cookieOpts } from "./team-members.js";

// ── Phase 91: access codes ───────────────────────────────────────────────────
// The other way into a company: the owner prints or texts a short code, the
// employee types it at /join, creates their own account (or signs in), and
// lands in the company with the role the code carries. A code is an ordinary
// organization_members invitation whose email is a placeholder until it is
// redeemed — so it holds a seat, shows on the team page, and can be revoked
// like any invite. Codes are hashed; the team page only keeps the last four
// characters to tell them apart.

const router = Router();
const CODE_DAYS = 14;
// Crockford base32 without I, L, O, U: nothing to misread on a phone screen.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 10; // 50 bits

const INVITABLE_ROLES = TEAM_MEMBER_ROLES.filter((r) => r !== "owner") as Exclude<TeamMemberRole, "owner">[];

function newCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i]! % 32];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/** What a person typed → the canonical code: case, spaces, dashes and look-alike letters forgiven. */
function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== CODE_LENGTH || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

async function findCode(raw: string) {
  const code = normalizeCode(raw);
  if (!code) return null;
  const [member] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.accessCodeHash, hashToken(code)));
  return member ?? null;
}

// POST /api/team/members/codes — { count, role } — make codes for people to join with.
router.post("/team/members/codes", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const body = z.object({ count: z.number().int().min(1).max(25), role: z.enum(INVITABLE_ROLES as [Exclude<TeamMemberRole, "owner">, ...Exclude<TeamMemberRole, "owner">[]]) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
    if (!hasFeature(profile, "team_accounts")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("team_accounts"), message: "Team accounts require the Pro plan" });
      return;
    }
    const seats = await seatCount(orgId);
    if (seats.used + body.data.count > seats.limit) {
      res.status(403).json({ error: "SEAT_LIMIT", message: `That would need ${seats.used + body.data.count} seats; you have ${seats.limit}.`, seatsIncluded: seats.limit, available: Math.max(0, seats.limit - seats.used) });
      return;
    }
    const expiresAt = new Date(Date.now() + CODE_DAYS * 86_400_000);
    const codes: { id: string; code: string; role: string; expiresAt: string }[] = [];
    for (let i = 0; i < body.data.count; i++) {
      const code = newCode();
      const [row] = await db
        .insert(organizationMembersTable)
        .values({
          ownerId: orgId,
          invitedEmail: `${randomUUID()}${CODE_EMAIL_DOMAIN}`,
          role: body.data.role,
          status: "invited",
          invitedByUserId: actorId,
          accessCodeHash: hashToken(code),
          accessCodeHint: code.slice(-4),
          inviteTokenExpiresAt: expiresAt,
        })
        .returning();
      codes.push({ id: row!.id, code, role: body.data.role, expiresAt: expiresAt.toISOString() });
    }
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: codes[0]!.id, action: "access_codes_issued", diff: { count: codes.length, role: body.data.role } });
    res.status(201).json({ codes, joinUrl: "/join" });
  } catch (err) {
    req.log.error({ err }, "Error creating access codes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Guessing budget: a code is 50 bits, and this is a public lookup.
const codeLimiter = ipRateLimiter({ windowMs: 15 * 60_000, max: 20, message: "Too many attempts. Try again in a few minutes." });

type Lookup = { ok: true; member: typeof organizationMembersTable.$inferSelect } | { ok: false; status: number; error: string; message: string };

async function lookup(raw: string): Promise<Lookup> {
  const member = await findCode(raw);
  if (!member) return { ok: false, status: 404, error: "NOT_FOUND", message: "That code doesn't match any company." };
  if (member.status !== "invited") return { ok: false, status: 409, error: "ALREADY_USED", message: "That code has already been used." };
  if (!member.inviteTokenExpiresAt || member.inviteTokenExpiresAt.getTime() < Date.now()) return { ok: false, status: 410, error: "EXPIRED", message: "That code has expired. Ask for a new one." };
  return { ok: true, member };
}

// GET /api/team/code/:code — public preview: which company and role.
router.get("/team/code/:code", codeLimiter, async (req, res) => {
  try {
    const r = await lookup(req.params.code as string);
    if (!r.ok) {
      res.status(r.status).json({ error: r.error, message: r.message });
      return;
    }
    const [profile] = await db.select({ companyName: businessProfilesTable.companyName, logoUrl: businessProfilesTable.logoUrl }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, r.member.ownerId));
    res.json({ companyName: profile?.companyName || "", logoUrl: profile?.logoUrl ?? null, role: r.member.role, code: normalizeCode(req.params.code as string) });
  } catch (err) {
    req.log.error({ err }, "Error looking up access code");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/code/:code/redeem — signed in: join the company with the code's role.
router.post("/team/code/:code/redeem", codeLimiter, requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const r = await lookup(req.params.code as string);
    if (!r.ok) {
      res.status(r.status).json({ error: r.error, message: r.message });
      return;
    }
    const { member } = r;
    if (member.ownerId === actorId) {
      res.status(409).json({ error: "OWN_COMPANY", message: "This is your own company." });
      return;
    }
    const email = (res.locals.userEmail ?? "").toLowerCase().trim();
    const [already] = await db
      .select()
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.ownerId, member.ownerId), eq(organizationMembersTable.invitedEmail, email), ne(organizationMembersTable.id, member.id)));
    if (already?.status === "active") {
      res.status(409).json({ error: "ALREADY_MEMBER", message: "You already have access to this company." });
      return;
    }
    // The hash stays, so the same code typed again says "already used" rather than "no such code".
    // An open emailed invite for the same person is replaced by this membership (it would otherwise hold a second seat).
    if (already) await db.delete(organizationMembersTable).where(eq(organizationMembersTable.id, already.id));
    await db
      .update(organizationMembersTable)
      .set({ status: "active", userId: actorId, invitedEmail: email || member.invitedEmail, joinedAt: new Date(), inviteTokenExpiresAt: null })
      .where(eq(organizationMembersTable.id, member.id));
    await writeAudit({ userId: member.ownerId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "access_code_redeemed", diff: { hint: member.accessCodeHint } });
    await createNotification({ userId: member.ownerId, type: "team_joined", title: `${res.locals.userName || email} joined with an access code`, link: "/dashboard/team" });
    res.cookie(ACTIVE_ORG_COOKIE, member.ownerId, cookieOpts());
    res.json({ orgId: member.ownerId, role: member.role });
  } catch (err) {
    req.log.error({ err }, "Error redeeming access code");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
