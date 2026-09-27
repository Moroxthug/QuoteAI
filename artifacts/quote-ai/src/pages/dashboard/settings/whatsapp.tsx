import { SettingsSection } from "./ui";
import { useState } from "react";
import { useGetSubscription, useGetWhatsappStatus, useConnectWhatsapp, useVerifyWhatsapp, useDisconnectWhatsapp, useToggleWhatsapp, getGetWhatsappStatusQueryKey, useGetWhatsappUsage, useCreateCheckoutSession } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crown, CheckCircle2, XCircle, BarChart3, AlertCircle, MessageCircle, Phone, Link2Off, FileText, Mic, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { NotAvailableNote } from "./shared";

function WhatsappUpsellCard() {
  const { t } = useLanguage();
  const createCheckout = useCreateCheckoutSession();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCheckout = (planId: string) => {
    setLoadingPlanId(planId);
    createCheckout.mutate(
      { data: { planType: planId as "monthly_pro" | "monthly_business" } },
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
              { Icon: FileText, label: t("dashboard.settings.whatsappUpsell.text.label"), desc: t("dashboard.settings.whatsappUpsell.text.desc") },
              { Icon: Mic, label: t("dashboard.settings.whatsappUpsell.voice.label"), desc: t("dashboard.settings.whatsappUpsell.voice.desc") },
              { Icon: Camera, label: t("dashboard.settings.whatsappUpsell.photo.label"), desc: t("dashboard.settings.whatsappUpsell.photo.desc") },
            ].map(item => (
              <div key={item.label} className="bg-card/70 rounded-[var(--radius)] p-3 text-center border border-navy-100">
                <item.Icon className="h-6 w-6 mx-auto mb-1" style={{ color: "var(--navy)" }} aria-hidden="true" />
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>{item.desc}</div>
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
              onClick={() => handleCheckout("monthly_business")}
              disabled={loadingPlanId === "monthly_business"}>
              {loadingPlanId === "monthly_business" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {t("dashboard.settings.whatsappUpsell.upgradeToBusinessPrice")}
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
  const isElite = (subscription?.plan === "monthly_business" || subscription?.plan === "monthly_elite") && subscription?.isActive;
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
              { Icon: FileText, label: t("dashboard.settings.whatsappUpsell.text.label"), desc: t("dashboard.settings.whatsapp.connect.text.desc") },
              { Icon: Mic, label: t("dashboard.settings.whatsappUpsell.voice.label"), desc: t("dashboard.settings.whatsapp.connect.voice.desc") },
              { Icon: Camera, label: t("dashboard.settings.whatsappUpsell.photo.label"), desc: t("dashboard.settings.whatsappUpsell.photo.desc") },
            ].map(item => (
              <div key={item.label} className="bg-muted rounded-[var(--radius)] p-3 text-center">
                <item.Icon className="h-6 w-6 mx-auto mb-1" style={{ color: "var(--navy)" }} aria-hidden="true" />
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>{item.desc}</div>
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

/** Messaging → WhatsApp: quoting from WhatsApp (Phase 5+). Moved as-is; its connect/verify steps are actions, not fields. */
export function WhatsappSection() {
  const { t } = useLanguage();
  return (
    <SettingsSection title={t("settings.section.whatsapp")} intro={t("settings.intro.whatsapp")}>
      <WhatsappTab />
    </SettingsSection>
  );
}
