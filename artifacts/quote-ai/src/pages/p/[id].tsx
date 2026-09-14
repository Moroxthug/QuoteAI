import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, FileX, Hammer, Landmark, Gift, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";

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
  subtotale: string;
  ivaPercentuale: string;
  ivaValore: string;
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
  subtotale: string;
  ivaPercentuale: string;
  ivaValore: string;
  totale: string;
  note: string;
  pdfUrl: string | null;
  status: "unlocked" | "accepted";
  acceptedAt: string | null;
  acceptedByName: string | null;
  acceptedVariantId: string | null;
  variants: PublicQuoteVariant[];
}

function euro(value: string | number) {
  return Number(value).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
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
  const { t } = useLanguage();
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
    <Card className="border-amber-100 bg-amber-50/50 mb-6">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-gray-900">{t("publicQuote.financing.title")}</p>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t("publicQuote.financing.subtitle")}</p>

        {application ? (
          <div className="space-y-2">
            {FINANCEIT_STATUS_KEYS[application.status] && (
              <p className="text-xs text-gray-700">{t(FINANCEIT_STATUS_KEYS[application.status])}</p>
            )}
            {application.status === "sent" && (
              <Button variant="outline" size="sm" onClick={() => { window.location.href = application.applicationLink; }} className="gap-2">
                {t("publicQuote.financing.continueApplication")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {estimate ? (
              <div className="text-sm text-gray-800">
                <span className="text-lg font-bold">{euro(estimate.monthlyPayment)}</span>
                <span className="text-gray-500">{t("publicQuote.financing.perMonth")}</span>
                <span className="text-xs text-gray-400 ml-2">({estimate.termMonths} {t("publicQuote.financing.termMonths")})</span>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEstimate} disabled={loadingEstimate} className="gap-2">
                {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("publicQuote.financing.getEstimate")}
              </Button>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div>
              <Button onClick={handleApply} disabled={applying} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
                {t("publicQuote.financing.applyButton")}
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">{t("publicQuote.financing.disclaimer")}</p>
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card className="border-emerald-100 bg-emerald-50/50 mb-6">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-gray-900">{t("publicQuote.rebates.title")}</p>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t("publicQuote.rebates.subtitle")}</p>

        <div className="space-y-3">
          {incentives.map((inc) => {
            const amount = inc.massimaleContributo
              ? euro(inc.massimaleContributo)
              : inc.percentualeMassima
                ? `${Number(inc.percentualeMassima)}%`
                : null;
            return (
              <div key={inc.id} className="border border-emerald-100 bg-white rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">{inc.titolo}</p>
                  {amount && (
                    <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                      {t("publicQuote.rebates.upTo")} {amount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{inc.descrizione}</p>
                <div className="flex items-center gap-3 mt-2">
                  {inc.incomeTested && (
                    <span className="text-[11px] text-amber-600 font-medium">{t("publicQuote.rebates.incomeTested")}</span>
                  )}
                  {inc.fonteUfficialeUrl && (
                    <a
                      href={inc.fonteUfficialeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
                    >
                      {t("publicQuote.rebates.learnMore")} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">{t("publicQuote.rebates.disclaimer")}</p>
      </CardContent>
    </Card>
  );
}

export default function PublicQuotePage() {
  const { t, lang } = useLanguage();
  const { id } = useParams();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nomeConferma, setNomeConferma] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

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
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <FileX className="h-10 w-10 text-gray-300 mb-4" />
        <h1 className="text-lg font-semibold text-gray-900">{t("publicQuote.notAvailableTitle")}</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
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
  const displayIvaPercentuale = activeVariant ? activeVariant.ivaPercentuale : quote.ivaPercentuale;
  const displayIvaValore = activeVariant ? activeVariant.ivaValore : quote.ivaValore;
  const displayTotale = activeVariant ? activeVariant.totale : quote.totale;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-2xl">
      <div className="text-center mb-8">
        <div className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-2">
          {quote.companySnapshot?.companyName || t("publicQuote.quoteFallback")}
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {quote.titoloPreventivoRiga2 || quote.titoloPreventivoRiga1}
        </h1>
        {quote.numeroPreventivoData && (
          <p className="text-sm text-gray-400 mt-1">{quote.numeroPreventivoData}</p>
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
                className={`text-left rounded-xl border p-4 transition ${
                  isSelected
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                    : "border-gray-200 bg-white hover:border-violet-200"
                } ${isAccepted && !isWinner ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">{tier.label}</span>
                  {isWinner && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                {tier.description && <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>}
                <p className="text-lg font-extrabold text-gray-900 mt-2">{euro(tier.totale)}</p>
              </button>
            );
          })}
        </div>
      )}

      <Card className="border-gray-100 shadow-md mb-6">
        <CardContent className="p-5 sm:p-6">
          {quote.clientData?.nome && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                {t("publicQuote.clientLabel")}
              </div>
              <div className="text-sm font-medium text-gray-800">{quote.clientData.nome}</div>
              {quote.clientData.indirizzo && (
                <div className="text-xs text-gray-500">{quote.clientData.indirizzo}</div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {(displayCapitoli || []).map((cap) => (
              <div key={cap.lettera}>
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800 mb-1.5">
                  <span>{cap.lettera}. {cap.titolo}</span>
                  <span>{euro(cap.subtotale)}</span>
                </div>
                <div className="space-y-1">
                  {cap.voci.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                      <span className="pr-3">{v.descrizione} ({v.quantita} {v.um})</span>
                      <span className="shrink-0">{euro(v.totale)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{t("publicQuote.subtotal")}</span>
              <span>{euro(displaySubtotale)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{t("publicQuote.tax")} ({displayIvaPercentuale}%)</span>
              <span>{euro(displayIvaValore)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
              <span>{t("publicQuote.total")}</span>
              <span>{euro(displayTotale)}</span>
            </div>
          </div>

          {quote.note && (
            <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">{quote.note}</p>
          )}
        </CardContent>
      </Card>

      <RebatesWidget quoteId={quote.id} />
      <FinancingWidget quoteId={quote.id} />

      {isAccepted ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5 sm:p-6 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">{t("publicQuote.acceptedTitle")}</p>
              <p className="text-xs text-emerald-700 mt-0.5">
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
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-100">
          <CardContent className="p-5 sm:p-6">
            <p className="text-sm font-semibold text-gray-900 mb-1">{t("publicQuote.acceptTitle")}</p>
            <p className="text-xs text-gray-500 mb-4">
              {t("publicQuote.acceptSubtitle")}
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="nomeConferma" className="text-xs text-gray-500">{t("publicQuote.fullNameLabel")}</Label>
                <Input
                  id="nomeConferma"
                  value={nomeConferma}
                  onChange={(e) => setNomeConferma(e.target.value)}
                  placeholder={t("publicQuote.fullNamePlaceholder")}
                  className="mt-1"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                onClick={handleAccept}
                disabled={!nomeConferma.trim() || accepting || (hasTiers && !selectedVariantId)}
                className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold"
              >
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
                {t("publicQuote.acceptButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[11px] text-gray-300 mt-8">
        {t("publicQuote.generatedWith")}
      </p>
    </div>
  );
}
