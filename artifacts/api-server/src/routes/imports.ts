import { Router } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import {
  db,
  importBatchesTable,
  quoteImportCandidatesTable,
  quotesTable,
  clientsTable,
  uploadedDocumentsTable,
  businessProfilesTable,
  clientDedupKey,
  importedQuoteExtractionSchema,
  type ImportedQuoteExtraction,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { ensureClientForQuote } from "../lib/clients.js";
import { logger } from "../lib/logger.js";
import { parseSpreadsheet } from "../imports/parseSpreadsheet.js";
import { readImportedQuotePdf } from "../imports/quoteImportAi.js";
import { currentActorId } from "../lib/requestContext.js";

// ── Phase 14: data migration / import ────────────────────────────────────────
// A company uploads a CSV/Excel of past quotes, or PDFs of old quotes. Every
// row/document becomes a `quote_import_candidates` row the company reviews
// and confirms (or rejects) — nothing is written to `quotes` automatically.

const router = Router();
const objectStorage = new ObjectStorageService();

const importLimiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, message: "Hourly import limit reached. Try again later." });

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.mimetype) || /\.(csv|xlsx|xls)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Use a .csv or .xlsx file.`));
  },
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Use a PDF.`));
  },
});

async function ownedBatch(userId: string, id: string) {
  const [batch] = await db.select().from(importBatchesTable).where(and(eq(importBatchesTable.id, id), eq(importBatchesTable.userId, userId)));
  return batch ?? null;
}

/** Writes one confirmed candidate as a real historical quote. Caller has already checked status/clientName. */
type CompanySnapshot = { companyName: string; vatNumber?: string; address?: string; phone?: string; email?: string; logoUrl?: string } | null;

async function createQuoteFromCandidate(userId: string, candidate: typeof quoteImportCandidatesTable.$inferSelect, companySnapshot: CompanySnapshot) {
  const extraction = candidate.extraction as ImportedQuoteExtraction;
  const items = extraction.items.length > 0 ? extraction.items : [{ description: "Imported quote", quantity: 1, unitPrice: extraction.total, total: extraction.total }];
  const subtotale = Math.round(items.reduce((s, it) => s + (it.total ?? 0), 0) * 100) / 100;
  const totale = extraction.total ?? subtotale;
  const clientData = {
    nome: extraction.clientName!,
    indirizzo: extraction.address ?? "",
    email: extraction.email ?? undefined,
    phone: extraction.phone ?? undefined,
    city: extraction.city ?? undefined,
    postalCode: extraction.postalCode ?? undefined,
    province: extraction.province ?? undefined,
  };
  const createdAt = extraction.date ? new Date(`${extraction.date}T12:00:00Z`) : new Date();

  const [quote] = await db
    .insert(quotesTable)
    .values({
      userId,
      createdByUserId: currentActorId(),
      clientData,
      descrizioneGenerale: extraction.notes ?? "Imported historical quote",
      items: items.map((it) => ({ descrizione: it.description, quantita: it.quantity ?? 1, unita: "pz", prezzoUnitario: it.unitPrice ?? (it.total ?? 0), totale: it.total ?? 0 })),
      subtotale: String(subtotale),
      ivaPercentuale: "0",
      ivaValore: "0",
      totale: String(totale),
      status: extraction.status === "accepted" ? "accepted" : "draft",
      source: "import",
      rawInput: `[Imported] ${candidate.id}`,
      companySnapshot,
      createdAt,
      acceptedAt: extraction.status === "accepted" ? createdAt : null,
    })
    .returning();

  const clientId = await ensureClientForQuote(userId, clientData);
  await db.update(quotesTable).set({ clientId, province: extraction.province ?? null }).where(eq(quotesTable.id, quote!.id));
  await db.update(quoteImportCandidatesTable).set({ status: "confirmed", createdQuoteId: quote!.id, matchedClientId: clientId, confirmedAt: new Date() }).where(eq(quoteImportCandidatesTable.id, candidate.id));
  return { quoteId: quote!.id, clientId };
}

/** Read-only preview of which existing client a candidate would match, without creating anything. */
async function previewClientMatch(userId: string, extraction: ImportedQuoteExtraction): Promise<string | null> {
  if (!extraction.clientName) return null;
  const dedupKey = clientDedupKey({ name: extraction.clientName, email: extraction.email, phone: extraction.phone });
  const [existing] = await db.select({ id: clientsTable.id }).from(clientsTable).where(and(eq(clientsTable.userId, userId), eq(clientsTable.dedupKey, dedupKey)));
  return existing?.id ?? null;
}

// GET /api/imports/template.csv — downloadable starter template
router.get("/imports/template.csv", requireAuth, (_req, res) => {
  const header = "Client Name,Email,Phone,Address,City,Province,Postal Code,Quote Date,Status,Description,Quantity,Unit Price,Total,Notes\n";
  const example = "John Smith,john@example.com,613-555-0100,123 Main St,Ottawa,ON,K1A0B1,2025-03-15,accepted,Bathroom renovation,1,8500,8500,Paid in full\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=quoteai-import-template.csv");
  res.send(header + example);
});

