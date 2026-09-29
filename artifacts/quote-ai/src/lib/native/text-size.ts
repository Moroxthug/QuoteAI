import { App } from "@capacitor/app";
import { TextZoom } from "@capacitor/text-zoom";
import { clampTextZoom } from "./text-zoom-rule";

// Phase 122: the phone's text-size setting, honoured in the app.
//
// Android's WebView already follows it (its textZoom starts at the system
// font scale, up to 200 %), so nothing is done there. iOS's WKWebView ignores
// Dynamic Type, so on iOS the app asks for the preferred size and applies it —
// on opening and on coming back (the setting may have changed meanwhile).
// Every screen is checked up to 2× in qa:visual (`--text=2`); the largest
// accessibility sizes beyond that are capped at 2× — past it a phone screen
// holds a word or two per line and the controls stop fitting at all.

export async function startTextSize(): Promise<void> {
  const apply = async () => {
    const { value } = await TextZoom.getPreferred();
    await TextZoom.set({ value: clampTextZoom(value) });
  };
  await apply().catch(() => {});
  void App.addListener("resume", () => void apply().catch(() => {}));
}
