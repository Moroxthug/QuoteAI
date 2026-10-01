import test from "node:test";
import assert from "node:assert/strict";
import {
  activity, bodyBlocks, canVoid, details, FILTER_ORDER, groupOf, kpis, matchesFilter, matchesSearch, oneDecimal, partyLines, plainHeading, primaryOf, rowDates, sectionTag, signerWord, stateOf, stepOf,
  termsOf, termsPatch, typedSignature, validEmail, validSignature, warrantyParts, type ContractFull, type ContractRow, type ContractStatus, type SignerDto,
} from "./contracts.ts";

const row = (o: Partial<ContractRow> = {}): ContractRow => ({
  id: "c1", quoteId: null, kind: "agreement", contractNumber: "C-2026-034", status: "draft", title: "Bedrooms and bath ceiling", customerName: "Dana Whitfield", contractValueCents: 413_105,
  sentAt: null, viewedAt: null, signedAt: null, voidedAt: null, expiresAt: null, createdAt: "2026-09-29T09:12:00Z", ...o,
});

const signer = (o: Partial<SignerDto> = {}): SignerDto => ({ id: "s", role: "customer", name: "Dana Whitfield", email: "d@x.ca", status: "pending", signatureType: null, signedAt: null, viewedAt: null, declinedAt: null, declineReason: null, ...o });

const full = (status: ContractStatus, o: Partial<ContractFull> = {}, signers: SignerDto[] = [signer({ role: "contractor", name: "Marco Rossi" }), signer()]): ContractFull => ({
  id: "c1", quoteId: "q1", clientId: null, projectId: null, kind: "agreement", parentContractId: null, contractNumber: "C-2026-034", status, province: "ON", language: "en", templateKey: "ON",
  document: { title: "Contract", language: "en", sections: [] },
  variables: {
    contractNumber: "C-2026-034", quoteNumber: "Q-2026-119", contractor: { name: "Rossi Renovations" }, customer: { name: "Dana Whitfield", email: "d@x.ca" }, siteAddress: "17 Castle Frank Cres", province: "ON",
    projectTitle: "Bedrooms and bath ceiling", subtotal: 3655.8, taxLines: [{ code: "HST", label: "HST", rate: 13, amount: 475.25 }], taxTotal: 475.25, total: 4131.05, startDate: "2026-10-13", estimatedDurationWeeks: 2,
    warrantyMonths: 12, paymentSchedule: { holdback: { enabled: true, percent: 10 } },
  },
  contractValueCents: 413_105, holdbackEnabled: true, holdbackPercent: 10, hasSignedPdf: false, sentAt: null, expiresAt: null, signedAt: null, voidedAt: null, voidReason: null, reminderCount: 0,
  createdAt: "2026-09-29T09:12:00Z", signers, events: [], ...o,
});

test("the server's status words become the board's", () => {
  assert.equal(stateOf("sent"), "await");
  assert.equal(stateOf("viewed"), "viewed");
  assert.equal(stateOf("voided"), "voided");
  assert.equal(stateOf("signed"), "signed");
});

test("groups and filters follow the board", () => {
  assert.deepEqual((["draft", "sent", "viewed", "signed", "voided", "declined", "expired"] as ContractStatus[]).map(groupOf), ["open", "open", "open", "signed", "closed", "closed", "closed"]);
  const all = ["draft", "sent", "viewed", "signed", "voided", "declined", "expired"] as ContractStatus[];
  assert.deepEqual(FILTER_ORDER.map((f) => all.filter((s) => matchesFilter(s, f)).length), [7, 1, 2, 1, 3]);
});

test("search finds a client, a job or a number, accents aside", () => {
  const c = row({ customerName: "Hélène Côté", title: "Plancher du corridor" });
  assert.ok(matchesSearch(c, "helene"));
  assert.ok(matchesSearch(c, "corridor"));
  assert.ok(matchesSearch(c, "034"));
  assert.ok(matchesSearch(c, "  "));
  assert.ok(!matchesSearch(c, "okoye"));
});

test("the three numbers: to sign, signed this month, time to sign", () => {
  const now = new Date("2026-09-30T12:00:00");
  const rows = [
    row({ id: "a", status: "draft" }), row({ id: "b", status: "viewed" }), row({ id: "c", status: "sent" }),
    row({ id: "d", status: "signed", contractValueCents: 221_000, sentAt: "2026-09-15T09:00:00", signedAt: "2026-09-16T09:00:00" }),
    row({ id: "e", status: "signed", contractValueCents: 395_500, sentAt: "2026-09-19T09:00:00", signedAt: "2026-09-20T09:00:00" }),
    row({ id: "f", status: "signed", contractValueCents: 3_840_000, sentAt: "2026-08-28T09:00:00", signedAt: "2026-08-30T09:00:00" }),
    row({ id: "g", status: "voided" }),
  ];
  const k = kpis(rows, now);
  assert.equal(k.toSign, 3);
  assert.equal(k.yours, 1);
  assert.deepEqual(k.signed, { cents: 616_500, count: 2 });
  assert.equal(oneDecimal(k.avgDays!), 1.3);
  assert.equal(oneDecimal(k.deltaDays!), -1);
});

