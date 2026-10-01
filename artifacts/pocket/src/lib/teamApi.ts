// The people and hours calls the Job screen's Team tab (and later the Team screens) make; the app's wrapped fetch adds the token.
import { api } from "./api";
import type { EquipmentRow, MemberRow, Seats, TimeRow } from "./team";

export type Worker = {
  id: string; name: string; role: string; email: string; phone: string; hourlyRateCents: number | null; workerType: string; payrollId: string; burdenPercent: number;
  active: boolean; canAddTasks: boolean; hasInvite: boolean; inviteExpiresAt: string | null; lastTimeEntryAt: string | null; hoursThisMonth: number; pendingCount: number; createdAt: string;
};

export const teamApi = {
  workers: () => api<{ items: Worker[] }>("/api/team/workers"),
  entries: (status: TimeRow["status"]) => api<{ items: TimeRow[] }>(`/api/team/time-entries?status=${status}`),
  reject: (id: string, reason?: string) => api<unknown>(`/api/team/time-entries/${encodeURIComponent(id)}`, { method: "PUT", body: { status: "rejected", ...(reason ? { rejectedReason: reason } : null) } }),
  workerEntries: (workerId: string, from: string, to: string) => api<{ items: TimeRow[] }>(`/api/team/time-entries?workerId=${encodeURIComponent(workerId)}&from=${from}&to=${to}`),
  updateWorker: (id: string, body: { canAddTasks?: boolean; active?: boolean }) => api<unknown>(`/api/team/workers/${encodeURIComponent(id)}`, { method: "PUT", body }),
  revokeLink: (id: string) => api<unknown>(`/api/team/workers/${encodeURIComponent(id)}/invite`, { method: "DELETE" }),
  equipment: () => api<{ items: EquipmentRow[] }>("/api/team/equipment"),
  members: () => api<{ items: MemberRow[]; seats: Seats }>("/api/team/members"),
  invite: (email: string, role: "office" | "foreman" | "viewer") => api<{ url: string; expiresAt: string; emailed: boolean }>("/api/team/members/invite", { method: "POST", body: { email, role } }),
  codes: (count: number, role: "office" | "foreman" | "viewer") => api<{ codes: { id: string; code: string; role: string; expiresAt: string }[] }>("/api/team/members/codes", { method: "POST", body: { count, role } }),
  pairingCode: (workerId: string) => api<{ code: string; expiresAt: string }>(`/api/team/workers/${encodeURIComponent(workerId)}/pairing-code`, { method: "POST", body: {} }),
  sendLink: (workerId: string) => api<{ url: string; expiresAt: string; emailed: boolean }>(`/api/team/workers/${encodeURIComponent(workerId)}/invite`, { method: "POST", body: {} }),
  approve: (ids: string[]) => api<{ approved: number }>("/api/team/time-entries/approve", { method: "POST", body: { ids } }),
  logHours: (jobId: string, body: { workerId: string; date: string; hours: number; note?: string; approve?: boolean }) =>
    api<unknown>(`/api/jobs/${encodeURIComponent(jobId)}/time-entries`, { method: "POST", body }),
  assign: (jobId: string, workerId: string, roleInProject?: string) => api<unknown>(`/api/jobs/${encodeURIComponent(jobId)}/assignments`, { method: "POST", body: { workerId, ...(roleInProject ? { roleInProject } : null) } }),
  unassign: (jobId: string, assignmentId: string) => api<unknown>(`/api/jobs/${encodeURIComponent(jobId)}/assignments/${encodeURIComponent(assignmentId)}`, { method: "DELETE" }),
};