// GET /api/imports/batches — list this company's import batches
router.get("/imports/batches", requireAuth, requirePermission("imports", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const batches = await db.select().from(importBatchesTable).where(eq(importBatchesTable.userId, userId)).orderBy(desc(importBatchesTable.createdAt)).limit(50);
    res.json({ batches });
  } catch (err) {
    req.log.error({ err }, "Error listing import batches");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/imports/candidates?batchId= — review queue (defaults to pending_review across all batches)
router.get("/imports/candidates", requireAuth, requirePermission("imports", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const batchId = typeof req.query.batchId === "string" ? req.query.batchId : null;
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "pending_review";
    const conditions = [eq(quoteImportCandidatesTable.userId, userId)];
    if (batchId) conditions.push(eq(quoteImportCandidatesTable.batchId, batchId));
    if (statusFilter !== "all") conditions.push(eq(quoteImportCandidatesTable.status, statusFilter as "pending_review" | "confirmed" | "rejected"));
    const candidates = await db.select().from(quoteImportCandidatesTable).where(and(...conditions)).orderBy(desc(quoteImportCandidatesTable.createdAt)).limit(500);
    res.json({ candidates });
  } catch (err) {
    req.log.error({ err }, "Error listing import candidates");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/imports/spreadsheet — multipart { file } (CSV or XLSX) → one candidate per row
router.post(
  "/imports/spreadsheet",
  requireAuth,
  requirePermission("imports", "edit"),
  importLimiter,
  (req, res, next) => {
    spreadsheetUpload.single("file")(req, res, (err) => {
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
      const kind: "csv" | "xlsx" = /\.csv$/i.test(file.originalname) || file.mimetype === "text/csv" ? "csv" : "xlsx";
      const [batch] = await db.insert(importBatchesTable).values({ userId, kind, fileName: file.originalname, status: "processing" }).returning();

      let rows: ReturnType<typeof parseSpreadsheet>;
      try {
        rows = parseSpreadsheet(file.buffer);
      } catch (err) {
        logger.warn({ err, batchId: batch!.id }, "Spreadsheet parse failed");
        await db.update(importBatchesTable).set({ status: "error", errorMessage: err instanceof Error ? err.message : "Parse error" }).where(eq(importBatchesTable.id, batch!.id));
        res.status(400).json({ error: "Could not read that file. Check it's a valid CSV or Excel export." });
        return;
      }

      if (rows.length === 0) {
        await db.update(importBatchesTable).set({ status: "error", errorMessage: "No usable rows found" }).where(eq(importBatchesTable.id, batch!.id));
        res.status(400).json({ error: "No usable rows found — check the file has a client name, description, or total in each row." });
        return;
      }

      const values = await Promise.all(
        rows.map(async (r, i) => ({
          batchId: batch!.id,
          userId,
          rowIndex: i,
          rawRow: r.rawRow,
          extraction: r.extraction,
          matchedClientId: await previewClientMatch(userId, r.extraction),
        })),
      );
      await db.insert(quoteImportCandidatesTable).values(values);
      await db.update(importBatchesTable).set({ status: "done", totalRows: rows.length }).where(eq(importBatchesTable.id, batch!.id));

      res.status(201).json({ batchId: batch!.id, totalRows: rows.length });
    } catch (err) {
      req.log.error({ err }, "Error importing spreadsheet");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/imports/pdf — multipart { files[] } (up to 20 PDFs) → one candidate per PDF, AI-read
router.post(
  "/imports/pdf",
  requireAuth,
  requirePermission("imports", "edit"),
  importLimiter,
  (req, res, next) => {
    pdfUpload.array("files", 20)(req, res, (err) => {
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
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
      }
      const [batch] = await db.insert(importBatchesTable).values({ userId, kind: "pdf", fileName: files.length === 1 ? files[0]!.originalname : `${files.length} PDFs`, status: "processing" }).returning();

      let ok = 0;
      let failed = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        try {
          const subPath = `imports/${userId}/${randomUUID()}.pdf`;
          const fileUrl = await objectStorage.uploadObjectBuffer({ subPath, buffer: file.buffer, contentType: file.mimetype });
          const [doc] = await db.insert(uploadedDocumentsTable).values({ userId, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype, fileUrl, status: "processing", purpose: "import_pdf" }).returning();

          const extraction = await readImportedQuotePdf({ buffer: file.buffer, userId });
          if (!extraction) {
            await db.update(uploadedDocumentsTable).set({ status: "error", errorMessage: "No extractable text" }).where(eq(uploadedDocumentsTable.id, doc!.id));
            await db.insert(quoteImportCandidatesTable).values({
              batchId: batch!.id,
              userId,
              rowIndex: i,
              status: "pending_review",
              extraction: { clientName: null, email: null, phone: null, address: null, city: null, province: null, postalCode: null, date: null, status: "draft", items: [], total: null, notes: `Could not read ${file.originalname} — please fill in by hand.`, confidence: "low" },
              errorMessage: "No extractable text in this PDF",
            });
            failed++;
            continue;
          }
          await db.update(uploadedDocumentsTable).set({ status: "done", extractedData: extraction }).where(eq(uploadedDocumentsTable.id, doc!.id));
          await db.insert(quoteImportCandidatesTable).values({
            batchId: batch!.id,
            userId,
            rowIndex: i,
            status: "pending_review",
            extraction,
            matchedClientId: await previewClientMatch(userId, extraction),
          });
          ok++;
        } catch (err) {
          logger.warn({ err, fileName: file.originalname }, "Failed to import one PDF");
          failed++;
        }
      }

      await db.update(importBatchesTable).set({ status: ok > 0 ? "done" : "error", totalRows: files.length, errorMessage: failed > 0 ? `${failed} of ${files.length} file(s) could not be read` : null }).where(eq(importBatchesTable.id, batch!.id));
      res.status(201).json({ batchId: batch!.id, totalRows: files.length, ok, failed });
    } catch (err) {
      req.log.error({ err }, "Error importing PDFs");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PUT /api/imports/candidates/:id — edit the extraction before confirming
router.put("/imports/candidates/:id", requireAuth, requirePermission("imports", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [candidate] = await db.select().from(quoteImportCandidatesTable).where(and(eq(quoteImportCandidatesTable.id, req.params.id as string), eq(quoteImportCandidatesTable.userId, userId)));
    if (!candidate) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (candidate.status !== "pending_review") {
      res.status(409).json({ error: "ALREADY_RESOLVED", message: "This candidate was already confirmed or rejected." });
      return;
    }
    const body = importedQuoteExtractionSchema.safeParse(req.body?.extraction);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const matchedClientId = await previewClientMatch(userId, body.data);
    const [updated] = await db.update(quoteImportCandidatesTable).set({ extraction: body.data, matchedClientId }).where(eq(quoteImportCandidatesTable.id, candidate.id)).returning();
    res.json({ candidate: updated });
  } catch (err) {
    req.log.error({ err }, "Error editing import candidate");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/imports/candidates/:id/reject
router.post("/imports/candidates/:id/reject", requireAuth, requirePermission("imports", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [candidate] = await db.select().from(quoteImportCandidatesTable).where(and(eq(quoteImportCandidatesTable.id, req.params.id as string), eq(quoteImportCandidatesTable.userId, userId)));
    if (!candidate) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (candidate.status !== "pending_review") {
      res.status(409).json({ error: "ALREADY_RESOLVED" });
      return;
    }
    await db.update(quoteImportCandidatesTable).set({ status: "rejected" }).where(eq(quoteImportCandidatesTable.id, candidate.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error rejecting import candidate");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/imports/candidates/:id/confirm — writes a real historical quote
router.post("/imports/candidates/:id/confirm", requireAuth, requirePermission("imports", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [candidate] = await db.select().from(quoteImportCandidatesTable).where(and(eq(quoteImportCandidatesTable.id, req.params.id as string), eq(quoteImportCandidatesTable.userId, userId)));
    if (!candidate) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (candidate.status !== "pending_review") {
      res.status(409).json({ error: "ALREADY_RESOLVED", message: "This candidate was already confirmed or rejected." });
      return;
    }
    const extraction = candidate.extraction as ImportedQuoteExtraction;
    if (!extraction.clientName?.trim()) {
      res.status(400).json({ error: "MISSING_CLIENT", message: "Add a client name before confirming." });
      return;
    }

    const [bp] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const companySnapshot: CompanySnapshot = bp ? { companyName: bp.companyName, vatNumber: bp.vatNumber ?? undefined, address: bp.address ?? undefined, phone: bp.phone ?? undefined, email: bp.email ?? undefined, logoUrl: bp.logoUrl ?? undefined } : null;
    const { quoteId, clientId } = await createQuoteFromCandidate(userId, candidate, companySnapshot);
    res.json({ quoteId, clientId });
  } catch (err) {
    req.log.error({ err }, "Error confirming import candidate");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/imports/candidates/confirm-all — bulk-confirm every pending candidate in a batch that has a client name
router.post("/imports/batches/:id/confirm-all", requireAuth, requirePermission("imports", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const batch = await ownedBatch(userId, req.params.id as string);
    if (!batch) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const pending = await db.select().from(quoteImportCandidatesTable).where(and(eq(quoteImportCandidatesTable.batchId, batch.id), eq(quoteImportCandidatesTable.status, "pending_review")));
    let confirmed = 0;
    let skipped = 0;
    for (const candidate of pending) {
      const extraction = candidate.extraction as ImportedQuoteExtraction;
      if (!extraction.clientName?.trim()) {
        skipped++;
        continue;
      }
      await createQuoteFromCandidate(userId, candidate, null);
      confirmed++;
    }
    res.json({ confirmed, skipped });
  } catch (err) {
    req.log.error({ err }, "Error bulk-confirming import batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/imports/batches/:id
router.delete("/imports/batches/:id", requireAuth, requirePermission("imports", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const batch = await ownedBatch(userId, req.params.id as string);
    if (!batch) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(quoteImportCandidatesTable).where(eq(quoteImportCandidatesTable.batchId, batch.id));
    await db.delete(importBatchesTable).where(eq(importBatchesTable.id, batch.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting import batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
