// Job roles: what each role's phone shows first. Nine roles; each has four home sections (in order), four tabs (Home and three more), an access label and a starting set of the four
// sensitive switches. A person arranges their own home within it (hide or reorder; add back what the role leaves out), unless the owner turned that off. Source: SetRoles.dc.html,
// CustomizeHome.dc.html and RoleHomes.dc.html. The server keeps who has which role (routes/job-roles.ts); the roles themselves are here.
export type JobRole = "owner" | "officeManager" | "estimator" | "projectManager" | "dispatcher" | "bookkeeper" | "safety" | "foreman" | "crew";
export const ROLE_KEYS: JobRole[] = ["owner", "officeManager", "estimator", "projectManager", "dispatcher", "bookkeeper", "safety", "foreman", "crew"];
export type Access = "owner" | "office" | "viewer" | "foreman" | "link";
export type Tone = "violet" | "azure" | "teal" | "amber" | "sage" | "rose" | "gold" | "clay" | "slate" | "indigo" | "sky";
export type SensitiveKey = "payRates" | "margins" | "approveTime" | "sendInvoices";
export const SENSITIVE: SensitiveKey[] = ["payRates", "margins", "approveTime", "sendInvoices"];

export type RoleDef = { icon: string; tone: Tone; access: Access; sections: string[]; tabs: string[] };
export const ROLES: Record<JobRole, RoleDef> = {
  owner: { icon: "star", tone: "gold", access: "owner", sections: ["needs", "money", "quotes", "crew"], tabs: ["quotes", "jobs", "clients"] },
  officeManager: { icon: "building", tone: "azure", access: "office", sections: ["needs", "money", "today", "week"], tabs: ["quotes", "invoices", "clients"] },
  estimator: { icon: "ruler", tone: "violet", access: "office", sections: ["quotes", "visits", "win", "waiting"], tabs: ["quotes", "leads", "clients"] },
  projectManager: { icon: "list", tone: "teal", access: "office", sections: ["atRisk", "activeJobs", "budget", "changeOrders"], tabs: ["jobs", "schedule", "clients"] },
  dispatcher: { icon: "truck", tone: "amber", access: "office", sections: ["crewNow", "unassigned", "tomorrow", "week"], tabs: ["schedule", "jobs", "map"] },
  bookkeeper: { icon: "bank", tone: "sage", access: "office", sections: ["reconcile", "receipts", "hst", "comingUp"], tabs: ["invoices", "books", "pay"] },
  safety: { icon: "shield", tone: "rose", access: "viewer", sections: ["certificates", "incidents", "toolbox", "inspections"], tabs: ["jobs", "team", "docs"] },
  foreman: { icon: "hammer", tone: "clay", access: "foreman", sections: ["clock", "blockers", "crewToday", "tasks"], tabs: ["jobs", "schedule", "team"] },
  crew: { icon: "users", tone: "slate", access: "link", sections: ["clock", "tasksToday", "comingUp", "reports"], tabs: ["hours", "photos", "travel"] },
};

export type SectionDef = { icon: string; tone: Tone };
export const SECTIONS: Record<string, SectionDef> = {
  needs: { icon: "bell", tone: "clay" }, money: { icon: "card", tone: "sage" }, quotes: { icon: "doc", tone: "violet" }, crew: { icon: "users", tone: "azure" },
  today: { icon: "cal", tone: "azure" }, week: { icon: "list", tone: "slate" }, visits: { icon: "pin", tone: "rose" }, win: { icon: "bars", tone: "indigo" }, waiting: { icon: "clock", tone: "amber" },
  weather: { icon: "sun", tone: "gold" }, leads: { icon: "user", tone: "sage" },
  atRisk: { icon: "warn", tone: "amber" }, activeJobs: { icon: "cone", tone: "amber" }, budget: { icon: "percent", tone: "violet" }, changeOrders: { icon: "doc", tone: "violet" },
  crewNow: { icon: "pin", tone: "rose" }, unassigned: { icon: "hammer", tone: "amber" }, tomorrow: { icon: "cal", tone: "azure" },
  reconcile: { icon: "bank", tone: "sage" }, receipts: { icon: "receipt", tone: "rose" }, hst: { icon: "percent", tone: "teal" }, comingUp: { icon: "clock", tone: "amber" },
  certificates: { icon: "shield", tone: "rose" }, incidents: { icon: "warn", tone: "amber" }, toolbox: { icon: "chat", tone: "violet" }, inspections: { icon: "house", tone: "clay" },
  clock: { icon: "clock", tone: "amber" }, blockers: { icon: "warn", tone: "rose" }, crewToday: { icon: "users", tone: "azure" }, tasks: { icon: "list", tone: "violet" },
  tasksToday: { icon: "list", tone: "violet" }, reports: { icon: "doc", tone: "slate" },
};

