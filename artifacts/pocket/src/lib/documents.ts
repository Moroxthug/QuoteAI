// Documents (Documents.dc.html): what the receipts and supplier invoices the AI read say about prices: the item that moved most with who charges
// what, the item that is nearly tracked, the key materials with their price lines, the list of what was read, and the files by job. Pure, so they
// are tested (documents.test.ts). The server's shapes are routes/documents.ts (GET /api/documents/overview).
import type { Locale } from "./format.ts";

export type DocState = "read" | "reading" | "check";
export type StorePrice = { name: string; at: string; price: number };
export type TrendNudge = { itemId: string; bookPrice: number; newPrice: number; newCost: number | null };
export type Trend = { name: string; from: number; to: number; changePct: number; points: number[]; invoices: number; stores: StorePrice[]; nudge: TrendNudge | null };
export type MaterialRow = { name: string; store: string; invoices: number; price: number; changePct: number; points: number[] };
export type DocRow = {
  id: string; name: string; fileName: string; at: string; state: DocState; prices: number; unread: number; changed: number; projectId: string | null; projectName: string | null; kind: "receipt" | "quote";
};
export type Folder = { id: string; name: string; clientName: string | null; count: number };

export type DocumentsOverview = {
  canUpload: boolean; files: number; readThisMonth: number; trend: Trend | null; almost: { name: string; have: number; need: number } | null;
  materials: MaterialRow[]; docs: DocRow[]; folders: Folder[]; company: number; fileUnder: { id: string; name: string }[];
};

/** Nothing has been read yet: the board's empty state. */
export const isEmpty = (o: DocumentsOverview): boolean => o.docs.length === 0 && !o.trend && o.materials.length === 0;

/** "8 %" / "8%": the size of a move, without a sign (the words say up or down). */
export function movePercent(pct: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(Math.abs(pct) / 100);
}

/** Up, down, or the same, as the board's cards tell it. */
export const directionOf = (pct: number): "up" | "down" | "flat" => (pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat");

/** The chart's points in a 320×64 box with 4 of padding, and where the last one sits. A single price is drawn as a level line. */
export function chartPoints(values: number[], w = 320, h = 64, pad = 4): { line: [number, number][]; last: [number, number] } {
  const vals = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const rg = mx - mn || 1;
  const line = vals.map((v, i) => [pad + (i * (w - 2 * pad)) / (vals.length - 1), mx === mn ? h / 2 : h - pad - ((v - mn) / rg) * (h - 2 * pad)] as [number, number]);
  return { line, last: line[line.length - 1]! };
}

/** The last `count` months up to and including `now`'s, short names by the locale ("Apr" … "Sep" / "avr." … "sept."). */
export function monthLabels(now: Date, locale: Locale, count = 6): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
  return Array.from({ length: count }, (_, i) => fmt.format(new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)));
}

/** The month the chart starts in ("April"), long name by the locale. */
export function sinceMonth(now: Date, locale: Locale, count = 6): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(now.getFullYear(), now.getMonth() - (count - 1), 1));
}

/** The cheapest of the stores that were looked at, when there is more than one and one stands alone: the board paints it green. */
export function cheapest(stores: StorePrice[]): string | null {
  if (stores.length < 2) return null;
  const low = Math.min(...stores.map((s) => s.price));
  const best = stores.filter((s) => s.price === low);
  return best.length === 1 ? best[0]!.name : null;
}

/** A price book nudge that was kept this month stays quiet until next month. */
export const keepKey = (itemId: string): string => `docs.keep.${itemId}`;
export const keepValue = (now: Date): string => `${now.getFullYear()}-${now.getMonth() + 1}`;
export const keptThisMonth = (stored: string | null, now: Date): boolean => stored === keepValue(now);

/** The folders the board draws: up to three jobs and Company (what is not filed under a job), each with how many files. */
export function foldersOf(o: Pick<DocumentsOverview, "folders" | "company">): { key: string; id: string | null; name: string | null; client: string | null; count: number }[] {
  const jobs = o.folders.map((f) => ({ key: f.id, id: f.id, name: f.name, client: f.clientName, count: f.count }));
  return o.company > 0 ? [...jobs, { key: "company", id: null, name: null, client: null, count: o.company }] : jobs;
}

/** The accepted upload types: what the receipt reader takes. */
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const isUploadable = (type: string): boolean => (UPLOAD_TYPES as readonly string[]).includes(type);

/** A job's name short enough for a chip: cut at 26 with an ellipsis. */
export const clip = (s: string, max = 26): string => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
