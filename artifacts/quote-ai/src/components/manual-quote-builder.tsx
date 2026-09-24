import { useState, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Loader2,
  GripVertical, X, CheckCircle2, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateManualQuote, useSuggestItemDescription, useListCatalogItems, useListTaxProfiles } from "@workspace/api-client-react";
import { CANADIAN_PROVINCES } from "@/lib/payment-schedule";
import { profileSummary, previewTaxLines, taxLineLabel } from "@/lib/tax-display";
import type { CreateManualQuoteBody } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatAmount } from "@/lib/money";

const UM_OPTIONS = ["sq.ft", "ln.ft", "cu.yd", "kg", "t", "hrs", "g", "LS", "pcs", "ea.", "kW", "L"];

function getTemplates(t: (key: string) => string) {
  return [
    { id: "standard", label: t("manualQuote.template.standard.label"), desc: t("manualQuote.template.standard.desc") },
    { id: "arosio", label: t("manualQuote.template.arosio.label"), desc: t("manualQuote.template.arosio.desc") },
    { id: "mariagrazia", label: t("manualQuote.template.mariagrazia.label"), desc: t("manualQuote.template.mariagrazia.desc") },
  ] as const;
}

function getDefaultCondizioni(t: (key: string) => string) {
  return [
    t("manualQuote.defaultTerms1"),
    t("manualQuote.defaultTerms2"),
    t("manualQuote.defaultTerms3"),
    t("manualQuote.defaultTerms4"),
  ];
}

// Phase 71: taxes come from the province (GET /api/tax-profiles), not a fixed list.
const TAX_EXEMPT = "EXEMPT";

interface VoceState {
  id: string;
  descrizione: string;
  um: string;
  quantita: string;
  prezzoUnitario: string;
}

interface ChapterState {
  id: string;
  titolo: string;
  osservazione: string;
  voci: VoceState[];
  collapsed: boolean;
}

interface ClientData {
  nome: string;
  indirizzo?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  businessNumber?: string;
  partitaIva?: string;
  email?: string;
  phone?: string;
}

