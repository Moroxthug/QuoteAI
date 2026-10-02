import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, businessProfilesTable, memberJobRolesTable, effectivePlan, type SensitiveKey } from "@workspace/db";
import { defaultJobRole, effectiveSensitive, isJobRole, roleHomesIncluded, type Access } from "./rules.js";

// Pocket 128.7: the four sensitive switches (Settings → Roles) are enforced here. A person is restricted only when the plan includes role homes AND the owner has given them a job role or an
// exception (a row in member_job_roles); everyone else keeps what their access role has always allowed, so nothing changes for a team that never opened Roles. The owner is never restricted.

export type Switches = Record<SensitiveKey, boolean>;

/** Fields that carry what a worker is paid, and fields that carry a margin or profit: removed from every response for someone whose switch is off. */
export const PAY_KEYS = new Set(["hourlyRate", "hourlyRateCents", "collaboratorHourlyRate", "rateCentsSnapshot", "burdenPercent", "burdenPercentSnapshot", "payRate", "payRateCents"]);
export const MARGIN_KEYS = new Set(["margin", "marginCents", "marginPercent", "marginPct", "profit", "profitCents", "grossMargin", "grossMarginCents", "grossMarginPercent"]);

export function scrub<T>(value: T, flags: Pick<Switches, "payRates" | "margins">): T {
  if (Array.isArray(value)) return value.map((v) => scrub(v, flags)) as unknown as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!flags.payRates && PAY_KEYS.has(k)) continue;
      if (!flags.margins && MARGIN_KEYS.has(k)) continue;
      out[k] = scrub(v, flags);
    }
    return out as T;
  }
  return value;
}

const cache = new Map<string, { at: number; value: Switches | null }>();
const TTL = 10_000;
export const forgetRestriction = (orgId: string, actorId: string) => cache.delete(`${orgId}:${actorId}`);

/** The switches that apply to this person, or null when nothing restricts them. */
export async function restrictionFor(orgId: string, actorId: string, access: Access): Promise<Switches | null> {
  if (access === "owner" || orgId === actorId) return null;
  const key = `${orgId}:${actorId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const [[row], [profile]] = await Promise.all([
    db.select().from(memberJobRolesTable).where(and(eq(memberJobRolesTable.orgId, orgId), eq(memberJobRolesTable.memberUserId, actorId))),
    db.select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus, featureFlags: businessProfilesTable.featureFlags }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId)),
  ]);
  let value: Switches | null = null;
  if (row && profile && roleHomesIncluded(effectivePlan(profile as never))) {
    const role = row.jobRole && isJobRole(row.jobRole) ? row.jobRole : defaultJobRole(access);
    value = effectiveSensitive(role, row.sensitive ?? {}, false);
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Called once the actor is known: hides pay rates and margins from the JSON this request sends when the person's switches say so, and remembers them for requireSensitive. */
export async function applyRestriction(res: Response, orgId: string, actorId: string, access: Access): Promise<void> {
  const flags = await restrictionFor(orgId, actorId, access);
  res.locals.switches = flags;
  if (!flags || (flags.payRates && flags.margins)) return;
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(scrub(body, flags))) as typeof res.json;
}

/** Stops an action (approve time, send an invoice) for someone whose switch is off. */
export function requireSensitive(key: "approveTime" | "sendInvoices") {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const flags = res.locals.switches as Switches | null | undefined;
    if (flags && !flags[key]) { res.status(403).json({ error: "SENSITIVE_OFF", message: "The owner has turned this off for your role." }); return; }
    next();
  };
}
