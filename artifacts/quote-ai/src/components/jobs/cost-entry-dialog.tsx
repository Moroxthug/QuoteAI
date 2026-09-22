import { localDay } from "@/lib/local-day";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, ExternalLink, AlertTriangle } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type CostCategory, type CostEntryDto, type CostEntryEdit, type MilestoneDto } from "@/lib/jobs-api";
import { runOrQueue } from "@/lib/offline/outbox";

export const COST_CATEGORY_KEYS: CostCategory[] = ["materials", "labour", "subcontractor", "permits_fees", "equipment", "misc"];
const TAX_KEYS = ["GST", "HST", "PST", "QST"] as const;

const toDollars = (c: number | undefined | null) => (c ? (c / 100).toFixed(2) : "");
const toCents = (s: string) => Math.round((Number(s) || 0) * 100);

/**
 * Add / edit / confirm a cost entry. For receipts the AI reading is shown
 * next to the editable fields together with the receipt image, so
 * confirming is a glance + one click.
 */
export function CostEntryDialog({
  jobId,
  entry,
  milestones,
  jobs,
  open,
  onOpenChange,
}: {
  /** Job the dialog belongs to (may differ from entry.projectId for unmatched receipts). */
  jobId: string | null;
  entry: CostEntryDto | null;
  milestones: MilestoneDto[];
  /** Optional job list so an unmatched receipt can be assigned. */
  jobs?: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = !entry;
  const isReceipt = entry?.source === "receipt";

  const [projectId, setProjectId] = useState<string>(entry?.projectId ?? jobId ?? "");
  const [category, setCategory] = useState<CostCategory>(entry?.category ?? "materials");
  const [vendor, setVendor] = useState(entry?.vendor ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [date, setDate] = useState(entry?.date ?? localDay());
  const [milestoneId, setMilestoneId] = useState<string>(entry?.milestoneId ?? "");
  const [subtotal, setSubtotal] = useState(toDollars(entry?.subtotalCents));
  const [taxes, setTaxes] = useState<Record<(typeof TAX_KEYS)[number], string>>({ GST: toDollars(entry?.taxBreakdown.GST), HST: toDollars(entry?.taxBreakdown.HST), PST: toDollars(entry?.taxBreakdown.PST), QST: toDollars(entry?.taxBreakdown.QST) });
  const [total, setTotal] = useState(toDollars(entry?.totalCents));

  useEffect(() => {
    if (!open) return;
    setProjectId(entry?.projectId ?? jobId ?? "");
    setCategory(entry?.category ?? "materials");
    setVendor(entry?.vendor ?? "");
    setDescription(entry?.description ?? "");
    setDate(entry?.date ?? localDay());
    setMilestoneId(entry?.milestoneId ?? "");
    setSubtotal(toDollars(entry?.subtotalCents));
    setTaxes({ GST: toDollars(entry?.taxBreakdown.GST), HST: toDollars(entry?.taxBreakdown.HST), PST: toDollars(entry?.taxBreakdown.PST), QST: toDollars(entry?.taxBreakdown.QST) });
    setTotal(toDollars(entry?.totalCents));
  }, [open, entry, jobId]);

  const taxCents = TAX_KEYS.reduce((s, k) => s + toCents(taxes[k]), 0);
  // Typing a subtotal or a tax recomputes the total; typing the total leaves it alone.
  const onSubtotal = (v: string) => { setSubtotal(v); setTotal(((toCents(v) + taxCents) / 100).toFixed(2)); };
  const onTax = (k: (typeof TAX_KEYS)[number], v: string) => {
    const next = { ...taxes, [k]: v };
    setTaxes(next);
    const tc = TAX_KEYS.reduce((s, kk) => s + toCents(next[kk]), 0);
    setTotal(((toCents(subtotal) + tc) / 100).toFixed(2));
  };

  const body = (): CostEntryEdit => {
    const taxBreakdown: CostEntryEdit["taxBreakdown"] = {};
    for (const k of TAX_KEYS) if (toCents(taxes[k])) taxBreakdown[k] = toCents(taxes[k]);
    return { category, vendor: vendor.trim(), description: description.trim(), date, milestoneId: milestoneId || null, subtotalCents: toCents(subtotal), taxCents, taxBreakdown, totalCents: toCents(total), ...(projectId && projectId !== entry?.projectId ? { projectId } : {}) };
  };
  const targetJob = projectId || jobId || entry?.projectId || "";
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["job", targetJob] });
    if (entry?.projectId && entry.projectId !== targetJob) queryClient.invalidateQueries({ queryKey: ["job", entry.projectId] });
    queryClient.invalidateQueries({ queryKey: ["costs-review"] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });

  const save = useMutation({
    mutationFn: async (confirm: boolean) => {
      if (isNew) {
        // Phase 77: a new cost typed on site goes through the outbox when there is no signal.
        const b = { ...body(), category, totalCents: toCents(total) };
        const r = await runOrQueue({ kind: "job.addCost", jobId: targetJob, body: b }, { scope: targetJob, label: `${formatCents(b.totalCents)} · ${b.vendor || b.description || t("jobs.costs.newEntry")}` }, (clientRef) => jobsApi.addCost(targetJob, { ...b, clientRef }));
        return r.queued;
      }
      await jobsApi.updateCost(entry.projectId ?? targetJob, entry.id, { ...body(), ...(confirm ? { status: "confirmed" as const } : {}) });
      return false;
    },
    onSuccess: (queued, confirm) => { refresh(); onOpenChange(false); if (queued) toast({ title: t("offline.savedOnDevice"), description: t("offline.savedOnDeviceHint") }); else if (confirm) toast({ title: t("jobs.costs.confirmedToast") }); },
    onError,
  });

  const valid = !!targetJob && toCents(total) !== 0 && (description.trim() || vendor.trim());
  const ai = entry?.aiExtraction ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={isReceipt ? "xxl" : "xl"}>
        <DialogHeader>
          <DialogTitle>{isNew ? t("jobs.costs.newEntry") : isReceipt && entry.status === "pending_review" ? t("jobs.costs.reviewReceipt") : t("jobs.costs.editEntry")}</DialogTitle>
          <DialogDescription>{isReceipt ? t("jobs.costs.reviewReceiptDesc") : t("jobs.costs.newEntryDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className={isReceipt ? "receipt-split" : undefined}>
            {isReceipt && entry.sourceDocumentId && (
              <div>
                <div className="receipt-frame">
                  <ReceiptPreview docId={entry.sourceDocumentId} />
                </div>
                {ai && (
                  <div className="ai-read">
                    <div className="hd"><Sparkles /> {t("jobs.costs.aiRead")} · <span className={`conf ${ai.confidence}`}>{t(`jobs.costs.confidence.${ai.confidence}`)}</span></div>
                    {ai.lines.length > 0 && (
                      <ul>
                        {ai.lines.map((l, i) => (
                          <li key={i}><span>{l.quantity && l.quantity !== 1 ? `${l.quantity} × ` : ""}{l.description}</span>{l.total !== null && <span>{l.total.toFixed(2)}</span>}</li>
                        ))}
                      </ul>
                    )}
                    {ai.note && <div className="warn"><AlertTriangle /> {ai.note}</div>}
                  </div>
                )}
              </div>
            )}

            <div className="stack" style={{ gap: 14 }}>
              {jobs && (isReceipt || !jobId) && (
                <div className="field">
                  <label>{t("jobs.costs.job")}</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">{t("jobs.costs.pickJob")}</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-grid">
                <div className="field">
                  <label>{t("jobs.costs.category")}</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as CostCategory)}>
                    {COST_CATEGORY_KEYS.map((c) => <option key={c} value={c}>{t(`jobs.cost.${c}`)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t("jobs.costs.date")}</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>{t("jobs.costs.vendor")}</label>
                <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Home Depot" />
              </div>
              <div className="field">
                <label>{t("jobs.costs.description")}</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("jobs.costs.descPlaceholder")} />
              </div>
              {milestones.length > 0 && (
                <div className="field">
                  <label>{t("jobs.costs.milestone")}</label>
                  <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                    <option value="">{t("jobs.costs.wholeJob")}</option>
                    {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}
              <div className="money-box">
                <div className="row">
                  <span>{t("jobs.costs.subtotal")}</span>
                  <input className="inp-sm r" type="number" step="0.01" value={subtotal} onChange={(e) => onSubtotal(e.target.value)} />
                </div>
                <div className="taxes">
                  {TAX_KEYS.map((k) => (
                    <div key={k}>
                      <label>{k}</label>
                      <input className="inp-sm r" type="number" step="0.01" value={taxes[k]} onChange={(e) => onTax(k, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="row total">
                  <span>{t("jobs.costs.total")}</span>
                  <input className="inp-sm r" type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          {isReceipt && entry.status === "pending_review" ? (
            <>
              <button type="button" className="btn btn-sm btn-outline-navy" disabled={!valid || save.isPending} onClick={() => save.mutate(false)}>{t("jobs.costs.saveDraft")}</button>
              <button type="button" className="btn btn-sm btn-green" disabled={!valid || save.isPending} onClick={() => save.mutate(true)}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.costs.confirm")} {toCents(total) ? formatCents(toCents(total)) : ""}</button>
            </>
          ) : (
            <button type="button" className="btn btn-sm btn-navy" disabled={!valid || save.isPending} onClick={() => save.mutate(false)}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isNew ? t("jobs.costs.add") : t("jobs.save")}</button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptPreview({ docId }: { docId: string }) {
  const { t } = useLanguage();
  const url = jobsApi.receiptFileUrl(docId);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-link"><ExternalLink /> {t("jobs.costs.openReceipt")}</a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title={t("jobs.costs.openReceipt")}>
      <img src={url} alt="" onError={() => setFailed(true)} />
    </a>
  );
}
