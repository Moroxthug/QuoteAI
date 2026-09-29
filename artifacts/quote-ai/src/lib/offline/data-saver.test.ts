// Phase 122: photos on Wi-Fi only, and how far the app follows the phone's text size.
// Run: pnpm --filter @workspace/quote-ai test (node:test through tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { carriesPhoto, kindOf, waitsForWifi } from "./data-saver";
import type { OutboxOp } from "./outbox";
import { clampTextZoom } from "../native/text-zoom-rule";

const blob = new Blob(["x"]);
const photo: OutboxOp = { kind: "job.uploadPhoto", jobId: "j1", file: blob, fileName: "a.jpg" };
const reportWithPhoto: OutboxOp = { kind: "worker.report", token: "t", projectId: "p", reportKind: "blocker", file: blob, fileName: "b.jpg" };
const reportText: OutboxOp = { kind: "worker.report", token: "t", projectId: "p", reportKind: "note", body: "done" };
const receipt: OutboxOp = { kind: "job.scanReceipt", jobId: "j1", file: blob, fileName: "r.jpg" };
const edit: OutboxOp = { kind: "api", method: "PATCH", path: "/api/jobs/j1", body: "{}", key: "k", base: null };

test("what the phone or browser calls a connection", () => {
  assert.equal(kindOf("wifi"), "wifi");
  assert.equal(kindOf("ethernet"), "wifi");
  assert.equal(kindOf("cellular"), "cellular");
  assert.equal(kindOf("none"), "unknown");
  assert.equal(kindOf("unknown"), "unknown");
  assert.equal(kindOf(undefined), "unknown", "Safari and desktops don't say — never held on a guess");
});

test("only photos wait, and only on a phone plan when asked", () => {
  assert.equal(carriesPhoto(photo), true);
  assert.equal(carriesPhoto(reportWithPhoto), true);
  assert.equal(carriesPhoto(reportText), false);
  assert.equal(carriesPhoto(receipt), false, "a receipt makes the cost — it goes now");
  assert.equal(carriesPhoto(edit), false);

  const on = { wifiOnly: true, connection: "cellular" as const };
  assert.equal(waitsForWifi(photo, on), true);
  assert.equal(waitsForWifi(reportWithPhoto, on), true);
  assert.equal(waitsForWifi(edit, on), false, "everything else still sends over data");
  assert.equal(waitsForWifi(photo, { ...on, wifiOnly: false }), false, "off by default");
  assert.equal(waitsForWifi(photo, { ...on, connection: "wifi" }), false);
  assert.equal(waitsForWifi(photo, { ...on, connection: "unknown" }), false);
  assert.equal(waitsForWifi(photo, { ...on, sendNow: true }), false, "Send now sends it over data");
});

test("the app follows the phone's text size up to 2×", () => {
  assert.equal(clampTextZoom(1), 1);
  assert.equal(clampTextZoom(1.35), 1.35);
  assert.equal(clampTextZoom(1.764), 1.76);
  assert.equal(clampTextZoom(3.1), 2, "the largest accessibility sizes stop at what every screen is checked at");
  assert.equal(clampTextZoom(0.5), 0.8);
  assert.equal(clampTextZoom(Number.NaN), 1);
  assert.equal(clampTextZoom(0), 1);
});
