import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useUpdateBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Upload, X, ImageIcon, ArrowRight, ArrowLeft, Sparkles, MapPin, Landmark, CalendarClock } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { markOnboardingSkipped, markOnboardingDone } from "@/lib/onboarding-state";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { CANADIAN_PROVINCES, type PaymentSchedule } from "@/lib/payment-schedule";

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE_MB = 2;

const DEFAULT_SCHEDULE: PaymentSchedule = {
  currency: "CAD",
  derived: false,
  holdback: { enabled: false, percent: 10 },
  terms: [
    { id: "t1", type: "deposit", label: "Deposit upon contract signing", trigger: "on_signing", amountType: "percent", value: 15, dueDays: 0 },
    { id: "t2", type: "milestone", label: "Delivery of materials and start of work", trigger: "milestone", amountType: "percent", value: 35, dueDays: 15 },
    { id: "t3", type: "milestone", label: "Substantial completion", trigger: "milestone", amountType: "percent", value: 35, dueDays: 15 },
    { id: "t4", type: "completion", label: "Final balance upon completion and client walkthrough", trigger: "on_completion", amountType: "percent", value: 15, dueDays: 15 },
  ],
};

export default function OnboardingPage() {
  const { t, lang } = useLanguage();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [, setLocation] = useLocation();
  const updateProfile = useUpdateBusinessProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);

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
  const [schedule, setSchedule] = useState<PaymentSchedule>(DEFAULT_SCHEDULE);

  if (!isLoaded) {
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

  const goToStep2 = () => {
    if (!companyName.trim()) return;
    setStep(2);
  };

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
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      if (userId) markOnboardingDone(userId);
      setLocation("/dashboard/new");
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

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          {step === 1 ? (
            <>
              {/* Welcome header */}
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <Building2 className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--navy)" }}>{t("onboarding.title")}</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--muted-mk)" }}>
                  {t("onboarding.subtitle")}
                </p>
              </div>

              <div className="card">
                <div className="logo-drop">
                  <div className="logo-tile">
                    {logoPreview ? <img src={logoPreview} alt="Logo" /> : <ImageIcon className="h-6 w-6" />}
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
                    <input id="phone" placeholder="+1 416 555 0123" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="field full">
                    <label htmlFor="address">{t("onboarding.address")}</label>
                    <input id="address" placeholder="123 Main St, Toronto, ON M5V 2T6" value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
                  <div className="field full">
                    <label htmlFor="email">{t("onboarding.businessEmail")}</label>
                    <input id="email" type="email" placeholder="info@yourcompany.ca" value={email} onChange={e => setEmail(e.target.value)} />
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
          ) : (
            <>
              {/* Step 2 header */}
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.15), rgba(15,151,162,0.15))" }}>
                  <MapPin className="h-8 w-8" style={{ color: "var(--navy)" }} />
                </div>
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
                    <label htmlFor="etransfer" className="flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> {t("onboarding.etransferEmail")}
                    </label>
                    <input id="etransfer" type="email" placeholder="payments@yourcompany.ca" value={etransferEmail} onChange={e => setEtransferEmail(e.target.value)} />
                    <span className="text-[11px] mt-1 block" style={{ color: "var(--faint)" }}>{t("onboarding.etransferHint")}</span>
                  </div>
                  <div className="field full">
                    <label className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> {t("onboarding.scheduleTitle")}
                    </label>
                    <p className="text-[11px] mb-2" style={{ color: "var(--faint)" }}>{t("onboarding.scheduleHint")}</p>
                    <PaymentScheduleEditor value={schedule} onChange={setSchedule} total={0} />
                  </div>
                </div>

                <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isSaving} className="h-11 gap-2 text-sm">
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
                        <><Sparkles className="h-4 w-4" /> {t("onboarding.finish")} <ArrowRight className="h-4 w-4" /></>
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
      </div>
    </div>
  );
}
