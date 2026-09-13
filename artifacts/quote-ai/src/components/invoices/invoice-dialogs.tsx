import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents } from "@/lib/jobs-api";
import { invoicesApi, PAYMENT_METHODS, type InvoiceDto, type LineInput, type PaymentMethod } from "@/lib/invoices-api";

// ── Shared line editor ───────────────────────────────────────────────────────

type Row = { description: string; quantity: string; unit: string };
const emptyRow = (): Row => ({ description: "", quantity: "1", unit: "" });
const rowCents = (r: Row) => Math.round((Number(r.quantity) || 0) * (Number(r.unit) || 0) * 100);

export function toLineInputs(rows: Row[]): LineInput[] {
  return rows.filter((r) => r.description.trim() && r.unit !== "").map((r) => ({ description: r.description.trim(), quantity: Number(r.quantity) || 1, unitCents: Math.round((Number(r.unit) || 0) * 100) }));
}

export function rowsFromLines(lines: { description: string; quantity: number; unitCents: number }[]): Row[] {
  return lines.length ? lines.map((l) => ({ description: l.description, quantity: String(l.quantity), unit: (l.unitCents / 100).toFixed(2) })) : [emptyRow()];
}

export function LineEditor({ rows, onChange }: { rows: Row[]; onChange: (rows: Row[]) => void }) {
  const { t } = useLanguage();
  const update = (i: number, patch: Partial<Row>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const subtotal = rows.reduce((s, r) => s + rowCents(r), 0);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_70px_110px_100px_28px] gap-2 text-[11px] uppercase tracking-wide text-slate-500 px-1">
        <span>{t("invoices.line.description")}</span><span className="text-right">{t("invoices.line.qty")}</span><span className="text-right">{t("invoices.line.unit")}</span><span className="text-right">{t("invoices.line.amount")}</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_110px_100px_28px] gap-2 items-center">
          <Input value={r.description} onChange={(e) => update(i, { description: e.target.value })} placeholder={t("invoices.line.placeholder")} className="h-9" />
          <Input value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} inputMode="decimal" className="h-9 text-right" />
          <Input value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} inputMode="decimal" placeholder="0.00" className="h-9 text-right" />
          <div className="text-sm text-right font-medium text-slate-800 tabular-nums">{formatCents(rowCents(r))}</div>
          <button type="button" className="text-slate-300 hover:text-rose-500 disabled:opacity-30" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1" onClick={() => onChange([...rows, emptyRow()])}><Plus className="h-3 w-3" /> {t("invoices.line.add")}</button>
        <div className="text-sm text-slate-600">{t("invoices.subtotal")} <span className="font-semibold text-slate-900">{formatCents(subtotal)}</span></div>
      </div>
    </div>
  );
}

// ── New manual invoice ───────────────────────────────────────────────────────

