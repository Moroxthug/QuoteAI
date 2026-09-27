import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { useLocation } from "wouter";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export type SheetAction = {
  label: string;
  icon?: LucideIcon;
  /** Navigate instead of running `onSelect`. */
  href?: string;
  onSelect?: () => void;
  /** Right-aligned quiet text ("PDF", "⌘E"). */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this action. */
  separated?: boolean;
};

/**
 * Phase 100 — the ⋯ menu. Everything that is not a screen's one primary
 * action lives here (docs/MOBILE-RULES.md rule 2): a dropdown on desktop, a
 * bottom sheet of full-width 52 px rows on phones.
 */
export function ActionSheet({
  actions,
  title,
  trigger,
  plain,
  align = "end",
}: {
  /** Falsy entries are skipped, so conditions can sit inline. */
  actions: Array<SheetAction | false | null | undefined>;
  /** Heading of the phone sheet (defaults to "More actions"). */
  title?: string;
  /** Custom trigger; defaults to the round ⋯ button. Must be a single element that accepts ref + onClick. */
  trigger?: ReactNode;
  /** Borderless ⋯ (the top bar). */
  plain?: boolean;
  align?: "start" | "end";
}) {
  const { t } = useLanguage();
  const phone = useMediaQuery("(max-width: 640px)");
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const heading = title ?? t("mobile.moreActions");
  const visible = actions.filter((a): a is SheetAction => !!a);
  if (visible.length === 0) return null;

  const run = (a: SheetAction) => {
    setOpen(false);
    if (a.href) navigate(a.href);
    else a.onSelect?.();
  };

  const button = trigger ?? (
    <button type="button" className={cn("more-btn", plain && "plain")} aria-label={heading}>
      <MoreHorizontal />
    </button>
  );

  if (!phone) {
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-[210px]">
          {visible.map((a, i) => (
            <div key={`${a.label}-${i}`}>
              {a.separated && i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={a.disabled}
                onSelect={() => run(a)}
                className={cn("cursor-pointer gap-2.5 py-2 font-semibold", a.danger && "text-[var(--red)] focus:text-[var(--red)]")}
              >
                {a.icon && <a.icon className="h-4 w-4" />}
                <span className="flex-1">{a.label}</span>
                {a.hint && <span className="text-xs text-[var(--faint)]">{a.hint}</span>}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      {isValidElement(button)
        ? cloneElement(button as ReactElement<Record<string, unknown>>, { onClick: () => setOpen(true), "aria-haspopup": "dialog", "aria-expanded": open })
        : button}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sheet" hideClose aria-describedby={undefined}>
          <div className="sheet-grab" aria-hidden="true" />
          <DialogTitle className="sr-only">{heading}</DialogTitle>
          <div className="asheet-list">
            {visible.map((a, i) => (
              <div key={`${a.label}-${i}`} style={{ display: "contents" }}>
                {a.separated && i > 0 && <div className="asheet-sep" role="separator" />}
                <button type="button" className={cn("asheet-item", a.danger && "danger")} disabled={a.disabled} onClick={() => run(a)}>
                  {a.icon && <a.icon />}
                  <span>{a.label}</span>
                  {a.hint && <span className="asheet-hint">{a.hint}</span>}
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-outline-navy asheet-cancel" onClick={() => setOpen(false)}>
            {t("mobile.cancel")}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
