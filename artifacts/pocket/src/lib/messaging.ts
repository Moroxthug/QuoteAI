// SMS and WhatsApp: the pure parts. A message in the log gets a word, a client's name is found by the last ten digits of the number, and a meter goes amber near the end.
export type SmsRow = { id: string; direction: "outbound" | "inbound"; purpose: string; status: "sent" | "failed" | "skipped" | "received"; phone: string; body: string; createdAt: string };

export type LogState = { word: "sent" | "received" | "failed" | "skipped"; tone: "info" | "acc" | "bad" | "mute"; shape: "q1" | "dot" | "x" | "off" };

export function logState(m: Pick<SmsRow, "direction" | "status">): LogState {
  if (m.status === "failed") return { word: "failed", tone: "bad", shape: "x" };
  if (m.status === "skipped") return { word: "skipped", tone: "mute", shape: "off" };
  if (m.direction === "inbound" || m.status === "received") return { word: "received", tone: "acc", shape: "dot" };
  return { word: "sent", tone: "info", shape: "q1" };
}

/** The last ten digits: the same number written (416) 555-0142, +1 416 555 0142 or 4165550142. */
export const phoneKey = (p: string | null | undefined): string => (p ?? "").replace(/\D/g, "").slice(-10);

export function nameByPhone(clients: { name: string; phone: string | null }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of clients) { const k = phoneKey(c.phone); if (k.length === 10 && !out.has(k)) out.set(k, c.name); }
  return out;
}

const PURPOSES = new Set(["lead_followup", "quote_followup", "quote_send", "contract_reminder", "invoice_reminder", "on_my_way", "appointment_reminder", "test", "reply", "opt_out", "opt_in"]);
export const purposeKey = (p: string): string => (PURPOSES.has(p) ? p : "other");

/** A received message is shown quoted and short. */
export function snippet(body: string, max = 42): string {
  const s = body.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** A number the person typed for WhatsApp: digits with an optional +; a ten-digit one is Canadian. */
export function waNumber(raw: string): string | null {
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
