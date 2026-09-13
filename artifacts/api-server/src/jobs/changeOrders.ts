import {
  db,
  changeOrdersTable,
  contractsTable,
  contractSignersTable,
  projectsTable,
  milestonesTable,
  computeTax,
  type Contract,
  type ContractDocument,
  type ContractSection,
  type ContractVariables,
  type ChangeOrder,
  type ChangeOrderItem,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logContractEvent } from "../contracts/service.js";
import { TEMPLATE_VERSION } from "../contracts/templates.js";
import { fmtDate, fmtMoney } from "../contracts/render.js";
import { createNotification, writeAudit } from "../lib/notifications.js";
import { addCalendarDays } from "./dates.js";

// ── Change orders ────────────────────────────────────────────────────────────
// The signable document is a `contracts` row (kind = change_order) so the
// Phase 1 flow — contractor signs, sends, customer verifies by OTP and signs,
// PDF + audit certificate — is reused unchanged. Once fully signed the
// contract.signed automation calls `applySignedChangeOrder`, which adds the
// amount to the job and shifts the remaining schedule.

type Lang = "en" | "fr";
const L = (en: string, fr: string, lang: Lang) => (lang === "fr" ? fr : en);

export function changeOrderTotals(items: ChangeOrderItem[], province: string | null | undefined): { subtotal: number; tax: number; total: number; taxLines: { code: string; label: string; rate: number; amount: number }[] } {
  const subtotal = Math.round(items.reduce((s, i) => s + Number(i.totale || 0), 0) * 100) / 100;
  const calc = computeTax(subtotal, province);
  return {
    subtotal,
    tax: calc.total,
    total: Math.round((subtotal + calc.total) * 100) / 100,
    taxLines: calc.lines.map((l) => ({ code: l.code, label: l.label, rate: l.rate, amount: l.amount })),
  };
}

function buildChangeOrderDocument(params: { parent: Contract; co: { number: string; title: string; description: string; scheduleDeltaDays: number }; variables: ContractVariables; lang: Lang }): ContractDocument {
  const { parent, co, variables: v, lang } = params;
  const delta = co.scheduleDeltaDays;
  const scheduleBody =
    delta > 0
      ? L(`The time for completion under the Agreement is extended by **${delta} calendar days** to account for the additional work described above. All milestone dates that have not yet been reached move accordingly.`,
          `Le délai d'exécution prévu au Contrat est prolongé de **${delta} jours civils** pour tenir compte des travaux additionnels décrits ci-dessus. Les jalons non encore atteints sont reportés en conséquence.`, lang)
      : delta < 0
        ? L(`The time for completion under the Agreement is reduced by **${Math.abs(delta)} calendar days**.`, `Le délai d'exécution prévu au Contrat est réduit de **${Math.abs(delta)} jours civils**.`, lang)
        : L("This change does not affect the time for completion under the Agreement.", "Cette modification n'a aucune incidence sur le délai d'exécution prévu au Contrat.", lang);

  const sections: ContractSection[] = [
    { key: "parties", heading: L("Parties", "Parties", lang), body: "", kind: "data", editable: false },
    {
      key: "reference",
      heading: L("Agreement being amended", "Contrat modifié", lang),
      body: L(
        `This Change Order ${co.number} amends the construction services agreement **${parent.contractNumber}** signed on ${fmtDate(parent.signedAt, lang)} (the "Agreement"). Except as expressly modified below, all terms and conditions of the Agreement remain in full force and effect and apply to the work described in this Change Order.`,
        `Le présent avenant ${co.number} modifie le contrat d'entreprise **${parent.contractNumber}** signé le ${fmtDate(parent.signedAt, lang)} (le « Contrat »). Sauf modification expresse ci-dessous, toutes les conditions du Contrat demeurent en vigueur et s'appliquent aux travaux décrits dans le présent avenant.`,
        lang,
      ),
      kind: "legal",
      editable: false,
    },
    { key: "change", heading: L("Description of the change", "Description de la modification", lang), body: co.description || co.title, kind: "ai", editable: true },
    {
      key: "price",
      heading: L("Change in contract price", "Modification du prix du contrat", lang),
      body: L(
        `The Contract Price is ${v.total >= 0 ? "increased" : "reduced"} by **${fmtMoney(Math.abs(v.total), lang)}** (taxes included) as itemized below. Unless otherwise agreed in writing, the amount is invoiced with the next progress invoice or, if none remains, on completion.`,
        `Le prix du contrat est ${v.total >= 0 ? "majoré" : "réduit"} de **${fmtMoney(Math.abs(v.total), lang)}** (taxes incluses) selon le détail ci-dessous. Sauf entente écrite contraire, ce montant est facturé avec la prochaine facture d'étape ou, à défaut, à la fin des travaux.`,
        lang,
      ),
      kind: "data",
      editable: false,
    },
    { key: "schedule", heading: L("Schedule", "Échéancier", lang), body: scheduleBody, kind: "legal", editable: false },
    {
      key: "signatures",
      heading: L("Signatures", "Signatures", lang),
      body: L(
        "By signing below, both parties agree to the change described in this Change Order. Electronic signatures are binding under applicable Canadian and provincial electronic commerce legislation.",
        "En signant ci-dessous, les parties acceptent la modification décrite dans le présent avenant. Les signatures électroniques ont force obligatoire en vertu des lois canadiennes et provinciales applicables au commerce électronique.",
        lang,
      ),
      kind: "data",
      editable: false,
    },
  ];
  return {
    templateKey: parent.templateKey,
    templateVersion: TEMPLATE_VERSION,
    language: lang,
    title: L(`Change Order ${co.number}`, `Avenant ${co.number}`, lang),
    sections,
  };
}

