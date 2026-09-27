import type { QuoteSummary } from "@workspace/api-client-react";

/**
 * Phase 105 — one status chip for a quote, list and page alike. "Sent" and
 * "Accepted" used to show as "Unlocked" (the payment state, not where the
 * quote is with the client).
 */
export function quoteStatusChip(q: Pick<QuoteSummary, "status"> & { sentAt?: string | null }, t: (key: string) => string): { cls: string; label: string } {
  if (q.status === "accepted") return { cls: "chip-green", label: t("quotes.m.statusAccepted") };
  if (q.status === "unlocked" && q.sentAt) return { cls: "chip-teal", label: t("quotes.m.statusSent") };
  if (q.status === "unlocked") return { cls: "chip-green", label: t("dashboard.quotesList.statusUnlocked") };
  if (q.status === "pending_payment") return { cls: "chip-yellow", label: t("dashboard.quotesList.statusPending") };
  return { cls: "chip-grey", label: t("dashboard.quotesList.statusDraft") };
}
