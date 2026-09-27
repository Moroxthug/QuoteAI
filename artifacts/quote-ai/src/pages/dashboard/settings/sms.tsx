import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, type Locale } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Loader2, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { smsApi, type SmsMessageDto } from "@/lib/sms-api";
import { ActionRow, SettingsGroup, SettingsSection, ToggleRow, useSettingsDraft } from "./ui";

type SmsDraft = { smsEnabled: boolean; smsReminders: boolean; scheduleReminders: boolean };

/**
 * Messaging → SMS (Phase 74): the automation switches, this month's usage
 * against the plan allowance, a test text to the company's own phone and the
 * message log (sent, skipped-with-reason, replies, STOPs). Honest
 * "not available yet" until the Twilio number exists, like every other
 * integration. Phase 102: the switches wait for the save bar like every other setting.
 */
export function SmsSection() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = lang === "fr" ? frCA : enCA;
  const { data: status, isLoading } = useQuery({ queryKey: ["sms-status"], queryFn: smsApi.status });
  const { data: log } = useQuery({ queryKey: ["sms-messages"], queryFn: () => smsApi.messages(30) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sms-status"] });
    queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
    queryClient.invalidateQueries({ queryKey: ["usage-summary"] });
  };

  const source = useMemo<SmsDraft | undefined>(() => status && { smsEnabled: status.smsEnabled, smsReminders: status.smsReminders, scheduleReminders: status.scheduleReminders }, [status]);
  const { draft, set } = useSettingsDraft<SmsDraft>(source, async (d) => {
    try {
      await smsApi.updateSettings(d);
    } catch (e) {
      toast({ title: t("dashboard.settings.sms.error"), description: (e as Error).message, variant: "destructive" });
      throw e;
    }
    refresh();
    toast({ title: t("dashboard.settings.sms.saved") });
  });
  const sendTest = useMutation({
    mutationFn: () => smsApi.sendTest(lang === "fr" ? "fr" : "en"),
    onSuccess: (r) => { refresh(); toast({ title: t("dashboard.settings.sms.testSent"), description: r.body }); },
    onError: (e: Error & { code?: string }) => {
      const key = e.code === "NO_PHONE" ? "dashboard.settings.sms.testNoPhone" : e.code === "NOT_CONFIGURED" ? "dashboard.settings.integrations.notAvailableTitle" : "dashboard.settings.sms.testFailed";
      toast({ title: t(key), description: e.code ? undefined : e.message, variant: "destructive" });
    },
  });

  if (isLoading || !status || !draft) {
    return (
      <SettingsSection title={t("settings.section.sms")} intro={t("dashboard.settings.sms.desc")}>
        {isLoading && <Skeleton className="h-64 w-full rounded-[var(--radius)]" />}
      </SettingsSection>
    );
  }

  const { used, allowance } = status.usage;
  const pct = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  const noAllowance = allowance === 0;

  return (
    <SettingsSection title={t("settings.section.sms")} intro={t("dashboard.settings.sms.desc")}>
      {!status.available && (
        <div className="notice info" data-testid="integration-not-available">
          <AlertCircle aria-hidden="true" />
          <span className="grow">{t("dashboard.settings.integrations.notAvailableTitle")}<small>{t("dashboard.settings.sms.notAvailableDesc")}</small></span>
        </div>
      )}

      <SettingsGroup title={t("dashboard.settings.sms.previewTitle")} desc={t("dashboard.settings.sms.caslNote")}>
        <div className="sgroup-pad">
          {/* CASL: what every text carries, shown before anything is switched on. */}
          <p className="ssms-preview">
            {status.identityLine}: {t("dashboard.settings.sms.previewBody")} {lang === "fr" ? "Répondez STOP pour ne plus recevoir de textos." : "Reply STOP to opt out."}
          </p>
          {status.fromNumberHint && <p className="smeter-note">{t("dashboard.settings.sms.fromNumber").replace("{number}", status.fromNumberHint)}</p>}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("settings.group.smsAutomation")}>
        <ToggleRow label={t("dashboard.settings.sms.enabled")} help={t("dashboard.settings.sms.enabledHint")} checked={draft.smsEnabled} onChange={(v) => set("smsEnabled", v)} />
        <ToggleRow label={t("dashboard.settings.sms.reminders")} help={t("dashboard.settings.sms.remindersHint")} checked={draft.smsReminders} onChange={(v) => set("smsReminders", v)} />
        <ToggleRow label={t("dashboard.settings.sms.scheduleReminders")} help={t("dashboard.settings.sms.scheduleRemindersHint")} checked={draft.scheduleReminders} onChange={(v) => set("scheduleReminders", v)} />
      </SettingsGroup>

      <SettingsGroup title={t("dashboard.settings.usage.smsMessages")}>
        <div className="sgroup-pad">
          <div className="smeter">
            <div className="smeter-top">
              <span>{t("settings.sms.thisMonth")}</span>
              <span>{used}{allowance !== null ? ` / ${allowance}` : ""}</span>
            </div>
            {allowance !== null && (
              <div className="hbar">
                <i style={{ width: `${pct}%`, background: pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow-dark)" : "var(--green)" }} />
              </div>
            )}
          </div>
          <p className="smeter-note">{noAllowance ? t("dashboard.settings.sms.noAllowance") : t("dashboard.settings.sms.allowanceNote")}</p>
        </div>
        <ActionRow label={t("settings.sms.testLabel")} help={status.ownPhone ? undefined : t("dashboard.settings.sms.sendTestNoPhone")}>
          <button type="button" className="btn btn-outline-navy btn-sm gap-2" disabled={!status.available || noAllowance || sendTest.isPending} onClick={() => sendTest.mutate()}>
            {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {status.ownPhone ? t("dashboard.settings.sms.sendTest").replace("{phone}", status.ownPhone) : t("settings.sms.sendTest")}
          </button>
        </ActionRow>
      </SettingsGroup>

      <SettingsGroup title={t("dashboard.settings.sms.logTitle")} desc={t("dashboard.settings.sms.logDesc")}>
        {!log || log.items.length === 0 ? (
          <div className="card-empty">{t("dashboard.settings.sms.logEmpty")}</div>
        ) : (
          <ul className="divide-y">
            {log.items.map((m) => <SmsLogRow key={m.id} m={m} locale={locale} />)}
          </ul>
        )}
      </SettingsGroup>
    </SettingsSection>
  );
}

/** Known skip/failure reasons have a translation; a raw Twilio error is shown as-is. */
function reasonLabel(t: (key: string) => string, error: string): string {
  const key = `dashboard.settings.sms.reason.${error}`;
  const label = t(key);
  return label === key ? error : label;
}

function SmsLogRow({ m, locale }: { m: SmsMessageDto; locale: Locale }) {
  const { t } = useLanguage();
  const Icon = m.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
  const chip = m.status === "sent" || m.status === "received" ? "chip-green" : m.status === "failed" ? "chip-red" : "chip-yellow";
  return (
    <li className="px-5 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <b className="truncate">{m.phone}</b>
          <span className="text-xs text-muted-foreground">{t(`dashboard.settings.sms.purpose.${m.purpose}`)}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className={cn("chip", chip)}>{t(`dashboard.settings.sms.status.${m.status}`)}</span>
          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale })}</span>
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 break-words">{m.body}</p>
      {m.error && <p className="text-xs text-[var(--red)] mt-0.5">{reasonLabel(t, m.error)}</p>}
    </li>
  );
}
