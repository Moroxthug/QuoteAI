import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Briefcase, Building2, CalendarDays, Camera, Check, ChevronRight, CreditCard, FilePlus2, FileText, HardHat, Home, LayoutGrid, Loader2, LogOut, Mic, Plus, Receipt, Target, Users, Wallet, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BottomTabBar, tabOwns, type TabItem } from "@/components/mobile/bottom-tab-bar";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { JobCaptureSheet } from "@/components/jobs/voice-actions";
import { useUnreadNotifications } from "@/components/notifications-bell";
import { restoreScrollOnNextVisit } from "@/components/scroll-manager";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan, useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { jobsApi, type JobSummaryDto } from "@/lib/jobs-api";
import { teamMembersApi } from "@/lib/team-members-api";
import { cn } from "@/lib/utils";

/**
 * Phase 101 — how you move around the dashboard on a phone or a tablet
 * (≤ 980 px, where the sidebar used to become a hamburger drawer):
 *
 * - four role-aware tabs + More at the bottom (docs/MOBILE-AND-APP-PLAN.md);
 * - More: every other section, grouped Work / Money / Team / Business, with
 *   the account, notifications and the company switcher on top;
 * - New (the + in the top bar): one sheet for the things you start from
 *   anywhere — a quote, a lead, a receipt photo, a spoken job note.
 *
 * Each tab remembers the last screen you had open in it and where you had
 * scrolled to; tapping the tab you are already in goes to its first screen,
 * then to the top. Every move is a history push, so Back (Android's button,
 * iOS's swipe) retraces your steps instead of leaving the app.
 */

export type PhoneNavItem = { href: string; label: string; icon: LucideIcon; proOnly: boolean };

type Group = "work" | "money" | "team" | "business";
const GROUPS: Group[] = ["work", "money", "team", "business"];
const GROUP_OF: Record<string, Group> = {
  "/dashboard/quotes": "work",
  "/dashboard/clients": "work",
  "/dashboard/leads": "work",
  "/dashboard/contracts": "work",
  "/dashboard/jobs": "work",
  "/dashboard/schedule": "work",
  "/dashboard/catalog": "work",
  "/dashboard/documents": "work",
  "/dashboard/archive": "work",
  "/dashboard/invoices": "money",
  "/dashboard/pay": "money",
  "/dashboard/books": "money",
  "/dashboard/compliance": "money",
  "/dashboard/analytics": "money",
  "/dashboard/team": "team",
  "/dashboard/group": "team",
  "/dashboard/assistant": "business",
  "/dashboard/imports": "business",
  "/dashboard/settings": "business",
};

/** What each role reaches for most, in order; the first three that this plan shows become tabs. */
const PREFERRED: Record<"office" | "foreman", string[]> = {
  office: ["/dashboard/quotes", "/dashboard/jobs", "/dashboard/invoices", "/dashboard/clients", "/dashboard/leads"],
  foreman: ["/dashboard/jobs", "/dashboard/schedule", "/dashboard/team", "/dashboard/quotes", "/dashboard/clients"],
};

