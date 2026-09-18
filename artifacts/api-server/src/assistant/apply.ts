// Phase 5 — executes a confirmed proposal with the same logic the manual
// routes use (milestone status → automation, invoice drafts → service, …).
import {
  db,
  assistantProposalsTable,
  projectsTable,
  milestonesTable,
  projectTasksTable,
  costEntriesTable,
  businessProfilesTable,
  hasFeature,
  type AssistantProposal,
  type CostCategory,
  type MilestoneStatus,
  type PaymentMethod,
  type ProductFeature,
  type TaxBreakdown,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { raiseAutomation } from "../lib/automation.js";
import { writeAudit } from "../lib/notifications.js";
import { recomputeProgress } from "../jobs/setup.js";
import { parseIsoDate } from "../jobs/dates.js";
import { draftDepositInvoice, draftFinalInvoice, draftHoldbackReleaseInvoice, draftMilestoneInvoice, buildInvoiceContext, sendInvoice, recordPayment } from "../invoices/service.js";

const FEATURE_FOR: Record<AssistantProposal["kind"], ProductFeature> = {
  cost_entry: "costs",
  milestone_update: "jobs",
  task: "jobs",
  invoice: "invoicing",
  send_invoice: "invoicing",
  record_payment: "invoicing",
};

export class ProposalError extends Error {
  constructor(message: string, public code: string = "PROPOSAL_FAILED", public status = 400) { super(message); }
}

export type ApplyResult = { proposal: AssistantProposal; entityType: string; entityId: string; link: string | null };

export async function confirmProposal(params: { userId: string; proposalId: string; ip?: string | null }): Promise<ApplyResult> {
  const [proposal] = await db.select().from(assistantProposalsTable).where(and(eq(assistantProposalsTable.id, params.proposalId), eq(assistantProposalsTable.userId, params.userId)));
  if (!proposal) throw new ProposalError("Proposal not found", "NOT_FOUND", 404);
  if (proposal.status !== "pending") throw new ProposalError(`Proposal already ${proposal.status}`, "ALREADY_RESOLVED", 409);
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  if (!hasFeature(profile, FEATURE_FOR[proposal.kind])) throw new ProposalError("Your plan does not include this action", "PLAN_REQUIRED", 403);

  try {
    const out = await execute(proposal, params.userId, params.ip ?? null);
    const [updated] = await db.update(assistantProposalsTable).set({ status: "confirmed", resultEntityType: out.entityType, resultEntityId: out.entityId, resolvedAt: new Date() }).where(eq(assistantProposalsTable.id, proposal.id)).returning();
    return { proposal: updated!, ...out };
  } catch (err) {
    const message = (err as Error).message || "Could not apply the proposal";
    await db.update(assistantProposalsTable).set({ status: "failed", error: message, resolvedAt: new Date() }).where(eq(assistantProposalsTable.id, proposal.id));
    throw err instanceof ProposalError ? err : new ProposalError(message);
  }
}

export async function dismissProposal(params: { userId: string; proposalId: string }): Promise<AssistantProposal> {
  const [proposal] = await db.select().from(assistantProposalsTable).where(and(eq(assistantProposalsTable.id, params.proposalId), eq(assistantProposalsTable.userId, params.userId)));
  if (!proposal) throw new ProposalError("Proposal not found", "NOT_FOUND", 404);
  if (proposal.status !== "pending") throw new ProposalError(`Proposal already ${proposal.status}`, "ALREADY_RESOLVED", 409);
  const [updated] = await db.update(assistantProposalsTable).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(assistantProposalsTable.id, proposal.id)).returning();
  return updated!;
}

async function ownedProject(userId: string, id: string) {
  const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!p) throw new ProposalError("Job not found", "NOT_FOUND", 404);
  return p;
}

