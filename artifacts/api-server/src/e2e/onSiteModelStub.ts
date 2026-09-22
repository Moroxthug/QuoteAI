// Phase 78 — a keyword "model" for the walkthrough server when no real AI key
// is set (.env.staging carries the Groq key as an empty Sensitive var, so the
// client is pointed at a closed port). It answers the OpenAI-compatible host
// with just enough to click the job page's Dictate / Photo sheet through:
// a fixed transcript, one propose_* tool call picked from the wording of the
// last user message, then a one-line reply. Every other AI feature keeps its
// deterministic fallback (it only answers chat turns that carry tools, i.e.
// the assistant). Not used by the e2e suite, which scripts its own model.
import { stubHost, json, type StubbedRequest } from "./vendorStub.js";

type Part = { type: string; text?: string };
type Msg = { role: string; content: string | Part[] | null };

function textOf(m: Msg | undefined): string {
  if (!m || m.content === null) return "";
  if (typeof m.content === "string") return m.content;
  return m.content.map((p) => p.text ?? "").join(" ");
}
function hasImage(m: Msg | undefined): boolean {
  return !!m && Array.isArray(m.content) && m.content.some((p) => p.type === "image_url");
}

function pickTool(user: Msg | undefined): { name: string; arguments: string } {
  const text = textOf(user);
  const lower = text.toLowerCase();
  const money = /(\d+(?:[.,]\d{1,2})?)\s*(?:\$|dollars?|bucks|piasses?)|\$\s*(\d+(?:[.,]\d{1,2})?)/.exec(lower);
  const amount = money ? Number((money[1] ?? money[2] ?? "0").replace(",", ".")) : 0;
  if (hasImage(user)) {
    return { name: "propose_job_note", arguments: JSON.stringify({ body: `Site photo: exposed wiring behind the drywall — looks like knob-and-tube; have an electrician confirm before closing up.${text.replace(/^\[Photo\]\s*/, "").trim() ? ` (${text.replace(/^\[Photo\]\s*/, "").trim()})` : ""}` }) };
  }
  if (/change order|avenant|extra\b/.test(lower)) {
    const title = text.replace(/^.*?(?:change order|avenant)\s*:?\s*/i, "").replace(/,?\s*\d+.*$/, "").trim() || "Extra work";
    return { name: "propose_change_order", arguments: JSON.stringify({ title: title.charAt(0).toUpperCase() + title.slice(1), description: text, items: [{ description: title, unit_price: amount || 250 }] }) };
  }
  if (/^note\b|^\s*note\s*:|remember|client wants|le client veut/.test(lower)) {
    return { name: "propose_job_note", arguments: JSON.stringify({ body: text.replace(/^\s*note\s*:?\s*/i, "").trim() || text }) };
  }
  if (amount > 0 || /\blog\b|spent|paid|bought|acheté|payé/.test(lower)) {
    const vendor = /\bat\s+([A-Z][\w' ]+?)(?:\s+for|\s*,|$)/.exec(text)?.[1]?.trim() ?? (/chez\s+([A-Z][\w' ]+?)(?:\s+pour|\s*,|$)/.exec(text)?.[1]?.trim() ?? "");
    const description = /\bfor\s+(.+?)$/i.exec(text)?.[1]?.trim() ?? (/\bpour\s+(.+?)$/i.exec(text)?.[1]?.trim() ?? "");
    return { name: "propose_cost_entry", arguments: JSON.stringify({ category: "materials", vendor, description, amount: amount || 100, tax_included: true }) };
  }
  return { name: "propose_job_note", arguments: JSON.stringify({ body: text }) };
}

/** Answer the closed-port AI base URL with the keyword model. Call once, before the app is imported. */
export function installOnSiteModelStub(baseUrl: string): void {
  const origin = new URL(baseUrl).origin + "/";
  stubHost(origin, (req: StubbedRequest) => {
    if (req.url.endsWith("/audio/transcriptions")) return json(200, { text: "log 340 dollars at Home Depot for drywall" });
    if (!req.url.endsWith("/chat/completions")) return json(599, { error: "walkthrough: AI call without a stub", url: req.url });
    const body = (req.json ?? {}) as { messages?: Msg[]; tools?: unknown[] };
    if (!body.tools?.length) return json(599, { error: "walkthrough: no AI key — fallback path", url: req.url });
    const messages = body.messages ?? [];
    const last = messages[messages.length - 1];
    if (last?.role === "tool") {
      const result = JSON.parse(String(last.content ?? "{}")) as { error?: string; summary?: string };
      // A refused tool (e.g. change order without a signed contract) → keep the words as a note, once.
      const priorNote = messages.some((m) => m.role === "assistant" && JSON.stringify(m).includes("propose_job_note"));
      if (result.error && !priorNote) {
        const user = [...messages].reverse().find((m) => m.role === "user");
        const call = { name: "propose_job_note", arguments: JSON.stringify({ body: `${textOf(user).replace(/^\[Photo\]\s*/, "")} — not done: ${result.error.split(".")[0]}.` }) };
        return json(200, { id: "chatcmpl-walkthrough", object: "chat.completion", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "call_2", type: "function", function: call }] } }] });
      }
      const text = result.error ? `I couldn't do that: ${result.error}` : `Proposed: ${result.summary ?? "see the card"}. Nothing is saved until you confirm.`;
      return json(200, { id: "chatcmpl-walkthrough", object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: text } }] });
    }
    const user = [...messages].reverse().find((m) => m.role === "user");
    const call = pickTool(user);
    console.log(`\n[ai] on-site turn → ${call.name} ${call.arguments.slice(0, 90)}`);
    return json(200, { id: "chatcmpl-walkthrough", object: "chat.completion", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: call }] } }] });
  });
}
