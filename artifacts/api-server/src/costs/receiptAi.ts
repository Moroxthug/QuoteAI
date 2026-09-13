import { COST_CATEGORIES, getTaxProfile, normalizeProvince, type CostCategory, type ReceiptExtraction, type TaxBreakdown } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";
import { logger } from "../lib/logger.js";

const _require = createRequire(import.meta.url);

// ── Receipt / supplier-invoice reading ───────────────────────────────────────
// A photo or PDF of a receipt goes to the model once; the answer is
// normalised here (pure, testable) into a proposed cost entry the company
// confirms on the Costs tab. Nothing is ever confirmed automatically.

export type JobCandidate = { id: string; name: string; address: string; clientName: string | null };

export const RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

function systemPrompt(candidates: JobCandidate[], province: string | null): string {
  const jobs = candidates.length
    ? candidates.map((j) => `- id "${j.id}": ${j.name}${j.address ? ` (${j.address})` : ""}${j.clientName ? ` — client ${j.clientName}` : ""}`).join("\n")
    : "- (none)";
  return `You read receipts and supplier invoices for a small Canadian construction company${province ? ` based in ${province}` : ""}.
Extract the purchase into JSON. Amounts are in dollars (decimals), never cents. Canadian sales taxes: GST 5%, HST 13–15%, PST/RST 6–7%, QST 9.975%. A receipt shows either HST alone, or GST plus a provincial tax; never invent a tax that is not printed.

Cost categories: ${COST_CATEGORIES.join(" | ")}.
- materials: lumber, drywall, tile, paint, fasteners, plumbing/electrical supplies, hardware stores (Home Depot, RONA, Lowe's, Canac, BMR…)
- labour: wages, staffing agencies
- subcontractor: another trade's invoice (electrician, plumber, roofer…)
- permits_fees: municipal permits, inspections, disposal/dump fees, insurance certificates
- equipment: tool purchases, rentals (scaffolding, lifts, compactors), fuel
- misc: anything else (meals, parking, small consumables)

Open jobs (pick the one the purchase most likely belongs to; use the delivery/ship-to address, PO number or job name printed on the receipt; null if unsure):
${jobs}

Return ONLY this JSON object:
{
  "vendor": "store or supplier name or null",
  "date": "YYYY-MM-DD or null",
  "currency": "CAD",
  "lines": [{ "description": "...", "quantity": 1, "unitPrice": 0.0, "total": 0.0 }],
  "subtotal": 0.0,
  "taxes": { "GST": 0.0, "HST": null, "PST": null, "QST": null },
  "total": 0.0,
  "suggestedCategory": "materials",
  "suggestedProjectId": "uuid or null",
  "confidence": "high | medium | low",
  "note": "one short sentence on anything odd (illegible total, credit/return, deposit, foreign currency) or null"
}
Keep at most 25 lines. If the document is not a receipt or invoice, return {"vendor":null,"date":null,"currency":null,"lines":[],"subtotal":null,"taxes":{},"total":null,"suggestedCategory":null,"suggestedProjectId":null,"confidence":"low","note":"Not a receipt"}.`;
}

async function pdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = _require("pdf-parse") as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }>; destroy(): Promise<void> } };
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    return result.text.slice(0, 12000);
  } catch (err) {
    logger.warn({ err }, "pdf-parse failed on receipt");
    return "";
  }
}

/** Calls the model. Images use gpt-4o vision; PDFs are parsed to text and sent to gpt-4o-mini. */
export async function readReceipt(params: { buffer: Buffer; mimeType: string; candidates: JobCandidate[]; province: string | null }): Promise<{ raw: unknown; model: string }> {
  const system = systemPrompt(params.candidates, params.province);
  if (params.mimeType === "application/pdf") {
    const text = await pdfText(params.buffer);
    if (!text.trim()) return { raw: { note: "No extractable text in the PDF", confidence: "low" }, model: "none" };
    const model = "gpt-4o-mini";
    const completion = await openai.chat.completions.create(
      { model, temperature: 0, max_completion_tokens: 1500, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: `Text of the document:\n\n${text}` }] },
      { timeout: 30_000 },
    );
    return { raw: safeJson(completion.choices[0]?.message?.content), model };
  }
  const model = "gpt-4o";
  const dataUrl = `data:${params.mimeType};base64,${params.buffer.toString("base64")}`;
  const completion = await openai.chat.completions.create(
    {
      model,
      temperature: 0,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: [{ type: "image_url", image_url: { url: dataUrl, detail: "high" } }, { type: "text", text: "Read this receipt." }] },
      ],
    },
    { timeout: 40_000 },
  );
  return { raw: safeJson(completion.choices[0]?.message?.content), model };
}

