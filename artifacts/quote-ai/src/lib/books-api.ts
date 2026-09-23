// Phase 88 — the books: bank lines matched to costs and payments, crew
// materials claims matched to receipts, and the month-end close.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type CostCategory = "materials" | "labour" | "subcontractor" | "permits_fees" | "equipment" | "misc";

export type BooksOverviewDto =
  | { enabled: false; requiredPlan: string }
  | {
      enabled: true;
      today: string;
      bank: { onPlan: boolean; requiredPlan: string; connected: boolean; account: { name: string; institution: string; last4: string | null } | null; lastSyncedAt: string | null };
      books: { provider: "quickbooks" | "wave"; name: string; paymentsPulledAt: string | null } | null;
    };

type BankMatchDto =
  | { kind: "cost"; id: string; label: string; date: string; amountCents: number; status: string; projectId: string | null; projectName: string | null }
  | { kind: "payment"; id: string; invoiceId: string; invoiceNumber: string; customer: string; date: string; amountCents: number; method: string };

export type BankLineDto = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  status: "unmatched" | "matched" | "ignored";
  autoMatched: boolean;
  match: BankMatchDto | null;
};

export type BankCandidatesDto = {
  direction: "in" | "out";
  costs: { id: string; vendor: string; description: string; date: string; totalCents: number; status: string; source: string; projectName: string | null }[];
  payments: { id: string; invoiceId: string; invoiceNumber: string; customer: string; date: string; amountCents: number; method: string }[];
  invoices: { id: string; number: string; customer: string; balanceCents: number; dueDate: string; status: string; exact: boolean }[];
};

export type ClaimDto = {
  reportId: string;
  costEntryId: string;
  authorName: string;
  body: string;
  reportedAt: string;
  projectId: string | null;
  projectName: string | null;
  date: string;
  totalCents: number;
  status: string;
  receipts: { id: string; vendor: string; description: string; date: string; totalCents: number; taxCents: number; status: string; projectId: string | null }[];
};

type CheckKey = "bank_unmatched" | "payments_unbanked" | "costs_pending" | "claims_open" | "tax_unsplit" | "invoices_draft" | "time_unapproved" | "not_in_books";

export type CloseDto = {
  month: string;
  first: string;
  last: string;
  books: "quickbooks" | "wave" | null;
  bankFeed: boolean;
  open: number;
  items: { key: CheckKey; applies: boolean; count: number; cents: number; href: string; rows: { id: string; label: string; date: string; cents: number; href: string }[] }[];
  closed: { month: string; closedAt: string; closedByName: string | null; note: string } | null;
  changedSinceClose: CheckKey[];
  closedMonths: string[];
};

export const booksApi = {
  overview: () => req<BooksOverviewDto>("/api/books/overview"),
  bank: (status: "unmatched" | "matched" | "ignored" | "all") => req<{ lines: BankLineDto[] }>(`/api/books/bank?status=${status}`),
  syncBank: () => req<{ fetched: number; matched: number }>("/api/books/bank/sync", { method: "POST" }),
  candidates: (id: string) => req<BankCandidatesDto>(`/api/books/bank/${id}/candidates`),
  matchCost: (id: string, costEntryId: string) => req<{ success: true }>(`/api/books/bank/${id}/match`, { method: "POST", body: json({ costEntryId }) }),
  matchPayment: (id: string, paymentId: string) => req<{ success: true }>(`/api/books/bank/${id}/match`, { method: "POST", body: json({ paymentId }) }),
  recordPayment: (id: string, invoiceId: string) => req<{ paymentId: string }>(`/api/books/bank/${id}/record-payment`, { method: "POST", body: json({ invoiceId }) }),
  createCost: (id: string, category: CostCategory, projectId: string | null) => req<{ costEntryId: string }>(`/api/books/bank/${id}/create-cost`, { method: "POST", body: json({ category, projectId }) }),
  unmatch: (id: string) => req<{ success: true }>(`/api/books/bank/${id}/unmatch`, { method: "POST" }),
  ignore: (id: string) => req<{ success: true }>(`/api/books/bank/${id}/ignore`, { method: "POST" }),
  claims: () => req<{ claims: ClaimDto[] }>("/api/books/claims"),
  mergeClaim: (costEntryId: string, receiptId: string) => req<{ costEntryId: string }>(`/api/books/claims/${costEntryId}/merge`, { method: "POST", body: json({ receiptId }) }),
  close: (month?: string) => req<CloseDto>(`/api/books/close${month ? `?month=${month}` : ""}`),
  closeMonth: (month: string, note: string) => req<{ close: CloseDto["closed"] }>("/api/books/close", { method: "POST", body: json({ month, note }) }),
  reopenMonth: (month: string) => req<{ success: true }>("/api/books/close/reopen", { method: "POST", body: json({ month }) }),
};
