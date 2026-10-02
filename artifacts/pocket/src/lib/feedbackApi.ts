// The feedback server call (routes/feedback.ts) and the list of notes that wait for a connection.
import { Platform } from "react-native";
import { ApiFailure, api } from "./api";
import { OUTBOX_KEY, parseOutbox, queue, thin, type Note } from "./feedback";
import { uploadFile, type UploadFile } from "./jobUpload";
import { kvGet, kvSet } from "./kv";

export type Sent = { ref: string; screenshot: boolean };
export type Result = { ok: true; ref: string } | { ok: false; status: number; message?: string };

export const deviceName = (): string => `${Platform.OS} ${String(Platform.Version)}`;

export async function sendFeedback(n: Omit<Note, "at">, appVersion: string, shot?: UploadFile): Promise<Result> {
  const fields: Record<string, string> = {
    kind: n.kind, note: n.note, replyOk: String(n.replyOk), includeLogs: String(n.includeLogs), screen: n.screen, appVersion, device: deviceName(),
  };
  if (n.markup?.length) fields.markup = JSON.stringify(thin(n.markup));
  if (shot) {
    const r = await uploadFile<Sent>("/api/feedback", "screenshot", shot, fields);
    return r.ok ? { ok: true, ref: r.data.ref } : r;
  }
  // No picture: the same fields as JSON.
  try {
    const r = await api<Sent>("/api/feedback", { method: "POST", body: fields });
    return { ok: true, ref: r.ref };
  } catch (e) {
    return { ok: false, status: e instanceof ApiFailure ? e.status : 0, message: e instanceof ApiFailure ? e.message : undefined };
  }
}

export const feedbackWaiting = {
  read: async (): Promise<Note[]> => parseOutbox(await kvGet(OUTBOX_KEY)),
  add: async (n: Note): Promise<void> => kvSet(OUTBOX_KEY, JSON.stringify(queue(await feedbackWaiting.read(), n))),
  clear: async (): Promise<void> => kvSet(OUTBOX_KEY, null),
};

/** Sends what waited; a note the server refuses is dropped, one that finds no signal stays. Returns how many went. */
export async function flushFeedback(appVersion: string): Promise<number> {
  const list = await feedbackWaiting.read();
  let sent = 0;
  const left: Note[] = [];
  for (const n of list) {
    const r = await sendFeedback(n, appVersion);
    if (r.ok) sent++;
    else if (r.status === 0) left.push(n);
  }
  await kvSet(OUTBOX_KEY, left.length ? JSON.stringify(left) : null);
  return sent;
}
