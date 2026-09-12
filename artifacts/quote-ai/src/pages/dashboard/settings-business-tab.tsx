import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, Save, MapPin, Landmark, Zap, CalendarClock } from "lucide-react";
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
  defaultPaymentSchedule: PaymentSchedule | null;
  automationSettings: { notifyOnQuoteAccepted: boolean; autoDraftContract: boolean; autoSendInvoices: boolean };
};

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
  const [notifyOnQuoteAccepted, setNotifyOnQuoteAccepted] = useState(true);
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
    setNotifyOnQuoteAccepted(profile.automationSettings?.notifyOnQuoteAccepted ?? true);
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
          automationSettings: { notifyOnQuoteAccepted },
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
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-violet-600" />
            {t("dashboard.settings.business.identityTitle")}
          </CardTitle>
          <CardDescription>{t("dashboard.settings.business.identityDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="province">{t("dashboard.settings.business.province")}</Label>
              <select
                id="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("dashboard.settings.business.provinceSelect")}</option>
                {CANADIAN_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>{lang === "fr" ? p.fr : p.en}</option>
                ))}
              </select>
              {taxHint && (
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.business.taxApplied")}: <strong>{taxHint}</strong></p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gst">{t("dashboard.settings.business.gstHst")}</Label>
              <Input id="gst" value={gstHstNumber} onChange={(e) => setGstHstNumber(e.target.value)} placeholder="123456789 RT0001" />
            </div>
            {province === "QC" && (
              <div className="space-y-1.5">
                <Label htmlFor="qst">{t("dashboard.settings.business.qst")}</Label>
                <Input id="qst" value={qstNumber} onChange={(e) => setQstNumber(e.target.value)} placeholder="1234567890 TQ0001" />
              </div>
            )}
            {(province === "BC" || province === "SK" || province === "MB") && (
              <div className="space-y-1.5">
                <Label htmlFor="pst">{t("dashboard.settings.business.pst")}</Label>
                <Input id="pst" value={pstNumber} onChange={(e) => setPstNumber(e.target.value)} placeholder="PST-1234-5678" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="licence">{t("dashboard.settings.business.licence")}</Label>
              <Input id="licence" value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} placeholder={province === "QC" ? "RBQ 1234-5678-01" : t("dashboard.settings.business.licencePlaceholder")} />
              <p className="text-xs text-muted-foreground">{t("dashboard.settings.business.licenceHint")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="h-5 w-5 text-violet-600" />
            {t("dashboard.settings.business.paymentsTitle")}
          </CardTitle>
          <CardDescription>{t("dashboard.settings.business.paymentsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="etransfer">{t("dashboard.settings.business.etransferEmail")}</Label>
          <Input id="etransfer" type="email" value={etransferEmail} onChange={(e) => setEtransferEmail(e.target.value)} placeholder="payments@yourcompany.ca" />
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.business.etransferHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-violet-600" />
            {t("dashboard.settings.business.scheduleTitle")}
          </CardTitle>
          <CardDescription>{t("dashboard.settings.business.scheduleDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentScheduleEditor value={schedule} onChange={setSchedule} total={0} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-violet-600" />
            {t("dashboard.settings.business.automationTitle")}
          </CardTitle>
          <CardDescription>{t("dashboard.settings.business.automationDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <div className="text-sm font-medium">{t("dashboard.settings.business.notifyAccepted")}</div>
              <div className="text-xs text-muted-foreground">{t("dashboard.settings.business.notifyAcceptedHint")}</div>
            </div>
            <Switch checked={notifyOnQuoteAccepted} onCheckedChange={setNotifyOnQuoteAccepted} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.business.save")}
        </Button>
      </div>
    </div>
  );
}
