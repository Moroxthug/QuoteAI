// The Leads screen's server calls (routes/leads.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { Lead, LeadChannel, LeadStatus } from "./leads";

export const leadsApi = {
  list: () => api<{ items: Lead[] }>("/api/leads"),
  add: (body: { name: string; email?: string; phone?: string; preferredChannel: "sms" | "email"; preferredLanguage: "en" | "fr"; notes?: string }) =>
    api<{ lead: Lead }>("/api/leads", { method: "POST", body }),
  update: (id: string, body: { status?: LeadStatus; preferredChannel?: LeadChannel; notes?: string }) =>
    api<{ lead: Lead }>(`/api/leads/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  send: (id: string) => api<{ lead: Lead; channel: LeadChannel }>(`/api/leads/${encodeURIComponent(id)}/send`, { method: "POST", body: {} }),
};
