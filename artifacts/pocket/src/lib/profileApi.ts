// The company's profile and a person's own choices: the server calls (routes/business-profile.ts, routes/member-prefs.ts, routes/push.ts).
import { api } from "./api";
import { uploadFile, type UploadFile } from "./jobUpload";
import type { Profile, ProfilePatch } from "./profile";

export type MemberPrefs = { voice?: "ember" | "tide" | "stone"; speak?: boolean; confirmSend?: boolean; language?: "en" | "fr"; jobTitle?: string; mobile?: string; signature?: string; home?: { order?: string[]; on?: Record<string, boolean>; tabs?: string[]; density?: 0 | 1 } };
export type Numbers = { made: number; sent: number; won: number; wonPercent: number | null; invoicedCents: number; jobs: number; activeJobs: number };
export type MyNumbers = { period: "month" | "quarter" | "year"; now: Numbers; before: Numbers; months: { month: string; sent: number; won: number; invoicedCents: number }[] };
export type PushPrefs = { categories: string[]; muted: string[] };

export const profileApi = {
  get: () => api<Profile>("/api/business-profile"),
  /** Only what is given changes. */
  save: (patch: ProfilePatch) => api<Profile>("/api/business-profile", { method: "PUT", body: patch }),
  logo: (file: UploadFile) => uploadFile<{ logoUrl: string }>("/api/business-profile/logo", "logo", file, {}),
  numbers: (period: "month" | "quarter" | "year") => api<MyNumbers>(`/api/me/numbers?period=${period}`),
  prefs: () => api<{ preferences: MemberPrefs }>("/api/me/preferences"),
  savePrefs: (p: MemberPrefs) => api<{ preferences: MemberPrefs }>("/api/me/preferences", { method: "PUT", body: p }),
  push: () => api<PushPrefs>("/api/push/preferences"),
  savePush: (muted: string[]) => api<PushPrefs>("/api/push/preferences", { method: "PUT", body: { muted } }),
};
