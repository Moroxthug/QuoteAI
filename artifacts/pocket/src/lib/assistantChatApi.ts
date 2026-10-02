// The assistant's chat: the company conversation and a message to it (routes/assistant.ts). Needs the plan that includes the assistant; without it the server answers PLAN_REQUIRED.
import { api } from "./api";

export type ChatMessage = { id: string; role: string; content: string | null };
export type ChatProposal = { id: string; summary: string; status: string };

export const assistantChatApi = {
  conversation: () => api<{ conversation: { id: string }; messages: ChatMessage[]; proposals: ChatProposal[] }>("/api/assistant/conversation"),
  send: (conversationId: string, content: string, language: "en" | "fr") => api<{ messages: ChatMessage[]; proposals: ChatProposal[] }>(`/api/assistant/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: { content, language } }),
};
