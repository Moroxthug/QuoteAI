import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Download, CheckCircle2, Banknote, Mail, Copy, CreditCard, MailCheck, Clock, LayoutDashboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { publicInvoiceApi } from "@/lib/invoices-api";
import { Logo } from "@/components/logo";
import { StickyActionBar } from "@/components/mobile/sticky-action-bar";
import { ActionSheet, type SheetAction } from "@/components/mobile/action-sheet";
import { BottomSheet } from "@/components/mobile/bottom-sheet";

/**
 * Public invoice page (/i/:token). No login: the customer sees the invoice,
 * the balance and how to pay, and can download the PDF. Payments are by
 * e-Transfer / cheque — nothing is collected here.
 *
 * Phase 111: the balance and how to pay are the first screen; one action is
 * docked on a phone — Pay by card when the contractor takes cards, otherwise
 * "I've sent it" for an e-Transfer — with the PDF (and the other one) behind ⋯.
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

  useDocumentTitle(data ? `${data.invoice.type === "credit_note" ? t("invoices.type.credit_note") : t("publicInvoice.invoice")} ${data.invoice.number} · ${data.invoice.companyName}` : null);
  useEffect(() => {
    if (data?.invoice.language) setLang(data.invoice.language);
  }, [data?.invoice.language, setLang]);

  const invoice = data?.invoice;
  const pi = invoice?.paymentInstructions ?? {};
  const pdfHref = token ? publicInvoiceApi.pdfUrl(token, true) : "";
  const canCard = !!invoice?.canPayByCard;
  const canSent = !!pi.etransferEmail;
  // The docked bar: one primary, the rest behind ⋯ (docs/MOBILE-RULES.md rule 2).
  const more = useMemo<SheetAction[]>(() => [
    ...(canCard && canSent ? [{ label: t("publicInvoice.iSentIt"), icon: Clock, onSelect: () => setConfirming(true) }] : []),
    { label: t("publicInvoice.downloadPdf"), icon: Download, onSelect: () => { window.location.href = pdfHref; } },
  ], [canCard, canSent, pdfHref, t]);

  if (isLoading) {
    return <div className="doc-shell flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} /></div>;
  }
  if (error || !data || !invoice) {
    return (
      <div className="doc-shell flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <AlertTriangle className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--yellow-dark)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--navy)" }}>{t("publicInvoice.notFoundTitle")}</h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted-mk)" }}>{t("publicInvoice.notFoundDesc")}</p>
        </div>
      </div>
    );
  }

  const fmt = (c: number) => new Intl.NumberFormat(invoice.language === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(c / 100);
  const day = (s: string) => new Date(s).toLocaleDateString(invoice.language === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" });
  const paid = invoice.status === "paid";
  const voided = invoice.status === "void";
  const pendingConfirmation = invoice.status === "pending_confirmation";
  const credit = invoice.type === "credit_note";
  const owing = !paid && !voided && !pendingConfirmation && !credit;

  return (
    <div className={owing ? "doc-shell pb-16 doc-docked" : "doc-shell pb-16"}>
      <header className="doc-head">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{t("publicInvoice.from")} <strong style={{ color: "var(--ink)" }}>{invoice.companyName}</strong></div>
            <div className="text-sm font-semibold truncate" style={{ color: "var(--navy)" }}>{credit ? t("invoices.type.credit_note") : t("publicInvoice.invoice")} {invoice.number}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold hidden sm:block" style={{ color: "var(--navy)" }}>{fmt(credit ? invoice.totalCents : invoice.balanceCents)}</span>
            <Logo className="h-6" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {paid && !credit && (
          <div className="doc-banner ok p-5">
            <CheckCircle2 className="h-9 w-9 mx-auto mb-2" style={{ color: "var(--green-dark)" }} />
            <h1 className="text-lg font-bold">{t("publicInvoice.paidTitle")}</h1>
            <p className="text-sm mt-1">{invoice.paidAt ? `${t("publicInvoice.paidOn")} ${day(invoice.paidAt)}. ` : ""}{t("publicInvoice.paidDesc")}</p>
          </div>
        )}
        {voided && (
          <div className="doc-banner info p-5">
            <h1 className="text-lg font-bold">{t("publicInvoice.voidTitle")}</h1>
            <p className="text-sm mt-1">{t("publicInvoice.voidDesc")}</p>
          </div>
        )}
        {pendingConfirmation && !credit && (
          <div className="doc-banner warn p-5">
            <MailCheck className="h-9 w-9 mx-auto mb-2" style={{ color: "var(--yellow-dark)" }} />
            <h1 className="text-lg font-bold">{t("publicInvoice.pendingConfirmationTitle")}</h1>
            <p className="text-sm mt-1">{t("publicInvoice.pendingConfirmationDesc")}</p>
          </div>
        )}
        {owing && (
          <div className="inv-due rounded-2xl p-4 sm:p-5" style={invoice.status === "overdue" ? { border: "1px solid var(--red-t)", background: "var(--red-t)" } : { border: "1px solid var(--line)", background: "var(--soft)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {/* Not an h1: the invoice document below carries the page heading. */}
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: invoice.status === "overdue" ? "var(--red)" : "var(--navy)" }}>{invoice.status === "overdue" ? t("publicInvoice.overdue") : t("publicInvoice.balanceDue")}</div>
                <div className="text-3xl font-extrabold mt-1" style={{ color: "var(--navy)" }}>{fmt(invoice.balanceCents)}</div>
                <div className="text-sm mt-1" style={{ color: "var(--ink)" }}>{t("publicInvoice.dueBy")} <strong>{day(invoice.dueDate)}</strong>{invoice.paidCents > 0 ? ` · ${t("publicInvoice.alreadyPaid")} ${fmt(invoice.paidCents)}` : ""}</div>
              </div>
            </div>

            {(pi.etransferEmail || pi.chequePayableTo || pi.note) && (
              <div className="mt-4 rounded-xl p-4 space-y-2 text-sm" style={{ background: "rgba(255,255,255,.8)", border: "1px solid #fff" }}>
                <h2 className="font-semibold inline-flex items-center gap-2 text-sm" style={{ color: "var(--navy)" }}><Banknote className="h-4 w-4" style={{ color: "var(--navy)" }} /> {t("publicInvoice.howToPay")}</h2>
                {pi.etransferEmail && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Mail className="h-4 w-4" style={{ color: "var(--faint)" }} />
                    <span style={{ color: "var(--ink)" }}>{t("publicInvoice.etransferTo")}</span>
                    <span className="inline-flex items-center gap-1 max-w-full">
                      <code className="rounded px-2 py-0.5 font-semibold break-all" style={{ background: "var(--soft-2)", color: "var(--navy)" }}>{pi.etransferEmail}</code>
                      <button type="button" className="ic-btn" aria-label={t("a11y.copyEmail")} style={{ color: "var(--navy)" }} onClick={() => { navigator.clipboard.writeText(pi.etransferEmail!); toast({ title: t("invoices.copied") }); }}><Copy className="h-4 w-4" /></button>
                    </span>
                  </div>
                )}
                {pi.chequePayableTo && <div style={{ color: "var(--ink)" }}>{t("publicInvoice.chequeTo")} <strong>{pi.chequePayableTo}</strong></div>}
                {pi.note && <div style={{ color: "var(--ink)" }}>{pi.note}</div>}
                <div className="text-xs" style={{ color: "var(--muted-mk)" }}>{t("publicInvoice.reference")} <strong>{invoice.number}</strong>.</div>
              </div>
            )}

            <div className="mt-4">
              <StickyActionBar label={t("publicInvoice.howToPay")}>
                <ActionSheet actions={more} />
                {canCard ? (
                  <button type="button" className="btn btn-navy" data-primary-action onClick={() => payLink.mutate()} disabled={payLink.isPending}>
                    {payLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {t("publicInvoice.payByCard")} · {fmt(invoice.balanceCents)}
                  </button>
                ) : canSent ? (
                  <button type="button" className="btn btn-navy" data-primary-action onClick={() => setConfirming(true)}>
                    <Clock className="h-4 w-4" /> {t("publicInvoice.iSentIt")}
                  </button>
                ) : (
                  <a href={pdfHref} className="btn btn-navy" data-primary-action><Download className="h-4 w-4" /> {t("publicInvoice.downloadPdf")}</a>
                )}
              </StickyActionBar>
            </div>
          </div>
        )}

        <div className="card p-4 sm:p-10 inv-doc" style={{ boxShadow: "var(--shadow-card)" }}>
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <div dangerouslySetInnerHTML={{ __html: data.html }} />
        </div>

        {invoice.portalUrl && (
          <a href={invoice.portalUrl} className="card p-4 flex items-center gap-3 text-sm no-underline" style={{ boxShadow: "var(--shadow-card)" }}>
            <LayoutDashboard className="h-5 w-5 shrink-0" style={{ color: "var(--navy)" }} />
            <span className="grow" style={{ color: "var(--ink)" }}><b style={{ color: "var(--navy)" }}>{t("portalLink.title").replace("{company}", invoice.companyName)}</b><span className="block text-xs" style={{ color: "var(--muted-mk)" }}>{t("portalLink.desc")}</span></span>
            <span className="btn btn-sm btn-outline-navy">{t("portalLink.open")}</span>
          </a>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: "var(--muted-mk)" }}>
          <a href={pdfHref} className="inline-flex items-center gap-2 font-medium hover:underline" style={{ color: "var(--navy)" }}><Download className="h-4 w-4" /> {t("publicInvoice.downloadPdf")}</a>
          <span>{t("publicInvoice.questions")} {invoice.companyEmail ? <a href={`mailto:${invoice.companyEmail}`} className="underline">{invoice.companyEmail}</a> : invoice.companyName}{invoice.companyPhone ? <> · <a href={`tel:${invoice.companyPhone.replace(/[^\d+]/g, "")}`} className="underline">{invoice.companyPhone}</a></> : ""}</span>
        </div>
      </main>

      <BottomSheet
        open={confirming}
        onOpenChange={(o) => { if (!markSent.isPending) setConfirming(o); }}
        title={t("publicInvoice.iSentIt")}
        description={t("publicInvoice.markSentConfirm")}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-outline-navy secondary" onClick={() => setConfirming(false)}>{t("jobs.cancel")}</button>
            <button type="button" className="btn btn-navy" onClick={() => markSent.mutate()} disabled={markSent.isPending}>{markSent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("publicInvoice.confirmSent")}</button>
          </>
        }
      >
        {pi.etransferEmail && (
          <p className="text-sm m-0" style={{ color: "var(--ink)" }}>{t("publicInvoice.etransferTo")} <b style={{ color: "var(--navy)" }}>{pi.etransferEmail}</b> · {fmt(invoice.balanceCents)}</p>
        )}
      </BottomSheet>
    </div>
  );
}
