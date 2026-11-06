// The real quote PDF, from the server's own generator, for the made-up company. No database: the logo goes in inline.
// From artifacts/api-server: DATABASE_URL=postgres://none:none@127.0.0.1:9/none npx tsx ../pocket/video/make-pdf.ts
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateQuotePdfBuffer } from "../../api-server/src/quotes/pdf.js";
import { NOW, pdfInput } from "./fixtures.mjs";

// The PDF dates itself with today; the video's day is fixed.
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a: unknown[]) { if (a.length) super(...(a as [string])); else super(NOW); } } as DateConstructor;

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out", "assets");
for (const lang of ["en", "fr"] as const) {
  const { quote, profile } = pdfInput(lang);
  const logoUrl = `data:image/png;base64,${readFileSync(join(OUT, `logo-${lang}.png`)).toString("base64")}`;
  const row = { ...quote, documentLanguage: lang, createdAt: new Date(quote.createdAt), updatedAt: new Date(quote.updatedAt) };
  const pdf = await generateQuotePdfBuffer(row as never, { ...profile, logoUrl } as never, false);
  writeFileSync(join(OUT, `quote-${lang}.pdf`), pdf);
  console.log(lang, pdf.length);
}
process.exit(0);
