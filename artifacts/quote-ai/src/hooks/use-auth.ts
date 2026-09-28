import { authClient } from "@/lib/auth-client";
import { getRestoredProfile } from "@/lib/offline/cache-state";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export function useAuth() {
  const { data: session, isPending, error } = authClient.useSession();

  // Phase 116: this device opened with the saved answers of the person who
  // used it last (they never signed out — signing out deletes them). While the
  // session check is on its way, and when it can't be answered (no signal),
  // the app is theirs and draws from the device at once — instead of a
  // skeleton or the "can't reach QuoteAI" card. When the check answers, its
  // answer wins: signed out goes to sign-in, someone else's session drops the
  // saved data first (useCacheOwnerCheck).
  const offlineProfile = (isPending || error) && !session ? getRestoredProfile() : null;
  if (offlineProfile) {
    return {
      isLoaded: true,
      isError: false,
      isSignedIn: true,
      userId: offlineProfile.id,
      user: { id: offlineProfile.id, name: offlineProfile.name, email: offlineProfile.email, image: offlineProfile.image ?? null } as AuthUser,
      session,
    };
  }

  return {
    isLoaded: !isPending,
    /** The session check itself failed (API unreachable / 5xx) — not the same as "signed out". */
    isError: !!error,
    isSignedIn: !!session?.user,
    userId: session?.user?.id ?? null,
    user: (session?.user as AuthUser | null | undefined) ?? null,
    session,
  };
}
