// SystemStates.dc.html, "Offline and sync": the rules behind what the office phone keeps while it has no signal and how it is sent later. Pure, so they are
// tested (sync.test.ts); the store that keeps the waiting changes is lib/outbox.ts.
//  - A change made with no signal waits on the phone ("3 waiting to send"); two edits to the same quote become one, the later winning per field.
//  - An edit says which version it was made against (X-Base-Version, the row's updatedAt). When the server answers 409 STALE with the row as it is now, the
//    edit is merged field by field: fields only this phone changed go again on the new version; a field both sides changed differently is a conflict
//    ("Q-2026-119 was also changed on another device": Keep mine / Keep theirs per field).
//  - Any other refusal is "Rejected by the server": the change, from → to, when, and why; Retry or Discard.

export type OpKind = "quote" | "jobNote";

/** A conflicting field group on a quote: the edit's keys that travel together. */
export type FieldGroup = "lines" | "schedule" | "title" | "notes" | "exclusions" | "discount" | "template" | "client" | "terms" | "summary";

export type Conflict = {
  /** The row as the server has it now (its updatedAt is the new base). */
  current: Record<string, unknown>;
  updatedAt: string;
  groups: FieldGroup[];
  picks: Partial<Record<FieldGroup, "mine" | "theirs">>;
};

export type Rejection = { status: number; code?: string; message?: string };

export type Op = {
  id: string;
  kind: OpKind;
  method: "PUT" | "POST";
  path: string;
  body: Record<string, unknown>;
  /** The version the edit was made against; none for a new note. */
  base?: string | null;
  /** The edited fields as they were before this phone changed them (to tell what the server changed meanwhile). */
  before?: Record<string, unknown>;
  /** What the change is about, for the rows: the quote's number or the job's name. */
  ref: string;
  /** When the person made it (the latest edit for a merged one). */
  at: string;
  state: "waiting" | "rejected" | "conflict";
  rejected?: Rejection;
  conflict?: Conflict;
};

const GROUPS: Record<string, FieldGroup> = {
  capitoli: "lines", items: "lines", subtotale: "lines", ivaValore: "lines", ivaPercentuale: "lines", totale: "lines", taxLines: "lines",
  paymentSchedule: "schedule", condizioniPagamento: "terms",
  titoloPreventivoRiga1: "title", titoloPreventivoRiga2: "title",
  note: "notes", exclusions: "exclusions", sconto: "discount", templateId: "template",
  clientData: "client", province: "client", descrizioneGenerale: "summary",
};
export const groupOf = (key: string): FieldGroup => GROUPS[key] ?? "summary";

/** Same value, whatever the key order (the server and the phone may build objects differently). */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b; // null and undefined are both "not set"
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((v, i) => same(v, (b as unknown[])[i]));
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** A second edit to something already waiting: one op, the later value winning per field; `before` keeps the first edit's view. */
export function coalesce(waiting: Op, next: Op): Op {
  const before = { ...(next.before ?? {}), ...(waiting.before ?? {}) };
  return { ...waiting, body: { ...waiting.body, ...next.body }, before, at: next.at };
}

/** Whether a new change folds into one already waiting (edits to the same row; notes never fold). */
export const foldsInto = (waiting: Op, next: Op): boolean =>
  waiting.state === "waiting" && waiting.kind === next.kind && next.method === "PUT" && waiting.method === "PUT" && waiting.path === next.path;

export type StaleOutcome = { kind: "resend"; op: Op } | { kind: "conflict"; op: Op } | { kind: "done" };

/**
 * The server said STALE and sent the row as it is now. Fields the other side didn't touch (or set to what this phone wants) go again on the new
 * version; groups both changed differently become a conflict. "done" when nothing of this edit is left to send.
 */
