// The people and hours calls the Job screen's Team tab (and later the Team screens) make; the app's wrapped fetch adds the token.
import { api } from "./api";

export type Worker = {
  id: string; name: string; role: string; email: string; phone: string; hourlyRateCents: number | null; workerType: string; payrollId: string; burdenPercent: number;
  active: boolean; canAddTasks: boolean; hasInvite: boolean; inviteExpiresAt: string | null; lastTimeEntryAt: string | null; hoursThisMonth: number; pendingCount: number; createdAt: string;
};

export const teamApi = {
  workers: () => api<{ items: Worker[] }>("/api/team/workers"),
  approve: (ids: string[]) => api<{ approved: number }>("/api/team/time-entries/approve", { method: "POST", body: { ids } }),
  logHours: (jobId: string, body: { workerId: string; date: string; hours: number; note?: string; approve?: boolean }) =>
    api<unknown>(`/api/jobs/${encodeURIComponent(jobId)}/time-entries`, { method: "POST", body }),
  assign: (jobId: string, workerId: string, roleInProject?: string) => api<unknown>(`/api/jobs/${encodeURIComponent(jobId)}/assignments`, { method: "POST", body: { workerId, ...(roleInProject ? { roleInProject } : null) } }),
  unassign: (jobId: string, assignmentId: string) => api<unknown>(`/api/jobs/${encodeURIComponent(jobId)}/assignments/${encodeURIComponent(assignmentId)}`, { method: "DELETE" }),
};
