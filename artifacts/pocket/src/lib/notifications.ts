// Notifications (Notifications.dc.html): what the server told the company (a quote was viewed, a payment came in, hours need a look), as the phone lists
// it: a glyph for each kind, where a tap goes, the one action some of them carry, and the Today / Earlier groups. Pure, so they are tested
// (notifications.test.ts). The server's shapes are routes/notifications.ts.
import type { IconName, Tone } from "@/ui/Icon";

export type NotificationDto = {
  id: string; type: string; title: string; body: string; link: string | null; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string;
};
export type NotificationsResponse = { items: NotificationDto[]; unread: number };

/** The glyph and tone the board draws for each kind of notification; anything the board doesn't know is the bell. */
export function look(type: string): { icon: IconName; tone: Tone } {
  switch (type) {
    case "morning_brief": return { icon: "sun", tone: "gold" };
    case "quote_viewed": return { icon: "eye", tone: "violet" };
    case "quote_accepted": case "contract_signed": case "change_order_signed": return { icon: "pen", tone: "sage" };
    case "quote_declined": case "contract_declined": return { icon: "doc", tone: "clay" };
    case "paid": case "invoice_paid": return { icon: "card", tone: "sage" };
    case "invoice_payment_reported": return { icon: "bank", tone: "amber" };
    case "invoice_overdue": return { icon: "receipt", tone: "clay" };
    case "invoice_drafted": case "invoice_sent": return { icon: "receipt", tone: "violet" };
    case "time_entry_submitted": return { icon: "clock", tone: "teal" };
    case "field_blocker": return { icon: "warn", tone: "clay" };
    case "field_report": return { icon: "photo", tone: "azure" };
    case "budget_alert": case "budget_exceeded": return { icon: "bars", tone: "amber" };
    case "compliance_due": case "milestone_payment_due": return { icon: "shield", tone: "teal" };
    case "client_message": case "sms_reply": return { icon: "chat", tone: "azure" };
    case "team_joined": case "crew_link_requested": return { icon: "users", tone: "lilac" };
    case "group_invite": case "group_joined": return { icon: "building", tone: "lilac" };
    case "job_setup_ready": return { icon: "house", tone: "teal" };
    case "accountant_comment": return { icon: "chat", tone: "indigo" };
    default: return { icon: "bell", tone: "violet" };
  }
}

/** The screen a notification opens, by name (the design's), with the id it needs; null when it only needs reading. */
export type Target = { screen: string; params?: Record<string, string> };
export function targetOf(n: Pick<NotificationDto, "type" | "entityType" | "entityId">): Target | null {
  const id = n.entityId ?? undefined;
  switch (n.entityType) {
    case "invoice": return id ? { screen: "Invoice", params: { id } } : null;
    case "quote": return id ? { screen: "Quote", params: { id } } : null;
    case "project": return id ? { screen: "Job", params: { id } } : null;
    case "contract": return id ? { screen: "Contract", params: { id } } : null;
    case "time_entry": return { screen: "CrewHours" };
    case "pay_allowance": return { screen: "Pay" };
    case "company_group": return { screen: "Group" };
    case "client": return id ? { screen: "Client", params: { id } } : null;
  }
  switch (n.type) {
    case "compliance_due": return { screen: "Compliance" };
    case "team_joined": return { screen: "Team" };
    case "morning_brief": return { screen: "SmartHome" };
    default: return null;
  }
}

/** The one button some rows carry (the board's "Confirm", "Review hours", "Send a reminder"); it opens where the thing is done. */
export type ActionKey = "confirm" | "review" | "remind";
export function actionOf(type: string): ActionKey | null {
  switch (type) {
    case "invoice_payment_reported": return "confirm";
    case "time_entry_submitted": return "review";
    case "invoice_overdue": return "remind";
    default: return null;
  }
}

export const isUnread = (n: Pick<NotificationDto, "readAt">): boolean => !n.readAt;

export type Filter = "all" | "unread";
export const FILTERS: Filter[] = ["all", "unread"];

/** The rows to show, newest first, grouped as the board does: Today, then Earlier. */
export function groupNotifications(items: NotificationDto[], filter: Filter, now: Date): { key: "today" | "earlier"; rows: NotificationDto[] }[] {
  const keep = items.filter((n) => filter === "all" || isUnread(n)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sameDay = (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const today = keep.filter((n) => sameDay(new Date(n.createdAt)));
  const earlier = keep.filter((n) => !sameDay(new Date(n.createdAt)));
  return [{ key: "today" as const, rows: today }, { key: "earlier" as const, rows: earlier }].filter((g) => g.rows.length > 0);
}

/** "6:30" today; "Mon" within the last week; "Sep 27" before that (the board's times). */
export function whenLabel(at: Date, now: Date, clock: (d: Date) => string, weekday: (d: Date) => string, date: (d: Date) => string): string {
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return clock(at);
  if (days < 7) return weekday(at);
  return date(at);
}
