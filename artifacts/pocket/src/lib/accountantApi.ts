// The accountant view's server calls (routes/accountant.ts); the app's wrapped fetch adds the token.
import { api } from "./api";
import type { AccountantOverview, CommentDto } from "./accountant";

const id = encodeURIComponent;

export const accountantApi = {
  overview: (month?: string) => api<AccountantOverview>(`/api/accountant/overview${month ? `?month=${id(month)}` : ""}`),
  comments: (month: string) => api<{ items: CommentDto[]; canWrite: boolean }>(`/api/accountant/comments?month=${id(month)}`),
  comment: (month: string, body: string) => api<{ comment: CommentDto }>("/api/accountant/comments", { method: "POST", body: { month, body } }),
};
