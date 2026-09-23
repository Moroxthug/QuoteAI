import { useMemo, useState } from "react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { CloudUpload, MapPin, Phone, Sun } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { runOrQueue, useOutbox } from "@/lib/offline/outbox";
import { workerApi, type CrewTaskStatus, type WorkerTodayJobDto } from "@/lib/team-api";

/** A maps link that opens the phone's own maps app from an address; no key, no tracking pixel. */
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/**
 * Phase 86 — "what am I doing today" at the top of /t/:token: each job the
 * worker is booked on today, when, where (a maps link), who to call on site,
 * and the tasks under it, tickable offline.
 */
export function WorkerToday({ token, jobs }: { token: string; jobs: WorkerTodayJobDto[] }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const outbox = useOutbox(token);
  // What this phone last set, until the page reloads with the server's answer.
  const [local, setLocal] = useState<Record<string, CrewTaskStatus>>({});
  const queuedTasks = useMemo(() => new Set(outbox.rows.filter((r) => r.op.kind === "worker.task" && r.status === "pending").map((r) => (r.op as { taskId: string }).taskId)), [outbox.rows]);

  const toggle = async (taskId: string, done: boolean) => {
    const status: CrewTaskStatus = done ? "done" : "todo";
    setLocal((m) => ({ ...m, [taskId]: status }));
    try {
      await runOrQueue({ kind: "worker.task", token, taskId, status }, { scope: token, label: t("crew.taskLabel") }, () => workerApi.setTask(token, taskId, status));
    } catch {
      setLocal((m) => {
        const next = { ...m };
        delete next[taskId];
        return next;
      });
    }
  };

  if (jobs.length === 0) return null;
  return (
    <section className="card p-4 space-y-3" aria-labelledby="worker-today-h">
      <h2 id="worker-today-h" className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}>
        <Sun className="h-4 w-4" /> {t("crew.todayTitle")}
      </h2>
      {jobs.map((j) => {
        const open = j.tasks.filter((x) => (local[x.id] ?? x.status) !== "done").length;
        return (
          <article key={j.id} className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--line)" }}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-sm" style={{ color: "var(--navy)" }}>{j.name}</h3>
              <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--muted-mk)" }}>
                {j.blocks.length === 0 ? t("crew.clockedInHere") : j.blocks.map((b) => (b.allDay ? t("worker.allDay") : `${format(new Date(b.startsAt), "H:mm", { locale })}–${format(new Date(b.endsAt), "H:mm", { locale })}`)).join(", ")}
              </span>
            </div>
            {(j.address || j.contact) && (
              <div className="flex flex-wrap gap-2">
                {j.address && (
                  <a className="btn btn-sm btn-outline-navy" href={mapsUrl(j.address)} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-4 w-4" /> <span className="truncate max-w-[14rem]">{j.address}</span>
                  </a>
                )}
                {j.contact?.phone && (
                  <a className="btn btn-sm btn-outline-navy" href={`tel:${j.contact.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone className="h-4 w-4" /> {t("crew.call")} {j.contact.name}
                  </a>
                )}
                {j.contact && !j.contact.phone && <span className="text-xs self-center" style={{ color: "var(--muted-mk)" }}>{t("crew.siteContact")}: {j.contact.name}</span>}
              </div>
            )}
            {j.blocks.filter((b) => b.notes).map((b) => (
              <p key={b.id} className="text-xs rounded-lg px-2 py-1.5" style={{ background: "var(--soft)", color: "var(--ink)" }}>{b.notes}</p>
            ))}
            {j.tasks.length > 0 && (
              <fieldset className="space-y-1">
                <legend className="text-xs font-medium mb-1" style={{ color: "var(--muted-mk)" }}>{t("crew.tasks")} · {open === 0 ? t("crew.allDone") : `${open} ${t("crew.toDo")}`}</legend>
                {j.tasks.map((task) => {
                  const status = local[task.id] ?? task.status;
                  const id = `task-${task.id}`;
                  return (
                    <div key={task.id} className="flex items-start gap-2.5 py-1">
                      <input id={id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={status === "done"} onChange={(e) => void toggle(task.id, e.target.checked)} />
                      <label htmlFor={id} className="text-sm leading-snug flex-1 min-w-0" style={{ color: status === "done" ? "var(--faint)" : "var(--ink)", textDecoration: status === "done" ? "line-through" : undefined }}>
                        {task.title}
                        {task.milestoneTitle && <span className="block text-[11px]" style={{ color: "var(--faint)" }}>{task.milestoneTitle}</span>}
                      </label>
                      {queuedTasks.has(task.id) && <CloudUpload className="h-3.5 w-3.5 mt-1 shrink-0" style={{ color: "var(--teal-dark)" }} aria-label={t("worker.status.pending")} />}
                    </div>
                  );
                })}
              </fieldset>
            )}
          </article>
        );
      })}
    </section>
  );
}
