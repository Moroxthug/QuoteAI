// Pocket 128.5 (Imports): the rows of a spreadsheet the phone mapped to clients, sorted into what can be added at once, what looks like a client the company already has
// (the person decides), and what is wrong with the row. Pure: the route reads the clients and writes the rows.

export type ClientRow = { row: number; name: string; phone?: string; email?: string; address?: string; notes?: string };
export type ExistingClient = { id: string; name: string; email: string | null; phone: string | null; dedupKey: string };

export type RowError = { row: number; name: string; why: "no_name" | "short_phone" | "bad_email" };
export type RowMatch = { row: number; name: string; existingId: string; existingName: string; why: "email" | "phone" };
export type Plan = { clean: ClientRow[]; matches: RowMatch[]; errors: RowError[]; skipped: number };

const digits = (s: string | null | undefined): string => (s ?? "").replace(/\D/g, "");
const key = (r: { name: string; email?: string | null; phone?: string | null }): string => `${r.name.trim().toLowerCase()}|${(r.email ?? "").trim().toLowerCase()}|${(r.phone ?? "").trim().toLowerCase()}`;

/** A phone is ten digits (an eleventh is the leading 1); anything shorter is a typo. */
export const phoneOk = (p: string | undefined): boolean => { const d = digits(p); return d.length === 10 || (d.length === 11 && d.startsWith("1")); };

export function planClientRows(rows: ClientRow[], existing: ExistingClient[]): Plan {
  const clean: ClientRow[] = [];
  const matches: RowMatch[] = [];
  const errors: RowError[] = [];
  let skipped = 0;
  const seen = new Set(existing.map((c) => c.dedupKey));
  const byEmail = new Map<string, ExistingClient>();
  const byPhone = new Map<string, ExistingClient>();
  for (const c of existing) {
    if (c.email) byEmail.set(c.email.trim().toLowerCase(), c);
    if (digits(c.phone).length >= 10) byPhone.set(digits(c.phone).slice(-10), c);
  }
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) { errors.push({ row: r.row, name: "", why: "no_name" }); continue; }
    if (r.email && !r.email.includes("@")) { errors.push({ row: r.row, name, why: "bad_email" }); continue; }
    if (r.phone && r.phone.trim() && !phoneOk(r.phone)) { errors.push({ row: r.row, name, why: "short_phone" }); continue; }
    const k = key({ name, email: r.email, phone: r.phone });
    if (seen.has(k)) { skipped++; continue; }
    const hit = (r.email && byEmail.get(r.email.trim().toLowerCase())) || (r.phone && digits(r.phone).length >= 10 ? byPhone.get(digits(r.phone).slice(-10)) : undefined) || null;
    if (hit) { matches.push({ row: r.row, name, existingId: hit.id, existingName: hit.name, why: r.email && byEmail.get(r.email.trim().toLowerCase()) ? "email" : "phone" }); seen.add(k); continue; }
    seen.add(k);
    clean.push({ ...r, name });
  }
  return { clean, matches, errors, skipped };
}
