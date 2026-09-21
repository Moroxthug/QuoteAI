// Thin fetch client for the Phase 74 SMS endpoints (not in the orval
// generated client — same hand-written pattern as usage-api.ts).
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type SmsStatusDto = {
  available: boolean;
  fromNumberHint: string | null;
  smsEnabled: boolean;
  smsReminders: boolean;
  usage: { used: number; allowance: number | null };
  ownPhone: string | null;
  identityLine: string;
};

export type SmsMessageDto = {
  id: string;
  direction: "outbound" | "inbound";
  purpose: "lead_followup" | "quote_followup" | "contract_reminder" | "invoice_reminder" | "on_my_way" | "appointment_reminder" | "test" | "reply" | "opt_out" | "opt_in";
  status: "sent" | "failed" | "skipped" | "received";
  phone: string;
  body: string;
  segments: number;
  language: "en" | "fr";
  error: string | null;
  createdAt: string;
};

export const smsApi = {
  status: () => req<SmsStatusDto>("/api/sms/status"),
  updateSettings: (body: { smsEnabled?: boolean; smsReminders?: boolean }) => req<{ smsEnabled: boolean; smsReminders: boolean }>("/api/sms/settings", { method: "PUT", body: json(body) }),
  sendTest: (lang: "en" | "fr") => req<{ ok: true; segments: number; body: string }>("/api/sms/test", { method: "POST", body: json({ lang }) }),
  messages: (limit = 30) => req<{ items: SmsMessageDto[] }>(`/api/sms/messages?limit=${limit}`),
};
