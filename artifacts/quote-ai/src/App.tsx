import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { RouteAnnouncer } from "@/components/a11y";
import { ScrollManager } from "@/components/scroll-manager";
import { setOutboxQueryClient, startOutbox } from "@/lib/offline/outbox";
import { installSyncFetch } from "@/lib/sync/install";
import { TooltipProvider } from "@/components/ui/tooltip";
import { pageLoaders } from "@/lib/route-chunks";
import { withDashboardStrings } from "@/i18n/dashboard";
import { AppShellSkeleton, PageSkeleton } from "@/components/layout/app-shell-skeleton";

// Every other public page is lazy (Phase 68): the homepage is the entry's
// LCP-critical route and these pages — auth, onboarding, legal, contact,
// WhatsApp, sitemap — were ~55 kB of the bundle it had to load first.
// Phase 115: the homepage, the public layout and the 404 page are lazy too —
// together ~35 kB gzipped that every signed-in screen was loading for nothing.
// The homepage is prerendered, so its hero paints from the HTML either way;
// the prerender preloads these chunks (scripts/prerender-seo.ts) for hydration.
const Home = lazy(() => import("@/pages/home"));
// The toast viewport (Radix Toast) is only needed once there is a toast; one
// raised before it arrives waits in the use-toast store and shows on mount.
const Toaster = lazy(() => import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })));
const NotFound = lazy(() => import("@/pages/not-found"));
const PublicLayoutLazy = lazy(() => import("@/components/layout/public-layout").then((m) => ({ default: m.PublicLayout })));
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PublicLayoutLazy>{children}</PublicLayoutLazy>
    </Suspense>
  );
}
const WhatsappPage = lazy(() => import("@/pages/whatsapp"));
// Phase 81 — the marketing pages built for the BC/ON/QC pilot.
const PricingPage = lazy(() => import("@/pages/pricing"));
const PilotPage = lazy(() => import("@/pages/pilot"));
// Phase 100: the calm-mobile primitives on fake data — dev server only (the import is dropped from production builds).
const MobilePreview = import.meta.env.DEV ? lazy(() => import("@/dev/mobile-preview")) : null;
const ProvincePage = lazy(() => import("@/pages/provinces/[slug]"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const OnboardingPage = lazy(withDashboardStrings(() => import("@/pages/onboarding")));
const PrivacyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const ChiSiamoPage = lazy(() => import("@/pages/chi-siamo"));
const ContattiPage = lazy(() => import("@/pages/contatti"));
const MappaSitoPage = lazy(() => import("@/pages/mappa-sito"));
const HelpIndexPage = lazy(() => import("@/pages/help/index"));
const HelpArticlePage = lazy(() => import("@/pages/help/[slug]"));

import { PATHS } from "@/data/sitemap-routes";

// Phase 115: the signed-in pages load through the shared loaders in
// lib/route-chunks.ts, so a nav link or list row can prefetch the same chunk.
const DashboardHome = lazy(pageLoaders.today);
const NewQuote = lazy(pageLoaders.newQuote);
const QuotesList = lazy(pageLoaders.quotes);
const QuoteDetail = lazy(pageLoaders.quote);
const BillingPage = lazy(pageLoaders.billing);
const SettingsPage = lazy(pageLoaders.settings);
const CatalogPage = lazy(pageLoaders.catalog);
const AnalyticsPage = lazy(pageLoaders.analytics);
// The admin and onboarding pages are dashboard roots of their own (no dashboard
// layout above them), so they bring the dashboard strings with them.
const AdminPage = lazy(withDashboardStrings(() => import("@/pages/admin")));
const ClientsPage = lazy(pageLoaders.clients);
const LeadsListPage = lazy(pageLoaders.leads);
const ImportsPage = lazy(pageLoaders.imports);
const ClientDetailPage = lazy(pageLoaders.client);
const InvoicesPage = lazy(pageLoaders.invoices);
const InvoiceDetailPage = lazy(pageLoaders.invoice);
const PublicInvoicePage = lazy(() => import("@/pages/i/[token]"));
const JobsListPage = lazy(pageLoaders.jobs);
const JobDetailPage = lazy(pageLoaders.job);
const JobSetupPage = lazy(pageLoaders.jobSetup);
const TeamPage = lazy(pageLoaders.team);
const SchedulePage = lazy(pageLoaders.schedule);
const CompliancePage = lazy(pageLoaders.compliance);
const BooksPage = lazy(pageLoaders.books);
const PayPage = lazy(pageLoaders.pay);
const GroupPage = lazy(pageLoaders.group);
const MePage = lazy(pageLoaders.me);
const TeammatePage = lazy(() => pageLoaders.me().then((m) => ({ default: m.TeammatePage })));
const JoinPage = lazy(() => import("@/pages/join"));
const AssistantPage = lazy(pageLoaders.assistant);
const WorkerTimePage = lazy(() => import("@/pages/t/[token]"));
const TeamInvitePage = lazy(() => import("@/pages/team-invite/[token]"));
const DocumentsPage = lazy(pageLoaders.documents);
const ArchivePage = lazy(pageLoaders.archive);
const NotificationsPage = lazy(pageLoaders.notifications);
const PublicQuotePage = lazy(() => import("@/pages/p/[id]"));

const SeoLanding = lazy(() => import("@/pages/seo/[type]"));
const SeoCityLanding = lazy(() => import("@/pages/seo/city-landing"));
const BlogPage = lazy(() => import("@/pages/blog/index"));
const ContractsListPage = lazy(pageLoaders.contracts);
const ContractDetailPage = lazy(pageLoaders.contract);
const SignPage = lazy(() => import("@/pages/sign/[token]"));
const PortalPage = lazy(() => import("@/pages/portal/[token]"));
const BlogArticlePage = lazy(() => import("@/pages/blog/[slug]"));
const BlogCategoryPage = lazy(() => import("@/pages/blog/categoria/[slug]"));

import { ErrorBoundary } from "@/components/error-boundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { isNativeApp } from "@/lib/native/env";
import { isAppPath } from "@/lib/native/routes";
import { NativeOutside } from "@/components/native-outside";
import { isOnboardingSkipped } from "@/lib/onboarding-state";

// The QueryClient (freshness rules, Phase 116) lives in lib/query-client.ts so
// main.tsx can fill it from the device before this module renders anything.
// Phase 77: the offline outbox refreshes the affected queries after a replay.
setOutboxQueryClient(queryClient);
startOutbox();
// Phase 117: every write goes through the sync layer (idempotency keys, versions, queue, merge).
installSyncFetch();

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey(), enabled: isLoaded && !!userId, retry: false }
  });

  const skipped = isLoaded && !!userId && isOnboardingSkipped(userId);

  const shouldRedirect =
    isLoaded &&
    !isLoading &&
    !!userId &&
    !skipped &&
    location !== "/onboarding" &&
    profile !== undefined &&
    profile.companyName === "";

  useEffect(() => {
    if (shouldRedirect) {
      setLocation("/onboarding");
    }
  }, [shouldRedirect, setLocation]);

  if (shouldRedirect) return null;
  return <>{children}</>;
}

function DashSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

// Lazy so the dashboard chunk is not a static dependency of the public entry:
// a static import here would make Vite modulepreload the whole dashboard
// bundle on the marketing homepage (Phase 61 finding).
// Phase 115: it arrives with the dashboard strings in the page's language,
// and the app frame is drawn while both are on their way (never a blank page).
const DashboardLayoutLazy = lazy(withDashboardStrings(() =>
  import("@/components/layout/dashboard-layout").then((m) => ({ default: m.DashboardLayout })),
));
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <DashboardLayoutLazy>{children}</DashboardLayoutLazy>
    </Suspense>
  );
}

// Phase 115: the signed-in app. Until now each dashboard route rendered its
// own OnboardingGuard + layout inside an inline component, so every tap on a
// tab unmounted and rebuilt the sidebar, the top bar and the tab bar, and a
// page whose chunk wasn't loaded yet blanked the whole screen. Now the layout
// stays; only the page area waits (with a page-shaped skeleton), and the
// `key` still gives every URL a fresh page, as before.
function DashboardApp() {
  const [location] = useLocation();
  return (
    <OnboardingGuard>
      <DashboardLayout>
        <Suspense fallback={<PageSkeleton />}>
          <Switch key={location}>
            <Route path="/dashboard" component={DashboardHome} />
            <Route path="/dashboard/new" component={NewQuote} />
            <Route path="/dashboard/quotes" component={QuotesList} />
            <Route path="/dashboard/quotes/:id" component={QuoteDetail} />
            <Route path="/dashboard/analytics" component={AnalyticsPage} />
            <Route path="/dashboard/settings/:section" component={SettingsPage} />
            <Route path="/dashboard/settings" component={SettingsPage} />
            {/* Phase 102: the old company profile page duplicated Settings → Company details. */}
            <Route path="/dashboard/profile" component={() => <Redirect to="/dashboard/settings/company" />} />
            <Route path="/dashboard/billing" component={isNativeApp ? () => <Redirect to="/dashboard/settings/plan" replace /> : BillingPage} />
            <Route path="/dashboard/catalog" component={CatalogPage} />
            <Route path="/dashboard/clients/:id" component={ClientDetailPage} />
            <Route path="/dashboard/clients" component={ClientsPage} />
            <Route path="/dashboard/leads" component={LeadsListPage} />
            <Route path="/dashboard/imports" component={ImportsPage} />
            <Route path="/dashboard/contracts/:id" component={ContractDetailPage} />
            <Route path="/dashboard/contracts" component={ContractsListPage} />
            <Route path="/dashboard/invoices/:id" component={InvoiceDetailPage} />
            <Route path="/dashboard/invoices" component={InvoicesPage} />
            <Route path="/dashboard/jobs/:id/setup" component={JobSetupPage} />
            <Route path="/dashboard/jobs/:id" component={JobDetailPage} />
            <Route path="/dashboard/jobs" component={JobsListPage} />
            <Route path="/dashboard/assistant" component={AssistantPage} />
            <Route path="/dashboard/team" component={TeamPage} />
            <Route path="/dashboard/schedule" component={SchedulePage} />
            <Route path="/dashboard/compliance" component={CompliancePage} />
            <Route path="/dashboard/books" component={BooksPage} />
            <Route path="/dashboard/me" component={MePage} />
            <Route path="/dashboard/people/:userId" component={TeammatePage} />
            <Route path="/dashboard/group" component={GroupPage} />
            <Route path="/dashboard/pay" component={PayPage} />
            <Route path="/dashboard/documents" component={DocumentsPage} />
            <Route path="/dashboard/archive" component={ArchivePage} />
            <Route path="/dashboard/notifications" component={NotificationsPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </DashboardLayout>
    </OnboardingGuard>
  );
}


function Router() {
  // Phase 118: the phone app is the signed-in app and the way into it — any
  // other page (Terms, Privacy, help, a client's link) opens on the website.
  const [location] = useLocation();
  if (isNativeApp && !isAppPath(location)) return <NativeOutside path={location} />;
  return (
    <Switch>
      {/* Public pages — paths from sitemap-routes.ts (shared with generate-sitemap.ts) */}
      <Route path={PATHS.HOME} component={() => <PublicLayout><Suspense fallback={null}><Home /></Suspense></PublicLayout>} />
      {/* French homepage — same component, detects lang from the /fr prefix */}
      <Route path="/fr" component={() => <PublicLayout><Suspense fallback={null}><Home /></Suspense></PublicLayout>} />
      {/* Phase 81 — pricing, pilot and province pages, each with a real French URL */}
      <Route path={PATHS.PRICING} component={() => <PublicLayout><Suspense fallback={null}><PricingPage /></Suspense></PublicLayout>} />
      <Route path="/fr/tarifs" component={() => <PublicLayout><Suspense fallback={null}><PricingPage /></Suspense></PublicLayout>} />
      <Route path={PATHS.PILOT} component={() => <PublicLayout><Suspense fallback={null}><PilotPage /></Suspense></PublicLayout>} />
      <Route path="/fr/pilote" component={() => <PublicLayout><Suspense fallback={null}><PilotPage /></Suspense></PublicLayout>} />
      <Route path="/provinces/:slug" component={() => <PublicLayout><Suspense fallback={null}><ProvincePage /></Suspense></PublicLayout>} />
      <Route path="/fr/provinces/:slug" component={() => <PublicLayout><Suspense fallback={null}><ProvincePage /></Suspense></PublicLayout>} />
      <Route path={PATHS.WHATSAPP} component={() => <PublicLayout><Suspense fallback={null}><WhatsappPage /></Suspense></PublicLayout>} />
      <Route path={PATHS.CHI_SIAMO} component={() => <Suspense fallback={null}><ChiSiamoPage /></Suspense>} />
      <Route path={PATHS.CONTATTI} component={() => <Suspense fallback={null}><ContattiPage /></Suspense>} />
      <Route path={PATHS.PRIVACY} component={() => <Suspense fallback={null}><PrivacyPage /></Suspense>} />
      <Route path={PATHS.TERMS} component={() => <Suspense fallback={null}><TermsPage /></Suspense>} />
      {/* Phase 95 — the legal pages in French (same components, language from the /fr prefix) */}
      <Route path="/fr/confidentialite" component={() => <Suspense fallback={null}><PrivacyPage /></Suspense>} />
      <Route path="/fr/conditions" component={() => <Suspense fallback={null}><TermsPage /></Suspense>} />
      {/* Old Italian-era paths kept as redirects so existing links/bookmarks keep working */}
      <Route path="/privacy" component={() => <Redirect to={PATHS.PRIVACY} />} />
      <Route path="/termini" component={() => <Redirect to={PATHS.TERMS} />} />
      <Route path={PATHS.MAPPA_SITO} component={() => <Suspense fallback={null}><MappaSitoPage /></Suspense>} />
      {/* Help centre — Phase 70; articles from HELP_ARTICLES */}
      <Route path="/help/:slug" component={() => <PublicLayout><Suspense fallback={null}><HelpArticlePage /></Suspense></PublicLayout>} />
      <Route path={PATHS.HELP} component={() => <PublicLayout><Suspense fallback={null}><HelpIndexPage /></Suspense></PublicLayout>} />

      {/* Auth routes (not indexed) */}
      <Route path="/sign-in" component={() => <PublicLayout><Suspense fallback={null}><SignInPage /></Suspense></PublicLayout>} />
      <Route path="/sign-in/:rest*" component={() => <PublicLayout><Suspense fallback={null}><SignInPage /></Suspense></PublicLayout>} />
      <Route path="/sign-up" component={() => <PublicLayout><Suspense fallback={null}><SignUpPage /></Suspense></PublicLayout>} />
      <Route path="/sign-up/:rest*" component={() => <PublicLayout><Suspense fallback={null}><SignUpPage /></Suspense></PublicLayout>} />

      <Route path="/onboarding" component={() => <Suspense fallback={null}><OnboardingPage /></Suspense>} />

      {/* Dashboard (private, not indexed). Phase 115: one route for the whole
          signed-in app, so its layout stays mounted from page to page. */}
      <Route path="/dashboard/admin" component={() => <DashSuspense><AdminPage /></DashSuspense>} />
      {MobilePreview && (
        <Route path="/dashboard/__preview" component={() => (
          <DashboardLayout><DashSuspense><MobilePreview /></DashSuspense></DashboardLayout>
        )} />
      )}
      <Route path="/dashboard/*?" component={DashboardApp} />
      {/* The old CRM is retired (Phase 2): its working parts live in Jobs */}
      <Route path="/crm" component={() => <Redirect to="/dashboard/jobs" />} />
      <Route path="/crm/:rest*" component={() => <Redirect to="/dashboard/jobs" />} />

      {/* Public e-signature page: the customer signs the contract from the emailed link */}
      <Route path="/sign/:token" component={() => <Suspense fallback={null}><SignPage /></Suspense>} />
      <Route path="/portal/:token" component={() => <Suspense fallback={null}><PortalPage /></Suspense>} />
      {/* Public invoice page: the customer sees the balance + payment instructions from the emailed link */}
      <Route path="/i/:token" component={() => <Suspense fallback={null}><PublicInvoicePage /></Suspense>} />
      {/* Public worker time-entry page (magic link from the Team page) */}
      <Route path="/t/:token" component={() => <Suspense fallback={null}><WorkerTimePage /></Suspense>} />
      {/* Team member invite accept page (emailed link, Phase 7) */}
      <Route path="/team-invite/:token" component={() => <Suspense fallback={null}><TeamInvitePage /></Suspense>} />
      <Route path="/join" component={() => <Suspense fallback={null}><JoinPage /></Suspense>} />

      {/* Pagina pubblica: il cliente finale visualizza e accetta il preventivo (link condiviso via WhatsApp/email) */}
      <Route path="/p/:id" component={() => <Suspense fallback={null}><PublicQuotePage /></Suspense>} />

      {/* SEO landing pages — dynamic, driven by SECTORS / CITIES data */}
      <Route path="/quotes/:type/:city" component={() => <PublicLayout><Suspense fallback={null}><SeoCityLanding /></Suspense></PublicLayout>} />
      <Route path="/quotes/:type" component={() => <PublicLayout><Suspense fallback={null}><SeoLanding /></Suspense></PublicLayout>} />
      {/* French SEO landing pages — same components, detect lang from the /fr prefix */}
      <Route path="/fr/soumissions/:type/:city" component={() => <PublicLayout><Suspense fallback={null}><SeoCityLanding /></Suspense></PublicLayout>} />
      <Route path="/fr/soumissions/:type" component={() => <PublicLayout><Suspense fallback={null}><SeoLanding /></Suspense></PublicLayout>} />

      {/* Blog — dynamic, driven by BLOG_ARTICLES / BLOG_CATEGORIES data */}
      <Route path="/blog/categoria/:slug" component={() => <PublicLayout><Suspense fallback={null}><BlogCategoryPage /></Suspense></PublicLayout>} />
      <Route path="/blog/:slug" component={() => <PublicLayout><Suspense fallback={null}><BlogArticlePage /></Suspense></PublicLayout>} />
      <Route path={PATHS.BLOG} component={() => <PublicLayout><Suspense fallback={null}><BlogPage /></Suspense></PublicLayout>} />

      <Route component={() => <Suspense fallback={null}><NotFound /></Suspense>} />
    </Switch>
  );
}

import { identifyUser, resetUser } from "@/lib/analytics";

function PostHogIdentify() {
  const { user, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded || !import.meta.env.VITE_POSTHOG_KEY) return;
    if (user) {
      identifyUser(user.id, { email: user.email, name: user.name });
    } else {
      resetUser();
    }
  }, [user, isLoaded]);

  return null;
}

/**
 * `ssr` is only passed by scripts/prerender-seo.ts (via entry-server.tsx) to
 * render the homepage to static HTML at build time; the browser bundle never
 * sets it, and main.tsx hydrates that markup.
 */
function App({ ssr }: { ssr?: { path: string; lang: Lang } } = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* The wouter Router sits above LanguageProvider because the provider
          reads useLocation() to sync the language with /fr URLs; under the
          build-time render (ssrPath) that must be the same router. */}
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")} ssrPath={ssr?.path}>
        <LanguageProvider initialLang={ssr?.lang}>
          <TooltipProvider>
            <PostHogIdentify />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
            <Suspense fallback={null}><Toaster /></Suspense>
            <RouteAnnouncer />
            <ScrollManager />
          </TooltipProvider>
        </LanguageProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
