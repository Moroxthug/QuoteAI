import { Router } from "express";
import multer from "multer";
import { requireAuth, getUserId, getActorRole } from "../middlewares/authMiddleware";
import { requirePermission, roleCan } from "../middlewares/requirePermission.js";
import { kindOf } from "../materials/priceBook.js";
import { almostReady, changedIn, docState, readOf, storePrices, topMover, type CostLines } from "../materials/documents.js";
import { priceHistory, priceSeries, sameItem } from "../materials/suppliers.js";
import {
  db,
  clientsTable,
  costEntriesTable,
  priceCatalogItemsTable,
  projectsTable,
  uploadedDocumentsTable,
  priceIntelligenceTable,
  priceIntelligenceAlertsTable,
  extractedDocumentDataSchema,
} from "@workspace/db";
import { eq, and, desc, avg, min, max, count, sql, isNull, isNotNull, inArray, gte } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";
import { createRequire } from "node:module";
import { userRateLimiter } from "../lib/rateLimit.js";

const _require = createRequire(import.meta.url);

const documentAiLimiter = userRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: "You have reached the hourly limit for AI document processing. Please try again later.",
});

const objectStorage = new ObjectStorageService();

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Use PDF, DOCX, XLSX, JPG, PNG, or WEBP.`));
    }
  },
});

const router = Router();

function serializeDoc(d: typeof uploadedDocumentsTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    fileName: d.fileName,
    fileSize: d.fileSize ?? null,
    mimeType: d.mimeType,
    fileUrl: d.fileUrl,
    status: d.status,
    extractedData: (d.extractedData as object | null) ?? null,
    errorMessage: d.errorMessage ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

const EXTRACTION_PROMPT = `You are a quote/estimate expert for the Canadian market (construction, building systems, technical services).
Analyze this document (a quote, bill of quantities, invoice, or proposal) and extract the work items with their unit prices.

RULES:
1. Extract ONLY work items with a clear unit price ($/sqft, $/hour, $/linear ft, $/each, etc.)
2. Normalize work-item names into professional English (e.g. "Interior wall painting", "Tile flooring installation", "Residential electrical wiring")
3. If the document mentions a geographic area (city, province), include it in the "zona" field
4. The "totale" field is the total for the entire document (if present)
5. Include a maximum of 30 items — choose the most significant ones by price
6. If the document's letterhead, header, or signature identifies the supplier/vendor/contractor company that issued it, put its name in "fornitore" (just the company name, not an address). If it's not clearly identifiable, use null.

OUTPUT VALID JSON ONLY, no extra text:
{
  "lavorazioni": [
    { "tipo": "Interior wall painting", "prezzoUnitario": 8.5, "um": "sqft", "zona": "Toronto" }
  ],
  "totale": 15000,
  "zona": "Toronto (ON)",
  "fornitore": "Acme Renovations Inc.",
  "note": "Quote for apartment renovation"
}

If you can't find clear unit prices, return: { "lavorazioni": [], "totale": null, "zona": null, "fornitore": null, "note": "No unit prices found" }`;

async function extractFromImage(buffer: Buffer, mimeType: string) {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
          {
            type: "text",
            text: "Analyze this document and extract the work items with their unit prices.",
          },
        ],
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? "{}";
}

