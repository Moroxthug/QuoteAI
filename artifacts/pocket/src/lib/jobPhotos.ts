// Adding a photo to a job: the camera (or, on the web, the file chooser), then the upload. Used by the quick action and the Photos tab.
import { takePhoto } from "./media";
import { uploadFile } from "./jobUpload";

export type AddPhotoResult = "ok" | "cancelled" | "denied" | "unavailable" | "failed";

export async function addJobPhoto(jobId: string): Promise<AddPhotoResult> {
  const r = await takePhoto("job-photo");
  if (!r.ok) return r.problem;
  if (!r.files.length) return "cancelled";
  const up = await uploadFile(`/api/jobs/${encodeURIComponent(jobId)}/photos`, "file", r.files[0]!);
  return up.ok ? "ok" : "failed";
}