test("no signed contracts: no time to sign, no change", () => {
  const k = kpis([row()], new Date("2026-09-30T12:00:00"));
  assert.equal(k.avgDays, null);
  assert.equal(k.deltaDays, null);
  assert.deepEqual(k.signed, { cents: 0, count: 0 });
});

test("the steps: review, sign, send, the client signs", () => {
  assert.equal(stepOf(full("draft")), 1);
  assert.equal(primaryOf(full("draft")), "sign");
  const mine = [signer({ role: "contractor", status: "signed" }), signer()];
  assert.equal(stepOf(full("draft", {}, mine)), 2);
  assert.equal(primaryOf(full("draft", {}, mine)), "send");
  assert.equal(stepOf(full("sent", {}, mine)), 3);
  assert.equal(primaryOf(full("viewed", {}, mine)), "waiting");
  assert.equal(stepOf(full("signed", {}, mine)), 4);
  assert.equal(primaryOf(full("signed", {}, mine)), "download");
  assert.equal(primaryOf(full("voided", {}, mine)), "closed");
});

test("a voided contract keeps the step it had reached", () => {
  const mine = [signer({ role: "contractor", status: "signed" }), signer()];
  assert.equal(stepOf(full("voided", { events: [{ id: "1", type: "sent", actor: "contractor", detail: null, createdAt: "2026-09-29T09:36:00Z" }] }, mine)), 3);
  assert.equal(stepOf(full("voided", {}, mine)), 2);
  assert.equal(stepOf(full("voided")), 1);
});

test("only a draft can be edited; an executed contract cannot be voided", () => {
  assert.ok(canVoid(full("draft")) && canVoid(full("sent")) && canVoid(full("viewed")));
  assert.ok(!canVoid(full("signed")) && !canVoid(full("voided")));
});

test("the text of a section: paragraphs, bullets and bold", () => {
  const b = bodyBlocks("Work **starts** Oct 13.\n\nWe provide:\n- paint\n- **sundries**");
  assert.deepEqual(b.map((x) => x.kind), ["p", "p", "li", "li"]);
  assert.deepEqual(b[0]!.parts, [{ text: "Work ", bold: false }, { text: "starts", bold: true }, { text: " Oct 13.", bold: false }]);
  assert.deepEqual(b[3]!.parts, [{ text: "sundries", bold: true }]);
  assert.deepEqual(bodyBlocks(""), []);
});

test("a party is its name, its address and how to reach it", () => {
  assert.deepEqual(partyLines({ name: "Rossi", legalName: "Rossi Renovations Inc.", address: "12 King St", city: "Toronto", province: "ON", postalCode: "M5V 1A1", email: "m@r.ca", phone: "416-555-0100" }),
    ["Rossi Renovations Inc.", "12 King St, Toronto, ON M5V 1A1", "m@r.ca · 416-555-0100"]);
  assert.deepEqual(partyLines({ name: "Dana" }), ["Dana"]);
});

test("a section is drafted by AI, a standard clause, or filled in from the quote", () => {
  assert.equal(sectionTag({ kind: "ai", editable: true }), "ai");
  assert.equal(sectionTag({ kind: "legal", editable: false }), "legal");
  assert.equal(sectionTag({ kind: "data", editable: false }), "data");
});

test("each signer's word", () => {
  const c = (s: ContractStatus) => ({ status: s });
  assert.equal(signerWord(c("draft"), { role: "contractor", status: "pending", viewedAt: null }), "yourTurn");
  assert.equal(signerWord(c("draft"), { role: "customer", status: "pending", viewedAt: null }), "notSent");
  assert.equal(signerWord(c("sent"), { role: "customer", status: "pending", viewedAt: null }), "pending");
  assert.equal(signerWord(c("viewed"), { role: "customer", status: "viewed", viewedAt: "x" }), "viewed");
  assert.equal(signerWord(c("signed"), { role: "customer", status: "signed", viewedAt: "x" }), "signed");
  assert.equal(signerWord(c("voided"), { role: "customer", status: "pending", viewedAt: null }), "voided");
  assert.equal(signerWord(c("sent"), { role: "customer", status: "declined", viewedAt: null }), "declined");
});

test("the Details card in the board's order", () => {
  assert.deepEqual(details(full("draft")).map((d) => d.key), ["province", "language", "subtotal", "tax", "total", "holdback", "start", "warranty"]);
  const hb = details(full("draft")).find((d) => d.key === "holdback");
  assert.deepEqual(hb, { key: "holdback", percent: 10, cents: 41_311 });
  const bare = full("draft");
  bare.variables.paymentSchedule.holdback.enabled = false;
  bare.variables.startDate = null;
  assert.deepEqual(details(bare).map((d) => d.key), ["province", "language", "subtotal", "tax", "total", "warranty"]);
});

