import { MoreHorizontal } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { ActionSheet, type SheetAction } from "./action-sheet";

/**
 * Phase 106 — a row's own ⋯, phones only. Wider screens show a row's small
 * buttons on hover (`.hover-act`); a phone has no hover and no room for
 * three icons next to the text, so the same actions open as a sheet from
 * one button at the end of the row. Pair it with `hide-phone` on the
 * desktop buttons.
 */
export function RowMore({ actions, label, open, onOpenChange }: { actions: Array<SheetAction | false | null | undefined>; label?: string; /** Phase 120: a long press on the row opens it too. */ open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { t } = useLanguage();
  const heading = label ?? t("mobile.moreActions");
  if (!actions.some(Boolean)) return null;
  return (
    <span className="show-phone row-more">
      <ActionSheet
        actions={actions}
        title={heading}
        open={open}
        onOpenChange={onOpenChange}
        trigger={<button type="button" className="ic-btn" aria-label={heading}><MoreHorizontal /></button>}
      />
    </span>
  );
}
