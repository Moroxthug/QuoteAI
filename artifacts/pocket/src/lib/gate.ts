// Where a signed-in person goes first. Pure, so the rules are tested (gate.test.ts).
//  - joined a company and owns none (an invite or an access code): straight to its Home;
//  - belongs to several companies and hasn't picked one on this phone: choose a company;
//  - owns none and an invitation is waiting for their address: offered before any form;
//  - their own company has no name yet (and they haven't chosen "Skip for now"): set up;
//  - otherwise: Home.
import type { OrgDto, PendingInviteDto } from "./api";

export type GateInput = {
  orgs: OrgDto[];
  invites: PendingInviteDto[];
  /** The company name on the signed-in person's own profile ("" when never set up). */
  companyName: string | null;
  setupSkipped: boolean;
  hasActiveOrg: boolean;
};

export type GateRoute = "/home" | "/foreman-home" | "/company-picker" | "/invites" | "/onboarding";

export function decideRoute({ orgs, invites, companyName, setupSkipped, hasActiveOrg }: GateInput): GateRoute {
  const owns = orgs.some((o) => o.isOwn);
  // A foreman who only joined a company has their own Home (phase 126).
  if (orgs.length > 0 && !owns && orgs.length === 1) return orgs[0]!.role === "foreman" ? "/foreman-home" : "/home";
  if (orgs.length > 1 && !hasActiveOrg) return "/company-picker";
  if (!owns && invites.length > 0) return "/invites";
  if (!(orgs.length > 0 && !owns) && companyName === "" && !setupSkipped) return "/onboarding";
  return "/home";
}
