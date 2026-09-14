import type { Request, Response, NextFunction } from "express";
import type { TeamMemberRole } from "@workspace/db";
import { getActorRole } from "./authMiddleware.js";

// ── Phase 7 permission matrix (docs/GROWTH-PLATFORM-PLAN.md §3.2) ───────────
// A starting point, not a spec — refine per-role behaviour as real usage
// surfaces gaps. Owner/admin always pass; requirePermission only exists to
// hold back office/foreman/viewer from actions their role shouldn't reach.

export type PermissionArea = "quotes" | "contracts" | "jobs" | "costs" | "invoicing" | "team" | "analytics" | "settings" | "leads" | "integrations" | "security" | "imports";
export type PermissionAction = "view" | "edit" | "full";

const RANK: Record<PermissionAction, number> = { view: 0, edit: 1, full: 2 };

const MATRIX: Record<TeamMemberRole, Record<PermissionArea, PermissionAction>> = {
  owner: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "full", leads: "full", integrations: "full", security: "full", imports: "full" },
  admin: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "view", leads: "full", integrations: "view", security: "view", imports: "full" },
  office: { quotes: "full", contracts: "edit", jobs: "full", costs: "full", invoicing: "full", team: "view", analytics: "view", settings: "view", leads: "full", integrations: "view", security: "view", imports: "edit" },
  foreman: { quotes: "view", contracts: "view", jobs: "edit", costs: "edit", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view" },
  viewer: { quotes: "view", contracts: "view", jobs: "view", costs: "view", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view" },
};

export function roleCan(role: TeamMemberRole, area: PermissionArea, action: PermissionAction): boolean {
  return RANK[MATRIX[role][area]] >= RANK[action];
}

/** Wrap after `requireAuth`. Blocks a role that doesn't meet `action` on `area`. */
export function requirePermission(area: PermissionArea, action: PermissionAction) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const role = getActorRole(res);
    if (!roleCan(role, area, action)) {
      res.status(403).json({ error: "FORBIDDEN", message: `Your role (${role}) doesn't have ${action} access to ${area}.` });
      return;
    }
    next();
  };
}
