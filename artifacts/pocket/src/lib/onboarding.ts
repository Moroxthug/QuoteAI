// Onboarding's data and pure rules (no React, no network: tested in onboarding.test.ts).
// The value sets match the web app (quote-ai: lib/people-api.ts COMPANY_TRADES, lib/payment-schedule.ts
// CANADIAN_PROVINCES) so the API sees the same codes from both.

export type IconKey = "house" | "hammer" | "brush" | "bolt" | "drop" | "fan" | "roof" | "grid" | "box" | "bricks" | "leaf" | "plus";
export type ToneKey = "slate" | "violet" | "rose" | "gold" | "azure" | "sky" | "clay" | "amber" | "stone" | "sage" | "lilac";

/** The 12 tiles on the board, in the board's order. `id` is the API's trade code. */
export const TRADES: { id: string; icon: IconKey; tone: ToneKey }[] = [
  { id: "general", icon: "house", tone: "slate" },
  { id: "renovation", icon: "hammer", tone: "violet" },
  { id: "painting", icon: "brush", tone: "rose" },
  { id: "electrical", icon: "bolt", tone: "gold" },
  { id: "plumbing", icon: "drop", tone: "azure" },
  { id: "hvac", icon: "fan", tone: "sky" },
  { id: "roofing", icon: "roof", tone: "clay" },
  { id: "flooring", icon: "grid", tone: "amber" },
  { id: "drywall", icon: "box", tone: "stone" },
  { id: "masonry", icon: "bricks", tone: "clay" },
  { id: "landscaping", icon: "leaf", tone: "sage" },
  { id: "other", icon: "plus", tone: "lilac" },
];

/** In the board's order (Ontario first); the server accepts these two-letter codes. */
export const PROVINCES = ["ON", "QC", "BC", "AB", "SK", "MB", "NS", "NB", "NL", "PE", "YT", "NT", "NU"] as const;
export type ProvinceCode = (typeof PROVINCES)[number];

/** Board roles → the API's roles (crew can see their work and clock in: "viewer"). */
export type PersonRole = "admin" | "foreman" | "crew";
export const ROLE_ORDER: PersonRole[] = ["admin", "foreman", "crew"];
export const API_ROLE: Record<PersonRole, "admin" | "foreman" | "viewer"> = { admin: "admin", foreman: "foreman", crew: "viewer" };

export function nextRole(r: PersonRole): PersonRole {
  return ROLE_ORDER[(ROLE_ORDER.indexOf(r) + 1) % ROLE_ORDER.length]!;
}

/** The team-size control's four options → the number sent as `teamSize` (undefined for "just me"). */
export const TEAM_SIZE_VALUE: (number | undefined)[] = [undefined, 4, 10, 20];

export type Person = { email: string; role: PersonRole };

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._\-+\s]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : local.slice(0, 2);
  return (letters || "?").toUpperCase();
}

/** Name shown for an invited address: "luca.bianchi@x.ca" → "Luca Bianchi". */
export function nameOf(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.split(/[._\-+]+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ") || email;
}

export type CompanyFields = {
  companyName: string;
  phone: string;
  email: string;
  vatNumber: string;
  address: string;
};

/** The body of useUpdateBusinessProfile: empty optional fields are left out. */
export function companyBody(f: CompanyFields) {
  return {
    companyName: f.companyName.trim(),
    vatNumber: f.vatNumber.trim() || undefined,
    address: f.address.trim() || undefined,
    phone: f.phone.trim() || undefined,
    email: f.email.trim() || undefined,
  };
}

/** The extras PUT to /api/business-profile; null when there is nothing to send. */
export function detailsBody(d: { province: ProvinceCode | null; licenceNumber: string; etransferEmail: string }) {
  if (!d.province && !d.licenceNumber.trim() && !d.etransferEmail.trim()) return null;
  return {
    province: d.province,
    licenceNumber: d.licenceNumber.trim() || null,
    etransferEmail: d.etransferEmail.trim() || null,
  };
}

export type CompanySetup = { trades?: string[]; teamSize?: number; fieldCrew?: boolean };

/** The "your work" answers; null when nothing was answered. */
export function setupBody(s: { trades: string[]; sizeIndex: number | null; fieldCrew: boolean | null }): CompanySetup | null {
  const out: CompanySetup = {};
  if (s.trades.length) out.trades = s.trades;
  const size = s.sizeIndex == null ? undefined : TEAM_SIZE_VALUE[s.sizeIndex];
  if (size) out.teamSize = size;
  if (s.sizeIndex != null && s.sizeIndex > 0 && s.fieldCrew !== null) out.fieldCrew = s.fieldCrew;
  return Object.keys(out).length ? out : null;
}

export function togglePick(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** How many access codes "Create" makes: one for each crew member listed, at least one. */
export function codeCount(people: Person[]): number {
  return Math.max(1, people.filter((p) => p.role === "crew").length);
}
