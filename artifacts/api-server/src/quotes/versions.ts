// Quote versions (Pocket, Phase 125). A quote the client already has, once edited, becomes the next version: the
// old one is kept (quote_versions) and the edits go into the new one until the quote is sent again.
import type { quotesTable } from "@workspace/db";

type QuoteRow = typeof quotesTable.$inferSelect;

/** True when saving an edit must first keep the current version and start the next one. */
export function startsNewVersion(q: Pick<QuoteRow, "sentAt" | "status" | "revisionOpen">): boolean {
  return !!q.sentAt && q.status === "unlocked" && !q.revisionOpen;
}

/** What the client could see of this version. */
export function snapshotOf(q: QuoteRow) {
  return {
    numeroPreventivoData: q.numeroPreventivoData,
    titoloPreventivoRiga1: q.titoloPreventivoRiga1,
    titoloPreventivoRiga2: q.titoloPreventivoRiga2,
    descrizioneGenerale: q.descrizioneGenerale,
    clientData: q.clientData,
    capitoli: q.capitoli,
    items: q.items,
    sconto: q.sconto,
    exclusions: q.exclusions,
    condizioniPagamento: q.condizioniPagamento,
    paymentSchedule: q.paymentSchedule,
    note: q.note,
    subtotale: q.subtotale,
    ivaPercentuale: q.ivaPercentuale,
    ivaValore: q.ivaValore,
    totale: q.totale,
    sentAt: q.sentAt,
  };
}
