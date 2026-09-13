import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCad } from "@/lib/jobs-api";

type Row = { descrizione: string; quantita: string; um: string; prezzoUnitario: string };
const emptyRow = (): Row => ({ descrizione: "", quantita: "1", um: "", prezzoUnitario: "" });
const rowTotal = (r: Row) => Math.round((Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0) * 100) / 100;

/**
 * Creates a change order draft. The signable document is generated server-
 * side and the user is taken to the contract page to sign and send it.
 */
export function ChangeOrderDialog({ jobId, open, onOpenChange }: { jobId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [delta, setDelta] = useState("0");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const subtotal = rows.reduce((s, r) => s + rowTotal(r), 0);
  const valid = title.trim().length > 0 && rows.some((r) => r.descrizione.trim() && r.prezzoUnitario !== "");

  const create = useMutation({
    mutationFn: () =>
      jobsApi.createChangeOrder(jobId, {
        title: title.trim(),
        description: description.trim(),
        scheduleDeltaDays: Math.round(Number(delta) || 0),
        items: rows
          .filter((r) => r.descrizione.trim() && r.prezzoUnitario !== "")
          .map((r) => ({ descrizione: r.descrizione.trim(), um: r.um.trim(), quantita: Number(r.quantita) || 1, prezzoUnitario: Number(r.prezzoUnitario) || 0, totale: rowTotal(r) })),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      onOpenChange(false);
      toast({ title: t("jobs.co.created"), description: t("jobs.co.createdDesc") });
      navigate(`/dashboard/contracts/${res.documentContractId}`);
    },
    onError: (e: Error & { code?: string }) =>
      toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : e.code === "NO_CONTRACT" ? t("jobs.co.noContract") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("jobs.co.new")}</DialogTitle>
          <DialogDescription>{t("jobs.co.newDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1">
              <Label>{t("jobs.co.title")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("jobs.co.titlePlaceholder")} autoFocus />
            </div>
            <div className="space-y-1">
              <Label>{t("jobs.co.delta")}</Label>
              <Input type="number" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("jobs.co.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("jobs.co.descriptionPlaceholder")} />
          </div>

          <div className="space-y-2">
            <Label>{t("jobs.co.items")}</Label>
            <div className="hidden md:grid grid-cols-[1fr_70px_70px_110px_100px_28px] gap-2 text-[11px] uppercase tracking-wide text-slate-400 px-1">
              <span>{t("jobs.co.item")}</span><span>{t("jobs.co.qty")}</span><span>{t("jobs.co.unit")}</span><span>{t("jobs.co.unitPrice")}</span><span className="text-right">{t("jobs.co.total")}</span><span />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-[1fr_70px_70px_110px_100px_28px] gap-2 items-center">
                <Input className="col-span-2 md:col-span-1" value={r.descrizione} onChange={(e) => update(i, { descrizione: e.target.value })} placeholder={t("jobs.co.itemPlaceholder")} />
                <Input type="number" step="0.01" value={r.quantita} onChange={(e) => update(i, { quantita: e.target.value })} />
                <Input value={r.um} onChange={(e) => update(i, { um: e.target.value })} placeholder="ea" />
                <Input type="number" step="0.01" value={r.prezzoUnitario} onChange={(e) => update(i, { prezzoUnitario: e.target.value })} placeholder="0.00" />
                <div className="text-sm font-medium text-right text-slate-800">{formatCad(rowTotal(r))}</div>
                <button type="button" className="text-slate-300 hover:text-rose-500 justify-self-end" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus className="h-3.5 w-3.5" /> {t("jobs.co.addItem")}</Button>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-slate-500">{t("jobs.co.subtotal")} <span className="text-[11px]">({t("jobs.co.taxNote")})</span></span>
            <span className={subtotal < 0 ? "font-semibold text-rose-600" : "font-semibold text-slate-900"}>{formatCad(subtotal)}</span>
          </div>

          <Button className="w-full gap-2" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {t("jobs.co.createAndSign")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
