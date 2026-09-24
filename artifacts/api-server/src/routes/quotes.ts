import { Router } from "express";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission.js";
import multer from "multer";
import { db, quotesTable, quoteAttachmentsTable, quoteVariantsTable, businessProfilesTable, priceCatalogItemsTable, priceIntelligenceTable, uploadedDocumentsTable, quoteClientDataSchema, quoteCompanySnapshotSchema, paymentScheduleSchema, derivePaymentScheduleFromText, validatePaymentSchedule, paymentScheduleToText, normalizeProvince, getTaxProfile, quoteTaxLines } from "@workspace/db";
import { getBaseUrl } from "../lib/baseUrl.js";
import { resolveQuoteTaxRate } from "../lib/tax.js";
import { quoteLanguageFor, qt, fmtQuoteDate, fmtQty } from "../quotes/i18n.js";
import { generateQuotePdfBuffer, generateCapitolatoPdfBuffer } from "../quotes/pdf.js";
import { eq, desc, count, sum, sql, and, avg, isNull, inArray } from "drizzle-orm";
import { catalogOwnerIds } from "../groups/service.js";
import { getTrialStatus, PLANS } from "./payments.js";
import {
  UpdateQuoteBody,
  GetQuoteParams,
  UpdateQuoteParams,
  DeleteQuoteParams,
  GenerateQuotePdfParams,
  RegenerateQuoteBody,
  CreateQuoteVariantBody,
  UpdateQuoteVariantBody,
  SendQuotePdfEmailBody,
  SuggestItemDescriptionBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { REGIONAL_PRICING_GUIDANCE, DESCRIPTION_QUALITY_GUIDANCE } from "../lib/generateQuoteFromText.js";
import type { QuoteChapter, QuoteDiscount, QuoteCompanySnapshot, QuoteClientData, QuoteItem } from "@workspace/db";
import {
  parseComputoMetrico, isComputoMetrico,
  isTabularComputoMetrico, parseTabularComputoMetrico,
  isNumberedComputoMetrico, parseNumberedComputoMetrico,
} from "../lib/computeParser.js";
import { userRateLimiter } from "../lib/rateLimit.js";

// Shared across every AI-calling authenticated endpoint below (create,
// regenerate, upgrade-to-capitolato, suggest-item-description) so the cap is
// on total AI spend per user, not per endpoint — a runaway/compromised
// account can't just spread calls across routes to dodge the limit.
const aiCallLimiter = userRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: "You've reached the hourly limit for AI generations. Please try again later.",
});

import { ObjectStorageService } from "../lib/objectStorage.js";
import { generateNumeroPreventivo } from "../lib/quoteNumber.js";
import { sendQuotePdfEmail } from "../lib/email.js";
import { quoteFollowupDays, stageDueAt } from "../lib/followupCadence.js";
import { linkQuoteToClient, ensureClientForQuote } from "../lib/clients.js";
import { createManualQuote, ManualQuoteBodySchema, manualQuoteBodyError } from "../quotes/manualCreate.js";
import { loadPriceReferences, priceCheckChapters, repriceChapters } from "../quotes/priceCheck.js";
import { writeAudit } from "../lib/notifications.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { extractFromPdf, extractFromDocx, extractFromXlsx } from "../lib/extractDocument.js";
import { currentActorId } from "../lib/requestContext.js";

