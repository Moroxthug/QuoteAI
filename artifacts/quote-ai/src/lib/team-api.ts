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
  hasInvite: boolean;
  inviteExpiresAt: string | null;
  lastTimeEntryAt: string | null;
  hoursThisMonth: number;
  pendingCount: number;
  createdAt: string;
};
export type WorkerEdit = { name?: string; role?: string; email?: string | null; phone?: string | null; hourlyRateCents?: number; workerType?: WorkerType; burdenPercent?: number; active?: boolean };

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
  worker: { name: string; role: string };
  companyName: string;
  language: "en" | "fr";
  jobs: { id: string; name: string; address: string; milestones: { id: string; title: string; status: string }[] }[];
  entries: WorkerEntryDto[];
  activeEntry: WorkerEntryDto | null;
  today: string;
  /** Phase 75: the worker's upcoming schedule blocks (today → two weeks). */
  schedule: WorkerScheduleBlockDto[];
};
type WorkerScheduleBlockDto = { id: string; projectId: string | null; label: string; address: string | null; milestoneTitle: string | null; startsAt: string; endsAt: string; allDay: boolean; notes: string };
export type WorkerEntryDto = { id: string; projectId: string; projectName: string | null; milestoneId: string | null; milestoneTitle: string | null; date: string | null; hours: number; note: string; status: TimeEntryStatus; rejectedReason: string | null; clockInAt: string | null; clockOutAt: string | null; geofenceFlagged: boolean; createdAt: string };

export const workerApi = {
  get: (token: string) => req<WorkerPageDto>(`/api/t/${token}`),
  add: (token: string, body: { projectId: string; date: string; hours: number; milestoneId?: string | null; note?: string }) => req<{ entry: WorkerEntryDto }>(`/api/t/${token}/entries`, { method: "POST", body: json(body) }),
  remove: (token: string, id: string) => req<{ success: true }>(`/api/t/${token}/entries/${id}`, { method: "DELETE" }),
  clockIn: (token: string, body: { projectId: string; milestoneId?: string | null; lat?: number; lng?: number }) => req<{ entry: WorkerEntryDto }>(`/api/t/${token}/clock-in`, { method: "POST", body: json(body) }),
  clockOut: (token: string, entryId: string, body: { lat?: number; lng?: number }) => req<{ entry: WorkerEntryDto }>(`/api/t/${token}/entries/${entryId}/clock-out`, { method: "POST", body: json(body) }),
};
