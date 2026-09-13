import {
  db,
  projectsTable,
  projectTasksTable,
  milestonesTable,
  costBudgetLinesTable,
  contractsTable,
  quotesTable,

  COST_CATEGORIES,
  type Contract,
  type ContractVariables,
  type QuoteChapter,
  type CostCategory,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";
import { writeAudit } from "../lib/notifications.js";
import { layoutSequential } from "./dates.js";
import { buildFallbackPlan, budgetFromSplit, DEFAULT_COST_RATIO, DEFAULT_SPLIT, type SetupPlan } from "./plan.js";

// ── Job setup from a signed contract ─────────────────────────────────────────
// The company never fills a form to create the job: this module turns the
// signed contract (and the quote behind it) into a project with milestones
// imported from the quote chapters, linked to the payment schedule, a
// proposed calendar and a cost budget. Everything lands as
// `setupStatus = pending_review` and is editable on the review screen.

// ── AI refinement ────────────────────────────────────────────────────────────
// The AI only adjusts durations and the budget split of the deterministic
// plan; it never invents milestones, so payment links stay intact.

async function refineWithAi(plan: SetupPlan, params: { chapters: QuoteChapter[]; variables: ContractVariables; language: "en" | "fr" }): Promise<SetupPlan> {
  const { variables: v, language } = params;
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const list = plan.milestones.map((m) => `- key=${m.key} | ${m.title} | value ${(m.valueCents / 100).toFixed(0)} CAD | tasks: ${m.tasks.slice(0, 5).join("; ") || "-"}`).join("\n");
  const system = language === "fr"
    ? "Tu es un chargé de projet en rénovation résidentielle au Canada. Tu estimes des durées réalistes en jours ouvrables et une répartition des coûts. Réponds UNIQUEMENT en JSON."
    : "You are a residential renovation project manager in Canada. You estimate realistic working-day durations and an expected cost split. Reply with JSON ONLY.";
  const user = `${language === "fr" ? "Projet" : "Project"}: ${v.projectTitle}
${language === "fr" ? "Prix avant taxes" : "Pre-tax price"}: ${v.subtotal.toFixed(0)} CAD · ${language === "fr" ? "Durée estimée au contrat" : "Contract duration estimate"}: ${v.estimatedDurationWeeks ? `${v.estimatedDurationWeeks} ${language === "fr" ? "semaines" : "weeks"}` : "-"}
${language === "fr" ? "Jalons (dans l'ordre)" : "Milestones (in order)"}:
${list}

${language === "fr"
  ? `Retourne: {"milestones":[{"key":"<key>","duration_days":<entier ≥1>}...pour chaque jalon], "cost_ratio": <coût attendu ÷ prix avant taxes, entre 0.5 et 0.9>, "split": {"materials":<0-1>,"labour":<0-1>,"subcontractor":<0-1>,"permits_fees":<0-1>,"equipment":<0-1>,"misc":<0-1>} (somme = 1), "rationale": "<2 phrases max>"}`
  : `Return: {"milestones":[{"key":"<key>","duration_days":<integer ≥1>}...one per milestone], "cost_ratio": <expected cost ÷ pre-tax price, between 0.5 and 0.9>, "split": {"materials":<0-1>,"labour":<0-1>,"subcontractor":<0-1>,"permits_fees":<0-1>,"equipment":<0-1>,"misc":<0-1>} (sums to 1), "rationale": "<2 sentences max>"}`}`;

  const completion = await openai.chat.completions.create(
    {
      model,
      temperature: 0.2,
      max_completion_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { timeout: 20_000 },
  );
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    milestones?: { key?: string; duration_days?: number }[];
    cost_ratio?: number;
    split?: Partial<Record<CostCategory, number>>;
    rationale?: string;
  };

  const durations = new Map<string, number>();
  for (const m of parsed.milestones ?? []) {
    if (m.key && typeof m.duration_days === "number" && m.duration_days >= 1 && m.duration_days <= 120) durations.set(m.key, Math.round(m.duration_days));
  }
  if (durations.size === 0) throw new Error("AI plan had no usable durations");

  const costRatio = typeof parsed.cost_ratio === "number" && parsed.cost_ratio >= 0.5 && parsed.cost_ratio <= 0.9 ? parsed.cost_ratio : DEFAULT_COST_RATIO;
  const split: Record<CostCategory, number> = { ...DEFAULT_SPLIT };
  const s = parsed.split ?? {};
  const splitSum = COST_CATEGORIES.reduce((acc, c) => acc + (typeof s[c] === "number" && s[c]! >= 0 ? s[c]! : 0), 0);
  if (splitSum > 0.9 && splitSum < 1.1) for (const c of COST_CATEGORIES) split[c] = typeof s[c] === "number" && s[c]! >= 0 ? s[c]! : 0;

  return {
    ...plan,
    milestones: plan.milestones.map((m) => ({ ...m, durationDays: durations.get(m.key) ?? m.durationDays })),
    budget: budgetFromSplit(v.subtotal * costRatio, split, language),
    proposal: {
      source: "ai",
      model,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 600) : undefined,
      generatedAt: new Date().toISOString(),
      durationWorkingDays: plan.milestones.reduce((acc, m) => acc + (durations.get(m.key) ?? m.durationDays), 0),
      costRatio,
    },
  };
}

