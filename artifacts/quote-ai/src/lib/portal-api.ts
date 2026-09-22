// Phase 76: the client portal (/portal/:token) and the contractor's side of
// it (portal link, invite, message thread). Hand-written like sms-api.ts.
//
// The portal session token is kept in localStorage per portal link and sent
// as the X-Portal-Session header — never a cookie, so a contractor logged in
// to the dashboard and a client on the portal in the same browser never mix.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type PortalMessageDto = { id: string; sender: "contractor" | "client"; senderName: string; body: string; jobId: string | null; jobName: string | null; createdAt: string; readAt: string | null };
type PortalQuoteDto = { id: string; number: string; title: string; total: number; status: "unlocked" | "accepted"; acceptedAt: string | null; createdAt: string; url: string };
type PortalContractDto = { id: string; contractNumber: string; kind: string; title: string; status: string; total: number; sentAt: string | null; signedAt: string | null; expiresAt: string | null; canSign: boolean; jobId: string | null };
type PortalInvoiceDto = { id: string; number: string; type: string; status: string; title: string; issueDate: string; dueDate: string; totalCents: number; paidCents: number; balanceCents: number; canPayByCard: boolean; etransferEmail: string | null; jobId: string | null; url: string | null; paidAt: string | null };
type PortalMilestoneDto = { id: string; title: string; status: string; plannedStart: string | null; plannedEnd: string | null; actualEnd: string | null };
type PortalPhotoDto = { id: string; caption: string; createdAt: string; milestoneId: string | null };
export type PortalJobDto = { id: string; name: string; address: string; status: string; progressPercent: number; plannedStart: string | null; plannedEnd: string | null; completedAt: string | null; milestones: PortalMilestoneDto[]; photos: PortalPhotoDto[] };
type PortalCompanyDto = { name: string; logoUrl: string | null; email: string | null; phone: string | null };

export type PortalHeaderDto = { company: PortalCompanyDto; client: { name: string; emailMasked: string | null; language: "en" | "fr" }; authenticated: boolean; sessionExpiresAt: string | null };
export type PortalOverviewDto = {
  company: PortalCompanyDto;
  client: { name: string; email: string | null; language: "en" | "fr" };
  quotes: PortalQuoteDto[];
  contracts: PortalContractDto[];
  invoices: PortalInvoiceDto[];
  jobs: PortalJobDto[];
  messages: PortalMessageDto[];
};

const storageKey = (token: string) => `qai_portal_session:${token.slice(0, 16)}`;

export function getPortalSession(token: string): string | null {
  try {
    return localStorage.getItem(storageKey(token));
  } catch {
    return null;
  }
}
export function setPortalSession(token: string, session: string | null): void {
  try {
    if (session) localStorage.setItem(storageKey(token), session);
    else localStorage.removeItem(storageKey(token));
  } catch {
    /* private mode — the session just lives for this page load */
  }
}

// `req` spreads `init` after its own headers, so a custom `headers` object
// replaces them — Content-Type has to be repeated here or Express never parses
// the JSON body.
function sessionHeaders(token: string): Record<string, string> {
  const s = getPortalSession(token);
  return { "Content-Type": "application/json", ...(s ? { "X-Portal-Session": s } : {}) };
}

export const portalApi = {
  header: (token: string) => req<PortalHeaderDto>(`/api/portal/${token}`, { headers: sessionHeaders(token) }),
  otp: (token: string) => req<{ success: true }>(`/api/portal/${token}/otp`, { method: "POST", body: "{}" }),
  verify: (token: string, code: string) => req<{ success: true; session: string; expiresAt: string }>(`/api/portal/${token}/verify`, { method: "POST", body: json({ code }) }),
  logout: (token: string) => req<{ success: true }>(`/api/portal/${token}/logout`, { method: "POST", body: "{}", headers: sessionHeaders(token) }),
  overview: (token: string) => req<PortalOverviewDto>(`/api/portal/${token}/overview`, { headers: sessionHeaders(token) }),
  sendMessage: (token: string, body: { body: string; jobId?: string | null }) => req<{ message: PortalMessageDto }>(`/api/portal/${token}/messages`, { method: "POST", body: json(body), headers: sessionHeaders(token) }),
  payLink: (token: string, invoiceId: string) => req<{ url: string }>(`/api/portal/${token}/invoices/${invoiceId}/pay-link`, { method: "POST", body: "{}", headers: sessionHeaders(token) }),
  markSent: (token: string, invoiceId: string) => req<{ status: string }>(`/api/portal/${token}/invoices/${invoiceId}/mark-sent`, { method: "POST", body: "{}", headers: sessionHeaders(token) }),
  signLink: (token: string, contractId: string) => req<{ url: string }>(`/api/portal/${token}/contracts/${contractId}/sign-link`, { method: "POST", body: "{}", headers: sessionHeaders(token) }),
  /** PDFs and photos need the session header, so they are fetched as blobs (see PortalPage). */
  invoicePdfPath: (token: string, invoiceId: string) => `/api/portal/${token}/invoices/${invoiceId}/pdf?download=1`,
  contractPdfPath: (token: string, contractId: string) => `/api/portal/${token}/contracts/${contractId}/pdf?download=1`,
  photoPath: (token: string, photoId: string) => `/api/portal/${token}/photos/${photoId}/file`,
  fetchBlob: async (token: string, path: string): Promise<Blob> => {
    const res = await fetch(path, { headers: sessionHeaders(token) });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.blob();
  },
};

// ── Contractor side ─────────────────────────────────────────────────────────

export type ClientPortalStatusDto = { url: string | null; hasEmail: boolean; email: string | null; invitedAt: string | null; lastSeenAt: string | null; unread: number };
export type ClientThreadDto = { messages: PortalMessageDto[]; client: { id: string; name: string; email: string | null; portalLastSeenAt: string | null } };

export const clientPortalApi = {
  status: (clientId: string) => req<ClientPortalStatusDto>(`/api/clients/${clientId}/portal`),
  invite: (clientId: string) => req<{ success: true; invitedAt: string; url: string }>(`/api/clients/${clientId}/portal/invite`, { method: "POST", body: "{}" }),
  thread: (clientId: string) => req<ClientThreadDto>(`/api/clients/${clientId}/messages`),
  send: (clientId: string, body: { body: string; jobId?: string | null }) => req<{ message: PortalMessageDto; emailed: boolean }>(`/api/clients/${clientId}/messages`, { method: "POST", body: json(body) }),
};
