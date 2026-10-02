// Connected apps: the pure parts. Twelve apps (as Integrations.dc.html draws them) in eight groups, each in one of six states, and what the list shows from that:
// those connected on top, the rest as tiles (the ones that need a plan after the ones you can connect). Where the server has the app, its answers decide the state.
export type AppId = "qbo" | "xero" | "wave" | "stripe" | "gcal" | "outlook" | "wa" | "drive" | "jobber" | "hd" | "hs" | "gbp";
export type Cat = "acct" | "pay" | "msg" | "cal" | "store" | "supp" | "lead";
export const CATS: ("all" | Cat)[] = ["all", "acct", "pay", "msg", "cal", "store", "supp", "lead"];
export type State = "connected" | "attention" | "paused" | "none" | "soon" | "locked";

export type AppDef = { id: AppId; cat: Cat; icon: "bars" | "orb" | "wave" | "card" | "cal" | "chat" | "cloud" | "export" | "hammer" | "star" | "pin"; tone: string; /** The plan feature that unlocks it. */ feature?: string; /** Or the cheapest plan that includes it. */ minPlan?: string; /** The server has nothing for it yet. */ none?: boolean };

export const APPS: AppDef[] = [
  { id: "qbo", cat: "acct", icon: "bars", tone: "sage", feature: "quickbooks_sync" },
  { id: "xero", cat: "acct", icon: "orb", tone: "sky", none: true },
  { id: "wave", cat: "acct", icon: "wave", tone: "teal", feature: "wave_sync" },
  { id: "stripe", cat: "pay", icon: "card", tone: "violet", feature: "invoice_card_payments" },
  { id: "gcal", cat: "cal", icon: "cal", tone: "azure", feature: "calendar_sync" },
  { id: "outlook", cat: "cal", icon: "cal", tone: "indigo", feature: "calendar_sync" },
  { id: "wa", cat: "msg", icon: "chat", tone: "sage", minPlan: "monthly_pro" },
  { id: "drive", cat: "store", icon: "cloud", tone: "amber", none: true },
  { id: "jobber", cat: "store", icon: "export", tone: "slate" },
  { id: "hd", cat: "supp", icon: "hammer", tone: "clay", none: true },
  { id: "hs", cat: "lead", icon: "star", tone: "gold" },
  { id: "gbp", cat: "lead", icon: "pin", tone: "rose", feature: "google_lsa" },
];

export const isOn = (s: State): boolean => s === "connected" || s === "attention" || s === "paused";

const PLAN_ORDER = ["free", "monthly_starter", "monthly_pro", "monthly_business", "monthly_elite"];
/** Does the plan (and its feature list from the server) include the app? */
export function unlocked(app: AppDef, plan: string, features: string[]): boolean {
  if (app.none) return true;
  if (app.minPlan) return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(app.minPlan);
  return !app.feature || features.includes(app.feature);
}

type Status = { connected?: boolean; available?: boolean; isEnabled?: boolean | null; chargesEnabled?: boolean } | null | undefined;

/** The shape most apps share: not set up on the server → soon; connected on or off; otherwise Connect. `attention` is a failure the owner should look at. */
export function stateOf(s: Status, attention = false): State {
  if (!s) return "none";
  if (!s.connected) return s.available === false ? "soon" : "none";
  if (attention) return "attention";
  return s.isEnabled === false ? "paused" : "connected";
}

type LogEntry = { entityType?: string; entityId?: string; milestoneId?: string; provider?: string; status: string };
/** The sync logs only grow (a retry adds a row), so an entity needs attention while its newest row, newest first, is a failure. */
export function unresolvedFailures<T extends LogEntry>(entries: readonly T[] | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of entries ?? []) {
    const key = `${e.provider ?? ""}:${e.entityType ?? ""}:${e.entityId ?? e.milestoneId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.status === "failed" && e.entityType !== "payment_pull") out.push(e);
  }
  return out;
}

/** The apps matching a category and a search (the name, or its words), in the board's order. */
export function visible(apps: AppDef[], cat: "all" | Cat, term: string, words: (id: AppId) => string): AppDef[] {
  const q = term.trim().toLowerCase();
  return apps.filter((a) => (cat === "all" || a.cat === cat) && (!q || words(a.id).toLowerCase().includes(q)));
}

/** The tiles: what can be connected first, then the coming soon, then what a plan unlocks. */
export function tileOrder(apps: AppDef[], states: Record<AppId, State>): AppDef[] {
  const rank = (s: State) => (s === "soon" ? 1 : s === "locked" ? 2 : 0);
  return apps.map((a, i) => ({ a, i })).sort((x, y) => rank(states[x.a.id]) - rank(states[y.a.id]) || x.i - y.i).map((x) => x.a);
}

export type Counts = { on: number; attention: number };
export function counts(states: Record<AppId, State>): Counts {
  const all = Object.values(states);
  return { on: all.filter(isOn).length, attention: all.filter((s) => s === "attention").length };
}

const FEATURE_PLAN: Record<string, string> = { quickbooks_sync: "monthly_business", wave_sync: "monthly_business", invoice_card_payments: "monthly_business", calendar_sync: "monthly_business", google_lsa: "monthly_elite" };
/** The cheapest plan that includes the app, or null when every plan has it. */
export const requiredPlan = (app: AppDef): string | null => app.minPlan ?? (app.feature ? FEATURE_PLAN[app.feature] ?? "monthly_elite" : null);
