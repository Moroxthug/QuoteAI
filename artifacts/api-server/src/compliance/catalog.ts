// Phase 87 — what is *typically* required, as a starting point.
//
// Permits are municipal (building, demolition, plumbing, usually HVAC) or
// provincial (electrical and gas in Ontario and BC go to a safety authority,
// in Québec to licensed trades declaring to the RBQ). We do not pretend to
// know every municipality's bylaw: the suggestion names the kind of permit
// and who usually issues it, and the link for a municipal permit is a search
// for that permit in the job's own municipality, which never goes stale.
// Every screen that shows these says "check with the municipality".

import type { PermitKind, ReminderKind, ReminderRecurrence } from "@workspace/db";

export const WORK_TYPES = ["structural", "addition", "basement", "deck", "demolition", "electrical", "plumbing", "gas", "hvac"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

const WORK_PERMITS: Record<WorkType, PermitKind[]> = {
  structural: ["building"],
  addition: ["building", "electrical", "plumbing"],
  basement: ["building", "electrical", "plumbing"],
  deck: ["building"],
  demolition: ["demolition"],
  electrical: ["electrical"],
  plumbing: ["plumbing"],
  gas: ["gas"],
  hvac: ["hvac", "gas"],
};

type Authority = { name: string; url: string | null };

/** Provincial authorities we are sure of; everything else is the municipality. */
const PROVINCIAL: Partial<Record<string, Partial<Record<PermitKind, Authority>>>> = {
  ON: {
    electrical: { name: "Electrical Safety Authority (ESA)", url: "https://esasafe.com" },
    gas: { name: "TSSA (licensed gas contractor)", url: "https://www.tssa.org" },
  },
  BC: {
    electrical: { name: "Technical Safety BC (or the municipality where it issues its own)", url: "https://www.technicalsafetybc.ca/" },
    gas: { name: "Technical Safety BC (or the municipality where it issues its own)", url: "https://www.technicalsafetybc.ca/" },
  },
  QC: {
    electrical: { name: "RBQ — declaration by a CMEQ master electrician", url: "https://www.rbq.gouv.qc.ca" },
    gas: { name: "RBQ — licensed gas contractor", url: "https://www.rbq.gouv.qc.ca" },
    plumbing: { name: "Municipality (work by a CMMTQ master pipe-mechanic)", url: null },
  },
};

export type PermitSuggestion = { kind: PermitKind; authority: string; url: string };

/** "12 Elm St, Toronto, ON M4X" → "Toronto". Free-text addresses, so a best effort. */
export function municipalityOf(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[1]!.replace(/\b[A-Z]{2}\b.*$/, "").trim() || parts[1]!;
  return "";
}

export function suggestPermits(works: WorkType[], province: string | null, address: string): PermitSuggestion[] {
  const kinds = [...new Set(works.flatMap((w) => WORK_PERMITS[w] ?? []))];
  const place = municipalityOf(address) || province || "";
  return kinds.map((kind) => {
    const prov = PROVINCIAL[(province ?? "").toUpperCase()]?.[kind];
    const search = `https://www.google.com/search?q=${encodeURIComponent(`${kind} permit ${place}`.trim())}`;
    return { kind, authority: prov?.name ?? (place ? `Municipality — ${place}` : "Municipality"), url: prov?.url ?? search };
  });
}

// ── Reminder presets (workers' comp, licences, insurance) ────────────────────

export type ReminderPreset = {
  id: string;
  kind: ReminderKind;
  provinces: string[] | "all";
  title: { en: string; fr: string };
  authority: string;
  url: string | null;
  recurrence: ReminderRecurrence;
  /** A usual date (MM-DD) to pre-fill, only where the date is the same for everyone. The form asks to confirm it. */
  usualDate: string | null;
};

const REMINDER_PRESETS: ReminderPreset[] = [
  { id: "worksafebc", kind: "workers_comp", provinces: ["BC"], title: { en: "WorkSafeBC payroll report", fr: "Déclaration de salaires WorkSafeBC" }, authority: "WorkSafeBC", url: "https://www.worksafebc.com", recurrence: "quarterly", usualDate: null },
  { id: "wsib", kind: "workers_comp", provinces: ["ON"], title: { en: "WSIB premium report", fr: "Déclaration de primes WSIB" }, authority: "WSIB", url: "https://www.wsib.ca", recurrence: "quarterly", usualDate: null },
  { id: "cnesst", kind: "workers_comp", provinces: ["QC"], title: { en: "CNESST annual wage declaration", fr: "Déclaration des salaires CNESST" }, authority: "CNESST", url: "https://www.cnesst.gouv.qc.ca", recurrence: "annual", usualDate: "03-15" },
  { id: "wcb_ab", kind: "workers_comp", provinces: ["AB"], title: { en: "WCB-Alberta annual return", fr: "Déclaration annuelle WCB-Alberta" }, authority: "WCB-Alberta", url: "https://www.wcb.ab.ca", recurrence: "annual", usualDate: null },
  { id: "wcb_other", kind: "workers_comp", provinces: "all", title: { en: "Workers' compensation report", fr: "Déclaration à l'organisme d'indemnisation" }, authority: "", url: null, recurrence: "quarterly", usualDate: null },
  { id: "rbq", kind: "licence", provinces: ["QC"], title: { en: "RBQ licence — annual renewal", fr: "Licence RBQ — renouvellement annuel" }, authority: "Régie du bâtiment du Québec", url: "https://www.rbq.gouv.qc.ca", recurrence: "annual", usualDate: null },
  { id: "hcra", kind: "licence", provinces: ["ON"], title: { en: "HCRA builder/vendor licence renewal", fr: "Renouvellement de licence HCRA" }, authority: "Home Construction Regulatory Authority", url: "https://hcraontario.ca/", recurrence: "annual", usualDate: null },
  { id: "ab_prepaid", kind: "licence", provinces: ["AB"], title: { en: "Prepaid contracting licence renewal", fr: "Renouvellement du permis d'entrepreneur (prépaiement)" }, authority: "Government of Alberta", url: "https://www.alberta.ca/prepaid-contracting-licence", recurrence: "annual", usualDate: null },
  { id: "municipal_licence", kind: "licence", provinces: "all", title: { en: "Municipal business licence renewal", fr: "Renouvellement du permis d'affaires municipal" }, authority: "", url: null, recurrence: "annual", usualDate: null },
  { id: "liability_insurance", kind: "insurance", provinces: "all", title: { en: "Liability insurance renewal", fr: "Renouvellement de l'assurance responsabilité" }, authority: "", url: null, recurrence: "annual", usualDate: null },
  { id: "vehicle_insurance", kind: "insurance", provinces: "all", title: { en: "Commercial vehicle insurance renewal", fr: "Renouvellement de l'assurance des véhicules" }, authority: "", url: null, recurrence: "annual", usualDate: null },
];

export function presetsFor(province: string | null): ReminderPreset[] {
  const p = (province ?? "").toUpperCase();
  return REMINDER_PRESETS.filter((r) => r.provinces === "all" || r.provinces.includes(p));
}
