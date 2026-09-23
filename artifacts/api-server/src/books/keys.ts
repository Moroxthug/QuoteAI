import type { InvoiceTaxLine } from "@workspace/db";

// Phase 88: the two keys the accounting links and mappings are built on.
// Pure, so they are unit-tested without a database.

/** A name as a key: "  ACME Plumbing Inc. " and "acme plumbing inc" are one vendor; "Rénovations" and "Renovations" too. */
export function nameKey(name: string): string {
  return name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The tax an invoice carries as a mapping key: "HST 13%", "GST 5% + QST 9.975%",
 * "none". The rate is part of the key because HST 13% and HST 15% are
 * different QBO tax codes.
 */
export function taxSetKey(taxLines: Pick<InvoiceTaxLine, "code" | "rate">[]): string {
  const parts = taxLines.filter((l) => l.rate > 0).map((l) => `${l.code} ${l.rate}%`);
  return parts.length ? parts.join(" + ") : "none";
}
