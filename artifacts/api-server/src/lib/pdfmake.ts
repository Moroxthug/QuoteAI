import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// pdfmake's default export is ONE shared object. Until Phase 63 each PDF
// module (quotes, WhatsApp quote, invoices, contracts) assigned its own
// `lib.fonts = {…}` on that object and cached the result locally — so the
// last module to initialise won, and a warm function instance that had
// rendered an invoice (Roboto only) would then crash every contract signing
// with "Font 'Serif' in style 'bold' is not defined". Register the union
// once, here, and have every module take its instance from this file.

export type PdfMakeInstance = {
  fonts: Record<string, Record<string, string>>;
  createPdf(docDef: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};

const HELVETICA = { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" };
const TIMES = { normal: "Times-Roman", bold: "Times-Bold", italics: "Times-Italic", bolditalics: "Times-BoldItalic" };

export const PDF_FONTS: Record<string, Record<string, string>> = {
  Roboto: HELVETICA, // pdfmake's default font name, mapped onto the built-in Helvetica
  Helvetica: HELVETICA,
  Serif: TIMES, // contracts
};

let _instance: PdfMakeInstance | null = null;

export function getPdfmake(): PdfMakeInstance {
  if (_instance) return _instance;
  const lib = pdfmake as unknown as PdfMakeInstance;
  lib.fonts = PDF_FONTS;
  _instance = lib;
  return lib;
}
