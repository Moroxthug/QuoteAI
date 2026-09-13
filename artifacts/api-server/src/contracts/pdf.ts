import pdfmake from "pdfmake";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { createHash } from "node:crypto";
import type { ContractDocument, ContractVariables, ContractSigner, ContractEvent } from "@workspace/db";
import { paymentTermAmount } from "@workspace/db";
import { parseBlocks, type Run, fmtMoney, fmtDate, tr, dueLabel, eventLabel } from "./render.js";
import type { Lang } from "./templates.js";

type PdfMakeInstance = {
  fonts: Record<string, Record<string, string>>;
  createPdf(docDef: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};

let _pdfmake: PdfMakeInstance | null = null;
function getPdfmake(): PdfMakeInstance {
  if (_pdfmake) return _pdfmake;
  const lib = pdfmake as unknown as PdfMakeInstance;
  lib.fonts = {
    Roboto: { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" },
    Serif: { normal: "Times-Roman", bold: "Times-Bold", italics: "Times-Italic", bolditalics: "Times-BoldItalic" },
  };
  _pdfmake = lib;
  return lib;
}

const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#d1d5db";

function runsToText(runs: Run[]): Content {
  return { text: runs.map((r) => ({ text: r.text, bold: r.bold, italics: r.italic })) };
}

function bodyContent(body: string): Content[] {
  return parseBlocks(body).map((b): Content =>
    b.type === "p"
      ? { text: b.runs.map((r) => ({ text: r.text, bold: r.bold, italics: r.italic })), margin: [0, 0, 0, 6] }
      : { ul: b.items.map((i) => runsToText(i)), margin: [0, 0, 0, 6] },
  );
}

function partyCell(label: string, p: ContractVariables["contractor"], lang: Lang): Content {
  const lines = [
    p.address,
    [p.city, p.province, p.postalCode].filter(Boolean).join(", "),
    p.email ? `${tr("email", lang)}: ${p.email}` : "",
    p.phone ? `${tr("phone", lang)}: ${p.phone}` : "",
    p.businessNumber ? `${tr("bn", lang)}: ${p.businessNumber}` : "",
    p.licenceNumber ? `${tr("licence", lang)}: ${p.licenceNumber}` : "",
  ].filter(Boolean) as string[];
  return {
    stack: [
      { text: label.toUpperCase(), fontSize: 7.5, color: MUTED, font: "Roboto", characterSpacing: 0.5 },
      { text: p.name, bold: true, fontSize: 11, margin: [0, 2, 0, 2] },
      ...lines.map((l) => ({ text: l, fontSize: 9, color: "#374151" })),
    ],
  };
}

function gridTable(header: string[], rows: TableCell[][], widths: (string | number)[], numericCols: number[]): Content {
  return {
    table: {
      headerRows: 1,
      widths,
      body: [
        header.map((h, i) => ({ text: h.toUpperCase(), fontSize: 7.5, color: MUTED, font: "Roboto", bold: true, alignment: numericCols.includes(i) ? "right" : "left", margin: [0, 2, 0, 2] })),
        ...rows,
      ],
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : i === 1 ? 0.8 : 0.4),
      vLineWidth: () => 0,
      hLineColor: (i: number) => (i === 1 ? RULE : "#f3f4f6"),
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 4, 0, 8],
  };
}

function priceTable(v: ContractVariables, lang: Lang): Content {
  const cell = (t: string, opts: Partial<{ bold: boolean; align: "right" | "left"; fill: string }> = {}): TableCell => ({
    text: t, fontSize: 9.5, bold: opts.bold, alignment: opts.align ?? "left", fillColor: opts.fill,
  });
  const rows: TableCell[][] = v.priceLines.map((l) => [cell(l.label), cell(fmtMoney(l.amount, lang), { align: "right" })]);
  if (v.discount) rows.push([cell(`${tr("discount", lang)} (${v.discount.percent}%)`), cell(`- ${fmtMoney(v.discount.amount, lang)}`, { align: "right" })]);
  rows.push([cell(tr("subtotal", lang), { bold: true }), cell(fmtMoney(v.subtotal, lang), { bold: true, align: "right" })]);
  for (const t of v.taxLines) rows.push([cell(`${t.label} (${t.rate}%)`), cell(fmtMoney(t.amount, lang), { align: "right" })]);
  rows.push([cell(tr("total", lang), { bold: true, fill: "#f9fafb" }), cell(fmtMoney(v.total, lang), { bold: true, align: "right", fill: "#f9fafb" })]);
  return gridTable([tr("description", lang), tr("amount", lang)], rows, ["*", 110], [1]);
}

function paymentTable(v: ContractVariables, lang: Lang): Content {
  const rows: TableCell[][] = v.paymentSchedule.terms.map((t, i) => [
    { text: `${i + 1}. ${t.label}`, fontSize: 9.5 },
    { text: dueLabel(t.trigger, t.dueDays, lang), fontSize: 9 },
    { text: t.amountType === "percent" ? `${t.value}%` : "", fontSize: 9.5, alignment: "right" },
    { text: fmtMoney(paymentTermAmount(t, v.total), lang), fontSize: 9.5, alignment: "right" },
  ]);
  return gridTable([tr("payment", lang), tr("due", lang), "%", tr("amount", lang)], rows, ["*", 150, 40, 90], [2, 3]);
}

function signatureBlock(role: "contractor" | "customer", v: ContractVariables, signers: ContractSigner[], lang: Lang): Content {
  const s = signers.find((x) => x.role === role);
  const party = role === "contractor" ? v.contractor : v.customer;
  const stack: Content[] = [
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 230, y2: 0, lineWidth: 0.8, lineColor: "#9ca3af" }], margin: [0, 24, 0, 6] },
    { text: tr(role, lang).toUpperCase(), fontSize: 7.5, color: MUTED, font: "Roboto", characterSpacing: 0.5 },
    { text: party.name, bold: true, fontSize: 11, margin: [0, 2, 0, 4] },
  ];
  if (s?.status === "signed") {
    if (s.signatureType === "drawn" && s.signatureData?.startsWith("data:image")) {
      stack.push({ image: s.signatureData, fit: [200, 60], margin: [0, 2, 0, 4] });
    } else {
      stack.push({ text: s.signatureData || s.name, italics: true, fontSize: 20, margin: [0, 4, 0, 4] });
    }
    stack.push({ text: `${tr("signedBy", lang)} ${s.name}`, fontSize: 8.5, color: MUTED, font: "Roboto" });
    stack.push({ text: `${tr("signedOn", lang)} ${fmtDate(s.signedAt, lang, true)}`, fontSize: 8.5, color: MUTED, font: "Roboto" });
  } else {
    stack.push({ text: tr("notYetSigned", lang), italics: true, fontSize: 9, color: "#9ca3af", margin: [0, 18, 0, 0] });
  }
  return { stack };
}

