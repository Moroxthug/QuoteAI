// Phase 78 — voice-first job actions, server side. The AI host is answered
// from the vendor stub so the whole path runs without a model: transcript →
// on-site turn (system prompt in ON-SITE MODE) → propose_change_order /
// propose_job_note / propose_cost_entry → proposal rows → confirm → the same
// rows the manual routes create. Also the photo path (gallery row + image
// part in the model request), the notes CRUD, the plan gate and failures.

import { describe, test, expect, beforeAll, afterAll, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, projectsTable, changeOrdersTable, jobNotesTable, jobPhotosTable, costEntriesTable, auditLogTable, assistantMessagesTable } from "@workspace/db";
import { startServer, stopServer, createOrg, cleanupAll } from "./harness.js";
import { seedShowcase } from "./fixtures.js";
import { installVendorStubs, stubHost, unstubHost, requestsTo, resetRecorded, json, type StubbedRequest } from "./vendorStub.js";

const AI = "http://127.0.0.1:9/";
const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

type ToolCall = { name: string; args: Record<string, unknown> };
type Script = { transcript?: string; first: ToolCall; afterError?: ToolCall; reply?: string };

const toolCallResponse = (calls: ToolCall[]) =>
  json(200, { id: "chatcmpl-e2e", object: "chat.completion", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: calls.map((c, i) => ({ id: `call_${i + 1}`, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } }] });
const textResponse = (text: string) => json(200, { id: "chatcmpl-e2e", object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: text } }] });

type ChatBody = { messages: { role: string; content: unknown; tool_calls?: unknown[] }[] };
function chatBodies(): ChatBody[] {
  return requestsTo(AI).filter((r) => r.url.endsWith("/chat/completions")).map((r) => r.json as ChatBody);
}

/** A model that calls `first`, retries with `afterError` when the tool answers with an error, then replies. */
function scriptModel(script: Script) {
  let usedFallback = false;
  stubHost(AI, (req: StubbedRequest) => {
    if (req.url.endsWith("/audio/transcriptions")) return json(200, { text: script.transcript ?? "" });
    const body = req.json as ChatBody;
    const last = body.messages[body.messages.length - 1]!;
    if (last.role === "tool") {
      const result = JSON.parse(String(last.content)) as { error?: string };
      if (result.error && script.afterError && !usedFallback) {
        usedFallback = true;
        return toolCallResponse([script.afterError]);
      }
      return textResponse(script.reply ?? "Proposed — confirm the card.");
    }
    return toolCallResponse([script.first]);
  });
}

