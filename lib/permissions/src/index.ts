// Phase 80: the Phase 7 permission matrix (docs/GROWTH-PLATFORM-PLAN.md §3.2),
// shared by the API (requirePermission) and the dashboard (useCan) so a button
// the server would answer with 403 is hidden or disabled instead of shown.
// A starting point, not a spec — refine per-role behaviour as real usage
// surfaces gaps. Owner/admin always pass; the matrix only exists to hold back
// office/foreman/viewer from actions their role shouldn't reach.

export const TEAM_MEMBER_ROLES = ["owner", "admin", "office", "foreman", "viewer"] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

export type PermissionArea = "quotes" | "contracts" | "jobs" | "costs" | "invoicing" | "team" | "analytics" | "settings" | "leads" | "integrations" | "security" | "imports";
export type PermissionAction = "view" | "edit" | "full";

const RANK: Record<PermissionAction, number> = { view: 0, edit: 1, full: 2 };

export const PERMISSION_MATRIX: Record<TeamMemberRole, Record<PermissionArea, PermissionAction>> = {
  owner: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "full", leads: "full", integrations: "full", security: "full", imports: "full" },
  admin: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "view", leads: "full", integrations: "view", security: "view", imports: "full" },
  office: { quotes: "full", contracts: "edit", jobs: "full", costs: "full", invoicing: "full", team: "view", analytics: "view", settings: "view", leads: "full", integrations: "view", security: "view", imports: "edit" },
  foreman: { quotes: "view", contracts: "view", jobs: "edit", costs: "edit", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view" },
  viewer: { quotes: "view", contracts: "view", jobs: "view", costs: "view", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view" },
};

export function roleCan(role: TeamMemberRole, area: PermissionArea, action: PermissionAction): boolean {
  return RANK[PERMISSION_MATRIX[role][area]] >= RANK[action];
}
