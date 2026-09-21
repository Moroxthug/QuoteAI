import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key);
}

// Bucket names — create these in your Supabase Storage dashboard
const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET ?? "public-assets";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  async searchPublicObject(filePath: string): Promise<{ bucket: string; path: string } | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.storage.from(PUBLIC_BUCKET).list(
      filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "",
      { search: filePath.includes("/") ? filePath.substring(filePath.lastIndexOf("/") + 1) : filePath }
    );
    if (!data || data.length === 0) return null;
    return { bucket: PUBLIC_BUCKET, path: filePath };
  }

  async downloadObject(
    ref: { bucket: string; path: string },
    opts: { cacheTtlSec?: number; isPublic?: boolean } = {}
  ): Promise<Response> {
    const { cacheTtlSec = 3600, isPublic = false } = opts;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path);
    if (error || !data) throw new ObjectNotFoundError();
    const headers: Record<string, string> = {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    return new Response(data, { headers });
  }

  async downloadPrivateObject(objectPath: string): Promise<Response> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).download(objectPath);
    if (error || !data) throw new ObjectNotFoundError();
    return new Response(data, {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const supabase = getSupabaseClient();
    const objectId = randomUUID();
    const path = `uploads/${objectId}`;
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Failed to create signed upload URL: ${error?.message}`);
    return data.signedUrl;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Already normalized paths from Supabase don't need adjustment
    return rawPath;
  }

  async uploadObjectBuffer({
    subPath,
    buffer,
    contentType,
  }: {
    subPath: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<string> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .upload(subPath, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return `/objects/${subPath}`;
  }

  async deleteObjectBuffer(subPath: string): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.storage.from(PRIVATE_BUCKET).remove([subPath]);
  }

  // Phase 72: whole-tenant listing and removal for the data export and the
  // account purge. Supabase list() is one level deep, so walk folders; every
  // tenant file lives under `<kind>/<userId>/…`, so a prefix per kind covers it.
  async listPrivateObjects(prefix: string): Promise<{ path: string; size: number }[]> {
    const supabase = getSupabaseClient();
    const out: { path: string; size: number }[] = [];
    const walk = async (folder: string): Promise<void> => {
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).list(folder, { limit: 1000, offset });
        if (error) throw new Error(`List failed for ${folder}: ${error.message}`);
        if (!data || data.length === 0) return;
        for (const entry of data) {
          const full = folder ? `${folder}/${entry.name}` : entry.name;
          // Folders come back without an id; files carry metadata.
          if (entry.id === null || entry.id === undefined) await walk(full);
          else out.push({ path: full, size: Number((entry.metadata as { size?: number } | null)?.size ?? 0) });
        }
        if (data.length < 1000) return;
        offset += data.length;
      }
    };
    await walk(prefix.replace(/\/$/, ""));
    return out;
  }

  async removePrivateObjects(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const supabase = getSupabaseClient();
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(PRIVATE_BUCKET).remove(paths.slice(i, i + 100));
      if (error) throw new Error(`Remove failed: ${error.message}`);
    }
  }

  async downloadPrivateObjectBuffer(subPath: string): Promise<Buffer> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).download(subPath);
    if (error || !data) throw new ObjectNotFoundError();
    return Buffer.from(await data.arrayBuffer());
  }

  async getPresignedGetURL(subPath: string, ttlSec: number): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(subPath, ttlSec);
    if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message}`);
    return data.signedUrl;
  }

  async uploadPublicObjectBuffer({
    subPath,
    buffer,
    contentType,
  }: {
    subPath: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<string> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage
      .from(PUBLIC_BUCKET)
      .upload(subPath, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Public upload failed: ${error.message}`);
    return subPath;
  }

  getPublicUrl(subPath: string): string {
    const supabase = getSupabaseClient();
    const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(subPath);
    return data.publicUrl;
  }
}
