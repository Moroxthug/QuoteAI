// Phase 117: stand-in ids of queued creates — `q_` + the outbox row's id (a
// UUID). Later queued edits of that row use it; the replay swaps in the real one.
export const TEMP_ID_RE = /q_[0-9a-fA-F-]{8,64}/g;
export const tempIdFor = (rowId: string) => `q_${rowId}`;
