import type { Request, Response, NextFunction } from "express";
import { applyRestriction } from "../roles/enforce.js";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { db, businessProfilesTable, organizationMembersTable, type TeamMemberRole } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { runWithActor } from "../lib/requestContext.js";

declare global {
  namespace Express {
    interface Locals {
      /** The acting org id — an owner's own userId, or the org they're an active member of. Every existing tenant-scoped query keys off this. */
      userId: string;
      /** The real logged-in person, regardless of which org they're acting as. Use for audit trails and permission checks. */
      actorUserId: string;
      /** The actor's role within the acting org ("owner" when acting as themselves). */
      actorRole: TeamMemberRole;
      userEmail: string;
      userName: string;
    }
  }
}

/** Cookie holding the acting org id across requests, so switching orgs doesn't require re-login. */
export const ACTIVE_ORG_COOKIE = "qai_active_org";
/**
 * Phase 118: the phone app signs in with a bearer token and sends no cookies,
 * so it carries the acting org in this header instead. Every answer that sets
 * or clears the cookie also sets this header (empty = cleared) for the app to
 * keep. Either way the membership is checked in resolveActingOrg.
 */
export const ACTIVE_ORG_HEADER = "x-active-org";

function readCookie(req: { headers: { cookie?: string } }, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Resolves which org a logged-in person is acting as. Order of precedence:
 * 1. An explicit active-org cookie, if the actor has an active membership there.
 * 2. Their own business profile (they're an owner) — the default/most common case.
 * 3. Their oldest active membership, if they don't own a profile themselves.
 * 4. Fall back to their own id (brand-new signup, no profile row yet).
 */
export async function resolveActingOrg(actorId: string, cookieOrgId: string | null): Promise<{ orgId: string; role: TeamMemberRole }> {
  if (cookieOrgId && cookieOrgId !== actorId) {
    const [membership] = await db
      .select()
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.ownerId, cookieOrgId), eq(organizationMembersTable.status, "active")));
    if (membership) return { orgId: cookieOrgId, role: membership.role };
  }

  const [profile] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, actorId));
  if (profile) return { orgId: actorId, role: "owner" };

  const [membership] = await db
    .select()
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.status, "active")))
    .orderBy(asc(organizationMembersTable.joinedAt))
    .limit(1);
  if (membership) return { orgId: membership.ownerId, role: membership.role };

  return { orgId: actorId, role: "owner" };
}

export async function requireAuth<P = Record<string, string>>(req: Request<P>, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const cookieOrgId = readCookie(req, ACTIVE_ORG_COOKIE) ?? (typeof req.headers[ACTIVE_ORG_HEADER] === "string" ? (req.headers[ACTIVE_ORG_HEADER] as string) || null : null);
    const { orgId, role } = await resolveActingOrg(session.user.id, cookieOrgId);
    res.locals.userId = orgId;
    res.locals.actorUserId = session.user.id;
    res.locals.actorRole = role;
    res.locals.userEmail = session.user.email;
    res.locals.userName = session.user.name;
    await applyRestriction(res, orgId, session.user.id, role);
    // Phase 91: the rest of the request knows who is acting (created_by, audit rows).
    runWithActor({ actorUserId: session.user.id, orgId }, () => next());
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function getUserId(res: Response): string {
  return res.locals.userId;
}
export function getActorUserId(res: Response): string {
  return res.locals.actorUserId;
}
export function getActorRole(res: Response): TeamMemberRole {
  return res.locals.actorRole;
}
export function getUserEmail(res: Response): string {
  return res.locals.userEmail ?? "";
}
export function getUserName(res: Response): string {
  return res.locals.userName ?? "";
}
