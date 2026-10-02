// Documents: the server calls (routes/documents.ts for the overview; a file goes to routes/costs.ts, which reads it and files it under the job).
import { Platform } from "react-native";
import { api } from "./api";
import type { DocumentsOverview } from "./documents";
import { choosePhotos, type PickResult } from "./media";
import { uploadFile, type UploadFile } from "./jobUpload";

export const documentsApi = {
  overview: () => api<DocumentsOverview>("/api/documents/overview"),
  /** The AI reads the file and a cost waiting for review is made from it, on the job when one is given. */
  upload: (file: UploadFile, projectId?: string | null) => uploadFile<unknown>("/api/costs/receipts", "file", file, projectId ? { projectId } : {}),
};

/**
 * "Choose a file": on the web a PDF or a photo from the computer; on the phone the photo library (a PDF picker is a native module this build
 * does not have yet, so a PDF has to come from the web app for now).
 */
export async function chooseDocument(): Promise<PickResult> {
  if (Platform.OS !== "web") return choosePhotos(1, "scan");
  return new Promise((resolve) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/pdf,image/jpeg,image/png,image/webp";
      input.onchange = () => {
        const f = input.files?.[0];
        resolve(f ? { ok: true, files: [{ uri: URL.createObjectURL(f), name: f.name, type: f.type }] } : { ok: true, files: [] });
      };
      input.oncancel = () => resolve({ ok: true, files: [] });
      input.click();
    } catch {
      resolve({ ok: false, problem: "failed" });
    }
  });
}
