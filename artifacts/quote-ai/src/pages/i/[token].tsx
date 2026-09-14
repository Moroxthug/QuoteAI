import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Download, CheckCircle2, Banknote, Mail, Copy, CreditCard, MailCheck, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { publicInvoiceApi } from "@/lib/invoices-api";
import { Logo } from "@/components/logo";

/**
 * Public invoice page (/i/:token). No login: the customer sees the invoice,
 * the balance and how to pay, and can download the PDF. Payments are by
 * e-Transfer / cheque — nothing is collected here.
 */
export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const { t, setLang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["public-invoice", token], queryFn: () => publicInvoiceApi.get(token!), enabled: !!token, retry: false });
  const [confirming, setConfirming] = useState(false);

  const markSent = useMutation({
    mutationFn: () => publicInvoiceApi.markSent(token!),
    onSuccess: () => { setConfirming(false); queryClient.invalidateQueries({ queryKey: ["public-invoice", token] }); },
    onError: () => toast({ title: t("publicInvoice.markSentError"), variant: "destructive" }),
  });
  const payLink = useMutation({
    mutationFn: () => publicInvoiceApi.payLink(token!),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("publicInvoice.payError"), variant: "destructive" }),
  });

  useEffect(() => {
    if (data?.invoice.language) setLang(data.invoice.language);
  }, [data?.invoice.language, setLang]);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-slate-900">{t("publicInvoice.notFoundTitle")}</h1>
          <p className="text-sm text-slate-500 mt-2">{t("publicInvoice.notFoundDesc")}</p>
        </div>
      </div>
    );
  }

  const { invoice } = data;
  const fmt = (c: number) => new Intl.NumberFormat(invoice.language === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(c / 100);
  const day = (s: string) => new Date(s).toLocaleDateString(invoice.language === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" });
  const paid = invoice.status === "paid";
  const voided = invoice.status === "void";
  const pendingConfirmation = invoice.status === "pending_confirmation";
  const credit = invoice.type === "credit_note";
  const pi = invoice.paymentInstructions ?? {};

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 truncate">{t("publicInvoice.from")} <strong className="text-slate-800">{invoice.companyName}</strong></div>
            <div className="text-sm font-semibold text-slate-900 truncate">{credit ? t("invoices.type.credit_note") : t("publicInvoice.invoice")} {invoice.number}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold text-slate-900 hidden sm:block">{fmt(credit ? invoice.totalCents : invoice.balanceCents)}</span>
            <Logo className="h-6" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {paid && !credit && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-600 mx-auto mb-2" />
            <h1 className="text-lg font-bold text-emerald-900">{t("publicInvoice.paidTitle")}</h1>
            <p className="text-sm text-emerald-800 mt-1">{invoice.paidAt ? `${t("publicInvoice.paidOn")} ${day(invoice.paidAt)}. ` : ""}{t("publicInvoice.paidDesc")}</p>
          </div>
        )}
        {voided && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <h1 className="text-lg font-bold text-slate-900">{t("publicInvoice.voidTitle")}</h1>
            <p className="text-sm text-slate-500 mt-1">{t("publicInvoice.voidDesc")}</p>
          </div>
        )}
        {pendingConfirmation && !credit && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <MailCheck className="h-9 w-9 text-amber-600 mx-auto mb-2" />
            <h1 className="text-lg font-bold text-amber-900">{t("publicInvoice.pendingConfirmationTitle")}</h1>
            <p className="text-sm text-amber-800 mt-1">{t("publicInvoice.pendingConfirmationDesc")}</p>
          </div>
        )}
        {!paid && !voided && !pendingConfirmation && !credit && (
          <div className={`rounded-2xl border p-5 ${invoice.status === "overdue" ? "border-rose-200 bg-rose-50" : "border-violet-200 bg-violet-50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${invoice.status === "overdue" ? "text-rose-700" : "text-violet-700"}`}>{invoice.status === "overdue" ? t("publicInvoice.overdue") : t("publicInvoice.balanceDue")}</div>
                <div className="text-3xl font-extrabold text-slate-900 mt-1">{fmt(invoice.balanceCents)}</div>
                <div className="text-sm text-slate-600 mt-1">{t("publicInvoice.dueBy")} <strong>{day(invoice.dueDate)}</strong>{invoice.paidCents > 0 ? ` · ${t("publicInvoice.alreadyPaid")} ${fmt(invoice.paidCents)}` : ""}</div>
              </div>
              <a href={publicInvoiceApi.pdfUrl(token!, true)} className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"><Download className="h-4 w-4" /> {t("publicInvoice.downloadPdf")}</a>
            </div>

            {invoice.canPayByCard && (
              <div className="mt-4">
                <Button className="gap-2 w-full sm:w-auto" onClick={() => payLink.mutate()} disabled={payLink.isPending}>
                  {payLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {t("publicInvoice.payByCard")}
                </Button>
              </div>
            )}

            {(pi.etransferEmail || pi.chequePayableTo || pi.note) && (
              <div className="mt-4 rounded-xl bg-white/80 border border-white p-4 space-y-2 text-sm">
                <div className="font-semibold text-slate-900 inline-flex items-center gap-2"><Banknote className="h-4 w-4 text-violet-600" /> {t("publicInvoice.howToPay")}</div>
                {pi.etransferEmail && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700">{t("publicInvoice.etransferTo")}</span>
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-slate-900 font-semibold">{pi.etransferEmail}</code>
                    <button className="text-violet-600 hover:text-violet-800" onClick={() => { navigator.clipboard.writeText(pi.etransferEmail!); toast({ title: t("invoices.copied") }); }}><Copy className="h-4 w-4" /></button>
                  </div>
                )}
                {pi.chequePayableTo && <div className="text-slate-700">{t("publicInvoice.chequeTo")} <strong>{pi.chequePayableTo}</strong></div>}
                {pi.note && <div className="text-slate-700">{pi.note}</div>}
                <div className="text-xs text-slate-500">{t("publicInvoice.reference")} <strong>{invoice.number}</strong>.</div>
                {pi.etransferEmail && !confirming && (
                  <button className="mt-1 inline-flex items-center gap-1.5 text-violet-700 hover:text-violet-900 font-medium" onClick={() => setConfirming(true)}>
                    <Clock className="h-4 w-4" /> {t("publicInvoice.iSentIt")}
                  </button>
                )}
                {confirming && (
                  <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                    <p className="text-slate-700">{t("publicInvoice.markSentConfirm")}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>{t("jobs.cancel")}</Button>
                      <Button size="sm" onClick={() => markSent.mutate()} disabled={markSent.isPending}>{markSent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}{t("publicInvoice.confirmSent")}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-10 shadow-sm">
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <div dangerouslySetInnerHTML={{ __html: data.html }} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <a href={publicInvoiceApi.pdfUrl(token!, true)} className="inline-flex items-center gap-2 font-medium text-violet-700 hover:underline"><Download className="h-4 w-4" /> {t("publicInvoice.downloadPdf")}</a>
          <span>{t("publicInvoice.questions")} {invoice.companyEmail ? <a href={`mailto:${invoice.companyEmail}`} className="underline">{invoice.companyEmail}</a> : invoice.companyName}{invoice.companyPhone ? ` · ${invoice.companyPhone}` : ""}</span>
        </div>
      </main>
    </div>
  );
}
