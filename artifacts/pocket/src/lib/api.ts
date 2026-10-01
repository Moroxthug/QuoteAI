// Calls the generated hooks don't cover (invitations, companies, access codes, the setup answers).
// The app's wrapped fetch (lib/session.ts) adds the token and the acting company.
import { API_ORIGIN } from "./session";

export class ApiFailure extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
  }
  /** No signal: the request never reached the server. */
  get offline(): boolean {
    return this.status === 0;
  }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}${path}`, {
      method: init?.method ?? "GET",
      headers: { accept: "application/json", ...(init?.body !== undefined ? { "content-type": "application/json" } : null) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiFailure(0, undefined, "offline");
  }
  const text = await res.text();
  let body: { code?: string; error?: string; message?: string } = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
  if (!res.ok) throw new ApiFailure(res.status, body.code ?? body.error, body.message ?? body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export type TeamRole = "admin" | "office" | "foreman" | "viewer" | "accountant";
export type OrgDto = { orgId: string; companyName: string; role: "owner" | TeamRole; isOwn: boolean };
export type PendingInviteDto = { id: string; companyName: string; role: TeamRole; logoUrl: string | null };
export type CodePreviewDto = { code: string; companyName: string; role: TeamRole; logoUrl: string | null };

export const team = {
  orgs: () => api<{ items: OrgDto[]; activeOrgId: string }>("/api/team/orgs"),
  switchOrg: (orgId: string) => api<{ orgId: string; role: string }>("/api/team/switch", { method: "POST", body: { orgId } }),
  pendingInvites: () => api<{ items: PendingInviteDto[] }>("/api/team/pending-invites"),
  acceptInvite: (id: string) => api<unknown>(`/api/team/pending-invites/${encodeURIComponent(id)}/accept`, { method: "POST" }),
  previewCode: (code: string) => api<CodePreviewDto>(`/api/team/code/${encodeURIComponent(code)}`),
  redeemCode: (code: string) => api<{ orgId: string; role: TeamRole }>(`/api/team/code/${encodeURIComponent(code)}/redeem`, { method: "POST" }),
};
