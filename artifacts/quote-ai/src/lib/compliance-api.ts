// Phase 87 — compliance: the filing calendar, the remittance worksheet, the
// T5018 summary, the company's own reminders and the permits on a job.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type FilingKind = "sales_tax" | "sales_tax_payment" | "gst_instalment" | "pst" | "t5018";

export type ComplianceSettings = {
  salesTaxFrequency?: "monthly" | "quarterly" | "annual" | null;
  fiscalYearEnd?: string | null;
  structure?: "sole_proprietor" | "partnership" | "corporation" | null;
  instalments?: boolean;
  pstFrequency?: "monthly" | "quarterly" | "semiannual" | "annual" | null;
  t5018?: boolean;
};

export type DeadlineDto = {
  key: string;
  kind: FilingKind;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  tax: string;
  authority: "cra" | "rq" | "bc" | "sk" | "mb";
  frequency: string;
  hasWorksheet: boolean;
  filedAt: string | null;
  filedByName: string | null;
  note: string;
  daysLeft: number;
  state: "filed" | "overdue" | "due_soon" | "upcoming";
  url: string;
};

type ReminderKind = "workers_comp" | "licence" | "insurance" | "other";
export type ReminderRecurrence = "none" | "monthly" | "quarterly" | "annual";

export type ReminderDto = {
  id: string;
  kind: ReminderKind;
  preset: string | null;
  title: string;
  authority: string;
  reference: string;
  url: string | null;
  dueDate: string;
  recurrence: ReminderRecurrence;
  remindDaysBefore: number;
  notes: string;
  lastDoneAt: string | null;
  daysLeft: number;
  state: "overdue" | "due_soon" | "upcoming";
};

export type ReminderPresetDto = {
  id: string;
  kind: ReminderKind;
  title: { en: string; fr: string };
  authority: string;
  url: string | null;
  recurrence: ReminderRecurrence;
  usualDate: string | null;
};

export type Registrations = { province: string | null; gstHstNumber: string | null; qstNumber: string | null; pstNumber: string | null; licenceNumber: string | null };

export type ComplianceOverviewDto =
  | { enabled: false; requiredPlan: string }
  | { enabled: true; today: string; settings: ComplianceSettings; registrations: Registrations; deadlines: DeadlineDto[]; reminders: ReminderDto[]; presets: ReminderPresetDto[] };

type Codes = { GST: number; HST: number; QST: number; PST: number; RST: number; TAX: number };

export type WorksheetDto = {
  from: string;
  to: string;
  province: string | null;
  registrations: Registrations;
  summary: {
    invoiceCount: number;
    salesCents: number;
    collected: Codes;
    credits: { GST: number; HST: number; QST: number };
    nonRecoverableCents: number;
    gstHst: { collectedCents: number; creditsCents: number; netCents: number };
    qst: { collectedCents: number; creditsCents: number; netCents: number };
    pst: { collectedCents: number };
    warnings: { unsplitCostCount: number; unsplitTaxCents: number; pendingCostCount: number; pendingTaxCents: number; genericTaxCents: number };
  };
  invoices: { id: string; number: string; type: string; day: string; customer: string; taxableCents: number; taxLines: { code: string; amountCents: number }[] }[];
  costs: { id: string; day: string; vendor: string; description: string; status: "pending_review" | "confirmed"; subtotalCents: number; taxCents: number; taxBreakdown: Partial<Codes> }[];
};

export type T5018Dto = {
  year: number;
  thresholdCents: number;
  totalCents: number;
  recipients: { key: string; name: string; source: "supplier" | "vendor" | "worker"; entryCount: number; subtotalCents: number; taxCents: number; totalCents: number; overThreshold: boolean }[];
};

export type PermitKind = "building" | "demolition" | "electrical" | "plumbing" | "gas" | "hvac" | "other";
export type PermitStatus = "needed" | "applied" | "issued" | "closed" | "not_required";
export type WorkType = "structural" | "addition" | "basement" | "deck" | "demolition" | "electrical" | "plumbing" | "gas" | "hvac";

export type PermitDto = {
  id: string;
  projectId: string;
  kind: PermitKind;
  title: string;
  authority: string;
  referenceNumber: string;
  url: string | null;
  status: PermitStatus;
  open: boolean;
  appliedAt: string | null;
  issuedAt: string | null;
  inspectionAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  notes: string;
};

export type PermitInput = Partial<Omit<PermitDto, "id" | "projectId" | "open" | "closedAt">> & { title?: string };
export type ReminderInput = Partial<Pick<ReminderDto, "kind" | "preset" | "title" | "authority" | "reference" | "url" | "dueDate" | "recurrence" | "remindDaysBefore" | "notes">>;

export const complianceApi = {
  overview: () => req<ComplianceOverviewDto>("/api/compliance/overview"),
  saveSettings: (s: ComplianceSettings) => req<{ settings: ComplianceSettings }>("/api/compliance/settings", { method: "PUT", body: json(s) }),
  markFiled: (kind: FilingKind, periodKey: string, note?: string) => req<{ filing: unknown }>("/api/compliance/filings", { method: "POST", body: json({ kind, periodKey, note }) }),
  unmarkFiled: (kind: FilingKind, periodKey: string) => req<void>(`/api/compliance/filings?kind=${kind}&periodKey=${encodeURIComponent(periodKey)}`, { method: "DELETE" }),
  worksheet: (from: string, to: string) => req<WorksheetDto>(`/api/compliance/remittance?from=${from}&to=${to}`),
  worksheetCsvUrl: (from: string, to: string) => `/api/compliance/remittance.csv?from=${from}&to=${to}`,
  t5018: (year: number) => req<T5018Dto>(`/api/compliance/t5018?year=${year}`),
  t5018CsvUrl: (year: number) => `/api/compliance/t5018.csv?year=${year}`,
  addReminder: (body: ReminderInput) => req<{ reminder: ReminderDto }>("/api/compliance/reminders", { method: "POST", body: json(body) }),
  updateReminder: (id: string, body: ReminderInput) => req<{ reminder: ReminderDto }>(`/api/compliance/reminders/${id}`, { method: "PATCH", body: json(body) }),
  reminderDone: (id: string) => req<{ reminder: ReminderDto | null }>(`/api/compliance/reminders/${id}/done`, { method: "POST" }),
  deleteReminder: (id: string) => req<void>(`/api/compliance/reminders/${id}`, { method: "DELETE" }),

  permits: (jobId: string) => req<{ permits: PermitDto[]; workTypes: WorkType[]; province: string | null }>(`/api/jobs/${jobId}/permits`),
  suggest: (jobId: string, works: WorkType[]) => req<{ suggestions: { kind: PermitKind; authority: string; url: string }[] }>(`/api/jobs/${jobId}/permits/suggest?work=${works.join(",")}`),
  addPermits: (jobId: string, permits: PermitInput[]) => req<{ permits: PermitDto[] }>(`/api/jobs/${jobId}/permits`, { method: "POST", body: json({ permits }) }),
  updatePermit: (jobId: string, id: string, body: PermitInput) => req<{ permit: PermitDto }>(`/api/jobs/${jobId}/permits/${id}`, { method: "PATCH", body: json(body) }),
  deletePermit: (jobId: string, id: string) => req<void>(`/api/jobs/${jobId}/permits/${id}`, { method: "DELETE" }),
};
