// The Contracts list and the Contract page (Contracts.dc.html, Contract.dc.html): what each contract is called, the three numbers on top, the
// filters and groups, the steps from review to the client's signature, the sections of the agreement, who has signed, the terms and the
// activity. Pure, so they are tested (contracts.test.ts). The server's shapes (routes/contracts.ts, db/schema/contracts.ts) are typed here.

export type ContractStatus = "draft" | "sent" | "viewed" | "signed" | "declined" | "voided" | "expired";

/** One row of the list (`GET /api/contracts?lean=1`). */
export type ContractRow = {
  id: string; quoteId: string | null; kind: "agreement" | "change_order"; contractNumber: string; status: ContractStatus; title: string; customerName: string;
  contractValueCents: number; sentAt: string | null; viewedAt: string | null; signedAt: string | null; voidedAt: string | null; expiresAt: string | null; createdAt: string;
};

export type SectionKind = "legal" | "ai" | "data";
export type ContractSection = { key: string; heading: string; body: string; kind: SectionKind; editable: boolean };
export type Party = { name: string; legalName?: string; address?: string; city?: string; province?: string; postalCode?: string; email?: string; phone?: string; businessNumber?: string; licenceNumber?: string };
export type TaxLine = { code: string; label: string; rate: number; amount: number };

export type SignerDto = {
  id: string; role: "contractor" | "customer"; name: string; email: string; status: "pending" | "viewed" | "verified" | "signed" | "declined";
  signatureType: "drawn" | "typed" | null; signatureData?: string | null; signedAt: string | null; viewedAt: string | null; declinedAt: string | null; declineReason: string | null;
};
export type EventDto = { id: string; type: string; actor: string; detail: unknown; createdAt: string };

/** One contract (`GET /api/contracts/:id`, and the answer of every change to it). */
export type ContractFull = {
  id: string; quoteId: string | null; clientId: string | null; projectId: string | null; kind: "agreement" | "change_order"; parentContractId: string | null;
  contractNumber: string; status: ContractStatus; province: string; language: "en" | "fr"; templateKey: string;
  document: { title: string; language: "en" | "fr"; sections: ContractSection[] };
  variables: {
    contractNumber: string; quoteNumber: string; contractor: Party; customer: Party; siteAddress: string; province: string; projectTitle: string;
    subtotal: number; taxLines: TaxLine[]; taxTotal: number; total: number; startDate: string | null; estimatedDurationWeeks: number | null; warrantyMonths: number;
    paymentSchedule: { holdback: { enabled: boolean; percent: number } };
  };
  contractValueCents: number; holdbackEnabled: boolean; holdbackPercent: number; hasSignedPdf: boolean;
  sentAt: string | null; expiresAt: string | null; signedAt: string | null; voidedAt: string | null; voidReason: string | null; reminderCount: number; createdAt: string;
  signers: SignerDto[]; events: EventDto[];
};

// ── Status ──────────────────────────────────────────────────────────────────

/** The words the boards use: Draft, Awaiting, Viewed, Signed, Voided (plus Declined and Expired, which the server also has). */
export type ContractState = "draft" | "await" | "viewed" | "signed" | "voided" | "declined" | "expired";
export type StatusLook = { tone: "mute" | "warn" | "acc" | "ok" | "bad"; shape: "draft" | "clock" | "q2" | "check" | "x" | "off" };

export const STATE_LOOK: Record<ContractState, StatusLook> = {
  draft: { tone: "mute", shape: "draft" }, await: { tone: "warn", shape: "clock" }, viewed: { tone: "acc", shape: "q2" }, signed: { tone: "ok", shape: "check" },
  voided: { tone: "bad", shape: "x" }, declined: { tone: "bad", shape: "x" }, expired: { tone: "mute", shape: "off" },
};

export function stateOf(status: ContractStatus): ContractState {
  switch (status) {
    case "sent": return "await";
    case "voided": return "voided";
    default: return status;
  }
}

// ── The list ────────────────────────────────────────────────────────────────

export type ContractGroup = "open" | "signed" | "closed";
export const GROUP_ORDER: ContractGroup[] = ["open", "signed", "closed"];

export function groupOf(status: ContractStatus): ContractGroup {
  if (status === "signed") return "signed";
  if (status === "draft" || status === "sent" || status === "viewed") return "open";
  return "closed";
}

export type ContractFilter = "all" | "draft" | "await" | "signed" | "closed";
export const FILTER_ORDER: ContractFilter[] = ["all", "draft", "await", "signed", "closed"];

