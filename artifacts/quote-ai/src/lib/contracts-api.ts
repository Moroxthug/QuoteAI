// Thin fetch client for the Phase 1 contract endpoints (not in the orval
// generated client). All calls send the session cookie.

export type ContractSectionDto = { key: string; heading: string; body: string; kind: "legal" | "ai" | "data"; editable: boolean };

export type ContractDto = {
  id: string;
  quoteId: string | null;
  clientId: string | null;
  projectId: string | null;
  kind: "agreement" | "change_order";
  parentContractId: string | null;
  changeOrderId: string | null;
  contractNumber: string;
  status: "draft" | "sent" | "viewed" | "signed" | "declined" | "voided" | "expired";
  province: string;
  language: "en" | "fr";
  templateKey: string;
  document: { templateKey: string; templateVersion: number; language: "en" | "fr"; title: string; sections: ContractSectionDto[] };
  variables: {
    contractNumber: string;
    quoteNumber: string;
    contractor: { name: string; email?: string; licenceNumber?: string };
    customer: { name: string; email?: string };
    siteAddress: string;
    province: string;
    projectTitle: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    paymentSchedule: { holdback: { enabled: boolean; percent: number }; terms: unknown[] };
    startDate: string | null;
    estimatedDurationWeeks: number | null;
    warrantyMonths: number;
    englishRequestedInQuebec: boolean;
    directAgreement: boolean;
  };
  contractValueCents: number;
  hasSignedPdf: boolean;
  signedPdfHash: string | null;
  unsignedPdfHash: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  reminderCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  signers: { id: string; role: "contractor" | "customer"; name: string; email: string; status: string; signatureType: string | null; signedAt: string | null; viewedAt: string | null; declinedAt: string | null; declineReason: string | null }[];
  events: { id: string; type: string; actor: string; detail: unknown; createdAt: string }[];
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; requiredPlan?: string };
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number; requiredPlan?: string };
    err.code = body.error;
    err.status = res.status;
    err.requiredPlan = body.requiredPlan;
    throw err;
  }
  return body;
}

export const contractsApi = {
  list: () => req<{ items: ContractDto[] }>("/api/contracts"),
  byQuote: (quoteId: string) => req<{ contract: ContractDto | null }>(`/api/contracts/by-quote/${quoteId}`),
  get: (id: string) => req<{ contract: ContractDto; html: string; css: string }>(`/api/contracts/${id}`),
  createFromQuote: (quoteId: string, body: { language?: "en" | "fr"; province?: string } = {}) =>
    req<{ contract: ContractDto; created: boolean }>(`/api/contracts/from-quote/${quoteId}`, { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { sections?: { key: string; body: string }[]; variables?: Record<string, unknown> }) =>
    req<{ contract: ContractDto; html: string }>(`/api/contracts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  sign: (id: string, body: { signatureType: "drawn" | "typed"; signatureData: string; name: string; consent: true }) =>
    req<{ contract: ContractDto }>(`/api/contracts/${id}/sign`, { method: "POST", body: JSON.stringify(body) }),
  send: (id: string, body: { message?: string; toEmail?: string } = {}) => req<{ contract: ContractDto }>(`/api/contracts/${id}/send`, { method: "POST", body: JSON.stringify(body) }),
  void: (id: string, reason?: string) => req<{ contract: ContractDto }>(`/api/contracts/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) }),
  archive: (id: string) => req<ContractDto>(`/api/contracts/${id}/archive`, { method: "POST", body: "{}" }),
  restore: (id: string) => req<ContractDto>(`/api/contracts/${id}/restore`, { method: "POST", body: "{}" }),
  pdfUrl: (id: string, download = false) => `/api/contracts/${id}/pdf${download ? "?download=1" : ""}`,
};

export type PublicSignPayload = {
  contract: {
    id: string;
    contractNumber: string;
    status: string;
    language: "en" | "fr";
    province: string;
    title: string;
    total: number;
    companyName: string;
    companyEmail: string | null;
    companyPhone: string | null;
    customerName: string;
    expiresAt: string | null;
    signedAt: string | null;
    contractorSignedAt: string | null;
    /** Phase 76: the client portal, when the contract has a client with an email. */
    portalUrl: string | null;
  };
  signer: { name: string; emailMasked: string; status: string; otpVerified: boolean; signedAt: string | null };
  html: string;
  css: string;
};

export const signApi = {
  get: (token: string) => req<PublicSignPayload>(`/api/sign/${token}`),
  otp: (token: string) => req<{ success: true }>(`/api/sign/${token}/otp`, { method: "POST", body: "{}" }),
  verify: (token: string, code: string) => req<{ success: true }>(`/api/sign/${token}/verify`, { method: "POST", body: JSON.stringify({ code }) }),
  complete: (token: string, body: { name: string; signatureType: "drawn" | "typed"; signatureData: string; consent: true }) =>
    req<{ success: true; status: string; signedAt: string | null }>(`/api/sign/${token}/complete`, { method: "POST", body: JSON.stringify(body) }),
  decline: (token: string, reason: string) => req<{ success: true }>(`/api/sign/${token}/decline`, { method: "POST", body: JSON.stringify({ reason }) }),
  pdfUrl: (token: string) => `/api/sign/${token}/pdf`,
};
