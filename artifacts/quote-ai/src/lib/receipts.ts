import { jobsApi } from "./jobs-api";
import { runOrQueue } from "./offline/outbox";
import { shrinkAll } from "./capture";

// Phase 119: a receipt snapped on site is made smaller on the phone and sent
// to the OCR; with no signal it waits in the outbox (kind `job.scanReceipt`)
// and is read when the phone is back online, once — the replay carries the
// outbox row's id as its Idempotency-Key.
export async function scanOrQueueReceipt(file: File, jobId: string | null, label: string) {
  const [small] = await shrinkAll([file]);
  const f = small ?? file;
  return runOrQueue({ kind: "job.scanReceipt", jobId, file: f, fileName: f.name }, { scope: jobId ?? "receipts", label }, (clientRef) => jobsApi.scanReceipt(f, jobId ?? undefined, { idempotencyKey: clientRef }));
}
