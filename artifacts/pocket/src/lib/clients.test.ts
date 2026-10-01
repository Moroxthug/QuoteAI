import assert from "node:assert/strict";
import { test } from "node:test";
import { canSaveDetails, changedDetails, contactLine, contactLinks, formatPhone, matchesClientFilter, matchesClientSearch, owingClients, tintFor, topClients, wonOf, yearTrend, type ClientRow } from "./clients.ts";

const row = (o: Partial<ClientRow> = {}): ClientRow => ({
  id: "c", name: "Tom & Lena Hart", type: "individual", email: "lena@x.ca", phone: "4165550148", address: "48 Galloway Rd", city: "Scarborough", province: "ON", status: "active",
  createdAt: "2026-08-01T00:00:00Z", quoteCount: 3, jobCount: 1, activeJobs: 1, lifetimeCents: 4_235_500, owedCents: 0, overdueCount: 0, overdueCents: 0, lastActivity: null, ...o,
});

test("filters", () => {
  assert.ok(matchesClientFilter(row(), "all"));
  assert.ok(matchesClientFilter(row(), "active"));
  assert.ok(!matchesClientFilter(row(), "prospect"));
});

test("search finds name, phone digits, email and area", () => {
  assert.ok(matchesClientSearch(row(), "lena"));
  assert.ok(matchesClientSearch(row(), "555-0148"));
  assert.ok(matchesClientSearch(row(), "(416) 555"));
  assert.ok(matchesClientSearch(row(), "scarborough"));
  assert.ok(matchesClientSearch(row(), "galloway"));
  assert.ok(!matchesClientSearch(row(), "okoye"));
  assert.ok(matchesClientSearch(row(), "  "));
});

test("phone formatting", () => {
  assert.equal(formatPhone("4165550148"), "(416) 555-0148");
  assert.equal(formatPhone("+1 416 555 0148"), "(416) 555-0148");
  assert.equal(formatPhone("555-01"), "555-01");
});

test("contact line is the phone or the email, then the area", () => {
  assert.equal(contactLine(row(), formatPhone), "(416) 555-0148 · Scarborough");
  assert.equal(contactLine(row({ phone: null }), formatPhone), "lena@x.ca · Scarborough");
  assert.equal(contactLine(row({ phone: null, email: null, city: null }), formatPhone), "48 Galloway Rd".split(",")[0]);
});

test("contact links only for what the client has", () => {
  const all = contactLinks(row());
  assert.equal(all.call, "tel:4165550148");
  assert.equal(all.text, "sms:4165550148");
  assert.equal(all.email, "mailto:lena@x.ca");
  assert.ok(all.map?.includes("48%20Galloway%20Rd%2C%20Scarborough%2C%20ON"));
  assert.deepEqual(Object.keys(contactLinks(row({ phone: null, email: null, address: null, city: null, province: null }))), []);
});

test("a client keeps their tint", () => {
  assert.equal(tintFor("Tom & Lena Hart"), tintFor("Tom & Lena Hart"));
  assert.ok([1, 2, 3, 4, 5].includes(tintFor("Priya Nair")));
});

test("won of the quotes that left the building", () => {
  assert.equal(wonOf([{ sentAt: null, acceptedAt: null, declinedAt: null }]), null);
  assert.deepEqual(wonOf([
    { sentAt: "x", acceptedAt: "x", declinedAt: null }, { sentAt: "x", acceptedAt: "x", declinedAt: null }, { sentAt: "x", acceptedAt: null, declinedAt: "x" }, { sentAt: null, acceptedAt: null, declinedAt: null },
  ]), { won: 2, of: 3, percent: 67 });
});

test("year trend", () => {
  assert.equal(yearTrend({ lifetimeThisYearCents: 118, lifetimeLastYearCents: 100 }), 18);
  assert.equal(yearTrend({ lifetimeThisYearCents: 5, lifetimeLastYearCents: 0 }), null);
});

test("who owes and who bought most", () => {
  const list = [row({ id: "a", owedCents: 100, overdueCents: 0, lifetimeCents: 50 }), row({ id: "b", owedCents: 300, overdueCents: 300, lifetimeCents: 900 }), row({ id: "c", owedCents: 0, lifetimeCents: 0 }), row({ id: "d", owedCents: 200, overdueCents: 200, lifetimeCents: 10 })];
  assert.deepEqual(owingClients(list).map((c) => c.id), ["b", "d", "a"]);
  assert.deepEqual(topClients(list).map((c) => c.id), ["b", "a", "d"]);
});

test("edits send only what changed, empty clears", () => {
  const before = { name: "A", email: "a@x.ca", phone: "", address: "1 St", city: "", province: "", postalCode: "", notes: "old" };
  assert.deepEqual(changedDetails(before, { ...before }), {});
  assert.deepEqual(changedDetails(before, { ...before, email: "", phone: " 416 ", notes: "new\n" }), { email: null, phone: "416", notes: "new\n" });
  assert.ok(canSaveDetails(before));
  assert.ok(!canSaveDetails({ ...before, name: " " }));
  assert.ok(!canSaveDetails({ ...before, email: "nope" }));
});
