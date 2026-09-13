// Thin fetch client for the Phase 5 assistant endpoints.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

export type AssistantRole = "user" | "assistant" | "tool";
export type ProposalKind = "cost_entry" | "milestone_update" | "task" | "invoice" | "record_payment" | "send_invoice";
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

export const assistantApi = {
  conversation: (projectId: string | null) => req<ConversationDto>(`/api/assistant/conversation${projectId ? `?projectId=${projectId}` : ""}`),
  send: (conversationId: string, content: string, language: "en" | "fr") => req<TurnDto>(`/api/assistant/conversations/${conversationId}/messages`, { method: "POST", body: json({ content, language }) }),
  clear: (conversationId: string) => req<{ success: true }>(`/api/assistant/conversations/${conversationId}`, { method: "DELETE" }),
  confirm: (proposalId: string) => req<{ proposal: ProposalDto; link: string | null }>(`/api/assistant/proposals/${proposalId}/confirm`, { method: "POST" }),
  dismiss: (proposalId: string) => req<{ proposal: ProposalDto }>(`/api/assistant/proposals/${proposalId}/dismiss`, { method: "POST" }),
};
