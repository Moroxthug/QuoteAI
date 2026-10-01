// The Books screen's server calls (routes/books.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { BankLine, BooksOverview, Candidates, CloseDto, MonthChecklist } from "./books";

const id = encodeURIComponent;

export const booksApi = {
  overview: () => api<BooksOverview>("/api/books/overview"),
  close: (month: string) => api<MonthChecklist>(`/api/books/close?month=${id(month)}`),
  doClose: (month: string, note = "") => api<{ close: CloseDto }>("/api/books/close", { method: "POST", body: { month, note } }),
  reopen: (month: string) => api<{ success: boolean }>("/api/books/close/reopen", { method: "POST", body: { month } }),
  bank: () => api<{ lines: BankLine[] }>("/api/books/bank?status=all"),
  sync: () => api<{ fetched: number; matched: number }>("/api/books/bank/sync", { method: "POST", body: {} }),
  candidates: (lineId: string) => api<Candidates>(`/api/books/bank/${id(lineId)}/candidates`),
  matchCost: (lineId: string, costEntryId: string) => api<unknown>(`/api/books/bank/${id(lineId)}/match`, { method: "POST", body: { costEntryId } }),
  matchPayment: (lineId: string, paymentId: string) => api<unknown>(`/api/books/bank/${id(lineId)}/match`, { method: "POST", body: { paymentId } }),
  recordPayment: (lineId: string, invoiceId: string) => api<{ paymentId: string }>(`/api/books/bank/${id(lineId)}/record-payment`, { method: "POST", body: { invoiceId } }),
  /** A cost with no category yet ("misc", pending review): it then shows under "Costs waiting" until someone sorts it. */
  recordCost: (lineId: string) => api<{ costEntryId: string }>(`/api/books/bank/${id(lineId)}/create-cost`, { method: "POST", body: { category: "misc", projectId: null } }),
  unmatch: (lineId: string) => api<unknown>(`/api/books/bank/${id(lineId)}/unmatch`, { method: "POST", body: {} }),
  ignore: (lineId: string) => api<unknown>(`/api/books/bank/${id(lineId)}/ignore`, { method: "POST", body: {} }),
};
