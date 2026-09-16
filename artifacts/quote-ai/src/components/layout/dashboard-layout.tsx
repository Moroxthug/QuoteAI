import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, Menu, BarChart3, Settings, ChevronLeft, ChevronRight, Plus, LogOut, User, CreditCard, Building2, ChevronDown, BookOpen, Users, Receipt, Briefcase, FolderOpen, ArrowUpRight, FileSignature, HardHat, Sparkles, Check, Target, UploadCloud } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamMembersApi } from "@/lib/team-members-api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGetSubscription } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/i18n/LanguageContext";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";

function useNavItems() {
  const { t } = useLanguage();
  return [
    { href: "/dashboard", labelKey: "dashboard.nav.dashboard", icon: LayoutDashboard, exact: true, proOnly: false, comingSoon: false },
    { href: "/dashboard/quotes", labelKey: "dashboard.nav.quotes", icon: FileText, exact: false, proOnly: false, comingSoon: false },
    { href: "/dashboard/clients", labelKey: "dashboard.nav.clients", icon: Users, exact: false, proOnly: false, comingSoon: false },
    { href: "/dashboard/leads", labelKey: "dashboard.nav.leads", icon: Target, exact: false, proOnly: false, comingSoon: false },
    { href: "/dashboard/contracts", labelKey: "dashboard.nav.contracts", icon: FileSignature, exact: false, proOnly: true, comingSoon: false },
    { href: "/dashboard/jobs", labelKey: "dashboard.nav.jobs", icon: Briefcase, exact: false, proOnly: true, comingSoon: false },
    { href: "/dashboard/team", labelKey: "dashboard.nav.team", icon: HardHat, exact: false, proOnly: true, comingSoon: false },
    { href: "/dashboard/assistant", labelKey: "dashboard.nav.assistant", icon: Sparkles, exact: false, proOnly: true, comingSoon: false },
    { href: "/dashboard/analytics", labelKey: "dashboard.nav.analytics", icon: BarChart3, exact: false, proOnly: false, comingSoon: false },
    { href: "/dashboard/catalog", labelKey: "dashboard.nav.catalog", icon: BookOpen, exact: false, proOnly: true, comingSoon: false },
    { href: "/dashboard/invoices", labelKey: "dashboard.nav.invoices", icon: Receipt, exact: false, proOnly: true, comingSoon: false },
    { href: "/dashboard/documents", labelKey: "dashboard.nav.documents", icon: FolderOpen, exact: false, proOnly: false, comingSoon: false },
    { href: "/dashboard/imports", labelKey: "dashboard.nav.imports", icon: UploadCloud, exact: false, proOnly: false, comingSoon: false },
    { href: "/dashboard/settings", labelKey: "dashboard.nav.settings", icon: Settings, exact: false, proOnly: false, comingSoon: false },
  ].map(item => ({ ...item, label: t(item.labelKey) }));
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
          {o.orgId === data?.activeOrgId ? <Check className="h-3.5 w-3.5 text-navy-600 shrink-0" /> : <span className="w-3.5 shrink-0" />}
          <span className="truncate flex-1">{o.isOwn ? (o.companyName || t("team.switcher.myCompany")) : o.companyName}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}

