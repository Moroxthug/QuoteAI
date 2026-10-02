// The company assistant: the server calls (routes/assistant-company.ts). Approving does what the card says; every action lands in Activity.
import { api } from "./api";
import type { ActivityOverview, ActivityRow, LevelKey, Level, Permissions, ProposalsOverview, Quiet, Suggestion } from "./assistant";

const id = encodeURIComponent;

export type PermissionsPatch = Partial<{ levels: Partial<Record<LevelKey, Level>>; spendLimitCents: number; quiet: Partial<Quiet>; readBack: boolean }>;

export const assistantApi = {
  overview: () => api<ProposalsOverview>("/api/assistant/overview"),
  approve: (suggestionId: string, draft?: string) => api<{ suggestion: Suggestion; activityId: string | null }>(`/api/assistant/suggestions/${id(suggestionId)}/approve`, { method: "POST", body: draft !== undefined ? { draft } : {} }),
  dismiss: (suggestionId: string) => api<{ suggestion: Suggestion }>(`/api/assistant/suggestions/${id(suggestionId)}/dismiss`, { method: "POST", body: {} }),
  restore: (suggestionId: string) => api<{ suggestion: Suggestion }>(`/api/assistant/suggestions/${id(suggestionId)}/restore`, { method: "POST", body: {} }),
  activity: () => api<ActivityOverview>("/api/assistant/activity"),
  undo: (activityId: string) => api<{ activity: ActivityRow; toast: string }>(`/api/assistant/activity/${id(activityId)}/undo`, { method: "POST", body: {} }),
  /** The voice this person chose (Settings): ember, tide or stone. */
  voice: () => api<{ preferences: { voice?: "ember" | "tide" | "stone" } }>("/api/me/preferences"),
  permissions: () => api<Permissions>("/api/assistant/permissions"),
  savePermissions: (patch: PermissionsPatch) => api<Omit<Permissions, "enabled" | "canEdit">>("/api/assistant/permissions", { method: "PUT", body: patch }),
};