export function NewInvoiceDialog({ open, onOpenChange, defaultJobId, defaultClientId }: { open: boolean; onOpenChange: (v: boolean) => void; defaultJobId?: string; defaultClientId?: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data: jobs } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: open });
  const { data: clients } = useQuery({ queryKey: ["invoice-clients"], queryFn: invoicesApi.clients, enabled: open && !defaultJobId });
  const clientList = useMemo(() => clients?.items ?? [], [clients]);

  const [jobId, setJobId] = useState(defaultJobId ?? "");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [title, setTitle] = useState("");
  const [dueDays, setDueDays] = useState("15");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  useEffect(() => { if (open) { setJobId(defaultJobId ?? ""); setClientId(defaultClientId ?? ""); setTitle(""); setDueDays("15"); setNotes(""); setRows([emptyRow()]); } }, [open, defaultJobId, defaultClientId]);

  const lines = toLineInputs(rows);
  const valid = lines.length > 0 && (jobId || clientId);
  const create = useMutation({
    mutationFn: () => invoicesApi.create({ projectId: jobId || undefined, clientId: !jobId && clientId ? clientId : undefined, title: title.trim() || undefined, lines, dueDays: Math.max(0, Math.round(Number(dueDays) || 0)), notes: notes.trim() || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (jobId) queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      onOpenChange(false);
      toast({ title: t("invoices.created") });
      navigate(`/dashboard/invoices/${res.invoice.id}`);
    },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("invoices.new")}</DialogTitle>
          <DialogDescription>{t("invoices.newDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("invoices.field.job")}</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={!!defaultJobId}>
                <option value="">{t("invoices.field.noJob")}</option>
                {(jobs?.items ?? []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            {!jobId && (
              <div className="space-y-1">
                <Label>{t("invoices.field.client")}</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">—</option>
                  {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label>{t("invoices.field.title")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("invoices.field.titlePlaceholder")} />
            </div>
            <div className="space-y-1">
              <Label>{t("invoices.field.dueDays")}</Label>
              <Input value={dueDays} onChange={(e) => setDueDays(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <LineEditor rows={rows} onChange={setRows} />
          <div className="space-y-1">
            <Label>{t("invoices.field.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <p className="text-xs text-slate-500">{t("invoices.taxHint")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button>
            <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t("invoices.createDraft")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Record payment ───────────────────────────────────────────────────────────

export function RecordPaymentDialog({ invoice, open, onOpenChange }: { invoice: InvoiceDto; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Exclude<PaymentMethod, "credit_note">>("etransfer");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState(true);
  useEffect(() => { if (open) { setAmount((invoice.balanceCents / 100).toFixed(2)); setMethod("etransfer"); setDate(new Date().toISOString().slice(0, 10)); setReference(""); setReceipt(!!invoice.customer.email); } }, [open, invoice]);

  const cents = Math.round((Number(amount) || 0) * 100);
  const record = useMutation({
    mutationFn: () => invoicesApi.recordPayment(invoice.id, { amountCents: cents, method, date, reference: reference.trim() || undefined, sendReceipt: receipt }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (invoice.projectId) queryClient.invalidateQueries({ queryKey: ["job", invoice.projectId] });
      onOpenChange(false);
      toast({ title: res.invoice.status === "paid" ? t("invoices.paidToast") : t("invoices.paymentRecorded") });
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invoices.recordPayment")}</DialogTitle>
          <DialogDescription>{invoice.number} · {t("invoices.balance")} {formatCents(invoice.balanceCents)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>{t("invoices.payment.amount")}</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></div>
            <div className="space-y-1"><Label>{t("invoices.payment.date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>{t("invoices.payment.method")}</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`invoices.method.${m}`)}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>{t("invoices.payment.reference")}</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e-Transfer #…" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={receipt} disabled={!invoice.customer.email} onChange={(e) => setReceipt(e.target.checked)} /> {t("invoices.payment.sendReceipt")}</label>
          {cents > invoice.balanceCents && <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{t("invoices.payment.overpay")}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button>
            <Button disabled={cents <= 0 || record.isPending} onClick={() => record.mutate()} className="bg-emerald-600 hover:bg-emerald-700">{record.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t("invoices.payment.save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Credit note ──────────────────────────────────────────────────────────────

export function CreditNoteDialog({ invoice, open, onOpenChange }: { invoice: InvoiceDto; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) { setAmount(""); setDescription(""); setReason(""); } }, [open]);
  const cents = Math.round((Number(amount) || 0) * 100);
  const issue = useMutation({
    mutationFn: () => invoicesApi.creditNote(invoice.id, { amountCents: cents, description: description.trim(), reason: reason.trim() || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (invoice.projectId) queryClient.invalidateQueries({ queryKey: ["job", invoice.projectId] });
      onOpenChange(false);
      toast({ title: t("invoices.creditIssued"), description: res.creditNote.number });
      navigate(`/dashboard/invoices/${res.creditNote.id}`);
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invoices.creditNote")}</DialogTitle>
          <DialogDescription>{t("invoices.creditNoteDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>{t("invoices.credit.amount")}</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" /><p className="text-xs text-slate-500">{t("invoices.credit.amountHint")} {formatCents(invoice.taxableCents)}</p></div>
          <div className="space-y-1"><Label>{t("invoices.credit.description")}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("invoices.credit.descriptionPlaceholder")} /></div>
          <div className="space-y-1"><Label>{t("invoices.credit.reason")}</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button>
            <Button disabled={cents <= 0 || cents > invoice.taxableCents || !description.trim() || issue.isPending} onClick={() => issue.mutate()}>{issue.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t("invoices.credit.issue")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
