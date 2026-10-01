// The crew's calls (routes/worker-time.ts, team.ts): the worker's link token rides in the path. With no signal an action is kept on the phone and sent
// when there is signal, with the moment it really happened (`at`) and a `clientRef`, so the server never records it twice (see lib/crewOutbox.ts).
import { api, ApiFailure } from "./api";
import type { CrewAllowance, CrewEntry, CrewReport, CrewTask, CrewView } from "./crew";
import { uploadFile, type UploadFile } from "./jobUpload";

const base = (path: string) => `/api/t/${encodeURIComponent(path)}`;

export type Pairing = { token: string; workerName: string; companyName: string };
export type PairingPreview = { workerName: string; companyName: string };

export const crewApi = {
  preview: (code: string) => api<PairingPreview>(`/api/crew/pair/${encodeURIComponent(code)}`),
  pair: (code: string) => api<Pairing>("/api/crew/pair", { method: "POST", body: { code } }),
  requestLink: (token: string) => api<{ success: boolean }>("/api/crew/request-link", { method: "POST", body: { token } }),

  view: (path: string) => api<CrewView>(base(path)),
  clockIn: (path: string, body: { projectId: string; milestoneId?: string | null; lat?: number; lng?: number; at?: string; clientRef?: string }) =>
    api<{ entry: CrewEntry }>(`${base(path)}/clock-in`, { method: "POST", body }),
  clockOut: (path: string, body: { lat?: number; lng?: number; at?: string; entryId?: string; entryClientRef?: string }) =>
    api<{ entry: CrewEntry }>(`${base(path)}/clock-out`, { method: "POST", body }),
  hours: (path: string, body: { projectId: string; date: string; hours: number; note?: string; clientRef?: string }) =>
    api<{ entry: CrewEntry }>(`${base(path)}/entries`, { method: "POST", body }),
  task: (path: string, taskId: string, status: "todo" | "in_progress" | "done") =>
    api<{ task: { id: string; status: string } }>(`${base(path)}/tasks/${encodeURIComponent(taskId)}`, { method: "POST", body: { status } }),
  addTask: (path: string, projectId: string, title: string) =>
    api<{ task: CrewTask }>(`${base(path)}/jobs/${encodeURIComponent(projectId)}/tasks`, { method: "POST", body: { title } }),
  location: (path: string, lat: number, lng: number) => api<unknown>(`${base(path)}/location`, { method: "POST", body: { lat, lng } }),
  stopLocation: (path: string) => api<unknown>(`${base(path)}/location/stop`, { method: "POST", body: {} }),
  seen: (path: string, upTo: string) => api<unknown>(`${base(path)}/seen`, { method: "POST", body: { upTo } }),
  allowance: (path: string, body: { kind: "mileage" | "per_diem"; quantity: number; date: string; projectId?: string | null; note?: string; clientRef?: string }) =>
    api<{ allowance: { id: string; status: string } }>(`${base(path)}/allowances`, { method: "POST", body }),
  deleteAllowance: (path: string, id: string) => api<unknown>(`${base(path)}/allowances/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** A field report, with a photo when there is one. */
  report: async (path: string, body: { projectId: string; kind: "note" | "blocker" | "materials"; body: string; materialsCents?: number; clientRef?: string }, photo?: UploadFile | null): Promise<{ report: CrewReport }> => {
    const fields: Record<string, string> = { projectId: body.projectId, kind: body.kind, body: body.body };
    if (body.materialsCents != null) fields.materialsCents = String(body.materialsCents);
    if (body.clientRef) fields.clientRef = body.clientRef;
    if (photo) {
      const r = await uploadFile<{ report: CrewReport }>(`${base(path)}/reports`, "file", photo, fields);
      if (!r.ok) throw new ApiFailure(r.status, undefined, r.message ?? "upload failed");
      return r.data;
    }
    return api<{ report: CrewReport }>(`${base(path)}/reports`, { method: "POST", body: fields.materialsCents ? { ...body } : { ...body } });
  },
};

export type { CrewAllowance };
