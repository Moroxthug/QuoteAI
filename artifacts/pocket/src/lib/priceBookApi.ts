// The Price book's server calls (routes/catalog.ts). The same rows are the quote editor's price book sheet (`GET /api/catalog`).
import { api } from "./api";
import type { BookItem, BookOverview, PriceKind } from "./priceBook";

export type NewItem = { nome: string; um: string; prezzoUnitario: number; kind: PriceKind; unitCost?: number };

export const priceBookApi = {
  overview: () => api<BookOverview>("/api/catalog/overview"),
  add: (body: NewItem) => api<BookItem>("/api/catalog", { method: "POST", body }),
};
