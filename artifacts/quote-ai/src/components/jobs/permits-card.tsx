// Phase 87 — permits on a job. A checklist, not a registry: what is typically
// needed for the kind of work (suggested by province, with a link to who
// issues it), a status per permit, and the inspection date, which shows on
// the dashboard calendar. While any permit is still needed, applied for or
// issued without its final inspection, the job cannot be marked complete.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { ExternalLink, FileCheck2, Loader2, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { complianceApi, type PermitDto, type PermitInput, type PermitKind, type PermitStatus, type WorkType } from "@/lib/compliance-api";

const KINDS: PermitKind[] = ["building", "demolition", "electrical", "plumbing", "gas", "hvac", "other"];
const STATUSES: PermitStatus[] = ["needed", "applied", "issued", "closed", "not_required"];
const STATUS_CHIP: Record<PermitStatus, string> = { needed: "chip-red", applied: "chip-yellow", issued: "chip-teal", closed: "chip-green", not_required: "chip-grey" };
const dayDate = (s: string) => new Date(`${s}T00:00:00`);

export function PermitStatusChip({ status }: { status: PermitStatus }) {
  const { t } = useLanguage();
  return <span className={cn("chip", STATUS_CHIP[status])}>{t(`permits.status.${status}`)}</span>;
}

