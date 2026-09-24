// Fetch client for Phase 7 team accounts: member management, the public
// invite accept flow, and the org switcher.
import { apiRequest as req, apiJson as json } from "./jobs-api";

export type TeamMemberRole = "admin" | "office" | "foreman" | "viewer";
export type PendingInviteDto = { id: string; companyName: string; role: TeamMemberRole; logoUrl: string | null };
export type TeamMemberStatus = "invited" | "active" | "suspended";

export type TeamMemberDto = {
  id: string;
  /** Phase 91: the person once joined (null while only invited). */
  userId: string | null;
  /** Null for an access code nobody has used yet. */
  email: string | null;
  kind: "email" | "code";
  /** The code's last four characters, to tell codes apart. */
  codeHint: string | null;
  name: string | null;
  image: string | null;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitedAt: string;
  joinedAt: string | null;
  inviteExpiresAt: string | null;
};

export type OrgDto = { orgId: string; companyName: string; role: "owner" | TeamMemberRole; isOwn: boolean };

export const teamMembersApi = {
  list: () => req<{ items: TeamMemberDto[]; seats: { used: number; limit: number; included: number; extra: number } }>("/api/team/members"),
  invite: (email: string, role: TeamMemberRole, send = true) => req<{ url: string; expiresAt: string; emailed: boolean }>("/api/team/members/invite", { method: "POST", body: json({ email, role, send }) }),
  resend: (id: string) => req<{ url: string; expiresAt: string; emailed: boolean }>(`/api/team/members/${id}/resend`, { method: "POST" }),
  update: (id: string, body: { role?: TeamMemberRole; status?: "active" | "suspended" }) => req<{ member: TeamMemberDto }>(`/api/team/members/${id}`, { method: "PUT", body: json(body) }),
  remove: (id: string) => req<{ success: true }>(`/api/team/members/${id}`, { method: "DELETE" }),

  orgs: () => req<{ items: OrgDto[]; activeOrgId: string; group: { status: "pending" | "active" } | null }>("/api/team/orgs"),
  /** Phase 93: invitations sent to the signed-in address (accepted without the emailed link). */
  pendingInvites: () => req<{ items: PendingInviteDto[] }>("/api/team/pending-invites"),
  acceptPendingInvite: (id: string) => req<unknown>(`/api/team/pending-invites/${encodeURIComponent(id)}/accept`, { method: "POST" }),
  switchOrg: (orgId: string) => req<{ orgId: string; role: string }>("/api/team/switch", { method: "POST", body: json({ orgId }) }),
  /** Phase 72: remove yourself from a company you were invited to. */
  leave: (orgId: string) => req<{ success: true }>("/api/team/members/leave", { method: "POST", body: json({ orgId }) }),
};

export type InvitePreviewDto = { companyName: string; email: string; role: TeamMemberRole };

export const teamInviteApi = {
  preview: (token: string) => req<InvitePreviewDto>(`/api/team/invite/${token}`),
  accept: (token: string) => req<{ member: TeamMemberDto }>(`/api/team/invite/${token}/accept`, { method: "POST" }),
};
