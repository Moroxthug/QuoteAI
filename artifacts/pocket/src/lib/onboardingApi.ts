// Onboarding's calls the generated hooks don't cover (the web app's saveDetails, saveSetup, invite
// and makeCodes). The wrapped fetch in api.ts adds the token and the acting company.
import { api } from "./api";
import { API_ROLE, type CompanySetup, type PersonRole } from "./onboarding";

export const onboardingApi = {
  /** Province, licence number and e-Transfer email (no company name needed). */
  saveDetails: (body: { province: string | null; licenceNumber: string | null; etransferEmail: string | null }) =>
    api("/api/business-profile", { method: "PUT", body }),
  /** What kind of work, how big (PUT /api/company-setup). */
  saveSetup: (body: CompanySetup) => api("/api/company-setup", { method: "PUT", body }),
  invite: (email: string, role: PersonRole) =>
    api("/api/team/members/invite", { method: "POST", body: { email: email.trim(), role: API_ROLE[role], send: true } }),
  makeCodes: (count: number) =>
    api<{ codes: { id: string; code: string }[] }>("/api/team/members/codes", { method: "POST", body: { count, role: API_ROLE.crew } }),
};
