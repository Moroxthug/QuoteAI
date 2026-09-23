// Phase 85 — the agenda the dashboard widget reads, the .ics subscriptions,
// and the published feed. Same thin-fetch shape as the other clients here.
import { apiRequest as req } from "@/lib/jobs-api";

export type AgendaKind = "block" | "milestone" | "invoice" | "followup" | "external";

export type AgendaEntryDto = {
  id: string;
  kind: AgendaKind;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  href: string | null;
  externalUrl?: string | null;
  amountCents?: number | null;
  state?: "overdue" | "done" | null;
  source?: "google" | "outlook" | "ics";
};

export type AgendaDto = {
  entries: AgendaEntryDto[];
  /** False on Starter/free: the widget shows its locked one-liner. */
  scheduleEnabled: boolean;
  /** False without Elite or without a connected calendar: no external events. */
  externalEnabled: boolean;
  requiredPlan: string | null;
};

export type CalendarFeedDto = {
  id: string;
  name: string;
  url: string;
  isEnabled: boolean;
  lastFetchedAt: string | null;
  lastStatus: "ok" | "failed" | null;
  lastError: string | null;
  eventCount: number;
};

export type PublishStateDto = {
  enabled: boolean;
  hint: string | null;
  createdAt: string | null;
  lastAccessedAt: string | null;
};

export const calendarApi = {
  agenda: (from: Date, to: Date) =>
    req<AgendaDto>(`/api/calendar/agenda?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`),
  refresh: () => req<{ events: number; errors: string[] }>("/api/calendar/refresh", { method: "POST" }),
  feeds: () => req<{ feeds: CalendarFeedDto[] }>("/api/calendar/feeds"),
  addFeed: (name: string, url: string) =>
    req<{ feed: CalendarFeedDto; events: number }>("/api/calendar/feeds", { method: "POST", body: JSON.stringify({ name, url }) }),
  setFeedEnabled: (id: string, isEnabled: boolean) =>
    req<{ id: string; isEnabled: boolean }>(`/api/calendar/feeds/${id}`, { method: "PATCH", body: JSON.stringify({ isEnabled }) }),
  deleteFeed: (id: string) => req<void>(`/api/calendar/feeds/${id}`, { method: "DELETE" }),
  publishState: () => req<PublishStateDto>("/api/calendar/publish"),
  /** The full URL comes back exactly once — the server only keeps its hash. */
  createPublishLink: () => req<{ url: string; hint: string }>("/api/calendar/publish", { method: "POST" }),
  revokePublishLink: () => req<void>("/api/calendar/publish", { method: "DELETE" }),
};
