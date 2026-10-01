// Leads.dc.html: the rules behind the Leads screen. The server keeps six statuses (new, contacted, quoted, won, lost,
// unsubscribed); the board has five tabs, so an unsubscribed lead sits under Lost (it can't be messaged or reopened).
// Pure functions, no React: the screen passes `now` in so everything here is testable.

export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost" | "unsubscribed";
export type LeadChannel = "email" | "sms" | "whatsapp";
export type LeadSource = "widget" | "manual" | "import" | "meta_lead_ads" | "google_lsa";

/** A lead as GET /api/leads returns it (the columns the screen uses). */
export type Lead = {
  id: string;
  clientId: string | null;
  quoteId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  preferredLanguage: "en" | "fr";
  preferredChannel: LeadChannel;
  source: LeadSource;
  status: LeadStatus;
  unsubscribedAt: string | null;
  followUpStage: number;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

/** The five tabs, in the board's order. */
export const STAGES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export function stageOf(lead: Pick<Lead, "status">): Stage {
  return lead.status === "unsubscribed" ? "lost" : lead.status;
}

/** New, Contacted and Quoted leads are still being worked: they have a follow-up and can be marked lost. */
export function isOpenStage(stage: Stage): boolean {
  return stage === "new" || stage === "contacted" || stage === "quoted";
}

export function stageCounts(leads: Lead[]): Record<Stage, number> {
  const out: Record<Stage, number> = { new: 0, contacted: 0, quoted: 0, won: 0, lost: 0 };
  for (const l of leads) out[stageOf(l)] += 1;
  return out;
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

/** One tab's leads: open stages by next follow-up (soonest first, none last), won and lost by latest change. */
export function leadsIn(leads: Lead[], stage: Stage): Lead[] {
  const rows = leads.filter((l) => stageOf(l) === stage);
  if (!isOpenStage(stage)) return rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  return rows.sort((a, b) => {
    const x = time(a.nextFollowUpAt), y = time(b.nextFollowUpAt);
    if (x != null && y != null && x !== y) return x - y;
    if (x != null && y == null) return -1;
    if (x == null && y != null) return 1;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86_400_000;

export type FollowUp =
  | { kind: "none" }
  /** `day`: how the date reads (today / tomorrow / yesterday / a date). `tone`: late = a day or more missed, due = today. */
  | { kind: "set"; at: Date; day: "today" | "tomorrow" | "yesterday" | "date"; tone: "late" | "due" | "plain" };

export function followUp(lead: Pick<Lead, "nextFollowUpAt" | "status">, now: Date): FollowUp {
  if (!lead.nextFollowUpAt || !isOpenStage(stageOf(lead))) return { kind: "none" };
  const at = new Date(lead.nextFollowUpAt);
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY);
  if (days < 0) return { kind: "set", at, day: days === -1 ? "yesterday" : "date", tone: "late" };
  if (days === 0) return { kind: "set", at, day: "today", tone: "due" };
  return { kind: "set", at, day: days === 1 ? "tomorrow" : "date", tone: "plain" };
}

/** Open leads whose follow-up is today or already missed: the board's "3 follow-ups due today". */
export function dueCount(leads: Lead[], now: Date): number {
  return leads.filter((l) => {
    const f = followUp(l, now);
    return f.kind === "set" && f.tone !== "plain";
  }).length;
}

export function openCount(leads: Lead[]): number {
  return leads.filter((l) => isOpenStage(stageOf(l))).length;
}

/** Where a lead came from: the word's key, and the board's gradient icon and tone for it. */
export function sourceInfo(source: LeadSource): { key: "website" | "google" | "meta" | "manual" | "import"; icon: string; tone: string } {
  switch (source) {
    case "widget": return { key: "website", icon: "globe", tone: "azure" };
    case "google_lsa": return { key: "google", icon: "search", tone: "sage" };
    case "meta_lead_ads": return { key: "meta", icon: "users", tone: "indigo" };
    case "import": return { key: "import", icon: "file", tone: "stone" };
    default: return { key: "manual", icon: "pen", tone: "slate" };
  }
}

/** What they asked for: the lead's notes, tidied to one paragraph for the card's two lines. */
export function askOf(lead: Pick<Lead, "notes">): string {
  return lead.notes.replace(/\s+/g, " ").trim();
}

/** "de Marie" / "d’Aaron" (French elision before a vowel or a mute h). */
export function deName(first: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(first) ? `d’${first}` : `de ${first}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** What the lead can be reached by, for the follow-up button: the channel they chose, falling back to what we have. */
export function sendChannel(lead: Pick<Lead, "preferredChannel" | "phone" | "email">): LeadChannel {
  if ((lead.preferredChannel === "sms" || lead.preferredChannel === "whatsapp") && lead.phone) return lead.preferredChannel;
  if (lead.email) return "email";
  return lead.preferredChannel;
}

/** A follow-up can go out unless the lead unsubscribed or is won or lost. */
export function canSend(lead: Pick<Lead, "status" | "unsubscribedAt">): boolean {
  return !lead.unsubscribedAt && isOpenStage(stageOf(lead));
}

/** Which of the server's three follow-up messages goes next (the last one repeats). */
export function replyStep(followUpStage: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(2, followUpStage)) as 0 | 1 | 2;
}

/** The status a reopened lead goes back to: Contacted if we ever reached them, else New. */
export function reopenStatus(lead: Pick<Lead, "lastContactedAt">): "new" | "contacted" {
  return lead.lastContactedAt ? "contacted" : "new";
}

export type NewLead = { name: string; email: string; phone: string; channel: "sms" | "email"; notes: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailOk(email: string): boolean {
  return email.trim() === "" || EMAIL.test(email.trim());
}

export function canSaveLead(d: NewLead): boolean {
  return d.name.trim().length > 0 && emailOk(d.email);
}

/** The POST /api/leads body: only what was filled in. */
export function newLeadBody(d: NewLead, language: "en" | "fr") {
  return {
    name: d.name.trim(),
    ...(d.email.trim() ? { email: d.email.trim() } : {}),
    ...(d.phone.trim() ? { phone: d.phone.trim() } : {}),
    preferredChannel: d.channel,
    preferredLanguage: language,
    ...(d.notes.trim() ? { notes: d.notes.trim() } : {}),
  };
}

/** A lead's card tint: the same name always gets the same one of the five. */
export function leadTint(name: string): 1 | 2 | 3 | 4 | 5 {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 5;
  return (h + 1) as 1 | 2 | 3 | 4 | 5;
}
