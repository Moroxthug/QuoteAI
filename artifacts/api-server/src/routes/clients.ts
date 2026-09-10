import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { db, quotesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";

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
