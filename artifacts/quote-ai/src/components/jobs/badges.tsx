import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { JobStatus, MilestoneStatus, ChangeOrderStatus } from "@/lib/jobs-api";
import type { InvoiceStatus, InvoiceType } from "@/lib/invoices-api";

const JOB: Record<JobStatus, string> = {
  planning: "bg-slate-100 text-slate-700",
  active: "bg-blue-100 text-blue-700",
  suspended: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};
const MILESTONE: Record<MilestoneStatus, string> = {
  planned: "bg-violet-100 text-violet-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  skipped: "bg-slate-100 text-slate-500",
};
const CO: Record<ChangeOrderStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  signed: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  voided: "bg-slate-100 text-slate-500",
};

export function JobStatusBadge({ status, pendingReview }: { status: JobStatus; pendingReview?: boolean }) {
  const { t } = useLanguage();
  if (pendingReview) return <Badge className="font-medium border-0 bg-amber-100 text-amber-800">{t("jobs.status.pending_review")}</Badge>;
  return <Badge className={cn("font-medium border-0", JOB[status])}>{t(`jobs.status.${status}`)}</Badge>;
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const { t } = useLanguage();
  return <Badge className={cn("font-medium border-0", MILESTONE[status])}>{t(`jobs.milestone.status.${status}`)}</Badge>;
}

export function ChangeOrderStatusBadge({ status }: { status: ChangeOrderStatus }) {
  const { t } = useLanguage();
  return <Badge className={cn("font-medium border-0", CO[status])}>{t(`jobs.co.status.${status}`)}</Badge>;
}

const INVOICE: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  partially_paid: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  void: "bg-slate-100 text-slate-500 line-through",
};

export function InvoiceStatusBadge({ status, scheduled }: { status: InvoiceStatus; scheduled?: boolean }) {
  const { t } = useLanguage();
  if (status === "draft" && scheduled) return <Badge className="font-medium border-0 bg-violet-100 text-violet-700">{t("invoices.status.scheduled")}</Badge>;
  return <Badge className={cn("font-medium border-0", INVOICE[status])}>{t(`invoices.status.${status}`)}</Badge>;
}

export function InvoiceTypeBadge({ type }: { type: InvoiceType }) {
  const { t } = useLanguage();
  return <Badge variant="outline" className="font-normal text-slate-600">{t(`invoices.type.${type}`)}</Badge>;
}
