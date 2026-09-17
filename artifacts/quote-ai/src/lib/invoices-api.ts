// Thin fetch client for the Phase 4 invoice endpoints (not in the orval
// generated client). All calls send the session cookie.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type InvoiceType = "deposit" | "progress" | "final" | "holdback_release" | "change_order" | "manual" | "credit_note";
export type InvoiceStatus = "draft" | "sent" | "viewed" | "pending_confirmation" | "partially_paid" | "paid" | "overdue" | "void";
export type PaymentMethod = "etransfer" | "cheque" | "cash" | "card" | "bank_transfer" | "credit_note" | "other";
export const PAYMENT_METHODS: Exclude<PaymentMethod, "credit_note">[] = ["etransfer", "cheque", "cash", "card", "bank_transfer", "other"];

export type InvoicePartyDto = {
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  email?: string | null;
  phone?: string | null;
  gstHstNumber?: string | null;
  qstNumber?: string | null;
  pstNumber?: string | null;
  licenceNumber?: string | null;
  businessNumber?: string | null;
};
export type InvoiceLineDto = { description: string; quantity: number; unitCents: number; amountCents: number };
export type InvoiceTaxLineDto = { code: string; label: string; rate: number; amountCents: number; registrationNumber?: string | null };

export type InvoiceDto = {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  source: "automation" | "manual";
  language: "en" | "fr";
  province: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  contractId: string | null;
  milestoneId: string | null;
  paymentTermId: string | null;
  paymentTermLabel: string | null;
  creditNoteForId: string | null;
  issueDate: string;
  dueDate: string;
  scheduledFor: string | null;
  contractor: InvoicePartyDto;
  customer: InvoicePartyDto;
  siteAddress: string;
  lines: InvoiceLineDto[];
  subtotalCents: number;
  holdbackPercent: number;
  holdbackCents: number;
  taxableCents: number;
  taxLines: InvoiceTaxLineDto[];
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  notes: string;
  paymentInstructions: { etransferEmail?: string | null; chequePayableTo?: string | null; note?: string | null };
  hasPdf: boolean;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  autoSendAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type InvoicePaymentDto = { id: string; date: string; amountCents: number; method: PaymentMethod; reference: string; note: string; creditNoteId: string | null; createdAt: string };
export type InvoiceEventDto = { id: string; type: string; actor: "contractor" | "customer" | "system"; detail: Record<string, unknown> | null; createdAt: string };

export type AgingDto = { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; totalCents: number; overdueCents: number };
export type InvoiceListDto = {
  items: InvoiceDto[];
  aging: AgingDto;
  stats: { drafts: number; outstandingCents: number; overdueCents: number; overdueCount: number; paidThisMonthCents: number };
};
export type InvoiceDetailDto = { invoice: InvoiceDto; payments: InvoicePaymentDto[]; events: InvoiceEventDto[]; html: string; css: string; publicUrl: string | null; reminderDays: number[] };
export type InvoiceTotalsDto = { invoicedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number; draftCount: number };

export type LineInput = { description: string; quantity: number; unitCents: number };
export type InvoiceEdit = { title?: string; lines?: LineInput[]; dueDays?: number; holdbackPercent?: number; notes?: string; language?: "en" | "fr"; customerEmail?: string; customerName?: string; paymentNote?: string | null };

export const invoicesApi = {
  list: () => req<InvoiceListDto>("/api/invoices"),
  clients: () => req<{ items: { id: string; name: string; email: string | null; province: string | null }[] }>("/api/invoices/clients"),
  get: (id: string) => req<InvoiceDetailDto>(`/api/invoices/${id}`),
  create: (body: { projectId?: string; clientId?: string; title?: string; lines: LineInput[]; dueDays?: number; holdbackPercent?: number; notes?: string; language?: "en" | "fr"; province?: string }) =>
    req<{ invoice: InvoiceDto }>("/api/invoices", { method: "POST", body: json(body) }),
  createForJob: (jobId: string, body: { kind: "deposit" | "term" | "final" | "holdback_release"; paymentTermId?: string; milestoneId?: string }) =>
    req<{ invoice: InvoiceDto; created: boolean }>(`/api/jobs/${jobId}/invoices`, { method: "POST", body: json(body) }),
  forJob: (jobId: string) => req<{ items: InvoiceDto[]; totals: InvoiceTotalsDto }>(`/api/jobs/${jobId}/invoices`),
  update: (id: string, body: InvoiceEdit) => req<{ invoice: InvoiceDto; html: string }>(`/api/invoices/${id}`, { method: "PUT", body: json(body) }),
  remove: (id: string) => req<{ success: true }>(`/api/invoices/${id}`, { method: "DELETE" }),
  send: (id: string, body: { message?: string; customerEmail?: string } = {}) => req<{ invoice: InvoiceDto; resend: boolean }>(`/api/invoices/${id}/send`, { method: "POST", body: json(body) }),
  remind: (id: string) => req<{ success: true }>(`/api/invoices/${id}/remind`, { method: "POST", body: "{}" }),
  recordPayment: (id: string, body: { amountCents: number; method: Exclude<PaymentMethod, "credit_note">; date?: string; reference?: string; note?: string; sendReceipt?: boolean }) =>
    req<{ invoice: InvoiceDto; payment: InvoicePaymentDto }>(`/api/invoices/${id}/payments`, { method: "POST", body: json(body) }),
  removePayment: (id: string, pid: string) => req<{ invoice: InvoiceDto }>(`/api/invoices/${id}/payments/${pid}`, { method: "DELETE" }),
  void: (id: string, reason?: string) => req<{ invoice: InvoiceDto }>(`/api/invoices/${id}/void`, { method: "POST", body: json({ reason }) }),
  archive: (id: string) => req<{ invoice: InvoiceDto }>(`/api/invoices/${id}/archive`, { method: "POST", body: "{}" }),
  restore: (id: string) => req<{ invoice: InvoiceDto }>(`/api/invoices/${id}/restore`, { method: "POST", body: "{}" }),
  creditNote: (id: string, body: { amountCents: number; description: string; reason?: string; send?: boolean }) =>
    req<{ creditNote: InvoiceDto; invoice: InvoiceDto }>(`/api/invoices/${id}/credit-note`, { method: "POST", body: json(body) }),
  confirmEtransfer: (id: string) => req<{ invoice: InvoiceDto }>(`/api/invoices/${id}/confirm-etransfer`, { method: "POST", body: "{}" }),
  rejectEtransfer: (id: string) => req<{ invoice: InvoiceDto }>(`/api/invoices/${id}/reject-etransfer`, { method: "POST", body: "{}" }),
  pdfUrl: (id: string, download = false) => `/api/invoices/${id}/pdf${download ? "?download=1" : ""}`,
};

export type StripeConnectStatusDto = { connected: boolean; chargesEnabled?: boolean; payoutsEnabled?: boolean; detailsSubmitted?: boolean; connectedAt?: string };

export const stripeConnectApi = {
  status: () => req<StripeConnectStatusDto>("/api/invoice-payments/connect/status"),
  onboard: () => req<{ url: string }>("/api/invoice-payments/connect/onboard", { method: "POST", body: "{}" }),
};

export type FinanceitStatusDto = { connected: boolean; dealerId?: string; isEnabled?: boolean; connectedAt?: string; lastAppliedAt?: string | null };

export const financeitApi = {
  status: () => req<FinanceitStatusDto>("/api/financeit/status"),
  saveDealer: (dealerId: string) => req<{ connected: boolean; dealerId: string; isEnabled: boolean }>("/api/financeit/dealer", { method: "PUT", body: json({ dealerId }) }),
  toggle: (isEnabled: boolean) => req<{ success: true }>("/api/financeit/toggle", { method: "PATCH", body: json({ isEnabled }) }),
  disconnect: () => req<{ success: true }>("/api/financeit/disconnect", { method: "DELETE" }),
};

// Phase 27: Flinks bank feed reconciliation (engineering track — inert until Flinks accreditation is granted)
export type FlinksAccountDto = { id: string; name: string; institution: string; last4: string | null };
export type FlinksStatusDto = {
  connected: boolean;
  institutionName?: string;
  selectedAccount?: FlinksAccountDto | null;
  isEnabled?: boolean;
  connectedAt?: string;
  lastSyncedAt?: string | null;
};
export type FlinksTransactionDto = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  matchStatus: "unmatched" | "matched" | "ignored";
  matchedCostEntryId: string | null;
  autoMatched: boolean;
};
export type FlinksCandidateDto = { id: string; vendor: string; description: string; date: string; totalCents: number };

