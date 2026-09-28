// Phase 91: the last steps use team, seat and access-code strings from the dashboard dictionary
// (loaded with this page since Phase 115 — see withDashboardStrings in App.tsx).
// Phase 121: the first run's company basics — three steps, each skippable:
// your work and province first (they pick the examples and the taxes), then
// the business, then the team; the last step hands over to the guided first
// quote (/dashboard/new?first=1).
import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useUpdateBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pointCacheAtOrg } from "@/lib/offline/query-cache";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Upload, X, ImageIcon, ArrowRight, ArrowLeft, Landmark, CalendarClock, Hammer, Users, Mail, Receipt } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { markOnboardingSkipped, markOnboardingDone } from "@/lib/onboarding-state";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { CANADIAN_PROVINCES, defaultPaymentSchedule, type PaymentSchedule } from "@/lib/payment-schedule";
import { TAX_PROFILES, taxComponentLabel, formatRate, type ProvinceCode } from "@/lib/tax-profiles";
import { TradeChips, TeamSizeFields } from "@/components/onboarding/work-step";
import { TeamStep } from "@/components/onboarding/team-step";
import { peopleApi, type CompanySetup, type CompanyTrade } from "@/lib/people-api";
import { teamMembersApi } from "@/lib/team-members-api";
import { ApiImg } from "@/components/api-img";
import { isNativeApp } from "@/lib/native/env";
import { setFirstQuoteStage, signedOutPath } from "@/lib/first-run";

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE_MB = 2;
const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const { t, lang } = useLanguage();
  useDocumentTitle(`${t("onboarding.title")} · QuoteAI`);
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [, setLocation] = useLocation();
  const updateProfile = useUpdateBusinessProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Phase 121: your work + province → your business → your team.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const plan = new URLSearchParams(useSearch()).get("plan");
  const [setup, setSetup] = useState<CompanySetup & { trades: CompanyTrade[] }>({ trades: [] });
  // Someone who joined a company (invite or access code) and owns none has no company to set up.
  const orgsQuery = useQuery({ queryKey: ["team-orgs"], queryFn: teamMembersApi.orgs, enabled: !!isSignedIn });
  const orgs = orgsQuery.data;
  const joinedOnly = !!orgs && orgs.items.length > 0 && !orgs.items.some((o) => o.isOwn);
  useEffect(() => {
    if (joinedOnly) setLocation("/dashboard");
  }, [joinedOnly, setLocation]);
  // Phase 93: an invitation waiting for this address (signed up without the link) is offered before any form —
  // otherwise the only way forward was to start a company of their own.
  const ownsCompany = !!orgs?.items.some((o) => o.isOwn);
  const invitesQuery = useQuery({ queryKey: ["pending-invites"], queryFn: teamMembersApi.pendingInvites, enabled: !!isSignedIn && !!orgs && !ownsCompany && !joinedOnly });
  const [setUpOwn, setSetUpOwn] = useState(false);
  const joinInvite = useMutation({
    mutationFn: (id: string) => teamMembersApi.acceptPendingInvite(id),
    // A full load: the acting company changed (a cookie), and nothing cached belongs to the old one.
    onSuccess: () => { pointCacheAtOrg(null); queryClient.clear(); window.location.href = "/dashboard/me?welcome=1"; },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [province, setProvince] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [etransferEmail, setEtransferEmail] = useState("");
  const [schedule, setSchedule] = useState<PaymentSchedule>(defaultPaymentSchedule(lang));
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Phase 93: nothing is shown until we know whose company this would be (a member who reached this page must never
  // get a form that writes over their employer's profile), and whether an invitation is waiting.
  const deciding = !!isSignedIn && (orgsQuery.isPending || joinedOnly || (invitesQuery.isEnabled && invitesQuery.isPending));
  if (!isLoaded || deciding) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-[3px] border-navy-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    window.location.href = signedOutPath(isNativeApp);
    return null;
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: t("onboarding.unsupportedFormat"), description: t("onboarding.useFormats"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: t("onboarding.fileTooLarge"), description: `${t("onboarding.maxSize")} ${MAX_SIZE_MB} MB`, variant: "destructive" });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/business-profile/logo", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const { logoUrl } = await res.json() as { logoUrl: string };
      setLogoPreview(logoUrl);
      toast({ title: t("onboarding.logoUploaded") });
    } catch {
      toast({ title: t("onboarding.logoUploadError"), variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const pendingInvites = invitesQuery.data?.items ?? [];
  const StepCount = () => <p className="text-xs font-semibold mb-2" style={{ color: "var(--faint)" }}>{t("setup.stepOf").replace("{n}", String(step)).replace("{total}", String(TOTAL_STEPS))}</p>;
  const taxProfile = province && province in TAX_PROFILES ? TAX_PROFILES[province as ProvinceCode] : null;

  /** Province, licence, e-transfer and the default schedule — sent with or without a company name. */
  const saveDetails = async () => {
    if (!province && !licenceNumber.trim() && !etransferEmail.trim()) return;
    const res = await fetch("/api/business-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        province: province || null,
        licenceNumber: licenceNumber.trim() || null,
        etransferEmail: etransferEmail.trim() || null,
        defaultPaymentSchedule: schedule,
      }),
    });
    if (!res.ok) throw new Error("Save failed");
  };

  // The guided first quote (Phase 121): describe one real job → it prices → send it to yourself.
  const toFirstQuote = () => {
    setFirstQuoteStage(userId, "compose");
    setLocation("/dashboard/new?first=1");
  };

  const saveBusiness = async () => {
    if (!companyName.trim()) return;
    setIsSaving(true);
    try {
      const saved = await updateProfile.mutateAsync({
        data: {
          companyName: companyName.trim(),
          vatNumber: vatNumber.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }
      });
      await saveDetails();
      queryClient.setQueryData(getGetBusinessProfileQueryKey(), (old: unknown) => ({
        ...(old && typeof old === "object" ? old : {}),
        ...(saved && typeof saved === "object" ? saved : {}),
        companyName: companyName.trim(),
      }));
      // Phase 91: the answers from "your work" (never blocking: a failure here doesn't stop onboarding).
      if (setup.trades.length) await peopleApi.saveSetup(setup).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      if (userId) markOnboardingDone(userId);
      setStep(3);
    } catch {
      toast({ title: t("onboarding.saveError"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // "Skip for now" on the business: what was already answered is kept, then straight to the first quote.
  const handleSkip = async () => {
    setIsSaving(true);
    await saveDetails().catch(() => undefined);
    if (setup.trades.length) await peopleApi.saveSetup(setup).catch(() => undefined);
    setIsSaving(false);
    if (userId) markOnboardingSkipped(userId);
    toFirstQuote();
  };

  const finishTeam = () => {
    if (setup.teamSize || setup.seatsWanted || setup.fieldCrew !== undefined) void peopleApi.saveSetup(setup).catch(() => undefined);
    toFirstQuote();
  };

  const head = (Icon: typeof Building2, title: string, subtitle: string) => (
    <div className="ob-head text-center mb-8">
      <div className="ob-icon mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
        <Icon className="h-8 w-8" style={{ color: "var(--navy)" }} />
      </div>
      <StepCount />
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{title}</h1>
      <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>{subtitle}</p>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "linear-gradient(180deg, var(--soft), #fff)" }}>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b bg-white/80 backdrop-blur-sm" style={{ borderColor: "var(--soft)" }}>
        <Logo />
        {!(pendingInvites.length > 0 && !setUpOwn) && step === 1 && (
          <button type="button" className="ob-skip" onClick={() => setStep(2)} data-skip-step="">{t("firstRun.skip")}</button>
        )}
      </header>

      <main id="main" className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500" data-step={step}>
          {pendingInvites.length > 0 && !setUpOwn ? (
            <>
              <div className="ob-head text-center mb-8">
                <div className="ob-icon mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <Mail className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{t("onboarding.invite.title")}</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>{t("onboarding.invite.subtitle")}</p>
              </div>
              <div className="stack" style={{ gap: 12 }}>
                {pendingInvites.map((inv) => (
                  <section key={inv.id} className="card p-5 text-center stack" style={{ gap: 12 }} data-pending-invite="">
                    {inv.logoUrl && <ApiImg src={inv.logoUrl} alt="" style={{ maxHeight: 44, margin: "0 auto" }} />}
                    <p className="m-0" style={{ color: "var(--ink)" }}>
                      {t("onboarding.invite.body").replace("{company}", inv.companyName || "—").replace("{role}", t(`join.role.${inv.role}`))}
                    </p>
                    <button type="button" className="btn btn-navy" disabled={joinInvite.isPending} onClick={() => joinInvite.mutate(inv.id)}>
                      {t("onboarding.invite.join").replace("{company}", inv.companyName || "—")} {joinInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    </button>
                  </section>
                ))}
                <button type="button" className="btn btn-outline-navy w-full" onClick={() => setSetUpOwn(true)}>{t("onboarding.invite.own")}</button>
              </div>
            </>
          ) : step === 1 ? (
            <>
              {head(Hammer, t("firstRun.ob.workTitle"), t("firstRun.ob.workSubtitle"))}
              <div className="card">
                <div className="form-grid">
                  <TradeChips value={setup} onChange={setSetup} />
                  <div className="field full">
                    <label htmlFor="province">{t("onboarding.province")}</label>
                    <select id="province" value={province} onChange={(e) => setProvince(e.target.value)}>
                      <option value="">{t("onboarding.provinceSelect")}</option>
                      {CANADIAN_PROVINCES.map((p) => (
                        <option key={p.code} value={p.code}>{lang === "fr" ? p.fr : p.en}</option>
                      ))}
                    </select>
                    <span className="text-[11px] mt-1 flex items-center gap-1" style={{ color: taxProfile ? "var(--teal)" : "var(--faint)" }} data-tax-hint="">
                      <Receipt className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {taxProfile
                        ? t("firstRun.ob.taxLine").replace("{taxes}", taxProfile.components.map((c) => `${taxComponentLabel(c, lang)} ${formatRate(c.rate, lang)}${lang === "fr" ? " %" : "%"}`).join(" + "))
                        : t("firstRun.ob.provinceHint")}
                    </span>
                  </div>
                </div>
                <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <button type="button" onClick={() => setStep(2)} className="btn btn-navy w-full gap-2">
                    {t("onboarding.continueButton")} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : step === 2 ? (
            <>
              {head(Building2, t("onboarding.title"), t("onboarding.subtitle"))}
              <div className="card">
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="companyName">{t("onboarding.companyName")} <span style={{ color: "var(--red)" }}>*</span></label>
                    <input
                      id="companyName"
                      placeholder={t("onboarding.companyNamePlaceholder")}
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      autoComplete="organization"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">{t("onboarding.phone")}</label>
                    <input id="phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" placeholder={t("onboarding.phonePlaceholder")} value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="email">{t("onboarding.businessEmail")}</label>
                    <input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="done" placeholder={t("onboarding.emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>

                <details className="ob-more" data-more-details="">
                  <summary>{t("firstRun.ob.moreDetails")}</summary>
                  <div className="logo-drop">
                    <div className="logo-tile">
                      {logoPreview ? <img src={logoPreview} alt={t("a11y.companyLogo")} /> : <ImageIcon className="h-6 w-6" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 14.5, color: "var(--navy)", display: "block" }}>
                        {t("onboarding.companyLogo")} <span style={{ color: "var(--faint)", fontWeight: 500 }}>({t("onboarding.optional")})</span>
                      </b>
                      <span className="text-xs" style={{ color: "var(--faint)" }}>SVG, PNG, JPG · max 2 MB</span>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                    {logoPreview && (
                      <button type="button" className="btn btn-outline-navy btn-sm" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setLogoPreview(null)}>
                        <X className="h-4 w-4" /> {t("onboarding.remove")}
                      </button>
                    )}
                    <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo}>
                      {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isUploadingLogo ? t("onboarding.uploading") : logoPreview ? t("onboarding.changeLogo") : t("onboarding.uploadLogo")}
                    </button>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="vatNumber">{t("onboarding.businessNumber")}</label>
                      <input id="vatNumber" placeholder="123456789 RT0001" value={vatNumber} onChange={e => setVatNumber(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="next" />
                    </div>
                    <div className="field">
                      <label htmlFor="licence">{t("onboarding.licence")}</label>
                      <input id="licence" placeholder={province === "QC" ? "RBQ 1234-5678-01" : t("onboarding.licencePlaceholder")} value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} autoCapitalize="characters" spellCheck={false} enterKeyHint="next" />
                    </div>
                    <div className="field full">
                      <label htmlFor="address">{t("onboarding.address")}</label>
                      <input id="address" autoComplete="street-address" enterKeyHint="next" placeholder={t("onboarding.addressPlaceholder")} value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                    <div className="field full">
                      <label htmlFor="etransfer" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Landmark className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> {t("onboarding.etransferEmail")}
                      </label>
                      <input id="etransfer" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="done" placeholder={t("onboarding.etransferPlaceholder")} value={etransferEmail} onChange={e => setEtransferEmail(e.target.value)} />
                      <span className="text-[11px] mt-1 block" style={{ color: "var(--faint)" }}>{t("onboarding.etransferHint")}</span>
                    </div>
                    <div className="field full">
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CalendarClock className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> {t("onboarding.scheduleTitle")}
                      </label>
                      <p className="text-[11px] mb-2" style={{ color: "var(--faint)" }}>{t("onboarding.scheduleHint")}</p>
                      {scheduleOpen ? (
                        <PaymentScheduleEditor value={schedule} onChange={setSchedule} total={0} />
                      ) : (
                        <div className="ob-sched">
                          <span className="ob-sched-txt">
                            <b>{t(schedule.terms.length === 1 ? "onboarding.schedulePayments1" : "onboarding.schedulePayments").replace("{n}", String(schedule.terms.length))}</b>
                            <span>{schedule.terms.map((x) => (x.amountType === "percent" ? `${x.value}${lang === "fr" ? " %" : "%"}` : new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(x.value))).join(" · ")}</span>
                          </span>
                          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setScheduleOpen(true)}>{t("onboarding.scheduleChange")}</button>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isSaving} className="h-11 gap-2 text-sm">
                      <ArrowLeft className="h-4 w-4" /> {t("onboarding.back")}
                    </Button>
                    <button type="button" onClick={() => void saveBusiness()} disabled={!companyName.trim() || isSaving} className="btn btn-navy flex-1 gap-2">
                      {isSaving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {t("onboarding.saving")}</>
                      ) : (
                        <>{t("onboarding.continueButton")} <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSkip()}
                    className="w-full text-center text-xs transition-colors py-1"
                    style={{ color: "var(--faint)" }}
                    disabled={isSaving}
                    data-skip-onboarding=""
                  >
                    {t("onboarding.skipForNow")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {head(Users, t("setup.teamTitle"), t("setup.teamSubtitle"))}
              <div className="stack" style={{ gap: 16 }}>
                <section className="card">
                  <TeamSizeFields value={setup} onChange={setSetup} />
                </section>
                {/* Re-read when the seats wanted change: the checkout's extra seats start from it. */}
                <TeamStep key={setup.seatsWanted ?? 0} plan={plan} seatsWanted={setup.seatsWanted} fieldCrew={setup.fieldCrew} onDone={finishTeam} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
