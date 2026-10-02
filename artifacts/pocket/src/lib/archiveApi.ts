// The archive's server calls (routes/archive.ts and each kind's own restore and delete).
import { api } from "./api";
import type { ArchiveItem, Kind } from "./archive";

const enc = encodeURIComponent;
const PATH: Record<Kind, string> = { quote: "quotes", job: "jobs", invoice: "invoices", contract: "contracts", client: "archive/clients" };

export const archiveApi = {
  list: () => api<{ items: ArchiveItem[] }>("/api/archive/overview"),
  restore: (type: Kind, id: string) => api<unknown>(`/api/${PATH[type]}/${enc(id)}/restore`, { method: "POST", body: {} }),
  /** Quotes, invoices and jobs only. */
  remove: (type: Kind, id: string) => api<unknown>(`/api/${PATH[type]}/${enc(id)}`, { method: "DELETE" }),
};
