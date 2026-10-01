// CompanyPicker.dc.html: the person's companies, which one is selected, and the company they were removed from.
import type { OrgDto } from "./api";

/** What the phone remembers about a company between visits, to tell when access was taken away and to show "Last opened". */
export type KnownOrg = { orgId: string; companyName: string; role: OrgDto["role"]; lastOpened?: string };

/** Where the phone keeps the companies it has seen (the picker and the accountant view both write it). */
export const KNOWN_KEY = "quoteai.knownCompanies";

export type PickerRow = { org: KnownOrg; gone: boolean };

/** The current list plus the remembered companies that are no longer in it (removed). */
export function pickerRows(current: OrgDto[], known: KnownOrg[]): PickerRow[] {
  const byId = new Map(known.map((k) => [k.orgId, k]));
  const rows: PickerRow[] = current.map((o) => ({ org: { orgId: o.orgId, companyName: o.companyName, role: o.role, lastOpened: byId.get(o.orgId)?.lastOpened }, gone: false }));
  const here = new Set(current.map((o) => o.orgId));
  for (const k of known) if (!here.has(k.orgId)) rows.push({ org: k, gone: true });
  return rows;
}

/** The row selected first: the company stored on this phone when still available, else the most recently opened, else the first. */
export function initialSelection(rows: PickerRow[], activeOrgId: string | null): string | null {
  const open = rows.filter((r) => !r.gone);
  if (open.length === 0) return null;
  const stored = open.find((r) => r.org.orgId === activeOrgId);
  if (stored) return stored.org.orgId;
  const dated = open.filter((r) => r.org.lastOpened).sort((a, b) => (b.org.lastOpened ?? "").localeCompare(a.org.lastOpened ?? ""));
  return (dated[0] ?? open[0]!).org.orgId;
}

/** The remembered list after a visit to `activeId`: the current companies (the open one dated now), then the remembered ones that are gone, kept so a removal can still be told. */
export function mergeKnown(known: KnownOrg[], current: OrgDto[], activeId: string | null, now: Date): KnownOrg[] {
  const byId = new Map(known.map((k) => [k.orgId, k]));
  const here = new Set(current.map((o) => o.orgId));
  return [
    ...current.map((o) => ({ orgId: o.orgId, companyName: o.companyName, role: o.role, lastOpened: o.orgId === activeId ? now.toISOString() : byId.get(o.orgId)?.lastOpened })),
    ...known.filter((k) => !here.has(k.orgId)),
  ];
}

export function parseKnown(raw: string | null): KnownOrg[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((k): k is KnownOrg => !!k && typeof k.orgId === "string" && typeof k.companyName === "string" && typeof k.role === "string");
  } catch {
    return [];
  }
}

/** The list to remember after a choice: the current companies, each with when it was last opened. */
export function remember(rows: PickerRow[], openedId: string, now: Date): KnownOrg[] {
  return rows.filter((r) => !r.gone).map((r) => ({ ...r.org, lastOpened: r.org.orgId === openedId ? now.toISOString() : r.org.lastOpened }));
}

/** switchOrg answered "no access" (403) or "no such company" (404). */
export function isRemoval(failure: { status: number }): boolean {
  return failure.status === 403 || failure.status === 404;
}
