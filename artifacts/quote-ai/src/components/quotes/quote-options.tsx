import { useId, useState } from "react";
import { CheckCircle2, ChevronRight, Lock, SlidersHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCadWhole } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TemplateId = "standard" | "arosio" | "mariagrazia";

export function useTemplateChoices() {
  const { t } = useLanguage();
  return [
    { id: "standard" as const, label: t("dashboard.new.template.standard.label"), desc: t("dashboard.new.template.standard.desc"), proOnly: false },
    { id: "arosio" as const, label: t("dashboard.new.template.professional.label"), desc: t("dashboard.new.template.professional.desc"), proOnly: true },
    { id: "mariagrazia" as const, label: t("dashboard.new.template.elegant.label"), desc: t("dashboard.new.template.elegant.desc"), proOnly: true },
  ];
}

/** "18000", "18 000,50" → 18000 / 18000.5; empty or nonsense → undefined. */
export function parseTarget(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v.replace(/[\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Phase 105 — the new quote's rarely-changed settings as one line
 * ("Standard · no target amount") that opens a sheet (docs/MOBILE-RULES.md
 * rule 6), instead of three layout cards and a target field above the box
 * the page is for. Same on every width. Without `onTarget` it is the layout
 * alone (the manual builder: its total is the sum of its lines).
 */
export function QuoteOptions({ templateId, onTemplate, isPro, onProRequired, target, onTarget, disabled }: {
  templateId: TemplateId;
  onTemplate: (id: TemplateId) => void;
  isPro: boolean;
  onProRequired: () => void;
  target?: string;
  onTarget?: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const choices = useTemplateChoices();
  const current = choices.find((c) => c.id === templateId) ?? choices[0]!;
  const targetN = target !== undefined ? parseTarget(target) : undefined;
  const summary = [
    current.label,
    onTarget ? (targetN ? t("quotes.m.targetSummary").replace("{amount}", formatCadWhole(targetN)) : t("quotes.m.noTarget")) : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <button type="button" className="qopts" onClick={() => setOpen(true)} disabled={disabled} aria-haspopup="dialog">
        <SlidersHorizontal className="qopts-ic" />
        <span className="qopts-txt">
          <b>{t("quotes.m.options")}</b>
          <span>{summary}</span>
        </span>
        <ChevronRight className="qopts-chev" />
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t("quotes.m.options")}
        footer={<button type="button" className="btn btn-navy" onClick={() => setOpen(false)}>{t("quotes.m.done")}</button>}
      >
        <fieldset className="qopts-set">
          <legend className="eyebrow">{t("dashboard.new.layoutLabel")}</legend>
          <div className="src-list flush">
            {choices.map((c) => {
              const locked = c.proOnly && !isPro;
              const on = c.id === templateId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cn("src sm", on && "on")}
                  aria-pressed={on}
                  onClick={() => (locked ? onProRequired() : onTemplate(c.id))}
                >
                  <b>
                    {on && <CheckCircle2 />}
                    {c.label}
                    {locked && <span className="chip chip-yellow"><Lock className="h-3 w-3" /> {t("dashboard.new.template.pro")}</span>}
                  </b>
                  <p>{c.desc}</p>
                </button>
              );
            })}
          </div>
        </fieldset>
        {onTarget && (
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor={`${id}-target`}>{t("dashboard.new.targetAmount")}</label>
            <div className="money-in">
              <span aria-hidden="true">$</span>
              <input
                id={`${id}-target`}
                inputMode="numeric"
                autoComplete="off"
                value={target ?? ""}
                onChange={(e) => onTarget(e.target.value.replace(/[^0-9.,\s]/g, ""))}
                placeholder={t("dashboard.new.targetPlaceholder")}
                aria-describedby={`${id}-target-hint`}
              />
            </div>
            <p id={`${id}-target-hint`} className="field-hint">{t("quotes.m.targetHint")}</p>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
