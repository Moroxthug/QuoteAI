import { Router } from "express";
import { db, quotesTable, clientsTable, invoicesTable, contractsTable, projectsTable, type QuoteClientData } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";

const router = Router();

type ArchiveItem = {
  id: string;
  type: "quote" | "client" | "invoice" | "job" | "contract";
  label: string;
  archivedAt: string;
  archivedByName: string | null;
};

// GET /api/archive — everything soft-archived across the 5 entities, newest-archived first.
router.get("/archive", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    const [quotes, clients, invoices, jobs, contracts] = await Promise.all([
      db.select({ id: quotesTable.id, clientData: quotesTable.clientData, archivedAt: quotesTable.archivedAt, archivedByName: quotesTable.archivedByName })
        .from(quotesTable).where(and(eq(quotesTable.userId, userId), isNotNull(quotesTable.archivedAt))),
      db.select({ id: clientsTable.id, name: clientsTable.name, archivedAt: clientsTable.archivedAt, archivedByName: clientsTable.archivedByName })
        .from(clientsTable).where(and(eq(clientsTable.userId, userId), isNotNull(clientsTable.archivedAt))),
      db.select({ id: invoicesTable.id, number: invoicesTable.number, archivedAt: invoicesTable.archivedAt, archivedByName: invoicesTable.archivedByName })
        .from(invoicesTable).where(and(eq(invoicesTable.userId, userId), isNotNull(invoicesTable.archivedAt))),
      db.select({ id: projectsTable.id, name: projectsTable.name, archivedAt: projectsTable.archivedAt, archivedByName: projectsTable.archivedByName })
        .from(projectsTable).where(and(eq(projectsTable.userId, userId), isNotNull(projectsTable.archivedAt))),
      db.select({ id: contractsTable.id, contractNumber: contractsTable.contractNumber, archivedAt: contractsTable.archivedAt, archivedByName: contractsTable.archivedByName })
        .from(contractsTable).where(and(eq(contractsTable.userId, userId), isNotNull(contractsTable.archivedAt))),
    ]);

    const items: ArchiveItem[] = [
      ...quotes.map((q) => ({
        id: q.id,
        type: "quote" as const,
        label: `Quote — ${(q.clientData as QuoteClientData | null)?.nome || "Untitled"}`,
        archivedAt: q.archivedAt!.toISOString(),
        archivedByName: q.archivedByName,
      })),
      ...clients.map((c) => ({
        id: c.id,
        type: "client" as const,
        label: c.name,
        archivedAt: c.archivedAt!.toISOString(),
        archivedByName: c.archivedByName,
      })),
      ...invoices.map((i) => ({
        id: i.id,
        type: "invoice" as const,
        label: `Invoice ${i.number}`,
        archivedAt: i.archivedAt!.toISOString(),
        archivedByName: i.archivedByName,
      })),
      ...jobs.map((j) => ({
        id: j.id,
        type: "job" as const,
        label: j.name,
        archivedAt: j.archivedAt!.toISOString(),
        archivedByName: j.archivedByName,
      })),
      ...contracts.map((c) => ({
        id: c.id,
        type: "contract" as const,
        label: `Contract ${c.contractNumber}`,
        archivedAt: c.archivedAt!.toISOString(),
        archivedByName: c.archivedByName,
      })),
    ].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));

    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "Error listing archive");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
