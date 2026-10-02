// What the signed-in person is in the company they are acting in: the owner changes the company's settings; everyone else sees them.
import { useQuery } from "@tanstack/react-query";
import { team } from "./api";
import { useSession } from "./useSession";

export function useRole(): { role: "owner" | "admin" | "office" | "foreman" | "viewer" | "accountant" | null; isOwner: boolean; ready: boolean } {
  const { status } = useSession();
  const orgs = useQuery({ queryKey: ["team-orgs"], queryFn: team.orgs, enabled: status === "in", retry: false });
  const active = orgs.data?.items.find((o) => o.orgId === orgs.data.activeOrgId);
  // No membership row means the person's own company: they own it.
  const role = active?.role ?? (orgs.data || status === "offline" ? "owner" : null);
  return { role, isOwner: role === "owner", ready: !!orgs.data || orgs.isError || status === "offline" };
}
