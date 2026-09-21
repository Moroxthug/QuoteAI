import { authClient } from "@/lib/auth-client";
import { useLocation } from "wouter";
import { useEffect } from "react";

export type AuthUser = {
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

export function useRequireAuth() {
  const { isLoaded, isSignedIn, isError } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // A failed session check is not a sign-out — don't bounce to /sign-in on an outage.
    if (isLoaded && !isSignedIn && !isError) {
      navigate("/sign-in");
    }
  }, [isLoaded, isSignedIn, isError, navigate]);

  return { isLoaded, isSignedIn };
}
