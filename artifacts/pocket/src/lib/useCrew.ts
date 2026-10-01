// The crew screens' data: the worker's day from their link (GET /api/t/:token), refreshed every minute, with what waited on the phone sent first.
// A link that no longer works comes back as `problem` (expired, replaced, invalid, or no signal); the screens send the person to CrewExpired.
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "./api";
import { linkProblem, type CrewView, type LinkProblem } from "./crew";
import { crewApi } from "./crewApi";
import { flushOutbox } from "./crewOutbox";
import { loadCrewSession, rememberCrew, useCrewSession } from "./crewSession";

export type CrewState = {
  /** The stored link is still being read. */
  loading: boolean;
  /** No pairing on this phone yet. */
  unpaired: boolean;
  path: string | null;
  view: CrewView | undefined;
  problem: LinkProblem | null;
  /** Had data once, now offline: show what it knew with a note. */
  stale: boolean;
  refetch: () => Promise<unknown>;
  loadingView: boolean;
};

export function useCrew(): CrewState {
  const s = useCrewSession();
  const client = useQueryClient();
  useEffect(() => { void loadCrewSession(); }, []);
  const q = useQuery({
    queryKey: ["crew", s.path],
    queryFn: async () => {
      const path = s.path!;
      // What waited on the phone goes first, so the day that comes back already holds it.
      await flushOutbox(path).catch(() => undefined);
      return crewApi.view(path);
    },
    enabled: !!s.path,
    retry: false,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  useEffect(() => {
    const v = q.data;
    if (v) void rememberCrew({ workerName: v.worker.name, companyName: v.companyName, language: v.language });
  }, [q.data]);
  void client;
  const problem = q.error instanceof ApiFailure ? linkProblem(q.error) : null;
  return {
    loading: !s.loaded,
    unpaired: s.loaded && !s.token,
    path: s.path,
    view: q.data,
    problem: problem && !(problem === "offline" && q.data) ? problem : null,
    stale: problem === "offline" && !!q.data,
    refetch: q.refetch,
    loadingView: q.isPending && !!s.path,
  };
}