export async function createChangeOrder(params: {
  userId: string;
  projectId: string;
  title: string;
  description: string;
  items: ChangeOrderItem[];
  scheduleDeltaDays: number;
}): Promise<{ changeOrder: ChangeOrder; documentContractId: string }> {
  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, params.projectId), eq(projectsTable.userId, params.userId)));
  if (!project) throw new Error("Job not found");
  if (!project.contractId) throw new Error("NO_CONTRACT");
  const [parent] = await db.select().from(contractsTable).where(eq(contractsTable.id, project.contractId));
  if (!parent || parent.status !== "signed") throw new Error("NO_CONTRACT");

  const lang = parent.language as Lang;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(changeOrdersTable).where(eq(changeOrdersTable.projectId, project.id));
  const seq = Number(count ?? 0) + 1;
  const number = `CO-${String(seq).padStart(2, "0")}`;

  const totals = changeOrderTotals(params.items, project.province ?? parent.province);
  const pv = parent.variables;
  const variables: ContractVariables = {
    ...pv,
    contractNumber: `${parent.contractNumber}-${number}`,
    priceLines: params.items.map((i) => ({ label: i.quantita && i.quantita !== 1 ? `${i.descrizione} (${i.quantita} ${i.um || ""})`.trim() : i.descrizione, amount: Number(i.totale) })),
    discount: null,
    subtotal: totals.subtotal,
    taxLines: totals.taxLines,
    taxTotal: totals.tax,
    total: totals.total,
    paymentSchedule: {
      currency: "CAD",
      derived: true,
      holdback: { enabled: false, percent: 10 },
      terms: [{ id: "co", type: "completion", label: L("With the next progress invoice", "Avec la prochaine facture d'étape", lang), trigger: "on_completion", amountType: "percent", value: 100, dueDays: 15 }],
    },
    startDate: null,
    estimatedDurationWeeks: null,
  };
  const document = buildChangeOrderDocument({ parent, co: { number, title: params.title, description: params.description, scheduleDeltaDays: params.scheduleDeltaDays }, variables, lang });

  const result = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(contractsTable)
      .values({
        userId: params.userId,
        quoteId: null,
        clientId: parent.clientId,
        projectId: project.id,
        kind: "change_order",
        parentContractId: parent.id,
        contractNumber: variables.contractNumber,
        status: "draft",
        province: parent.province,
        language: lang,
        templateKey: parent.templateKey,
        document,
        variables,
        contractValueCents: Math.round(totals.total * 100),
        holdbackEnabled: false,
        holdbackPercent: parent.holdbackPercent,
      })
      .returning();
    const contractorSigner = parent.id ? (await tx.select().from(contractSignersTable).where(and(eq(contractSignersTable.contractId, parent.id), eq(contractSignersTable.role, "contractor"))))[0] : undefined;
    const customerSigner = parent.id ? (await tx.select().from(contractSignersTable).where(and(eq(contractSignersTable.contractId, parent.id), eq(contractSignersTable.role, "customer"))))[0] : undefined;
    await tx.insert(contractSignersTable).values([
      { contractId: doc!.id, role: "contractor", name: pv.contractor.name, email: pv.contractor.email || contractorSigner?.email || "" },
      { contractId: doc!.id, role: "customer", name: pv.customer.name, email: pv.customer.email || customerSigner?.email || "" },
    ]);
    const [co] = await tx
      .insert(changeOrdersTable)
      .values({
        userId: params.userId,
        projectId: project.id,
        contractId: parent.id,
        documentContractId: doc!.id,
        number,
        title: params.title,
        description: params.description,
        items: params.items,
        subtotalCents: Math.round(totals.subtotal * 100),
        taxCents: Math.round(totals.tax * 100),
        totalCents: Math.round(totals.total * 100),
        scheduleDeltaDays: params.scheduleDeltaDays,
        status: "draft",
      })
      .returning();
    await tx.update(contractsTable).set({ changeOrderId: co!.id }).where(eq(contractsTable.id, doc!.id));
    return { co: co!, docId: doc!.id };
  });

  await logContractEvent({ contractId: result.docId, type: "created", actor: "contractor", detail: { kind: "change_order", changeOrderId: result.co.id, number } });
  await writeAudit({ userId: params.userId, actorType: "user", actorId: params.userId, entityType: "change_order", entityId: result.co.id, action: "created", diff: { projectId: project.id, totalCents: result.co.totalCents } });
  return { changeOrder: result.co, documentContractId: result.docId };
}

