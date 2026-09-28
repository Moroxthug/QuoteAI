import type { Change } from "./affects";

// Phase 117 (docs/APP-PLAN.md "Sync II"): the edits that go through the sync
// layer (lib/sync/sync-fetch.ts). For each one:
//   - it is queued when there is no signal (or the request dies on the way)
//     and replayed later with the same Idempotency-Key;
//   - `versioned` edits carry the row's version and are merged field by field
//     when the row changed elsewhere (409 STALE);
//   - `echo` is the answer a queued request gets right away, shaped like the
//     route's real answer (the row as the phone knows it, with the edit on
//     top), so the screen that sent it carries on as if it had gone through;
//   - a queued create gets a stand-in id `q_<outbox id>`; later queued edits
//     of that row use it, and the replay swaps in the real id.
// Any other request is sent as it always was (with an Idempotency-Key).

type Row = Record<string, unknown>;
type EchoInput = { body: Row; row: Row; tempId: string; params: string[] };

type SyncRoute = {
  name: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  pattern: RegExp;
  entity: string;
  /** Capture group (1-based) holding the edited row's id. */
  idGroup?: number;
  /** Capture group holding the job the row belongs to. */
  jobGroup?: number;
  versioned?: boolean;
  /** i18n key of the outbox label ("Task ticked · Basement finish"). */
  label: string;
  echo: (e: EchoInput) => unknown;
  /** For creates: the real id in the server's answer. */
  createdId?: (response: Row) => string | null;
};

const merged = (e: EchoInput) => ({ ...e.row, ...e.body });
const nowIso = () => new Date().toISOString();
const idOf = (key: string) => (r: Row) => {
  const v = r[key] as Row | undefined;
  return typeof v?.id === "string" ? v.id : null;
};

const ID = "([^/?#]+)";

const SYNC_ROUTES: SyncRoute[] = [
  { name: "job.edit", method: "PUT", pattern: new RegExp(`^/api/jobs/${ID}$`), entity: "job", idGroup: 1, jobGroup: 1, versioned: true, label: "sync.op.jobEdit", echo: (e) => ({ job: merged(e) }) },
  { name: "milestone.edit", method: "PUT", pattern: new RegExp(`^/api/jobs/${ID}/milestones/${ID}$`), entity: "milestone", idGroup: 2, jobGroup: 1, versioned: true, label: "sync.op.milestoneEdit", echo: (e) => ({ milestone: merged(e) }) },
  {
    name: "task.add",
    method: "POST",
    pattern: new RegExp(`^/api/jobs/${ID}/tasks$`),
    entity: "task",
    jobGroup: 1,
    label: "sync.op.taskAdd",
    echo: (e) => ({ task: { id: e.tempId, milestoneId: e.body.milestoneId ?? null, title: e.body.title ?? "", description: "", status: "todo", dueDate: e.body.dueDate ?? null, sortOrder: 0, addedFromFieldBy: null, updatedAt: nowIso() } }),
    createdId: idOf("task"),
  },
  { name: "task.edit", method: "PATCH", pattern: new RegExp(`^/api/jobs/${ID}/tasks/${ID}$`), entity: "task", idGroup: 2, jobGroup: 1, versioned: true, label: "sync.op.taskEdit", echo: (e) => ({ task: merged(e) }) },
  { name: "task.delete", method: "DELETE", pattern: new RegExp(`^/api/jobs/${ID}/tasks/${ID}$`), entity: "task", idGroup: 2, jobGroup: 1, label: "sync.op.taskDelete", echo: () => ({ success: true }) },
  {
    name: "note.add",
    method: "POST",
    pattern: new RegExp(`^/api/jobs/${ID}/notes$`),
    entity: "note",
    jobGroup: 1,
    label: "sync.op.noteAdd",
    echo: (e) => ({ note: { id: e.tempId, projectId: e.params[0], milestoneId: e.body.milestoneId ?? null, photoId: null, body: e.body.body ?? "", source: "manual", authorName: "", createdAt: nowIso() } }),
    createdId: idOf("note"),
  },
  { name: "note.delete", method: "DELETE", pattern: new RegExp(`^/api/jobs/${ID}/notes/${ID}$`), entity: "note", idGroup: 2, jobGroup: 1, label: "sync.op.noteDelete", echo: () => ({ success: true }) },
  { name: "cost.edit", method: "PUT", pattern: new RegExp(`^/api/jobs/${ID}/costs/${ID}$`), entity: "cost", idGroup: 2, jobGroup: 1, versioned: true, label: "sync.op.costEdit", echo: (e) => ({ entry: merged(e) }) },
  { name: "cost.delete", method: "DELETE", pattern: new RegExp(`^/api/jobs/${ID}/costs/${ID}$`), entity: "cost", idGroup: 2, jobGroup: 1, label: "sync.op.costDelete", echo: () => ({ success: true }) },
  { name: "quote.edit", method: "PUT", pattern: new RegExp(`^/api/quotes/${ID}$`), entity: "quote", idGroup: 1, versioned: true, label: "sync.op.quoteEdit", echo: (e) => merged(e) },
  { name: "invoice.edit", method: "PUT", pattern: new RegExp(`^/api/invoices/${ID}$`), entity: "invoice", idGroup: 1, versioned: true, label: "sync.op.invoiceEdit", echo: (e) => ({ invoice: merged(e), html: "" }) },
  { name: "schedule.edit", method: "PUT", pattern: new RegExp(`^/api/schedule/blocks/${ID}$`), entity: "schedule", idGroup: 1, versioned: true, label: "sync.op.scheduleEdit", echo: (e) => ({ block: { conflicts: [], ...merged(e) } }) },
  { name: "lead.edit", method: "PATCH", pattern: new RegExp(`^/api/leads/${ID}$`), entity: "lead", idGroup: 1, versioned: true, label: "sync.op.leadEdit", echo: (e) => ({ lead: merged(e) }) },
];

export type RouteMatch = { route: SyncRoute; params: string[]; id: string | null; jobId: string | null };

export function matchRoute(method: string, pathname: string): RouteMatch | null {
  const m = method.toUpperCase();
  for (const route of SYNC_ROUTES) {
    if (route.method !== m) continue;
    const hit = route.pattern.exec(pathname);
    if (!hit) continue;
    const params = hit.slice(1).map((p) => decodeURIComponent(p));
    return { route, params, id: route.idGroup ? params[route.idGroup - 1]! : null, jobId: route.jobGroup ? params[route.jobGroup - 1]! : null };
  }
  return null;
}

/** What a finished edit changed, for `affects()` (lib/sync/affects.ts). */
export function changeOf(match: RouteMatch): Change {
  const { route, id, jobId } = match;
  return { entity: route.entity, id: route.entity === "job" ? jobId : id, parentId: route.entity === "job" ? null : jobId };
}

