export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost" | "unsubscribed";
export type LeadChannel = "email" | "sms" | "whatsapp";

export type LeadDto = {
  id: string;
  userId: string;
  clientId: string | null;
  quoteId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  preferredLanguage: "en" | "fr";
  preferredChannel: LeadChannel;
  source: "widget" | "manual" | "import";
  status: LeadStatus;
  consentSource: string;
  consentAt: string;
  unsubscribedAt: string | null;
  followUpStage: number;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadEventDto = {
  id: string;
  leadId: string;
  type: string;
  channel: LeadChannel | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = body.error;
    err.status = res.status;
    throw err;
  }
  return body;
}

const json = (body: unknown) => JSON.stringify(body);

export const leadsApi = {
  list: (status?: LeadStatus) => req<{ items: LeadDto[] }>(`/api/leads${status ? `?status=${status}` : ""}`),
  get: (id: string) => req<{ lead: LeadDto; events: LeadEventDto[] }>(`/api/leads/${id}`),
  create: (body: { name: string; email?: string; phone?: string; notes?: string; preferredChannel?: LeadChannel; preferredLanguage?: "en" | "fr" }) =>
    req<{ lead: LeadDto }>("/api/leads", { method: "POST", body: json(body) }),
  update: (id: string, body: { status?: LeadStatus; notes?: string; preferredChannel?: LeadChannel; preferredLanguage?: "en" | "fr" }) =>
    req<{ lead: LeadDto }>(`/api/leads/${id}`, { method: "PATCH", body: json(body) }),
  sendNow: (id: string) => req<{ lead: LeadDto; channel: LeadChannel }>(`/api/leads/${id}/send`, { method: "POST", body: "{}" }),
};
