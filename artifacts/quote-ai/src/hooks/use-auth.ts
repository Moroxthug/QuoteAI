import { authClient } from "@/lib/auth-client";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export function useAuth() {
  const { data: session, isPending, error } = authClient.useSession();

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
