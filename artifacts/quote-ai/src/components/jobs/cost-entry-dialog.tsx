import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type CostCategory, type CostEntryDto, type CostEntryEdit, type MilestoneDto } from "@/lib/jobs-api";

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
  const [date, setDate] = useState(entry?.date ?? new Date().toISOString().slice(0, 10));
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
    setDate(entry?.date ?? new Date().toISOString().slice(0, 10));
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
    mutationFn: (confirm: boolean) => {
      if (isNew) return jobsApi.addCost(targetJob, { ...body(), category, totalCents: toCents(total) });
      return jobsApi.updateCost(entry.projectId ?? targetJob, entry.id, { ...body(), ...(confirm ? { status: "confirmed" as const } : {}) });
    },
    onSuccess: (_r, confirm) => { refresh(); onOpenChange(false); if (confirm) toast({ title: t("jobs.costs.confirmedToast") }); },
    onError,
  });

  const valid = !!targetJob && toCents(total) !== 0 && (description.trim() || vendor.trim());
  const ai = entry?.aiExtraction ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl", isReceipt && "sm:max-w-4xl")}>
        <DialogHeader>
          <DialogTitle>{isNew ? t("jobs.costs.newEntry") : isReceipt && entry.status === "pending_review" ? t("jobs.costs.reviewReceipt") : t("jobs.costs.editEntry")}</DialogTitle>
          <DialogDescription>{isReceipt ? t("jobs.costs.reviewReceiptDesc") : t("jobs.costs.newEntryDesc")}</DialogDescription>
        </DialogHeader>
        <div className={cn("grid gap-5", isReceipt && "md:grid-cols-[1fr_1.1fr]")}>
          {isReceipt && entry.sourceDocumentId && (
            <div className="space-y-2 min-w-0">
              <div className="rounded-xl border bg-slate-50 overflow-hidden max-h-[420px]">
                <ReceiptPreview docId={entry.sourceDocumentId} />
              </div>
              {ai && (
                <div className="rounded-xl border border-navy-100 bg-navy-50/60 p-3 text-xs text-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-navy-800"><Sparkles className="h-3.5 w-3.5" /> {t("jobs.costs.aiRead")} · <span className={cn("font-medium", ai.confidence === "high" ? "text-emerald-700" : ai.confidence === "medium" ? "text-amber-700" : "text-rose-700")}>{t(`jobs.costs.confidence.${ai.confidence}`)}</span></div>
                  {ai.lines.length > 0 && (
                    <ul className="max-h-32 overflow-y-auto divide-y divide-navy-100">
                      {ai.lines.map((l, i) => (
                        <li key={i} className="flex justify-between gap-2 py-0.5"><span className="truncate">{l.quantity && l.quantity !== 1 ? `${l.quantity} × ` : ""}{l.description}</span>{l.total !== null && <span className="whitespace-nowrap">{l.total.toFixed(2)}</span>}</li>
                      ))}
                    </ul>
                  )}
                  {ai.note && <div className="flex items-start gap-1 text-amber-800"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {ai.note}</div>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {jobs && (isReceipt || !jobId) && (
              <div className="space-y-1">
                <Label>{t("jobs.costs.job")}</Label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-card px-2 text-sm">
                  <option value="">{t("jobs.costs.pickJob")}</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("jobs.costs.category")}</Label>
                <select value={category} onChange={(e) => setCategory(e.target.value as CostCategory)} className="h-9 w-full rounded-md border border-slate-200 bg-card px-2 text-sm">
                  {COST_CATEGORY_KEYS.map((c) => <option key={c} value={c}>{t(`jobs.cost.${c}`)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t("jobs.costs.date")}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("jobs.costs.vendor")}</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Home Depot" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label>{t("jobs.costs.description")}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("jobs.costs.descPlaceholder")} className="h-9" />
            </div>
            {milestones.length > 0 && (
              <div className="space-y-1">
                <Label>{t("jobs.costs.milestone")}</Label>
                <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-card px-2 text-sm">
                  <option value="">{t("jobs.costs.wholeJob")}</option>
                  {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            )}
            <div className="rounded-xl border p-3 space-y-2">
              <div className="grid grid-cols-[1fr_120px] items-center gap-2 text-sm">
                <span className="text-slate-600">{t("jobs.costs.subtotal")}</span>
                <Input type="number" step="0.01" value={subtotal} onChange={(e) => onSubtotal(e.target.value)} className="h-8 text-right" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TAX_KEYS.map((k) => (
                  <div key={k} className="space-y-0.5">
                    <Label className="text-[10px] text-slate-500">{k}</Label>
                    <Input type="number" step="0.01" value={taxes[k]} onChange={(e) => onTax(k, e.target.value)} className="h-8 text-right px-1.5" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_120px] items-center gap-2 text-sm font-semibold border-t pt-2">
                <span>{t("jobs.costs.total")}</span>
                <Input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className="h-9 text-right font-semibold" />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button>
              {isReceipt && entry.status === "pending_review" ? (
                <>
                  <Button variant="outline" disabled={!valid || save.isPending} onClick={() => save.mutate(false)}>{t("jobs.costs.saveDraft")}</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={!valid || save.isPending} onClick={() => save.mutate(true)}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.costs.confirm")} {toCents(total) ? formatCents(toCents(total)) : ""}</Button>
                </>
              ) : (
                <Button disabled={!valid || save.isPending} onClick={() => save.mutate(false)} className="gap-2">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isNew ? t("jobs.costs.add") : t("jobs.save")}</Button>
              )}
            </div>
          </div>
        </div>
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
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-8 text-sm text-navy-700 hover:underline"><ExternalLink className="h-4 w-4" /> {t("jobs.costs.openReceipt")}</a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title={t("jobs.costs.openReceipt")}>
      <img src={url} alt="" className="w-full max-h-[420px] object-contain bg-card" onError={() => setFailed(true)} />
    </a>
  );
}
