// Fetch client for the Phase 3 team endpoints (workers, time entries,
// equipment) and the public worker time-entry page.
import { apiRequest as req, apiJson as json, type TimeEntryDto, type TimeEntryStatus, type UsageUnit } from "./jobs-api";

export type WorkerType = "employee" | "subcontractor";
export type WorkerDto = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  hourlyRateCents: number;
  workerType: WorkerType;
  burdenPercent: number;
  active: boolean;
  /** Phase 86b: may add tasks from the site. */
  canAddTasks: boolean;
  hasInvite: boolean;
  inviteExpiresAt: string | null;
  lastTimeEntryAt: string | null;
  hoursThisMonth: number;
  pendingCount: number;
  createdAt: string;
};
export type WorkerEdit = { name?: string; role?: string; email?: string | null; phone?: string | null; hourlyRateCents?: number; workerType?: WorkerType; burdenPercent?: number; active?: boolean; canAddTasks?: boolean };

export type EquipmentOwnership = "owned" | "rented" | "financed";
export type EquipmentDto = {
  id: string;
  name: string;
  ownership: EquipmentOwnership;
  purchaseCents: number;
  financing: { lender?: string; monthlyPaymentCents?: number; remainingMonths?: number };
  usageRateCents: number;
  usageUnit: UsageUnit;
  notes: string;
  active: boolean;
  usageCentsThisMonth: number;
  createdAt: string;
};
export type EquipmentEdit = { name?: string; ownership?: EquipmentOwnership; purchaseCents?: number; financing?: EquipmentDto["financing"]; usageRateCents?: number; usageUnit?: UsageUnit; notes?: string; active?: boolean };

