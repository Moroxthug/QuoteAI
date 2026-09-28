import { createElement, useId, useRef } from "react";
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { useLanguage } from "@/i18n/LanguageContext";

// Phase 115 (docs/APP-PLAN.md "Instant": taps answer immediately): an edit
// that can be undone — tick a task, change a status, rename, add or delete a
// note, archive — shows its result the moment it is tapped. The cached
// list/detail is patched first; the request runs behind it; a failure puts the
// cache back and says why (the usual destructive toast); either way the
// affected queries are refetched afterwards so the screen ends on the server's
// truth. Reversible edits also get a quiet "Undo" for five seconds, which
// sends the inverse edit (optimistically too).
//
// The Phase 77 offline outbox composes with this rather than competing: a
// mutationFn that queues its op when the network is gone (runOrQueue) resolves
// instead of throwing, so the optimistic patch simply stays until the replay
// invalidates the same queries.

/** One cache edit: every cached query whose key starts with `queryKey` goes through `update` (skipped while it has no data). */
export type CachePatch<T = unknown> = { queryKey: QueryKey; update: (old: T) => T };

/** Builds a patch with the cached data's type, e.g. `patch<{ items: Lead[] }>(["leads"], (d) => …)`. */
export function patch<T>(queryKey: QueryKey, update: (old: T) => T): CachePatch {
  return { queryKey, update: update as (old: unknown) => unknown };
}

type Snapshot = Array<[QueryKey, unknown]>;

/** Cancels what is in flight for each key (so a late answer can't overwrite the patch), snapshots, patches. */
export async function applyPatches(qc: QueryClient, patches: CachePatch[]): Promise<Snapshot> {
  await Promise.all(patches.map((p) => qc.cancelQueries({ queryKey: p.queryKey })));
  const snap: Snapshot = [];
  for (const p of patches) {
    for (const [key, data] of qc.getQueriesData({ queryKey: p.queryKey })) {
      if (data === undefined) continue;
      snap.push([key, data]);
      try {
        qc.setQueryData(key, p.update(data));
      } catch {
        // A cache shape the patch did not expect: leave it; the refetch after the request fixes it.
      }
    }
  }
  return snap;
}

/** Restores a snapshot (newest patch first, so overlapping keys end on their original data). */
export function rollback(qc: QueryClient, snap: Snapshot): void {
  for (let i = snap.length - 1; i >= 0; i--) qc.setQueryData(snap[i]![0], snap[i]![1]);
}

/** The quiet undo: a plain toast with one Undo button, gone after five seconds. */
export function showUndoToast({ title, description, undoLabel, onUndo }: { title: string; description?: string; undoLabel: string; onUndo: () => void }) {
  return toast({
    title,
    description,
    duration: 5000,
    // 44 px tall on a phone (docs/MOBILE-RULES.md), the usual 32 from 640 px up.
    action: createElement(ToastAction, { altText: undoLabel, onClick: onUndo, className: "h-11 px-4 sm:h-8 sm:px-3" }, undoLabel) as unknown as ToastActionElement,
  });
}

export type OptimisticOptions<TVars, TData> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** The cache edits that show the result now. Their keys are refetched when the request settles. */
  patch: (vars: TVars) => CachePatch[];
  /** More keys to refetch when it settles (totals, other lists this edit changes). */
  invalidate?: (vars: TVars) => QueryKey[];
  onSuccess?: (data: TData, vars: TVars) => void;
  /** Replaces the default error toast (the cache is rolled back either way). */
  onError?: (err: Error, vars: TVars) => void;
  /**
   * When the edit can be undone: the toast's words and the variables of the
   * inverse edit (sent through the same mutationFn and patch). Null to skip
   * the undo for this call.
   */
  undo?: (vars: TVars, data: TData) => { title: string; description?: string; inverse: TVars } | null;
};

/**
 * `useMutation` with an optimistic cache patch, rollback and an optional
 * Undo toast. Returns what the call sites use: `mutate`, `isPending`,
 * `variables`.
 *
 *   const toggle = useOptimisticMutation({
 *     mutationFn: (task: TaskDto) => jobsApi.updateTask(jobId, task.id, { status: flip(task) }),
 *     patch: (task) => [patch<JobDetailDto>(["job", jobId], (d) => withTask(d, task.id, flip(task)))],
 *     undo: (task) => ({ title: t("undo.taskDone"), inverse: { ...task, status: flip(task) } }),
 *   });
 */
