import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { ArrowLeft, Receipt, Send, Download, Banknote, Ban, FileMinus, BellRing, Pencil, Check, X, Loader2, Copy, ExternalLink, Trash2, Briefcase, Clock, AlertTriangle, MailQuestion, Archive } from "lucide-react";
import { DetailSkeleton } from "@/components/skeletons";
import { showUndoToast } from "@/lib/optimistic";
import { ActionSheet, type SheetAction } from "@/components/mobile/action-sheet";
import { StickyActionBar } from "@/components/mobile/sticky-action-bar";
import { StatStrip } from "@/components/mobile/stat-strip";
import { useMobileHeader } from "@/components/mobile/mobile-page-header";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { formatCents } from "@/lib/jobs-api";
import { invoicesApi, isOpenInvoice, type InvoiceDetailDto, type InvoiceDto, type InvoiceEventDto } from "@/lib/invoices-api";
import { InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/jobs/badges";
import { LineEditor, RecordPaymentDialog, CreditNoteDialog, rowsFromLines, toLineInputs } from "@/components/invoices/invoice-dialogs";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const can = useCan();
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
  const archive = useMutation({
    mutationFn: () => invoicesApi.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      // Phase 115: a quiet Undo on the list this lands on (restores the invoice).
      showUndoToast({ title: t("archive.archivedToast"), undoLabel: t("common.undo"), onUndo: () => { invoicesApi.restore(id!).then(() => { void queryClient.invalidateQueries({ queryKey: ["invoices"] }); void queryClient.invalidateQueries({ queryKey: ["archive"] }); }, onError); } });
      navigate("/dashboard/invoices");
    },
    onError,
  });
  const number = data?.invoice.number;
  useMobileHeader(useMemo(() => (number ? { title: number } : null), [number]));

  if (isLoading) return <DetailSkeleton strip={4} rows={4} />;
  if (error || !data) return <div className="card card-empty">{t("invoices.notFound")} <Link href="/dashboard/invoices" className="text-link">{t("invoices.backToList")}</Link></div>;

  const inv = data.invoice;
  const isDraft = inv.status === "draft";
  const open = isOpenInvoice(inv.status);
  const isCredit = inv.type === "credit_note";
  const scheduled = isDraft && !!inv.scheduledFor && new Date(inv.scheduledFor) > new Date();
  const overdueDays = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000);
  const canEdit = can("invoicing", "edit");
  const canFull = can("invoicing", "full");
  const publicUrl = data.publicUrl;
  // The one thing to do next with this invoice: send the draft, then record what comes in.
  const primary = isCredit || !canEdit || editing ? null
    : isDraft ? { label: t("invoices.send"), icon: Send, onClick: () => setSendOpen(true) }
    : open ? { label: t("invoices.recordPayment"), icon: Banknote, onClick: () => setPayOpen(true) }
    : null;
  const moreActions: Array<SheetAction | false> = [
    { label: t("invoices.m.downloadPdf"), icon: Download, onSelect: () => { window.location.href = invoicesApi.pdfUrl(inv.id, true); } },
    isDraft && !editing && canEdit && { label: t("invoices.edit"), icon: Pencil, onSelect: () => setEditing(true) },
    open && !isCredit && canEdit && { label: t("invoices.resend"), icon: Send, onSelect: () => setSendOpen(true) },
    open && canEdit && !!inv.customer.email && { label: t("invoices.remind"), icon: BellRing, disabled: remind.isPending, onSelect: () => remind.mutate() },
    !!publicUrl && { label: t("invoices.m.copyLink"), icon: Copy, separated: true, onSelect: () => { navigator.clipboard.writeText(publicUrl); toast({ title: t("invoices.copied") }); } },
    !!publicUrl && { label: t("invoices.m.openLink"), icon: ExternalLink, onSelect: () => { window.open(publicUrl, "_blank", "noopener"); } },
    (open || inv.status === "paid") && !isCredit && canFull && { label: t("invoices.creditNote"), icon: FileMinus, separated: true, onSelect: () => setCreditOpen(true) },
    (inv.status === "paid" || inv.status === "void") && canFull && { label: t("dashboard.quotesList.archive"), icon: Archive, disabled: archive.isPending, onSelect: () => archive.mutate() },
    inv.status !== "void" && !isDraft && canFull && { label: t("invoices.void"), icon: Ban, danger: true, separated: true, onSelect: () => setVoidOpen(true) },
    isDraft && canFull && { label: t("invoices.deleteDraft"), icon: Trash2, danger: true, separated: true, disabled: remove.isPending, onSelect: () => remove.mutate() },
  ];

  return (
    <div className="animate-in fade-in duration-300 q-page">
      <Link href="/dashboard/invoices" className="back-link hide-phone"><ArrowLeft /> {t("invoices.backToList")}</Link>

      {/* Phase 107: who it is for, what is still owed and where it stands first;
          one primary action by where the invoice is (docked at the bottom on a
          phone), the rest in the menu — like the quote (Phase 105). */}
      <section className="card q-hero i-hero">
        <div className="q-hero-main">
          <div className="q-hero-eyebrow">
            <Receipt aria-hidden="true" />
            <span>{inv.number}</span>
            <span>{format(new Date(inv.issueDate), "d MMM yyyy", { locale })}</span>
          </div>
          <h1>{inv.customer.name || inv.number}</h1>
          {inv.title ? <p className="q-hero-sub">{inv.title}</p>
            : inv.projectId && <p className="q-hero-sub"><Link href={`/dashboard/jobs/${inv.projectId}?tab=invoices`} className="j-hero-link">{inv.projectName ?? t("invoices.job")}</Link></p>}
          <div className="q-hero-chips">
            <InvoiceStatusBadge status={inv.status} scheduled={scheduled} />
            <InvoiceTypeBadge type={inv.type} />
            {inv.projectId && inv.title && <Link href={`/dashboard/jobs/${inv.projectId}?tab=invoices`} className="chip chip-grey i-hero-link"><Briefcase className="h-3 w-3 mr-1" />{inv.projectName ?? t("invoices.job")}</Link>}
            {inv.creditNoteForId && <Link href={`/dashboard/invoices/${inv.creditNoteForId}`} className="chip chip-grey i-hero-link">{t("invoices.creditFor")}</Link>}
          </div>
        </div>
        <div className="q-hero-side">
          <span className="q-hero-lbl">{isCredit ? t("invoices.creditAmount") : open ? t("invoices.balance") : t("invoices.total")}</span>
          <b className={cn("q-hero-total", inv.status === "overdue" && "t-bad")}>{formatCents(open ? inv.balanceCents : inv.totalCents)}</b>
          <StickyActionBar label={t("invoices.m.actions")}>
            <ActionSheet actions={moreActions} title={t("invoices.m.actions")} />
            {primary && (
              <button type="button" className="btn btn-navy" onClick={primary.onClick} data-primary-action>
                <primary.icon className="h-4 w-4" /> {primary.label}
              </button>
            )}
          </StickyActionBar>
        </div>
      </section>

      <StatStrip
        label={t("invoices.m.numbers")}
        items={[
          { label: isCredit ? t("invoices.creditAmount") : t("invoices.total"), value: formatCents(inv.totalCents) },
          { label: t("invoices.paid"), value: formatCents(inv.paidCents), tone: inv.paidCents > 0 ? "ok" : undefined },
          { label: t("invoices.balance"), value: formatCents(inv.balanceCents), tone: inv.status === "overdue" ? "bad" : undefined },
          { label: t("invoices.dueOn"), value: format(new Date(inv.dueDate), "PP", { locale }), tone: inv.status === "overdue" ? "bad" : undefined, sub: inv.status === "overdue" ? `${overdueDays} ${t("invoices.daysOverdue")}` : inv.sentAt ? `${t("invoices.sentOn")} ${format(new Date(inv.sentAt), "PP", { locale })}` : undefined },
        ]}
      />

      {scheduled && (
        <div className="notice info">
          <Clock />
          <span className="grow">{t("invoices.scheduledHint")} <strong>{format(new Date(inv.scheduledFor!), "PPP", { locale })}</strong>. {t("invoices.scheduledHint2")}</span>
        </div>
      )}
      {inv.autoSendAt && isDraft && (
        <div className="notice warn">
          <AlertTriangle />
          <span className="grow">{t("invoices.autoSendHint")} <strong>{format(new Date(inv.autoSendAt), "PPp", { locale })}</strong>. {t("invoices.autoSendHint2")}</span>
        </div>
      )}
      {inv.status === "void" && <div className="notice"><Ban /><span className="grow">{t("invoices.voidedOn")} {inv.voidedAt ? format(new Date(inv.voidedAt), "PPp", { locale }) : ""}{inv.voidReason ? ` — ${inv.voidReason}` : ""}</span></div>}
      {inv.status === "pending_confirmation" && <PendingConfirmationBanner invoice={inv} onDone={refresh} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginTop: 16 }}>
        <div className="lg:col-span-2">
          {editing ? (
            <DraftEditor data={data} onDone={() => { setEditing(false); refresh(); }} onCancel={() => setEditing(false)} />
          ) : (
            <section className="card doc-view">
              <style dangerouslySetInnerHTML={{ __html: data.css }} />
              <div dangerouslySetInnerHTML={{ __html: data.html }} />
            </section>
          )}
        </div>

        <div className="stack">
          {data.publicUrl && (
            <section className="card hide-phone">
              <div className="card-head"><div><h2>{t("invoices.publicLink")}</h2><p className="sub">{t("invoices.publicLinkHint")}</p></div></div>
              <div className="act-body">
                <div className="field inline">
                  <input readOnly value={data.publicUrl} aria-label={t("a11y.publicLink")} className="flex-1 min-w-0 text-xs" />
                  <button type="button" className="ic-btn" aria-label={t("a11y.copyLink")} onClick={() => { navigator.clipboard.writeText(data.publicUrl!); toast({ title: t("invoices.copied") }); }}><Copy /></button>
                  <a href={data.publicUrl} target="_blank" rel="noreferrer" className="ic-btn" aria-label={t("a11y.openInNewTab")}><ExternalLink /></a>
                </div>
              </div>
            </section>
          )}

          {!isCredit && (
            <section className="card">
              <div className="card-head">
                <div><h2>{t("invoices.payments")}</h2></div>
                {open && can("invoicing", "edit") && <button type="button" className="text-link" onClick={() => setPayOpen(true)}>{t("invoices.recordPayment")}</button>}
              </div>
              {data.payments.length === 0 ? <div className="card-empty">{t("invoices.noPayments")}</div> : (
                <div>
                  {data.payments.map((p) => (
                    <div key={p.id} className="item-row">
                      <div className="grow">
                        <b className="ttl">{format(new Date(p.date), "PP", { locale })} · {t(`invoices.method.${p.method}`)}</b>
                        {(p.reference || p.creditNoteId) && <span className="sub">{p.creditNoteId ? <Link href={`/dashboard/invoices/${p.creditNoteId}`} className="hover:underline">{p.reference}</Link> : p.reference}</span>}
                      </div>
                      <span className="amt" style={{ color: "var(--green-dark)" }}>{formatCents(p.amountCents)}</span>
                      {!p.creditNoteId && inv.status !== "void" && can("invoicing", "full") && <RemovePayment invoiceId={inv.id} paymentId={p.id} onDone={refresh} />}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="card">
            <div className="card-head"><div><h2>{t("invoices.activity")}</h2></div></div>
            <div>
              {[...data.events].reverse().map((e) => <EventRow key={e.id} e={e} locale={locale} />)}
            </div>
            {open && inv.reminderCount === 0 && <div className="card-foot"><span className="foot-note">{t("invoices.reminderSchedule")} {data.reminderDays.join(" / ")} {t("invoices.daysPastDue")}</span></div>}
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

function PendingConfirmationBanner({ invoice, onDone }: { invoice: InvoiceDto; onDone: () => void }) {
  const { t } = useLanguage();
const can = useCan();
  const { toast } = useToast();
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const confirm = useMutation({ mutationFn: () => invoicesApi.confirmEtransfer(invoice.id), onSuccess: () => { onDone(); toast({ title: t("invoices.etransferConfirmed") }); }, onError });
  const reject = useMutation({ mutationFn: () => invoicesApi.rejectEtransfer(invoice.id), onSuccess: () => { onDone(); toast({ title: t("invoices.etransferRejected") }); }, onError });
  return (
    <div className="notice warn">
      <MailQuestion />
      <span className="grow">{t("invoices.pendingConfirmationHint")} <strong>{formatCents(invoice.balanceCents)}</strong>.</span>
      <div className="actions">
        {can("invoicing", "edit") && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => reject.mutate()} disabled={reject.isPending || confirm.isPending}>{reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} {t("invoices.notReceived")}</button>}
        {can("invoicing", "edit") && <button type="button" className="btn btn-sm btn-navy" style={{ background: "var(--green)" }} onClick={() => confirm.mutate()} disabled={confirm.isPending || reject.isPending}>{confirm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("invoices.confirmReceived")}</button>}
      </div>
    </div>
  );
}

function EventRow({ e, locale }: { e: InvoiceEventDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const d = e.detail ?? {};
  const extra = typeof d.to === "string" ? d.to : typeof d.amountCents === "number" ? formatCents(d.amountCents) : typeof d.reason === "string" && d.reason ? d.reason : "";
  const dot = e.type === "paid" || e.type === "payment_recorded" ? "ok" : e.type === "voided" || e.type === "overdue" ? "bad" : "";
  return (
    <div className="tl-row">
      <span className={cn("tl-dot", dot)} />
      <div className="min-w-0">
        <b>{t(`invoices.event.${e.type}`)}{extra ? <em> · {extra}</em> : null}</b>
        <span>{format(new Date(e.createdAt), "PPp", { locale })} · {t(`invoices.actor.${e.actor}`)}</span>
      </div>
    </div>
  );
}

function RemovePayment({ invoiceId, paymentId, onDone }: { invoiceId: string; paymentId: string; onDone: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const m = useMutation({ mutationFn: () => invoicesApi.removePayment(invoiceId, paymentId), onSuccess: onDone, onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }) });
  return <button type="button" className="ic-btn danger" title={t("invoices.removePayment")} aria-label={t("invoices.removePayment")} onClick={() => m.mutate()} disabled={m.isPending}><X /></button>;
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
  const lockedHoldback = inv.type === "deposit" || inv.type === "holdback_release" || inv.type === "credit_note";
  return (
    <section className="card">
      <div className="card-head"><div><h2>{t("invoices.edit")}</h2><p className="sub">{inv.number}</p></div></div>
      <div className="form-grid tight">
        <div className="field"><label htmlFor="invdet-1">{t("invoices.field.title")}</label><input id="invdet-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(`invoices.type.${inv.type}`)} /></div>
        <div className="field"><label htmlFor="invdet-2">{t("invoices.field.customerEmail")}</label><input id="invdet-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="invdet-3">{t("invoices.field.dueDays")}</label><input id="invdet-3" value={dueDays} onChange={(e) => setDueDays(e.target.value)} inputMode="numeric" /></div>
        <div className="field"><label htmlFor="invdet-4">{t("invoices.field.holdback")}</label><input id="invdet-4" value={holdback} onChange={(e) => setHoldback(e.target.value)} inputMode="numeric" disabled={lockedHoldback} /></div>
        <div className="field">
          <label htmlFor="invdet-5">{t("invoices.field.language")}</label>
          <select id="invdet-5" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "fr")}><option value="en">English</option><option value="fr">Français</option></select>
        </div>
        <div className="field"><label htmlFor="invdet-6">{t("invoices.field.paymentNote")}</label><input id="invdet-6" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder={t("invoices.field.paymentNotePlaceholder")} /></div>
        <div className="full"><LineEditor rows={rows} onChange={setRows} /></div>
        <div className="field full"><label htmlFor="invdet-7">{t("invoices.field.notes")}</label><textarea id="invdet-7" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      </div>
      <div className="card-foot" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={onCancel}><X className="h-4 w-4" /> {t("jobs.cancel")}</button>
        <button type="button" className="btn btn-sm btn-navy" onClick={() => save.mutate()} disabled={save.isPending || toLineInputs(rows).length === 0}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("invoices.save")}</button>
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
    <SimpleDialog open={open} onOpenChange={onOpenChange} title={invoice.status === "draft" ? t("invoices.send") : t("invoices.resend")} description={`${invoice.number} · ${formatCents(invoice.totalCents)}`}
      footer={<>
        <span className="foot-note">{t("invoices.sendHint")}</span>
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
        <button type="button" className="btn btn-sm btn-navy" onClick={() => send.mutate()} disabled={send.isPending || !email.includes("@")}>{send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t("invoices.sendNow")}</button>
      </>}
    >
      {scheduled && <div className="notice warn"><AlertTriangle /><span className="grow">{t("invoices.sendEarlyWarning")}</span></div>}
      <div className="field"><label htmlFor="invdet-8">{t("invoices.field.customerEmail")}</label><input id="invdet-8" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={invoice.status !== "draft"} /></div>
      <div className="field"><label htmlFor="invdet-9">{t("invoices.field.message")}</label><textarea id="invdet-9" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={t("invoices.field.messagePlaceholder")} /></div>
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
    <SimpleDialog open={open} onOpenChange={onOpenChange} title={t("invoices.void")} description={t("invoices.voidDesc")} size="sm"
      footer={<>
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
        <button type="button" className="btn btn-sm btn-red" onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("invoices.voidConfirm")}</button>
      </>}
    >
      <div className="field"><label htmlFor="invdet-10">{t("invoices.field.reason")}</label><textarea id="invdet-10" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
    </SimpleDialog>
  );
}

function SimpleDialog({ open, onOpenChange, title, description, size, footer, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; size?: "sm" | "md" | "lg"; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