function auditPage(params: {
  variables: ContractVariables;
  signers: ContractSigner[];
  events: ContractEvent[];
  unsignedPdfHash: string | null;
  signedHash: string;
  lang: Lang;
}): Content[] {
  const { lang } = params;
  const rows: TableCell[][] = params.events.map((e) => {
    const signer = params.signers.find((s) => s.id === e.signerId);
    const who = e.actor === "system" ? "QuoteAI" : signer?.name ?? tr(e.actor === "customer" ? "customer" : "contractor", lang);
    return [
      { text: eventLabel(e, lang), fontSize: 8.5 },
      { text: fmtDate(e.createdAt, lang, true), fontSize: 8.5 },
      { text: who, fontSize: 8.5 },
      { text: [e.ip, e.userAgent ? e.userAgent.slice(0, 60) : ""].filter(Boolean).join("\n"), fontSize: 7, color: MUTED },
    ];
  });
  return [
    { text: tr("auditTitle", lang), fontSize: 16, bold: true, font: "Roboto", pageBreak: "before", margin: [0, 0, 0, 4] },
    { text: `${tr("contractNo", lang)} ${params.variables.contractNumber}`, fontSize: 9, color: MUTED, font: "Roboto", margin: [0, 0, 0, 10] },
    { text: tr("auditIntro", lang), fontSize: 9.5, margin: [0, 0, 0, 12] },
    gridTable([tr("event", lang), tr("when", lang), tr("who", lang), tr("ipUa", lang)], rows, [150, 110, 90, "*"], []),
    ...(params.unsignedPdfHash
      ? [
          { text: tr("unsignedHash", lang).toUpperCase(), fontSize: 7.5, color: MUTED, font: "Roboto", margin: [0, 10, 0, 2] } as Content,
          { text: params.unsignedPdfHash, fontSize: 8, font: "Roboto" } as Content,
        ]
      : []),
    { text: tr("signedHash", lang).toUpperCase(), fontSize: 7.5, color: MUTED, font: "Roboto", margin: [0, 8, 0, 2] },
    { text: params.signedHash, fontSize: 8, font: "Roboto" },
  ];
}