export function useOptimisticMutation<TVars, TData = unknown>(opts: OptimisticOptions<TVars, TData>) {
  const qc = useQueryClient();
  const { t } = useLanguage();
  // One key per call site: a settle only refetches when no other edit from
  // the same place is still in flight, so ticking three tasks quickly doesn't
  // flicker the first two back while the third is on its way.
  const id = useId();
  const mutationKey = ["optimistic", id];
  const latest = useRef(opts);
  latest.current = opts;

  const settle = (vars: TVars) => {
    const o = latest.current;
    if (qc.isMutating({ mutationKey }) > 1) return;
    const keys = [...o.patch(vars).map((p) => p.queryKey), ...(o.invalidate?.(vars) ?? [])];
    for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
  };

  const fail = (err: Error, vars: TVars) => {
    const o = latest.current;
    if (o.onError) o.onError(err, vars);
    else toast({ title: t("jobs.error"), description: err.message, variant: "destructive" });
  };

  // The undo runs outside the hook's observer: it still works after the
  // screen that made the edit has gone (archive, then back to the list).
  const runUndo = async (o: OptimisticOptions<TVars, TData>, inverse: TVars) => {
    const snap = await applyPatches(qc, o.patch(inverse));
    try {
      await o.mutationFn(inverse);
    } catch (err) {
      rollback(qc, snap);
      fail(err as Error, inverse);
    } finally {
      const keys = [...o.patch(inverse).map((p) => p.queryKey), ...(o.invalidate?.(inverse) ?? [])];
      for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
    }
  };

  const m = useMutation<TData, Error, TVars, { snap: Snapshot }>({
    mutationKey,
    mutationFn: (vars) => latest.current.mutationFn(vars),
    onMutate: async (vars) => ({ snap: await applyPatches(qc, latest.current.patch(vars)) }),
    onError: (err, vars, ctx) => {
      if (ctx) rollback(qc, ctx.snap);
      fail(err, vars);
    },
    onSuccess: (data, vars) => {
      const o = latest.current;
      o.onSuccess?.(data, vars);
      const u = o.undo?.(vars, data);
      if (u) showUndoToast({ title: u.title, description: u.description, undoLabel: t("common.undo"), onUndo: () => void runUndo(o, u.inverse) });
    },
    onSettled: (_d, _e, vars) => settle(vars),
  });

  return { mutate: (vars: TVars) => m.mutate(vars), isPending: m.isPending, variables: m.variables };
}

// Deletes that wait out their Undo: the row goes at once, the request only
// after the toast has gone (5 s). Undo just puts the row back — nothing to
// re-create, so the note keeps its id, source and date. Leaving the page
// sends whatever is still waiting.
const waiting = new Map<number, () => void>();
let pagehideBound = false;
function bindPagehide() {
  if (pagehideBound || typeof window === "undefined") return;
  pagehideBound = true;
  window.addEventListener("pagehide", () => {
    for (const run of [...waiting.values()]) run();
  });
}

/**
 * Removes something optimistically and only commits it once the Undo window
 * has passed. For deletes that have no inverse endpoint (a note, a task).
 */
export function useUndoableRemove<TVars>(opts: {
  commit: (vars: TVars) => Promise<unknown>;
  patch: (vars: TVars) => CachePatch[];
  invalidate?: (vars: TVars) => QueryKey[];
  title: (vars: TVars) => string;
  delayMs?: number;
}) {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const latest = useRef(opts);
  latest.current = opts;

  return (vars: TVars) => {
    const o = latest.current;
    bindPagehide();
    void applyPatches(qc, o.patch(vars)).then((snap) => {
      let done = false;
      const refresh = () => {
        for (const queryKey of [...o.patch(vars).map((p) => p.queryKey), ...(o.invalidate?.(vars) ?? [])]) void qc.invalidateQueries({ queryKey });
      };
      const run = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        waiting.delete(timer);
        o.commit(vars).then(refresh, (err: Error) => {
          rollback(qc, snap);
          toast({ title: t("jobs.error"), description: err.message, variant: "destructive" });
          refresh();
        });
      };
      const timer = window.setTimeout(run, o.delayMs ?? 5000);
      waiting.set(timer, run);
      showUndoToast({
        title: o.title(vars),
        undoLabel: t("common.undo"),
        onUndo: () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          waiting.delete(timer);
          rollback(qc, snap);
        },
      });
    });
  };
}
