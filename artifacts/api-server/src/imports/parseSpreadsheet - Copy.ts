import { createRequire } from "node:module";
import type { ImportedQuoteExtraction } from "@workspace/db";
import { logger } from "../lib/logger.js";

const _require = createRequire(import.meta.url);

// ── Phase 14: CSV/Excel row → quote-import-candidate mapper ─────────────────
// Every quote a company already has lives as one spreadsheet row. Column
// names vary wildly, so headers are matched against a set of common aliases
// rather than requiring an exact template — the template is only a
// convenience, not a requirement.

const FIELD_ALIASES: Record<string, string[]> = {
  clientName: ["clientname", "client", "customer", "customername", "name", "fullname"],
  email: ["email", "emailaddress", "e-mail"],
  phone: ["phone", "phonenumber", "telephone", "tel", "cell", "mobile"],
  address: ["address", "streetaddress", "street"],
  city: ["city", "town"],
  province: ["province", "state"],
  postalCode: ["postalcode", "postal", "zip", "zipcode"],
  date: ["date", "quotedate", "created", "createddate"],
  status: ["status"],
  description: ["description", "item", "items", "work", "scope", "workdescription"],
  quantity: ["quantity", "qty"],
  unitPrice: ["unitprice", "price", "rate", "priceperunit"],
  total: ["total", "amount", "totalamount", "value", "price"],
  notes: ["notes", "note", "comments", "comment"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const match = normalized.find((h) => aliases.includes(h.norm));
    if (match) map[field] = match.raw;
  }
  return map;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    if (cleaned && Number.isFinite(Number(cleaned))) return Number(cleaned);
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  // xlsx hands back JS Date objects for real date cells; strings otherwise.
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Reads a CSV or XLSX buffer and returns one raw row + one normalized extraction per data row. */
export function parseSpreadsheet(buffer: Buffer): { rawRow: Record<string, string>; extraction: ImportedQuoteExtraction }[] {
  const XLSX = _require("xlsx") as {
    read: (data: Buffer, opts: { type: "buffer"; cellDates: boolean }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json: (sheet: unknown, opts?: Record<string, unknown>) => Record<string, unknown>[] };
  };
  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (err) {
    logger.warn({ err }, "Failed to parse import spreadsheet");
    return [];
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]!);
  const headerMap = buildHeaderMap(headers);

  return rows
    .map((row) => {
      const rawRow: Record<string, string> = {};
      for (const h of headers) rawRow[h] = str(row[h]) ?? "";

      const get = (field: string) => (headerMap[field] ? row[headerMap[field]!] : undefined);
      const clientName = str(get("clientName"));
      const description = str(get("description"));
      const total = num(get("total"));
      const quantity = num(get("quantity"));
      const unitPrice = num(get("unitPrice"));
      const statusRaw = (str(get("status")) ?? "").toLowerCase();

      const extraction: ImportedQuoteExtraction = {
        clientName,
        email: str(get("email")),
        phone: str(get("phone")),
        address: str(get("address")),
        city: str(get("city")),
        province: str(get("province")),
        postalCode: str(get("postalCode")),
        date: toIsoDate(get("date")),
        status: statusRaw.includes("accept") || statusRaw.includes("won") || statusRaw.includes("complet") ? "accepted" : "draft",
        items: description || total !== null ? [{ description: description ?? "Imported quote", quantity, unitPrice, total: total ?? (quantity !== null && unitPrice !== null ? Math.round(quantity * unitPrice * 100) / 100 : null) }] : [],
        total: total ?? (quantity !== null && unitPrice !== null ? Math.round(quantity * unitPrice * 100) / 100 : null),
        notes: str(get("notes")),
        confidence: clientName ? "high" : "low",
      };
      return { rawRow, extraction };
    })
    .filter((r) => r.extraction.clientName || r.extraction.total !== null || r.extraction.items.length > 0); // skip fully blank rows
}
