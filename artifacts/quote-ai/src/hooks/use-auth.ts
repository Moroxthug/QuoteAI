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
  const { data: session, isPending } = authClient.useSession();

  return {
    isLoaded: !isPending,
    isSignedIn: !!session?.user,
    userId: session?.user?.id ?? null,
    user: (session?.user as AuthUser | null | undefined) ?? null,
    session,
  };
}

export function useRequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate("/sign-in");
    }
  }, [isLoaded, isSignedIn, navigate]);

  return { isLoaded, isSignedIn };
}