/** Updates a draft change order and re-renders its document (draft only). */
export async function updateChangeOrder(params: {
  userId: string;
  changeOrderId: string;
  title?: string;
  description?: string;
  items?: ChangeOrderItem[];
  scheduleDeltaDays?: number;
}): Promise<ChangeOrder> {
  const [co] = await db.select().from(changeOrdersTable).where(and(eq(changeOrdersTable.id, params.changeOrderId), eq(changeOrdersTable.userId, params.userId)));
  if (!co) throw new Error("Change order not found");
  const [doc] = co.documentContractId ? await db.select().from(contractsTable).where(eq(contractsTable.id, co.documentContractId)) : [];
  if (!doc || doc.status !== "draft") throw new Error("LOCKED");
  const [parent] = co.contractId ? await db.select().from(contractsTable).where(eq(contractsTable.id, co.contractId)) : [];
  if (!parent) throw new Error("NO_CONTRACT");
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, co.projectId));

  const next = {
    title: params.title ?? co.title,
    description: params.description ?? co.description,
    items: params.items ?? co.items,
    scheduleDeltaDays: params.scheduleDeltaDays ?? co.scheduleDeltaDays,
  };
  const totals = changeOrderTotals(next.items, project?.province ?? parent.province);
  const lang = doc.language as Lang;
  const variables: ContractVariables = {
    ...doc.variables,
    priceLines: next.items.map((i) => ({ label: i.quantita && i.quantita !== 1 ? `${i.descrizione} (${i.quantita} ${i.um || ""})`.trim() : i.descrizione, amount: Number(i.totale) })),
    subtotal: totals.subtotal,
    taxLines: totals.taxLines,
    taxTotal: totals.tax,
    total: totals.total,
  };
  const document = buildChangeOrderDocument({ parent, co: { number: co.number, ...next }, variables, lang });

  const [updated] = await db.transaction(async (tx) => {
    await tx.update(contractsTable).set({ variables, document, contractValueCents: Math.round(totals.total * 100) }).where(eq(contractsTable.id, doc.id));
    return tx
      .update(changeOrdersTable)
      .set({ ...next, subtotalCents: Math.round(totals.subtotal * 100), taxCents: Math.round(totals.tax * 100), totalCents: Math.round(totals.total * 100) })
      .where(eq(changeOrdersTable.id, co.id))
      .returning();
  });
  await logContractEvent({ contractId: doc.id, type: "edited", actor: "contractor", detail: { kind: "change_order" } });
  return updated!;
}