export function matchesFilter(status: ContractStatus, f: ContractFilter): boolean {
  switch (f) {
    case "all": return true;
    case "draft": return status === "draft";
    case "await": return status === "sent" || status === "viewed";
    case "signed": return status === "signed";
    case "closed": return groupOf(status) === "closed";
  }
}

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The search box: the client, the job or the number. Accents don't matter. */
export function matchesSearch(c: Pick<ContractRow, "customerName" | "title" | "contractNumber">, term: string): boolean {
  const q = fold(term.trim());
  return !q || fold(`${c.contractNumber} ${c.customerName} ${c.title}`).includes(q);
}

const DAY = 86_400_000;
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export type Kpis = {
  /** Open contracts (drafts and sent), and how many of them are the company's own to sign or send. */
  toSign: number; yours: number;
  /** Signed in the current month. */
  signed: { cents: number; count: number };
  /** The average days from sent to signed, over every signed contract that was sent; null when none. */
  avgDays: number | null;
  /** This month's average against the average before it (negative = faster); null when either has none. */
  deltaDays: number | null;
};

const daysToSign = (c: Pick<ContractRow, "sentAt" | "signedAt">): number | null => (c.sentAt && c.signedAt ? Math.max(0, (new Date(c.signedAt).getTime() - new Date(c.sentAt).getTime()) / DAY) : null);
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function kpis(rows: ContractRow[], now: Date): Kpis {
  const open = rows.filter((c) => groupOf(c.status) === "open");
  const signedRows = rows.filter((c) => c.status === "signed" && c.signedAt);
  const thisMonth = signedRows.filter((c) => monthKey(new Date(c.signedAt!)) === monthKey(now));
  const before = signedRows.filter((c) => monthKey(new Date(c.signedAt!)) !== monthKey(now));
  const spans = (list: ContractRow[]) => list.map(daysToSign).filter((x): x is number => x != null);
  const all = mean(spans(signedRows));
  const cur = mean(spans(thisMonth));
  const prev = mean(spans(before));
  return {
    toSign: open.length, yours: open.filter((c) => c.status === "draft").length,
    signed: { cents: thisMonth.reduce((s, c) => s + c.contractValueCents, 0), count: thisMonth.length },
    avgDays: all, deltaDays: cur != null && prev != null ? cur - prev : null,
  };
}

/** One decimal, rounded the way the board shows it ("1.2 d"). */
export const oneDecimal = (n: number): number => Math.round(n * 10) / 10;

// ── The page: steps and the main action ─────────────────────────────────────

export type Primary = "sign" | "send" | "waiting" | "download" | "closed";

/** How far the contract has got: 1 = reviewed (sign is next), 2 = signed by the company (send is next), 3 = sent (the client is next), 4 = everyone signed. */
export function stepOf(c: Pick<ContractFull, "status" | "signers" | "events">): 1 | 2 | 3 | 4 {
  if (c.status === "signed") return 4;
  if (c.status === "sent" || c.status === "viewed") return 3;
  const mine = c.signers.find((s) => s.role === "contractor");
  if (c.status === "draft") return mine?.status === "signed" ? 2 : 1;
  // declined, voided, expired: as far as it had got
  return c.signers.find((s) => s.role === "customer")?.viewedAt || c.events.some((e) => e.type === "sent") ? 3 : mine?.status === "signed" ? 2 : 1;
}

export function primaryOf(c: Pick<ContractFull, "status" | "signers" | "events">): Primary {
  switch (c.status) {
    case "draft": return stepOf(c) === 1 ? "sign" : "send";
    case "sent": case "viewed": return "waiting";
    case "signed": return "download";
    default: return "closed";
  }
}

/** Only a draft can be edited (the server refuses the rest). */
export const editable = (c: Pick<ContractFull, "status">): boolean => c.status === "draft";
/** Anything not executed and not already closed can be voided. */
export const canVoid = (c: Pick<ContractFull, "status">): boolean => c.status === "draft" || c.status === "sent" || c.status === "viewed";
export const canRemind = (c: Pick<ContractFull, "status">): boolean => c.status === "sent" || c.status === "viewed";

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

// ── The agreement ───────────────────────────────────────────────────────────

export type Inline = { text: string; bold: boolean };
export type Block = { kind: "p" | "li"; parts: Inline[] };

/** The server's markdown-lite: paragraphs split by a blank line, "- " bullets, **bold**. */
export function bodyBlocks(body: string): Block[] {
  const out: Block[] = [];
  for (const para of body.split(/\n\s*\n/)) {
    for (const line of para.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const bullet = /^[-•]\s+/.test(line);
      out.push({ kind: bullet ? "li" : "p", parts: inline(bullet ? line.replace(/^[-•]\s+/, "") : line) });
    }
  }
  return out;
}

function inline(line: string): Inline[] {
  const parts: Inline[] = [];
  line.split(/(\*\*[^*]+\*\*)/).forEach((chunk) => {
    if (!chunk) return;
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) parts.push({ text: chunk.slice(2, -2), bold: true });
    else parts.push({ text: chunk, bold: false });
  });
  return parts;
}

