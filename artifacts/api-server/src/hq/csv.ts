// Owner HQ (Phase 132): CSV for the accountant. Pure.

/** Dollars with two decimals from integer cents, no thousands separators (spreadsheets parse it as a number). */
export function centsToDecimal(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

/** One CSV field. Quotes when needed, and neutralizes spreadsheet formulas ("=", "+", "-", "@") in text the owner or a customer typed. */
export function csvField(v: string | number | null | undefined, opts: { numeric?: boolean } = {}): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (!opts.numeric && typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type CsvCell = string | number | null | undefined | { n: number };

/** Header row plus data rows, CRLF line ends. A `{ n }` cell is a number written as-is (negative amounts stay numbers). */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const line = (cells: CsvCell[]) => cells.map((c) => (typeof c === "object" && c !== null ? csvField(c.n, { numeric: true }) : csvField(c))).join(",");
  return [line(headers), ...rows.map(line)].join("\r\n") + "\r\n";
}
