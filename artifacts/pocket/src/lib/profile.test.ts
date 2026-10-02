import test from "node:test";
import assert from "node:assert/strict";
import { applyPatch, brandKeyOf, defaultSchedule, depositOf, looksLikeGstHst, netOf, pageOf, withDeposit, withHoldback, withNet, type Profile } from "./profile.ts";

test("a deposit takes from the last payment and gives it back, so the terms keep adding up", () => {
  const s = defaultSchedule();
  assert.equal(depositOf(s), 15);
  const up = withDeposit(s, 30, "Deposit")!;
  assert.equal(depositOf(up), 30);
  assert.equal(up.terms.at(-1)!.value, 0);
  assert.equal(up.terms.reduce((n, t) => n + t.value, 0), 100);
  const down = withDeposit(up, 10, "Deposit")!;
  assert.equal(down.terms.reduce((n, t) => n + t.value, 0), 100);
});

test("a deposit the last payment can't give is refused, and no deposit drops the term", () => {
  assert.equal(withDeposit(defaultSchedule(), 40, "Deposit"), null);
  const none = withDeposit(defaultSchedule(), 0, "Deposit")!;
  assert.equal(none.terms.some((t) => t.type === "deposit"), false);
  assert.equal(depositOf(none), 0);
});

test("a company with no deposit gets one added first, from the last payment", () => {
  const none = withDeposit(defaultSchedule(), 0, "Deposit")!;
  const again = withDeposit(none, 5, "Deposit upon signing")!;
  assert.equal(again.terms[0]!.type, "deposit");
  assert.equal(again.terms[0]!.dueDays, 0);
  assert.equal(again.terms.reduce((n, t) => n + t.value, 0), 100);
});

test("the payment terms are the days the payments after the deposit give", () => {
  const s = defaultSchedule();
  assert.equal(netOf(s), "net15");
  assert.equal(netOf(withNet(s, "receipt")), "receipt");
  assert.equal(netOf(withNet(s, "net30")), "net30");
  assert.equal(withNet(s, "net30").terms[0]!.dueDays, 0, "the deposit stays due on signing");
});

test("holdback is on or off with its percent kept", () => {
  const h = withHoldback(defaultSchedule(), true);
  assert.deepEqual(h.holdback, { enabled: true, percent: 10 });
  assert.deepEqual(withHoldback(h, false).holdback, { enabled: false, percent: 10 });
  assert.deepEqual(withHoldback(h, true, 5).holdback, { enabled: true, percent: 5 });
});

test("a patch changes only the keys of a page", () => {
  const p = { pocketSettings: { tax: { split: true, showAs: "line" } }, automationSettings: { invoiceReminders: true, smsReminders: false } } as unknown as Profile;
  const n = applyPatch(p, { companyName: "X", pocketSettings: { tax: { split: false }, invoices: { terms: "net30" } }, automationSettings: { smsReminders: true } });
  assert.equal(n.companyName, "X");
  assert.deepEqual(n.pocketSettings.tax, { split: false, showAs: "line" });
  assert.deepEqual(n.pocketSettings.invoices, { terms: "net30" });
  assert.deepEqual(n.automationSettings, { invoiceReminders: true, smsReminders: true });
  assert.deepEqual(pageOf(p, "quotes"), {});
});

test("a GST/HST number looks right with or without the spaces", () => {
  assert.equal(looksLikeGstHst("81234 5678 RT0001"), true);
  assert.equal(looksLikeGstHst("812345678RT0001"), true);
  assert.equal(looksLikeGstHst("81234 5678"), false);
  assert.equal(looksLikeGstHst(""), false);
});

test("a saved colour is one of the swatches, or the violet", () => {
  const colours = { violet: "#6A2FBF", harbour: "#1F4F86", forest: "#1F7A45", brick: "#B4462B", teal: "#1E7F80", charcoal: "#2B2B30" };
  assert.equal(brandKeyOf("#1f4f86", colours), "harbour");
  assert.equal(brandKeyOf(null, colours), "violet");
  assert.equal(brandKeyOf("#123456", colours), "violet");
});

test("the next invoice number is one more than this year's highest", async () => {
  const { nextInvoiceNumber } = await import("./profile.ts");
  assert.equal(nextInvoiceNumber(["INV-2026-0003", "INV-2026-0012", "INV-2025-0099", "CN-2026-0004"], 2026), "INV-2026-0013");
  assert.equal(nextInvoiceNumber([], 2026), "INV-2026-0001");
});