export const flinksApi = {
  status: () => req<FlinksStatusDto>("/api/flinks/status"),
  connectUrl: () => req<{ url: string }>("/api/flinks/connect-url"),
  connect: (loginId: string, institutionName: string) =>
    req<{ connected: boolean; institutionName: string; accounts: FlinksAccountDto[] }>("/api/flinks/connect", { method: "POST", body: json({ loginId, institutionName }) }),
  accounts: () => req<{ accounts: FlinksAccountDto[] }>("/api/flinks/accounts"),
  selectAccount: (account: FlinksAccountDto) => req<{ success: true }>("/api/flinks/account", { method: "PUT", body: json(account) }),
  toggle: (isEnabled: boolean) => req<{ success: true }>("/api/flinks/toggle", { method: "PATCH", body: json({ isEnabled }) }),
  disconnect: () => req<{ success: true }>("/api/flinks/disconnect", { method: "DELETE" }),
  sync: () => req<{ success: true; fetched: number; matched: number }>("/api/flinks/sync", { method: "POST" }),
  transactions: () => req<{ transactions: FlinksTransactionDto[] }>("/api/flinks/transactions"),
  candidates: (transactionId: string) => req<{ candidates: FlinksCandidateDto[] }>(`/api/flinks/transactions/${transactionId}/candidates`),
  match: (transactionId: string, costEntryId: string) => req<{ success: true }>(`/api/flinks/transactions/${transactionId}/match`, { method: "POST", body: json({ costEntryId }) }),
  unmatch: (transactionId: string) => req<{ success: true }>(`/api/flinks/transactions/${transactionId}/unmatch`, { method: "POST" }),
  ignore: (transactionId: string) => req<{ success: true }>(`/api/flinks/transactions/${transactionId}/ignore`, { method: "POST" }),
};