/**
 * Called by the contract.signed automation for change-order documents.
 * Idempotent: `appliedAt` guards the value/schedule mutation.
 */
export async function applySignedChangeOrder(doc: Contract): Promise<{ applied: boolean; changeOrderId: string | null }> {
  if (doc.kind !== "change_order" || !doc.changeOrderId) return { applied: false, changeOrderId: null };
  const [co] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, doc.changeOrderId));
  if (!co) throw new Error(`Change order ${doc.changeOrderId} not found`);
  if (co.appliedAt) return { applied: false, changeOrderId: co.id };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, co.projectId));
  if (!project) throw new Error("Job not found for change order");

  const now = new Date();
  const delta = co.scheduleDeltaDays;
  await db.transaction(async (tx) => {
    // Claim first so a concurrent retry cannot apply the amount twice.
    const [claimed] = await tx
      .update(changeOrdersTable)
      .set({ status: "signed", signedAt: doc.signedAt ?? now, appliedAt: now })
      .where(and(eq(changeOrdersTable.id, co.id), sql`${changeOrdersTable.appliedAt} IS NULL`))
      .returning({ id: changeOrdersTable.id });
    if (!claimed) return;

    await tx
      .update(projectsTable)
      .set({
        changeOrdersCents: sql`${projectsTable.changeOrdersCents} + ${co.totalCents}`,
        budget: sql`${projectsTable.budget} + ${co.totalCents}`,
        plannedEnd: delta !== 0 && project.plannedEnd ? addCalendarDays(project.plannedEnd, delta) : project.plannedEnd,
        endDate: delta !== 0 && project.endDate ? addCalendarDays(project.endDate, delta) : project.endDate,
      })
      .where(eq(projectsTable.id, project.id));

    if (delta !== 0) {
      const open = await tx.select().from(milestonesTable).where(and(eq(milestonesTable.projectId, project.id), sql`${milestonesTable.status} IN ('planned','in_progress')`));
      for (const m of open) {
        await tx
          .update(milestonesTable)
          .set({
            plannedStart: m.status === "planned" && m.plannedStart ? addCalendarDays(m.plannedStart, delta) : m.plannedStart,
            plannedEnd: m.plannedEnd ? addCalendarDays(m.plannedEnd, delta) : m.plannedEnd,
          })
          .where(eq(milestonesTable.id, m.id));
      }
    }
  });

  await writeAudit({ userId: doc.userId, actorType: "system", entityType: "change_order", entityId: co.id, action: "applied", diff: { totalCents: co.totalCents, scheduleDeltaDays: delta, projectId: project.id } });
  await createNotification({
    userId: doc.userId,
    type: "change_order_signed",
    title: `${doc.variables.customer.name} signed ${co.number} on ${project.name}`,
    body: `${new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(co.totalCents / 100)} added to the contract value${delta ? `, schedule ${delta > 0 ? "extended" : "shortened"} by ${Math.abs(delta)} days` : ""}.`,
    link: `/dashboard/jobs/${project.id}?tab=changes`,
    entityType: "project",
    entityId: project.id,
  });
  return { applied: true, changeOrderId: co.id };
}

/** Status of a change order derived from its signable document. */
export function changeOrderStatusFromDocument(co: ChangeOrder, docStatus: string | null | undefined): ChangeOrder["status"] {
  if (co.appliedAt || co.status === "signed") return "signed";
  switch (docStatus) {
    case "sent":
    case "viewed":
      return "sent";
    case "signed":
      return "signed";
    case "declined":
      return "declined";
    case "voided":
    case "expired":
      return "voided";
    default:
      return "draft";
  }
}

