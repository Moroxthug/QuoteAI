import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetSubscription } from "@workspace/api-client-react";
import {
  Building2, CalendarClock, ChevronRight, CreditCard, Globe, Landmark, Mail, MessageCircle, MessageSquareText, Plug, Receipt, ShieldCheck, UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan, useRole } from "@/hooks/use-role";
import { useMobileHeader } from "@/components/mobile/mobile-page-header";
import { authClient } from "@/lib/auth-client";
import { peopleApi } from "@/lib/people-api";
import { cn } from "@/lib/utils";
import { SaveBar, useDraftHost, useSinglePane } from "./ui";
import { PROVINCE_TAX, useBusinessProfile } from "./data";
import { ProfileSection } from "./profile";
import { SecuritySection } from "./security";
import { CompanySection } from "./company";
import { TaxesSection } from "./taxes";
import { InvoicingSection } from "./invoicing";
import { FollowupsSection } from "./followups";
import { WidgetSection } from "./widget";
import { EmailSection } from "./email";
import { SmsSection } from "./sms";
import { WhatsappSection } from "./whatsapp";
import { AppsSection } from "./apps";
import { PlanSection, planLabelOf } from "./plan";

// ── Phase 102: Settings as a settings area ───────────────────────────────────
// /dashboard/settings/<section>. On a wide screen: the grouped list on the
// left, the open section on the right. Under 860 px: the list is the first
// screen (/dashboard/settings) and a section opens as its own page with a
// back arrow. Old ?tab= links (emails, OAuth returns, bookmarks) redirect.

type SectionId = "profile" | "security" | "company" | "taxes" | "invoicing" | "followups" | "widget" | "email" | "sms" | "whatsapp" | "apps" | "plan";
type GroupId = "you" | "business" | "selling" | "messaging" | "more";

type SectionDef = { id: SectionId; group: GroupId; icon: LucideIcon; Component: ComponentType };

const SECTIONS: SectionDef[] = [
  { id: "profile", group: "you", icon: UserRound, Component: ProfileSection },
  { id: "security", group: "you", icon: ShieldCheck, Component: SecuritySection },
  { id: "company", group: "business", icon: Building2, Component: CompanySection },
  { id: "taxes", group: "business", icon: Landmark, Component: TaxesSection },
  { id: "invoicing", group: "business", icon: Receipt, Component: InvoicingSection },
  { id: "followups", group: "selling", icon: CalendarClock, Component: FollowupsSection },
  { id: "widget", group: "selling", icon: Globe, Component: WidgetSection },
  { id: "email", group: "messaging", icon: Mail, Component: EmailSection },
  { id: "sms", group: "messaging", icon: MessageSquareText, Component: SmsSection },
  { id: "whatsapp", group: "messaging", icon: MessageCircle, Component: WhatsappSection },
  { id: "apps", group: "more", icon: Plug, Component: AppsSection },
  { id: "plan", group: "more", icon: CreditCard, Component: PlanSection },
];
const GROUPS: GroupId[] = ["you", "business", "selling", "messaging", "more"];

/** The old tabs (and the Phase 55 /settings/account path) → their section now. */
const LEGACY: Record<string, SectionId> = {
  account: "company", business: "taxes", billing: "plan", usage: "plan", whatsapp: "whatsapp",
  sms: "sms", widget: "widget", integrations: "apps", security: "security",
};

const settingsHref = (id: SectionId) => `/dashboard/settings/${id}`;

/** Which sections this person sees: the same plan and permission gates the old tabs had. */
function useVisibleSections() {
  const can = useCan();
  const { loaded: roleLoaded } = useRole();
  const { data: sub, isFetched: subLoaded } = useGetSubscription();
  const plan = sub?.isActive ? sub.plan : null;
  const isPaid = !!plan && plan !== "free";
  const proUp = plan === "monthly_pro" || plan === "monthly_business" || plan === "monthly_elite";
  const businessUp = plan === "monthly_business" || plan === "monthly_elite";
  const visible = useMemo(() => {
    const show: Record<SectionId, boolean> = {
      profile: true,
      security: true,
      company: can("settings", "edit"),
      taxes: can("settings", "edit"),
      invoicing: can("settings", "edit"),
      followups: can("settings", "edit"),
      widget: can("settings", "edit"),
      email: businessUp && can("integrations", "full"),
      sms: isPaid && can("settings", "edit"),
      whatsapp: proUp && can("integrations", "full"),
      apps: businessUp && can("integrations", "full"),
      plan: true,
    };
    return SECTIONS.filter((s) => show[s.id]);
  }, [can, isPaid, proUp, businessUp]);
  return { visible, ready: roleLoaded && subLoaded, plan };
}

type Status = { text: string | null; attention?: boolean };

