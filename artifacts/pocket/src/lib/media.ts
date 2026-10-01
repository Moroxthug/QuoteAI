// The camera and the photo library, for what the Job screen sends (job photos, receipts). Native modules the installed dev client may
// not have yet, so each is loaded on its own and the screen gets a plain "unavailable" instead of a crash. On the web there is no
// camera permission, so the camera falls back to the file chooser.
import { Platform } from "react-native";
import type { UploadFile } from "./jobUpload";

export type PickResult = { ok: true; files: UploadFile[] } | { ok: false; problem: "unavailable" | "denied" | "failed" };

function toFiles(assets: { uri: string; mimeType?: string | null; fileName?: string | null }[], stem: string): UploadFile[] {
  return assets.map((x, i) => {
    const type = x.mimeType && x.mimeType.startsWith("image/") ? x.mimeType : "image/jpeg";
    const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1] ?? "jpg";
    return { uri: x.uri, name: x.fileName && /\.\w+$/.test(x.fileName) ? x.fileName : `${stem}-${i + 1}.${ext}`, type };
  });
}

async function picker() {
  try { return await import("expo-image-picker"); } catch { return null; }
}

export async function takePhoto(stem = "photo"): Promise<PickResult> {
  const p = await picker();
  if (!p) return { ok: false, problem: "unavailable" };
  try {
    if (Platform.OS === "web") {
      const r = await p.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      return r.canceled ? { ok: true, files: [] } : { ok: true, files: toFiles(r.assets, stem) };
    }
    const perm = await p.requestCameraPermissionsAsync();
    if (!perm.granted) return { ok: false, problem: "denied" };
    const r = await p.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    return r.canceled ? { ok: true, files: [] } : { ok: true, files: toFiles(r.assets, stem) };
  } catch {
    return { ok: false, problem: "failed" };
  }
}

export async function choosePhotos(limit: number, stem = "photo"): Promise<PickResult> {
  const p = await picker();
  if (!p) return { ok: false, problem: "unavailable" };
  try {
    if (Platform.OS !== "web") {
      const perm = await p.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return { ok: false, problem: "denied" };
    }
    const r = await p.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 0.8 });
    return r.canceled ? { ok: true, files: [] } : { ok: true, files: toFiles(r.assets.slice(0, limit), stem) };
  } catch {
    return { ok: false, problem: "failed" };
  }
}
