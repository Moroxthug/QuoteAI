// Thin fetch client for the Phase 13 security/audit-log endpoint — same
// hand-written pattern as usage-api.ts. Session listing/revocation and 2FA
// go straight through `authClient` (better-auth's own endpoints), not here.

export type AuditLogEventDto = {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(body.message || body.error || `Request failed (${res.status})`);
  return body;
}

export const securityApi = {
  auditLog: () => req<{ events: AuditLogEventDto[] }>("/api/security/audit-log"),
};
