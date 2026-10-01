// The foreman's Home calls: the office's crew day, answering a blocker or a report, approving hours.
import { api } from "./api";
import type { CrewTodayView } from "./foreman";

export const foremanApi = {
  today: () => api<CrewTodayView>("/api/crew/today"),
  resolve: (id: string, note?: string) => api<unknown>(`/api/field-reports/${encodeURIComponent(id)}/resolve`, { method: "POST", body: note ? { note } : {} }),
  approve: (ids: string[]) => api<{ approved: number }>("/api/team/time-entries/approve", { method: "POST", body: { ids } }),
};
