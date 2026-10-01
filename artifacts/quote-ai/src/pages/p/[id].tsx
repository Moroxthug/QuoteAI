import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Loader2, FileX, ExternalLink, Download, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { taxLineLabel } from "@/lib/tax-display";
import { ClientHeader, Glyph, StatusPill, BigMoney, useClientTheme, initialsOf, money as euro } from "@/components/client/kit";
import { BottomSheet } from "@/components/mobile/bottom-sheet";

type PublicTaxLine = { code: string; label: string; rate: number; amount: number };

interface PublicQuoteChapterItem {
  descrizione: string;
  um: string;
  quantita: number;
  prezzoUnitario: number;
  totale: number;
}

interface PublicQuoteChapter {
  lettera: string;
  titolo: string;
  voci: PublicQuoteChapterItem[];
  subtotale: number;
  osservazione?: string;
}

interface PublicQuoteVariant {
  id: string;
  label: string;
  description: string;
  position: number;
  recommended?: boolean;
  capitoli: PublicQuoteChapter[] | null;
  sconto: { percentuale: number; importoScontato: number } | null;
  subtotale: string;
  ivaPercentuale: string;
  ivaValore: string;
  taxLines?: PublicTaxLine[];
  totale: string;
}

interface PublicQuote {
  id: string;
  numeroPreventivoData: string | null;
  titoloPreventivoRiga1: string | null;
  titoloPreventivoRiga2: string | null;
  descrizioneGenerale: string;
  clientData: { nome: string; indirizzo: string } | null;
  companySnapshot: { companyName: string; address?: string; phone?: string; email?: string } | null;
  capitoli: PublicQuoteChapter[] | null;
  sconto: { percentuale: number; importoScontato: number } | null;
  subtotale: string;
  ivaPercentuale: string;
  ivaValore: string;
  taxLines?: PublicTaxLine[];
  province?: string | null;
  totale: string;
  note: string;
  pdfUrl: string | null;
  status: "unlocked" | "accepted";
  acceptedAt: string | null;
  acceptedByName: string | null;
  acceptedVariantId: string | null;
  exclusions?: string[];
  declinedAt?: string | null;
  variants: PublicQuoteVariant[];
}


type FinanceitEstimate = { monthlyPayment: number; termMonths: number; apr: number };
type FinanceitApplicationStatusDto = { status: string; applicationLink: string };

const FINANCEIT_STATUS_KEYS: Record<string, string> = {
  sent: "publicQuote.financing.statusSent",
  in_progress: "publicQuote.financing.statusInProgress",
  approved: "publicQuote.financing.statusApproved",
  declined: "publicQuote.financing.statusDeclined",
  funded: "publicQuote.financing.statusFunded",
};

