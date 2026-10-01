import { test } from "node:test";
import assert from "node:assert/strict";
import { backStep, createdAtIso, elapsedLabel, elapsedSince, parseSent, parseStage, pricedLines, pricedTaxes, quoteTitle, resumeStep, stageForStep, stepStates } from "./firstQuote.ts";

test("parseStage keeps only the three stages", () => {
  assert.equal(parseStage("compose"), "compose");
  assert.equal(parseStage("review"), "review");
  assert.equal(parseStage("done"), "done");
  assert.equal(parseStage("nope"), null);
  assert.equal(parseStage(null), null);
});

test("stages follow the steps", () => {
  assert.equal(stageForStep("describe"), "compose");
  assert.equal(stageForStep("check"), "review");
  assert.equal(stageForStep("send"), "review");
  assert.equal(stageForStep("done"), "done");
});

test("reopening resumes where the person left", () => {
  const sent = { email: "a@b.ca", elapsed: "3 min" };
  assert.equal(resumeStep(null, false, null), "describe");
  assert.equal(resumeStep("compose", false, null), "describe");
  assert.equal(resumeStep("review", true, null), "check");
  assert.equal(resumeStep("review", false, null), "describe");
  assert.equal(resumeStep("done", true, sent), "done");
  assert.equal(resumeStep("done", true, null), "describe"); // skipped, never sent
});

test("back and step states", () => {
  assert.equal(backStep("describe"), null);
  assert.equal(backStep("check"), "describe");
  assert.equal(backStep("send"), "check");
  assert.equal(backStep("done"), null);
  assert.deepEqual(stepStates("describe"), ["now", "later", "later"]);
  assert.deepEqual(stepStates("send"), ["done", "done", "now"]);
});

test("parseSent", () => {
  assert.deepEqual(parseSent('{"email":"a@b.ca","elapsed":"3 min"}'), { email: "a@b.ca", elapsed: "3 min" });
  assert.equal(parseSent("{"), null);
  assert.equal(parseSent('{"email":""}'), null);
});

test("elapsedLabel", () => {
  const t0 = Date.parse("2026-10-01T12:00:00Z");
  assert.equal(elapsedLabel("2026-10-01T11:57:00Z", t0), "3 min");
  assert.equal(elapsedLabel("2026-10-01T11:59:50Z", t0), "1 min");
  assert.equal(elapsedLabel("2026-10-01T10:55:00Z", t0), "1 h 5 min");
  assert.equal(elapsedLabel("2026-10-01T10:00:00Z", t0), "2 h");
  assert.equal(elapsedLabel("2026-09-29T10:00:00Z", t0), null);
  assert.equal(elapsedLabel("2026-10-01T13:00:00Z", t0), null);
  assert.equal(elapsedLabel("garbage", t0), null);
  assert.equal(elapsedLabel(null, t0), null);
});

test("elapsedSince falls back to when the guide opened", () => {
  const t0 = Date.parse("2026-10-01T12:00:00Z");
  assert.equal(elapsedSince("2026-10-01T11:54:00Z", null, t0), "6 min");
  assert.equal(elapsedSince(undefined, t0 - 4 * 60_000, t0), "4 min");
  assert.equal(elapsedSince(undefined, null, t0), null);
  assert.equal(createdAtIso(new Date("2026-10-01T12:00:00Z")), "2026-10-01T12:00:00.000Z");
});

test("a quote's lines, taxes and title", () => {
  const q = {
    descrizioneGenerale: "Repaint a bedroom. Two coats.",
    capitoli: [{ voci: [{ descrizione: "Walls", um: "sq ft", quantita: 416, prezzoUnitario: 1.35, totale: 561.6 }] }],
    ivaPercentuale: 13, ivaValore: 112.66,
  };
  assert.deepEqual(pricedLines(q), [{ name: "Walls", qty: 416, unit: "sq ft", unitPrice: 1.35, total: 561.6 }]);
  assert.deepEqual(pricedTaxes(q), [{ label: "", rate: 13, amount: 112.66 }]);
  assert.deepEqual(pricedTaxes({ ...q, taxLines: [{ label: "GST", rate: 5, amount: 1 }, { label: "QST", rate: 9.975, amount: 2 }] }).map((t) => t.label), ["GST", "QST"]);
  assert.equal(quoteTitle(q), "Repaint a bedroom.");
  assert.equal(quoteTitle({ ...q, titoloPreventivoRiga1: "Bedroom repaint" }), "Bedroom repaint");
  assert.equal(pricedLines({ items: [{ descrizione: "A", quantita: 1, unita: "ea", prezzoUnitario: 5, totale: 5 }] })[0]!.unit, "ea");
});