async function execute(proposal: AssistantProposal, userId: string, ip: string | null): Promise<{ entityType: string; entityId: string; link: string | null }> {
  const p = proposal.payload as Record<string, unknown>;
  switch (proposal.kind) {
    case "cost_entry": {
      const project = await ownedProject(userId, String(p.projectId));
      const [entry] = await db
        .insert(costEntriesTable)
        .values({
          userId,
          projectId: project.id,
          milestoneId: (p.milestoneId as string | null) ?? null,
          category: p.category as CostCategory,
          vendor: String(p.vendor ?? ""),
          description: String(p.description ?? ""),
          date: parseIsoDate(p.date as string | null) ?? new Date(),
          subtotalCents: Number(p.subtotalCents ?? 0),
          taxCents: Number(p.taxCents ?? 0),
          taxBreakdown: (p.taxBreakdown as TaxBreakdown) ?? {},
          totalCents: Number(p.totalCents ?? 0),
          status: "confirmed",
          source: "manual",
          createdBy: "ai",
          confirmedAt: new Date(),
        })
        .returning();
      await writeAudit({ userId, actorType: "ai", actorId: proposal.id, entityType: "cost_entry", entityId: entry!.id, action: "created_via_assistant", ip });
      return { entityType: "cost_entry", entityId: entry!.id, link: `/dashboard/jobs/${project.id}?tab=costs` };
    }
    case "milestone_update": {
      const project = await ownedProject(userId, String(p.projectId));
      const [m] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, String(p.milestoneId)), eq(milestonesTable.projectId, project.id)));
      if (!m) throw new ProposalError("Milestone not found", "NOT_FOUND", 404);
      const updates: Partial<typeof milestonesTable.$inferInsert> = {};
      if (p.title) updates.title = String(p.title);
      if (p.plannedStart) updates.plannedStart = parseIsoDate(String(p.plannedStart));
      if (p.plannedEnd) updates.plannedEnd = parseIsoDate(String(p.plannedEnd));
      const status = (p.status as MilestoneStatus | null) ?? null;
      if (status) {
        updates.status = status;
        if (status === "in_progress" && !m.actualStart) updates.actualStart = new Date();
        if (status === "completed") { updates.actualEnd = m.actualEnd ?? new Date(); if (!m.actualStart) updates.actualStart = new Date(); }
        if (status === "planned") { updates.actualStart = null; updates.actualEnd = null; }
      }
      await db.update(milestonesTable).set(updates).where(eq(milestonesTable.id, m.id));
      await recomputeProgress(project.id);
      if (status === "completed" && m.status !== "completed") {
        await raiseAutomation({ event: "milestone.completed", userId, entityType: "milestone", entityId: m.id, payload: { projectId: project.id } });
      }
      await writeAudit({ userId, actorType: "ai", actorId: proposal.id, entityType: "milestone", entityId: m.id, action: "updated_via_assistant", diff: updates as Record<string, unknown>, ip });
      return { entityType: "milestone", entityId: m.id, link: `/dashboard/jobs/${project.id}?tab=schedule` };
    }
    case "task": {
      const project = await ownedProject(userId, String(p.projectId));
      const [t] = await db.insert(projectTasksTable).values({ projectId: project.id, title: String(p.title), milestoneId: (p.milestoneId as string | null) ?? null, dueDate: parseIsoDate((p.dueDate as string | null) ?? null), status: "todo" }).returning();
      return { entityType: "task", entityId: t!.id, link: `/dashboard/jobs/${project.id}?tab=schedule` };
    }
    case "invoice": {
      const project = await ownedProject(userId, String(p.projectId));
      const kind = String(p.kind);
      const ctx = await buildInvoiceContext({ userId, projectId: project.id });
      let out: { invoice: { id: string }; created: boolean } | null;
      if (kind === "deposit") {
        if (!ctx.contract) throw new ProposalError("This job has no signed contract");
        out = await draftDepositInvoice({ contract: ctx.contract, projectId: project.id, source: "manual", actor: "contractor" });
      } else if (kind === "term") {
        const [ms] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, String(p.milestoneId)), eq(milestonesTable.projectId, project.id)));
        if (!ms) throw new ProposalError("Milestone not found", "NOT_FOUND", 404);
        out = await draftMilestoneInvoice({ milestone: ms, source: "manual", actor: "contractor" });
      } else if (kind === "final") out = await draftFinalInvoice({ project, source: "manual", actor: "contractor" });
      else out = await draftHoldbackReleaseInvoice({ project, source: "manual", actor: "contractor" });
      if (!out) throw new ProposalError("Nothing left to invoice for that item", "NOTHING_TO_INVOICE");
      return { entityType: "invoice", entityId: out.invoice.id, link: `/dashboard/invoices/${out.invoice.id}` };
    }
    case "send_invoice": {
      const { invoice } = await sendInvoice({ invoiceId: String(p.invoiceId), userId, actor: "contractor", message: p.message ? String(p.message) : undefined, ip });
      return { entityType: "invoice", entityId: invoice.id, link: `/dashboard/invoices/${invoice.id}` };
    }
    case "record_payment": {
      const { invoice } = await recordPayment({ invoiceId: String(p.invoiceId), userId, amountCents: Number(p.amountCents), method: (p.method as PaymentMethod) ?? "etransfer", date: parseIsoDate((p.date as string | null) ?? null) ?? new Date(), reference: p.reference ? String(p.reference) : undefined, ip });
      return { entityType: "invoice", entityId: invoice.id, link: `/dashboard/invoices/${invoice.id}` };
    }
    default:
      throw new ProposalError(`Unsupported proposal kind ${proposal.kind}`);
  }
}
