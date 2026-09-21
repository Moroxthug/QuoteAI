// Phase 67 — render every PDF the product produces across the matrix
// province (ON/QC) × logo (with/without) × document, plus the language flip
// (an English contract/invoice in Quebec, a French one in Ontario) and the
// long 30-line quote that forces page breaks. Files land in
// .qa/pdfs/<province>-<logo>/… for eyeballing; the script itself only checks
// that each renders, is a PDF, and reports the page count.
//
//   pnpm --filter @workspace/api-server qa:pdf
//   E2E_NO_PURGE=1 pnpm --filter @workspace/api-server qa:pdf   # while qa:visual is running

import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("qa-pdf");

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../../.qa/pdfs");

const mailbox = await captureResend();
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { db, businessProfilesTable, invoicesTable, quotesTable, contractsTable } = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");
const { startServer, stopServer, createOrg, cleanupAll } = await import("./harness.js");
const { seedShowcase, setSignTokenCapture, loadShowcaseRows } = await import("./fixtures.js");
const { generateQuotePdfBuffer, generateCapitolatoPdfBuffer } = await import("../quotes/pdf.js");
const { generateQuoteWhatsappPdfBuffer } = await import("../lib/generateQuoteWhatsappPdfBuffer.js");
const { contractPdfBuffer, createContractFromQuote } = await import("../contracts/service.js");
const { invoicePdfBuffer, buildInvoiceContext, createInvoice } = await import("../invoices/service.js");

setSignTokenCapture(() => {
  for (let i = mailbox.length - 1; i >= 0; i--) {
    const l = mailbox[i]!.links.find((x) => x.includes("/sign/"));
    if (l) return l.split("/sign/")[1]!.split(/[/?#]/)[0]!;
  }
  return null;
});

type Row = { dir: string; file: string; pages: number | null; bytes: number; error?: string };
const rows: Row[] = [];

function pageCount(buf: Buffer): number | null {
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  const m = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : null;
}

async function emit(dir: string, file: string, make: () => Promise<Buffer>) {
  const abs = resolve(OUT, dir);
  mkdirSync(abs, { recursive: true });
  try {
    const buf = await make();
    writeFileSync(resolve(abs, file), buf);
    const pages = pageCount(buf);
    rows.push({ dir, file, pages, bytes: buf.length, error: pages === null ? "not a PDF" : undefined });
    console.log(`${dir}/${file}`.padEnd(64), pages === null ? "NOT A PDF" : `${pages} page(s), ${(buf.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    rows.push({ dir, file, pages: null, bytes: 0, error: (e as Error).message.slice(0, 200) });
    console.log(`${dir}/${file}`.padEnd(64), `ERROR ${(e as Error).message.slice(0, 120)}`);
  }
}

rmSync(OUT, { recursive: true, force: true });
try {
  await startServer();
  for (const province of ["ON", "QC"] as const) {
    for (const withLogo of [true, false]) {
      const dir = `${province}-${withLogo ? "logo" : "nologo"}`;
      const org = await createOrg({ province, companyName: province === "QC" ? "Rénovations Tremblay inc." : "Northside Renovations Ltd." });
      const s = await seedShowcase(org, { withLogo });
      const { quote, longQuote, invoice } = await loadShowcaseRows(s);
      const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));

      await emit(dir, "quote-standard.pdf", () => generateQuotePdfBuffer(quote, profile ?? null, false));
      await emit(dir, "quote-long-30-lines.pdf", () => generateQuotePdfBuffer(longQuote, profile ?? null, false));
      await emit(dir, "quote-long-watermark-trial.pdf", () => generateQuotePdfBuffer(longQuote, profile ?? null, true));
      await emit(dir, "quote-capitolato-long.pdf", () => generateCapitolatoPdfBuffer(longQuote, profile ?? null));
      await emit(dir, "quote-whatsapp-long.pdf", () => generateQuoteWhatsappPdfBuffer(longQuote, profile ?? null));

      await emit(dir, `contract-signed-${s.language}.pdf`, async () => (await contractPdfBuffer(s.contractId)).buffer);
      await emit(dir, `contract-sent-unsigned-${s.language}.pdf`, async () => (await contractPdfBuffer(s.pendingContractId)).buffer);
      // Language flip: the opposite official language for the same province.
      const flip = s.language === "fr" ? "en" : "fr";
      await emit(dir, `contract-draft-${flip}-flipped.pdf`, async () => {
        const { contract } = await createContractFromQuote({ userId: org.userId, quoteId: s.longQuoteId, language: flip, actor: "contractor" });
        return (await contractPdfBuffer(contract.id)).buffer;
      });

      await emit(dir, `invoice-progress-partly-paid-${s.language}.pdf`, async () => (await invoicePdfBuffer(invoice.id)).buffer);
      const deposit = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, s.jobId), eq(invoicesTable.type, "deposit"))))[0];
      if (deposit) await emit(dir, `invoice-deposit-draft-${s.language}.pdf`, async () => (await invoicePdfBuffer(deposit.id)).buffer);
      await emit(dir, `invoice-manual-${flip}-flipped-long.pdf`, async () => {
        const ctx = await buildInvoiceContext({ userId: org.userId, language: flip });
        const lines = Array.from({ length: 28 }, (_, i) => ({ description: `Line ${i + 1} — ${i % 4 === 0 ? "supply and install of finish carpentry, including all trims, casings and caulking" : "labour"}`, quantity: 1 + (i % 3), unitCents: 12_500 + i * 1_000, amountCents: (1 + (i % 3)) * (12_500 + i * 1_000) }));
        const inv = await createInvoice({ userId: org.userId, ctx, type: "manual", source: "manual", actor: "contractor", dueDays: 30, lines });
        return (await invoicePdfBuffer(inv.id)).buffer;
      });

      // Sanity: the two chains share the same tax profile on the quote row.
      const [q] = await db.select({ ivaPercentuale: quotesTable.ivaPercentuale, totale: quotesTable.totale }).from(quotesTable).where(eq(quotesTable.id, s.quoteId));
      const [c] = await db.select({ language: contractsTable.language, total: contractsTable.variables }).from(contractsTable).where(eq(contractsTable.id, s.contractId));
      console.log(`  ${dir}: quote tax ${q?.ivaPercentuale}% total ${q?.totale} · contract ${c?.language} total ${(c?.total as { total?: number } | null)?.total}`);
    }
  }
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(rows, null, 2));
  const bad = rows.filter((r) => r.error);
  console.log(`\n[qa-pdf] ${rows.length} PDFs → ${OUT}${bad.length ? ` — ${bad.length} FAILED` : ""}`);
} finally {
  await cleanupAll().catch((e) => console.error("[qa-pdf] cleanup failed", e));
  await stopServer();
}
process.exit(0);
