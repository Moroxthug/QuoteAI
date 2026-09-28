import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLanguage } from "@/i18n/LanguageContext"
import { haptic } from "@/lib/haptics"

/**
 * Radix Dialog wrapped in the locked `.modal*` vocabulary
 * (mockup-system.css, "MODALS (Phase 60)"). Radix keeps the focus trap,
 * portal, escape/scrim dismissal and `data-state` attributes the CSS
 * animates on; the shell, header, body and footer are pure locked classes.
 *
 *   <Dialog>
 *     <DialogContent size="lg">
 *       <DialogHeader><DialogTitle/><DialogDescription/></DialogHeader>
 *       <DialogBody>…form…</DialogBody>
 *       <DialogFooter>…buttons…</DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 */

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn("modal-scrim", className)} {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export type DialogSize = "sm" | "md" | "lg" | "xl" | "xxl"

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Panel max-width: sm 420 · md 520 (default) · lg 640 · xl 760 · xxl 920. */
    size?: DialogSize
    /** Fixed-height panel (iframes, scrolling lists). */
    tall?: boolean
    /** Drop the corner close button (e.g. the command palette). */
    hideClose?: boolean
  }
>(({ className, children, size = "md", tall, hideClose, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const { t } = useLanguage()
  // Phase 101: Radix hands focus back to a <DialogTrigger> on close; a dialog
  // opened from state (the phone More / New sheets, ActionSheet, most of the
  // app's dialogs) has none, so focus fell to <body>. Remember whatever had
  // focus when it opened and go back there instead.
  const opener = React.useRef<HTMLElement | null>(null)
  // Phase 120: on a phone every dialog is a sheet, and a sheet follows the finger
  // (lib/motion/sheet-drag.ts, loaded on phones only; ready well before a thumb is).
  const detach = React.useRef<(() => void) | null>(null)
  const setRef = React.useCallback((el: HTMLDivElement | null) => {
    detach.current?.()
    detach.current = null
    if (el && !el.classList.contains("side") && window.matchMedia("(max-width: 640px)").matches) {
      let gone = false
      detach.current = () => { gone = true }
      void import("@/lib/motion/sheet-drag").then((m) => {
        if (!gone && el.isConnected) detach.current = m.attachSheetDrag(el)
      }).catch(() => {})
    }
    // A destructive confirm (its action is .btn-red) arrives with the warning haptic.
    if (el?.querySelector(".btn-red")) haptic("warning")
    if (typeof ref === "function") ref(el)
    else if (ref) ref.current = el
  }, [ref])
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={setRef}
      className={cn("modal", size !== "md" && size, tall && "tall", className)}
      onOpenAutoFocus={(e) => {
        opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
        onOpenAutoFocus?.(e)
      }}
      onCloseAutoFocus={(e) => {
        onCloseAutoFocus?.(e)
        const el = opener.current
        if (e.defaultPrevented || !el?.isConnected) return
        e.preventDefault()
        el.focus()
      }}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="ic-btn modal-x" aria-label={t("a11y.close")}>
          <X />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("modal-head", className)} {...props}>
    <div className="txt">{children}</div>
  </div>
)
DialogHeader.displayName = "DialogHeader"

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("modal-body", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("modal-foot", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} asChild>
    <h2 className={className} {...props} />
  </DialogPrimitive.Title>
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("sub", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
