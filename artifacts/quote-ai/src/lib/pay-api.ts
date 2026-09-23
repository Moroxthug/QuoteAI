// Phase 89 — time to pay: the pay period worksheet (overtime, holiday pay,
// travel and per diem), labour by job, the rules, and the payroll export.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type HolidayPayMethod = "div20_4w" | "avg_day_30d" | "avg_day_28d" | "none";
export type PayExportFormat = "generic" | "wagepoint" | "payworks" | "qbo_payroll";
export type EarningKind = "regular" | "overtime" | "double" | "holiday" | "holiday_worked" | "mileage" | "per_diem" | "other";
export type AllowanceKind = "mileage" | "per_diem" | "other";

export const PAY_FREQUENCIES: PayFrequency[] = ["weekly", "biweekly", "semimonthly", "monthly"];
export const HOLIDAY_PAY_METHODS: HolidayPayMethod[] = ["div20_4w", "avg_day_30d", "avg_day_28d", "none"];
export const PAY_EXPORT_FORMATS: PayExportFormat[] = ["generic", "wagepoint", "payworks", "qbo_payroll"];
export const EARNING_KINDS: EarningKind[] = ["regular", "overtime", "double", "holiday", "holiday_worked", "mileage", "per_diem", "other"];

type OvertimeRules = { dailyHours: number | null; dailyDoubleHours: number | null; weeklyHours: number | null; multiplier: number; doubleMultiplier: number };
type HolidayRules = { method: HolidayPayMethod; workedMultiplier: number; minDaysWorked: number; minEmployedDays: number };

export type PaySettings = {
  frequency?: PayFrequency;
  anchorDate?: string;
  weekStartsOn?: number;
  overtime?: OvertimeRules | null;
  averaging?: { weeks: number; startDate: string } | null;
  holidays?: Partial<HolidayRules> & { added?: { date: string; name: string }[]; removed?: string[] };
  allowances?: { kmRateCents?: number; perDiemCents?: number };
  exportFormat?: PayExportFormat;
  earningCodes?: Partial<Record<EarningKind, string>>;
};

type EffectivePaySettings = {
  province: string;
  frequency: PayFrequency;
  anchorDate: string;
  weekStartsOn: number;
  overtime: OvertimeRules;
  overtimeIsDefault: boolean;
  averaging: { weeks: number; startDate: string } | null;
  holidays: HolidayRules;
  allowances: { kmRateCents: number; perDiemCents: number };
  exportFormat: PayExportFormat;
  earningCodes: Record<EarningKind, string>;
};

export type HolidayDto = { date: string; key: string | null; name: string | null; custom: boolean };

export type PaySettingsDto =
  | { enabled: false; requiredPlan: string }
  | {
      enabled: true;
      settings: PaySettings;
      effective: EffectivePaySettings;
      provinceDefaults: { overtime: OvertimeRules; holidays: HolidayRules; earningCodes: Record<EarningKind, string> };
      holidays: HolidayDto[];
      provinceHolidays: HolidayDto[];
      today: string;
      recomputed?: number;
      recomputedSince?: string;
    };

type EarningLineDto = { kind: EarningKind; code: string; hours: number | null; quantity: number | null; rateCents: number; amountCents: number; taxable: boolean; note?: string };

export type EmployeePayDto = {
  workerId: string;
  name: string;
  payrollId: string | null;
  hours: number;
  lines: EarningLineDto[];
  grossCents: number;
  holidays: { date: string; key: string | null; name: string | null; cents: number | null; hours: number | null; reason: "method_none" | "not_employed_long_enough" | "too_few_days" | null }[];
  allowances: { id: string; date: string; kind: AllowanceKind; quantity: number; rateCents: number; amountCents: number; taxable: boolean; note: string; projectId: string | null; projectName: string | null }[];
  jobs: string[];
};

export type PayPeriodDto = {
  period: { start: string; end: string };
  previousStart: string;
  nextStart: string;
  today: string;
  isCurrent: boolean;
  holidays: HolidayDto[];
  employees: EmployeePayDto[];
  subcontractors: { workerId: string; name: string; hours: number; amountCents: number }[];
  jobs: { projectId: string | null; name: string | null; hours: number; overtimeHours: number; straightCents: number; premiumCents: number; burdenCents: number; allowanceCents: number; totalCents: number }[];
  totals: { hours: number; overtimeHours: number; grossCents: number; holidayCents: number; allowanceCents: number; premiumCents: number };
  pending: { count: number; hours: number };
  warnings: { missingPayrollId: string[]; zeroRate: string[] };
  exports: { id: string; format: PayExportFormat; exportedAt: string; exportedByName: string | null }[];
  changedSinceExport: string[];
  settings: EffectivePaySettings;
};

export type PayWorkerDto = { id: string; name: string; workerType: "employee" | "subcontractor"; payrollId: string | null; active: boolean; hourlyRateCents: number };

export const payApi = {
  settings: () => req<PaySettingsDto>("/api/pay/settings"),
  saveSettings: (body: PaySettings) => req<Extract<PaySettingsDto, { enabled: true }>>("/api/pay/settings", { method: "PUT", body: json(body) }),
  period: (date?: string) => req<PayPeriodDto>(`/api/pay/period${date ? `?date=${date}` : ""}`),
  exportUrl: (date: string, format: PayExportFormat) => `/api/pay/export.csv?date=${date}&format=${format}`,
  workers: () => req<{ workers: PayWorkerDto[] }>("/api/pay/workers"),
  addAllowance: (body: { workerId: string; date: string; kind: AllowanceKind; quantity: number; rateCents?: number; projectId?: string | null; taxable?: boolean; note?: string }) =>
    req<{ allowance: { id: string; amountCents: number } }>("/api/pay/allowances", { method: "POST", body: json(body) }),
  deleteAllowance: (id: string) => req<{ success: true }>(`/api/pay/allowances/${id}`, { method: "DELETE" }),
};
