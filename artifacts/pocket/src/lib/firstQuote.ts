// The guided first quote (FirstQuote.dc.html): describe -> check -> send -> done.
// Pure rules, ported from the web's first-run.ts (Phase 121): the stage the phone remembers per
// person, the "3 min" label, and how a priced quote is laid out on the check step.
export type FirstQuoteStage = "compose" | "review" | "done";
export type FirstQuoteStep = "describe" | "check" | "send" | "done";

export const STEP_ORDER: readonly FirstQuoteStep[] = ["describe", "check", "send", "done"];

export const stageKey = (userId: string) => `quoteai.firstQuote.${userId}`;
/** The quote the guide wrote, so reopening the app resumes at "check". */
export const quoteKey = (userId: string) => `quoteai.firstQuote.quote.${userId}`;
/** What the done step shows once the quote went out (so a skipped guide never claims it did). */
export const sentKey = (userId: string) => `quoteai.firstQuote.sent.${userId}`;
/** When the guide was first opened, the fallback for the elapsed time when the account's age is unknown. */
export const openedKey = (userId: string) => `quoteai.firstQuote.opened.${userId}`;

export function parseStage(v: string | null | undefined): FirstQuoteStage | null {
  return v === "compose" || v === "review" || v === "done" ? v : null;
}

export type Sent = { email: string; elapsed: string | null };
export function parseSent(v: string | null | undefined): Sent | null {
  if (!v) return null;
  try {
    const o = JSON.parse(v) as { email?: unknown; elapsed?: unknown };
    if (typeof o.email !== "string" || !o.email) return null;
    return { email: o.email, elapsed: typeof o.elapsed === "string" ? o.elapsed : null };
  } catch {
    return null;
  }
}

/** The stage the phone stores for a step: describing is "compose", checking and sending are "review". */
export function stageForStep(step: FirstQuoteStep): FirstQuoteStage {
  return step === "describe" ? "compose" : step === "done" ? "done" : "review";
}

/** Where reopening lands: a finished guide shows its done step; a saved quote resumes at "check". */
export function resumeStep(stage: FirstQuoteStage | null, hasQuote: boolean, sent: Sent | null): FirstQuoteStep {
  if (stage === "done") return sent ? "done" : "describe";
  if (stage === "review" && hasQuote) return "check";
  return "describe";
}

/** Back is on the check and send steps only, one step at a time. */
export function backStep(step: FirstQuoteStep): FirstQuoteStep | null {
  return step === "check" ? "describe" : step === "send" ? "check" : null;
}

export type StepState = "done" | "now" | "later";
export function stepStates(step: FirstQuoteStep): StepState[] {
  const idx = Math.max(0, STEP_ORDER.indexOf(step));
  return [0, 1, 2].map((i) => (i < idx ? "done" : i === idx ? "now" : "later"));
}

/** "3 min" / "1 h 5 min": how long from account to first quote sent (web first-run.ts). */
export function elapsedLabel(fromIso: string | null | undefined, now: number): string | null {
  if (!fromIso) return null;
  const start = Date.parse(fromIso);
  if (!Number.isFinite(start) || now < start) return null;
  const mins = Math.max(1, Math.round((now - start) / 60_000));
  if (mins > 24 * 60) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The account's creation time as the session hands it (a Date or an ISO string). */
export function createdAtIso(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  return typeof v === "string" && v ? v : null;
}

/** The "From sign-up to sent" figure: the account's age, or the time since the guide was opened. */
export function elapsedSince(createdAt: unknown, openedAt: number | null, now: number): string | null {
  return elapsedLabel(createdAtIso(createdAt), now) ?? (openedAt ? elapsedLabel(new Date(openedAt).toISOString(), now) : null);
}

// ── The priced quote, as the check step lays it out ────────────────────────

export type PricedLine = { name: string; qty: number; unit: string; unitPrice: number; total: number };
export type PricedTax = { label: string; rate: number; amount: number };
export type QuoteLike = {
  titoloPreventivoRiga1?: string | null;
  descrizioneGenerale?: string;
  numeroPreventivoData?: string | null;
  items?: { descrizione: string; quantita: number; unita: string; prezzoUnitario: number; totale: number }[];
  capitoli?: { voci: { descrizione: string; um: string; quantita: number; prezzoUnitario: number; totale: number }[] }[];
  sconto?: { percentuale: number; importoScontato: number } | null;
  taxLines?: { label: string; rate: number; amount: number }[];
  ivaPercentuale?: number;
  ivaValore?: number;
  subtotale?: number;
  totale?: number;
};

export function pricedLines(q: QuoteLike): PricedLine[] {
  const chapters = (q.capitoli ?? []).flatMap((c) => c.voci ?? []);
  if (chapters.length) return chapters.map((v) => ({ name: v.descrizione, qty: v.quantita, unit: v.um, unitPrice: v.prezzoUnitario, total: v.totale }));
  return (q.items ?? []).map((v) => ({ name: v.descrizione, qty: v.quantita, unit: v.unita, unitPrice: v.prezzoUnitario, total: v.totale }));
}

/** The statutory tax lines (GST/QST, HST...) when the server gave them, else one line from the rate. */
export function pricedTaxes(q: QuoteLike): PricedTax[] {
  if (q.taxLines && q.taxLines.length) return q.taxLines.map((t) => ({ label: t.label, rate: t.rate, amount: t.amount }));
  if (q.ivaValore && q.ivaValore > 0) return [{ label: "", rate: q.ivaPercentuale ?? 0, amount: q.ivaValore }];
  return [];
}

/** The quote's title: its heading, else the first sentence of the description. */
export function quoteTitle(q: QuoteLike): string {
  const head = q.titoloPreventivoRiga1?.trim();
  if (head) return head;
  const first = (q.descrizioneGenerale ?? "").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return first.length > 80 ? `${first.slice(0, 77).trimEnd()}…` : first;
}

/** Fraction digits to show a quantity with: whole numbers plain, anything else to 2 places. */
export const qtyDigits = (n: number) => (Number.isInteger(n) ? 0 : 2);