const MEMORY_KEY = "phone-tab-memory";
function readMemory(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(MEMORY_KEY) || "{}") as Record<string, string>; } catch { return {}; }
}
function writeMemory(m: Record<string, string>) {
  try { sessionStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch { /* private mode: tabs just start at their root */ }
}

function usePhoneTabs(navItems: PhoneNavItem[]): TabItem[] {
  const { t } = useLanguage();
  const { role } = useRole();
  return useMemo(() => {
    const shown = new Map(navItems.map((i) => [i.href, i]));
    const picks = PREFERRED[role === "foreman" ? "foreman" : "office"].filter((h) => shown.has(h)).slice(0, 3);
    const tabs: TabItem[] = [{ href: "/dashboard", label: t("mobile.nav.today"), icon: Home, exact: true }];
    for (const href of picks) {
      const item = shown.get(href)!;
      if (href === "/dashboard/invoices") tabs.push({ href, label: t("mobile.nav.money"), icon: Wallet, match: ["/dashboard/pay", "/dashboard/books", "/dashboard/compliance"] });
      else if (href === "/dashboard/team") tabs.push({ href, label: t("mobile.nav.crew"), icon: HardHat, match: ["/dashboard/people"] });
      else tabs.push({ href, label: item.label, icon: TAB_ICON[href] ?? item.icon });
    }
    return tabs;
  }, [navItems, role, t]);
}
const TAB_ICON: Record<string, LucideIcon> = { "/dashboard/quotes": FileText, "/dashboard/jobs": Briefcase, "/dashboard/clients": Users, "/dashboard/leads": Target, "/dashboard/schedule": CalendarDays };

export function PhoneTabBar({ navItems, moreProps }: { navItems: PhoneNavItem[]; moreProps: Omit<MoreSheetProps, "open" | "onOpenChange" | "tabs"> }) {
  const { t } = useLanguage();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const tabs = usePhoneTabs(navItems);
  const unread = useUnreadNotifications();
  const [moreOpen, setMoreOpen] = useState(false);

  // Remember the last screen of each tab (path + query, so a job's open tab comes back too).
  useEffect(() => {
    const owner = tabs.find((tab) => tabOwns(tab, location));
    if (!owner) return;
    const memory = readMemory();
    memory[owner.href] = location + (search ? `?${search}` : "");
    writeMemory(memory);
  }, [location, search, tabs]);

  // A sheet never outlives the screen it was opened on (Back while it is open lands on the previous screen, closed).
  useEffect(() => setMoreOpen(false), [location]);

  const onTabClick = useCallback((tab: TabItem, e: React.MouseEvent) => {
    const here = location + (search ? `?${search}` : "");
    if (tabOwns(tab, location)) {
      e.preventDefault();
      if (here !== tab.href) navigate(tab.href);
      else window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    const target = readMemory()[tab.href] ?? tab.href;
    restoreScrollOnNextVisit(target);
    if (target !== tab.href) {
      e.preventDefault();
      navigate(target);
    }
  }, [location, search, navigate]);

  const ownedByTab = tabs.some((tab) => tabOwns(tab, location)) || location === "/dashboard/new";
  const all: TabItem[] = [
    ...tabs,
    { href: "#more", label: t("mobile.nav.more"), icon: LayoutGrid, badge: unread, onClick: () => setMoreOpen(true), active: moreOpen || !ownedByTab, expanded: moreOpen },
  ];

  return (
    <>
      <BottomTabBar tabs={all} label={t("mobile.sections")} onTabClick={onTabClick} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} tabs={tabs} {...moreProps} />
    </>
  );
}

type MoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: TabItem[];
  navItems: PhoneNavItem[];
  name: string;
  email: string;
  avatar: React.ReactNode;
  canBilling: boolean;
  onSignOut: () => void;
};

