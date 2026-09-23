// Phase 86: a phone photo is 3-8 MB and the site often has one bar of signal.
// Anything larger than the job gallery ever displays is re-encoded as a
// ~2000 px JPEG before it is sent or queued. If the browser cannot decode the
// file (HEIC outside Safari, a corrupt image) the original goes as-is — the
// server accepts it and a slow upload beats a lost photo.

const MAX_EDGE = 2000;
const SKIP_BELOW_BYTES = 1_200_000;

export async function shrinkPhoto(file: File): Promise<{ blob: Blob; fileName: string }> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return { blob: file, fileName: file.name };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) {
      bitmap.close();
      return { blob: file, fileName: file.name };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return { blob: file, fileName: file.name };
    return { blob, fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch {
    return { blob: file, fileName: file.name };
  }
}
