// Phase 71: the quote documents (quote PDF with optional DRAFT watermark, and
// the Pro "capitolato" technical specification), extracted from routes/quotes.ts
// so the WhatsApp bot and the e2e PDF matrix render the same layout as the
// dashboard instead of a drifting copy. Bilingual via ./i18n.ts.
import { getPdfmake } from "../lib/pdfmake.js";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { QuoteChapter, QuoteDiscount, QuoteCompanySnapshot, QuoteClientData } from "@workspace/db";
import { quotesTable, businessProfilesTable, normalizeProvince } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { quoteLanguageFor, quoteTaxLinesFor, qt, fmtMoney, fmtQuoteDate, fmtRate, fmtQty } from "./i18n.js";

const objectStorage = new ObjectStorageService();

export type QuoteRow = typeof quotesTable.$inferSelect;
export type ProfileRow = typeof businessProfilesTable.$inferSelect | null;


function formatDescriptionPdf(descrizione: string, bg: string | null): any {
  const parts = descrizione.split("\n");
  const title = parts[0];
  const detail = parts.slice(1).join("\n");
  if (!detail) {
    return { text: title, fontSize: 8, color: "#1a1a1a", fillColor: bg };
  }
  return {
    stack: [
      { text: title, bold: true, fontSize: 8, color: "#1a1a1a" },
      { text: detail, fontSize: 7, color: "#555555", margin: [0, 2, 0, 0] }
    ],
    fillColor: bg
  };
}


/**
 * Attempt to load a logo image from object storage and encode as base64 data URI for pdfmake.
 *
 * Supported URL formats:
 *   - `/api/storage/public-objects/<subPath>`  (logo uploads — public GCS objects)
 *   - `/objects/<subPath>`                     (private GCS objects, fallback)
 */
