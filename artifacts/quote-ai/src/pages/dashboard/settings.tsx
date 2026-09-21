import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetBusinessProfile, useUpdateBusinessProfile, useGetSubscription,
  useCreateCustomerPortalSession, getGetBusinessProfileQueryKey,
  useGetWhatsappStatus, useConnectWhatsapp, useVerifyWhatsapp, useDisconnectWhatsapp,
  useToggleWhatsapp, getGetWhatsappStatusQueryKey, useGetWhatsappUsage,
  useCreateCheckoutSession, useGetPlans, getGetSubscriptionQueryKey,
  useGetQuickbooksStatus, getGetQuickbooksStatusQueryKey, useGetQuickbooksConnectUrl,
  getGetQuickbooksConnectUrlQueryKey, useDisconnectQuickbooks, useToggleQuickbooks,
  useGetQuickbooksAccounts, getGetQuickbooksAccountsQueryKey, useUpdateQuickbooksMapping,
  useGetQuickbooksSyncLog, getGetQuickbooksSyncLogQueryKey, useRetryQuickbooksSync,
  useGetWaveStatus, getGetWaveStatusQueryKey, useGetWaveConnectUrl,
  getGetWaveConnectUrlQueryKey, useDisconnectWave, useToggleWave,
  useGetWaveAccounts, getGetWaveAccountsQueryKey, useUpdateWaveMapping,
  useGetWaveSyncLog, getGetWaveSyncLogQueryKey, useRetryWaveSync,
  useGetCalendarStatus, getGetCalendarStatusQueryKey, useGetCalendarConnectUrl,
  getGetCalendarConnectUrlQueryKey, useDisconnectCalendar, useToggleCalendar,
  type CalendarProvider,
  useGetEmailConnectionsStatus, getGetEmailConnectionsStatusQueryKey, useGetEmailConnectionConnectUrl,
  getGetEmailConnectionConnectUrlQueryKey, useDisconnectEmailConnection, useToggleEmailConnection,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, X, ImageIcon, Crown, Zap, CheckCircle2, XCircle, CalendarDays, BarChart3, AlertCircle, RefreshCw, ArrowUpRight, MessageCircle, Phone, Link2Off, Plug, Building2, CreditCard, Landmark, KeyRound, Webhook, Copy, Trash2, Mail, Banknote, Megaphone, Search, Settings as SettingsIcon } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { BusinessTab } from "./settings-business-tab";
import { SecurityTab } from "./settings-security-tab";
import { usageApi } from "@/lib/usage-api";
import { COST_CATEGORY_KEYS } from "@/components/jobs/cost-entry-dialog";
import { stripeConnectApi, financeitApi, developerApi, flinksApi, metaLeadAdsApi, googleLsaApi, type AutomationEventName, type FlinksAccountDto } from "@/lib/invoices-api";

function useProfileSchema() {
  const { t } = useLanguage();
  return z.object({
    companyName: z.string().min(2, t("dashboard.profile.errors.companyNameMin")),
    vatNumber: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email(t("dashboard.profile.errors.invalidEmail")).optional().or(z.literal("")),
  });
}
type ProfileFormValues = z.infer<ReturnType<typeof useProfileSchema>>;

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE_MB = 2;

// Phase 65: an integration whose server-side app registration is missing
// reports `available: false` on its status endpoint. Rendered in place of the
// Connect button so nobody is bounced to a vendor error page.
function NotAvailableNote() {
  const { t } = useLanguage();
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="integration-not-available">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium text-foreground">{t("dashboard.settings.integrations.notAvailableTitle")}</p>
        <p className="mt-0.5">{t("dashboard.settings.integrations.notAvailableDesc")}</p>
      </div>
    </div>
  );
}

