// Phase 96 — job photo thumbnails.
//
// A gallery of forty 4 MB phone photos loaded them all at full size; the crew
// app shrinks on the device (lib/image-shrink.ts) but the office gallery and
// older photos never did. This makes a small JPEG (longest edge THUMB_EDGE)
// next to the original: on upload when it can, and otherwise lazily the first
// time a thumbnail is asked for, so old photos catch up as they are viewed.
//
// `sharp` is a native module: it is bundled as an external (build.mjs copies it
// and its platform package into dist/node_modules) and loaded here on first
// use. When it is missing or fails to load — a platform without a prebuilt
// binary, a HEIC the prebuilt libvips can't decode — every caller falls back
// to the original, which is exactly what happened before this phase.
import { db, jobPhotosTable, type JobPhoto } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { logger } from "../lib/logger.js";

export const THUMB_EDGE = 480;
const THUMB_QUALITY = 78;
/** Nothing smaller than this is worth a second file: the original is served as its own thumbnail. */
const THUMB_SKIP_BELOW_BYTES = 40 * 1024;
const THUMB_MIME = "image/jpeg";

const objectStorage = new ObjectStorageService();

type SharpModule = typeof import("sharp").default;
let sharpModule: Promise<SharpModule | null> | null = null;

/** The sharp module, or null when it can't load on this platform (logged once). */
function loadSharp(): Promise<SharpModule | null> {
  sharpModule ??= import("sharp")
    .then((m) => m.default)
    .catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, "sharp unavailable — job photos are served without thumbnails");
      return null;
    });
  return sharpModule;
}

/** The thumbnail's storage path, next to the original: `<path>.thumb.jpg`. */
function thumbSubPathFor(fileUrl: string): string {
  return `${fileUrl.replace(/^\/objects\//, "")}.thumb.jpg`;
}

/**
 * A JPEG at most THUMB_EDGE on its longest side, EXIF orientation applied,
 * or null when the image can't be decoded or is already small.
 */
async function makeThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  if (!mimeType.startsWith("image/")) return null;
  if (buffer.length < THUMB_SKIP_BELOW_BYTES) return null;
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    const out = await sharp(buffer, { failOn: "none", limitInputPixels: 80_000_000 })
      .rotate()
      .resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
      .toBuffer();
    // A "thumbnail" bigger than its original (a tiny PNG, say) helps nobody.
    return out.length < buffer.length ? out : null;
  } catch (err) {
    logger.info({ err: err instanceof Error ? err.message : String(err), mimeType }, "Thumbnail not generated");
    return null;
  }
}

/** Makes and stores the thumbnail for freshly uploaded bytes; returns its `/objects/...` url or null. */
export async function storeThumbnail(fileUrl: string, buffer: Buffer, mimeType: string): Promise<string | null> {
  const thumb = await makeThumbnail(buffer, mimeType);
  if (!thumb) return null;
  try {
    return await objectStorage.uploadObjectBuffer({ subPath: thumbSubPathFor(fileUrl), buffer: thumb, contentType: THUMB_MIME });
  } catch (err) {
    logger.warn({ err }, "Thumbnail upload failed (serving the original)");
    return null;
  }
}

export type PhotoBytes = { body: Response; isThumb: boolean };

/**
 * The thumbnail as a streamable Response, made and stored on first request
 * when the row doesn't have one yet; the original when none can be made.
 * Throws ObjectNotFoundError only when the original itself is missing.
 */
export async function thumbnailOrOriginal(photo: JobPhoto): Promise<PhotoBytes> {
  if (photo.thumbUrl) {
    try {
      return { body: await objectStorage.downloadPrivateObject(photo.thumbUrl.replace(/^\/objects\//, "")), isThumb: true };
    } catch (err) {
      if (!(err instanceof ObjectNotFoundError)) throw err;
      // The row says there is one but the object is gone: fall through and remake it.
    }
  }
  const originalPath = photo.fileUrl.replace(/^\/objects\//, "");
  const original = await objectStorage.downloadPrivateObjectBuffer(originalPath);
  const thumb = await makeThumbnail(original, photo.mimeType);
  if (thumb) {
    try {
      const thumbUrl = await objectStorage.uploadObjectBuffer({ subPath: thumbSubPathFor(photo.fileUrl), buffer: thumb, contentType: THUMB_MIME });
      await db.update(jobPhotosTable).set({ thumbUrl }).where(eq(jobPhotosTable.id, photo.id));
      return { body: new Response(new Uint8Array(thumb), { headers: { "Content-Type": THUMB_MIME, "Cache-Control": "private, max-age=3600" } }), isThumb: true };
    } catch (err) {
      logger.warn({ err, photoId: photo.id }, "Lazy thumbnail store failed (serving it once, unstored)");
      return { body: new Response(new Uint8Array(thumb), { headers: { "Content-Type": THUMB_MIME, "Cache-Control": "private, max-age=3600" } }), isThumb: true };
    }
  }
  return {
    body: new Response(new Uint8Array(original), { headers: { "Content-Type": photo.mimeType || "application/octet-stream", "Cache-Control": "private, max-age=3600" } }),
    isThumb: false,
  };
}

/** Removes the thumbnail object, if the row has one. Never throws. */
export async function deleteThumbnail(photo: Pick<JobPhoto, "thumbUrl">): Promise<void> {
  if (!photo.thumbUrl) return;
  try {
    await objectStorage.deleteObjectBuffer(photo.thumbUrl.replace(/^\/objects\//, ""));
  } catch (err) {
    logger.warn({ err }, "Thumbnail delete failed (ignoring)");
  }
}
