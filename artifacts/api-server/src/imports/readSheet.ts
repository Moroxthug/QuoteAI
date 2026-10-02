import { createRequire } from "node:module";
import { logger } from "../lib/logger.js";

const _require = createRequire(import.meta.url);

export const SHEET_ROW_LIMIT = 5000;

/** The first sheet of a CSV or Excel file as text: the header row, then up to 5,000 rows (the phone maps the columns). */
export function readSheet(buffer: Buffer): { headers: string[]; rows: string[][]; total: number } | null {
  const XLSX = _require("xlsx") as {
    read: (data: Buffer, opts: { type: "buffer"; cellDates: boolean }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json: (sheet: unknown, opts?: Record<string, unknown>) => unknown[][] };
  };
  try {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const name = wb.SheetNames[0];
    if (!name) return null;
    const all = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false, blankrows: false });
    if (all.length < 2) return null;
    const cell = (v: unknown): string => String(v ?? "").trim();
    const headers = (all[0] ?? []).map((h, i) => cell(h) || `Column ${i + 1}`);
    const rows = all.slice(1).map((r) => headers.map((_, i) => cell(r[i]))).filter((r) => r.some(Boolean));
    return { headers, rows: rows.slice(0, SHEET_ROW_LIMIT), total: rows.length };
  } catch (err) {
    logger.warn({ err }, "Failed to read an import sheet");
    return null;
  }
}
