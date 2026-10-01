// New quote's server calls beyond the AI create (firstQuoteApi.create): POST /api/quotes/manual for the Manual and
// Price list modes, and POST /api/speech/transcribe for the mic. Same problems as the AI quote bar, plus "role" (the
// server's 403 when the person's role may not create quotes).
import { Platform } from "react-native";
import { ApiFailure, api } from "./api";
import type { manualBody } from "./newQuote.ts";
import { API_ORIGIN } from "./session";

export type CreateProblem = "offline" | "quota" | "cannot" | "unlock" | "role" | "failed";

export function problemOf(e: unknown): CreateProblem {
  if (e instanceof ApiFailure) {
    if (e.offline) return "offline";
    if (e.status === 429) return "quota";
    if (e.status === 400 || e.status === 422) return "cannot";
    if (e.status === 402) return "unlock";
    if (e.status === 403) return "role";
  }
  return "failed";
}

export type Created = { id: string; numeroPreventivoData?: string | null; totale?: number };
export type Outcome<T> = { ok: true; data: T } | { ok: false; problem: CreateProblem };

export const newQuoteApi = {
  /** The Manual and Price list modes: the quote is created from the lines the person typed or picked, no AI. */
  createManual: async (body: ReturnType<typeof manualBody>): Promise<Outcome<Created>> => {
    try {
      return { ok: true, data: await api<Created>("/api/quotes/manual", { method: "POST", body }) };
    } catch (e) {
      return { ok: false, problem: problemOf(e) };
    }
  },

  /** A recording → text. The server takes webm, ogg, wav, mp4, mpeg; the phone records m4a (audio/mp4). */
  transcribe: async (clip: { uri: string; name: string; type: string }): Promise<{ ok: true; text: string } | { ok: false; problem: "offline" | "failed" }> => {
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(clip.uri)).blob();
        form.append("audio", new Blob([blob], { type: clip.type }), clip.name);
      } else {
        form.append("audio", { uri: clip.uri, name: clip.name, type: clip.type } as unknown as Blob);
      }
      let res: Response;
      try {
        res = await fetch(`${API_ORIGIN}/api/speech/transcribe`, { method: "POST", body: form, headers: { accept: "application/json" } });
      } catch {
        return { ok: false, problem: "offline" };
      }
      const text = await res.text();
      let body: { text?: string } = {};
      try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
      if (!res.ok || typeof body.text !== "string") return { ok: false, problem: "failed" };
      return { ok: true, text: body.text.trim() };
    } catch {
      return { ok: false, problem: "failed" };
    }
  },
};
