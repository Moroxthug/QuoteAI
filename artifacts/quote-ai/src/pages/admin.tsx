import { useState, useEffect, Fragment } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Users, TrendingUp, FileText, DollarSign, ToggleLeft, ToggleRight,
  RefreshCw, ArrowLeft, Crown, Zap, BarChart3,
  ChevronUp, ChevronDown, Minus, Search, Settings, ShieldAlert,
  Sparkles, CheckCircle2, AlertTriangle, Activity,
  Globe, Award, HeartHandshake, Eye,
  MessageSquare, Bot, Send, Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Metrics = {
  totalUsers: number;
  usersThisMonth: number;
  activeSubscriptions: number;
  starterCount: number;
  proCount: number;
  mrr: number;
  totalQuotes: number;
  quotesThisMonth: number;
  quotesPrevMonth: number;
  totalQuoteRevenue: number;
};

type AdminUser = {
  userId: string;
  email: string;
  firstName: string;
  companyName: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
};

type Settings = Record<string, string>;
type Tab = "overview" | "users" | "widget" | "stripe" | "gsc" | "seo" | "settings" | "support" | "email-events" | "margin" | "incentives";

type IncentiveCatalogRow = {
  id: string;
  level: "federal" | "provincial" | "municipal" | "utility";
  codice: string;
  titolo: string;
  descrizione: string;
  province: string | null;
  city: string | null;
  categoriaIntervento: string;
  tipoAgevolazione: string;
  massimaleContributo: string | null;
  incomeTested: boolean;
  scadenza: string | null;
  stato: "active" | "expiring_soon" | "closed";
  fonteUfficialeUrl: string | null;
  isVerifiedByAi: boolean;
  humanVerified: boolean;
  lastCheckedAt: string | null;
};

const EMPTY_INCENTIVE_FORM = {
  level: "federal" as const,
  codice: "",
  titolo: "",
  descrizione: "",
  province: "",
  city: "",
  categoriaIntervento: "all",
  tipoAgevolazione: "rebate",
  massimaleContributo: "",
  incomeTested: false,
  fonteUfficialeUrl: "",
};

type MarginRow = {
  userId: string;
  companyName: string | null;
  plan: string | null;
  costCents: number;
  revenueCents: number;
  marginCents: number;
  byKind: Record<string, { costCents: number; quantity: number }>;
};

type EmailEvent = {
  id: string;
  type: string;
  emailId: string | null;
  to: string[] | null;
  from: string | null;
  subject: string | null;
  createdAt: string;
};

type GscSummary = {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
};

type GscKeyword = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type GscTrend = {
  day: string;
  clicks: number;
  impressions: number;
};

type SeoPageResult = {
  url: string;
  name: string;
  score: number;
  title: string;
  description: string;
  h1: string;
  issues: string[];
};

type SeoAuditResult = {
  overallScore: number;
  pages: SeoPageResult[];
  lastChecked: string;
};

