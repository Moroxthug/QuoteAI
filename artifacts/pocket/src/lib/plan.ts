// Plan and billing: the pure parts. How full a meter is, and the list of what the plan includes (a row per feature, locked when the plan lacks it).
export const PLANS_URL = "https://quoteai.ca/dashboard/billing";

export type Meter = { used: number; limit: number };
export type Level = "ok" | "near" | "full";

/** 0 to 1 and the level: 80% is "near" (amber), all of it "full" (red). */
export function meterOf(m: Meter): { value: number; level: Level } {
  const value = m.limit > 0 ? Math.min(1, m.used / m.limit) : 1;
  const pct = Math.round(value * 100);
  return { value, level: pct >= 100 ? "full" : pct >= 80 ? "near" : "ok" };
}

export type FeatureRow = { id: string; included: boolean; tier: "pro" | "business"; count?: number };

/** What each row needs from the server's `features` list; rows built from two features need both. */
const NEEDS: { id: string; any: string[]; tier: "pro" | "business" }[] = [
  { id: "contracts", any: ["contracts"], tier: "pro" },
  { id: "costs", any: ["costs", "invoicing"], tier: "pro" },
  { id: "teamTime", any: ["team_time"], tier: "business" },
  { id: "assistant", any: ["assistant"], tier: "business" },
  { id: "analytics", any: ["analytics_pro"], tier: "business" },
  { id: "books", any: ["quickbooks_sync", "wave_sync"], tier: "business" },
  { id: "calendar", any: ["calendar_sync"], tier: "business" },
  { id: "cards", any: ["invoice_card_payments"], tier: "business" },
  { id: "gmail", any: ["gmail_send"], tier: "business" },
];

/** The quotes and jobs rows say what the plan caps ("60 quotes a month", "3 active jobs") or "Unlimited quotes and jobs"; the logins row says how many. */
export function featureRows(features: string[], o: { quotes: Meter | null; openJobs: Meter | null; logins: number }): FeatureRow[] {
  const has = (f: string) => features.includes(f);
  const rows: FeatureRow[] = [];
  if (!has("quotes")) return rows;
  if (has("jobs") && !o.quotes && !o.openJobs) rows.push({ id: "unlimited", included: true, tier: "business" });
  else {
    if (o.quotes) rows.push({ id: "quotes", included: true, tier: "pro", count: o.quotes.limit });
    if (o.openJobs) rows.push({ id: "jobs", included: true, tier: "pro", count: o.openJobs.limit });
  }
  for (const n of NEEDS) rows.push({ id: n.id, included: n.id === "books" ? n.any.some(has) : n.any.every(has), tier: n.tier });
  if (has("team_accounts")) rows.push({ id: "logins", included: true, tier: "pro", count: o.logins });
  return rows;
}
