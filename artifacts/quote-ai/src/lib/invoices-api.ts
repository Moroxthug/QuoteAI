// Thin fetch client for the Phase 4 invoice endpoints (not in the orval
// generated client). All calls send the session cookie.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type InvoiceType = "deposit" | "progress" | "final" | "holdback_release" | "change_order" | "manual" | "credit_note";
export type InvoiceStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "void";
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
  creditNote: (id: string, body: { amountCents: number; description: string; reason?: string; send?: boolean }) =>
    req<{ creditNote: InvoiceDto; invoice: InvoiceDto }>(`/api/invoices/${id}/credit-note`, { method: "POST", body: json(body) }),
  pdfUrl: (id: string, download = false) => `/api/invoices/${id}/pdf${download ? "?download=1" : ""}`,
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
  };
  html: string;
  css: string;
};

export const publicInvoiceApi = {
  get: (token: string) => req<PublicInvoiceDto>(`/api/i/${token}`),
  pdfUrl: (token: string, download = false) => `/api/i/${token}/pdf${download ? "?download=1" : ""}`,
};

/** Open statuses = counts towards accounts receivable. */
export const isOpenInvoice = (s: InvoiceStatus) => s === "sent" || s === "viewed" || s === "partially_paid" || s === "overdue";
