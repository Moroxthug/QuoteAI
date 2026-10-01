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
  /** The version the client sees (2 after a sent quote was edited); revisionOpen: edited since it was last sent. */
  version?: number;
  revisionOpen?: boolean;
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
  exclusions?: string[];
  rawInput?: string;
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
  exclusions: string[];
  templateId: string;
}>;

export type Finding = { chapter: string; index: number; description: string; um: string; quantita: number; quotedUnitPrice: number; referenceUnitPrice: number; referenceName: string; referenceUnit: string | null; source: "catalog" | "receipts"; sampleCount: number; vendor: string | null; changePct: number; deltaTotal: number };
export type PriceCheckLine = { chapter: string; index: number; description: string; um: string; quantita: number; quotedUnitPrice: number; referenceUnitPrice: number | null; referenceName: string | null; source: "catalog" | "receipts" | null; sampleCount: number | null; changePct: number | null; verdict: "low" | "high" | "in_range" | "no_data" };
export type PriceCheck = { checkedAt: string; thresholdPct: number; linesChecked: number; findings: Finding[]; lines: PriceCheckLine[]; deltaTotal: number; editable: boolean; references: number };
export type CatalogItem = { id: string; nome: string; categoria: string | null; um: string; prezzoUnitario: number; note: string | null };
export type Variant = { id: string; quoteId: string; label: string; description: string; recommended: boolean; position: number; capitoli: Chapter[]; sconto: Discount; subtotale: number; ivaPercentuale: number; ivaValore: number; totale: number };
export type VariantUpdate = Partial<{ label: string; description: string; recommended: boolean; capitoli: Chapter[]; sconto: Discount; subtotale: number; ivaPercentuale: number; ivaValore: number; totale: number }>;

export type SmsStatus = { available: boolean; smsEnabled: boolean };

const enc = encodeURIComponent;

export const quoteApi = {
  get: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}`),
  update: (id: string, body: QuoteUpdate) => api<QuoteFull>(`/api/quotes/${enc(id)}`, { method: "PUT", body }),
  sendEmail: (id: string, toEmail: string, clientName?: string) => api<{ success?: boolean }>(`/api/quotes/${enc(id)}/send-pdf-email`, { method: "POST", body: { toEmail, ...(clientName ? { clientName } : null) } }),
  sendSms: (id: string, toPhone: string) => api<{ success?: boolean }>(`/api/quotes/${enc(id)}/send-sms`, { method: "POST", body: { toPhone } }),
  smsStatus: () => api<SmsStatus>("/api/sms/status"),
  priceCheck: (id: string) => api<PriceCheck>(`/api/quotes/${enc(id)}/price-check`),
  reprice: (id: string, items: { chapter: string; index: number; unitPrice: number }[]) => api<{ quote: QuoteFull; applied: number; totale: { from: number; to: number } }>(`/api/quotes/${enc(id)}/reprice`, { method: "POST", body: { items } }),
  catalog: () => api<CatalogItem[]>("/api/catalog"),
  variants: (id: string) => api<{ variants: Variant[] }>(`/api/quotes/${enc(id)}/variants`),
  addVariant: (id: string, body: { label?: string; description?: string; cloneFromVariantId?: string }) => api<Variant>(`/api/quotes/${enc(id)}/variants`, { method: "POST", body }),
  updateVariant: (id: string, variantId: string, body: VariantUpdate) => api<Variant>(`/api/quotes/${enc(id)}/variants/${enc(variantId)}`, { method: "PUT", body }),
  removeVariant: (id: string, variantId: string) => api<unknown>(`/api/quotes/${enc(id)}/variants/${enc(variantId)}`, { method: "DELETE" }),
  regenerate: (id: string, newDescription: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/regenerate`, { method: "POST", body: { newDescription, keepClientData: true } }),
  markWon: (id: string, variantId?: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/mark-won`, { method: "POST", body: variantId ? { variantId } : {} }),
  duplicate: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/duplicate`, { method: "POST", body: {} }),
  archive: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/archive`, { method: "POST", body: {} }),
  restore: (id: string) => api<QuoteFull>(`/api/quotes/${enc(id)}/restore`, { method: "POST", body: {} }),
};
