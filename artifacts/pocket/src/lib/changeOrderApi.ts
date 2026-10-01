// The Change order screen's server calls (routes/jobs.ts, contracts.ts, assistant.ts); the app's wrapped fetch adds the token.
// A change order is a record on the job plus a signable document (a contract of kind change_order): the contractor signs it, it is emailed to the
// client with a signing link, the client signs, and the job's value and schedule follow.
import { api } from "./api";
import type { ChangeOrderRow } from "./jobDetail";

export type CoItems = { descrizione: string; um: string; quantita: number; prezzoUnitario: number; totale: number }[];
export type CoBody = { title: string; description: string; items: CoItems; scheduleDeltaDays: number };

export type ContractState = {
  contract: {
    id: string; status: string; contractNumber: string; sentAt: string | null; signedAt: string | null; reminderCount: number;
    signers: { id: string; role: "contractor" | "customer"; name: string; email: string; status: string; signatureType: string | null; signedAt: string | null; viewedAt: string | null; declinedAt: string | null }[];
    events: { id: string; type: string; actor: string; createdAt: string }[];
  };
};

export type AssistantProposal = { id: string; kind: string; summary: string; payload: unknown; status: string };

export const changeOrderApi = {
  create: (jobId: string, body: CoBody) => api<{ changeOrder: ChangeOrderRow; documentContractId: string }>(`/api/jobs/${encodeURIComponent(jobId)}/change-orders`, { method: "POST", body }),
  update: (jobId: string, coId: string, body: Partial<CoBody>) => api<{ changeOrder: ChangeOrderRow }>(`/api/jobs/${encodeURIComponent(jobId)}/change-orders/${encodeURIComponent(coId)}`, { method: "PUT", body }),
  remove: (jobId: string, coId: string) => api<unknown>(`/api/jobs/${encodeURIComponent(jobId)}/change-orders/${encodeURIComponent(coId)}`, { method: "DELETE" }),
  contract: (docId: string) => api<ContractState>(`/api/contracts/${encodeURIComponent(docId)}`),
  /** The contractor signs the document (typed name) so it can be sent. */
  sign: (docId: string, name: string) => api<ContractState>(`/api/contracts/${encodeURIComponent(docId)}/sign`, { method: "POST", body: { signatureType: "typed", signatureData: name, name, consent: true } }),
  send: (docId: string) => api<ContractState>(`/api/contracts/${encodeURIComponent(docId)}/send`, { method: "POST", body: {} }),
  /** The assistant reads what was said and proposes the change order's lines (the assistant is the Elite plan's). */
  draft: (projectId: string, text: string, language: "en" | "fr") => api<{ proposals: AssistantProposal[] }>("/api/assistant/actions", { method: "POST", body: { projectId, text, language } }),
  dismissProposal: (id: string) => api<unknown>(`/api/assistant/proposals/${encodeURIComponent(id)}/dismiss`, { method: "POST", body: {} }),
};
