// Phase 91: the last steps use team, seat and access-code strings from the dashboard dictionary.
import "@/i18n/dashboard";
import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useUpdateBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Upload, X, ImageIcon, ArrowRight, ArrowLeft, MapPin, Landmark, CalendarClock, Hammer, Users, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { markOnboardingSkipped, markOnboardingDone } from "@/lib/onboarding-state";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { CANADIAN_PROVINCES, defaultPaymentSchedule, type PaymentSchedule } from "@/lib/payment-schedule";
import { WorkStepFields } from "@/components/onboarding/work-step";
import { TeamStep } from "@/components/onboarding/team-step";
import { peopleApi, type CompanySetup, type CompanyTrade } from "@/lib/people-api";
import { teamMembersApi } from "@/lib/team-members-api";

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE_MB = 2;

export default function OnboardingPage() {
  const { t, lang } = useLanguage();
  useDocumentTitle(`${t("onboarding.title")} · QuoteAI`);
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [, setLocation] = useLocation();
  const updateProfile = useUpdateBusinessProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Phase 91: company → your work (trades, size, seats) → province and payments → your team.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
    onSuccess: () => { queryClient.clear(); window.location.href = "/dashboard/me?welcome=1"; },
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
    window.location.href = "/sign-in";
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

  const goToStep2 = () => {
    if (!companyName.trim()) return;
    setStep(2);
  };
  const StepCount = () => <p className="text-xs font-semibold mb-2" style={{ color: "var(--faint)" }}>{t("setup.stepOf").replace("{n}", String(step)).replace("{total}", "4")}</p>;

  const finish = async (includeStep2: boolean) => {
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
      if (includeStep2 && (province || licenceNumber.trim() || etransferEmail.trim())) {
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
      }
      queryClient.setQueryData(getGetBusinessProfileQueryKey(), (old: unknown) => ({
        ...(old && typeof old === "object" ? old : {}),
        ...(saved && typeof saved === "object" ? saved : {}),
        companyName: companyName.trim(),
      }));
      // Phase 91: the answers from "your work" (never blocking: a failure here doesn't stop onboarding).
      if (setup.trades.length || setup.teamSize || setup.seatsWanted || setup.fieldCrew !== undefined) await peopleApi.saveSetup(setup).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      if (userId) markOnboardingDone(userId);
      setStep(4);
    } catch {
      toast({ title: t("onboarding.saveError"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    if (userId) markOnboardingSkipped(userId);
    setLocation("/dashboard/new");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "linear-gradient(180deg, var(--soft), #fff)" }}>
      {/* Header */}
      <header className="h-16 flex items-center px-6 border-b bg-white/80 backdrop-blur-sm" style={{ borderColor: "var(--soft)" }}>
        <Logo />
      </header>

      <main id="main" className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500" data-step={step}>
          {pendingInvites.length > 0 && !setUpOwn ? (
            <>
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <Mail className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{t("onboarding.invite.title")}</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>{t("onboarding.invite.subtitle")}</p>
              </div>
              <div className="stack" style={{ gap: 12 }}>
                {pendingInvites.map((inv) => (
                  <section key={inv.id} className="card p-5 text-center stack" style={{ gap: 12 }} data-pending-invite="">
                    {inv.logoUrl && <img src={inv.logoUrl} alt="" style={{ maxHeight: 44, margin: "0 auto" }} />}
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
              {/* Welcome header */}
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <Building2 className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
                <StepCount />
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{t("onboarding.title")}</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>
                  {t("onboarding.subtitle")}
                </p>
              </div>

              <div className="card">
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
                  <div className="field full">
                    <label htmlFor="companyName">{t("onboarding.companyName")} <span style={{ color: "var(--red)" }}>*</span></label>
                    <input
                      id="companyName"
                      placeholder={t("onboarding.companyNamePlaceholder")}
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="vatNumber">{t("onboarding.businessNumber")}</label>
                    <input id="vatNumber" placeholder="123456789 RT0001" value={vatNumber} onChange={e => setVatNumber(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">{t("onboarding.phone")}</label>
                    <input id="phone" placeholder={t("onboarding.phonePlaceholder")} value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="field full">
                    <label htmlFor="address">{t("onboarding.address")}</label>
                    <input id="address" placeholder={t("onboarding.addressPlaceholder")} value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
                  <div className="field full">
                    <label htmlFor="email">{t("onboarding.businessEmail")}</label>
                    <input id="email" type="email" placeholder={t("onboarding.emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>

                <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <button
                    type="button"
                    onClick={goToStep2}
                    disabled={!companyName.trim() || isSaving}
                    className="btn btn-navy w-full gap-2"
                  >
                    {t("onboarding.continueButton")} <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSkip}
                    className="w-full text-center text-xs transition-colors py-1"
                    style={{ color: "var(--faint)" }}
                    disabled={isSaving}
                  >
                    {t("onboarding.skipForNow")}
                  </button>
                </div>
              </div>
            </>
          ) : step === 2 ? (
            <>
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <Hammer className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
                <StepCount />
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{t("setup.workTitle")}</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>{t("setup.workSubtitle")}</p>
              </div>
              <div className="card">
                <WorkStepFields value={setup} onChange={setSetup} />
                <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-11 gap-2 text-sm">
                      <ArrowLeft className="h-4 w-4" /> {t("onboarding.back")}
                    </Button>
                    <button type="button" onClick={() => setStep(3)} className="btn btn-navy flex-1 gap-2">
                      {t("onboarding.continueButton")} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : step === 4 ? (
            <>
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <Users className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
                <StepCount />
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{t("setup.teamTitle")}</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>{t("setup.teamSubtitle")}</p>
              </div>
              <TeamStep plan={plan} seatsWanted={setup.seatsWanted} fieldCrew={setup.fieldCrew} onDone={() => setLocation("/dashboard/new")} />
            </>
          ) : (
            <>
              {/* Step 3 header (province, licence, payments) */}
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <MapPin className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
                <StepCount />
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{t("onboarding.step2Title")}</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>
                  {t("onboarding.step2Subtitle")}
                </p>
              </div>

              <div className="card">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="province">{t("onboarding.province")}</label>
                    <select
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                    >
                      <option value="">{t("onboarding.provinceSelect")}</option>
                      {CANADIAN_PROVINCES.map((p) => (
                        <option key={p.code} value={p.code}>{lang === "fr" ? p.fr : p.en}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="licence">{t("onboarding.licence")}</label>
                    <input id="licence" placeholder={province === "QC" ? "RBQ 1234-5678-01" : t("onboarding.licencePlaceholder")} value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} />
                  </div>
                  <div className="field full">
                    <label htmlFor="etransfer" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Landmark className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> {t("onboarding.etransferEmail")}
                    </label>
                    <input id="etransfer" type="email" placeholder={t("onboarding.etransferPlaceholder")} value={etransferEmail} onChange={e => setEtransferEmail(e.target.value)} />
                    <span className="text-[11px] mt-1 block" style={{ color: "var(--faint)" }}>{t("onboarding.etransferHint")}</span>
                  </div>
                  <div className="field full">
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <CalendarClock className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> {t("onboarding.scheduleTitle")}
                    </label>
                    <p className="text-[11px] mb-2" style={{ color: "var(--faint)" }}>{t("onboarding.scheduleHint")}</p>
                    <PaymentScheduleEditor value={schedule} onChange={setSchedule} total={0} />
                  </div>
                </div>

                <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isSaving} className="h-11 gap-2 text-sm">
                      <ArrowLeft className="h-4 w-4" /> {t("onboarding.back")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => finish(true)}
                      disabled={isSaving}
                      className="btn btn-navy flex-1 gap-2"
                    >
                      {isSaving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {t("onboarding.saving")}</>
                      ) : (
                        <>{t("onboarding.continueButton")} <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="w-full text-center text-xs transition-colors py-1"
                    style={{ color: "var(--faint)" }}
                    disabled={isSaving}
                  >
                    {t("onboarding.skipForNow")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