/** What a person can add back to their home beyond the role's four. */
const EXTRAS: Record<JobRole, string[]> = {
  owner: ["weather", "leads"], officeManager: ["weather", "leads"], estimator: ["needs", "weather", "leads"], projectManager: ["needs", "weather"], dispatcher: ["needs", "weather"],
  bookkeeper: ["needs"], safety: ["needs", "weather"], foreman: ["weather"], crew: [],
};

export type TabDef = { icon: string; tone: Tone };
export const TABS: Record<string, TabDef> = {
  quotes: { icon: "doc", tone: "violet" }, leads: { icon: "user", tone: "sage" }, clients: { icon: "users", tone: "azure" }, jobs: { icon: "hammer", tone: "clay" }, schedule: { icon: "cal", tone: "teal" },
  invoices: { icon: "receipt", tone: "rose" }, map: { icon: "pin", tone: "amber" }, docs: { icon: "file", tone: "slate" }, books: { icon: "bank", tone: "gold" }, pay: { icon: "card", tone: "sage" }, team: { icon: "users", tone: "indigo" },
  hours: { icon: "clock", tone: "amber" }, photos: { icon: "photo", tone: "azure" }, travel: { icon: "truck", tone: "teal" },
};
/** The tabs a person can pick from (the ones in the board's tile grid); the others are not part of the role. */
export const TAB_CHOICES = ["quotes", "leads", "clients", "jobs", "schedule", "invoices", "map", "docs", "books"] as const;
/** Tabs a role may not have (the board draws Books locked for an estimator). */
export const lockedTabs = (role: JobRole): string[] => (role === "owner" || role === "bookkeeper" ? [] : role === "officeManager" ? ["pay"] : ["books", "pay"]);
export const MAX_TABS = 3;

export type HomePrefs = { order?: string[]; on?: Record<string, boolean>; tabs?: string[]; density?: 0 | 1 };

/** The home's sections in the person's order with what is shown: the role's four on, the extras off, unless they chose otherwise; a section the role gained since is added at its place. */
export function homeOf(role: JobRole, prefs: HomePrefs | null | undefined): { key: string; on: boolean }[] {
  const base = [...ROLES[role].sections, ...EXTRAS[role]];
  const known = new Set(base);
  const saved = (prefs?.order ?? []).filter((k) => known.has(k));
  const order = [...saved, ...base.filter((k) => !saved.includes(k))];
  return order.map((key) => ({ key, on: prefs?.on?.[key] ?? ROLES[role].sections.includes(key) }));
}

/** The three tabs after Home: the person's pick when it is still allowed, else the role's. */
export function tabsOf(role: JobRole, prefs: HomePrefs | null | undefined): string[] {
  const allowed = (k: string) => k in TABS && !lockedTabs(role).includes(k);
  const own = (prefs?.tabs ?? []).filter(allowed);
  const picked = own.length ? own.slice(0, MAX_TABS) : ROLES[role].tabs;
  return picked.slice(0, MAX_TABS);
}

export function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const a = list.slice();
  [a[i], a[j]] = [a[j]!, a[i]!];
  return a;
}

/** A tab toggled: removed if there, added if there is room; `full` says it could not be added. */
export function toggleTab(tabs: string[], key: string, locked: string[]): { tabs: string[]; full: boolean } {
  if (locked.includes(key)) return { tabs, full: false };
  if (tabs.includes(key)) return { tabs: tabs.filter((t) => t !== key), full: false };
  if (tabs.length >= MAX_TABS) return { tabs, full: true };
  return { tabs: [...tabs, key], full: false };
}

export const accessOf = (role: JobRole): Access => ROLES[role].access;

/** The four switches as each role starts (the same as the server's, in routes/job-roles.ts rules). */
const START: Record<JobRole, [boolean, boolean, boolean, boolean]> = {
  owner: [true, true, true, true], officeManager: [false, true, true, true], estimator: [false, true, false, false], projectManager: [false, true, true, false], dispatcher: [false, false, true, false],
  bookkeeper: [true, true, true, true], safety: [false, false, false, false], foreman: [false, false, true, false], crew: [false, false, false, false],
};
export const defaultSensitive = (role: JobRole): Record<SensitiveKey, boolean> => ({ payRates: START[role][0], margins: START[role][1], approveTime: START[role][2], sendInvoices: START[role][3] });

/** How many of the four differ from the role's start. */
export const changedCount = (role: JobRole, now: Record<SensitiveKey, boolean>): number => SENSITIVE.filter((k) => now[k] !== defaultSensitive(role)[k]).length;

/** "Carla" for one, "Amara, Sofia and 2 more" for four: the names are given, the "and N more" wording is the caller's. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

export const isJobRole = (v: unknown): v is JobRole => typeof v === "string" && (ROLE_KEYS as string[]).includes(v);