test("warranty reads in years when it is whole years", () => {
  assert.deepEqual(warrantyParts(12), { unit: "year", count: 1 });
  assert.deepEqual(warrantyParts(24), { unit: "year", count: 2 });
  assert.deepEqual(warrantyParts(18), { unit: "month", count: 18 });
  assert.deepEqual(warrantyParts(0), { unit: "month", count: 0 });
});

test("editing the terms sends only what changed", () => {
  const from = termsOf(full("draft"));
  assert.deepEqual(termsPatch(from, from), {});
  assert.deepEqual(termsPatch(from, { ...from, warrantyMonths: 24, holdbackPercent: 5 }), { warrantyMonths: 24, holdbackPercent: 5 });
  assert.deepEqual(termsPatch(from, { ...from, startDate: null }), { startDate: null });
  assert.deepEqual(termsPatch(from, { ...from, customerEmail: " new@x.ca " }), { customerEmail: "new@x.ca" });
  assert.deepEqual(termsPatch({ ...from, customerEmail: "" }, { ...from, customerEmail: "" }), {});
});

test("an email is checked before it is sent", () => {
  assert.ok(validEmail("dana@whitfield.ca"));
  assert.ok(!validEmail("dana@"));
  assert.ok(!validEmail("dana whitfield"));
});

test("activity, newest first, with the noise left out", () => {
  const f = full("sent", {
    events: [
      { id: "1", type: "created", actor: "contractor", detail: { byAi: true }, createdAt: "2026-09-29T09:12:00Z" },
      { id: "2", type: "edited", actor: "contractor", detail: { sections: ["schedule"] }, createdAt: "2026-09-29T09:20:00Z" },
      { id: "3", type: "contractor_signed", actor: "contractor", detail: null, createdAt: "2026-09-29T09:34:00Z" },
      { id: "4", type: "sent", actor: "contractor", detail: { to: "d@x.ca" }, createdAt: "2026-09-29T09:36:00Z" },
      { id: "5", type: "otp_sent", actor: "system", detail: null, createdAt: "2026-09-29T10:00:00Z" },
      { id: "6", type: "viewed", actor: "customer", detail: null, createdAt: "2026-09-29T10:01:00Z" },
      { id: "7", type: "viewed", actor: "customer", detail: null, createdAt: "2026-09-29T11:01:00Z" },
    ],
  });
  const a = activity(f);
  assert.deepEqual(a.map((x) => x.kind), ["viewed", "sent", "contractorSigned", "edited", "created"]);
  assert.equal(a[0]!.id, "7");
  assert.equal(a[0]!.who, "Dana Whitfield");
  assert.equal(a[2]!.who, "Marco Rossi");
  assert.deepEqual(a[3]!.sections, ["schedule"]);
});

test("a typed signature", () => {
  assert.ok(validSignature("Marco Rossi", true));
  assert.ok(!validSignature("M", true));
  assert.ok(!validSignature("Marco Rossi", false));
  assert.deepEqual(typedSignature("  Marco Rossi "), { signatureType: "typed", signatureData: "Marco Rossi", name: "Marco Rossi", consent: true });
});

test("the line under a contract says when it was sent and what came of it", () => {
  const now = new Date("2026-09-29T15:00:00");
  assert.deepEqual(rowDates(row({ createdAt: "2026-09-29T09:12:00" }), now), [{ key: "draftedToday" }]);
  assert.deepEqual(rowDates(row({ createdAt: "2026-09-20T09:12:00" }), now), [{ key: "drafted", at: "2026-09-20T09:12:00" }]);
  assert.deepEqual(rowDates(row({ status: "sent", sentAt: "2026-09-28T09:00:00" }), now), [{ key: "sent", at: "2026-09-28T09:00:00" }, { key: "notOpened" }]);
  assert.deepEqual(rowDates(row({ status: "viewed", sentAt: "2026-09-24T09:00:00", viewedAt: "2026-09-26T09:00:00" }), now).map((p) => p.key), ["sent", "viewed"]);
  assert.deepEqual(rowDates(row({ status: "viewed", sentAt: "2026-09-24T09:00:00" }), now).map((p) => p.key), ["sent", "viewedUnknown"]);
  assert.deepEqual(rowDates(row({ status: "signed", sentAt: "a", signedAt: "b" }), now).map((p) => p.key), ["sent", "signed"]);
  assert.deepEqual(rowDates(row({ status: "voided", sentAt: "a", voidedAt: "b" }), now).map((p) => p.key), ["sent", "voided"]);
  assert.deepEqual(rowDates(row({ status: "declined", sentAt: "a" }), now).map((p) => p.key), ["sent", "declined"]);
  assert.deepEqual(rowDates(row({ status: "signed", signedAt: "b" }), now).map((p) => p.key), ["signed"]);
});

test("the server's numbered headings lose their number", () => {
  assert.equal(plainHeading("3. Contract Price"), "Contract Price");
  assert.equal(plainHeading("12) Dispute resolution"), "Dispute resolution");
  assert.equal(plainHeading("Parties"), "Parties");
  assert.equal(plainHeading("2026 plan"), "2026 plan");
});
