import { Capacitor } from "@capacitor/core";
import { Camera, MediaTypeSelection } from "@capacitor/camera";

// Phase 119: the phone's own camera. A job photo is taken with the native
// camera (sized on the phone: long edge 2000 px, JPEG); a receipt or a
// document goes through Google's document scanner on Android, which finds the
// page edges, flattens and crops it — a straight, readable receipt for the
// OCR — and falls back to the camera where the scanner is not there (iPhone,
// a phone without Play services). Each returns Files, ready for the same
// upload (and the same offline outbox) as a file picked in a browser.

export type CaptureMode = "photo" | "document";

/** Thrown when the person closed the camera or the scanner without taking anything. */
export class CaptureCancelled extends Error {
  constructor() {
    super("cancelled");
  }
}

const cancelled = (err: unknown) => /cancel|dismiss|no image|user denied|No photo|canceled/i.test(String((err as Error)?.message ?? err));

async function fileFrom(src: string, name: string): Promise<File> {
  const res = await fetch(src.startsWith("http") || src.startsWith("blob:") || src.startsWith("data:") ? src : Capacitor.convertFileSrc(src));
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");

async function takePhoto(): Promise<File[]> {
  try {
    const r = await Camera.takePhoto({ quality: 82, targetWidth: 2000, targetHeight: 2000, correctOrientation: true, saveToGallery: false });
    const src = r.webPath ?? r.uri;
    if (!src) throw new CaptureCancelled();
    return [await fileFrom(src, `photo-${stamp()}.jpg`)];
  } catch (err) {
    if (err instanceof CaptureCancelled || cancelled(err)) throw new CaptureCancelled();
    throw err;
  }
}

async function scanDocument(): Promise<File[] | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  let DocumentScanner: typeof import("@capacitor-mlkit/document-scanner").DocumentScanner;
  try {
    ({ DocumentScanner } = await import("@capacitor-mlkit/document-scanner"));
    const { available } = await DocumentScanner.isGoogleDocumentScannerModuleAvailable();
    if (!available) {
      // Downloaded by Play services in the background; the camera serves this time.
      void DocumentScanner.installGoogleDocumentScannerModule().catch(() => undefined);
      return null;
    }
  } catch {
    return null;
  }
  try {
    const r = await DocumentScanner.scanDocument({ galleryImportAllowed: true, pageLimit: 4, resultFormats: "JPEG", scannerMode: "FULL" });
    const pages = r.scannedImages ?? [];
    if (pages.length === 0) throw new CaptureCancelled();
    const when = stamp();
    return Promise.all(pages.map((p, i) => fileFrom(p, `scan-${when}${pages.length > 1 ? `-${i + 1}` : ""}.jpg`)));
  } catch (err) {
    if (err instanceof CaptureCancelled || cancelled(err)) throw new CaptureCancelled();
    return null;
  }
}

/** Opens the camera (or the document scanner) and returns what was taken. Throws CaptureCancelled when nothing was. */
export async function capture(mode: CaptureMode): Promise<File[]> {
  if (mode === "document") {
    const scanned = await scanDocument();
    if (scanned) return scanned;
  }
  return takePhoto();
}

/** Picks photos already on the phone (the system photo picker: no storage permission needed). */
export async function chooseFromGallery(multiple: boolean): Promise<File[]> {
  try {
    const r = await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, allowMultipleSelection: multiple, limit: multiple ? 20 : 1, quality: 82, targetWidth: 2000, targetHeight: 2000, correctOrientation: true } as Parameters<typeof Camera.chooseFromGallery>[0]);
    const when = stamp();
    const files = await Promise.all(r.results.map((m, i) => (m.webPath ?? m.uri ? fileFrom((m.webPath ?? m.uri)!, `photo-${when}-${i + 1}.jpg`) : null)));
    const out = files.filter((f): f is File => !!f);
    if (out.length === 0) throw new CaptureCancelled();
    return out;
  } catch (err) {
    if (err instanceof CaptureCancelled || cancelled(err)) throw new CaptureCancelled();
    throw err;
  }
}
