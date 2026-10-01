// What GET /api/jobs/:id returns (routes/jobs.ts loadJobDetail), shared by Job setup, Job, Change order and the
// screens that open from them. Dates that are days ("2026-10-05") come as YYYY-MM-DD; moments come as ISO strings.

export type TaskStatus = string;
export type JobTask = { id: string; milestoneId: string | null; title: string; description: string; status: TaskStatus; dueDate: string | null; sortOrder: number; addedFromFieldBy: string | null; updatedAt: string };

export type MilestoneStatus = "planned" | "in_progress" | "completed" | "skipped";
export type JobMilestone = {
  id: string; key: string; title: string; description: string; sortOrder: number;
  plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null;
  status: MilestoneStatus; paymentTermId: string | null; paymentTermLabel: string | null; paymentAmountCents: number | null;
  sourceChapter: string | null; valueCents: number; updatedAt: string; tasks: JobTask[];
};

export type CostCategory = "materials" | "labour" | "subcontractor" | "permits_fees" | "equipment" | "misc";
export const COST_CATEGORIES: CostCategory[] = ["materials", "labour", "subcontractor", "permits_fees", "equipment", "misc"];
export type BudgetLine = { id: string; category: CostCategory; chapterRef: string | null; label: string; plannedCents: number; sortOrder: number };

export type PaymentTerm = { id: string; label: string; amountType: "percent" | "fixed"; value: number; dueDays?: number; milestoneKey?: string | null };

export type ChangeOrderStatus = "draft" | "sent" | "signed" | "declined" | "voided";
export type ChangeOrderRow = {
  id: string; number: string; title: string; description: string;
  items: { descrizione: string; um: string; quantita: number; prezzoUnitario: number; totale: number }[];
  subtotalCents: number; taxCents: number; totalCents: number; scheduleDeltaDays: number; status: ChangeOrderStatus;
  documentContractId: string | null; signedAt: string | null; appliedAt: string | null; createdAt: string;
};

export type CostEntry = {
  id: string; projectId: string | null; milestoneId: string | null; milestoneTitle: string | null; category: CostCategory; vendor: string; description: string; date: string;
  subtotalCents: number; taxCents: number; totalCents: number; status: "pending" | "confirmed"; source: string; createdBy: string; sourceDocumentId: string | null; confirmedAt: string | null; createdAt: string;
};

export type TimeEntryRow = {
  id: string; workerId: string; workerName?: string; projectId: string | null; milestoneId: string | null; date: string; hours: number; note?: string; status: string;
  clockInAt?: string | null; clockOutAt?: string | null; costCents?: number;
};

export type Assignment = { id: string; collaboratorId: string; roleInProject: string; collaboratorName: string; collaboratorRole: string; collaboratorHourlyRate: number | null; workerType: string; active: boolean };

export type JobInvoice = {
  id: string; number: string; type: string; status: string; title: string; paymentTermId: string | null; paymentTermLabel: string | null; milestoneId: string | null;
  issueDate: string; dueDate: string; totalCents: number; paidCents: number; balanceCents: number;
};

export type JobDetail = {
  job: {
    id: string; name: string; description: string; status: "planning" | "active" | "suspended" | "completed"; setupStatus: "pending_review" | "confirmed";
    quoteId: string | null; clientId: string | null; contractId: string | null; address: string; province: string | null;
    latitude: number | null; longitude: number | null; geofenceRadiusMeters: number | null;
    contractValueCents: number; changeOrdersCents: number; totalValueCents: number; plannedStart: string | null; plannedEnd: string | null;
    progressPercent: number; completedAt: string | null; createdAt: string; updatedAt: string; archivedAt: string | null;
    client: { id: string; name: string; email: string; phone: string } | null;
    contract: { id: string; contractNumber: string; status: string; signedAt: string | null; hasSignedPdf: boolean; language: string; paymentSchedule: { terms: PaymentTerm[] }; total: number; subtotal: number; customerName: string } | null;
    quote: { id: string; number: string; status: string } | null;
  };
  milestones: JobMilestone[];
  unassignedTasks: JobTask[];
  budget: BudgetLine[];
  budgetTotalCents: number;
  changeOrders: ChangeOrderRow[];
  costs: { totalCents: number; pendingCents: number; pendingCount: number; byCategory: Record<CostCategory, number>; entries: CostEntry[] };
  timeEntries: TimeEntryRow[];
  equipmentUsage: { id: string; equipmentName?: string; date: string; costCents?: number }[];
  assignments: Assignment[];
  invoices: JobInvoice[];
  invoiceTotals: { invoicedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number; draftCount: number };
};