const objectStorage = new ObjectStorageService();

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_DOC_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const allAllowedMimes = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_DOC_MIMES];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (allAllowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Use JPG, PNG, WEBP, HEIC, PDF, DOCX or XLSX.`));
    }
  },
});

const router = Router();

/**
 * A draft quote of a non-subscriber is unlocked by the trial — once — the
 * first time it leaves the account (PDF download or email send). Each unlock
 * consumes one trial download. Returns false when the trial is over, so the
 * caller can answer 402. (Phase 66: email send used to require the quote to
 * be unlocked already, so trial users could not send before downloading.)
 */
async function tryTrialUnlock(
  quote: typeof quotesTable.$inferSelect,
  profile: typeof businessProfilesTable.$inferSelect | null,
  log: { info: (obj: object, msg: string) => void }
): Promise<boolean> {
  const trial = getTrialStatus(profile);
  if (!trial.isTrialActive) return false;
  await Promise.all([
    db.update(quotesTable).set({ status: "unlocked", unlockedWithPlan: "trial" }).where(eq(quotesTable.id, quote.id)),
    db
      .update(businessProfilesTable)
      .set({ trialDownloadsUsed: (profile?.trialDownloadsUsed ?? 0) + 1 })
      .where(eq(businessProfilesTable.userId, quote.userId)),
  ]);
  log.info({ quoteId: quote.id, userId: quote.userId }, "Quote auto-unlocked via trial");
  return true;
}

const AI_PROMPT = `You are an expert consultant for professional quotes/estimates in the Canadian market (tradespeople, construction, building systems, technical services).

You must turn a free-text description into a professional ITEMIZED COST ANALYSIS AND ESTIMATE, structured into chapters/sections, consistent with the owner's price catalog and with realistic 2026 Canadian market rates. Write ALL text content (descriptions, titles, notes) in English.

CORE RULES:
1. Reference and catalog pricing (PRICE LIST):
   - If a "USER'S CUSTOM PRICE LIST" is provided, you MUST prioritize the unit prices defined there for all matching or related work items.
   - Do not invent new unit prices if the line item matches something already in the custom price list.
   - If a work item isn't in the custom price list, use realistic 2026 Canadian market rates (in CAD):
     * painter: $4–10/sqft for painting, $12–20/sqft for specialty work
     * electrician: $60–100/hour labour
     * plumber: $65–110/hour labour
     * general construction: rates consistent with regional Canadian market pricing
     * general labourer/mason: $45–70/hour
     * carpenter/finish carpentry: $55–85/hour
2. If specific data is missing: make realistic assumptions, do NOT ask clarifying questions. If "PROPERTY MEASUREMENTS AND DIMENSIONS" are provided, use them rigorously and mathematically to calculate quantities (sqft, linear ft, etc.).
3. Organize the work into logical CHAPTERS/SECTIONS (A, B, C, D, …) with professional titles (e.g. "Site Setup", "Demolition", "New Construction Work", "Electrical System", etc.)
4. Each chapter contains detailed line ITEMS with professional units of measure (sqft, linear ft, cubic ft, kg, hours, lump sum, each, kW, etc.)
5. Calculate a subtotal for each chapter. The SUMMARY is derived automatically from the chapters array (letter + title + subtotal + note); no separate field is needed.
6. Apply a discount ONLY if the user explicitly requests one in their description; otherwise always set percentage: 0
7. Payment terms must follow Canadian norms, NOT a large upfront deposit: a small deposit of 10-15% on signing, one or two progress payments tied to milestones (e.g. on material delivery/start of work, and on substantial completion) making up the bulk of the total, and a final holdback of 10-15% released only after the client has inspected and approved the completed work. Never default to a deposit larger than 15%.
8. Do not assume a fixed sales-tax rate — Canadian GST/HST varies by province (roughly 5–15%); leave the tax percentage at 0 unless the user specifies a rate or province
9. The second title line must describe the project and job-site location
10. numero_preventivo_data: DO NOT GENERATE — the server assigns the quote number automatically. Return an empty string.
11. CRITICAL RULE — ZERO OMISSIONS: if the user provides a detailed description with many NUMBERED or BULLETED items, every single item must become its own distinct line in the quote. Do NOT summarize, do NOT merge multiple items into one, do NOT skip or omit items. Create MULTIPLE CHAPTERS if needed to fit everything. Every item the user lists must have its own description, unit of measure, quantity, unit price, and total.
12. IF the user attaches a document with a bill of quantities or item list: transform the document 1:1. Every line of the document becomes one item. Do NOT invent new items, do NOT merge similar items. Keep the quantities and unit prices from the document.
13. descrizione_generale must be a real 2-4 sentence plain-English summary of the project scope (what is being done, where, and the general approach) — never a placeholder or a one-line restatement of the title.
14. note must be a short client-facing closing paragraph that always covers: the quote's validity period (e.g. 30 days), a one-line statement of what is NOT included (permits, unforeseen conditions behind walls/floors, work not explicitly listed above, etc.), and a brief workmanship-warranty statement (e.g. "Workmanship is guaranteed for 1 year from completion; manufacturer warranties apply to materials and fixtures.").

OUTPUT — VALID JSON ONLY, no extra text:
{
  "titolo_riga1": "Project Quote & Itemized Estimate",
  "titolo_riga2": "[Brief description] project – [City] ([Province])",
  "numero_preventivo_data": "",
  "cliente": { "nome": "", "indirizzo": "" },
  "descrizione_generale": "2-4 sentence plain-English summary of the project scope, approach, and location.",
  "capitoli": [
    {
      "lettera": "A",
      "titolo": "Site Setup",
      "osservazione": "Standard item",
      "voci": [
        {
          "descrizione": "Complete site setup",
          "um": "lump sum",
          "quantita": 1,
          "prezzo_unitario": 2500.00,
          "totale": 2500.00
        }
      ],
      "subtotale": 2500.00
    }
  ],
  "sconto": { "percentuale": 0, "importo_scontato": 0 },
  "condizioni_pagamento": [
    "15% deposit on contract signing",
    "35% on delivery of materials and start of work",
    "35% on substantial completion",
    "15% final balance on completion and client walkthrough"
  ],
  "subtotale": 0,
  "iva_percentuale": 0,
  "iva_valore": 0,
  "totale": 0,
  "note": "Quote valid for 30 days from the date of issue. Excludes permits, unforeseen conditions behind existing walls/floors, and any work not explicitly listed above. Workmanship is guaranteed for 1 year from completion; manufacturer warranties apply to materials and fixtures."
}

CALCULATIONS:
- subtotale = sum of all chapter subtotals
- If sconto > 0: imponibile_scontato = subtotale * (1 - percentuale/100); iva_valore = imponibile_scontato * iva_percentuale/100; totale = imponibile_scontato + iva_valore
- If sconto = 0: iva_valore = subtotale * iva_percentuale/100; totale = subtotale + iva_valore
- sconto.importo_scontato = subtotale after applying the discount (before tax)

VERY IMPORTANT: output PURE JSON ONLY, no explanation, no markdown.`;

type QuoteRow = typeof quotesTable.$inferSelect;

type AttachmentRow = typeof quoteAttachmentsTable.$inferSelect;

type VariantRow = typeof quoteVariantsTable.$inferSelect;

export function serializeQuoteVariant(v: VariantRow, province: string | null = null) {
  return {
    id: v.id,
    quoteId: v.quoteId,
    label: v.label,
    description: v.description,
    position: v.position,
    items: Array.isArray(v.items) ? v.items : [],
    capitoli: Array.isArray(v.capitoli) ? v.capitoli : [],
    sconto: (v.sconto as QuoteDiscount | null) ?? null,
    condizioniPagamento: Array.isArray(v.condizioniPagamento) ? v.condizioniPagamento : [],
    subtotale: Number(v.subtotale),
    ivaPercentuale: Number(v.ivaPercentuale),
    ivaValore: Number(v.ivaValore),
    /** Phase 71: statutory components (GST/QST…) or one generic "Tax" line; sums to ivaValore. */
    taxLines: quoteTaxLines(v.sconto && typeof (v.sconto as QuoteDiscount).importoScontato === "number" ? (v.sconto as QuoteDiscount).importoScontato : Number(v.subtotale), Number(v.ivaPercentuale), Number(v.ivaValore), province),
    totale: Number(v.totale),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export function serializeQuote(q: QuoteRow, attachments?: AttachmentRow[], variants?: VariantRow[]) {
  const tot = Number(q.totale);
  const province = normalizeProvince(q.province) ?? normalizeProvince((q.clientData as QuoteClientData | null)?.province) ?? null;
  const paymentSchedule = q.paymentSchedule ?? derivePaymentScheduleFromText(q.condizioniPagamento, tot);
  return {
    id: q.id,
    userId: q.userId,
    clientId: q.clientId ?? null,
    province,
    taxProfile: province ? getTaxProfile(province) : null,
    paymentSchedule,
    clientData: q.clientData,
    descrizioneGenerale: q.descrizioneGenerale,
    items: Array.isArray(q.items) ? q.items : [],
    capitoli: Array.isArray(q.capitoli) ? q.capitoli : [],
    sconto: (q.sconto as QuoteDiscount | null) ?? null,
    condizioniPagamento: Array.isArray(q.condizioniPagamento) ? q.condizioniPagamento : [],
    titoloPreventivoRiga1: q.titoloPreventivoRiga1 ?? null,
    titoloPreventivoRiga2: q.titoloPreventivoRiga2 ?? null,
    numeroPreventivoData: q.numeroPreventivoData ?? null,
    companySnapshot: (q.companySnapshot as QuoteCompanySnapshot | null) ?? null,
    subtotale: Number(q.subtotale),
    ivaPercentuale: Number(q.ivaPercentuale),
    ivaValore: Number(q.ivaValore),
    /** Phase 71: statutory components (GST/QST…) or one generic "Tax" line; sums to ivaValore. */
    taxLines: quoteTaxLines((q.sconto as QuoteDiscount | null)?.importoScontato ?? Number(q.subtotale), Number(q.ivaPercentuale), Number(q.ivaValore), province),
    /** Language the customer-facing documents are produced in (client preference, else French in Québec). Phase 71. */
    documentLanguage: province === "QC" ? "fr" : "en",
    totale: tot,
    prezzoMinimo: Math.round(tot * 0.9 * 100) / 100,
    prezzoMassimo: Math.round(tot * 1.25 * 100) / 100,
    note: q.note,
    status: q.status,
    acceptedByName: q.acceptedByName ?? null,
    acceptedAt: q.acceptedAt?.toISOString() ?? null,
    pdfUrl: q.pdfUrl ?? null,
    rawInput: q.rawInput,
    pdfDownloadedAt: q.pdfDownloadedAt?.toISOString() ?? null,
    capitolatoPro: q.capitolatoPro ?? false,
    capitolatoPdfUrl: q.capitolatoPdfUrl ?? null,
    templateId: q.templateId ?? "standard",
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    archivedAt: q.archivedAt?.toISOString() ?? null,
    acceptedVariantId: q.acceptedVariantId ?? null,
    variants: variants?.map((v) => serializeQuoteVariant(v, province)) ?? [],
    attachments: attachments?.map(a => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileUrl: a.fileUrl,
      fileSize: a.fileSize ? Number(a.fileSize) : null,
      createdAt: a.createdAt.toISOString(),
    })) ?? [],
  };
}

// GET /api/quotes/stats
router.get("/quotes/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const [recentQuotes, statsResult, allForStats] = await Promise.all([
      db
        .select()
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId))
        .orderBy(desc(quotesTable.createdAt))
        .limit(5),
      db
        .select({
          total: count(),
          totalRevenue: sum(quotesTable.totale),
        })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId)),
      db
        .select({ status: quotesTable.status, totale: quotesTable.totale, createdAt: quotesTable.createdAt })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId)),
    ]);

    // "unlocked" on the dashboard means "sent to the client" — an accepted
    // quote is still unlocked (Phase 66: accepted quotes vanished from the
    // unlocked count and revenue the moment the client said yes).
    const allStatusCounts = { draft: 0, unlocked: 0, pending_payment: 0, accepted: 0 };
    let thisMonth = 0;
    let unlockedRevenue = 0;
    for (const q of allForStats) {
      if (q.status in allStatusCounts) {
        allStatusCounts[q.status as keyof typeof allStatusCounts]++;
      }
      if (q.createdAt >= thisMonthStart) thisMonth++;
      if (q.status === "unlocked" || q.status === "accepted") unlockedRevenue += Number(q.totale ?? 0);
    }

    const total = Number(statsResult[0]?.total ?? 0);
    const avgValue = total > 0 ? Number(statsResult[0]?.totalRevenue ?? 0) / total : 0;

    res.json({
      total,
      draft: allStatusCounts.draft,
      unlocked: allStatusCounts.unlocked + allStatusCounts.accepted,
      accepted: allStatusCounts.accepted,
      pendingPayment: allStatusCounts.pending_payment,
      totalRevenue: Number(statsResult[0]?.totalRevenue ?? 0),
      unlockedRevenue,
      thisMonth,
      avgValue,
      recentQuotes: recentQuotes.map(q => serializeQuote(q)),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/quotes — summaries only (Phase 68). The list pages read a dozen
// scalar fields; shipping every quote's chapters, line items, raw input and
// company snapshot made a 500-quote account wait 1.7 s for 1.5 MB. Detail
// views fetch /api/quotes/:id. `lineItemCount` is computed in SQL so the
// JSON columns never leave Postgres.
router.get("/quotes", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select({
        id: quotesTable.id,
        clientId: quotesTable.clientId,
        province: quotesTable.province,
        clientData: quotesTable.clientData,
        descrizioneGenerale: quotesTable.descrizioneGenerale,
        lineItemCount: sql<number>`coalesce(jsonb_array_length(${quotesTable.items}), 0)::int`,
        subtotale: quotesTable.subtotale,
        ivaValore: quotesTable.ivaValore,
        totale: quotesTable.totale,
        status: quotesTable.status,
        acceptedAt: quotesTable.acceptedAt,
        pdfUrl: quotesTable.pdfUrl,
        capitolatoPro: quotesTable.capitolatoPro,
        templateId: quotesTable.templateId,
        createdAt: quotesTable.createdAt,
        updatedAt: quotesTable.updatedAt,
        archivedAt: quotesTable.archivedAt,
      })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, userId), isNull(quotesTable.archivedAt)))
      .orderBy(desc(quotesTable.createdAt));
    res.json(
      rows.map((q) => ({
        id: q.id,
        clientId: q.clientId ?? null,
        province: normalizeProvince(q.province) ?? normalizeProvince((q.clientData as QuoteClientData | null)?.province) ?? null,
        clientData: q.clientData,
        descrizioneGenerale: q.descrizioneGenerale,
        lineItemCount: q.lineItemCount,
        subtotale: Number(q.subtotale),
        ivaValore: Number(q.ivaValore),
        totale: Number(q.totale),
        status: q.status,
        acceptedAt: q.acceptedAt?.toISOString() ?? null,
        pdfUrl: q.pdfUrl ?? null,
        capitolatoPro: q.capitolatoPro ?? false,
        templateId: q.templateId ?? "standard",
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        archivedAt: q.archivedAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

function findRelevantCatalogItems(
  input: string,
  catalog: Array<typeof priceCatalogItemsTable.$inferSelect>,
  limit = 20
): Array<typeof priceCatalogItemsTable.$inferSelect> {
  if (catalog.length <= limit) return catalog;

  const words = input.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (words.length === 0) return catalog.slice(0, limit);

  const scored = catalog.map(item => {
    const nameLower = item.nome.toLowerCase();
    const catLower = (item.categoria || "").toLowerCase();
    const noteLower = (item.note || "").toLowerCase();

    let score = 0;
    for (const word of words) {
      if (nameLower.includes(word)) score += 3;
      if (catLower.includes(word)) score += 1.5;
      if (noteLower.includes(word)) score += 0.5;
    }
    return { item, score };
  });

  const filtered = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);

  if (filtered.length < limit) {
    const addedIds = new Set(filtered.map(f => f.id));
    for (const item of catalog) {
      if (filtered.length >= limit) break;
      if (!addedIds.has(item.id)) {
        filtered.push(item);
        addedIds.add(item.id);
      }
    }
  }

  return filtered.slice(0, limit);
}

function buildPastQuotesContext(
  quotes: Array<{ rawInput: string; capitoli: unknown; totale: string }>
): string {
  const examples = quotes
    .filter(q => Array.isArray(q.capitoli) && (q.capitoli as QuoteChapter[]).length > 0)
    .slice(0, 3)
    .map(q => {
      const caps = q.capitoli as QuoteChapter[];
      const voci = caps.flatMap(c => c.voci).slice(0, 8);
      const prezziLines = voci
        .map(v => `  - ${v.descrizione} (${v.um}): $${v.prezzoUnitario}/unit`)
        .join("\n");
      const totale = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(q.totale));
      return `Job: "${q.rawInput.slice(0, 120).replace(/\n/g, " ")}"\nTotal: ${totale}\nPrices applied:\n${prezziLines}`;
    });

  if (examples.length === 0) return "";

  return `USER'S PAST QUOTES (use as reference for pricing and style consistency):
These are the same user's previous quotes. Stay consistent with the unit prices and types of work already used, adapting them to the new job.

${examples.join("\n\n---\n\n")}`;
}

// Multipart text fields; clientData / companySnapshot are JSON strings checked against their own schemas below.
const CreateQuoteFields = z.object({
  rawInput: z.string().trim().min(1).max(20_000),
  misure: z.union([z.string().max(20_000), z.record(z.union([z.string(), z.number()]))]).optional(),
  templateId: z.string().max(50).optional(),
  targetTotalEur: z.union([z.string().max(30), z.number()]).optional(),
  clientData: z.string().max(20_000).optional(),
  companySnapshot: z.string().max(200_000).optional(),
});

// POST /api/quotes  (multipart/form-data: rawInput, clientData?, companySnapshot?, images[])
router.post("/quotes", requireAuth, requirePermission("quotes", "edit"), aiCallLimiter, imageUpload.array("images", 3), async (req, res) => {
  try {
    const userId = getUserId(res);

    // ── Quota enforcement ─────────────────────────────────────────────────────
    const [profile] = await db
      .select({
        subscriptionPlan: businessProfilesTable.subscriptionPlan,
        subscriptionStatus: businessProfilesTable.subscriptionStatus,
        trialStartedAt: businessProfilesTable.trialStartedAt,
        province: businessProfilesTable.province,
      })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (profile?.subscriptionStatus === "active" && profile.subscriptionPlan) {
      const plan = PLANS.find(p => p.id === profile.subscriptionPlan);
      if (plan?.quotaPerMonth != null) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const [{ cnt }] = await db
          .select({ cnt: sql<number>`count(*)::int` })
          .from(quotesTable)
          .where(sql`${quotesTable.userId} = ${userId} AND ${quotesTable.createdAt} >= ${monthStart.toISOString()} AND ${quotesTable.createdAt} < ${nextMonth.toISOString()}`);
        if (cnt >= plan.quotaPerMonth) {
          res.status(429).json({
            error: `Monthly quota reached. You've used all ${plan.quotaPerMonth} quotes included in the ${plan.name} plan this month. Upgrade to a higher plan to continue.`,
            code: "QUOTA_EXCEEDED",
          });
          return;
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const fields = CreateQuoteFields.safeParse(req.body ?? {});
    if (!fields.success) {
      res.status(400).json({ error: fields.error.issues.some((i) => i.path[0] === "rawInput") ? "rawInput is required" : "Invalid parameters", details: fields.error });
      return;
    }
    const f = fields.data;
    const rawInput = f.rawInput;

    let misure: Record<string, string | number> | undefined;
    if (f.misure) {
      try {
        misure = typeof f.misure === "string" ? JSON.parse(f.misure) : f.misure;
      } catch (err) {
        req.log.warn({ err }, "Error parsing body.misure");
      }
    }

    const requestedTemplateId = f.templateId ?? "standard";
    const validTemplateIds = ["standard", "arosio", "mariagrazia"];
    const templateId = validTemplateIds.includes(requestedTemplateId) ? requestedTemplateId : "standard";

    const rawTargetTotal = f.targetTotalEur;
    const targetTotalEur: number | null =
      rawTargetTotal !== undefined && rawTargetTotal !== "" && !isNaN(Number(rawTargetTotal)) && Number(rawTargetTotal) > 0
        ? Number(rawTargetTotal)
        : null;

    let clientDataInput: QuoteClientData | undefined;
    if (f.clientData) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(f.clientData);
      } catch {
        res.status(400).json({ error: "clientData must be valid JSON" });
        return;
      }
      const result = quoteClientDataSchema.safeParse(parsed);
      if (!result.success) {
        res.status(400).json({ error: "Invalid clientData", details: result.error });
        return;
      }
      clientDataInput = result.data;
    }

    let companySnapshotInput: QuoteCompanySnapshot | undefined;
    if (f.companySnapshot) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(f.companySnapshot);
      } catch {
        res.status(400).json({ error: "companySnapshot must be valid JSON" });
        return;
      }
      const result = quoteCompanySnapshotSchema.safeParse(parsed);
      if (!result.success) {
        res.status(400).json({ error: "Invalid companySnapshot", details: result.error });
        return;
      }
      companySnapshotInput = result.data;
    }

    const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
    const imageFiles = uploadedFiles.filter(f => ALLOWED_IMAGE_MIMES.includes(f.mimetype));
    const docFiles = uploadedFiles.filter(f => ALLOWED_DOC_MIMES.includes(f.mimetype));

    const imageDataUrls = imageFiles.map(
      (f) => `data:${f.mimetype};base64,${f.buffer.toString("base64")}`
    );

    // Extract text from documents for AI context
    const docTexts: string[] = [];
    for (const f of docFiles) {
      let text = "";
      if (f.mimetype === "application/pdf") text = await extractFromPdf(f.buffer);
      else if (f.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") text = await extractFromDocx(f.buffer);
      else if (f.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") text = await extractFromXlsx(f.buffer);
      if (text) docTexts.push(`--- File: ${f.originalname} ---\n${text}`);
    }

    // Build user message: inject client data and document text as context
    let userMessage = rawInput;
    if (clientDataInput?.nome) {
      userMessage = `Client data (do NOT regenerate, use these exact values):
- Name/Company Name: ${clientDataInput.nome}
- Address: ${clientDataInput.indirizzo || ""}${clientDataInput.businessNumber ? `\n- Business Number: ${clientDataInput.businessNumber}` : ""}${clientDataInput.city ? `\n- City: ${clientDataInput.city}` : ""}${clientDataInput.postalCode ? ` Postal Code: ${clientDataInput.postalCode}` : ""}${clientDataInput.province ? ` (${clientDataInput.province})` : ""}

Job description: ${rawInput}`;
    }

    // Detect computo metrico in rawInput or document text to bypass AI entirely
    const fullText = userMessage + "\n" + docTexts.join("\n");
    const isStructured = isComputoMetrico(fullText);
    if (isStructured) {
      req.log.info({ userId }, "Structured computo metrico detected; bypassing AI.");
    }

    // Detect tabular computo metrico format (PDF extracts with Category/Description/UM/QTA columns)
    const isTabular = docTexts.length > 0 && isTabularComputoMetrico(docTexts.join("\n"));
    let tabularData: ReturnType<typeof parseTabularComputoMetrico> = null;
    if (isTabular) {
      tabularData = parseTabularComputoMetrico(docTexts.join("\n"));
      if (tabularData && tabularData.totalVoci >= 5) {
        req.log.info({ userId, totalVoci: tabularData.totalVoci }, "Tabular computo metrico detected; extracting structured voci list.");
      }
    }

    // Detect numbered computo metrico (Italian "A. Demolizioni" + N° rows + Subtotale format)
    // This is the most common format from Italian computo software.
    // Check BEFORE isTabular to give it priority — it extracts actual prices from the document.
    const docJoined = docTexts.join("\n");
    const isNumbered = docTexts.length > 0 && isNumberedComputoMetrico(docJoined);
    let numberedData: ReturnType<typeof parseNumberedComputoMetrico> = null;
    if (isNumbered) {
      numberedData = parseNumberedComputoMetrico(docJoined);
      req.log.info({ userId, totalVoci: numberedData?.totalVoci ?? 0 }, "Numbered computo metrico detected; deterministic parse with actual prices.");
    }

    if (docTexts.length > 0 && !isStructured && !isTabular && !isNumbered) {
      userMessage += `\n\n\nCONTENT EXTRACTED FROM ATTACHED DOCUMENTS:
${docTexts.join("\n\n---\n\n")}

MANDATORY INSTRUCTION ABOUT ATTACHED DOCUMENTS:
The user has attached a document with a detailed itemized breakdown (bill of quantities). Every single item and every single element listed in the document must become a separate line in the quote. Do NOT summarize, do NOT merge, do NOT omit anything. Transform the document 1:1 into work items: take each element, keep its description, unit of measure, quantity, and unit price, and insert it as a separate item in the appropriate chapter. If necessary, create MULTIPLE CHAPTERS to hold all the items. Do not apply discounts or changes to the unit prices provided in the document. Write all output text in English.`;
    }

    // Fetch business profile, recent quotes, catalog items, and price intelligence in parallel
    const [fetchedProfileResult, recentQuotes, catalogItems, processedDocCount, priceIntelligenceItems] = await Promise.all([
      companySnapshotInput
        ? Promise.resolve([])
        : db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)),
      db.select({
        rawInput: quotesTable.rawInput,
        capitoli: quotesTable.capitoli,
        totale: quotesTable.totale,
      })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId))
        .orderBy(desc(quotesTable.createdAt))
        .limit(5),
      db.select()
        .from(priceCatalogItemsTable)
        .where(inArray(priceCatalogItemsTable.userId, await catalogOwnerIds(userId)))
        .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome),
      db.select({ cnt: count() })
        .from(uploadedDocumentsTable)
        .where(and(eq(uploadedDocumentsTable.userId, userId), eq(uploadedDocumentsTable.status, "done"))),
      db.select({
        workType: priceIntelligenceTable.workType,
        zone: priceIntelligenceTable.zone,
        avgPrice: avg(sql`${priceIntelligenceTable.unitPrice}::numeric`),
        unit: sql<string | null>`max(${priceIntelligenceTable.unit})`,
      })
        .from(priceIntelligenceTable)
        .where(eq(priceIntelligenceTable.userId, userId))
        .groupBy(priceIntelligenceTable.workType, priceIntelligenceTable.zone)
        .orderBy(priceIntelligenceTable.workType, priceIntelligenceTable.zone),
    ]);
    const [fetchedProfile] = fetchedProfileResult as (typeof businessProfilesTable.$inferSelect)[];

    const resolvedSnapshot: QuoteCompanySnapshot | null = companySnapshotInput
      ? {
          companyName: companySnapshotInput.companyName,
          vatNumber: companySnapshotInput.vatNumber ?? undefined,
          address: companySnapshotInput.address ?? undefined,
          phone: companySnapshotInput.phone ?? undefined,
          email: companySnapshotInput.email ?? undefined,
          logoUrl: companySnapshotInput.logoUrl ?? undefined,
        }
      : fetchedProfile
        ? {
            companyName: fetchedProfile.companyName,
            vatNumber: fetchedProfile.vatNumber ?? undefined,
            address: fetchedProfile.address ?? undefined,
            phone: fetchedProfile.phone ?? undefined,
            email: fetchedProfile.email ?? undefined,
            logoUrl: fetchedProfile.logoUrl ?? undefined,
          }
        : null;

    // Build past-quotes context for pricing consistency
    const pastContext = buildPastQuotesContext(recentQuotes as { rawInput: string; capitoli: unknown; totale: string }[]);

    // Build catalog context if user has custom price items
    const relevantCatalogItems = findRelevantCatalogItems(rawInput, catalogItems, 20);
    const catalogContext = relevantCatalogItems.length > 0
      ? `USER'S CUSTOM PRICE LIST (use these prices as the PRIORITY reference when the work items match — adjust quantities to the requested job):
${relevantCatalogItems
  .map(item => `  - ${item.nome} (${item.um}): $${Number(item.prezzoUnitario).toFixed(2)}/unit${item.categoria ? ` [${item.categoria}]` : ""}${item.note ? ` — ${item.note}` : ""}`)
  .join("\n")}

When you use a price-list item, apply the exact unit price or a very close one. For work items not present in the price list, use standard market prices. Write all output text in English.`
      : "";

    // Build misure context if provided
    let misureContext = "";
    if (misure && typeof misure === "object" && Object.keys(misure).length > 0) {
      misureContext = `PROPERTY MEASUREMENTS AND DIMENSIONS (binding for quantity calculations):
${Object.entries(misure)
  .map(([key, val]) => `  - ${key}: ${val}`)
  .join("\n")}

Use these exact measurements to mathematically calculate the quantities of the individual work items requested in the quote. Do not invent arbitrary quantities that contradict these dimensions.`;
    }

    // Build price intelligence context from user's uploaded documents (activated when ≥3 docs processed)
    const docCount = Number(processedDocCount[0]?.cnt ?? 0);
    const priceIntelContext = docCount >= 3 && priceIntelligenceItems.length > 0
      ? `PERSONALIZED PRICE INTELLIGENCE (extracted from ${docCount} of the user's real quotes — use these prices as guidance for the user's region and types of work):
${priceIntelligenceItems
  .slice(0, 30)
  .map(item => `  - ${item.workType}${item.zone ? ` [${item.zone}]` : ""}: ${Number(item.avgPrice ?? 0).toFixed(2)}${item.unit ? `/${item.unit}` : ""}`)
  .join("\n")}

These prices reflect the real values applied by the user in their local market. Where available, the geographic zone is shown in square brackets. Use them as the priority reference when the requested work items and zone match.`
      : "";

    const hasImages = imageDataUrls.length > 0;

    const imagesContext = hasImages
      ? `INSTRUCTIONS FOR THE ATTACHED IMAGES:
The user has attached ${imageDataUrls.length === 1 ? "one photo" : `${imageDataUrls.length} photos`} to support the request. You MUST analyze them carefully and extract every piece of information useful for the quote:
- Handwritten notes (including cursive): TRANSCRIBE AND INTERPRET measurements, quantities, work descriptions, materials, brands, models, addresses, client names
- Sketches and technical drawings: infer dimensions, layout, type of job
- Job-site or room photos: identify surfaces, condition of the space, work needed, any issues
- Product labels/photos: extract brand, model, codes, technical specs
- Documents, floor plans, itemized breakdowns: use the numbers and line items as a basis
NEVER REFUSE to read or interpret an image: the tradesperson's notes are the main working tool. If something is illegible, make a reasonable assumption and proceed.
Always combine the information extracted from the images with the user's text description to generate the most complete and accurate quote possible.
REMEMBER: the output must be ONLY valid JSON per the given schema — NEVER free text, NEVER refusals, NEVER explanations. Write all output text in English.`
      : "";

    const targetTotalContext = targetTotalEur
      ? `MANDATORY TOTAL AMOUNT:
The quote MUST have a total (before any provincial/GST-HST sales tax) of APPROXIMATELY ${targetTotalEur.toLocaleString("en-CA")} CAD. This is an absolute constraint.
Distribute the unit prices of ALL items so their sum respects this amount. Do not ignore this constraint.
If the attached document has many items, keep them all and adjust prices proportionally to reach the required total.`
      : "";

    const templateStyleContext =
      templateId === "arosio"
        ? `PROFESSIONAL TECHNICAL SPECIFICATION MODE:
For every work item, write the description in DETAILED TECHNICAL SPECIFICATION style with AT LEAST 4-6 technical lines in formal English:
- Describe precisely the operations performed and the execution methods (work sequence, techniques, order of phases)
- Specify materials, products, and components with technical characteristics and applicable Canadian/North American standards (CSA, NBC/National Building Code, provincial codes, ULC, etc.)
- State the quality, strength, class, or certification requirements for the materials
- Explicitly state what is INCLUDED in the item (supply, labour, loading, transport, disposal)
- State any relevant EXCLUSIONS and/or costs to be borne by the client
- Use professional construction/trades terminology
Example: "Demolition and removal of existing ceramic tile flooring, including detachment by mechanical chipping and removal of the setting bed to an average thickness of 5 cm. Includes loading, transport, and disposal of debris at an authorized landfill in accordance with applicable provincial waste regulations. Excludes structural subfloor repair and waterproofing work."

Always set titolo_riga1 = "Detailed Cost Analysis and Itemized Estimate".`
        : templateId === "mariagrazia"
        ? `ELEGANT COMMERCIAL PROPOSAL MODE:
Write the quote in PROFESSIONAL and PERSUASIVE COMMERCIAL PROPOSAL style:
- Item descriptions must be CLEAR, CONCISE, and WELL WRITTEN (1-3 lines per item, 4 max)
- Use a professional yet engaging tone, suited to presenting a commercial offer to a private client
- Emphasize service QUALITY, EXPERIENCE, and ATTENTION TO DETAIL
- Organize chapters logically and make them easy to read
- Use descriptive, commercial chapter titles (e.g. "Site Preparation and Setup", "Main Works", "Quality Finishes", "Cleanup and Handover")
- Set titolo_riga1 = "Commercial Proposal"
- Include a closing note highlighting the quality of the service, the company's experience, and the warranty on the work
- Payment terms: propose 2-3 simple, clear installments (e.g. 50% deposit on signing, 50% balance on completion)
Write all output text in English.`
        : null;

    let aiData: {
      titolo_riga1?: string;
      titolo_riga2?: string;
      numero_preventivo_data?: string;
      cliente?: { nome?: string; indirizzo?: string };
      descrizione_generale?: string;
      capitoli?: Array<{
        lettera?: string;
        titolo?: string;
        osservazione?: string;
        voci?: Array<{
          descrizione?: string;
          um?: string;
          quantita?: number;
          prezzo_unitario?: number;
          totale?: number;
        }>;
        subtotale?: number;
      }>;
      sconto?: { percentuale?: number; importo_scontato?: number } | null;
      condizioni_pagamento?: string[];
      subtotale?: number;
      iva_percentuale?: number;
      iva_valore?: number;
      totale?: number;
      note?: string;
    } = {};

    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let totalTokens: number | null = null;
    let modelUsed: string | null = null;
    let apiCost: string | null = null;

    if (!isStructured && !isTabular && !isNumbered) {
      const targetModel = (hasImages || docTexts.length > 0) ? "gpt-4o" : "gpt-4o-mini";
      const completion = await openai.chat.completions.create({
        model: targetModel,
        max_completion_tokens: (hasImages || docTexts.length > 0) ? 16384 : 8192,
        temperature: 0.3,
        messages: [
          { role: "system", content: AI_PROMPT },
          { role: "system", content: REGIONAL_PRICING_GUIDANCE },
          { role: "system", content: DESCRIPTION_QUALITY_GUIDANCE },
          ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
          ...(misureContext ? [{ role: "system" as const, content: misureContext }] : []),
          ...(priceIntelContext ? [{ role: "system" as const, content: priceIntelContext }] : []),
          ...(pastContext ? [{ role: "system" as const, content: pastContext }] : []),
          ...(targetTotalContext ? [{ role: "system" as const, content: targetTotalContext }] : []),
          ...(templateStyleContext ? [{ role: "system" as const, content: templateStyleContext }] : []),
          ...(imagesContext ? [{ role: "system" as const, content: imagesContext }] : []),
          {
            role: "user",
            content: hasImages
              ? [
                  { type: "text" as const, text: userMessage },
                  ...imageDataUrls.map(img => ({
                    type: "image_url" as const,
                    image_url: { url: img, detail: "high" as const },
                  })),
                ]
              : userMessage,
          },
        ],
      });

      const usage = completion.usage;
      promptTokens = usage?.prompt_tokens ?? 0;
      completionTokens = usage?.completion_tokens ?? 0;
      totalTokens = usage?.total_tokens ?? 0;
      modelUsed = completion.model || targetModel;

      const isMini = modelUsed.includes("mini");
      const isGpt4 = modelUsed.includes("gpt-4o") && !isMini;
      const pCostRate = isMini ? 0.00000015 : isGpt4 ? 0.000005 : 0.00000059;
      const cCostRate = isMini ? 0.00000060 : isGpt4 ? 0.000015 : 0.00000079;
      apiCost = ((promptTokens * pCostRate) + (completionTokens * cCostRate)).toFixed(6);

      const content = completion.choices[0]?.message?.content ?? "{}";
      try {
        const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        aiData = JSON.parse(cleaned);
      } catch {
        req.log.error({ content, hasImages }, "Failed to parse AI JSON");
        const isRefusal = /mi dispiace|mi spiace|non (posso|riesco)|sorry|i cannot|i can't/i.test(content);
        if (isRefusal && hasImages) {
          res.status(422).json({
            error: "The AI couldn't interpret the attached images. Try rephrasing the text description with more details (measurements, materials, work items), or upload clearer photos.",
            code: "AI_IMAGE_REFUSAL",
          });
          return;
        }
        res.status(422).json({
          error: "The AI didn't return a valid quote. Please try again in a moment or rephrase your request.",
          code: "AI_INVALID_OUTPUT",
        });
        return;
      }
    } else if (isNumbered && numberedData && numberedData.totalVoci >= 3) {
      // Numbered computo metrico: BYPASS AI entirely — use ACTUAL prices from document
      // This format (A. Demolizioni + numbered rows + chapter subtotal) is the most common
      // one produced by Italian computo-metrico software. The AI summarizes C/D/E chapters; we don't.
      req.log.info({ userId, totalVoci: numberedData.totalVoci, targetTotalEur }, "Numbered computo: bypassing AI, using actual prices from document");

      const chaptersRaw = numberedData.sections.map((s) => {
        const voci = s.voci.map(v => {
          // Use actual price from the document; fall back to estimation only if missing
          let pu = v.prezzoUnitario;
          if (!pu || pu <= 0) {
            pu = estimatePriceForVoce(s.titolo, v.descrizione, v.um);
          }
          const qty = v.quantita > 0 ? v.quantita : 1;
          const totale = Math.round(qty * pu * 100) / 100;
          return {
            descrizione: v.descrizione,
            um: v.um,
            quantita: qty,
            prezzo_unitario: pu,
            totale,
          };
        });
        const subtotale = voci.reduce((sum, v) => sum + v.totale, 0);
        return {
          lettera: s.lettera,
          titolo: s.titolo,
          osservazione: getChapterDescription(s.titolo),
          voci,
          subtotale,
        };
      });

      // Apply proportional scaling to hit targetTotalEur (tax included) if provided
      let chapters = chaptersRaw;
      let subTot = chaptersRaw.reduce((sum, c) => sum + c.subtotale, 0);

      if (targetTotalEur && subTot > 0) {
        const ivaRate = 0.13;
        const targetSubtotale = targetTotalEur / (1 + ivaRate);
        const scaleFactor = targetSubtotale / subTot;
        req.log.info({ scaleFactor, rawSubtotale: subTot, targetSubtotale }, "Numbered computo: applying price scaling to hit target total");

        chapters = chaptersRaw.map(c => {
          const voci = c.voci.map(v => {
            const newPu = Math.round(v.prezzo_unitario * scaleFactor * 100) / 100;
            const newTotale = Math.round(v.quantita * newPu * 100) / 100;
            return { ...v, prezzo_unitario: newPu, totale: newTotale };
          });
          return { ...c, voci, subtotale: voci.reduce((s, v) => s + v.totale, 0) };
        });
        subTot = chapters.reduce((sum, c) => sum + c.subtotale, 0);
      }

      chapters = await enrichVociDescrizioni(chapters);

      const iva = Math.round(subTot * 13) / 100;
      const totale = Math.round((subTot + iva) * 100) / 100;

      aiData = {
        capitoli: chapters,
        subtotale: subTot,
        iva_percentuale: 13,
        iva_valore: iva,
        totale,
        descrizione_generale: "Itemized quote generated from the uploaded price list document.",
        note: "Quote valid for 30 days",
        sconto: { percentuale: 0, importo_scontato: 0 },
        condizioni_pagamento: [
          "15% deposit upon contract signing",
          "35% upon delivery of materials and start of work",
          "35% upon substantial completion",
          "15% final balance upon completion and client walkthrough",
        ],
        titolo_riga1: "Project Quote & Itemized Estimate",
        titolo_riga2: "",
        numero_preventivo_data: "",
        cliente: { nome: "", indirizzo: "" },
      };
    } else if (isTabular && tabularData && tabularData.totalVoci >= 5) {
      // Tabular computo metrico: BYPASS AI entirely — build quote deterministically
      // The AI truncates JSON when there are too many voci; deterministic pricing is reliable
      req.log.info({ userId, totalVoci: tabularData.totalVoci, targetTotalEur }, "Tabular computo: bypassing AI, deterministic pricing");

      const chaptersRaw = tabularData.sections.map((s, idx) => {
        const voci = s.voci.map(v => {
          const estimatedPrice = estimatePriceForVoce(v.categoria, v.descrizione, v.um);
          const totale = Math.round(v.quantita * estimatedPrice * 100) / 100;
          return {
            descrizione: v.descrizione,
            um: v.um,
            quantita: v.quantita,
            prezzo_unitario: estimatedPrice,
            totale,
          };
        });
        const subtotale = voci.reduce((sum, v) => sum + v.totale, 0);
        return {
          lettera: String.fromCharCode(65 + idx),
          titolo: s.titolo,
          osservazione: getChapterDescription(s.titolo),
          voci,
          subtotale,
        };
      });

      // Apply proportional scaling to hit the target total (tax included) if provided
      let chapters = chaptersRaw;
      let subTot = chaptersRaw.reduce((sum, c) => sum + c.subtotale, 0);

      if (targetTotalEur && subTot > 0) {
        const ivaRate = 0.13;
        const targetSubtotale = targetTotalEur / (1 + ivaRate);
        const scaleFactor = targetSubtotale / subTot;
        req.log.info({ scaleFactor, rawSubtotale: subTot, targetSubtotale }, "Tabular computo: applying price scaling to hit target total");

        chapters = chaptersRaw.map(c => {
          const voci = c.voci.map(v => {
            const newPu = Math.round(v.prezzo_unitario * scaleFactor * 100) / 100;
            const newTotale = Math.round(v.quantita * newPu * 100) / 100;
            return { ...v, prezzo_unitario: newPu, totale: newTotale };
          });
          return { ...c, voci, subtotale: voci.reduce((s, v) => s + v.totale, 0) };
        });
        subTot = chapters.reduce((sum, c) => sum + c.subtotale, 0);
      }

      chapters = await enrichVociDescrizioni(chapters);

      const iva = Math.round(subTot * 13) / 100;
      const totale = Math.round((subTot + iva) * 100) / 100;

      aiData = {
        capitoli: chapters,
        subtotale: subTot,
        iva_percentuale: 13,
        iva_valore: iva,
        totale,
        descrizione_generale: "Economic analysis and priced bill of quantities",
        note: "Quote valid for 30 days",
        sconto: { percentuale: 0, importo_scontato: 0 },
        condizioni_pagamento: [
          "15% deposit upon contract signing",
          "35% upon delivery of materials and start of work",
          "35% upon substantial completion",
          "15% final balance upon completion and client walkthrough",
        ],
        titolo_riga1: "Project Quote & Itemized Estimate",
        titolo_riga2: "",
        numero_preventivo_data: "",
        cliente: { nome: "", indirizzo: "" },
      };
    } else {
      const parsedCapitoli = parseComputoMetrico(fullText);
      const subTot = parsedCapitoli?.reduce((sum, c) => sum + c.subtotale, 0) ?? 0;
      const iva = Math.round(subTot * 13) / 100;
      aiData = {
        capitoli: parsedCapitoli?.map(c => ({
          lettera: c.lettera,
          titolo: c.titolo,
          osservazione: c.osservazione,
          voci: c.voci.map(v => ({
            descrizione: v.descrizione,
            um: v.um,
            quantita: v.quantita,
            prezzo_unitario: v.prezzoUnitario,
            totale: v.totale,
          })),
          subtotale: c.subtotale,
        })) ?? [],
        subtotale: subTot,
        iva_percentuale: 13,
        iva_valore: iva,
        totale: subTot + iva,
        descrizione_generale: "Economic analysis and priced bill of quantities",
        note: "Quote valid for 30 days",
      };
    }

    // NOTE: totale/subtotale for each line item and chapter are always
    // RECOMPUTED here from quantita * prezzoUnitario rather than trusted from
    // the AI's own aiData.totale/subtotale/iva_valore fields. The model
    // sometimes echoes the literal "0" placeholders from the prompt's example
    // JSON for the top-level totals even while correctly computing every
    // per-item and per-chapter number, which used to make the request fail
    // the "AI returned empty or invalid quote structure" check below.
    let capitoli: QuoteChapter[] = (aiData.capitoli ?? []).map((cap) => {
      let capSubtotale = 0;
      const voci = (cap.voci ?? []).map((v) => {
        const quantita = Number(v.quantita ?? 0);
        const prezzoUnitario = Number(v.prezzo_unitario ?? 0);
        const totale = Number((quantita * prezzoUnitario).toFixed(2));
        capSubtotale += totale;
        return {
          descrizione: v.descrizione ?? "",
          um: v.um ?? "a.c.",
          quantita,
          prezzoUnitario,
          totale,
        };
      });
      return {
        lettera: cap.lettera ?? "A",
        titolo: cap.titolo ?? "",
        osservazione: cap.osservazione ?? "Standard item",
        voci,
        subtotale: Number(capSubtotale.toFixed(2)),
      };
    });

    if (templateId === "arosio" || templateId === "mariagrazia") {
      capitoli = await enrichVociDescrizioni(capitoli);
    }

    const calculatedSubtotale = Number(capitoli.reduce((sum, c) => sum + c.subtotale, 0).toFixed(2));

    const scontoRaw = aiData.sconto;
    const scontoPercentuale = scontoRaw ? Number(scontoRaw.percentuale ?? 0) : 0;
    // Phase 67: `importoScontato` is the *discounted subtotal* everywhere the
    // quote is rendered (PDFs, HTML, dashboard editor) — not the discount
    // amount. Storing the amount here made a 10 % discount print as "−$9,000".
    const discountAmount = scontoPercentuale > 0 ? Number((calculatedSubtotale * scontoPercentuale / 100).toFixed(2)) : 0;
    const importoScontato = Number((calculatedSubtotale - discountAmount).toFixed(2));
    const sconto: QuoteDiscount | null =
      scontoPercentuale > 0 ? { percentuale: scontoPercentuale, importoScontato } : null;

    const condizioniPagamento = aiData.condizioni_pagamento ?? [
      "15% deposit upon contract signing",
      "35% upon delivery of materials and start of work",
      "35% upon substantial completion",
      "15% final balance upon completion and client walkthrough",
    ];

    const subtotale = calculatedSubtotale;
    const ivaPercentuale = resolveQuoteTaxRate(aiData.iva_percentuale, profile?.province);
    const imponibile = importoScontato;
    const ivaValore = Number((imponibile * ivaPercentuale / 100).toFixed(2));
    const totale = Number((imponibile + ivaValore).toFixed(2));

    // Sanity check: reject empty/zero-value AI output before persisting a junk quote
    const hasAnyVoci = capitoli.some(c => Array.isArray(c.voci) && c.voci.length > 0);
    if (capitoli.length === 0 || !hasAnyVoci || totale <= 0) {
      req.log.error({ aiData, hasImages }, "AI returned empty or invalid quote structure");
      res.status(422).json({
        error: hasImages
          ? "The AI couldn't extract useful information from the images. Try adding more detail to the text description (work items, measurements, materials)."
          : "The AI couldn't generate a quote from the description provided. Try adding more detail (work items, measurements, materials).",
        code: "AI_EMPTY_QUOTE",
      });
      return;
    }

    // Prefer structured clientData from request, fall back to AI-generated
    const resolvedClientData: QuoteClientData = clientDataInput?.nome
      ? {
          nome: clientDataInput.nome,
          indirizzo: clientDataInput.indirizzo || "",
          // Phase 94: the quote form now asks for these; they used to be dropped here.
          email: clientDataInput.email?.trim() || undefined,
          phone: clientDataInput.phone?.trim() || undefined,
          businessNumber: clientDataInput.businessNumber,
          partitaIva: clientDataInput.partitaIva,
          city: clientDataInput.city,
          postalCode: clientDataInput.postalCode,
          province: clientDataInput.province,
        }
      : {
          nome: aiData.cliente?.nome ?? "",
          indirizzo: aiData.cliente?.indirizzo ?? "",
        };

    const [quote] = await db.transaction(async (tx) => {
      // Row lock the user's business profile record to prevent concurrent quote creation
      await tx.execute(sql`SELECT user_id FROM ${businessProfilesTable} WHERE user_id = ${userId} FOR UPDATE`);

      const numeroPreventivoData = await generateNumeroPreventivo(userId);

      return await tx
        .insert(quotesTable)
        .values({
          userId,
          createdByUserId: currentActorId(),
          rawInput,
          clientData: resolvedClientData,
          companySnapshot: resolvedSnapshot,
          descrizioneGenerale: aiData.descrizione_generale ?? "",
          items: [],
          capitoli,
          sconto,
          condizioniPagamento,
          capitolatoPro: !!(profile?.subscriptionStatus === "active" && (profile?.subscriptionPlan === "monthly_pro" || profile?.subscriptionPlan === "monthly_elite")),
          titoloPreventivoRiga1: aiData.titolo_riga1 ?? "Project Quote & Itemized Estimate",
          titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
          numeroPreventivoData,
          subtotale: subtotale.toFixed(2),
          ivaPercentuale: ivaPercentuale.toFixed(3),
          ivaValore: ivaValore.toFixed(2),
          totale: totale.toFixed(2),
          note: aiData.note ?? "Quote valid for 30 days",
          promptTokens,
          completionTokens,
          totalTokens,
          modelUsed,
          apiCost,
        })
        .returning();
    });

    await linkQuoteToClient(quote!, profile?.province);

    // Save attachments to object storage + quote_attachments table
    const savedAttachments: typeof quoteAttachmentsTable.$inferInsert[] = [];
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "image/heic": "heic", "image/heif": "heif",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };
    for (const f of uploadedFiles) {
      const objectId = randomUUID();
      const ext = extMap[f.mimetype] ?? "bin";
      const subPath = `quote_attachments/${userId}/${quote.id}/${objectId}.${ext}`;
      const fileUrl = await objectStorage.uploadObjectBuffer({
        subPath,
        buffer: f.buffer,
        contentType: f.mimetype,
      });
      savedAttachments.push({
        quoteId: quote.id,
        userId,
        fileName: f.originalname,
        mimeType: f.mimetype,
        fileUrl,
        fileSize: String(f.size),
      });
    }
    if (savedAttachments.length > 0) {
      await db.insert(quoteAttachmentsTable).values(savedAttachments);
    }

    // Start trial on first quote creation
    if (!profile?.trialStartedAt) {
      await db
        .update(businessProfilesTable)
        .set({ trialStartedAt: new Date() })
        .where(eq(businessProfilesTable.userId, userId));
    }

    const attachments = savedAttachments.length > 0
      ? savedAttachments.map(a => ({ ...a, id: "", createdAt: new Date(), fileSize: a.fileSize ? String(a.fileSize) : null }))
      : undefined;

    res.status(201).json(serializeQuote(quote!, attachments));
  } catch (err) {
    req.log.error({ err }, "Error creating quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/quotes/:id
router.get("/quotes/:id", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = GetQuoteParams.parse(req.params);

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [attachments, variants] = await Promise.all([
      db.select().from(quoteAttachmentsTable).where(eq(quoteAttachmentsTable.quoteId, id)),
      db.select().from(quoteVariantsTable).where(eq(quoteVariantsTable.quoteId, id)).orderBy(quoteVariantsTable.position),
    ]);

    res.json(serializeQuote(quote, attachments, variants));
  } catch (err) {
    req.log.error({ err }, "Error fetching quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/quotes/:id/variants
router.get("/quotes/:id/variants", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const variants = await db
      .select()
      .from(quoteVariantsTable)
      .where(eq(quoteVariantsTable.quoteId, id))
      .orderBy(quoteVariantsTable.position);

    res.json({ variants: variants.map((v) => serializeQuoteVariant(v, normalizeProvince(quote.province) ?? normalizeProvince((quote.clientData as QuoteClientData | null)?.province))) });
  } catch (err) {
    req.log.error({ err }, "Error fetching quote variants");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/variants — clone the quote's current pricing into a new variant
router.post("/quotes/:id/variants", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const existingVariants = await db
      .select()
      .from(quoteVariantsTable)
      .where(eq(quoteVariantsTable.quoteId, id));

    if (existingVariants.length >= 3) {
      res.status(400).json({ error: "A quote can have at most 3 variants" });
      return;
    }

    const parsed = CreateQuoteVariantBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }
    const body = parsed.data;
    const cloneFrom = body.cloneFromVariantId
      ? existingVariants.find(v => v.id === body.cloneFromVariantId)
      : undefined;

    const source = cloneFrom ?? quote;
    const defaultLabels = ["Good", "Better", "Best"];

    const [variant] = await db
      .insert(quoteVariantsTable)
      .values({
        quoteId: id,
        userId,
        label: body.label ?? (defaultLabels[existingVariants.length] ?? ""),
        description: body.description ?? "",
        position: existingVariants.length,
        items: (Array.isArray(source.items) ? source.items : []) as QuoteItem[],
        capitoli: (Array.isArray(source.capitoli) ? source.capitoli : []) as QuoteChapter[],
        sconto: (source.sconto as QuoteDiscount | null) ?? null,
        condizioniPagamento: Array.isArray(source.condizioniPagamento) ? source.condizioniPagamento : [],
        subtotale: source.subtotale,
        ivaPercentuale: source.ivaPercentuale,
        ivaValore: source.ivaValore,
        totale: source.totale,
      })
      .returning();

    res.status(201).json(serializeQuoteVariant(variant!, normalizeProvince(quote.province)));
  } catch (err) {
    req.log.error({ err }, "Error creating quote variant");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/quotes/:id/variants/:variantId
router.put("/quotes/:id/variants/:variantId", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id, variantId } = req.params as { id: string; variantId: string };

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [existing] = await db
      .select()
      .from(quoteVariantsTable)
      .where(and(eq(quoteVariantsTable.id, variantId), eq(quoteVariantsTable.quoteId, id)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const parsed = UpdateQuoteVariantBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }
    const body = parsed.data;
    const updates: Partial<typeof existing> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.description !== undefined) updates.description = body.description;
    if (body.items) updates.items = body.items as QuoteItem[];
    if (body.capitoli) updates.capitoli = body.capitoli as QuoteChapter[];
    if (body.sconto !== undefined) updates.sconto = body.sconto as QuoteDiscount | null;
    if (body.condizioniPagamento) updates.condizioniPagamento = body.condizioniPagamento;
    if (body.subtotale !== undefined) updates.subtotale = String(body.subtotale);
    if (body.ivaPercentuale !== undefined) updates.ivaPercentuale = String(body.ivaPercentuale);
    if (body.ivaValore !== undefined) updates.ivaValore = String(body.ivaValore);
    if (body.totale !== undefined) updates.totale = String(body.totale);

    const [updated] = await db
      .update(quoteVariantsTable)
      .set(updates)
      .where(eq(quoteVariantsTable.id, variantId))
      .returning();

    res.json(serializeQuoteVariant(updated!, normalizeProvince(quote.province)));
  } catch (err) {
    req.log.error({ err }, "Error updating quote variant");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Phase 79: price check + one-click reprice ───────────────────────────────

const RepriceBody = z.object({
  items: z.array(z.object({ chapter: z.string().min(1).max(10), index: z.number().int().min(0).max(500), unitPrice: z.number().min(0).max(10_000_000) })).min(1).max(200),
});

async function ownedQuoteForPricing(userId: string, id: string, res: import("express").Response): Promise<QuoteRow | null> {
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  if (!quote || quote.userId !== userId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return quote;
}

// GET /api/quotes/:id/price-check — lines whose catalog / learned price moved ≥ 5 % from what is quoted.
router.get("/quotes/:id/price-check", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const quote = await ownedQuoteForPricing(userId, req.params.id as string, res);
    if (!quote) return;
    const editable = !quote.pdfDownloadedAt && quote.status !== "accepted";
    const refs = await loadPriceReferences(userId);
    const check = priceCheckChapters((quote.capitoli ?? []) as QuoteChapter[], refs);
    res.json({ ...check, editable, references: refs.length });
  } catch (err) {
    req.log.error({ err }, "Error running quote price check");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/reprice — apply new unit prices to the given lines; every total is recomputed server-side.
router.post("/quotes/:id/reprice", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = RepriceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }
    const quote = await ownedQuoteForPricing(userId, req.params.id as string, res);
    if (!quote) return;
    if (quote.pdfDownloadedAt || quote.status === "accepted") {
      res.status(400).json({ error: "LOCKED", message: "This quote can no longer be edited" });
      return;
    }
    const capitoli = (quote.capitoli ?? []) as QuoteChapter[];
    for (const it of parsed.data.items) {
      const cap = capitoli.find((c) => c.lettera === it.chapter);
      if (!cap || !cap.voci[it.index]) {
        res.status(400).json({ error: "Unknown line", chapter: it.chapter, index: it.index });
        return;
      }
    }
    const before = Number(quote.totale);
    const next = repriceChapters(capitoli, parsed.data.items, Number(quote.ivaPercentuale), quote.sconto?.percentuale ?? 0);
    const [updated] = await db
      .update(quotesTable)
      .set({ capitoli: next.capitoli, subtotale: next.subtotale.toFixed(2), sconto: next.sconto, ivaValore: next.ivaValore.toFixed(2), totale: next.totale.toFixed(2), pdfUrl: null })
      .where(eq(quotesTable.id, quote.id))
      .returning();
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "quote", entityId: quote.id, action: "repriced", diff: { lines: next.applied, totale: { from: before, to: next.totale } }, ip: req.ip, userAgent: req.get("user-agent") });
    res.json({ quote: serializeQuote(updated!), applied: next.applied, totale: { from: before, to: next.totale } });
  } catch (err) {
    req.log.error({ err }, "Error repricing quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/quotes/:id/variants/:variantId
router.delete("/quotes/:id/variants/:variantId", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id, variantId } = req.params as { id: string; variantId: string };

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [existing] = await db
      .select()
      .from(quoteVariantsTable)
      .where(and(eq(quoteVariantsTable.id, variantId), eq(quoteVariantsTable.quoteId, id)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await db.delete(quoteVariantsTable).where(eq(quoteVariantsTable.id, variantId));

    // Renumber remaining variants so `position` stays contiguous.
    const remaining = await db
      .select()
      .from(quoteVariantsTable)
      .where(eq(quoteVariantsTable.quoteId, id))
      .orderBy(quoteVariantsTable.position);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i]!.position !== i) {
        await db.update(quoteVariantsTable).set({ position: i }).where(eq(quoteVariantsTable.id, remaining[i]!.id));
      }
    }

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error deleting quote variant");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/quotes/:id
router.put("/quotes/:id", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = UpdateQuoteParams.parse(req.params);
    const parsed = UpdateQuoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const [existing] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updates: Partial<typeof existing> = {};
    const body = parsed.data;

    // Template entitlement and lock checks
    if (body.templateId !== undefined) {
      if (existing.pdfDownloadedAt) {
        res.status(400).json({ error: "LOCKED", message: "Template cannot be changed after PDF download" });
        return;
      }
      if (body.templateId !== "standard") {
        const [profileData] = await db
          .select({ subscriptionStatus: businessProfilesTable.subscriptionStatus, subscriptionPlan: businessProfilesTable.subscriptionPlan })
          .from(businessProfilesTable)
          .where(eq(businessProfilesTable.userId, userId));
        const isProUser = profileData?.subscriptionStatus === "active" && (profileData?.subscriptionPlan === "monthly_pro" || profileData?.subscriptionPlan === "monthly_elite");
        if (!isProUser) {
          res.status(403).json({ error: "PRO_REQUIRED", message: "This template requires an active Pro or Elite subscription" });
          return;
        }
      }
    }

    if (body.clientData !== undefined) {
      updates.clientData = body.clientData;
      updates.clientId = await ensureClientForQuote(userId, body.clientData);
      const fromClient = normalizeProvince(body.clientData.province);
      if (fromClient) updates.province = fromClient;
    }

    // Phase 0 fields are not in the generated UpdateQuoteBody (which strips
    // unknown keys), so they are validated here; the schedule's shape by its own schema below.
    const extras = z.object({ province: z.string().max(40).nullable().optional(), paymentSchedule: z.unknown().optional() }).safeParse(req.body);
    if (!extras.success) {
      res.status(400).json({ error: "Invalid province code", details: extras.error });
      return;
    }
    const rawBody = extras.data;
    if (rawBody.province !== undefined) {
      const p = rawBody.province === null ? null : normalizeProvince(rawBody.province);
      if (rawBody.province !== null && !p) {
        res.status(400).json({ error: "Invalid province code" });
        return;
      }
      updates.province = p;
    }
    if (rawBody.paymentSchedule !== undefined) {
      if (rawBody.paymentSchedule === null) {
        updates.paymentSchedule = null;
      } else {
        const ps = paymentScheduleSchema.safeParse(rawBody.paymentSchedule);
        if (!ps.success) {
          res.status(400).json({ error: "Invalid payment schedule", details: ps.error });
          return;
        }
        const totalForCheck = body.totale !== undefined ? Number(body.totale) : Number(existing.totale);
        const problem = validatePaymentSchedule(ps.data, totalForCheck);
        if (problem) {
          res.status(400).json({ error: problem });
          return;
        }
        updates.paymentSchedule = { ...ps.data, derived: false };
        // Keep the human-readable terms (used by PDFs/emails) in sync unless
        // the caller is explicitly editing the text in the same request.
        if (body.condizioniPagamento === undefined) updates.condizioniPagamento = paymentScheduleToText(ps.data);
      }
    } else if (body.condizioniPagamento !== undefined && existing.paymentSchedule?.derived !== false) {
      // Free-text edit with no hand-edited schedule: drop the cached one so
      // it is re-derived from the new text on read.
      updates.paymentSchedule = null;
    }
    if (body.descrizioneGenerale !== undefined) updates.descrizioneGenerale = body.descrizioneGenerale;
    if (body.items !== undefined) updates.items = body.items;
    if (body.capitoli !== undefined) updates.capitoli = body.capitoli as QuoteChapter[];
    if (body.sconto !== undefined) updates.sconto = body.sconto as QuoteDiscount | null;
    if (body.condizioniPagamento !== undefined) updates.condizioniPagamento = body.condizioniPagamento;
    if (body.titoloPreventivoRiga1 !== undefined) updates.titoloPreventivoRiga1 = body.titoloPreventivoRiga1 ?? null;
    if (body.titoloPreventivoRiga2 !== undefined) updates.titoloPreventivoRiga2 = body.titoloPreventivoRiga2 ?? null;
    if (body.note !== undefined) updates.note = body.note;
    if (body.status !== undefined) updates.status = body.status;
    if (body.subtotale !== undefined) updates.subtotale = String(body.subtotale);
    if (body.ivaPercentuale !== undefined) updates.ivaPercentuale = String(body.ivaPercentuale);
    if (body.ivaValore !== undefined) updates.ivaValore = String(body.ivaValore);
    if (body.totale !== undefined) updates.totale = String(body.totale);
    if (body.templateId !== undefined) updates.templateId = body.templateId;

    // Phase 83: a body that names no known field left `updates` empty, and
    // Drizzle throws on `.set({})` — the caller got a 500 for what is a bad
    // request. (Found by the role suite sending `{ titolo }`, which this
    // route has never accepted.)
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Invalid request", message: "No updatable fields in the request body" });
      return;
    }

    const [updated] = await db
      .update(quotesTable)
      .set(updates)
      .where(eq(quotesTable.id, id))
      .returning();

    res.json(serializeQuote(updated!));
  } catch (err) {
    req.log.error({ err }, "Error updating quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/quotes/:id
router.delete("/quotes/:id", requireAuth, requirePermission("quotes", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = DeleteQuoteParams.parse(req.params);

    const [existing] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(quotesTable).where(eq(quotesTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error deleting quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/archive
router.post("/quotes/:id/archive", requireAuth, requirePermission("quotes", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = DeleteQuoteParams.parse(req.params);
    const [existing] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    const [updated] = await db
      .update(quotesTable)
      .set({ archivedAt: new Date(), archivedByName: getUserName(res) })
      .where(eq(quotesTable.id, id))
      .returning();
    res.json(serializeQuote(updated));
  } catch (err) {
    req.log.error({ err }, "Error archiving quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/restore
router.post("/quotes/:id/restore", requireAuth, requirePermission("quotes", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = DeleteQuoteParams.parse(req.params);
    const [existing] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    const [updated] = await db
      .update(quotesTable)
      .set({ archivedAt: null, archivedByName: null })
      .where(eq(quotesTable.id, id))
      .returning();
    res.json(serializeQuote(updated));
  } catch (err) {
    req.log.error({ err }, "Error restoring quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/generate-pdf
router.post("/quotes/:id/generate-pdf", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = GenerateQuotePdfParams.parse(req.params);

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    // Draft quotes get watermark; unlocked quotes use the plan's hasWatermark setting.
    const planHasWatermark = (plan: string | null | undefined) =>
      !plan || plan === "monthly_starter" || plan === "oneshot_watermark";

    // Trial auto-unlock
    let effectiveStatus = quote.status;
    if (quote.status === "draft" && profile?.subscriptionStatus !== "active") {
      if (await tryTrialUnlock(quote, profile ?? null, req.log)) {
        effectiveStatus = "unlocked";
      } else {
        res.status(402).json({ error: "Payment required", code: "trial_expired" });
        return;
      }
    }

    const isProOrElite = profile?.subscriptionStatus === "active" &&
      (profile?.subscriptionPlan === "monthly_pro" || profile?.subscriptionPlan === "monthly_elite");
    const unlockedPlan = effectiveStatus === "unlocked" && quote.status === "draft"
      ? "trial"
      : quote.unlockedWithPlan;
    const withWatermark = isProOrElite
      ? false
      : (effectiveStatus !== "unlocked" || planHasWatermark(unlockedPlan));

    // Generate server-side PDF with pdfmake
    const pdfBuffer = await generateQuotePdfBuffer(quote, profile ?? null, withWatermark);

    // Upload to Object Storage
    const dateStr = new Date().toISOString().split("T")[0];
    const numero = quote.numeroPreventivoData?.replace(/\//g, "_") || quote.id.slice(0, 4).toUpperCase();
    const cleanNumero = numero.replace(/[^a-zA-Z0-9_\-.]/g, "_");
    const subPath = `quote-pdfs/${userId}/${dateStr}/${cleanNumero}.pdf`;
    const pdfPath = await objectStorage.uploadObjectBuffer({
      subPath,
      buffer: pdfBuffer,
      contentType: "application/pdf",
    });

    // Track first download time (lock editing after this point)
    if (!quote.pdfDownloadedAt) {
      await db
        .update(quotesTable)
        .set({ pdfDownloadedAt: new Date() })
        .where(eq(quotesTable.id, id));
    }

    res.json({ pdfUrl: pdfPath, isDraft: withWatermark });
  } catch (err) {
    req.log.error({ err }, "Error generating PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/send-pdf-email — send quote PDF to client via email
router.post("/quotes/:id/send-pdf-email", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;
    const parsed = SendQuotePdfEmailBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Recipient email address is required" });
      return;
    }
    const { toEmail, clientName } = parsed.data;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }
    if (quote.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));

    // Sending is what makes a quote leave the account, so it unlocks the
    // quote exactly like a PDF download does: subscribers unlock with their
    // plan, trial users spend one trial download, everyone else must pay.
    // Only a draft is ever touched — an accepted quote stays accepted.
    if (quote.status === "draft" || quote.status === "pending_payment") {
      if (profile?.subscriptionStatus === "active") {
        await db
          .update(quotesTable)
          .set({ status: "unlocked", unlockedWithPlan: profile.subscriptionPlan ?? null })
          .where(eq(quotesTable.id, id));
        quote.status = "unlocked";
      } else if (await tryTrialUnlock(quote, profile ?? null, req.log)) {
        quote.status = "unlocked";
      } else {
        res.status(402).json({ error: "Unlock the quote to send it via email", code: "PAYMENT_REQUIRED" });
        return;
      }
    } else if (quote.status !== "unlocked" && quote.status !== "accepted") {
      res.status(402).json({ error: "Unlock the quote to send it via email", code: "PAYMENT_REQUIRED" });
      return;
    }

    // Generate clean PDF (never watermark for email)
    const pdfBuffer = await generateQuotePdfBuffer(quote, profile ?? null, false);
    const lang = await quoteLanguageFor(quote);

    const companyName = (quote.companySnapshot as QuoteCompanySnapshot | null)?.companyName || profile?.companyName || "Your company";
    const numeroData = quote.numeroPreventivoData || `${qt("quoteNo", lang)} ${quote.id.slice(0, 4).toUpperCase()} - ${fmtQuoteDate(new Date(), lang)}`;
    const totale = Number(quote.totale);
    const totaleFormatted = fmtQty(totale, lang);
    const filename = `${lang === "fr" ? "Soumission" : "Quote"} ${numeroData.replace(/\//g, "_")}.pdf`;

    await sendQuotePdfEmail({
      toEmail,
      userId,
      companyName,
      clientName: clientName || (quote.clientData as QuoteClientData)?.nome || "",
      lang,
      quoteNumber: numeroData,
      totale: totaleFormatted,
      pdfBuffer,
      filename,
      companyLogoUrl: profile?.logoUrl ?? null,
      replyTo: profile?.email ?? null,
      publicUrl: quote.status === "unlocked" || quote.status === "accepted" ? `${getBaseUrl()}/p/${quote.id}` : null,
    });

    // Phase 95: the first person to send it is credited if the client accepts.
    const sender = currentActorId();
    if (sender && !quote.sentByUserId) {
      await db.update(quotesTable).set({ sentByUserId: sender }).where(and(eq(quotesTable.id, quote.id), isNull(quotesTable.sentByUserId)));
    }

    // Phase 21: start the follow-up reminder sequence, unless the quote is
    // already accepted or the client has unsubscribed from reminders.
    if (quote.status !== "accepted" && !quote.unsubscribedAt) {
      // The follow-ups go to clientData.email, which the quote forms never
      // collect — remember the address the contractor just typed, or the
      // whole sequence dies with `no_email` (Phase 66).
      const existingClient = (quote.clientData as QuoteClientData | null) ?? null;
      const clientData =
        existingClient && !existingClient.email ? { ...existingClient, email: toEmail.trim() } : existingClient;
      await db
        .update(quotesTable)
        .set({
          sentAt: quote.sentAt ?? new Date(),
          followUpStage: 0,
          nextFollowUpAt: stageDueAt(quoteFollowupDays(profile?.automationSettings), 0),
          ...(clientData && clientData !== existingClient ? { clientData } : {}),
        })
        .where(eq(quotesTable.id, quote.id));
      if (clientData !== existingClient) await linkQuoteToClient({ ...quote, clientData }, profile?.province ?? null, { applyDefaultTerms: false });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error sending quote PDF email");
    const message = err instanceof Error ? err.message : "Error sending the email";
    res.status(500).json({ error: message });
  }
});

// POST /api/quotes/:id/duplicate — clone a quote as a new draft
router.post("/quotes/:id/duplicate", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;

    const [original] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!original) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (original.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [newQuote] = await db.transaction(async (tx) => {
      // Row lock the user's business profile record to prevent concurrent quote creation
      await tx.execute(sql`SELECT user_id FROM ${businessProfilesTable} WHERE user_id = ${userId} FOR UPDATE`);

      const newNumeroPreventivoData = await generateNumeroPreventivo(userId);

      return await tx
        .insert(quotesTable)
        .values({
          userId,
          createdByUserId: currentActorId(),
          rawInput: original.rawInput,
          descrizioneGenerale: original.descrizioneGenerale,
          companySnapshot: (original.companySnapshot as QuoteCompanySnapshot | null) ?? null,
          items: (Array.isArray(original.items) ? original.items : []) as QuoteItem[],
          capitoli: (Array.isArray(original.capitoli) ? original.capitoli : []) as QuoteChapter[],
          sconto: (original.sconto as QuoteDiscount | null) ?? null,
          condizioniPagamento: Array.isArray(original.condizioniPagamento) ? original.condizioniPagamento : [],
          titoloPreventivoRiga1: original.titoloPreventivoRiga1,
          titoloPreventivoRiga2: original.titoloPreventivoRiga2,
          numeroPreventivoData: newNumeroPreventivoData,
          subtotale: original.subtotale,
          ivaPercentuale: original.ivaPercentuale,
          ivaValore: original.ivaValore,
          totale: original.totale,
          note: original.note,
          status: "draft",
          pdfUrl: null,
          pdfDownloadedAt: null,
          templateId: original.templateId ?? "standard",
        })
        .returning();
    });

    await linkQuoteToClient(newQuote!, null, { applyDefaultTerms: false });

    res.status(201).json(serializeQuote(newQuote));
  } catch (err) {
    req.log.error({ err }, "Error duplicating quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/regenerate — re-run AI on an existing quote
router.post("/quotes/:id/regenerate", requireAuth, requirePermission("quotes", "edit"), aiCallLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;
    const body = RegenerateQuoteBody.parse(req.body);

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (quote.pdfDownloadedAt) {
      res.status(409).json({ error: "Cannot regenerate a quote that has already been downloaded" });
      return;
    }

    const inputText = body.newDescription?.trim() || quote.rawInput;
    const keepClientData = body.keepClientData !== false;

    const currentClientData = keepClientData
      ? (quote.clientData as QuoteClientData)
      : undefined;

    let userMessage = inputText;
    if (currentClientData?.nome) {
      userMessage = `Client data (do NOT regenerate, use these exact values):
- Name/Company Name: ${currentClientData.nome}
- Address: ${currentClientData.indirizzo || ""}

Job description: ${inputText}`;
    }

    // Fetch recent quotes and catalog in parallel for pricing context
    const [recentQuotes, catalogItems] = await Promise.all([
      db.select({ rawInput: quotesTable.rawInput, capitoli: quotesTable.capitoli, totale: quotesTable.totale })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId))
        .orderBy(desc(quotesTable.createdAt))
        .limit(5),
      db.select()
        .from(priceCatalogItemsTable)
        .where(inArray(priceCatalogItemsTable.userId, await catalogOwnerIds(userId)))
        .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome),
    ]);

    const pastContext = buildPastQuotesContext(recentQuotes as { rawInput: string; capitoli: unknown; totale: string }[]);

    const catalogContext = catalogItems.length > 0
      ? `USER'S CUSTOM PRICE LIST (use these prices as the PRIORITY reference when the work items match — adjust quantities to the requested job):
${catalogItems
  .map(item => `  - ${item.nome} (${item.um}): $${Number(item.prezzoUnitario).toFixed(2)}/unit${item.categoria ? ` [${item.categoria}]` : ""}${item.note ? ` — ${item.note}` : ""}`)
  .join("\n")}

When you use a price-list item, apply the exact unit price or a very close one. For work items not present in the price list, use standard market prices. Write all output text in English.`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: "system", content: AI_PROMPT },
        { role: "system", content: REGIONAL_PRICING_GUIDANCE },
        { role: "system", content: DESCRIPTION_QUALITY_GUIDANCE },
        ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
        ...(pastContext ? [{ role: "system" as const, content: pastContext }] : []),
        { role: "user", content: userMessage },
      ],
    });

    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? 0;
    const modelUsed = completion.model || "gpt-4o-mini";

    const isMini = modelUsed.includes("mini");
    const isGpt4 = modelUsed.includes("gpt-4o") && !isMini;
    const pCostRate = isMini ? 0.00000015 : isGpt4 ? 0.000005 : 0.00000059;
    const cCostRate = isMini ? 0.00000060 : isGpt4 ? 0.000015 : 0.00000079;
    const apiCost = ((promptTokens * pCostRate) + (completionTokens * cCostRate)).toFixed(6);

    const content = completion.choices[0]?.message?.content ?? "{}";
    let aiData: {
      titolo_riga1?: string;
      titolo_riga2?: string;
      numero_preventivo_data?: string;
      cliente?: { nome?: string; indirizzo?: string };
      descrizione_generale?: string;
      capitoli?: Array<{
        lettera?: string;
        titolo?: string;
        osservazione?: string;
        voci?: Array<{
          descrizione?: string;
          um?: string;
          quantita?: number;
          prezzo_unitario?: number;
          totale?: number;
        }>;
        subtotale?: number;
      }>;
      sconto?: { percentuale?: number; importo_scontato?: number } | null;
      condizioni_pagamento?: string[];
      subtotale?: number;
      iva_percentuale?: number;
      iva_valore?: number;
      totale?: number;
      note?: string;
    };

    try {
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      aiData = JSON.parse(cleaned);
    } catch {
      req.log.error({ content }, "Failed to parse AI JSON in regenerate");
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    // NOTE: totals are recomputed from quantita * prezzoUnitario, not trusted from
    // the AI's own top-level fields — see the identical comment on the POST /api/quotes
    // handler above for why (the model can echo the prompt's placeholder "0" values).
    let capitoli: QuoteChapter[] = (aiData.capitoli ?? []).map((cap) => {
      let capSubtotale = 0;
      const voci = (cap.voci ?? []).map((v) => {
        const quantita = Number(v.quantita ?? 0);
        const prezzoUnitario = Number(v.prezzo_unitario ?? 0);
        const totale = Number((quantita * prezzoUnitario).toFixed(2));
        capSubtotale += totale;
        return {
          descrizione: v.descrizione ?? "",
          um: v.um ?? "a.c.",
          quantita,
          prezzoUnitario,
          totale,
        };
      });
      return {
        lettera: cap.lettera ?? "A",
        titolo: cap.titolo ?? "",
        osservazione: cap.osservazione ?? "Standard item",
        voci,
        subtotale: Number(capSubtotale.toFixed(2)),
      };
    });

    if (quote.templateId === "arosio" || quote.templateId === "mariagrazia") {
      capitoli = await enrichVociDescrizioni(capitoli);
    }

    const calculatedSubtotale = Number(capitoli.reduce((sum, c) => sum + c.subtotale, 0).toFixed(2));

    const scontoRaw = aiData.sconto;
    const scontoPercentuale = scontoRaw ? Number(scontoRaw.percentuale ?? 0) : 0;
    // Phase 67: `importoScontato` is the *discounted subtotal* everywhere the
    // quote is rendered (PDFs, HTML, dashboard editor) — not the discount
    // amount. Storing the amount here made a 10 % discount print as "−$9,000".
    const discountAmount = scontoPercentuale > 0 ? Number((calculatedSubtotale * scontoPercentuale / 100).toFixed(2)) : 0;
    const importoScontato = Number((calculatedSubtotale - discountAmount).toFixed(2));
    const sconto: QuoteDiscount | null =
      scontoPercentuale > 0 ? { percentuale: scontoPercentuale, importoScontato } : null;

    const condizioniPagamento = aiData.condizioni_pagamento ?? quote.condizioniPagamento ?? [];
    const subtotale = calculatedSubtotale;
    const ivaPercentuale = resolveQuoteTaxRate(aiData.iva_percentuale, quote.province ?? (quote.clientData as QuoteClientData | null)?.province);
    const imponibile = importoScontato;
    const ivaValore = Number((imponibile * ivaPercentuale / 100).toFixed(2));
    const totale = Number((imponibile + ivaValore).toFixed(2));

    const resolvedClientData: QuoteClientData = keepClientData && currentClientData?.nome
      ? currentClientData
      : { nome: aiData.cliente?.nome ?? "", indirizzo: aiData.cliente?.indirizzo ?? "" };

    const [updated] = await db
      .update(quotesTable)
      .set({
        rawInput: inputText,
        clientData: resolvedClientData,
        descrizioneGenerale: aiData.descrizione_generale ?? "",
        items: [],
        capitoli,
        sconto,
        condizioniPagamento,
        titoloPreventivoRiga1: aiData.titolo_riga1 ?? quote.titoloPreventivoRiga1,
        titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
        numeroPreventivoData: quote.numeroPreventivoData,
        subtotale: subtotale.toFixed(2),
        ivaPercentuale: ivaPercentuale.toFixed(3),
        ivaValore: ivaValore.toFixed(2),
        totale: totale.toFixed(2),
        note: aiData.note ?? quote.note,
        promptTokens,
        completionTokens,
        totalTokens,
        modelUsed,
        apiCost,
      })
      .where(eq(quotesTable.id, id))
      .returning();

    res.json(serializeQuote(updated!));
  } catch (err) {
    req.log.error({ err }, "Error regenerating quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/upgrade-to-capitolato — rewrite descriptions in professional capitolato style (Pro only)
router.post("/quotes/:id/upgrade-to-capitolato", requireAuth, requirePermission("quotes", "edit"), aiCallLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }
    if (quote.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    // Check Pro plan
    const [profile] = await db
      .select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    const isProUser = profile?.subscriptionStatus === "active" && (profile?.subscriptionPlan === "monthly_pro" || profile?.subscriptionPlan === "monthly_elite");
    if (!isProUser) {
      res.status(403).json({ error: "Pro or Elite plan required", code: "PRO_REQUIRED" });
      return;
    }

    const capitoli = Array.isArray(quote.capitoli) ? (quote.capitoli as QuoteChapter[]) : [];
    if (capitoli.length === 0) {
      res.status(400).json({ error: "The quote has no chapters to enrich" });
      return;
    }

    const capitolatoPrompt = `You are an expert writer of professional DETAILED TECHNICAL SPECIFICATIONS for the Canadian construction and trades sector.

For each item in the quote, rewrite the "descrizione" (description) in professional DETAILED TECHNICAL SPECIFICATION style, with AT LEAST 4-6 technical lines in formal English:
- Describe precisely the operations performed and the execution methods (work sequence, techniques, order of phases)
- Specify materials, products, and components with technical characteristics and applicable Canadian/North American standards (CSA, NBC/National Building Code, provincial codes, ULC, etc.)
- State the quality, strength, class, or certification requirements for the materials
- Explicitly state what is INCLUDED in the item (e.g. "Includes loading, transport, disposal at an authorized landfill...")
- State any relevant EXCLUSIONS and/or costs to be borne by the client (e.g. "Excludes work related to...")
- Keep unchanged: um, quantita, prezzo_unitario, totale, lettera, titolo, osservazione, subtotale
- Write all output text in English

FUNDAMENTAL RULE: return ONLY valid JSON with this exact structure (no additional text):
{
  "capitoli": [
    {
      "lettera": "A",
      "titolo": "...",
      "osservazione": "...",
      "voci": [
        {
          "descrizione": "Professional technical specification description here...",
          "um": "...",
          "quantita": 0,
          "prezzo_unitario": 0,
          "totale": 0
        }
      ],
      "subtotale": 0
    }
  ]
}`;

    const inputCapitoli = JSON.stringify(capitoli.map(cap => ({
      lettera: cap.lettera,
      titolo: cap.titolo,
      osservazione: cap.osservazione,
      voci: cap.voci.map(v => ({
        descrizione: v.descrizione,
        um: v.um,
        quantita: v.quantita,
        prezzo_unitario: v.prezzoUnitario,
        totale: v.totale,
      })),
      subtotale: cap.subtotale,
    })));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: capitolatoPrompt },
        { role: "user", content: `Here is the quote to enrich in detailed-specification style:\n${inputCapitoli}` },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let aiData: { capitoli?: Array<{ lettera?: string; titolo?: string; osservazione?: string; voci?: Array<{ descrizione?: string; um?: string; quantita?: number; prezzo_unitario?: number; totale?: number }>; subtotale?: number }> };

    try {
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      aiData = JSON.parse(cleaned);
    } catch {
      req.log.error({ content }, "Failed to parse AI JSON in upgrade-to-capitolato");
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    // Validate: AI must return exactly the same number of chapters and voci counts
    const aiCapitoli = aiData.capitoli ?? [];
    if (aiCapitoli.length !== capitoli.length) {
      req.log.error({ aiCount: aiCapitoli.length, origCount: capitoli.length }, "AI chapter count mismatch in upgrade-to-capitolato");
      res.status(500).json({ error: "Invalid AI response: chapter structure doesn't match" });
      return;
    }
    for (let i = 0; i < aiCapitoli.length; i++) {
      const aiVoci = aiCapitoli[i]?.voci ?? [];
      const origVoci = capitoli[i]?.voci ?? [];
      if (aiVoci.length !== origVoci.length) {
        req.log.error({ chapIdx: i, aiVociCount: aiVoci.length, origVociCount: origVoci.length }, "AI voci count mismatch");
        res.status(500).json({ error: "Invalid AI response: item count doesn't match in chapter " + (i + 1) });
        return;
      }
    }

    // Build updated chapters: ONLY take `descrizione` from AI; preserve all economic data from originals
    const updatedCapitoli: QuoteChapter[] = capitoli.map((orig, i) => {
      const aiCap = aiCapitoli[i]!;
      return {
        lettera: orig.lettera,
        titolo: orig.titolo,
        osservazione: orig.osservazione,
        voci: orig.voci.map((origV, vi) => ({
          descrizione: aiCap.voci?.[vi]?.descrizione ?? origV.descrizione,
          um: origV.um,
          quantita: origV.quantita,
          prezzoUnitario: origV.prezzoUnitario,
          totale: origV.totale,
        })),
        subtotale: orig.subtotale,
      };
    });

    const [updated] = await db
      .update(quotesTable)
      .set({ capitoli: updatedCapitoli, capitolatoPro: true })
      .where(eq(quotesTable.id, id))
      .returning();

    res.json(serializeQuote(updated!));
  } catch (err) {
    req.log.error({ err }, "Error upgrading quote to capitolato");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/generate-pdf-pro — server-side PDF for capitolato quotes (Pro only)
router.post("/quotes/:id/generate-pdf-pro", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }
    if (quote.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!quote.capitolatoPro) {
      res.status(400).json({ error: "The quote hasn't been enriched into detailed-specification format" });
      return;
    }

    // Check Pro plan
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    const isProUser = profile?.subscriptionStatus === "active" && (profile?.subscriptionPlan === "monthly_pro" || profile?.subscriptionPlan === "monthly_elite");
    if (!isProUser) {
      res.status(403).json({ error: "Pro or Elite plan required", code: "PRO_REQUIRED" });
      return;
    }

    // Generate the PDF
    const pdfBuffer = await generateCapitolatoPdfBuffer(quote, profile ?? null);

    // Upload to Object Storage
    const subPath = `capitolato-pdfs/${userId}/${randomUUID()}.pdf`;
    const pdfPath = await objectStorage.uploadObjectBuffer({
      subPath,
      buffer: pdfBuffer,
      contentType: "application/pdf",
    });

    // Persist the URL on the quote
    await db
      .update(quotesTable)
      .set({ capitolatoPdfUrl: pdfPath })
      .where(eq(quotesTable.id, id));

    res.json({ pdfUrl: pdfPath, quoteId: id });
  } catch (err) {
    req.log.error({ err }, "Error generating Pro PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});


// POST /api/quotes/manual — create a manually-built quote (no AI)
router.post("/quotes/manual", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = ManualQuoteBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: manualQuoteBodyError(body.error), details: body.error });
      return;
    }
    const result = await createManualQuote(userId, body.data);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, details: result.details, code: result.status === 429 ? "QUOTA_EXCEEDED" : undefined });
      return;
    }
    res.status(201).json(serializeQuote(result.quote));
  } catch (err) {
    req.log.error({ err }, "Error creating manual quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/suggest-item-description — AI helper for manual quote items
router.post("/quotes/suggest-item-description", requireAuth, requirePermission("quotes", "edit"), aiCallLimiter, async (req, res) => {
  try {
    const parsed = SuggestItemDescriptionBody.extend({ brief: z.string().trim().min(1).max(1000), context: z.string().max(4000).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "brief is required" });
      return;
    }
    const { brief, context } = parsed.data;

    const systemPrompt = `Sei un esperto di preventivi per l'edilizia e artigianato italiano.
Genera UNA sola descrizione professionale e tecnica per una voce di lavoro/materiale da inserire in un computo metrico.
La descrizione deve essere precisa, professionale e in italiano. Massimo 2 righe. Solo la descrizione, nessun'altra spiegazione.`;

    const userMsg = context
      ? `Progetto: ${context}\nVoce di lavoro: ${brief}`
      : `Voce di lavoro: ${brief}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      max_tokens: 150,
      temperature: 0.4,
    });

    const description = completion.choices[0]?.message?.content?.trim() ?? brief;
    res.json({ description });
  } catch (err) {
    req.log.error({ err }, "Error suggesting item description");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enriches voce descriptions in both deterministic paths with AI-generated capitolato-style text.
// Prices, quantities, and UMs are NEVER touched — only `descrizione` is expanded.
// Falls back to original descriptions silently if the AI call fails.
async function enrichVociDescrizioni<T extends {
  lettera: string;
  titolo: string;
  voci: Array<{ descrizione: string; um: string } & Record<string, unknown>>;
}>(chapters: T[]): Promise<T[]> {
  const flat: Array<{ ci: number; vi: number; i: number; cap: string; t: string; um: string }> = [];
  for (let ci = 0; ci < chapters.length; ci++) {
    for (let vi = 0; vi < chapters[ci].voci.length; vi++) {
      flat.push({
        ci, vi, i: flat.length,
        cap: `${chapters[ci].lettera}. ${chapters[ci].titolo}`,
        t: chapters[ci].voci[vi].descrizione,
        um: chapters[ci].voci[vi].um,
      });
    }
  }
  if (flat.length === 0) return chapters;

  const ENRICH_PROMPT = `You are a Canadian construction technician expert in detailed technical specifications.
For each item you receive: index (i), chapter (cap), short title (t), unit of measure (um).
Generate a professional description in English, in DETAILED TECHNICAL SPECIFICATION style:
- First line: exact copy of the short title (t)
- Second line: concise technical description (1-2 lines) of the operations, materials, work included, and applicable standards
Use "\\n" as the separator between the title and the description.
OUTPUT: JSON array only, in the format [{"i":0,"d":"Title\\nTechnical description..."},...]
VERY IMPORTANT: output ONLY pure JSON, no explanation, no markdown.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: ENRICH_PROMPT },
        { role: "user", content: JSON.stringify(flat.map(f => ({ i: f.i, cap: f.cap, t: f.t, um: f.um }))) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const enriched: Array<{ i: number; d: string }> = JSON.parse(cleaned);
    const result: T[] = chapters.map(c => ({ ...c, voci: c.voci.map(v => ({ ...v })) }));
    for (const { i, d } of enriched) {
      const f = flat[i];
      if (f && d) {
        (result[f.ci].voci[f.vi] as { descrizione: string }).descrizione = d;
      }
    }
    return result;
  } catch {
    return chapters;
  }
}

// Returns a professional English description for a chapter (capitolo) based on its title.
// The lookup keys stay in Italian because they're matched against chapter titles parsed
// from source documents (which may still use Italian terminology); the displayed
// description values are in English.
// Used in deterministic paths to populate osservazione instead of the generic "Standard item".
function getChapterDescription(titolo: string): string {
  const t = titolo.toLowerCase().trim();
  const MAP: Record<string, string> = {
    demolizioni: "Includes all demolition work, removal of existing structures, and disposal of debris",
    costruzioni: "Includes construction work, structural framing, reinforced concrete pours, and masonry work",
    giardino: "Includes landscaping, garden, and surrounding grounds work",
    muratura: "Includes masonry work, infill walls, closures, and partition walls",
    generale: "Includes general-purpose work, equipment rentals, temporary works, and incidental costs",
    finiture: "Includes surface finishing, painting, and touch-up work",
    pavimentazioni: "Includes installation of flooring, floor coverings, and baseboards",
    rivestimenti: "Includes installation of vertical and horizontal wall coverings",
    impianti: "Includes mechanical systems: plumbing, sanitary, and electrical",
    strutture: "Includes structural work in reinforced concrete and steel",
    impermeabilizzazioni: "Includes waterproofing and water protection work",
    isolamenti: "Includes thermal and acoustic insulation work",
    infissi: "Includes supply and installation of windows, frames, and doors",
    tinteggiature: "Includes painting, coating, and surface treatment work",
    verniciature: "Includes painting, coating, and protective surface treatment work",
    falegnameria: "Includes carpentry work, woodwork, and furnishing accessories",
    varie: "Includes miscellaneous work and incidental items not classified elsewhere",
    ponteggi: "Includes installation, rental, and dismantling of scaffolding and temporary works",
    scavi: "Includes excavation, earthmoving, and site grading work",
    fondazioni: "Includes foundation work and ground consolidation",
    intonaci: "Includes plastering and skim-coating of interior and exterior surfaces",
    coperture: "Includes roofing, roof structure, and waterproofing work",
    serramenti: "Includes supply and installation of windows/doors and solar shading",
    controsoffitti: "Includes installation of drop ceilings and furring walls",
    ripristini: "Includes repair, restoration, and code-compliance upgrade work",
    noleggi: "Includes rental of machinery, equipment, and work vehicles",
    cantiere: "Includes job-site setup, fencing, and safety measures",
    cappotto: "Includes installation of exterior insulation (EIFS) and associated finishing",
    idraulico: "Includes the plumbing, sanitary, and water distribution system",
    elettrico: "Includes the electrical system, lighting, and distribution panels",
  };
  if (MAP[t]) return MAP[t];
  for (const [key, desc] of Object.entries(MAP)) {
    if (t.includes(key)) return desc;
  }
  const cap = titolo.charAt(0).toUpperCase() + titolo.slice(1).toLowerCase();
  return `Includes ${cap.toLowerCase()} work as per the attached bill of quantities`;
}

// Fallback price estimation for tabular computo metrico voci (Brianza/Milano market rates 2026).
// NOTE: the keyword table below matches against Italian-language line-item descriptions
// that may still appear in parsed source documents, so the keywords and EUR-calibrated
// figures are intentionally left as-is (translating them would break the matching).
// Uses earliest-match strategy: the keyword appearing FIRST in the description wins,
// preventing secondary words (e.g. "scalini" in a tiling description) from hijacking the price.
function estimatePriceForVoce(categoria: string, descrizione: string, um: string): number {
  const desc = descrizione.toLowerCase();
  const cat = categoria.toLowerCase();
  const unit = um.toLowerCase();

  // Priority-ordered keyword → price map (Brianza/Milano market rates 2026)
  // Order matters: put more specific/primary terms before generic ones.
  // The keyword that appears EARLIEST in the description wins (not first in this list).
  const keywordPrices: Array<[string, number]> = [
    // ── Demolizioni ─────────────────────────────────────────────────────────
    ["scavo", 85],
    ["scrostamento", 32],
    ["rimozione marciapiede", 38],
    ["rimozione", 38],
    ["demolizione solaio", 350],
    ["demolizione scala", 400],
    ["demolizione massetto", 48],
    ["demolizione tramezzi", 48],
    ["demolizione", 48],
    // ── Impermeabilizzazioni ─────────────────────────────────────────────────
    ["guaina impermeabile", 42],
    ["guaina", 40],
    ["impermeabilizzazione mapelastic", 55],
    ["impermeabilizzazione", 48],
    ["membrana bugnata", 24],
    ["membrana", 22],
    // ── Isolamento ───────────────────────────────────────────────────────────
    ["cappotto esterno", 80],
    ["cappotto", 78],
    ["polistirene espanso", 34],
    ["polistirene", 32],
    ["igloo", 65],
    ["vespaio", 75],
    ["barriera anti radon", 12],
    ["barriera", 12],
    // ── Intonaci e rasature ──────────────────────────────────────────────────
    ["intonachino ai silicati", 28],
    ["intonaco al grezzo", 40],
    ["intonaco civile", 45],
    ["intonaco", 42],
    ["rasatura", 22],
    ["ripristino intonaco", 48],
    ["ripristino", 48],
    // ── Pavimentazioni e rivestimenti ────────────────────────────────────────
    ["piastrellatura", 95],
    ["pavimentazione con piastrelle", 90],
    ["pavimentazione", 85],
    ["rivestimento gradini", 90],
    ["rivestimento", 75],
    ["zoccolatura", 32],
    ["zoccolino", 25],
    ["massetto", 38],
    // ── Strutture in c.a. ────────────────────────────────────────────────────
    ["soletta in c.a.", 140],
    ["soletta", 130],
    ["muretto di contenimento", 380],
    ["muretto in c.a.", 380],
    ["muretto", 320],
    ["getto in cls", 110],
    ["getto cls", 110],
    ["getto", 100],
    ["cls armato", 120],
    ["cls", 110],
    ["sottofondo", 38],
    // ── Gradini e scale ──────────────────────────────────────────────────────
    ["formazione n.", 1200],
    ["formazione marciapiede", 85],
    ["formazione scalini", 1800],
    ["formazione scala", 2200],
    ["formazione", 80],
    ["scalini in cemento", 1800],
    ["scalini in pietra", 2800],
    ["scalini", 1800],
    ["gradini", 1800],
    ["gradino", 400],
    // ── Ponteggi ─────────────────────────────────────────────────────────────
    ["noleggio ponteggio", 8],
    ["ponteggio", 18],
    ["noleggio", 10],
    // ── Facciate e gronde ─────────────────────────────────────────────────────
    ["sotto gronda", 55],
    ["grondaia in alluminio", 48],
    ["grondaia", 45],
    ["pluviale", 180],
    ["gocciolatoio", 30],
    // ── Serramenti e aperture ────────────────────────────────────────────────
    ["monoblocco", 1600],
    ["porta finestra", 1800],
    ["porta d'ingresso", 2200],
    ["apertura nuova porta", 900],
    ["porta", 1400],
    ["finestra", 900],
    ["davanzali e soglie", 280],
    ["davanzale", 260],
    ["soglie", 260],
    ["soglia", 260],
    ["architrave", 350],
    ["telaio", 600],
    ["chiusura vano", 450],
    ["chiusura porta", 450],
    ["chiusura", 400],
    ["adeguamento muratura", 350],
    // ── Tubazioni e drenaggi ─────────────────────────────────────────────────
    ["tubazione di drenaggio", 38],
    ["tubazione fognaria", 55],
    ["tubazione", 38],
    ["tnt", 12],
    ["colonna montante", 95],
    ["colonna", 90],
    ["rete fognaria", 60],
    ["scarico acque nere", 60],
    ["scarico acque meteoriche", 48],
    ["scarico", 45],
    ["canaletta", 65],
    ["pozzetto", 280],
    ["piletta", 180],
    // ── Rinterri e trasporti ─────────────────────────────────────────────────
    ["rinterro parziale", 28],
    ["rinterro con ciottoli", 35],
    ["rinterro", 28],
    ["trasporto", 18],
    // ── Balconi ──────────────────────────────────────────────────────────────
    ["sistemazione balconi", 3200],
    ["balcone", 3200],
    ["balconi", 3200],
    // ── Verniciature e trattamenti ───────────────────────────────────────────
    ["idropulizia", 22],
    ["trattamento passivizzante", 28],
    ["verniciatura con smalto", 420],
    ["verniciatura a spruzzo", 22],
    ["verniciatura", 380],
    ["pulizia e scartavetratura", 320],
    ["pulizia", 320],
    ["trattamento", 32],
    // ── Impianti ─────────────────────────────────────────────────────────────
    ["impianto elettrico", 65],
    ["impianto idraulico", 75],
    ["impianto riscaldamento", 3200],
    ["riscaldamento", 3200],
    ["caldaia", 2400],
    ["termosifoni", 90],
    ["elettrico", 65],
    ["idraulico", 75],
    // ── Muratura ─────────────────────────────────────────────────────────────
    ["mattoni uni", 65],
    ["mattoni semipieni", 65],
    ["mattoni", 60],
    ["muratura", 85],
    ["messa in sicurezza", 120],
    // ── Generico ─────────────────────────────────────────────────────────────
    ["opere", 65],
    ["lavori", 60],
    ["servizi", 55],
  ];

  // Find the keyword that appears EARLIEST in the description (earliest char position wins)
  let bestPrice: number | null = null;
  let bestPos = Infinity;

  for (const [key, price] of keywordPrices) {
    const pos = desc.indexOf(key);
    if (pos !== -1 && pos < bestPos) {
      bestPos = pos;
      bestPrice = price;
    }
  }

  if (bestPrice !== null) return bestPrice;

  // Category-based fallback
  if (cat.includes("demoliz")) return 45;
  if (cat.includes("costruz")) return 70;
  if (cat.includes("impiant")) return 450;
  if (cat.includes("finitur")) return 55;
  if (cat.includes("vernic")) return 400;
  if (cat.includes("falegn")) return 120;
  if (cat.includes("infiss")) return 1300;
  if (cat.includes("strutture")) return 150;
  if (cat.includes("muratura")) return 250;

  // Unit-based fallback
  if (unit === "mq" || unit === "m2") return 70;
  if (unit === "ml" || unit === "m") return 38;
  if (unit === "mc" || unit === "m3") return 65;
  if (unit === "n." || unit === "n" || unit === "nr") return 900;
  if (unit === "cpo" || unit === "corpo" || unit === "cad." || unit === "cad") return 1200;
  if (unit === "kg") return 5;
  if (unit === "ore" || unit === "h" || unit === "hh") return 55;
  if (unit === "a.c." || unit === "a.c" || unit === "ac") return 2500;

  return 80;
}

export { generateQuotePdfBuffer, generateCapitolatoPdfBuffer };
export default router;
