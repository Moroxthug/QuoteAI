import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Car, CheckCircle2, CloudUpload, Loader2, Minus, Plus, Trash2, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { runOrQueue, useOutbox } from "@/lib/offline/outbox";
import { workerApi, type WorkerAllowanceDto } from "@/lib/team-api";

type Job = { id: string; name: string };
type Kind = "mileage" | "per_diem";

const day = (s: string) => new Date(`${s}T00:00:00`);

/**
 * Phase 89b — km and per diem from the site. An employee logs the distance or
 * the days; the office prices it at the company's rate and approves it under
 * Pay, so no amount is ever shown here. Goes through the offline outbox.
 */
export function TravelCard({ token, jobs, today, defaultJobId, travel, allowances }: { token: string; jobs: Job[]; today: string; defaultJobId: string | null; travel: { km: boolean; perDiem: boolean }; allowances: WorkerAllowanceDto[] }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const queryClient = useQueryClient();
  const outbox = useOutbox(token);
  const kinds = useMemo(() => [...(travel.km ? (["mileage"] as const) : []), ...(travel.perDiem ? (["per_diem"] as const) : [])], [travel.km, travel.perDiem]);

  const [kind, setKind] = useState<Kind>(kinds[0] ?? "mileage");
  const [km, setKm] = useState("");
  const [days, setDays] = useState(1);
  const [date, setDate] = useState(today);
  const [projectId, setProjectId] = useState(defaultJobId ?? "");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<false | "online" | "offline">(false);
  useEffect(() => { if (!projectId && defaultJobId) setProjectId(defaultJobId); }, [defaultJobId, projectId]);

  const quantity = kind === "mileage" ? Number(km.replace(",", ".")) : days;
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= (kind === "mileage" ? 2000 : 31) && !!date;
  const jobName = (id: string) => jobs.find((j) => j.id === id)?.name ?? "";
  const label = (k: Kind, q: number) => (k === "mileage" ? `${q} km` : t("crew.travel.daysN").replace("{n}", String(q)));

  const send = useMutation({
    mutationFn: () => {
      const input = { kind, quantity, date, projectId: projectId || null, note: note.trim() || undefined };
      return runOrQueue(
        { kind: "worker.allowance", token, allowanceKind: kind, quantity, date, projectId: input.projectId, note: input.note },
        { scope: token, label: `${t(`crew.travel.kind.${kind}`)} · ${label(kind, quantity)}${projectId ? ` · ${jobName(projectId)}` : ""}` },
        (clientRef) => workerApi.addAllowance(token, { ...input, clientRef }),
      );
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["worker", token] });
      setKm(""); setDays(1); setNote("");
      setSent(r.queued ? "offline" : "online");
      setTimeout(() => setSent(false), 3500);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => workerApi.removeAllowance(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }),
  });

  const pending = useMemo(() => outbox.rows.filter((r) => r.op.kind === "worker.allowance"), [outbox.rows]);
  if (!kinds.length) return null;

  return (
    <section className="card p-4 space-y-3" aria-labelledby="travel-h">
      <h2 id="travel-h" className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}><Car className="h-4 w-4" /> {t("crew.travel.title")}</h2>

      {kinds.length > 1 && (
        <div role="group" aria-label={t("crew.travel.kindLabel")} className="grid grid-cols-2 gap-2">
          {kinds.map((k) => {
            const Icon = k === "mileage" ? Car : Utensils;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className="rounded-xl px-2 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                style={kind === k ? { border: "1px solid var(--navy)", background: "var(--soft)", color: "var(--navy)" } : { border: "1px solid var(--line)", background: "#fff", color: "var(--muted-mk)" }}
              >
                <Icon className="h-4 w-4" /> {t(`crew.travel.kind.${k}`)}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {kind === "mileage" ? (
          <div className="field">
            <label htmlFor="travel-km">{t("crew.travel.km")}</label>
            <input id="travel-km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" />
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="travel-days" style={{ color: "var(--muted-mk)" }}>{t("crew.travel.days")}</label>
            <div className="flex items-center rounded-xl h-11 overflow-hidden" style={{ border: "1px solid var(--line)", background: "#fff" }}>
              <button type="button" aria-label={t("a11y.decrease")} className="h-full w-11 flex items-center justify-center" style={{ color: "var(--ink)" }} onClick={() => setDays((d) => Math.max(0.5, d - 0.5))}><Minus className="h-4 w-4" /></button>
              <input id="travel-days" type="number" step="0.5" min="0.5" max="31" value={days} onChange={(e) => setDays(Math.min(31, Math.max(0.5, Number(e.target.value) || 0.5)))} className="flex-1 min-w-0 text-center font-bold text-lg outline-none" style={{ color: "var(--navy)" }} />
              <button type="button" aria-label={t("a11y.increase")} className="h-full w-11 flex items-center justify-center" style={{ color: "var(--ink)" }} onClick={() => setDays((d) => Math.min(31, d + 0.5))}><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="travel-date">{t("worker.date")}</label>
          <input id="travel-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="field">
          <label htmlFor="travel-job">{t("worker.job")}</label>
          <select id="travel-job" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t("crew.travel.noJob")}</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="travel-note">{t("crew.travel.note")}</label>
        <input id="travel-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "mileage" ? t("crew.travel.notePlaceholder") : ""} />
      </div>

      {send.error && <p className="text-xs" style={{ color: "var(--red)" }} role="alert">{(send.error as Error).message}</p>}
      <button
        type="button"
        className="btn w-full text-base"
        style={sent ? { background: sent === "offline" ? "var(--teal-dark)" : "var(--green-dark)", color: "#fff" } : { background: "var(--navy)", color: "#fff" }}
        disabled={!valid || send.isPending}
        onClick={() => send.mutate()}
      >
        {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : sent === "offline" ? <CloudUpload className="h-5 w-5" /> : sent ? <CheckCircle2 className="h-5 w-5" /> : null}
        {sent === "offline" ? t("worker.savedOffline") : sent ? t("crew.sent") : t("crew.travel.send")}
      </button>
      <p className="text-[11px]" style={{ color: "var(--muted-mk)" }}>{t("crew.travel.hint")}</p>

      {(pending.length > 0 || allowances.length > 0) && (
        <div className="pt-1">
          <h3 className="text-xs font-semibold mb-1" style={{ color: "var(--muted-mk)" }}>{t("crew.travel.yours")}</h3>
          <ul className="divide-y" style={{ borderColor: "var(--soft)" }}>
            {pending.map((r) => (
              <li key={r.id} className="py-2 text-sm flex items-center gap-2" style={{ borderColor: "var(--soft)" }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{r.label}</span>
                <span className={cn("doc-status", r.status === "failed" ? "danger" : "warn")}>{r.status === "failed" ? t("worker.status.failed") : t("worker.status.pending")}</span>
              </li>
            ))}
            {allowances.map((a) => (
              <li key={a.id} className="py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>
                    <b>{format(day(a.date), "d MMM", { locale })}</b> · {a.kind === "other" ? t("crew.travel.kind.other") : label(a.kind, a.quantity)}{a.projectName ? ` · ${a.projectName}` : ""}{a.note ? ` — ${a.note}` : ""}
                  </span>
                  <span className={cn("doc-status", a.status === "approved" ? "ok" : a.status === "rejected" ? "danger" : "warn")}>{t(`worker.status.${a.status}`)}</span>
                  {a.status === "submitted" && a.enteredBy === "worker" && (
                    <button type="button" className="h-8 w-8 inline-flex items-center justify-center" style={{ color: "var(--muted-mk)" }} aria-label={t("crew.travel.remove")} disabled={remove.isPending} onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
                {a.status === "rejected" && a.rejectedReason && <p className="text-xs mt-1 rounded-lg px-2 py-1" style={{ background: "var(--soft)", color: "var(--ink)" }}>{a.rejectedReason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