/** The parties and the signatures sections hold no text of their own: the server draws them from the variables. */
export function partyLines(p: Party): string[] {
  const place = [p.address, p.city, [p.province, p.postalCode].filter(Boolean).join(" ")].map((x) => x?.trim()).filter(Boolean).join(", ");
  return [p.legalName || p.name, place, [p.email, p.phone].filter(Boolean).join(" · ")].filter((x): x is string => !!x);
}

/** The server numbers its headings ("3. Contract Price"); the page has a number column of its own. */
export const plainHeading = (h: string): string => h.replace(/^\s*\d+[.)]\s+/, "");

export type SectionTag = "ai" | "legal" | "data";
export const sectionTag = (s: Pick<ContractSection, "kind" | "editable">): SectionTag => (s.kind === "ai" && s.editable ? "ai" : s.kind === "data" ? "data" : "legal");

// ── Signers ─────────────────────────────────────────────────────────────────

export type SignerWord = "yourTurn" | "signed" | "notSent" | "pending" | "viewed" | "declined" | "voided" | "expired";
export const SIGNER_LOOK: Record<SignerWord, { tone: "mute" | "warn" | "acc" | "ok" | "bad" | "info"; shape: "draft" | "clock" | "q1" | "q2" | "check" | "x" | "off" }> = {
  yourTurn: { tone: "warn", shape: "clock" }, signed: { tone: "ok", shape: "check" }, notSent: { tone: "mute", shape: "draft" }, pending: { tone: "info", shape: "q1" },
  viewed: { tone: "acc", shape: "q2" }, declined: { tone: "bad", shape: "x" }, voided: { tone: "bad", shape: "x" }, expired: { tone: "mute", shape: "off" },
};

export function signerWord(c: Pick<ContractFull, "status">, s: Pick<SignerDto, "role" | "status" | "viewedAt">): SignerWord {
  if (s.status === "signed") return "signed";
  if (s.status === "declined") return "declined";
  if (c.status === "voided") return "voided";
  if (c.status === "expired") return "expired";
  if (s.role === "contractor") return "yourTurn";
  if (c.status === "draft") return "notSent";
  return s.viewedAt || s.status === "viewed" || s.status === "verified" ? "viewed" : "pending";
}

// ── The terms ───────────────────────────────────────────────────────────────

export type Detail =
  | { key: "province"; value: string } | { key: "language"; value: "en" | "fr" } | { key: "subtotal"; cents: number } | { key: "tax"; label: string; rate: number; cents: number }
  | { key: "total"; cents: number } | { key: "holdback"; percent: number; cents: number } | { key: "start"; iso: string } | { key: "warranty"; months: number };

const toCents = (n: number): number => Math.round(n * 100);

/** The Details card, in the board's order, leaving out what the contract doesn't have (no holdback, no start date). */
export function details(c: Pick<ContractFull, "variables" | "province" | "language">): Detail[] {
  const v = c.variables;
  const out: Detail[] = [{ key: "province", value: c.province }, { key: "language", value: c.language }, { key: "subtotal", cents: toCents(v.subtotal) }];
  for (const t of v.taxLines) out.push({ key: "tax", label: t.label, rate: t.rate, cents: toCents(t.amount) });
  out.push({ key: "total", cents: toCents(v.total) });
  if (v.paymentSchedule.holdback.enabled) out.push({ key: "holdback", percent: v.paymentSchedule.holdback.percent, cents: Math.round(toCents(v.total) * v.paymentSchedule.holdback.percent / 100) });
  if (v.startDate) out.push({ key: "start", iso: v.startDate });
  out.push({ key: "warranty", months: v.warrantyMonths });
  return out;
}

/** "1 year", "18 months": the warranty as years when it is whole years. */
export function warrantyParts(months: number): { unit: "year" | "month"; count: number } {
  return months > 0 && months % 12 === 0 ? { unit: "year", count: months / 12 } : { unit: "month", count: months };
}

export type TermsForm = { startDate: string | null; warrantyMonths: number; holdbackEnabled: boolean; holdbackPercent: number; customerEmail: string };

export function termsOf(c: Pick<ContractFull, "variables" | "signers">): TermsForm {
  const v = c.variables;
  return {
    startDate: v.startDate, warrantyMonths: v.warrantyMonths, holdbackEnabled: v.paymentSchedule.holdback.enabled, holdbackPercent: v.paymentSchedule.holdback.percent,
    customerEmail: v.customer.email || c.signers.find((s) => s.role === "customer")?.email || "",
  };
}

