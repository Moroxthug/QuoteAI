import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MockupToggle } from "@/components/ui/mockup-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, Save, MapPin, Landmark, Zap, CalendarClock, Star } from "lucide-react";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { CANADIAN_PROVINCES, type PaymentSchedule } from "@/lib/payment-schedule";

type TaxProfile = { province: string; components: { code: string; label: string; rate: number }[]; totalRate: number };

type ProfileExtras = {
  province: string | null;
  taxProfile: TaxProfile | null;
  gstHstNumber: string | null;
  qstNumber: string | null;
  pstNumber: string | null;
  licenceNumber: string | null;
  etransferEmail: string | null;
  googleReviewUrl: string | null;
  homeStarsProfileUrl: string | null;
  sendReviewRequests: boolean;
  defaultPaymentSchedule: PaymentSchedule | null;
  automationSettings: { notifyOnQuoteAccepted: boolean; autoDraftContract: boolean; autoSendInvoices: boolean; invoiceAutoSendAfterHours: number; invoiceReminders: boolean; leadFollowupDays?: number[]; quoteFollowupDays?: number[]; reviewRequestDelayDays?: number };
};

// Phase 80: "1, 3, 7" ⇄ [1, 3, 7] — days after the previous touch, at most 5, each 1–90.
function parseCadence(text: string): number[] | null {
  const parts = text.split(/[,\s]+/).filter(Boolean);
  if (parts.length > 5) return null;
  const days = parts.map((p) => Number(p));
  return days.every((d) => Number.isInteger(d) && d >= 1 && d <= 90) ? days : null;
}

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

/**
 * "Business" settings tab: Canadian identity (province, tax numbers,
 * licence, e-transfer email), automation preferences and the default
 * payment schedule new quotes start from.
 */
