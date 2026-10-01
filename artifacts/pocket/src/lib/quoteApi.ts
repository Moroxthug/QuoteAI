// The Quote and Quote editor screens' server calls (routes/quotes.ts, sms.ts). The generated hooks cover most of
// them; these go through lib/api.ts so the app's token, acting company and offline answer are the same everywhere.
import { api } from "./api";
import type { Chapter, Discount, Schedule } from "./quoteMath";

export type TaxLine = { code: string; label?: string; rate: number; amount: number };
export type QuoteItem = { descrizione: string; quantita: number; unita: string; prezzoUnitario: number; totale: number };

export type QuoteFull = {
  id: string;
  status: string;
  clientId?: string | null;
  clientData: { nome: string; indirizzo?: string; city?: string; province?: string; postalCode?: string; email?: string; phone?: string; partitaIva?: string; businessNumber?: string };
  descrizioneGenerale: string;
  items: QuoteItem[];
  capitoli: Chapter[];
  sconto: Discount;
  condizioniPagamento: string[];
  titoloPreventivoRiga1: string | null;
  titoloPreventivoRiga2: string | null;
  numeroPreventivoData: string | null;
  subtotale: number;
  ivaPercentuale: number;
  ivaValore: number;
  taxLines?: TaxLine[];
  totale: number;
  note: string;
  province?: string | null;
  paymentSchedule?: Schedule | null;
  validDays?: number | null;
  sentAt?: string | null;
  firstViewedAt?: string | null;
  declinedAt?: string | null;
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  jobId?: string | null;
  pdfDownloadedAt?: string | null;
  pdfUrl?: string | null;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type QuoteUpdate = Partial<{
  clientData: QuoteFull["clientData"];
  descrizioneGenerale: string;
  capitoli: Chapter[];
  items: QuoteItem[];
  sconto: Discount;
  condizioniPagamento: string[];
  titoloPreventivoRiga1: string | null;
  titoloPreventivoRiga2: string | null;
  note: string;
  subtotale: number;
  ivaPercentuale: number;
  ivaValore: number;
  totale: number;
  province: string | null;
  paymentSchedule: Schedule | null;
}>;

export type SmsStatus = { available: boolean; smsEnabled: boolean };

const enc = encodeURIComponent;

export const quoteApi = {
  get: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}`),
  update: (id: string, body: QuoteUpdate) => api<QuoteFull>(`/api/quotes/${enc(id)}`, { method: "PUT", body }),
  sendEmail: (id: string, toEmail: string, clientName?: string) => api<{ success?: boolean }>(`/api/quotes/${enc(id)}/send-pdf-email`, { method: "POST", body: { toEmail, ...(clientName ? { clientName } : null) } }),
  sendSms: (id: string, toPhone: string) => api<{ success?: boolean }>(`/api/quotes/${enc(id)}/send-sms`, { method: "POST", body: { toPhone } }),
  smsStatus: () => api<SmsStatus>("/api/sms/status"),
  duplicate: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/duplicate`, { method: "POST", body: {} }),
  archive: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/archive`, { method: "POST", body: {} }),
  restore: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/restore`, { method: "POST", body: {} }),
};
