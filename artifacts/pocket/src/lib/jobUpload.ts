// A file sent to the server as a multipart form (job photos, receipts): the phone sends {uri, name, type}, the web a Blob.
import { Platform } from "react-native";
import { API_ORIGIN } from "./session";

export type UploadFile = { uri: string; name: string; type: string };
export type UploadResult<T> = { ok: true; data: T } | { ok: false; status: number; message?: string };

export async function uploadFile<T>(path: string, field: string, file: UploadFile, fields: Record<string, string> = {}): Promise<UploadResult<T>> {
  try {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    if (Platform.OS === "web") {
      const blob = await (await fetch(file.uri)).blob();
      form.append(field, new Blob([blob], { type: file.type }), file.name);
    } else {
      form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    }
    let res: Response;
    try {
      res = await fetch(`${API_ORIGIN}${path}`, { method: "POST", body: form, headers: { accept: "application/json" } });
    } catch {
      return { ok: false, status: 0 };
    }
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
    if (!res.ok) return { ok: false, status: res.status, message: typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : undefined };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0 };
  }
}
