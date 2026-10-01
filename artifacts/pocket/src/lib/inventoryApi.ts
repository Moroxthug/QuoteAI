// Inventory's server calls (routes/inventory.ts). A reorder is an order on the order list: routes/suppliers.ts (`suppliersApi.addOrder`).
import { api } from "./api";
import type { Count, InventoryOverview, StockItem } from "./inventory";

const id = encodeURIComponent;

export const inventoryApi = {
  overview: () => api<InventoryOverview>("/api/inventory/overview"),
  addItem: (body: { name: string; unit: string; par: number; shopQty: number }) => api<{ item: StockItem }>("/api/inventory/items", { method: "POST", body }),
  count: (iid: string, body: Count) => api<{ item: StockItem }>(`/api/inventory/items/${id(iid)}`, { method: "PUT", body }),
  fromReceipts: () => api<{ created: number }>("/api/inventory/from-receipts", { method: "POST", body: {} }),
};
