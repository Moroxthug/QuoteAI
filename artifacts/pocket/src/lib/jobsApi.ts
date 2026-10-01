// The Jobs screens' server calls (routes/jobs.ts, crew.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { JobsResponse } from "./jobs";

export type CrewDay = {
  enabled: boolean;
  requiredPlan?: string;
  day?: string;
  jobs?: { jobId: string | null; jobName: string | null; address: string | null; crew: { blockId: string; workerId: string | null; workerName: string | null; startsAt: string; endsAt: string; allDay: boolean; title: string; clockedInAt: string | null; clockedInElsewhere: boolean }[] }[];
  clockedIn?: { entryId: string; workerId: string; workerName: string | null; projectId: string; projectName: string | null; since: string }[];
  blockers?: { id: string; projectId: string; projectName: string | null; authorName: string | null; body: string; createdAt: string }[];
};

export const jobsApi = {
  list: () => api<JobsResponse>("/api/jobs"),
  crewToday: () => api<CrewDay>("/api/crew/today"),
  resolveBlocker: (id: string) => api<unknown>(`/api/field-reports/${encodeURIComponent(id)}/resolve`, { method: "POST", body: {} }),
};
