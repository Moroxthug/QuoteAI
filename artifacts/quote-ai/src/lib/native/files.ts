import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { fileNameFor } from "./links";

// Phase 119: PDFs, receipts and exports in the phone app. A link can't carry
// the sign-in token and the WebView has no downloads, so the app fetches the
// file itself (lib/native/fetch.ts adds the token), keeps it in its cache and
// hands it to the phone's share sheet — save to Files or Drive, open in a PDF
// viewer, send by email or text. The shell (shell.ts) sends every /api file
// link, window.open and blob download here.

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Writes a file into the app's cache and opens the share sheet on it. */
export async function shareBlob(blob: Blob, name: string, title?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // A browser preview of the app bundle: a plain download.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.dataset.nativeHandled = "1";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const path = `shared/${Date.now()}-${name}`;
  const written = await Filesystem.writeFile({ path, data: await base64Of(blob), directory: Directory.Cache, recursive: true });
  try {
    await Share.share({ title: title ?? name, files: [written.uri], dialogTitle: title ?? name });
  } catch (err) {
    // Closing the sheet without choosing is not an error.
    if (!/cancel/i.test(String((err as Error)?.message ?? err))) throw err;
  }
}

/** Fetches a file the app may open (an /api link, a blob: URL) and shares it. */
export async function shareUrl(url: string, name?: string | null): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const blob = await res.blob();
  await shareBlob(blob, fileNameFor(url, name, res.headers.get("content-disposition"), blob.type || res.headers.get("content-type")));
}

/** Old shared files are removed at start so the cache does not grow. */
export async function clearSharedFiles(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Filesystem.rmdir({ path: "shared", directory: Directory.Cache, recursive: true }).catch(() => undefined);
}