interface ManualQuoteBuilderProps {
  clientData?: ClientData;
  /** Phase 94: the page's own check on the client fields (a bad email); false stops the save. */
  onBeforeSubmit?: () => boolean;
  profileData?: {
    companyName?: string;
    vatNumber?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
    province?: string | null;
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function mkVoce(): VoceState {
  return { id: uid(), descrizione: "", um: "mq", quantita: "1", prezzoUnitario: "" };
}

function mkChapter(index: number, t: (key: string) => string): ChapterState {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return {
    id: uid(),
    titolo: `${t("manualQuote.chapterWord")} ${letters[index] ?? index + 1}`,
    osservazione: "",
    voci: [mkVoce()],
    collapsed: false,
  };
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Phase 94: in the app's language ("1 234,50" in French).
const fmt = (n: number): string => formatAmount(n);

function computeVoceTotale(v: VoceState): number {
  return Math.round(parseNum(v.quantita) * parseNum(v.prezzoUnitario) * 100) / 100;
}

function computeCapSubtotale(ch: ChapterState): number {
  return Math.round(ch.voci.reduce((s, v) => s + computeVoceTotale(v), 0) * 100) / 100;
}

function computeTotals(chapters: ChapterState[], iva: number) {
  const subtotale = Math.round(chapters.reduce((s, c) => s + computeCapSubtotale(c), 0) * 100) / 100;
  const ivaValore = Math.round(subtotale * (iva / 100) * 100) / 100;
  const totale = Math.round((subtotale + ivaValore) * 100) / 100;
  return { subtotale, ivaValore, totale };
}

function AISuggestButton({
  voce,
  chapterTitle,
  projectTitle,
  onSuggest,
}: {
  voce: VoceState;
  chapterTitle: string;
  projectTitle: string;
  onSuggest: (desc: string) => void;
}) {
  const suggest = useSuggestItemDescription();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleClick = () => {
    const brief = voce.descrizione.trim() || chapterTitle;
    if (!brief) {
      toast({ title: t("manualQuote.toast.describeFirstTitle"), description: t("manualQuote.toast.describeFirstDesc"), variant: "destructive" });
      return;
    }
    suggest.mutate(
      { data: { brief, context: projectTitle || chapterTitle } },
      {
        onSuccess: (r) => onSuggest(r.description),
        onError: () => toast({ title: t("manualQuote.toast.aiErrorTitle"), description: t("manualQuote.toast.aiErrorDesc"), variant: "destructive" }),
      }
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={suggest.isPending}
      title={t("manualQuote.improveWithAi")}
      className="ic-btn"
      aria-label={t("manualQuote.improveWithAi")}
    >
      {suggest.isPending
        ? <Loader2 className="animate-spin" />
        : <Sparkles />}
    </button>
  );
}

export default function ManualQuoteBuilder({ clientData, profileData, onBeforeSubmit }: ManualQuoteBuilderProps) {
  const { t, lang } = useLanguage();
  const TEMPLATES = getTemplates(t);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createManualQuote = useCreateManualQuote();
  const { data: catalogItems = [] } = useListCatalogItems();
  const [activeVoceId, setActiveVoceId] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState<"standard" | "arosio" | "mariagrazia">("standard");
  const [titoloRiga1, setTitoloRiga1] = useState(t("manualQuote.defaultDocTitle"));
  const [titoloRiga2, setTitoloRiga2] = useState("");
  const [descrizione, setDescrizione] = useState("");
  // Phase 71: the province decides the tax components; "EXEMPT" = 0 %.
  const [taxProvince, setTaxProvince] = useState<string>(() => (clientData?.province || profileData?.province || "ON").toUpperCase());
  const { data: taxProfilesData } = useListTaxProfiles();
  const taxProfile = taxProvince === TAX_EXEMPT ? null : (taxProfilesData?.profiles.find((p) => p.province === taxProvince) ?? null);
  const ivaPercentuale = taxProfile?.totalRate ?? 0;
  const [condizioni, setCondizioni] = useState<string[]>(() => getDefaultCondizioni(t));
  const [newCondizione, setNewCondizione] = useState("");
  const [note, setNote] = useState(t("manualQuote.defaultNote"));

  const [chapters, setChapters] = useState<ChapterState[]>([mkChapter(0, t)]);

  const { subtotale, totale } = computeTotals(chapters, ivaPercentuale);
  const taxLinesPreview = previewTaxLines(subtotale, taxProfile);

  const updateChapter = useCallback((chId: string, patch: Partial<ChapterState>) => {
    setChapters(prev => prev.map(c => c.id === chId ? { ...c, ...patch } : c));
  }, []);

  const updateVoce = useCallback((chId: string, vId: string, patch: Partial<VoceState>) => {
    setChapters(prev => prev.map(c =>
      c.id === chId
        ? { ...c, voci: c.voci.map(v => v.id === vId ? { ...v, ...patch } : v) }
        : c
    ));
  }, []);

  const addChapter = () => {
    setChapters(prev => [...prev, mkChapter(prev.length, t)]);
  };

  const removeChapter = (chId: string) => {
    setChapters(prev => prev.filter(c => c.id !== chId));
  };

  const addVoce = (chId: string) => {
    setChapters(prev => prev.map(c =>
      c.id === chId ? { ...c, voci: [...c.voci, mkVoce()] } : c
    ));
  };

  const removeVoce = (chId: string, vId: string) => {
    setChapters(prev => prev.map(c =>
      c.id === chId ? { ...c, voci: c.voci.filter(v => v.id !== vId) } : c
    ));
  };

  const removeCondizione = (idx: number) => {
    setCondizioni(prev => prev.filter((_, i) => i !== idx));
  };

  const addCondizione = () => {
    const trimmed = newCondizione.trim();
    if (!trimmed) return;
    setCondizioni(prev => [...prev, trimmed]);
    setNewCondizione("");
  };

  const handleSubmit = () => {
    if (createManualQuote.isPending) return;
    if (onBeforeSubmit && !onBeforeSubmit()) return;

    const hasContent = chapters.some(c => c.voci.some(v => v.descrizione.trim() && parseNum(v.prezzoUnitario) > 0));
    if (!hasContent) {
      toast({
        title: t("manualQuote.toast.addItemTitle"),
        description: t("manualQuote.toast.addItemDesc"),
        variant: "destructive",
      });
      return;
    }

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const capitoli = chapters.map((ch, idx) => ({
      lettera: letters[idx] ?? String(idx + 1),
      titolo: ch.titolo || `${t("manualQuote.chapterWord")} ${letters[idx] ?? idx + 1}`,
      osservazione: ch.osservazione || undefined,
      voci: ch.voci.map(v => ({
        descrizione: v.descrizione,
        um: v.um,
        quantita: parseNum(v.quantita),
        prezzoUnitario: parseNum(v.prezzoUnitario),
        totale: computeVoceTotale(v),
      })),
      subtotale: computeCapSubtotale(ch),
    }));

    const companySnapshot = profileData
      ? {
          companyName: profileData.companyName || "",
          ...(profileData.vatNumber && { vatNumber: profileData.vatNumber }),
          ...(profileData.address && { address: profileData.address }),
          ...(profileData.phone && { phone: profileData.phone }),
          ...(profileData.email && { email: profileData.email }),
          ...(profileData.logoUrl && { logoUrl: profileData.logoUrl }),
        }
      : undefined;

    const body: CreateManualQuoteBody = {
      templateId,
      capitoli,
      clientData: clientData?.nome
        ? { ...clientData, indirizzo: clientData.indirizzo ?? "" }
        : undefined,
      companySnapshot,
      titoloPreventivoRiga1: titoloRiga1 || undefined,
      titoloPreventivoRiga2: titoloRiga2 || undefined,
      descrizioneGenerale: descrizione || undefined,
      ivaPercentuale,
      province: taxProvince === TAX_EXEMPT ? undefined : taxProvince,
      condizioniPagamento: condizioni,
      note: note || undefined,
    };

    createManualQuote.mutate(
      { data: body },
      {
        onSuccess: (quote) => setLocation(`/dashboard/quotes/${quote.id}`),
        onError: (err: unknown) => {
          const status = (err as { status?: number })?.status;
          if (status === 429) {
            toast({ title: t("manualQuote.toast.quotaTitle"), description: t("manualQuote.toast.quotaDesc"), variant: "destructive" });
          } else {
            toast({ title: t("manualQuote.toast.createErrorTitle"), description: t("manualQuote.toast.createErrorDesc"), variant: "destructive" });
          }
        },
      }
    );
  };

  const isSubmitting = createManualQuote.isPending;

  return (
    <div className="stack">

      {/* ── Template ── */}
      <section className="card">
        <div className="card-head"><div><h2>{t("manualQuote.pdfTemplate")}</h2></div></div>
        <div className="src-grid" style={{ paddingTop: 16 }}>
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setTemplateId(tpl.id)}
              className={cn("src sm", templateId === tpl.id && "on")}
            >
              <b>{templateId === tpl.id && <CheckCircle2 />}{tpl.label}</b>
              <p>{tpl.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Title & Description ── */}
      <section className="card">
        <div className="card-head"><div><h2>{t("manualQuote.quoteHeader")}</h2></div></div>
        <div className="form-grid tight">
          <div className="field full">
            <label>{t("manualQuote.jobSubject")}</label>
            <input
              placeholder={t("manualQuote.jobSubjectPlaceholder")}
              value={titoloRiga2}
              onChange={e => setTitoloRiga2(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="field full">
            <label>{t("manualQuote.documentTitle")}</label>
            <input
              value={titoloRiga1}
              onChange={e => setTitoloRiga1(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="field full">
            <label>{t("manualQuote.generalDescription")}</label>
            <textarea
              value={descrizione}
              onChange={e => setDescrizione(e.target.value)}
              placeholder={t("manualQuote.generalDescriptionPlaceholder")}
              rows={2}
              style={{ resize: "none" }}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </section>

      {/* ── Chapters ── */}
      <div>
        {chapters.map((ch, chIdx) => {
          const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const lettera = letters[chIdx] ?? String(chIdx + 1);
          const capSubtotale = computeCapSubtotale(ch);

          return (
            <div key={ch.id} className="chap-block">
              {/* Chapter header */}
              <div className="chap-head">
                <GripVertical className="chev" />
                <span className="let">{lettera}</span>
                <input
                  value={ch.titolo}
                  onChange={e => updateChapter(ch.id, { titolo: e.target.value })}
                  placeholder={`${t("manualQuote.chapterWord")} ${lettera}`}
                  className="inl"
                  disabled={isSubmitting}
                />
                <span className="amt">$ {fmt(capSubtotale)}</span>
                <button
                  type="button"
                  onClick={() => updateChapter(ch.id, { collapsed: !ch.collapsed })}
                  className="ic-btn"
                  aria-label={ch.collapsed ? "Expand" : "Collapse"}
                >
                  {ch.collapsed ? <ChevronDown /> : <ChevronUp />}
                </button>
                {chapters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChapter(ch.id)}
                    className="ic-btn danger"
                    disabled={isSubmitting}
                    aria-label={t("manualQuote.chapterWord")}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>

              {!ch.collapsed && (
                <div className="li-body">
                  {/* Column headers */}
                  <div className="li-head">
                    <span>{t("manualQuote.colDescription")}</span>
                    <span>{t("manualQuote.colUnit")}</span>
                    <span>{t("manualQuote.colQty")}</span>
                    <span>{t("manualQuote.colUnitPrice")}</span>
                    <span className="r">{t("manualQuote.colTotal")}</span>
                    <span />
                  </div>

                  {/* Line items */}
                  <div>
                    {ch.voci.map(v => {
                      const voceTot = computeVoceTotale(v);
                      return (
                        <div key={v.id} className="li-row">
                          {/* Description + AI */}
                          <div className="desc">
                            <input
                              value={v.descrizione}
                              onChange={e => updateVoce(ch.id, v.id, { descrizione: e.target.value })}
                              onFocus={() => setActiveVoceId(v.id)}
                              onBlur={() => setTimeout(() => setActiveVoceId(null), 250)}
                              placeholder={t("manualQuote.itemDescriptionPlaceholder")}
                              className="inp-sm"
                              disabled={isSubmitting}
                            />
                            <AISuggestButton
                              voce={v}
                              chapterTitle={ch.titolo}
                              projectTitle={titoloRiga2}
                              onSuggest={desc => updateVoce(ch.id, v.id, { descrizione: desc })}
                            />

                            {activeVoceId === v.id && v.descrizione.trim().length >= 2 && (() => {
                              const suggestions = catalogItems.filter(item =>
                                item.nome.toLowerCase().includes(v.descrizione.toLowerCase())
                              ).slice(0, 5);

                              if (suggestions.length === 0) return null;

                              return (
                                <div className="sugg">
                                  {suggestions.map(item => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => {
                                        updateVoce(ch.id, v.id, {
                                          descrizione: item.nome,
                                          um: item.um,
                                          prezzoUnitario: String(item.prezzoUnitario),
                                        });
                                        setActiveVoceId(null);
                                      }}
                                    >
                                      <b>{item.nome}</b>
                                      <span>({item.um}) ${item.prezzoUnitario}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          {/* U.M. */}
                          <select
                            value={v.um}
                            onChange={e => updateVoce(ch.id, v.id, { um: e.target.value })}
                            className="inp-sm um"
                            disabled={isSubmitting}
                            aria-label={t("manualQuote.colUnit")}
                          >
                            {UM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>

                          {/* Quantity */}
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={v.quantita}
                            onChange={e => updateVoce(ch.id, v.id, { quantita: e.target.value })}
                            className="inp-sm r qty"
                            disabled={isSubmitting}
                            aria-label={t("manualQuote.colQty")}
                          />

                          {/* Unit Price */}
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={v.prezzoUnitario}
                            onChange={e => updateVoce(ch.id, v.id, { prezzoUnitario: e.target.value })}
                            placeholder="0.00"
                            className="inp-sm r price"
                            disabled={isSubmitting}
                            aria-label={t("manualQuote.colUnitPrice")}
                          />

                          {/* Line item total */}
                          <span className={cn("tot", voceTot <= 0 && "faint")}>
                            {voceTot > 0 ? `$ ${fmt(voceTot)}` : "—"}
                          </span>

                          {/* Remove line item */}
                          {ch.voci.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeVoce(ch.id, v.id)}
                              className="ic-btn danger"
                              disabled={isSubmitting}
                              aria-label={t("manualQuote.colDescription")}
                            >
                              <X />
                            </button>
                          ) : <span />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add voce */}
                  <button type="button" onClick={() => addVoce(ch.id)} className="text-link" disabled={isSubmitting}>
                    <Plus /> {t("manualQuote.addItem")}
                  </button>

                  {/* Chapter note */}
                  <div className="obs">
                    <input
                      value={ch.osservazione}
                      onChange={e => updateChapter(ch.id, { osservazione: e.target.value })}
                      placeholder={t("manualQuote.chapterNotePlaceholder")}
                      className="inp-sm dashed"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Chapter subtotal */}
                  <div className="sub">
                    {t("manualQuote.subtotalPrefix")} {lettera}: <b>$ {fmt(capSubtotale)}</b>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add chapter */}
        <button
          type="button"
          onClick={addChapter}
          className="add-dashed"
          style={{ marginTop: 12 }}
          disabled={isSubmitting || chapters.length >= 26}
        >
          <Plus />
          {t("manualQuote.addChapter")}
        </button>
      </div>

      {/* ── Totals & Tax ── */}
      <section className="card">
        <div className="card-head"><div><h2>{t("manualQuote.financialSummary")}</h2></div></div>

        {/* Phase 71: province → statutory components; the picker is the same
            province list the contract template uses. */}
        <div className="tax-row">
          <label htmlFor="manual-quote-tax-province">{t("manualQuote.taxProvince")}</label>
          <div className="pills" style={{ alignItems: "center", gap: 8 }}>
            <select
              id="manual-quote-tax-province"
              className="inp-sm"
              value={taxProvince}
              onChange={(e) => setTaxProvince(e.target.value)}
              disabled={isSubmitting}
            >
              {CANADIAN_PROVINCES.map((p) => {
                const prof = taxProfilesData?.profiles.find((x) => x.province === p.code);
                return <option key={p.code} value={p.code}>{p[lang]}{prof ? ` — ${profileSummary(prof, lang)}` : ""}</option>;
              })}
              <option value={TAX_EXEMPT}>{t("manualQuote.taxExemptOption")}</option>
            </select>
          </div>
        </div>

        {/* Totals breakdown */}
        <div className="kv-list">
          <div className="kv"><span>{t("manualQuote.taxableAmount")}</span><b>$ {fmt(subtotale)}</b></div>
          {taxLinesPreview.length === 0 ? (
            <div className="kv"><span>{t("manualQuote.taxLabel")} — {t("manualQuote.taxExempt")}</span><b>$ {fmt(0)}</b></div>
          ) : taxLinesPreview.map((line) => (
            <div className="kv" key={line.code}><span>{taxLineLabel(line, lang, t("manualQuote.taxLabel"))}</span><b>$ {fmt(line.amount)}</b></div>
          ))}
          <div className="kv total"><span>{t("manualQuote.total")}</span><b>$ {fmt(totale)}</b></div>
        </div>
      </section>

      {/* ── Payment terms ── */}
      <section className="card">
        <div className="card-head"><div><h2>{t("manualQuote.paymentTerms")}</h2></div></div>
        <div className="term-list">
          {condizioni.map((c, idx) => (
            <div key={idx} className="term-row">
              <span className="n">{idx + 1}.</span>
              <span className="grow">{c}</span>
              <button type="button" onClick={() => removeCondizione(idx)} className="ic-btn danger" disabled={isSubmitting} aria-label={t("manualQuote.paymentTerms")}>
                <X />
              </button>
            </div>
          ))}
          <div className="add">
            <input
              value={newCondizione}
              onChange={e => setNewCondizione(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCondizione(); } }}
              placeholder={t("manualQuote.addTermPlaceholder")}
              className="inp-sm"
              disabled={isSubmitting}
            />
            <button type="button" onClick={addCondizione} disabled={!newCondizione.trim() || isSubmitting} className="btn btn-sm btn-outline-navy" aria-label={t("manualQuote.addTermPlaceholder")}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Notes ── */}
      <section className="card">
        <div className="card-head"><div><h2>{t("manualQuote.finalNotes")}</h2></div></div>
        <div className="form-grid tight">
          <div className="field full">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              style={{ resize: "none" }}
              disabled={isSubmitting}
              aria-label={t("manualQuote.finalNotes")}
            />
          </div>
        </div>
      </section>

      {/* ── Submit ── */}
      <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="btn btn-navy" style={{ width: "100%" }}>
        {isSubmitting
          ? <><Loader2 className="h-4 w-4 animate-spin" />{t("manualQuote.creatingInProgress")}</>
          : <>{t("manualQuote.createQuote")} <ArrowRight className="chev" /></>}
      </button>
    </div>
  );
}
