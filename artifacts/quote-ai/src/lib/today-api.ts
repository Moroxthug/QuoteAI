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

// ── Pocket (docs/POCKET-DESIGN-PLAN.md): the phone Home's reads ─────────────
export type WeatherKind = "clear" | "cloud" | "rain" | "snow" | "storm" | "fog";
export type TodayWeatherDto = { site: string; tempC: number | null; kind: WeatherKind; condition: { en: string; fr: string }; next: { kind: "rain" | "snow" | "storm"; at: string } | null };
export type BusinessPeriod = "W" | "M" | "Q";
export type BusinessCardDto = {
  period: BusinessPeriod;
  buckets: { start: string; collectedCents: number }[] | null;
  winPercent: number | null;
  outstanding: { balanceCents: number; overdueCents: number } | null;
  marginPercent: number | null;
};
export type ChecklistItemDto = Omit<NeedsYouItemDto, "kind"> & { kind: NeedsYouKind | "task"; done: boolean; jobName?: string };

export const pocketApi = {
  weather: (pos?: { lat: number; lon: number }) => req<{ weather: TodayWeatherDto | null }>(`/api/weather/today${pos ? `?lat=${pos.lat.toFixed(2)}&lon=${pos.lon.toFixed(2)}` : ""}`),
  business: (period: BusinessPeriod) => req<BusinessCardDto>(`/api/today/business?period=${period}`),
  checklist: () => req<{ day: string; items: ChecklistItemDto[] }>("/api/today/checklist"),
  check: (itemId: string, done: boolean) => req<{ itemId: string; done: boolean }>(`/api/today/checklist/${encodeURIComponent(itemId)}`, { method: "PUT", body: JSON.stringify({ done }), headers: { "content-type": "application/json" } }),
};
