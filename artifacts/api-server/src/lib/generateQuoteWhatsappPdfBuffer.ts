// Phase 71: the WhatsApp bot sends the same document the dashboard produces
// (quotes/pdf.ts, bilingual, province tax lines). Before, this file carried a
// 330-line copy of the layout that had already drifted (English-only, one
// "TAX" line) — kept as a named export so routes/whatsapp.ts and the e2e PDF
// matrix don't change.
import { generateQuotePdfBuffer, type QuoteRow, type ProfileRow } from "../quotes/pdf.js";

export async function generateQuoteWhatsappPdfBuffer(quote: QuoteRow, profile: ProfileRow): Promise<Buffer> {
  return generateQuotePdfBuffer(quote, profile, false);
}
