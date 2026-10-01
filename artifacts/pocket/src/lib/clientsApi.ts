// The Clients tab and Client screen's server calls (routes/clients.ts, client-portal.ts, invoices.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { ClientDetail, ClientRow, ClientsStats, Details } from "./clients";

export type PortalStatus = { clientId: string; url: string | null; hasEmail: boolean; email: string | null; invitedAt: string | null; lastSeenAt: string | null; unread: number };
export type PortalMessage = { id: string; sender: "contractor" | "client"; senderName: string; body: string; jobId: string | null; jobName: string | null; createdAt: string; readAt: string | null };

export const clientsApi = {
  overview: () => api<{ items: ClientRow[]; stats: ClientsStats }>("/api/clients/overview"),
  detail: (id: string) => api<ClientDetail>(`/api/clients/${encodeURIComponent(id)}/overview`),
  add: (d: Partial<Details>) => api<ClientDetail>("/api/clients", { method: "POST", body: d }),
  save: (id: string, d: Partial<Record<keyof Details, string | null>>) => api<ClientDetail>(`/api/clients/${encodeURIComponent(id)}/details`, { method: "PUT", body: d }),
  portal: (id: string) => api<PortalStatus>(`/api/clients/${encodeURIComponent(id)}/portal`),
  invite: (id: string) => api<{ success: boolean; invitedAt: string; url: string }>(`/api/clients/${encodeURIComponent(id)}/portal/invite`, { method: "POST", body: {} }),
  messages: (id: string) => api<{ messages: PortalMessage[] }>(`/api/clients/${encodeURIComponent(id)}/messages`),
  send: (id: string, body: string, jobId?: string) => api<unknown>(`/api/clients/${encodeURIComponent(id)}/messages`, { method: "POST", body: { body, ...(jobId ? { jobId } : null) } }),
  remind: (invoiceId: string) => api<unknown>(`/api/invoices/${encodeURIComponent(invoiceId)}/remind`, { method: "POST", body: {} }),
};
