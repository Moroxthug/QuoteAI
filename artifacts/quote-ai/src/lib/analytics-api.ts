// Thin fetch client for the Phase 5 analytics endpoints.
import { apiRequest as req } from "@/lib/jobs-api";
import type { CostCategory } from "@/lib/jobs-api";
import type { AgingDto } from "@/lib/invoices-api";

export type CategoryPointDto = { category: CostCategory; plannedCents: number; actualCents: number; pendingCents: number; varianceCents: number; usedPercent: number | null };
export type CurvePointDto = { week: string; actualCents: number; plannedCents: number; invoicedCents: number; collectedCents: number };
export type MilestoneVarianceDto = { id: string; title: string; status: string; plannedDays: number | null; slipDays: number; state: "done_on_time" | "done_late" | "on_track" | "late" | "not_started_late" | "pending" };
export type EarnedValueDto = {
  earnedCents: number;
  invoicedSubtotalCents: number;
  billingGapCents: number;
  budgetEarnedCents: number;
  costCents: number;
  costPerformance: number | null;
  projectedFinalCostCents: number | null;
  projectedMarginPercent: number | null;
};

export type JobAnalyticsDto = {
  subtotalCents: number;
  budgetCents: number;
  costCents: number;
  pendingCostCents: number;
  categories: CategoryPointDto[];
  curve: CurvePointDto[];
  schedule: { rows: MilestoneVarianceDto[]; daysBehind: number; lateCount: number; plannedEnd: string | null; forecastEnd: string | null };
  earned: EarnedValueDto;
  invoices: { invoicedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number; draftCount: number; upcomingCents: number };
};

export type MonthPointDto = { month: string; invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null };
export type CashWeekDto = { week: string; dueCents: number; overdueCents: number; expectedCents: number; outflowCents: number; netCents: number; cumulativeCents: number };
export type RiskFlag = "over_budget" | "budget_burn" | "behind_schedule" | "overdue_invoices" | "billing_gap" | "unbilled_completion";
export type JobRiskDto = { id: string; name: string; flags: RiskFlag[]; score: number; detail: { overBudgetCents: number; burnPercent: number | null; daysBehind: number; overdueCents: number; billingGapCents: number } };
export type JobMarginDto = { id: string; name: string; clientName: string | null; status: string; subtotalCents: number; costCents: number; marginPercent: number | null; progressPercent: number };

export type CompanyAnalyticsDto = {
  months: MonthPointDto[];
  totals: { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number };
  aging: AgingDto;
  cashFlow: CashWeekDto[];
  jobs: { byStatus: Record<string, number>; active: number; risks: JobRiskDto[]; margins: JobMarginDto[] };
};

export const analyticsApi = {
  job: (id: string) => req<JobAnalyticsDto>(`/api/jobs/${id}/analytics`),
  company: (months = 6) => req<CompanyAnalyticsDto>(`/api/analytics/company?months=${months}`),
};
