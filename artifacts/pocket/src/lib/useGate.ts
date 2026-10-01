// Resolves where "/" leads: signed out → Welcome (first run) or Sign in; signed in → decideRoute.
import { useEffect, useState } from "react";
import { getGetBusinessProfileQueryKey, useGetBusinessProfile } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { team } from "./api";
import { decideRoute, type GateRoute } from "./gate";
import { getActiveOrg } from "./session";
import { useSession, welcomeSeen } from "./useSession";

export type Gate = GateRoute | "/welcome" | "/sign-in" | null;

export function useGate(): Gate {
  const { status, setupSkipped } = useSession();
  const signedIn = status === "in" || status === "offline";
  const [seen, setSeen] = useState<boolean | null>(null);
  const [hasActiveOrg, setHasActiveOrg] = useState<boolean | null>(null);
  useEffect(() => { void welcomeSeen().then(setSeen); }, []);
  useEffect(() => { if (signedIn) void getActiveOrg().then((o) => setHasActiveOrg(!!o)); }, [signedIn]);

  const orgs = useQuery({ queryKey: ["team-orgs"], queryFn: team.orgs, enabled: status === "in", retry: false });
  const owns = orgs.data?.items.some((o) => o.isOwn) ?? false;
  const invites = useQuery({ queryKey: ["pending-invites"], queryFn: team.pendingInvites, enabled: !!orgs.data && !owns && orgs.data.items.length === 0, retry: false });
  const profile = useGetBusinessProfile({ query: { queryKey: getGetBusinessProfileQueryKey(), enabled: status === "in", retry: false } });

  if (status === "loading") return null;
  if (status === "out") return seen === null ? null : seen ? "/sign-in" : "/welcome";
  if (status === "offline") return "/home"; // signed in on this phone, no signal: open on what it last knew
  if (orgs.isError || profile.isError) return "/home";
  const waiting = orgs.isPending || profile.isPending || hasActiveOrg === null || (invites.isEnabled && invites.isPending);
  if (waiting) return null;
  return decideRoute({
    orgs: orgs.data?.items ?? [],
    invites: invites.data?.items ?? [],
    companyName: profile.data?.companyName ?? "",
    setupSkipped,
    hasActiveOrg: !!hasActiveOrg,
    activeOrgId: orgs.data?.activeOrgId ?? null,
  });
}
