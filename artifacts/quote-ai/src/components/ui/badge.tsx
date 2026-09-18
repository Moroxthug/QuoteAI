import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // @replit
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate ",
  {
    variants: {
      variant: {
        default:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          // @replit no hover because we use hover-elevate
          "border-transparent bg-secondary text-secondary-foreground",
          // @replit shadow-xs" - use badge outline variable
        outline: "text-foreground border [border-color:var(--badge-outline)]",
        // Tinted status "chips" (docs/DESIGN-SYSTEM.md) — fixed brand/semantic colors,
        // not theme-tokens, so they read the same in light and dark mode.
        "chip-green": "border-transparent bg-[var(--qa-green-t)] text-[var(--qa-green-dark)]",
        "chip-teal": "border-transparent bg-[var(--qa-teal-t)] text-[var(--qa-teal-dark)]",
        "chip-yellow": "border-transparent bg-[var(--qa-yellow-t)] text-[var(--qa-yellow-dark)]",
        "chip-red": "border-transparent bg-[var(--qa-red-t)] text-[var(--qa-red)]",
        "chip-purple": "border-transparent bg-[var(--qa-purple-t)] text-[var(--qa-purple)]",
        "chip-grey": "border-transparent bg-[var(--qa-grey-t)] text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
