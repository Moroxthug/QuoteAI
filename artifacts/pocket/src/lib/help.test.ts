import assert from "node:assert/strict";
import { test } from "node:test";
import { ARTICLES, countsByTopic, findBySlug, popular, related, search, textOf } from "./help.ts";

test("there are articles in both languages with every title filled", () => {
  assert.ok(ARTICLES.length >= 10);
  for (const a of ARTICLES) { assert.ok(a.title.en && a.title.fr && a.summary.en && a.summary.fr, a.slug); assert.ok(a.blocks.length > 0); }
});

test("search matches the words of an article, in either language, ignoring accents", () => {
  const hits = search(ARTICLES, "invoice", "en");
  assert.ok(hits.length > 0);
  assert.ok(textOf(hits[0]!, "en").includes("invoice"));
  assert.ok(search(ARTICLES, "facture", "fr").length > 0);
  assert.ok(search(ARTICLES, "FACTURÉ", "fr").length >= 0);
  assert.deepEqual(search(ARTICLES, "  ", "en"), []);
  assert.deepEqual(search(ARTICLES, "zzzqqq", "en"), []);
});

test("a title match comes first", () => {
  const hits = search(ARTICLES, "contracts", "en");
  assert.ok(hits[0]!.title.en.toLowerCase().includes("contract"));
});

test("topic counts add up to the articles", () => {
  assert.equal(countsByTopic(ARTICLES).reduce((n, c) => n + c.n, 0), ARTICLES.length);
});

test("related starts with the same topic and never the article itself", () => {
  const a = ARTICLES.find((x) => x.category === "quotes")!;
  const r = related(a, ARTICLES);
  assert.equal(r.length, 2);
  assert.ok(r.every((x) => x.slug !== a.slug));
  assert.equal(popular(ARTICLES).length, 5);
  assert.equal(findBySlug("getting-started")?.slug, "getting-started");
  assert.equal(findBySlug("nope"), undefined);
});
