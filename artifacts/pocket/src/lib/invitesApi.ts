// The emailed invitation link (quoteai.ca/team-invite/:token, opened in the app as /invites?token=): the
// same two calls the web page makes (api-server routes/team-members.ts). Preview needs no sign-in; accept does.
import { api, type TeamRole } from "./api";

export type InvitePreview = { companyName: string; email: string; role: TeamRole };

export const inviteLink = {
  preview: (token: string) => api<InvitePreview>(`/api/team/invite/${encodeURIComponent(token)}`),
  accept: (token: string) => api<unknown>(`/api/team/invite/${encodeURIComponent(token)}/accept`, { method: "POST" }),
};
