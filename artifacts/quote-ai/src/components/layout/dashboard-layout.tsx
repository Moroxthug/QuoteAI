import "@/i18n/dashboard";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, Menu, BarChart3, Settings, ChevronLeft, ChevronRight, Plus, LogOut, User, CreditCard, Building2, ChevronDown, BookOpen, Users, Receipt, Briefcase, FolderOpen, FileSignature, HardHat, Sparkles, Check, Target, UploadCloud, Search, Archive, CalendarDays } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamMembersApi } from "@/lib/team-members-api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from "@/components/ui/command";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useGetSubscription } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/i18n/LanguageContext";
import { NotificationsBell } from "@/components/notifications-bell";

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
    { href: "/dashboard/catalog", labelKey: "dashboard.nav.catalog", icon: BookOpen, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/invoices", labelKey: "dashboard.nav.invoices", icon: Receipt, exact: false, proOnly: true, comingSoon: false, group: "delivery" },
    { href: "/dashboard/analytics", labelKey: "dashboard.nav.analytics", icon: BarChart3, exact: false, proOnly: false, comingSoon: false, group: "insights" },
    { href: "/dashboard/assistant", labelKey: "dashboard.nav.assistant", icon: Sparkles, exact: false, proOnly: true, comingSoon: false, group: "insights" },
    { href: "/dashboard/documents", labelKey: "dashboard.nav.documents", icon: FolderOpen, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
    { href: "/dashboard/archive", labelKey: "dashboard.nav.archive", icon: Archive, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
    { href: "/dashboard/imports", labelKey: "dashboard.nav.imports", icon: UploadCloud, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
    { href: "/dashboard/settings", labelKey: "dashboard.nav.settings", icon: Settings, exact: false, proOnly: false, comingSoon: false, group: "workspace" },
  ].map(item => ({ ...item, label: t(item.labelKey), groupLabel: t(`dashboard.nav.group.${item.group}`) }));
}

/**
 * Attaches touch listeners to a div ref and calls `onClose` when the user
 * swipes left. Only fires when horizontal movement dominates (|dx| > |dy| * 1.5)
 * so vertical scrolling inside the drawer is never blocked.
 */
function useSwipeToClose(enabled: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      startX.current = e.touches[0]!.clientX;
      startY.current = e.touches[0]!.clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0]!.clientX - startX.current;
      const dy = e.changedTouches[0]!.clientY - startY.current;
      // Swipe left: at least 50px, and clearly more horizontal than vertical
      if (dx < -50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        onCloseRef.current();
      }
    }

    function onTouchCancel() {
      // Reset gesture state if the OS interrupts the touch (e.g. incoming call on iOS)
      startX.current = 0;
      startY.current = 0;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled]);

  return ref;
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

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48 mb-1">
        <OrgSwitcherItems />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=account" className="cursor-pointer flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {t("dashboard.account.companyProfile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=billing" className="cursor-pointer flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> {t("dashboard.account.planBilling")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" /> {t("dashboard.account.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600 gap-2">
          <LogOut className="h-3.5 w-3.5" /> {t("dashboard.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NavItem = ReturnType<typeof useNavItems>[number];

/** Cmd/Ctrl+K palette for jumping to a nav page or firing a quick action; styled as the mockup's `.search` pill. */
function QuickSearch({ navItems }: { navItems: NavItem[] }) {
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
          <CommandGroup heading={t("dashboard.search.groupActions")}>
            <CommandItem value={t("dashboard.nav.newQuote")} onSelect={() => go("/dashboard/new")}>
              <Plus className="text-[var(--navy)]" />
              {t("dashboard.nav.newQuote")}
            </CommandItem>
          </CommandGroup>
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
  const { isLoaded, isSignedIn, isError, user } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const swipeRef = useSwipeToClose(isMobileMenuOpen, closeMenu);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  const { data: subscription } = useGetSubscription();
  const isPro = subscription?.isActive && (subscription?.plan === "monthly_pro" || subscription?.plan === "monthly_elite");
  // Hooks must run on every render — keep this above the early returns below.
  const allNavItems = useNavItems();

  // Every dashboard route used to keep the marketing homepage <title> (Phase 66):
  // name the tab after the section the user is in.
  const navLabelsKey = allNavItems.map((item) => item.label).join("|"); // useNavItems returns a fresh array each render
  useEffect(() => {
    const section = allNavItems
      .filter((item) => (item.exact ? location === item.href : location.startsWith(item.href)))
      .sort((a, b) => b.href.length - a.href.length)[0];
    const previous = document.title;
    document.title = section ? `${section.label} · QuoteAI` : "QuoteAI";
    return () => {
      document.title = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navLabelsKey]);

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(isCollapsed)); } catch {}
  }, [isCollapsed]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

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

  const NAV_ITEMS = allNavItems.filter(item => !item.proOnly || isPro);
  const name = user?.name || user?.email?.split("@")[0] || "Account";
  const email = user?.email ?? "";
  const initials = name.slice(0, 2).toUpperCase();

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
              onClick={closeMenu}
              className={cn("sb-link", active && "active")}
              title={item.label}
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
    <div className={cn("app", isCollapsed && "rail")}>
      {/* Sidebar (desktop: rail-collapsible; mobile: slide-in drawer) */}
      <aside ref={swipeRef} className={cn("sidebar", isMobileMenuOpen && "open")} aria-label={t("dashboard.nav.navMenu")}>
        <div className="sb-top">
          <span className="sb-mark">q</span>
          <Link href="/dashboard" className="sb-logo" onClick={closeMenu}>
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

        <Link href="/dashboard/new" onClick={closeMenu} className="btn btn-white sb-new">
          <Plus className="ic" style={{ width: 16, height: 16 }} />
          <span className="btn-txt">{t("dashboard.nav.newQuote")}</span>
        </Link>

        <NavLinks />

        <div className="sb-bottom">
          <NotificationsBell variant="sidebar" side="right" />
          <AccountMenu
            trigger={
              <button className="sb-user" type="button">
                <span className="sb-avatar">{initials || <User className="h-3.5 w-3.5" />}</span>
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

      {isMobileMenuOpen && <div className="scrim show" onClick={closeMenu} />}

      {/* Main column */}
      <div className="main">
        <header className="topbar">
          <button type="button" className="tb-menu" onClick={() => setIsMobileMenuOpen(true)} aria-label={t("dashboard.nav.toggleMenu")}>
            <Menu className="ic" style={{ width: 22, height: 22 }} />
          </button>
          <QuickSearch navItems={NAV_ITEMS} />
          <div className="tb-right">
            <NotificationsBell variant="topbar" side="bottom" align="end" />
            <AccountMenu trigger={<button className="tb-avatar" type="button" aria-label={name}>{initials || <User className="h-3.5 w-3.5" />}</button>} />
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
