// Search (Search.dc.html): one box over quotes, clients, jobs, invoices and the app's own pages; what was searched for and opened lately is kept on the
// phone. Pure, so they are tested (search.test.ts).
export type SearchType = "quotes" | "clients" | "jobs" | "invoices" | "pages";
export const TYPES: SearchType[] = ["quotes", "clients", "jobs", "invoices", "pages"];
export type TypeFilter = "all" | SearchType;

/** Lower case without accents, so "cote" finds "Côté" and "Montréal". */
export const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Every word of the term is somewhere in the text, in any order ("hart overdue" finds INV-0412 of the Harts that is overdue). */
export function matchesTerm(haystack: string, term: string): boolean {
  const words = fold(term).split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const h = fold(haystack);
  return words.every((w) => h.includes(w));
}

/** A title split around the first thing the term matched, to draw the match in `acc`: [before, match, after]. */
export function highlight(title: string, term: string): [string, string, string] {
  const t = term.trim();
  if (!t) return [title, "", ""];
  const folded = fold(title);
  const i = folded.indexOf(fold(t));
  // Folding can change a string's length (a ligature), but not for the accents Canadian names carry; if it did, draw no highlight.
  if (i < 0 || folded.length !== title.length) return [title, "", ""];
  return [title.slice(0, i), title.slice(i, i + t.length), title.slice(i + t.length)];
}

export type Hit<T = unknown> = { type: SearchType; id: string; title: string; haystack: string; ref: T };

/** The hits for a term, each type capped (the board's "See all" shows the rest), with how many each type matched. */
export function search<T>(hits: Hit<T>[], term: string, type: TypeFilter, cap = 3): { groups: { type: SearchType; n: number; rows: Hit<T>[]; more: boolean }[]; counts: Record<TypeFilter, number> } {
  const found = hits.filter((h) => matchesTerm(h.haystack, term));
  const counts = { all: found.length, quotes: 0, clients: 0, jobs: 0, invoices: 0, pages: 0 } as Record<TypeFilter, number>;
  for (const h of found) counts[h.type]++;
  const groups = TYPES.filter((t) => type === "all" || type === t)
    .map((t) => {
      const rows = found.filter((h) => h.type === t);
      const lim = type === "all" ? cap : Infinity;
      return { type: t, n: rows.length, rows: rows.slice(0, lim), more: rows.length > lim };
    })
    .filter((g) => g.n > 0);
  return { groups, counts };
}

export const MAX_RECENT_SEARCHES = 6;
export const MAX_OPENED = 4;

export function parseList<T>(raw: string | null, ok: (v: unknown) => v is T): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter(ok) : [];
  } catch {
    return [];
  }
}

/** A search put first, once, kept to six. Nothing under two letters is remembered. */
export function addSearch(list: string[], term: string): string[] {
  const t = term.trim();
  if (t.length < 2) return list;
  return [t, ...list.filter((x) => fold(x) !== fold(t))].slice(0, MAX_RECENT_SEARCHES);
}

export type Opened = { type: Exclude<SearchType, "pages">; id: string; title: string; sub: string };
export const isOpened = (v: unknown): v is Opened => !!v && typeof v === "object" && typeof (v as Opened).id === "string" && typeof (v as Opened).title === "string" && ["quotes", "clients", "jobs", "invoices"].includes((v as Opened).type);

/** What was opened, newest first, once each, kept to four. */
export function addOpened(list: Opened[], o: Opened): Opened[] {
  return [o, ...list.filter((x) => !(x.type === o.type && x.id === o.id))].slice(0, MAX_OPENED);
}
