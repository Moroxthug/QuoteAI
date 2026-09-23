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
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number | null;
  contractValueCents: number;
  changeOrdersCents: number;
  totalValueCents: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  progressPercent: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  clientName: string | null;
  milestoneCount: number;
  milestonesDone: number;
  nextMilestone: { id: string; title: string; plannedEnd: string | null } | null;
  crewCount: number;
};

export type TaskDto = { id: string; milestoneId: string | null; title: string; description: string; status: "todo" | "in_progress" | "done"; dueDate: string | null; sortOrder: number; /** Phase 86b: the crew member who added it from the site, if one did. */ addedFromFieldBy?: string | null };

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

export type CostEntryStatus = "pending_review" | "confirmed";
export type CostEntrySource = "manual" | "receipt" | "time_entry" | "equipment" | "legacy";
export type TaxBreakdownDto = { GST?: number; HST?: number; PST?: number; QST?: number };
export type ReceiptExtractionDto = {
  vendor: string | null;
  date: string | null;
  currency: string | null;
  lines: { description: string; quantity: number | null; unitPrice: number | null; total: number | null }[];
  subtotal: number | null;
  taxes: { GST?: number | null; HST?: number | null; PST?: number | null; QST?: number | null };
  total: number | null;
  suggestedCategory: CostCategory | null;
  suggestedProjectId: string | null;
  confidence: "high" | "medium" | "low";
  note: string | null;
  model: string;
};
export type CostEntryDto = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  milestoneId: string | null;
  milestoneTitle: string | null;
  category: CostCategory;
  vendor: string;
  description: string;
  date: string | null;
  subtotalCents: number;
  taxCents: number;
  taxBreakdown: TaxBreakdownDto;
  totalCents: number;
  status: CostEntryStatus;
  source: CostEntrySource;
  createdBy: "user" | "ai" | "system";
  sourceDocumentId: string | null;
  timeEntryId: string | null;
  equipmentUsageId: string | null;
  aiExtraction: ReceiptExtractionDto | null;
  confirmedAt: string | null;
  createdAt: string;
};
export type CostEntryEdit = { category?: CostCategory; vendor?: string; description?: string; date?: string; milestoneId?: string | null; subtotalCents?: number; taxCents?: number; taxBreakdown?: TaxBreakdownDto; totalCents?: number; status?: CostEntryStatus; projectId?: string };

export type TimeEntryStatus = "submitted" | "approved" | "rejected";
export type TimeEntryDto = {
  id: string;
  workerId: string;
  workerName: string | null;
  projectId: string;
  projectName: string | null;
  milestoneId: string | null;
  milestoneTitle: string | null;
  date: string | null;
  hours: number;
  rateCents: number;
  burdenPercent: number;
  costCents: number;
  note: string;
  status: TimeEntryStatus;
  enteredBy: "worker" | "company";
  approvedAt: string | null;
  rejectedReason: string | null;
  costEntryId: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  geofenceFlagged: boolean;
  createdAt: string;
};
export type UsageUnit = "hour" | "day";
export type EquipmentUsageDto = {
  id: string;
  equipmentId: string;
  equipmentName: string | null;
  projectId: string;
  projectName: string | null;
  milestoneId: string | null;
  date: string | null;
  quantity: number;
  unit: UsageUnit;
  rateCents: number;
  costCents: number;
  note: string;
  costEntryId: string | null;
  createdAt: string;
};

export type PaymentTermDto = { id: string; type: string; label: string; trigger: string; amountType: "percent" | "fixed"; value: number; dueDays: number; milestoneKey?: string };

