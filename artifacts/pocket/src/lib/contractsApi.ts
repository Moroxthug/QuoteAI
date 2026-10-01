// The Contracts and Contract screens' server calls (routes/contracts.ts); the app's wrapped fetch adds the token.
// The client signs on the web page the emailed link opens (routes/sign.ts), not in the app.
import { api } from "./api";
import type { ContractFull, ContractRow } from "./contracts";

const id = encodeURIComponent;
type One = { contract: ContractFull };

export const contractsApi = {
  list: () => api<{ items: ContractRow[] }>("/api/contracts?lean=1"),
  get: (cid: string) => api<One>(`/api/contracts/${id(cid)}`),
  /** The active contract of a quote, or none. (This answer has no signers or events: read the contract itself.) */
  byQuote: (quoteId: string) => api<{ contract: { id: string } | null }>(`/api/contracts/by-quote/${id(quoteId)}`),
  /** Draft a contract from a quote (the assistant reads the quote; the plan must include contracts). Slow: a few seconds. */
  fromQuote: (quoteId: string, language?: "en" | "fr") => api<{ contract: ContractFull; created: boolean }>(`/api/contracts/from-quote/${id(quoteId)}`, { method: "POST", body: language ? { language } : {} }),
  update: (cid: string, body: { sections?: { key: string; body: string }[]; variables?: Record<string, unknown> }) => api<One>(`/api/contracts/${id(cid)}`, { method: "PUT", body }),
  /** The company signs (a typed name). */
  sign: (cid: string, body: { signatureType: "typed"; signatureData: string; name: string; consent: true }) => api<One>(`/api/contracts/${id(cid)}/sign`, { method: "POST", body }),
  /** Email the client the signing link; also a reminder. */
  send: (cid: string, toEmail?: string) => api<One>(`/api/contracts/${id(cid)}/send`, { method: "POST", body: toEmail ? { toEmail } : {} }),
  void: (cid: string, reason?: string) => api<One>(`/api/contracts/${id(cid)}/void`, { method: "POST", body: reason ? { reason } : {} }),
  archive: (cid: string) => api<unknown>(`/api/contracts/${id(cid)}/archive`, { method: "POST", body: {} }),
  restore: (cid: string) => api<unknown>(`/api/contracts/${id(cid)}/restore`, { method: "POST", body: {} }),
};
