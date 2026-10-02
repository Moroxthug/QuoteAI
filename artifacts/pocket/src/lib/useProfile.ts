// The company's profile for the Settings screens: read once, changed at once on the phone and saved a moment later (rolled back, with a toast from the
// screen, when the server says no).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useCallback } from "react";
import { ApiFailure } from "./api";
import { applyPatch, type Profile, type ProfilePatch } from "./profile";
import { profileApi } from "./profileApi";
import { useSession } from "./useSession";

export function useProfile() {
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["profile"], queryFn: profileApi.get, enabled: signedIn, retry: 1, staleTime: 30_000 });
  /** Saves a patch; resolves true when the server took it, false when it didn't (and the phone shows what it had before). */
  const save = useCallback(async (patch: ProfilePatch): Promise<{ ok: true } | { ok: false; status: number }> => {
    const before = client.getQueryData<Profile>(["profile"]);
    if (before) client.setQueryData(["profile"], applyPatch(before, patch));
    try {
      const saved = await profileApi.save(patch);
      client.setQueryData(["profile"], saved);
      void client.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      return { ok: true };
    } catch (e) {
      if (before) client.setQueryData(["profile"], before);
      return { ok: false, status: e instanceof ApiFailure ? e.status : 0 };
    }
  }, [client]);
  return { profile: q.data, q, save, signedIn };
}
