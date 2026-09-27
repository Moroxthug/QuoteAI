import { Banknote, BookOpenCheck, CalendarDays, CalendarRange, Code2, CreditCard, Globe, Landmark, Mail, Megaphone, MessageCircle, MessageSquareText, type LucideIcon } from "lucide-react";
import { PLAN_FEATURES, PLAN_IDS, type PlanId, type ProductFeature } from "@/lib/plans";

// ── Phase 103: the apps directory ────────────────────────────────────────────
// Every integration QuoteAI has, as one list: which group it sits in, its logo
// (public/brands/, see BRANDS.md there), the plan feature that unlocks it, and
// — for the three that already have a settings section of their own — where
// its tile leads instead of a detail panel.

export type AppId =
  | "quickbooks" | "wave"
  | "google_calendar" | "outlook_calendar" | "ics"
  | "gmail"
  | "whatsapp" | "sms"
  | "stripe" | "financeit"
  | "flinks"
  | "meta_leads" | "google_lsa"
  | "widget" | "api";

export type AppGroup = "accounting" | "calendar" | "email" | "messaging" | "payments" | "banking" | "leads" | "developers";

export type AppDef = {
  id: AppId;
  group: AppGroup;
  /**
   * File in public/brands/ — the company's own mark (BRANDS.md: where each came
   * from, and why Outlook, Twilio, WhatsApp and Meta have none: their owners
   * license their logos only by written permission or behind a terms click).
   */
  logo?: string;
  /** A wordmark rather than a square symbol: it gets a wider box. */
  wide?: boolean;
  /** Our own tools, the brands without a licensed logo, and the fallback while a file is missing. */
  icon: LucideIcon;
  /** The plan feature that unlocks it (lib/plans.ts, mirrored from the server). */
  feature?: ProductFeature;
  /** For the two gated on a monthly allowance rather than a feature. */
  minPlan?: PlanId;
  /** Opens this settings section instead of a detail panel. */
  section?: "whatsapp" | "sms" | "widget";
  /** For the trademark line at the foot of the page. */
  owner?: string;
};

export const APPS: AppDef[] = [
  // quickbooks.svg is Intuit's approved app icon, downloadable only when signed in to developer.intuit.com (BRANDS.md).
  { id: "quickbooks", group: "accounting", logo: "quickbooks.svg", icon: BookOpenCheck, feature: "quickbooks_sync", owner: "Intuit Inc." },
  { id: "wave", group: "accounting", logo: "wave.svg", wide: true, icon: BookOpenCheck, feature: "wave_sync", owner: "Wave Financial Inc." },
  { id: "google_calendar", group: "calendar", logo: "google-calendar.svg", icon: CalendarDays, feature: "calendar_sync", owner: "Google LLC" },
  { id: "outlook_calendar", group: "calendar", icon: CalendarDays, feature: "calendar_sync", owner: "Microsoft Corporation" },
  { id: "ics", group: "calendar", icon: CalendarRange, feature: "calendar_sync" },
  { id: "gmail", group: "email", logo: "gmail.svg", icon: Mail, feature: "gmail_send", owner: "Google LLC" },
  { id: "whatsapp", group: "messaging", icon: MessageCircle, minPlan: "monthly_pro", section: "whatsapp", owner: "WhatsApp LLC" },
  { id: "sms", group: "messaging", icon: MessageSquareText, minPlan: "monthly_starter", section: "sms", owner: "Twilio Inc." },
  { id: "stripe", group: "payments", logo: "stripe.svg", wide: true, icon: CreditCard, feature: "invoice_card_payments", owner: "Stripe, Inc." },
  { id: "financeit", group: "payments", logo: "financeit.svg", wide: true, icon: Landmark, feature: "financeit", owner: "Financeit Canada Inc." },
  { id: "flinks", group: "banking", logo: "flinks.png", wide: true, icon: Banknote, feature: "flinks_bank_feed", owner: "Flinks Technology Inc." },
  { id: "meta_leads", group: "leads", icon: Megaphone, feature: "meta_lead_ads", owner: "Meta Platforms, Inc." },
  { id: "google_lsa", group: "leads", logo: "google.svg", icon: Megaphone, feature: "google_lsa", owner: "Google LLC" },
  { id: "widget", group: "developers", icon: Globe, section: "widget" },
  { id: "api", group: "developers", icon: Code2, feature: "public_api" },
];

export const APP_GROUPS: AppGroup[] = ["accounting", "calendar", "email", "messaging", "payments", "banking", "leads", "developers"];

export const appById = (id: string | null | undefined): AppDef | undefined => APPS.find((a) => a.id === id);

/** The cheapest plan that includes the app; null when every plan (and no plan) has it. */
export function requiredPlanFor(app: AppDef): PlanId | null {
  if (app.minPlan) return app.minPlan;
  if (!app.feature) return null;
  for (const plan of PLAN_IDS) if (PLAN_FEATURES[plan].has(app.feature)) return plan;
  return "monthly_elite";
}

/** Whether `plan` (null = no active plan) includes the app. */
export function isUnlocked(app: AppDef, plan: string | null | undefined): boolean {
  const need = requiredPlanFor(app);
  if (!need) return true;
  const have = PLAN_IDS.indexOf((plan ?? "free") as PlanId);
  return have >= PLAN_IDS.indexOf(need);
}

/**
 * The OAuth callbacks send the browser back to /dashboard/settings/apps with
 * one of these (…?qb=connected). Which app that was, so its panel opens.
 */
export const RETURN_PARAMS: Array<{ param: string; app: (q: URLSearchParams) => AppId }> = [
  { param: "qb", app: () => "quickbooks" },
  { param: "wave", app: () => "wave" },
  { param: "cal", app: (q) => (q.get("provider") === "outlook" ? "outlook_calendar" : "google_calendar") },
  { param: "email", app: () => "gmail" },
  { param: "stripeConnect", app: () => "stripe" },
  { param: "metaLeadAds", app: () => "meta_leads" },
  { param: "googleLsa", app: () => "google_lsa" },
];

export const APPS_HREF = "/dashboard/settings/apps";
export const appHref = (id: AppId) => `${APPS_HREF}?app=${id}`;
