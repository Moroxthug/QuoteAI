// The Imports server calls (routes/imports.ts, routes/catalog.ts, routes/clients.ts).
import { api } from "./api";
import type { ClientRow } from "./imports";
import { uploadFile, type UploadFile } from "./jobUpload";
import { API_ORIGIN } from "./session";

export type Sheet = { fileName: string; headers: string[]; rows: string[][]; total: number };
export type RowMatch = { row: number; name: string; existingId: string; existingName: string; why: "email" | "phone" };
export type RowError = { row: number; name: string; why: "no_name" | "short_phone" | "bad_email" };
export type ClientsResult = { added: number; matches: RowMatch[]; errors: RowError[]; skipped: number };
export type Batch = { id: string; kind: "csv" | "xlsx" | "pdf"; fileName: string; status: "processing" | "done" | "error"; totalRows: number; createdAt: string };

export const importsApi = {
  sheet: (file: UploadFile) => uploadFile<Sheet>("/api/imports/sheet", "file", file, {}),
  clients: (rows: ClientRow[]) => api<ClientsResult>("/api/imports/clients", { method: "POST", body: { rows } }),
  batches: async (): Promise<{ items: Batch[] }> => ({ items: (await api<{ batches: Batch[] }>("/api/imports/batches")).batches ?? [] }),
  template: async (): Promise<string> => {
    const res = await fetch(`${API_ORIGIN}/api/imports/template.csv`);
    if (!res.ok) throw new Error(String(res.status));
    return res.text();
  },
  catalog: () => api<{ nome: string; um: string }[]>("/api/catalog"),
  bulkPrices: (items: { nome: string; um: string; prezzoUnitario: number; categoria?: string; note?: string }[]) => api<unknown>("/api/catalog/bulk", { method: "POST", body: items }),
  addClient: (d: { name: string; phone?: string; email?: string; address?: string; notes?: string }) => api<unknown>("/api/clients", { method: "POST", body: d }),
  fillClient: (id: string, d: Record<string, string>) => api<unknown>(`/api/clients/${encodeURIComponent(id)}/details`, { method: "PUT", body: d }),
};
