import { describe, expect, it } from "vitest";
import pino from "pino";
import { Writable } from "node:stream";
import { PERSONAL_FIELDS } from "./logger.js";

describe("log redaction (audit B13)", () => {
  it("censors personal fields at the top level and one level down", () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _enc, cb) { lines.push(String(chunk)); cb(); } });
    const log = pino({ redact: { paths: [...PERSONAL_FIELDS, ...PERSONAL_FIELDS.map((f) => `*.${f}`)], censor: "[redacted]" } }, sink);
    log.info({ to: "a@b.ca", toEmail: "c@d.ca", phone: "+15145551234", quoteId: "q1", nested: { email: "e@f.ca" } }, "sent");
    const out = JSON.parse(lines[0]!);
    expect(out.to).toBe("[redacted]");
    expect(out.toEmail).toBe("[redacted]");
    expect(out.phone).toBe("[redacted]");
    expect(out.nested.email).toBe("[redacted]");
    expect(out.quoteId).toBe("q1");
  });
});