export function mergeStale(op: Op, current: Record<string, unknown>, updatedAt: string): StaleOutcome {
  const before = op.before ?? {};
  const keys = Object.keys(op.body);
  const clash = new Set<FieldGroup>();
  const send: Record<string, unknown> = {};
  for (const k of keys) {
    const mine = op.body[k];
    const theirs = current[k];
    const changedThere = k in before ? !same(before[k], theirs) : false;
    if (same(mine, theirs)) continue; // already what this phone wants
    if (k in before && same(before[k], mine)) continue; // sent along, but not changed here: the server's value stands
    if (changedThere) clash.add(groupOf(k));
    send[k] = mine;
  }
  if (clash.size === 0) {
    if (Object.keys(send).length === 0) return { kind: "done" };
    return { kind: "resend", op: { ...op, body: send, base: updatedAt, state: "waiting", conflict: undefined } };
  }
  // Keys of a clashing group stay in the body until the person picks; the rest goes with them.
  return { kind: "conflict", op: { ...op, body: send, state: "conflict", conflict: { current, updatedAt, groups: [...clash], picks: {} } } };
}

/** After the person picked a side for every group: what to send ("theirs" drops that group's keys), on the server's version. */
export function resolve(op: Op): StaleOutcome {
  const c = op.conflict;
  if (!c) return { kind: "resend", op };
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(op.body)) if (c.picks[groupOf(k)] !== "theirs") body[k] = v;
  if (Object.keys(body).length === 0) return { kind: "done" };
  return { kind: "resend", op: { ...op, body, base: c.updatedAt, state: "waiting", conflict: undefined } };
}

export const allPicked = (c: Conflict): boolean => c.groups.every((g) => c.picks[g]);

/** How the server's refusal reads. A 409 STALE is not a refusal (it is merged); everything else that isn't "no signal" or a server error is. */
export type Why = "sent" | "role" | "gone" | "locked" | "plan" | "invalid" | "other";
export function whyRejected(r: Rejection): Why {
  if (r.code === "LOCKED") return "locked";
  if (r.code === "PRO_REQUIRED" || r.status === 402) return "plan";
  if (r.status === 403) return "role";
  if (r.status === 404 || r.status === 410) return "gone";
  if (r.code === "QUOTE_SENT" || r.code === "ALREADY_SENT") return "sent";
  if (r.status === 400 || r.status === 422) return "invalid";
  return "other";
}

/** What happens to an op after one try. */
export type Attempt = { ok: true } | { ok: false; status: number; code?: string; message?: string; current?: Record<string, unknown>; updatedAt?: string };
export type Next = { kind: "sent" } | { kind: "offline" } | { kind: "later" } | { kind: "stale"; outcome: StaleOutcome } | { kind: "rejected"; op: Op };

export function afterAttempt(op: Op, a: Attempt): Next {
  if (a.ok) return { kind: "sent" };
  if (a.status === 0) return { kind: "offline" };
  if (a.status >= 500 || a.status === 429) return { kind: "later" };
  if (a.status === 409 && a.code === "STALE" && a.current && a.updatedAt) return { kind: "stale", outcome: mergeStale(op, a.current, a.updatedAt) };
  return { kind: "rejected", op: { ...op, state: "rejected", rejected: { status: a.status, code: a.code, message: a.message } } };
}

/** "2 quote edits and a job note": the counts for the Sending row and the offline banner. */
export function counts(ops: Op[]): { quote: number; jobNote: number; total: number } {
  const waiting = ops.filter((o) => o.state === "waiting");
  const quote = waiting.filter((o) => o.kind === "quote").length;
  const jobNote = waiting.filter((o) => o.kind === "jobNote").length;
  return { quote, jobNote, total: waiting.length };
}

/** A quote with the waiting edits laid over it, so the screen shows what the person typed. */
export function overlay<T extends Record<string, unknown>>(row: T, ops: Op[], path: string): T {
  let out = row;
  for (const o of ops) if (o.path === path && o.method === "PUT" && o.state !== "rejected") out = { ...out, ...o.body };
  return out;
}

/** Photos waiting for Wi-Fi: the total for "6 photos waiting for Wi-Fi · 38 MB". */
export function photoTotals(photos: { size?: number }[]): { count: number; bytes: number } {
  return { count: photos.length, bytes: photos.reduce((s, p) => s + (p.size ?? 0), 0) };
}

/** Photos go now on Wi-Fi; on mobile data they wait unless the person tapped Send now. */
export const photosMaySend = (net: { online: boolean; wifi: boolean }, forced: boolean): boolean => net.online && (net.wifi || forced);