async function extractFromPdf(buffer: Buffer) {
  let pdfText = "";
  try {
    const { PDFParse } = _require("pdf-parse") as {
      PDFParse: new (opts: { data: Buffer }) => {
        getText(): Promise<{ text: string }>;
        destroy(): Promise<void>;
      };
    };
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    pdfText = result.text.slice(0, 12000);
  } catch (err) {
    logger.warn({ err }, "pdf-parse failed, falling back to empty text");
  }

  if (!pdfText.trim()) {
    return JSON.stringify({ lavorazioni: [], totale: null, zona: null, note: "No extractable text in the PDF" });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: `Text extracted from the document:\n\n${pdfText}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? "{}";
}

async function extractFromDocx(buffer: Buffer) {
  let docText = "";
  try {
    const mammoth = _require("mammoth") as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    docText = result.value.slice(0, 12000);
  } catch (err) {
    logger.warn({ err }, "mammoth failed, falling back to empty text");
  }

  if (!docText.trim()) {
    return JSON.stringify({ lavorazioni: [], totale: null, zona: null, note: "No extractable text in the DOCX" });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: `Text extracted from the DOCX document:\n\n${docText}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? "{}";
}

async function extractFromXlsx(buffer: Buffer) {
  let sheetText = "";
  try {
    const XLSX = _require("xlsx") as {
      read: (data: Buffer, opts: { type: "buffer" }) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: {
        sheet_to_csv: (sheet: unknown) => string;
      };
    };
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const csvParts: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 3)) {
      const sheet = workbook.Sheets[sheetName];
      if (sheet) {
        csvParts.push(`--- ${sheetName} ---\n${XLSX.utils.sheet_to_csv(sheet)}`);
      }
    }
    sheetText = csvParts.join("\n\n").slice(0, 12000);
  } catch (err) {
    logger.warn({ err }, "xlsx failed, falling back to empty text");
  }

  if (!sheetText.trim()) {
    return JSON.stringify({ lavorazioni: [], totale: null, zona: null, note: "No extractable text in the XLSX" });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: `Data extracted from the Excel file (CSV format per sheet):\n\n${sheetText}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? "{}";
}

// GET /api/documents
router.get("/documents", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const docs = await db
      .select()
      .from(uploadedDocumentsTable)
      .where(and(eq(uploadedDocumentsTable.userId, userId), eq(uploadedDocumentsTable.purpose, "price_intelligence")))
      .orderBy(desc(uploadedDocumentsTable.createdAt));
    res.json(docs.map(serializeDoc));
  } catch (err) {
    logger.error({ err }, "Error listing documents");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/documents/upload
router.post(
  "/documents/upload",
  requireAuth,
  requirePermission("quotes", "edit"),
  (req, res, next) => {
    documentUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError || err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    });
  },
  async (req, res) => {
    try {
      const userId = getUserId(res);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const extMap: Record<string, string> = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      const ext = extMap[file.mimetype] ?? (file.mimetype.split("/")[1] || "bin");
      const objectId = randomUUID();
      const subPath = `documents/${userId}/${objectId}.${ext}`;

      const fileUrl = await objectStorage.uploadObjectBuffer({
        subPath,
        buffer: file.buffer,
        contentType: file.mimetype,
      });

      const [doc] = await db
        .insert(uploadedDocumentsTable)
        .values({
          userId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileUrl,
          status: "pending",
        })
        .returning();

      res.status(201).json(serializeDoc(doc));
    } catch (err) {
      logger.error({ err }, "Error uploading document");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/documents/overview — Pocket 127.7: the Documents screen. Prices are read from the cost entries the AI read (receipts and supplier
// invoices); the list is the documents the company has uploaded (receipts, and old quotes read for prices), each with what was read from it.
router.get("/documents/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const now = new Date();
    const since = new Date(now.getTime() - 190 * 86_400_000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const purposes = ["receipt", "price_intelligence"] as const;
    const [docs, costRows, book, jobs] = await Promise.all([
      db.select().from(uploadedDocumentsTable).where(and(eq(uploadedDocumentsTable.userId, userId), inArray(uploadedDocumentsTable.purpose, [...purposes]))).orderBy(desc(uploadedDocumentsTable.createdAt)).limit(500),
      db.select({ vendor: costEntriesTable.vendor, date: costEntriesTable.date, ai: costEntriesTable.aiExtraction }).from(costEntriesTable)
        .where(and(eq(costEntriesTable.userId, userId), gte(costEntriesTable.date, since), inArray(costEntriesTable.category, ["materials", "equipment", "misc"]))).orderBy(desc(costEntriesTable.date)).limit(3000),
      db.select().from(priceCatalogItemsTable).where(eq(priceCatalogItemsTable.userId, userId)),
      db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status, clientId: projectsTable.clientId }).from(projectsTable).where(eq(projectsTable.userId, userId)).orderBy(desc(projectsTable.createdAt)).limit(300),
    ]);

    const costs: CostLines[] = costRows.map((r) => ({
      vendor: r.vendor, date: r.date,
      lines: Array.isArray(r.ai?.lines) ? r.ai!.lines.map((l) => ({ description: String(l.description ?? ""), unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : null })) : [],
    }));
    const series = priceSeries(costs.map((c) => ({ at: c.date, lines: c.lines })));
    const moved = priceHistory(series, now, 6, 200).filter((p) => p.when);

    // The biggest mover, with who charges what and the price book's old price.
    const top = topMover(series, now);
    let trend = null as null | { name: string; from: number; to: number; changePct: number; points: number[]; invoices: number; stores: { name: string; at: string; price: number }[]; nudge: null | { itemId: string; bookPrice: number; newPrice: number; newCost: number | null } };
    if (top) {
      const item = top.changePct > 0.05 ? book.find((b) => kindOf(b.kind, b.um) === "material" && sameItem(b.nome, top.name) && Number(b.prezzoUnitario) < top.to - 0.004) : undefined;
      let nudge = null as null | { itemId: string; bookPrice: number; newPrice: number; newCost: number | null };
      if (item) {
        const cost = item.unitCost == null ? null : Number(item.unitCost);
        const bookPrice = Number(item.prezzoUnitario);
        nudge = { itemId: item.id, bookPrice, newPrice: cost == null ? top.to : Math.round((bookPrice + (top.to - cost)) * 100) / 100, newCost: cost == null ? null : top.to };
      }
      trend = {
        name: top.name, from: top.from, to: top.to, changePct: top.changePct, points: top.points,
        invoices: costs.filter((c) => c.lines.some((l) => sameItem(l.description, top.name))).length,
        stores: storePrices(costs, top.name), nudge,
      };
    }

    // Key materials: the items with a price history, the latest store and the number of invoices behind it.
    const materials = priceHistory(series, now, 6, 4).map((p) => {
      const mine = costs.filter((c) => c.lines.some((l) => sameItem(l.description, p.name)));
      return { name: p.name, store: mine[0]?.vendor.trim() ?? "", invoices: mine.length, price: p.to, changePct: p.changePct, points: p.points };
    });

    const names = new Map(jobs.map((j) => [j.id, j.name]));
    const clientIds = [...new Set(jobs.map((j) => j.clientId).filter((x): x is string => !!x))];
    const clients = clientIds.length ? new Map((await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds))).map((c) => [c.id, c.name])) : new Map<string, string>();

    const movedNames = moved.map((m) => m.name);
    const list = docs.slice(0, 12).map((d) => {
      const r = readOf(d.extractedData);
      return {
        id: d.id, name: r.vendor || d.fileName, fileName: d.fileName, at: d.createdAt.toISOString(), state: docState(d.status, r.unread), prices: r.prices, unread: r.unread,
        changed: changedIn(r.names, movedNames), projectId: d.projectId, projectName: d.projectId ? names.get(d.projectId) ?? null : null, kind: d.purpose === "receipt" ? "receipt" : "quote",
      };
    });
    const perJob = new Map<string, number>();
    let company = 0;
    for (const d of docs) {
      if (d.projectId && names.has(d.projectId)) perJob.set(d.projectId, (perJob.get(d.projectId) ?? 0) + 1);
      else company++;
    }
    const folders = [...perJob.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => {
      const j = jobs.find((x) => x.id === id)!;
      return { id, name: j.name, clientName: j.clientId ? clients.get(j.clientId) ?? null : null, count };
    });
    const canUpload = roleCan(getActorRole(res), "costs", "edit");
    res.json({
      canUpload,
      files: docs.length,
      readThisMonth: docs.filter((d) => d.status === "done" && d.createdAt >= monthStart).length,
      trend,
      almost: almostReady(series),
      materials,
      docs: list,
      folders,
      company,
      fileUnder: jobs.filter((j) => j.status === "planning" || j.status === "active").slice(0, 6).map((j) => ({ id: j.id, name: j.name })),
    });
  } catch (err) {
    logger.error({ err }, "Error building the documents overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/documents/price-summary
router.get("/documents/price-summary", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    const [{ totalDocs }] = await db
      .select({ totalDocs: count() })
      .from(uploadedDocumentsTable)
      .where(eq(uploadedDocumentsTable.userId, userId));

    const [{ processedDocs }] = await db
      .select({ processedDocs: count() })
      .from(uploadedDocumentsTable)
      .where(
        and(
          eq(uploadedDocumentsTable.userId, userId),
          eq(uploadedDocumentsTable.status, "done")
        )
      );

    const rows = await db
      .select({
        workType: priceIntelligenceTable.workType,
        avgUnitPrice: avg(sql`${priceIntelligenceTable.unitPrice}::numeric`),
        minPrice: min(sql`${priceIntelligenceTable.unitPrice}::numeric`),
        maxPrice: max(sql`${priceIntelligenceTable.unitPrice}::numeric`),
        cnt: count(),
        unit: sql<string | null>`max(${priceIntelligenceTable.unit})`,
        zones: sql<string[]>`array_agg(distinct ${priceIntelligenceTable.zone}) filter (where ${priceIntelligenceTable.zone} is not null)`,
      })
      .from(priceIntelligenceTable)
      .where(eq(priceIntelligenceTable.userId, userId))
      .groupBy(priceIntelligenceTable.workType)
      .orderBy(desc(count()));

    res.json({
      totalDocuments: Number(totalDocs),
      processedDocuments: Number(processedDocs),
      items: rows.map((r) => ({
        workType: r.workType,
        avgUnitPrice: Number(r.avgUnitPrice ?? 0),
        minPrice: Number(r.minPrice ?? 0),
        maxPrice: Number(r.maxPrice ?? 0),
        count: Number(r.cnt),
        unit: r.unit || null,
        zones: Array.isArray(r.zones) ? r.zones.filter(Boolean) : [],
      })),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching price summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

function serializeAlert(a: typeof priceIntelligenceAlertsTable.$inferSelect) {
  return {
    id: a.id,
    workType: a.workType,
    zone: a.zone ?? null,
    previousAvgPrice: Number(a.previousAvgPrice),
    currentAvgPrice: Number(a.currentAvgPrice),
    percentChange: Number(a.percentChange),
    direction: a.direction,
    createdAt: a.createdAt.toISOString(),
  };
}

// GET /api/documents/price-alerts
router.get("/documents/price-alerts", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const alerts = await db
      .select()
      .from(priceIntelligenceAlertsTable)
      .where(
        and(
          eq(priceIntelligenceAlertsTable.userId, userId),
          isNull(priceIntelligenceAlertsTable.dismissedAt)
        )
      )
      .orderBy(desc(priceIntelligenceAlertsTable.createdAt));
    res.json(alerts.map(serializeAlert));
  } catch (err) {
    logger.error({ err }, "Error fetching price alerts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/documents/price-alerts/:id/dismiss
router.post("/documents/price-alerts/:id/dismiss", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const alertId = String(req.params.id);
    const [updated] = await db
      .update(priceIntelligenceAlertsTable)
      .set({ dismissedAt: new Date() })
      .where(
        and(
          eq(priceIntelligenceAlertsTable.id, alertId),
          eq(priceIntelligenceAlertsTable.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.json(serializeAlert(updated));
  } catch (err) {
    logger.error({ err }, "Error dismissing price alert");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/documents/price-comparison — cross-supplier comparison for work types
// seen from 2+ distinct vendors in the same zone.
router.get("/documents/price-comparison", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    const rows = await db
      .select({
        workType: priceIntelligenceTable.workType,
        zone: priceIntelligenceTable.zone,
        vendor: priceIntelligenceTable.vendor,
        avgPrice: avg(sql`${priceIntelligenceTable.unitPrice}::numeric`),
        cnt: count(),
        unit: sql<string | null>`max(${priceIntelligenceTable.unit})`,
      })
      .from(priceIntelligenceTable)
      .where(
        and(
          eq(priceIntelligenceTable.userId, userId),
          isNotNull(priceIntelligenceTable.vendor)
        )
      )
      .groupBy(priceIntelligenceTable.workType, priceIntelligenceTable.zone, priceIntelligenceTable.vendor);

    type VendorPrice = { vendor: string; avgPrice: number; count: number };
    type ComparisonGroup = { workType: string; zone: string | null; unit: string | null; vendors: VendorPrice[] };
    const groups = new Map<string, ComparisonGroup>();

    for (const r of rows) {
      if (!r.vendor) continue;
      const key = `${r.workType}::${r.zone ?? ""}`;
      let group = groups.get(key);
      if (!group) {
        group = { workType: r.workType, zone: r.zone ?? null, unit: r.unit || null, vendors: [] };
        groups.set(key, group);
      }
      group.vendors.push({ vendor: r.vendor, avgPrice: Number(r.avgPrice ?? 0), count: Number(r.cnt) });
    }

    const comparisons = Array.from(groups.values())
      .filter((g) => g.vendors.length >= 2)
      .map((g) => ({ ...g, vendors: g.vendors.sort((a, b) => a.avgPrice - b.avgPrice) }));

    res.json({ comparisons });
  } catch (err) {
    logger.error({ err }, "Error fetching price comparison");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/documents/:id/extract
router.post("/documents/:id/extract", requireAuth, requirePermission("quotes", "edit"), documentAiLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const docId = String(req.params.id);

    const [doc] = await db
      .select()
      .from(uploadedDocumentsTable)
      .where(
        and(
          eq(uploadedDocumentsTable.id, docId),
          eq(uploadedDocumentsTable.userId, userId)
        )
      );

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    if (doc.status === "processing") {
      res.status(409).json({ error: "Extraction already in progress" });
      return;
    }

    await db
      .update(uploadedDocumentsTable)
      .set({ status: "processing" })
      .where(eq(uploadedDocumentsTable.id, docId));

    try {
      const fileResp = await objectStorage.downloadPrivateObject(
        doc.fileUrl.replace("/objects/", "")
      );
      const buffer = Buffer.from(await fileResp.arrayBuffer());

      let rawContent: string;
      if (doc.mimeType === "application/pdf") {
        rawContent = await extractFromPdf(buffer);
      } else if (doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        rawContent = await extractFromDocx(buffer);
      } else if (doc.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        rawContent = await extractFromXlsx(buffer);
      } else {
        rawContent = await extractFromImage(buffer, doc.mimeType);
      }

      const cleaned = rawContent
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("AI returned invalid JSON");
      }

      const result = extractedDocumentDataSchema.safeParse(parsed);
      const extractedData = result.success ? result.data : { lavorazioni: [], totale: null, zona: null, fornitore: null, note: "Parsing fallito" };

      await db
        .update(uploadedDocumentsTable)
        .set({ status: "done", extractedData, errorMessage: null })
        .where(eq(uploadedDocumentsTable.id, docId));

      await db.delete(priceIntelligenceTable).where(
        and(
          eq(priceIntelligenceTable.userId, userId),
          eq(priceIntelligenceTable.sourceDocumentId, docId)
        )
      );

      if (extractedData.lavorazioni && extractedData.lavorazioni.length > 0) {
        const piRows = extractedData.lavorazioni.map((l) => ({
          userId,
          workType: l.tipo,
          unitPrice: String(l.prezzoUnitario),
          unit: l.um ?? null,
          zone: l.zona ?? extractedData.zona ?? null,
          vendor: extractedData.fornitore ?? null,
          sourceDocumentId: docId,
        }));

        await db.insert(priceIntelligenceTable).values(piRows);
      }

      const [updated] = await db
        .select()
        .from(uploadedDocumentsTable)
        .where(eq(uploadedDocumentsTable.id, docId));

      res.json(serializeDoc(updated));
    } catch (extractErr) {
      logger.error({ err: extractErr, docId }, "Extraction failed");
      await db
        .update(uploadedDocumentsTable)
        .set({
          status: "error",
          errorMessage: extractErr instanceof Error ? extractErr.message : "Unknown error",
        })
        .where(eq(uploadedDocumentsTable.id, docId));

      const [updated] = await db
        .select()
        .from(uploadedDocumentsTable)
        .where(eq(uploadedDocumentsTable.id, docId));

      res.status(422).json({
        error: "Extraction failed",
        document: serializeDoc(updated),
      });
    }
  } catch (err) {
    logger.error({ err }, "Error in extract endpoint");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/documents/:id
router.delete("/documents/:id", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const docId = String(req.params.id);

    const [doc] = await db
      .select()
      .from(uploadedDocumentsTable)
      .where(
        and(
          eq(uploadedDocumentsTable.id, docId),
          eq(uploadedDocumentsTable.userId, userId)
        )
      );

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const subPath = doc.fileUrl.replace("/objects/", "");
    try {
      await objectStorage.deleteObjectBuffer(subPath);
    } catch (e) {
      logger.warn({ err: e, docId }, "Failed to delete object from storage");
    }

    await db
      .delete(uploadedDocumentsTable)
      .where(eq(uploadedDocumentsTable.id, docId));

    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Error deleting document");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
