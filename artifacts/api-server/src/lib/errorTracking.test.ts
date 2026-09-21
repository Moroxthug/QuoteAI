// Phase 69: the dependency-free Sentry client (@workspace/error-reporting)
// that both apps report through. Pins the DSN parsing, the stack → frames
// conversion (both V8 and Gecko formats, innermost frame last), the debug-id
// lookup that makes uploaded source maps match, and the envelope wire format.

import { describe, expect, test } from "vitest";
import { buildEvent, debugIdImages, parseDsn, parseStack, sendEvent, serializeEnvelope } from "@workspace/error-reporting";

const DSN = "https://abc123@o4507.ingest.us.sentry.io/4509";

describe("parseDsn", () => {
  test("extracts key, host and project and builds the envelope URL", () => {
    const dsn = parseDsn(DSN)!;
    expect(dsn.publicKey).toBe("abc123");
    expect(dsn.host).toBe("o4507.ingest.us.sentry.io");
    expect(dsn.projectId).toBe("4509");
    expect(dsn.envelopeUrl).toBe("https://o4507.ingest.us.sentry.io/api/4509/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=quoteai.error-reporting%2F1.0.0");
  });
  test("rejects garbage and empty values", () => {
    expect(parseDsn("")).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("not a dsn")).toBeNull();
    expect(parseDsn("https://sentry.io/123")).toBeNull();
  });
});

describe("parseStack", () => {
  test("V8 frames, innermost last, node internals not in_app", () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'x')",
      "    at handler (/var/task/artifacts/api-server/dist/app.mjs:120:15)",
      "    at async Layer.handle (/var/task/node_modules/express/lib/router/layer.js:95:5)",
      "    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
      "    at /var/task/artifacts/api-server/dist/app.mjs:10:2",
    ].join("\n");
    const frames = parseStack(stack);
    expect(frames).toHaveLength(4);
    expect(frames[frames.length - 1]).toEqual({ filename: "/var/task/artifacts/api-server/dist/app.mjs", function: "handler", lineno: 120, colno: 15, in_app: true });
    expect(frames[0]).toEqual({ filename: "/var/task/artifacts/api-server/dist/app.mjs", lineno: 10, colno: 2, in_app: true });
    expect(frames[1]!.in_app).toBe(false);
    expect(frames[2]!.function).toBe("Layer.handle");
  });
  test("Windows paths keep their drive letter", () => {
    const [f] = parseStack("Error: x\n    at Object.<anonymous> (C:\\proj\\src\\index.ts:3:7)");
    expect(f).toMatchObject({ filename: "C:\\proj\\src\\index.ts", lineno: 3, colno: 7 });
  });
  test("Gecko/WebKit frames", () => {
    const frames = parseStack("render@https://quoteai.ca/assets/App-abc.js:1:2345\n@https://quoteai.ca/assets/index-def.js:7:89");
    expect(frames).toEqual([
      { filename: "https://quoteai.ca/assets/index-def.js", lineno: 7, colno: 89, in_app: true },
      { filename: "https://quoteai.ca/assets/App-abc.js", function: "render", lineno: 1, colno: 2345, in_app: true },
    ]);
  });
  test("tolerates missing stacks", () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack("Error: only a header")).toEqual([]);
  });
});