export const teamApi = {
  workers: () => req<{ items: WorkerDto[] }>("/api/team/workers"),
  addWorker: (body: WorkerEdit & { name: string }) => req<{ worker: WorkerDto }>("/api/team/workers", { method: "POST", body: json(body) }),
  updateWorker: (id: string, body: WorkerEdit) => req<{ worker: WorkerDto }>(`/api/team/workers/${id}`, { method: "PUT", body: json(body) }),
  deleteWorker: (id: string) => req<{ success: true; deactivated: boolean }>(`/api/team/workers/${id}`, { method: "DELETE" }),
  invite: (id: string, send = true) => req<{ url: string; expiresAt: string; emailed: boolean }>(`/api/team/workers/${id}/invite`, { method: "POST", body: json({ send }) }),
  revokeInvite: (id: string) => req<{ success: true }>(`/api/team/workers/${id}/invite`, { method: "DELETE" }),

  timeEntries: (params: { status?: TimeEntryStatus; workerId?: string; projectId?: string; from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString();
    return req<{ items: TimeEntryDto[] }>(`/api/team/time-entries${qs ? `?${qs}` : ""}`);
  },
  updateTimeEntry: (id: string, body: { status?: TimeEntryStatus; hours?: number; date?: string; note?: string; milestoneId?: string | null; rejectedReason?: string | null }) => req<{ entry: TimeEntryDto }>(`/api/team/time-entries/${id}`, { method: "PUT", body: json(body) }),
  approveMany: (ids: string[]) => req<{ approved: number }>("/api/team/time-entries/approve", { method: "POST", body: json({ ids }) }),
  deleteTimeEntry: (id: string) => req<{ success: true }>(`/api/team/time-entries/${id}`, { method: "DELETE" }),
  payrollCsvUrl: (from: string, to: string) => `/api/team/payroll-summary.csv?from=${from}&to=${to}`,

  equipment: () => req<{ items: EquipmentDto[] }>("/api/team/equipment"),
  addEquipment: (body: EquipmentEdit & { name: string }) => req<{ equipment: EquipmentDto }>("/api/team/equipment", { method: "POST", body: json(body) }),
  updateEquipment: (id: string, body: EquipmentEdit) => req<{ equipment: EquipmentDto }>(`/api/team/equipment/${id}`, { method: "PUT", body: json(body) }),
  deleteEquipment: (id: string) => req<{ success: true; deactivated: boolean }>(`/api/team/equipment/${id}`, { method: "DELETE" }),
};

// ── Public worker page (/t/:token) ───────────────────────────────────────────

export type WorkerPageDto = {
  worker: { name: string; role: string; canAddTasks: boolean };
  companyName: string;
  language: "en" | "fr";
  jobs: { id: string; name: string; address: string; milestones: { id: string; title: string; status: string }[] }[];
  entries: WorkerEntryDto[];
  activeEntry: WorkerEntryDto | null;
  today: string;
  /** Phase 75: the worker's upcoming schedule blocks (today → two weeks). */
  schedule: WorkerScheduleBlockDto[];
  /** Phase 86: the jobs they are booked on today, with tasks, address and site contact. */
  todayJobs: WorkerTodayJobDto[];
  /** Phase 86: what they sent from the field in the last two weeks. */
  reports: FieldReportDto[];
  /** Phase 86b: what the office changed since the worker last said "Got it", newest first. */
  changes: CrewChangeDto[];
  /** When that list was built — what "Got it" moves the marker to. */
  changesUpTo: string;
};
type WorkerScheduleBlockDto = { id: string; projectId: string | null; label: string; address: string | null; milestoneTitle: string | null; startsAt: string; endsAt: string; allDay: boolean; notes: string };
export type WorkerEntryDto = { id: string; projectId: string; projectName: string | null; milestoneId: string | null; milestoneTitle: string | null; date: string | null; hours: number; note: string; status: TimeEntryStatus; rejectedReason: string | null; clockInAt: string | null; clockOutAt: string | null; geofenceFlagged: boolean; createdAt: string };

// Phase 77: every write carries `clientRef` (the outbox op id) and, for the
// clock, `at` (when the tap happened) so an offline replay is idempotent and
// keeps the real time — see src/lib/offline/outbox.ts.
export const workerApi = {
  get: (token: string) => req<WorkerPageDto>(`/api/t/${token}`),
  add: (token: string, body: { projectId: string; date: string; hours: number; milestoneId?: string | null; note?: string; clientRef?: string }) => req<{ entry: WorkerEntryDto; replayed?: boolean }>(`/api/t/${token}/entries`, { method: "POST", body: json(body) }),
  remove: (token: string, id: string) => req<{ success: true }>(`/api/t/${token}/entries/${id}`, { method: "DELETE" }),
  clockIn: (token: string, body: { projectId: string; milestoneId?: string | null; lat?: number; lng?: number; at?: string; clientRef?: string }) => req<{ entry: WorkerEntryDto; replayed?: boolean }>(`/api/t/${token}/clock-in`, { method: "POST", body: json(body) }),
  /** Closes the open clock-in by server id, by the clock-in's clientRef (made offline), or whichever is open. */
  clockOut: (token: string, body: { entryId?: string; entryClientRef?: string; lat?: number; lng?: number; at?: string }) => req<{ entry: WorkerEntryDto; replayed?: boolean }>(`/api/t/${token}/clock-out`, { method: "POST", body: json(body) }),
  /** Phase 86: tick a task from the field. */
  setTask: (token: string, taskId: string, status: CrewTaskStatus) => req<{ task: { id: string; status: CrewTaskStatus } }>(`/api/t/${token}/tasks/${taskId}`, { method: "POST", body: json({ status }) }),
  /** Phase 86b: add a task from the site (only for a worker the office allowed to). */
  addTask: (token: string, projectId: string, body: { title: string; milestoneId?: string | null; clientRef?: string }) => req<{ task: CrewTaskDto; replayed?: boolean }>(`/api/t/${token}/jobs/${projectId}/tasks`, { method: "POST", body: json(body) }),
  /** Phase 86b: "Got it" on the changes list. */
  markSeen: (token: string, upTo: string) => req<{ success: true }>(`/api/t/${token}/seen`, { method: "POST", body: json({ upTo }) }),
  /** Phase 86: a photo, a note, a blocker or materials — multipart, so it cannot go through `req`. */
  report: async (token: string, body: FieldReportInput & { clientRef?: string }) => {
    const fd = new FormData();
    fd.append("projectId", body.projectId);
    fd.append("kind", body.kind);
    if (body.body) fd.append("body", body.body);
    if (body.milestoneId) fd.append("milestoneId", body.milestoneId);
    if (body.materialsCents != null) fd.append("materialsCents", String(body.materialsCents));
    if (body.clientRef) fd.append("clientRef", body.clientRef);
    if (body.file) fd.append("file", body.file, body.fileName ?? "photo.jpg");
    const res = await fetch(`/api/t/${token}/reports`, { method: "POST", body: fd });
    const out = (await res.json().catch(() => ({}))) as { report: FieldReportDto; replayed?: boolean; error?: string; message?: string };
    if (!res.ok) {
      const err = new Error(out.message || out.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
      err.code = out.error;
      err.status = res.status;
      throw err;
    }
    return out;
  },
};

// ── Phase 86: the crew's app ─────────────────────────────────────────────────

export type CrewTaskStatus = "todo" | "in_progress" | "done";
export type CrewTaskDto = { id: string; title: string; status: CrewTaskStatus; milestoneTitle: string | null; dueDate: string | null; addedBy: string | null };

export type CrewChangeDto =
  | { kind: "shift_added" | "shift_changed" | "shift_removed"; at: string; blockId: string; projectId: string | null; label: string; startsAt: string; endsAt: string; allDay: boolean }
  | { kind: "task_added" | "task_changed" | "task_done"; at: string; taskId: string; projectId: string; projectName: string; title: string; by: string | null }
  | { kind: "answer"; at: string; reportId: string; projectId: string; projectName: string | null; body: string; answer: string | null; by: string | null };
export type FieldReportKind = "note" | "blocker" | "materials";
export type FieldReportInput = { projectId: string; kind: FieldReportKind; body?: string; milestoneId?: string | null; materialsCents?: number | null; file?: Blob | null; fileName?: string };
export type FieldReportDto = {
  id: string;
  projectId: string;
  projectName: string | null;
  milestoneId: string | null;
  workerId: string | null;
  authorName: string;
  kind: FieldReportKind;
  body: string;
  photoId: string | null;
  materialsCents: number | null;
  costEntryId: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  createdAt: string;
};
export type WorkerTodayJobDto = {
  id: string;
  name: string;
  address: string | null;
  contact: { name: string; phone: string | null } | null;
  blocks: { id: string; startsAt: string; endsAt: string; allDay: boolean; notes: string }[];
  tasks: CrewTaskDto[];
};

export type CrewTodayDto =
  | { enabled: false; requiredPlan: string }
  | {
      enabled: true;
      day: string;
      jobs: { jobId: string | null; jobName: string | null; address: string | null; crew: { blockId: string; workerId: string | null; workerName: string | null; startsAt: string; endsAt: string; allDay: boolean; title: string; clockedInAt: string | null; clockedInElsewhere: boolean }[] }[];
      clockedIn: { entryId: string; workerId: string; workerName: string | null; projectId: string; projectName: string | null; since: string; geofenceFlagged: boolean }[];
      awaitingApproval: { id: string; workerId: string; workerName: string | null; projectId: string; projectName: string | null; date: string | null; hours: number; note: string; geofenceFlagged: boolean; clocked: boolean }[];
      blockers: FieldReportDto[];
      recentReports: FieldReportDto[];
    };

export const crewApi = {
  today: () => req<CrewTodayDto>("/api/crew/today"),
  jobReports: (jobId: string) => req<{ reports: FieldReportDto[] }>(`/api/jobs/${jobId}/field-reports`),
  resolve: (id: string, note?: string) => req<{ report: FieldReportDto }>(`/api/field-reports/${id}/resolve`, { method: "POST", body: json({ note }) }),
  photoUrl: (jobId: string, photoId: string) => `/api/jobs/${jobId}/photos/${photoId}/file`,
};
