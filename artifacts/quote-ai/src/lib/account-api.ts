// Phase 72: data export + account deletion — same hand-written fetch pattern
// as security-api.ts (these are account-lifecycle calls, not part of the
// generated OpenAPI client).

type AccountExportDto = {
  id: string;
  status: "pending" | "ready" | "failed";
  createdAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  sizeBytes: number | null;
  tableCount: number | null;
  fileCount: number | null;
  downloadUrl: string | null;
  error: string | null;
};

export type AccountStatusDto = {
  ownsProfile: boolean;
  companyName: string | null;
  canExport: boolean;
  canDelete: boolean;
  graceDays: number;
  retentionYears: number;
  pendingDeletion: { scheduledFor: string; daysLeft: number } | null;
  exports: AccountExportDto[];
};

export class AccountApiError extends Error {
  constructor(message: string, public code: string | null, public status: number) {
    super(message);
    this.name = "AccountApiError";
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; code?: string };
  if (!res.ok) throw new AccountApiError(body.message || body.error || `Request failed (${res.status})`, body.code ?? null, res.status);
  return body;
}

export const accountApi = {
  status: () => req<AccountStatusDto>("/api/account"),
  requestExport: (language: "en" | "fr") => req<{ id: string; status: string; email: string }>("/api/account/export", { method: "POST", body: JSON.stringify({ language }) }),
  requestDeletion: (body: { password: string; code?: string; language: "en" | "fr" }) =>
    req<{ scheduledFor: string; daysLeft: number; alreadyPending: boolean }>("/api/account", { method: "DELETE", body: JSON.stringify(body) }),
};
