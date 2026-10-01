import assert from "node:assert/strict";
import { test } from "node:test";
import { askOf, canSaveLead, canSend, deName, dueCount, followUp, leadsIn, newLeadBody, openCount, reopenStatus, replyStep, sendChannel, sourceInfo, stageCounts, stageOf, type Lead } from "./leads.ts";

const NOW = new Date(2026, 8, 30, 12, 0); // Wed Sep 30, 2026, noon (local)
const at = (day: number, h: number) => new Date(2026, 8, day, h, 0).toISOString();
const lead = (o: Partial<Lead> = {}): Lead => ({
  id: "l", clientId: null, quoteId: null, name: "Aaron Mitchell", email: "a@x.ca", phone: "4165550100", preferredLanguage: "en", preferredChannel: "sms", source: "widget", status: "new",
  unsubscribedAt: null, followUpStage: 0, nextFollowUpAt: at(30, 16), lastContactedAt: null, notes: "Kitchen  repaint\n about 400 sq ft.", createdAt: at(30, 9), updatedAt: at(30, 9), ...o,
});

test("an unsubscribed lead sits under Lost", () => {
  assert.equal(stageOf(lead({ status: "unsubscribed" })), "lost");
  assert.equal(stageOf(lead({ status: "quoted" })), "quoted");
});

test("tab counts and the open count", () => {
  const all = [lead(), lead({ status: "new" }), lead({ status: "contacted" }), lead({ status: "won" }), lead({ status: "unsubscribed" })];
  assert.deepEqual(stageCounts(all), { new: 2, contacted: 1, quoted: 0, won: 1, lost: 1 });
  assert.equal(openCount(all), 3);
});

test("open tabs are ordered by next follow-up, none last; won by latest change", () => {
  const a = lead({ id: "a", nextFollowUpAt: at(30, 17) });
  const b = lead({ id: "b", nextFollowUpAt: at(29, 9) });
  const c = lead({ id: "c", nextFollowUpAt: null, createdAt: at(30, 11) });
  const d = lead({ id: "d", nextFollowUpAt: at(30, 17), createdAt: at(30, 10) });
  assert.deepEqual(leadsIn([a, c, b, d], "new").map((l) => l.id), ["b", "d", "a", "c"]);
  const w1 = lead({ id: "w1", status: "won", updatedAt: at(20, 9) });
  const w2 = lead({ id: "w2", status: "won", updatedAt: at(25, 9) });
  assert.deepEqual(leadsIn([w1, w2], "won").map((l) => l.id), ["w2", "w1"]);
});

test("follow-up: today is due, a past day is late, later is plain", () => {
  const f = (iso: string | null, status: Lead["status"] = "new") => followUp({ nextFollowUpAt: iso, status }, NOW);
  assert.deepEqual(f(null), { kind: "none" });
  assert.deepEqual(f(at(30, 8)), { kind: "set", at: new Date(at(30, 8)), day: "today", tone: "due" }); // earlier today still counts as today
  assert.equal((f(at(29, 9)) as { day: string }).day, "yesterday");
  assert.equal((f(at(29, 9)) as { tone: string }).tone, "late");
  assert.equal((f(at(27, 9)) as { day: string }).day, "date");
  assert.equal((f(at(27, 9)) as { tone: string }).tone, "late");
  assert.equal((f(new Date(2026, 9, 1, 9).toISOString()) as { day: string }).day, "tomorrow");
  assert.equal((f(new Date(2026, 9, 3, 9).toISOString()) as { tone: string }).tone, "plain");
  assert.deepEqual(f(at(30, 16), "won"), { kind: "none" }); // closed leads have no follow-up
});

test("due count: today and missed, open leads only", () => {
  const all = [lead({ nextFollowUpAt: at(30, 16) }), lead({ nextFollowUpAt: at(28, 9) }), lead({ nextFollowUpAt: new Date(2026, 9, 2).toISOString() }), lead({ status: "won", nextFollowUpAt: at(30, 9) })];
  assert.equal(dueCount(all, NOW), 2);
});

test("sources", () => {
  assert.equal(sourceInfo("widget").key, "website");
  assert.equal(sourceInfo("google_lsa").icon, "search");
  assert.equal(sourceInfo("meta_lead_ads").key, "meta");
  assert.equal(sourceInfo("manual").key, "manual");
});

test("ask is one tidy paragraph", () => {
  assert.equal(askOf(lead()), "Kitchen repaint about 400 sq ft.");
});

test("French elision of a first name", () => {
  assert.equal(deName("Aaron"), "d’Aaron");
  assert.equal(deName("Hassan"), "d’Hassan");
  assert.equal(deName("Marie"), "de Marie");
});

test("the follow-up goes by the chosen channel, else what we have", () => {
  assert.equal(sendChannel(lead({ preferredChannel: "sms" })), "sms");
  assert.equal(sendChannel(lead({ preferredChannel: "sms", phone: null })), "email");
  assert.equal(sendChannel(lead({ preferredChannel: "email" })), "email");
  assert.equal(sendChannel(lead({ preferredChannel: "sms", phone: null, email: null })), "sms");
});

test("send is only for open, subscribed leads", () => {
  assert.ok(canSend(lead()));
  assert.ok(!canSend(lead({ status: "won" })));
  assert.ok(!canSend(lead({ status: "lost" })));
  assert.ok(!canSend(lead({ unsubscribedAt: at(1, 9) })));
});

test("reply step and reopen status", () => {
  assert.equal(replyStep(0), 0);
  assert.equal(replyStep(1), 1);
  assert.equal(replyStep(7), 2);
  assert.equal(reopenStatus({ lastContactedAt: null }), "new");
  assert.equal(reopenStatus({ lastContactedAt: at(1, 9) }), "contacted");
});

test("a new lead needs a name and, if given, a real email", () => {
  const d = { name: " Mei Lin ", email: "", phone: "", channel: "sms" as const, notes: "" };
  assert.ok(canSaveLead(d));
  assert.ok(!canSaveLead({ ...d, name: "  " }));
  assert.ok(!canSaveLead({ ...d, email: "mei@" }));
  assert.ok(canSaveLead({ ...d, email: "mei@x.ca" }));
  assert.deepEqual(newLeadBody(d, "fr"), { name: "Mei Lin", preferredChannel: "sms", preferredLanguage: "fr" });
  assert.deepEqual(newLeadBody({ ...d, email: " mei@x.ca ", phone: "416", notes: " Two bedrooms " }, "en"), { name: "Mei Lin", email: "mei@x.ca", phone: "416", preferredChannel: "sms", preferredLanguage: "en", notes: "Two bedrooms" });
});