function AccountTab() {
  const { t } = useLanguage();
  const profileSchema = useProfileSchema();
  const { data: profile, isLoading } = useGetBusinessProfile();
  const updateProfile = useUpdateBusinessProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const createPortal = useCreateCustomerPortalSession();
  const isStarter = subscription?.isActive && subscription?.plan === "monthly_starter";
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentLogoUrl = logoPreview ?? profile?.logoUrl ?? null;

  const [generatingKey, setGeneratingKey] = useState(false);
  const handleGenerateApiKey = async () => {
    setGeneratingKey(true);
    try {
      const res = await fetch("/api/business-profile/apikey", { method: "POST" });
      if (!res.ok) throw new Error(t("dashboard.settings.account.apiKeyGenFailed"));
      await res.json();
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.settings.account.apiKeyGenerated") });
    } catch {
      toast({ title: t("dashboard.settings.account.apiKeyGenError"), variant: "destructive" });
    } finally {
      setGeneratingKey(false);
    }
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      companyName: profile?.companyName || "",
      vatNumber: profile?.vatNumber || "",
      address: profile?.address || "",
      phone: profile?.phone || "",
      email: profile?.email || "",
    }
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile.mutate({ data }, {
      onSuccess: () => {
        toast({ title: t("dashboard.profile.toast.updated") });
        queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      },
      onError: () => toast({ title: t("dashboard.profile.toast.errorUpdate"), variant: "destructive" })
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: t("dashboard.profile.errors.unsupportedFormat"), description: t("dashboard.profile.errors.useFormats"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: t("dashboard.profile.errors.fileTooLarge"), description: t("dashboard.profile.errors.maxSize").replace("{max}", String(MAX_SIZE_MB)), variant: "destructive" });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/business-profile/logo", { method: "POST", body: formData });
      if (!res.ok) throw new Error(t("dashboard.profile.errors.uploadFailed"));
      const { logoUrl } = await res.json() as { logoUrl: string };
      setLogoPreview(logoUrl);
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.profile.toast.logoUploaded") });
    } catch (err) {
      toast({ title: t("dashboard.profile.toast.errorLogoUpload"), description: err instanceof Error ? err.message : t("dashboard.profile.toast.unknownError"), variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateProfile.mutateAsync({ data: { logoUrl: "" } });
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      setLogoPreview(null);
      toast({ title: t("dashboard.profile.toast.logoRemoved") });
    } catch {
      toast({ title: t("dashboard.profile.toast.errorLogoRemove"), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      {isStarter ? (
        <div className="card border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50">
          <div className="card-head">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-navy-500" />
              <h2>{t("dashboard.profile.logoProOnly.title")}</h2>
            </div>
            <p className="sub">
              {t("dashboard.settings.account.logoStarterDesc1")}<br/>
              {t("dashboard.settings.account.logoStarterDesc2")}
            </p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                {[t("dashboard.profile.logoProOnly.feature1"), t("dashboard.profile.logoProOnly.feature2"), t("dashboard.profile.logoProOnly.feature3")].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm"><span className="text-navy-500 font-bold">✓</span> {f}</div>
                ))}
              </div>
              <button onClick={() => createPortal.mutate(undefined, { onSuccess: (r) => { window.open(r.url, "_blank"); } })} disabled={createPortal.isPending} className="btn btn-navy">
                {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                {t("dashboard.profile.logoProOnly.upgradeButton")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-head">
            <h2>{t("dashboard.profile.logo.title")}</h2>
            <p className="sub">{t("dashboard.settings.account.logoDesc")}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-6">
              <div className="w-32 h-20 border-2 border-dashed border-muted-foreground/30 rounded-[var(--radius-sm)] flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                {currentLogoUrl ? (
                  <img src={currentLogoUrl} alt={t("dashboard.profile.logo.altText")} className="max-h-full max-w-full object-contain p-1" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" /><span className="text-xs">{t("dashboard.profile.logo.none")}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                <button type="button"   onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo} className="btn btn-outline-navy btn-sm gap-2">
                  {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploadingLogo ? t("dashboard.profile.logo.uploading") : t("dashboard.profile.logo.uploadButton")}
                </button>
                {currentLogoUrl && (
                  <button type="button"   onClick={handleRemoveLogo} className="btn btn-outline-navy btn-sm gap-2 text-destructive hover:text-destructive block">
                    <X className="h-4 w-4" />{t("dashboard.profile.logo.remove")}
                  </button>
                )}
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.account.logoFormatsShort")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="card">
            <div className="card-head">
              <h2>{t("dashboard.profile.businessData.title")}</h2>
              <p className="sub">{t("dashboard.profile.businessData.desc")}</p>
            </div>
            <div className="p-5 space-y-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("dashboard.profile.businessData.companyNameLabel")}</FormLabel>
                  <FormControl><Input placeholder={t("dashboard.profile.businessData.companyNamePlaceholder")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="vatNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("dashboard.profile.businessData.vatNumberLabel")}</FormLabel>
                    <FormControl><Input placeholder={t("dashboard.profile.businessData.vatNumberPlaceholder")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("dashboard.profile.businessData.phoneLabel")}</FormLabel>
                    <FormControl><Input placeholder={t("dashboard.profile.businessData.phonePlaceholder")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("dashboard.profile.businessData.emailLabel")}</FormLabel>
                  <FormControl><Input placeholder={t("dashboard.profile.businessData.emailPlaceholder")} type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("dashboard.profile.businessData.addressLabel")}</FormLabel>
                  <FormControl><Input placeholder={t("dashboard.profile.businessData.addressPlaceholder")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="card-foot flex justify-end border-t p-6">
              <button type="submit" disabled={updateProfile.isPending} className="btn btn-navy min-w-[120px]">
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {t("dashboard.profile.businessData.saveButton")}
              </button>
            </div>
          </div>
        </form>
      </Form>

      {/* Widget Funnel Integration Card */}
      <div className="card mt-6">
        <div className="card-head">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-navy-500" />
            <h2>{t("dashboard.settings.account.widgetCard.title")}</h2>
          </div>
          <p className="sub">
            {t("dashboard.settings.account.widgetCard.desc")}
          </p>
        </div>
        <div className="p-5 space-y-4">
          {profile?.apiKey ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FormLabel className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">{t("dashboard.settings.account.widgetCard.activeApiKeyLabel")}</FormLabel>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={profile.apiKey}
                    className="font-mono text-xs bg-muted/30 text-center"
                  />
                  <button onClick={handleGenerateApiKey}
                    disabled={generatingKey}
                    
                    className="btn btn-outline-navy shrink-0">
                    {generatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    {t("dashboard.settings.account.widgetCard.regenerate")}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <FormLabel className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">{t("dashboard.settings.account.widgetCard.embedCodeLabel")}</FormLabel>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.account.widgetCard.embedCodeDesc")}</p>
                <div className="relative">
                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-[var(--radius)] overflow-x-auto font-mono text-[10px] leading-relaxed max-h-40 whitespace-pre-wrap select-all border border-slate-800">
{`<!-- QuoteAI Widget Funnel -->
<div id="quoteai-widget">
  <a href="https://quoteai.ca" rel="noopener">${t("dashboard.settings.account.widgetCard.embedAnchorText")}</a>
</div>
<script
  src="${typeof window !== "undefined" ? window.location.origin : "https://quoteai.ca"}/widget.js"
  data-api-key="${profile.apiKey}"
  async
></script>`}
                  </pre>
                  <button onClick={() => {
                      const code = `<!-- QuoteAI Widget Funnel -->\n<div id="quoteai-widget">\n  <a href="https://quoteai.ca" rel="noopener">${t("dashboard.settings.account.widgetCard.embedAnchorText")}</a>\n</div>\n<script\n  src="${typeof window !== "undefined" ? window.location.origin : "https://quoteai.ca"}/widget.js"\n  data-api-key="${profile.apiKey}"\n  async\n></script>`;
                      navigator.clipboard.writeText(code);
                      toast({ title: t("dashboard.settings.account.widgetCard.codeCopiedTitle"), description: t("dashboard.settings.account.widgetCard.codeCopiedDesc") });
                    }}
                    className="btn btn-navy btn-sm absolute right-3 top-3 text-[10px] font-semibold h-7 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                    {t("dashboard.settings.account.widgetCard.copy")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed rounded-[var(--radius)] bg-muted/10 space-y-3">
              <p className="text-sm text-muted-foreground">{t("dashboard.settings.account.widgetCard.noApiKeyDesc")}</p>
              <button onClick={handleGenerateApiKey} disabled={generatingKey} className="btn btn-navy">
                {generatingKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                {t("dashboard.settings.account.widgetCard.enableWidgetButton")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("dashboard.billing.quotesUsed")}</span><span className="font-semibold">{used} / {limit}</span></div>
      <div className="hbar">
        <i style={{ width: `${pct}%`, background: pct >= 90 ? "var(--red)" : pct >= 70 ? "var(--yellow-dark)" : "var(--navy)" }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{t("dashboard.settings.whatsapp.remaining").replace("{count}", String(limit - used))}</span><span>{t("dashboard.billing.pctUsed").replace("{pct}", String(pct))}</span></div>
    </div>
  );
}

function PlanFeature({ text, ok }: { text: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-muted-foreground line-through opacity-50"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </li>
  );
}

function BillingTab() {
  const { t } = useLanguage();
  const { data: sub, isLoading } = useGetSubscription();
  const { data: plans } = useGetPlans();
  const createPortal = useCreateCustomerPortalSession();
  const createCheckout = useCreateCheckoutSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManage = () => {
    createPortal.mutate(undefined, {
      onSuccess: (r) => { window.open(r.url, "_blank"); },
      onError: () => {
        toast({ title: t("dashboard.settings.billing.portalUnavailableTitle"), description: t("dashboard.settings.billing.portalUnavailableDesc"), variant: "destructive" });
      },
    });
  };

  const handleCheckout = (planId: string) => {
    setLoadingPlanId(planId);
    createCheckout.mutate(
      { data: { planType: planId as "monthly_starter" | "monthly_pro" | "monthly_elite" | "oneshot_watermark" | "oneshot_clean" } },
      {
        onSuccess: (r) => { window.location.href = r.url; },
        onError: () => {
          setLoadingPlanId(null);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      }
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/payments/sync-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { synced: boolean; active?: boolean; plan?: string; message?: string };
      if (data.synced && data.active) {
        await queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
        toast({ title: t("dashboard.settings.billing.syncedTitle"), description: t("dashboard.settings.billing.syncedDesc").replace("{plan}", data.plan ?? "") });
      } else {
        toast({ title: t("dashboard.settings.billing.noSubFoundTitle"), description: data.message ?? t("dashboard.settings.billing.checkStripeDesc"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("dashboard.settings.billing.errorSync"), variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  const isStarter = sub?.plan === "monthly_starter";
  const isPro = sub?.plan === "monthly_pro";
  const isElite = sub?.plan === "monthly_elite";
  const isActive = sub?.isActive ?? false;
  const planLabel = isElite ? "Elite" : isPro ? "Pro" : isStarter ? "Starter" : null;
  const planPrice = isElite ? t("dashboard.billing.priceElite") : isPro ? t("dashboard.billing.pricePro") : isStarter ? t("dashboard.billing.priceStarter") : null;
  const renewalDate = sub?.periodEnd ? new Date(sub.periodEnd).toLocaleDateString("en-CA", { day: "2-digit", month: "long", year: "numeric" }) : null;
  const resetDate = sub?.quotaResetDate ? new Date(sub.quotaResetDate).toLocaleDateString("en-CA", { day: "2-digit", month: "long" }) : null;
  const subscriptionPlans = Array.isArray(plans) ? plans.filter((p) => !!p.interval) : [];

  return (
    <div className="space-y-6">
      {isActive ? (
        <div className={cn("card", `border-2 ${isElite ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50" : isPro ? "border-amber-300 bg-gradient-to-br from-amber-50 to-navy-50" : "border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50"}`)}>
          <div className="card-head pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center ${isElite ? "bg-amber-200" : isPro ? "bg-amber-100" : "bg-navy-100"}`}>
                  {isElite ? <Crown className="h-6 w-6 text-amber-700" /> : isPro ? <Crown className="h-6 w-6 text-amber-600" /> : <Zap className="h-6 w-6 text-navy-500" />}
                </div>
                <div>
                  <h2 className="text-xl">QuoteAI {planLabel}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{planPrice}</p>
                </div>
              </div>
              <span className={cn("chip", isElite ? "chip-yellow" : isPro ? "chip-purple" : "chip-teal")}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.billing.active")}
              </span>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {isStarter && sub.quotaUsed != null && sub.quotaLimit != null && (
              <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-navy-100">
                <div className="flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-navy-500" /><span className="text-sm font-semibold">{t("dashboard.billing.monthlyUsage")}</span></div>
                <QuotaBar used={sub.quotaUsed} limit={sub.quotaLimit} />
                {resetDate && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><RefreshCw className="h-3 w-3" />{t("dashboard.billing.quotaResetsOn").replace("{date}", resetDate)}</p>}
                {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[var(--radius-sm)] p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("dashboard.settings.billing.almostOutShort")}
                  </div>
                )}
              </div>
            )}
            <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-navy-100">
              <div className="text-sm font-semibold mb-3">{t("dashboard.billing.includedInPlan")}</div>
              <ul className="space-y-2">
                {isElite ? (
                  <><PlanFeature text={t("dashboard.billing.feature.unlimitedQuotes")} ok /><PlanFeature text={t("dashboard.billing.feature.noWatermark")} ok /><PlanFeature text={t("dashboard.billing.feature.ownLogo")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.allTemplates")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.unlimitedNotesUpload")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.unlimitedVoice")} ok /></>
                ) : isPro ? (
                  <><PlanFeature text={t("dashboard.settings.billing.feature.quotes60PerMonth")} ok /><PlanFeature text={t("dashboard.billing.feature.noWatermark")} ok /><PlanFeature text={t("dashboard.billing.feature.ownLogo")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.allTemplates")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.notesUpload30")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.voiceRecording30")} ok /></>
                ) : (
                  <><PlanFeature text={t("dashboard.settings.billing.feature.quotesPerMonthCount").replace("{count}", String(sub?.quotaLimit ?? 10))} ok /><PlanFeature text={t("dashboard.settings.billing.feature.pdfWithLogo")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.templateStandard")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.pdfNoWatermarkFalse")} ok={false} /><PlanFeature text={t("dashboard.settings.billing.feature.templateProPremium")} ok={false} /></>
                )}
              </ul>
            </div>
            {renewalDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />{t("dashboard.billing.nextRenewal")} <span className="font-medium text-foreground">{renewalDate}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {(isStarter || isPro) && (
                <button onClick={handleManage} disabled={createPortal.isPending} className="btn btn-navy gap-2">
                  {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}{isStarter ? t("dashboard.billing.upgradeToPro") : t("dashboard.settings.billing.upgradeToElite")}
                </button>
              )}
              <button onClick={handleManage} disabled={createPortal.isPending} className="btn btn-outline-navy gap-2">
                <ArrowUpRight className="h-4 w-4" />{t("dashboard.billing.manageSubscription")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.billing.managedByStripeShort")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card border-dashed">
            <div className="card-head">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-muted flex items-center justify-center"><XCircle className="h-5 w-5 text-muted-foreground" /></div>
                  <div><h2>{t("dashboard.billing.noActiveSubTitle")}</h2><p className="sub mt-0.5">{t("dashboard.settings.billing.noActiveSubDesc")}</p></div>
                </div>
                <button onClick={handleSync} disabled={isSyncing} className="btn btn-outline-navy btn-sm gap-2 shrink-0">
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("dashboard.settings.billing.verifySubscription")}
                </button>
              </div>
            </div>
          </div>

          {subscriptionPlans.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-4">
              {subscriptionPlans.map((plan) => {
                const isPlanPro = plan.id === "monthly_pro";
                const isPlanElite = plan.id === "monthly_elite";
                return (
                  <div key={plan.id} className={cn("card", `flex flex-col ${isPlanPro ? "border-2 border-navy-300 shadow-lg" : isPlanElite ? "border-2 border-amber-300" : ""}`)}>
                    <div className="card-head pb-2">
                      {isPlanPro && <span className="text-[10px] font-bold text-navy-600 uppercase tracking-wider">{t("dashboard.settings.billing.mostPopular")}</span>}
                      {isPlanElite && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{t("dashboard.settings.billing.unlimited")}</span>}
                      <h2 className="text-lg">{plan.name}</h2>
                      <p className="text-2xl font-extrabold">${plan.price}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                    </div>
                    <div className="p-5 flex-1 pb-0">
                      <ul className="space-y-1.5 mb-4">
                        {plan.features.map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isPlanPro ? "text-navy-500" : isPlanElite ? "text-amber-500" : "text-muted-foreground"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="card-foot pt-3">
                      <button className={cn("btn btn-navy", `w-full gap-2 ${isPlanPro ? "btn-gradient" : isPlanElite ? "bg-amber-500 hover:bg-amber-600 text-white border-0" : ""}`)}
                        
                        onClick={() => handleCheckout(plan.id)}
                        disabled={loadingPlanId === plan.id}>
                        {loadingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                        {loadingPlanId === plan.id ? t("dashboard.settings.billing.pleaseWait") : t("dashboard.settings.billing.choosePlan").replace("{name}", plan.name)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {isActive && (isStarter || isPro) && (
        <div className="card">
          <div className="p-5 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">{t("dashboard.settings.billing.undetectedSubTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.billing.undetectedSubDesc")}</p>
              </div>
              <button onClick={handleSync} disabled={isSyncing} className="btn btn-outline-navy btn-sm gap-2 shrink-0">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("dashboard.settings.billing.verifySubscription")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsappUpsellCard() {
  const { t } = useLanguage();
  const createCheckout = useCreateCheckoutSession();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCheckout = (planId: string) => {
    setLoadingPlanId(planId);
    createCheckout.mutate(
      { data: { planType: planId as "monthly_pro" | "monthly_elite" } },
      {
        onSuccess: (r) => { window.location.href = r.url; },
        onError: () => {
          setLoadingPlanId(null);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="card border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-navy-500" />
            </div>
            <div>
              <h2>{t("dashboard.settings.whatsappUpsell.title")}</h2>
              <p className="sub mt-0.5">
                {t("dashboard.settings.whatsappUpsell.desc")}
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "📝", label: t("dashboard.settings.whatsappUpsell.text.label"), desc: t("dashboard.settings.whatsappUpsell.text.desc") },
              { icon: "🎙️", label: t("dashboard.settings.whatsappUpsell.voice.label"), desc: t("dashboard.settings.whatsappUpsell.voice.desc") },
              { icon: "📷", label: t("dashboard.settings.whatsappUpsell.photo.label"), desc: t("dashboard.settings.whatsappUpsell.photo.desc") },
            ].map(item => (
              <div key={item.label} className="bg-card/70 rounded-[var(--radius)] p-3 text-center border border-navy-100">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <button className="btn btn-navy btn-gradient gap-2"
              onClick={() => handleCheckout("monthly_pro")}
              disabled={loadingPlanId === "monthly_pro"}>
              {loadingPlanId === "monthly_pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {t("dashboard.settings.whatsappUpsell.upgradeToProPrice")}
            </button>
            <button className="btn btn-navy bg-amber-500 hover:bg-amber-600 text-white border-0 gap-2"
              onClick={() => handleCheckout("monthly_elite")}
              disabled={loadingPlanId === "monthly_elite"}>
              {loadingPlanId === "monthly_elite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {t("dashboard.settings.whatsappUpsell.upgradeToElitePrice")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsappTab() {
  const { t } = useLanguage();
  const { data: status, isLoading } = useGetWhatsappStatus();
  const { data: usage } = useGetWhatsappUsage();
  const { data: subscription } = useGetSubscription();
  const connectWa = useConnectWhatsapp();
  const verifyWa = useVerifyWhatsapp();
  const disconnectWa = useDisconnectWhatsapp();
  const toggleWa = useToggleWhatsapp();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [phoneInput, setPhoneInput] = useState("");
  const [otpState, setOtpState] = useState<{ phoneNumber: string } | null>(null);
  const [otpInput, setOtpInput] = useState("");

  const isConnected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = () => {
    if (!phoneInput.trim()) return;
    connectWa.mutate(
      { data: { phoneNumber: phoneInput.trim() } },
      {
        onSuccess: (result) => {
          setOtpState({ phoneNumber: result.phoneNumber });
          setOtpInput("");
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("dashboard.settings.whatsapp.errorConnecting");
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleVerify = () => {
    if (!otpState || !otpInput.trim()) return;
    verifyWa.mutate(
      { data: { phoneNumber: otpState.phoneNumber, otp: otpInput.trim() } },
      {
        onSuccess: () => {
          setOtpState(null);
          setOtpInput("");
          queryClient.invalidateQueries({ queryKey: getGetWhatsappStatusQueryKey() });
          toast({ title: t("dashboard.settings.whatsapp.connectedSuccess") });
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("dashboard.settings.whatsapp.wrongOrExpiredCode");
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleDisconnect = () => {
    disconnectWa.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWhatsappStatusQueryKey() });
        toast({ title: t("dashboard.settings.whatsapp.disconnected") });
      },
      onError: () => toast({ title: t("dashboard.settings.whatsapp.errorDisconnecting"), variant: "destructive" }),
    });
  };

  const handleToggle = () => {
    toggleWa.mutate(
      { data: { isEnabled: !isEnabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWhatsappStatusQueryKey() });
          toast({ title: isEnabled ? t("dashboard.settings.whatsapp.integrationDisabled") : t("dashboard.settings.whatsapp.integrationEnabled") });
        },
        onError: () => toast({ title: t("dashboard.settings.whatsapp.error"), variant: "destructive" }),
      }
    );
  };

  const isPro = subscription?.plan === "monthly_pro" && subscription?.isActive;
  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  const hasWhatsappAccess = isPro || isElite;

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;

  if (!hasWhatsappAccess) return <WhatsappUpsellCard />;

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="card border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="card-head pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg">{t("dashboard.settings.whatsapp.connectedTitle")}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    +{status?.phoneNumber}
                  </p>
                </div>
              </div>
              <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </span>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {usage != null && usage.limit != null && (
              <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">{t("dashboard.settings.whatsapp.usageThisMonth")}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("dashboard.settings.whatsapp.used")}</span>
                    <span className="font-semibold">{usage.used} / {usage.limit}</span>
                  </div>
                  <div className="hbar">
                    <i
                      style={{
                        width: `${Math.min(100, Math.round((usage.used / usage.limit) * 100))}%`,
                        background: usage.used >= usage.limit ? "var(--red)" : usage.used >= usage.limit * 0.8 ? "var(--yellow-dark)" : "var(--green)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("dashboard.settings.whatsapp.remaining").replace("{count}", String(Math.max(0, usage.limit - usage.used)))}</span>
                    <span>{t("dashboard.settings.whatsapp.pctUsed").replace("{pct}", String(Math.min(100, Math.round((usage.used / usage.limit) * 100))))}</span>
                  </div>
                </div>
                {usage.used >= usage.limit && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-[var(--radius-sm)] p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {t("dashboard.settings.whatsapp.limitReached")}
                  </div>
                )}
                {usage.used < usage.limit && usage.limit - usage.used <= 5 && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[var(--radius-sm)] p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {t("dashboard.settings.whatsapp.almostOut")}
                  </div>
                )}
              </div>
            )}
            <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-emerald-100 text-sm text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground mb-2">{t("dashboard.settings.whatsapp.howToUseTitle")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse1")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse2")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse3")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse4")}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <button onClick={handleToggle}
                disabled={toggleWa.isPending}
                className="btn btn-navy btn-sm gap-2">
                {toggleWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")} {t("dashboard.settings.whatsapp.integrationSuffix")}
              </button>
              <button onClick={handleDisconnect}
                disabled={disconnectWa.isPending}
                className="btn btn-outline-navy btn-sm gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5">
                {disconnectWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.whatsapp.disconnectButton")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (otpState) {
    return (
      <div className="card border-navy-200">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-navy-600" />
            </div>
            <div>
              <h2>{t("dashboard.settings.whatsapp.enterCodeTitle")}</h2>
              <p className="sub mt-0.5">
                {t("dashboard.settings.whatsapp.codeSentDesc").replace("{phone}", otpState.phoneNumber)}
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="bg-navy-50 border border-navy-200 rounded-[var(--radius)] p-4 text-sm text-navy-700 space-y-1">
            <p className="font-semibold">{t("dashboard.settings.whatsapp.checkPhone")}</p>
            <p className="text-navy-500">{t("dashboard.settings.whatsapp.codeInstructions")}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("dashboard.settings.whatsapp.verificationCodeLabel")}</label>
            <div className="flex gap-2">
              <Input
                placeholder="123456"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter" && otpInput.length === 6) handleVerify(); }}
                className="flex-1 text-center text-xl tracking-widest font-mono"
                maxLength={6}
                inputMode="numeric"
              />
              <button onClick={handleVerify}
                disabled={otpInput.length !== 6 || verifyWa.isPending}
                className="btn btn-navy gap-2 btn-gradient">
                {verifyWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t("dashboard.settings.whatsapp.verify")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.whatsapp.codeValidFor")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => { connectWa.mutate({ data: { phoneNumber: otpState.phoneNumber } }); }}
              disabled={connectWa.isPending}
              className="btn btn-outline-navy btn-sm text-muted-foreground gap-2">
              {connectWa.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("dashboard.settings.whatsapp.resendCode")}
            </button>
            <button onClick={() => { setOtpState(null); setOtpInput(""); }} className="btn btn-outline-navy btn-sm text-muted-foreground">
              {t("dashboard.settings.whatsapp.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-muted flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2>{t("dashboard.settings.whatsapp.connectTitle")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.whatsapp.connectDesc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "📝", label: t("dashboard.settings.whatsappUpsell.text.label"), desc: t("dashboard.settings.whatsapp.connect.text.desc") },
              { icon: "🎙️", label: t("dashboard.settings.whatsappUpsell.voice.label"), desc: t("dashboard.settings.whatsapp.connect.voice.desc") },
              { icon: "📷", label: t("dashboard.settings.whatsappUpsell.photo.label"), desc: t("dashboard.settings.whatsappUpsell.photo.desc") },
            ].map(item => (
              <div key={item.label} className="bg-muted rounded-[var(--radius)] p-3 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>

          {status?.businessNumber && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-[var(--radius)] p-4">
              <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800">{t("dashboard.settings.whatsapp.botNumberLabel")}</p>
                <p className="text-xs text-emerald-700 mt-0.5">{t("dashboard.settings.whatsapp.botNumberDesc")}</p>
              </div>
              <a
                href={`https://wa.me/${status.businessNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <button className="btn btn-outline-navy btn-sm gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <Phone className="h-3.5 w-3.5" />
                  +{status.businessNumber}
                </button>
              </a>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("dashboard.settings.whatsapp.yourNumberLabel")}</label>
            <div className="flex gap-2">
              <Input
                placeholder="+1 416 555 0123"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && phoneInput.trim()) handleConnect(); }}
                className="flex-1"
                disabled={status?.available === false}
              />
              <button onClick={handleConnect}
                disabled={!phoneInput.trim() || connectWa.isPending || status?.available === false}
                className="btn btn-navy gap-2 btn-gradient">
                {connectWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("dashboard.settings.whatsapp.connectButton")}
              </button>
            </div>
            {status?.available === false ? <NotAvailableNote /> : <p className="text-xs text-muted-foreground">{t("dashboard.settings.whatsapp.formatHint")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickbooksUpsellCard() {
  const { t } = useLanguage();
  const createCheckout = useCreateCheckoutSession();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = () => {
    setLoading(true);
    createCheckout.mutate(
      { data: { planType: "monthly_elite" } },
      {
        onSuccess: (r) => { window.location.href = r.url; },
        onError: () => {
          setLoading(false);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="card border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
            <Plug className="h-6 w-6 text-navy-500" />
          </div>
          <div>
            <h2>{t("dashboard.settings.quickbooksUpsell.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.quickbooksUpsell.desc")}</p>
          </div>
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleCheckout} disabled={loading} className="btn btn-navy gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t("dashboard.settings.quickbooksUpsell.cta")}
        </button>
      </div>
    </div>
  );
}

function QuickbooksMappingCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useGetQuickbooksStatus();
  const { data: accounts, isLoading: loadingAccounts } = useGetQuickbooksAccounts({ query: { queryKey: getGetQuickbooksAccountsQueryKey(), enabled: !!status?.connected } });
  const updateMapping = useUpdateQuickbooksMapping();

  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [categoryAccountIds, setCategoryAccountIds] = useState<Record<string, string>>({});

  const paymentAccount = accounts?.paymentAccounts.find(a => a.id === paymentAccountId);

  const handleSave = () => {
    const categoryMap: Record<string, { id: string; name: string } | null> = {};
    for (const c of COST_CATEGORY_KEYS) {
      const id = categoryAccountIds[c];
      const account = accounts?.expenseAccounts.find(a => a.id === id);
      categoryMap[c] = account ? { id: account.id, name: account.name } : null;
    }
    updateMapping.mutate(
      { data: { paymentAccount: paymentAccount ? { id: paymentAccount.id, name: paymentAccount.name } : undefined, categoryMap } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() });
          toast({ title: t("dashboard.settings.quickbooks.mappingSaved") });
        },
        onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
      }
    );
  };

  if (loadingAccounts) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.quickbooks.mappingTitle")}</h2>
        <p className="sub">{t("dashboard.settings.quickbooks.mappingDesc")}</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("dashboard.settings.quickbooks.paymentAccount")}</label>
          <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={status?.paymentAccountName ?? t("dashboard.settings.quickbooks.selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              {accounts?.paymentAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">{t("dashboard.settings.quickbooks.categoryMapping")}</label>
          {COST_CATEGORY_KEYS.map((c) => (
            <div key={c} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32 shrink-0">{t(`jobs.cost.${c}`)}</span>
              <Select
                value={categoryAccountIds[c] ?? ""}
                onValueChange={(v) => setCategoryAccountIds(prev => ({ ...prev, [c]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={status?.categoryMap?.[c] ?? t("dashboard.settings.quickbooks.selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.expenseAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleSave} disabled={updateMapping.isPending} className="btn btn-navy gap-2">
          {updateMapping.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.quickbooks.saveMapping")}
        </button>
      </div>
    </div>
  );
}

function QuickbooksSyncLogCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: log } = useGetQuickbooksSyncLog();
  const retry = useRetryQuickbooksSync();

  if (!log || log.entries.length === 0) return null;

  const handleRetry = (entityType: string, entityId: string) => {
    retry.mutate(
      { data: { entityType: entityType as "invoice" | "cost_entry", entityId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuickbooksSyncLogQueryKey() });
          toast({ title: t("dashboard.settings.quickbooks.retried") });
        },
        onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
      }
    );
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.quickbooks.syncLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "synced" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{e.entityType === "invoice" ? t("dashboard.settings.quickbooks.invoice") : t("dashboard.settings.quickbooks.costEntry")}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
            {e.status === "failed" && (
              <button className="btn btn-outline-navy btn-sm gap-1.5 shrink-0" onClick={() => handleRetry(e.entityType, e.entityId)} disabled={retry.isPending}>
                <RefreshCw className="h-3.5 w-3.5" /> {t("dashboard.settings.quickbooks.retry")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickbooksTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetQuickbooksStatus();
  const { data: subscription } = useGetSubscription();
  const getConnectUrl = useGetQuickbooksConnectUrl({ query: { queryKey: getGetQuickbooksConnectUrlQueryKey(), enabled: false } });
  const disconnectQb = useDisconnectQuickbooks();
  const toggleQb = useToggleQuickbooks();

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  const isConnected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectQb.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() });
        toast({ title: t("dashboard.settings.quickbooks.disconnected") });
      },
      onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
    });
  };

  const handleToggle = () => {
    toggleQb.mutate(
      { data: { isEnabled: !isEnabled } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() }),
        onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  if (!isElite) return <QuickbooksUpsellCard />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2>{t("dashboard.settings.quickbooks.connectTitle")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.quickbooks.connectDesc")}</p>
            </div>
          </div>
        </div>
        <div className="card-foot">
          {status?.available === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-navy gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.quickbooks.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <div className="card-head pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg">{status?.companyName || t("dashboard.settings.quickbooks.connectedTitle")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.settings.quickbooks.connectedSince")} {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}</p>
              </div>
            </div>
            <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
              {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
            </span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {status?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.quickbooks.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <button onClick={handleToggle} disabled={toggleQb.isPending} className="btn btn-navy btn-sm gap-2">
              {toggleQb.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
            </button>
            <button onClick={handleDisconnect} disabled={disconnectQb.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
              {disconnectQb.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.quickbooks.disconnect")}
            </button>
          </div>
        </div>
      </div>
      <QuickbooksMappingCard />
      <QuickbooksSyncLogCard />
    </div>
  );
}

function WaveUpsellCard() {
  const { t } = useLanguage();
  const createCheckout = useCreateCheckoutSession();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = () => {
    setLoading(true);
    createCheckout.mutate(
      { data: { planType: "monthly_elite" } },
      {
        onSuccess: (r) => { window.location.href = r.url; },
        onError: () => {
          setLoading(false);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="card border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
            <Plug className="h-6 w-6 text-navy-500" />
          </div>
          <div>
            <h2>{t("dashboard.settings.waveUpsell.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.waveUpsell.desc")}</p>
          </div>
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleCheckout} disabled={loading} className="btn btn-navy gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t("dashboard.settings.waveUpsell.cta")}
        </button>
      </div>
    </div>
  );
}

function WaveMappingCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useGetWaveStatus();
  const { data: accounts, isLoading: loadingAccounts } = useGetWaveAccounts({ query: { queryKey: getGetWaveAccountsQueryKey(), enabled: !!status?.connected } });
  const updateMapping = useUpdateWaveMapping();

  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [incomeAccountId, setIncomeAccountId] = useState<string>("");
  const [categoryAccountIds, setCategoryAccountIds] = useState<Record<string, string>>({});

  const paymentAccount = accounts?.paymentAccounts.find(a => a.id === paymentAccountId);
  const incomeAccount = accounts?.incomeAccounts.find(a => a.id === incomeAccountId);

  const handleSave = () => {
    const categoryMap: Record<string, { id: string; name: string } | null> = {};
    for (const c of COST_CATEGORY_KEYS) {
      const id = categoryAccountIds[c];
      const account = accounts?.expenseAccounts.find(a => a.id === id);
      categoryMap[c] = account ? { id: account.id, name: account.name } : null;
    }
    updateMapping.mutate(
      {
        data: {
          paymentAccount: paymentAccount ? { id: paymentAccount.id, name: paymentAccount.name } : undefined,
          incomeAccount: incomeAccount ? { id: incomeAccount.id, name: incomeAccount.name } : undefined,
          categoryMap,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() });
          toast({ title: t("dashboard.settings.wave.mappingSaved") });
        },
        onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
      }
    );
  };

  if (loadingAccounts) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.wave.mappingTitle")}</h2>
        <p className="sub">{t("dashboard.settings.wave.mappingDesc")}</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("dashboard.settings.wave.paymentAccount")}</label>
          <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={status?.paymentAccountName ?? t("dashboard.settings.wave.selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              {accounts?.paymentAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("dashboard.settings.wave.incomeAccount")}</label>
          <Select value={incomeAccountId} onValueChange={setIncomeAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={status?.incomeAccountName ?? t("dashboard.settings.wave.selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              {accounts?.incomeAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">{t("dashboard.settings.wave.categoryMapping")}</label>
          {COST_CATEGORY_KEYS.map((c) => (
            <div key={c} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32 shrink-0">{t(`jobs.cost.${c}`)}</span>
              <Select
                value={categoryAccountIds[c] ?? ""}
                onValueChange={(v) => setCategoryAccountIds(prev => ({ ...prev, [c]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={status?.categoryMap?.[c] ?? t("dashboard.settings.wave.selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.expenseAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleSave} disabled={updateMapping.isPending} className="btn btn-navy gap-2">
          {updateMapping.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.wave.saveMapping")}
        </button>
      </div>
    </div>
  );
}

function WaveSyncLogCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: log } = useGetWaveSyncLog();
  const retry = useRetryWaveSync();

  if (!log || log.entries.length === 0) return null;

  const handleRetry = (entityType: string, entityId: string) => {
    retry.mutate(
      { data: { entityType: entityType as "invoice" | "cost_entry", entityId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWaveSyncLogQueryKey() });
          toast({ title: t("dashboard.settings.wave.retried") });
        },
        onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
      }
    );
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.wave.syncLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "synced" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{e.entityType === "invoice" ? t("dashboard.settings.wave.invoice") : t("dashboard.settings.wave.costEntry")}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
            {e.status === "failed" && (
              <button className="btn btn-outline-navy btn-sm gap-1.5 shrink-0" onClick={() => handleRetry(e.entityType, e.entityId)} disabled={retry.isPending}>
                <RefreshCw className="h-3.5 w-3.5" /> {t("dashboard.settings.wave.retry")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WaveTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetWaveStatus();
  const { data: subscription } = useGetSubscription();
  const getConnectUrl = useGetWaveConnectUrl({ query: { queryKey: getGetWaveConnectUrlQueryKey(), enabled: false } });
  const disconnectWaveMutation = useDisconnectWave();
  const toggleWaveMutation = useToggleWave();

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  const isConnected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectWaveMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() });
        toast({ title: t("dashboard.settings.wave.disconnected") });
      },
      onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
    });
  };

  const handleToggle = () => {
    toggleWaveMutation.mutate(
      { data: { isEnabled: !isEnabled } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() }),
        onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  if (!isElite) return <WaveUpsellCard />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2>{t("dashboard.settings.wave.connectTitle")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.wave.connectDesc")}</p>
            </div>
          </div>
        </div>
        <div className="card-foot">
          {status?.available === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-navy gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.wave.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <div className="card-head pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg">{status?.businessName || t("dashboard.settings.wave.connectedTitle")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.settings.wave.connectedSince")} {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}</p>
              </div>
            </div>
            <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
              {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
            </span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {status?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.wave.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <button onClick={handleToggle} disabled={toggleWaveMutation.isPending} className="btn btn-navy btn-sm gap-2">
              {toggleWaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
            </button>
            <button onClick={handleDisconnect} disabled={disconnectWaveMutation.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
              {disconnectWaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.wave.disconnect")}
            </button>
          </div>
        </div>
      </div>
      <WaveMappingCard />
      <WaveSyncLogCard />
    </div>
  );
}

function StripeConnectTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["stripe-connect-status"], queryFn: stripeConnectApi.status });
  const onboard = useMutation({
    mutationFn: stripeConnectApi.onboard,
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("dashboard.settings.stripeConnect.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const chargesEnabled = status?.chargesEnabled ?? false;

  return (
    <div className={cn("card", connected && chargesEnabled ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50" : undefined)}>
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected && chargesEnabled ? "bg-emerald-100" : "bg-navy-100")}>
            <CreditCard className={cn("h-6 w-6", connected && chargesEnabled ? "text-emerald-600" : "text-navy-500")} />
          </div>
          <div>
            <h2>{t("dashboard.settings.stripeConnect.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.stripeConnect.desc")}</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {connected && (
          <span className={cn("chip", chargesEnabled ? "chip-green" : "chip-yellow")}>
            {chargesEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.stripeConnect.active")}</> : <><AlertCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.stripeConnect.onboardingIncomplete")}</>}
          </span>
        )}
      </div>
      <div className="card-foot">
        {status?.available === false ? <NotAvailableNote /> : (
          <button onClick={() => onboard.mutate()} disabled={onboard.isPending} className="btn btn-navy gap-2">
            {onboard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {connected ? (chargesEnabled ? t("dashboard.settings.stripeConnect.manage") : t("dashboard.settings.stripeConnect.finishOnboarding")) : t("dashboard.settings.stripeConnect.connectCta")}
          </button>
        )}
      </div>
    </div>
  );
}

function FinanceitTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["financeit-status"], queryFn: financeitApi.status });
  const [dealerId, setDealerId] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["financeit-status"] });

  const saveDealer = useMutation({
    mutationFn: () => financeitApi.saveDealer(dealerId.trim()),
    onSuccess: () => { invalidate(); setDealerId(""); toast({ title: t("dashboard.settings.financeit.connected") }); },
    onError: () => toast({ title: t("dashboard.settings.financeit.error"), variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => financeitApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.financeit.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: financeitApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.financeit.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.financeit.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  return (
    <div className={cn("card", connected && isEnabled ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : undefined)}>
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected && isEnabled ? "bg-amber-100" : "bg-navy-100")}>
            <Landmark className={cn("h-6 w-6", connected && isEnabled ? "text-amber-600" : "text-navy-500")} />
          </div>
          <div>
            <h2>{t("dashboard.settings.financeit.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.financeit.desc")}</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {connected ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.financeit.active")}</> : t("dashboard.settings.financeit.paused")}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">{t("dashboard.settings.financeit.dealerIdLabel")}: {status?.dealerId}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.financeit.dealerIdHelp")}</p>
            <Input
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
              placeholder={t("dashboard.settings.financeit.dealerIdPlaceholder")}
            />
          </div>
        )}
      </div>
      <div className="card-foot gap-2">
        {connected ? (
          <>
            <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
              {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.financeit.pause") : t("dashboard.settings.financeit.resume")}
            </button>
            <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
              {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.financeit.disconnect")}
            </button>
          </>
        ) : status?.available === false ? (
          <NotAvailableNote />
        ) : (
          <button onClick={() => saveDealer.mutate()} disabled={!dealerId.trim() || saveDealer.isPending} className="btn btn-navy gap-2">
            {saveDealer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t("dashboard.settings.financeit.connectCta")}
          </button>
        )}
      </div>
    </div>
  );
}

function FlinksConnectDialog({ open, onOpenChange, onConnected }: { open: boolean; onOpenChange: (open: boolean) => void; onConnected: (accounts: FlinksAccountDto[]) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: connectUrlData, isLoading } = useQuery({ queryKey: ["flinks-connect-url"], queryFn: flinksApi.connectUrl, enabled: open, retry: false });
  const connectMutation = useMutation({
    mutationFn: ({ loginId, institutionName }: { loginId: string; institutionName: string }) => flinksApi.connect(loginId, institutionName),
    onSuccess: (r) => { onConnected(r.accounts); onOpenChange(false); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });

  useEffect(() => {
    if (!open) return;
    function handleMessage(event: MessageEvent) {
      const data = event.data as { step?: string; loginId?: string; institution?: string } | undefined;
      if (data?.step === "REDIRECT" && data.loginId) {
        connectMutation.mutate({ loginId: data.loginId, institutionName: data.institution ?? "Bank account" });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" tall>
        <DialogHeader>
          <DialogTitle>{t("dashboard.settings.flinks.connectTitle")}</DialogTitle>
          <DialogDescription>{t("dashboard.settings.flinks.connectDialogDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flush">
          {isLoading || !connectUrlData?.url ? (
            <div className="card-empty" style={{ flex: 1, display: "grid", placeItems: "center" }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--faint)" }} /></div>
          ) : (
            <iframe src={connectUrlData.url} title="Flinks Connect" style={{ width: "100%", height: "100%", border: 0, flex: 1 }} />
          )}
          {connectMutation.isPending && (
            <p className="foot-note" style={{ padding: "10px 22px", borderTop: "1px solid var(--soft)", display: "flex", alignItems: "center", gap: 8 }}><Loader2 className="h-3 w-3 animate-spin" /> {t("dashboard.settings.flinks.connecting")}</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function FlinksAccountPicker({ accounts, onPick, isPending }: { accounts: FlinksAccountDto[]; onPick: (a: FlinksAccountDto) => void; isPending: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("dashboard.settings.flinks.pickAccountHelp")}</p>
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={isPending}
          onClick={() => onPick(a)}
          className="w-full text-left px-3 py-2 rounded-[var(--radius-sm)] border border-border hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm flex items-center justify-between disabled:opacity-50"
        >
          <span>{a.name}{a.last4 ? ` ••••${a.last4}` : ""}</span>
          <span className="text-xs text-muted-foreground">{a.institution}</span>
        </button>
      ))}
    </div>
  );
}

function FlinksTransactionsCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["flinks-transactions"], queryFn: flinksApi.transactions });
  const [candidatesFor, setCandidatesFor] = useState<string | null>(null);
  const { data: candidatesData } = useQuery({
    queryKey: ["flinks-candidates", candidatesFor],
    queryFn: () => flinksApi.candidates(candidatesFor!),
    enabled: !!candidatesFor,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["flinks-transactions"] });
  const matchMutation = useMutation({
    mutationFn: ({ id, costEntryId }: { id: string; costEntryId: string }) => flinksApi.match(id, costEntryId),
    onSuccess: () => { invalidate(); setCandidatesFor(null); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const ignoreMutation = useMutation({
    mutationFn: (id: string) => flinksApi.ignore(id),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const unmatchMutation = useMutation({
    mutationFn: (id: string) => flinksApi.unmatch(id),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;
  const transactions = data?.transactions ?? [];
  if (transactions.length === 0) {
    return (
      <div className="card">
        <div className="p-5 py-6 text-sm text-muted-foreground text-center">{t("dashboard.settings.flinks.noTransactions")}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head pb-3">
        <h2 className="text-base">{t("dashboard.settings.flinks.transactionsTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {transactions.map((tx) => (
          <div key={tx.id} className="border border-border rounded-[var(--radius-sm)] p-3 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">{tx.description || t("dashboard.settings.flinks.unlabeledTransaction")}</p>
                <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-semibold", tx.amountCents < 0 ? "text-red-600" : "text-emerald-600")}>
                  {(tx.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" })}
                </span>
                <span
                  className={cn(
                    "chip",
                    tx.matchStatus === "matched" && "chip-green",
                    tx.matchStatus === "ignored" && "chip-grey",
                    tx.matchStatus === "unmatched" && "chip-yellow"
                  )}
                >
                  {t(`dashboard.settings.flinks.status.${tx.matchStatus}`)}
                </span>
              </div>
            </div>
            {tx.matchStatus === "unmatched" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button onClick={() => setCandidatesFor(candidatesFor === tx.id ? null : tx.id)} className="btn btn-outline-navy btn-sm gap-1.5">
                    {t("dashboard.settings.flinks.findMatch")}
                  </button>
                  <button onClick={() => ignoreMutation.mutate(tx.id)} disabled={ignoreMutation.isPending} className="btn btn-outline-navy btn-sm text-muted-foreground">
                    {t("dashboard.settings.flinks.ignore")}
                  </button>
                </div>
                {candidatesFor === tx.id && (
                  <div className="pl-2 border-l-2 border-amber-200 space-y-1.5">
                    {(candidatesData?.candidates.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("dashboard.settings.flinks.noCandidates")}</p>
                    ) : (
                      candidatesData!.candidates.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={matchMutation.isPending}
                          onClick={() => matchMutation.mutate({ id: tx.id, costEntryId: c.id })}
                          className="w-full text-left px-2.5 py-1.5 rounded-md border border-border hover:border-amber-300 hover:bg-amber-50 text-xs flex items-center justify-between disabled:opacity-50"
                        >
                          <span>{c.vendor || c.description || t("dashboard.settings.flinks.unlabeledTransaction")}</span>
                          <span className="text-muted-foreground">{new Date(c.date).toLocaleDateString()}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {tx.matchStatus === "matched" && (
              <button onClick={() => unmatchMutation.mutate(tx.id)} disabled={unmatchMutation.isPending} className="btn btn-outline-navy btn-sm text-muted-foreground h-7 px-2 text-xs">
                {t("dashboard.settings.flinks.undoMatch")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlinksTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["flinks-status"], queryFn: flinksApi.status });
  const [showConnect, setShowConnect] = useState(false);
  const [pendingAccounts, setPendingAccounts] = useState<FlinksAccountDto[] | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["flinks-status"] });
  const selectAccountMutation = useMutation({
    mutationFn: (a: FlinksAccountDto) => flinksApi.selectAccount(a),
    onSuccess: () => { invalidate(); setPendingAccounts(null); toast({ title: t("dashboard.settings.flinks.connected") }); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => flinksApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: flinksApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.flinks.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const sync = useMutation({
    mutationFn: flinksApi.sync,
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ["flinks-transactions"] }); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;
  const hasAccount = !!status?.selectedAccount;

  return (
    <div className="space-y-4">
      <div className={cn("card", connected && hasAccount && isEnabled ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : undefined)}>
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected && hasAccount ? "bg-amber-100" : "bg-navy-100")}>
              <Banknote className={cn("h-6 w-6", connected && hasAccount ? "text-amber-600" : "text-navy-500")} />
            </div>
            <div>
              <h2>{t("dashboard.settings.flinks.title")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.flinks.desc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {!connected && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.flinks.connectHelp")}</p>
          )}
          {connected && !hasAccount && (
            pendingAccounts ? (
              <FlinksAccountPicker accounts={pendingAccounts} onPick={(a) => selectAccountMutation.mutate(a)} isPending={selectAccountMutation.isPending} />
            ) : (
              <p className="text-xs text-muted-foreground">{t("dashboard.settings.flinks.noAccountSelected")}</p>
            )
          )}
          {connected && hasAccount && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                  {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.financeit.active")}</> : t("dashboard.settings.financeit.paused")}
                </span>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {status?.institutionName} — {status?.selectedAccount?.name}{status?.selectedAccount?.last4 ? ` ••••${status.selectedAccount.last4}` : ""}
                </p>
                {status?.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.flinks.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="card-foot gap-2 flex-wrap">
          {!connected ? (
            status?.available === false ? <NotAvailableNote /> : (
              <button onClick={() => setShowConnect(true)} className="btn btn-navy gap-2">
                <Plug className="h-4 w-4" />
                {t("dashboard.settings.flinks.connectCta")}
              </button>
            )
          ) : (
            <>
              {hasAccount && (
                <button onClick={() => sync.mutate()} disabled={sync.isPending} className="btn btn-outline-navy btn-sm gap-2">
                  {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("dashboard.settings.flinks.syncNow")}
                </button>
              )}
              <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.financeit.pause") : t("dashboard.settings.financeit.resume")}
              </button>
              <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.flinks.disconnect")}
              </button>
            </>
          )}
        </div>
      </div>
      {connected && hasAccount && <FlinksTransactionsCard />}
      <FlinksConnectDialog
        open={showConnect}
        onOpenChange={setShowConnect}
        onConnected={(accounts) => { setPendingAccounts(accounts); invalidate(); }}
      />
    </div>
  );
}

function MetaLeadAdsImportLogCard() {
  const { t } = useLanguage();
  const { data: log } = useQuery({ queryKey: ["meta-lead-ads-import-log"], queryFn: metaLeadAdsApi.importLog });

  if (!log || log.entries.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.metaLeadAds.importLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "imported" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{new Date(e.createdAt).toLocaleString()}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaLeadAdsTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["meta-lead-ads-status"], queryFn: metaLeadAdsApi.status });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["meta-lead-ads-status"] });
  const getConnectUrl = useQuery({ queryKey: ["meta-lead-ads-connect-url"], queryFn: metaLeadAdsApi.connectUrl, enabled: false });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => metaLeadAdsApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: metaLeadAdsApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.metaLeadAds.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <div className={cn("card", connected && isEnabled ? "border-blue-200 bg-gradient-to-br from-blue-50 to-navy-50" : undefined)}>
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected ? "bg-blue-100" : "bg-navy-100")}>
              <Megaphone className={cn("h-6 w-6", connected ? "text-blue-600" : "text-navy-500")} />
            </div>
            <div>
              <h2>{t("dashboard.settings.metaLeadAds.title")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.metaLeadAds.desc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {!connected && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.metaLeadAds.connectHelp")}</p>
          )}
          {connected && (
            <div>
              <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">{status?.pageName}</p>
              {status?.lastLeadAt && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.metaLeadAds.lastLead")} {new Date(status.lastLeadAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
        <div className="card-foot gap-2 flex-wrap">
          {!connected ? (
            status?.available === false ? <NotAvailableNote /> : (
              <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-navy gap-2">
                {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                {t("dashboard.settings.metaLeadAds.connectCta")}
              </button>
            )
          ) : (
            <>
              <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
              </button>
              <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.metaLeadAds.disconnect")}
              </button>
            </>
          )}
        </div>
      </div>
      {connected && <MetaLeadAdsImportLogCard />}
    </div>
  );
}

function GoogleLsaImportLogCard() {
  const { t } = useLanguage();
  const { data: log } = useQuery({ queryKey: ["google-lsa-import-log"], queryFn: googleLsaApi.importLog });

  if (!log || log.entries.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.googleLsa.importLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "imported" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{new Date(e.createdAt).toLocaleString()}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleLsaTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["google-lsa-status"], queryFn: googleLsaApi.status });
  const [lsaCustomerId, setLsaCustomerId] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["google-lsa-status"] });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => googleLsaApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: googleLsaApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.googleLsa.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }),
  });
  const connect = useMutation({
    mutationFn: (id: string) => googleLsaApi.connectUrl(id),
    onSuccess: (result) => { if (result.url) window.location.href = result.url; else toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }); },
    onError: () => toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  return (
    <div className="space-y-4">
      <div className={cn("card", connected && isEnabled ? "border-blue-200 bg-gradient-to-br from-blue-50 to-navy-50" : undefined)}>
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected ? "bg-blue-100" : "bg-navy-100")}>
              <Search className={cn("h-6 w-6", connected ? "text-blue-600" : "text-navy-500")} />
            </div>
            <div>
              <h2>{t("dashboard.settings.googleLsa.title")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.googleLsa.desc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {!connected && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("dashboard.settings.googleLsa.connectHelp")}</p>
              <Input
                value={lsaCustomerId}
                onChange={(e) => setLsaCustomerId(e.target.value)}
                placeholder={t("dashboard.settings.googleLsa.customerIdPlaceholder")}
                className="max-w-xs"
              />
            </div>
          )}
          {connected && (
            <div>
              <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">{status?.lsaCustomerId}</p>
              {status?.lastLeadAt && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.googleLsa.lastLead")} {new Date(status.lastLeadAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
        <div className="card-foot gap-2 flex-wrap">
          {!connected ? (
            status?.available === false ? <NotAvailableNote /> : (
              <button onClick={() => connect.mutate(lsaCustomerId)} disabled={connect.isPending || !lsaCustomerId.trim()} className="btn btn-navy gap-2">
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                {t("dashboard.settings.googleLsa.connectCta")}
              </button>
            )
          ) : (
            <>
              <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
              </button>
              <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.googleLsa.disconnect")}
              </button>
            </>
          )}
        </div>
      </div>
      {connected && <GoogleLsaImportLogCard />}
    </div>
  );
}

function DeveloperApiTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: keysData, isLoading: keysLoading } = useQuery({ queryKey: ["developer-api-keys"], queryFn: developerApi.listKeys });
  const { data: webhooksData, isLoading: webhooksLoading } = useQuery({ queryKey: ["developer-webhooks"], queryFn: developerApi.listWebhooks });
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<AutomationEventName[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;

  const createKey = useMutation({
    mutationFn: () => developerApi.createKey(keyName.trim()),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["developer-api-keys"] });
      setKeyName("");
      setRevealedKey(res.rawKey);
    },
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => developerApi.revokeKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-api-keys"] }),
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const createWebhook = useMutation({
    mutationFn: () => developerApi.createWebhook(webhookUrl.trim(), webhookEvents),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] });
      setWebhookUrl("");
      setWebhookEvents([]);
      setRevealedSecret(res.secret);
    },
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const toggleWebhook = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => developerApi.toggleWebhook(id, isEnabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] }),
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const deleteWebhook = useMutation({
    mutationFn: (id: string) => developerApi.deleteWebhook(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] }),
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });

  if (!isElite) return null;

  const keys = keysData?.items ?? [];
  const events = keysData?.events ?? webhooksData?.events ?? [];
  const webhooks = webhooksData?.items ?? [];

  return (
    <div className="card">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center bg-slate-100">
            <KeyRound className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h2>{t("dashboard.settings.developerApi.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.developerApi.desc")}</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-6">
        {/* API keys */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">{t("dashboard.settings.developerApi.apiKeys")}</h4>
          {revealedKey && (
            <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs text-amber-800">{t("dashboard.settings.developerApi.keyRevealWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-card border rounded px-2 py-1.5 flex-1 overflow-x-auto">{revealedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(revealedKey); toast({ title: t("dashboard.settings.developerApi.copied") }); }} className="btn btn-outline-navy btn-sm">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <button onClick={() => setRevealedKey(null)} className="btn btn-outline-navy btn-sm">{t("dashboard.settings.developerApi.dismiss")}</button>
            </div>
          )}
          {keysLoading ? <Skeleton className="h-16 w-full rounded-[var(--radius-sm)]" /> : (
            <div className="space-y-2">
              {keys.filter(k => !k.revokedAt).map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border p-2.5">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">{k.keyPrefix}••••••••• · {k.role}</p>
                  </div>
                  <button className="btn btn-outline-navy btn-sm text-red-600 hover:text-red-700" onClick={() => revokeKey.mutate(k.id)} disabled={revokeKey.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={t("dashboard.settings.developerApi.keyNamePlaceholder")} className="max-w-xs" />
            <button onClick={() => createKey.mutate()} disabled={!keyName.trim() || createKey.isPending} className="btn btn-navy btn-sm gap-2">
              {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("dashboard.settings.developerApi.createKey")}
            </button>
          </div>
        </div>

        {/* Webhooks */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Webhook className="h-4 w-4" /> {t("dashboard.settings.developerApi.webhooks")}</h4>
          {revealedSecret && (
            <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs text-amber-800">{t("dashboard.settings.developerApi.secretRevealWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-card border rounded px-2 py-1.5 flex-1 overflow-x-auto">{revealedSecret}</code>
                <button onClick={() => { navigator.clipboard.writeText(revealedSecret); toast({ title: t("dashboard.settings.developerApi.copied") }); }} className="btn btn-outline-navy btn-sm">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <button onClick={() => setRevealedSecret(null)} className="btn btn-outline-navy btn-sm">{t("dashboard.settings.developerApi.dismiss")}</button>
            </div>
          )}
          {webhooksLoading ? <Skeleton className="h-16 w-full rounded-[var(--radius-sm)]" /> : (
            <div className="space-y-2">
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border p-2.5">
                  <div>
                    <p className="text-sm font-medium break-all">{w.url}</p>
                    <p className="text-xs text-muted-foreground">{w.events.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleWebhook.mutate({ id: w.id, isEnabled: !w.isEnabled })} disabled={toggleWebhook.isPending} className="btn btn-outline-navy btn-sm">
                      {w.isEnabled ? t("dashboard.settings.developerApi.pause") : t("dashboard.settings.developerApi.resume")}
                    </button>
                    <button className="btn btn-outline-navy btn-sm text-red-600 hover:text-red-700" onClick={() => deleteWebhook.mutate(w.id)} disabled={deleteWebhook.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder={t("dashboard.settings.developerApi.webhookUrlPlaceholder")} />
            <div className="flex flex-wrap gap-1.5">
              {events.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => setWebhookEvents((prev) => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])}
                  className={cn("text-xs px-2 py-1 rounded-full border", webhookEvents.includes(ev) ? "bg-gray-900 text-white border-gray-900" : "bg-card text-muted-foreground border-border")}
                >
                  {ev}
                </button>
              ))}
            </div>
            <button onClick={() => createWebhook.mutate()} disabled={!webhookUrl.trim() || webhookEvents.length === 0 || createWebhook.isPending} className="btn btn-navy btn-sm gap-2">
              {createWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
              {t("dashboard.settings.developerApi.addWebhook")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CALENDAR_PROVIDER_LABEL: Record<CalendarProvider, string> = { google: "Google Calendar", outlook: "Outlook" };

function CalendarProviderCard({ provider }: { provider: CalendarProvider }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetCalendarStatus();
  const getConnectUrl = useGetCalendarConnectUrl(provider, { query: { queryKey: getGetCalendarConnectUrlQueryKey(provider), enabled: false } });
  const disconnectCal = useDisconnectCalendar();
  const toggleCal = useToggleCalendar();

  const conn = status?.connections.find((c) => c.provider === provider);
  const isConnected = !!conn;
  const isEnabled = conn?.isEnabled ?? true;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetCalendarStatusQueryKey() });

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectCal.mutate(
      { provider },
      { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.calendar.disconnected") }); }, onError: () => toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" }) }
    );
  };

  const handleToggle = () => {
    toggleCal.mutate(
      { provider, data: { isEnabled: !isEnabled } },
      { onSuccess: invalidate, onError: () => toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" }) }
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-sky-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <h2 className="text-base">{CALENDAR_PROVIDER_LABEL[provider]}</h2>
          </div>
        </div>
        <div className="card-foot">
          {status?.available?.[provider] === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-outline-navy btn-sm gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.calendar.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card border-sky-200 bg-gradient-to-br from-sky-50 to-teal-50">
      <div className="card-head pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-sky-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-base">{CALENDAR_PROVIDER_LABEL[provider]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{conn?.accountEmail}</p>
            </div>
          </div>
          <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
            {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
          </span>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {conn?.lastSyncedAt && (
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.calendar.lastSynced")} {new Date(conn.lastSyncedAt).toLocaleString()}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button onClick={handleToggle} disabled={toggleCal.isPending} className="btn btn-navy btn-sm gap-2">
            {toggleCal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
          </button>
          <button onClick={handleDisconnect} disabled={disconnectCal.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
            {disconnectCal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            {t("dashboard.settings.calendar.disconnect")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarSyncTab() {
  const { t } = useLanguage();
  const { data: subscription } = useGetSubscription();
  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{t("dashboard.settings.calendar.title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.calendar.desc")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CalendarProviderCard provider="google" />
        <CalendarProviderCard provider="outlook" />
      </div>
    </div>
  );
}

function EmailConnectionCard() {
  const provider = "google" as const;
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetEmailConnectionsStatus();
  const getConnectUrl = useGetEmailConnectionConnectUrl(provider, { query: { queryKey: getGetEmailConnectionConnectUrlQueryKey(provider), enabled: false } });
  const disconnectEmail = useDisconnectEmailConnection();
  const toggleEmail = useToggleEmailConnection();

  const conn = status?.connections.find((c) => c.provider === provider);
  const isConnected = !!conn;
  const isEnabled = conn?.isEnabled ?? true;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetEmailConnectionsStatusQueryKey() });

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectEmail.mutate(
      { provider },
      { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.emailSend.disconnected") }); }, onError: () => toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" }) }
    );
  };

  const handleToggle = () => {
    toggleEmail.mutate(
      { provider, data: { isEnabled: !isEnabled } },
      { onSuccess: invalidate, onError: () => toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" }) }
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-rose-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-rose-600" />
            </div>
            <h2 className="text-base">Gmail</h2>
          </div>
        </div>
        <div className="card-foot">
          {status?.available?.google === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-outline-navy btn-sm gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.emailSend.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50">
      <div className="card-head pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-rose-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base">Gmail</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{conn?.accountEmail}</p>
            </div>
          </div>
          <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
            {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
          </span>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {conn?.lastSendError ? (
          <p className="text-xs text-red-600">{t("dashboard.settings.emailSend.lastSendFailed")}</p>
        ) : conn?.lastSendAt ? (
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.emailSend.lastSend")} {new Date(conn.lastSendAt).toLocaleString()}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button onClick={handleToggle} disabled={toggleEmail.isPending} className="btn btn-navy btn-sm gap-2">
            {toggleEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
          </button>
          <button onClick={handleDisconnect} disabled={disconnectEmail.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
            {disconnectEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            {t("dashboard.settings.emailSend.disconnect")}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailSendTab() {
  const { t } = useLanguage();
  const { data: subscription } = useGetSubscription();
  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{t("dashboard.settings.emailSend.title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.emailSend.desc")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EmailConnectionCard />
      </div>
    </div>
  );
}

function WidgetTab() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useGetBusinessProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<"key" | "code" | null>(null);

  const apiKey = (profile as any)?.apiKey || "";

  const handleGenerateKey = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/business-profile/apikey", { method: "POST" });
      if (!res.ok) throw new Error(t("dashboard.settings.widget.errorGenerating"));
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.settings.widget.apiKeyGenerated") });
    } catch (err) {
      toast({
        title: t("dashboard.settings.widget.errorGenerating"),
        description: err instanceof Error ? err.message : t("dashboard.settings.widget.tryAgainLater"),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, type: "key" | "code") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast({ title: t("dashboard.settings.widget.copiedToClipboard") });
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      </div>
    );
  }

  const widgetUrl = typeof window !== "undefined" ? `${window.location.origin}/widget.js` : "https://quoteai.ca/widget.js";

  const embedCode = `<!-- QuoteAI Widget Funnel -->
<div id="quoteai-widget">
  <a href="https://quoteai.ca" rel="noopener">${t("dashboard.settings.widget.embedAnchorText")}</a>
</div>
<script
  src="${widgetUrl}"
  data-api-key="${apiKey || t("dashboard.settings.widget.embedKeyPlaceholder")}"
  async
></script>`;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
              <Zap className="h-6 w-6 text-navy-600" />
            </div>
            <div>
              <h2>{t("dashboard.settings.widget.title")}</h2>
              <p className="sub mt-0.5">
                {t("dashboard.settings.widget.desc")}
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t("dashboard.settings.widget.step1Title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.settings.widget.step1Desc")}
            </p>
            {apiKey ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={apiKey}
                  className="font-mono text-sm bg-muted flex-1"
                />
                <button onClick={() => copyToClipboard(apiKey, "key")}
                  className="btn btn-outline-navy gap-2 shrink-0">
                  {copied === "key" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copy")}
                </button>
                <button onClick={handleGenerateKey}
                  disabled={generating}
                  className="btn btn-outline-navy text-muted-foreground hover:text-foreground shrink-0">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <div className="bg-muted rounded-[var(--radius)] p-4 text-center border border-dashed border-border">
                <p className="text-sm text-muted-foreground mb-3">{t("dashboard.settings.widget.noKeyDesc")}</p>
                <button onClick={handleGenerateKey}
                  disabled={generating}
                  className="btn btn-navy btn-gradient gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("dashboard.settings.widget.generateKeyButton")}
                </button>
              </div>
            )}
          </div>

          {apiKey && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold">{t("dashboard.settings.widget.step2Title")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.settings.widget.step2Desc")}
              </p>
              <div className="relative">
                <pre className="p-4 bg-gray-900 text-gray-100 rounded-[var(--radius)] overflow-x-auto font-mono text-xs leading-relaxed max-h-48 whitespace-pre-wrap">
                  {embedCode}
                </pre>
                <button onClick={() => copyToClipboard(embedCode, "code")}
                  className="btn btn-navy btn-sm absolute right-3 top-3 gap-1.5">
                  {copied === "code" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copyCode")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageMeter({ label, used, allowance }: { label: string; used: number; allowance: number | null }) {
  const pct = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {used} {allowance !== null ? `/ ${allowance}` : "(unlimited)"}
        </span>
      </div>
      {allowance !== null && (
        <div className="hbar">
          <i style={{ width: `${pct}%`, background: pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow-dark)" : "var(--green)" }} />
        </div>
      )}
    </div>
  );
}

function UsageTab() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({ queryKey: ["usage-summary"], queryFn: usageApi.summary });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  if (!data) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t("dashboard.settings.tabs.usage")}</h2>
        <p className="sub">{t("dashboard.settings.usage.subtitle")}</p>
      </div>
      <div className="p-5 space-y-5">
        <UsageMeter label={t("dashboard.settings.usage.receiptScans")} used={data.receiptScans.used} allowance={data.receiptScans.allowance} />
        <UsageMeter label={t("dashboard.settings.usage.whatsappMessages")} used={data.whatsappMessages.used} allowance={data.whatsappMessages.allowance} />
        <p className="text-xs text-muted-foreground pt-2 border-t">{t("dashboard.settings.usage.resetNote")}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isAccountPath = typeof window !== "undefined" && window.location.pathname.includes("/account");
  const tabFromParam = params.get("tab");
  const { data: subscription } = useGetSubscription();
  const isProOrElite = subscription?.isActive && (subscription?.plan === "monthly_pro" || subscription?.plan === "monthly_elite");
  const isElite = subscription?.isActive && subscription?.plan === "monthly_elite";
  const defaultTab = (isAccountPath || tabFromParam === "account") ? "account" : tabFromParam === "business" ? "business" : tabFromParam === "whatsapp" ? "whatsapp" : tabFromParam === "widget" ? "widget" : tabFromParam === "usage" ? "usage" : tabFromParam === "integrations" ? "integrations" : tabFromParam === "security" ? "security" : "billing";
  const [activeTab, setActiveTab] = useState<"account" | "business" | "billing" | "whatsapp" | "widget" | "usage" | "integrations" | "security">(defaultTab as any);

  const TABS = [
    { id: "account" as const, label: t("dashboard.settings.tabs.account") },
    { id: "business" as const, label: t("dashboard.settings.tabs.business") },
    { id: "billing" as const, label: t("dashboard.settings.tabs.billing") },
    ...(isProOrElite ? [{ id: "whatsapp" as const, label: t("dashboard.settings.tabs.whatsapp") }] : []),
    { id: "widget" as const, label: t("dashboard.settings.tabs.widget") },
    { id: "usage" as const, label: t("dashboard.settings.tabs.usage") },
    ...(isElite ? [{ id: "integrations" as const, label: t("dashboard.settings.tabs.integrations") }] : []),
    { id: "security" as const, label: t("dashboard.settings.tabs.security") },
  ];

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-navy-500" />{t("dashboard.settings.title")}</h1>
          <p className="sub">{t("dashboard.settings.subtitle")}</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="pills mb-4">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn("pill", activeTab === tab.id && "on")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "account" ? (
        <AccountTab />
      ) : activeTab === "business" ? (
        <BusinessTab />
      ) : activeTab === "whatsapp" ? (
        <WhatsappTab />
      ) : activeTab === "widget" ? (
        <WidgetTab />
      ) : activeTab === "usage" ? (
        <UsageTab />
      ) : activeTab === "integrations" ? (
        <div className="space-y-6">
          <StripeConnectTab />
          <FinanceitTab />
          <QuickbooksTab />
          <WaveTab />
          <FlinksTab />
          <MetaLeadAdsTab />
          <GoogleLsaTab />
          <CalendarSyncTab />
          <EmailSendTab />
          <DeveloperApiTab />
        </div>
      ) : activeTab === "security" ? (
        <SecurityTab />
      ) : (
        <BillingTab />
      )}
    </div>
  );
}
