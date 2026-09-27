import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCad } from "@/lib/money";
import { cn } from "@/lib/utils";

/** One line of a quote as the rows show it (view or edit). */
export type LineView = { descrizione: string; um: string; quantita: number; prezzoUnitario: number; totale?: number };

/** Quantities as people write them: "3", "2.5", never "2.50000001". */
const qty = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Phase 105 — a quote's lines as rows on a phone (docs/MOBILE-RULES.md
 * rule 4): the description over at most two lines, "qty unit × unit price"
 * under it, the amount on the right. With `onEdit` each row is a button that
 * opens the line in a sheet; with `onAdd` an "Add item" row closes the list.
 * AI "pro" descriptions keep their heading on the first line and the long
 * text after it — the row shows the heading.
 */
export function QuoteLineRows({ lines, onEdit, onAdd, label }: {
  lines: LineView[];
  onEdit?: (index: number) => void;
  onAdd?: () => void;
  label: string;
}) {
  const { t } = useLanguage();
  return (
    <ul className="qlines" aria-label={label}>
      {lines.map((l, i) => {
        const total = l.totale ?? l.quantita * l.prezzoUnitario;
        const desc = l.descrizione.split("\n")[0]?.trim() || t("quotes.m.untitledLine");
        const body = (
          <>
            {/* The visible text is the button's name (a screen reader hears what is shown), after "Edit line:". */}
            {onEdit && <span className="sr-only">{t("quotes.m.editLine")}: </span>}
            <span className="qline-main">
              <span className={cn("qline-desc", !l.descrizione.trim() && "faint")}>{desc}</span>
              <span className="qline-calc">{qty(l.quantita)} {l.um} × {formatCad(l.prezzoUnitario)}</span>
            </span>
            <span className="qline-amt">{formatCad(total)}</span>
            {onEdit && <ChevronRight className="qline-chev" aria-hidden="true" />}
          </>
        );
        return (
          <li key={i}>
            {onEdit
              ? <button type="button" className="qline" onClick={() => onEdit(i)}>{body}</button>
              : <div className="qline">{body}</div>}
          </li>
        );
      })}
      {onAdd && (
        <li>
          <button type="button" className="qline add" onClick={onAdd}>
            <Plus /> {t("dashboard.quoteDetail.addItem")}
          </button>
        </li>
      )}
    </ul>
  );
}

/** The fields of the line sheet, kept as typed so "2," and "" survive until Done. */
export type LineDraft = { descrizione: string; um: string; quantita: string; prezzoUnitario: string };

export const parseAmount = (v: string) => {
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Phase 105 — one line in a bottom sheet instead of a row of five tiny inputs
 * (the manual editor and the quote's edit mode on phones). Changes stay in
 * the sheet until Done; Cancel / the scrim / Escape drop them. `units` turns
 * the unit field into a picker; `descTools` puts helpers under the
 * description (the AI "improve" button, catalog matches).
 */
export function LineItemSheet({ open, onOpenChange, initial, isNew, units, onSave, onDelete, descTools }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LineDraft;
  isNew?: boolean;
  units?: readonly string[];
  onSave: (line: LineDraft) => void;
  /** Absent when the line can't be removed (the only line of a chapter). */
  onDelete?: () => void;
  descTools?: (draft: LineDraft, patch: (p: Partial<LineDraft>) => void) => ReactNode;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [draft, setDraft] = useState<LineDraft>(initial);
  // A new line (or another one) each time the sheet opens.
  useEffect(() => { if (open) setDraft(initial); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (p: Partial<LineDraft>) => setDraft((d) => ({ ...d, ...p }));
  const total = parseAmount(draft.quantita) * parseAmount(draft.prezzoUnitario);
  const unitOptions = units && !units.includes(draft.um) && draft.um ? [draft.um, ...units] : units;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isNew ? t("quotes.m.newLine") : t("quotes.m.editLine")}
      footer={
        <>
          {onDelete && (
            <button type="button" className="btn btn-outline-navy secondary line-del" onClick={() => { onDelete(); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4" /> {t("quotes.m.deleteLine")}
            </button>
          )}
          <button type="button" className="btn btn-navy" onClick={() => { onSave(draft); onOpenChange(false); }}>
            {isNew ? t("quotes.m.addLine") : t("quotes.m.done")}
          </button>
        </>
      }
    >
      <div className="line-sheet">
        <div className="field">
          <label htmlFor={`${id}-d`}>{t("dashboard.quoteDetail.colDescription")}</label>
          <textarea id={`${id}-d`} rows={3} value={draft.descrizione} onChange={(e) => patch({ descrizione: e.target.value })} placeholder={t("dashboard.quoteDetail.itemDescriptionPlaceholder")} />
          {descTools?.(draft, patch)}
        </div>
        <div className="line-sheet-nums">
          <div className="field">
            <label htmlFor={`${id}-q`}>{t("dashboard.quoteDetail.colQty")}</label>
            <input id={`${id}-q`} inputMode="decimal" autoComplete="off" value={draft.quantita} onChange={(e) => patch({ quantita: e.target.value.replace(/[^0-9.,]/g, "") })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-u`}>{t("dashboard.quoteDetail.colUnit")}</label>
            {unitOptions ? (
              <select id={`${id}-u`} value={draft.um} onChange={(e) => patch({ um: e.target.value })}>
                {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : (
              <input id={`${id}-u`} autoComplete="off" value={draft.um} onChange={(e) => patch({ um: e.target.value })} />
            )}
          </div>
          <div className="field">
            <label htmlFor={`${id}-p`}>{t("dashboard.quoteDetail.colUnitPrice")}</label>
            <input id={`${id}-p`} inputMode="decimal" autoComplete="off" placeholder="0.00" value={draft.prezzoUnitario} onChange={(e) => patch({ prezzoUnitario: e.target.value.replace(/[^0-9.,]/g, "") })} />
          </div>
        </div>
        <div className="line-sheet-tot">
          <span>{t("dashboard.quoteDetail.colTotal")}</span>
          <b>{formatCad(total)}</b>
        </div>
      </div>
    </BottomSheet>
  );
}
