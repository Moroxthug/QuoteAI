import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { idempotency, type IdempotencyStore, type IdempotencyRecord, type IdempotencyId } from "./idempotency";

// Phase 117: the middleware against an in-memory store — a replay gets the
// first answer, the work runs once, 5xx and non-JSON answers free the key,
// a different body is refused and a claim left behind is taken over.

function memoryStore() {
  const rows = new Map<string, IdempotencyRecord>();
  const k = (id: IdempotencyId) => `${id.key}|${id.method}|${id.path}`;
  const store: IdempotencyStore = {
    async claim(id, fingerprint) {
      if (rows.has(k(id))) return false;
      rows.set(k(id), { fingerprint, responseStatus: null, responseBody: null, createdAt: new Date() });
      return true;
    },
    async get(id) {
      return rows.get(k(id)) ?? null;
    },
    async complete(id, status, body) {
      const r = rows.get(k(id));
      if (r) rows.set(k(id), { ...r, responseStatus: status, responseBody: body });
    },
    async release(id) {
      rows.delete(k(id));
    },
  };
  return { store, rows };
}

const mem = memoryStore();
let clock = Date.now();
let runs = 0;
let base = "";
let server: Server;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", idempotency(mem.store, () => clock));
  app.post("/api/notes", (req, res) => {
    runs++;
    res.status(201).json({ note: { id: `n${runs}`, body: req.body.body } });
  });
  app.post("/api/flaky", (_req, res) => {
    runs++;
    res.status(503).json({ error: "down" });
  });
  app.post("/api/file", (_req, res) => {
    runs++;
    res.type("text/plain").send("ok");
  });
  app.post("/api/slow", async (_req, res) => {
    runs++;
    await new Promise((r) => setTimeout(r, 300));
    res.json({ ok: true });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  base = typeof addr === "object" && addr ? `http://127.0.0.1:${addr.port}` : "";
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const post = (path: string, body: unknown, key?: string) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body) });

describe("idempotency middleware", () => {
  it("runs a keyed request once and replays its answer", async () => {
    runs = 0;
    const a = await post("/api/notes", { body: "hi" }, "key-0001-aaaa");
    const b = await post("/api/notes", { body: "hi" }, "key-0001-aaaa");
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers.get("idempotent-replayed")).toBe("true");
    expect(await b.json()).toEqual(await a.json());
    expect(runs).toBe(1);
  });

  it("leaves requests without a key alone", async () => {
    runs = 0;
    await post("/api/notes", { body: "x" });
    await post("/api/notes", { body: "x" });
    expect(runs).toBe(2);
  });

  it("refuses the same key with a different body", async () => {
    await post("/api/notes", { body: "one" }, "key-0002-bbbb");
    const r = await post("/api/notes", { body: "two" }, "key-0002-bbbb");
    expect(r.status).toBe(422);
  });

  it("frees the key after a 5xx so the retry runs again", async () => {
    runs = 0;
    await post("/api/flaky", {}, "key-0003-cccc");
    await new Promise((r) => setTimeout(r, 20));
    await post("/api/flaky", {}, "key-0003-cccc");
    expect(runs).toBe(2);
  });

  it("does not keep a non-JSON answer", async () => {
    runs = 0;
    await post("/api/file", {}, "key-0004-dddd");
    await new Promise((r) => setTimeout(r, 20));
    await post("/api/file", {}, "key-0004-dddd");
    expect(runs).toBe(2);
  });

  it("answers 409 in progress while the first request still runs", async () => {
    runs = 0;
    const first = post("/api/slow", {}, "key-0005-eeee");
    await new Promise((r) => setTimeout(r, 50));
    const second = await post("/api/slow", {}, "key-0005-eeee");
    expect(second.status).toBe(409);
    expect((await second.json()).code).toBe("IDEMPOTENCY_IN_PROGRESS");
    expect((await first).status).toBe(200);
    expect(runs).toBe(1);
  });

  it("takes over a claim whose request never finished", async () => {
    runs = 0;
    await mem.store.claim({ key: "key-0006-ffff", method: "POST", path: "/api/notes" }, null);
    clock += 5 * 60_000;
    const r = await post("/api/notes", { body: "late" }, "key-0006-ffff");
    expect(r.status).toBe(201);
    expect(runs).toBe(1);
  });

  it("rejects a malformed key", async () => {
    const r = await post("/api/notes", { body: "x" }, "bad key!");
    expect(r.status).toBe(400);
  });
});