function Trend({ current, prev }: { current: number; prev: number }) {
  const { t } = useLanguage();
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><ChevronUp className="h-3 w-3" />{pct}% {t("admin.vsLastMonth")}</span>;
  if (pct < 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500"><ChevronDown className="h-3 w-3" />{Math.abs(pct)}% {t("admin.vsLastMonth")}</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><Minus className="h-3 w-3" />{t("admin.stable")}</span>;
}

function PlanBadge({ plan, status }: { plan: string | null; status: string | null }) {
  const { t } = useLanguage();
  if (!plan || status !== "active") return <span className="text-xs text-gray-400 font-medium bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">{t("admin.noPlan")}</span>;
  const isPro = plan === "monthly_pro";
  const isElite = plan === "monthly_elite";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      isElite ? "bg-teal-50 text-teal-700 border border-teal-200" :
      isPro ? "bg-amber-50 text-amber-700 border border-amber-200" :
      "bg-navy-50 text-navy-700 border border-navy-200"
    }`}>
      {isPro || isElite ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
      {isElite ? "Elite" : isPro ? "Pro" : "Starter"}
    </span>
  );
}

function WidgetStatusBadge({ active }: { active: boolean }) {
  const { t } = useLanguage();
  return active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {t("admin.active")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      {t("admin.disabled")}
    </span>
  );
}

function QuoteSourceBadge({ source }: { source: string }) {
  const { t } = useLanguage();
  const style =
    source === "widget" ? "bg-teal-50 text-teal-700 border-teal-200" :
    source === "whatsapp" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    "bg-navy-50 text-navy-700 border-navy-200";
  const label = source === "widget" ? t("admin.widgetFunnel") : source === "whatsapp" ? "WhatsApp Bot" : t("admin.webApp");
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
      {label}
    </span>
  );
}

export default function AdminPage() {
  const { isLoaded, user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Stripe Management state
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [freePlanType, setFreePlanType] = useState("monthly_pro");
  const [freeDuration, setFreeDuration] = useState("30");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [grantingPlan, setGrantingPlan] = useState(false);

  // Search Console state
  const [gscSummary, setGscSummary] = useState<GscSummary | null>(null);
  const [gscKeywords, setGscKeywords] = useState<GscKeyword[]>([]);
  const [gscTrends, setGscTrends] = useState<GscTrend[]>([]);
  const [gscLoading, setGscLoading] = useState(false);

  // SEO Checker state
  const [seoResult, setSeoResult] = useState<SeoAuditResult | null>(null);
  const [seoScanning, setSeoScanning] = useState(false);

  // Users filter state
  const [userSearch, setUserSearch] = useState("");

  // Support live chat states
  const [adminOnline, setAdminOnline] = useState(false);
  const [supportConvs, setSupportConvs] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [adminReply, setAdminReply] = useState("");

  // Client monitoring / widget control state
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [clientQuotes, setClientQuotes] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);

  // Widget sub-tab e stati per le statistiche avanzate
  const [widgetSubTab, setWidgetSubTab] = useState<"keys" | "analytics">("keys");
  const [widgetStats, setWidgetStats] = useState<any>(null);
  const [widgetStatsLoading, setWidgetStatsLoading] = useState(false);

  // Stati del form per la creazione di un cliente non registrato
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientVat, setNewClientVat] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [marginRows, setMarginRows] = useState<MarginRow[]>([]);
  const [marginLoading, setMarginLoading] = useState(false);

  async function loadMargin() {
    setMarginLoading(true);
    try {
      const data = await authFetch("/api/admin/margin?days=30");
      setMarginRows((data as { rows: MarginRow[] }).rows ?? []);
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: "Failed to load margin data" });
    } finally {
      setMarginLoading(false);
    }
  }

  async function loadWidgetStats() {
    setWidgetStatsLoading(true);
    try {
      const data = await authFetch("/api/admin/widget/stats");
      setWidgetStats(data);
    } catch {
      toast({
        variant: "destructive",
        title: t("admin.error"),
        description: t("admin.errorLoadWidgetStats"),
      });
    } finally {
      setWidgetStatsLoading(false);
    }
  }

  // Stato e funzioni per lo storico eventi Resend (delivery/bounce/complaint)
  const [emailEvents, setEmailEvents] = useState<EmailEvent[]>([]);
  const [loadingEmailEvents, setLoadingEmailEvents] = useState(false);

  async function loadEmailEvents() {
    setLoadingEmailEvents(true);
    try {
      const res = await authFetch("/api/admin/email-events");
      if (res.success) setEmailEvents(res.events || []);
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorLoadEmailEvents") });
    } finally {
      setLoadingEmailEvents(false);
    }
  }

  useEffect(() => {
    if (tab === "email-events") loadEmailEvents();
  }, [tab]);

  // Incentives catalog (Phase 17)
  const [incentives, setIncentives] = useState<IncentiveCatalogRow[]>([]);
  const [loadingIncentives, setLoadingIncentives] = useState(false);
  const [incentiveForm, setIncentiveForm] = useState<Omit<typeof EMPTY_INCENTIVE_FORM, "level"> & { level: IncentiveCatalogRow["level"] }>(EMPTY_INCENTIVE_FORM);
  const [editingIncentiveId, setEditingIncentiveId] = useState<string | null>(null);
  const [showIncentiveForm, setShowIncentiveForm] = useState(false);
  const [savingIncentive, setSavingIncentive] = useState(false);

  async function loadIncentives() {
    setLoadingIncentives(true);
    try {
      const res = await authFetch("/api/admin/incentives");
      if (res.success) setIncentives(res.incentives || []);
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorLoadIncentivesCatalog") });
    } finally {
      setLoadingIncentives(false);
    }
  }

  useEffect(() => {
    if (tab === "incentives") loadIncentives();
  }, [tab]);

  function startEditIncentive(row: IncentiveCatalogRow) {
    setEditingIncentiveId(row.id);
    setIncentiveForm({
      level: row.level,
      codice: row.codice,
      titolo: row.titolo,
      descrizione: row.descrizione,
      province: row.province || "",
      city: row.city || "",
      categoriaIntervento: row.categoriaIntervento,
      tipoAgevolazione: row.tipoAgevolazione,
      massimaleContributo: row.massimaleContributo || "",
      incomeTested: row.incomeTested,
      fonteUfficialeUrl: row.fonteUfficialeUrl || "",
    });
    setShowIncentiveForm(true);
  }

  function resetIncentiveForm() {
    setEditingIncentiveId(null);
    setIncentiveForm(EMPTY_INCENTIVE_FORM);
    setShowIncentiveForm(false);
  }

  async function saveIncentive(e: React.FormEvent) {
    e.preventDefault();
    setSavingIncentive(true);
    try {
      const payload = {
        ...incentiveForm,
        province: incentiveForm.province.trim() || null,
        city: incentiveForm.city.trim() || null,
        fonteUfficialeUrl: incentiveForm.fonteUfficialeUrl.trim() || null,
        massimaleContributo: incentiveForm.massimaleContributo.trim() || null,
      };
      const res = editingIncentiveId
        ? await authFetch(`/api/admin/incentives/${editingIncentiveId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await authFetch("/api/admin/incentives", { method: "POST", body: JSON.stringify(payload) });
      if (res.success) {
        resetIncentiveForm();
        loadIncentives();
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: t("admin.error"), description: err.message || t("admin.errorLoadIncentivesCatalog") });
    } finally {
      setSavingIncentive(false);
    }
  }

  async function toggleHumanVerified(row: IncentiveCatalogRow) {
    try {
      await authFetch(`/api/admin/incentives/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ humanVerified: !row.humanVerified }),
      });
      loadIncentives();
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorLoadIncentivesCatalog") });
    }
  }

  async function deleteIncentive(id: string) {
    if (!window.confirm("Delete this incentive program?")) return;
    try {
      await authFetch(`/api/admin/incentives/${id}`, { method: "DELETE" });
      loadIncentives();
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorLoadIncentivesCatalog") });
    }
  }

  async function handleCreateUnregisteredClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorCompanyNameRequired") });
      return;
    }
    setCreatingClient(true);
    try {
      const res = await authFetch("/api/admin/widget/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: newClientName,
          email: newClientEmail,
          phone: newClientPhone,
          address: newClientAddress,
          vatNumber: newClientVat,
        }),
      });
      if (res.success) {
        toast({ title: t("admin.clientCreated"), description: t("admin.clientCreatedDesc").replace("{name}", newClientName) });
        setNewClientName("");
        setNewClientEmail("");
        setNewClientPhone("");
        setNewClientAddress("");
        setNewClientVat("");
        loadUsers(); // Reload the users grid
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: t("admin.error"), description: err.message || t("admin.errorCreateClient") });
    } finally {
      setCreatingClient(false);
    }
  }

  useEffect(() => {
    if (tab === "widget" && widgetSubTab === "analytics") {
      loadWidgetStats();
    }
    if (tab === "margin") {
      loadMargin();
    }
    // Avoid a row expanded in "Users" staying open (with the wrong
    // content) when switching to "Clients & Widget", since they share
    // the same expandedUserId.
    setExpandedUserId(null);
  }, [tab, widgetSubTab]);

  async function loadSupportStatus() {
    try {
      const res = await authFetch("/api/support/admin-status");
      setAdminOnline(res.online);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSupportConvs() {
    try {
      const list = await authFetch("/api/support/conversations");
      setSupportConvs(list);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleAdminOnline() {
    try {
      const newStatus = !adminOnline;
      await authFetch("/api/support/admin-status", {
        method: "POST",
        body: JSON.stringify({ online: newStatus }),
      });
      setAdminOnline(newStatus);
      toast({ title: t("admin.operatorStatusUpdated"), description: (newStatus ? t("admin.nowOnlineForSupport") : t("admin.nowOfflineForSupport")) });
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorUpdateStatus") });
    }
  }

  // Poll conversations when tab === "support"
  useEffect(() => {
    if (tab !== "support") return;
    loadSupportStatus();
    loadSupportConvs();

    const interval = setInterval(() => {
      loadSupportConvs();
    }, 4000);

    return () => clearInterval(interval);
  }, [tab]);

  // Poll messages for active conversation
  useEffect(() => {
    if (tab !== "support" || !selectedConvId) return;

    const fetchMsgs = async () => {
      try {
        const msgs = await authFetch(`/api/support/conversations/${selectedConvId}/messages`);
        setConvMessages(msgs);
      } catch (e) {
        console.error(e);
      }
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 3000);
    return () => clearInterval(interval);
  }, [tab, selectedConvId]);

  async function authFetch(path: string, options?: RequestInit) {
    const r = await fetch(`${BASE}${path}`, {
      ...options,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      credentials: "include",
    });
    if (r.type === "opaqueredirect" || r.status === 302 || r.status === 403) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `${r.status}`);
    }
    return r.json() as Promise<any>;
  }

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        authFetch("/api/admin/metrics"),
        authFetch("/api/admin/settings"),
      ]);
      setMetrics(m as Metrics);
      setSettings(s as Settings);
    } catch (e: any) {
      if (e.status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    loadBaseData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  async function loadUsers() {
    setLoading(true);
    try {
      const u = await authFetch("/api/admin/users");
      setUsers(u as AdminUser[]);
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorLoadUsers") });
    } finally {
      setLoading(false);
    }
  }

  async function loadClientQuotes(targetUserId: string) {
    setLoadingQuotes(true);
    try {
      const data = await authFetch(`/api/admin/users/${targetUserId}/quotes`);
      setClientQuotes(data);
    } catch {
      toast({
        variant: "destructive",
        title: t("admin.error"),
        description: t("admin.errorLoadClientQuotes"),
      });
    } finally {
      setLoadingQuotes(false);
    }
  }

  const handleToggleExpandClient = (targetUserId: string) => {
    if (expandedUserId === targetUserId) {
      setExpandedUserId(null);
      setClientQuotes([]);
    } else {
      setExpandedUserId(targetUserId);
      setClientQuotes([]);
      loadClientQuotes(targetUserId);
    }
  };

  async function rotateApiKey(targetUserId: string, customKey?: string) {
    setRotatingKeyId(targetUserId);
    try {
      const res = await authFetch(`/api/admin/users/${targetUserId}/apikey`, {
        method: "POST",
        body: JSON.stringify({ apiKey: customKey }),
      });
      if (res.success) {
        toast({ title: t("admin.apiKeyUpdated"), description: t("admin.apiKeyUpdatedDesc") });
        loadUsers();
      }
    } catch {
      toast({
        variant: "destructive",
        title: t("admin.error"),
        description: t("admin.errorUpdateApiKey"),
      });
    } finally {
      setRotatingKeyId(null);
    }
  }

  async function loadGSC() {
    setGscLoading(true);
    try {
      const res = await authFetch("/api/admin/search-console");
      setGscSummary(res.summary);
      setGscKeywords(res.keywords);
      setGscTrends(res.trends);
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorLoadSearchConsole") });
    } finally {
      setGscLoading(false);
    }
  }

  async function runSeoScan() {
    setSeoScanning(true);
    // Simulate real scanning delay for visual premium feel
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const res = await authFetch("/api/admin/seo-audit");
      setSeoResult(res);
      toast({ title: t("admin.scanComplete"), description: t("admin.scanCompleteDesc") });
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorSeoAudit") });
    } finally {
      setSeoScanning(false);
    }
  }

  useEffect(() => {
    if (tab === "users" || tab === "widget") {
      loadUsers();
    } else if (tab === "gsc") {
      loadGSC();
    } else if (tab === "seo" && !seoResult) {
      runSeoScan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function toggleSetting(key: string, currentValue: string) {
    const newValue = currentValue === "false" ? "true" : "false";
    setSavingKey(key);
    try {
      await authFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key, value: newValue }),
      });
      setSettings(prev => ({ ...prev, [key]: newValue }));
      toast({ title: t("admin.settingSaved"), description: t("admin.settingSavedDesc").replace("{key}", key) });
    } catch {
      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorSaveSetting") });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleGrantPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserEmail) return;
    setGrantingPlan(true);
    try {
      await authFetch("/api/admin/grant-plan", {
        method: "POST",
        body: JSON.stringify({
          email: selectedUserEmail,
          plan: freePlanType,
          days: Number(freeDuration),
        }),
      });
      toast({ title: t("admin.planGrantedSuccess"), description: t("admin.planGrantedDesc").replace("{plan}", freePlanType).replace("{days}", freeDuration).replace("{email}", selectedUserEmail) });
      setSelectedUserEmail("");
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: t("admin.error"), description: err.message || t("admin.errorGrantPlan") });
    } finally {
      setGrantingPlan(false);
    }
  }

  async function handleSyncStripe(email: string) {
    try {
      await authFetch("/api/admin/sync-subscription", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast({ title: t("admin.syncComplete"), description: t("admin.syncCompleteDesc").replace("{email}", email) });
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: t("admin.syncError"), description: err.message || t("admin.errorVerifyStripeUser") });
    }
  }

  async function handleLinkCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserEmail || !stripeCustomerId) return;
    try {
      await authFetch("/api/admin/sync-by-customer", {
        method: "POST",
        body: JSON.stringify({
          stripeCustomerId,
          userEmail: selectedUserEmail,
        }),
      });
      toast({ title: t("admin.stripeCustomerLinked"), description: t("admin.stripeCustomerLinkedDesc").replace("{customerId}", stripeCustomerId).replace("{email}", selectedUserEmail) });
      setStripeCustomerId("");
      setSelectedUserEmail("");
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: t("admin.error"), description: err.message || t("admin.errorLinkCustomerId") });
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/40">
        <div className="h-9 w-9 rounded-full border-[3px] border-navy-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/40 px-4">
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-xl max-w-md w-full text-center">
          <div className="h-14 w-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{t("admin.accessRestricted")}</h1>
          <p className="text-slate-500 text-sm mb-6">{t("admin.accessRestrictedDesc")}</p>
          <Link href="/" className="btn-gradient inline-flex items-center justify-center h-10 px-6 font-semibold w-full">
            {t("admin.backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  const registrationOpen = (settings["registration_open"] ?? "true") !== "false";
  const fmt = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);

  // Filter users based on search
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.firstName || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.companyName || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      {/* Top Glassmorphic Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-100/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-navy-600 animate-pulse" />
              <h1 className="text-base font-bold text-slate-900">{t("admin.consoleTitle")}</h1>
            </div>
            <p className="text-xs text-slate-400">{t("admin.globalControlPanelFor")} {user?.name || user?.email}</p>
          </div>
        </div>

        <button
          onClick={loadBaseData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 bg-white shadow-sm text-xs text-slate-500 hover:text-slate-800 transition-all font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("admin.refreshData")}
        </button>
      </header>

      {/* Main Page Layout */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        
        {/* Navigation Sidebar/List */}
        <aside className="w-full md:w-60 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 p-2 shadow-sm space-y-1">
            {[
              { id: "overview", label: t("admin.tabOverview"), icon: BarChart3 },
              { id: "users", label: t("admin.tabUsers"), icon: Users },
              { id: "widget", label: t("admin.tabWidget"), icon: Zap },
              { id: "margin", label: "Cost & Margin", icon: TrendingUp },
              { id: "incentives", label: t("admin.tabIncentives"), icon: Award },
              { id: "stripe", label: t("admin.tabStripe"), icon: DollarSign },
              { id: "gsc", label: "Search Console", icon: Globe },
              { id: "seo", label: "SEO Checker", icon: Sparkles },
              { id: "support", label: t("admin.tabSupport"), icon: MessageSquare },
              { id: "email-events", label: t("admin.tabEmailEvents"), icon: Mail },
              { id: "settings", label: t("admin.tabSettings"), icon: Settings },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === item.id
                    ? "bg-navy-50 text-navy-700 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <item.icon className={`h-4 w-4 ${tab === item.id ? "text-navy-600" : "text-slate-400"}`} />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Container */}
        <main className="flex-1 min-w-0">

          {/* OVERVIEW TAB */}
          {tab === "overview" && metrics && (
            <div className="space-y-6">
              {/* Premium Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: t("admin.totalUsers"), value: String(metrics.totalUsers), sub: `+${metrics.usersThisMonth} ${t("admin.thisMonth")}`, icon: Users, color: "text-navy-500", bg: "bg-navy-50" },
                  { label: t("admin.estimatedMrr"), value: fmt(metrics.mrr), sub: `${metrics.starterCount} Starter · ${metrics.proCount} Pro`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
                  { label: t("admin.totalQuotes"), value: String(metrics.totalQuotes), sub: `${metrics.quotesThisMonth} ${t("admin.thisMonth")}`, trend: true, icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
                  { label: t("admin.revenueGenerated"), value: fmt(metrics.totalQuoteRevenue), sub: t("admin.totalUnlockedQuoteValue"), icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50" },
                ].map(({ label, value, sub, trend, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                      <div className={`h-7 w-7 rounded-lg ${bg} flex items-center justify-center`}><Icon className={`h-4 w-4 ${color}`} /></div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{value}</div>
                    <div className="mt-1">
                      {trend ? <Trend current={metrics.quotesThisMonth} prev={metrics.quotesPrevMonth} /> : <span className="text-xs text-slate-400 font-medium">{sub}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Analytics Graph Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Subscriptions Details */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-navy-500" /> {t("admin.subscriptionStatus")}
                  </h2>
                  <div className="space-y-3">
                    <div className="p-3 bg-navy-50/50 border border-navy-100/50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-navy-600" />
                        <div>
                          <div className="text-xs font-bold text-navy-800">{t("admin.starterPlan")}</div>
                          <div className="text-[10px] text-navy-500">$19{t("admin.perMonthShort")}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-navy-900">{metrics.starterCount}</div>
                        <div className="text-[10px] text-navy-500">{fmt(metrics.starterCount * 19)} MRR</div>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-600" />
                        <div>
                          <div className="text-xs font-bold text-amber-800">{t("admin.proPlan")}</div>
                          <div className="text-[10px] text-amber-500">$49{t("admin.perMonthShort")}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-900">{metrics.proCount}</div>
                        <div className="text-[10px] text-amber-500">{fmt(metrics.proCount * 49)} MRR</div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500" />
                        <div>
                          <div className="text-xs font-bold text-slate-700">{t("admin.freemiumUsers")}</div>
                          <div className="text-[10px] text-slate-400">{t("admin.freeBasePlan")}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-800">{metrics.totalUsers - metrics.activeSubscriptions}</div>
                        <div className="text-[10px] text-slate-400">{t("admin.withoutActiveSubscription")}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Chart representation */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm lg:col-span-2 space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" /> {t("admin.quotesUsersGrowth")}
                  </h2>
                  <div className="h-48 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={[
                          { day: "Jun 1", preventivi: 12, utenti: 5 },
                          { day: "Jun 5", preventivi: 18, utenti: 8 },
                          { day: "Jun 10", preventivi: 15, utenti: 11 },
                          { day: "Jun 15", preventivi: 29, utenti: 15 },
                          { day: "Jun 20", preventivi: 38, utenti: 22 },
                          { day: "Jun 25", preventivi: 45, utenti: 30 },
                          { day: "Jun 30", preventivi: metrics.quotesThisMonth || 52, utenti: metrics.totalUsers || 35 },
                        ]}
                      >
                        <defs>
                          <linearGradient id="colorQuotes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="day" stroke="#94A3B8" />
                        <YAxis stroke="#94A3B8" />
                        <ChartTooltip />
                        <Area type="monotone" dataKey="preventivi" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#colorQuotes)" name={t("admin.quotes")} />
                        <Area type="monotone" dataKey="utenti" stroke="#0EA5E9" strokeWidth={2} fillOpacity={0} name={t("admin.registeredUsers")} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* USERS TAB */}
          {tab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">{t("admin.registeredUsersList")}</h2>
                  <p className="text-xs text-slate-400">{t("admin.registeredUsersListDesc")}</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("admin.searchByEmailNameCompany")}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.user")}</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.company")}</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.currentPlan")}</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.quotesApiCost")}</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.signupDate")}</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">{t("admin.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map(u => {
                        const isExpanded = expandedUserId === u.userId;
                        return (
                          <Fragment key={u.userId}>
                            <tr className={`hover:bg-slate-50/40 transition-colors ${isExpanded ? "bg-slate-50/20" : ""}`}>
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-800">{u.firstName || t("admin.noName")}</div>
                                <div className="text-xs text-slate-400">{u.email || u.userId.slice(0, 16)}</div>
                              </td>
                              <td className="px-5 py-4 text-slate-600 font-medium">{u.companyName || "—"}</td>
                              <td className="px-5 py-4"><PlanBadge plan={u.subscriptionPlan} status={u.subscriptionStatus} /></td>
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-700">{(u as any).quoteCount ?? 0} {t("admin.quotesAbbrev")}</div>
                                <div className="text-xs text-emerald-600 font-bold">{Number((u as any).totalCost ?? 0).toFixed(4)} $</div>
                              </td>
                              <td className="px-5 py-4 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" })}</td>
                              <td className="px-5 py-4 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => handleToggleExpandClient(u.userId)}
                                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isExpanded ? "text-navy-700 bg-navy-50" : "text-slate-600 hover:text-navy-700 hover:bg-navy-50"
                                    }`}
                                  >
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    {t("admin.quotes")}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedUserEmail(u.email);
                                      setTab("stripe");
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-navy-700 hover:bg-navy-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Crown className="h-3.5 w-3.5" />
                                    {t("admin.plan")}
                                  </button>
                                  <button
                                    onClick={() => handleSyncStripe(u.email)}
                                    title={t("admin.syncStatusFromStripe")}
                                    className="inline-flex items-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="bg-slate-50/40 p-6 border-b border-slate-100">
                                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 text-left">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h3 className="text-sm font-bold text-slate-800">
                                          {t("admin.generatedQuotesHistory")} — {u.companyName || u.firstName || t("admin.client")}
                                        </h3>
                                        <p className="text-xs text-slate-400">{t("admin.generatedQuotesHistoryDesc")}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                          {t("admin.totalApiCost")}: <span className="text-emerald-600 font-mono">{Number((u as any).totalCost ?? 0).toFixed(4)} $</span>
                                        </span>
                                      </div>
                                    </div>

                                    {loadingQuotes ? (
                                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                        <RefreshCw className="h-6 w-6 animate-spin text-navy-500" />
                                        <span className="text-xs">{t("admin.loadingQuotes")}</span>
                                      </div>
                                    ) : clientQuotes.length === 0 ? (
                                      <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 border border-dashed border-slate-100 rounded-xl">
                                        {t("admin.noQuotesGeneratedByUser")}
                                      </div>
                                    ) : (
                                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                              <th className="px-4 py-3 font-bold text-slate-500">{t("admin.quoteClient")}</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">{t("admin.generationDate")}</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">{t("admin.channelSource")}</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">{t("admin.modelAndTokens")}</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">{t("admin.totalAmount")}</th>
                                              <th className="px-4 py-3 font-bold text-slate-500 text-right">{t("admin.apiCost")}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-50">
                                            {clientQuotes.map(q => (
                                              <tr key={q.id} className="hover:bg-slate-50/20">
                                                <td className="px-4 py-3">
                                                  <div className="font-semibold text-slate-800" title={q.numeroPreventivoData}>
                                                    {q.numeroPreventivoData || t("admin.unnumberedQuote")}
                                                  </div>
                                                  <div className="text-[10px] text-slate-400">
                                                    {q.clientData?.nome || t("admin.anonymousLead")}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                  {new Date(q.createdAt).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </td>
                                                <td className="px-4 py-3">
                                                  <QuoteSourceBadge source={q.source} />
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                  {q.modelUsed ? (
                                                    <div>
                                                      <div className="font-mono text-[10px] text-slate-700 font-medium">{q.modelUsed}</div>
                                                      <div className="text-[9px] text-slate-400">Tokens: {q.promptTokens} in / {q.completionTokens} out</div>
                                                    </div>
                                                  ) : (
                                                    <span className="text-slate-400">—</span>
                                                  )}
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-slate-700">
                                                  {Number(q.totale || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" })}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-600">
                                                  {q.apiCost ? `${Number(q.apiCost).toFixed(4)} $` : "0.0000 $"}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* WIDGET TAB */}
          {tab === "widget" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">{t("admin.widgetIntegrationTitle")}</h2>
                  <p className="text-xs text-slate-400">{t("admin.widgetIntegrationDesc")}</p>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-center">
                  <button
                    onClick={() => setWidgetSubTab("keys")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      widgetSubTab === "keys" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {t("admin.keysAndClientsMgmt")}
                  </button>
                  <button
                    onClick={() => setWidgetSubTab("analytics")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      widgetSubTab === "analytics" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {t("admin.aiAnalyticsMonitoring")}
                  </button>
                </div>
              </div>

              {widgetSubTab === "keys" ? (
                <div className="space-y-6">
                  {/* Form per la creazione di un cliente virtuale / non registrato */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-navy-500" />
                      {t("admin.registerNewBusiness")}
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">{t("admin.registerNewBusinessDesc")}</p>
                    <form onSubmit={handleCreateUnregisteredClient} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("admin.businessCompanyName")} *</label>
                        <input
                          type="text"
                          required
                          placeholder={t("admin.businessNamePlaceholder")}
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("admin.businessEmail")}</label>
                        <input
                          type="email"
                          placeholder="e.g. info@smithbuilders.ca"
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("admin.phone")}</label>
                        <input
                          type="text"
                          placeholder="e.g. 4161234567"
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("admin.address")}</label>
                        <input
                          type="text"
                          placeholder="e.g. 15 Main St, Toronto"
                          value={newClientAddress}
                          onChange={(e) => setNewClientAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("admin.gstHstNumber")}</label>
                        <input
                          type="text"
                          placeholder="e.g. 123456789RT0001"
                          value={newClientVat}
                          onChange={(e) => setNewClientVat(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={creatingClient}
                          className="w-full bg-navy-600 hover:bg-navy-700 disabled:bg-navy-300 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer h-[38px]"
                        >
                          {creatingClient ? t("admin.generating") : t("admin.generateKeyAndProfile")}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Search and key table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">{t("admin.activeBusinessesIntegrations")}</h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder={t("admin.filterBusinesses")}
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="w-full sm:w-64 pl-9 pr-4 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.clientId")}</th>
                              <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.company")}</th>
                              <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.widgetApiKey")}</th>
                              <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">{t("admin.widgetStatus")}</th>
                              <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">{t("admin.integration")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {filteredUsers.map(u => {
                              const isExpanded = expandedUserId === u.userId;
                              return (
                                <Fragment key={u.userId}>
                                  <tr className={`hover:bg-slate-50/40 transition-colors ${isExpanded ? "bg-slate-50/20" : ""}`}>
                                    <td className="px-5 py-4">
                                      <div className="font-semibold text-slate-800">{u.firstName || t("admin.noName")}</div>
                                      <div className="text-xs text-slate-400">{u.email || u.userId.slice(0, 16)}</div>
                                    </td>
                                    <td className="px-5 py-4 text-slate-600 font-medium">{u.companyName || "—"}</td>
                                    <td className="px-5 py-4">
                                      {(u as any).apiKey ? (
                                        <span className="font-mono text-xs bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-slate-600">
                                          {(u as any).apiKey.slice(0, 15)}...
                                        </span>
                                      ) : (
                                        <span className="text-red-500 text-xs font-medium bg-red-50 px-2 py-0.5 rounded border border-red-100">{t("admin.noKey")}</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-4">
                                      <WidgetStatusBadge active={Boolean((u as any).apiKey)} />
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                      <button
                                        onClick={() => handleToggleExpandClient(u.userId)}
                                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                                          isExpanded ? "text-navy-700 bg-navy-50" : "text-slate-600 hover:text-navy-700 hover:bg-navy-50"
                                        }`}
                                      >
                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                        {isExpanded ? t("admin.close") : t("admin.configure")}
                                      </button>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={5} className="bg-slate-50/40 p-6 border-b border-slate-100">
                                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm text-left space-y-5">
                                          <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-navy-50 text-navy-600 flex items-center justify-center shrink-0">
                                              <Zap className="h-5 w-5" />
                                            </div>
                                            <div>
                                              <h3 className="text-sm font-bold text-slate-800">
                                                {t("admin.leadFunnelConfig")} — {u.companyName || u.firstName || t("admin.client")}
                                              </h3>
                                              <p className="text-xs text-slate-400">{t("admin.leadFunnelConfigDesc")}</p>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                            <div className="md:col-span-1 space-y-4">
                                              <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">{t("admin.activeApiKey")}</label>
                                                <input
                                                  type="text"
                                                  readOnly
                                                  value={(u as any).apiKey || t("admin.noKeyConfigured")}
                                                  className="font-mono text-xs bg-slate-50 text-slate-700 px-3 py-2 border border-slate-100 rounded-xl w-full focus:outline-none text-center"
                                                />
                                              </div>
                                              <button
                                                onClick={() => rotateApiKey(u.userId)}
                                                disabled={rotatingKeyId === u.userId}
                                                className="w-full bg-navy-600 hover:bg-navy-700 disabled:bg-navy-300 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                              >
                                                {rotatingKeyId === u.userId ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                                {(u as any).apiKey ? t("admin.regenerateApiKey") : t("admin.generateApiKey")}
                                              </button>
                                            </div>

                                            <div className="md:col-span-2 space-y-2">
                                              <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">{t("admin.embedScriptCode")}</label>
                                              {(u as any).apiKey ? (
                                                <div className="relative">
                                                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto font-mono text-[10px] leading-relaxed max-h-40 whitespace-pre-wrap select-all border border-slate-800">
{`<!-- QuoteAI Widget Funnel -->
<div id="quoteai-widget">
  <a href="https://quoteai.ca" rel="noopener">Get your quote with QuoteAI</a>
</div>
<script
  src="${typeof window !== "undefined" ? window.location.origin : "https://quoteai.ca"}/widget.js"
  data-api-key="${(u as any).apiKey}"
  async
></script>`}
                                                  </pre>
                                                  <button
                                                    onClick={() => {
                                                      const code = `<!-- QuoteAI Widget Funnel -->\n<div id="quoteai-widget">\n  <a href="https://quoteai.ca" rel="noopener">Get your quote with QuoteAI</a>\n</div>\n<script\n  src="${typeof window !== "undefined" ? window.location.origin : "https://quoteai.ca"}/widget.js"\n  data-api-key="${(u as any).apiKey}"\n  async\n></script>`;
                                                      navigator.clipboard.writeText(code);
                                                      toast({ title: t("admin.codeCopied"), description: t("admin.codeCopiedDesc") });
                                                    }}
                                                    className="absolute right-3 top-3 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-slate-700 transition-all cursor-pointer shadow-sm"
                                                  >
                                                    {t("admin.copyCode")}
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-xs text-slate-400">
                                                  {t("admin.generateApiKeyToSeeEmbed")}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Global metrics */}
                  {widgetStatsLoading || !widgetStats ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-6 w-6 text-navy-500 animate-spin" />
                      <span className="ml-2 text-sm text-slate-500">{t("admin.loadingStats")}</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { label: t("admin.widgetQuotesGenerated"), value: String(widgetStats.global.totalQuotes), desc: t("admin.totalWidgetRequests"), icon: FileText, color: "text-navy-500", bg: "bg-navy-50" },
                          { label: t("admin.totalAiCost"), value: `$${Number(widgetStats.global.totalCost).toFixed(4)}`, desc: t("admin.estimatedTokenCost"), icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
                          { label: t("admin.totalTokens"), value: widgetStats.global.totalTokens.toLocaleString("en-CA"), desc: `${t("admin.promptPlusCompletion")}: ${widgetStats.global.totalQuotes > 0 ? Math.round(widgetStats.global.totalTokens / widgetStats.global.totalQuotes) : 0} / ${t("admin.call")}`, icon: Bot, color: "text-blue-500", bg: "bg-blue-50" },
                        ].map(({ label, value, desc, icon: Icon, color, bg }) => (
                          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                              <div className={`h-7 w-7 rounded-lg ${bg} flex items-center justify-center`}><Icon className={`h-4 w-4 ${color}`} /></div>
                            </div>
                            <div className="text-2xl font-bold text-slate-800">{value}</div>
                            <div className="text-xs text-slate-400 font-medium mt-1">{desc}</div>
                          </div>
                        ))}
                      </div>

                      {/* Detailed usage per business */}
                      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">{t("admin.aiUsagePerBusiness")}</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase">{t("admin.business")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase">{t("admin.apiKey")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase text-center">{t("admin.widgetRequests")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase text-right">{t("admin.totalTokensShort")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase text-right">{t("admin.aiCost")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {widgetStats.clientUsage.map((c: any) => (
                                <tr key={c.userId} className="hover:bg-slate-50/20">
                                  <td className="px-5 py-3.5 font-semibold text-slate-800">{c.companyName || t("admin.noNameVirtual")}</td>
                                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{c.apiKey ? `${c.apiKey.slice(0, 15)}...` : t("admin.none")}</td>
                                  <td className="px-5 py-3.5 text-center text-slate-700 font-medium">{c.quotesCount}</td>
                                  <td className="px-5 py-3.5 text-right text-slate-500">{c.totalTokens.toLocaleString("en-CA")}</td>
                                  <td className="px-5 py-3.5 text-right text-emerald-600 font-semibold">${c.totalCost.toFixed(5)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Latest API calls (debug log) */}
                      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">{t("admin.recentAiCallsLog")}</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase">{t("admin.date")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase">{t("admin.hostBusiness")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase">Lead</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase text-center">{t("admin.aiModel")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase text-right">{t("admin.tokens")}</th>
                                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase text-right">{t("admin.aiCost")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {widgetStats.recentCalls.map((call: any) => (
                                <tr key={call.quoteId} className="hover:bg-slate-50/20 text-xs">
                                  <td className="px-5 py-3 text-slate-500">{new Date(call.date).toLocaleString("en-CA")}</td>
                                  <td className="px-5 py-3 font-semibold text-slate-800">{call.companyName || t("admin.virtual")}</td>
                                  <td className="px-5 py-3">
                                    <div className="font-semibold text-slate-800">{call.clientName}</div>
                                    <div className="text-[10px] text-slate-400">{call.clientEmail}</div>
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <span className="bg-navy-50 text-navy-700 px-2 py-0.5 rounded border border-navy-100 font-medium">
                                      Llama 3.3 (Groq)
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-right text-slate-500">{(call.totalTokens || 0).toLocaleString("en-CA")}</td>
                                  <td className="px-5 py-3 text-right text-emerald-600 font-semibold">${Number(call.apiCost || 0).toFixed(5)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* COST & MARGIN TAB (Phase 8 §4a) — cost vs. subscription revenue per org,
              rolled up nightly from usage_events into usage_daily_summary, so
              accounts running at a loss surface before it's a pattern. */}
          {tab === "margin" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Cost & Margin (last 30 days)</h2>
                <p className="text-xs text-slate-400">AI (receipt vision + quote text) and WhatsApp cost vs. estimated subscription revenue, per account. Sorted by lowest margin first.</p>
              </div>
              {marginLoading ? (
                <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>
              ) : marginRows.length === 0 ? (
                <div className="text-sm text-slate-400 py-8 text-center">No metered usage recorded in this window yet.</div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Company</th>
                        <th className="px-4 py-3 text-left">Plan</th>
                        <th className="px-4 py-3 text-right">Cost</th>
                        <th className="px-4 py-3 text-right">Revenue (est.)</th>
                        <th className="px-4 py-3 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {marginRows.map((row) => (
                        <tr key={row.userId} className={row.marginCents < 0 ? "bg-red-50/50" : ""}>
                          <td className="px-4 py-3 font-medium text-slate-700">{row.companyName || row.userId.slice(0, 8)}</td>
                          <td className="px-4 py-3 text-slate-500">{row.plan ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-mono">${(row.costCents / 100).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono">${(row.revenueCents / 100).toFixed(2)}</td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${row.marginCents < 0 ? "text-red-600" : "text-emerald-600"}`}>
                            ${(row.marginCents / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* STRIPE MANAGEMENT TAB */}
          {tab === "stripe" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-800">{t("admin.subscriptionConnectionMgmt")}</h2>
                <p className="text-xs text-slate-400">{t("admin.subscriptionConnectionMgmtDesc")}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Free plan grantor form */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-pink-500" /> {t("admin.grantFreePeriod")}
                  </h3>
                  <form onSubmit={handleGrantPlan} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">{t("admin.userEmail")}</label>
                      <input
                        type="email"
                        required
                        placeholder="user@example.com"
                        value={selectedUserEmail}
                        onChange={(e) => setSelectedUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">{t("admin.planToGrant")}</label>
                      <select
                        value={freePlanType}
                        onChange={(e) => setFreePlanType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                      >
                        <option value="monthly_starter">{t("admin.planStarterDesc")}</option>
                        <option value="monthly_pro">{t("admin.planProDesc")}</option>
                        <option value="monthly_elite">{t("admin.planEliteDesc")}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">{t("admin.freeDays")}</label>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {[
                          { label: t("admin.days7"), val: "7" },
                          { label: t("admin.month1"), val: "30" },
                          { label: t("admin.months3"), val: "90" },
                          { label: t("admin.year1"), val: "365" },
                        ].map(opt => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setFreeDuration(opt.val)}
                            className={`py-1.5 border rounded-lg text-xs font-medium transition-all ${
                              freeDuration === opt.val
                                ? "border-navy-500 bg-navy-50 text-navy-700"
                                : "border-slate-100 hover:bg-slate-50 text-slate-500"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        required
                        min="1"
                        max="1000"
                        value={freeDuration}
                        onChange={(e) => setFreeDuration(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={grantingPlan}
                      className="w-full btn-gradient h-10 font-semibold text-sm transition-all"
                    >
                      {grantingPlan ? t("admin.grantingInProgress") : t("admin.grantFreePlan")}
                    </button>
                  </form>
                </div>

                {/* Force-link Stripe Customer Form */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" /> {t("admin.linkStripeCustomerId")}
                  </h3>
                  <form onSubmit={handleLinkCustomer} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">{t("admin.quoteAiUserEmail")}</label>
                      <input
                        type="email"
                        required
                        placeholder="user@example.com"
                        value={selectedUserEmail}
                        onChange={(e) => setSelectedUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Stripe Customer ID (`cus_...`)</label>
                      <input
                        type="text"
                        required
                        placeholder="cus_RzT83..."
                        value={stripeCustomerId}
                        onChange={(e) => setStripeCustomerId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-navy-500 bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 h-10 font-bold rounded-xl text-sm transition-all"
                    >
                      {t("admin.linkStripeCustomer")}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* GOOGLE SEARCH CONSOLE TAB */}
          {tab === "gsc" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-800">{t("admin.gscConnectionTitle")}</h2>
                <p className="text-xs text-slate-400">{t("admin.gscConnectionDesc")}</p>
              </div>

              {gscLoading && (
                <div className="h-48 flex items-center justify-center bg-white rounded-2xl border border-slate-100">
                  <div className="h-7 w-7 rounded-full border-2 border-navy-500 border-t-transparent animate-spin" />
                </div>
              )}

              {!gscLoading && gscSummary && (
                <>
                  {/* Summary grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: t("admin.totalClicks"), value: gscSummary.totalClicks, icon: Eye, color: "text-navy-500", bg: "bg-navy-50" },
                      { label: t("admin.totalImpressions"), value: gscSummary.totalImpressions, icon: Globe, color: "text-blue-500", bg: "bg-blue-50" },
                      { label: t("admin.averageCtr"), value: `${(gscSummary.averageCtr * 100).toFixed(1)}%`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50" },
                      { label: t("admin.averagePosition"), value: gscSummary.averagePosition, icon: Award, color: "text-amber-500", bg: "bg-amber-50" },
                    ].map(({ label, value, icon: Icon, color, bg }) => (
                      <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400">{label}</span>
                          <div className={`h-6 w-6 rounded-md ${bg} flex items-center justify-center`}><Icon className={`h-3.5 w-3.5 ${color}`} /></div>
                        </div>
                        <div className="text-xl font-bold text-slate-800">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Trend chart */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">{t("admin.clicksImpressionsTrend")}</h3>
                    <div className="h-44 w-full text-xs">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={gscTrends}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="day" stroke="#94A3B8" />
                          <YAxis yAxisId="left" stroke="#7C3AED" />
                          <YAxis yAxisId="right" orientation="right" stroke="#0EA5E9" />
                          <ChartTooltip />
                          <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#7C3AED" strokeWidth={2} name={t("admin.clicks")} dot={false} />
                          <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#0EA5E9" strokeWidth={2} name={t("admin.impressions")} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Keywords performance table */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-800">{t("admin.searchKeywords")}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase">{t("admin.searchQuery")}</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">{t("admin.clicks")}</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">{t("admin.impressions")}</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">CTR</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">{t("admin.averagePosition")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {gscKeywords.map(k => (
                            <tr key={k.query} className="hover:bg-slate-50/30">
                              <td className="px-4 py-2.5 font-semibold text-slate-700">{k.query}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{k.clicks}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{k.impressions}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{(k.ctr * 100).toFixed(1)}%</td>
                              <td className="px-4 py-2.5 text-center text-slate-700 font-bold">{k.position}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SEO CHECKER TAB */}
          {tab === "seo" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">SEO Audit & Validator</h2>
                  <p className="text-xs text-slate-400">{t("admin.seoAuditDesc")}</p>
                </div>
                <button
                  onClick={runSeoScan}
                  disabled={seoScanning}
                  className="btn-gradient inline-flex items-center gap-1.5 h-9 px-4 text-xs font-bold transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${seoScanning ? "animate-spin" : ""}`} />
                  {t("admin.runSeoScan")}
                </button>
              </div>

              {seoScanning && (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center space-y-4">
                  <div className="h-10 w-10 bg-navy-50 text-navy-500 rounded-full flex items-center justify-center mx-auto border border-navy-100 animate-spin">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{t("admin.scanInProgress")}</h3>
                    <p className="text-xs text-slate-400 mt-1">{t("admin.scanInProgressDesc")}</p>
                  </div>
                </div>
              )}

              {!seoScanning && seoResult && (
                <div className="space-y-6">
                  {/* Global Score Panel */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-800">{t("admin.globalSeoScore")}</h3>
                      <p className="text-xs text-slate-400">{t("admin.globalSeoScoreDesc")}</p>
                      <div className="text-[10px] text-slate-400">{t("admin.lastScan")}: {new Date(seoResult.lastChecked).toLocaleTimeString("en-CA")}</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 flex items-center justify-center rounded-full border-4 border-emerald-500 bg-emerald-50/50">
                        <div className="text-center">
                          <span className="text-2xl font-bold text-emerald-700">{seoResult.overallScore}</span>
                          <span className="text-[10px] text-emerald-600 block">/100</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scanned Pages breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">{t("admin.detailedPageResults")}</h3>

                    <div className="space-y-3">
                      {seoResult.pages.map(page => (
                        <div key={page.url} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-400">{page.name}</div>
                              <div className="text-sm font-bold text-slate-700">{page.url}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              page.score >= 90 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                              page.score >= 75 ? "bg-amber-50 text-amber-600 border border-amber-200" :
                              "bg-red-50 text-red-600 border border-red-200"
                            }`}>
                              SEO: {page.score}/100
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 rounded-xl text-xs">
                            <div>
                              <span className="block font-bold text-slate-400 mb-0.5">Tag Title</span>
                              <span className="text-slate-700 font-medium">{page.title || "—"}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-slate-400 mb-0.5">Meta Description</span>
                              <span className="text-slate-700 font-medium">{page.description || "—"}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-slate-400 mb-0.5">{t("admin.h1Heading")}</span>
                              <span className="text-slate-700 font-semibold">{page.h1 || "—"}</span>
                            </div>
                          </div>

                          {page.issues.length > 0 ? (
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-500 block">{t("admin.itemsToFix")}</span>
                              {page.issues.map((issue, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  {issue}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              {t("admin.noSeoIssues")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RESEND WEBHOOK EVENTS (delivery/bounce/complaint) */}
          {tab === "incentives" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-500" /> {t("admin.incentivesEngineTitle")}
                </h2>
                <p className="text-xs text-slate-400 mt-1">{t("admin.incentivesEngineDesc")}</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    {t("admin.activeVerifiedIncentives")} ({incentives.filter(i => i.stato !== "closed" && i.humanVerified).length} / {incentives.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { resetIncentiveForm(); setShowIncentiveForm(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-600 text-white text-xs font-semibold hover:bg-navy-700"
                    >
                      + Add program
                    </button>
                    <button
                      onClick={loadIncentives}
                      disabled={loadingIncentives}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 bg-white shadow-sm text-xs text-slate-500 hover:text-slate-800 transition-all font-medium disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingIncentives ? "animate-spin" : ""}`} />
                      {t("admin.refresh")}
                    </button>
                  </div>
                </div>

                {showIncentiveForm && (
                  <form onSubmit={saveIncentive} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <select value={incentiveForm.level} onChange={e => setIncentiveForm(f => ({ ...f, level: e.target.value as any }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                        <option value="federal">Federal</option>
                        <option value="provincial">Provincial</option>
                        <option value="municipal">Municipal</option>
                        <option value="utility">Utility</option>
                      </select>
                      <input required placeholder="Code (e.g. CGHAP)" value={incentiveForm.codice} onChange={e => setIncentiveForm(f => ({ ...f, codice: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                      <input placeholder="Province (ON, QC...)" value={incentiveForm.province} onChange={e => setIncentiveForm(f => ({ ...f, province: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                      <input placeholder="City (optional)" value={incentiveForm.city} onChange={e => setIncentiveForm(f => ({ ...f, city: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                    </div>
                    <input required placeholder="Program title" value={incentiveForm.titolo} onChange={e => setIncentiveForm(f => ({ ...f, titolo: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-full" />
                    <textarea required placeholder="Description" value={incentiveForm.descrizione} onChange={e => setIncentiveForm(f => ({ ...f, descrizione: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-full" rows={2} />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <select value={incentiveForm.categoriaIntervento} onChange={e => setIncentiveForm(f => ({ ...f, categoriaIntervento: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                        {["all", "energy_efficiency", "heat_pump", "insulation", "windows_doors", "accessibility", "general_renovation"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={incentiveForm.tipoAgevolazione} onChange={e => setIncentiveForm(f => ({ ...f, tipoAgevolazione: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                        {["rebate", "direct_grant", "tax_credit", "no_cost_direct_install", "low_interest_loan"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input placeholder="Max amount ($)" value={incentiveForm.massimaleContributo} onChange={e => setIncentiveForm(f => ({ ...f, massimaleContributo: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                      <label className="flex items-center gap-1.5 text-xs text-slate-500">
                        <input type="checkbox" checked={incentiveForm.incomeTested} onChange={e => setIncentiveForm(f => ({ ...f, incomeTested: e.target.checked }))} />
                        Income-tested
                      </label>
                    </div>
                    <input placeholder="Official source URL" value={incentiveForm.fonteUfficialeUrl} onChange={e => setIncentiveForm(f => ({ ...f, fonteUfficialeUrl: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-full" />
                    <div className="flex items-center gap-2">
                      <button type="submit" disabled={savingIncentive} className="px-3 py-1.5 rounded-lg bg-navy-600 text-white text-xs font-semibold hover:bg-navy-700 disabled:opacity-50">
                        {editingIncentiveId ? "Save changes" : "Create program"}
                      </button>
                      <button type="button" onClick={resetIncentiveForm} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500">
                        {t("admin.cancel")}
                      </button>
                    </div>
                  </form>
                )}

                {incentives.length === 0 && !loadingIncentives && (
                  <p className="text-xs text-slate-400">No incentive programs yet.</p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Program</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Level / Region</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Category</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Verification</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {incentives.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/20 text-xs align-top">
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-slate-700">{row.titolo}</p>
                            <p className="text-slate-400">{row.codice}</p>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {row.level}{row.province ? ` · ${row.province}` : ""}{row.city ? ` · ${row.city}` : ""}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">{row.categoriaIntervento}</td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${row.stato === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : row.stato === "expiring_soon" ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-slate-100 text-slate-500"}`}>
                              {row.stato}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => toggleHumanVerified(row)}
                              className={`px-2 py-0.5 rounded-full font-bold ${row.humanVerified ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                            >
                              {row.humanVerified ? "Human-verified" : "Mark verified"}
                            </button>
                            {!row.isVerifiedByAi && (
                              <span className="ml-1.5 px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-600 border border-red-100">AI check failed</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-2">
                            <button onClick={() => startEditIncentive(row)} className="text-navy-600 hover:underline font-semibold">Edit</button>
                            <button onClick={() => deleteIncentive(row.id)} className="text-red-500 hover:underline font-semibold">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "email-events" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-500" /> {t("admin.emailEventsTitle")}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {t("admin.emailEventsDesc")}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">{t("admin.latestEvents")} ({emailEvents.length})</h3>
                  <button
                    onClick={loadEmailEvents}
                    disabled={loadingEmailEvents}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 bg-white shadow-sm text-xs text-slate-500 hover:text-slate-800 transition-all font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingEmailEvents ? "animate-spin" : ""}`} />
                    {t("admin.refresh")}
                  </button>
                </div>

                {emailEvents.length === 0 && !loadingEmailEvents && (
                  <p className="text-xs text-slate-400">{t("admin.noEventsYet")}</p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">{t("admin.type")}</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">{t("admin.recipient")}</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">{t("admin.subject")}</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase text-right">{t("admin.date")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {emailEvents.map((ev) => {
                        const isProblem = ev.type === "email.bounced" || ev.type === "email.complained";
                        return (
                          <tr key={ev.id} className="hover:bg-slate-50/20 text-xs">
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded-full font-bold ${isProblem ? "bg-red-50 text-red-700 border border-red-100" : "bg-slate-100 text-slate-600"}`}>
                                {ev.type}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">{(ev.to || []).join(", ") || "—"}</td>
                            <td className="px-4 py-3.5 text-slate-600">{ev.subject || "—"}</td>
                            <td className="px-4 py-3.5 text-right text-slate-400">
                              {new Date(ev.createdAt).toLocaleString("en-CA")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PLATFORM CONFIGURATION SETTINGS */}
          {tab === "settings" && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-base font-bold text-slate-800">{t("admin.platformSettings")}</h2>
              <p className="text-xs text-slate-400">{t("admin.platformSettingsDesc")}</p>

              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("admin.registrationsOpen")}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{t("admin.registrationsOpenDesc")}</p>
                  </div>
                  <button
                    onClick={() => toggleSetting("registration_open", settings["registration_open"] ?? "true")}
                    disabled={savingKey === "registration_open"}
                    className="shrink-0 transition-colors disabled:opacity-50"
                  >
                    {registrationOpen ? <ToggleRight className="h-8 w-8 text-emerald-500" /> : <ToggleLeft className="h-8 w-8 text-slate-400" />}
                  </button>
                </div>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${registrationOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {registrationOpen ? t("admin.openNewUsersCanRegister") : t("admin.closedSignupDisabled")}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700">
                <strong>{t("admin.note")}:</strong> {t("admin.closedRegistrationsNote")}
              </div>
            </div>
          )}

          {/* SUPPORT TAB */}
          {tab === "support" && (
            <div className="space-y-6">
              {/* Header section with toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl border border-slate-100 p-5 shadow-sm gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-navy-500" /> {t("admin.realtimeSupportTitle")}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">{t("admin.realtimeSupportDesc")}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-slate-500">{t("admin.operatorStatus")}:</span>
                  <button
                    onClick={toggleAdminOnline}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-bold"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${adminOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                    {adminOnline ? t("admin.onlineReceivingChats") : t("admin.offlineAiOnly")}
                  </button>
                </div>
              </div>

              {/* Chat Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                {/* Conversation List */}
                <div className="bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden shadow-sm lg:col-span-1">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("admin.conversations")}</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {supportConvs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        {t("admin.noSupportConvs")}
                      </div>
                    ) : (
                      supportConvs.map(c => {
                        const isSelected = selectedConvId === c.id;
                        const hasWaiting = c.status === "human_needed";
                        const isActive = c.status === "human_active";
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedConvId(c.id)}
                            className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex flex-col gap-1.5 ${
                              isSelected ? "bg-navy-50/50 border-l-4 border-navy-600" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 truncate">{c.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                hasWaiting ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                isActive ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                                c.status === "closed" ? "bg-slate-100 text-slate-500 border border-slate-200" :
                                "bg-navy-100 text-navy-700 border border-navy-200"
                              }`}>
                                {hasWaiting ? t("admin.waiting") : isActive ? t("admin.activeStatus") : c.status === "closed" ? t("admin.closedStatus") : "AI"}
                              </span>
                            </div>
                            {c.visitorEmail && (
                              <span className="text-[10px] text-slate-500 truncate">{c.visitorEmail}</span>
                            )}
                            <span className="text-[9px] text-slate-400 self-end">
                              {new Date(c.updatedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Chat Panel */}
                <div className="bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden shadow-sm lg:col-span-2">
                  {selectedConvId ? (
                    (() => {
                      const activeConv = supportConvs.find(c => c.id === selectedConvId);
                      return (
                        <>
                          {/* Chat Header */}
                          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                {activeConv?.title}
                                <span className={`h-2 w-2 rounded-full ${
                                  activeConv?.status === "human_needed" ? "bg-amber-500 animate-ping" :
                                  activeConv?.status === "human_active" ? "bg-emerald-500" :
                                  activeConv?.status === "closed" ? "bg-slate-400" : "bg-navy-500"
                                }`} />
                              </div>
                              {activeConv && (activeConv.visitorName || activeConv.visitorEmail || activeConv.visitorPhone) && (
                                <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                  {activeConv.visitorName && <span>{t("admin.name")}: <strong>{activeConv.visitorName}</strong></span>}
                                  {activeConv.visitorEmail && <span>Email: <strong>{activeConv.visitorEmail}</strong></span>}
                                  {activeConv.visitorPhone && <span>{t("admin.telAbbrev")}: <strong>{activeConv.visitorPhone}</strong></span>}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {activeConv?.status === "human_needed" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await authFetch(`/api/support/conversations/${selectedConvId}/join`, { method: "POST" });
                                      loadSupportConvs();
                                      toast({ title: t("admin.chatTakenOver"), description: t("admin.chatTakenOverDesc") });
                                    } catch {
                                      toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorTakeOverChat") });
                                    }
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                                >
                                  {t("admin.takeOver")}
                                </button>
                              )}
                              {activeConv?.status !== "closed" && (
                                <button
                                  onClick={async () => {
                                    if (confirm(t("admin.confirmCloseConversation"))) {
                                      try {
                                        await authFetch(`/api/support/conversations/${selectedConvId}/close`, { method: "POST" });
                                        loadSupportConvs();
                                        toast({ title: t("admin.chatClosed"), description: t("admin.chatClosedDesc") });
                                      } catch {
                                        toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorCloseChat") });
                                      }
                                    }
                                  }}
                                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition"
                                >
                                  {t("admin.closeChat")}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Message History */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                            {convMessages.length === 0 ? (
                              <div className="p-8 text-center text-xs text-slate-400">
                                {t("admin.waitingForMessages")}
                              </div>
                            ) : (
                              convMessages.map((m, idx) => {
                                const isAdminMsg = m.role === "admin";
                                const isAi = m.role === "assistant";
                                return (
                                  <div key={m.id || idx} className={`flex gap-2 ${isAdminMsg ? "justify-end" : ""}`}>
                                    {!isAdminMsg && (
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${isAi ? "bg-navy-100 text-navy-700" : "bg-blue-100 text-blue-700"}`}>
                                        {isAi ? <Bot className="h-3.5 w-3.5" /> : "U"}
                                      </div>
                                    )}
                                    <div className={`p-3 rounded-2xl text-xs max-w-[70%] shadow-sm ${
                                      isAdminMsg ? "bg-navy-600 text-white rounded-tr-none" :
                                      isAi ? "bg-white border border-slate-100 text-slate-600 rounded-tl-none italic" :
                                      "bg-white border border-slate-100 text-slate-800 rounded-tl-none font-medium"
                                    }`}>
                                      <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>
                                      <div className={`text-[8px] mt-1 text-right ${isAdminMsg ? "text-navy-200" : "text-slate-400"}`}>
                                        {new Date(m.createdAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
                                      </div>
                                    </div>
                                    {isAdminMsg && (
                                      <div className="w-6 h-6 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                                        OP
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Message input */}
                          {activeConv?.status !== "closed" ? (
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!adminReply.trim()) return;
                                const content = adminReply;
                                setAdminReply("");
                                try {
                                  await authFetch(`/api/support/conversations/${selectedConvId}/messages`, {
                                    method: "POST",
                                    body: JSON.stringify({ role: "admin", content }),
                                  });
                                  // Refresh messages
                                  const msgs = await authFetch(`/api/support/conversations/${selectedConvId}/messages`);
                                  setConvMessages(msgs);
                                } catch {
                                  toast({ variant: "destructive", title: t("admin.error"), description: t("admin.errorSendMessage") });
                                }
                              }}
                              className="p-3 border-t border-slate-100 bg-white flex gap-2"
                            >
                              <input
                                type="text"
                                placeholder={t("admin.typeReply")}
                                value={adminReply}
                                onChange={e => setAdminReply(e.target.value)}
                                className="flex-1 px-3 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs focus:outline-none focus:border-navy-500"
                              />
                              <button
                                type="submit"
                                disabled={!adminReply.trim()}
                                className="p-2.5 bg-navy-600 hover:bg-navy-700 text-white rounded-xl transition-all disabled:opacity-50 shrink-0"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            </form>
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 border-t">
                              {t("admin.chatIsClosed")}
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">{t("admin.noConversationSelected")}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{t("admin.selectChatFromLeft")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
