import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Download, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { publicInvoiceApi } from "@/lib/invoices-api";
import { ClientHeader, Glyph, StatusPill, BigMoney, useClientTheme, type StatusTone } from "@/components/client/kit";

/**
 * Public invoice page (/i/:token). No login: the customer sees the invoice, the balance
 * and how to pay, and can download the PDF. Payments are by card (Stripe, when the
 * contractor takes cards), e-Transfer or cheque.
 *
 * Pocket 125.10: built from the ClientInvoice board: balance card with the paid bar,
 * the due date and what is paid so far, then How to pay (e-Transfer rows to copy, "I sent it"
 * confirmed in place, card, cheque), then the invoice itself folded.
 */
export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const { t, lang, setLang } = useLanguage();
  useClientTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["public-invoice", token], queryFn: () => publicInvoiceApi.get(token!), enabled: !!token, retry: false });
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState("");
  const [folded, setFolded] = useState(true);

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

  if (isLoading) {
    return <div className="cp-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} /></div>;
  }
  if (error || !data || !invoice) {
    return (
      <div className="cp-page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <AlertTriangle className="h-10 w-10 mb-4" style={{ color: "var(--warn)" }} />
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>{t("publicInvoice.notFoundTitle")}</h1>
        <p className="cp-sub" style={{ marginTop: 6, maxWidth: 320 }}>{t("publicInvoice.notFoundDesc")}</p>
      </div>
    );
  }

  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const fmt = (c: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "CAD" }).format(c / 100);
  // A date-only string (due date, issue date) is a calendar day, not a UTC instant: read it at local noon.
  const asDate = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s);
  const day = (s: string, style: "long" | "medium" = "long") => asDate(s).toLocaleDateString(locale, { dateStyle: style });
  const paid = invoice.status === "paid";
  const voided = invoice.status === "void";
  const pendingConfirmation = invoice.status === "pending_confirmation";
  const credit = invoice.type === "credit_note";
  const overdue = invoice.status === "overdue";
  const owing = !paid && !voided && !pendingConfirmation && !credit;
  const canCard = !!invoice.canPayByCard;
  const canSent = !!pi.etransferEmail;
  const showPay = owing && (canCard || canSent || !!pi.chequePayableTo || !!pi.note);
  const paidPct = invoice.totalCents > 0 ? Math.min(100, Math.max(0, (invoice.paidCents / invoice.totalCents) * 100)) : 0;
  const daysLate = overdue ? Math.max(1, Math.round((Date.now() - asDate(invoice.dueDate).getTime()) / 86_400_000)) : 0;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });

  const pill: { tone: StatusTone; shape?: "alert" | "clock" | "check"; label: string } =
    paid ? { tone: "ok", label: t("publicInvoice.paidTitle") }
    : voided ? { tone: "mute", label: t("cp.inv.void") }
    : credit ? { tone: "mute", label: t("invoices.type.credit_note") }
    : pendingConfirmation ? { tone: "info", shape: "clock", label: t("cp.inv.awaiting") }
    : overdue ? { tone: "bad", shape: "alert", label: t("publicInvoice.overdue") }
    : invoice.paidCents > 0 ? { tone: "warn", label: t("cp.inv.partly") }
    : { tone: "info", label: t("cp.inv.open") };

  const copy = (key: string, value: string) => {
    try { void navigator.clipboard?.writeText(value); } catch { /* the row still shows the value */ }
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1800);
  };
  const copyRows: Array<{ key: string; label: string; value: string; raw: string; mono?: boolean }> = [];
  if (pi.etransferEmail) {
    copyRows.push({ key: "to", label: t("cp.inv.sendTo"), value: pi.etransferEmail, raw: pi.etransferEmail });
    copyRows.push({ key: "amt", label: t("cp.inv.amount"), value: fmt(invoice.balanceCents), raw: (invoice.balanceCents / 100).toFixed(2), mono: true });
    copyRows.push({ key: "ref", label: t("cp.inv.reference"), value: invoice.number, raw: invoice.number, mono: true });
  }

  const kind = credit ? t("invoices.type.credit_note") : t("publicInvoice.invoice");

  return (
    <main id="main" className="cp-page">
      <div className="cp-col cp-pad">
        <ClientHeader company={invoice.companyName} from={t("publicInvoice.from")} />

        <section className="cp-rise" style={{ padding: "22px 20px 0", animationDelay: "40ms" }}>
          <span className="cp-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{kind} {invoice.number} · {day(invoice.issueDate, "medium")}</span>
          <h1 className="cp-h1" style={{ marginTop: 8 }}>{invoice.title || kind}</h1>
          <p className="cp-sub" style={{ marginTop: 8 }}>{invoice.customerName}</p>
        </section>

        {!voided && (
          <section className="cp-rise" style={{ padding: "18px 16px 0", animationDelay: "80ms" }}>
            <div className="cp-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "18px 18px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span className="cp-sub" style={{ fontSize: 12.5 }}>{credit ? t("publicInvoice.invoice") : t("publicInvoice.balanceDue")}</span>
                  <StatusPill tone={pill.tone} shape={pill.shape}>{pill.label}</StatusPill>
                </div>
                <div style={{ marginTop: 6, color: overdue ? "var(--bad)" : undefined }}>
                  <BigMoney value={(credit ? invoice.totalCents : paid ? 0 : invoice.balanceCents) / 100} lang={lang} size={42} />
                </div>
                {!credit && (
                  <span className="cp-bar" style={{ marginTop: 16 }}>
                    <span style={{ width: `${paidPct}%`, background: paid ? "var(--ok-dot)" : undefined, transition: "width 1s cubic-bezier(.16,1,.3,1)" }} />
                  </span>
                )}
              </div>
              {!credit && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 18px" }}>
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.inv.dueDate")}</span>
                    <span className="cp-num" style={{ fontSize: 16, fontWeight: 600, color: overdue ? "var(--bad)" : undefined }}>{day(invoice.dueDate, "medium")}</span>
                    {overdue && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{rtf.format(-daysLate, "day")}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 18px", borderLeft: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.inv.paidSoFar")}</span>
                    <span className="cp-num" style={{ fontSize: 16, fontWeight: 600 }}>{fmt(paid ? invoice.totalCents : invoice.paidCents)}</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("cp.inv.of")} <span className="cp-num">{fmt(invoice.totalCents)}</span></span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {voided && (
          <section className="cp-rise" style={{ padding: "18px 16px 0" }}>
            <div className="cp-banner cp-b-info" role="status"><div><b>{t("publicInvoice.voidTitle")}</b><div style={{ marginTop: 2 }}>{t("publicInvoice.voidDesc")}</div></div></div>
          </section>
        )}

        {pendingConfirmation && !credit && (
          <section className="cp-rise" style={{ padding: "14px 16px 0" }}>
            <div className="cp-banner cp-b-info" role="status">
              <Glyph name="sync" tone="azure" size={22} />
              <div><b>{t("publicInvoice.pendingConfirmationTitle")}</b><div style={{ marginTop: 2 }}>{t("publicInvoice.pendingConfirmationDesc")}</div></div>
            </div>
          </section>
        )}

        {paid && !credit && (
          <section className="cp-rise" style={{ padding: "14px 16px 0" }}>
            <div className="cp-card" style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <span style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--ok-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}><Glyph name="check" tone="sage" size={34} /></span>
              <h2 style={{ marginTop: 14, fontSize: 21, fontWeight: 600, letterSpacing: "-0.03em" }}>{t("publicInvoice.paidTitle")}</h2>
              <p className="cp-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>{invoice.paidAt ? `${t("publicInvoice.paidOn")} ${day(invoice.paidAt)}. ` : ""}{t("publicInvoice.paidDesc")}</p>
            </div>
          </section>
        )}

        {showPay && (
          <section className="cp-rise" style={{ padding: "24px 16px 0", animationDelay: "120ms" }}>
            <div className="cp-sh"><h2>{t("publicInvoice.howToPay")}</h2></div>

            {canSent && (
              <div className="cp-card" style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 6px" }}>
                  <Glyph name="send" tone="indigo" size={30} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <b style={{ fontSize: 15, fontWeight: 600 }}>{t("cp.inv.etransfer")}</b>
                    <small style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.inv.noFee")}</small>
                  </span>
                </div>
                {copyRows.map((c) => {
                  const on = copied === c.key;
                  return (
                    <div key={c.key} className="cp-lrow" style={{ borderTop: "1px solid var(--line)" }}>
                      <span className="cp-lt">
                        <small>{c.label}</small>
                        <b className={c.mono ? "cp-mono" : undefined} style={{ fontSize: 15, wordBreak: "break-all" }}>{c.value}</b>
                      </span>
                      <button type="button" className="cp-press" onClick={() => copy(c.key, c.raw)} aria-label={`${t("cp.inv.copy")} ${c.label}`} style={{ height: 36, padding: "0 12px", borderRadius: 11, border: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 500, flexShrink: 0, background: on ? "var(--ok-soft)" : "var(--sunk)", color: on ? "var(--ok)" : "var(--ink)" }}>
                        {on ? <Check width={14} height={14} aria-hidden="true" /> : <Copy width={14} height={14} aria-hidden="true" />}
                        {on ? t("invoices.copied") : t("cp.inv.copy")}
                      </button>
                    </div>
                  );
                })}
                <div style={{ padding: "4px 16px 16px" }}>
                  {!confirming ? (
                    <button type="button" className="cp-btn cp-btn-s cp-btn-w cp-press" onClick={() => setConfirming(true)} data-primary-action={canCard ? undefined : ""}>{t("publicInvoice.iSentIt")}</button>
                  ) : (
                    <div className="cp-rise" style={{ background: "var(--soft)", borderRadius: 18, padding: 14, boxShadow: "0 0 0 1px var(--line)" }}>
                      <b style={{ fontSize: 14.5, fontWeight: 600 }}>{t("publicInvoice.iSentIt")}</b>
                      <p className="cp-sub" style={{ marginTop: 6, fontSize: 13 }}>{t("publicInvoice.markSentConfirm")}</p>
                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        <button type="button" className="cp-btn cp-btn-md cp-press" onClick={() => setConfirming(false)} disabled={markSent.isPending} style={{ flexGrow: 1, background: "var(--card)", boxShadow: "0 0 0 1px var(--line2)", color: "var(--ink)" }}>{t("jobs.cancel")}</button>
                        <button type="button" className="cp-btn cp-btn-md cp-btn-p cp-press" onClick={() => markSent.mutate()} disabled={markSent.isPending} style={{ flexGrow: 2 }}>
                          {markSent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("publicInvoice.confirmSent")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {canCard && (
              <div className="cp-card" style={{ marginTop: canSent ? 12 : 0, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Glyph name="card" tone="violet" size={30} />
                  <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <b style={{ fontSize: 15, fontWeight: 600 }}>{t("publicInvoice.payByCard")}</b>
                    <small style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.inv.cardSub")}</small>
                  </span>
                </div>
                <button type="button" className="cp-btn cp-btn-lg cp-btn-p cp-btn-w cp-press" onClick={() => payLink.mutate()} disabled={payLink.isPending} aria-busy={payLink.isPending} data-primary-action style={{ marginTop: 14 }}>
                  {payLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("publicInvoice.payByCard")} · <span className="cp-num">{fmt(invoice.balanceCents)}</span>
                </button>
                <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12.5, color: "var(--faint)" }}>{t("cp.inv.secure")}</p>
              </div>
            )}

            {(pi.chequePayableTo || pi.note) && (
              <div className="cp-card" style={{ marginTop: 12, overflow: "hidden" }}>
                <div className="cp-lrow" style={{ alignItems: "flex-start", paddingTop: 14, paddingBottom: 14 }}>
                  <Glyph name="doc" tone="stone" />
                  <span className="cp-lt">
                    <b>{t("cp.inv.cheque")}</b>
                    {pi.chequePayableTo && <small style={{ whiteSpace: "normal", lineHeight: 1.45 }}>{t("publicInvoice.chequeTo")} {pi.chequePayableTo}</small>}
                    {pi.note && <small style={{ whiteSpace: "normal", lineHeight: 1.45 }}>{pi.note}</small>}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="cp-rise" style={{ padding: "24px 16px 0", animationDelay: "160ms" }}>
          <div className="cp-sh"><h2>{t("cp.inv.details")}</h2></div>
          <div className="cp-card" style={{ overflow: "hidden" }}>
            <div className="cp-fold" data-folded={folded ? "true" : "false"}>
              <style dangerouslySetInnerHTML={{ __html: data.css }} />
              <div className="cp-paper inv-doc" dangerouslySetInnerHTML={{ __html: data.html }} />
              {folded && <div className="cp-fold-fade" aria-hidden="true" />}
            </div>
            <div style={{ padding: "12px 16px 16px" }}>
              <button type="button" className="cp-btn cp-btn-md cp-btn-s cp-btn-w cp-press" onClick={() => setFolded((f) => !f)} aria-expanded={!folded}>
                {folded ? t("cp.inv.showAll") : t("cp.sign.less")}
                <ChevronDown width={14} height={14} aria-hidden="true" style={{ transition: "transform .35s", transform: folded ? "none" : "rotate(180deg)" }} />
              </button>
            </div>
          </div>
        </section>

        <section className="cp-rise" style={{ padding: "16px 16px 0", animationDelay: "190ms" }}>
          <a href={pdfHref} className="cp-btn cp-btn-s cp-btn-w cp-press" data-primary-action={showPay || !owing ? undefined : ""}>
            <Download width={18} height={18} aria-hidden="true" />{t("publicInvoice.downloadPdf")}
          </a>
          {invoice.portalUrl && (
            <a href={invoice.portalUrl} className="cp-card cp-lrow cp-press" style={{ marginTop: 12, textDecoration: "none" }}>
              <Glyph name="doc" tone="indigo" />
              <span className="cp-lt">
                <b>{t("portalLink.title").replace("{company}", invoice.companyName)}</b>
                <small>{t("portalLink.desc")}</small>
              </span>
              <span className="cp-vh">{t("portalLink.open")}</span>
              <ChevronRight width={18} height={18} aria-hidden="true" style={{ color: "var(--faint)", flexShrink: 0 }} />
            </a>
          )}
          <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {t("publicInvoice.questions")}{" "}
            {invoice.companyEmail ? <a href={`mailto:${invoice.companyEmail}`} style={{ color: "var(--ink)", fontWeight: 500 }}>{invoice.companyEmail}</a> : invoice.companyName}
            {invoice.companyPhone ? <> · <a href={`tel:${invoice.companyPhone.replace(/[^\d+]/g, "")}`} className="cp-num" style={{ color: "var(--ink)", fontWeight: 500 }}>{invoice.companyPhone}</a></> : ""}
          </p>
        </section>
      </div>
    </main>
  );
}
