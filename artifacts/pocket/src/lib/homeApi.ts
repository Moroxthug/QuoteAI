// Smart Home's server reads (routes/today.ts, weather.ts) and the reminder; the app's wrapped fetch adds the token.
import { api } from "./api";
import type { BusinessCard, BusinessPeriod, ChecklistItem, NeedsYouItem, TodayWeather } from "./home";

export const homeApi = {
  needsYou: () => api<{ items: NeedsYouItem[] }>("/api/today/needs-you"),
  weather: () => api<{ weather: TodayWeather | null }>("/api/weather/today"),
  business: (period: BusinessPeriod) => api<BusinessCard>(`/api/today/business?period=${period}`),
  checklist: () => api<{ day: string; items: ChecklistItem[] }>("/api/today/checklist"),
  check: (itemId: string, done: boolean) => api<{ itemId: string; done: boolean }>(`/api/today/checklist/${encodeURIComponent(itemId)}`, { method: "PUT", body: { done } }),
  unread: () => api<{ unread: number }>("/api/notifications?limit=1"),
  remind: (invoiceId: string) => api<unknown>(`/api/invoices/${encodeURIComponent(invoiceId)}/remind`, { method: "POST", body: {} }),
};
