// Archive: the pure parts. The list by month with a type filter and a search, and what each kind can do (everything comes back; only a quote, an invoice and a job can be deleted for good).
export type Kind = "quote" | "client" | "invoice" | "job" | "contract";
export type ArchiveItem = { id: string; type: Kind; title: string; detail: string; state: string; amountCents: number | null; archivedAt: string; archivedByName: string | null };

export const KINDS: Kind[] = ["quote", "job", "client", "invoice", "contract"];
export const FILTERS: ("all" | Kind)[] = ["all", ...KINDS];
const DELETABLE: Kind[] = ["quote", "invoice", "job"];
export const canDelete = (k: Kind): boolean => DELETABLE.includes(k);

/** Matches the client's name, what it was, its kind and how it ended, ignoring case and accents. */
export function matches(i: ArchiveItem, term: string): boolean {
  const q = fold(term);
  return !q || fold(`${i.title} ${i.detail} ${i.type} ${i.state}`).includes(q);
}
const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const keyOfMonth = (iso: string): string => iso.slice(0, 7);

/** Newest month first, each month's rows newest first. */
export function byMonth(items: ArchiveItem[]): { month: string; rows: ArchiveItem[] }[] {
  const out = new Map<string, ArchiveItem[]>();
  for (const i of [...items].sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1))) {
    const k = keyOfMonth(i.archivedAt);
    out.set(k, [...(out.get(k) ?? []), i]);
  }
  return [...out.entries()].map(([month, rows]) => ({ month, rows }));
}

/** The title when the server found none (a quote with no client name). */
export const titleOf = (i: ArchiveItem, fallback: string): string => i.title.trim() || fallback;
