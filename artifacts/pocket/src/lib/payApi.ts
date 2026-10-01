// The Pay screen's server calls (routes/pay.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { PayFormat, PayReport, PaySettingsPayload, RawSettings } from "./pay";

const id = encodeURIComponent;

export const payApi = {
  settings: () => api<PaySettingsPayload>("/api/pay/settings"),
  saveSettings: (body: RawSettings) => api<PaySettingsPayload & { recomputed?: number; recomputedSince?: string }>("/api/pay/settings", { method: "PUT", body }),
  period: (date?: string) => api<PayReport>(`/api/pay/period${date ? `?date=${id(date)}` : ""}`),
  review: (allowanceId: string, decision: "approved" | "rejected") => api<{ allowance: { id: string; status: string } }>(`/api/pay/allowances/${id(allowanceId)}/review`, { method: "POST", body: { decision } }),
  exportPath: (date: string, format: PayFormat) => `/api/pay/export.csv?date=${id(date)}&format=${id(format)}`,
};
