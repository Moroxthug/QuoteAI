// Group: the server calls (routes/groups.ts). Every change is the owner's or an admin's; the server says no to anyone else.
import { api } from "./api";
import type { GroupCrew, GroupOverview, GroupResponse } from "./group";

const id = encodeURIComponent;

export const groupApi = {
  get: () => api<GroupResponse>("/api/group"),
  overview: () => api<GroupOverview>("/api/group/overview?months=6"),
  crew: () => api<GroupCrew>("/api/group/crew"),
  start: (name: string) => api<{ group: unknown }>("/api/group", { method: "POST", body: { name } }),
  invite: (orgId: string) => api<{ group: unknown }>("/api/group/companies", { method: "POST", body: { orgId } }),
  accept: () => api<{ group: unknown }>("/api/group/accept", { method: "POST", body: {} }),
  decline: () => api<{ group: null }>("/api/group/decline", { method: "POST", body: {} }),
  leave: (orgId: string) => api<{ group: unknown }>(`/api/group/companies/${id(orgId)}`, { method: "DELETE" }),
  useBook: (useGroupCatalog: boolean) => api<{ group: unknown }>("/api/group/me", { method: "PUT", body: { useGroupCatalog } }),
  link: (workerIds: string[]) => api<{ personId: string }>("/api/group/crew/link", { method: "POST", body: { workerIds } }),
};
