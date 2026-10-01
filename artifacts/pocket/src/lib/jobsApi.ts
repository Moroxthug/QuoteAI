// The Jobs screens' server calls (routes/jobs.ts, crew.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { JobDetail } from "./jobDetail";
import type { JobsResponse } from "./jobs";
import type { setupBody } from "./jobSetup";

export type CrewDay = {
  enabled: boolean;
  requiredPlan?: string;
  day?: string;
  jobs?: { jobId: string | null; jobName: string | null; address: string | null; crew: { blockId: string; workerId: string | null; workerName: string | null; startsAt: string; endsAt: string; allDay: boolean; title: string; clockedInAt: string | null; clockedInElsewhere: boolean }[] }[];
  clockedIn?: { entryId: string; workerId: string; workerName: string | null; projectId: string; projectName: string | null; since: string }[];
  blockers?: { id: string; projectId: string; projectName: string | null; authorName: string | null; body: string; createdAt: string }[];
};

export type FieldReport = { id: string; projectId: string; projectName: string | null; milestoneId: string | null; workerId: string | null; authorName: string | null; kind: "note" | "blocker" | "materials"; body: string; photoId: string | null; materialsCents: number | null; resolvedAt: string | null; resolvedByName: string | null; resolutionNote: string | null; createdAt: string };

export type Permit = { id: string; projectId: string; kind: string; title: string; authority: string; referenceNumber: string; url: string | null; status: "needed" | "applied" | "issued" | "closed" | "not_required"; open: boolean; appliedAt: string | null; issuedAt: string | null; inspectionAt: string | null; expiresAt: string | null; closedAt: string | null; notes: string };

export type JobNote = { id: string; projectId: string; milestoneId: string | null; photoId: string | null; body: string; source: string; authorName: string | null; createdAt: string };

export type SchedBlock = { id: string; projectId: string | null; projectName: string | null; projectAddress: string | null; milestoneId: string | null; milestoneTitle: string | null; collaboratorId: string | null; collaboratorName: string | null; title: string; label: string | null; startsAt: string; endsAt: string; allDay: boolean; notes: string; conflicts: string[]; updatedAt: string };

export type JobPhoto = { id: string; projectId: string; milestoneId: string | null; fileName: string; fileSize: number; mimeType: string; caption: string; sortOrder: number; sharedAt: string | null; createdAt: string; hasThumb: boolean };

export const jobsApi = {
  list: () => api<JobsResponse>("/api/jobs"),
  get: (id: string) => api<JobDetail>(`/api/jobs/${encodeURIComponent(id)}`),
  /** A job from a quote (the same one again when the quote already has one) or a blank one. */
  create: (body: { name: string; quoteId?: string }) => api<{ job: { id: string; setupStatus: string }; created: boolean }>("/api/jobs", { method: "POST", body }),
  saveSetup: (id: string, body: ReturnType<typeof setupBody>) => api<JobDetail>(`/api/jobs/${encodeURIComponent(id)}/setup`, { method: "PUT", body }),
  confirmSetup: (id: string, body: ReturnType<typeof setupBody>) => api<JobDetail>(`/api/jobs/${encodeURIComponent(id)}/setup/confirm`, { method: "POST", body }),
  regenerateSetup: (id: string) => api<JobDetail>(`/api/jobs/${encodeURIComponent(id)}/setup/regenerate`, { method: "POST", body: {} }),
  fieldReports: (id: string) => api<{ reports: FieldReport[] }>(`/api/jobs/${encodeURIComponent(id)}/field-reports`),
  resolveReport: (id: string, note?: string) => api<{ report: FieldReport }>(`/api/field-reports/${encodeURIComponent(id)}/resolve`, { method: "POST", body: note ? { note } : {} }),
  permits: (id: string) => api<{ permits: Permit[]; province: string | null }>(`/api/jobs/${encodeURIComponent(id)}/permits`),
  addPermit: (id: string, body: { title: string; kind?: string; authority?: string; status?: Permit["status"] }) => api<{ permits: Permit[] }>(`/api/jobs/${encodeURIComponent(id)}/permits`, { method: "POST", body }),
  notes: (id: string) => api<{ notes: JobNote[] }>(`/api/jobs/${encodeURIComponent(id)}/notes`),
  addNote: (id: string, body: string) => api<{ note: JobNote }>(`/api/jobs/${encodeURIComponent(id)}/notes`, { method: "POST", body: { body } }),
  onMyWay: (id: string, lang: "en" | "fr", etaMinutes?: number) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/sms/on-my-way`, { method: "POST", body: { lang, ...(etaMinutes ? { etaMinutes } : null) } }),
  schedule: (from: Date, to: Date, projectId?: string) => api<{ blocks: SchedBlock[] }>(`/api/schedule?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`),
  setTask: (id: string, taskId: string, status: "todo" | "in_progress" | "done") => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", body: { status } }),
  addTask: (id: string, title: string, milestoneId: string | null) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/tasks`, { method: "POST", body: { title, milestoneId } }),
  setMilestone: (id: string, milestoneId: string, status: "planned" | "in_progress" | "completed" | "skipped") => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/milestones/${encodeURIComponent(milestoneId)}`, { method: "PUT", body: { status } }),
  setStatus: (id: string, status: "planning" | "active" | "suspended" | "completed") => api<unknown>(`/api/jobs/${encodeURIComponent(id)}`, { method: "PUT", body: { status } }),
  archive: (id: string) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/archive`, { method: "POST", body: {} }),
  setRadius: (id: string, geofenceRadiusMeters: number) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}`, { method: "PUT", body: { geofenceRadiusMeters } }),
  photos: (id: string) => api<{ photos: JobPhoto[] }>(`/api/jobs/${encodeURIComponent(id)}/photos`),
  deletePhoto: (id: string, photoId: string) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" }),
  sharePhotos: (id: string, photoIds: string[]) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/photos/share`, { method: "POST", body: { photoIds } }),
  rename: (id: string, name: string) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}`, { method: "PUT", body: { name } }),
  confirmCost: (id: string, costId: string) => api<unknown>(`/api/jobs/${encodeURIComponent(id)}/costs/${encodeURIComponent(costId)}`, { method: "PUT", body: { status: "confirmed" } }),
  /** Drafts the invoice for a payment term whose milestone is done. */
  invoiceTerm: (id: string, milestoneId: string) => api<{ invoice: { id: string; number: string }; created: boolean }>(`/api/jobs/${encodeURIComponent(id)}/invoices`, { method: "POST", body: { kind: "term", milestoneId } }),
  crewToday: () => api<CrewDay>("/api/crew/today"),
  resolveBlocker: (id: string) => api<unknown>(`/api/field-reports/${encodeURIComponent(id)}/resolve`, { method: "POST", body: {} }),
};
