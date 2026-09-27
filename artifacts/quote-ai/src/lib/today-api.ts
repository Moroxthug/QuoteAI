// Phase 104 — the dashboard home's two reads (routes/today.ts on the server).
import { apiRequest as req } from "@/lib/jobs-api";

export type NeedsYouKind = "blocker" | "etransfer" | "overdue" | "hours" | "followup" | "waiting";

export type NeedsYouItemDto = {
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

export type TodayStatsDto = {
  quotes: { current: number; previous: number } | null;
  won: { current: number; previous: number; valueCents: number } | null;
  outstanding: { balanceCents: number; overdueCents: number; count: number } | null;
  collected: { currentCents: number; previousCents: number } | null;
};

export const todayApi = {
  needsYou: () => req<{ items: NeedsYouItemDto[] }>("/api/today/needs-you"),
  stats: (from: Date, to: Date, prevFrom: Date) =>
    req<TodayStatsDto>(`/api/today/stats?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&prevFrom=${encodeURIComponent(prevFrom.toISOString())}`),
};
