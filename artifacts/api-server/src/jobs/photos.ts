// Job photo storage shared by the gallery upload route and the Phase 78
// photo → assistant path: same bucket layout, same row, same replay rule.
import multer from "multer";
import { randomUUID } from "node:crypto";
import { db, jobPhotosTable, milestonesTable, type JobPhoto } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage.js";

const objectStorage = new ObjectStorageService();

const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Use a JPG, PNG, WEBP or HEIC photo.`));
  },
});

export function serializePhoto(p: JobPhoto) {
  return {
    id: p.id,
    projectId: p.projectId,
    milestoneId: p.milestoneId,
    fileName: p.fileName,
    fileSize: p.fileSize,
    mimeType: p.mimeType,
    caption: p.caption,
    sortOrder: p.sortOrder,
    sharedAt: p.sharedAt ? p.sharedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export type StoredPhoto = { photo: JobPhoto; replayed: boolean };

/**
 * Uploads the bytes and inserts the gallery row. A `clientRef` the company has
 * already used returns that row instead (the offline outbox re-posts until it
 * gets an answer). Throws "Milestone not found" for a foreign milestone id.
 */
export async function storeJobPhoto(params: {
  userId: string;
  projectId: string;
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number };
  caption?: string;
  milestoneId?: string | null;
  clientRef?: string | null;
}): Promise<StoredPhoto> {
  const clientRef = params.clientRef && /^[0-9a-f-]{36}$/i.test(params.clientRef) ? params.clientRef : null;
  if (clientRef) {
    const [replayed] = await db.select().from(jobPhotosTable).where(and(eq(jobPhotosTable.userId, params.userId), eq(jobPhotosTable.clientRef, clientRef)));
    if (replayed) return { photo: replayed, replayed: true };
  }
  const milestoneId = params.milestoneId || null;
  if (milestoneId) {
    const [m] = await db.select({ id: milestonesTable.id }).from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.projectId, params.projectId)));
    if (!m) throw new Error("Milestone not found");
  }
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[params.file.mimetype] ?? "bin";
  const subPath = `job-photos/${params.userId}/${params.projectId}/${randomUUID()}.${ext}`;
  const fileUrl = await objectStorage.uploadObjectBuffer({ subPath, buffer: params.file.buffer, contentType: params.file.mimetype });
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(jobPhotosTable).where(eq(jobPhotosTable.projectId, params.projectId));
  const [photo] = await db
    .insert(jobPhotosTable)
    .values({
      userId: params.userId,
      projectId: params.projectId,
      milestoneId,
      fileName: params.file.originalname,
      fileSize: params.file.size,
      mimeType: params.file.mimetype,
      fileUrl,
      caption: (params.caption ?? "").slice(0, 500),
      sortOrder: Number(count ?? 0),
      clientRef,
    })
    .returning();
  return { photo: photo!, replayed: false };
}
