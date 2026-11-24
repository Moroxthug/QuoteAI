/**
 * Downloadable templates (docs/SEO-RECOVERY-PLAN.md S3 item 4):
 *   public/templates/quote-template-canada.xlsx      (EN, formulas + province tax lookup)
 *   public/templates/quote-template-canada.docx      (EN)
 *   public/templates/renovation-contract-template.docx (EN)
 *   public/templates/modele-soumission-quebec.xlsx   (FR)
 *   public/templates/modele-soumission-quebec.docx   (FR)
 *
 * Tax rates come from src/lib/tax-profiles.ts, so a rate change there plus a
 * re-run keeps the files in step. No dependencies: .xlsx and .docx are zip
 * files of XML, written with node:zlib.
 *
 *   pnpm --filter @workspace/quote-ai run templates
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";
import { TAX_PROFILES } from "../src/lib/tax-profiles";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/templates");
const RATES_AS_OF = { en: "November 2026", fr: "novembre 2026" };

// ─── zip ─────────────────────────────────────────────────────────────────────
function zip(files: Record<string, string>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // Fixed timestamp (1 Jan 2026) so re-runs produce identical files.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf8");
    const comp = deflateRawSync(data);
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ─── copy ────────────────────────────────────────────────────────────────────
type Lang = "en" | "fr";
const PROVINCES: Record<string, { en: string; fr: string }> = {
  AB: { en: "Alberta", fr: "Alberta" },
  BC: { en: "British Columbia", fr: "Colombie-Britannique" },
  MB: { en: "Manitoba", fr: "Manitoba" },
  NB: { en: "New Brunswick", fr: "Nouveau-Brunswick" },
  NL: { en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" },
  NS: { en: "Nova Scotia", fr: "Nouvelle-Écosse" },
  NT: { en: "Northwest Territories", fr: "Territoires du Nord-Ouest" },
  NU: { en: "Nunavut", fr: "Nunavut" },
  ON: { en: "Ontario", fr: "Ontario" },
  PE: { en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" },
  QC: { en: "Quebec", fr: "Québec" },
  SK: { en: "Saskatchewan", fr: "Saskatchewan" },
  YT: { en: "Yukon", fr: "Yukon" },
};
const FR_CODE: Record<string, string> = { GST: "TPS", HST: "TVH", PST: "TVP", QST: "TVQ", RST: "TVD" };

const T = {
  en: {
    sheet: "Quote", rates: "Tax rates", how: "How to use",
    title: "QUOTE",
    from: ["Business name", "Address", "Phone / email", "GST/HST number", "QST number (Québec only)", "Licence number (if required)"],
    meta: ["Quote number", "Date", "Valid until", "Province of the work", "Charge PST/RST?"],
    client: ["Client", "Job address", "Job description"],
    head: ["Description", "Qty", "Unit", "Unit price", "Amount"],
    subtotal: "Subtotal", total: "Total", deposit: "Deposit on signing",
    terms: ["Payment terms", "Exclusions", "Notes"],
    accept: "Accepted by (client signature)", date: "Date",
    yes: "Yes", no: "No",
    ratesHead: ["Code", "Province or territory", "Tax 1", "Rate 1", "Tax 2", "Rate 2"],
    note: `Rates as of ${RATES_AS_OF.en}, from the CRA's GST/HST rates page (canada.ca). Check for changes before you rely on them. Template by quoteai.ca.`,
    howLines: [
      "1. Fill in the yellow cells: your business details, the client, the quote number and dates.",
      "2. Pick the province where the work is done. The GST/HST line and, in Québec, the QST line fill in by themselves.",
      "3. PST (BC, SK) and RST (MB): whether it goes on the client's bill depends on the province and the type of contract. For example, BC real property contractors usually pay PST on their materials instead of charging it. Check your province's rules, then set 'Charge PST/RST?' to Yes only if you charge it.",
      "4. List the work one task or material per line: description, quantity, unit and unit price. Amounts and totals calculate themselves.",
      "5. Only show a GST/HST line if you are registered. The CRA's small supplier threshold is $30,000 of taxable sales (canada.ca, 'When to register').",
      "6. Save as PDF before you send it, so the client can't edit it.",
      "General information, not tax or legal advice.",
    ],
    file: "quote-template-canada",
  },
  fr: {
    sheet: "Soumission", rates: "Taux de taxes", how: "Mode d'emploi",
    title: "SOUMISSION",
    from: ["Nom de l'entreprise", "Adresse", "Téléphone / courriel", "Numéro de TPS/TVH", "Numéro de TVQ", "Licence RBQ / NEQ"],
    meta: ["Numéro de soumission", "Date", "Valide jusqu'au", "Province des travaux", "Facturer la TVP/TVD?"],
    client: ["Client", "Adresse des travaux", "Description des travaux"],
    head: ["Description", "Qté", "Unité", "Prix unitaire", "Montant"],
    subtotal: "Sous-total", total: "Total", deposit: "Acompte à la signature",
    terms: ["Modalités de paiement", "Exclusions", "Notes"],
    accept: "Acceptée par (signature du client)", date: "Date",
    yes: "Oui", no: "Non",
    ratesHead: ["Code", "Province ou territoire", "Taxe 1", "Taux 1", "Taxe 2", "Taux 2"],
    note: `Taux en vigueur en ${RATES_AS_OF.fr}, selon la page des taux de TPS/TVH de l'ARC (canada.ca) et Revenu Québec. Vérifiez-les avant de vous y fier. Modèle offert par quoteai.ca.`,
    howLines: [
      "1. Remplissez les cellules jaunes : vos coordonnées, le client, le numéro et les dates de la soumission.",
      "2. Choisissez la province où les travaux ont lieu. Au Québec, la TPS (5 %) et la TVQ (9,975 %) s'affichent sur deux lignes.",
      "3. Au Québec, inscrivez votre numéro de licence RBQ sur la soumission, au format « Licence RBQ : XXXX-XXXX-XX » (rbq.gouv.qc.ca).",
      "4. Une ligne par tâche ou par matériau : description, quantité, unité et prix unitaire. Les montants et les totaux se calculent seuls.",
      "5. N'affichez la TPS et la TVQ que si vous êtes inscrit. Le seuil de petit fournisseur est de 30 000 $ de ventes taxables (canada.ca).",
      "6. Enregistrez en PDF avant d'envoyer, pour que le client ne puisse pas modifier le document.",
      "Renseignements généraux, pas un avis fiscal ou juridique.",
    ],
    file: "modele-soumission-quebec",
  },
} as const;

// ─── xlsx ────────────────────────────────────────────────────────────────────
// cellXfs: 0 default · 1 title · 2 label · 3 table head · 4 cell text · 5 cell money
// 6 cell number · 7 total money · 8 percent · 9 note · 10 input · 11 money plain · 12 total label
function styles(lang: Lang) {
  const money = lang === "fr" ? '#,##0.00\\ "$"' : '"$"#,##0.00';
  return `${XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="${esc(money)}"/><numFmt numFmtId="165" formatCode="0.000%"/></numFmts>
<fonts count="5">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="18"/><color rgb="FF1B2A4A"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FF1B2A4A"/><name val="Arial"/></font>
<font><i/><sz val="9"/><color rgb="FF6B7280"/><name val="Arial"/></font>
<font><b/><sz val="12"/><color rgb="FF1B2A4A"/><name val="Arial"/></font>
</fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8ECF3"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="13">
<xf/>
<xf fontId="1" applyFont="1"/>
<xf fontId="2" applyFont="1"/>
<xf fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf borderId="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="164" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf borderId="1" applyBorder="1"/>
<xf numFmtId="164" fontId="4" fillId="2" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" applyNumberFormat="1"/>
<xf fontId="3" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf fillId="3" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="164" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf fontId="4" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
</styleSheet>`;
}

type Cell = { v?: string | number; f?: string; s?: number };
class Sheet {
  rows = new Map<number, Map<string, Cell>>();
  merges: string[] = [];
  set(ref: string, cell: Cell) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
    const r = Number(m[2]);
    if (!this.rows.has(r)) this.rows.set(r, new Map());
    this.rows.get(r)!.set(m[1]!, cell);
  }
  xml(cols: number[], extra = "", heights: Record<number, number> = {}) {
    const colXml = cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    const rowXml = [...this.rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([r, cells]) => {
        const cs = [...cells.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([c, cell]) => {
            const s = cell.s ? ` s="${cell.s}"` : "";
            if (cell.f) return `<c r="${c}${r}"${s}><f>${esc(cell.f)}</f></c>`;
            if (typeof cell.v === "number") return `<c r="${c}${r}"${s}><v>${cell.v}</v></c>`;
            if (cell.v === undefined || cell.v === "") return `<c r="${c}${r}"${s}/>`;
            return `<c r="${c}${r}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`;
          })
          .join("");
        const ht = heights[r] ? ` ht="${heights[r]}" customHeight="1"` : "";
        return `<row r="${r}"${ht}>${cs}</row>`;
      })
      .join("");
    const merges = this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
    return `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${colXml}</cols><sheetData>${rowXml}</sheetData>${merges}${extra}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }
}

function quoteXlsx(lang: Lang): Buffer {
  const t = T[lang];
  const codes = Object.keys(TAX_PROFILES);
  const label = (c: string) => (lang === "fr" ? FR_CODE[c] ?? c : c);

  // Rates sheet: A code, B name, C tax 1, D rate 1, E tax 2, F rate 2.
  const rates = new Sheet();
  [...t.ratesHead, lang === "fr" ? "Libellé 1" : "Label 1", lang === "fr" ? "Libellé 2" : "Label 2"].forEach((h, i) => rates.set(`${"ABCDEFGH"[i]}1`, { v: h, s: 3 }));
  codes.forEach((code, i) => {
    const r = i + 2;
    const comps = TAX_PROFILES[code as keyof typeof TAX_PROFILES].components;
    rates.set(`A${r}`, { v: code, s: 6 });
    rates.set(`B${r}`, { v: PROVINCES[code]![lang], s: 6 });
    rates.set(`C${r}`, { v: label(comps[0]!.code), s: 6 });
    rates.set(`D${r}`, { v: comps[0]!.rate / 100, s: 8 });
    rates.set(`E${r}`, { v: comps[1] ? label(comps[1].code) : "", s: 6 });
    rates.set(`F${r}`, { v: comps[1] ? comps[1].rate / 100 : 0, s: 8 });
    // Display labels as text, so no locale-dependent TEXT() formats are needed.
    const fmt = (rate: number) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 3 }).format(rate);
    const show = (c: { code: string; rate: number }) => `${label(c.code)} (${fmt(c.rate)}${lang === "fr" ? "\u00a0%" : "%"})`;
    rates.set(`G${r}`, { v: show(comps[0]!), s: 6 });
    rates.set(`H${r}`, { v: comps[1] ? show(comps[1]) : "", s: 6 });
  });
  const last = codes.length + 1;
  rates.set(`A${last + 2}`, { v: t.note, s: 9 });
  rates.merges.push(`A${last + 2}:H${last + 2}`);
  const R = `'${t.rates}'!$A$2:$H${last}`;

  const q = new Sheet();
  q.set("A1", { v: t.title, s: 1 });
  t.from.forEach((l, i) => {
    q.set(`A${i + 3}`, { v: l, s: 2 });
    q.set(`B${i + 3}`, { v: "", s: 10 });
    q.set(`C${i + 3}`, { v: "", s: 10 });
    q.merges.push(`B${i + 3}:C${i + 3}`);
  });
  t.meta.forEach((l, i) => {
    q.set(`D${i + 3}`, { v: l, s: 2 });
    q.set(`E${i + 3}`, { v: i === 3 ? (lang === "fr" ? "QC" : "ON") : i === 4 ? t.no : "", s: 10 });
  });
  t.client.forEach((l, i) => {
    q.set(`A${i + 10}`, { v: l, s: 2 });
    q.set(`B${i + 10}`, { v: "", s: 10 });
    q.merges.push(`B${i + 10}:E${i + 10}`);
    for (const c of "CDE") q.set(`${c}${i + 10}`, { v: "", s: 10 });
  });
  t.head.forEach((h, i) => q.set(`${"ABCDE"[i]}14`, { v: h, s: 3 }));
  const first = 15;
  const lastItem = 34;
  for (let r = first; r <= lastItem; r++) {
    q.set(`A${r}`, { v: "", s: 4 });
    q.set(`B${r}`, { v: "", s: 6 });
    q.set(`C${r}`, { v: "", s: 6 });
    q.set(`D${r}`, { v: "", s: 5 });
    q.set(`E${r}`, { f: `IF(OR(B${r}="",D${r}=""),"",ROUND(B${r}*D${r},2))`, s: 5 });
  }
  const look = (col: number) => `VLOOKUP($E$6,${R},${col},FALSE)`;
  // Tax 2 is always charged when it is QST; PST/RST only when the user says so.
  const rate2 = `IF(OR(${look(5)}="${label("QST")}",$E$7="${t.yes}"),${look(6)},0)`;
  q.set("D36", { v: t.subtotal, s: 2 });
  q.set("E36", { f: `SUM(E${first}:E${lastItem})`, s: 5 });
  q.set("D37", { f: look(7), s: 2 });
  q.set("E37", { f: `ROUND(E36*${look(4)},2)`, s: 5 });
  q.set("D38", { f: `IF(${rate2}=0,"",${look(8)})`, s: 2 });
  q.set("E38", { f: `ROUND(E36*${rate2},2)`, s: 5 });
  q.set("D39", { v: t.total, s: 12 });
  q.set("E39", { f: "E36+E37+E38", s: 7 });
  q.set("D40", { v: t.deposit, s: 2 });
  q.set("E40", { v: "", s: 11 });
  t.terms.forEach((l, i) => {
    const r = 42 + i;
    q.set(`A${r}`, { v: l, s: 2 });
    q.set(`B${r}`, { v: "", s: 10 });
    for (const c of "CDE") q.set(`${c}${r}`, { v: "", s: 10 });
    q.merges.push(`B${r}:E${r}`);
  });
  q.set("A47", { v: t.accept, s: 2 });
  q.set("B47", { v: "", s: 10 });
  q.set("C47", { v: "", s: 10 });
  q.merges.push("B47:C47");
  q.set("D47", { v: t.date, s: 2 });
  q.set("E47", { v: "", s: 10 });
  q.set("A49", { v: t.note, s: 9 });
  q.merges.push("A49:E49");
  const validation = `<dataValidations count="2"><dataValidation type="list" allowBlank="0" showErrorMessage="1" sqref="E6"><formula1>'${esc(t.rates)}'!$A$2:$A$${last}</formula1></dataValidation><dataValidation type="list" allowBlank="0" showErrorMessage="1" sqref="E7"><formula1>"${t.yes},${t.no}"</formula1></dataValidation></dataValidations>`;

  const how = new Sheet();
  how.set("A1", { v: t.how, s: 1 });
  t.howLines.forEach((l, i) => how.set(`A${i + 3}`, { v: l, s: i === t.howLines.length - 1 ? 9 : 4 }));

  const sheetNames = [t.sheet, t.rates, t.how];
  const files: Record<string, string> = {
    "[Content_Types].xml": `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetNames.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetNames.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${esc(t.sheet)}'!$A$1:$E$49</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetNames.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": styles(lang),
    "xl/worksheets/sheet1.xml": q.xml([44, 9, 10, 24, 16], validation, { 1: 28 }),
    "xl/worksheets/sheet2.xml": rates.xml([8, 30, 10, 10, 10, 10, 16, 16]),
    "xl/worksheets/sheet3.xml": how.xml([110]),
  };
  return zip(files);
}

// ─── docx ────────────────────────────────────────────────────────────────────
type Run = string | { b?: string; i?: string };
const run = (r: Run) => {
  if (typeof r === "string") return `<w:r><w:t xml:space="preserve">${esc(r)}</w:t></w:r>`;
  if (r.b !== undefined) return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(r.b)}</w:t></w:r>`;
  return `<w:r><w:rPr><w:i/><w:color w:val="6B7280"/></w:rPr><w:t xml:space="preserve">${esc(r.i ?? "")}</w:t></w:r>`;
};
const P = (runs: Run | Run[], style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${(Array.isArray(runs) ? runs : [runs]).map(run).join("")}</w:p>`;
const LI = (runs: Run | Run[]) => `<w:p><w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${(Array.isArray(runs) ? runs : [runs]).map(run).join("")}</w:p>`;
function table(widths: number[], rows: Run[][], headRow = true) {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const border = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>`).join("")}</w:tblBorders>`;
  const trs = rows
    .map((cells, ri) => `<w:tr>${cells.map((c, ci) => `<w:tc><w:tcPr><w:tcW w:w="${widths[ci]}" w:type="dxa"/>${headRow && ri === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="E8ECF3"/>' : ""}</w:tcPr><w:p>${run(headRow && ri === 0 && typeof c === "string" ? { b: c } : c)}</w:p></w:tc>`).join("")}</w:tr>`)
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${border}<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>`;
}

function docx(body: string, lang: Lang): Buffer {
  const font = "Arial";
  const files: Record<string, string> = {
    "[Content_Types].xml": `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
    "_rels/.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/_rels/document.xml.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
    "word/styles.xml": `${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="20"/><w:lang w:val="${lang === "fr" ? "fr-CA" : "en-CA"}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:b/><w:color w:val="1B2A4A"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1B2A4A"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="6B7280"/><w:sz w:val="17"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:style></w:styles>`,
    "word/numbering.xml": `${XML}<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
    "word/document.xml": `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  };
  return zip(files);
}

const ITEM_W = [4900, 900, 1000, 1600, 1680];

function quoteDocxEn(): Buffer {
  const blank = Array.from({ length: 8 }, () => ["", "", "", "", ""] as Run[]);
  const body = [
    P("QUOTE", "Title"),
    P({ b: "[Your business name]" }),
    P("[Street address, city, province, postal code]"),
    P("[Phone]  ·  [Email]  ·  [Website]"),
    P("GST/HST number: [123456789 RT0001]   (delete this line if you are not registered)"),
    P("Licence: [number, where your province or trade requires one]"),
    P(""),
    table([2400, 4000, 1700, 1980], [
      [{ b: "Quote number" }, "[Q-0001]", { b: "Date" }, "[date]"],
      [{ b: "Client" }, "[name]", { b: "Valid until" }, "[date]"],
      [{ b: "Job address" }, "[address]", { b: "Province" }, "[province]"],
    ], false),
    P("Scope of work", "Heading1"),
    P("[One short paragraph: what you will do, where, with which products. The line items below price it.]"),
    table(ITEM_W, [["Description", "Qty", "Unit", "Unit price", "Amount"], ...blank]),
    table([8400, 1680], [
      [{ b: "Subtotal" }, "[$0.00]"],
      ["[GST 5% / HST 13%, 14% or 15%, by province]", "[$0.00]"],
      ["[QST 9.975% in Québec; PST or RST only if your contract charges it]", "[$0.00]"],
      [{ b: "Total" }, { b: "[$0.00]" }],
    ], false),
    P("Exclusions", "Heading1"),
    LI("[Things a client might assume are included: permits, moving furniture, repairs to hidden damage, disposal of old fixtures.]"),
    LI("[Anything behind walls or under floors you have not opened. Hidden conditions are priced by written change order.]"),
    P("Payment terms", "Heading1"),
    LI("Deposit: [amount] on signing. [In Ontario the province recommends no more than 10% of the total.]"),
    LI("[Progress payment: amount, due when (an event, not a date)]"),
    LI("Balance: [amount] on completion. Payment by [e-transfer / cheque / card]."),
    P("Validity", "Heading1"),
    P("This quote is valid until [date]. After that date, prices and the schedule may change."),
    P("Acceptance", "Heading1"),
    P("I accept this quote and its terms."),
    table([5040, 5040], [["Client signature:", "Date:"], ["Contractor signature:", "Date:"]], false),
    P(""),
    P({ i: `Tax rates as of ${RATES_AS_OF.en}: GST 5%; HST 13% (ON), 14% (NS), 15% (NB, NL, PE); QST 9.975% (QC); PST 7% (BC), 6% (SK); RST 7% (MB). Check the CRA's GST/HST rates page on canada.ca before you rely on them. Template by quoteai.ca. General information, not tax or legal advice.` }),
  ].join("");
  return docx(body, "en");
}

function quoteDocxFr(): Buffer {
  const blank = Array.from({ length: 8 }, () => ["", "", "", "", ""] as Run[]);
  const body = [
    P("SOUMISSION", "Title"),
    P({ b: "[Nom de votre entreprise]" }),
    P("[Adresse, ville, province, code postal]"),
    P("[Téléphone]  ·  [Courriel]  ·  [Site Web]"),
    P("Licence RBQ : [XXXX-XXXX-XX]    NEQ : [numéro]"),
    P("No de TPS : [123456789 RT0001]    No de TVQ : [1234567890 TQ0001]   (retirez ces lignes si vous n'êtes pas inscrit)"),
    P(""),
    table([2400, 4000, 1700, 1980], [
      [{ b: "Soumission no" }, "[S-0001]", { b: "Date" }, "[date]"],
      [{ b: "Client" }, "[nom]", { b: "Valide jusqu'au" }, "[date]"],
      [{ b: "Adresse des travaux" }, "[adresse]", { b: "Province" }, "Québec"],
    ], false),
    P("Description des travaux", "Heading1"),
    P("[Un court paragraphe : les travaux, l'endroit, les produits. Les lignes ci-dessous en donnent le prix.]"),
    table(ITEM_W, [["Description", "Qté", "Unité", "Prix unitaire", "Montant"], ...blank]),
    table([8400, 1680], [
      [{ b: "Sous-total" }, "[0,00 $]"],
      ["TPS (5 %)", "[0,00 $]"],
      ["TVQ (9,975 %)", "[0,00 $]"],
      [{ b: "Total" }, { b: "[0,00 $]" }],
    ], false),
    P("Exclusions", "Heading1"),
    LI("[Ce que le client pourrait croire inclus : permis, déplacement des meubles, réparation de dommages cachés, disposition des anciens appareils.]"),
    LI("[Tout ce qui se trouve derrière les murs ou sous les planchers non ouverts. Les conditions cachées sont facturées par avenant écrit.]"),
    P("Modalités de paiement", "Heading1"),
    LI("Acompte : [montant] à la signature. [Contrat signé au domicile du client pour certains travaux : vérifiez les règles du commerçant itinérant de l'OPC avant d'exiger un acompte.]"),
    LI("[Paiement d'étape : montant, exigible à quel moment (une étape, pas une date)]"),
    LI("Solde : [montant] à la fin des travaux. Paiement par [virement Interac / chèque / carte]."),
    P("Validité", "Heading1"),
    P("Cette soumission est valide jusqu'au [date]. Après cette date, les prix et l'échéancier peuvent changer."),
    P("Acceptation", "Heading1"),
    P("J'accepte cette soumission et ses conditions."),
    table([5040, 5040], [["Signature du client :", "Date :"], ["Signature de l'entrepreneur :", "Date :"]], false),
    P(""),
    P({ i: `Taux en vigueur en ${RATES_AS_OF.fr} : TPS 5 %, TVQ 9,975 % (canada.ca et revenuquebec.ca). Le numéro de licence RBQ doit figurer sur vos soumissions et contrats (rbq.gouv.qc.ca). Modèle offert par quoteai.ca. Renseignements généraux, pas un avis fiscal ou juridique.` }),
  ].join("");
  return docx(body, "fr");
}

function contractDocxEn(): Buffer {
  const H = (s: string) => P(s, "Heading1");
  const body = [
    P("Renovation contract", "Title"),
    P({ i: "Template from quoteai.ca. This is a starting point, not legal advice. Provincial consumer laws set required content and cancellation rights for home renovation contracts, especially when the contract is signed at the client's home. Read the notes in [brackets], delete them, and have a lawyer review your final version." }),
    H("1. Parties"),
    P([{ b: "Contractor: " }, "[legal business name], [address], [phone], [email]. GST/HST no. [number]. Licence no. [number, where required, e.g. RBQ in Québec]."]),
    P([{ b: "Client: " }, "[name], [address], [phone], [email]."]),
    P([{ b: "Property where the work is done: " }, "[address]."]),
    H("2. Scope of work"),
    P("The work is described in Quote [number] dated [date], attached and forming part of this contract. Work not listed in that quote is excluded."),
    P({ i: "[Attach the itemized quote. One description of the scope, not two.]" }),
    H("3. Price and taxes"),
    P("Contract price: $[amount] plus [GST/HST/QST at rate] ($[tax]), total $[total]."),
    P("Allowances: [item] is an allowance of $[amount] before tax. The client pays or is credited the difference between the allowance and the actual cost."),
    P({ i: "[Ontario requires the total price including taxes. If an estimate is part of the contract, Ontario law limits what you may charge above it without a signed change.]" }),
    H("4. Payment schedule"),
    LI("Deposit: $[amount] on signing."),
    LI("$[amount] when [event, e.g. rough-in passes inspection]."),
    LI("$[amount] on substantial completion."),
    LI("Holdback: $[amount] retained as required by [the Construction Act (Ontario) / the Builders Lien Act (BC) / your province's law], paid when the holdback period ends."),
    P({ i: "[Tie each payment to an event, and check the amounts add up to the total. Ontario recommends deposits of no more than 10%. In Québec, contractors treated as itinerant merchants may not collect payment during the 10-day cancellation period. In Alberta, taking any payment before the work is finished requires a prepaid contracting licence.]" }),
    H("5. Changes"),
    P("No work outside the scope will be done without a written change order stating the work, the price, the tax and the effect on the completion date, signed by both parties before the work starts."),
    H("6. Schedule and delays"),
    P("Start date: [date]. Completion date: [date]. Dates move by the length of any delay caused by permit or inspection scheduling, back-ordered materials outside the contractor's control, weather for exterior work, or hidden conditions requiring a change order. The contractor will tell the client in writing within [two] business days of such a delay."),
    H("7. Permits and inspections"),
    P("[The contractor / the client] obtains and pays for the permits listed here: [permits]. The contractor books the required inspections."),
    H("8. Site, clean-up and disposal"),
    P("[Working hours, access, protection of floors and furniture, daily clean-up, disposal of debris and old fixtures.]"),
    H("9. Insurance and workers' compensation"),
    P("The contractor carries commercial general liability insurance of $[amount] and is registered with [WSIB / WorkSafeBC / CNESST / WCB-Alberta]. Certificates are available on request."),
    H("10. Warranty"),
    P("Workmanship is warranted for [one year] from completion. Manufacturer warranties pass to the client. The warranty does not cover damage from misuse, lack of maintenance or alterations by others."),
    H("11. Cancellation"),
    P({ i: "[Required wording depends on the province and where the contract is signed. Ontario: a contract signed at the client's home carries a 10-day cooling-off period (ontario.ca, guide for home renovation and roofing businesses). Québec: itinerant merchant contracts must follow the Office de la protection du consommateur's rules, including its cancellation form. Alberta: use the exact cancellation statement in the regulation. British Columbia: see Consumer Protection BC's direct sales rules. Put the correct statement here.]" }),
    H("12. Disputes"),
    P("The parties will first try to settle any dispute by discussion. [Mediation / small claims / courts of the province of the work.]"),
    H("13. Entire agreement"),
    P("This contract, the attached quote and any signed change orders are the whole agreement. Changes are valid only in writing and signed by both parties."),
    H("Signatures"),
    table([5040, 5040], [["Client signature:", "Date:"], ["Contractor signature:", "Date:"]], false),
    P(""),
    P({ i: "The client acknowledges receiving a signed copy of this contract on [date]." }),
    P({ i: "Template by quoteai.ca. General information, not legal advice." }),
  ].join("");
  return docx(body, "en");
}

mkdirSync(OUT, { recursive: true });
const out: Record<string, Buffer> = {
  [`${T.en.file}.xlsx`]: quoteXlsx("en"),
  [`${T.en.file}.docx`]: quoteDocxEn(),
  "renovation-contract-template.docx": contractDocxEn(),
  [`${T.fr.file}.xlsx`]: quoteXlsx("fr"),
  [`${T.fr.file}.docx`]: quoteDocxFr(),
};
for (const [name, buf] of Object.entries(out)) {
  writeFileSync(join(OUT, name), buf);
  console.log(`  ✓ public/templates/${name} (${(buf.length / 1024).toFixed(1)} kB)`);
}
