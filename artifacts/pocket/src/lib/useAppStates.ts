// Each app's state and its one line, from what the server says about it (a status call for each app the plan includes; the others are locked without asking).
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { APPS, stateOf, unlocked, unresolvedFailures, type AppId, type State } from "./integrations";
import { useProfile } from "./useProfile";
import { useSession } from "./useSession";

type Conn = { connected?: boolean; available?: boolean; isEnabled?: boolean | null; companyName?: string | null; businessName?: string | null; phoneNumber?: string | null; lsaCustomerId?: string | null; chargesEnabled?: boolean };
type Log = { entries: { status: string; entityType?: string; entityId?: string; milestoneId?: string; provider?: string }[] };
type Calendar = { available?: Record<string, boolean>; connections: { provider: string; isEnabled?: boolean | null; accountEmail?: string | null }[] };
type Plan = { plan: string; features: string[] };

export type AppLine = { state: State; /** What to say under the name when it is on: a company, an address or "N didn't sync". */ detail?: string; failures?: number };

export function useAppStates(): { apps: Record<AppId, AppLine>; plan: Plan | undefined; loading: boolean; refresh: () => void } {
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const { profile } = useProfile();
  const planQ = useQuery({ queryKey: ["plan-overview"], queryFn: () => api<Plan>("/api/plan/overview"), enabled: signedIn, retry: 0, staleTime: 60_000 });
  const plan = planQ.data;
  const on = (id: AppId) => !!plan && unlocked(APPS.find((a) => a.id === id)!, plan.plan, plan.features);
  const get = <T,>(key: string, path: string, id: AppId, extra = true) => useQuery({ queryKey: [key], queryFn: () => api<T>(path), enabled: signedIn && on(id) && extra, retry: 0, staleTime: 30_000 });
  const qb = get<Conn>("qb-status", "/api/quickbooks/status", "qbo");
  const qbLog = get<Log>("qb-log", "/api/quickbooks/sync-log", "qbo", !!qb.data?.connected);
  const wave = get<Conn>("wave-status", "/api/wave/status", "wave");
  const waveLog = get<Log>("wave-log", "/api/wave/sync-log", "wave", !!wave.data?.connected);
  const stripe = get<Conn>("stripe-connect", "/api/invoice-payments/connect/status", "stripe");
  const cal = get<Calendar>("calendar-status", "/api/calendar/status", "gcal");
  const calLog = get<Log>("calendar-log", "/api/calendar/sync-log", "gcal", (cal.data?.connections.length ?? 0) > 0);
  const wa = get<Conn>("wa-status", "/api/whatsapp/status", "wa");
  const lsa = get<Conn>("lsa-status", "/api/google-lsa/status", "gbp");

  const calendarOf = (provider: "google" | "outlook"): AppLine => {
    const conn = cal.data?.connections.find((c) => c.provider === provider);
    if (!conn) return { state: cal.data?.available?.[provider] === false ? "soon" : "none" };
    const failing = unresolvedFailures(calLog.data?.entries).filter((e) => e.provider === provider).length;
    if (failing) return { state: "attention", failures: failing };
    return { state: conn.isEnabled === false ? "paused" : "connected", detail: conn.accountEmail ?? undefined };
  };
  const qbFail = unresolvedFailures(qb.data?.connected ? qbLog.data?.entries : undefined).length;
  const waveFail = unresolvedFailures(wave.data?.connected ? waveLog.data?.entries : undefined).length;

  const raw: Record<AppId, AppLine> = {
    qbo: { state: stateOf(qb.data, qbFail > 0), detail: qb.data?.companyName ?? undefined, failures: qbFail },
    xero: { state: "soon" },
    wave: { state: stateOf(wave.data, waveFail > 0), detail: wave.data?.businessName ?? undefined, failures: waveFail },
    stripe: stripe.data?.connected && !stripe.data.chargesEnabled ? { state: "attention" } : { state: stateOf(stripe.data) },
    gcal: calendarOf("google"),
    outlook: calendarOf("outlook"),
    wa: { state: stateOf(wa.data), detail: wa.data?.phoneNumber ?? undefined },
    drive: { state: "soon" },
    jobber: { state: "none" },
    hd: { state: "soon" },
    hs: { state: profile?.homeStarsProfileUrl ? "connected" : "none" },
    gbp: { state: stateOf(lsa.data), detail: lsa.data?.lsaCustomerId ?? undefined },
  };
  const apps = {} as Record<AppId, AppLine>;
  for (const a of APPS) apps[a.id] = !plan || on(a.id) ? raw[a.id] : { state: "locked" };
  const loading = planQ.isPending && !plan;
  return { apps, plan, loading, refresh: () => { void planQ.refetch(); void qb.refetch(); void wave.refetch(); void stripe.refetch(); void cal.refetch(); void wa.refetch(); void lsa.refetch(); } };
}
