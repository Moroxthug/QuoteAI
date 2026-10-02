// The signed-in person's job role and how they arranged their home (their own member preferences), read once and kept fresh.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { homeOf, tabsOf, type HomePrefs, type JobRole } from "./jobRoles";
import { jobRolesApi, type MyRole } from "./jobRolesApi";
import { profileApi, type MemberPrefs } from "./profileApi";
import { useSession } from "./useSession";

const FALLBACK: MyRole = { included: false, jobRole: "owner", access: "owner", sensitive: { payRates: true, margins: true, approveTime: true, sendInvoices: true }, mayChangeHome: false };

export function useJobRole() {
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const client = useQueryClient();
  const meQ = useQuery({ queryKey: ["my-job-role"], queryFn: jobRolesApi.me, enabled: signedIn, retry: 0, staleTime: 60_000 });
  const prefsQ = useQuery({ queryKey: ["member-prefs"], queryFn: profileApi.prefs, enabled: signedIn, retry: 0, staleTime: 60_000 });
  const me = meQ.data ?? FALLBACK;
  const prefs: HomePrefs | undefined = me.mayChangeHome ? (prefsQ.data?.preferences as MemberPrefs | undefined)?.home : undefined;
  const role: JobRole = me.jobRole;
  const saveHome = useCallback(async (home: HomePrefs) => {
    const r = await profileApi.savePrefs({ home });
    client.setQueryData(["member-prefs"], r);
  }, [client]);
  return { me, role, prefs, sections: homeOf(role, prefs), tabs: tabsOf(role, prefs), ready: !!meQ.data || meQ.isError, saveHome, refresh: () => { void meQ.refetch(); void prefsQ.refetch(); } };
}