// Only rendered once we've confirmed the contractor behind this quote has
// financing enabled — most quotes never call the Financeit APIs at all.
function FinancingWidget({ quoteId }: { quoteId: string }) {
  const { t, lang } = useLanguage();
  const [checked, setChecked] = useState(false);
  const [available, setAvailable] = useState(false);
  const [application, setApplication] = useState<FinanceitApplicationStatusDto | null>(null);
  const [estimate, setEstimate] = useState<FinanceitEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/quotes/${quoteId}/financeit/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAvailable(!!data.available);
        setApplication(data.application ?? null);
      } catch {
        // Financing is a bonus, not core to the accept flow — fail silently.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [quoteId]);

  async function handleEstimate() {
    setLoadingEstimate(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotes/${quoteId}/financeit/estimate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(t("publicQuote.financing.error")); return; }
      setEstimate(data.estimate);
    } catch {
      setError(t("publicQuote.financing.error"));
    } finally {
      setLoadingEstimate(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotes/${quoteId}/financeit/apply`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(t("publicQuote.financing.error")); return; }
      window.location.href = data.applicationLink;
    } catch {
      setError(t("publicQuote.financing.error"));
    } finally {
      setApplying(false);
    }
  }

  if (!checked || !available) return null;

  const statusKey = application ? FINANCEIT_STATUS_KEYS[application.status] : undefined;
  return (
    <section className="cp-section-t cp-rise" style={{ animationDelay: "210ms" }}>
      <div className="cp-card">
        <div className="cp-lrow" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <Glyph name="bank" tone="indigo" />
          <span className="cp-lt">
            <b style={{ whiteSpace: "normal" }}>{t("publicQuote.financing.title")}</b>
            <small style={{ whiteSpace: "normal" }}>
              {application && statusKey ? t(statusKey) : estimate ? (
                <>
                  {t("publicQuote.financing.estimateLabel")} <span className="cp-num" style={{ color: "var(--ink)", fontWeight: 600 }}>{euro(estimate.monthlyPayment, lang)}</span>
                  {t("publicQuote.financing.perMonth")} · <span className="cp-num">{estimate.termMonths}</span> {t("publicQuote.financing.termMonths")}
                </>
              ) : t("publicQuote.financing.subtitle")}
            </small>
          </span>
          {application ? (
            application.status === "sent" && (
              <button type="button" className="cp-btn cp-btn-sm cp-btn-s cp-press" onClick={() => { window.location.href = application.applicationLink; }}>
                {t("publicQuote.financing.continueApplication")}
              </button>
            )
          ) : !estimate && (
            <button type="button" className="cp-btn cp-btn-sm cp-btn-s cp-press" onClick={handleEstimate} disabled={loadingEstimate}>
              {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("cp.quote.checkRate")}
            </button>
          )}
        </div>
        {!application && (estimate || error) && (
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {error && <p className="cp-err" role="alert">{error}</p>}
            {estimate && (
              <button type="button" onClick={handleApply} disabled={applying} className="cp-btn cp-btn-md cp-btn-p cp-btn-w cp-press">
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("publicQuote.financing.applyButton")}
              </button>
            )}
            <p className="cp-note">{t("publicQuote.financing.disclaimer")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

interface MatchedIncentive {
  id: string;
  level: "federal" | "provincial" | "municipal" | "utility";
  titolo: string;
  descrizione: string;
  tipoAgevolazione: string;
  percentualeMassima: string | null;
  massimaleContributo: string | null;
  massimaleSpesa: string | null;
  incomeTested: boolean;
  fonteUfficialeUrl: string | null;
  humanVerified: boolean;
}

// Fully self-contained, same pattern as FinancingWidget: fetches its own
// data on mount and renders nothing if there's no match, so most quotes pay
// no cost for this widget existing.
function RebatesWidget({ quoteId }: { quoteId: string }) {
  const { t, lang } = useLanguage();
  const [checked, setChecked] = useState(false);
  const [incentives, setIncentives] = useState<MatchedIncentive[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/quotes/${quoteId}/incentives`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setIncentives(data.incentives ?? []);
      } catch {
        // Rebates are a bonus, not core to the accept flow — fail silently.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [quoteId]);

  if (!checked || incentives.length === 0) return null;

  return (
    <section className="cp-section-t cp-rise" style={{ animationDelay: "200ms" }}>
      <div className="cp-card">
        <div className="cp-lrow" style={{ alignItems: "flex-start", paddingTop: 14, paddingBottom: 10 }}>
          <Glyph name="gift" tone="rose" />
          <span className="cp-lt">
            <b style={{ whiteSpace: "normal" }}>{t("publicQuote.rebates.title")}</b>
            <small style={{ whiteSpace: "normal" }}>{t("publicQuote.rebates.subtitle")}</small>
          </span>
        </div>
        {incentives.map((inc) => {
          const amount = inc.massimaleContributo
            ? euro(inc.massimaleContributo, lang)
            : inc.percentualeMassima
              ? `${Number(inc.percentualeMassima)}%`
              : null;
          return (
            <div key={inc.id} className="cp-lrow" style={{ alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, width: "100%" }}>
                <b style={{ fontSize: 14.5, fontWeight: 500 }}>{inc.titolo}</b>
                {amount && <span className="cp-st cp-st-ok si-check" style={{ flexShrink: 0 }}>{t("publicQuote.rebates.upTo")} <span className="cp-num">{amount}</span></span>}
              </div>
              <small style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>{inc.descrizione}</small>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 20 }}>
                {inc.incomeTested && <span className="cp-st cp-st-warn si-alert">{t("publicQuote.rebates.incomeTested")}</span>}
                {inc.fonteUfficialeUrl && (
                  <a href={inc.fonteUfficialeUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}>
                    {t("publicQuote.rebates.learnMore")} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
        <p className="cp-note" style={{ padding: "4px 16px 14px" }}>{t("publicQuote.rebates.disclaimer")}</p>
      </div>
    </section>
  );
}

export default function PublicQuotePage() {
  const { t, lang, setLang } = useLanguage();
  const { id } = useParams();
  useClientTheme();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  /** Phase 76: the client portal link, when the quote is linked to a client with an email. */
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nomeConferma, setNomeConferma] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  // Phase 111: the name is asked for in a sheet the docked Accept opens, not a form at the end of the page.
  const [acceptOpen, setAcceptOpen] = useState(false);
  // Pocket 125: the client can say no, with an optional reason (POST /api/public/quotes/:id/decline).
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  useDocumentTitle(quote ? `${t("publicQuote.quoteFallback")}${quote.numeroPreventivoData ? ` ${quote.numeroPreventivoData}` : ""} · ${quote.companySnapshot?.companyName || "QuoteAI"}` : notFound ? t("publicQuote.notAvailableTitle") : null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/quotes/${id}`);
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setQuote(data.quote);
          setPortalUrl(typeof data.portalUrl === "string" ? data.portalUrl : null);
          const variants: PublicQuoteVariant[] = data.quote?.variants ?? [];
          if (variants.length > 1) {
            setSelectedVariantId(data.quote.acceptedVariantId || variants[0]?.id || null);
          }
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleAccept() {
    if (!id || !nomeConferma.trim() || accepting) return;
    const hasTiers = (quote?.variants?.length ?? 0) > 1;
    if (hasTiers && !selectedVariantId) {
      setError(t("publicQuote.tiers.selectOneError"));
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotes/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeConferma: nomeConferma.trim(), variantId: hasTiers ? selectedVariantId : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("publicQuote.errorAcceptFailed"));
        return;
      }
      setQuote(data.quote);
      setAcceptOpen(false);
      // The confirmation is the first thing on the page now.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(t("publicQuote.errorConnection"));
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!id || declining) return;
    setDeclining(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotes/${id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("publicQuote.errorDeclineFailed"));
        return;
      }
      setQuote(data.quote);
      setDeclineOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(t("publicQuote.errorConnection"));
    } finally {
      setDeclining(false);
    }
  }

  if (loading) {
    return (
      <div className="cp-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="cp-page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <FileX className="h-10 w-10 mb-4" style={{ color: "var(--faint)" }} />
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>{t("publicQuote.notAvailableTitle")}</h1>
        <p className="cp-sub" style={{ marginTop: 6, maxWidth: 320 }}>{t("publicQuote.notAvailableBody")}</p>
      </div>
    );
  }

  const isAccepted = quote.status === "accepted";
  const isDeclined = !isAccepted && !!quote.declinedAt;
  const tiers = quote.variants || [];
  const hasTiers = tiers.length > 1;
  const activeVariant = hasTiers ? (tiers.find((v) => v.id === selectedVariantId) ?? tiers[0]) : null;
  const displayCapitoli = activeVariant ? activeVariant.capitoli : quote.capitoli;
  const displaySubtotale = activeVariant ? activeVariant.subtotale : quote.subtotale;
  const displaySconto = activeVariant ? activeVariant.sconto : quote.sconto;
  const displayIvaPercentuale = activeVariant ? activeVariant.ivaPercentuale : quote.ivaPercentuale;
  const displayIvaValore = activeVariant ? activeVariant.ivaValore : quote.ivaValore;
  const displayTaxLines = (activeVariant ? activeVariant.taxLines : quote.taxLines) ?? [];
  const displayTotale = activeVariant ? activeVariant.totale : quote.totale;
  // The board's "+$420 / Base price" line: each option against the recommended one (else the first).
  const basePrice = Number((tiers.find((v) => v.recommended) ?? tiers[0])?.totale ?? 0);

  const companyName = quote.companySnapshot?.companyName || t("publicQuote.quoteFallback");
  const phone = quote.companySnapshot?.phone;
  const title = quote.titoloPreventivoRiga2 || quote.titoloPreventivoRiga1;
  return (
    // Phase 83: the page an outsider is most likely to meet with a screen
    // reader had no landmark at all to jump into.
    <main id="main" className="cp-page">
      <div className="cp-col cp-pad">
        <ClientHeader company={companyName} from={t("publicInvoice.from")} />

        {/* Phase 111: once accepted, that is the first thing the client sees. */}
        {isAccepted && (
          <div className="cp-rise" style={{ padding: "14px 16px 0" }}>
            <div className="cp-banner cp-b-ok" role="status" style={{ alignItems: "center" }}>
              <Glyph name="check" tone="sage" size={24} />
              <div>
                <b>{t("publicQuote.acceptedTitle")}</b>
                <div style={{ marginTop: 2 }}>
                  {t("publicQuote.confirmedByPrefix")} {quote.acceptedByName}
                  {quote.acceptedAt && (
                    <> {t("publicQuote.confirmedOnPrefix")} {format(
                      new Date(quote.acceptedAt),
                      lang === "fr" ? `d MMMM yyyy '${t("publicQuote.confirmedAtPrefix")}' HH:mm` : `MMMM d, yyyy '${t("publicQuote.confirmedAtPrefix")}' HH:mm`,
                      { locale: lang === "fr" ? frCA : enCA }
                    )}</>
                  )}.
                </div>
              </div>
            </div>
          </div>
        )}

        {isDeclined && (
          <div className="cp-rise" style={{ padding: "14px 16px 0" }}>
            <div className="cp-banner cp-b-info" role="status">
              <div>
                <b>{t("publicQuote.declinedTitle")}</b>
                <div style={{ marginTop: 2 }}>{t("publicQuote.declinedBody")}</div>
              </div>
            </div>
          </div>
        )}

        <section className="cp-rise" style={{ padding: "22px 20px 0", animationDelay: "40ms" }}>
          <span className="cp-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {t("publicQuote.quoteFallback")}{quote.numeroPreventivoData ? ` ${quote.numeroPreventivoData}` : ""}
          </span>
          {title && <h1 className="cp-h1" style={{ marginTop: 8 }}>{title}</h1>}
          {quote.clientData?.nome && (
            <p className="cp-sub" style={{ marginTop: 8 }}>
              {t("cp.quote.for")} {quote.clientData.nome}{quote.clientData.indirizzo ? ` · ${quote.clientData.indirizzo}` : ""}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {isAccepted ? <StatusPill tone="ok">{t("cp.quote.statusAccepted")}</StatusPill>
              : isDeclined ? <StatusPill tone="bad" shape="x">{t("cp.quote.statusDeclined")}</StatusPill>
              : <StatusPill tone="info">{t("cp.quote.statusOpen")}</StatusPill>}
          </div>
        </section>

        <section className="cp-rise" style={{ padding: "18px 16px 0", animationDelay: "80ms" }}>
          <div className="cp-card" style={{ padding: 18 }}>
            <span className="cp-sub">{t("cp.quote.totalWith")}</span>
            <div style={{ marginTop: 4 }}><BigMoney value={Number(displayTotale)} lang={lang} /></div>
          </div>
        </section>

        {/* Phase 111: the options at every width, as the board's radio cards. */}
        {hasTiers && (
          <section className="cp-rise" style={{ padding: "24px 16px 0", animationDelay: "120ms" }}>
            <div className="cp-sh">
              <h2>{isAccepted ? t("publicQuote.tiers.chosen") : t("publicQuote.tiers.choose")}</h2>
              {!isAccepted && <span className="cp-lnk">{t("cp.quote.pickOne")}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }} role="radiogroup" aria-label={t("publicQuote.tiers.choose")}>
              {tiers.map((tier) => {
                const on = tier.id === activeVariant?.id;
                const isWinner = isAccepted && quote.acceptedVariantId === tier.id;
                const diff = Number(tier.totale) - basePrice;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => !isAccepted && setSelectedVariantId(tier.id)}
                    disabled={isAccepted}
                    className="cp-press"
                    style={{ width: "100%", border: 0, textAlign: "left", background: "var(--card)", borderRadius: 20, padding: 16, display: "flex", gap: 14, alignItems: "flex-start", boxShadow: on ? "0 0 0 2px var(--ink)" : "0 0 0 1px var(--ring)", opacity: isAccepted && !isWinner ? 0.5 : 1, color: "inherit" }}
                  >
                    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--inv)" : "transparent", boxShadow: on ? "none" : "inset 0 0 0 1.6px var(--line2)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--on-inv)", transform: on ? "scale(1)" : "scale(0)", transition: "transform .3s cubic-bezier(.34,1.4,.64,1)" }} />
                    </span>
                    <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <b style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{tier.label}</b>
                        {tier.recommended && !isAccepted && <span className="cp-st cp-st-acc">{t("publicQuote.tiers.recommended")}</span>}
                      </span>
                      {tier.description && <span className="cp-sub" style={{ lineHeight: 1.45 }}>{tier.description}</span>}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                      <span className="cp-num" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{euro(tier.totale, lang)}</span>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        {Math.abs(diff) < 0.005 ? t("cp.quote.basePrice") : `${diff > 0 ? "+" : "−"}${euro(Math.abs(diff), lang)}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="cp-rise" style={{ padding: "24px 16px 0", animationDelay: "160ms" }}>
          <div className="cp-sh">
            <h2>{t("cp.quote.included")}</h2>
            {activeVariant && <span className="cp-lnk">{activeVariant.label}</span>}
          </div>
          <div className="cp-card" style={{ overflow: "hidden" }}>
            {(displayCapitoli || []).map((cap, ci) => (
              <div key={cap.lettera}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "12px 16px 8px", background: "var(--soft)", borderTop: ci ? "1px solid var(--line2)" : undefined }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{cap.titolo}</span>
                  <span className="cp-num" style={{ fontSize: 12.5, color: "var(--muted)" }}>{euro(cap.subtotale, lang)}</span>
                </div>
                {cap.voci.map((v, i) => (
                  <div key={i} style={{ padding: "12px 16px", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", borderTop: "1px solid var(--line)" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.3 }}>{v.descrizione}</span>
                      <span style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.35 }}>{v.quantita} {v.um}</span>
                    </span>
                    <span className="cp-num" style={{ fontSize: 14.5, fontWeight: 500, whiteSpace: "nowrap" }}>{euro(v.totale, lang)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--line2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--muted)" }}>
                <span>{t("publicQuote.subtotal")}</span>
                <span className="cp-num" style={{ color: "var(--ink)" }}>{euro(displaySubtotale, lang)}</span>
              </div>
              {displaySconto && displaySconto.percentuale > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--ok)", marginTop: 8 }}>
                    <span>{t("publicQuote.discount")} (<span className="cp-num">{displaySconto.percentuale}%</span>)</span>
                    <span className="cp-num">−{euro(Number(displaySubtotale) - displaySconto.importoScontato, lang)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>
                    <span>{t("publicQuote.discountedSubtotal")}</span>
                    <span className="cp-num" style={{ color: "var(--ink)" }}>{euro(displaySconto.importoScontato, lang)}</span>
                  </div>
                </>
              )}
              {displayTaxLines.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>
                  <span>{t("publicQuote.tax")} (<span className="cp-num">{displayIvaPercentuale}%</span>)</span>
                  <span className="cp-num" style={{ color: "var(--ink)" }}>{euro(displayIvaValore, lang)}</span>
                </div>
              ) : displayTaxLines.map((line) => (
                <div key={line.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>
                  <span>{taxLineLabel(line, lang, t("publicQuote.tax"))}</span>
                  <span className="cp-num" style={{ color: "var(--ink)" }}>{euro(line.amount, lang)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t("publicQuote.total")}</span>
                <span className="cp-num" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.03em" }}>{euro(displayTotale, lang)}</span>
              </div>
            </div>
            {(quote.exclusions?.length ?? 0) > 0 && (
              <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--line2)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("publicQuote.notIncluded")}</div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, listStyle: "disc", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.45 }}>
                  {quote.exclusions!.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>

        {quote.note && (
          <section className="cp-section-t cp-rise" style={{ animationDelay: "190ms" }}>
            <div className="cp-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="cp-av" aria-hidden="true" style={{ width: 34, height: 34, background: "var(--warn-soft)", color: "var(--warn)" }}>{initialsOf(companyName)}</span>
                <b style={{ fontSize: 14.5, fontWeight: 600 }}>{companyName}</b>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--t2)", textWrap: "pretty" as const, whiteSpace: "pre-line" }}>{quote.note}</p>
            </div>
          </section>
        )}

        <RebatesWidget quoteId={quote.id} />
        <FinancingWidget quoteId={quote.id} />

        {!isAccepted && (
          <section className="cp-section cp-rise" id="accept" style={{ animationDelay: "250ms" }}>
            <div className="cp-card" style={{ padding: 18 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>{t("publicQuote.acceptTitle")}</h2>
              <p className="cp-sub" style={{ marginTop: 6 }}>{activeVariant ? <>{activeVariant.label} · <span className="cp-num">{euro(displayTotale, lang)}</span></> : t("publicQuote.acceptSubtitle")}</p>
              <div className="cp-field" style={{ marginTop: 16 }}>
                <label htmlFor="nomeConferma">{t("publicQuote.fullNameLabel")}</label>
                <input
                  id="nomeConferma"
                  value={nomeConferma}
                  onChange={(e) => setNomeConferma(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAccept(); }}
                  placeholder={t("publicQuote.fullNamePlaceholder")}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="done"
                />
              </div>
              <p className="cp-note" style={{ margin: "10px 2px 0" }}>{t("cp.quote.legal")}</p>
              {error && !declineOpen && <p className="cp-err" role="alert" style={{ margin: "10px 2px 0" }}>{error}</p>}
              <button type="button" onClick={handleAccept} data-primary-action disabled={!nomeConferma.trim() || accepting || (hasTiers && !selectedVariantId)} className="cp-btn cp-btn-lg cp-btn-p cp-btn-w cp-press" style={{ marginTop: 14 }}>
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("publicQuote.acceptButton")} · <span className="cp-num">{euro(displayTotale, lang)}</span>
              </button>
            </div>
            {!quote.declinedAt && (
              <p style={{ textAlign: "center", marginTop: 4 }}>
                <button type="button" className="cp-link" onClick={() => { setError(null); setDeclineOpen(true); }}>{t("publicQuote.declineLink")}</button>
              </p>
            )}
            <BottomSheet
              open={declineOpen}
              onOpenChange={(o) => { if (!declining) setDeclineOpen(o); }}
              title={t("publicQuote.declineTitle")}
              description={t("publicQuote.declineSubtitle")}
              footer={
                <button type="button" onClick={handleDecline} disabled={declining} className="cp-btn cp-btn-md cp-btn-s cp-btn-w">
                  {declining ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("publicQuote.declineButton")}
                </button>
              }
            >
              <div className="cp-field">
                <label htmlFor="declineReason">{t("publicQuote.declineReasonLabel")}</label>
                <textarea id="declineReason" rows={3} maxLength={500} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder={t("publicQuote.declineReasonPlaceholder")} />
              </div>
              {error && <p className="cp-err" role="alert">{error}</p>}
            </BottomSheet>
          </section>
        )}

        <section className="cp-rise" style={{ padding: "16px 16px 0", animationDelay: "280ms" }}>
          {quote.pdfUrl && (
            <a href={quote.pdfUrl} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-s cp-btn-w cp-press">
              <Download width={18} height={18} aria-hidden="true" />{t("publicInvoice.downloadPdf")}
            </a>
          )}
          {portalUrl && (
            <a href={portalUrl} className="cp-card cp-lrow cp-press" style={{ marginTop: 12, textDecoration: "none" }}>
              <Glyph name="doc" tone="indigo" />
              <span className="cp-lt">
                <b>{t("portalLink.title").replace("{company}", quote.companySnapshot?.companyName || "")}</b>
                <small>{t("portalLink.desc")}</small>
              </span>
              <span className="cp-vh">{t("portalLink.open")}</span>
              <ChevronRight width={18} height={18} aria-hidden="true" style={{ color: "var(--faint)", flexShrink: 0 }} />
            </a>
          )}
          <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {phone && <>{t("cp.quote.questions")} <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="cp-num" style={{ color: "var(--ink)", fontWeight: 500 }}>{phone}</a><br /></>}
            <a href="https://quoteai.ca" style={{ color: "var(--faint)" }}>{t("cp.quote.sentWith")}</a>
          </p>
        </section>
      </div>
    </main>
  );
}
