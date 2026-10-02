import assert from "node:assert/strict";
import { test } from "node:test";
import { embedCode, mailtoCode, previewFields, widgetLeads } from "./widget.ts";

test("the code carries the key and the look", () => {
  const code = embedCode({ origin: "https://quoteai.ca", apiKey: "quoteai_pk_abc", colour: "#1F4F86", theme: "auto", lang: "fr" });
  assert.match(code, /src="https:\/\/quoteai\.ca\/widget\.js"/);
  assert.match(code, /data-api-key="quoteai_pk_abc"/);
  assert.match(code, /data-color="#1F4F86"/);
  assert.match(code, /data-theme="auto"/);
  assert.match(code, /data-lang="fr"/);
});

test("the widget's leads this month and the last one", () => {
  const now = new Date(2026, 9, 15);
  const r = widgetLeads([
    { source: "widget", createdAt: new Date(2026, 9, 3).toISOString() },
    { source: "widget", createdAt: new Date(2026, 8, 20).toISOString() },
    { source: "manual", createdAt: new Date(2026, 9, 10).toISOString() },
  ], now);
  assert.equal(r.thisMonth, 1);
  assert.equal(r.last?.getDate(), 3);
  assert.deepEqual(widgetLeads([], now), { thisMonth: 0, last: null });
});

test("the preview shows the name and up to two more fields", () => {
  const w = { name: "Your name", phone: "Phone", email: "Email", postal: "Postal code" };
  assert.deepEqual(previewFields({ phone: true, email: true, postal: true }, w), ["Your name", "Phone", "Email"]);
  assert.deepEqual(previewFields({ phone: false, email: false, postal: true }, w), ["Your name", "Postal code"]);
});

test("the mail to the web person has the code in it", () => {
  assert.match(mailtoCode("Widget", "Please add this", "<script>"), /^mailto:\?subject=Widget&body=Please%20add%20this%0A%0A%3Cscript%3E$/);
});
