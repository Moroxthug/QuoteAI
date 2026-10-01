// The Invoices list and Invoice screen's server calls (routes/invoices.ts, invoice-payments.ts, business-profile.ts).
// The app's wrapped fetch (lib/session.ts) adds the token and the acting company.
import { api } from "./api";
import type { InvoiceDto, InvoiceEventDto, InvoiceList } from "./invoices.ts";

export type InvoiceLineDto = { description: string; quantity: number; unitCents: number; amountCents: number };
export type InvoiceTaxLineDto = { code: string; label: string; rate: number; amountCents: number };
export type InvoicePartyDto = { name?: string | null; address?: string | null; city?: string | null; province?: string | null; postalCode?: string | null; email?: string | null; phone?: string | null };

export type InvoiceFull = InvoiceDto & {
  lines: InvoiceLineDto[];
  subtotalCents: number;
  holdbackPercent: number | null;
  holdbackCents: number;
  taxLines: InvoiceTaxLineDto[];
  taxCents: number;
  notes: string;
  siteAddress: string;
  customer: InvoicePartyDto;
  contractor: InvoicePartyDto;
  projectId: string | null;
  language: string;
  hasPdf: boolean;
};

export type PaymentDto = { id: string; date: string; amountCents: number; method: string; reference: string; note: string; creditNoteId: string | null; createdAt: string };

export type InvoiceDetail = {
  invoice: InvoiceFull;
  payments: PaymentDto[];
  events: InvoiceEventDto[];
  publicUrl: string | null;
  reminderDays: number[];
};

export type PaymentInput = { amountCents: number; method: string; reference?: string; sendReceipt: boolean };

const enc = encodeURIComponent;
const post = <T = unknown>(path: string, body: unknown = {}) => api<T>(path, { method: "POST", body });

export const invoicesApi = {
  list: () => api<InvoiceList>("/api/invoices"),
  get: (id: string) => api<InvoiceDetail>(`/api/invoices/${enc(id)}`),
  send: (id: string) => post(`/api/invoices/${enc(id)}/send`),
  remind: (id: string) => post(`/api/invoices/${enc(id)}/remind`),
  receipt: (id: string) => post(`/api/invoices/${enc(id)}/receipt`),
  pay: (id: string, p: PaymentInput) => post<{ invoice: InvoiceFull }>(`/api/invoices/${enc(id)}/payments`, p),
  confirmEtransfer: (id: string) => post(`/api/invoices/${enc(id)}/confirm-etransfer`),
  rejectEtransfer: (id: string) => post(`/api/invoices/${enc(id)}/reject-etransfer`),
  archive: (id: string) => post(`/api/invoices/${enc(id)}/archive`),
  restore: (id: string) => post(`/api/invoices/${enc(id)}/restore`),
  void: (id: string, reason?: string) => post(`/api/invoices/${enc(id)}/void`, reason ? { reason } : {}),
  remove: (id: string) => api<{ success: boolean }>(`/api/invoices/${enc(id)}`, { method: "DELETE" }),
  /** The company's reminder settings (the one switch the Reminders card carries is company-wide). */
  settings: () => api<{ automationSettings: { invoiceReminders: boolean; smsReminders: boolean } }>("/api/business-profile"),
  setReminders: (on: boolean) => api<unknown>("/api/business-profile", { method: "PUT", body: { automationSettings: { invoiceReminders: on } } }),
};
