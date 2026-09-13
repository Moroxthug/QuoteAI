import {
  paymentTermAmount,
  COST_CATEGORIES,
  type ContractVariables,
  type PaymentSchedule,
  type PaymentTerm,
  type QuoteChapter,
  type CostCategory,
  type ProjectSetupProposal,
} from "@workspace/db";
import { addCalendarDays, nextWorkingDay, parseIsoDate } from "./dates.js";

// ── Deterministic job plan ───────────────────────────────────────────────────
// Pure functions (no DB, no AI) that turn the signed contract + quote
// chapters into milestones, payment links, durations and a cost budget.
// setup.ts persists the plan and optionally lets the AI refine durations.


export type PlannedMilestone = {
  key: string;
  title: string;
  description: string;
  sourceChapter: string | null;
  valueCents: number;
  durationDays: number;
  paymentTermId: string | null;
  paymentTermLabel: string | null;
  paymentAmountCents: number | null;
  tasks: string[];
};

export type PlannedBudgetLine = { category: CostCategory; label: string; plannedCents: number };

export type SetupPlan = {
  milestones: PlannedMilestone[];
  budget: PlannedBudgetLine[];
  proposal: ProjectSetupProposal;
  plannedStart: Date;
};

const MAX_MILESTONES = 12;
const MAX_TASKS_PER_MILESTONE = 8;
export const DEFAULT_COST_RATIO = 0.72;
export const DEFAULT_SPLIT: Record<CostCategory, number> = {
  materials: 0.42,
  labour: 0.4,
  subcontractor: 0.05,
  permits_fees: 0.03,
  equipment: 0.04,
  misc: 0.06,
};
const CATEGORY_LABELS: Record<CostCategory, { en: string; fr: string }> = {
  materials: { en: "Materials", fr: "Matériaux" },
  labour: { en: "Labour", fr: "Main-d'œuvre" },
  subcontractor: { en: "Subcontractors", fr: "Sous-traitants" },
  permits_fees: { en: "Permits & fees", fr: "Permis et frais" },
  equipment: { en: "Equipment", fr: "Équipement" },
  misc: { en: "Miscellaneous", fr: "Divers" },
};
const COMPLETION_KEY = "completion";

const cents = (n: number) => Math.round(n * 100);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
}

const START_WORDS = /\b(start|début|debut|demolition|démolition|mobili[sz]ation|materials?|matériaux|materiaux|delivery|livraison|rough)\b/i;
const END_WORDS = /\b(substantial|completion|achèvement|achevement|final|finish|handover|walkthrough)\b/i;

/**
 * Maps the milestone-triggered payment terms onto the chapter milestones.
 * Keyword overlap first, then "start"/"completion" words, then an even
 * spread; if the mapping ends up out of order we fall back to the spread.
 */
function assignTermsToChapters(terms: PaymentTerm[], chapters: { key: string; title: string }[]): Map<string, PaymentTerm> {
  const m = chapters.length;
  const n = terms.length;
  const spread = (i: number) => Math.min(m - 1, Math.floor(((i + 1) * m) / (n + 1)));

  const chapterTokens = chapters.map((c) => tokens(c.title));
  const chosen: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = terms[i]!;
    if (t.milestoneKey) {
      const idx = chapters.findIndex((c) => c.key === t.milestoneKey);
      if (idx >= 0) { chosen.push(idx); continue; }
    }
    const lt = tokens(t.label);
    let best = -1;
    let bestScore = 0;
    chapterTokens.forEach((ct, idx) => {
      let score = 0;
      for (const w of lt) if (ct.has(w)) score++;
      if (score > bestScore && !chosen.includes(idx)) { bestScore = score; best = idx; }
    });
    if (best >= 0) chosen.push(best);
    else if (START_WORDS.test(t.label) && !chosen.includes(0)) chosen.push(0);
    else if (END_WORDS.test(t.label) && !chosen.includes(m - 1)) chosen.push(m - 1);
    else chosen.push(spread(i));
  }
  const monotonic = chosen.every((c, i) => i === 0 || c > chosen[i - 1]!);
  const finalIdx = monotonic ? chosen : terms.map((_, i) => spread(i));

  const out = new Map<string, PaymentTerm>();
  finalIdx.forEach((idx, i) => {
    const key = chapters[idx]!.key;
    if (!out.has(key)) out.set(key, terms[i]!);
  });
  return out;
}

function proportionalDays(totalDays: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (sum <= 0) return weights.map(() => Math.max(1, Math.round(totalDays / Math.max(1, weights.length))));
  const raw = weights.map((w) => Math.max(1, Math.round((totalDays * Math.max(0, w)) / sum)));
  return raw;
}

