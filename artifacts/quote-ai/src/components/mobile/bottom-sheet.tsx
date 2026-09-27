import type { ReactNode } from "react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, type DialogSize } from "@/components/ui/dialog";

/**
 * Phase 100 — filters, options and pickers. A centred modal on desktop, a
 * sheet docked to the bottom on phones (the `.modal` phone rule), with a grab
 * handle and room for the home indicator. Radix keeps the focus trap, Escape
 * and scrim dismissal.
 *
 *   <BottomSheet open={o} onOpenChange={setO} title="Filter" footer={<button className="btn btn-navy">Show 12</button>}>
 *     …fields…
 *   </BottomSheet>
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  flush,
  noAutoFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  /** Body without padding (a list that runs edge to edge). */
  flush?: boolean;
  /** Phase 111: open without focusing the first field (a sheet whose first field would raise the phone keyboard over what it is for, e.g. a signature pad). */
  noAutoFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size} className="sheet" {...(noAutoFocus ? { onOpenAutoFocus: (e: Event) => e.preventDefault() } : {})} {...(description ? {} : { "aria-describedby": undefined })}>
        <div className="sheet-grab" aria-hidden="true" />
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className={flush ? "flush" : undefined}>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
