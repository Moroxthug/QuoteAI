// Thin fetch client for the Phase 2 job endpoints (not in the orval
// generated client). All calls send the session cookie.

export type JobStatus = "planning" | "active" | "suspended" | "completed";
export type MilestoneStatus = "planned" | "in_progress" | "completed" | "skipped";
export type CostCategory = "materials" | "labour" | "subcontractor" | "permits_fees" | "equipment" | "misc";
export type ChangeOrderStatus = "draft" | "sent" | "signed" | "declined" | "voided";

export type JobSummaryDto = {
  id: string;
  name: string;
  description: string;
  status: JobStatus;
  setupStatus: "pending_review" | "confirmed";
  quoteId: string | null;
  clientId: string | null;
  contractId: string | null;
  address: string;
  province: string | null;
  contractValueCents: number;
  changeOrdersCents: number;
  totalValueCents: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  progressPercent: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientName: string | null;
  milestoneCount: number;
  milestonesDone: number;
  nextMilestone: { id: string; title: string; plannedEnd: string | null } | null;
};

export type TaskDto = { id: string; milestoneId: string | null; title: string; description: string; status: "todo" | "in_progress" | "done"; dueDate: string | null; sortOrder: number };

export type MilestoneDto = {
  id: string;
  key: string;
  title: string;
  description: string;
  sortOrder: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: MilestoneStatus;
  paymentTermId: string | null;
  paymentTermLabel: string | null;
  paymentAmountCents: number | null;
  sourceChapter: string | null;
  valueCents: number;
  tasks: TaskDto[];
};

export type BudgetLineDto = { id: string; category: CostCategory; chapterRef: string | null; label: string; plannedCents: number; sortOrder: number };

export type ChangeOrderItemDto = { descrizione: string; um: string; quantita: number; prezzoUnitario: number; totale: number };

export type ChangeOrderDto = {
  id: string;
  number: string;
  title: string;
  description: string;
  items: ChangeOrderItemDto[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  scheduleDeltaDays: number;
  status: ChangeOrderStatus;
  documentContractId: string | null;
  signedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type PaymentTermDto = { id: string; type: string; label: string; trigger: string; amountType: "percent" | "fixed"; value: number; dueDays: number; milestoneKey?: string };

export type JobDetailDto = {
  job: Omit<JobSummaryDto, "clientName" | "milestoneCount" | "milestonesDone" | "nextMilestone"> & {
    setupProposal: { source: "ai" | "fallback"; model?: string; rationale?: string; generatedAt: string; durationWorkingDays: number; costRatio: number } | null;
    setupConfirmedAt: string | null;
    client: { id: string; name: string; email: string | null; phone: string | null } | null;
    contract: {
      id: string;
      contractNumber: string;
      status: string;
      signedAt: string | null;
      hasSignedPdf: boolean;
      language: "en" | "fr";
      paymentSchedule: { terms: PaymentTermDto[]; holdback: { enabled: boolean; percent: number } };
      total: number;
      subtotal: number;
      customerName: string;
    } | null;
    quote: { id: string; number: string | null; status: string } | null;
  };
  milestones: MilestoneDto[];
  unassignedTasks: TaskDto[];
  budget: BudgetLineDto[];
  budgetTotalCents: number;
  changeOrders: ChangeOrderDto[];
  costs: { totalCents: number; entries: { id: string; description: string; amountCents: number; date: string }[] };
  assignments: { id: string; collaboratorId: string; roleInProject: string; collaboratorName: string; collaboratorRole: string; collaboratorHourlyRate: number }[];
};

export type MilestoneEdit = {
  id?: string;
  key?: string;
  title: string;
  description?: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  paymentTermId?: string | null;
  valueCents?: number;
};
export type BudgetEdit = { category: CostCategory; label?: string; plannedCents: number };
export type SetupEdits = { name?: string; plannedStart?: string | null; milestones?: MilestoneEdit[]; budget?: BudgetEdit[] };

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; requiredPlan?: string };
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number; requiredPlan?: string };
    err.code = body.error;
    err.status = res.status;
    err.requiredPlan = body.requiredPlan;
    throw err;
  }
  return body;
}

const json = (body: unknown) => JSON.stringify(body);

