import assert from "node:assert/strict";
import { test } from "node:test";
import { SAMPLES, TEMPLATES, addSlot, fill, isEdited, parts, removeSlot, segmentsOf, wordCount } from "./templates.ts";

test("a text splits into words and numbered slots", () => {
  assert.deepEqual(parts("Hi {first}, see {link}"), [{ text: "Hi " }, { slot: "first", n: 0 }, { text: ", see " }, { slot: "link", n: 1 }]);
});

test("a sample client fills the slots on one line", () => {
  assert.equal(fill("Hi {first}, {me} from {co} is on the way. Arriving around {eta}.", { first: "Grace", me: "Marco", co: "Rossi", eta: "8:30 am" }), "Hi Grace, Marco from Rossi is on the way. Arriving around 8:30 am.");
  assert.equal(fill("Pay {inv}  now", {}), "Pay now");
});

test("removing and adding a slot", () => {
  assert.equal(removeSlot("Hi {first}, see {link} {me}", 1), "Hi {first}, see {me}");
  assert.equal(addSlot("Hi {first}  ", "co"), "Hi {first} {co}");
});

test("counts", () => {
  assert.equal(wordCount("a  b c"), 3);
  assert.equal(wordCount(""), 0);
  assert.equal(segmentsOf("x".repeat(161)), 2);
  assert.equal(segmentsOf(""), 1);
});

test("a template is edited once its saved text differs from ours", () => {
  const t = TEMPLATES[0]!;
  assert.equal(isEdited(t, {}), false);
  assert.equal(isEdited(t, { f1_en: t.en }), false);
  assert.equal(isEdited(t, { f1_fr: "autre" }), true);
});

test("every template only uses slots it offers, and the samples fill them", () => {
  for (const t of TEMPLATES) {
    for (const l of ["en", "fr"] as const) {
      for (const p of parts(t[l])) if ("slot" in p) assert.ok(t.vars.includes(p.slot as never), `${t.id} ${l} ${p.slot}`);
      const filled = fill(t[l], { ...SAMPLES[t.who][l], me: "Marco", co: "Rossi" });
      assert.ok(!filled.includes("{"), `${t.id} ${l}`);
    }
  }
});
