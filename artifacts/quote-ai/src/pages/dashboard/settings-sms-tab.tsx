import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, type Locale } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Loader2, MessageSquareText, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MockupToggle } from "@/components/ui/mockup-toggle";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { smsApi, type SmsMessageDto } from "@/lib/sms-api";

/**
 * Settings → SMS (Phase 74): the two automation toggles, this month's usage
 * against the plan allowance, a test text to the company's own phone and the
 * message log (sent, skipped-with-reason, replies, STOPs). Honest
 * "not available yet" until the Twilio number exists, like every other
 * integration card.
 */
export function SmsTab() {
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

  const update = useMutation({
    mutationFn: smsApi.updateSettings,
    onSuccess: () => { refresh(); toast({ title: t("dashboard.settings.sms.saved") }); },
    onError: (e: Error) => toast({ title: t("dashboard.settings.sms.error"), description: e.message, variant: "destructive" }),
  });
  const sendTest = useMutation({
    mutationFn: () => smsApi.sendTest(lang === "fr" ? "fr" : "en"),
    onSuccess: (r) => { refresh(); toast({ title: t("dashboard.settings.sms.testSent"), description: r.body }); },
    onError: (e: Error & { code?: string }) => {
      const key = e.code === "NO_PHONE" ? "dashboard.settings.sms.testNoPhone" : e.code === "NOT_CONFIGURED" ? "dashboard.settings.integrations.notAvailableTitle" : "dashboard.settings.sms.testFailed";
      toast({ title: t(key), description: e.code ? undefined : e.message, variant: "destructive" });
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-[var(--radius)]" />;
  if (!status) return null;

  const { used, allowance } = status.usage;
  const pct = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  const noAllowance = allowance === 0;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", status.available ? "bg-emerald-100" : "bg-navy-100")}>
              <MessageSquareText className={cn("h-6 w-6", status.available ? "text-emerald-600" : "text-navy-500")} />
            </div>
            <div>
              <h2>{t("dashboard.settings.sms.title")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.sms.desc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {!status.available && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="integration-not-available">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">{t("dashboard.settings.integrations.notAvailableTitle")}</p>
                <p className="mt-0.5">{t("dashboard.settings.sms.notAvailableDesc")}</p>
              </div>
            </div>
          )}

          {/* CASL: what every text carries, shown before anything is switched on. */}
          <div className="rounded-[var(--radius-sm)] border bg-[var(--soft)] p-4 text-sm space-y-1.5">
            <p className="font-semibold text-foreground">{t("dashboard.settings.sms.previewTitle")}</p>
            <p className="font-mono text-xs text-foreground break-words">
              {status.identityLine}: {t("dashboard.settings.sms.previewBody")} {lang === "fr" ? "Répondez STOP pour ne plus recevoir de textos." : "Reply STOP to opt out."}
            </p>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.sms.caslNote")}</p>
            {status.fromNumberHint && <p className="text-xs text-muted-foreground">{t("dashboard.settings.sms.fromNumber").replace("{number}", status.fromNumberHint)}</p>}
          </div>

          <div className="set-row">
            <div className="txt">
              <b>{t("dashboard.settings.sms.enabled")}</b>
              <span>{t("dashboard.settings.sms.enabledHint")}</span>
            </div>
            <MockupToggle checked={status.smsEnabled} onCheckedChange={(v) => update.mutate({ smsEnabled: v })} label={t("dashboard.settings.sms.enabled")} />
          </div>
          <div className="set-row">
            <div className="txt">
              <b>{t("dashboard.settings.sms.reminders")}</b>
              <span>{t("dashboard.settings.sms.remindersHint")}</span>
            </div>
            <MockupToggle checked={status.smsReminders} onCheckedChange={(v) => update.mutate({ smsReminders: v })} label={t("dashboard.settings.sms.reminders")} />
          </div>
          <div className="set-row">
            <div className="txt">
              <b>{t("dashboard.settings.sms.scheduleReminders")}</b>
              <span>{t("dashboard.settings.sms.scheduleRemindersHint")}</span>
            </div>
            <MockupToggle checked={status.scheduleReminders} onCheckedChange={(v) => update.mutate({ scheduleReminders: v })} label={t("dashboard.settings.sms.scheduleReminders")} />
          </div>

          <div className="space-y-1.5 pt-2 border-t">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground">{t("dashboard.settings.usage.smsMessages")}</span>
              <span className="text-muted-foreground">{used}{allowance !== null ? ` / ${allowance}` : ""}</span>
            </div>
            {allowance !== null && (
              <div className="hbar">
                <i style={{ width: `${pct}%`, background: pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow-dark)" : "var(--green)" }} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{noAllowance ? t("dashboard.settings.sms.noAllowance") : t("dashboard.settings.sms.allowanceNote")}</p>
          </div>
        </div>
        <div className="card-foot">
          <button type="button" className="btn btn-outline-navy gap-2" disabled={!status.available || noAllowance || sendTest.isPending} onClick={() => sendTest.mutate()}>
            {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {status.ownPhone ? t("dashboard.settings.sms.sendTest").replace("{phone}", status.ownPhone) : t("dashboard.settings.sms.sendTestNoPhone")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t("dashboard.settings.sms.logTitle")}</h2>
          <p className="sub">{t("dashboard.settings.sms.logDesc")}</p>
        </div>
        {!log || log.items.length === 0 ? (
          <div className="card-empty">{t("dashboard.settings.sms.logEmpty")}</div>
        ) : (
          <ul className="divide-y">
            {log.items.map((m) => <SmsLogRow key={m.id} m={m} locale={locale} />)}
          </ul>
        )}
      </div>
    </div>
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