export const validEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** What changed, as the PUT body (only the fields that differ, so an edit doesn't touch what you left alone). */
export function termsPatch(from: TermsForm, to: TermsForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (to.startDate !== from.startDate) out.startDate = to.startDate;
  if (to.warrantyMonths !== from.warrantyMonths) out.warrantyMonths = to.warrantyMonths;
  if (to.holdbackEnabled !== from.holdbackEnabled) out.holdbackEnabled = to.holdbackEnabled;
  if (to.holdbackPercent !== from.holdbackPercent) out.holdbackPercent = to.holdbackPercent;
  const email = to.customerEmail.trim();
  if (email && email !== from.customerEmail.trim()) out.customerEmail = email;
  return out;
}

// ── Activity ────────────────────────────────────────────────────────────────

export type ActivityKind = "created" | "edited" | "contractorSigned" | "sent" | "reminder" | "viewed" | "verified" | "signed" | "declined" | "voided" | "expired";
export type Activity = { id: string; kind: ActivityKind; at: string; who?: string; reason?: string; /** The keys of the sections edited. */ sections?: string[] };

const KNOWN: Record<string, ActivityKind> = {
  created: "created", edited: "edited", contractor_signed: "contractorSigned", sent: "sent", reminder_sent: "reminder", viewed: "viewed", otp_verified: "verified",
  signed: "signed", declined: "declined", voided: "voided", expired: "expired",
};

/** Newest first. Events the page doesn't tell (a code sent, the executed copy being made) are left out. */
export function activity(c: Pick<ContractFull, "events" | "signers" | "variables">): Activity[] {
  const customer = c.signers.find((s) => s.role === "customer");
  const contractor = c.signers.find((s) => s.role === "contractor");
  const list: Activity[] = [];
  for (const e of c.events) {
    const kind = KNOWN[e.type];
    if (!kind) continue;
    const d = (e.detail ?? {}) as { reason?: string; sections?: unknown[] };
    if (kind === "created" && e.actor === "customer") continue;
    const who = e.type === "contractor_signed" ? contractor?.name : e.actor === "customer" ? customer?.name : undefined;
    list.push({ id: e.id, kind, at: e.createdAt, who, reason: d.reason, sections: Array.isArray(d.sections) ? d.sections.filter((x): x is string => typeof x === "string") : undefined });
  }
  // A viewed event is logged on each visit: once is enough.
  const seen = new Set<ActivityKind>();
  return list.sort((a, b) => b.at.localeCompare(a.at)).filter((a) => {
    if (a.kind !== "viewed" && a.kind !== "verified") return true;
    if (seen.has(a.kind)) return false;
    seen.add(a.kind);
    return true;
  });
}

// ── Signing ─────────────────────────────────────────────────────────────────

/** A typed signature needs a real name (the server wants at least two characters). */
export const validSignature = (name: string, consent: boolean): boolean => name.trim().length >= 2 && consent;

/** The typed signature as the server stores it for a person who signs with their name. */
export const typedSignature = (name: string): { signatureType: "typed"; signatureData: string; name: string; consent: true } => {
  const n = name.trim();
  return { signatureType: "typed", signatureData: n, name: n, consent: true };
};

/** The consent line the server keeps with the signature (routes/contracts.ts); the sheet shows the same words. */
export const consentFor = (language: "en" | "fr"): string =>
  language === "fr"
    ? "J'accepte de signer ce contrat électroniquement et je reconnais que ma signature électronique a la même valeur qu'une signature manuscrite."
    : "I agree to sign this contract electronically and acknowledge that my electronic signature has the same effect as a handwritten signature.";

// ── A row's dates ───────────────────────────────────────────────────────────

export type DatePart = { key: "draftedToday" | "drafted" | "sent" | "notOpened" | "viewed" | "viewedUnknown" | "signed" | "voided" | "declined" | "expired"; at?: string };

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The line under a contract: when it was drafted or sent, and what came of it ("Sent Sep 24 · Viewed Sep 26"). */
export function rowDates(c: ContractRow, now: Date): DatePart[] {
  if (c.status === "draft") return [sameDay(new Date(c.createdAt), now) ? { key: "draftedToday" } : { key: "drafted", at: c.createdAt }];
  const out: DatePart[] = c.sentAt ? [{ key: "sent", at: c.sentAt }] : [];
  switch (c.status) {
    case "sent": out.push({ key: "notOpened" }); break;
    case "viewed": out.push(c.viewedAt ? { key: "viewed", at: c.viewedAt } : { key: "viewedUnknown" }); break;
    case "signed": if (c.signedAt) out.push({ key: "signed", at: c.signedAt }); break;
    case "voided": if (c.voidedAt) out.push({ key: "voided", at: c.voidedAt }); break;
    case "declined": out.push({ key: "declined" }); break;
    case "expired": if (c.expiresAt) out.push({ key: "expired", at: c.expiresAt }); break;
  }
  return out;
}
