import test from "node:test";
import assert from "node:assert/strict";
import { addOpened, addSearch, fold, highlight, isOpened, matchesTerm, parseList, search, type Hit } from "./search.ts";

const h = (type: Hit["type"], id: string, title: string, extra = ""): Hit => ({ type, id, title, haystack: `${title} ${extra}`, ref: null });

test("accents and case are ignored, and every word has to be there", () => {
  assert.equal(fold("Côté Montréal"), "cote montreal");
  assert.equal(matchesTerm("INV-0412 Tom & Lena Hart overdue", "hart overdue"), true);
  assert.equal(matchesTerm("INV-0412 Tom & Lena Hart", "hart overdue"), false);
  assert.equal(matchesTerm("Marie Côté", "cote"), true);
  assert.equal(matchesTerm("anything", "   "), false);
});

test("the match is drawn inside the title", () => {
  assert.deepEqual(highlight("Tom & Lena Hart", "hart"), ["Tom & Lena ", "Hart", ""]);
  assert.deepEqual(highlight("Marie Côté", "cote"), ["Marie ", "Côté", ""]);
  assert.deepEqual(highlight("Dana Whitfield", "zzz"), ["Dana Whitfield", "", ""]);
});

test("under All each type shows three and says there is more; one type shows them all", () => {
  const hits = [h("quotes", "1", "Hart a"), h("quotes", "2", "Hart b"), h("quotes", "3", "Hart c"), h("quotes", "4", "Hart d"), h("clients", "5", "Hart client"), h("jobs", "6", "Other")];
  const all = search(hits, "hart", "all");
  assert.deepEqual(all.groups.map((g) => [g.type, g.n, g.rows.length, g.more]), [["quotes", 4, 3, true], ["clients", 1, 1, false]]);
  assert.deepEqual([all.counts.all, all.counts.quotes, all.counts.clients, all.counts.jobs], [5, 4, 1, 0]);
  assert.equal(search(hits, "hart", "quotes").groups[0]!.rows.length, 4);
});

test("recent searches go first, once, six at most, and short ones are not kept", () => {
  assert.deepEqual(addSearch(["hart", "dental"], "Hart"), ["Hart", "dental"]);
  assert.deepEqual(addSearch(["hart"], "h"), ["hart"]);
  assert.equal(addSearch(["a1", "b2", "c3", "d4", "e5", "f6"], "g7").length, 6);
});

test("recently opened keeps four, newest first, one each", () => {
  let l = addOpened([], { type: "quotes", id: "1", title: "A", sub: "" });
  for (const i of [2, 3, 4, 5]) l = addOpened(l, { type: "jobs", id: String(i), title: "J", sub: "" });
  l = addOpened(l, { type: "jobs", id: "3", title: "J", sub: "" });
  assert.deepEqual(l.map((x) => x.id), ["3", "5", "4", "2"]);
});

test("a stored list survives junk", () => {
  assert.deepEqual(parseList("nope", isOpened), []);
  assert.equal(parseList(JSON.stringify([{ type: "jobs", id: "1", title: "x", sub: "" }, { type: "bad" }, 5]), isOpened).length, 1);
});
