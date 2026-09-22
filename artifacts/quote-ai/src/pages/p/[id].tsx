import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { CheckCircle2, Loader2, FileX, Hammer, Landmark, Gift, ExternalLink, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/logo";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { taxLineLabel } from "@/lib/tax-display";

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
  variants: PublicQuoteVariant[];
}

function euro(value: string | number, lang: "en" | "fr" = "en") {
  return Number(value).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });
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

  return (
    <div className="card mb-6" style={{ borderColor: "var(--yellow-t)", background: "var(--yellow-t)" }}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="h-4 w-4" style={{ color: "var(--yellow-dark)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--navy)" }}>{t("publicQuote.financing.title")}</p>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-mk)" }}>{t("publicQuote.financing.subtitle")}</p>

        {application ? (
          <div className="space-y-2">
            {FINANCEIT_STATUS_KEYS[application.status] && (
              <p className="text-xs" style={{ color: "var(--ink)" }}>{t(FINANCEIT_STATUS_KEYS[application.status])}</p>
            )}
            {application.status === "sent" && (
              <button className="btn btn-outline-navy btn-sm" onClick={() => { window.location.href = application.applicationLink; }}>
                {t("publicQuote.financing.continueApplication")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {estimate ? (
              <div className="text-sm" style={{ color: "var(--ink)" }}>
                <span className="text-lg font-bold">{euro(estimate.monthlyPayment, lang)}</span>
                <span style={{ color: "var(--muted-mk)" }}>{t("publicQuote.financing.perMonth")}</span>
                <span className="text-xs ml-2" style={{ color: "var(--faint)" }}>({estimate.termMonths} {t("publicQuote.financing.termMonths")})</span>
              </div>
            ) : (
              <button className="btn btn-outline-navy btn-sm gap-2" onClick={handleEstimate} disabled={loadingEstimate}>
                {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("publicQuote.financing.getEstimate")}
              </button>
            )}
            {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
            <div>
              <button onClick={handleApply} disabled={applying} className="btn btn-navy btn-sm">
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
                {t("publicQuote.financing.applyButton")}
              </button>
            </div>
            <p className="text-[11px]" style={{ color: "var(--faint)" }}>{t("publicQuote.financing.disclaimer")}</p>
          </div>
        )}
      </div>
    </div>
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
  const { t } = useLanguage();
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
    <div className="card mb-6" style={{ borderColor: "var(--green-t)", background: "var(--green-t)" }}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-4 w-4" style={{ color: "var(--green-dark)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--navy)" }}>{t("publicQuote.rebates.title")}</p>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-mk)" }}>{t("publicQuote.rebates.subtitle")}</p>

        <div className="space-y-3">
          {incentives.map((inc) => {
            const amount = inc.massimaleContributo
              ? euro(inc.massimaleContributo)
              : inc.percentualeMassima
                ? `${Number(inc.percentualeMassima)}%`
                : null;
            return (
              <div key={inc.id} className="rounded-lg p-3" style={{ border: "1px solid var(--green-t)", background: "#fff" }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{inc.titolo}</p>
                  {amount && (
                    <span className="chip chip-green shrink-0">
                      {t("publicQuote.rebates.upTo")} {amount}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--muted-mk)" }}>{inc.descrizione}</p>
                <div className="flex items-center gap-3 mt-2">
                  {inc.incomeTested && (
                    <span className="text-[11px] font-medium" style={{ color: "var(--yellow-dark)" }}>{t("publicQuote.rebates.incomeTested")}</span>
                  )}
                  {inc.fonteUfficialeUrl && (
                    <a
                      href={inc.fonteUfficialeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline"
                      style={{ color: "var(--green-dark)" }}
                    >
                      {t("publicQuote.rebates.learnMore")} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] mt-3" style={{ color: "var(--faint)" }}>{t("publicQuote.rebates.disclaimer")}</p>
      </div>
    </div>
  );
}

export default function PublicQuotePage() {
  const { t, lang, setLang } = useLanguage();
  const { id } = useParams();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  /** Phase 76: the client portal link, when the quote is linked to a client with an email. */
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nomeConferma, setNomeConferma] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
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
    } catch {
      setError(t("publicQuote.errorConnection"));
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="doc-shell min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} />
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="doc-shell min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <FileX className="h-10 w-10 mb-4" style={{ color: "var(--line)" }} />
        <h1 className="text-lg font-semibold" style={{ color: "var(--navy)" }}>{t("publicQuote.notAvailableTitle")}</h1>
        <p className="text-sm mt-1 max-w-sm" style={{ color: "var(--muted-mk)" }}>
          {t("publicQuote.notAvailableBody")}
        </p>
      </div>
    );
  }

  const isAccepted = quote.status === "accepted";
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

  const companyName = quote.companySnapshot?.companyName || t("publicQuote.quoteFallback");
  return (
    <div className="doc-shell pb-16">
      {/* Phase 67: a customer document, not a marketing page — the same sticky
          doc header the invoice and signing pages use, no site nav or footer. */}
      <header className="doc-head">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{t("publicInvoice.from")} <strong style={{ color: "var(--ink)" }}>{companyName}</strong></div>
            <div className="text-sm font-semibold truncate" style={{ color: "var(--navy)" }}>{t("publicQuote.quoteFallback")}{quote.numeroPreventivoData ? ` ${quote.numeroPreventivoData}` : ""}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => setLang(lang === "fr" ? "en" : "fr")} aria-label={lang === "fr" ? "English" : "Français"}>{lang === "fr" ? "EN" : "FR"}</button>
            <Logo className="h-6" />
          </div>
        </div>
      </header>
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-2xl">
      <div className="text-center mb-8">
        <div className="eyebrow mb-2">
          {quote.companySnapshot?.companyName || t("publicQuote.quoteFallback")}
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--navy)" }}>
          {quote.titoloPreventivoRiga2 || quote.titoloPreventivoRiga1}
        </h1>
        {quote.numeroPreventivoData && (
          <p className="text-sm mt-1" style={{ color: "var(--faint)" }}>{quote.numeroPreventivoData}</p>
        )}
      </div>

      {hasTiers && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {tiers.map((tier) => {
            const isSelected = tier.id === activeVariant?.id;
            const isWinner = isAccepted && quote.acceptedVariantId === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => !isAccepted && setSelectedVariantId(tier.id)}
                disabled={isAccepted}
                className="text-left rounded-xl border p-4 transition"
                style={{
                  borderColor: isSelected ? "var(--navy)" : "var(--line)",
                  background: isSelected ? "var(--soft)" : "#fff",
                  boxShadow: isSelected ? "0 0 0 2px var(--navy-100, rgba(16,16,49,.12))" : "none",
                  opacity: isAccepted && !isWinner ? 0.5 : 1,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: "var(--navy)" }}>{tier.label}</span>
                  {isWinner && <CheckCircle2 className="h-4 w-4" style={{ color: "var(--green-dark)" }} />}
                </div>
                {tier.description && <p className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>{tier.description}</p>}
                <p className="text-lg font-extrabold mt-2" style={{ color: "var(--navy)" }}>{euro(tier.totale, lang)}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="card mb-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="p-5 sm:p-6">
          {quote.clientData?.nome && (
            <div className="mb-4 pb-4" style={{ borderBottom: "1px solid var(--soft)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--faint)" }}>
                {t("publicQuote.clientLabel")}
              </div>
              <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{quote.clientData.nome}</div>
              {quote.clientData.indirizzo && (
                <div className="text-xs" style={{ color: "var(--muted-mk)" }}>{quote.clientData.indirizzo}</div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {(displayCapitoli || []).map((cap) => (
              <div key={cap.lettera}>
                <div className="flex items-center justify-between text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                  <span>{cap.lettera}. {cap.titolo}</span>
                  <span>{euro(cap.subtotale, lang)}</span>
                </div>
                <div className="space-y-1">
                  {cap.voci.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-xs" style={{ color: "var(--muted-mk)" }}>
                      <span className="pr-3">{v.descrizione} ({v.quantita} {v.um})</span>
                      <span className="shrink-0">{euro(v.totale, lang)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 space-y-1" style={{ borderTop: "1px solid var(--soft)" }}>
            <div className="flex justify-between text-sm" style={{ color: "var(--muted-mk)" }}>
              <span>{t("publicQuote.subtotal")}</span>
              <span>{euro(displaySubtotale, lang)}</span>
            </div>
            {displaySconto && displaySconto.percentuale > 0 && (
              <>
                <div className="flex justify-between text-sm" style={{ color: "var(--green-dark)" }}>
                  <span>{t("publicQuote.discount")} ({displaySconto.percentuale}%)</span>
                  <span>−{euro(Number(displaySubtotale) - displaySconto.importoScontato)}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ color: "var(--muted-mk)" }}>
                  <span>{t("publicQuote.discountedSubtotal")}</span>
                  <span>{euro(displaySconto.importoScontato, lang)}</span>
                </div>
              </>
            )}
            {displayTaxLines.length === 0 ? (
              <div className="flex justify-between text-sm" style={{ color: "var(--muted-mk)" }}>
                <span>{t("publicQuote.tax")} ({displayIvaPercentuale}%)</span>
                <span>{euro(displayIvaValore, lang)}</span>
              </div>
            ) : displayTaxLines.map((line) => (
              <div key={line.code} className="flex justify-between text-sm" style={{ color: "var(--muted-mk)" }}>
                <span>{taxLineLabel(line, lang, t("publicQuote.tax"))}</span>
                <span>{euro(line.amount, lang)}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold pt-1" style={{ color: "var(--navy)" }}>
              <span>{t("publicQuote.total")}</span>
              <span>{euro(displayTotale, lang)}</span>
            </div>
          </div>

          {quote.note && (
            <p className="text-xs mt-4 pt-4" style={{ color: "var(--faint)", borderTop: "1px solid var(--soft)" }}>{quote.note}</p>
          )}
        </div>
      </div>

      <RebatesWidget quoteId={quote.id} />
      <FinancingWidget quoteId={quote.id} />

      {isAccepted ? (
        <div className="doc-banner ok text-left p-5 sm:p-6 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--green-dark)" }} />
          <div>
            <p className="text-sm font-semibold">{t("publicQuote.acceptedTitle")}</p>
            <p className="text-xs mt-0.5">
              {t("publicQuote.confirmedByPrefix")} {quote.acceptedByName}
              {quote.acceptedAt && (
                <> {t("publicQuote.confirmedOnPrefix")} {format(
                  new Date(quote.acceptedAt),
                  lang === "fr" ? `d MMMM yyyy '${t("publicQuote.confirmedAtPrefix")}' HH:mm` : `MMMM d, yyyy '${t("publicQuote.confirmedAtPrefix")}' HH:mm`,
                  { locale: lang === "fr" ? frCA : enCA }
                )}</>
              )}.
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="p-5 sm:p-6">
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--navy)" }}>{t("publicQuote.acceptTitle")}</p>
            <p className="text-xs mb-4" style={{ color: "var(--muted-mk)" }}>
              {t("publicQuote.acceptSubtitle")}
            </p>
            <div className="space-y-3">
              <div className="field">
                <label htmlFor="nomeConferma">{t("publicQuote.fullNameLabel")}</label>
                <input
                  id="nomeConferma"
                  value={nomeConferma}
                  onChange={(e) => setNomeConferma(e.target.value)}
                  placeholder={t("publicQuote.fullNamePlaceholder")}
                />
              </div>
              {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
              <button
                onClick={handleAccept}
                disabled={!nomeConferma.trim() || accepting || (hasTiers && !selectedVariantId)}
                className="btn btn-navy w-full"
              >
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
                {t("publicQuote.acceptButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {portalUrl && (
        <a href={portalUrl} className="card p-4 mt-6 flex items-center gap-3 text-sm no-underline" style={{ boxShadow: "var(--shadow-card)" }}>
          <LayoutDashboard className="h-5 w-5 shrink-0" style={{ color: "var(--navy)" }} />
          <span className="grow" style={{ color: "var(--ink)" }}><b style={{ color: "var(--navy)" }}>{t("portalLink.title").replace("{company}", quote.companySnapshot?.companyName || "")}</b><span className="block text-xs" style={{ color: "var(--muted-mk)" }}>{t("portalLink.desc")}</span></span>
          <span className="btn btn-sm btn-outline-navy">{t("portalLink.open")}</span>
        </a>
      )}

      <p className="text-center text-xs mt-8" style={{ color: "var(--muted-mk)" }}>
        <a href="https://quoteai.ca" className="underline">{t("publicQuote.generatedWith")}</a>
      </p>
    </div>
    </div>
  );
}
