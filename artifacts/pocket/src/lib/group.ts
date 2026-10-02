// Group (Group.dc.html): the companies that belong to one group, the month's figures for all of them (work between them left out) or for one,
// the invoiced bars, who pays the bill and who shares the price book, and the crew who work for more than one company. Pure, so they are tested
// (group.test.ts). The server's shapes are routes/groups.ts and groups/service.ts.

export type GroupCompany = {
  orgId: string; companyName: string; province: string | null; status: "active" | "pending"; covered: boolean; useGroupCatalog: boolean;
  isManager: boolean; isBilling: boolean; isCatalog: boolean; isCurrent: boolean; yourRole: string | null;
};
export type GroupDto = {
  id: string; name: string; managerOrgId: string; catalogOrgId: string | null; billingOrgId: string | null;
  self: { status: "active" | "pending"; useGroupCatalog: boolean; covered: boolean }; companies: GroupCompany[];
};
export type GroupResponse = {
  available: boolean; requiredPlan: string; canManage: boolean; canDecide: boolean; group: GroupDto | null;
  billing: { available: boolean; reason: string | null; plan: string | null; interval: string } | null;
  coveredBy: { orgId: string; companyName: string | null } | null; candidates: { orgId: string; companyName: string }[];
};

export type Totals = { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number };
export type MonthCell = { month: string; invoicedCents: number; costCents: number };
export type OverviewCompany = { orgId: string; companyName: string; province: string | null; totals: Totals; activeJobs: number; series: MonthCell[] };
export type GroupOverview = {
  months: number; companies: OverviewCompany[]; excluded: { orgId: string; companyName: string; role: string | null }[];
  consolidated: { invoicedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; activeJobs: number };
  intercompany: { invoicedCents: number; costCents: number; byMonth: { month: string; invoicedCents: number; costCents: number }[] };
  series: { month: string; invoicedCents: number; collectedCents: number; costCents: number }[];
};

export type CrewCompany = { orgId: string; companyName: string; workerId: string; hours: number; weeklyThreshold: number | null };
export type CrewPerson = { personId: string; name: string; companies: CrewCompany[]; combinedHours: number; overCombined: boolean };
export type CrewWorker = { id: string; orgId: string; companyName: string; name: string; role: string; workerType: string; personId: string | null; hasLink: boolean };
export type GroupCrew = { weekOf: string; workers: CrewWorker[]; people: CrewPerson[]; excluded: { orgId: string; companyName: string }[] };

/** "all" or one company's id. */
export type Scope = "all" | string;

// ── Names ───────────────────────────────────────────────────────────────────

/** The names without the word they all start with: "Rossi Renovations" and "Rossi Commercial" become "Renovations" and "Commercial". */
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names;
  const first = (n: string) => n.trim().split(/\s+/)[0] ?? "";
  const head = first(names[0]!);
  if (!head || !names.every((n) => first(n).toLowerCase() === head.toLowerCase() && n.trim().split(/\s+/).length > 1)) return names;
  return names.map((n) => n.trim().split(/\s+/).slice(1).join(" "));
}

export const initialsOf = (name: string): string => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1]![0]! : "")).toUpperCase();
};

// ── The month ───────────────────────────────────────────────────────────────

export const currentMonth = (o: Pick<GroupOverview, "series">): string | null => o.series[o.series.length - 1]?.month ?? null;
export const previousMonth = (month: string): string => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) - 1;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};

/** The month the figures are for: this month, or the one before while this one has nothing yet (the first days of a month). */
export function shownMonth(o: Pick<GroupOverview, "series" | "companies">): string | null {
  const now = currentMonth(o);
  if (!now) return null;
  const any = (m: string) => o.companies.some((c) => (c.series.find((x) => x.month === m)?.invoicedCents ?? 0) !== 0 || (c.series.find((x) => x.month === m)?.costCents ?? 0) !== 0);
  const before = previousMonth(now);
  return !any(now) && any(before) ? before : now;
}

const cell = (c: OverviewCompany, month: string): MonthCell => c.series.find((s) => s.month === month) ?? { month, invoicedCents: 0, costCents: 0 };

/** What was invoiced and spent in a month: for all the companies with the work between them taken out, or for one. */
export function monthSums(o: GroupOverview, scope: Scope, month: string): { invoicedCents: number; costCents: number } {
  if (scope !== "all") {
    const c = o.companies.find((x) => x.orgId === scope);
    return c ? { invoicedCents: cell(c, month).invoicedCents, costCents: cell(c, month).costCents } : { invoicedCents: 0, costCents: 0 };
  }
  const ic = o.intercompany.byMonth.find((m) => m.month === month);
  return {
    invoicedCents: o.companies.reduce((n, c) => n + cell(c, month).invoicedCents, 0) - (ic?.invoicedCents ?? 0),
    costCents: o.companies.reduce((n, c) => n + cell(c, month).costCents, 0) - (ic?.costCents ?? 0),
  };
}

