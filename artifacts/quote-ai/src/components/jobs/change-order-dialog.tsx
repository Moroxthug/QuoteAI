import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, FileSignature } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t("jobs.co.new")}</DialogTitle>
          <DialogDescription>{t("jobs.co.newDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="form-grid narrow-2">
            <div className="field">
              <label>{t("jobs.co.title")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("jobs.co.titlePlaceholder")} autoFocus />
            </div>
            <div className="field">
              <label>{t("jobs.co.delta")}</label>
              <input type="number" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </div>
            <div className="field full">
              <label>{t("jobs.co.description")}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("jobs.co.descriptionPlaceholder")} />
            </div>
          </div>

          <div className="field">
            <label>{t("jobs.co.items")}</label>
            <div className="li-body">
              <div className="li-head">
                <span>{t("jobs.co.item")}</span><span>{t("jobs.co.qty")}</span><span>{t("jobs.co.unit")}</span><span>{t("jobs.co.unitPrice")}</span><span className="r">{t("jobs.co.total")}</span><span />
              </div>
              <div>
                {rows.map((r, i) => (
                  <div key={i} className="li-row">
                    <div className="desc"><input className="inp-sm" value={r.descrizione} onChange={(e) => update(i, { descrizione: e.target.value })} placeholder={t("jobs.co.itemPlaceholder")} /></div>
                    <input className="inp-sm r qty" type="number" step="0.01" value={r.quantita} onChange={(e) => update(i, { quantita: e.target.value })} />
                    <input className="inp-sm c um" value={r.um} onChange={(e) => update(i, { um: e.target.value })} placeholder="ea" />
                    <input className="inp-sm r price" type="number" step="0.01" value={r.prezzoUnitario} onChange={(e) => update(i, { prezzoUnitario: e.target.value })} placeholder="0.00" />
                    <div className="tot">{formatCad(rowTotal(r))}</div>
                    <button type="button" className="ic-btn danger" disabled={rows.length === 1} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))}><Trash2 /></button>
                  </div>
                ))}
              </div>
              <button type="button" className="text-link" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus /> {t("jobs.co.addItem")}</button>
              <div className="li-sum">
                <span>{t("jobs.co.subtotal")} <small>({t("jobs.co.taxNote")})</small></span>
                <b className={subtotal < 0 ? "neg" : undefined}>{formatCad(subtotal)}</b>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {t("jobs.co.createAndSign")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
