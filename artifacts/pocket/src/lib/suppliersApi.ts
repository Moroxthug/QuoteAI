// Suppliers, Supplier and the order list: the server calls (routes/suppliers.ts). The receipts' job is set on the cost entry (routes/costs.ts).
import { api } from "./api";
import type { OrderDto, SupplierDetail, SupplierDto, SuppliersOverview } from "./suppliers";

const id = encodeURIComponent;

export type SupplierBody = {
  name: string; category: string; kind: "account" | "counter"; repName: string; repRole: string; phone: string; email: string; accountNo: string; terms: string; address: string;
  delivers: string; hours: string; notes: string; proDiscountPct: number | null;
};

export type NewOrder = { inventoryItemId?: string | null; itemName: string; unit: string; qty: number; unitPriceCents?: number | null; destination?: string };

export const suppliersApi = {
  overview: () => api<SuppliersOverview>("/api/suppliers/overview"),
  get: (sid: string) => api<SupplierDetail>(`/api/suppliers/${id(sid)}`),
  add: (body: SupplierBody) => api<{ supplier: SupplierDto }>("/api/suppliers", { method: "POST", body }),
  update: (sid: string, body: Partial<SupplierBody>) => api<{ supplier: SupplierDto }>(`/api/suppliers/${id(sid)}`, { method: "PUT", body }),
  archive: (sid: string) => api<{ archived: boolean }>(`/api/suppliers/${id(sid)}/archive`, { method: "POST", body: {} }),
  fromReceipts: () => api<{ created: number }>("/api/suppliers/from-receipts", { method: "POST", body: {} }),
  /** What is on the order list (not yet ordered), with the supplier's name. */
  listed: () => api<{ items: (OrderDto & { supplierName: string })[] }>("/api/suppliers/orders"),
  addOrder: (sid: string, body: NewOrder) => api<{ order: OrderDto }>(`/api/suppliers/${id(sid)}/orders`, { method: "POST", body }),
  changeOrder: (oid: string, body: { supplierId?: string; qty?: number; unitPriceCents?: number | null; destination?: string }) => api<{ order: OrderDto }>(`/api/suppliers/orders/${id(oid)}`, { method: "PUT", body }),
  /** The list went to the supplier: what was on it is now ordered. */
  sent: (sid: string) => api<{ ordered: number }>(`/api/suppliers/${id(sid)}/orders/sent`, { method: "POST", body: {} }),
  /** Put a receipt on a job (the cost entry's job; the first id in the path is the job it goes to). */
  matchReceipt: (projectId: string, costId: string) => api<unknown>(`/api/jobs/${id(projectId)}/costs/${id(costId)}`, { method: "PUT", body: { projectId } }),
};
