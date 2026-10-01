// Smart Home's data: the server's own reads for the phone Home (routes/today.ts, weather.ts) and
// the pure rules that turn them into what the screen shows (home.test.ts).

export type NeedsYouKind = "blocker" | "etransfer" | "overdue" | "hours" | "followup" | "waiting";

export type NeedsYouItem = {
  id: string;
  kind: NeedsYouKind;
  title: string;
  subtitle: string;
  at: string | null;
  href: string;
  amountCents?: number;
  days?: number;
  count?: number;
  hours?: number;
  people?: number;
  phone?: string | null;
  canRemind?: boolean;
};

export type WeatherKind = "clear" | "cloud" | "rain" | "snow" | "storm" | "fog";
export type TodayWeather = { site: string; tempC: number | null; kind: WeatherKind; condition: { en: string; fr: string }; next: { kind: "rain" | "snow" | "storm"; at: string } | null };

export type BusinessPeriod = "W" | "M" | "Q";
export type BusinessCard = {
  period: BusinessPeriod;
  buckets: { start: string; collectedCents: number }[] | null;
  winPercent: number | null;
  outstanding: { balanceCents: number; overdueCents: number } | null;
  marginPercent: number | null;
};

export type ChecklistItem = Omit<NeedsYouItem, "kind"> & { kind: NeedsYouKind | "task"; done: boolean; jobName?: string };

export type Greeting = "morning" | "afternoon" | "evening";

/** "Good morning" until noon, "Good afternoon" until 5 pm, then "Good evening". */
export function greetingFor(now: Date): Greeting {
  const h = now.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** What a Needs you card's button does. */
export type NeedsAction =
  | { type: "remind"; invoiceId: string }
  | { type: "call"; phone: string }
  | { type: "open"; screen: "Invoice" | "Quote" | "Leads" | "Job" | "Timesheets"; id?: string };

export type NeedsCardKind = "hours" | "etransfer" | "lead" | "remind" | "blocker" | "waiting";

export type NeedsCard = {
  id: string;
  kind: NeedsCardKind;
  item: NeedsYouItem;
  action: NeedsAction;
  /** True when the button can change something here (a reminder is sent); false when it opens the screen. */
  doneInPlace: boolean;
};

const idOf = (item: NeedsYouItem) => item.id.includes(":") ? item.id.slice(item.id.indexOf(":") + 1) : item.id;

/** The card for a server row, most urgent first (the server ranks them). */
export function needsCard(item: NeedsYouItem): NeedsCard {
  const id = idOf(item);
  switch (item.kind) {
    case "overdue":
      return item.canRemind
        ? { id: item.id, kind: "remind", item, action: { type: "remind", invoiceId: id }, doneInPlace: true }
        : { id: item.id, kind: "remind", item, action: { type: "open", screen: "Invoice", id }, doneInPlace: false };
    case "etransfer": return { id: item.id, kind: "etransfer", item, action: { type: "open", screen: "Invoice", id }, doneInPlace: false };
    case "hours": return { id: item.id, kind: "hours", item, action: { type: "open", screen: "Timesheets" }, doneInPlace: false };
    case "blocker": return { id: item.id, kind: "blocker", item, action: { type: "open", screen: "Job", id: item.href.split("/").pop() }, doneInPlace: false };
    case "followup":
      return item.phone
        ? { id: item.id, kind: "lead", item, action: { type: "call", phone: item.phone }, doneInPlace: false }
        : { id: item.id, kind: "lead", item, action: { type: "open", screen: "Leads" }, doneInPlace: false };
    case "waiting":
      return item.phone
        ? { id: item.id, kind: "waiting", item, action: { type: "call", phone: item.phone }, doneInPlace: false }
        : { id: item.id, kind: "waiting", item, action: { type: "open", screen: "Quote", id }, doneInPlace: false };
  }
}

/** A number as `tel:` digits only (the phone's dialler takes it). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
