// Phase 91 — seats, the sign-up answers, access codes, and every person's own page.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";
import type { TeamMemberRole } from "@/lib/team-members-api";

export const COMPANY_TRADES = ["general", "renovation", "painting", "electrical", "plumbing", "hvac", "roofing", "carpentry", "flooring", "drywall", "masonry", "landscaping", "concrete", "cleaning", "other"] as const;
export type CompanyTrade = (typeof COMPANY_TRADES)[number];
export type CompanySetup = { trades?: CompanyTrade[]; teamSize?: number; seatsWanted?: number; fieldCrew?: boolean };

type Role = "owner" | TeamMemberRole;

export type SeatsDto = {
  used: number;
  limit: number;
  included: number;
  extra: number;
  canBuy: boolean;
  reason: "SEATS_UNAVAILABLE" | "COVERED_BY_GROUP" | "NO_SUBSCRIPTION" | null;
  interval: "month" | "year";
  pricePerSeatCents: number;
  seatsWanted?: number | null;
};

export type AccessCodeDto = { id: string; code: string; role: TeamMemberRole; expiresAt: string };
export type CodePreviewDto = { companyName: string; logoUrl: string | null; role: TeamMemberRole; code: string };

export type PersonDto = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  memberSince: string;
  phone: string | null;
  jobTitle: string | null;
  bio: string | null;
  setupDone: boolean;
};

export type PersonStatsDto = {
  months: number;
  since: string;
  attributionSince: string;
  quotes: { created: number; valueCents: number; won: number; wonValueCents: number; winRate: number | null };
  invoices: { issued: number; invoicedCents: number; paidCents: number };
  jobs: number;
  contracts: number;
  hours: { total: number; linkedWorker: boolean };
  series: { month: string; quotes: number; quoteValueCents: number; won: number; invoicedCents: number; hours: number }[];
};

export type ActivityDto = { id: string; at: string; action: string; entityType: string; entityId: string; link: string | null };

export type MeDto = {
  person: PersonDto;
  companies: { orgId: string; companyName: string; role: Role; joinedAt: string | null; isOwn: boolean }[];
  current: { orgId: string; role: Role };
};

export type TeammateDto = { person: PersonDto; role: Role; stats: PersonStatsDto; seesMoney: boolean; activity: ActivityDto[] };

export const peopleApi = {
  me: () => req<MeDto>("/api/me"),
  updateMe: (body: { name?: string; phone?: string | null; jobTitle?: string | null; bio?: string | null; complete?: boolean }) => req<{ person: PersonDto }>("/api/me", { method: "PUT", body: json(body) }),
  uploadAvatar: async (file: File): Promise<{ image: string }> => {
    const fd = new FormData();
    fd.append("avatar", file);
    const res = await fetch("/api/me/avatar", { method: "POST", body: fd, credentials: "include" });
    const body = (await res.json().catch(() => ({}))) as { image?: string; message?: string; error?: string };
    if (!res.ok) throw new Error(body.message || body.error || `Upload failed (${res.status})`);
    return { image: body.image! };
  },
  removeAvatar: () => req<{ image: null }>("/api/me/avatar", { method: "DELETE" }),
  myStats: (months: number) => req<PersonStatsDto>(`/api/me/stats?months=${months}`),
  myActivity: () => req<{ items: ActivityDto[] }>("/api/me/activity"),
  teammate: (userId: string, months: number) => req<TeammateDto>(`/api/team/people/${encodeURIComponent(userId)}?months=${months}`),

  seats: () => req<SeatsDto>("/api/seats"),
  setSeats: (extraSeats: number) => req<SeatsDto>("/api/seats", { method: "PUT", body: json({ extraSeats }) }),
  saveSetup: (body: CompanySetup) => req<{ companySetup: CompanySetup }>("/api/company-setup", { method: "PUT", body: json(body) }),

  makeCodes: (count: number, role: TeamMemberRole) => req<{ codes: AccessCodeDto[] }>("/api/team/members/codes", { method: "POST", body: json({ count, role }) }),
  previewCode: (code: string) => req<CodePreviewDto>(`/api/team/code/${encodeURIComponent(code)}`),
  redeemCode: (code: string) => req<{ orgId: string; role: TeamMemberRole }>(`/api/team/code/${encodeURIComponent(code)}/redeem`, { method: "POST" }),
};
