import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { ForegroundPush } from "./push";

// Phase 119: a notification that arrives while the app is open is shown as a
// toast (the phone shows nothing itself then), with Open when it has a screen.
export function showForegroundPush(p: ForegroundPush, go: (path: string) => void, openLabel: string): void {
  toast({
    title: p.title,
    description: p.body || undefined,
    action: p.link ? <ToastAction altText={openLabel} onClick={() => go(p.link!)}>{openLabel}</ToastAction> : undefined,
  });
}
