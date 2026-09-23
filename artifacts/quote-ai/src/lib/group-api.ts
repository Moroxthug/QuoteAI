// Phase 90 — company groups: the consolidated view, the shared catalog, crew on
// more than one payroll, and one bill.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";
import type { TeamMemberRole } from "@/lib/team-members-api";

type Role = "owner" | TeamMemberRole;

export type GroupCompanyDto = {
  orgId: string;
  companyName: string;
  province: string | null;
  status: "pending" | "active";
  covered: boolean;
  useGroupCatalog: boolean;
  isManager: boolean;
  isBilling: boolean;
  isCatalog: boolean;
  isCurrent: boolean;
  yourRole: Role | null;
};

type GroupDto = {
  id: string;
  name: string;
  managerOrgId: string;
  catalogOrgId: string | null;
  billingOrgId: string | null;
  self: { status: "pending" | "active"; useGroupCatalog: boolean; covered: boolean };
  companies: GroupCompanyDto[];
};

export type GroupBillingDto = { available: boolean; reason: string | null; plan: string | null; interval: "month" | "year" };

export type GroupPageDto = {
  available: boolean;
  requiredPlan: string;
  canManage: boolean;
  canDecide: boolean;
  group: GroupDto | null;
  billing: GroupBillingDto | null;
  coveredBy: { orgId: string; companyName: string | null } | null;
  candidates: { orgId: string; companyName: string }[];
};

type Totals = { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number };
type Aging = { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; totalCents: number; overdueCents: number };
type Excluded = { orgId: string; companyName: string; role: Role | null };

export type GroupOverviewDto = {
  months: number;
  companies: { orgId: string; companyName: string; province: string | null; totals: Totals; aging: Aging; activeJobs: number }[];
  excluded: Excluded[];
  consolidated: Omit<Totals, never> & { activeJobs: number };
  intercompany: { invoicedCents: number; costCents: number; lines: { fromOrgId: string; toOrgId: string; kind: "invoice" | "cost"; count: number; cents: number }[] };
  series: { month: string; invoicedCents: number; collectedCents: number; costCents: number }[];
  aging: Aging;
  cashFlow: { week: string; netCents: number; cumulativeCents: number }[];
};

export type GroupCrewDto = {
  weekOf: string;
  workers: { id: string; orgId: string; companyName: string; name: string; role: string; workerType: string; personId: string | null; hasLink: boolean }[];
  people: { personId: string; name: string; companies: { orgId: string; companyName: string; workerId: string; hours: number; weeklyThreshold: number | null }[]; combinedHours: number; overCombined: boolean }[];
  excluded: Excluded[];
};

type Wrapped = { group: GroupDto | null; billing?: GroupBillingDto | null };

export const groupApi = {
  get: () => req<GroupPageDto>("/api/group"),
  create: (name: string) => req<Wrapped>("/api/group", { method: "POST", body: json({ name }) }),
  update: (body: { name?: string; catalogOrgId?: string | null }) => req<Wrapped>("/api/group", { method: "PUT", body: json(body) }),
  invite: (orgId: string) => req<Wrapped>("/api/group/companies", { method: "POST", body: json({ orgId }) }),
  accept: () => req<Wrapped>("/api/group/accept", { method: "POST" }),
  decline: () => req<Wrapped>("/api/group/decline", { method: "POST" }),
  remove: (orgId: string) => req<Wrapped>(`/api/group/companies/${encodeURIComponent(orgId)}`, { method: "DELETE" }),
  setMine: (useGroupCatalog: boolean) => req<Wrapped>("/api/group/me", { method: "PUT", body: json({ useGroupCatalog }) }),
  setPays: (pays: boolean) => req<Wrapped>("/api/group/billing", { method: "PUT", body: json({ pays }) }),
  setCovered: (orgId: string, covered: boolean) => req<Wrapped>(`/api/group/companies/${encodeURIComponent(orgId)}/coverage`, { method: "PUT", body: json({ covered }) }),
  overview: (months: number) => req<GroupOverviewDto>(`/api/group/overview?months=${months}`),
  crew: (day: string) => req<GroupCrewDto>(`/api/group/crew?day=${day}`),
  link: (workerIds: string[]) => req<{ personId: string }>("/api/group/crew/link", { method: "POST", body: json({ workerIds }) }),
  unlink: (workerId: string) => req<{ success: true }>(`/api/group/crew/link/${workerId}`, { method: "DELETE" }),
};