async function fetchLogoDataUri(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    let response: Response | null = null;

    if (logoUrl.startsWith("/api/storage/public-objects/")) {
      // Public logo: extract subPath and search across PUBLIC_OBJECT_SEARCH_PATHS
      const subPath = logoUrl.replace(/^\/api\/storage\/public-objects\//, "");
      const file = await objectStorage.searchPublicObject(subPath).catch(() => null);
      if (!file) return null;
      response = await objectStorage.downloadObject(file, { isPublic: true, cacheTtlSec: 3600 }).catch(() => null);
    } else if (logoUrl.startsWith("/objects/")) {
      // Private object (legacy path)
      const subPath = logoUrl.replace(/^\/objects\//, "");
      response = await objectStorage.downloadPrivateObject(subPath).catch(() => null);
    }

    if (!response || !response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    const ct = response.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    // Best-effort: if logo fetch fails, proceed without logo
    return null;
  }
}

export async function generateCapitolatoPdfBuffer(quote: QuoteRow, profile: ProfileRow): Promise<Buffer> {
  const lang = await quoteLanguageFor(quote);
  const province = normalizeProvince(quote.province) ?? normalizeProvince(((quote.clientData ?? {}) as QuoteClientData).province) ?? normalizeProvince(profile?.province) ?? null;
  const taxLines = quoteTaxLinesFor(quote, province, lang);
  const money = (n: number) => fmtMoney(n, lang);
  const capitoli: QuoteChapter[] = Array.isArray(quote.capitoli) && quote.capitoli.length > 0
    ? quote.capitoli as QuoteChapter[]
    : [];
  const clientData = (quote.clientData ?? { nome: "", indirizzo: "" }) as QuoteClientData;
  const sconto = quote.sconto as QuoteDiscount | null;
  const condizioniPagamento: string[] = Array.isArray(quote.condizioniPagamento) ? quote.condizioniPagamento : [];
  const snap = (quote.companySnapshot as QuoteCompanySnapshot | null) ?? null;

  const companyName = snap?.companyName || profile?.companyName || "";
  const companyVat = snap?.vatNumber || profile?.vatNumber || "";
  const companyAddress = snap?.address || profile?.address || "";
  const companyPhone = snap?.phone || profile?.phone || "";
  const companyEmail = snap?.email || profile?.email || "";
  // The DB default title is the English string; a French document localises it unless the company typed its own.
  const titolo1 = quote.titoloPreventivoRiga1 && quote.titoloPreventivoRiga1 !== qt("defaultTitle", "en") ? quote.titoloPreventivoRiga1 : qt("defaultTitle", lang);
  const titolo2 = quote.titoloPreventivoRiga2 || "";
  const numeroData = quote.numeroPreventivoData || `${qt("quoteNo", lang)} ${quote.id.slice(0, 4).toUpperCase()} - ${fmtQuoteDate(new Date(), lang)}`;
  const subtotale = Number(quote.subtotale);
  // ivaPercentuale is split into components by quoteTaxLinesFor (Phase 71).
  // The stored ivaValore is what taxLines sum to.
  const totale = Number(quote.totale);
  const isDraft = quote.status !== "unlocked";

  const DARK = "#1a1a2e";
  const LIGHT_BG = "#f4f6f9";
  const GRAY = "#888888";

  // Fetch company logo (best-effort; null if unavailable)
  const logoPath = snap?.logoUrl || profile?.logoUrl || null;
  const logoDataUri = await fetchLogoDataUri(logoPath);

  // Company header stack (right of logo or full-width if no logo)
  const companyInfoStack: Content[] = [
    { text: companyName, fontSize: 13, bold: true, color: DARK, margin: [0, 4, 0, 2] },
  ];
  if (companyVat) companyInfoStack.push({ text: `${qt("gstNo", lang)}: ${companyVat}`, fontSize: 8, color: "#555555" });
  if (companyAddress) companyInfoStack.push({ text: companyAddress, fontSize: 8, color: "#555555" });
  if (companyPhone) companyInfoStack.push({ text: `${qt("tel", lang)}: ${companyPhone}`, fontSize: 8, color: "#555555" });
  if (companyEmail) companyInfoStack.push({ text: companyEmail, fontSize: 8, color: "#555555" });

  // Header left cell: logo + company info
  const headerLeftContent: Content = logoDataUri
    ? {
        columns: [
          { image: logoDataUri, fit: [56, 56] as [number, number], margin: [0, 4, 10, 0] as [number, number, number, number] },
          { stack: companyInfoStack },
        ],
      }
    : { stack: companyInfoStack };

  // Summary table body
  const quadroBody: Content[][] = [
    [
      { text: qt("chapter", lang), style: "tableHeader" },
      { text: qt("netAmount", lang), style: "tableHeaderRight" },
      { text: qt("notes", lang), style: "tableHeader" },
    ],
    ...capitoli.map(cap => [
      { text: `${cap.lettera}. ${cap.titolo}`, fontSize: 9, color: "#1a1a1a" } as Content,
      { text: money(cap.subtotale), fontSize: 9, alignment: "right" as const, bold: true } as Content,
      { text: cap.osservazione ?? qt("standardItem", lang), fontSize: 8, color: "#666666", italics: true } as Content,
    ]),
  ];

  // Chapter detail tables — includes No. column
  const chaptersContent: Content[] = capitoli.flatMap(cap => {
    const bodyRows: Content[][] = [
      [
        { text: qt("no", lang), style: "tableHeaderCenter" },
        { text: qt("description", lang), style: "tableHeader" },
        { text: qt("unit", lang), style: "tableHeaderCenter" },
        { text: qt("qty", lang), style: "tableHeaderCenter" },
        { text: "Unit Price ($)", style: "tableHeaderRight" },
        { text: "Total ($)", style: "tableHeaderRight" },
      ],
      ...cap.voci.map((v, vi) => {
        const bg = vi % 2 === 0 ? null : "#f8f9fb";
        return [
          { text: String(vi + 1), fontSize: 8, alignment: "center" as const, color: "#666", fillColor: bg } as Content,
          formatDescriptionPdf(v.descrizione, bg) as Content,
          { text: v.um, fontSize: 8, alignment: "center" as const, fillColor: bg } as Content,
          { text: String(v.quantita), fontSize: 8, alignment: "center" as const, fillColor: bg } as Content,
          { text: fmtQty(v.prezzoUnitario, lang), fontSize: 8, alignment: "right" as const, fillColor: bg } as Content,
          { text: fmtQty(v.totale, lang), fontSize: 8, alignment: "right" as const, bold: true, fillColor: bg } as Content,
        ];
      }),
      [
        { text: qt("chapterSubtotal", lang, { x: cap.lettera }), colSpan: 5, fontSize: 8.5, bold: true, fillColor: "#edf0f5", color: DARK } as Content,
        {} as Content, {} as Content, {} as Content, {} as Content,
        { text: money(cap.subtotale), fontSize: 8.5, alignment: "right" as const, bold: true, fillColor: "#edf0f5", color: DARK } as Content,
      ],
    ];

    return [
      {
        text: `${cap.lettera}. ${cap.titolo}`,
        fontSize: 10,
        bold: true,
        color: DARK,
        margin: [0, 10, 0, 4],
      } as Content,
      {
        table: {
          headerRows: 1,
          widths: [18, "*", 32, 32, 60, 60],
          body: bodyRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#dddddd",
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 4,
          paddingBottom: () => 4,
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return DARK;
            if (rowIndex === bodyRows.length - 1) return "#edf0f5";
            return null;
          },
        },
        margin: [0, 0, 0, 14] as [number, number, number, number],
      } as Content,
    ] as Content[];
  });

  // Totals section
  const totalsRows: Content[][] = [
    [
      { text: qt("subtotal", lang), style: "totLabel" },
      { text: money(subtotale), style: "totValue" },
    ],
  ];
  if (sconto && sconto.percentuale > 0) {
    totalsRows.push([
      { text: `${qt("discount", lang)} (${fmtRate(sconto.percentuale, lang)})`, style: "totLabel" },
      { text: `- ${money(subtotale - sconto.importoScontato)}`, style: "totValue" },
    ]);
    totalsRows.push([
      { text: qt("discountedSubtotal", lang), style: "totLabel" },
      { text: money(sconto.importoScontato), style: "totValue" },
    ]);
  }
  if (taxLines.length === 0) {
    totalsRows.push([
      { text: qt("taxExempt", lang), style: "totLabel" },
      { text: money(0), style: "totValue" },
    ]);
  }
  for (const line of taxLines) {
    totalsRows.push([
      { text: line.display, style: "totLabel" },
      { text: money(line.amount), style: "totValue" },
    ]);
  }
  totalsRows.push([
    { text: qt("grandTotal", lang), fontSize: 10, bold: true, color: "white", fillColor: DARK } as Content,
    { text: money(totale), fontSize: 10, bold: true, alignment: "right" as const, color: "white", fillColor: DARK } as Content,
  ]);

  // Payment conditions
  const condizioniContent: Content[] = condizioniPagamento.length > 0
    ? [
        { text: qt("paymentTerms", lang), style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        {
          ul: condizioniPagamento.map(c => ({ text: c.toUpperCase(), fontSize: 8.5, bold: true })),
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },
        {
          text: qt("nb", lang),
          fontSize: 8,
          color: "#cc0000",
          bold: true,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
      ]
    : [];

  // Acceptance signature section
  const signatureSection: Content[] = [
    { text: qt("acceptance", lang), style: "sectionHeading", margin: [0, 20, 0, 6] as [number, number, number, number] },
    {
      text: qt("acceptanceText", lang),
      fontSize: 8,
      color: "#444",
      margin: [0, 0, 0, 14] as [number, number, number, number],
    },
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: qt("dateAndLocation", lang), fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 160, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
        {
          width: "*",
          stack: [
            { text: qt("clientSignature", lang), fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 200, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
        {
          width: "*",
          stack: [
            { text: qt("contractorSignature", lang), fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 160, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
      ],
      columnGap: 20,
    } as Content,
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 70, 40, 50] as [number, number, number, number],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 9,
      color: "#1a1a1a",
    },
    styles: {
      tableHeader: { color: "white", bold: true, fontSize: 8, fillColor: DARK },
      tableHeaderCenter: { color: "white", bold: true, fontSize: 8, fillColor: DARK, alignment: "center" },
      tableHeaderRight: { color: "white", bold: true, fontSize: 8, fillColor: DARK, alignment: "right" },
      sectionHeading: { fontSize: 9, bold: true, color: GRAY, characterSpacing: 0.5 },
      totLabel: { fontSize: 8.5, bold: true, color: "#333333" },
      totValue: { fontSize: 9, bold: true, alignment: "right" },
    },
    // DRAFT diagonal watermark for draft/unpaid quotes
    ...(isDraft ? {
      watermark: {
        text: qt("draft", lang),
        color: "#cccccc",
        opacity: 0.18,
        bold: true,
        italics: false,
        fontSize: 120,
        angle: -45,
      },
    } : {}),
    header: (currentPage: number, pageCount: number): Content => ({
      margin: [40, 14, 40, 0] as [number, number, number, number],
      table: {
        widths: ["*", "auto"],
        // pdfmake TableCell borders use [bool,bool,bool,bool] which TS types don't fully model;
        // double-cast through unknown to satisfy the strict union
        body: ([
          [
            { ...(headerLeftContent as object), border: [false, false, false, true] },
            {
              stack: [
                { text: qt("specTitle", lang), fontSize: 7, bold: true, color: "#7c3aed", alignment: "right", characterSpacing: 1 },
                { text: numeroData, fontSize: 10, bold: true, color: DARK, alignment: "right" },
                { text: `${qt("date", lang)}: ${fmtQuoteDate(new Date(), lang)}`, fontSize: 8, color: "#555555", alignment: "right" },
                { text: `${qt("page", lang)} ${currentPage}/${pageCount}`, fontSize: 7, color: GRAY, alignment: "right", margin: [0, 2, 0, 0] },
              ],
              border: [false, false, false, true],
            },
          ],
        ] as unknown) as Content[][],
      },
      layout: {
        hLineWidth: (i: number) => i === 1 ? 2 : 0,
        vLineWidth: () => 0,
        hLineColor: () => DARK,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingBottom: () => 8,
      },
    }),
    content: [
      // Document title
      { text: titolo1.toUpperCase(), fontSize: 12, bold: true, alignment: "center", color: DARK, margin: [0, 6, 0, 0] as [number, number, number, number] },
      ...(titolo2 ? [{ text: titolo2, fontSize: 9, alignment: "center" as const, color: "#444444", italics: true, margin: [0, 2, 0, 8] as [number, number, number, number] }] : [{ text: "", margin: [0, 0, 0, 8] as [number, number, number, number] }]),

      // Client box
      {
        table: {
          widths: ["*"],
          body: [[
            {
              border: [true, true, true, true],
              stack: [
                { text: qt("preparedFor", lang), fontSize: 7, bold: true, color: GRAY, characterSpacing: 0.5 },
                { text: clientData.nome || "——", fontSize: 10, bold: true, color: DARK },
                ...(clientData.indirizzo ? [{ text: clientData.indirizzo, fontSize: 8.5, color: "#555" }] : []),
                ...(clientData.city ? [{ text: [clientData.city, clientData.province, clientData.postalCode].filter(Boolean).join(" "), fontSize: 8, color: "#666" }] : []),
                ...((clientData.businessNumber || clientData.partitaIva) ? [{ text: [clientData.businessNumber ? `BN: ${clientData.businessNumber}` : "", clientData.partitaIva ? `GST/HST: ${clientData.partitaIva}` : ""].filter(Boolean).join("  ·  "), fontSize: 8, color: "#666" }] : []),
              ],
              margin: [10, 8, 10, 8] as [number, number, number, number],
              fillColor: LIGHT_BG,
            },
          ]],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#c5cce0", vLineColor: () => "#c5cce0", paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        margin: [0, 0, 0, 14] as [number, number, number, number],
      } as Content,

      // Quadro sintetico
      ...(capitoli.length > 0 ? [
        { text: qt("summary", lang), style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
        {
          table: { headerRows: 1, widths: ["*", 120, 120], body: quadroBody },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#dddddd",
            fillColor: (rowIndex: number) => rowIndex === 0 ? DARK : (rowIndex % 2 === 0 ? "#f8f9fb" : null),
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
          margin: [0, 0, 0, 14] as [number, number, number, number],
        },
      ] as Content[] : []),

      // Chapters
      ...(capitoli.length > 0 ? [
        { text: qt("detailedBoq", lang), style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
        ...chaptersContent,
      ] as Content[] : []),

      // Totals
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 320,
            table: { widths: ["*", 120], body: totalsRows },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0,
              hLineColor: () => "#dde1ec",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 6,
              paddingBottom: () => 6,
              fillColor: (rowIndex: number) => rowIndex === totalsRows.length - 1 ? DARK : null,
            },
          },
        ],
        margin: [0, 0, 0, 14] as [number, number, number, number],
      } as Content,

      // Payment conditions
      ...condizioniContent,

      // Note
      ...(quote.note ? [
        { text: qt("note", lang), style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        { text: quote.note, fontSize: 8, color: "#333" },
      ] as Content[] : []),

      // Acceptance signature section
      ...signatureSection,
    ],
    footer: (_currentPage: number, _pageCount: number): Content => ({
      margin: [40, 0, 40, 14] as [number, number, number, number],
      columns: [
        {
          text: `${companyName}${companyAddress ? " – " + companyAddress : ""}`,
          fontSize: 7.5,
          color: "#aaaaaa",
        },
        {
          text: isDraft ? qt("provisional", lang) : qt("generatedWith", lang),
          fontSize: 7.5,
          color: isDraft ? "#cc8800" : "#aaaaaa",
          alignment: "right",
          bold: isDraft,
        },
      ],
    }),
  };

  return getPdfmake().createPdf(docDefinition).getBuffer();
}

/**
 * Generates a server-side PDF buffer for any quote using pdfmake.
 * Supports watermark for draft/unpaid quotes.
 */
export async function generateQuotePdfBuffer(quote: QuoteRow, profile: ProfileRow, withWatermark: boolean): Promise<Buffer> {
  const lang = await quoteLanguageFor(quote);
  const province = normalizeProvince(quote.province) ?? normalizeProvince(((quote.clientData ?? {}) as QuoteClientData).province) ?? normalizeProvince(profile?.province) ?? null;
  const taxLines = quoteTaxLinesFor(quote, province, lang);
  const money = (n: number) => fmtMoney(n, lang);
  const capitoli: QuoteChapter[] = Array.isArray(quote.capitoli) && quote.capitoli.length > 0
    ? quote.capitoli as QuoteChapter[]
    : [];
  const clientData = (quote.clientData ?? { nome: "", indirizzo: "" }) as QuoteClientData;
  const sconto = quote.sconto as QuoteDiscount | null;
  const condizioniPagamento: string[] = Array.isArray(quote.condizioniPagamento) ? quote.condizioniPagamento : [];
  const snap = (quote.companySnapshot as QuoteCompanySnapshot | null) ?? null;

  const companyName = snap?.companyName || profile?.companyName || "";
  const companyVat = snap?.vatNumber || profile?.vatNumber || "";
  const companyAddress = snap?.address || profile?.address || "";
  const companyPhone = snap?.phone || profile?.phone || "";
  const companyEmail = snap?.email || profile?.email || "";
  // The DB default title is the English string; a French document localises it unless the company typed its own.
  const titolo1 = quote.titoloPreventivoRiga1 && quote.titoloPreventivoRiga1 !== qt("defaultTitle", "en") ? quote.titoloPreventivoRiga1 : qt("defaultTitle", lang);
  const titolo2 = quote.titoloPreventivoRiga2 || "";
  const numeroData = quote.numeroPreventivoData || `${qt("quoteNo", lang)} ${quote.id.slice(0, 4).toUpperCase()} - ${fmtQuoteDate(new Date(), lang)}`;
  const subtotale = Number(quote.subtotale);
  // ivaPercentuale is split into components by quoteTaxLinesFor (Phase 71).
  // Tax total is presented via taxLines (Phase 71); the stored ivaValore is what they sum to.
  const totale = Number(quote.totale);
  const isDraft = withWatermark;

  const DARK = "#1a1a2e";
  const LIGHT_BG = "#f4f6f9";
  const GRAY = "#888888";

  const logoPath = snap?.logoUrl || profile?.logoUrl || null;
  const logoDataUri = await fetchLogoDataUri(logoPath);

  const companyInfoStack: Content[] = [
    { text: companyName, fontSize: 13, bold: true, color: DARK, margin: [0, 4, 0, 2] },
  ];
  if (companyVat) companyInfoStack.push({ text: `${qt("gstNo", lang)}: ${companyVat}`, fontSize: 8, color: "#555555" });
  if (companyAddress) companyInfoStack.push({ text: companyAddress, fontSize: 8, color: "#555555" });
  if (companyPhone) companyInfoStack.push({ text: `${qt("tel", lang)}: ${companyPhone}`, fontSize: 8, color: "#555555" });
  if (companyEmail) companyInfoStack.push({ text: companyEmail, fontSize: 8, color: "#555555" });

  const headerLeftContent: Content = logoDataUri
    ? {
        columns: [
          { image: logoDataUri, fit: [56, 56] as [number, number], margin: [0, 4, 10, 0] as [number, number, number, number] },
          { stack: companyInfoStack },
        ],
      }
    : { stack: companyInfoStack };

  const quadroBody: Content[][] = [
    [
      { text: qt("chapter", lang), style: "tableHeader" },
      { text: qt("netAmount", lang), style: "tableHeaderRight" },
      { text: qt("notes", lang), style: "tableHeader" },
    ],
    ...capitoli.map(cap => [
      { text: `${cap.lettera}. ${cap.titolo}`, fontSize: 9, color: "#1a1a1a" } as Content,
      { text: money(cap.subtotale), fontSize: 9, alignment: "right" as const, bold: true } as Content,
      { text: cap.osservazione ?? qt("standardItem", lang), fontSize: 8, color: "#666666", italics: true } as Content,
    ]),
  ];

  const chaptersContent: Content[] = capitoli.flatMap(cap => {
    const bodyRows: Content[][] = [
      [
        { text: qt("no", lang), style: "tableHeaderCenter" },
        { text: qt("description", lang), style: "tableHeader" },
        { text: qt("unit", lang), style: "tableHeaderCenter" },
        { text: qt("qty", lang), style: "tableHeaderCenter" },
        { text: "Unit Price ($)", style: "tableHeaderRight" },
        { text: "Total ($)", style: "tableHeaderRight" },
      ],
      ...cap.voci.map((v, vi) => {
        const bg = vi % 2 === 0 ? null : "#f8f9fb";
        return [
          { text: String(vi + 1), fontSize: 8, alignment: "center" as const, color: "#666", fillColor: bg } as Content,
          formatDescriptionPdf(v.descrizione, bg) as Content,
          { text: v.um, fontSize: 8, alignment: "center" as const, fillColor: bg } as Content,
          { text: String(v.quantita), fontSize: 8, alignment: "center" as const, fillColor: bg } as Content,
          { text: fmtQty(v.prezzoUnitario, lang), fontSize: 8, alignment: "right" as const, fillColor: bg } as Content,
          { text: fmtQty(v.totale, lang), fontSize: 8, alignment: "right" as const, bold: true, fillColor: bg } as Content,
        ];
      }),
      [
        { text: qt("chapterSubtotal", lang, { x: cap.lettera }), colSpan: 5, fontSize: 8.5, bold: true, fillColor: "#edf0f5", color: DARK } as Content,
        {} as Content, {} as Content, {} as Content, {} as Content,
        { text: money(cap.subtotale), fontSize: 8.5, alignment: "right" as const, bold: true, fillColor: "#edf0f5", color: DARK } as Content,
      ],
    ];

    return [
      {
        text: `${cap.lettera}. ${cap.titolo}`,
        fontSize: 10,
        bold: true,
        color: DARK,
        margin: [0, 10, 0, 4],
      } as Content,
      {
        table: {
          headerRows: 1,
          widths: [18, "*", 32, 32, 60, 60],
          body: bodyRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#dddddd",
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 4,
          paddingBottom: () => 4,
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return DARK;
            if (rowIndex === bodyRows.length - 1) return "#edf0f5";
            return null;
          },
        },
        margin: [0, 0, 0, 14] as [number, number, number, number],
      } as Content,
    ] as Content[];
  });

  const totalsRows: Content[][] = [
    [
      { text: qt("subtotal", lang), style: "totLabel" },
      { text: money(subtotale), style: "totValue" },
    ],
  ];
  if (sconto && sconto.percentuale > 0) {
    totalsRows.push([
      { text: `${qt("discount", lang)} (${fmtRate(sconto.percentuale, lang)})`, style: "totLabel" },
      { text: `- ${money(subtotale - sconto.importoScontato)}`, style: "totValue" },
    ]);
    totalsRows.push([
      { text: qt("discountedSubtotal", lang), style: "totLabel" },
      { text: money(sconto.importoScontato), style: "totValue" },
    ]);
  }
  if (taxLines.length === 0) {
    totalsRows.push([
      { text: qt("taxExempt", lang), style: "totLabel" },
      { text: money(0), style: "totValue" },
    ]);
  }
  for (const line of taxLines) {
    totalsRows.push([
      { text: line.display, style: "totLabel" },
      { text: money(line.amount), style: "totValue" },
    ]);
  }
  totalsRows.push([
    { text: qt("grandTotal", lang), fontSize: 10, bold: true, color: "white", fillColor: DARK } as Content,
    { text: money(totale), fontSize: 10, bold: true, alignment: "right" as const, color: "white", fillColor: DARK } as Content,
  ]);

  const condizioniContent: Content[] = condizioniPagamento.length > 0
    ? [
        { text: qt("paymentTerms", lang), style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        {
          ul: condizioniPagamento.map(c => ({ text: c.toUpperCase(), fontSize: 8.5, bold: true })),
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },
        {
          text: qt("nb", lang),
          fontSize: 8,
          color: "#cc0000",
          bold: true,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
      ]
    : [];

  const signatureSection: Content[] = [
    { text: qt("acceptance", lang), style: "sectionHeading", margin: [0, 20, 0, 6] as [number, number, number, number] },
    {
      text: qt("acceptanceText", lang),
      fontSize: 8,
      color: "#444",
      margin: [0, 0, 0, 14] as [number, number, number, number],
    },
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: qt("dateAndLocation", lang), fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 160, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
        {
          width: "*",
          stack: [
            { text: qt("clientSignature", lang), fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 200, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
        {
          width: "*",
          stack: [
            { text: qt("contractorSignature", lang), fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 160, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
      ],
      columnGap: 20,
    } as Content,
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 70, 40, 50] as [number, number, number, number],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 9,
      color: "#1a1a1a",
    },
    styles: {
      tableHeader: { color: "white", bold: true, fontSize: 8, fillColor: DARK },
      tableHeaderCenter: { color: "white", bold: true, fontSize: 8, fillColor: DARK, alignment: "center" },
      tableHeaderRight: { color: "white", bold: true, fontSize: 8, fillColor: DARK, alignment: "right" },
      sectionHeading: { fontSize: 9, bold: true, color: GRAY, characterSpacing: 0.5 },
      totLabel: { fontSize: 8.5, bold: true, color: "#333333" },
      totValue: { fontSize: 9, bold: true, alignment: "right" },
    },
    ...(isDraft ? {
      watermark: {
        text: qt("draft", lang),
        color: "#cccccc",
        opacity: 0.18,
        bold: true,
        italics: false,
        fontSize: 120,
        angle: -45,
      },
    } : {}),
    header: (currentPage: number, pageCount: number): Content => ({
      margin: [40, 14, 40, 0] as [number, number, number, number],
      table: {
        widths: ["*", "auto"],
        body: ([
          [
            { ...(headerLeftContent as object), border: [false, false, false, true] },
            {
              stack: [
                { text: numeroData, fontSize: 10, bold: true, color: DARK, alignment: "right" },
                { text: `${qt("date", lang)}: ${fmtQuoteDate(new Date(), lang)}`, fontSize: 8, color: "#555555", alignment: "right" },
                { text: `${qt("page", lang)} ${currentPage}/${pageCount}`, fontSize: 7, color: GRAY, alignment: "right", margin: [0, 2, 0, 0] },
              ],
              border: [false, false, false, true],
            },
          ],
        ] as unknown) as Content[][],
      },
      layout: {
        hLineWidth: (i: number) => i === 1 ? 2 : 0,
        vLineWidth: () => 0,
        hLineColor: () => DARK,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingBottom: () => 8,
      },
    }),
    content: [
      { text: titolo1.toUpperCase(), fontSize: 12, bold: true, alignment: "center", color: DARK, margin: [0, 6, 0, 0] as [number, number, number, number] },
      ...(titolo2 ? [{ text: titolo2, fontSize: 9, alignment: "center" as const, color: "#444444", italics: true, margin: [0, 2, 0, 8] as [number, number, number, number] }] : [{ text: "", margin: [0, 0, 0, 8] as [number, number, number, number] }]),

      {
        table: {
          widths: ["*"],
          body: [[
            {
              border: [true, true, true, true],
              stack: [
                { text: qt("preparedFor", lang), fontSize: 7, bold: true, color: GRAY, characterSpacing: 0.5 },
                { text: clientData.nome || "\u2014\u2014", fontSize: 10, bold: true, color: DARK },
                ...(clientData.indirizzo ? [{ text: clientData.indirizzo, fontSize: 8.5, color: "#555" }] : []),
                ...(clientData.city ? [{ text: [clientData.city, clientData.province, clientData.postalCode].filter(Boolean).join(" "), fontSize: 8, color: "#666" }] : []),
                ...((clientData.businessNumber || clientData.partitaIva) ? [{ text: [clientData.businessNumber ? `BN: ${clientData.businessNumber}` : "", clientData.partitaIva ? `GST/HST: ${clientData.partitaIva}` : ""].filter(Boolean).join("  \u00b7  "), fontSize: 8, color: "#666" }] : []),
              ],
              margin: [10, 8, 10, 8] as [number, number, number, number],
              fillColor: LIGHT_BG,
            },
          ]],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#c5cce0", vLineColor: () => "#c5cce0", paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        margin: [0, 0, 0, 14] as [number, number, number, number],
      } as Content,

      ...(capitoli.length > 0 ? [
        { text: qt("summary", lang), style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
        {
          table: { headerRows: 1, widths: ["*", 120, 120], body: quadroBody },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#dddddd",
            fillColor: (rowIndex: number) => rowIndex === 0 ? DARK : (rowIndex % 2 === 0 ? "#f8f9fb" : null),
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
          margin: [0, 0, 0, 14] as [number, number, number, number],
        },
      ] as Content[] : []),

      ...(capitoli.length > 0 ? [
        { text: qt("detailedBoq", lang), style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
        ...chaptersContent,
      ] as Content[] : []),

      {
        columns: [
          { width: "*", text: "" },
          {
            width: 320,
            table: { widths: ["*", 120], body: totalsRows },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0,
              hLineColor: () => "#dde1ec",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 6,
              paddingBottom: () => 6,
              fillColor: (rowIndex: number) => rowIndex === totalsRows.length - 1 ? DARK : null,
            },
          },
        ],
        margin: [0, 0, 0, 14] as [number, number, number, number],
      } as Content,

      ...condizioniContent,

      ...(quote.note ? [
        { text: qt("note", lang), style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        { text: quote.note, fontSize: 8, color: "#333" },
      ] as Content[] : []),

      ...signatureSection,
    ],
    footer: (_currentPage: number, _pageCount: number): Content => ({
      margin: [40, 0, 40, 14] as [number, number, number, number],
      columns: [
        {
          text: `${companyName}${companyAddress ? " \u2013 " + companyAddress : ""}`,
          fontSize: 7.5,
          color: "#aaaaaa",
        },
        {
          text: isDraft ? qt("provisional", lang) : qt("generatedWith", lang),
          fontSize: 7.5,
          color: isDraft ? "#cc8800" : "#aaaaaa",
          alignment: "right",
          bold: isDraft,
        },
      ],
    }),
  };

  return getPdfmake().createPdf(docDefinition).getBuffer();
}