describe("buildEvent", () => {
  test("exception with cause chain (root cause first), tags stringified, context copied", () => {
    const root = new Error("db down");
    const err = new Error("save failed", { cause: root });
    const event = buildEvent({ error: err }, "node", {
      environment: "production",
      release: "abc",
      tags: { app: "api-server", attempt: 3, skip: undefined },
      user: { id: "u1" },
      request: { url: "/api/x", method: "POST" },
      mechanism: "express",
      handled: false,
    });
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(event.platform).toBe("node");
    expect(event.level).toBe("error");
    expect(event.environment).toBe("production");
    expect(event.release).toBe("abc");
    expect(event.tags).toEqual({ app: "api-server", attempt: "3" });
    expect(event.user).toEqual({ id: "u1" });
    expect(event.request).toEqual({ url: "/api/x", method: "POST" });
    const values = event.exception!.values;
    expect(values.map((v) => v.value)).toEqual(["db down", "save failed"]);
    expect(values[1]!.mechanism).toEqual({ type: "express", handled: false });
    expect(values[0]!.mechanism).toBeUndefined();
    expect(values[1]!.stacktrace!.frames.length).toBeGreaterThan(0);
  });
  test("non-Error throwables become an Error with a readable value", () => {
    const event = buildEvent({ error: { code: 42 } }, "javascript");
    expect(event.exception!.values[0]).toMatchObject({ type: "Error", value: '{"code":42}' });
    expect(buildEvent({ error: "boom" }, "javascript").exception!.values[0]!.value).toBe("boom");
  });
  test("messages", () => {
    const event = buildEvent({ message: "cron stale" }, "node", { level: "warning" });
    expect(event.message).toBe("cron stale");
    expect(event.level).toBe("warning");
    expect(event.exception).toBeUndefined();
  });
});

describe("debug ids", () => {
  test("maps the innermost frame of each registry key to its file and attaches one image per file", () => {
    const g = globalThis as { _sentryDebugIds?: Record<string, string> };
    g._sentryDebugIds = {
      "Error\n    at https://quoteai.ca/assets/App-abc.js:1:100\n    at https://quoteai.ca/assets/index-def.js:1:1": "11111111-1111-1111-1111-111111111111",
      "Error\n    at https://quoteai.ca/assets/index-def.js:1:50": "22222222-2222-2222-2222-222222222222",
    };
    try {
      const images = debugIdImages([
        { filename: "https://quoteai.ca/assets/App-abc.js" },
        { filename: "https://quoteai.ca/assets/App-abc.js" },
        { filename: "https://quoteai.ca/assets/other.js" },
      ]);
      expect(images).toEqual([{ type: "sourcemap", code_file: "https://quoteai.ca/assets/App-abc.js", debug_id: "11111111-1111-1111-1111-111111111111" }]);
      const err = new Error("x");
      err.stack = "Error: x\n    at fn (https://quoteai.ca/assets/index-def.js:9:9)";
      expect(buildEvent({ error: err }, "javascript").debug_meta).toEqual({
        images: [{ type: "sourcemap", code_file: "https://quoteai.ca/assets/index-def.js", debug_id: "22222222-2222-2222-2222-222222222222" }],
      });
    } finally {
      delete g._sentryDebugIds;
    }
  });
});

describe("envelope + transport", () => {
  test("three newline-separated JSON lines, header carries the DSN and event id", () => {
    const dsn = parseDsn(DSN)!;
    const event = buildEvent({ message: "hi" }, "node");
    const lines = serializeEnvelope(dsn, event).split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!)).toMatchObject({ event_id: event.event_id, dsn: DSN });
    expect(JSON.parse(lines[1]!)).toEqual({ type: "event" });
    expect(JSON.parse(lines[2]!).message).toBe("hi");
  });
  test("sendEvent posts to the envelope URL and never throws", async () => {
    const dsn = parseDsn(DSN)!;
    const event = buildEvent({ message: "hi" }, "node");
    const calls: { url: string; init: { method: string; headers: Record<string, string>; body: string } }[] = [];
    const ok = await sendEvent(dsn, event, async (url, init) => {
      calls.push({ url, init });
      return { status: 200 };
    });
    expect(ok).toBe(true);
    expect(calls[0]!.url).toBe(dsn.envelopeUrl);
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers["Content-Type"]).toBe("text/plain;charset=UTF-8");
    expect(calls[0]!.init.body).toContain('"type":"event"');
    expect(await sendEvent(dsn, event, async () => ({ status: 429 }))).toBe(false);
    expect(await sendEvent(dsn, event, async () => { throw new Error("offline"); })).toBe(false);
  });
});
