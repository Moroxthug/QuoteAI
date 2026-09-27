import "@/i18n/dashboard";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, BarChart3, Settings, ChevronLeft, ChevronRight, Plus, LogOut, User, CreditCard, Building2, ChevronDown, BookOpen, Users, Receipt, Briefcase, FolderOpen, FileSignature, HardHat, Sparkles, Check, Target, UploadCloud, Search, Archive, CalendarDays, Landmark, BookCheck, Wallet, Network } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamMembersApi } from "@/lib/team-members-api";
import { peopleApi } from "@/lib/people-api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from "@/components/ui/command";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useGetSubscription } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useMediaQuery } from "@/hooks/use-media-query";
import { SkipLink } from "@/components/a11y";
import { NotificationsBell } from "@/components/notifications-bell";
import { OfflineBar } from "@/components/pwa/offline-bar";
import { clearOfflineCaches } from "@/lib/pwa";
import { MobileHeaderProvider, MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { PhoneNewButton, PhoneTabBar } from "@/components/layout/phone-nav";

/** Section groupings for the sidebar rail — purely presentational, doesn't affect routing or access. */
const NAV_GROUPS = ["overview", "sales", "delivery", "insights", "workspace"] as const;

function useNavItems() {
  const { t } = useLanguage();
  return [
    { href: "/dashboard", labelKey: "dashboard.nav.dashboard", icon: LayoutDashboard, exact: true, proOnly: false, comingSoon: false, group: "overview" },
    { href: "/dashboard/quotes", labelKey: "dashboard.nav.quotes", icon: FileText, exact: false, proOnly: false, comingSoon: false, group: "sales" },
    { href: "/dashboard/clients", labelKey: "dashboard.nav.clients", icon: Users, exact: false, proOnly: false, comingSoon: false, group: "sales" },
    { href: "/dashboard/leads", labelKey: "dashboard.nav.leads", icon: Target, exact: false, proOnly: false, comingSoon: false, group: "sales" },
    { href: "/dashboard/contracts", labelKey: "dashboard.nav.contracts", icon: FileSignature, exact: false, proOnly: true, comingSoon: false, group: "sales" },
    { href: "/dashboard/jobs", labelKey: "dashboard.nav.jobs", icon: Briefcase, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/schedule", labelKey: "dashboard.nav.schedule", icon: CalendarDays, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/team", labelKey: "dashboard.nav.team", icon: HardHat, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/pay", labelKey: "dashboard.nav.pay", icon: Wallet, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/catalog", labelKey: "dashboard.nav.catalog", icon: BookOpen, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/invoices", labelKey: "dashboard.nav.invoices", icon: Receipt, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/compliance", labelKey: "dashboard.nav.compliance", icon: Landmark, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/books", labelKey: "dashboard.nav.books", icon: BookCheck, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/analytics", labelKey: "dashboard.nav.analytics", icon: BarChart3, exact: false, proOnly: false, comingSoon: false, group: "insights" },
    { href: "/dashboard/assistant", labelKey: "dashboard.nav.assistant", icon: Sparkles, exact: false, proOnly: true, comingSoon: false, group: "insights" },
    { href: "/dashboard/group", labelKey: "dashboard.nav.group", icon: Network, exact: false, proOnly: false, comingSoon: false, group: "insights" },
    { href: "/dashboard/documents", labelKey: "dashboard.nav.documents", icon: FolderOpen, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
    { href: "/dashboard/archive", labelKey: "dashboard.nav.archive", icon: Archive, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
    { href: "/dashboard/imports", labelKey: "dashboard.nav.imports", icon: UploadCloud, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
    { href: "/dashboard/settings", labelKey: "dashboard.nav.settings", icon: Settings, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
  ].map(item => ({ ...item, label: t(item.labelKey), groupLabel: t(`dashboard.nav.group.${item.group}`) }));
}

async function signOut() {
  await authClient.signOut();
  // Phase 77: the service worker keeps API reads for offline use — not for the next person on this browser.
  await clearOfflineCaches();
  window.location.href = "/";
}

/** Pages that are not in the sidebar but still need a name in the phone top bar. */
const EXTRA_TITLES: Record<string, string> = {
  "/dashboard/new": "dashboard.nav.newQuote",
  "/dashboard/me": "dashboard.account.myProfile",
  "/dashboard/profile": "dashboard.account.companyProfile",
  "/dashboard/billing": "dashboard.account.planBilling",
  "/dashboard/notifications": "notifications.title",
  "/dashboard/people": "dashboard.nav.team",
};

/**
 * Phase 100: the phone top bar's back target — the screen one level up
 * (/dashboard/quotes/:id → /dashboard/quotes). Section roots have none; the
 * bottom tabs (Phase 101) are how you move between sections.
 */
function parentOf(location: string): string | null {
  const segs = location.split("/").filter(Boolean);
  if (segs[0] !== "dashboard" || segs.length < 3) return null;
  if (segs[1] === "people") return "/dashboard/team?tab=members";
  return "/" + segs.slice(0, -1).join("/");
}

function isActive(navHref: string, location: string, exact: boolean) {
  if (exact) return location === navHref;
  return location === navHref || location.startsWith(navHref + "/") || location.startsWith(navHref + "?");
}

function OrgSwitcherItems() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["team-orgs"], queryFn: teamMembersApi.orgs, staleTime: 60_000 });
  const switchOrg = useMutation({
    mutationFn: (orgId: string) => teamMembersApi.switchOrg(orgId),
    onSuccess: () => { queryClient.clear(); window.location.href = "/dashboard"; },
  });
  const orgs = data?.items ?? [];
  if (orgs.length < 2) return null;
  return (
    <>
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("team.switcher.switch")}</div>
      {orgs.map((o) => (
        <DropdownMenuItem key={o.orgId} className="cursor-pointer flex items-center gap-2" onClick={() => o.orgId !== data?.activeOrgId && switchOrg.mutate(o.orgId)}>
          {o.orgId === data?.activeOrgId ? <Check className="h-3.5 w-3.5 text-[var(--navy)] shrink-0" /> : <span className="w-3.5 shrink-0" />}
          <span className="truncate flex-1">{o.isOwn ? (o.companyName || t("team.switcher.myCompany")) : o.companyName}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}

/** Renders the sb-user block; the dropdown itself carries account/org actions. */
function AccountMenu({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useLanguage();
  const can = useCan();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48 mb-1">
        <OrgSwitcherItems />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/me" className="cursor-pointer flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" /> {t("dashboard.account.myProfile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=account" className="cursor-pointer flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {t("dashboard.account.companyProfile")}
          </Link>
        </DropdownMenuItem>
        {can("settings", "full") && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings?tab=billing" className="cursor-pointer flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> {t("dashboard.account.planBilling")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" /> {t("dashboard.account.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600 focus:text-red-600 gap-2">
          <LogOut className="h-3.5 w-3.5" /> {t("dashboard.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NavItem = ReturnType<typeof useNavItems>[number];

/** Cmd/Ctrl+K palette for jumping to a nav page or firing a quick action; styled as the mockup's `.search` pill. */
function QuickSearch({ navItems, canNewQuote }: { navItems: NavItem[]; canNewQuote: boolean }) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    navigate(href);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="search">
        <Search className="ic" style={{ width: 17, height: 17 }} />
        <span className="flex-1 text-left truncate">{t("dashboard.search.placeholder")}</span>
        <kbd className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--soft-2)] text-[var(--muted-mk)] shrink-0">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title={t("dashboard.search.placeholder")}>
        <CommandInput placeholder={t("dashboard.search.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("dashboard.search.empty")}</CommandEmpty>
          {canNewQuote && (
            <CommandGroup heading={t("dashboard.search.groupActions")}>
              <CommandItem value={t("dashboard.nav.newQuote")} onSelect={() => go("/dashboard/new")}>
                <Plus className="text-[var(--navy)]" />
                {t("dashboard.nav.newQuote")}
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading={t("dashboard.search.groupPages")}>
            {navItems.map((item) => (
              <CommandItem key={item.href} value={`${item.label} ${item.groupLabel}`} onSelect={() => go(item.href)}>
                <item.icon className="text-muted-foreground" />
                {item.label}
                <CommandShortcut>{item.groupLabel}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const can = useCan();
  const { isLoaded, isSignedIn, isError, user } = useAuth();
  const [location] = useLocation();
  // Phase 101: at 980 px and below the sidebar is gone (CSS) and the phone
  // tabs + More sheet take over — the hamburger drawer they replace hid twenty
  // links two taps away.
  const phoneNav = useMediaQuery("(max-width: 980px)");
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  const { data: subscription } = useGetSubscription();
  const isPro = subscription?.isActive && (subscription?.plan === "monthly_pro" || subscription?.plan === "monthly_elite");
  // Hooks must run on every render — keep this above the early returns below.
  const allNavItems = useNavItems();
  const { data: orgsData } = useQuery({ queryKey: ["team-orgs"], queryFn: teamMembersApi.orgs, staleTime: 60_000 });
  // Phase 91: the person's own name and photo (the session copy goes stale after they change it).
  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: peopleApi.me, staleTime: 5 * 60_000, enabled: !!isSignedIn });

  // Every dashboard route used to keep the marketing homepage <title> (Phase 66):
  // name the tab after the section the user is in.
  const sectionOf = (path: string) => {
    const extra = Object.keys(EXTRA_TITLES).find((p) => path === p || path.startsWith(p + "/"));
    if (extra) return t(EXTRA_TITLES[extra]!);
    return allNavItems
      .filter((item) => (item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/") || path.startsWith(item.href + "?")))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label;
  };
  const sectionLabel = sectionOf(location);
  const backHref = parentOf(location);
  useEffect(() => {
    const previous = document.title;
    document.title = sectionLabel ? `${sectionLabel} · QuoteAI` : "QuoteAI";
    return () => {
      document.title = previous;
    };
  }, [sectionLabel]);

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(isCollapsed)); } catch {}
  }, [isCollapsed]);

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-7 h-7 rounded-full border-[3px] border-navy-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  // A failed session check (API down, cold 502) is not a sign-out: bouncing the
  // user to /sign-in loses their place and their unsaved work (Phase 66).
  if (!isSignedIn && isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
        <div className="card" style={{ maxWidth: 420, padding: 28, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>{t("dashboard.offline.title")}</h1>
          <p className="sub" style={{ marginTop: 8 }}>{t("dashboard.offline.body")}</p>
          <button type="button" className="btn btn-navy" style={{ marginTop: 18 }} onClick={() => window.location.reload()}>{t("dashboard.offline.retry")}</button>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    window.location.href = "/sign-in";
    return null;
  }

  // Phase 88: the books (the bank account, the month-end close) are the office's, not a foreman's.
  // Phase 89: so is pay (wages) — costs:full.
  // Phase 90: Group shows once there is something to group — a second company to switch to, or a group this one is in.
  const hasGroupEntry = !!orgsData?.group || (orgsData?.items.length ?? 0) > 1;
  const NAV_ITEMS = allNavItems.filter(item => (!item.proOnly || isPro) && (item.href !== "/dashboard/books" || can("invoicing", "full")) && (item.href !== "/dashboard/pay" || can("costs", "full")) && (item.href !== "/dashboard/group" || hasGroupEntry));
  // Phase 80: roles below quotes:edit (foreman, viewer) never see the New quote entry points.
  const canNewQuote = can("quotes", "edit");
  const name = meData?.person.name || user?.name || user?.email?.split("@")[0] || "Account";
  const photo = meData?.person.image ?? user?.image ?? null;
  const email = user?.email ?? "";
  // The account button is named by `name`: its visible initials stay the name's first letters so they are part of that name (label-in-name).
  const initials = name.slice(0, 2).toUpperCase();
  const avatar = photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : initials || <User className="h-3.5 w-3.5" />;

  const NavLinks = () => (
    <>
      {NAV_GROUPS.flatMap((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group);
        if (items.length === 0) return [];

        const header = <p key={`${group}-heading`} className="sb-group">{items[0]!.groupLabel}</p>;

        const links = items.map((item) => {
          const active = isActive(item.href, location, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sb-link", active && "active")}
              title={item.label}
              // The `active` class is a colour; this is the part a screen
              // reader can hear.
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="ic" />
              <span className="sb-txt">{item.label}</span>
              {item.proOnly && <span className="badge-pro">{t("dashboard.nav.pro")}</span>}
              {item.comingSoon && <span className="badge-pro">{t("dashboard.nav.comingSoon")}</span>}
            </Link>
          );
        });

        return [header, ...links];
      })}
    </>
  );

  return (
    <MobileHeaderProvider>
    <div className={cn("app", isCollapsed && "rail")}>
      <SkipLink />
      {/* Sidebar (desktop, rail-collapsible; display: none at 980 px and below — PhoneTabBar instead) */}
      <aside className="sidebar" aria-label={t("dashboard.nav.navMenu")}>
        <div className="sb-top">
          <span className="sb-mark">q</span>
          <Link href="/dashboard" className="sb-logo">
            <Logo style={{ height: 28 }} />
          </Link>
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="sb-collapse"
            aria-label={isCollapsed ? t("dashboard.nav.expandSidebar") : t("dashboard.nav.collapseSidebar")}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight className="chev" /> : <ChevronLeft className="chev" />}
          </button>
        </div>

        {canNewQuote && (
          <Link href="/dashboard/new" className="btn btn-white sb-new" aria-current={location === "/dashboard/new" ? "page" : undefined}>
            <Plus className="ic" style={{ width: 16, height: 16 }} />
            <span className="btn-txt">{t("dashboard.nav.newQuote")}</span>
          </Link>
        )}

        {/* `display: contents` — the landmark a screen reader navigates by,
            with the flex column of links exactly as it was. */}
        <nav className="sb-nav"><NavLinks /></nav>

        <div className="sb-bottom">
          <NotificationsBell variant="sidebar" side="right" />
          <AccountMenu
            trigger={
              <button className="sb-user" type="button">
                <span className="sb-avatar">{avatar}</span>
                <span className="sb-userinfo">
                  <b>{name}</b>
                  <span>{email}</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#8f91a6] shrink-0" />
              </button>
            }
          />
        </div>
      </aside>

      {/* Main column */}
      <div className="main">
        <header className="topbar">
          <MobilePageHeader title={sectionLabel ?? "QuoteAI"} backHref={backHref} backLabel={backHref ? sectionOf(backHref.split("?")[0]!) : undefined} />
          <QuickSearch navItems={NAV_ITEMS} canNewQuote={canNewQuote} />
          <div className="tb-right">
            {phoneNav && <PhoneNewButton hasJobs={NAV_ITEMS.some((i) => i.href === "/dashboard/jobs")} />}
            {/* On a phone both live in More (its tab carries the unread count). */}
            <NotificationsBell variant="topbar" side="bottom" align="end" />
            <AccountMenu trigger={<button className="tb-avatar" type="button" aria-label={name}>{avatar}</button>} />
          </div>
        </header>

        <main id="main" className="content"><OfflineBar />{children}</main>
      </div>
      {phoneNav && (
        <PhoneTabBar
          navItems={NAV_ITEMS}
          moreProps={{ navItems: NAV_ITEMS, name, email, avatar, canBilling: can("settings", "full"), onSignOut: signOut }}
        />
      )}
    </div>
    </MobileHeaderProvider>
  );
}
