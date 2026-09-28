import { isNativeApp } from "./native/env";

// Phase 119: one way to hand the person a file (a quote PDF, an invoice, an
// export). On the website: a normal download. In the phone app: the file is
// fetched with the app's sign-in and opened in the phone's share sheet
// (lib/native/files.ts), since the app's WebView has no downloads.

export async function saveFile(url: string, filename?: string): Promise<void> {
  if (isNativeApp) {
    const { shareUrl } = await import("./native/files");
    await shareUrl(url, filename);
    return;
  }
  if (!filename) {
    // The server names it (Content-Disposition: attachment).
    window.location.href = url;
    return;
  }
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Download failed");
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