/** The one-line status under each name, and a dot where something needs doing. Reads only cached queries. */
function useStatuses(plan: string | null | undefined): Partial<Record<SectionId, Status>> {
  const { t } = useLanguage();
  const can = useCan();
  const { data: profile } = useBusinessProfile();
  const { data: session } = authClient.useSession();
  const me = useQuery({ queryKey: ["me"], queryFn: peopleApi.me, staleTime: 60_000 });
  const twoFactor = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);
  const out: Partial<Record<SectionId, Status>> = {
    profile: { text: me.data?.person.name ?? null },
    security: session ? { text: twoFactor ? t("settings.status.twoFactorOn") : t("settings.status.twoFactorOff"), attention: !twoFactor } : { text: null },
    plan: { text: planLabelOf(plan) ?? t("settings.status.noPlan") },
  };
  if (profile && can("settings", "edit")) {
    const missingContact = !profile.phone || !profile.address;
    out.company = profile.companyName.trim()
      ? { text: missingContact ? t("settings.status.contactMissing") : profile.companyName, attention: missingContact }
      : { text: t("settings.status.notSetUp"), attention: true };
    out.taxes = !profile.province
      ? { text: t("settings.status.provinceMissing"), attention: true }
      : !profile.gstHstNumber
        ? { text: t("settings.status.gstMissing"), attention: true }
        : { text: `${profile.province} · ${PROVINCE_TAX[profile.province] ?? ""}`.trim() };
    out.invoicing = { text: profile.etransferEmail ? t("settings.status.etransferOn") : t("settings.status.etransferOff") };
    const quoteDays = profile.automationSettings?.quoteFollowupDays ?? [2, 5, 10];
    out.followups = { text: quoteDays.length ? t("settings.status.followupsOn").replace("{days}", quoteDays.join(", ")) : t("settings.status.followupsOff") };
    out.widget = { text: profile.apiKey ? t("settings.status.widgetOn") : t("settings.status.notSetUp") };
  }
  return out;
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const [, params] = useRoute<{ section: string }>("/dashboard/settings/:section");
  const single = useSinglePane();
  const { visible, ready, plan } = useVisibleSections();
  const statuses = useStatuses(plan);
  const { reg, DraftProvider, ctx } = useDraftHost();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const raw = params?.section ?? null;
  const active = visible.find((s) => s.id === raw) ?? null;

  // Old links, unknown sections and (on a wide screen) the bare root all land somewhere real.
  useEffect(() => {
    const q = new URLSearchParams(search);
    const tab = q.get("tab");
    if (tab || (raw && LEGACY[raw] && !SECTIONS.some((s) => s.id === raw))) {
      q.delete("tab");
      const target = (tab && LEGACY[tab]) || (raw && LEGACY[raw]) || null;
      const rest = q.toString();
      navigate(`${target ? settingsHref(target) : "/dashboard/settings"}${rest ? `?${rest}` : ""}`, { replace: true });
      return;
    }
    if (!ready) return;
    if (raw && !active) { navigate("/dashboard/settings", { replace: true }); return; }
    if (!raw && !single && visible[0]) navigate(settingsHref(visible[0].id), { replace: true });
  }, [search, raw, active, ready, single, visible, navigate]);

  // Unsaved edits: closing the tab asks the browser's question; following a link inside the app asks ours.
  const dirty = !!reg?.dirty;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const href = url.pathname + url.search;
      if (href === location) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, location]);

  const leave = useCallback(async (mode: "discard" | "save") => {
    const href = pendingHref;
    if (!href) return;
    if (mode === "save") {
      const ok = await reg?.save();
      if (!ok) { setPendingHref(null); return; }
    } else {
      reg?.discard();
    }
    setPendingHref(null);
    navigate(href);
  }, [pendingHref, reg, navigate]);

  const activeLabel = active ? t(`settings.section.${active.id}`) : null;
  const header = useMemo(() => (single && activeLabel ? { title: activeLabel } : null), [single, activeLabel]);
  useMobileHeader(header);

  const showList = !single || !raw;
  const showPane = !!active && (!single || !!raw);

  return (
    <div className={cn("settings animate-in fade-in duration-500", single && raw && "settings-single-section")}>
      {showList && (
        <div className="page-head">
          <div>
            <h1>{t("dashboard.settings.title")}</h1>
            <p className="sub">{t("settings.subtitle")}</p>
          </div>
        </div>
      )}
      <div className="settings-grid">
        {showList && (
          <nav className="snav" aria-label={t("dashboard.settings.title")}>
            {GROUPS.map((g) => {
              const items = visible.filter((s) => s.group === g);
              if (!items.length) return null;
              return (
                <div key={g} className="snav-group">
                  <h2 className="snav-group-title">{t(`settings.group.${g}`)}</h2>
                  <ul>
                    {items.map((s) => {
                      const Icon = s.icon;
                      const st = statuses[s.id];
                      const current = active?.id === s.id && !single;
                      return (
                        <li key={s.id}>
                          <Link href={settingsHref(s.id)} className={cn("snav-item", current && "on")} aria-current={current ? "page" : undefined}>
                            <span className="snav-ic"><Icon aria-hidden="true" /></span>
                            <span className="snav-txt">
                              <span className="snav-name">{t(`settings.section.${s.id}`)}</span>
                              {st?.text && <span className="snav-status">{st.text}</span>}
                            </span>
                            {st?.attention && <span className="snav-dot" role="img" aria-label={t("settings.status.needsAttention")} />}
                            {single && <ChevronRight className="snav-chev" aria-hidden="true" />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        )}
        {showPane && active && (
          <div className="settings-pane">
            <DraftProvider value={ctx}>
              <active.Component key={active.id} />
            </DraftProvider>
            <SaveBar reg={reg} />
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingHref} onOpenChange={(o) => { if (!o) setPendingHref(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.leave.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.leave.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.leave.stay")}</AlertDialogCancel>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => void leave("discard")}>{t("settings.leave.discard")}</button>
            <button type="button" className="btn btn-sm btn-navy" onClick={() => void leave("save")} disabled={!reg?.valid || reg?.saving}>{t("settings.leave.save")}</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
