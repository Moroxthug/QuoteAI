import { Router } from "express";
import multer from "multer";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission.js";
import { db, priceCatalogItemsTable, quotesTable, businessProfilesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { catalogOwnerIds } from "../groups/service.js";
import type { QuoteChapter } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { extractFromPdf, extractFromDocx, extractFromXlsx } from "../lib/extractDocument.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { z } from "zod";
import { CreateCatalogItemBody, BulkCreateCatalogItemsBodyItem, UpdateCatalogItemBody } from "@workspace/api-zod";

// The generated contract, with the lengths and "not blank" the handlers always required.
const catalogFields = {
  nome: z.string().trim().min(1).max(500),
  categoria: z.string().max(200).optional(),
  um: z.string().trim().min(1).max(30),
  prezzoUnitario: z.number().finite().min(-10_000_000).max(10_000_000),
  note: z.string().max(2000).optional(),
};
const CatalogItemSchema = CreateCatalogItemBody.extend(catalogFields);
const BulkCatalogSchema = z.array(BulkCreateCatalogItemsBodyItem.extend(catalogFields)).max(5000);
const CatalogUpdateSchema = UpdateCatalogItemBody.extend({ nome: catalogFields.nome.optional(), categoria: z.string().max(200).nullable().optional(), um: catalogFields.um.optional(), prezzoUnitario: catalogFields.prezzoUnitario.optional(), note: z.string().max(2000).nullable().optional() });

const router = Router();

const OCR_ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const OCR_ALLOWED_DOC_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const OCR_ALLOWED_MIMES = [...OCR_ALLOWED_IMAGE_MIMES, ...OCR_ALLOWED_DOC_MIMES];

const catalogOcrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (OCR_ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported format: ${file.mimetype}. Use JPG, PNG, WEBP, HEIC, PDF, DOCX, or XLSX.`));
    }
  },
});

// Importing the price list via OCR is an occasional operation (not repeated
// for every quote like AI generation), so a lower hourly cap is enough to
// contain costs without getting in the way of normal use.
const catalogOcrLimiter = userRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: "You have reached the hourly limit for price-list imports. Please try again later.",
});

const OCR_PROMPT = `You are an assistant that extracts a PRICE LIST from an image (a photo of a printed or on-screen price list) or from text extracted from a document (PDF, DOCX, XLSX).

For each price-list item you find, return an object with:
- nome: description of the work item or product
- categoria: general category (e.g. "Painting", "Electrical", "Plumbing", "General Construction"), null if it can't be inferred
- um: unit of measure, one of sqft, linear ft, cubic ft, each, hours, kg, "lump sum", pieces, kw, litres, tonnes, m, %
- prezzoUnitario: number (just the CAD figure, no symbol or thousands separators)
- note: any additional details, empty string if none

CORE RULES:
1. Extract ONLY items with a unit price that is clearly readable or inferable from context. If a line has no readable price, discard it — do not invent prices.
2. If a price is given as a range (e.g. "$10-15"), use the average value.
3. Correct obvious OCR typos only when context makes them unambiguous; when in doubt, discard the item rather than guess.
4. Maximum 200 items.

OUTPUT: A valid JSON array ONLY, no extra text or markdown:
[{ "nome": "...", "categoria": "...", "um": "...", "prezzoUnitario": 0, "note": "" }]`;

function serializeItem(item: typeof priceCatalogItemsTable.$inferSelect, shared?: { companyName: string }) {
  return {
    shared: !!shared,
    sharedFrom: shared?.companyName ?? null,
    id: item.id,
    userId: item.userId,
    nome: item.nome,
    categoria: item.categoria ?? null,
    um: item.um,
    prezzoUnitario: Number(item.prezzoUnitario),
    note: item.note ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.get("/catalog", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    // Phase 90: a group company also reads the group's catalog (read-only here).
    const owners = await catalogOwnerIds(userId);
    const items = await db
      .select()
      .from(priceCatalogItemsTable)
      .where(inArray(priceCatalogItemsTable.userId, owners))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome);
    const others = owners.filter((o) => o !== userId);
    const names = new Map(others.length ? (await db.select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(inArray(businessProfilesTable.userId, others))).map((p) => [p.userId, p.companyName]) : []);
    res.json(items.map((i) => serializeItem(i, i.userId === userId ? undefined : { companyName: names.get(i.userId) || "" })));
  } catch (err) {
    req.log.error({ err }, "Error listing catalog items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/catalog", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = CatalogItemSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "nome, um, and prezzoUnitario are required", details: parsed.error });
      return;
    }
    const { nome, categoria, um, prezzoUnitario, note } = parsed.data;

    const [created] = await db
      .insert(priceCatalogItemsTable)
      .values({
        userId,
        nome: nome.trim(),
        categoria: categoria?.trim() || null,
        um: um.trim(),
        prezzoUnitario: String(prezzoUnitario),
        note: note?.trim() || null,
      })
      .returning();

    res.status(201).json(serializeItem(created));
  } catch (err) {
    req.log.error({ err }, "Error creating catalog item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/catalog/bulk", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = BulkCatalogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "body must be an array of items, each with nome, um and prezzoUnitario", details: parsed.error });
      return;
    }
    const items = parsed.data;

    const inserted = [];
    if (items.length > 0) {
      const values = items.map(item => {
        return {
          userId,
          nome: item.nome.trim(),
          categoria: item.categoria?.trim() || null,
          um: item.um.trim(),
          prezzoUnitario: String(item.prezzoUnitario),
          note: item.note?.trim() || null,
        };
      });

      const result = await db.insert(priceCatalogItemsTable).values(values).returning();
      inserted.push(...result.map((i) => serializeItem(i)));
    }

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Error bulk creating catalog items");
    res.status(500).json({ error: (err instanceof Error ? err.message : "Internal server error") });
  }
});


router.post("/catalog/import-from-quotes", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);

    const quotes = await db
      .select({ capitoli: quotesTable.capitoli })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId));

    const existing = await db
      .select({ nome: priceCatalogItemsTable.nome, um: priceCatalogItemsTable.um })
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId));

    const existingKeys = new Set(
      existing.map(e => `${e.nome.toLowerCase().trim()}|${e.um.toLowerCase().trim()}`)
    );

    const seen = new Map<string, { nome: string; um: string; prezzoUnitario: number; count: number }>();

    for (const quote of quotes) {
      const capitoli = quote.capitoli as QuoteChapter[] | null;
      if (!Array.isArray(capitoli)) continue;
      for (const cap of capitoli) {
        for (const voce of cap.voci) {
          const key = `${voce.descrizione.toLowerCase().trim()}|${voce.um.toLowerCase().trim()}`;
          if (existingKeys.has(key)) continue;
          const current = seen.get(key);
          if (current) {
            current.prezzoUnitario =
              (current.prezzoUnitario * current.count + voce.prezzoUnitario) / (current.count + 1);
            current.count++;
          } else {
            seen.set(key, {
              nome: voce.descrizione.trim(),
              um: voce.um.trim(),
              prezzoUnitario: voce.prezzoUnitario,
              count: 1,
            });
          }
        }
      }
    }

    const toInsert = Array.from(seen.values());
    let imported = 0;
    const skipped = existing.length;

    if (toInsert.length > 0) {
      await db.insert(priceCatalogItemsTable).values(
        toInsert.map(item => ({
          userId,
          nome: item.nome,
          um: item.um,
          prezzoUnitario: String(Math.round(item.prezzoUnitario * 100) / 100),
          categoria: null,
          note: null,
        }))
      );
      imported = toInsert.length;
    }

    res.json({ imported, skipped });
  } catch (err) {
    req.log.error({ err }, "Error importing catalog from quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/catalog/import-ocr — reads a photo or document of the user's
// price list and extracts the items via AI. Returns only a PREVIEW:
// the actual insert happens via a separate call to POST /catalog/bulk
// after the user has reviewed/corrected the items, so an OCR reading
// error doesn't silently pollute the price list.
router.post(
  "/catalog/import-ocr",
  requireAuth,
  requirePermission("quotes", "edit"),
  catalogOcrLimiter,
  catalogOcrUpload.array("files", 3),
  async (req, res) => {
    try {
      const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
      if (uploadedFiles.length === 0) {
        res.status(400).json({ error: "Upload at least one photo or document of your price list." });
        return;
      }

      const imageFiles = uploadedFiles.filter(f => OCR_ALLOWED_IMAGE_MIMES.includes(f.mimetype));
      const docFiles = uploadedFiles.filter(f => OCR_ALLOWED_DOC_MIMES.includes(f.mimetype));

      const imageDataUrls = imageFiles.map(
        (f) => `data:${f.mimetype};base64,${f.buffer.toString("base64")}`
      );

      const docTexts: string[] = [];
      for (const f of docFiles) {
        let text = "";
        if (f.mimetype === "application/pdf") text = await extractFromPdf(f.buffer);
        else if (f.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") text = await extractFromDocx(f.buffer);
        else if (f.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") text = await extractFromXlsx(f.buffer);
        if (text) docTexts.push(`--- File: ${f.originalname} ---\n${text}`);
      }

      const hasImages = imageDataUrls.length > 0;
      if (!hasImages && docTexts.length === 0) {
        res.status(422).json({ error: "Could not read any content from the uploaded files." });
        return;
      }

      const userText = docTexts.length > 0
        ? `Text extracted from the uploaded document(s):\n\n${docTexts.join("\n\n")}`
        : "Extract the price list from the attached images.";

      const targetModel = hasImages ? "gpt-4o" : "gpt-4o-mini";
      const completion = await openai.chat.completions.create({
        model: targetModel,
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: OCR_PROMPT },
          {
            role: "user",
            content: hasImages
              ? [
                  { type: "text" as const, text: userText },
                  ...imageDataUrls.map(img => ({
                    type: "image_url" as const,
                    image_url: { url: img, detail: "high" as const },
                  })),
                ]
              : userText,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content ?? "[]";
      let parsedItems: any[] = [];
      try {
        const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        const parsed = JSON.parse(cleaned);
        parsedItems = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
      } catch (err) {
        req.log.error({ err, content }, "Failed to parse OCR catalog JSON");
        res.status(422).json({ error: "The AI couldn't read a price list from these files. Try a clearer photo." });
        return;
      }

      const items = parsedItems
        .filter((it) => it && it.nome && it.um && it.prezzoUnitario !== undefined && it.prezzoUnitario !== null)
        .slice(0, 200)
        .map((it) => ({
          nome: String(it.nome).trim(),
          categoria: it.categoria ? String(it.categoria).trim() : null,
          um: String(it.um).trim(),
          prezzoUnitario: Number(it.prezzoUnitario) || 0,
          note: it.note ? String(it.note).trim() : null,
        }));

      if (items.length === 0) {
        res.status(422).json({ error: "No item with a readable price was found in these files." });
        return;
      }

      res.json({ items });
    } catch (err) {
      req.log.error({ err }, "Error importing catalog via OCR");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.put("/catalog/:id", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id);
    const parsed = CatalogUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }
    const { nome, categoria, um, prezzoUnitario, note } = parsed.data;

    const updates: Partial<typeof priceCatalogItemsTable.$inferInsert> = {};
    if (nome !== undefined) updates.nome = nome.trim();
    if (categoria !== undefined) updates.categoria = categoria?.trim() || null;
    if (um !== undefined) updates.um = um.trim();
    if (prezzoUnitario !== undefined) updates.prezzoUnitario = String(prezzoUnitario);
    if (note !== undefined) updates.note = note?.trim() || null;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" }); // drizzle throws on an empty set()
      return;
    }

    const [updated] = await db
      .update(priceCatalogItemsTable)
      .set(updates)
      .where(and(eq(priceCatalogItemsTable.id, id), eq(priceCatalogItemsTable.userId, userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json(serializeItem(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating catalog item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/catalog/:id", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id);

    const deleted = await db
      .delete(priceCatalogItemsTable)
      .where(and(eq(priceCatalogItemsTable.id, id), eq(priceCatalogItemsTable.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting catalog item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
