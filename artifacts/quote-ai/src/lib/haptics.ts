import { isNativeApp } from "@/lib/native/env";

// Phase 120: haptics on the moments that matter (docs/APP-DESIGN.md §4) and
// nowhere else — sent, signed, paid, approved, clocked in (success); a
// destructive confirm (warning); switching tab (selection); the pull-to-
// refresh threshold and the mic starting or stopping (light); a swiped row
// committing (tick). Phone app only: the website stays still, and in its
// bundle `isNativeApp` is the constant false, so none of this ships there.

export type Haptic = "success" | "warning" | "selection" | "light" | "tick";

export function haptic(kind: Haptic): void {
  if (!isNativeApp) return;
  void import("@capacitor/haptics")
    .then(async ({ Haptics, ImpactStyle, NotificationType }) => {
      if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
      else if (kind === "warning") await Haptics.notification({ type: NotificationType.Warning });
      else if (kind === "selection") {
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
      } else await Haptics.impact({ style: kind === "tick" ? ImpactStyle.Medium : ImpactStyle.Light });
    })
    .catch(() => {});
}