export async function buildContractPdf(params: {
  document: ContractDocument;
  variables: ContractVariables;
  signers: ContractSigner[];
  events: ContractEvent[];
  status: string;
  createdAt: Date;
  unsignedPdfHash: string | null;
  /** When true the audit certificate page is appended (executed contracts only). */
  withAudit: boolean;
}): Promise<{ buffer: Buffer; sha256: string }> {
  const { document: doc, variables: v, signers } = params;
  const lang = doc.language;

  // The signed-document fingerprint cannot be embedded in the very bytes it
  // hashes, so the certificate carries the fingerprint of the document
  // rendered with a placeholder; we hash that first render, then re-render
  // with the real value. Layout callbacks survive because the definition is
  // rebuilt, not cloned.
  const build = (signedHash: string): TDocumentDefinitions => {
  const content: Content[] = [];

  if (params.status === "draft") {
    content.push({ text: tr("draft", lang), alignment: "center", fontSize: 9, bold: true, color: "#92400e", font: "Roboto", margin: [0, 0, 0, 10] });
  }
  content.push({ text: doc.title, fontSize: 18, bold: true, font: "Roboto", margin: [0, 0, 0, 2] });
  content.push({ text: `${tr("contractNo", lang)} ${v.contractNumber}   ·   ${tr("date", lang)}: ${fmtDate(params.createdAt, lang)}`, fontSize: 9, color: MUTED, font: "Roboto", margin: [0, 0, 0, 16] });

  for (const s of doc.sections) {
    content.push({ text: s.heading.toUpperCase(), fontSize: 9.5, bold: true, font: "Roboto", color: "#374151", characterSpacing: 0.4, margin: [0, 14, 0, 6] });
    content.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: RULE }], margin: [0, 0, 0, 6] });
    if (s.key === "parties") {
      content.push({ columns: [partyCell(tr("contractor", lang), v.contractor, lang), partyCell(tr("customer", lang), v.customer, lang)], columnGap: 16, margin: [0, 0, 0, 8] });
      content.push({
        table: {
          widths: [130, "*"],
          body: [
            [{ text: tr("siteAddress", lang), fontSize: 9, color: MUTED, font: "Roboto" }, { text: v.siteAddress, fontSize: 10 }],
            [{ text: tr("project", lang), fontSize: 9, color: MUTED, font: "Roboto" }, { text: v.projectTitle, fontSize: 10 }],
            [{ text: tr("quoteNo", lang), fontSize: 9, color: MUTED, font: "Roboto" }, { text: v.quoteNumber, fontSize: 10 }],
          ],
        },
        layout: "noBorders",
      });
    } else if (s.key === "price") {
      content.push(...bodyContent(s.body), priceTable(v, lang));
    } else if (s.key === "payment") {
      content.push(...bodyContent(s.body), paymentTable(v, lang));
    } else if (s.key === "signatures") {
      content.push(...bodyContent(s.body));
      content.push({ columns: [signatureBlock("contractor", v, signers, lang), signatureBlock("customer", v, signers, lang)], columnGap: 30, unbreakable: true });
    } else {
      content.push(...bodyContent(s.body));
    }
  }

  if (params.withAudit) {
    content.push(...auditPage({ variables: v, signers, events: params.events, unsignedPdfHash: params.unsignedPdfHash, signedHash, lang }));
  }

  return {
    pageSize: "LETTER",
    pageMargins: [48, 56, 48, 56],
    defaultStyle: { font: "Serif", fontSize: 10, color: INK, lineHeight: 1.25 },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `${v.contractor.name} · ${tr("contractNo", lang)} ${v.contractNumber}`, fontSize: 7.5, color: MUTED, font: "Roboto" },
        { text: `${tr("page", lang)} ${currentPage} / ${pageCount}`, fontSize: 7.5, color: MUTED, font: "Roboto", alignment: "right" },
      ],
      margin: [48, 20, 48, 0],
    }),
    info: { title: `${doc.title} — ${v.contractNumber}`, author: v.contractor.name, creator: "QuoteAI" },
  };
  };

  const first = await getPdfmake().createPdf(build("—")).getBuffer();
  const sha256 = createHash("sha256").update(first).digest("hex");
  if (!params.withAudit) return { buffer: first, sha256 };

  const final = await getPdfmake().createPdf(build(sha256)).getBuffer();
  return { buffer: final, sha256 };
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