/** The four figures: invoiced (and how it moved on the month before), costs, margin and profit, and what is owed (and what of it is late). */
export function monthFigures(o: GroupOverview, scope: Scope, month: string) {
  const now = monthSums(o, scope, month);
  const before = monthSums(o, scope, previousMonth(month));
  const one = scope === "all" ? null : o.companies.find((c) => c.orgId === scope);
  return {
    invoicedCents: now.invoicedCents,
    costCents: now.costCents,
    profitCents: now.invoicedCents - now.costCents,
    marginPercent: now.invoicedCents > 0 ? ((now.invoicedCents - now.costCents) / now.invoicedCents) * 100 : null,
    change: before.invoicedCents > 0 ? ((now.invoicedCents - before.invoicedCents) / before.invoicedCents) * 100 : null,
    outstandingCents: one ? one.totals.outstandingCents : o.consolidated.outstandingCents,
    overdueCents: one ? one.totals.overdueCents : o.consolidated.overdueCents,
  };
}

/** Work between the companies that was left out of the month's figures, or null when there was none. */
export const leftOut = (o: GroupOverview, month: string): number | null => {
  const ic = o.intercompany.byMonth.find((m) => m.month === month);
  const n = Math.max(ic?.invoicedCents ?? 0, ic?.costCents ?? 0);
  return n > 0 ? n : null;
};

/** The last `count` months of invoicing as stacked bars, one part per company in the scope; `max` is the tallest total, the bars' scale. */
export function monthBars(o: GroupOverview, scope: Scope, count = 3): { bars: { month: string; parts: { orgId: string; cents: number }[]; totalCents: number }[]; max: number } {
  const months = o.series.slice(-count).map((s) => s.month);
  const list = scope === "all" ? o.companies : o.companies.filter((c) => c.orgId === scope);
  const bars = months.map((month) => {
    const parts = list.map((c) => ({ orgId: c.orgId, cents: Math.max(0, cell(c, month).invoicedCents) }));
    return { month, parts, totalCents: parts.reduce((n, p) => n + p.cents, 0) };
  });
  return { bars, max: Math.max(1, ...bars.map((b) => b.totalCents)) };
}

// ── The crew ────────────────────────────────────────────────────────────────

/** The lowest weekly limit among a person's companies (the one they would cross first), or null when none has one. */
export const limitOf = (p: CrewPerson): number | null => {
  const l = p.companies.map((c) => c.weeklyThreshold).filter((x): x is number => x != null);
  return l.length ? Math.min(...l) : null;
};

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/** Two names that look like one person: the same name, or the same last name with a first name that is the other's initial or start ("D. Patel", "Dev Patel"). */
export function sameName(a: string, b: string): boolean {
  const x = fold(a).split(" ");
  const y = fold(b).split(" ");
  if (x.join(" ") === y.join(" ")) return x.length > 0 && x[0] !== "";
  if (x.length < 2 || y.length < 2) return false;
  if (x[x.length - 1] !== y[y.length - 1]) return false;
  const [p, q] = [x[0]!, y[0]!];
  return p[0] === q[0] && (p.length === 1 || q.length === 1 || p.startsWith(q) || q.startsWith(p));
}

/** Pairs of people on different companies' crews who are not linked yet and look like the same person; each person is in at most one pair. */
export function likelyDuplicates(workers: CrewWorker[]): { a: CrewWorker; b: CrewWorker }[] {
  const free = workers.filter((w) => !w.personId);
  const used = new Set<string>();
  const out: { a: CrewWorker; b: CrewWorker }[] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i]!;
      const b = free[j]!;
      if (used.has(a.id) || used.has(b.id) || a.orgId === b.orgId || !sameName(a.name, b.name)) continue;
      used.add(a.id);
      used.add(b.id);
      out.push({ a, b });
    }
  }
  return out;
}

// ── What the person can do ──────────────────────────────────────────────────

/** Companies of the group that are in it (not only invited). */
export const activeCompanies = (g: GroupDto): GroupCompany[] => g.companies.filter((c) => c.status === "active");

/** The group's price book is shared when a company is chosen to share it and this company uses it. */
export const sharesBook = (g: GroupDto): boolean => !!g.catalogOrgId && g.self.useGroupCatalog;

/** Who pays: the paying company's name and how many companies it pays for, or null when each pays its own. */
export function payer(g: GroupDto): { name: string; covers: number } | null {
  if (!g.billingOrgId) return null;
  const p = g.companies.find((c) => c.orgId === g.billingOrgId);
  return p ? { name: p.companyName, covers: g.companies.filter((c) => c.status === "active" && (c.covered || c.orgId === p.orgId)).length } : null;
}
