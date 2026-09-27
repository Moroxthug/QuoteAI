import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import type { PaymentSchedule } from "@/lib/payment-schedule";

type TaxProfile = { province: string; components: { code: string; label: string; rate: number }[]; totalRate: number };

type AutomationSettings = {
  notifyOnQuoteAccepted: boolean;
  autoDraftContract: boolean;
  autoSendInvoices: boolean;
  invoiceAutoSendAfterHours: number;
  invoiceReminders: boolean;
  leadFollowupDays?: number[];
  quoteFollowupDays?: number[];
  reviewRequestDelayDays?: number;
};

/** GET /api/business-profile with the fields the generated client does not type (Phase 2+ extras). */
type BusinessProfile = {
  companyName: string;
  vatNumber: string | null;
  address: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  apiKey?: string | null;
  province: string | null;
  taxProfile: TaxProfile | null;
  gstHstNumber: string | null;
  qstNumber: string | null;
  pstNumber: string | null;
  licenceNumber: string | null;
  etransferEmail: string | null;
  googleReviewUrl: string | null;
  homeStarsProfileUrl: string | null;
  sendReviewRequests: boolean;
  defaultPaymentSchedule: PaymentSchedule | null;
  automationSettings: AutomationSettings;
};

export function useBusinessProfile() {
  const q = useGetBusinessProfile();
  return { ...q, data: q.data as unknown as BusinessProfile | undefined };
}

/**
 * PUT /api/business-profile with only the fields a section changed (the
 * endpoint takes partial bodies and merges automationSettings). Toasts either
 * way; throws on failure so the save bar keeps the edits.
 */
export function useSaveBusinessProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  return useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/business-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: t("settings.save.error"), description: err.error, variant: "destructive" });
      throw new Error(err.error || "Save failed");
    }
    await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
    toast({ title: t("settings.save.saved") });
  }, [queryClient, toast, t]);
}

/** The keys of `draft` whose value differs from `saved`. */
export function changed<T extends Record<string, unknown>>(draft: T, saved: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(draft) as Array<keyof T>) {
    if (JSON.stringify(draft[k]) !== JSON.stringify(saved[k])) out[k] = draft[k];
  }
  return out;
}

/** "" → null, for the endpoint's nullable text fields. */
export const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

// Phase 80: "1, 3, 7" ⇄ [1, 3, 7] — days after the previous touch, at most 5, each 1–90.
export function parseCadence(text: string): number[] | null {
  const parts = text.split(/[,\s]+/).filter(Boolean);
  if (parts.length > 5) return null;
  const days = parts.map((p) => Number(p));
  return days.every((d) => Number.isInteger(d) && d >= 1 && d <= 90) ? days : null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export const PROVINCE_TAX: Record<string, string> = {
  AB: "GST 5%", BC: "GST 5% + PST 7%", MB: "GST 5% + RST 7%", NB: "HST 15%", NL: "HST 15%", NS: "HST 14%",
  NT: "GST 5%", NU: "GST 5%", ON: "HST 13%", PE: "HST 15%", QC: "GST 5% + QST 9.975%", SK: "GST 5% + PST 6%", YT: "GST 5%",
};
