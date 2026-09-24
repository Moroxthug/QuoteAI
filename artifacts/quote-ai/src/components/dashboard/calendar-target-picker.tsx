// Phase 96 — Settings → Integrations: which calendar the milestones and
// schedule blocks are written to. Until someone picks one, everything goes to
// the account's main calendar; picking another moves the upcoming events.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { calendarApi } from "@/lib/calendar-api";
import { getGetCalendarStatusQueryKey } from "@workspace/api-client-react";

type Props = {
  provider: "google" | "outlook";
  /** What the status endpoint says today: "primary" or a picked id, with its name. */
  calendarId: string;
  calendarName: string | null;
  /** The connect button's handler, for the "reconnect to choose" case. */
  onReconnect: () => void;
};

export function CalendarTargetPicker({ provider, calendarId, calendarName, onReconnect }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const can = useCan();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["calendar-choice", provider],
    queryFn: () => calendarApi.listCalendars(provider),
    enabled: open,
    retry: false,
  });
  const save = useMutation({
    mutationFn: (id: string) => {
      const picked = list.data?.calendars.find((c) => c.id === id);
      return calendarApi.setCalendar(provider, id, picked && !picked.isPrimary ? picked.name : null);
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: getGetCalendarStatusQueryKey() });
      setOpen(false);
      setChoice(null);
      toast({ title: t("dashboard.settings.calendar.targetSaved"), description: r.pushed || r.removed ? t("dashboard.settings.calendar.targetMoved").replace("{count}", String(r.pushed)) : undefined });
    },
    onError: () => toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" }),
  });

  const currentLabel = calendarId === "primary" || !calendarName ? t("dashboard.settings.calendar.targetPrimary") : calendarName;
  const selected = choice ?? calendarId;

  return (
    <div className="space-y-2" data-testid={`calendar-target-${provider}`}>
      <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t("dashboard.settings.calendar.targetLabel")} <b className="text-foreground">{currentLabel}</b></span>
        {can("integrations", "full") && !open && (
          <button type="button" className="cta-link ml-1" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>{t("dashboard.settings.calendar.targetChange")}</button>
        )}
      </p>
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          {list.isLoading ? (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("dashboard.settings.calendar.targetLoading")}</span>
          ) : list.isError ? (
            <span className="text-xs text-red-600">{t("dashboard.settings.calendar.targetListError")}</span>
          ) : list.data?.needsReconnect ? (
            <span className="text-xs text-muted-foreground">
              {t("dashboard.settings.calendar.targetReconnect")}{" "}
              <button type="button" className="cta-link" style={{ fontSize: 12 }} onClick={onReconnect}>{t("dashboard.settings.calendar.targetReconnectCta")}</button>
            </span>
          ) : (
            <>
              <label className="sr-only" htmlFor={`calendar-target-${provider}`}>{t("dashboard.settings.calendar.targetLabel")}</label>
              <select
                id={`calendar-target-${provider}`}
                className="inp-sm"
                style={{ width: "auto", maxWidth: "100%" }}
                value={selected}
                onChange={(e) => setChoice(e.target.value)}
                disabled={save.isPending}
              >
                {!list.data?.calendars.some((c) => c.id === selected) && <option value={selected}>{currentLabel}</option>}
                {list.data?.calendars.map((c) => (
                  <option key={c.id} value={c.id}>{c.isPrimary ? t("dashboard.settings.calendar.targetPrimary") : c.name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-navy btn-sm gap-2" disabled={save.isPending || selected === calendarId} onClick={() => save.mutate(selected)}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("dashboard.settings.calendar.targetSave")}
              </button>
              <button type="button" className="btn btn-outline-navy btn-sm" disabled={save.isPending} onClick={() => { setOpen(false); setChoice(null); }}>
                {t("dashboard.settings.calendar.targetCancel")}
              </button>
            </>
          )}
        </div>
      )}
      {open && list.data && !list.data.needsReconnect && <p className="text-[11px] text-muted-foreground">{t("dashboard.settings.calendar.targetHint")}</p>}
    </div>
  );
}
