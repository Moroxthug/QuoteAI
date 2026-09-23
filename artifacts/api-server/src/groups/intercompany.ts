// ── Phase 90: which invoices and costs are between two group companies ───────
// Pure, so it is unit-tested. A consolidated view that adds up company A's
// invoice to company B and B's cost for the same work counts the work twice
// (once as revenue, once as cost) and inflates both — so those lines are taken
// out of the group totals and shown on their own line. Matching is on what the
// documents already carry: the GST/HST business number first, then the email,
// then the company name with the legal suffixes stripped.

export type GroupCompanyKey = { orgId: string; name: string; email: string | null; businessNumber: string | null };

export type PartyLike = { name?: string | null; email?: string | null; gstHstNumber?: string | null };

const SUFFIXES = new Set(["inc", "incorporated", "ltd", "ltee", "limited", "limitee", "corp", "corporation", "co", "company", "cie", "enr", "senc", "llc"]);

export function normalizeCompanyName(name: string | null | undefined): string {
  if (!name) return "";
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1]!)) words.pop();
  return words.join(" ");
}

/** The 9-digit CRA business number at the front of a GST/HST or QST registration. */
export function businessNumber9(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(0, 9) : null;
}

/** The group company a customer or vendor is, other than `selfOrgId` — or null. */
export function matchGroupCompany(party: PartyLike, companies: GroupCompanyKey[], selfOrgId: string): string | null {
  const others = companies.filter((c) => c.orgId !== selfOrgId);
  const bn = businessNumber9(party.gstHstNumber);
  if (bn) {
    const hit = others.find((c) => businessNumber9(c.businessNumber) === bn);
    if (hit) return hit.orgId;
  }
  const email = party.email?.trim().toLowerCase();
  if (email) {
    const hit = others.find((c) => c.email && c.email.trim().toLowerCase() === email);
    if (hit) return hit.orgId;
  }
  const name = normalizeCompanyName(party.name);
  if (name.length >= 3) {
    const hit = others.find((c) => normalizeCompanyName(c.name) === name);
    if (hit) return hit.orgId;
  }
  return null;
}
