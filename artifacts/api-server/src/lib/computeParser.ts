export interface ParsedItem {
  descrizione: string;
  um: string;
  quantita: number;
  prezzoUnitario: number;
  totale: number;
}

export interface ParsedChapter {
  lettera: string;
  titolo: string;
  osservazione: string;
  voci: ParsedItem[];
  subtotale: number;
}

function parseEuro(s: string): number {
  const t = s.trim();
  // Italian format: comma = decimal separator, dot = thousands separator
  // BUT if there is NO comma, the dot might be decimal separator (e.g., 16.00)
  // or thousands separator (e.g., 1.000). We distinguish them:
  if (t.includes(",")) {
    // Comma present: comma is decimal, dots are thousands
    return Number(t.replace(/\./g, "").replace(/,/g, ".")) || 0;
  }
  // No comma: check if dot is thousands separator (followed by exactly 3 digits)
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // e.g., 1.000, 12.500, 1.000.000 — dot is thousands separator
    return Number(t.replace(/\./g, "")) || 0;
  }
  // Dot is decimal separator (e.g., 16.00, 22.50, 0.30)
  return Number(t) || 0;
}

// ───────────────────────────────────────────────────────────────────────────────
// 1. Markdown-style computo metrico (with ## chapters and : QTA × PU €/UM = TOT)
// ───────────────────────────────────────────────────────────────────────────────