/** Deterministic plan (no AI): milestones from chapters + payment schedule, proportional durations, default budget. */
export function buildFallbackPlan(params: {
  chapters: QuoteChapter[];
  variables: ContractVariables;
  signedAt: Date;
  language: "en" | "fr";
}): SetupPlan {
  const { chapters, variables: v, signedAt, language } = params;
  const schedule: PaymentSchedule = v.paymentSchedule;
  const total = v.total;
  const subtotal = v.subtotal;

  const milestoneTerms = schedule.terms.filter((t) => t.trigger === "milestone");
  const completionTerm = schedule.terms.find((t) => t.trigger === "on_completion") ?? null;

  // 1. Work milestones: one per chapter, or one per payment term when the quote has no usable chapters.
  let work: Omit<PlannedMilestone, "durationDays">[] = [];
  const usableChapters = chapters.filter((c) => c && c.titolo).slice(0, MAX_MILESTONES - 1);
  if (usableChapters.length > 0 && milestoneTerms.length <= usableChapters.length) {
    const keyed = usableChapters.map((c, i) => ({ key: `chapter-${(c.lettera || String(i + 1)).toString().toUpperCase()}`, title: c.titolo, chapter: c }));
    const linked = assignTermsToChapters(milestoneTerms, keyed);
    work = keyed.map(({ key, title, chapter }) => {
      const term = linked.get(key) ?? null;
      return {
        key,
        title,
        description: chapter.osservazione ?? "",
        sourceChapter: chapter.lettera || null,
        valueCents: cents(Number(chapter.subtotale) || 0),
        paymentTermId: term?.id ?? null,
        paymentTermLabel: term?.label ?? null,
        paymentAmountCents: term ? cents(paymentTermAmount(term, total)) : null,
        tasks: (chapter.voci ?? []).slice(0, MAX_TASKS_PER_MILESTONE).map((vv) => vv.descrizione.slice(0, 140)).filter(Boolean),
      };
    });
  } else if (milestoneTerms.length > 0) {
    const share = milestoneTerms.length > 0 ? cents(subtotal / milestoneTerms.length) : 0;
    work = milestoneTerms.map((t, i) => ({
      key: `term-${t.id}`,
      title: t.label,
      description: "",
      sourceChapter: null,
      valueCents: share,
      paymentTermId: t.id,
      paymentTermLabel: t.label,
      paymentAmountCents: cents(paymentTermAmount(t, total)),
      tasks: usableChapters.slice(i, i + 1).flatMap((c) => (c.voci ?? []).slice(0, MAX_TASKS_PER_MILESTONE).map((vv) => vv.descrizione.slice(0, 140))),
    }));
  } else {
    work = [{
      key: "work",
      title: language === "fr" ? "Travaux" : "Work",
      description: v.projectTitle,
      sourceChapter: null,
      valueCents: cents(subtotal),
      paymentTermId: null,
      paymentTermLabel: null,
      paymentAmountCents: null,
      tasks: usableChapters.flatMap((c) => (c.voci ?? []).map((vv) => vv.descrizione.slice(0, 140))).slice(0, MAX_TASKS_PER_MILESTONE),
    }];
  }

  // 2. Final walkthrough milestone releases the completion payment.
  const completion: Omit<PlannedMilestone, "durationDays"> = {
    key: COMPLETION_KEY,
    title: language === "fr" ? "Achèvement et inspection finale" : "Completion & final walkthrough",
    description: language === "fr" ? "Nettoyage final, liste de déficiences, inspection avec le client." : "Final cleanup, deficiency list, walkthrough with the customer.",
    sourceChapter: null,
    valueCents: 0,
    paymentTermId: completionTerm?.id ?? null,
    paymentTermLabel: completionTerm?.label ?? null,
    paymentAmountCents: completionTerm ? cents(paymentTermAmount(completionTerm, total)) : null,
    tasks: [],
  };

  // 3. Durations: contract estimate, else a value-based guess; spread by chapter value.
  const totalDays = v.estimatedDurationWeeks
    ? Math.max(2, v.estimatedDurationWeeks * 5)
    : Math.min(120, Math.max(3, Math.round(subtotal / 1200)));
  const workDays = proportionalDays(Math.max(1, totalDays - 1), work.map((w) => w.valueCents));
  const milestones: PlannedMilestone[] = [
    ...work.map((w, i) => ({ ...w, durationDays: workDays[i]! })),
    { ...completion, durationDays: 1 },
  ];

  // 4. Cost budget: default split of the expected cost.
  const expectedCost = subtotal * DEFAULT_COST_RATIO;
  const budget = budgetFromSplit(expectedCost, DEFAULT_SPLIT, language);

  const plannedStart = parseIsoDate(v.startDate) ?? nextWorkingDay(addCalendarDays(signedAt, 7));

  return {
    milestones,
    budget,
    plannedStart,
    proposal: {
      source: "fallback",
      generatedAt: new Date().toISOString(),
      durationWorkingDays: milestones.reduce((s, m) => s + m.durationDays, 0),
      costRatio: DEFAULT_COST_RATIO,
    },
  };
}

export function budgetFromSplit(expectedCost: number, split: Record<CostCategory, number>, language: "en" | "fr"): PlannedBudgetLine[] {
  const sum = COST_CATEGORIES.reduce((s, c) => s + (split[c] ?? 0), 0) || 1;
  return COST_CATEGORIES
    .map((c) => ({ category: c, label: CATEGORY_LABELS[c][language], plannedCents: cents((expectedCost * (split[c] ?? 0)) / sum) }))
    .filter((l) => l.plannedCents > 0);
}