describe("Voice-first job actions (Phase 78)", () => {
  let org: Awaited<ReturnType<typeof createOrg>>;
  let signedJobId: string;
  let bareJobId: string;

  beforeAll(async () => {
    await startServer();
    installVendorStubs();
    org = await createOrg({ plan: "monthly_elite", province: "ON" });
    const showcase = await seedShowcase(org);
    signedJobId = showcase.jobId;
    const [bare] = await db.insert(projectsTable).values({ userId: org.userId, name: "No-contract job", status: "active", province: "ON" }).returning();
    bareJobId = bare!.id;
  }, 180_000);

  afterEach(() => {
    unstubHost(AI);
    resetRecorded();
  });

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("typed instruction → change-order proposal with ON tax → confirm → CO-01 draft + document", async () => {
    scriptModel({ first: { name: "propose_change_order", args: { title: "Extra outlet in the garage", description: "Client asked for one more 20 A outlet on the north wall.", items: [{ description: "Extra outlet in the garage", unit_price: 250 }] } }, reply: "One card: change order for $250 plus tax. Confirm to draft it." });
    const res = await org.api("/api/assistant/actions", { body: { projectId: signedJobId, text: "add a change order: extra outlet in the garage, 250 dollars", language: "en" } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.proposals).toHaveLength(1);
    const p = res.body.proposals[0];
    expect(p.kind).toBe("change_order");
    expect(p.status).toBe("pending");
    expect(p.payload.subtotalCents).toBe(25000);
    expect(p.payload.taxCents).toBe(3250); // 13 % HST
    expect(p.payload.totalCents).toBe(28250);
    expect(p.payload.items[0]).toMatchObject({ descrizione: "Extra outlet in the garage", quantita: 1, prezzoUnitario: 250, totale: 250 });
    expect(p.summary).toContain("$282.50");
    expect(res.body.messages.some((m: { role: string; content: string }) => m.role === "assistant" && m.content.includes("Confirm"))).toBe(true);

    // The turn ran in on-site mode with the job as context.
    const bodies = chatBodies();
    expect(bodies.length).toBe(2);
    const system = String(bodies[0]!.messages[0]!.content);
    expect(system).toContain("ON-SITE MODE");
    expect(system).toContain(`id ${signedJobId}`);
    expect(bodies[0]!.messages[0]!.role).toBe("system");
    // Nothing written before confirmation.
    expect((await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.projectId, signedJobId))).length).toBe(0);

    const confirm = await org.api(`/api/assistant/proposals/${p.id}/confirm`, { body: {} });
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(200);
    expect(confirm.body.proposal.status).toBe("confirmed");
    expect(confirm.body.proposal.resultEntityType).toBe("change_order");
    expect(confirm.body.link).toBe(`/dashboard/jobs/${signedJobId}?tab=changes`);
    const [co] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.projectId, signedJobId));
    expect(co).toBeDefined();
    expect(co!.number).toBe("CO-01");
    expect(co!.status).toBe("draft");
    expect(co!.totalCents).toBe(28250);
    expect(co!.documentContractId).toBeTruthy();
    // Draft: the job value does not move until it is signed.
    const [job] = await db.select().from(projectsTable).where(eq(projectsTable.id, signedJobId));
    expect(job!.changeOrdersCents).toBe(0);
    const audits = await db.select().from(auditLogTable).where(and(eq(auditLogTable.entityType, "change_order"), eq(auditLogTable.entityId, co!.id)));
    expect(audits.some((a) => a.action === "created_via_assistant" && a.actorType === "ai")).toBe(true);
    // Twice is a 409.
    const again = await org.api(`/api/assistant/proposals/${p.id}/confirm`, { body: {} });
    expect(again.status).toBe(409);
  });

  test("no signed contract → the tool refuses, the model falls back to a note → confirm → job_notes row (source voice)", async () => {
    scriptModel({
      first: { name: "propose_change_order", args: { title: "Extra outlet", items: [{ description: "Extra outlet", unit_price: 250 }] } },
      afterError: { name: "propose_job_note", args: { body: "Change order wanted: extra outlet in the garage, $250 — needs a signed contract first." } },
      reply: "No signed contract on this job, so I saved it as a note instead.",
    });
    const res = await org.api("/api/assistant/actions", { body: { projectId: bareJobId, text: "add a change order: extra outlet in the garage, 250 dollars" } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.proposals).toHaveLength(1);
    const p = res.body.proposals[0];
    expect(p.kind).toBe("job_note");
    expect(p.payload.source).toBe("voice");
    // The tool's error reached the model verbatim.
    const bodies = chatBodies();
    const toolMsg = bodies[1]!.messages.filter((m) => m.role === "tool")[0]!;
    expect(String(toolMsg.content)).toContain("no signed contract");

    const confirm = await org.api(`/api/assistant/proposals/${p.id}/confirm`, { body: {} });
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(200);
    expect(confirm.body.link).toBe(`/dashboard/jobs/${bareJobId}?tab=overview`);
    const notes = await db.select().from(jobNotesTable).where(eq(jobNotesTable.projectId, bareJobId));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.source).toBe("voice");
    expect(notes[0]!.body).toContain("extra outlet");
    const list = await org.api(`/api/jobs/${bareJobId}/notes`);
    expect(list.status).toBe(200);
    expect(list.body.notes[0].source).toBe("voice");
  });

  test("voice multipart → transcript → cost proposal; the transcript is the user message in the job's thread", async () => {
    scriptModel({ transcript: "log three forty at Home Depot for drywall", first: { name: "propose_cost_entry", args: { category: "materials", vendor: "Home Depot", description: "Drywall", amount: 340, tax_included: true } }, reply: "One card: $340 of materials at Home Depot." });
    const fd = new FormData();
    fd.append("audio", new Blob([Buffer.alloc(2048, 1)], { type: "audio/webm;codecs=opus" }), "recording.webm");
    fd.append("projectId", signedJobId);
    fd.append("language", "en");
    const res = await org.api("/api/assistant/voice", { method: "POST", form: fd });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.transcript).toBe("log three forty at Home Depot for drywall");
    expect(res.body.proposals).toHaveLength(1);
    const p = res.body.proposals[0];
    expect(p.kind).toBe("cost_entry");
    expect(p.payload.totalCents).toBe(34000);
    expect(p.payload.vendor).toBe("Home Depot");
    // Whisper was asked in the user's language; the chat turn saw the transcript as the user message.
    const stt = requestsTo(AI).find((r) => r.url.endsWith("/audio/transcriptions"));
    expect(stt).toBeDefined();
    expect(stt!.body).toBe("[multipart]");
    const bodies = chatBodies();
    const user = bodies[0]!.messages.filter((m) => m.role === "user").pop()!;
    expect(user.content).toBe("log three forty at Home Depot for drywall");

    // Same conversation as the Assistant tab.
    const conv = await org.api(`/api/assistant/conversation?projectId=${signedJobId}`);
    expect(conv.status).toBe(200);
    expect(conv.body.conversation.id).toBe(res.body.conversationId);
    expect(conv.body.messages.some((m: { role: string; content: string }) => m.role === "user" && m.content === "log three forty at Home Depot for drywall")).toBe(true);
    expect(conv.body.proposals.some((x: { id: string }) => x.id === p.id)).toBe(true);

    const confirm = await org.api(`/api/assistant/proposals/${p.id}/confirm`, { body: {} });
    expect(confirm.status).toBe(200);
    const costs = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.projectId, signedJobId), eq(costEntriesTable.vendor, "Home Depot")));
    expect(costs).toHaveLength(1);
    expect(costs[0]!.createdBy).toBe("ai");
  });

  test("photo multipart → gallery row + image part in the model request → note linked to the photo", async () => {
    scriptModel({ first: { name: "propose_job_note", args: { body: "Knob-and-tube wiring visible behind the kitchen drywall — needs an electrician before closing up." } }, reply: "That looks like knob-and-tube. I proposed a note." });
    const fd = new FormData();
    fd.append("photo", new Blob([pngBytes], { type: "image/png" }), "kitchen.png");
    fd.append("projectId", signedJobId);
    fd.append("note", "found this behind the drywall in the kitchen");
    const res = await org.api("/api/assistant/photo", { method: "POST", form: fd });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.photo?.id).toBeTruthy();
    expect(res.body.photo.caption).toBe("found this behind the drywall in the kitchen");
    const [photo] = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.id, res.body.photo.id));
    expect(photo?.projectId).toBe(signedJobId);
    expect(photo?.fileName).toBe("kitchen.png");

    // The model got the text + the image (once), and the stored message keeps only the text.
    const bodies = chatBodies();
    const user = bodies[0]!.messages.filter((m) => m.role === "user").pop()!;
    expect(Array.isArray(user.content)).toBe(true);
    const parts = user.content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(parts.find((x) => x.type === "text")?.text).toBe("[Photo] found this behind the drywall in the kitchen");
    expect(parts.find((x) => x.type === "image_url")?.image_url?.url.startsWith("data:image/png;base64,")).toBe(true);
    const secondUser = bodies[1]!.messages.filter((m) => m.role === "user").pop()!;
    expect(Array.isArray(secondUser.content)).toBe(true); // same in-memory turn
    const stored = await db.select().from(assistantMessagesTable).where(eq(assistantMessagesTable.conversationId, res.body.conversationId));
    expect(stored.some((m) => m.role === "user" && m.content === "[Photo] found this behind the drywall in the kitchen")).toBe(true);
    expect(stored.every((m) => !m.content.includes("base64"))).toBe(true);
    expect(String(bodies[0]!.messages[0]!.content)).toContain("With a photo");

    const p = res.body.proposals[0];
    expect(p.kind).toBe("job_note");
    expect(p.payload.source).toBe("photo");
    expect(p.payload.photoId).toBe(res.body.photo.id);
    const confirm = await org.api(`/api/assistant/proposals/${p.id}/confirm`, { body: {} });
    expect(confirm.status).toBe(200);
    const [note] = await db.select().from(jobNotesTable).where(eq(jobNotesTable.id, confirm.body.proposal.resultEntityId));
    expect(note?.photoId).toBe(res.body.photo.id);
    expect(note?.source).toBe("photo");

    // HEIC is stored by the gallery route but refused here (the vision model cannot read it) — before anything is saved.
    const heic = new FormData();
    heic.append("photo", new Blob([pngBytes], { type: "image/heic" }), "site.heic");
    heic.append("projectId", signedJobId);
    const refused = await org.api("/api/assistant/photo", { method: "POST", form: heic });
    expect(refused.status).toBe(415);
    expect((await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.projectId, signedJobId))).length).toBe(1);
  });

  test("notes CRUD on the job page", async () => {
    const created = await org.api(`/api/jobs/${signedJobId}/notes`, { body: { body: "Client wants the trim white" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.note.source).toBe("manual");
    expect(created.body.note.authorName).toBe(org.name);
    const list = await org.api(`/api/jobs/${signedJobId}/notes`);
    expect(list.body.notes.map((n: { body: string }) => n.body)).toContain("Client wants the trim white");
    expect(list.body.notes[0].body).toBe("Client wants the trim white"); // newest first
    const empty = await org.api(`/api/jobs/${signedJobId}/notes`, { body: { body: "   " } });
    expect(empty.status).toBe(400);
    const foreignMilestone = await org.api(`/api/jobs/${signedJobId}/notes`, { body: { body: "x", milestoneId: "00000000-0000-4000-8000-000000000000" } });
    expect(foreignMilestone.status).toBe(404);
    // Another company cannot see or delete it.
    const other = await createOrg({ plan: "monthly_elite" });
    expect((await other.api(`/api/jobs/${signedJobId}/notes`)).status).toBe(404);
    expect((await other.api(`/api/jobs/${signedJobId}/notes/${created.body.note.id}`, { method: "DELETE" })).status).toBe(404);
    const del = await org.api(`/api/jobs/${signedJobId}/notes/${created.body.note.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect((await org.api(`/api/jobs/${signedJobId}/notes/${created.body.note.id}`, { method: "DELETE" })).status).toBe(404);
  });

  test("plan gate, foreign job, model failure and an empty transcript", async () => {
    const starter = await createOrg({ plan: "monthly_starter" });
    const [job] = await db.insert(projectsTable).values({ userId: starter.userId, name: "Starter job", status: "active" }).returning();
    const gated = await starter.api("/api/assistant/actions", { body: { projectId: job!.id, text: "note: hello" } });
    expect(gated.status).toBe(403);
    expect(gated.body.error).toBe("PLAN_REQUIRED");
    expect(gated.body.requiredPlan).toBe("monthly_elite");

    const foreign = await org.api("/api/assistant/actions", { body: { projectId: job!.id, text: "note: hello" } });
    expect(foreign.status).toBe(404);

    stubHost(AI, () => json(500, { error: { message: "boom" } }));
    const down = await org.api("/api/assistant/actions", { body: { projectId: signedJobId, text: "note: hello" } });
    expect(down.status).toBe(502);
    expect(down.body.error).toBe("ASSISTANT_FAILED");
    resetRecorded(); // the SDK retried that 500 twice

    stubHost(AI, (req) => (req.url.endsWith("/audio/transcriptions") ? json(200, { text: "   " }) : json(500, {})));
    const fd = new FormData();
    fd.append("audio", new Blob([Buffer.alloc(512, 1)], { type: "audio/webm" }), "recording.webm");
    fd.append("projectId", signedJobId);
    const silent = await org.api("/api/assistant/voice", { method: "POST", form: fd });
    expect(silent.status).toBe(422);
    expect(silent.body.error).toBe("EMPTY_TRANSCRIPT");
    expect(chatBodies().length).toBe(0);

    const badType = new FormData();
    badType.append("audio", new Blob([Buffer.alloc(512, 1)], { type: "text/plain" }), "notes.txt");
    badType.append("projectId", signedJobId);
    expect((await org.api("/api/assistant/voice", { method: "POST", form: badType })).status).toBe(400);
  });
});
