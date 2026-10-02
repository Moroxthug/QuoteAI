// QuickBooks Online: the pure parts. The sync log's rows become lines of the "Recent syncs" list (what was sent, whose, and how it went), the matching of tax codes and accounts
// is a list of rows with the one QuickBooks account each goes to, and the state is decided from the status and the unresolved failures.
export type Conn = {
  connected: boolean; available?: boolean; companyName?: string | null; isEnabled?: boolean; lastSyncedAt?: string | null; hasPaymentAccount?: boolean; paymentAccountName?: string | null;
  incomeAccountName?: string | null; depositAccountName?: string | null; categoryMap?: Record<string, string | null>; taxCodeMap?: Record<string, string>; taxSets?: string[]; pullPayments?: boolean; paymentsPulledAt?: string | null;
};
export type LogEntry = { id: string; entityType: string; entityId: string; qboId: string | null; status: string; error: string | null; createdAt: string };

export type Look = "on" | "attention" | "paused" | "off";
export function lookOf(c: Pick<Conn, "connected" | "isEnabled"> | undefined, failures: number): Look {
  if (!c?.connected) return "off";
  if (failures > 0) return "attention";
  return c.isEnabled === false ? "paused" : "on";
}

/** The newest row per thing, newest first; a failure still counts while that newest row is the failure (a retry that worked is a later row). */
export function newestPerEntity(entries: LogEntry[]): LogEntry[] {
  const seen = new Set<string>();
  const out: LogEntry[] = [];
  for (const e of entries) {
    const k = `${e.entityType}:${e.entityId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
export const failuresOf = (entries: LogEntry[]): LogEntry[] => newestPerEntity(entries).filter((e) => e.status === "failed" && e.entityType !== "payment_pull");

export type LogLine = { id: string; kind: "invoice" | "payment" | "expense" | "other"; entityType: string; entityId: string; title: string; failed: boolean; retryable: boolean; error: string | null; at: string };

/** A log row as a line: the invoice's number and client where they are known. */
export function logLines(entries: LogEntry[], invoices: { id: string; number: string; clientName: string | null }[], limit = 6): LogLine[] {
  const byId = new Map(invoices.map((i) => [i.id, i]));
  return newestPerEntity(entries).slice(0, limit).map((e) => {
    const inv = e.entityType === "invoice" ? byId.get(e.entityId) : undefined;
    const kind = e.entityType === "invoice" ? "invoice" : e.entityType === "invoice_payment" ? "payment" : e.entityType === "cost_entry" ? "expense" : "other";
    const title = inv ? [inv.number, inv.clientName].filter(Boolean).join(" · ") : "";
    return { id: e.id, kind, entityType: e.entityType, entityId: e.entityId, title, failed: e.status === "failed", retryable: e.status === "failed" && ["invoice", "cost_entry", "invoice_payment"].includes(e.entityType), error: e.error, at: e.createdAt };
  });
}

/** What QuickBooks says went wrong, trimmed to one short line. */
export function shortError(e: string | null, max = 90): string {
  const s = (e ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export type MapRowSpec = { key: string; kind: "tax" | "income" | "deposit" | "payment" | "materials"; label: string; to: string | null };
/** The matching list: a row for each tax set the invoices carry, then the income, deposit and payment accounts and the materials expense account. */
export function mapRows(c: Conn): MapRowSpec[] {
  const taxes: MapRowSpec[] = (c.taxSets ?? []).filter((s) => s !== "none").map((s) => ({ key: `tax:${s}`, kind: "tax", label: s, to: c.taxCodeMap?.[s] ?? null }));
  return [
    ...taxes,
    { key: "income", kind: "income", label: "", to: c.incomeAccountName ?? null },
    { key: "deposit", kind: "deposit", label: "", to: c.depositAccountName ?? null },
    { key: "payment", kind: "payment", label: "", to: c.paymentAccountName ?? null },
    { key: "materials", kind: "materials", label: "", to: c.categoryMap?.materials ?? null },
  ];
}
export const unmatchedTax = (c: Conn): string[] => (c.taxSets ?? []).filter((s) => s !== "none" && !c.taxCodeMap?.[s]);
