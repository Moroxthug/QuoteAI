import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

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
>(({ className, children, size = "md", tall, hideClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn("modal", size !== "md" && size, tall && "tall", className)}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="ic-btn modal-x" aria-label="Close">
          <X />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
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
