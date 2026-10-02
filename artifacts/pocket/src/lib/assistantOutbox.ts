// What the person approved or undid while offline waits on the phone and goes out when the connection is back (AssistantProposals / Activity
// "Sends when online", "Undo pending"). The list handling is pure and tested; the phone's storage and the sending are in assistantSync.ts.
export type Op = { type: "approve"; id: string; draft?: string } | { type: "undo"; id: string };

export const OUTBOX_KEY = "quoteai_assistant_outbox";

export function parse(raw: string | null): Op[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((o): o is Op => !!o && typeof o === "object" && ((o as Op).type === "approve" || (o as Op).type === "undo") && typeof (o as Op).id === "string") : [];
  } catch {
    return [];
  }
}

/** Adds an op; a second one for the same thing replaces the first (an edited draft, or the same undo twice). */
export const add = (ops: Op[], op: Op): Op[] => [...ops.filter((o) => !(o.type === op.type && o.id === op.id)), op];
export const without = (ops: Op[], type: Op["type"], id: string): Op[] => ops.filter((o) => !(o.type === type && o.id === id));

export const PERMISSIONS_KEY = "quoteai_assistant_permissions_pending";

type Patch = {
  levels?: Record<string, number>;
  quiet?: Record<string, number | boolean>;
  spendLimitCents?: number;
  readBack?: boolean;
};

/** Two changes made while offline become one: the later wins where both set the same thing. */
export function mergePatch<T extends Patch>(a: T | null | undefined, b: T): T {
  return {
    ...(a ?? {}), ...b,
    ...(a?.levels || b.levels ? { levels: { ...(a?.levels ?? {}), ...(b.levels ?? {}) } } : null),
    ...(a?.quiet || b.quiet ? { quiet: { ...(a?.quiet ?? {}), ...(b.quiet ?? {}) } } : null),
  } as T;
}
