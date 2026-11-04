// Adding a photo to a job: the camera (or, on the web, the file chooser), then the upload. Used by the quick action and the Photos tab.
// On mobile data or with no signal the photo waits for Wi-Fi on the phone ("queued", SystemStates "Photos waiting for Wi-Fi").
import { takePhoto } from "./media";
import { addJobPhotoFile } from "./outbox";

export type AddPhotoResult = "ok" | "queued" | "cancelled" | "denied" | "unavailable" | "failed";

export async function addJobPhoto(jobId: string, jobName: string): Promise<AddPhotoResult> {
  const r = await takePhoto("job-photo");
  if (!r.ok) return r.problem;
  if (!r.files.length) return "cancelled";
  const up = await addJobPhotoFile(jobId, jobName, r.files[0]!);
  return !up.ok ? "failed" : up.queued ? "queued" : "ok";
}
