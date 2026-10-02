// The assistant's offline outbox on the phone, and sending it when the connection is back.
import { ApiFailure } from "./api";
import { assistantApi } from "./assistantApi";
import { OUTBOX_KEY, add, parse, without, type Op } from "./assistantOutbox";
import { kvGet, kvSet } from "./kv";

export const outbox = {
  read: async (): Promise<Op[]> => parse(await kvGet(OUTBOX_KEY)),
  queue: async (op: Op): Promise<void> => kvSet(OUTBOX_KEY, JSON.stringify(add(await outbox.read(), op))),
  drop: async (type: Op["type"], id: string): Promise<void> => {
    const left = without(await outbox.read(), type, id);
    await kvSet(OUTBOX_KEY, left.length ? JSON.stringify(left) : null);
  },
};

/** Sends what waited. An op the server refuses (already decided, gone) is dropped; one that finds no signal stays. Returns how many were sent. */
export async function flushAssistantOutbox(): Promise<number> {
  let sent = 0;
  for (const op of await outbox.read()) {
    try {
      if (op.type === "approve") await assistantApi.approve(op.id, op.draft);
      else await assistantApi.undo(op.id);
      sent++;
    } catch (e) {
      if (e instanceof ApiFailure && e.offline) return sent;
    }
    await outbox.drop(op.type, op.id);
  }
  return sent;
}

// Permissions changed while offline are kept on the phone as one change and sent when the connection is back.
import { PERMISSIONS_KEY, mergePatch } from "./assistantOutbox";
import type { PermissionsPatch } from "./assistantApi";

export const pendingPermissions = {
  read: async (): Promise<PermissionsPatch | null> => {
    const raw = await kvGet(PERMISSIONS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as PermissionsPatch; } catch { return null; }
  },
  queue: async (patch: PermissionsPatch): Promise<void> => kvSet(PERMISSIONS_KEY, JSON.stringify(mergePatch(await pendingPermissions.read(), patch))),
  clear: async (): Promise<void> => kvSet(PERMISSIONS_KEY, null),
};

/** Sends what was changed offline. True when it went; false when there was nothing, or still no signal. */
export async function flushPermissions(): Promise<boolean> {
  const patch = await pendingPermissions.read();
  if (!patch) return false;
  try {
    await assistantApi.savePermissions(patch);
    await pendingPermissions.clear();
    return true;
  } catch (e) {
    if (e instanceof ApiFailure && e.offline) return false;
    await pendingPermissions.clear();
    return false;
  }
}
