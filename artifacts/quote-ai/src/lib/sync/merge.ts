// Phase 117 (docs/APP-PLAN.md "Sync II"): the field-by-field merge.
//
// An edit is a patch (the fields the person changed) made against a base (the
// row as the phone last had it from the server). When the server says the row
// has moved on (409 STALE, with the row as it is now), each field of the patch
// is one of:
//   - already so   — the row already has our value: nothing to send;
//   - ours to make — the other side left this field alone: send it again;
//   - a collision  — both sides changed it, to different values: ask.
// A field the phone never saw a base value for is treated as ours to make
// (last write wins for that field — the same as before versions existed).

export type FieldConflict = { field: string; mine: unknown; theirs: unknown; base: unknown };
export type MergeResult = { patch: Record<string, unknown>; conflicts: FieldConflict[]; alreadySo: string[] };

/** Structural equality on JSON values; `null` and a missing value are the same. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => sameValue(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!sameValue(ao[k], bo[k])) return false;
  return true;
}

export function mergeEdit(base: Record<string, unknown>, patch: Record<string, unknown>, current: Record<string, unknown>): MergeResult {
  const out: Record<string, unknown> = {};
  const conflicts: FieldConflict[] = [];
  const alreadySo: string[] = [];
  for (const [field, mine] of Object.entries(patch)) {
    if (!(field in current)) {
      out[field] = mine; // the server's row doesn't show this field: nothing to compare
      continue;
    }
    const theirs = current[field];
    if (sameValue(theirs, mine)) {
      alreadySo.push(field);
      continue;
    }
    if (!(field in base) || sameValue(theirs, base[field])) {
      out[field] = mine;
      continue;
    }
    conflicts.push({ field, mine, theirs, base: base[field] });
  }
  return { patch: out, conflicts, alreadySo };
}

/** The patch after the person chose, per colliding field, theirs (drop it) or mine (send it). */
export function resolvePatch(patch: Record<string, unknown>, conflicts: FieldConflict[], choice: Record<string, "mine" | "theirs">): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  for (const c of conflicts) {
    if (choice[c.field] === "theirs") delete out[c.field];
    else out[c.field] = c.mine;
  }
  return out;
}
