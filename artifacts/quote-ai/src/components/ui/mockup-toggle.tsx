import { cn } from "@/lib/utils";

/**
 * Mockup-vocabulary toggle switch (`.tgl` / `.tgl.on` from
 * docs/mockups/dashboard-mockup.html, Settings view). Replaces shadcn
 * `Switch` wherever a page has been reskinned to the mockup system
 * (Phase 45 — docs/PIXEL-REDESIGN-PLAN.md). Plain controlled button,
 * toggled by the caller — not a form primitive.
 */
export function MockupToggle({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-pressed={checked}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn("tgl", checked && "on", className)}
    />
  );
}
