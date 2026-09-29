import { App } from "@capacitor/app";
import { TextZoom } from "@capacitor/text-zoom";
import { clampTextZoom } from "./text-zoom-rule";
import { textScaleFactor } from "@/lib/text-scale";

// Phase 122: the phone's text-size setting, honoured in the app.
//
// Android's WebView already follows it (its textZoom starts at the system
// font scale, up to 200 %), so nothing is done there. iOS's WKWebView ignores
// Dynamic Type, so on iOS the app asks for the preferred size and applies it —
// on opening and on coming back (the setting may have changed meanwhile).
// Every screen is checked up to 2× in qa:visual (`--text=2`); the largest
// accessibility sizes beyond that are capped at 2× — past it a phone screen
// holds a word or two per line and the controls stop fitting at all.
//
// Pocket (Phase 149): Settings → Display → Text size multiplies it (on both
// platforms, then, when it isn't the default).

async function apply(): Promise<void> {
  const f = textScaleFactor();
  const { value } = await TextZoom.getPreferred();
  await TextZoom.set({ value: clampTextZoom(value * f) });
}

export async function startTextSize(): Promise<void> {
  await apply().catch(() => {});
  void App.addListener("resume", () => void apply().catch(() => {}));
}

/** After Settings → Text size changes. */
export async function reapplyTextSize(): Promise<void> {
  await apply().catch(() => {});
}
