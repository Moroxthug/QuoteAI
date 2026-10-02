import assert from "node:assert/strict";
import { test } from "node:test";
import { logState, nameByPhone, phoneKey, snippet, waNumber } from "./messaging.ts";

test("a message in the log gets its word", () => {
  assert.equal(logState({ direction: "outbound", status: "sent" }).word, "sent");
  assert.equal(logState({ direction: "inbound", status: "received" }).word, "received");
  assert.equal(logState({ direction: "outbound", status: "failed" }).word, "failed");
  assert.equal(logState({ direction: "outbound", status: "skipped" }).word, "skipped");
});

test("a client is found by the last ten digits", () => {
  assert.equal(phoneKey("+1 (416) 555-0142"), "4165550142");
  const names = nameByPhone([{ name: "Dana Whitfield", phone: "416-555-0142" }, { name: "No phone", phone: null }]);
  assert.equal(names.get(phoneKey("+14165550142")), "Dana Whitfield");
  assert.equal(names.size, 1);
});

test("a received message is short and one line", () => {
  assert.equal(snippet("Can you   start\nMonday?"), "Can you start Monday?");
  assert.equal(snippet("x".repeat(60)).length, 42);
});

test("a WhatsApp number is made international", () => {
  assert.equal(waNumber("416 555 0142"), "+14165550142");
  assert.equal(waNumber("1 416 555 0142"), "+14165550142");
  assert.equal(waNumber("+44 20 7946 0958"), "+442079460958");
  assert.equal(waNumber("555"), null);
});