// Phase 28: Meta (Facebook/Instagram) Lead Ads capture
export type MetaLeadAdsStatusDto = {
  connected: boolean;
  pageName?: string;
  isEnabled?: boolean;
  connectedAt?: string;
  lastLeadAt?: string | null;
};
export type MetaLeadAdsImportLogEntryDto = {
  id: string;
  metaLeadId: string;
  formId: string | null;
  status: "imported" | "duplicate" | "failed";
  error: string | null;
  createdAt: string;
};

export const metaLeadAdsApi = {
  status: () => req<MetaLeadAdsStatusDto>("/api/meta-lead-ads/status"),
  connectUrl: () => req<{ url: string }>("/api/meta-lead-ads/connect"),
  toggle: (isEnabled: boolean) => req<{ success: true }>("/api/meta-lead-ads/toggle", { method: "PATCH", body: json({ isEnabled }) }),
  disconnect: () => req<{ success: true }>("/api/meta-lead-ads/disconnect", { method: "DELETE" }),
  importLog: () => req<{ entries: MetaLeadAdsImportLogEntryDto[] }>("/api/meta-lead-ads/import-log"),
};

// Phase 29: Google Local Services Ads (LSA) lead capture — engineering track, gated on Google
// developer-token approval + manager account setup (see docs/EDGE-FEATURES-PLAN.md §15).
export type GoogleLsaStatusDto = {
  connected: boolean;
  lsaCustomerId?: string;
  isEnabled?: boolean;
  connectedAt?: string;
  lastPolledAt?: string | null;
  lastLeadAt?: string | null;
};
export type GoogleLsaImportLogEntryDto = {
  id: string;
  googleLsaLeadId: string;
  leadType: string | null;
  status: "imported" | "duplicate" | "failed";
  error: string | null;
  createdAt: string;
};

