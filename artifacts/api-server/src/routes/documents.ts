import { Router } from "express";
import multer from "multer";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import {
  db,
  uploadedDocumentsTable,
  priceIntelligenceTable,
  extractedDocumentDataSchema,
} from "@workspace/db";
import { eq, and, desc, avg, min, max, count, sql } from "drizzle-orm";
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

const EXTRACTION_MIME_TYPES = [
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

OUTPUT VALID JSON ONLY, no extra text:
{
  "lavorazioni": [
    { "tipo": "Interior wall painting", "prezzoUnitario": 8.5, "um": "sqft", "zona": "Toronto" }
  ],
  "totale": 15000,
  "zona": "Toronto (ON)",
  "note": "Quote for apartment renovation"
}

If you can't find clear unit prices, return: { "lavorazioni": [], "totale": null, "zona": null, "note": "No unit prices found" }`;

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
      .where(eq(uploadedDocumentsTable.userId, userId))
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

// POST /api/documents/:id/extract
router.post("/documents/:id/extract", requireAuth, documentAiLimiter, async (req, res) => {
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
      const extractedData = result.success ? result.data : { lavorazioni: [], totale: null, zona: null, note: "Parsing fallito" };

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
router.delete("/documents/:id", requireAuth, async (req, res) => {
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
