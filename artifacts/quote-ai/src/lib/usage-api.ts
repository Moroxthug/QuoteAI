// Thin fetch client for the Phase 8 usage endpoint (not in the orval
// generated client — follows the same hand-written pattern as jobs-api.ts).

export type UsageSummaryDto = {
  plan: string;
  receiptScans: { used: number; allowance: number | null };
  whatsappMessages: { used: number; allowance: number | null };
  aiTokens: { used: number };
  estimatedCostCents: number;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(body.message || body.error || `Request failed (${res.status})`);
  return body;
}

export const usageApi = {
  summary: () => req<UsageSummaryDto>("/api/usage/summary"),
};