function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const name = user?.name || user?.email?.split("@")[0] || "Account";
  const email = user?.email ?? "";
  const initials = name.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button className="h-9 w-9 mx-auto flex items-center justify-center rounded-lg hover:bg-accent transition-colors shrink-0">
                <div className="h-7 w-7 rounded-full bg-navy-100 dark:bg-navy-500/20 text-navy-700 dark:text-navy-300 text-xs font-bold flex items-center justify-center uppercase">
                  {initials || <User className="h-3.5 w-3.5" />}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{name}</TooltipContent>
          </Tooltip>
        ) : (
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors group text-left">
            <div className="h-7 w-7 rounded-full bg-navy-100 dark:bg-navy-500/20 text-navy-700 dark:text-navy-300 text-xs font-bold flex items-center justify-center uppercase shrink-0">
              {initials || <User className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate leading-tight">{name}</div>
              {email && <div className="text-[10px] text-muted-foreground truncate leading-tight">{email}</div>}
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48 mb-1">
        <div className="px-2 py-1">
          <div className="text-xs font-semibold text-foreground truncate">{name}</div>
          {email && <div className="text-[10px] text-muted-foreground truncate">{email}</div>}
        </div>
        <DropdownMenuSeparator />
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
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600 gap-2"
        >
          <LogOut className="h-3.5 w-3.5" /> {t("dashboard.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { isLoaded, isSignedIn } = useAuth();
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

  if (!isSignedIn) {
    window.location.href = "/sign-in";
    return null;
  }

  const NAV_ITEMS = allNavItems.filter(item => !item.proOnly || isPro);

  const NavLinks = ({ collapsed = false, onClick }: { collapsed?: boolean; onClick?: () => void }) => (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, location, item.exact);
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              "flex items-center rounded-lg transition-all",
              collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-2.5 py-2",
              "text-sm font-medium",
              active
                ? "text-navy-700 dark:text-navy-300 bg-navy-50 dark:bg-navy-500/15 font-semibold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-navy-600 dark:text-navy-300" : "text-muted-foreground")} />
            {!collapsed && (
              <span className="flex-1 text-sm">{item.label}</span>
            )}
            {!collapsed && item.proOnly && (
              <Badge className="text-[10px] px-1 py-0 h-4 bg-navy-100 text-navy-700 border-0 font-semibold">{t("dashboard.nav.pro")}</Badge>
            )}
            {!collapsed && item.comingSoon && (
              <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-100 text-amber-600 border-0 font-semibold">{t("dashboard.nav.comingSoon")}</Badge>
            )}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card shadow-sm transition-all duration-200 shrink-0",
          isCollapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo + toggle */}
        <div className={cn("h-14 flex items-center border-b border-border", isCollapsed ? "justify-center px-2" : "px-4 justify-between")}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center">
              <Logo />
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            title={isCollapsed ? t("dashboard.nav.expandSidebar") : t("dashboard.nav.collapseSidebar")}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className={cn("flex-1 flex flex-col gap-3 py-3", isCollapsed ? "px-2" : "px-3")}>
          {/* New quote button */}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/new"
                  className="btn-gradient h-9 w-9 mx-auto flex items-center justify-center rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{t("dashboard.nav.newQuote")}</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard/new"
              className="btn-gradient inline-flex w-full h-9 items-center justify-center gap-2 text-sm font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("dashboard.nav.newQuote")}
            </Link>
          )}

          <NavLinks collapsed={isCollapsed} />
        </div>

        {/* Notifications */}
        <div className={cn("border-t border-border py-2", isCollapsed ? "px-2" : "px-2")}>
          <NotificationsBell collapsed={isCollapsed} />
        </div>

        {/* Theme toggle */}
        <div className={cn("border-t border-border py-2", isCollapsed ? "px-2" : "px-2")}>
          <ThemeToggle collapsed={isCollapsed} />
        </div>

        {/* Account section */}
        <div className={cn("border-t border-border py-2", isCollapsed ? "px-2" : "px-2")}>
          <AccountMenu collapsed={isCollapsed} />
        </div>
      </aside>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">{t("dashboard.nav.toggleMenu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent ref={swipeRef} side="left" className="w-64 p-0 bg-card flex flex-col">
                <SheetTitle className="sr-only">{t("dashboard.nav.navMenu")}</SheetTitle>
                <div className="h-14 flex items-center px-5 border-b border-border">
                  <Link href="/dashboard" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                    <Logo />
                  </Link>
                </div>
                <div className="flex-1 p-3 flex flex-col gap-3">
                  <Link
                    href="/dashboard/new"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="btn-gradient inline-flex w-full h-9 items-center justify-center gap-2 text-sm font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("dashboard.nav.newQuote")}
                  </Link>
                  <NavLinks onClick={() => setIsMobileMenuOpen(false)} />
                </div>
                <div className="border-t border-border p-2">
                  <ThemeToggle />
                </div>
                <div className="border-t border-border p-2">
                  <AccountMenu />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center">
              <Logo style={{ height: 26 }} />
            </Link>
          </div>
          <AccountMenu />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
