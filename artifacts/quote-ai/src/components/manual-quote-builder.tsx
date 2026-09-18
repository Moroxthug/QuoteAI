import { useState, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Loader2,
  GripVertical, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateManualQuote, useSuggestItemDescription, useListCatalogItems } from "@workspace/api-client-react";
import type { CreateManualQuoteBody } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";

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

const IVA_OPTIONS = [0, 4, 5, 10, 13];

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
}

interface ManualQuoteBuilderProps {
  clientData?: ClientData;
  profileData?: {
    companyName?: string;
    vatNumber?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
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

function fmt(n: number): string {
  return n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
      className={cn(
        "shrink-0 h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
        suggest.isPending
          ? "bg-navy-100 text-navy-400 cursor-wait"
          : "text-muted-foreground hover:text-navy-500 hover:bg-navy-50"
      )}
    >
      {suggest.isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Sparkles className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function ManualQuoteBuilder({ clientData, profileData }: ManualQuoteBuilderProps) {
  const { t } = useLanguage();
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
  const [ivaPercentuale, setIvaPercentuale] = useState(13);
  const [condizioni, setCondizioni] = useState<string[]>(() => getDefaultCondizioni(t));
  const [newCondizione, setNewCondizione] = useState("");
  const [note, setNote] = useState(t("manualQuote.defaultNote"));

  const [chapters, setChapters] = useState<ChapterState[]>([mkChapter(0, t)]);

  const { subtotale, ivaValore, totale } = computeTotals(chapters, ivaPercentuale);

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
    <div className="space-y-4">

      {/* ── Template ── */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("manualQuote.pdfTemplate")}</p>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setTemplateId(tpl.id)}
              className={cn(
                "text-left p-3 rounded-xl border-2 transition-all",
                templateId === tpl.id
                  ? "border-navy-400 bg-navy-50"
                  : "border-border hover:border-navy-200"
              )}
            >
              <p className={cn("text-xs font-semibold", templateId === tpl.id ? "text-navy-700" : "text-foreground")}>{tpl.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{tpl.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Title & Description ── */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("manualQuote.quoteHeader")}</p>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t("manualQuote.jobSubject")}</Label>
          <Input
            placeholder={t("manualQuote.jobSubjectPlaceholder")}
            value={titoloRiga2}
            onChange={e => setTitoloRiga2(e.target.value)}
            className="h-9 text-sm"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t("manualQuote.documentTitle")}</Label>
          <Input
            value={titoloRiga1}
            onChange={e => setTitoloRiga1(e.target.value)}
            className="h-9 text-sm text-muted-foreground"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t("manualQuote.generalDescription")}</Label>
          <textarea
            value={descrizione}
            onChange={e => setDescrizione(e.target.value)}
            placeholder={t("manualQuote.generalDescriptionPlaceholder")}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent transition-shadow"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* ── Chapters ── */}
      <div className="space-y-3">
        {chapters.map((ch, chIdx) => {
          const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const lettera = letters[chIdx] ?? String(chIdx + 1);
          const capSubtotale = computeCapSubtotale(ch);

          return (
            <div key={ch.id} className="card overflow-hidden">
              {/* Chapter header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-bold text-sm text-navy-600 shrink-0 w-5">{lettera}</span>
                <input
                  value={ch.titolo}
                  onChange={e => updateChapter(ch.id, { titolo: e.target.value })}
                  placeholder={`${t("manualQuote.chapterWord")} ${lettera}`}
                  className="flex-1 text-sm font-semibold text-foreground bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
                  disabled={isSubmitting}
                />
                <span className="text-xs text-muted-foreground font-mono shrink-0">$ {fmt(capSubtotale)}</span>
                <button
                  type="button"
                  onClick={() => updateChapter(ch.id, { collapsed: !ch.collapsed })}
                  className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-accent transition-colors shrink-0"
                >
                  {ch.collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>
                {chapters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChapter(ch.id)}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {!ch.collapsed && (
                <div className="p-4 space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_64px_80px_88px_72px_28px] gap-2 px-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{t("manualQuote.colDescription")}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{t("manualQuote.colUnit")}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{t("manualQuote.colQty")}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{t("manualQuote.colUnitPrice")}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide text-right">{t("manualQuote.colTotal")}</p>
                    <span />
                  </div>

                  {/* Line items */}
                  {ch.voci.map(v => {
                    const voceTot = computeVoceTotale(v);
                    return (
                      <div key={v.id} className="grid grid-cols-[1fr_64px_80px_88px_72px_28px] gap-2 items-center">
                        {/* Description + AI */}
                        <div className="flex items-center gap-1 min-w-0 relative">
                          <input
                            value={v.descrizione}
                            onChange={e => updateVoce(ch.id, v.id, { descrizione: e.target.value })}
                            onFocus={() => setActiveVoceId(v.id)}
                            onBlur={() => setTimeout(() => setActiveVoceId(null), 250)}
                            placeholder={t("manualQuote.itemDescriptionPlaceholder")}
                            className="flex-1 h-8 px-2.5 rounded-lg border border-border text-xs text-foreground placeholder:text-muted-foreground bg-card focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent transition min-w-0"
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
                              <div className="absolute left-0 right-0 top-9 bg-card border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto divide-y">
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
                                    className="w-full text-left px-3 py-2 hover:bg-navy-50 text-[11px] flex justify-between gap-2"
                                  >
                                    <span className="font-semibold text-foreground truncate">{item.nome}</span>
                                    <span className="text-muted-foreground shrink-0 font-mono">({item.um}) ${item.prezzoUnitario}</span>
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
                          className="h-8 rounded-lg border border-border text-xs text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent px-1.5 transition w-full"
                          disabled={isSubmitting}
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
                          className="h-8 px-2 rounded-lg border border-border text-xs text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent transition text-right w-full"
                          disabled={isSubmitting}
                        />

                        {/* Unit Price */}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={v.prezzoUnitario}
                          onChange={e => updateVoce(ch.id, v.id, { prezzoUnitario: e.target.value })}
                          placeholder="0,00"
                          className="h-8 px-2 rounded-lg border border-border text-xs text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent transition text-right w-full"
                          disabled={isSubmitting}
                        />

                        {/* Line item total */}
                        <p className={cn("text-xs text-right font-mono shrink-0", voceTot > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {voceTot > 0 ? `$ ${fmt(voceTot)}` : "—"}
                        </p>

                        {/* Remove line item */}
                        {ch.voci.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeVoce(ch.id, v.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-50 transition-colors"
                            disabled={isSubmitting}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : <span />}
                      </div>
                    );
                  })}

                  {/* Add voce */}
                  <button
                    type="button"
                    onClick={() => addVoce(ch.id)}
                    className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-navy-600 hover:bg-navy-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("manualQuote.addItem")}
                  </button>

                  {/* Chapter note */}
                  <div className="pt-1 border-t border-border">
                    <input
                      value={ch.osservazione}
                      onChange={e => updateChapter(ch.id, { osservazione: e.target.value })}
                      placeholder={t("manualQuote.chapterNotePlaceholder")}
                      className="w-full h-7 px-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none focus:border-navy-300 transition"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Chapter subtotal */}
                  <div className="flex justify-end pt-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {t("manualQuote.subtotalPrefix")} {lettera}: <span className="font-mono font-semibold text-foreground">$ {fmt(capSubtotale)}</span>
                    </span>
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
          className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-navy-300 hover:text-navy-500 hover:bg-navy-50/30 transition-all flex items-center justify-center gap-2"
          disabled={isSubmitting || chapters.length >= 26}
        >
          <Plus className="h-4 w-4" />
          {t("manualQuote.addChapter")}
        </button>
      </div>

      {/* ── Totals & Tax ── */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("manualQuote.financialSummary")}</p>

        {/* Tax rate selector */}
        <div className="flex items-center gap-3">
          <Label className="text-xs font-medium text-muted-foreground shrink-0">{t("manualQuote.taxRate")}</Label>
          <div className="flex gap-2 flex-wrap">
            {IVA_OPTIONS.map(iva => (
              <button
                key={iva}
                type="button"
                onClick={() => setIvaPercentuale(iva)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  ivaPercentuale === iva
                    ? "border-navy-400 bg-navy-50 text-navy-700"
                    : "border-border text-muted-foreground hover:border-navy-200"
                )}
                disabled={isSubmitting}
              >
                {iva === 0 ? t("manualQuote.taxExempt") : `${iva}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Totals breakdown */}
        <div className="space-y-1 pt-1 border-t border-border">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("manualQuote.taxableAmount")}</span>
            <span className="font-mono">$ {fmt(subtotale)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("manualQuote.taxLabel")} {ivaPercentuale === 0 ? t("manualQuote.taxExempt") : `${ivaPercentuale}%`}</span>
            <span className="font-mono">$ {fmt(ivaValore)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-foreground pt-1 border-t border-border">
            <span>{t("manualQuote.total")}</span>
            <span className="font-mono text-navy-700">$ {fmt(totale)}</span>
          </div>
        </div>
      </div>

      {/* ── Payment terms ── */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("manualQuote.paymentTerms")}</p>
        <div className="space-y-1.5">
          {condizioni.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-4">{idx + 1}.</span>
              <span className="flex-1 text-sm text-foreground">{c}</span>
              <button
                type="button"
                onClick={() => removeCondizione(idx)}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                disabled={isSubmitting}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            value={newCondizione}
            onChange={e => setNewCondizione(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCondizione(); } }}
            placeholder={t("manualQuote.addTermPlaceholder")}
            className="h-8 text-sm flex-1"
            disabled={isSubmitting}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondizione}
            disabled={!newCondizione.trim() || isSubmitting}
            className="h-8 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="card p-4 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("manualQuote.finalNotes")}</Label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent transition-shadow"
          disabled={isSubmitting}
        />
      </div>

      {/* ── Submit ── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={cn(
          "w-full h-12 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
          isSubmitting
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "btn-gradient text-white shadow-sm hover:shadow-md"
        )}
      >
        {isSubmitting
          ? <><Loader2 className="h-4 w-4 animate-spin" />{t("manualQuote.creatingInProgress")}</>
          : <>{t("manualQuote.createQuote")} &rarr;</>}
      </button>
    </div>
  );
}