export const googleLsaApi = {
  status: () => req<GoogleLsaStatusDto>("/api/google-lsa/status"),
  connectUrl: (lsaCustomerId: string) => req<{ url: string }>(`/api/google-lsa/connect?lsaCustomerId=${encodeURIComponent(lsaCustomerId)}`),
  toggle: (isEnabled: boolean) => req<{ success: true }>("/api/google-lsa/toggle", { method: "PATCH", body: json({ isEnabled }) }),
  disconnect: () => req<{ success: true }>("/api/google-lsa/disconnect", { method: "DELETE" }),
  importLog: () => req<{ entries: GoogleLsaImportLogEntryDto[] }>("/api/google-lsa/import-log"),
};

// Phase 19: public API keys + webhooks (Settings → Integrations → Developer API)
export type AutomationEventName =
  | "quote.accepted" | "contract.signed" | "contract.declined" | "milestone.completed" | "job.completed"
  | "invoice.overdue" | "lead.followup_due" | "job.review_request_due" | "invoice.paid" | "cost.confirmed";

export type ApiKeyDto = { id: string; name: string; keyPrefix: string; role: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
export type WebhookDto = { id: string; url: string; events: AutomationEventName[]; isEnabled: boolean; createdAt: string };

export const developerApi = {
  listKeys: () => req<{ items: ApiKeyDto[]; events: AutomationEventName[] }>("/api/developer/api-keys"),
  createKey: (name: string) => req<{ key: ApiKeyDto; rawKey: string }>("/api/developer/api-keys", { method: "POST", body: json({ name }) }),
  revokeKey: (id: string) => req<{ success: true }>(`/api/developer/api-keys/${id}`, { method: "DELETE" }),
  listWebhooks: () => req<{ items: WebhookDto[]; events: AutomationEventName[] }>("/api/developer/webhooks"),
  createWebhook: (url: string, events: AutomationEventName[]) => req<{ webhook: WebhookDto; secret: string }>("/api/developer/webhooks", { method: "POST", body: json({ url, events }) }),
  toggleWebhook: (id: string, isEnabled: boolean) => req<{ success: true }>(`/api/developer/webhooks/${id}`, { method: "PATCH", body: json({ isEnabled }) }),
  deleteWebhook: (id: string) => req<{ success: true }>(`/api/developer/webhooks/${id}`, { method: "DELETE" }),
};

export type PublicInvoiceDto = {
  invoice: {
    id: string;
    number: string;
    type: InvoiceType;
    status: InvoiceStatus;
    language: "en" | "fr";
    province: string;
    title: string;
    issueDate: string;
    dueDate: string;
    totalCents: number;
    paidCents: number;
    balanceCents: number;
    companyName: string;
    companyEmail: string | null;
    companyPhone: string | null;
    customerName: string;
    paymentInstructions: { etransferEmail?: string | null; chequePayableTo?: string | null; note?: string | null };
    paidAt: string | null;
    canPayByCard: boolean;
  };
  html: string;
  css: string;
};

export const publicInvoiceApi = {
  get: (token: string) => req<PublicInvoiceDto>(`/api/i/${token}`),
  pdfUrl: (token: string, download = false) => `/api/i/${token}/pdf${download ? "?download=1" : ""}`,
  markSent: (token: string) => req<{ status: InvoiceStatus }>(`/api/i/${token}/mark-sent`, { method: "POST", body: "{}" }),
  payLink: (token: string) => req<{ url: string }>(`/api/i/${token}/pay-link`, { method: "POST", body: "{}" }),
};

/** Open statuses = counts towards accounts receivable. */
export const isOpenInvoice = (s: InvoiceStatus) => s === "sent" || s === "viewed" || s === "pending_confirmation" || s === "partially_paid" || s === "overdue";