function safeJson(content: string | null | undefined): unknown {
  if (!content) return {};
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const cents = (dollars: number | null): number => (dollars === null ? 0 : Math.round(dollars * 100));

/**
 * Turns the model's answer into a normalised extraction + the cents to store.
 * Pure: no DB, no network. Fills gaps sensibly (total = subtotal + taxes,
 * or subtotal = total − taxes, or taxes from the province rate when the
 * receipt shows only a total) and clamps the suggestions to known values.
 */
export function normalizeReceipt(raw: unknown, opts: { model: string; candidateIds: string[]; province: string | null }): { extraction: ReceiptExtraction; subtotalCents: number; taxCents: number; totalCents: number; taxBreakdown: TaxBreakdown; date: Date | null } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const taxesRaw = (r.taxes && typeof r.taxes === "object" ? r.taxes : {}) as Record<string, unknown>;
  const taxes: ReceiptExtraction["taxes"] = {};
  for (const k of ["GST", "HST", "PST", "QST"] as const) {
    const v = num(taxesRaw[k]);
    if (v !== null && v > 0) taxes[k] = v;
  }
  // RST (Manitoba) is printed as PST on most receipts; accept both spellings.
  const rst = num(taxesRaw.RST);
  if (rst !== null && rst > 0 && !taxes.PST) taxes.PST = rst;

  let subtotal = num(r.subtotal);
  let total = num(r.total);
  let taxSum: number = (Object.values(taxes) as (number | null | undefined)[]).reduce<number>((s, v) => s + (v ?? 0), 0);

  if (total !== null && subtotal !== null && taxSum === 0 && total > subtotal) {
    // Receipt printed a tax the model did not itemise: attribute it to the province's components.
    taxSum = Math.round((total - subtotal) * 100) / 100;
    const code = normalizeProvince(opts.province);
    if (code) {
      const profile = getTaxProfile(code);
      for (const c of profile.components) {
        const key = c.code === "RST" ? "PST" : c.code;
        taxes[key] = Math.round(((taxSum * c.rate) / profile.totalRate) * 100) / 100;
      }
    } else {
      taxes.GST = taxSum;
    }
  } else if (total === null && subtotal !== null) {
    total = Math.round((subtotal + taxSum) * 100) / 100;
  } else if (subtotal === null && total !== null) {
    subtotal = Math.round((total - taxSum) * 100) / 100;
  }

  const linesRaw = Array.isArray(r.lines) ? r.lines : [];
  const lines = linesRaw
    .slice(0, 25)
    .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>) : {}))
    .map((l) => ({ description: str(l.description) ?? "", quantity: num(l.quantity), unitPrice: num(l.unitPrice), total: num(l.total) }))
    .filter((l) => l.description);

  const categoryRaw = str(r.suggestedCategory);
  const suggestedCategory = (COST_CATEGORIES as readonly string[]).includes(categoryRaw ?? "") ? (categoryRaw as CostCategory) : null;
  const projectRaw = str(r.suggestedProjectId);
  const suggestedProjectId = projectRaw && opts.candidateIds.includes(projectRaw) ? projectRaw : null;
  const confidenceRaw = str(r.confidence);
  const confidence: ReceiptExtraction["confidence"] = confidenceRaw === "high" || confidenceRaw === "medium" ? confidenceRaw : "low";
  const dateStr = str(r.date);
  const date = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(Date.parse(dateStr)) ? new Date(`${dateStr}T12:00:00Z`) : null;

  const taxBreakdown: TaxBreakdown = {};
  for (const k of ["GST", "HST", "PST", "QST"] as const) if (taxes[k]) taxBreakdown[k] = cents(taxes[k]!);
  const taxCents = Object.values(taxBreakdown).reduce((s, v) => s + (v ?? 0), 0);
  const subtotalCents = cents(subtotal);
  const totalCents = total !== null ? cents(total) : subtotalCents + taxCents;

  return {
    extraction: { vendor: str(r.vendor), date: date ? dateStr : null, currency: str(r.currency) ?? "CAD", lines, subtotal, taxes, total, suggestedCategory, suggestedProjectId, confidence, note: str(r.note), model: opts.model },
    subtotalCents,
    taxCents,
    totalCents,
    taxBreakdown,
    date,
  };
}

/** One-line description for the cost entry built from a receipt. */
export function receiptDescription(x: ReceiptExtraction): string {
  if (x.lines.length === 1) return x.lines[0]!.description.slice(0, 200);
  if (x.lines.length > 1) return `${x.lines[0]!.description.slice(0, 120)} +${x.lines.length - 1}`;
  return x.vendor ? `Receipt — ${x.vendor}` : "Receipt";
}