export function BusinessTab() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profileRaw, isLoading } = useGetBusinessProfile();
  const profile = profileRaw as unknown as (typeof profileRaw & ProfileExtras) | undefined;

  const [province, setProvince] = useState("");
  const [gstHstNumber, setGstHstNumber] = useState("");
  const [qstNumber, setQstNumber] = useState("");
  const [pstNumber, setPstNumber] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [etransferEmail, setEtransferEmail] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [homeStarsProfileUrl, setHomeStarsProfileUrl] = useState("");
  const [sendReviewRequests, setSendReviewRequests] = useState(true);
  const [notifyOnQuoteAccepted, setNotifyOnQuoteAccepted] = useState(true);
  const [autoSendInvoices, setAutoSendInvoices] = useState(false);
  const [invoiceAutoSendAfterHours, setInvoiceAutoSendAfterHours] = useState(0);
  const [invoiceReminders, setInvoiceReminders] = useState(true);
  const [leadCadence, setLeadCadence] = useState("1, 3, 7");
  const [quoteCadence, setQuoteCadence] = useState("2, 5, 10");
  const [reviewDelayDays, setReviewDelayDays] = useState(3);
  const [schedule, setSchedule] = useState<PaymentSchedule>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setProvince(profile.province ?? "");
    setGstHstNumber(profile.gstHstNumber ?? "");
    setQstNumber(profile.qstNumber ?? "");
    setPstNumber(profile.pstNumber ?? "");
    setLicenceNumber(profile.licenceNumber ?? "");
    setEtransferEmail(profile.etransferEmail ?? "");
    setGoogleReviewUrl(profile.googleReviewUrl ?? "");
    setHomeStarsProfileUrl(profile.homeStarsProfileUrl ?? "");
    setSendReviewRequests(profile.sendReviewRequests ?? true);
    setNotifyOnQuoteAccepted(profile.automationSettings?.notifyOnQuoteAccepted ?? true);
    setAutoSendInvoices(profile.automationSettings?.autoSendInvoices ?? false);
    setInvoiceAutoSendAfterHours(profile.automationSettings?.invoiceAutoSendAfterHours ?? 0);
    setInvoiceReminders(profile.automationSettings?.invoiceReminders ?? true);
    setLeadCadence((profile.automationSettings?.leadFollowupDays ?? [1, 3, 7]).join(", "));
    setQuoteCadence((profile.automationSettings?.quoteFollowupDays ?? [2, 5, 10]).join(", "));
    setReviewDelayDays(profile.automationSettings?.reviewRequestDelayDays ?? 3);
    setSchedule(profile.defaultPaymentSchedule ?? DEFAULT_SCHEDULE);
  }, [profile]);

  const taxHint = (() => {
    const p = CANADIAN_PROVINCES.find((x) => x.code === province);
    if (!p) return null;
    const rates: Record<string, string> = {
      AB: "GST 5%", BC: "GST 5% + PST 7%", MB: "GST 5% + RST 7%", NB: "HST 15%", NL: "HST 15%", NS: "HST 14%",
      NT: "GST 5%", NU: "GST 5%", ON: "HST 13%", PE: "HST 15%", QC: "GST 5% + QST 9.975%", SK: "GST 5% + PST 6%", YT: "GST 5%",
    };
    return rates[province] ?? null;
  })();

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          province: province || null,
          gstHstNumber: gstHstNumber || null,
          qstNumber: qstNumber || null,
          pstNumber: pstNumber || null,
          licenceNumber: licenceNumber || null,
          etransferEmail: etransferEmail || null,
          googleReviewUrl: googleReviewUrl || null,
          homeStarsProfileUrl: homeStarsProfileUrl || null,
          sendReviewRequests,
          automationSettings: { notifyOnQuoteAccepted, autoSendInvoices, invoiceAutoSendAfterHours, invoiceReminders, leadFollowupDays: parseCadence(leadCadence) ?? undefined, quoteFollowupDays: parseCadence(quoteCadence) ?? undefined, reviewRequestDelayDays: reviewDelayDays },
          defaultPaymentSchedule: schedule,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Save failed");
      }
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.settings.business.saved") });
    } catch (err) {
      toast({ title: t("dashboard.settings.business.saveError"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.identityTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.identityDesc")}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <Label htmlFor="province">{t("dashboard.settings.business.province")}</Label>
            <select
              id="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">{t("dashboard.settings.business.provinceSelect")}</option>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>{lang === "fr" ? p.fr : p.en}</option>
              ))}
            </select>
            {taxHint && (
              <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.taxApplied")}: <strong>{taxHint}</strong></span>
            )}
          </div>
          <div className="field">
            <Label htmlFor="gst">{t("dashboard.settings.business.gstHst")}</Label>
            <Input id="gst" value={gstHstNumber} onChange={(e) => setGstHstNumber(e.target.value)} placeholder="123456789 RT0001" />
          </div>
          {province === "QC" && (
            <div className="field">
              <Label htmlFor="qst">{t("dashboard.settings.business.qst")}</Label>
              <Input id="qst" value={qstNumber} onChange={(e) => setQstNumber(e.target.value)} placeholder="1234567890 TQ0001" />
            </div>
          )}
          {(province === "BC" || province === "SK" || province === "MB") && (
            <div className="field">
              <Label htmlFor="pst">{t("dashboard.settings.business.pst")}</Label>
              <Input id="pst" value={pstNumber} onChange={(e) => setPstNumber(e.target.value)} placeholder="PST-1234-5678" />
            </div>
          )}
          <div className="field">
            <Label htmlFor="licence">{t("dashboard.settings.business.licence")}</Label>
            <Input id="licence" value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} placeholder={province === "QC" ? "RBQ 1234-5678-01" : t("dashboard.settings.business.licencePlaceholder")} />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.licenceHint")}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.paymentsTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.paymentsDesc")}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field full">
            <Label htmlFor="etransfer">{t("dashboard.settings.business.etransferEmail")}</Label>
            <Input id="etransfer" type="email" value={etransferEmail} onChange={(e) => setEtransferEmail(e.target.value)} placeholder="payments@yourcompany.ca" />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.etransferHint")}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Star className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.reviewsTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.reviewsDesc")}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field full">
            <Label htmlFor="googleReviewUrl">{t("dashboard.settings.business.googleReviewUrl")}</Label>
            <Input id="googleReviewUrl" type="url" value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/r/.../review" />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.googleReviewUrlHint")}</span>
          </div>
          <div className="field full">
            <Label htmlFor="homeStarsProfileUrl">{t("dashboard.settings.business.homeStarsProfileUrl")}</Label>
            <Input id="homeStarsProfileUrl" type="url" value={homeStarsProfileUrl} onChange={(e) => setHomeStarsProfileUrl(e.target.value)} placeholder="https://homestars.com/companies/..." />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.homeStarsProfileUrlHint")}</span>
          </div>
        </div>
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.sendReviewRequests")}</b>
            <span>{t("dashboard.settings.business.sendReviewRequestsHint")}</span>
          </div>
          <MockupToggle
            checked={sendReviewRequests}
            onCheckedChange={setSendReviewRequests}
            disabled={!googleReviewUrl}
            label={t("dashboard.settings.business.sendReviewRequests")}
          />
        </div>
        {sendReviewRequests && (
          <div className="set-row">
            <div className="txt">
              <b>{t("dashboard.settings.business.reviewDelay")}</b>
              <span>{t("dashboard.settings.business.reviewDelayHint")}</span>
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={reviewDelayDays}
              onChange={(e) => setReviewDelayDays(Number(e.target.value))}
              aria-label={t("dashboard.settings.business.reviewDelay")}
            >
              {[0, 1, 2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d === 0 ? t("dashboard.settings.business.reviewDelaySameDay") : d === 1 ? t("dashboard.settings.business.reviewDelayDay") : t("dashboard.settings.business.reviewDelayDays").replace("{n}", String(d))}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Phase 80: follow-up cadences used to be fixed at 1/3/7 (leads) and 2/5/10 (quotes) days. */}
      <div className="card">
        <div className="card-head">
          <div>
            <b>{t("dashboard.settings.business.followupCadence")}</b>
            <span>{t("dashboard.settings.business.followupCadenceHint")}</span>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <Label htmlFor="leadCadence">{t("dashboard.settings.business.leadCadence")}</Label>
            <Input id="leadCadence" value={leadCadence} onChange={(e) => setLeadCadence(e.target.value)} placeholder="1, 3, 7" aria-invalid={parseCadence(leadCadence) === null} />
            <span className="text-xs mt-1 block" style={{ color: parseCadence(leadCadence) === null ? "var(--red)" : "var(--muted-mk)" }}>
              {parseCadence(leadCadence) === null ? t("dashboard.settings.business.cadenceInvalid") : parseCadence(leadCadence)!.length === 0 ? t("dashboard.settings.business.cadenceOff") : t("dashboard.settings.business.leadCadenceHint")}
            </span>
          </div>
          <div className="field">
            <Label htmlFor="quoteCadence">{t("dashboard.settings.business.quoteCadence")}</Label>
            <Input id="quoteCadence" value={quoteCadence} onChange={(e) => setQuoteCadence(e.target.value)} placeholder="2, 5, 10" aria-invalid={parseCadence(quoteCadence) === null} />
            <span className="text-xs mt-1 block" style={{ color: parseCadence(quoteCadence) === null ? "var(--red)" : "var(--muted-mk)" }}>
              {parseCadence(quoteCadence) === null ? t("dashboard.settings.business.cadenceInvalid") : parseCadence(quoteCadence)!.length === 0 ? t("dashboard.settings.business.cadenceOff") : t("dashboard.settings.business.quoteCadenceHint")}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.scheduleTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.scheduleDesc")}</p>
          </div>
        </div>
        <div className="p-5">
          <PaymentScheduleEditor value={schedule} onChange={setSchedule} total={0} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.automationTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.automationDesc")}</p>
          </div>
        </div>
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.notifyAccepted")}</b>
            <span>{t("dashboard.settings.business.notifyAcceptedHint")}</span>
          </div>
          <MockupToggle checked={notifyOnQuoteAccepted} onCheckedChange={setNotifyOnQuoteAccepted} label={t("dashboard.settings.business.notifyAccepted")} />
        </div>

        {/* Phase 4: invoice automation */}
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.autoSendInvoices")}</b>
            <span>{t("dashboard.settings.business.autoSendInvoicesHint")}</span>
          </div>
          <MockupToggle checked={autoSendInvoices} onCheckedChange={setAutoSendInvoices} label={t("dashboard.settings.business.autoSendInvoices")} />
        </div>
        {!autoSendInvoices && (
          <div className="set-row">
            <div className="txt">
              <b>{t("dashboard.settings.business.invoiceReviewWindow")}</b>
              <span>{t("dashboard.settings.business.invoiceReviewWindowHint")}</span>
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={invoiceAutoSendAfterHours}
              onChange={(e) => setInvoiceAutoSendAfterHours(Number(e.target.value))}
            >
              <option value={0}>{t("dashboard.settings.business.reviewNever")}</option>
              <option value={24}>24 h</option>
              <option value={48}>48 h</option>
              <option value={72}>72 h</option>
            </select>
          </div>
        )}
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.invoiceReminders")}</b>
            <span>{t("dashboard.settings.business.invoiceRemindersHint")}</span>
          </div>
          <MockupToggle checked={invoiceReminders} onCheckedChange={setInvoiceReminders} label={t("dashboard.settings.business.invoiceReminders")} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving || parseCadence(leadCadence) === null || parseCadence(quoteCadence) === null} className="btn btn-navy gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.business.save")}
        </button>
      </div>
    </div>
  );
}
