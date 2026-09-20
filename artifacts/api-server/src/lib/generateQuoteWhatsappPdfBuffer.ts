import { getPdfmake } from "./pdfmake.js";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { QuoteChapter, QuoteDiscount, QuoteCompanySnapshot, QuoteClientData } from "@workspace/db";
import { quotesTable, businessProfilesTable } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage.js";

type QuoteRow = typeof quotesTable.$inferSelect;
type ProfileRow = typeof businessProfilesTable.$inferSelect | null;


const objectStorage = new ObjectStorageService();

function formatCad(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function fetchLogoDataUri(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    let response: Response | null = null;

    if (logoUrl.startsWith("/api/storage/public-objects/")) {
      const subPath = logoUrl.replace(/^\/api\/storage\/public-objects\//, "");
      const file = await objectStorage.searchPublicObject(subPath).catch(() => null);
      if (!file) return null;
      response = await objectStorage.downloadObject(file, { isPublic: true, cacheTtlSec: 3600 }).catch(() => null);
    } else if (logoUrl.startsWith("/objects/")) {
      const subPath = logoUrl.replace(/^\/objects\//, "");
      response = await objectStorage.downloadPrivateObject(subPath).catch(() => null);
    }

    if (!response || !response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    const ct = response.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Generates a PDF buffer for a quote using pdfmake.
 * Produces a clean, compact document suitable for WhatsApp delivery.
 * Always renders without watermark (WhatsApp quotes are for Pro/Elite users).
 */
export async function generateQuoteWhatsappPdfBuffer(quote: QuoteRow, profile: ProfileRow): Promise<Buffer> {
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
  const titolo1 = quote.titoloPreventivoRiga1 || "Project Quote & Itemized Estimate";
  const titolo2 = quote.titoloPreventivoRiga2 || "";
  const numeroData = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()} - ${new Date().toLocaleDateString("en-CA")}`;
  const subtotale = Number(quote.subtotale);
  const ivaPerc = Number(quote.ivaPercentuale);
  const ivaValore = Number(quote.ivaValore);
  const totale = Number(quote.totale);

  const DARK = "#1a1a2e";
  const GRAY = "#888888";
  const LIGHT_BG = "#f4f6f9";

  const logoPath = snap?.logoUrl || profile?.logoUrl || null;
  const logoDataUri = await fetchLogoDataUri(logoPath);

  const companyInfoStack: Content[] = [
    { text: companyName, fontSize: 13, bold: true, color: DARK, margin: [0, 4, 0, 2] },
  ];
  if (companyVat) companyInfoStack.push({ text: `Tax No.: ${companyVat}`, fontSize: 8, color: "#555555" });
  if (companyAddress) companyInfoStack.push({ text: companyAddress, fontSize: 8, color: "#555555" });
  if (companyPhone) companyInfoStack.push({ text: `Tel: ${companyPhone}`, fontSize: 8, color: "#555555" });
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
      { text: "Chapter", style: "tableHeader" },
      { text: "Net Amount", style: "tableHeaderRight" },
      { text: "Notes", style: "tableHeader" },
    ],
    ...capitoli.map(cap => [
      { text: `${cap.lettera}. ${cap.titolo}`, fontSize: 9, color: "#1a1a1a" } as Content,
      { text: `$ ${formatCad(cap.subtotale)}`, fontSize: 9, alignment: "right" as const, bold: true } as Content,
      { text: cap.osservazione ?? "Standard item", fontSize: 8, color: "#666666", italics: true } as Content,
    ]),
  ];

  const chaptersContent: Content[] = capitoli.flatMap(cap => {
    const bodyRows: Content[][] = [
      [
        { text: "No.", style: "tableHeaderCenter" },
        { text: "Description", style: "tableHeader" },
        { text: "Unit", style: "tableHeaderCenter" },
        { text: "Qty", style: "tableHeaderCenter" },
        { text: "Unit Price ($)", style: "tableHeaderRight" },
        { text: "Total ($)", style: "tableHeaderRight" },
      ],
      ...cap.voci.map((v, vi) => {
        const bg = vi % 2 === 0 ? null : "#f8f9fb";
        return [
          { text: String(vi + 1), fontSize: 8, alignment: "center" as const, color: "#666", fillColor: bg } as Content,
          { text: v.descrizione, fontSize: 8, color: "#1a1a1a", fillColor: bg } as Content,
          { text: v.um, fontSize: 8, alignment: "center" as const, fillColor: bg } as Content,
          { text: String(v.quantita), fontSize: 8, alignment: "center" as const, fillColor: bg } as Content,
          { text: formatCad(v.prezzoUnitario), fontSize: 8, alignment: "right" as const, fillColor: bg } as Content,
          { text: formatCad(v.totale), fontSize: 8, alignment: "right" as const, bold: true, fillColor: bg } as Content,
        ];
      }),
      [
        { text: `Chapter ${cap.lettera} subtotal`, colSpan: 5, fontSize: 8.5, bold: true, fillColor: "#edf0f5", color: DARK } as Content,
        {} as Content, {} as Content, {} as Content, {} as Content,
        { text: `$ ${formatCad(cap.subtotale)}`, fontSize: 8.5, alignment: "right" as const, bold: true, fillColor: "#edf0f5", color: DARK } as Content,
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
      { text: "SUBTOTAL", style: "totLabel" },
      { text: `$ ${formatCad(subtotale)}`, style: "totValue" },
    ],
  ];
  if (sconto && sconto.percentuale > 0) {
    totalsRows.push([
      { text: `DISCOUNT (${sconto.percentuale}%)`, style: "totLabel" },
      { text: `-$ ${formatCad(subtotale - sconto.importoScontato)}`, style: "totValue" },
    ]);
    totalsRows.push([
      { text: "DISCOUNTED SUBTOTAL", style: "totLabel" },
      { text: `$ ${formatCad(sconto.importoScontato)}`, style: "totValue" },
    ]);
  }
  totalsRows.push([
    { text: `TAX (${ivaPerc.toFixed(0)}%)`, style: "totLabel" },
    { text: `$ ${formatCad(ivaValore)}`, style: "totValue" },
  ]);
  totalsRows.push([
    { text: "TOTAL + TAX", fontSize: 10, bold: true, color: "white", fillColor: DARK } as Content,
    { text: `$ ${formatCad(totale)}`, fontSize: 10, bold: true, alignment: "right" as const, color: "white", fillColor: DARK } as Content,
  ]);

  const condizioniContent: Content[] = condizioniPagamento.length > 0
    ? [
        { text: "PAYMENT TERMS", style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        {
          ul: condizioniPagamento.map(c => ({ text: c.toUpperCase(), fontSize: 8.5, bold: true })),
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },
      ]
    : [];

  const signatureSection: Content[] = [
    { text: "QUOTE ACCEPTANCE", style: "sectionHeading", margin: [0, 20, 0, 6] as [number, number, number, number] },
    {
      text: "The undersigned, having reviewed this quote, accepts the terms indicated above and authorizes the work to proceed.",
      fontSize: 8,
      color: "#444",
      margin: [0, 0, 0, 14] as [number, number, number, number],
    },
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: "Date and Location", fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 160, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
        {
          width: "*",
          stack: [
            { text: "Client Signature", fontSize: 8, color: GRAY },
            { canvas: [{ type: "line", x1: 0, y1: 10, x2: 200, y2: 10, lineWidth: 0.5, lineColor: "#aaaaaa" }] },
          ],
        },
        {
          width: "*",
          stack: [
            { text: "Contractor Signature", fontSize: 8, color: GRAY },
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
                { text: `Date: ${new Date().toLocaleDateString("en-CA")}`, fontSize: 8, color: "#555555", alignment: "right" },
                { text: `Page ${currentPage}/${pageCount}`, fontSize: 7, color: GRAY, alignment: "right", margin: [0, 2, 0, 0] },
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
                { text: "PREPARED FOR", fontSize: 7, bold: true, color: GRAY, characterSpacing: 0.5 },
                { text: clientData.nome || "——", fontSize: 10, bold: true, color: DARK },
                ...(clientData.indirizzo ? [{ text: clientData.indirizzo, fontSize: 8.5, color: "#555" }] : []),
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
        { text: "SUMMARY", style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
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
        { text: "DETAILED BILL OF QUANTITIES", style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
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
        { text: "NOTES", style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        { text: quote.note, fontSize: 8, color: "#333" },
      ] as Content[] : []),

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
          text: "Document generated with QuoteAI",
          fontSize: 7.5,
          color: "#aaaaaa",
          alignment: "right",
        },
      ],
    }),
  };

  return getPdfmake().createPdf(docDefinition).getBuffer();
}
