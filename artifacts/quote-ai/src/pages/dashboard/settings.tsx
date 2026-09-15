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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, X, ImageIcon, Crown, Zap, CheckCircle2, XCircle, CalendarDays, BarChart3, AlertCircle, RefreshCw, ArrowUpRight, MessageCircle, Phone, Link2Off, Plug, Building2, CreditCard, Landmark, KeyRound, Webhook, Copy, Trash2, Mail, Banknote, Megaphone, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
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
      const data = await res.json() as { apiKey: string };
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.settings.account.apiKeyGenerated") });
    } catch (err) {
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
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      {isStarter ? (
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-violet-500" />
              <CardTitle>{t("dashboard.profile.logoProOnly.title")}</CardTitle>
            </div>
            <CardDescription>
              {t("dashboard.settings.account.logoStarterDesc1")}<br/>
              {t("dashboard.settings.account.logoStarterDesc2")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                {[t("dashboard.profile.logoProOnly.feature1"), t("dashboard.profile.logoProOnly.feature2"), t("dashboard.profile.logoProOnly.feature3")].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm"><span className="text-violet-500 font-bold">✓</span> {f}</div>
                ))}
              </div>
              <Button onClick={() => createPortal.mutate(undefined, { onSuccess: (r) => { window.open(r.url, "_blank"); } })} disabled={createPortal.isPending}>
                {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                {t("dashboard.profile.logoProOnly.upgradeButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.profile.logo.title")}</CardTitle>
            <CardDescription>{t("dashboard.settings.account.logoDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-32 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
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
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo} className="gap-2">
                  {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploadingLogo ? t("dashboard.profile.logo.uploading") : t("dashboard.profile.logo.uploadButton")}
                </Button>
                {currentLogoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-2 text-destructive hover:text-destructive block">
                    <X className="h-4 w-4" />{t("dashboard.profile.logo.remove")}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.account.logoFormatsShort")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.profile.businessData.title")}</CardTitle>
              <CardDescription>{t("dashboard.profile.businessData.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
            <CardFooter className="flex justify-end border-t p-6">
              <Button type="submit" disabled={updateProfile.isPending} className="min-w-[120px]">
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {t("dashboard.profile.businessData.saveButton")}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>

      {/* Widget Funnel Integration Card */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-500" />
            <CardTitle>{t("dashboard.settings.account.widgetCard.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("dashboard.settings.account.widgetCard.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <Button
                    onClick={handleGenerateApiKey}
                    disabled={generatingKey}
                    variant="outline"
                    className="shrink-0"
                  >
                    {generatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    {t("dashboard.settings.account.widgetCard.regenerate")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <FormLabel className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">{t("dashboard.settings.account.widgetCard.embedCodeLabel")}</FormLabel>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.account.widgetCard.embedCodeDesc")}</p>
                <div className="relative">
                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto font-mono text-[10px] leading-relaxed max-h-40 whitespace-pre-wrap select-all border border-slate-800">
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
                  <Button
                    size="sm"
                    onClick={() => {
                      const code = `<!-- QuoteAI Widget Funnel -->\n<div id="quoteai-widget">\n  <a href="https://quoteai.ca" rel="noopener">${t("dashboard.settings.account.widgetCard.embedAnchorText")}</a>\n</div>\n<script\n  src="${typeof window !== "undefined" ? window.location.origin : "https://quoteai.ca"}/widget.js"\n  data-api-key="${profile.apiKey}"\n  async\n></script>`;
                      navigator.clipboard.writeText(code);
                      toast({ title: t("dashboard.settings.account.widgetCard.codeCopiedTitle"), description: t("dashboard.settings.account.widgetCard.codeCopiedDesc") });
                    }}
                    className="absolute right-3 top-3 text-[10px] font-semibold h-7 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    {t("dashboard.settings.account.widgetCard.copy")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed rounded-xl bg-muted/10 space-y-3">
              <p className="text-sm text-muted-foreground">{t("dashboard.settings.account.widgetCard.noApiKeyDesc")}</p>
              <Button onClick={handleGenerateApiKey} disabled={generatingKey}>
                {generatingKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                {t("dashboard.settings.account.widgetCard.enableWidgetButton")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("dashboard.billing.quotesUsed")}</span><span className="font-semibold">{used} / {limit}</span></div>
      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
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

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
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
        <Card className={`border-2 ${isElite ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50" : isPro ? "border-amber-300 bg-gradient-to-br from-amber-50 to-violet-50" : "border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${isElite ? "bg-amber-200" : isPro ? "bg-amber-100" : "bg-violet-100"}`}>
                  {isElite ? <Crown className="h-6 w-6 text-amber-700" /> : isPro ? <Crown className="h-6 w-6 text-amber-600" /> : <Zap className="h-6 w-6 text-violet-500" />}
                </div>
                <div>
                  <CardTitle className="text-xl">QuoteAI {planLabel}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{planPrice}</p>
                </div>
              </div>
              <Badge className={`text-xs ${isElite ? "bg-amber-100 text-amber-800 border-amber-300" : isPro ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-violet-100 text-violet-700 border-violet-200"}`} variant="outline">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.billing.active")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {isStarter && sub.quotaUsed != null && sub.quotaLimit != null && (
              <div className="bg-card/70 rounded-xl p-4 border border-violet-100">
                <div className="flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-violet-500" /><span className="text-sm font-semibold">{t("dashboard.billing.monthlyUsage")}</span></div>
                <QuotaBar used={sub.quotaUsed} limit={sub.quotaLimit} />
                {resetDate && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><RefreshCw className="h-3 w-3" />{t("dashboard.billing.quotaResetsOn").replace("{date}", resetDate)}</p>}
                {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("dashboard.settings.billing.almostOutShort")}
                  </div>
                )}
              </div>
            )}
            <div className="bg-card/70 rounded-xl p-4 border border-violet-100">
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
                <Button onClick={handleManage} disabled={createPortal.isPending} className="gap-2">
                  {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}{isStarter ? t("dashboard.billing.upgradeToPro") : t("dashboard.settings.billing.upgradeToElite")}
                </Button>
              )}
              <Button variant="outline" onClick={handleManage} disabled={createPortal.isPending} className="gap-2">
                <ArrowUpRight className="h-4 w-4" />{t("dashboard.billing.manageSubscription")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.billing.managedByStripeShort")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center"><XCircle className="h-5 w-5 text-muted-foreground" /></div>
                  <div><CardTitle>{t("dashboard.billing.noActiveSubTitle")}</CardTitle><CardDescription className="mt-0.5">{t("dashboard.settings.billing.noActiveSubDesc")}</CardDescription></div>
                </div>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing} className="gap-2 shrink-0">
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("dashboard.settings.billing.verifySubscription")}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {subscriptionPlans.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-4">
              {subscriptionPlans.map((plan) => {
                const isPlanPro = plan.id === "monthly_pro";
                const isPlanElite = plan.id === "monthly_elite";
                return (
                  <Card key={plan.id} className={`flex flex-col ${isPlanPro ? "border-2 border-violet-300 shadow-lg" : isPlanElite ? "border-2 border-amber-300" : ""}`}>
                    <CardHeader className="pb-2">
                      {isPlanPro && <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">{t("dashboard.settings.billing.mostPopular")}</span>}
                      {isPlanElite && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{t("dashboard.settings.billing.unlimited")}</span>}
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <p className="text-2xl font-extrabold">${plan.price}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                      <ul className="space-y-1.5 mb-4">
                        {plan.features.map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isPlanPro ? "text-violet-500" : isPlanElite ? "text-amber-500" : "text-muted-foreground"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter className="pt-3">
                      <Button
                        className={`w-full gap-2 ${isPlanPro ? "btn-gradient" : isPlanElite ? "bg-amber-500 hover:bg-amber-600 text-white border-0" : ""}`}
                        variant={isPlanPro || isPlanElite ? "default" : "outline"}
                        onClick={() => handleCheckout(plan.id)}
                        disabled={loadingPlanId === plan.id}
                      >
                        {loadingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                        {loadingPlanId === plan.id ? t("dashboard.settings.billing.pleaseWait") : t("dashboard.settings.billing.choosePlan").replace("{name}", plan.name)}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {isActive && (isStarter || isPro) && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">{t("dashboard.settings.billing.undetectedSubTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.billing.undetectedSubDesc")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing} className="gap-2 shrink-0">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("dashboard.settings.billing.verifySubscription")}
              </Button>
            </div>
          </CardContent>
        </Card>
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
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.whatsappUpsell.title")}</CardTitle>
              <CardDescription className="mt-0.5">
                {t("dashboard.settings.whatsappUpsell.desc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "📝", label: t("dashboard.settings.whatsappUpsell.text.label"), desc: t("dashboard.settings.whatsappUpsell.text.desc") },
              { icon: "🎙️", label: t("dashboard.settings.whatsappUpsell.voice.label"), desc: t("dashboard.settings.whatsappUpsell.voice.desc") },
              { icon: "📷", label: t("dashboard.settings.whatsappUpsell.photo.label"), desc: t("dashboard.settings.whatsappUpsell.photo.desc") },
            ].map(item => (
              <div key={item.label} className="bg-card/70 rounded-xl p-3 text-center border border-violet-100">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              className="btn-gradient gap-2"
              onClick={() => handleCheckout("monthly_pro")}
              disabled={loadingPlanId === "monthly_pro"}
            >
              {loadingPlanId === "monthly_pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {t("dashboard.settings.whatsappUpsell.upgradeToProPrice")}
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-2"
              onClick={() => handleCheckout("monthly_elite")}
              disabled={loadingPlanId === "monthly_elite"}
            >
              {loadingPlanId === "monthly_elite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {t("dashboard.settings.whatsappUpsell.upgradeToElitePrice")}
            </Button>
          </div>
        </CardContent>
      </Card>
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

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  if (!hasWhatsappAccess) return <WhatsappUpsellCard />;

  if (isConnected) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("dashboard.settings.whatsapp.connectedTitle")}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    +{status?.phoneNumber}
                  </p>
                </div>
              </div>
              <Badge
                className={cn(
                  "text-xs",
                  isEnabled
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-muted text-muted-foreground border-border"
                )}
                variant="outline"
              >
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage != null && usage.limit != null && (
              <div className="bg-card/70 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">{t("dashboard.settings.whatsapp.usageThisMonth")}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("dashboard.settings.whatsapp.used")}</span>
                    <span className="font-semibold">{usage.used} / {usage.limit}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        usage.used >= usage.limit ? "bg-red-500" : usage.used >= usage.limit * 0.8 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.round((usage.used / usage.limit) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("dashboard.settings.whatsapp.remaining").replace("{count}", String(Math.max(0, usage.limit - usage.used)))}</span>
                    <span>{t("dashboard.settings.whatsapp.pctUsed").replace("{pct}", String(Math.min(100, Math.round((usage.used / usage.limit) * 100))))}</span>
                  </div>
                </div>
                {usage.used >= usage.limit && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {t("dashboard.settings.whatsapp.limitReached")}
                  </div>
                )}
                {usage.used < usage.limit && usage.limit - usage.used <= 5 && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {t("dashboard.settings.whatsapp.almostOut")}
                  </div>
                )}
              </div>
            )}
            <div className="bg-card/70 rounded-xl p-4 border border-emerald-100 text-sm text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground mb-2">{t("dashboard.settings.whatsapp.howToUseTitle")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse1")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse2")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse3")}</p>
              <p>{t("dashboard.settings.whatsapp.howToUse4")}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant={isEnabled ? "outline" : "default"}
                size="sm"
                onClick={handleToggle}
                disabled={toggleWa.isPending}
                className="gap-2"
              >
                {toggleWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")} {t("dashboard.settings.whatsapp.integrationSuffix")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectWa.isPending}
                className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              >
                {disconnectWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.whatsapp.disconnectButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (otpState) {
    return (
      <Card className="border-violet-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.whatsapp.enterCodeTitle")}</CardTitle>
              <CardDescription className="mt-0.5">
                {t("dashboard.settings.whatsapp.codeSentDesc").replace("{phone}", otpState.phoneNumber)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-800/40 rounded-xl p-4 text-sm text-violet-700 dark:text-violet-300 space-y-1">
            <p className="font-semibold">{t("dashboard.settings.whatsapp.checkPhone")}</p>
            <p className="text-violet-500">{t("dashboard.settings.whatsapp.codeInstructions")}</p>
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
              <Button
                onClick={handleVerify}
                disabled={otpInput.length !== 6 || verifyWa.isPending}
                className="gap-2 btn-gradient"
              >
                {verifyWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t("dashboard.settings.whatsapp.verify")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.whatsapp.codeValidFor")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { connectWa.mutate({ data: { phoneNumber: otpState.phoneNumber } }); }}
              disabled={connectWa.isPending}
              className="text-muted-foreground gap-2"
            >
              {connectWa.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("dashboard.settings.whatsapp.resendCode")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setOtpState(null); setOtpInput(""); }} className="text-muted-foreground">
              {t("dashboard.settings.whatsapp.cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.whatsapp.connectTitle")}</CardTitle>
              <CardDescription className="mt-0.5">{t("dashboard.settings.whatsapp.connectDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "📝", label: t("dashboard.settings.whatsappUpsell.text.label"), desc: t("dashboard.settings.whatsapp.connect.text.desc") },
              { icon: "🎙️", label: t("dashboard.settings.whatsappUpsell.voice.label"), desc: t("dashboard.settings.whatsapp.connect.voice.desc") },
              { icon: "📷", label: t("dashboard.settings.whatsappUpsell.photo.label"), desc: t("dashboard.settings.whatsappUpsell.photo.desc") },
            ].map(item => (
              <div key={item.label} className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>

          {status?.businessNumber && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
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
                <Button variant="outline" size="sm" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <Phone className="h-3.5 w-3.5" />
                  +{status.businessNumber}
                </Button>
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
              />
              <Button
                onClick={handleConnect}
                disabled={!phoneInput.trim() || connectWa.isPending}
                className="gap-2 btn-gradient"
              >
                {connectWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("dashboard.settings.whatsapp.connectButton")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.whatsapp.formatHint")}</p>
          </div>
        </CardContent>
      </Card>
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
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center">
            <Plug className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <CardTitle>{t("dashboard.settings.quickbooksUpsell.title")}</CardTitle>
            <CardDescription className="mt-0.5">{t("dashboard.settings.quickbooksUpsell.desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardFooter>
        <Button onClick={handleCheckout} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t("dashboard.settings.quickbooksUpsell.cta")}
        </Button>
      </CardFooter>
    </Card>
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

  if (loadingAccounts) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.settings.quickbooks.mappingTitle")}</CardTitle>
        <CardDescription>{t("dashboard.settings.quickbooks.mappingDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={updateMapping.isPending} className="gap-2">
          {updateMapping.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.quickbooks.saveMapping")}
        </Button>
      </CardFooter>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.settings.quickbooks.syncLogTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => handleRetry(e.entityType, e.entityId)} disabled={retry.isPending}>
                <RefreshCw className="h-3.5 w-3.5" /> {t("dashboard.settings.quickbooks.retry")}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
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

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (!isElite) return <QuickbooksUpsellCard />;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.quickbooks.connectTitle")}</CardTitle>
              <CardDescription className="mt-0.5">{t("dashboard.settings.quickbooks.connectDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="gap-2">
            {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t("dashboard.settings.quickbooks.connectCta")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{status?.companyName || t("dashboard.settings.quickbooks.connectedTitle")}</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.settings.quickbooks.connectedSince")} {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}</p>
              </div>
            </div>
            <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
              {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.quickbooks.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button variant={isEnabled ? "outline" : "default"} size="sm" onClick={handleToggle} disabled={toggleQb.isPending} className="gap-2">
              {toggleQb.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnectQb.isPending} className="gap-2 text-red-600 hover:text-red-700">
              {disconnectQb.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.quickbooks.disconnect")}
            </Button>
          </div>
        </CardContent>
      </Card>
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
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center">
            <Plug className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <CardTitle>{t("dashboard.settings.waveUpsell.title")}</CardTitle>
            <CardDescription className="mt-0.5">{t("dashboard.settings.waveUpsell.desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardFooter>
        <Button onClick={handleCheckout} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t("dashboard.settings.waveUpsell.cta")}
        </Button>
      </CardFooter>
    </Card>
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

  if (loadingAccounts) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.settings.wave.mappingTitle")}</CardTitle>
        <CardDescription>{t("dashboard.settings.wave.mappingDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={updateMapping.isPending} className="gap-2">
          {updateMapping.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.wave.saveMapping")}
        </Button>
      </CardFooter>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.settings.wave.syncLogTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => handleRetry(e.entityType, e.entityId)} disabled={retry.isPending}>
                <RefreshCw className="h-3.5 w-3.5" /> {t("dashboard.settings.wave.retry")}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
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

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (!isElite) return <WaveUpsellCard />;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.wave.connectTitle")}</CardTitle>
              <CardDescription className="mt-0.5">{t("dashboard.settings.wave.connectDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="gap-2">
            {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t("dashboard.settings.wave.connectCta")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{status?.businessName || t("dashboard.settings.wave.connectedTitle")}</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.settings.wave.connectedSince")} {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}</p>
              </div>
            </div>
            <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
              {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.wave.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button variant={isEnabled ? "outline" : "default"} size="sm" onClick={handleToggle} disabled={toggleWaveMutation.isPending} className="gap-2">
              {toggleWaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnectWaveMutation.isPending} className="gap-2 text-red-600 hover:text-red-700">
              {disconnectWaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.wave.disconnect")}
            </Button>
          </div>
        </CardContent>
      </Card>
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
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const connected = status?.connected ?? false;
  const chargesEnabled = status?.chargesEnabled ?? false;

  return (
    <Card className={connected && chargesEnabled ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50" : undefined}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", connected && chargesEnabled ? "bg-emerald-100" : "bg-violet-100")}>
            <CreditCard className={cn("h-6 w-6", connected && chargesEnabled ? "text-emerald-600" : "text-violet-500")} />
          </div>
          <div>
            <CardTitle>{t("dashboard.settings.stripeConnect.title")}</CardTitle>
            <CardDescription className="mt-0.5">{t("dashboard.settings.stripeConnect.desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {connected && (
          <Badge className={cn("text-xs", chargesEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200")} variant="outline">
            {chargesEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.stripeConnect.active")}</> : <><AlertCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.stripeConnect.onboardingIncomplete")}</>}
          </Badge>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={() => onboard.mutate()} disabled={onboard.isPending} className="gap-2">
          {onboard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          {connected ? (chargesEnabled ? t("dashboard.settings.stripeConnect.manage") : t("dashboard.settings.stripeConnect.finishOnboarding")) : t("dashboard.settings.stripeConnect.connectCta")}
        </Button>
      </CardFooter>
    </Card>
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
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  return (
    <Card className={connected && isEnabled ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : undefined}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", connected && isEnabled ? "bg-amber-100" : "bg-violet-100")}>
            <Landmark className={cn("h-6 w-6", connected && isEnabled ? "text-amber-600" : "text-violet-500")} />
          </div>
          <div>
            <CardTitle>{t("dashboard.settings.financeit.title")}</CardTitle>
            <CardDescription className="mt-0.5">{t("dashboard.settings.financeit.desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.financeit.active")}</> : t("dashboard.settings.financeit.paused")}
              </Badge>
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
      </CardContent>
      <CardFooter className="gap-2">
        {connected ? (
          <>
            <Button variant="outline" size="sm" onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="gap-2">
              {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.financeit.pause") : t("dashboard.settings.financeit.resume")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="gap-2 text-red-600 hover:text-red-700">
              {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.financeit.disconnect")}
            </Button>
          </>
        ) : (
          <Button onClick={() => saveDealer.mutate()} disabled={!dealerId.trim() || saveDealer.isPending} className="gap-2">
            {saveDealer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t("dashboard.settings.financeit.connectCta")}
          </Button>
        )}
      </CardFooter>
    </Card>
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
      <DialogContent className="max-w-2xl h-[640px] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("dashboard.settings.flinks.connectTitle")}</DialogTitle>
          <DialogDescription>{t("dashboard.settings.flinks.connectDialogDesc")}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 rounded-lg overflow-hidden border border-border bg-muted/30">
          {isLoading || !connectUrlData?.url ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <iframe src={connectUrlData.url} title="Flinks Connect" className="w-full h-full border-0" />
          )}
        </div>
        {connectMutation.isPending && (
          <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> {t("dashboard.settings.flinks.connecting")}</p>
        )}
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
          className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm flex items-center justify-between disabled:opacity-50"
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

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  const transactions = data?.transactions ?? [];
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground text-center">{t("dashboard.settings.flinks.noTransactions")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("dashboard.settings.flinks.transactionsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {transactions.map((tx) => (
          <div key={tx.id} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">{tx.description || t("dashboard.settings.flinks.unlabeledTransaction")}</p>
                <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-semibold", tx.amountCents < 0 ? "text-red-600" : "text-emerald-600")}>
                  {(tx.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" })}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    tx.matchStatus === "matched" && "bg-emerald-100 text-emerald-700 border-emerald-200",
                    tx.matchStatus === "ignored" && "bg-muted text-muted-foreground border-border",
                    tx.matchStatus === "unmatched" && "bg-amber-100 text-amber-800 border-amber-200"
                  )}
                >
                  {t(`dashboard.settings.flinks.status.${tx.matchStatus}`)}
                </Badge>
              </div>
            </div>
            {tx.matchStatus === "unmatched" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCandidatesFor(candidatesFor === tx.id ? null : tx.id)} className="gap-1.5">
                    {t("dashboard.settings.flinks.findMatch")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => ignoreMutation.mutate(tx.id)} disabled={ignoreMutation.isPending} className="text-muted-foreground">
                    {t("dashboard.settings.flinks.ignore")}
                  </Button>
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
              <Button size="sm" variant="ghost" onClick={() => unmatchMutation.mutate(tx.id)} disabled={unmatchMutation.isPending} className="text-muted-foreground h-7 px-2 text-xs">
                {t("dashboard.settings.flinks.undoMatch")}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
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
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;
  const hasAccount = !!status?.selectedAccount;

  return (
    <div className="space-y-4">
      <Card className={connected && hasAccount && isEnabled ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : undefined}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", connected && hasAccount ? "bg-amber-100" : "bg-violet-100")}>
              <Banknote className={cn("h-6 w-6", connected && hasAccount ? "text-amber-600" : "text-violet-500")} />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.flinks.title")}</CardTitle>
              <CardDescription className="mt-0.5">{t("dashboard.settings.flinks.desc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
                <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
                  {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.financeit.active")}</> : t("dashboard.settings.financeit.paused")}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {status?.institutionName} — {status?.selectedAccount?.name}{status?.selectedAccount?.last4 ? ` ••••${status.selectedAccount.last4}` : ""}
                </p>
                {status?.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.flinks.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2 flex-wrap">
          {!connected ? (
            <Button onClick={() => setShowConnect(true)} className="gap-2">
              <Plug className="h-4 w-4" />
              {t("dashboard.settings.flinks.connectCta")}
            </Button>
          ) : (
            <>
              {hasAccount && (
                <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending} className="gap-2">
                  {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("dashboard.settings.flinks.syncNow")}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.financeit.pause") : t("dashboard.settings.financeit.resume")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.flinks.disconnect")}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.settings.metaLeadAds.importLogTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
      </CardContent>
    </Card>
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
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <Card className={connected && isEnabled ? "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50" : undefined}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", connected ? "bg-blue-100" : "bg-violet-100")}>
              <Megaphone className={cn("h-6 w-6", connected ? "text-blue-600" : "text-violet-500")} />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.metaLeadAds.title")}</CardTitle>
              <CardDescription className="mt-0.5">{t("dashboard.settings.metaLeadAds.desc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!connected && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.metaLeadAds.connectHelp")}</p>
          )}
          {connected && (
            <div>
              <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1.5">{status?.pageName}</p>
              {status?.lastLeadAt && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.metaLeadAds.lastLead")} {new Date(status.lastLeadAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2 flex-wrap">
          {!connected ? (
            <Button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.metaLeadAds.connectCta")}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.metaLeadAds.disconnect")}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
      {connected && <MetaLeadAdsImportLogCard />}
    </div>
  );
}

function GoogleLsaImportLogCard() {
  const { t } = useLanguage();
  const { data: log } = useQuery({ queryKey: ["google-lsa-import-log"], queryFn: googleLsaApi.importLog });

  if (!log || log.entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.settings.googleLsa.importLogTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
      </CardContent>
    </Card>
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
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  return (
    <div className="space-y-4">
      <Card className={connected && isEnabled ? "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50" : undefined}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", connected ? "bg-blue-100" : "bg-violet-100")}>
              <Search className={cn("h-6 w-6", connected ? "text-blue-600" : "text-violet-500")} />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.googleLsa.title")}</CardTitle>
              <CardDescription className="mt-0.5">{t("dashboard.settings.googleLsa.desc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
              <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1.5">{status?.lsaCustomerId}</p>
              {status?.lastLeadAt && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.googleLsa.lastLead")} {new Date(status.lastLeadAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2 flex-wrap">
          {!connected ? (
            <Button onClick={() => connect.mutate(lsaCustomerId)} disabled={connect.isPending || !lsaCustomerId.trim()} className="gap-2">
              {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.googleLsa.connectCta")}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.googleLsa.disconnect")}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-slate-100">
            <KeyRound className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <CardTitle>{t("dashboard.settings.developerApi.title")}</CardTitle>
            <CardDescription className="mt-0.5">{t("dashboard.settings.developerApi.desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API keys */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">{t("dashboard.settings.developerApi.apiKeys")}</h4>
          {revealedKey && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs text-amber-800">{t("dashboard.settings.developerApi.keyRevealWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-card border rounded px-2 py-1.5 flex-1 overflow-x-auto">{revealedKey}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(revealedKey); toast({ title: t("dashboard.settings.developerApi.copied") }); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRevealedKey(null)}>{t("dashboard.settings.developerApi.dismiss")}</Button>
            </div>
          )}
          {keysLoading ? <Skeleton className="h-16 w-full rounded-lg" /> : (
            <div className="space-y-2">
              {keys.filter(k => !k.revokedAt).map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">{k.keyPrefix}••••••••• · {k.role}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => revokeKey.mutate(k.id)} disabled={revokeKey.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={t("dashboard.settings.developerApi.keyNamePlaceholder")} className="max-w-xs" />
            <Button size="sm" onClick={() => createKey.mutate()} disabled={!keyName.trim() || createKey.isPending} className="gap-2">
              {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("dashboard.settings.developerApi.createKey")}
            </Button>
          </div>
        </div>

        {/* Webhooks */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Webhook className="h-4 w-4" /> {t("dashboard.settings.developerApi.webhooks")}</h4>
          {revealedSecret && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs text-amber-800">{t("dashboard.settings.developerApi.secretRevealWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-card border rounded px-2 py-1.5 flex-1 overflow-x-auto">{revealedSecret}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(revealedSecret); toast({ title: t("dashboard.settings.developerApi.copied") }); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRevealedSecret(null)}>{t("dashboard.settings.developerApi.dismiss")}</Button>
            </div>
          )}
          {webhooksLoading ? <Skeleton className="h-16 w-full rounded-lg" /> : (
            <div className="space-y-2">
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                  <div>
                    <p className="text-sm font-medium break-all">{w.url}</p>
                    <p className="text-xs text-muted-foreground">{w.events.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => toggleWebhook.mutate({ id: w.id, isEnabled: !w.isEnabled })} disabled={toggleWebhook.isPending}>
                      {w.isEnabled ? t("dashboard.settings.developerApi.pause") : t("dashboard.settings.developerApi.resume")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteWebhook.mutate(w.id)} disabled={deleteWebhook.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
            <Button size="sm" onClick={() => createWebhook.mutate()} disabled={!webhookUrl.trim() || webhookEvents.length === 0 || createWebhook.isPending} className="gap-2">
              {createWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
              {t("dashboard.settings.developerApi.addWebhook")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <CardTitle className="text-base">{CALENDAR_PROVIDER_LABEL[provider]}</CardTitle>
          </div>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleConnect} disabled={getConnectUrl.isFetching} variant="outline" size="sm" className="gap-2">
            {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t("dashboard.settings.calendar.connectCta")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-base">{CALENDAR_PROVIDER_LABEL[provider]}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{conn?.accountEmail}</p>
            </div>
          </div>
          <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
            {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {conn?.lastSyncedAt && (
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.calendar.lastSynced")} {new Date(conn.lastSyncedAt).toLocaleString()}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant={isEnabled ? "outline" : "default"} size="sm" onClick={handleToggle} disabled={toggleCal.isPending} className="gap-2">
            {toggleCal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnectCal.isPending} className="gap-2 text-red-600 hover:text-red-700">
            {disconnectCal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            {t("dashboard.settings.calendar.disconnect")}
          </Button>
        </div>
      </CardContent>
    </Card>
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

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-rose-600" />
            </div>
            <CardTitle className="text-base">Gmail</CardTitle>
          </div>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleConnect} disabled={getConnectUrl.isFetching} variant="outline" size="sm" className="gap-2">
            {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t("dashboard.settings.emailSend.connectCta")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-base">Gmail</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{conn?.accountEmail}</p>
            </div>
          </div>
          <Badge className={cn("text-xs", isEnabled ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border")} variant="outline">
            {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {conn?.lastSendError ? (
          <p className="text-xs text-red-600">{t("dashboard.settings.emailSend.lastSendFailed")}</p>
        ) : conn?.lastSendAt ? (
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.emailSend.lastSend")} {new Date(conn.lastSendAt).toLocaleString()}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant={isEnabled ? "outline" : "default"} size="sm" onClick={handleToggle} disabled={toggleEmail.isPending} className="gap-2">
            {toggleEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnectEmail.isPending} className="gap-2 text-red-600 hover:text-red-700">
            {disconnectEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            {t("dashboard.settings.emailSend.disconnect")}
          </Button>
        </div>
      </CardContent>
    </Card>
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
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center">
              <Zap className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <CardTitle>{t("dashboard.settings.widget.title")}</CardTitle>
              <CardDescription className="mt-0.5">
                {t("dashboard.settings.widget.desc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
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
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(apiKey, "key")}
                  className="gap-2 shrink-0"
                >
                  {copied === "key" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copy")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleGenerateKey}
                  disabled={generating}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="bg-muted rounded-xl p-4 text-center border border-dashed border-border">
                <p className="text-sm text-muted-foreground mb-3">{t("dashboard.settings.widget.noKeyDesc")}</p>
                <Button
                  onClick={handleGenerateKey}
                  disabled={generating}
                  className="btn-gradient gap-2"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("dashboard.settings.widget.generateKeyButton")}
                </Button>
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
                <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl overflow-x-auto font-mono text-xs leading-relaxed max-h-48 whitespace-pre-wrap">
                  {embedCode}
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyToClipboard(embedCode, "code")}
                  className="absolute right-3 top-3 gap-1.5"
                >
                  {copied === "code" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copyCode")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function UsageTab() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({ queryKey: ["usage-summary"], queryFn: usageApi.summary });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.settings.tabs.usage")}</CardTitle>
        <CardDescription>{t("dashboard.settings.usage.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <UsageMeter label={t("dashboard.settings.usage.receiptScans")} used={data.receiptScans.used} allowance={data.receiptScans.allowance} />
        <UsageMeter label={t("dashboard.settings.usage.whatsappMessages")} used={data.whatsappMessages.used} allowance={data.whatsappMessages.allowance} />
        <p className="text-xs text-muted-foreground pt-2 border-t">{t("dashboard.settings.usage.resetNote")}</p>
      </CardContent>
    </Card>
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
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("dashboard.settings.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.settings.subtitle")}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
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
