// Where a signed-in person goes first. Pure, so the rules are tested (gate.test.ts).
//  - joined a company and owns none (an invite or an access code): straight to its Home;
//  - belongs to several companies and hasn't picked one on this phone: choose a company;
//  - owns none and an invitation is waiting for their address: offered before any form;
//  - their own company has no name yet (and they haven't chosen "Skip for now"): set up;
//  - the company they are in is one they are the accountant of: the accountant's read-only view (phase 127);
//  - otherwise: Home.
import type { OrgDto, PendingInviteDto } from "./api";

export type GateInput = {
  orgs: OrgDto[];
  invites: PendingInviteDto[];
  /** The company name on the signed-in person's own profile ("" when never set up). */
  companyName: string | null;
  setupSkipped: boolean;
  hasActiveOrg: boolean;
  /** The company the server says they are acting in. */
  activeOrgId?: string | null;
};

export type GateRoute = "/home" | "/foreman-home" | "/accountant-view" | "/company-picker" | "/invites" | "/onboarding";

export function decideRoute({ orgs, invites, companyName, setupSkipped, hasActiveOrg, activeOrgId }: GateInput): GateRoute {
  const owns = orgs.some((o) => o.isOwn);
  // A foreman who only joined a company has their own Home (phase 126); an accountant, the books (phase 127).
  if (orgs.length > 0 && !owns && orgs.length === 1) return orgs[0]!.role === "foreman" ? "/foreman-home" : orgs[0]!.role === "accountant" ? "/accountant-view" : "/home";
  if (orgs.length > 1 && !hasActiveOrg) return "/company-picker";
  if (orgs.length > 1 && orgs.some((o) => o.orgId === activeOrgId && !o.isOwn && o.role === "accountant")) return "/accountant-view";
  if (!owns && invites.length > 0) return "/invites";
  if (!(orgs.length > 0 && !owns) && companyName === "" && !setupSkipped) return "/onboarding";
  return "/home";
}
