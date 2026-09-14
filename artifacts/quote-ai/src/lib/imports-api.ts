export type ImportBatchKind = "csv" | "xlsx" | "pdf";
export type ImportBatchStatus = "processing" | "done" | "error";
export type ImportCandidateStatus = "pending_review" | "confirmed" | "rejected";

export type ImportedQuoteItem = { description: string; quantity: number | null; unitPrice: number | null; total: number | null };

export type ImportedQuoteExtraction = {
  clientName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  date: string | null;
  status: "draft" | "accepted";
  items: ImportedQuoteItem[];
  total: number | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

export type ImportBatchDto = {
  id: string;
  userId: string;
  kind: ImportBatchKind;
  fileName: string;
  status: ImportBatchStatus;
  totalRows: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportCandidateDto = {
  id: string;
  batchId: string;
  userId: string;
  rowIndex: number;
  status: ImportCandidateStatus;
  rawRow: Record<string, string> | null;
  extraction: ImportedQuoteExtraction;
  matchedClientId: string | null;
  createdQuoteId: string | null;
  errorMessage: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = body.error;
    err.status = res.status;
    throw err;
  }
  return body;
}

export const importsApi = {
  templateUrl: "/api/imports/template.csv",
  listBatches: () => req<{ batches: ImportBatchDto[] }>("/api/imports/batches"),
  listCandidates: (params?: { batchId?: string; status?: ImportCandidateStatus | "all" }) => {
    const qs = new URLSearchParams();
    if (params?.batchId) qs.set("batchId", params.batchId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return req<{ candidates: ImportCandidateDto[] }>(`/api/imports/candidates${suffix}`);
  },
  uploadSpreadsheet: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return req<{ batchId: string; totalRows: number }>("/api/imports/spreadsheet", { method: "POST", body: form });
  },
  uploadPdfs: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return req<{ batchId: string; totalRows: number; ok: number; failed: number }>("/api/imports/pdf", { method: "POST", body: form });
  },
  updateCandidate: (id: string, extraction: ImportedQuoteExtraction) =>
    req<{ candidate: ImportCandidateDto }>(`/api/imports/candidates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraction }) }),
  confirm: (id: string) => req<{ quoteId: string; clientId: string | null }>(`/api/imports/candidates/${id}/confirm`, { method: "POST" }),
  reject: (id: string) => req<{ success: true }>(`/api/imports/candidates/${id}/reject`, { method: "POST" }),
  confirmAll: (batchId: string) => req<{ confirmed: number; skipped: number }>(`/api/imports/batches/${batchId}/confirm-all`, { method: "POST" }),
  deleteBatch: (batchId: string) => req<{ success: true }>(`/api/imports/batches/${batchId}`, { method: "DELETE" }),
};
