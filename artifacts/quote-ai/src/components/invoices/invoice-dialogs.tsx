import { localDay } from "@/lib/local-day";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    <div className="li-body">
      <div className="li-head cols-5">
        <span>{t("invoices.line.description")}</span><span className="r">{t("invoices.line.qty")}</span><span className="r">{t("invoices.line.unit")}</span><span className="r">{t("invoices.line.amount")}</span><span />
      </div>
      <div>
        {rows.map((r, i) => (
          <div key={i} className="li-row cols-5">
            <div className="desc"><input className="inp-sm" value={r.description} onChange={(e) => update(i, { description: e.target.value })} placeholder={t("invoices.line.placeholder")} /></div>
            <input className="inp-sm r qty" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} inputMode="decimal" />
            <input className="inp-sm r price" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} inputMode="decimal" placeholder="0.00" />
            <div className="tot">{formatCents(rowCents(r))}</div>
            <button type="button" className="ic-btn danger" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><Trash2 /></button>
          </div>
        ))}
      </div>
      <button type="button" className="text-link" onClick={() => onChange([...rows, emptyRow()])}><Plus /> {t("invoices.line.add")}</button>
      <div className="li-sum"><span>{t("invoices.subtotal")}</span><b>{formatCents(subtotal)}</b></div>
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
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t("invoices.new")}</DialogTitle>
          <DialogDescription>{t("invoices.newDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field">
              <label>{t("invoices.field.job")}</label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={!!defaultJobId}>
                <option value="">{t("invoices.field.noJob")}</option>
                {(jobs?.items ?? []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            {!jobId && (
              <div className="field">
                <label>{t("invoices.field.client")}</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">—</option>
                  {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>{t("invoices.field.title")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("invoices.field.titlePlaceholder")} />
            </div>
            <div className="field">
              <label>{t("invoices.field.dueDays")}</label>
              <input value={dueDays} onChange={(e) => setDueDays(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <LineEditor rows={rows} onChange={setRows} />
          <div className="field">
            <label>{t("invoices.field.notes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </DialogBody>
        <DialogFooter>
          <span className="foot-note">{t("invoices.taxHint")}</span>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!valid || create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("invoices.createDraft")}</button>
        </DialogFooter>
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
  const [date, setDate] = useState(localDay());
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState(true);
  useEffect(() => { if (open) { setAmount((invoice.balanceCents / 100).toFixed(2)); setMethod("etransfer"); setDate(localDay()); setReference(""); setReceipt(!!invoice.customer.email); } }, [open, invoice]);

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoices.recordPayment")}</DialogTitle>
          <DialogDescription>{invoice.number} · {t("invoices.balance")} <b>{formatCents(invoice.balanceCents)}</b></DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field"><label>{t("invoices.payment.amount")}</label><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></div>
            <div className="field"><label>{t("invoices.payment.date")}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field">
              <label>{t("invoices.payment.method")}</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`invoices.method.${m}`)}</option>)}
              </select>
            </div>
            <div className="field"><label>{t("invoices.payment.reference")}</label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e-Transfer #…" /></div>
          </div>
          <label className={invoice.customer.email ? "chk-row" : "chk-row disabled"}><input type="checkbox" checked={receipt} disabled={!invoice.customer.email} onChange={(e) => setReceipt(e.target.checked)} /> {t("invoices.payment.sendReceipt")}</label>
          {cents > invoice.balanceCents && <div className="notice warn"><AlertTriangle /><span className="grow">{t("invoices.payment.overpay")}</span></div>}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-green" disabled={cents <= 0 || record.isPending} onClick={() => record.mutate()}>{record.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("invoices.payment.save")}</button>
        </DialogFooter>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoices.creditNote")}</DialogTitle>
          <DialogDescription>{t("invoices.creditNoteDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="field"><label>{t("invoices.credit.amount")}</label><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" /><div className="field-hint">{t("invoices.credit.amountHint")} {formatCents(invoice.taxableCents)}</div></div>
          <div className="field"><label>{t("invoices.credit.description")}</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("invoices.credit.descriptionPlaceholder")} /></div>
          <div className="field"><label>{t("invoices.credit.reason")}</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={cents <= 0 || cents > invoice.taxableCents || !description.trim() || issue.isPending} onClick={() => issue.mutate()}>{issue.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("invoices.credit.issue")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
