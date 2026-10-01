import { Router } from "express";
import { z } from "zod";
import { requireAuth, getUserId, getActorRole } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission.js";
import { db, quotesTable, clientsTable, businessProfilesTable, normalizeProvince } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { loadDetail, loadOverview } from "../clients/overview.js";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    const rows = await db
      .select({
        id: sql<string>`md5(concat_ws('|',
          lower(trim(${quotesTable.clientData}->>'nome')),
          coalesce(lower(trim(${quotesTable.clientData}->>'email')), ''),
          coalesce(lower(trim(${quotesTable.clientData}->>'phone')), '')
        ))`,
        clientName: sql<string>`max(${quotesTable.clientData}->>'nome')`,
        email: sql<string | null>`max(${quotesTable.clientData}->>'email')`,
        phone: sql<string | null>`max(${quotesTable.clientData}->>'phone')`,
        quoteCount: sql<number>`count(*)::int`,
        unlockedCount: sql<number>`count(*) filter (where ${quotesTable.status} = 'unlocked')::int`,
        totalValue: sql<number>`sum(${quotesTable.totale}::numeric)::float`,
        unlockedValue: sql<number>`sum(${quotesTable.totale}::numeric) filter (where ${quotesTable.status} = 'unlocked')::float`,
        lastQuoteDate: sql<string>`max(${quotesTable.createdAt})`,
        indirizzo: sql<string | null>`max(${quotesTable.clientData}->>'indirizzo')`,
        city: sql<string | null>`max(${quotesTable.clientData}->>'city')`,
        province: sql<string | null>`max(${quotesTable.clientData}->>'province')`,
        postalCode: sql<string | null>`max(${quotesTable.clientData}->>'postalCode')`,
        partitaIva: sql<string | null>`max(${quotesTable.clientData}->>'partitaIva')`,
        businessNumber: sql<string | null>`max(${quotesTable.clientData}->>'businessNumber')`,
      })
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.userId, userId),
          sql`trim(${quotesTable.clientData}->>'nome') != ''`
        )
      )
      .groupBy(
        sql`lower(trim(${quotesTable.clientData}->>'nome'))`,
        sql`coalesce(lower(trim(${quotesTable.clientData}->>'email')), '')`,
        sql`coalesce(lower(trim(${quotesTable.clientData}->>'phone')), '')`
      )
      .orderBy(desc(sql`max(${quotesTable.createdAt})`));

    res.json(
      rows.map((r) => ({
        id: r.id,
        clientName: r.clientName,
        email: r.email || null,
        phone: r.phone || null,
        quoteCount: r.quoteCount,
        unlockedCount: r.unlockedCount ?? 0,
        totalValue: r.totalValue ?? 0,
        unlockedValue: r.unlockedValue ?? 0,
        lastQuoteDate: r.lastQuoteDate,
        indirizzo: r.indirizzo || null,
        city: r.city || null,
        province: r.province || null,
        postalCode: r.postalCode || null,
        partitaIva: r.partitaIva || null,
        businessNumber: r.businessNumber || null,
      }))
    );
  } catch (err) {
    logger.error({ err }, "Error listing clients");
    res.status(500).json({ error: "Internal server error" });
  }
});


// ── Pocket (Phase 125): the phone's Clients tab and Client screen ───────────
// GET /api/clients/overview: every client with what they have bought, what they owe and what
// happened last, plus the strip's totals. GET /api/clients/:id/overview: one client with their
// quotes, invoices and jobs. PUT /api/clients/:id/details: edit the record (name, contact, address,
// notes). These use the real client records (clients.id), not the md5 ids of the legacy list below.
const profileOf = async (userId: string) => (await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)))[0];

router.get("/clients/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    res.json(await loadOverview(userId, getActorRole(res), await profileOf(userId)));
  } catch (err) {
    logger.error({ err }, "Error loading the clients overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(404).json({ error: "Not found" }); return; }
    const detail = await loadDetail(userId, getActorRole(res), await profileOf(userId), id);
    if (!detail) { res.status(404).json({ error: "Not found" }); return; }
    res.json(detail);
  } catch (err) {
    logger.error({ err }, "Error loading a client");
    res.status(500).json({ error: "Internal server error" });
  }
});

const clientDetailsBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  province: z.string().trim().max(40).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  notes: z.string().max(5000).optional(),
  type: z.enum(["individual", "business"]).optional(),
  preferredLanguage: z.enum(["en", "fr"]).optional(),
});

router.put("/clients/:id/details", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(404).json({ error: "Not found" }); return; }
    const body = clientDetailsBody.safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    if (d.email && !d.email.includes("@")) { res.status(400).json({ error: "Invalid parameters", message: "That email address doesn't look right." }); return; }
    const set: Partial<typeof clientsTable.$inferInsert> = {};
    if (d.name !== undefined) set.name = d.name;
    if (d.email !== undefined) set.email = d.email || null;
    if (d.phone !== undefined) set.phone = d.phone || null;
    if (d.address !== undefined) set.address = d.address || null;
    if (d.city !== undefined) set.city = d.city || null;
    if (d.province !== undefined) set.province = d.province ? normalizeProvince(d.province) ?? d.province.toUpperCase().slice(0, 2) : null;
    if (d.postalCode !== undefined) set.postalCode = d.postalCode || null;
    if (d.notes !== undefined) set.notes = d.notes;
    if (d.type !== undefined) set.type = d.type;
    if (d.preferredLanguage !== undefined) set.preferredLanguage = d.preferredLanguage;
    // The dedup key is left alone on purpose: the client portal addresses a client by md5(dedup_key).
    const [updated] = Object.keys(set).length
      ? await db.update(clientsTable).set(set).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId))).returning({ id: clientsTable.id })
      : await db.select({ id: clientsTable.id }).from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)));
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const detail = await loadDetail(userId, getActorRole(res), await profileOf(userId), id);
    res.json(detail);
  } catch (err) {
    logger.error({ err }, "Error editing a client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/quotes", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const clientId = req.params.id;

    const quotes = await db
      .select()
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.userId, userId),
          sql`md5(concat_ws('|',
            lower(trim(${quotesTable.clientData}->>'nome')),
            coalesce(lower(trim(${quotesTable.clientData}->>'email')), ''),
            coalesce(lower(trim(${quotesTable.clientData}->>'phone')), '')
          )) = ${clientId}`
        )
      )
      .orderBy(desc(quotesTable.createdAt));

    res.json(
      quotes.map((q) => ({
        id: q.id,
        userId: q.userId,
        clientData: q.clientData,
        descrizioneGenerale: q.descrizioneGenerale,
        items: q.items,
        capitoli: q.capitoli ?? [],
        sconto: q.sconto ?? null,
        condizioniPagamento: q.condizioniPagamento ?? [],
        titoloPreventivoRiga1: q.titoloPreventivoRiga1 ?? null,
        titoloPreventivoRiga2: q.titoloPreventivoRiga2 ?? null,
        numeroPreventivoData: q.numeroPreventivoData ?? null,
        companySnapshot: q.companySnapshot ?? null,
        subtotale: Number(q.subtotale),
        ivaPercentuale: Number(q.ivaPercentuale),
        ivaValore: Number(q.ivaValore),
        totale: Number(q.totale),
        note: q.note,
        status: q.status,
        pdfUrl: q.pdfUrl ?? null,
        rawInput: q.rawInput,
        pdfDownloadedAt: q.pdfDownloadedAt?.toISOString() ?? null,
        capitolatoPro: q.capitolatoPro,
        capitolatoPdfUrl: q.capitolatoPdfUrl ?? null,
        templateId: q.templateId ?? null,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "Error listing client quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
