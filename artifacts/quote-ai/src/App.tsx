import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
// Every other public page is lazy (Phase 68): the homepage is the entry's
// LCP-critical route and these pages — auth, onboarding, legal, contact,
// WhatsApp, sitemap — were ~55 kB of the bundle it had to load first.
const WhatsappPage = lazy(() => import("@/pages/whatsapp"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const PrivacyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const ChiSiamoPage = lazy(() => import("@/pages/chi-siamo"));
const ContattiPage = lazy(() => import("@/pages/contatti"));
const MappaSitoPage = lazy(() => import("@/pages/mappa-sito"));
const HelpIndexPage = lazy(() => import("@/pages/help/index"));
const HelpArticlePage = lazy(() => import("@/pages/help/[slug]"));

import { PATHS } from "@/data/sitemap-routes";

const DashboardHome = lazy(() => import("@/pages/dashboard/index"));
const NewQuote = lazy(() => import("@/pages/dashboard/new"));
const QuotesList = lazy(() => import("@/pages/dashboard/quotes/index"));
const QuoteDetail = lazy(() => import("@/pages/dashboard/quotes/[id]"));
const ProfileSettings = lazy(() => import("@/pages/dashboard/profile"));
const BillingPage = lazy(() => import("@/pages/dashboard/billing"));
const SettingsPage = lazy(() => import("@/pages/dashboard/settings"));
const CatalogPage = lazy(() => import("@/pages/dashboard/catalog"));
const AnalyticsPage = lazy(() => import("@/pages/dashboard/analytics"));
const AdminPage = lazy(() => import("@/pages/admin"));
const ClientsPage = lazy(() => import("@/pages/dashboard/clients/index"));
const LeadsListPage = lazy(() => import("@/pages/dashboard/leads/index"));
const ImportsPage = lazy(() => import("@/pages/dashboard/imports/index"));
const ClientDetailPage = lazy(() => import("@/pages/dashboard/clients/[name]"));
const InvoicesPage = lazy(() => import("@/pages/dashboard/invoices"));
const InvoiceDetailPage = lazy(() => import("@/pages/dashboard/invoices/[id]"));
const PublicInvoicePage = lazy(() => import("@/pages/i/[token]"));
const JobsListPage = lazy(() => import("@/pages/dashboard/jobs/index"));
const JobDetailPage = lazy(() => import("@/pages/dashboard/jobs/[id]"));
const JobSetupPage = lazy(() => import("@/pages/dashboard/jobs/setup"));
const TeamPage = lazy(() => import("@/pages/dashboard/team"));
const SchedulePage = lazy(() => import("@/pages/dashboard/schedule"));
const AssistantPage = lazy(() => import("@/pages/dashboard/assistant"));
const WorkerTimePage = lazy(() => import("@/pages/t/[token]"));
const TeamInvitePage = lazy(() => import("@/pages/team-invite/[token]"));
const DocumentsPage = lazy(() => import("@/pages/dashboard/documents"));
const ArchivePage = lazy(() => import("@/pages/dashboard/archive"));
const NotificationsPage = lazy(() => import("@/pages/dashboard/notifications"));
const PublicQuotePage = lazy(() => import("@/pages/p/[id]"));

const SeoLanding = lazy(() => import("@/pages/seo/[type]"));
const SeoCityLanding = lazy(() => import("@/pages/seo/city-landing"));
const BlogPage = lazy(() => import("@/pages/blog/index"));
const ContractsListPage = lazy(() => import("@/pages/dashboard/contracts/index"));
const ContractDetailPage = lazy(() => import("@/pages/dashboard/contracts/[id]"));
const SignPage = lazy(() => import("@/pages/sign/[token]"));
const PortalPage = lazy(() => import("@/pages/portal/[token]"));
const BlogArticlePage = lazy(() => import("@/pages/blog/[slug]"));
const BlogCategoryPage = lazy(() => import("@/pages/blog/categoria/[slug]"));

import { PublicLayout } from "@/components/layout/public-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { isOnboardingSkipped } from "@/lib/onboarding-state";

const queryClient = new QueryClient();

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
const DashboardLayoutLazy = lazy(() =>
  import("@/components/layout/dashboard-layout").then((m) => ({ default: m.DashboardLayout })),
);
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutLazy>{children}</DashboardLayoutLazy>
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public pages — paths from sitemap-routes.ts (shared with generate-sitemap.ts) */}
      <Route path={PATHS.HOME} component={() => <PublicLayout><Home /></PublicLayout>} />
      {/* French homepage — same component, detects lang from the /fr prefix */}
      <Route path="/fr" component={() => <PublicLayout><Home /></PublicLayout>} />
      <Route path={PATHS.WHATSAPP} component={() => <PublicLayout><Suspense fallback={null}><WhatsappPage /></Suspense></PublicLayout>} />
      <Route path={PATHS.CHI_SIAMO} component={() => <Suspense fallback={null}><ChiSiamoPage /></Suspense>} />
      <Route path={PATHS.CONTATTI} component={() => <Suspense fallback={null}><ContattiPage /></Suspense>} />
      <Route path={PATHS.PRIVACY} component={() => <Suspense fallback={null}><PrivacyPage /></Suspense>} />
      <Route path={PATHS.TERMS} component={() => <Suspense fallback={null}><TermsPage /></Suspense>} />
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

      {/* Dashboard (private, not indexed) */}
      <Route path="/dashboard" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><DashboardHome /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/new" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><NewQuote /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/quotes" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><QuotesList /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/quotes/:id" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><QuoteDetail /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/analytics" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><AnalyticsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/settings/account" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><SettingsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/settings" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><SettingsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/profile" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ProfileSettings /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/billing" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><BillingPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/catalog" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><CatalogPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/clients/:id" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ClientDetailPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/clients" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ClientsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/leads" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><LeadsListPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/imports" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ImportsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/contracts/:id" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ContractDetailPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/contracts" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ContractsListPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/invoices/:id" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><InvoiceDetailPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/invoices" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><InvoicesPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/jobs/:id/setup" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><JobSetupPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/jobs/:id" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><JobDetailPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/jobs" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><JobsListPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/assistant" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><AssistantPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/team" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><TeamPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/schedule" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><SchedulePage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      {/* The old CRM is retired (Phase 2): its working parts live in Jobs */}
      <Route path="/crm" component={() => <Redirect to="/dashboard/jobs" />} />
      <Route path="/crm/:rest*" component={() => <Redirect to="/dashboard/jobs" />} />
      <Route path="/dashboard/documents" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><DocumentsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/archive" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ArchivePage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/notifications" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><NotificationsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />

      {/* Public e-signature page: the customer signs the contract from the emailed link */}
      <Route path="/sign/:token" component={() => <Suspense fallback={null}><SignPage /></Suspense>} />
      <Route path="/portal/:token" component={() => <Suspense fallback={null}><PortalPage /></Suspense>} />
      {/* Public invoice page: the customer sees the balance + payment instructions from the emailed link */}
      <Route path="/i/:token" component={() => <Suspense fallback={null}><PublicInvoicePage /></Suspense>} />
      {/* Public worker time-entry page (magic link from the Team page) */}
      <Route path="/t/:token" component={() => <Suspense fallback={null}><WorkerTimePage /></Suspense>} />
      {/* Team member invite accept page (emailed link, Phase 7) */}
      <Route path="/team-invite/:token" component={() => <Suspense fallback={null}><TeamInvitePage /></Suspense>} />

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

      <Route path="/dashboard/admin" component={() => <DashSuspense><AdminPage /></DashSuspense>} />

      <Route component={NotFound} />
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
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