// ── Persist ──────────────────────────────────────────────────────────────────

function jobName(v: ContractVariables): string {
  const site = v.siteAddress.split(",")[0]?.trim();
  const tail = site || v.customer.name;
  return tail ? `${v.projectTitle} – ${tail}`.slice(0, 160) : v.projectTitle.slice(0, 160);
}

export async function setupJobFromContract(contract: Contract): Promise<{ projectId: string; created: boolean; milestoneCount: number; plannedEnd: Date | null }> {
  if (contract.kind !== "agreement") throw new Error("Only agreements create jobs");
  const v = contract.variables;
  const language = contract.language as "en" | "fr";

  // Idempotent: a retry after a partial failure reuses the project row.
  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.contractId, contract.id), eq(projectsTable.userId, contract.userId)));
  if (existing) {
    const rows = await db.select({ id: milestonesTable.id }).from(milestonesTable).where(eq(milestonesTable.projectId, existing.id));
    if (rows.length > 0) return { projectId: existing.id, created: false, milestoneCount: rows.length, plannedEnd: existing.plannedEnd };
  }

  const quote = contract.quoteId ? (await db.select().from(quotesTable).where(eq(quotesTable.id, contract.quoteId)))[0] : undefined;
  const chapters = (Array.isArray(quote?.capitoli) ? quote!.capitoli : []) as QuoteChapter[];
  const signedAt = contract.signedAt ?? new Date();

  let plan = buildFallbackPlan({ chapters, variables: v, signedAt, language });
  try {
    plan = await refineWithAi(plan, { chapters, variables: v, language });
  } catch (err) {
    logger.warn({ err, contractId: contract.id }, "AI job plan failed — using deterministic schedule and budget");
  }

  const layout = layoutSequential(plan.plannedStart, plan.milestones.map((m) => m.durationDays));
  const plannedEnd = layout[layout.length - 1]?.end ?? null;

  // Legacy projects linked to the same quote by the old "Start job" button are
  // adopted instead of duplicated.
  const [legacy] = !existing && contract.quoteId
    ? await db.select().from(projectsTable).where(and(eq(projectsTable.quoteId, contract.quoteId), eq(projectsTable.userId, contract.userId)))
    : [];

  const projectId = await db.transaction(async (tx) => {
    const values = {
      userId: contract.userId,
      quoteId: contract.quoteId,
      clientId: contract.clientId,
      contractId: contract.id,
      name: jobName(v),
      description: v.projectTitle,
      status: "planning" as const,
      address: v.siteAddress,
      province: contract.province,
      budget: contract.contractValueCents,
      contractValueCents: contract.contractValueCents,
      changeOrdersCents: 0,
      setupStatus: "pending_review" as const,
      setupProposal: plan.proposal,
      setupConfirmedAt: null,
      plannedStart: plan.plannedStart,
      plannedEnd,
      startDate: plan.plannedStart,
      endDate: plannedEnd,
      progressPercent: 0,
    };
    let id: string;
    if (existing) {
      id = existing.id;
      await tx.update(projectsTable).set(values).where(eq(projectsTable.id, id));
    } else if (legacy) {
      id = legacy.id;
      await tx.update(projectsTable).set({ ...values, name: legacy.name || values.name }).where(eq(projectsTable.id, id));
    } else {
      const [row] = await tx.insert(projectsTable).values(values).returning({ id: projectsTable.id });
      id = row!.id;
    }

    await tx.delete(milestonesTable).where(eq(milestonesTable.projectId, id));
    await tx.delete(costBudgetLinesTable).where(eq(costBudgetLinesTable.projectId, id));

    const inserted = await tx
      .insert(milestonesTable)
      .values(
        plan.milestones.map((m, i) => ({
          projectId: id,
          userId: contract.userId,
          key: m.key,
          title: m.title,
          description: m.description,
          sortOrder: i,
          plannedStart: layout[i]!.start,
          plannedEnd: layout[i]!.end,
          status: "planned" as const,
          paymentTermId: m.paymentTermId,
          paymentTermLabel: m.paymentTermLabel,
          paymentAmountCents: m.paymentAmountCents,
          sourceChapter: m.sourceChapter,
          valueCents: m.valueCents,
        })),
      )
      .returning({ id: milestonesTable.id, key: milestonesTable.key });

    const tasks = plan.milestones.flatMap((m, mi) =>
      m.tasks.map((title, ti) => ({
        projectId: id,
        milestoneId: inserted.find((r) => r.key === m.key)?.id ?? null,
        title,
        description: "",
        status: "todo",
        dueDate: layout[mi]!.end,
        sortOrder: ti,
      })),
    );
    if (tasks.length > 0) await tx.insert(projectTasksTable).values(tasks);

    if (plan.budget.length > 0) {
      await tx.insert(costBudgetLinesTable).values(plan.budget.map((b, i) => ({ projectId: id, category: b.category, chapterRef: null, label: b.label, plannedCents: b.plannedCents, sortOrder: i })));
    }

    await tx.update(contractsTable).set({ projectId: id }).where(eq(contractsTable.id, contract.id));
    return id;
  });

  await writeAudit({
    userId: contract.userId,
    actorType: "system",
    entityType: "project",
    entityId: projectId,
    action: existing || legacy ? "setup_regenerated" : "created_from_contract",
    diff: { contractId: contract.id, milestones: plan.milestones.length, source: plan.proposal.source },
  });

  return { projectId, created: !existing && !legacy, milestoneCount: plan.milestones.length, plannedEnd };
}

/** Recomputes progress % from milestone values (completed value ÷ total value). */
export async function recomputeProgress(projectId: string): Promise<number> {
  const rows = await db.select({ status: milestonesTable.status, valueCents: milestonesTable.valueCents }).from(milestonesTable).where(eq(milestonesTable.projectId, projectId));
  const counted = rows.filter((r) => r.status !== "skipped");
  const total = counted.reduce((s, r) => s + r.valueCents, 0);
  let pct: number;
  if (total > 0) pct = Math.round((counted.filter((r) => r.status === "completed").reduce((s, r) => s + r.valueCents, 0) / total) * 100);
  else pct = counted.length ? Math.round((counted.filter((r) => r.status === "completed").length / counted.length) * 100) : 0;
  await db.update(projectsTable).set({ progressPercent: pct }).where(eq(projectsTable.id, projectId));
  return pct;
}
