// Who is signed in, and which door they belong behind. `status` is "loading" until the saved
// token has been checked with the server; "offline" when it couldn't be (the person stays
// signed in on this phone and the app opens on what it last knew).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "./auth";
import { kvGet, kvSet } from "./kv";
import { clearSession, getToken, onSessionChange } from "./session";

export type SessionUser = { id: string; name: string; email: string; image: string | null };
export type SessionStatus = "loading" | "out" | "in" | "offline";

type SessionState = {
  status: SessionStatus;
  user: SessionUser | null;
  /** Re-check the token with the server (after a sign-in, a code, a company change). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** "Skip for now" on company setup is remembered per person on this phone. */
  setupSkipped: boolean;
  skipSetup: (skipped: boolean) => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);
const skipKey = (userId: string) => `quoteai.setupSkipped.${userId}`;
const WELCOME_KEY = "quoteai.welcomeSeen";

export async function welcomeSeen(): Promise<boolean> {
  return (await kvGet(WELCOME_KEY)) === "1";
}
export function markWelcomeSeen(): Promise<void> {
  return kvSet(WELCOME_KEY, "1");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [setupSkipped, setSkipped] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await getToken())) {
      setUser(null);
      setStatus("out");
      return;
    }
    const r = await auth.session();
    if (r.ok && r.data) {
      setUser(r.data);
      setSkipped((await kvGet(skipKey(r.data.id))) === "1");
      setStatus("in");
    } else if (r.ok) {
      // The server doesn't know this token any more.
      await clearSession();
      setUser(null);
      setStatus("out");
    } else {
      setStatus((s) => (s === "loading" ? "offline" : s));
    }
  }, []);

  useEffect(() => {
    void refresh();
    // A sign-in or sign-out anywhere (the token changed): check again.
    return onSessionChange(() => { void refresh(); });
  }, [refresh]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    await clearSession();
    client.clear();
    setUser(null);
    setStatus("out");
  }, [client]);

  const skipSetup = useCallback(async (skipped: boolean) => {
    if (!user) return;
    await kvSet(skipKey(user.id), skipped ? "1" : null);
    setSkipped(skipped);
  }, [user]);

  const value = useMemo(() => ({ status, user, refresh, signOut, setupSkipped, skipSetup }), [status, user, refresh, signOut, setupSkipped, skipSetup]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
