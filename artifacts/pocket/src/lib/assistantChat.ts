// HomeAI.dc.html's assistant layer: what the orb is doing (listen, think, speak, mute, idle), how far it swells, and a reply shown a word at a time. Pure, so it can be tested.
export type Mood = "listen" | "think" | "speak" | "mute" | "idle";

/** What the orb does at second `t`: busy wins, then muted, then (in voice mode) the board's 9.5 s cycle of listening, thinking and speaking. */
export function moodAt(t: number, o: { voice: boolean; muted: boolean; busy: Mood | null; cycle?: boolean }): Mood {
  if (o.busy) return o.busy;
  if (o.muted) return "mute";
  if (!o.voice) return "idle";
  if (!o.cycle) return "listen";
  const c = t % 9.5;
  return c < 3.8 ? "listen" : c < 5.2 ? "think" : "speak";
}

/** How far the orb swells (0 to 1) for a mood at second `t`, without the board's random jitter. */
export function ampFor(mood: Mood, t: number): number {
  switch (mood) {
    case "listen": return 0.12 + 0.34 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 7.7));
    case "speak": return 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * 8.6)), 2) * (0.55 + 0.45 * Math.sin(t * 1.9));
    case "think": return 0.1 + 0.05 * Math.sin(t * 6);
    case "idle": return 0.08 + 0.04 * Math.sin(t * 1.4);
    case "mute": return 0.02;
  }
}

export const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);

/** The first `n` words of a reply, as it is shown while it "types". */
export const firstWords = (text: string, n: number): string => words(text).slice(0, Math.max(0, n)).join(" ");

/** The reply the person reads: the assistant's last answer in a turn that has text. */
export function lastReply(messages: { role: string; content: string | null }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === "assistant" && m.content && m.content.trim()) return m.content.trim();
  }
  return "";
}
