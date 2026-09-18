import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { JobStatus, MilestoneStatus, ChangeOrderStatus } from "@/lib/jobs-api";
import type { InvoiceStatus, InvoiceType } from "@/lib/invoices-api";

/**
 * Status chips for jobs / milestones / change orders / invoices, on the
 * locked `.chip-*` vocabulary (Phase 57 — docs/PIXEL-REDESIGN-PLAN.md).
 * Same mapping the list pages use: green = done/paid, teal = in progress,
 * yellow = waiting on someone, red = problem, purple = planned/viewed,
 * grey = draft/closed.
 */
const JOB: Record<JobStatus, string> = {
  planning: "chip-grey",
  active: "chip-teal",
  suspended: "chip-yellow",
  completed: "chip-green",
};
const MILESTONE: Record<MilestoneStatus, string> = {
  planned: "chip-purple",
  in_progress: "chip-teal",
  completed: "chip-green",
  skipped: "chip-grey",
};
const CO: Record<ChangeOrderStatus, string> = {
  draft: "chip-grey",
  sent: "chip-teal",
  signed: "chip-green",
  declined: "chip-red",
  voided: "chip-grey",
};

export function JobStatusBadge({ status, pendingReview }: { status: JobStatus; pendingReview?: boolean }) {
  const { t } = useLanguage();
  if (pendingReview) return <span className="chip chip-yellow">{t("jobs.status.pending_review")}</span>;
  return <span className={cn("chip", JOB[status])}>{t(`jobs.status.${status}`)}</span>;
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const { t } = useLanguage();
  return <span className={cn("chip", MILESTONE[status])}>{t(`jobs.milestone.status.${status}`)}</span>;
}

export function ChangeOrderStatusBadge({ status }: { status: ChangeOrderStatus }) {
  const { t } = useLanguage();
  return <span className={cn("chip", CO[status])}>{t(`jobs.co.status.${status}`)}</span>;
}

const INVOICE: Record<InvoiceStatus, string> = {
  draft: "chip-grey",
  sent: "chip-teal",
  viewed: "chip-purple",
  pending_confirmation: "chip-yellow",
  partially_paid: "chip-yellow",
  paid: "chip-green",
  overdue: "chip-red",
  void: "chip-grey line-through",
};

export function InvoiceStatusBadge({ status, scheduled }: { status: InvoiceStatus; scheduled?: boolean }) {
  const { t } = useLanguage();
  if (status === "draft" && scheduled) return <span className="chip chip-purple">{t("invoices.status.scheduled")}</span>;
  return <span className={cn("chip", INVOICE[status])}>{t(`invoices.status.${status}`)}</span>;
}

export function InvoiceTypeBadge({ type }: { type: InvoiceType }) {
  const { t } = useLanguage();
  return <span className="chip chip-grey" style={{ background: "#fff", border: "1px solid var(--line)" }}>{t(`invoices.type.${type}`)}</span>;
}
