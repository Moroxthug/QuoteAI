import { useState } from "react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Bell, CalendarMinus, CalendarPlus, CalendarClock, Check, ListPlus, ListChecks, MessageSquareReply, PencilLine } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { workerApi, type CrewChangeDto } from "@/lib/team-api";

const ICON = {
  shift_added: CalendarPlus,
  shift_changed: CalendarClock,
  shift_removed: CalendarMinus,
  task_added: ListPlus,
  task_changed: PencilLine,
  task_done: ListChecks,
  answer: MessageSquareReply,
} as const;

/**
 * Phase 86b — "since you last looked", above Today on /t/:token: shifts the
 * office added, moved or took away, tasks added or changed on their jobs, and
 * answers to their blockers. It stays until the worker taps "Got it", so a
 * reload on a patchy connection does not lose it.
 */
export function WorkerChanges({ token, changes, upTo }: { token: string; changes: CrewChangeDto[]; upTo: string }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || changes.length === 0) return null;

  const when = (c: Extract<CrewChangeDto, { startsAt: string }>) => {
    const s = new Date(c.startsAt);
    const day = format(s, "EEE d MMM", { locale });
    return c.allDay ? `${day} · ${t("worker.allDay")}` : `${day} · ${format(s, "H:mm", { locale })}–${format(new Date(c.endsAt), "H:mm", { locale })}`;
  };

  const line = (c: CrewChangeDto): { head: string; detail: string | null } => {
    switch (c.kind) {
      case "shift_added":
        return { head: t("crew.change.shiftAdded"), detail: `${c.label} — ${when(c)}` };
      case "shift_changed":
        return { head: t("crew.change.shiftChanged"), detail: `${c.label} — ${when(c)}` };
      case "shift_removed":
        return { head: t("crew.change.shiftRemoved"), detail: when(c) };
      case "task_added":
        return { head: `${t("crew.change.taskAdded")} · ${c.projectName}`, detail: c.by ? `${c.title} (${c.by})` : c.title };
      case "task_changed":
        return { head: `${t("crew.change.taskChanged")} · ${c.projectName}`, detail: c.title };
      case "task_done":
        return { head: `${t("crew.change.taskDone")} · ${c.projectName}`, detail: c.by ? `${c.title} (${c.by})` : c.title };
      case "answer":
        return { head: `${t("crew.change.answer")}${c.projectName ? ` · ${c.projectName}` : ""}`, detail: c.answer ? `${c.answer}${c.by ? ` — ${c.by}` : ""}` : c.body };
    }
  };

  const gotIt = () => {
    setDismissed(true);
    // Best effort: offline, the list simply comes back on the next load and can be dismissed then.
    workerApi.markSeen(token, upTo).catch(() => {});
  };

  return (
    <section className="card p-4 space-y-2" aria-labelledby="worker-changes-h" style={{ borderColor: "var(--teal)" }}>
      <h2 id="worker-changes-h" className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}>
        <Bell className="h-4 w-4" /> {t("crew.changesTitle")}
      </h2>
      <ul className="space-y-2">
        {changes.map((c) => {
          const Icon = ICON[c.kind];
          const { head, detail } = line(c);
          return (
            <li key={`${c.kind}-${"blockId" in c ? c.blockId : "taskId" in c ? c.taskId : c.reportId}`} className="flex items-start gap-2.5 text-sm">
              <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: c.kind === "shift_removed" ? "var(--red)" : "var(--teal-dark)" }} aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-medium" style={{ color: "var(--ink)" }}>{head}</div>
                {detail && <div className="text-xs break-words" style={{ color: "var(--muted-mk)" }}>{detail}</div>}
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-sm btn-outline-navy" onClick={gotIt}>
        <Check className="h-4 w-4" /> {t("crew.changesGotIt")}
      </button>
    </section>
  );
}
