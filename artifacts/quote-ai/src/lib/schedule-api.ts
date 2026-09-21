// Thin fetch client for the Phase 75 schedule-board endpoints (hand-written,
// same pattern as sms-api.ts). Instants travel as ISO strings with offsets.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type ScheduleBlockDto = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  projectAddress: string | null;
  milestoneId: string | null;
  milestoneTitle: string | null;
  collaboratorId: string | null;
  collaboratorName: string | null;
  title: string;
  /** Title, else job name, else null (the UI falls back to a generic word). */
  label: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  notes: string;
  reminderSentAt: string | null;
  /** Ids of other blocks on the same worker that overlap this one. */
  conflicts: string[];
  updatedAt: string;
};

export type ScheduleWorkerDto = { id: string; name: string; role: string; hasPhone: boolean; hasEmail: boolean };
export type ScheduleMilestoneDto = { id: string; title: string; status: string; plannedStart: string | null; plannedEnd: string | null };
export type ScheduleJobDto = { id: string; name: string; address: string; status: string; milestones: ScheduleMilestoneDto[] };

export type ScheduleWindowDto = {
  from: string;
  to: string;
  blocks: ScheduleBlockDto[];
  workers: ScheduleWorkerDto[];
  jobs: ScheduleJobDto[];
};

export type BlockInput = {
  projectId?: string | null;
  milestoneId?: string | null;
  collaboratorId?: string | null;
  title?: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  notes?: string;
};

export const scheduleApi = {
  window: (from: Date, to: Date, projectId?: string) => {
    const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (projectId) q.set("projectId", projectId);
    return req<ScheduleWindowDto>(`/api/schedule?${q.toString()}`);
  },
  create: (body: BlockInput) => req<{ block: ScheduleBlockDto }>("/api/schedule/blocks", { method: "POST", body: json(body) }),
  update: (id: string, body: Partial<BlockInput>) => req<{ block: ScheduleBlockDto }>(`/api/schedule/blocks/${id}`, { method: "PUT", body: json(body) }),
  remove: (id: string) => req<{ success: true }>(`/api/schedule/blocks/${id}`, { method: "DELETE" }),
};
