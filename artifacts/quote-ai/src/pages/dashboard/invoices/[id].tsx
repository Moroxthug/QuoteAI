import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { ArrowLeft, Receipt, Send, Download, Banknote, Ban, FileMinus, BellRing, Pencil, Check, X, Loader2, Copy, ExternalLink, Trash2, Briefcase, Clock, AlertTriangle, MailQuestion, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCents } from "@/lib/jobs-api";
import { invoicesApi, isOpenInvoice, type InvoiceDetailDto, type InvoiceDto, type InvoiceEventDto } from "@/lib/invoices-api";
import { InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/jobs/badges";
import { LineEditor, RecordPaymentDialog, CreditNoteDialog, rowsFromLines, toLineInputs } from "@/components/invoices/invoice-dialogs";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery({ queryKey: ["invoice", id], queryFn: () => invoicesApi.get(id!), enabled: !!id });
  const [editing, setEditing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    if (data?.invoice.projectId) queryClient.invalidateQueries({ queryKey: ["job", data.invoice.projectId] });
  };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });

  const remind = useMutation({ mutationFn: () => invoicesApi.remind(id!), onSuccess: () => { refresh(); toast({ title: t("invoices.reminderSent") }); }, onError });
  const remove = useMutation({ mutationFn: () => invoicesApi.remove(id!), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast({ title: t("invoices.draftDeleted") }); navigate("/dashboard/invoices"); }, onError });
  const archive = useMutation({ mutationFn: () => invoicesApi.archive(id!), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast({ title: t("archive.archivedToast") }); navigate("/dashboard/invoices"); }, onError });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24 w-full rounded-[var(--radius)]" /><Skeleton className="h-96 w-full rounded-[var(--radius)]" /></div>;
  if (error || !data) return <div className="p-8 text-center text-slate-500">{t("invoices.notFound")} <Link href="/dashboard/invoices" className="text-navy-600 underline">{t("invoices.backToList")}</Link></div>;

  const inv = data.invoice;
  const isDraft = inv.status === "draft";
  const open = isOpenInvoice(inv.status);
  const isCredit = inv.type === "credit_note";
  const scheduled = isDraft && !!inv.scheduledFor && new Date(inv.scheduledFor) > new Date();

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <Link href="/dashboard/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> {t("invoices.backToList")}</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2 flex-wrap">
              <Receipt className="h-7 w-7 text-navy-600 shrink-0" />
              {inv.number}
              <InvoiceStatusBadge status={inv.status} scheduled={scheduled} />
              <InvoiceTypeBadge type={inv.type} />
            </h1>
            <div className="text-slate-500 mt-1 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{inv.customer.name}{inv.customer.email ? ` · ${inv.customer.email}` : ""}</span>
              {inv.projectId && <Link href={`/dashboard/jobs/${inv.projectId}?tab=invoices`} className="inline-flex items-center gap-1 hover:text-navy-700"><Briefcase className="h-3.5 w-3.5" />{inv.projectName ?? t("invoices.job")}</Link>}
              {inv.creditNoteForId && <Link href={`/dashboard/invoices/${inv.creditNoteForId}`} className="hover:text-navy-700">{t("invoices.creditFor")}</Link>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={invoicesApi.pdfUrl(inv.id, true)}><Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> PDF</Button></a>
            {isDraft && !editing && <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> {t("invoices.edit")}</Button>}
            {isDraft && <Button variant="outline" size="sm" className="gap-2 text-rose-600 hover:text-rose-700" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash2 className="h-4 w-4" /> {t("invoices.deleteDraft")}</Button>}
            {(isDraft || open) && !isCredit && <Button size="sm" className="gap-2" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> {isDraft ? t("invoices.send") : t("invoices.resend")}</Button>}
            {open && !isCredit && <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setPayOpen(true)}><Banknote className="h-4 w-4" /> {t("invoices.recordPayment")}</Button>}
            {open && <Button variant="outline" size="sm" className="gap-2" onClick={() => remind.mutate()} disabled={remind.isPending || !inv.customer.email}><BellRing className="h-4 w-4" /> {t("invoices.remind")}</Button>}
            {(open || inv.status === "paid") && !isCredit && <Button variant="outline" size="sm" className="gap-2" onClick={() => setCreditOpen(true)}><FileMinus className="h-4 w-4" /> {t("invoices.creditNote")}</Button>}
            {inv.status !== "void" && !isDraft && <Button variant="ghost" size="sm" className="gap-2 text-slate-500" onClick={() => setVoidOpen(true)}><Ban className="h-4 w-4" /> {t("invoices.void")}</Button>}
            {(inv.status === "paid" || inv.status === "void") && <Button variant="ghost" size="sm" className="gap-2 text-slate-500" onClick={() => archive.mutate()} disabled={archive.isPending}><Archive className="h-4 w-4" /> {t("dashboard.quotesList.archive")}</Button>}
          </div>
        </div>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={isCredit ? t("invoices.creditAmount") : t("invoices.total")} value={formatCents(inv.totalCents)} />
        <Kpi label={t("invoices.paid")} value={formatCents(inv.paidCents)} accent="text-emerald-600" />
        <Kpi label={t("invoices.balance")} value={formatCents(inv.balanceCents)} accent={inv.status === "overdue" ? "text-rose-600" : inv.balanceCents > 0 ? "text-blue-600" : undefined} />
        <Kpi label={t("invoices.dueOn")} value={format(new Date(inv.dueDate), "PP", { locale })} sub={inv.status === "overdue" ? `${Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000)} ${t("invoices.daysOverdue")}` : inv.sentAt ? `${t("invoices.sentOn")} ${format(new Date(inv.sentAt), "PP", { locale })}` : undefined} accent={inv.status === "overdue" ? "text-rose-600" : undefined} />
      </div>

      {scheduled && (
        <div className="rounded-[var(--radius)] border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-900 flex items-start gap-2">
          <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{t("invoices.scheduledHint")} <strong>{format(new Date(inv.scheduledFor!), "PPP", { locale })}</strong>. {t("invoices.scheduledHint2")}</span>
        </div>
      )}
      {inv.autoSendAt && isDraft && (
        <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{t("invoices.autoSendHint")} <strong>{format(new Date(inv.autoSendAt), "PPp", { locale })}</strong>. {t("invoices.autoSendHint2")}</span>
        </div>
      )}
      {inv.status === "void" && <div className="rounded-[var(--radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{t("invoices.voidedOn")} {inv.voidedAt ? format(new Date(inv.voidedAt), "PPp", { locale }) : ""}{inv.voidReason ? ` — ${inv.voidReason}` : ""}</div>}
      {inv.status === "pending_confirmation" && <PendingConfirmationBanner invoice={inv} onDone={refresh} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {editing ? (
            <DraftEditor data={data} onDone={() => { setEditing(false); refresh(); }} onCancel={() => setEditing(false)} />
          ) : (
            <section className="rounded-[var(--radius)] border border-slate-200 bg-card p-5 md:p-8">
              <style dangerouslySetInnerHTML={{ __html: data.css }} />
              <div dangerouslySetInnerHTML={{ __html: data.html }} />
            </section>
          )}
        </div>

        <div className="space-y-4">
          {data.publicUrl && (
            <section className="rounded-[var(--radius)] border border-slate-200 bg-card p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">{t("invoices.publicLink")}</h3>
              <div className="flex gap-2">
                <Input readOnly value={data.publicUrl} className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(data.publicUrl!); toast({ title: t("invoices.copied") }); }}><Copy className="h-4 w-4" /></Button>
                <a href={data.publicUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button></a>
              </div>
              <p className="text-xs text-slate-500 mt-2">{t("invoices.publicLinkHint")}</p>
            </section>
          )}

          {!isCredit && (
            <section className="rounded-[var(--radius)] border border-slate-200 bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">{t("invoices.payments")}</h3>
                {open && <button className="text-xs text-navy-600 hover:underline" onClick={() => setPayOpen(true)}>{t("invoices.recordPayment")}</button>}
              </div>
              {data.payments.length === 0 ? <p className="text-sm text-slate-400">{t("invoices.noPayments")}</p> : (
                <ul className="space-y-2">
                  {data.payments.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2 text-sm group">
                      <div className="min-w-0">
                        <div className="text-slate-800">{format(new Date(p.date), "PP", { locale })} · {t(`invoices.method.${p.method}`)}</div>
                        {(p.reference || p.creditNoteId) && <div className="text-xs text-slate-400 truncate">{p.creditNoteId ? <Link href={`/dashboard/invoices/${p.creditNoteId}`} className="hover:underline">{p.reference}</Link> : p.reference}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium text-emerald-700">{formatCents(p.amountCents)}</span>
                        {!p.creditNoteId && inv.status !== "void" && <RemovePayment invoiceId={inv.id} paymentId={p.id} onDone={refresh} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-[var(--radius)] border border-slate-200 bg-card p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">{t("invoices.activity")}</h3>
            <ul className="space-y-2">
              {[...data.events].reverse().map((e) => <EventRow key={e.id} e={e} locale={locale} />)}
            </ul>
            {open && inv.reminderCount === 0 && <p className="text-xs text-slate-400 mt-3">{t("invoices.reminderSchedule")} {data.reminderDays.join(" / ")} {t("invoices.daysPastDue")}</p>}
          </section>
        </div>
      </div>

      <RecordPaymentDialog invoice={inv} open={payOpen} onOpenChange={setPayOpen} />
      <CreditNoteDialog invoice={inv} open={creditOpen} onOpenChange={setCreditOpen} />
      <SendDialog invoice={inv} open={sendOpen} onOpenChange={setSendOpen} onDone={refresh} />
      <VoidDialog invoice={inv} open={voidOpen} onOpenChange={setVoidOpen} onDone={refresh} />
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-slate-200 bg-card px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold text-slate-900 mt-0.5", accent)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function PendingConfirmationBanner({ invoice, onDone }: { invoice: InvoiceDto; onDone: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const confirm = useMutation({ mutationFn: () => invoicesApi.confirmEtransfer(invoice.id), onSuccess: () => { onDone(); toast({ title: t("invoices.etransferConfirmed") }); }, onError });
  const reject = useMutation({ mutationFn: () => invoicesApi.rejectEtransfer(invoice.id), onSuccess: () => { onDone(); toast({ title: t("invoices.etransferRejected") }); }, onError });
  return (
    <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <MailQuestion className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t("invoices.pendingConfirmationHint")} <strong>{formatCents(invoice.balanceCents)}</strong>.</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => reject.mutate()} disabled={reject.isPending || confirm.isPending}>{reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} {t("invoices.notReceived")}</Button>
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => confirm.mutate()} disabled={confirm.isPending || reject.isPending}>{confirm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("invoices.confirmReceived")}</Button>
      </div>
    </div>
  );
}

function EventRow({ e, locale }: { e: InvoiceEventDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const d = e.detail ?? {};
  const extra = typeof d.to === "string" ? d.to : typeof d.amountCents === "number" ? formatCents(d.amountCents) : typeof d.reason === "string" && d.reason ? d.reason : "";
  return (
    <li className="text-sm">
      <div className="text-slate-800">{t(`invoices.event.${e.type}`)}{extra ? <span className="text-slate-500"> · {extra}</span> : null}</div>
      <div className="text-[11px] text-slate-400">{format(new Date(e.createdAt), "PPp", { locale })} · {t(`invoices.actor.${e.actor}`)}</div>
    </li>
  );
}

function RemovePayment({ invoiceId, paymentId, onDone }: { invoiceId: string; paymentId: string; onDone: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const m = useMutation({ mutationFn: () => invoicesApi.removePayment(invoiceId, paymentId), onSuccess: onDone, onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }) });
  return <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" title={t("invoices.removePayment")} onClick={() => m.mutate()} disabled={m.isPending}><X className="h-4 w-4" /></button>;
}

function DraftEditor({ data, onDone, onCancel }: { data: InvoiceDetailDto; onDone: () => void; onCancel: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const inv = data.invoice;
  const [rows, setRows] = useState(rowsFromLines(inv.lines));
  const [title, setTitle] = useState(inv.title);
  const [notes, setNotes] = useState(inv.notes);
  const [dueDays, setDueDays] = useState(String(Math.max(0, Math.round((new Date(inv.dueDate).getTime() - new Date(inv.issueDate).getTime()) / 86_400_000))));
  const [holdback, setHoldback] = useState(String(inv.holdbackPercent));
  const [email, setEmail] = useState(inv.customer.email ?? "");
  const [language, setLanguage] = useState<"en" | "fr">(inv.language);
  const [paymentNote, setPaymentNote] = useState(inv.paymentInstructions.note ?? "");
  const save = useMutation({
    mutationFn: () => invoicesApi.update(inv.id, { title, notes, lines: toLineInputs(rows), dueDays: Math.max(0, Math.round(Number(dueDays) || 0)), holdbackPercent: Math.max(0, Math.min(50, Math.round(Number(holdback) || 0))), customerEmail: email.trim() || undefined, language, paymentNote: paymentNote.trim() || null }),
    onSuccess: () => { toast({ title: t("invoices.saved") }); onDone(); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  return (
    <section className="rounded-[var(--radius)] border border-navy-200 bg-card p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>{t("invoices.field.title")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(`invoices.type.${inv.type}`)} /></div>
        <div className="space-y-1"><Label>{t("invoices.field.customerEmail")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>{t("invoices.field.dueDays")}</Label><Input value={dueDays} onChange={(e) => setDueDays(e.target.value)} inputMode="numeric" /></div>
        <div className="space-y-1"><Label>{t("invoices.field.holdback")}</Label><Input value={holdback} onChange={(e) => setHoldback(e.target.value)} inputMode="numeric" disabled={inv.type === "deposit" || inv.type === "holdback_release" || inv.type === "credit_note"} /></div>
        <div className="space-y-1">
          <Label>{t("invoices.field.language")}</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "fr")}><option value="en">English</option><option value="fr">Français</option></select>
        </div>
        <div className="space-y-1"><Label>{t("invoices.field.paymentNote")}</Label><Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder={t("invoices.field.paymentNotePlaceholder")} /></div>
      </div>
      <LineEditor rows={rows} onChange={setRows} />
      <div className="space-y-1"><Label>{t("invoices.field.notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-1" /> {t("jobs.cancel")}</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || toLineInputs(rows).length === 0}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />} {t("invoices.save")}</Button>
      </div>
    </section>
  );
}

function SendDialog({ invoice, open, onOpenChange, onDone }: { invoice: InvoiceDto; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(invoice.customer.email ?? "");
  useEffect(() => { if (open) { setMessage(""); setEmail(invoice.customer.email ?? ""); } }, [open, invoice]);
  const send = useMutation({
    mutationFn: () => invoicesApi.send(invoice.id, { message: message.trim() || undefined, customerEmail: email.trim() && email.trim() !== invoice.customer.email ? email.trim() : undefined }),
    onSuccess: (res) => { onOpenChange(false); onDone(); toast({ title: res.resend ? t("invoices.resent") : t("invoices.sent"), description: email }); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const scheduled = invoice.status === "draft" && !!invoice.scheduledFor && new Date(invoice.scheduledFor) > new Date();
  return (
    <SimpleDialog open={open} onOpenChange={onOpenChange} title={invoice.status === "draft" ? t("invoices.send") : t("invoices.resend")} description={`${invoice.number} · ${formatCents(invoice.totalCents)}`}>
      <div className="space-y-3">
        {scheduled && <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1.5">{t("invoices.sendEarlyWarning")}</p>}
        <div className="space-y-1"><Label>{t("invoices.field.customerEmail")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={invoice.status !== "draft"} /></div>
        <div className="space-y-1"><Label>{t("invoices.field.message")}</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={t("invoices.field.messagePlaceholder")} /></div>
        <p className="text-xs text-slate-500">{t("invoices.sendHint")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending || !email.includes("@")}>{send.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}{t("invoices.sendNow")}</Button>
        </div>
      </div>
    </SimpleDialog>
  );
}

function VoidDialog({ invoice, open, onOpenChange, onDone }: { invoice: InvoiceDto; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => invoicesApi.void(invoice.id, reason.trim() || undefined),
    onSuccess: () => { onOpenChange(false); onDone(); toast({ title: t("invoices.voided") }); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  return (
    <SimpleDialog open={open} onOpenChange={onOpenChange} title={t("invoices.void")} description={t("invoices.voidDesc")}>
      <div className="space-y-3">
        <div className="space-y-1"><Label>{t("invoices.field.reason")}</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t("invoices.voidConfirm")}</Button>
        </div>
      </div>
    </SimpleDialog>
  );
}

function SimpleDialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
