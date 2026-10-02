// The messaging server calls (routes/sms.ts, routes/whatsapp.ts, routes/usage.ts).
import { api } from "./api";
import type { SmsRow } from "./messaging";

export type SmsStatus = { available: boolean; fromNumberHint: string | null; smsEnabled: boolean; smsReminders: boolean; scheduleReminders: boolean; usage: { used: number; allowance: number | null }; ownPhone: string | null; identityLine: string };
export type WaStatus = { connected: boolean; available: boolean; phoneNumber: string | null; isEnabled: boolean | null; businessNumber: string | null };
export type OptOut = { phone: string; e164: string; source: string; at: string };
export type Usage = { whatsappMessages: { used: number; allowance: number | null } };

export const messagingApi = {
  sms: () => api<SmsStatus>("/api/sms/status"),
  saveSms: (p: Partial<Pick<SmsStatus, "smsEnabled" | "smsReminders" | "scheduleReminders">>) => api<unknown>("/api/sms/settings", { method: "PUT", body: p }),
  test: (lang: "en" | "fr") => api<{ ok: boolean }>("/api/sms/test", { method: "POST", body: { lang } }),
  log: (limit = 5) => api<{ items: SmsRow[] }>(`/api/sms/messages?limit=${limit}`),
  optOuts: () => api<{ items: OptOut[] }>("/api/sms/opt-outs"),
  wa: () => api<WaStatus>("/api/whatsapp/status"),
  waConnect: (phoneNumber: string) => api<{ sent: boolean; phoneNumber: string }>("/api/whatsapp/connect", { method: "POST", body: { phoneNumber } }),
  waVerify: (phoneNumber: string, otp: string) => api<{ success: boolean }>("/api/whatsapp/verify", { method: "POST", body: { phoneNumber, otp } }),
  waDisconnect: () => api<unknown>("/api/whatsapp/disconnect", { method: "DELETE" }),
  usage: () => api<Usage>("/api/usage/summary"),
};
