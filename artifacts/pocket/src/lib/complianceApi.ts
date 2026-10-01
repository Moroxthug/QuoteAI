// The Compliance screen's server calls (routes/compliance.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { ComplianceOverview, ComplianceSettings, FilingKind, ReminderDto, ReminderKind, Worksheet } from "./compliance";

const id = encodeURIComponent;

export const complianceApi = {
  overview: () => api<ComplianceOverview>("/api/compliance/overview"),
  worksheet: (from: string, to: string) => api<Worksheet & { province: string | null }>(`/api/compliance/remittance?from=${id(from)}&to=${id(to)}`),
  saveSettings: (body: ComplianceSettings) => api<{ settings: ComplianceSettings }>("/api/compliance/settings", { method: "PUT", body }),
  markFiled: (kind: FilingKind, periodKey: string) => api<unknown>("/api/compliance/filings", { method: "POST", body: { kind, periodKey } }),
  undoFiled: (kind: FilingKind, periodKey: string) => api<unknown>(`/api/compliance/filings?kind=${id(kind)}&periodKey=${id(periodKey)}`, { method: "DELETE" }),
  reminderDone: (reminderId: string) => api<{ reminder: ReminderDto | null }>(`/api/compliance/reminders/${id(reminderId)}/done`, { method: "POST", body: {} }),
  addReminder: (body: { kind: ReminderKind; preset?: string | null; title: string; authority?: string; dueDate: string; recurrence: ReminderDto["recurrence"] }) => api<{ reminder: ReminderDto }>("/api/compliance/reminders", { method: "POST", body }),
};