export type JobDetailDto = {
  job: Omit<JobSummaryDto, "clientName" | "milestoneCount" | "milestonesDone" | "nextMilestone" | "crewCount"> & {
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
  costs: { totalCents: number; pendingCents: number; pendingCount: number; byCategory: Record<CostCategory, number>; entries: CostEntryDto[] };
  timeEntries: TimeEntryDto[];
  equipmentUsage: EquipmentUsageDto[];
  assignments: { id: string; collaboratorId: string; roleInProject: string; collaboratorName: string; collaboratorRole: string; collaboratorHourlyRate: number; workerType: "employee" | "subcontractor"; active: boolean }[];
  // Phase 4
  invoices: import("./invoices-api").InvoiceDto[];
  invoiceTotals: import("./invoices-api").InvoiceTotalsDto;
};

export type JobNoteSource = "manual" | "voice" | "photo" | "assistant";
export type JobNoteDto = { id: string; projectId: string; milestoneId: string | null; photoId: string | null; body: string; source: JobNoteSource; authorName: string; createdAt: string };

export type JobPhotoDto = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption: string;
  sortOrder: number;
  sharedAt: string | null;
  createdAt: string;
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
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; requiredPlan?: string; reason?: string };
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number; requiredPlan?: string; reason?: string };
    err.code = body.error;
    err.status = res.status;
    err.requiredPlan = body.requiredPlan;
    err.reason = body.reason;
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
  update: (id: string, body: { name?: string; description?: string; status?: JobStatus; address?: string; plannedStart?: string | null; plannedEnd?: string | null; contractValueCents?: number; latitude?: number | null; longitude?: number | null; geofenceRadiusMeters?: number | null }) =>
    req<{ job: JobSummaryDto }>(`/api/jobs/${id}`, { method: "PUT", body: json(body) }),
  remove: (id: string) => req<{ success: true }>(`/api/jobs/${id}`, { method: "DELETE" }),
  archive: (id: string) => req<{ job: JobSummaryDto }>(`/api/jobs/${id}/archive`, { method: "POST", body: "{}" }),
  restore: (id: string) => req<{ job: JobSummaryDto }>(`/api/jobs/${id}/restore`, { method: "POST", body: "{}" }),

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

  // Costs (Phase 3)
  addCost: (id: string, body: CostEntryEdit & { category: CostCategory; totalCents: number; clientRef?: string }) => req<{ entry: CostEntryDto; replayed?: boolean }>(`/api/jobs/${id}/costs`, { method: "POST", body: json(body) }),
  updateCost: (id: string, cid: string, body: CostEntryEdit) => req<{ entry: CostEntryDto }>(`/api/jobs/${id}/costs/${cid}`, { method: "PUT", body: json(body) }),
  deleteCost: (id: string, cid: string) => req<{ success: true }>(`/api/jobs/${id}/costs/${cid}`, { method: "DELETE" }),
  reviewQueue: () => req<{ entries: CostEntryDto[] }>("/api/costs/review"),
  scanReceipt: async (file: File, projectId?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (projectId) fd.append("projectId", projectId);
    const res = await fetch("/api/costs/receipts", { method: "POST", credentials: "include", body: fd });
    const body = (await res.json().catch(() => ({}))) as { entry: CostEntryDto; error?: string; message?: string; requiredPlan?: string };
    if (!res.ok) {
      const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; requiredPlan?: string };
      err.code = body.error;
      err.requiredPlan = body.requiredPlan;
      throw err;
    }
    return body;
  },
  receiptFileUrl: (docId: string) => `/api/costs/receipts/${docId}/file`,

  // Team & time on a job (Phase 3)
  assign: (id: string, body: { workerId: string; roleInProject?: string }) => req<{ assignment: { id: string } }>(`/api/jobs/${id}/assignments`, { method: "POST", body: json(body) }),
  unassign: (id: string, assignmentId: string) => req<{ success: true }>(`/api/jobs/${id}/assignments/${assignmentId}`, { method: "DELETE" }),
  addTimeEntry: (id: string, body: { workerId: string; date: string; hours: number; milestoneId?: string | null; note?: string; approve?: boolean; clientRef?: string }) => req<{ entry: TimeEntryDto; replayed?: boolean }>(`/api/jobs/${id}/time-entries`, { method: "POST", body: json(body) }),
  addEquipmentUsage: (id: string, body: { equipmentId: string; date: string; quantity: number; unit?: UsageUnit; milestoneId?: string | null; note?: string }) => req<{ usage: EquipmentUsageDto }>(`/api/jobs/${id}/equipment-usage`, { method: "POST", body: json(body) }),
  deleteEquipmentUsage: (id: string, uid: string) => req<{ success: true }>(`/api/jobs/${id}/equipment-usage/${uid}`, { method: "DELETE" }),

  // Photos (Phase 10)
  listPhotos: (id: string) => req<{ photos: JobPhotoDto[] }>(`/api/jobs/${id}/photos`),
  uploadPhoto: async (id: string, file: Blob, opts?: { milestoneId?: string | null; caption?: string; fileName?: string; clientRef?: string }) => {
    const fd = new FormData();
    fd.append("file", file, opts?.fileName ?? (file instanceof File ? file.name : "photo.jpg"));
    if (opts?.milestoneId) fd.append("milestoneId", opts.milestoneId);
    if (opts?.caption) fd.append("caption", opts.caption);
    if (opts?.clientRef) fd.append("clientRef", opts.clientRef);
    const res = await fetch(`/api/jobs/${id}/photos`, { method: "POST", credentials: "include", body: fd });
    const body = (await res.json().catch(() => ({}))) as { photo: JobPhotoDto; replayed?: boolean; error?: string; message?: string };
    if (!res.ok) {
      const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
      err.code = body.error;
      err.status = res.status;
      throw err;
    }
    return body;
  },
  updatePhoto: (id: string, photoId: string, body: { caption?: string; milestoneId?: string | null; sortOrder?: number }) =>
    req<{ photo: JobPhotoDto }>(`/api/jobs/${id}/photos/${photoId}`, { method: "PUT", body: json(body) }),
  deletePhoto: (id: string, photoId: string) => req<{ success: true }>(`/api/jobs/${id}/photos/${photoId}`, { method: "DELETE" }),
  sharePhotos: (id: string, photoIds: string[]) => req<{ success: true; channel: "email" | "whatsapp"; count: number }>(`/api/jobs/${id}/photos/share`, { method: "POST", body: json({ photoIds }) }),
  /** Phase 74: one-off "on my way" text to the job's client. */
  onMyWay: (id: string, body: { etaMinutes?: number }) => req<{ success: true; body: string; segments: number }>(`/api/jobs/${id}/sms/on-my-way`, { method: "POST", body: json(body) }),
  photoFileUrl: (id: string, photoId: string) => `/api/jobs/${id}/photos/${photoId}/file`,

  // Notes (Phase 78)
  listNotes: (id: string) => req<{ notes: JobNoteDto[] }>(`/api/jobs/${id}/notes`),
  addNote: (id: string, body: { body: string; milestoneId?: string | null }) => req<{ note: JobNoteDto }>(`/api/jobs/${id}/notes`, { method: "POST", body: json(body) }),
  deleteNote: (id: string, noteId: string) => req<{ success: true }>(`/api/jobs/${id}/notes/${noteId}`, { method: "DELETE" }),
};

export { req as apiRequest, json as apiJson };

export const formatCad = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
export const formatCents = (c: number) => formatCad(c / 100);
