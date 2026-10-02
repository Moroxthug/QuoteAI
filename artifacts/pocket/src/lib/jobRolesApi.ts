// The job roles server calls (routes/job-roles.ts, routes/member-prefs.ts).
import { api } from "./api";
import type { JobRole, SensitiveKey } from "./jobRoles";

export type Person = { id: string; name: string; email: string; access: string; jobRole: JobRole; assigned: boolean; overrides: Partial<Record<SensitiveKey, boolean>>; sensitive: Record<SensitiveKey, boolean> };
export type RolesOverview = { included: boolean; companyName: string; people: Person[]; crew: { id: string; name: string }[]; ownHome: Record<JobRole, boolean> };
export type MyRole = { included: boolean; jobRole: JobRole; access: string; sensitive: Record<SensitiveKey, boolean>; mayChangeHome: boolean };

export const jobRolesApi = {
  list: () => api<RolesOverview>("/api/job-roles"),
  savePerson: (id: string, body: { jobRole?: JobRole; sensitive?: Partial<Record<SensitiveKey, boolean>> }) => api<{ jobRole: JobRole; overrides: Person["overrides"]; sensitive: Person["sensitive"] }>(`/api/job-roles/members/${encodeURIComponent(id)}`, { method: "PUT", body }),
  saveSettings: (ownHome: Partial<Record<JobRole, boolean>>) => api<{ ownHome: Record<JobRole, boolean> }>("/api/job-roles/settings", { method: "PUT", body: { ownHome } }),
  me: () => api<MyRole>("/api/me/job-role"),
};
