import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import multer from "multer";
import { db, quotesTable, quoteAttachmentsTable, businessProfilesTable, priceCatalogItemsTable, priceIntelligenceTable, uploadedDocumentsTable, quoteClientDataSchema, quoteCompanySnapshotSchema, quoteChapterSchema, paymentScheduleSchema, derivePaymentScheduleFromText, validatePaymentSchedule, paymentScheduleToText, normalizeProvince, getTaxProfile } from "@workspace/db";
import { getBaseUrl } from "../lib/baseUrl.js";
import { resolveQuoteTaxRate } from "../lib/tax.js";
import { eq, desc, count, sum, sql, and, avg } from "drizzle-orm";
import { getTrialStatus, PLANS } from "./payments.js";
import {
  UpdateQuoteBody,
  GetQuoteParams,
  UpdateQuoteParams,
  DeleteQuoteParams,
  GenerateQuotePdfParams,
  RegenerateQuoteBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { REGIONAL_PRICING_GUIDANCE, DESCRIPTION_QUALITY_GUIDANCE } from "../lib/generateQuoteFromText.js";
import type { QuoteChapter, QuoteChapterItem, QuoteDiscount, QuoteCompanySnapshot, QuoteClientData, QuoteItem } from "@workspace/db";
import { logger } from "../lib/logger.js";
import pdfmake from "pdfmake";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
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

type PdfMakeInstance = {
  fonts: Record<string, Record<string, string>>;
  createPdf(docDef: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};
let _pdfmakeInstance: PdfMakeInstance | null = null;
function getPdfmake(): PdfMakeInstance {
  if (_pdfmakeInstance) return _pdfmakeInstance;
  const lib = pdfmake as unknown as PdfMakeInstance;
  lib.fonts = {
    Roboto: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  };
  _pdfmakeInstance = lib;
  return lib;
}
import { ObjectStorageService } from "../lib/objectStorage.js";
import { generateNumeroPreventivo } from "../lib/quoteNumber.js";
import { sendQuotePdfEmail } from "../lib/email.js";
import { linkQuoteToClient, ensureClientForQuote } from "../lib/clients.js";
import { randomUUID } from "crypto";
import { extractFromPdf, extractFromDocx, extractFromXlsx } from "../lib/extractDocument.js";

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

function serializeQuote(q: QuoteRow, attachments?: AttachmentRow[]) {
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
    totale: tot,
    prezzoMinimo: Math.round(tot * 0.9 * 100) / 100,
    prezzoMassimo: Math.round(tot * 1.25 * 100) / 100,
    note: q.note,
    status: q.status,
    pdfUrl: q.pdfUrl ?? null,
    rawInput: q.rawInput,
    pdfDownloadedAt: q.pdfDownloadedAt?.toISOString() ?? null,
    capitolatoPro: q.capitolatoPro ?? false,
    capitolatoPdfUrl: q.capitolatoPdfUrl ?? null,
    templateId: q.templateId ?? "standard",
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
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

    const allStatusCounts = { draft: 0, unlocked: 0, pending_payment: 0 };
    let thisMonth = 0;
    let unlockedRevenue = 0;
    for (const q of allForStats) {
      if (q.status in allStatusCounts) {
        allStatusCounts[q.status as keyof typeof allStatusCounts]++;
      }
      if (q.createdAt >= thisMonthStart) thisMonth++;
      if (q.status === "unlocked") unlockedRevenue += Number(q.totale ?? 0);
    }

    const total = Number(statsResult[0]?.total ?? 0);
    const avgValue = total > 0 ? Number(statsResult[0]?.totalRevenue ?? 0) / total : 0;

    res.json({
      total,
      draft: allStatusCounts.draft,
      unlocked: allStatusCounts.unlocked,
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

// GET /api/quotes
router.get("/quotes", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const quotes = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId))
      .orderBy(desc(quotesTable.createdAt));
    res.json(quotes.map(q => serializeQuote(q)));
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

// POST /api/quotes  (multipart/form-data: rawInput, clientData?, companySnapshot?, images[])
router.post("/quotes", requireAuth, aiCallLimiter, imageUpload.array("images", 3), async (req, res) => {
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

    const rawInput = typeof req.body.rawInput === "string" ? req.body.rawInput.trim() : "";
    if (!rawInput) {
      res.status(400).json({ error: "rawInput is required" });
      return;
    }

    let misure: Record<string, string | number> | undefined;
    if (req.body.misure) {
      try {
        misure = typeof req.body.misure === "string" ? JSON.parse(req.body.misure) : req.body.misure;
      } catch (err) {
        req.log.warn({ err }, "Error parsing body.misure");
      }
    }

    const requestedTemplateId = typeof req.body.templateId === "string" ? req.body.templateId : "standard";
    const validTemplateIds = ["standard", "arosio", "mariagrazia"];
    const templateId = validTemplateIds.includes(requestedTemplateId) ? requestedTemplateId : "standard";

    const rawTargetTotal = req.body.targetTotalEur;
    const targetTotalEur: number | null =
      rawTargetTotal !== undefined && rawTargetTotal !== "" && !isNaN(Number(rawTargetTotal)) && Number(rawTargetTotal) > 0
        ? Number(rawTargetTotal)
        : null;

    let clientDataInput: QuoteClientData | undefined;
    if (req.body.clientData) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(req.body.clientData);
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
    if (req.body.companySnapshot) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(req.body.companySnapshot);
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
        .where(eq(priceCatalogItemsTable.userId, userId))
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

      const chaptersRaw = numberedData.sections.map((s, idx) => {
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
    const importoScontato = scontoPercentuale > 0 ? Number((calculatedSubtotale * scontoPercentuale / 100).toFixed(2)) : 0;
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
    const imponibile = Number((calculatedSubtotale - importoScontato).toFixed(2));
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
          ivaPercentuale: ivaPercentuale.toFixed(2),
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

    const attachments = await db
      .select()
      .from(quoteAttachmentsTable)
      .where(eq(quoteAttachmentsTable.quoteId, id));

    res.json(serializeQuote(quote, attachments));
  } catch (err) {
    req.log.error({ err }, "Error fetching quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/quotes/:id
router.put("/quotes/:id", requireAuth, async (req, res) => {
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
    // unknown keys), so they are validated here.
    const rawBody = req.body as Record<string, unknown>;
    if (rawBody.province !== undefined) {
      const p = rawBody.province === null ? null : normalizeProvince(String(rawBody.province));
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
router.delete("/quotes/:id", requireAuth, async (req, res) => {
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

// POST /api/quotes/:id/generate-pdf
router.post("/quotes/:id/generate-pdf", requireAuth, async (req, res) => {
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
      const trial = getTrialStatus(profile ?? null);
      if (trial.isTrialActive) {
        effectiveStatus = "unlocked";
        const updates: Partial<typeof businessProfilesTable.$inferSelect> = {
          trialDownloadsUsed: (profile?.trialDownloadsUsed ?? 0) + 1,
        };
        await Promise.all([
          db.update(quotesTable)
            .set({ status: "unlocked", unlockedWithPlan: "trial" })
            .where(eq(quotesTable.id, id)),
          db.update(businessProfilesTable)
            .set(updates)
            .where(eq(businessProfilesTable.userId, userId)),
        ]);
        req.log.info({ quoteId: id, userId }, "Quote auto-unlocked via trial");
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
router.post("/quotes/:id/send-pdf-email", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = req.params.id as string;
    const { toEmail, clientName } = req.body as { toEmail?: string; clientName?: string };

    if (!toEmail || !toEmail.includes("@")) {
      res.status(400).json({ error: "Recipient email address is required" });
      return;
    }

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }
    if (quote.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));

    // Only allow email for unlocked quotes or Pro/Elite users
    const isProOrElite = profile?.subscriptionStatus === "active" &&
      (profile?.subscriptionPlan === "monthly_pro" || profile?.subscriptionPlan === "monthly_elite");
    if (quote.status !== "unlocked" && !isProOrElite) {
      res.status(402).json({ error: "Unlock the quote to send it via email", code: "PAYMENT_REQUIRED" });
      return;
    }

    // Generate clean PDF (never watermark for email)
    const pdfBuffer = await generateQuotePdfBuffer(quote, profile ?? null, false);

    const companyName = (quote.companySnapshot as QuoteCompanySnapshot | null)?.companyName || profile?.companyName || "La tua azienda";
    const numeroData = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()} - ${new Date().toLocaleDateString("en-CA")}`;
    const totale = Number(quote.totale);
    const totaleFormatted = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totale);
    const filename = `Quote ${numeroData.replace(/\//g, "_")}.pdf`;

    await sendQuotePdfEmail({
      toEmail,
      companyName,
      clientName: clientName || (quote.clientData as QuoteClientData)?.nome || "Cliente",
      quoteNumber: numeroData,
      totale: totaleFormatted,
      pdfBuffer,
      filename,
      publicUrl: quote.status === "unlocked" || quote.status === "accepted" ? `${getBaseUrl()}/p/${quote.id}` : null,
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error sending quote PDF email");
    const message = err instanceof Error ? err.message : "Error sending the email";
    res.status(500).json({ error: message });
  }
});

// POST /api/quotes/:id/duplicate — clone a quote as a new draft
router.post("/quotes/:id/duplicate", requireAuth, async (req, res) => {
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
router.post("/quotes/:id/regenerate", requireAuth, aiCallLimiter, async (req, res) => {
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
        .where(eq(priceCatalogItemsTable.userId, userId))
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
    const importoScontato = scontoPercentuale > 0 ? Number((calculatedSubtotale * scontoPercentuale / 100).toFixed(2)) : 0;
    const sconto: QuoteDiscount | null =
      scontoPercentuale > 0 ? { percentuale: scontoPercentuale, importoScontato } : null;

    const condizioniPagamento = aiData.condizioni_pagamento ?? quote.condizioniPagamento ?? [];
    const subtotale = calculatedSubtotale;
    const ivaPercentuale = resolveQuoteTaxRate(aiData.iva_percentuale, quote.province ?? (quote.clientData as QuoteClientData | null)?.province);
    const imponibile = Number((calculatedSubtotale - importoScontato).toFixed(2));
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
        ivaPercentuale: ivaPercentuale.toFixed(2),
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
router.post("/quotes/:id/upgrade-to-capitolato", requireAuth, aiCallLimiter, async (req, res) => {
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
router.post("/quotes/:id/generate-pdf-pro", requireAuth, async (req, res) => {
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
    const subPath = `capitolato-pdfs/${randomUUID()}.pdf`;
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

type ProfileRow = typeof businessProfilesTable.$inferSelect | null;

function formatCad(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function generateQuoteHtml(
  quote: QuoteRow,
  withWatermark: boolean,
  profile: ProfileRow
): string {
  const templateId = (quote.templateId as string | null) ?? "standard";
  if (templateId === "arosio") return generateHtmlProfessionale(quote, withWatermark, profile);
  if (templateId === "mariagrazia") return generateHtmlElegante(quote, withWatermark, profile);
  return generateHtmlStandard(quote, withWatermark, profile);
}

function generateHtmlStandard(
  quote: QuoteRow,
  withWatermark: boolean,
  profile: ProfileRow
): string {
  const clientData = (quote.clientData ?? { nome: "", indirizzo: "" }) as QuoteClientData;
  const capitoli: QuoteChapter[] = Array.isArray(quote.capitoli) && quote.capitoli.length > 0
    ? quote.capitoli as QuoteChapter[]
    : [];
  const legacyItems = Array.isArray(quote.items) ? quote.items : [];
  const hasCapitoli = capitoli.length > 0;
  const sconto = quote.sconto as QuoteDiscount | null;
  const condizioniPagamento: string[] = Array.isArray(quote.condizioniPagamento)
    ? quote.condizioniPagamento
    : [];

  const titolo1 = quote.titoloPreventivoRiga1 || "Project Quote & Itemized Estimate";
  const titolo2 = quote.titoloPreventivoRiga2 || "";
  const numeroData = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()} - ${new Date().toLocaleDateString("en-CA")}`;
  const subtotale = Number(quote.subtotale);
  const ivaPerc = Number(quote.ivaPercentuale);
  const ivaValore = Number(quote.ivaValore);
  const totale = Number(quote.totale);

  // Use company snapshot saved at quote creation time, fall back to live profile
  const snap = (quote.companySnapshot as QuoteCompanySnapshot | null) ?? null;
  const companyName = snap?.companyName || profile?.companyName || "";
  const companyVat = snap?.vatNumber || profile?.vatNumber || "";
  const companyAddress = snap?.address || profile?.address || "";
  const companyPhone = snap?.phone || profile?.phone || "";
  const companyEmail = snap?.email || profile?.email || "";
  // Inline SVG logo for QuoteAI (used on watermarked/Starter quotes)
  const quoteaiLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="30" viewBox="0 0 110 30"><defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#7c3aed"/><stop offset="100%" style="stop-color:#06b6d4"/></linearGradient></defs><rect width="26" height="26" rx="5" y="2" fill="url(#pg)"/><text x="13" y="19" font-family="system-ui,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">P</text><text x="34" y="21" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#1a1a2e">prev</text><text x="63" y="21" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#7c3aed">ai</text></svg>`;
  const quoteaiLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(quoteaiLogoSvg).toString("base64")}`;

  const companyLogoUrl = withWatermark
    ? quoteaiLogoDataUri
    : (snap?.logoUrl || profile?.logoUrl || "");

  const logoHtml = companyLogoUrl
    ? `<img src="${companyLogoUrl}" alt="Logo" style="${withWatermark ? "max-height:36px;max-width:140px" : "max-height:60px;max-width:180px"};object-fit:contain;" />`
    : "";

  const companyHtml = `
    <div class="company-block">
      ${logoHtml}
      <div class="company-name">${companyName}</div>
      ${companyVat ? `<div class="company-detail">Tax ID: ${companyVat}</div>` : ""}
      ${companyAddress ? `<div class="company-detail">${companyAddress}</div>` : ""}
      ${companyPhone ? `<div class="company-detail">Tel: ${companyPhone}</div>` : ""}
      ${companyEmail ? `<div class="company-detail">${companyEmail}</div>` : ""}
    </div>`;

  const quadroSinteticoHtml = hasCapitoli
    ? `<div class="section">
        <table class="table-sintetico">
          <thead>
            <tr>
              <th>Chapter</th>
              <th class="col-amount">Net Amount</th>
              <th class="col-obs">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${capitoli.map(cap => `
              <tr>
                <td>${cap.lettera}. ${cap.titolo}</td>
                <td class="col-amount">$&nbsp;${formatCad(cap.subtotale)}</td>
                <td class="col-obs">${cap.osservazione ?? "Standard item"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`
    : "";

  const chaptersHtml = hasCapitoli
    ? capitoli.map(cap => `
        <div class="chapter-section">
          <div class="chapter-heading">${cap.lettera}. ${cap.titolo}</div>
          <table class="table-detail">
            <thead>
              <tr>
                <th class="col-desc">Description</th>
                <th class="col-um">Unit</th>
                <th class="col-qty">Qty</th>
                <th class="col-pu">Unit Price</th>
                <th class="col-tot">Total</th>
              </tr>
            </thead>
            <tbody>
              ${cap.voci.map(v => `
                <tr>
                  <td class="col-desc">${formatDescriptionHtml(v.descrizione)}</td>
                  <td class="col-um">${v.um}</td>
                  <td class="col-qty">${v.quantita}</td>
                  <td class="col-pu">$&nbsp;${formatCad(v.prezzoUnitario)}</td>
                  <td class="col-tot">$&nbsp;${formatCad(v.totale)}</td>
                </tr>`).join("")}
              <tr class="subtotale-row">
                <td colspan="4">Chapter ${cap.lettera} subtotal</td>
                <td class="col-tot">$&nbsp;${formatCad(cap.subtotale)}</td>
              </tr>
            </tbody>
          </table>
        </div>`).join("")
    : `<div class="chapter-section">
        <table class="table-detail">
          <thead>
            <tr>
              <th class="col-desc">Description</th>
              <th class="col-um">Unit</th>
              <th class="col-qty">Qty</th>
              <th class="col-pu">Unit Price</th>
              <th class="col-tot">Total</th>
            </tr>
          </thead>
          <tbody>
            ${legacyItems.map(item => `
              <tr>
                <td class="col-desc">${formatDescriptionHtml(item.descrizione)}</td>
                <td class="col-um">${item.unita}</td>
                <td class="col-qty">${item.quantita}</td>
                <td class="col-pu">$&nbsp;${formatCad(Number(item.prezzoUnitario))}</td>
                <td class="col-tot">$&nbsp;${formatCad(Number(item.totale))}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

  const scontoHtml = sconto && sconto.percentuale > 0
    ? `<tr>
        <td class="tot-label">DISCOUNT APPLIED</td>
        <td class="tot-value">${sconto.percentuale}%</td>
       </tr>
       <tr>
        <td class="tot-label">DISCOUNTED SUBTOTAL</td>
        <td class="tot-value">$&nbsp;${formatCad(sconto.importoScontato)}</td>
       </tr>`
    : "";

  const totalsHtml = `
    <div class="totals-section">
      <table class="table-totals">
        <tbody>
          <tr>
            <td class="tot-label">SUBTOTAL</td>
            <td class="tot-value">$&nbsp;${formatCad(subtotale)}</td>
          </tr>
          ${scontoHtml}
          <tr>
            <td class="tot-label">TAX (${ivaPerc.toFixed(0)}%)</td>
            <td class="tot-value">$&nbsp;${formatCad(ivaValore)}</td>
          </tr>
          <tr class="grand-total-row">
            <td class="tot-label">TOTAL + TAX</td>
            <td class="tot-value">$&nbsp;${formatCad(totale)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  const condizioniHtml = condizioniPagamento.length > 0
    ? `<div class="condizioni">
        <div class="condizioni-title">PAYMENT TERMS</div>
        <ul>${condizioniPagamento.map(c => `<li>${c.toUpperCase()}</li>`).join("")}</ul>
        <p class="nota-bene">N.B. ANY REQUESTED WORK NOT INCLUDED IN THIS QUOTE MUST BE QUOTED AND PAID FOR SEPARATELY.</p>
      </div>`
    : "";

  const filledOrBlank = (val: string | undefined, cls: string) =>
    val ? `<span class="prefilled">${val}</span>` : `<span class="${cls}"></span>`;

  const acceptanceHtml = `
    <div class="acceptance">
      <div class="acceptance-title">ACCEPTANCE STATEMENT ${numeroData}</div>
      <div class="acceptance-subtitle">INDIVIDUAL/BUSINESS</div>
      <table class="accept-table">
        <tr>
          <td>The undersigned ${filledOrBlank(clientData.nome, "blank-line")}</td>
        </tr>
        <tr>
          <td>Business Number ${filledOrBlank(clientData.businessNumber, "blank-line")}
              &nbsp;&nbsp; GST/HST No. ${filledOrBlank(clientData.partitaIva, "blank-line-short")}</td>
        </tr>
        <tr>
          <td>Residing at ${filledOrBlank(clientData.indirizzo, "blank-line")}</td>
        </tr>
        <tr>
          <td>City ${filledOrBlank(clientData.city, "blank-line-short")}
              &nbsp; Province ${filledOrBlank(clientData.province, "blank-line-xs")}
              &nbsp; Postal Code ${filledOrBlank(clientData.postalCode, "blank-line-xs")}</td>
        </tr>
      </table>
      <p class="dichiara">DECLARES</p>
      <p class="dichiara-text">that they have reviewed and fully accept the quote indicated above and the payment terms agreed on ………………………………</p>
      <p class="nb-doc">N.B. Attach a photocopy of the client's identification document</p>
      <table class="sign-table">
        <tr>
          <td class="sign-col">
            <div class="sign-label">FIRMA DITTA ESECUTRICE DEI LAVORI</div>
            <div class="sign-line"></div>
          </td>
          <td class="sign-col">
            <div class="sign-label">FIRMA PER ACCETTAZIONE DEL COMMITTENTE/CLIENTE</div>
            <div class="sign-line"></div>
          </td>
        </tr>
      </table>
    </div>`;

  const footerHtml = profile?.companyName
    ? `<div class="doc-footer">${profile.companyName}${profile.address ? ` – ${profile.address}` : ""}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
  <meta charset="UTF-8">
  <title>${titolo1}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 16mm 14mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #1a1a1a;
      margin: 0;
      padding: 16px 20px;
      background: white;
    }
    /* ---- Header ---- */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company-block { max-width: 55%; }
    .company-name { font-size: 13pt; font-weight: 700; color: #1a1a2e; margin: 4px 0 2px; }
    .company-detail { font-size: 8pt; color: #555; line-height: 1.4; }
    .doc-meta { text-align: right; font-size: 8pt; color: #555; }
    .doc-meta .numero { font-weight: 700; font-size: 10pt; color: #1a1a2e; }
    /* ---- Title ---- */
    .doc-title {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1a1a2e;
      margin: 0 0 2px;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 9pt;
      color: #444;
      margin: 0 0 14px;
      font-style: italic;
    }
    /* ---- Client box ---- */
    .client-box {
      background: #f4f6f9;
      border-left: 3px solid #1a1a2e;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 8.5pt;
    }
    .client-box .label { font-weight: 700; font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .client-box .value { font-weight: 600; color: #1a1a2e; }
    /* ---- Section headings ---- */
    .section { margin-bottom: 14px; }
    .section-heading {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 4px;
    }
    /* ---- Tables ---- */
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #1a1a2e;
      color: white;
      padding: 6px 8px;
      text-align: left;
      font-size: 8pt;
      font-weight: 600;
    }
    td { padding: 5px 8px; font-size: 8.5pt; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f8f9fb; }
    .table-sintetico { margin-bottom: 14px; }
    .table-sintetico .col-amount { text-align: right; white-space: nowrap; }
    .table-sintetico .col-obs { color: #666; font-style: italic; }
    /* ---- Chapter sections ---- */
    .chapter-section { margin-bottom: 18px; page-break-inside: avoid; }
    .chapter-heading {
      font-size: 10pt;
      font-weight: 700;
      color: #1a1a2e;
      border-left: 4px solid #1a1a2e;
      padding: 4px 0 4px 8px;
      margin-bottom: 6px;
      background: #f4f6f9;
    }
    .table-detail .col-desc { width: 44%; }
    .table-detail .col-um { width: 8%; text-align: center; }
    .table-detail .col-qty { width: 8%; text-align: center; }
    .table-detail .col-pu { width: 16%; text-align: right; white-space: nowrap; }
    .table-detail .col-tot { width: 16%; text-align: right; white-space: nowrap; }
    .subtotale-row td {
      background: #edf0f5 !important;
      font-weight: 700;
      border-top: 2px solid #c5cce0;
      font-size: 8.5pt;
    }
    /* ---- Totals ---- */
    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    .table-totals { width: 340px; border: 1px solid #dde1ec; }
    .table-totals td { padding: 6px 10px; }
    .table-totals .tot-label { font-weight: 600; font-size: 8.5pt; color: #333; }
    .table-totals .tot-value { text-align: right; font-weight: 700; white-space: nowrap; font-size: 9pt; }
    .grand-total-row td { background: #1a1a2e !important; color: white !important; font-size: 10pt; font-weight: 700; }
    /* ---- Condizioni ---- */
    .condizioni {
      border: 1px solid #dde1ec;
      border-radius: 3px;
      padding: 10px 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .condizioni-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1a1a2e;
      margin-bottom: 6px;
    }
    .condizioni ul { margin: 0 0 8px; padding-left: 18px; }
    .condizioni li { font-size: 8.5pt; margin-bottom: 3px; font-weight: 600; }
    .nota-bene { font-size: 8pt; color: #c00; font-weight: 700; margin: 6px 0 0; }
    /* ---- Acceptance ---- */
    .acceptance {
      border: 1px solid #c5cce0;
      border-radius: 3px;
      padding: 12px 16px;
      page-break-inside: avoid;
    }
    .acceptance-title {
      font-size: 9.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #1a1a2e;
      margin-bottom: 4px;
    }
    .acceptance-subtitle { font-size: 8.5pt; font-weight: 600; color: #555; margin-bottom: 10px; }
    .accept-table td { padding: 4px 0; font-size: 8.5pt; border: none; background: transparent; }
    .blank-line {
      display: inline-block;
      width: 220px;
      border-bottom: 1px dotted #666;
      margin-left: 4px;
      vertical-align: bottom;
    }
    .blank-line-short {
      display: inline-block;
      width: 100px;
      border-bottom: 1px dotted #666;
      margin-left: 4px;
      vertical-align: bottom;
    }
    .blank-line-xs {
      display: inline-block;
      width: 60px;
      border-bottom: 1px dotted #666;
      margin-left: 4px;
      vertical-align: bottom;
    }
    .prefilled {
      font-weight: 600;
      color: #1a1a2e;
      margin-left: 4px;
    }
    .dichiara { font-size: 9pt; font-weight: 700; text-transform: uppercase; margin: 10px 0 4px; }
    .dichiara-text { font-size: 8.5pt; color: #333; margin-bottom: 6px; }
    .nb-doc { font-size: 7.5pt; color: #888; margin-bottom: 14px; font-style: italic; }
    .sign-table { width: 100%; border: none; }
    .sign-table td { border: none; background: transparent; padding: 0; }
    .sign-col { width: 48%; padding: 0 10px 0 0 !important; vertical-align: bottom; }
    .sign-label { font-size: 7.5pt; font-weight: 600; color: #333; text-transform: uppercase; margin-bottom: 20px; }
    .sign-line { border-bottom: 1px solid #333; height: 1px; width: 90%; }
    /* ---- Footer ---- */
    .doc-footer {
      margin-top: 14px;
      text-align: center;
      font-size: 7.5pt;
      color: #aaa;
      border-top: 1px solid #eee;
      padding-top: 6px;
    }
    /* ---- Watermark ---- */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 72pt;
      color: rgba(0,0,0,0.045);
      font-weight: 900;
      z-index: 9999;
      white-space: nowrap;
      pointer-events: none;
      letter-spacing: 4px;
    }
    @media print {
      body { padding: 0; }
      .watermark { position: fixed; }
    }
  </style>
</head>
<body>
  ${withWatermark ? '<div class="watermark">DRAFT NOT VALID</div>' : ""}

  <div class="doc-header">
    ${companyHtml}
    <div class="doc-meta">
      <div class="numero">${numeroData}</div>
      <div>Date: ${new Date().toLocaleDateString("en-CA")}</div>
    </div>
  </div>

  <div class="doc-title">${titolo1}</div>
  ${titolo2 ? `<div class="doc-subtitle">${titolo2}</div>` : ""}

  <div class="client-box">
    <div class="label">Prepared For</div>
    <div class="value">${clientData.nome || "——"}</div>
    <div>${clientData.indirizzo || ""}</div>
  </div>

  ${hasCapitoli ? `<div class="section">
    <div class="section-heading">1. Summary</div>
    ${quadroSinteticoHtml}
  </div>` : ""}

  <div class="section">
    ${hasCapitoli ? `<div class="section-heading">2. Detailed Breakdown</div>` : ""}
    ${chaptersHtml}
  </div>

  ${totalsHtml}
  ${condizioniHtml}
  ${acceptanceHtml}
  ${footerHtml}
</body>
</html>`;
}

function formatDescriptionHtml(descrizione: string): string {
  const parts = descrizione.split("\n");
  const title = parts[0];
  const detail = parts.slice(1).join("\n");
  if (!detail) return title;
  return `<strong>${title}</strong><div style="font-size: 10px; color: #555; margin-top: 2px; font-weight: normal; line-height: 1.3;">${detail}</div>`;
}

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

function generateHtmlProfessionale(
  quote: QuoteRow,
  withWatermark: boolean,
  profile: ProfileRow
): string {
  const clientData = (quote.clientData ?? { nome: "", indirizzo: "" }) as QuoteClientData;
  const capitoli: QuoteChapter[] = Array.isArray(quote.capitoli) && quote.capitoli.length > 0
    ? quote.capitoli as QuoteChapter[]
    : [];
  const legacyItems = Array.isArray(quote.items) ? quote.items : [];
  const sconto = quote.sconto as QuoteDiscount | null;
  const condizioniPagamento: string[] = Array.isArray(quote.condizioniPagamento)
    ? quote.condizioniPagamento : [];

  const titolo2 = quote.titoloPreventivoRiga2 || "";
  const numeroData = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()} - ${new Date().toLocaleDateString("en-CA")}`;
  const subtotale = Number(quote.subtotale);
  const ivaPerc = Number(quote.ivaPercentuale);
  const ivaValore = Number(quote.ivaValore);
  const totale = Number(quote.totale);

  const snap = (quote.companySnapshot as QuoteCompanySnapshot | null) ?? null;
  const companyName = snap?.companyName || profile?.companyName || "";
  const companyVat = snap?.vatNumber || profile?.vatNumber || "";
  const companyAddress = snap?.address || profile?.address || "";
  const companyPhone = snap?.phone || profile?.phone || "";
  const companyEmail = snap?.email || profile?.email || "";
  const quoteaiLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="30" viewBox="0 0 110 30"><defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#7c3aed"/><stop offset="100%" style="stop-color:#06b6d4"/></linearGradient></defs><rect width="26" height="26" rx="5" y="2" fill="url(#pg)"/><text x="13" y="19" font-family="system-ui,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">P</text><text x="34" y="21" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#1a1a2e">prev</text><text x="63" y="21" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#7c3aed">ai</text></svg>`;
  const quoteaiLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(quoteaiLogoSvg).toString("base64")}`;
  const companyLogoUrl = withWatermark ? quoteaiLogoDataUri : (snap?.logoUrl || profile?.logoUrl || "");
  const logoHtml = companyLogoUrl ? `<img src="${companyLogoUrl}" alt="Logo" style="max-height:50px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px;" />` : "";

  const scontoHtml = sconto && sconto.percentuale > 0
    ? `<tr><td class="tot-label">DISCOUNT (${sconto.percentuale}%)</td><td class="tot-value">−&nbsp;$&nbsp;${formatCad(Number(quote.subtotale) - sconto.importoScontato)}</td></tr>
       <tr><td class="tot-label">DISCOUNTED SUBTOTAL</td><td class="tot-value">$&nbsp;${formatCad(sconto.importoScontato)}</td></tr>`
    : "";

  const hasCapitoli = capitoli.length > 0;
  const bodyRows = hasCapitoli
    ? capitoli.map((cap, ci) => {
        const chapterIdx = String(ci + 1).padStart(2, "0");
        const chapterLetter = String.fromCharCode(65 + ci);
        const voceRows = cap.voci.map((v, vi) => `
          <tr class="item-row">
            <td class="col-nr">${ci + 1}.${vi + 1}</td>
            <td class="col-desc">${formatDescriptionHtml(v.descrizione)}</td>
            <td class="col-um">${v.um}</td>
            <td class="col-unit">$&nbsp;${formatCad(v.prezzoUnitario)}</td>
            <td class="col-tot">$&nbsp;${formatCad(v.totale)}</td>
          </tr>`).join("");
        return `
          <tr><td colspan="5" class="section-header">${chapterIdx}_ ${cap.titolo.toUpperCase()}</td></tr>
          ${voceRows}
          <tr class="subtotale-row">
            <td colspan="4">${chapterLetter}_ TOTALE (iva esclusa)</td>
            <td>$&nbsp;${formatCad(cap.subtotale)}</td>
          </tr>`;
      }).join("")
    : legacyItems.map((item, i) => `
        <tr class="item-row">
          <td class="col-nr">${i + 1}</td>
          <td class="col-desc">${formatDescriptionHtml(item.descrizione)}</td>
          <td class="col-um">${item.unita}</td>
          <td class="col-unit">$&nbsp;${formatCad(Number(item.prezzoUnitario))}</td>
          <td class="col-tot">$&nbsp;${formatCad(Number(item.totale))}</td>
        </tr>`).join("");

  const condizioniHtml = condizioniPagamento.length > 0
    ? `<div class="condizioni">
        <div class="condizioni-title">PAYMENT TERMS</div>
        <ul>${condizioniPagamento.map(c => `<li>${c}</li>`).join("")}</ul>
      </div>`
    : "";

  const footerHtml = companyName
    ? `<div class="doc-footer">${companyName}${companyAddress ? ` — ${companyAddress}` : ""}</div>` : "";

  const committente = [clientData.nome, clientData.indirizzo, clientData.city, clientData.province, clientData.postalCode].filter(Boolean).join(" — ");

  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
  <meta charset="UTF-8">
  <title>Quote ${numeroData}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 16mm 14mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; margin: 0; padding: 16px 20px; background: white; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
    .company-block { max-width: 55%; }
    .company-name { font-size: 12pt; font-weight: 700; color: #1a1a2e; margin-bottom: 3px; }
    .company-detail { font-size: 8pt; color: #555; line-height: 1.5; }
    .doc-meta { text-align: right; }
    .doc-meta h1 { font-size: 15pt; font-weight: 900; color: #1a1a2e; margin: 0 0 4px; letter-spacing: 1px; }
    .doc-meta .doc-ref { font-size: 8.5pt; color: #444; line-height: 1.6; }
    hr.sep { border: none; border-top: 2.5px solid #1a1a2e; margin: 0 0 10px; }
    .oggetto { font-size: 9pt; font-weight: 600; margin-bottom: 8px; color: #222; }
    .committente-box { background: #f4f6f9; border-left: 4px solid #1a1a2e; padding: 7px 12px; margin-bottom: 14px; font-size: 8.5pt; }
    .committente-box .label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; }
    .table-header-row th { background: #1a1a2e; color: white; padding: 6px 8px; font-size: 8pt; font-weight: 600; }
    .table-header-row th.col-nr { text-align: center; }
    .table-header-row th.col-unit, .table-header-row th.col-tot { text-align: right; }
    .section-header td { background: #2d3561; color: white; font-weight: 700; font-size: 8.5pt; padding: 5px 8px; letter-spacing: 0.3px; }
    tr.item-row td { padding: 5px 8px; font-size: 8pt; border-bottom: 1px solid #eee; vertical-align: top; }
    tr.item-row:nth-child(even) td { background: #f8f9fb; }
    .col-nr { width: 7%; text-align: center; font-weight: 600; }
    .col-desc { width: 47%; }
    .col-um { width: 7%; text-align: center; }
    .col-unit { width: 17%; text-align: right; white-space: nowrap; }
    .col-tot { width: 17%; text-align: right; font-weight: 700; white-space: nowrap; }
    .subtotale-row td { background: #e8ecf4 !important; font-weight: 700; border-top: 2px solid #aab0cc; font-size: 8.5pt; padding: 6px 8px; }
    .subtotale-row td:first-child { text-align: right; }
    .subtotale-row td:last-child { text-align: right; white-space: nowrap; }
    .totals-section { display: flex; justify-content: flex-end; margin: 14px 0; }
    .table-totals { width: 320px; border: 1px solid #dde1ec; border-collapse: collapse; }
    .table-totals td { padding: 6px 10px; font-size: 8.5pt; border-bottom: 1px solid #eee; }
    .tot-label { font-weight: 600; color: #333; }
    .tot-value { text-align: right; font-weight: 700; white-space: nowrap; }
    .grand-total-row td { background: #1a1a2e !important; color: white !important; font-size: 10pt; font-weight: 700; border-bottom: none; }
    .condizioni { border: 1px solid #dde1ec; border-radius: 2px; padding: 10px 14px; margin-bottom: 14px; }
    .condizioni-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; color: #1a1a2e; margin-bottom: 6px; letter-spacing: 0.5px; }
    .condizioni ul { margin: 0; padding-left: 16px; }
    .condizioni li { font-size: 8pt; margin-bottom: 3px; }
    .doc-footer { margin-top: 14px; text-align: center; font-size: 7.5pt; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72pt; color: rgba(0,0,0,0.045); font-weight: 900; z-index: 9999; white-space: nowrap; pointer-events: none; letter-spacing: 4px; }
    @media print { body { padding: 0; } .watermark { position: fixed; } }
  </style>
</head>
<body>
  ${withWatermark ? '<div class="watermark">DRAFT NOT VALID</div>' : ""}

  <div class="header">
    <div class="company-block">
      ${logoHtml}
      <div class="company-name">${companyName}</div>
      ${companyVat ? `<div class="company-detail">Tax ID: ${companyVat}</div>` : ""}
      ${companyAddress ? `<div class="company-detail">${companyAddress}</div>` : ""}
      ${companyPhone ? `<div class="company-detail">Tel: ${companyPhone}</div>` : ""}
      ${companyEmail ? `<div class="company-detail">${companyEmail}</div>` : ""}
    </div>
    <div class="doc-meta">
      <h1>PREVENTIVO</h1>
      <div class="doc-ref">${numeroData}</div>
      <div class="doc-ref">Date: ${new Date().toLocaleDateString("en-CA")}</div>
    </div>
  </div>
  <hr class="sep">
  ${titolo2 ? `<div class="oggetto">OGGETTO: ${titolo2}</div>` : ""}

  <div class="committente-box">
    <div class="label">Prepared For</div>
    <div style="font-weight:600;color:#1a1a2e;margin-top:2px;">${committente || "——"}</div>
  </div>

  <table>
    <thead>
      <tr class="table-header-row">
        <th class="col-nr">No.</th>
        <th class="col-desc">Specification Item</th>
        <th class="col-um">Unit</th>
        <th class="col-unit">Unit Price ($)</th>
        <th class="col-tot">Total ($)</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>

  <div class="totals-section">
    <table class="table-totals">
      <tbody>
        <tr><td class="tot-label">SUBTOTAL</td><td class="tot-value">$&nbsp;${formatCad(subtotale)}</td></tr>
        ${scontoHtml}
        <tr><td class="tot-label">TAX (${ivaPerc.toFixed(0)}%)</td><td class="tot-value">$&nbsp;${formatCad(ivaValore)}</td></tr>
        <tr class="grand-total-row"><td class="tot-label">TOTAL + TAX</td><td class="tot-value">$&nbsp;${formatCad(totale)}</td></tr>
      </tbody>
    </table>
  </div>

  ${condizioniHtml}
  ${footerHtml}
</body>
</html>`;
}

function generateHtmlElegante(
  quote: QuoteRow,
  withWatermark: boolean,
  profile: ProfileRow
): string {
  const clientData = (quote.clientData ?? { nome: "", indirizzo: "" }) as QuoteClientData;
  const capitoli: QuoteChapter[] = Array.isArray(quote.capitoli) && quote.capitoli.length > 0
    ? quote.capitoli as QuoteChapter[]
    : [];
  const legacyItems = Array.isArray(quote.items) ? quote.items : [];
  const sconto = quote.sconto as QuoteDiscount | null;
  const condizioniPagamento: string[] = Array.isArray(quote.condizioniPagamento)
    ? quote.condizioniPagamento : [];

  const titolo2 = quote.titoloPreventivoRiga2 || "";
  const numeroData = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()} - ${new Date().toLocaleDateString("en-CA")}`;
  const subtotale = Number(quote.subtotale);
  const ivaPerc = Number(quote.ivaPercentuale);
  const ivaValore = Number(quote.ivaValore);
  const totale = Number(quote.totale);

  const snap = (quote.companySnapshot as QuoteCompanySnapshot | null) ?? null;
  const companyName = snap?.companyName || profile?.companyName || "";
  const companyVat = snap?.vatNumber || profile?.vatNumber || "";
  const companyAddress = snap?.address || profile?.address || "";
  const companyPhone = snap?.phone || profile?.phone || "";
  const companyEmail = snap?.email || profile?.email || "";
  const quoteaiLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="30" viewBox="0 0 110 30"><defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#7c3aed"/><stop offset="100%" style="stop-color:#06b6d4"/></linearGradient></defs><rect width="26" height="26" rx="5" y="2" fill="url(#pg)"/><text x="13" y="19" font-family="system-ui,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">P</text><text x="34" y="21" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#1a1a2e">prev</text><text x="63" y="21" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#7c3aed">ai</text></svg>`;
  const quoteaiLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(quoteaiLogoSvg).toString("base64")}`;
  const companyLogoUrl = withWatermark ? quoteaiLogoDataUri : (snap?.logoUrl || profile?.logoUrl || "");
  const logoHtml = companyLogoUrl ? `<img src="${companyLogoUrl}" alt="Logo" style="max-height:55px;max-width:170px;object-fit:contain;display:block;margin-bottom:6px;" />` : "";

  // Merge all voci from all chapters into a flat numbered list
  const hasCapitoli = capitoli.length > 0;
  const allRows = hasCapitoli
    ? capitoli.flatMap((cap, _ci) =>
        cap.voci.map(v => ({ descrizione: v.descrizione, um: v.um, quantita: v.quantita, pu: v.prezzoUnitario, totale: v.totale, chapter: cap.titolo }))
      )
    : legacyItems.map(item => ({ descrizione: item.descrizione, um: item.unita, quantita: item.quantita, pu: Number(item.prezzoUnitario), totale: Number(item.totale), chapter: "" }));

  const tableRows = allRows.map((row, i) => `
    <tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
      <td class="col-num">${i + 1}</td>
      <td class="col-desc">${formatDescriptionHtml(row.descrizione)}</td>
      <td class="col-um">${row.um}</td>
      <td class="col-qty">${row.quantita}</td>
      <td class="col-pu">$&nbsp;${formatCad(row.pu)}</td>
      <td class="col-tot">$&nbsp;${formatCad(row.totale)}</td>
    </tr>`).join("");

  const scontoHtml = sconto && sconto.percentuale > 0
    ? `<div class="total-row"><span>Discount (${sconto.percentuale}%)</span><span>−&nbsp;$&nbsp;${formatCad(Number(quote.subtotale) - sconto.importoScontato)}</span></div>
       <div class="total-row"><span>Discounted subtotal</span><span>$&nbsp;${formatCad(sconto.importoScontato)}</span></div>` : "";

  const condizioniHtml = condizioniPagamento.length > 0
    ? `<div class="condizioni">
        <div class="condizioni-title">PAYMENT TERMS</div>
        <ul>${condizioniPagamento.map(c => `<li>${c}</li>`).join("")}</ul>
      </div>` : "";

  const footerHtml = companyName
    ? `<div class="doc-footer">${companyName}${companyAddress ? ` — ${companyAddress}` : ""}</div>` : "";

  const clientLines = [clientData.nome, clientData.indirizzo, [clientData.city, clientData.province, clientData.postalCode].filter(Boolean).join(" ")].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
  <meta charset="UTF-8">
  <title>Quote ${numeroData}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 16mm 14mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; margin: 0; padding: 16px 20px; background: white; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 14px; }
    .company-info { }
    .company-name { font-size: 13pt; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
    .company-line { font-size: 8pt; color: #444; line-height: 1.5; }
    .offerta-block { text-align: right; }
    .offerta-label { font-size: 18pt; font-weight: 900; color: #1a1a1a; letter-spacing: 2px; margin-bottom: 4px; }
    .offerta-meta { font-size: 8.5pt; color: #555; line-height: 1.6; }
    .client-section { margin-bottom: 14px; padding: 8px 0; border-bottom: 1px solid #ddd; }
    .client-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 3px; }
    .client-name { font-size: 10pt; font-weight: 700; color: #1a1a1a; }
    .client-line { font-size: 8.5pt; color: #444; }
    ${titolo2 ? `.oggetto { font-size: 8.5pt; font-style: italic; color: #555; margin-bottom: 10px; }` : ""}
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    thead th { background: #333; color: white; padding: 6px 8px; font-size: 8pt; font-weight: 600; }
    thead th.col-num { text-align: center; width: 5%; }
    thead th.col-desc { text-align: left; width: 42%; }
    thead th.col-um { text-align: center; width: 7%; }
    thead th.col-qty { text-align: center; width: 7%; }
    thead th.col-pu { text-align: right; width: 18%; }
    thead th.col-tot { text-align: right; width: 18%; }
    .row-even td { background: #fff; }
    .row-odd td { background: #f7f7f7; }
    td { padding: 5px 8px; font-size: 8.5pt; border-bottom: 1px solid #eee; vertical-align: top; }
    .col-num { text-align: center; font-weight: 600; color: #555; }
    .col-desc { }
    .col-um { text-align: center; }
    .col-qty { text-align: center; }
    .col-pu { text-align: right; white-space: nowrap; }
    .col-tot { text-align: right; font-weight: 700; white-space: nowrap; }
    .totals-block { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    .totals-inner { width: 300px; border: 1px solid #ccc; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 8.5pt; border-bottom: 1px solid #eee; }
    .total-row span:last-child { font-weight: 700; white-space: nowrap; }
    .grand-total { display: flex; justify-content: space-between; padding: 8px 12px; background: #333; color: white; font-size: 10pt; font-weight: 700; }
    .condizioni { border: 1px solid #ddd; padding: 10px 14px; margin-bottom: 14px; }
    .condizioni-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; color: #333; margin-bottom: 6px; }
    .condizioni ul { margin: 0; padding-left: 16px; }
    .condizioni li { font-size: 8pt; margin-bottom: 3px; }
    .doc-footer { margin-top: 14px; text-align: center; font-size: 7.5pt; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72pt; color: rgba(0,0,0,0.045); font-weight: 900; z-index: 9999; white-space: nowrap; pointer-events: none; letter-spacing: 4px; }
    @media print { body { padding: 0; } .watermark { position: fixed; } }
  </style>
</head>
<body>
  ${withWatermark ? '<div class="watermark">DRAFT NOT VALID</div>' : ""}

  <div class="page-header">
    <div class="company-info">
      ${logoHtml}
      <div class="company-name">${companyName}</div>
      ${companyAddress ? `<div class="company-line">${companyAddress}</div>` : ""}
      ${companyVat ? `<div class="company-line">C.F. / P.IVA: ${companyVat}</div>` : ""}
      ${companyPhone ? `<div class="company-line">${companyPhone}</div>` : ""}
      ${companyEmail ? `<div class="company-line">${companyEmail}</div>` : ""}
    </div>
    <div class="offerta-block">
      <div class="offerta-label">OFFERTA</div>
      <div class="offerta-meta">${numeroData}</div>
      <div class="offerta-meta">Date: ${new Date().toLocaleDateString("en-CA")}</div>
    </div>
  </div>

  <div class="client-section">
    <div class="client-label">Prepared For</div>
    ${clientLines[0] ? `<div class="client-name">${clientLines[0]}</div>` : ""}
    ${clientLines.slice(1).map(l => `<div class="client-line">${l}</div>`).join("")}
  </div>

  ${titolo2 ? `<div class="oggetto">Oggetto: ${titolo2}</div>` : ""}

  <table>
    <thead>
      <tr>
        <th class="col-num">#</th>
        <th class="col-desc">Description</th>
        <th class="col-um">Unit</th>
        <th class="col-qty">Qty</th>
        <th class="col-pu">Unit Price</th>
        <th class="col-tot">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="totals-block">
    <div class="totals-inner">
      <div class="total-row"><span>Totale imponibile</span><span>$&nbsp;${formatCad(subtotale)}</span></div>
      ${scontoHtml}
      <div class="total-row"><span>TAX (${ivaPerc.toFixed(0)}%)</span><span>$&nbsp;${formatCad(ivaValore)}</span></div>
      <div class="grand-total"><span>TOTALE</span><span>$&nbsp;${formatCad(totale)}</span></div>
    </div>
  </div>

  ${condizioniHtml}
  ${footerHtml}
</body>
</html>`;
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

async function generateCapitolatoPdfBuffer(quote: QuoteRow, profile: ProfileRow): Promise<Buffer> {
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
  if (companyVat) companyInfoStack.push({ text: `Tax ID: ${companyVat}`, fontSize: 8, color: "#555555" });
  if (companyAddress) companyInfoStack.push({ text: companyAddress, fontSize: 8, color: "#555555" });
  if (companyPhone) companyInfoStack.push({ text: `Tel: ${companyPhone}`, fontSize: 8, color: "#555555" });
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

  // Chapter detail tables — includes No. column
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
          formatDescriptionPdf(v.descrizione, bg) as Content,
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

  // Totals section
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

  // Payment conditions
  const condizioniContent: Content[] = condizioniPagamento.length > 0
    ? [
        { text: "PAYMENT TERMS", style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        {
          ul: condizioniPagamento.map(c => ({ text: c.toUpperCase(), fontSize: 8.5, bold: true })),
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },
        {
          text: "N.B. ANY REQUESTED WORK NOT INCLUDED IN THIS QUOTE MUST BE QUOTED AND PAID FOR SEPARATELY.",
          fontSize: 8,
          color: "#cc0000",
          bold: true,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
      ]
    : [];

  // Acceptance signature section
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
    // DRAFT diagonal watermark for draft/unpaid quotes
    ...(isDraft ? {
      watermark: {
        text: "DRAFT",
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
                { text: "CAPITOLATO PRO", fontSize: 7, bold: true, color: "#7c3aed", alignment: "right", characterSpacing: 1 },
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
                { text: "PREPARED FOR", fontSize: 7, bold: true, color: GRAY, characterSpacing: 0.5 },
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
        { text: "1. SUMMARY", style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
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
        { text: "2. DETAILED BILL OF QUANTITIES", style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
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
        { text: "NOTE", style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        { text: quote.note, fontSize: 8, color: "#333" },
      ] as Content[] : []),

      // Acceptance signature section
      ...signatureSection,
    ],
    footer: (currentPage: number, _pageCount: number): Content => ({
      margin: [40, 0, 40, 14] as [number, number, number, number],
      columns: [
        {
          text: `${companyName}${companyAddress ? " – " + companyAddress : ""}`,
          fontSize: 7.5,
          color: "#aaaaaa",
        },
        {
          text: isDraft ? "PROVISIONAL DOCUMENT – NOT VALID FOR CONTRACTUAL PURPOSES" : "Document generated with QuoteAI",
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
async function generateQuotePdfBuffer(quote: QuoteRow, profile: ProfileRow, withWatermark: boolean): Promise<Buffer> {
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
  const isDraft = withWatermark;

  const DARK = "#1a1a2e";
  const LIGHT_BG = "#f4f6f9";
  const GRAY = "#888888";

  const logoPath = snap?.logoUrl || profile?.logoUrl || null;
  const logoDataUri = await fetchLogoDataUri(logoPath);

  const companyInfoStack: Content[] = [
    { text: companyName, fontSize: 13, bold: true, color: DARK, margin: [0, 4, 0, 2] },
  ];
  if (companyVat) companyInfoStack.push({ text: `Tax ID: ${companyVat}`, fontSize: 8, color: "#555555" });
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
          formatDescriptionPdf(v.descrizione, bg) as Content,
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
        {
          text: "N.B. ANY REQUESTED WORK NOT INCLUDED IN THIS QUOTE MUST BE QUOTED AND PAID FOR SEPARATELY.",
          fontSize: 8,
          color: "#cc0000",
          bold: true,
          margin: [0, 4, 0, 0] as [number, number, number, number],
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
    ...(isDraft ? {
      watermark: {
        text: "DRAFT",
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
        { text: "1. SUMMARY", style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
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
        { text: "2. DETAILED BILL OF QUANTITIES", style: "sectionHeading", margin: [0, 0, 0, 6] as [number, number, number, number] },
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
        { text: "NOTE", style: "sectionHeading", margin: [0, 14, 0, 4] as [number, number, number, number] },
        { text: quote.note, fontSize: 8, color: "#333" },
      ] as Content[] : []),

      ...signatureSection,
    ],
    footer: (currentPage: number, _pageCount: number): Content => ({
      margin: [40, 0, 40, 14] as [number, number, number, number],
      columns: [
        {
          text: `${companyName}${companyAddress ? " \u2013 " + companyAddress : ""}`,
          fontSize: 7.5,
          color: "#aaaaaa",
        },
        {
          text: isDraft ? "PROVISIONAL DOCUMENT \u2013 NOT VALID FOR CONTRACTUAL PURPOSES" : "Document generated with QuoteAI",
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

// POST /api/quotes/manual — create a manually-built quote (no AI)
router.post("/quotes/manual", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    // Quota enforcement (same as AI route)
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
          res.status(429).json({ error: `Monthly quota reached. You've used all ${plan.quotaPerMonth} quotes included in the ${plan.name} plan this month.`, code: "QUOTA_EXCEEDED" });
          return;
        }
      }
    }

    const {
      capitoli: rawCapitoli,
      clientData: rawClientData,
      companySnapshot: rawSnapshot,
      templateId,
      titoloPreventivoRiga1,
      titoloPreventivoRiga2,
      descrizioneGenerale,
      ivaPercentuale: rawIva,
      condizioniPagamento,
      note,
    } = req.body as {
      capitoli?: unknown;
      clientData?: unknown;
      companySnapshot?: unknown;
      templateId?: string;
      titoloPreventivoRiga1?: string;
      titoloPreventivoRiga2?: string;
      descrizioneGenerale?: string;
      ivaPercentuale?: number;
      condizioniPagamento?: string[];
      note?: string;
    };

    // Validate capitoli
    const capitoliResult = quoteChapterSchema.array().safeParse(rawCapitoli);
    if (!capitoliResult.success) {
      res.status(400).json({ error: "Invalid capitoli", details: capitoliResult.error });
      return;
    }
    const capitoli = capitoliResult.data as QuoteChapter[];

    // Validate optional clientData
    let clientDataInput: QuoteClientData | undefined;
    if (rawClientData) {
      const r = quoteClientDataSchema.safeParse(rawClientData);
      if (!r.success) {
        res.status(400).json({ error: "Invalid clientData", details: r.error });
        return;
      }
      clientDataInput = r.data;
    }

    // Resolve company snapshot
    let resolvedSnapshot: QuoteCompanySnapshot | null = null;
    if (rawSnapshot) {
      const r = quoteCompanySnapshotSchema.safeParse(rawSnapshot);
      if (r.success) resolvedSnapshot = r.data;
    }
    if (!resolvedSnapshot) {
      const [bp] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
      if (bp) {
        resolvedSnapshot = {
          companyName: bp.companyName,
          vatNumber: bp.vatNumber ?? undefined,
          address: bp.address ?? undefined,
          phone: bp.phone ?? undefined,
          email: bp.email ?? undefined,
          logoUrl: bp.logoUrl ?? undefined,
        };
      }
    }

    // Recalculate totals server-side (never trust client)
    const recalcCapitoli = capitoli.map(cap => {
      const voci = cap.voci.map(v => ({
        ...v,
        totale: Math.round(v.quantita * v.prezzoUnitario * 100) / 100,
      }));
      const subtotale = voci.reduce((s, v) => s + v.totale, 0);
      return { ...cap, voci, subtotale: Math.round(subtotale * 100) / 100 };
    });

    const subtotale = recalcCapitoli.reduce((s, c) => s + c.subtotale, 0);
    const ivaPercentuale = typeof rawIva === "number" && rawIva >= 0 ? rawIva : 22;
    const ivaValore = Math.round(subtotale * (ivaPercentuale / 100) * 100) / 100;
    const totale = Math.round((subtotale + ivaValore) * 100) / 100;

    const [quote] = await db.transaction(async (tx) => {
      // Row lock the user's business profile record to prevent concurrent quote creation
      await tx.execute(sql`SELECT user_id FROM ${businessProfilesTable} WHERE user_id = ${userId} FOR UPDATE`);

      const numeroPreventivoData = await generateNumeroPreventivo(userId);

      return await tx
        .insert(quotesTable)
        .values({
          userId,
          rawInput: `[Manual quote] ${titoloPreventivoRiga2 ?? descrizioneGenerale ?? ""}`.trim(),
          capitoli: recalcCapitoli,
          clientData: clientDataInput ?? { nome: "", indirizzo: "" },
          companySnapshot: resolvedSnapshot,
          templateId: (["standard", "arosio", "mariagrazia"].includes(templateId ?? "") ? templateId : "standard") as "standard" | "arosio" | "mariagrazia",
          titoloPreventivoRiga1: titoloPreventivoRiga1 ?? "Project Quote & Itemized Estimate",
          titoloPreventivoRiga2: titoloPreventivoRiga2 ?? "",
          descrizioneGenerale: descrizioneGenerale ?? "",
          numeroPreventivoData,
          subtotale: subtotale.toFixed(2),
          ivaPercentuale: ivaPercentuale.toFixed(2),
          ivaValore: ivaValore.toFixed(2),
          totale: totale.toFixed(2),
          condizioniPagamento: Array.isArray(condizioniPagamento) ? condizioniPagamento : [
            "30% acconto alla firma",
            "30% a SAL intermedio",
            "30% a SAL finale",
            "10% saldo fine lavori",
          ],
          note: note ?? "Quote valid for 30 days",
          status: "draft",
        })
        .returning();
    });

    await linkQuoteToClient(quote!, profile?.province);

    // Start trial on first quote creation
    if (!profile?.trialStartedAt) {
      await db
        .update(businessProfilesTable)
        .set({ trialStartedAt: new Date() })
        .where(eq(businessProfilesTable.userId, userId));
    }

    res.status(201).json(serializeQuote(quote!));
  } catch (err) {
    req.log.error({ err }, "Error creating manual quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/suggest-item-description — AI helper for manual quote items
router.post("/quotes/suggest-item-description", requireAuth, aiCallLimiter, async (req, res) => {
  try {
    const { brief, context } = req.body as { brief?: string; context?: string };
    if (!brief || typeof brief !== "string" || !brief.trim()) {
      res.status(400).json({ error: "brief is required" });
      return;
    }

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

export { generateQuoteHtml, generateQuotePdfBuffer, generateCapitolatoPdfBuffer };
export default router;
