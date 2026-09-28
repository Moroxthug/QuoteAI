import { isNativeApp } from "./native/env";
import { shrinkPhoto } from "./image-shrink";

// Phase 119: "take a photo" / "snap a receipt" for both builds. In the phone
// app it opens the native camera — Google's document scanner for receipts and
// documents (lib/native/camera.ts); on the website it clicks the page's own
// file input as before. Either way photos are made smaller on the device
// before they are sent or queued (lib/image-shrink.ts).

export type CaptureMode = "photo" | "document";
export type CaptureSource = "camera" | "gallery";

/** Photos re-encoded to ~2000 px JPEG; PDFs and anything that can't be decoded pass as they are. */
export async function shrinkAll(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (f) => {
      if (!f.type.startsWith("image/")) return f;
      const { blob, fileName } = await shrinkPhoto(f);
      return blob === f ? f : new File([blob], fileName, { type: blob.type || "image/jpeg" });
    }),
  );
}

/**
 * Opens the camera (app) or the file input (website). `onFiles` gets the
 * shrunk files; nothing is called when the person backs out.
 */
export async function openCapture(opts: {
  mode: CaptureMode;
  source?: CaptureSource;
  multiple?: boolean;
  input?: HTMLInputElement | null;
  onFiles: (files: File[]) => void;
  onError?: (err: Error) => void;
}): Promise<void> {
  if (!isNativeApp) {
    opts.input?.click();
    return;
  }
  try {
    const cam = await import("./native/camera");
    try {
      const files = opts.source === "gallery" ? await cam.chooseFromGallery(!!opts.multiple) : await cam.capture(opts.mode);
      opts.onFiles(await shrinkAll(files));
    } catch (err) {
      if (err instanceof cam.CaptureCancelled) return;
      throw err;
    }
  } catch (err) {
    opts.onError?.(err as Error);
  }
}