export function PermitsCard({ jobId }: { jobId: string }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const can = useCan();
  const canEdit = can("jobs", "edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["permits", jobId], queryFn: () => complianceApi.permits(jobId), retry: false });
  const [editing, setEditing] = useState<{ open: boolean; permit: PermitDto | null }>({ open: false, permit: null });
  const [suggestOpen, setSuggestOpen] = useState(false);
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["permits", jobId] }); queryClient.invalidateQueries({ queryKey: ["agenda"] }); };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: PermitStatus }) => complianceApi.updatePermit(jobId, id, { status }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => complianceApi.deletePermit(jobId, id), onSuccess: refresh, onError });

  if (!data) return null;
  const permits = data.permits;
  const open = permits.filter((p) => p.open).length;

  return (
    <section className="card">
      <div className="card-head">
        <div className="min-w-0">
          <h2><FileCheck2 className="h-4 w-4" /> {t("permits.title")}</h2>
          <p className="sub">{permits.length === 0 ? t("permits.subEmpty") : open ? t("permits.subOpen").replace("{n}", String(open)) : t("permits.subAllClear")}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setSuggestOpen(true)}><Wand2 className="h-4 w-4" /> {t("permits.suggest")}</button>
            <button type="button" className="ic-btn" title={t("permits.add")} aria-label={t("permits.add")} onClick={() => setEditing({ open: true, permit: null })}><Plus /></button>
          </div>
        )}
      </div>
      {permits.length > 0 && (
        <ul className="stack" style={{ gap: 0 }}>
          {permits.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3" style={{ padding: "12px 22px", borderTop: "1px solid var(--line)" }}>
              <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
                <b className="block text-sm text-navy-900">{p.title}</b>
                <span className="block text-xs text-slate-500">
                  {[t(`permits.kind.${p.kind}`), p.authority, p.referenceNumber ? `#${p.referenceNumber}` : null].filter(Boolean).join(" · ")}
                  {p.inspectionAt && ` · ${t("permits.inspection")} ${p.inspectionAt.endsWith("T00:00:00.000Z") ? format(dayDate(p.inspectionAt.slice(0, 10)), "PP", { locale }) : format(new Date(p.inspectionAt), "PPp", { locale })}`}
                  {p.expiresAt && ` · ${t("permits.expires")} ${format(dayDate(p.expiresAt), "PP", { locale })}`}
                </span>
              </div>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="text-link text-xs">{t("permits.where")} <ExternalLink className="h-3 w-3 inline" /></a>}
              {canEdit ? (
                <select className="inp-sm" style={{ width: "auto" }} aria-label={`${t("permits.statusLabel")} — ${p.title}`} value={p.status} onChange={(e) => setStatus.mutate({ id: p.id, status: e.target.value as PermitStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`permits.status.${s}`)}</option>)}
                </select>
              ) : <PermitStatusChip status={p.status} />}
              {canEdit && (
                <div className="row-act">
                  <button type="button" className="ic-btn" title={t("permits.edit")} aria-label={`${t("permits.edit")} — ${p.title}`} onClick={() => setEditing({ open: true, permit: p })}><Pencil /></button>
                  <button type="button" className="ic-btn danger" title={t("permits.delete")} aria-label={`${t("permits.delete")} — ${p.title}`} onClick={() => { if (confirm(t("permits.deleteConfirm"))) remove.mutate(p.id); }}><Trash2 /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="card-foot"><span className="foot-note">{t("permits.foot")}</span></div>
      <PermitDialog jobId={jobId} permit={editing.permit} open={editing.open} onOpenChange={(v) => setEditing((s) => ({ ...s, open: v }))} />
      <SuggestDialog jobId={jobId} workTypes={data.workTypes} open={suggestOpen} onOpenChange={setSuggestOpen} existing={permits} />
    </section>
  );
}

function PermitDialog({ jobId, permit, open, onOpenChange }: { jobId: string; permit: PermitDto | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PermitInput & { inspectionDay?: string; inspectionTime?: string }>({});
  useEffect(() => {
    if (!open) return;
    const ins = permit?.inspectionAt ? new Date(permit.inspectionAt) : null;
    const dateOnly = permit?.inspectionAt?.endsWith("T00:00:00.000Z");
    setForm({
      kind: permit?.kind ?? "building",
      title: permit?.title ?? "",
      authority: permit?.authority ?? "",
      referenceNumber: permit?.referenceNumber ?? "",
      url: permit?.url ?? "",
      status: permit?.status ?? "needed",
      appliedAt: permit?.appliedAt ?? null,
      issuedAt: permit?.issuedAt ?? null,
      expiresAt: permit?.expiresAt ?? null,
      notes: permit?.notes ?? "",
      inspectionDay: ins ? (dateOnly ? permit!.inspectionAt!.slice(0, 10) : format(ins, "yyyy-MM-dd")) : "",
      inspectionTime: ins && !dateOnly ? format(ins, "HH:mm") : "",
    });
  }, [open, permit]);

  const save = useMutation({
    mutationFn: () => {
      const { inspectionDay, inspectionTime, ...rest } = form;
      // A day alone is an all-day inspection; a time makes it a booked hour in the browser's zone.
      const inspectionAt = !inspectionDay ? null : inspectionTime ? new Date(`${inspectionDay}T${inspectionTime}:00`).toISOString() : inspectionDay;
      const body: PermitInput = { ...rest, title: (rest.title ?? "").trim(), url: rest.url?.trim() || null, appliedAt: rest.appliedAt || null, issuedAt: rest.issuedAt || null, expiresAt: rest.expiresAt || null, inspectionAt };
      return permit ? complianceApi.updatePermit(jobId, permit.id, body).then(() => undefined) : complianceApi.addPermits(jobId, [body]).then(() => undefined);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["permits", jobId] }); queryClient.invalidateQueries({ queryKey: ["agenda"] }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{permit ? t("permits.edit") : t("permits.add")}</DialogTitle><DialogDescription>{t("permits.dialogDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field full"><label htmlFor="p-title">{t("permits.name")}</label><input id="p-title" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("permits.namePlaceholder")} /></div>
            <div className="field"><label htmlFor="p-kind">{t("permits.kindLabel")}</label>
              <select id="p-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PermitKind })}>{KINDS.map((k) => <option key={k} value={k}>{t(`permits.kind.${k}`)}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="p-status">{t("permits.statusLabel")}</label>
              <select id="p-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PermitStatus })}>{STATUSES.map((s) => <option key={s} value={s}>{t(`permits.status.${s}`)}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="p-auth">{t("permits.authority")}</label><input id="p-auth" value={form.authority ?? ""} onChange={(e) => setForm({ ...form, authority: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-ref">{t("permits.reference")}</label><input id="p-ref" value={form.referenceNumber ?? ""} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} /></div>
            <div className="field full"><label htmlFor="p-url">{t("permits.link")}</label><input id="p-url" type="url" value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></div>
            <div className="field"><label htmlFor="p-applied">{t("permits.appliedOn")}</label><input id="p-applied" type="date" value={form.appliedAt ?? ""} onChange={(e) => setForm({ ...form, appliedAt: e.target.value || null })} /></div>
            <div className="field"><label htmlFor="p-issued">{t("permits.issuedOn")}</label><input id="p-issued" type="date" value={form.issuedAt ?? ""} onChange={(e) => setForm({ ...form, issuedAt: e.target.value || null })} /></div>
            <div className="field"><label htmlFor="p-insp">{t("permits.inspectionOn")}</label><input id="p-insp" type="date" value={form.inspectionDay ?? ""} onChange={(e) => setForm({ ...form, inspectionDay: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-insp-time">{t("permits.inspectionTime")}</label><input id="p-insp-time" type="time" value={form.inspectionTime ?? ""} onChange={(e) => setForm({ ...form, inspectionTime: e.target.value })} disabled={!form.inspectionDay} /></div>
            <div className="field"><label htmlFor="p-exp">{t("permits.expiresOn")}</label><input id="p-exp" type="date" value={form.expiresAt ?? ""} onChange={(e) => setForm({ ...form, expiresAt: e.target.value || null })} /></div>
            <div className="field full"><label htmlFor="p-notes">{t("permits.notes")}</label><input id="p-notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!form.title?.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestDialog({ jobId, workTypes, open, onOpenChange, existing }: { jobId: string; workTypes: WorkType[]; open: boolean; onOpenChange: (v: boolean) => void; existing: PermitDto[] }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [works, setWorks] = useState<WorkType[]>([]);
  // Only what the person changed is state; by default every suggestion not already on the job is ticked.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  useEffect(() => { if (open) { setWorks([]); setOverrides(new Map()); } }, [open]);
  const { data } = useQuery({ queryKey: ["permit-suggest", jobId, works.join(",")], queryFn: () => complianceApi.suggest(jobId, works), enabled: open && works.length > 0 });
  const have = new Set(existing.map((p) => p.kind));
  const suggestions = works.length > 0 ? (data?.suggestions ?? []) : [];
  const picked = new Set(suggestions.filter((s) => overrides.get(s.kind) ?? !have.has(s.kind)).map((s) => s.kind));

  const add = useMutation({
    mutationFn: () => complianceApi.addPermits(jobId, suggestions.filter((s) => picked.has(s.kind)).map((s) => ({ kind: s.kind, title: t(`permits.kindTitle.${s.kind}`), authority: s.authority, url: s.url, status: "needed" as const }))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["permits", jobId] }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const toggle = <T,>(set: T[], v: T) => (set.includes(v) ? set.filter((x) => x !== v) : [...set, v]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{t("permits.suggestTitle")}</DialogTitle><DialogDescription>{t("permits.suggestDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <fieldset className="field full">
              <legend className="text-sm font-bold text-navy-900" style={{ marginBottom: 8 }}>{t("permits.whatWork")}</legend>
              <div className="flex flex-wrap gap-2">
                {workTypes.map((w) => (
                  <button key={w} type="button" aria-pressed={works.includes(w)} className={cn("pill", works.includes(w) && "on")} onClick={() => setWorks(toggle(works, w))}>{t(`permits.work.${w}`)}</button>
                ))}
              </div>
            </fieldset>
            {suggestions.length > 0 && (
              <fieldset className="field full">
                <legend className="text-sm font-bold text-navy-900" style={{ marginBottom: 8 }}>{t("permits.typically")}</legend>
                <ul className="stack" style={{ gap: 8 }}>
                  {suggestions.map((s) => (
                    <li key={s.kind}>
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={picked.has(s.kind)} onChange={() => setOverrides((prev) => new Map(prev).set(s.kind, !picked.has(s.kind)))} />
                        <span>
                          <b className="block">{t(`permits.kindTitle.${s.kind}`)}{have.has(s.kind) ? ` — ${t("permits.alreadyListed")}` : ""}</b>
                          <span className="block text-xs text-slate-500">{s.authority} · <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-link">{t("permits.where")} <ExternalLink className="h-3 w-3 inline" /></a></span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <span className="foot-note">{t("permits.checkLocal")}</span>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={picked.size === 0 || add.isPending} onClick={() => add.mutate()}>{add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("permits.addPicked").replace("{n}", String(picked.size))}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
