import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOutbox, pathOf, pointAt, queue, refLabel, thin, type Note } from "./feedback.ts";

test("a touch becomes a point in 0 to 1, kept inside the picture", () => {
  assert.deepEqual(pointAt(50, 100, 200, 400), [0.25, 0.25]);
  assert.deepEqual(pointAt(-5, 500, 200, 400), [0, 1]);
  assert.deepEqual(pointAt(10, 10, 0, 0), [0, 0]);
});

test("a stroke draws at any size", () => {
  assert.equal(pathOf([[0, 0], [0.5, 0.25]], 200, 100), "M0.0 0.0 L100.0 25.0");
  assert.equal(pathOf([], 200, 100), "");
  assert.match(pathOf([[0.5, 0.5]], 100, 100), /^M50\.0 50\.0 L50\.1 50\.0$/);
});

test("long strokes are thinned, short ones kept", () => {
  const long = Array.from({ length: 1000 }, (_, i) => [i / 1000, 0] as [number, number]);
  const t = thin([long, [[0.1, 0.1]], []], 400);
  assert.equal(t.length, 2);
  assert.equal(t[0]!.length, 400);
  assert.equal(t[1]!.length, 1);
});

const note = (n: string): Note => ({ kind: "wrong", note: n, replyOk: true, includeLogs: true, screen: "Job", at: "2026-10-02T10:00:00Z" });

test("notes wait on the phone, five at most", () => {
  let list: Note[] = [];
  for (let i = 0; i < 7; i++) list = queue(list, note(`n${i}`));
  assert.deepEqual(list.map((n) => n.note), ["n2", "n3", "n4", "n5", "n6"]);
  assert.deepEqual(parseOutbox(JSON.stringify(list)).length, 5);
  assert.deepEqual(parseOutbox("not json"), []);
  assert.deepEqual(parseOutbox(null), []);
});

test("the reference", () => {
  assert.equal(refLabel("FB-1003"), "FB-1003");
  assert.equal(refLabel("x"), "");
  assert.equal(refLabel(undefined), "");
});
