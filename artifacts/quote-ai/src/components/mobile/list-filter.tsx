import { useState, type ReactNode } from "react";
import { Check, ListFilter, Search, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./bottom-sheet";

export type ListFilterOption<T extends string> = { id: T; label: string; count?: number };

/**
 * Phase 107 — a phone list's head (the quotes list's, Phase 105, made
 * shared): the search stays at the top while the list scrolls, the filter is
 * a sheet with counts, and the one that's on shows as a removable chip. The
 * first option is "all" (no chip). Without `filters` it is the search alone.
 */
export function PhoneListBar<T extends string>({
  search,
  onSearch,
  placeholder,
  filters,
  value,
  onChange,
  label,
  extra,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  filters?: ListFilterOption<T>[];
  value?: T;
  onChange?: (v: T) => void;
  /** Names the filter button and the sheet (defaults to "Filter"). */
  label?: string;
  /** More buttons after the filter (a view switch). */
  extra?: ReactNode;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const heading = label ?? t("quotes.m.filter");
  const all = filters?.[0]?.id;
  const active = filters?.find((f) => f.id === value && f.id !== all);
  return (
    <div className="toolbar qlist-bar">
      <label className="search sm grow">
        <Search className="h-4 w-4" />
        <input type="search" enterKeyHint="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {filters && (
        <button type="button" className={cn("more-btn", active && "on")} onClick={() => setOpen(true)} aria-label={heading} aria-haspopup="dialog">
          <ListFilter />
        </button>
      )}
      {extra}
      {active && all !== undefined && (
        <div className="qlist-active">
          <button type="button" className="chip chip-navy-soft" onClick={() => onChange?.(all)} aria-label={t("quotes.m.clearFilter").replace("{filter}", active.label)}>
            {active.label} <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {filters && (
        <BottomSheet open={open} onOpenChange={setOpen} title={heading} flush>
          <div className="asheet-list" role="radiogroup" aria-label={heading}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={value === f.id}
                className="asheet-item"
                onClick={() => { onChange?.(f.id); setOpen(false); }}
              >
                <span>{f.label}</span>
                {f.count !== undefined && <span className="asheet-hint">{f.count}</span>}
                {value === f.id ? <Check /> : <span style={{ width: 19 }} />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
