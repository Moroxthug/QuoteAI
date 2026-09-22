import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { roleCan, type PermissionAction, type PermissionArea, type TeamMemberRole } from "@workspace/permissions";
import { teamMembersApi } from "@/lib/team-members-api";

// Phase 80: the signed-in person's role in the company they are acting for,
// from the same /api/team/orgs the org switcher reads (one request, cached a
// minute). The server still enforces every permission (requirePermission);
// this only lets the dashboard hide or disable what would come back 403.
//
// Until the list has loaded — and for a fresh owner who has no orgs row yet —
// the role is `owner`: most people are the owner, so assuming it avoids a
// flash of missing buttons on every page load, and a viewer sees the buttons
// vanish within the one round trip rather than never.
function useRole(): { role: TeamMemberRole; loaded: boolean; isOwnCompany: boolean } {
  const { data, isSuccess } = useQuery({ queryKey: ["team-orgs"], queryFn: teamMembersApi.orgs, staleTime: 60_000 });
  const active = data?.items.find((o) => o.orgId === data.activeOrgId);
  return { role: active?.role ?? "owner", loaded: isSuccess, isOwnCompany: active?.isOwn ?? true };
}

/** `can("jobs", "edit")` — the shared Phase 7 matrix applied to the current role. */
export function useCan(): (area: PermissionArea, action: PermissionAction) => boolean {
  const { role } = useRole();
  return useCallback((area: PermissionArea, action: PermissionAction) => roleCan(role, area, action), [role]);
}