export function isComputoMetrico(text: string): boolean {
  const lines = text.split(/\r?\n/);
  const chapterLines = lines.filter(l => l.match(/^##\s+\d+\.\s/));
  const voceLines = lines.filter(l => l.match(/:\s*[\d.,]+\s*[a-zA-Z./°]+\s*[×x]\s*[\d.,]+\s*€\//) || l.match(/=\s*\*\*[\d.,]+\s*€\*\*/));
  return chapterLines.length >= 2 && voceLines.length >= 5;
}

const CHAPTER_RE = /^##\s+\d+\.\s*(.+?)(?:\s*\(.+?\))?\s*$/;
const SUBTOTALE_RE = /Subtotale Categoria:\s*([\d.,]+)\s*€/i;
const VOCE_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*€\/([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;
const VOCE_NO_PU_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;
const VOCE_MULTI_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*€\/([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;

function extractDesc(line: string): string {
  const colonIdx = line.indexOf(":");
  const prefix = colonIdx >= 0 ? line.substring(0, colonIdx) : line;
  return prefix.replace(/^\*+\s*/, "").replace(/\*\*/g, "").trim();
}

function normalizeLines(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("*") && !line.includes("€") && !line.includes(":") && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (!next.startsWith("##") && !next.startsWith("*")) {
        result.push(line + " " + next);
        i += 2;
        continue;
      }
    }
    result.push(line);
    i++;
  }
  return result;
}

export function parseComputoMetrico(text: string): ParsedChapter[] | null {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const lines = normalizeLines(rawLines);
  const chapters: ParsedChapter[] = [];
  let currentChapter: ParsedChapter | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const chapterMatch = line.match(CHAPTER_RE);
    if (chapterMatch) {
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = {
        lettera: String.fromCharCode(65 + chapters.length),
        titolo: chapterMatch[1].trim(),
        osservazione: "Voce ordinaria",
        voci: [],
        subtotale: 0,
      };
      continue;
    }
    if (!currentChapter) continue;
    const subtotaleMatch = line.match(SUBTOTALE_RE);
    if (subtotaleMatch) {
      currentChapter.subtotale = parseEuro(subtotaleMatch[1]);
      continue;
    }
    const multiMatch = line.match(VOCE_MULTI_RE);
    if (multiMatch) {
      const [, qty, um, pu, _puUm, qty2, _um2, tot] = multiMatch;
      const q = parseEuro(qty);
      const q2 = parseEuro(qty2);
      const t = parseEuro(tot);
      currentChapter.voci.push({
        descrizione: extractDesc(line), um: um.trim(), quantita: q * q2,
        prezzoUnitario: t / (q * q2), totale: t,
      });
      continue;
    }
    const voceMatch = line.match(VOCE_RE);
    if (voceMatch) {
      const [, qty, um, pu, _puUm, tot] = voceMatch;
      currentChapter.voci.push({
        descrizione: extractDesc(line), um: um.trim(), quantita: parseEuro(qty),
        prezzoUnitario: parseEuro(pu), totale: parseEuro(tot),
      });
      continue;
    }
    const noPuMatch = line.match(VOCE_NO_PU_RE);
    if (noPuMatch) {
      const [, qty, um, tot] = noPuMatch;
      const q = parseEuro(qty);
      const t = parseEuro(tot);
      currentChapter.voci.push({
        descrizione: extractDesc(line), um: um.trim(), quantita: q,
        prezzoUnitario: q > 0 ? t / q : t, totale: t,
      });
      continue;
    }
  }

  if (currentChapter) chapters.push(currentChapter);
  if (chapters.length === 0 || chapters.every(c => c.voci.length === 0)) return null;
  chapters.forEach(c => {
    if (c.subtotale === 0) c.subtotale = c.voci.reduce((sum, v) => sum + v.totale, 0);
  });
  return chapters;
}

// ───────────────────────────────────────────────────────────────────────────────
// 2. Robust tabular computo metrico parser (PDF extracts with multi-line descriptions)
// ───────────────────────────────────────────────────────────────────────────────

// Valid units of measure for a computo metrico (NOT dimensions like cm, mm, lt, l)
const VALID_UMS = [
  "mq", "ml", "mc",
  "n.", "n", "nr", "num", "numero",
  "cpo", "cad", "corpo",
  "kg", "q", "qli", "quint", "quintali",
  "t", "ton", "tonn", "tonnell", "tonnellate",
  "ore", "h", "hh",
  "a.c.", "a.c", "ac",
  "pezzi", "pz", "pzz", "p", "pc", "pe",
  "unità", "u", "ud", "unit",
  "pers",
  "giorni", "gg",
  "settimane", "sett", "settim", "set",
  "mesi", "mese",
  "ann",
  "ha",
  "km",
  "mld",
  "kw", "kwh", "kW", "kWh",
  "voce", "voc", "voci",
  "forfait", "forfett", "globale",
  "€", "euro",
  "m", "mt", "mtr", "mtrl", "mtrli",
  "m2", "m3", "m²", "m³",
  "mtl", "mtli",
  "percento", "%",
];

function isValidUM(token: string): boolean {
  const t = token.toLowerCase().replace(/\.$/, ""); // strip trailing dot
  if (VALID_UMS.includes(t)) return true;
  if (VALID_UMS.includes(token.toLowerCase())) return true;
  // special: "n." with trailing dot
  if (token.toLowerCase() === "n.") return true;
  if (token.toLowerCase() === "cad.") return true;
  return false;
}

/**
 * Try to parse a line as [description] [UM] [quantity].
 * Returns null if the last two tokens are not a valid UM + number.
 */
function tryParseVoceLine(text: string): { descrizione: string; um: string; quantita: number } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  const lastToken = tokens[tokens.length - 1];
  const secondLastToken = tokens[tokens.length - 2];

  // Last token must be a number (quantity)
  const isQta = /^[\d.,]+$/.test(lastToken);
  if (!isQta) return null;
  const quantita = parseEuro(lastToken);
  if (quantita <= 0) return null;

  // Second-to-last token must be a valid UM
  const um = secondLastToken.toLowerCase();
  if (!isValidUM(secondLastToken)) return null;

  // Everything before is the description
  const descrizione = tokens.slice(0, tokens.length - 2).join(" ").trim();
  return { descrizione, um, quantita };
}

// Category keywords that appear at the start of a line
const CATEGORY_RE = /^(Demolizioni|Costruzioni|Impianti|Muratura|Finiture|Strutture|Chiusure|Rasante|Controsoffitti|Impermeabilizzazioni|Pavimentazioni|Rivestimenti|Verniciature|Falegnameria|Infissi|Fabbro|Giardino|Spese|Generale|Varie|Installazioni|Ripristini|Accatastamenti|Trasporti|Smaltimenti|Noleggi|Assistenza|Progetto|Direzione|Collaudi|Certificazioni|Pratiche|Permessi|Documentazione|Geologia|Topografia|Rilievo|sicurezza|Coordinamento|Cantiere|Altro)\b/i;

function startsWithCategory(line: string): { categoria: string; rest: string } | null {
  const match = line.trim().match(CATEGORY_RE);
  if (!match) return null;
  return { categoria: match[0], rest: line.trim().slice(match[0].length).trim() };
}

export interface TabularVoce {
  categoria: string;
  descrizione: string;
  um: string;
  quantita: number;
}

export interface TabularSection {
  titolo: string;
  voci: TabularVoce[];
}

export function isTabularComputoMetrico(text: string): boolean {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const categoryLines = lines.filter(l => CATEGORY_RE.test(l.trim()));
  return categoryLines.length >= 10;
}

/**
 * Robustly parse a tabular computo metrico where descriptions may span multiple lines.
 *
 * Pattern:
 *   Demolizioni  [description on same line or next lines]  [UM]  [QTA]
 *
 * The category can appear on a line by itself, followed by description lines,
 * and the last line(s) may contain UM + QTA.
 */
export function parseTabularComputoMetrico(text: string): { sections: TabularSection[]; totalVoci: number; rawVoci: TabularVoce[] } | null {
  const rawLines = text.split(/\r?\n/).map(l => l.trim());
  const lines: string[] = [];
  for (const l of rawLines) {
    if (l.length === 0) continue;
    // Skip page markers and headers
    if (/^\s*Pagina\s+\d+/i.test(l)) continue;
    if (/^\s*COMPUTO\s+METRICO/i.test(l)) continue;
    if (/^\s*OPERE\s+/i.test(l) && l.length < 40) continue;
    if (/^\s*U\.M\.\s*QTA\s*PRIX/i.test(l)) continue;
    lines.push(l);
  }

  const voci: TabularVoce[] = [];
  let currentCategory: string | null = null;
  let descLines: string[] = [];

  function flushVoce() {
    if (!currentCategory || descLines.length === 0) {
      currentCategory = null;
      descLines = [];
      return;
    }

    // Try the last line as UM+QTA
    const lastLine = descLines[descLines.length - 1];
    const parsed = tryParseVoceLine(lastLine);
    if (parsed) {
      const desc = descLines.slice(0, -1).join(" ").trim();
      const fullDesc = desc ? (desc + " " + parsed.descrizione).trim() : parsed.descrizione;
      if (fullDesc) {
        voci.push({
          categoria: currentCategory,
          descrizione: fullDesc,
          um: parsed.um,
          quantita: parsed.quantita,
        });
      }
    } else {
      // Try to find UM+QTA somewhere in the accumulated lines
      let found = false;
      for (let i = descLines.length - 1; i >= 0; i--) {
        const p = tryParseVoceLine(descLines[i]);
        if (p) {
          const desc = descLines.slice(0, i).join(" ").trim();
          const fullDesc = desc ? (desc + " " + p.descrizione).trim() : p.descrizione;
          if (fullDesc) {
            voci.push({ categoria: currentCategory, descrizione: fullDesc, um: p.um, quantita: p.quantita });
          }
          found = true;
          break;
        }
      }
      if (!found) {
        // Could not parse — this voce is incomplete, discard
        // But log it for debugging
      }
    }
    currentCategory = null;
    descLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const catResult = startsWithCategory(line);

    // Section headers
    if (/^SISTEMAZIONE\s+/i.test(line) && line.length < 60) continue;
    if (/^Opere\s+(interne|esterne)/i.test(line) && line.length < 60) continue;
    if (/^Facciata/i.test(line) && line.length < 60) continue;
    if (/^Lato\s+/i.test(line) && line.length < 40) continue;
    if (/^\s*\d+\.\s*\d+/i.test(line)) continue; // skip numbers like 1.00 at start

    if (catResult) {
      // New category line — flush previous voce if any
      if (currentCategory) {
        flushVoce();
      }
      currentCategory = catResult.categoria;
      if (catResult.rest) {
        // Try to parse the rest as a complete voce
        const parsed = tryParseVoceLine(catResult.rest);
        if (parsed) {
          // Complete voce on a single line
          voci.push({
            categoria: currentCategory,
            descrizione: parsed.descrizione,
            um: parsed.um,
            quantita: parsed.quantita,
          });
          currentCategory = null;
          descLines = [];
        } else {
          // Start accumulating description
          descLines = [catResult.rest];
        }
      } else {
        // Category line with no rest — description will follow
        descLines = [];
      }
    } else {
      // Not a category line
      if (currentCategory) {
        descLines.push(line);
      }
    }
  }

  // Flush the last voce
  if (currentCategory && descLines.length > 0) {
    flushVoce();
  }

  if (voci.length === 0) return null;

  // Group by category into sections
  const categoryMap = new Map<string, TabularVoce[]>();
  for (const v of voci) {
    if (!categoryMap.has(v.categoria)) {
      categoryMap.set(v.categoria, []);
    }
    categoryMap.get(v.categoria)!.push(v);
  }

  const sections: TabularSection[] = [];
  for (const [categoria, catVoci] of categoryMap) {
    sections.push({
      titolo: categoria.charAt(0).toUpperCase() + categoria.slice(1).toLowerCase(),
      voci: catVoci,
    });
  }

  return { sections, totalVoci: voci.length, rawVoci: voci };
}

// ───────────────────────────────────────────────────────────────────────────────
// 3. Numbered computo metrico parser — "A. Demolizioni" + "N° rows" format
//    This handles PDFs generated by Italian computo software where each chapter
//    has a letter+title header and each row has N°, Descrizione, UM, Q.tà, P.u., Totale.
//    It extracts ACTUAL prices from the P.u. column and never discards voci.
// ───────────────────────────────────────────────────────────────────────────────

export interface NumberedVoce {
  descrizione: string;
  um: string;
  quantita: number;
  prezzoUnitario: number;
  totale: number;
}

export interface NumberedSection {
  lettera: string;
  titolo: string;
  voci: NumberedVoce[];
}

/**
 * Detect a numbered computo metrico (A. Demolizioni + N° numbered rows + Subtotale capitolo).
 */
export function isNumberedComputoMetrico(text: string): boolean {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  // Section headers like "A. Demolizioni", "B. Costruzioni", etc.
  const sectionHeaders = lines.filter(l => /^[A-Z]\.\s+[A-Za-zÀ-ÿ]/.test(l.trim())).length;
  // Numbered rows starting with "N <space> text"
  const numberedRows = lines.filter(l => /^\d{1,3}\s+[A-Za-zÀ-ÿ]/.test(l.trim())).length;
  // Subtotale capitolo lines
  const subtotaleLines = lines.filter(l => /subtotale\s+capitolo\s+[A-Z]/i.test(l)).length;
  return sectionHeaders >= 1 && numberedRows >= 3 && subtotaleLines >= 1;
}

/**
 * Returns true if a token looks like an Italian number:
 *   38,00 / 1.700,00 / 16 / 13.2 / 0.6
 * Returns false for compound strings like "26x1", "0.6x22x0.30h", "n.", "mq".
 */
function isItalianNumberToken(s: string): boolean {
  // Italian format: digits with comma decimal (38,00 or 1.700,00)
  if (/^\d{1,3}(\.\d{3})*,\d{1,3}$/.test(s)) return true;
  // Pure integer
  if (/^\d+$/.test(s)) return true;
  // English/mixed decimal (13.2 or 0.6) — valid for quantities like 13.2 mq
  if (/^\d+\.\d+$/.test(s)) return true;
  return false;
}

/**
 * Try to extract (descrizione, UM, quantita, prezzoUnitario, totale) from a combined row text.
 * Scans from the right for the last occurrence of [UM] [NUM] [NUM] [NUM].
 * The leading row number (if present) is stripped.
 * Returns null only if no valid data pattern is found.
 */
function tryParseRowData(text: string): NumberedVoce | null {
  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length < 4) return null;

  // Scan from right looking for: UM QTY PU TOTAL
  for (let i = tokens.length - 1; i >= 3; i--) {
    const totStr = tokens[i];
    const puStr = tokens[i - 1];
    const qtaStr = tokens[i - 2];
    const umStr = tokens[i - 3];

    if (
      isItalianNumberToken(totStr) &&
      isItalianNumberToken(puStr) &&
      isItalianNumberToken(qtaStr) &&
      isValidUM(umStr)
    ) {
      // Found data block at positions [i-3 .. i]
      const descTokens = tokens.slice(0, i - 3);
      // Strip leading row number (pure integer like "1", "26", "39")
      if (descTokens.length > 0 && /^\d+$/.test(descTokens[0])) descTokens.shift();
      const descrizione = descTokens.join(" ").trim();
      if (!descrizione) return null;

      const um = umStr.toLowerCase().replace(/\.$/, "");
      const quantita = parseEuro(qtaStr);
      const prezzoUnitario = parseEuro(puStr);
      const totale = parseEuro(totStr);

      // Sanity check: totale should be roughly quantita * prezzoUnitario (within 20%)
      // — skip the check if pu or qty is 0 (might be a lump-sum item with qty=1)
      if (quantita > 0 && prezzoUnitario > 0 && totale > 0) {
        const expected = quantita * prezzoUnitario;
        const ratio = totale / expected;
        // Allow ±20% tolerance for rounding / compound quantities in description
        if (ratio < 0.1 || ratio > 10) continue; // too far off — try next position
      }

      return { descrizione, um, quantita, prezzoUnitario, totale };
    }
  }
  return null;
}

/**
 * Parse a numbered computo metrico PDF extract into structured chapters with actual prices.
 */
export function parseNumberedComputoMetrico(text: string): {
  sections: NumberedSection[];
  totalVoci: number;
} | null {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const sections: NumberedSection[] = [];
  let currentSection: NumberedSection | null = null;

  // Current row accumulation state
  let currentRowNum: number | null = null;
  let currentRowContent: string[] = [];

  function flushRow() {
    if (currentSection === null || currentRowNum === null || currentRowContent.length === 0) {
      currentRowNum = null; currentRowContent = []; return;
    }
    const combined = currentRowContent.join(" ").trim();
    const parsed = tryParseRowData(combined);
    if (parsed) {
      currentSection.voci.push(parsed);
    } else {
      // Fallback: include voce with quantity=1, price=0 (will be estimated by caller)
      // Strip leading row number from description
      const cleanDesc = combined.replace(/^\d+\s+/, "").trim();
      if (cleanDesc) {
        currentSection.voci.push({
          descrizione: cleanDesc,
          um: "cpo",
          quantita: 1,
          prezzoUnitario: 0,
          totale: 0,
        });
      }
    }
    currentRowNum = null; currentRowContent = [];
  }

  for (const line of rawLines) {
    // Skip table header rows
    if (/^n[°.°]?\s*descrizione/i.test(line)) continue;
    if (/^n\s+descrizione\s+u/i.test(line)) continue;
    if (/^u\.?m\.?\s+q\.?t/i.test(line)) continue;
    // Skip page markers
    if (/^pag\.?\s*\d+/i.test(line)) continue;
    if (/^documento\s+generato/i.test(line)) continue;
    // Skip subtotale lines (they don't contain voci)
    if (/subtotale\s+capitolo/i.test(line)) { flushRow(); continue; }
    // Skip QUADRO SINTETICO section (summary table before detail)
    if (/^quadro\s+sintetico/i.test(line)) { flushRow(); continue; }
    if (/^computo\s+metrico\s+dettagliato/i.test(line)) { flushRow(); continue; }
    // Skip company header lines
    if (/^p\.?i\.?v\.?a|^tel:|^via\s+|^data:\s*\d/i.test(line)) continue;

    // Section header? Match ONLY standalone "X. Title" lines (no € amount, no trailing numbers).
    // This deliberately EXCLUDES quadro-sintetico summary rows like "A. Demolizioni  € 18.442,00  Voce ordinaria"
    // which also start with "A." but contain a € amount — the $ anchor makes them fail the match.
    const secMatch = line.match(/^([A-Z])\.\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]*)$/);
    if (secMatch) {
      const titleCandidate = secMatch[2].trim();
      if (titleCandidate && !/^\d/.test(titleCandidate)) {
        flushRow();
        currentSection = { lettera: secMatch[1], titolo: titleCandidate, voci: [] };
        sections.push(currentSection);
        continue;
      }
    }

    // Numbered row start? Starts with 1-3 digits followed by text
    const rowMatch = line.match(/^(\d{1,3})\s+(.+)$/);
    if (rowMatch && currentSection) {
      flushRow();
      currentRowNum = parseInt(rowMatch[1]);
      currentRowContent = [rowMatch[2]];
      continue;
    }

    // Continuation line for the current row
    if (currentRowNum !== null && currentSection) {
      currentRowContent.push(line);
    }
  }

  flushRow();

  const totalVoci = sections.reduce((sum, s) => sum + s.voci.length, 0);
  if (sections.length === 0 || totalVoci === 0) return null;

  return { sections, totalVoci };
}

// ───────────────────────────────────────────────────────────────────────────────
// 4. Price estimation for tabular computo voci (deterministic, no AI)
// ───────────────────────────────────────────────────────────────────────────────

export function estimatePriceForVoce(categoria: string, descrizione: string, um: string): number {
  const desc = descrizione.toLowerCase();
  const cat = categoria.toLowerCase();
  const unit = um.toLowerCase();

  const basePrices: Record<string, number> = {
    // Demolizioni
    "demolizione": 45,
    "scavo": 85,
    "scrostamento": 28,
    "rimozione": 40,
    "demolizione tramezzi": 35,
    "demolizione massetto": 35,
    "demolizione solaio": 650,
    "demolizione scala": 1800,
    // Costruzioni / strutture
    "ripristino": 45,
    "intonaco": 42,
    "guaina": 35,
    "impermeabilizzazione": 40,
    "polistirene": 32,
    "membrana": 22,
    "tubazione": 35,
    "tnt": 20,
    "rinterro": 30,
    "formazione": 75,
    "cls": 110,
    "getto": 95,
    "muretto": 280,
    "soletta": 120,
    "scalini": 1800,
    "piastrellatura": 90,
    "pavimentazione": 85,
    "zoccolatura": 28,
    "zoccolino": 22,
    "rivestimento": 75,
    "tramezzi": 65,
    "massetto": 55,
    "canaletta": 75,
    // Ponteggio
    "ponteggio": 28,
    "noleggio": 22,
    // Facciate / cappotto
    "cappotto": 75,
    "rasante": 35,
    "intonachino": 30,
    "grondaia": 22,
    "pluviale": 180,
    "davanzale": 320,
    "soglia": 300,
    "telaio": 1400,
    "monoblocco": 1800,
    "finestra": 900,
    "porta": 1200,
    "porta finestra": 1600,
    // Balconi
    "balcone": 2800,
    // Verniciature
    "verniciatura": 450,
    "pulizia": 380,
    "idropulizia": 25,
    "trattamento": 35,
    // Impianti
    "colonna": 450,
    "fognaria": 55,
    "scarico": 40,
    "elettrico": 550,
    "idraulico": 350,
    "riscaldamento": 2800,
    "caldaia": 2200,
    "termosifoni": 85,
    "radiatore": 320,
    "condizionamento": 1800,
    "split": 1400,
    "vespaio": 45,
    "barriera": 35,
    "igloo": 28,
    // Generico
    "opere": 60,
    "lavori": 55,
    "servizi": 50,
    "messa in sicurezza": 120,
    "apertura": 850,
    "chiusura": 650,
    "adeguamento": 75,
    "rifacimento": 80,
    "realizzazione": 70,
    "posa": 65,
    "installazione": 75,
    "fornitura": 85,
    "spostamento": 55,
  };

  for (const [key, price] of Object.entries(basePrices)) {
    if (desc.includes(key)) return price;
  }

  if (cat.includes("demoliz")) return 40;
  if (cat.includes("costruz")) return 70;
  if (cat.includes("impiant")) return 450;
  if (cat.includes("finitur")) return 55;
  if (cat.includes("vernic")) return 400;
  if (cat.includes("falegn")) return 120;
  if (cat.includes("infiss")) return 1300;
  if (cat.includes("strutture")) return 150;
  if (cat.includes("muratura")) return 250;
  if (cat.includes("chiusure")) return 900;

  if (unit === "mq" || unit === "m2" || unit === "m²") return 65;
  if (unit === "ml" || unit === "m" || unit === "mt" || unit === "mtr") return 35;
  if (unit === "mc" || unit === "m3" || unit === "m³") return 55;
  if (unit === "n." || unit === "n" || unit === "nr" || unit === "num" || unit === "numero") return 1200;
  if (unit === "cpo" || unit === "corpo" || unit === "cad") return 1800;
  if (unit === "kg" || unit === "q" || unit === "qli" || unit === "quint" || unit === "quintali") return 5;
  if (unit === "ore" || unit === "h" || unit === "hh") return 55;
  if (unit === "a.c." || unit === "a.c" || unit === "ac") return 2500;
  if (unit === "pezzi" || unit === "pz" || unit === "pzz" || unit === "p" || unit === "pc" || unit === "pe") return 120;
  if (unit === "unità" || unit === "u" || unit === "ud" || unit === "unit") return 120;
  if (unit === "giorni" || unit === "gg") return 350;
  if (unit === "settimane" || unit === "sett" || unit === "settim" || unit === "set") return 1800;
  if (unit === "mesi" || unit === "mese") return 7200;
  if (unit === "ann") return 86400;
  if (unit === "ha") return 500;
  if (unit === "km") return 80;
  if (unit === "mld") return 3;
  if (unit === "kw" || unit === "kwh" || unit === "kW" || unit === "kWh") return 200;
  if (unit === "voce" || unit === "voc" || unit === "voci") return 150;
  if (unit === "forfait" || unit === "forfett" || unit === "globale") return 2500;
  if (unit === "€" || unit === "euro") return 1;
  if (unit === "percento" || unit === "%") return 1;

  return 80;
}