function MoreSheet({ open, onOpenChange, tabs, navItems, name, email, avatar, canBilling, onSignOut }: MoreSheetProps) {
  const { t } = useLanguage();
  const [location] = useLocation();
  const unread = useUnreadNotifications();
  const queryClient = useQueryClient();
  const { data: orgs } = useQuery({ queryKey: ["team-orgs"], queryFn: teamMembersApi.orgs, staleTime: 60_000 });
  const switchOrg = useMutation({
    mutationFn: (orgId: string) => teamMembersApi.switchOrg(orgId),
    onSuccess: () => { queryClient.clear(); window.location.href = "/dashboard"; },
  });
  const close = () => onOpenChange(false);
  const tabRoots = new Set(tabs.map((tab) => tab.href));
  const current = (href: string) => location === href || location.startsWith(href + "/");

  const row = (href: string, label: string, Icon: LucideIcon, extra?: React.ReactNode) => (
    <Link key={href} href={href} onClick={close} className={cn("more-row", current(href.split("?")[0]!) && "on")} aria-current={current(href.split("?")[0]!) ? "page" : undefined}>
      <Icon aria-hidden="true" />
      <span className="more-row-label">{label}</span>
      {extra}
      <ChevronRight className="more-row-chev" aria-hidden="true" />
    </Link>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sheet more-sheet" hideClose aria-describedby={undefined}>
        <div className="sheet-grab" aria-hidden="true" />
        <DialogTitle className="sr-only">{t("mobile.nav.more")}</DialogTitle>
        <div className="more-body">
          <Link href="/dashboard/me" onClick={close} className="more-account">
            <span className="more-avatar">{avatar}</span>
            <span className="more-account-text"><b>{name}</b><span>{email}</span></span>
            <ChevronRight className="more-row-chev" aria-hidden="true" />
          </Link>

          <div className="more-card">
            {row("/dashboard/notifications", t("notifications.title"), Bell, unread > 0 ? (
              <>
                <span className="count-chip" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
                <span className="sr-only">{t("notifications.unreadCount").replace("{count}", String(unread))}</span>
              </>
            ) : undefined)}
          </div>

          {(orgs?.items.length ?? 0) > 1 && (
            <section className="more-group" aria-labelledby="more-g-company">
              <h3 id="more-g-company">{t("team.switcher.switch")}</h3>
              <div className="more-card">
                {orgs!.items.map((o) => {
                  const on = o.orgId === orgs!.activeOrgId;
                  return (
                    <button key={o.orgId} type="button" className="more-row" aria-pressed={on} disabled={switchOrg.isPending} onClick={() => !on && switchOrg.mutate(o.orgId)}>
                      <Building2 aria-hidden="true" />
                      <span className="more-row-label">{o.isOwn ? (o.companyName || t("team.switcher.myCompany")) : o.companyName}</span>
                      {on && <Check className="more-row-check" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {GROUPS.map((g) => {
            const items = navItems.filter((i) => GROUP_OF[i.href] === g && !tabRoots.has(i.href));
            const extras = g === "business"
              ? [
                  row("/dashboard/settings/company", t("dashboard.account.companyProfile"), Building2),
                  canBilling ? row("/dashboard/settings/plan", t("dashboard.account.planBilling"), CreditCard) : null,
                ]
              : [];
            if (items.length === 0 && !extras.some(Boolean)) return null;
            return (
              <section key={g} className="more-group" aria-labelledby={`more-g-${g}`}>
                <h3 id={`more-g-${g}`}>{t(`mobile.more.${g}`)}</h3>
                <div className="more-card">
                  {items.map((i) => row(i.href, i.label, i.icon, i.proOnly ? <span className="badge-pro">{t("dashboard.nav.pro")}</span> : undefined))}
                  {extras}
                </div>
              </section>
            );
          })}

          <div className="more-card">
            <button type="button" className="more-row danger" onClick={onSignOut}>
              <LogOut aria-hidden="true" />
              <span className="more-row-label">{t("dashboard.account.signOut")}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Intent = "receipt" | "note";

/**
 * The + in the phone top bar. Quote and lead open their screens; a receipt
 * photo and a spoken note first ask which job, then open the camera (in the
 * same tap, so the browser allows it) or the recorder.
 */
export function PhoneNewButton({ hasJobs, hasInvoices }: { hasJobs: boolean; hasInvoices?: boolean }) {
  const { t } = useLanguage();
  const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [capture, setCapture] = useState<string | null>(null);
  const [scanningJob, setScanningJob] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jobForFile = useRef<string | null>(null);

  useEffect(() => { setOpen(false); setIntent(null); }, [location]);

  const { data: jobs, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: intent !== null, staleTime: 30_000 });
  const openJobs = (jobs?.items ?? [])
    .filter((j: JobSummaryDto) => !j.archivedAt && j.status !== "completed" && j.setupStatus === "confirmed")
    .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));

  const scan = useMutation({
    mutationFn: ({ file, jobId }: { file: File; jobId: string }) => jobsApi.scanReceipt(file, jobId),
    onMutate: ({ jobId }) => setScanningJob(jobId),
    onSuccess: (_r, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: t("mobile.new.receiptSaved") });
      setIntent(null);
      navigate(`/dashboard/jobs/${jobId}?tab=costs`);
    },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
    onSettled: () => setScanningJob(null),
  });

  const actions = [
    can("quotes", "edit") && { key: "quote", label: t("dashboard.nav.newQuote"), icon: FilePlus2, run: () => navigate("/dashboard/new") },
    can("leads", "edit") && { key: "lead", label: t("mobile.new.lead"), icon: Target, run: () => navigate("/dashboard/leads?new=1") },
    // Phase 106: the jobs list's New job button lives here on a phone.
    hasJobs && can("jobs", "edit") && { key: "job", label: t("jobs.newJob"), icon: Briefcase, run: () => navigate("/dashboard/jobs?new=1") },
    // Phase 107: and the invoices list’s New invoice.
    hasInvoices && can("invoicing", "edit") && { key: "invoice", label: t("invoices.new"), icon: Receipt, run: () => navigate("/dashboard/invoices?new=1") },
    hasJobs && can("costs", "edit") && { key: "receipt", label: t("mobile.new.receipt"), icon: Camera, run: () => { setOpen(false); setIntent("receipt"); } },
    hasJobs && can("jobs", "edit") && { key: "note", label: t("mobile.new.note"), icon: Mic, run: () => { setOpen(false); setIntent("note"); } },
  ].filter((a): a is { key: string; label: string; icon: LucideIcon; run: () => void } => !!a);
  if (actions.length === 0) return null;

  const pickJob = (jobId: string) => {
    if (intent === "receipt") {
      jobForFile.current = jobId;
      fileRef.current?.click();
      return;
    }
    setIntent(null);
    setCapture(jobId);
  };

  return (
    <>
      <button type="button" className="tb-new" onClick={() => setOpen(true)} aria-label={t("mobile.new.title")} aria-haspopup="dialog" aria-expanded={open}>
        <Plus aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sheet" hideClose aria-describedby={undefined}>
          <div className="sheet-grab" aria-hidden="true" />
          <DialogTitle className="asheet-title">{t("mobile.new.title")}</DialogTitle>
          <div className="asheet-list">
            {actions.map((a) => (
              <button key={a.key} type="button" className="asheet-item" onClick={() => { setOpen(false); a.run(); }}>
                <a.icon />
                <span>{a.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-outline-navy asheet-cancel" onClick={() => setOpen(false)}>{t("mobile.cancel")}</button>
        </DialogContent>
      </Dialog>

      <BottomSheet
        open={intent !== null}
        onOpenChange={(v) => { if (!v && !scan.isPending) setIntent(null); }}
        title={t("mobile.new.whichJob")}
        description={intent === "receipt" ? t("mobile.new.whichJobReceipt") : t("mobile.new.whichJobNote")}
        flush
      >
        {isLoading ? (
          <p className="more-empty"><Loader2 className="h-4 w-4 animate-spin" /></p>
        ) : openJobs.length === 0 ? (
          <p className="more-empty">{t("mobile.new.noJobs")}</p>
        ) : (
          <div className="lrows">
            {openJobs.map((j) => (
              <button key={j.id} type="button" className="lrow" disabled={scan.isPending} onClick={() => pickJob(j.id)}>
                <span className="lrow-main">
                  <span className="lrow-title">{j.name}</span>
                  <span className="lrow-meta">{[j.clientName, j.address].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                {scanningJob === j.id ? <Loader2 className="lrow-chev animate-spin" aria-label={t("mobile.new.reading")} /> : <ChevronRight className="lrow-chev" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        data-testid="new-receipt-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && jobForFile.current) scan.mutate({ file, jobId: jobForFile.current });
        }}
      />

      {capture && <JobCaptureSheet jobId={capture} mode="voice" photo={null} onClose={() => setCapture(null)} />}
    </>
  );
}
