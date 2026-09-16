import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useUpdateBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="min-h-[100dvh] bg-gradient-to-br from-navy-50 via-white to-teal-50 flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center px-6 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <Logo />
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          {step === 1 ? (
            <>
              {/* Welcome header */}
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))" }}>
                  <Building2 className="h-8 w-8 text-navy-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("onboarding.title")}</h1>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  {t("onboarding.subtitle")}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                {/* Logo upload */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("onboarding.companyLogo")} <span className="text-gray-400 font-normal">({t("onboarding.optional")})</span></Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-14 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo} className="gap-2 h-8 text-xs">
                        {isUploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {isUploadingLogo ? t("onboarding.uploading") : logoPreview ? t("onboarding.changeLogo") : t("onboarding.uploadLogo")}
                      </Button>
                      {logoPreview && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setLogoPreview(null)} className="gap-1 h-7 text-xs text-destructive hover:text-destructive px-2">
                          <X className="h-3 w-3" /> {t("onboarding.remove")}
                        </Button>
                      )}
                      <p className="text-[11px] text-gray-400">SVG, PNG, JPG · max 2 MB</p>
                    </div>
                  </div>
                </div>

                {/* Company name */}
                <div className="space-y-1.5">
                  <Label htmlFor="companyName" className="text-sm font-medium">
                    {t("onboarding.companyName")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    placeholder={t("onboarding.companyNamePlaceholder")}
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                </div>

                {/* VAT + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="vatNumber" className="text-sm font-medium">{t("onboarding.businessNumber")}</Label>
                    <Input id="vatNumber" placeholder="123456789 RT0001" value={vatNumber} onChange={e => setVatNumber(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm font-medium">{t("onboarding.phone")}</Label>
                    <Input id="phone" placeholder="+1 416 555 0123" value={phone} onChange={e => setPhone(e.target.value)} className="h-10" />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-sm font-medium">{t("onboarding.address")}</Label>
                  <Input id="address" placeholder="123 Main St, Toronto, ON M5V 2T6" value={address} onChange={e => setAddress(e.target.value)} className="h-10" />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">{t("onboarding.businessEmail")}</Label>
                  <Input id="email" type="email" placeholder="info@yourcompany.ca" value={email} onChange={e => setEmail(e.target.value)} className="h-10" />
                </div>

                {/* Next */}
                <Button
                  onClick={goToStep2}
                  disabled={!companyName.trim() || isSaving}
                  className="w-full h-11 gap-2 text-sm font-semibold"
                >
                  {t("onboarding.continueButton")} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>

                <button
                  onClick={handleSkip}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                  disabled={isSaving}
                >
                  {t("onboarding.skipForNow")}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Step 2 header */}
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))" }}>
                  <MapPin className="h-8 w-8 text-navy-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("onboarding.step2Title")}</h1>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  {t("onboarding.step2Subtitle")}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="province" className="text-sm font-medium">{t("onboarding.province")}</Label>
                    <select
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">{t("onboarding.provinceSelect")}</option>
                      {CANADIAN_PROVINCES.map((p) => (
                        <option key={p.code} value={p.code}>{lang === "fr" ? p.fr : p.en}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="licence" className="text-sm font-medium">{t("onboarding.licence")}</Label>
                    <Input id="licence" placeholder={province === "QC" ? "RBQ 1234-5678-01" : t("onboarding.licencePlaceholder")} value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} className="h-10" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="etransfer" className="text-sm font-medium flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-gray-400" /> {t("onboarding.etransferEmail")}
                  </Label>
                  <Input id="etransfer" type="email" placeholder="payments@yourcompany.ca" value={etransferEmail} onChange={e => setEtransferEmail(e.target.value)} className="h-10" />
                  <p className="text-[11px] text-gray-400">{t("onboarding.etransferHint")}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-gray-400" /> {t("onboarding.scheduleTitle")}
                  </Label>
                  <p className="text-[11px] text-gray-400 mb-2">{t("onboarding.scheduleHint")}</p>
                  <PaymentScheduleEditor value={schedule} onChange={setSchedule} total={0} />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isSaving} className="h-11 gap-2 text-sm">
                    <ArrowLeft className="h-4 w-4" /> {t("onboarding.back")}
                  </Button>
                  <Button
                    onClick={() => finish(true)}
                    disabled={isSaving}
                    className="flex-1 h-11 gap-2 text-sm font-semibold"
                  >
                    {isSaving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {t("onboarding.saving")}</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> {t("onboarding.finish")} <ArrowRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </div>

                <button
                  onClick={handleSkip}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                  disabled={isSaving}
                >
                  {t("onboarding.skipForNow")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
