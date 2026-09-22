// Thin fetch client for the Phase 5 assistant endpoints.
import { apiRequest as req, apiJson as json, type JobPhotoDto } from "@/lib/jobs-api";

export type AssistantRole = "user" | "assistant" | "tool";
export type ProposalKind = "cost_entry" | "milestone_update" | "task" | "invoice" | "record_payment" | "send_invoice" | "change_order" | "job_note";
export type ProposalStatus = "pending" | "confirmed" | "dismissed" | "failed";

export type AssistantMessageDto = {
  id: string;
  role: AssistantRole;
  content: string;
  toolCalls: { id: string; name: string }[] | null;
  toolCallId: string | null;
  toolName: string | null;
  createdAt: string;
};

export type ProposalDto = {
  id: string;
  messageId: string | null;
  projectId: string | null;
  kind: ProposalKind;
  summary: string;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  resultEntityType: string | null;
  resultEntityId: string | null;
  error: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type ConversationDto = { conversation: { id: string; projectId: string | null; title: string }; messages: AssistantMessageDto[]; proposals: ProposalDto[] };
export type TurnDto = { messages: AssistantMessageDto[]; proposals: ProposalDto[] };
/** Phase 78: an on-site turn — the transcript (voice) or the saved gallery photo (photo) ride along. */
export type ActionTurnDto = TurnDto & { conversationId: string; transcript?: string; photo?: JobPhotoDto };

async function multipart<T>(url: string, fd: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", credentials: "include", body: fd });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; requiredPlan?: string };
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number; requiredPlan?: string };
    err.code = body.error;
    err.status = res.status;
    err.requiredPlan = body.requiredPlan;
    throw err;
  }
  return body;
}

export const assistantApi = {
  conversation: (projectId: string | null) => req<ConversationDto>(`/api/assistant/conversation${projectId ? `?projectId=${projectId}` : ""}`),
  send: (conversationId: string, content: string, language: "en" | "fr") => req<TurnDto>(`/api/assistant/conversations/${conversationId}/messages`, { method: "POST", body: json({ content, language }) }),
  clear: (conversationId: string) => req<{ success: true }>(`/api/assistant/conversations/${conversationId}`, { method: "DELETE" }),
  confirm: (proposalId: string) => req<{ proposal: ProposalDto; link: string | null }>(`/api/assistant/proposals/${proposalId}/confirm`, { method: "POST" }),
  dismiss: (proposalId: string) => req<{ proposal: ProposalDto }>(`/api/assistant/proposals/${proposalId}/dismiss`, { method: "POST" }),

  // Phase 78: on-site actions
  action: (projectId: string, text: string, language: "en" | "fr") => req<ActionTurnDto>("/api/assistant/actions", { method: "POST", body: json({ projectId, text, language }) }),
  voice: (projectId: string, audio: Blob, language: "en" | "fr") => {
    const fd = new FormData();
    const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
    fd.append("audio", audio, `recording.${ext}`);
    fd.append("projectId", projectId);
    fd.append("language", language);
    return multipart<ActionTurnDto>("/api/assistant/voice", fd);
  },
  photo: (projectId: string, photo: Blob, opts: { note?: string; milestoneId?: string | null; fileName?: string; language: "en" | "fr" }) => {
    const fd = new FormData();
    fd.append("photo", photo, opts.fileName ?? (photo instanceof File ? photo.name : "site.jpg"));
    fd.append("projectId", projectId);
    fd.append("language", opts.language);
    if (opts.note) fd.append("note", opts.note);
    if (opts.milestoneId) fd.append("milestoneId", opts.milestoneId);
    return multipart<ActionTurnDto>("/api/assistant/photo", fd);
  },
};