export const jobsApi = {
  list: () => req<{ items: JobSummaryDto[] }>("/api/jobs"),
  get: (id: string) => req<JobDetailDto>(`/api/jobs/${id}`),
  create: (body: { name: string; description?: string; quoteId?: string; clientId?: string; address?: string; province?: string; plannedStart?: string; plannedEnd?: string; contractValueCents?: number }) =>
    req<{ job: JobSummaryDto; created: boolean }>("/api/jobs", { method: "POST", body: json(body) }),
  update: (id: string, body: { name?: string; description?: string; status?: JobStatus; address?: string; plannedStart?: string | null; plannedEnd?: string | null; contractValueCents?: number }) =>
    req<{ job: JobSummaryDto }>(`/api/jobs/${id}`, { method: "PUT", body: json(body) }),
  remove: (id: string) => req<{ success: true }>(`/api/jobs/${id}`, { method: "DELETE" }),

  saveSetup: (id: string, body: SetupEdits) => req<JobDetailDto>(`/api/jobs/${id}/setup`, { method: "PUT", body: json(body) }),
  confirmSetup: (id: string, body: SetupEdits) => req<JobDetailDto>(`/api/jobs/${id}/setup/confirm`, { method: "POST", body: json(body) }),
  regenerateSetup: (id: string) => req<JobDetailDto>(`/api/jobs/${id}/setup/regenerate`, { method: "POST", body: "{}" }),

  addMilestone: (id: string, body: MilestoneEdit) => req<{ milestone: MilestoneDto }>(`/api/jobs/${id}/milestones`, { method: "POST", body: json(body) }),
  updateMilestone: (id: string, mid: string, body: Partial<MilestoneEdit> & { status?: MilestoneStatus; sortOrder?: number }) =>
    req<{ milestone: MilestoneDto; progressPercent: number }>(`/api/jobs/${id}/milestones/${mid}`, { method: "PUT", body: json(body) }),
  deleteMilestone: (id: string, mid: string) => req<{ success: true }>(`/api/jobs/${id}/milestones/${mid}`, { method: "DELETE" }),

  addTask: (id: string, body: { title: string; milestoneId?: string | null; dueDate?: string | null }) => req<{ task: TaskDto }>(`/api/jobs/${id}/tasks`, { method: "POST", body: json(body) }),
  updateTask: (id: string, tid: string, body: { title?: string; status?: TaskDto["status"]; milestoneId?: string | null; dueDate?: string | null }) =>
    req<{ task: TaskDto }>(`/api/jobs/${id}/tasks/${tid}`, { method: "PATCH", body: json(body) }),
  deleteTask: (id: string, tid: string) => req<{ success: true }>(`/api/jobs/${id}/tasks/${tid}`, { method: "DELETE" }),

  saveBudget: (id: string, lines: BudgetEdit[]) => req<{ budget: BudgetLineDto[]; budgetTotalCents: number }>(`/api/jobs/${id}/budget`, { method: "PUT", body: json({ lines }) }),

  createChangeOrder: (id: string, body: { title: string; description: string; items: ChangeOrderItemDto[]; scheduleDeltaDays: number }) =>
    req<{ changeOrder: ChangeOrderDto; documentContractId: string }>(`/api/jobs/${id}/change-orders`, { method: "POST", body: json(body) }),
  deleteChangeOrder: (id: string, coId: string) => req<{ success: true }>(`/api/jobs/${id}/change-orders/${coId}`, { method: "DELETE" }),

  addCost: (id: string, body: { description: string; amountCents: number; date?: string }) => req<{ entry: { id: string } }>(`/api/jobs/${id}/costs`, { method: "POST", body: json(body) }),
  deleteCost: (id: string, cid: string) => req<{ success: true }>(`/api/jobs/${id}/costs/${cid}`, { method: "DELETE" }),

  // Team (legacy CRM endpoints until Phase 3 introduces workers)
  collaborators: () => req<{ id: string; name: string; role: string; hourlyRate: number }[]>("/api/crm/collaborators"),
  addCollaborator: (body: { name: string; role?: string; hourlyRate?: number }) => req<{ id: string; name: string }>("/api/crm/collaborators", { method: "POST", body: json(body) }),
  assign: (id: string, body: { collaboratorId: string; roleInProject?: string }) => req<{ id: string }>(`/api/crm/projects/${id}/assignments`, { method: "POST", body: json(body) }),
  unassign: (id: string, assignmentId: string) => req<{ success: true }>(`/api/crm/projects/${id}/assignments/${assignmentId}`, { method: "DELETE" }),
};

export const formatCad = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
export const formatCents = (c: number) => formatCad(c / 100);
