// Fetch client for Phase 7 team accounts: member management, the public
// invite accept flow, and the org switcher.
import { apiRequest as req, apiJson as json } from "./jobs-api";

export type TeamMemberRole = "admin" | "office" | "foreman" | "viewer";
export type TeamMemberStatus = "invited" | "active" | "suspended";

export type TeamMemberDto = {
  id: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitedAt: string;
  joinedAt: string | null;
  inviteExpiresAt: string | null;
};

export type OrgDto = { orgId: string; companyName: string; role: "owner" | TeamMemberRole; isOwn: boolean };

export const teamMembersApi = {
  list: () => req<{ items: TeamMemberDto[]; seats: { used: number; included: number } }>("/api/team/members"),
  invite: (email: string, role: TeamMemberRole, send = true) => req<{ url: string; expiresAt: string; emailed: boolean }>("/api/team/members/invite", { method: "POST", body: json({ email, role, send }) }),
  resend: (id: string) => req<{ url: string; expiresAt: string; emailed: boolean }>(`/api/team/members/${id}/resend`, { method: "POST" }),
  update: (id: string, body: { role?: TeamMemberRole; status?: "active" | "suspended" }) => req<{ member: TeamMemberDto }>(`/api/team/members/${id}`, { method: "PUT", body: json(body) }),
  remove: (id: string) => req<{ success: true }>(`/api/team/members/${id}`, { method: "DELETE" }),

  orgs: () => req<{ items: OrgDto[]; activeOrgId: string }>("/api/team/orgs"),
  switchOrg: (orgId: string) => req<{ orgId: string; role: string }>("/api/team/switch", { method: "POST", body: json({ orgId }) }),
};

export type InvitePreviewDto = { companyName: string; email: string; role: TeamMemberRole };

export const teamInviteApi = {
  preview: (token: string) => req<InvitePreviewDto>(`/api/team/invite/${token}`),
  accept: (token: string) => req<{ member: TeamMemberDto }>(`/api/team/invite/${token}/accept`, { method: "POST" }),
};
