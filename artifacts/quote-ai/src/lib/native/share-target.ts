import { Capacitor } from "@capacitor/core";
import { CapacitorShareTarget } from "@capgo/capacitor-share-target";

// Phase 119: "Share → QuoteAI" from another app (a photo from the gallery, a
// supplier's PDF invoice, a message with a job description). Android hands
// the files over as copies in the app's cache; they come back here as Files.
// (iOS needs a share extension — native code, decided later.)

export type SharedIn = { files: File[]; text: string };

async function fileOf(f: { uri: string; name: string; mimeType: string }): Promise<File | null> {
  try {
    const src = /^(https?|blob|data):/.test(f.uri) ? f.uri : Capacitor.convertFileSrc(f.uri.startsWith("/") ? `file://${f.uri}` : f.uri);
    const blob = await (await fetch(src)).blob();
    return new File([blob], f.name || "shared", { type: f.mimeType || blob.type });
  } catch {
    return null;
  }
}

/** Accepted: photos and PDFs. Anything else is left out. */
function acceptedType(type: string): boolean {
  return type.startsWith("image/") || type === "application/pdf";
}

export async function startShareTarget(onShared: (s: SharedIn) => void): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  await CapacitorShareTarget.addListener("shareReceived", (e) => {
    void (async () => {
      const files = (await Promise.all((e.files ?? []).filter((f) => acceptedType(f.mimeType ?? "")).slice(0, 10).map(fileOf))).filter((f): f is File => !!f);
      const text = [e.title, ...(e.texts ?? [])].filter((s) => typeof s === "string" && s.trim()).join("\n").trim();
      if (files.length || text) onShared({ files, text });
    })();
  });
}
