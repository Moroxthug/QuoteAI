import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * Phase 120 — the success moment (docs/APP-DESIGN.md §4: sent, paid,
 * approved, clocked in): the button that did it shows a check for 900 ms,
 * with the phone's success haptic, and then whatever comes next happens
 * (the sheet closes, the screen moves on). Nothing counts up, nothing bursts.
 *
 *   const done = useDone();
 *   onSuccess: () => done.flash(() => onOpenChange(false))
 *   <button className={cn("btn", done.on && "is-done")} disabled={done.on}>{done.on ? <DoneCheck /> : <Send />} Send</button>
 */
export function useDone(): { on: boolean; flash: (then?: () => void) => void } {
  const [on, setOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = useCallback((then?: () => void) => {
    haptic("success");
    setOn(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setOn(false);
      then?.();
    }, 900);
  }, []);
  return { on, flash };
}

export function DoneCheck() {
  return <Check className="done-check h-4 w-4" aria-hidden="true" />;
}
