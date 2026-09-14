import type { ImportedQuoteExtraction } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";
import { logger } from "../lib/logger.js";
import { recordAiUsage } from "../lib/usage.js";

const _require = createRequire(import.meta.url);

// ── Phase 14: AI-assisted PDF quote import ───────────────────────────────────
// Mirrors costs/receiptAi.ts — a PDF of an old quote is parsed to text and
// read by a text model into the same structured shape as the CSV importer,
// so both paths land in the same review queue. Nothing is ever written
// straight to `quotes`; a human confirms every candidate.

const SYSTEM_PROMPT = `You read old quotes/estimates for a small Canadian construction company, to help them import their historical records.
Extract the quote into JSON. Amounts are in dollars (decimals), never cents.

Return ONLY this JSON object:
{
  "clientName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "address": "string or null",
  "city": "string or null",
  "province": "2-letter Canadian province code (ON, QC, BC...) or null",
  "postalCode": "string or null",
  "date": "YYYY-MM-DD or null",
  "status": "accepted if the document shows it was signed/accepted/won, otherwise draft",
  "items": [{ "description": "...", "quantity": 1, "unitPrice": 0.0, "total": 0.0 }],
  "total": 0.0,
  "notes": "one short sentence on anything odd, or null",
  "confidence": "high | medium | low"
}
Keep at most 30 line items. If the document is not a quote/estimate, return {"clientName":null,"email":null,"phone":null,"address":null,"city":null,"province":null,"postalCode":null,"date":null,"status":"draft","items":[],"total":null,"notes":"Not a quote","confidence":"low"}.`;

async function pdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = _require("pdf-parse") as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }>; destroy(): Promise<void> } };
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    return result.text.slice(0, 12000);
  } catch (err) {
    logger.warn({ err }, "pdf-parse failed on quote import");
    return "";
  }
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

/** Reads a PDF of an old quote/estimate. Returns null when the PDF has no extractable text. */
export async function readImportedQuotePdf(params: { buffer: Buffer; userId: string }): Promise<ImportedQuoteExtraction | null> {
  const text = await pdfText(params.buffer);
  if (!text.trim()) return null;

  const model = "gpt-4o-mini";
  let raw: unknown;
  try {
    const completion = await openai.chat.completions.create(
      { model, temperature: 0, max_completion_tokens: 1800, response_format: { type: "json_object" }, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `Text of the document:\n\n${text}` }] },
      { timeout: 30_000 },
    );
    recordAiUsage({ userId: params.userId, model, kind: "ai_text", usage: completion.usage, relatedEntityType: "quote_import" });
    raw = safeJson(completion.choices[0]?.message?.content);
  } catch (err) {
    logger.warn({ err }, "Quote-import AI read failed");
    raw = {};
  }

  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const linesRaw = Array.isArray(r.items) ? r.items : [];
  const items = linesRaw
    .slice(0, 30)
    .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>) : {}))
    .map((l) => ({ description: str(l.description) ?? "", quantity: num(l.quantity), unitPrice: num(l.unitPrice), total: num(l.total) }))
    .filter((l) => l.description);

  const statusRaw = str(r.status);
  const confidenceRaw = str(r.confidence);

  return {
    clientName: str(r.clientName),
    email: str(r.email),
    phone: str(r.phone),
    address: str(r.address),
    city: str(r.city),
    province: str(r.province),
    postalCode: str(r.postalCode),
    date: str(r.date),
    status: statusRaw === "accepted" ? "accepted" : "draft",
    items,
    total: num(r.total),
    notes: str(r.notes),
    confidence: confidenceRaw === "high" || confidenceRaw === "medium" ? confidenceRaw : "low",
  };
}
