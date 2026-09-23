import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Camera, CheckCircle2, CloudUpload, Loader2, MessageSquareText, OctagonAlert, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { runOrQueue, useOutbox } from "@/lib/offline/outbox";
import { shrinkPhoto } from "@/lib/image-shrink";
import { workerApi, type FieldReportDto, type FieldReportKind } from "@/lib/team-api";

type Job = { id: string; name: string; milestones: { id: string; title: string }[] };

const KINDS: { kind: FieldReportKind; icon: typeof Camera }[] = [
  { kind: "note", icon: MessageSquareText },
  { kind: "blocker", icon: OctagonAlert },
  { kind: "materials", icon: Package },
];

/** "12,50" or "12.50" or "$12" → 1250 cents; null when it is not a number. */
function parseDollars(v: string): number | null {
  const n = Number(v.replace(/[$\s]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/**
 * Phase 86 — report from the field without an account. A photo with a note,
 * "I'm blocked" (which pushes to the office), or materials used against the
 * job. Goes through the offline outbox like the clock does, photo and all.
 */
export function FieldReportCard({ token, jobs, defaultJobId, reports }: { token: string; jobs: Job[]; defaultJobId: string | null; reports: FieldReportDto[] }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const queryClient = useQueryClient();
  const outbox = useOutbox(token);
  const fileInput = useRef<HTMLInputElement>(null);

  const [projectId, setProjectId] = useState(defaultJobId ?? "");
  const [kind, setKind] = useState<FieldReportKind>("note");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sent, setSent] = useState<false | "online" | "offline">(false);

  useEffect(() => { if (!projectId && defaultJobId) setProjectId(defaultJobId); }, [defaultJobId, projectId]);
  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const jobName = (id: string) => jobs.find((j) => j.id === id)?.name ?? "";
  const cents = kind === "materials" ? parseDollars(amount) : null;
  const canSend = !!projectId && (kind === "materials" ? (cents !== null && cents > 0) || body.trim().length > 0 : body.trim().length > 0 || !!photo);

  const send = useMutation({
    mutationFn: async () => {
      const shrunk = photo ? await shrinkPhoto(photo) : null;
      const input = { projectId, kind, body: body.trim() || undefined, materialsCents: cents, file: shrunk?.blob ?? null, fileName: shrunk?.fileName };
      return runOrQueue(
        { kind: "worker.report", token, projectId, reportKind: kind, body: input.body, materialsCents: cents, file: input.file, fileName: input.fileName },
        { scope: token, label: `${t(`crew.kind.${kind}`)} · ${jobName(projectId)}` },
        (clientRef) => workerApi.report(token, { ...input, clientRef }),
      );
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["worker", token] });
      setBody(""); setAmount(""); setPhoto(null); setKind("note");
      if (fileInput.current) fileInput.current.value = "";
      setSent(r.queued ? "offline" : "online");
      setTimeout(() => setSent(false), 3500);
    },
  });

  const pending = useMemo(() => outbox.rows.filter((r) => r.op.kind === "worker.report"), [outbox.rows]);

  if (jobs.length === 0) return null;
  return (
    <section className="card p-4 space-y-3" aria-labelledby="field-report-h">
      <h2 id="field-report-h" className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}><Camera className="h-4 w-4" /> {t("crew.reportTitle")}</h2>

      <div className="field">
        <label htmlFor="report-job">{t("worker.job")}</label>
        <select id="report-job" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="" disabled>{t("crew.pickJob")}</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </div>

      <div role="group" aria-label={t("crew.kindLabel")} className="grid grid-cols-3 gap-2">
        {KINDS.map(({ kind: k, icon: Icon }) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className="rounded-xl px-2 py-2.5 text-xs font-semibold inline-flex flex-col items-center gap-1"
            style={kind === k ? { border: `1px solid ${k === "blocker" ? "var(--red)" : "var(--navy)"}`, background: "var(--soft)", color: k === "blocker" ? "var(--red)" : "var(--navy)" } : { border: "1px solid var(--line)", background: "#fff", color: "var(--muted-mk)" }}
          >
            <Icon className="h-4 w-4" /> {t(`crew.kind.${k}`)}
          </button>
        ))}
      </div>
      {kind === "blocker" && <p className="text-[11px]" style={{ color: "var(--muted-mk)" }}>{t("crew.blockerHint")}</p>}

      {kind === "materials" && (
        <div className="field">
          <label htmlFor="report-amount">{t("crew.materialsAmount")}</label>
          <input id="report-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
      )}

      <div className="field">
        <label htmlFor="report-body">{kind === "materials" ? t("crew.materialsWhat") : kind === "blocker" ? t("crew.blockerWhat") : t("crew.noteWhat")}</label>
        <textarea id="report-body" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt={t("crew.photoPreview")} className="h-24 w-24 object-cover rounded-lg" style={{ border: "1px solid var(--line)" }} />
          <button type="button" className="absolute -top-2 -right-2 h-7 w-7 rounded-full inline-flex items-center justify-center" style={{ background: "var(--navy)", color: "#fff" }} aria-label={t("crew.removePhoto")} onClick={() => { setPhoto(null); if (fileInput.current) fileInput.current.value = ""; }}><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <label className="btn btn-outline-navy w-full cursor-pointer">
          <Camera className="h-4 w-4" /> {t("crew.addPhoto")}
          <input ref={fileInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
      )}

      {send.error && <p className="text-xs" style={{ color: "var(--red)" }} role="alert">{(send.error as Error).message}</p>}
      <button
        type="button"
        className="btn w-full text-base"
        style={sent ? { background: sent === "offline" ? "var(--teal-dark)" : "var(--green-dark)", color: "#fff" } : { background: kind === "blocker" ? "var(--red)" : "var(--navy)", color: "#fff" }}
        disabled={!canSend || send.isPending}
        onClick={() => send.mutate()}
      >
        {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : sent === "offline" ? <CloudUpload className="h-5 w-5" /> : sent ? <CheckCircle2 className="h-5 w-5" /> : null}
        {sent === "offline" ? t("worker.savedOffline") : sent ? t("crew.sent") : kind === "blocker" ? t("crew.sendBlocker") : t("crew.send")}
      </button>

      {(pending.length > 0 || reports.length > 0) && (
        <div className="pt-1">
          <h3 className="text-xs font-semibold mb-1" style={{ color: "var(--muted-mk)" }}>{t("crew.yourReports")}</h3>
          <ul className="divide-y" style={{ borderColor: "var(--soft)" }}>
            {pending.map((r) => (
              <li key={r.id} className="py-2 text-sm flex items-center gap-2" style={{ borderColor: "var(--soft)" }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{r.label}</span>
                <span className={cn("doc-status", r.status === "failed" ? "danger" : "warn")}>{r.status === "failed" ? t("worker.status.failed") : t("worker.status.pending")}</span>
              </li>
            ))}
            {reports.map((r) => (
              <li key={r.id} className="py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>
                    <b>{t(`crew.kind.${r.kind}`)}</b> · {r.projectName}{r.body ? ` — ${r.body}` : ""}
                  </span>
                  {r.kind === "blocker" && <span className={cn("doc-status", r.resolvedAt ? "ok" : "danger")}>{r.resolvedAt ? t("crew.answered") : t("crew.open")}</span>}
                </div>
                <div className="text-[11px]" style={{ color: "var(--faint)" }}>
                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale })}
                  {r.photoId ? ` · ${t("crew.withPhoto")}` : ""}
                  {r.materialsCents ? ` · ${(r.materialsCents / 100).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" })}` : ""}
                </div>
                {r.resolutionNote && <p className="text-xs mt-1 rounded-lg px-2 py-1" style={{ background: "var(--soft)", color: "var(--ink)" }}>{r.resolvedByName ? `${r.resolvedByName}: ` : ""}{r.resolutionNote}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
