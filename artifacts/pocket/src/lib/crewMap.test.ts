import test from "node:test";
import assert from "node:assert/strict";
import { counts, fitPoints, mapPeople } from "./crewMap.ts";

test("one point, or two on top of each other, sit in the middle", () => {
  assert.deepEqual(fitPoints([{ lat: 43.65, lng: -79.38 }], 390, 400, 40), [{ x: 195, y: 200 }]);
  assert.deepEqual(fitPoints([{ lat: 43.65, lng: -79.38 }, { lat: 43.65001, lng: -79.38001 }], 390, 400, 40).map((p) => p.x), [195, 195]);
});
test("points keep north up and east right, inside the padding", () => {
  const [a, b] = fitPoints([{ lat: 43.70, lng: -79.40 }, { lat: 43.65, lng: -79.30 }], 390, 400, 40);
  assert.ok(a!.y < b!.y, "north is higher");
  assert.ok(a!.x < b!.x, "west is lefter");
  for (const p of [a!, b!]) { assert.ok(p.x >= 40 && p.x <= 350); assert.ok(p.y >= 40 && p.y <= 360); }
});
test("people: sharing first, then the rest of today's crew", () => {
  const p = mapPeople([{ workerId: "w1", name: "Dev", role: null, projectId: null, projectName: "Galloway", lat: 1, lng: 1, updatedAt: "" }], [{ workerId: "w1", name: "Dev", jobName: "x", state: "on", at: "" }, { workerId: "w2", name: "Amara", jobName: "Okoye", state: "later", at: "" }]);
  assert.deepEqual(p.map((x) => [x.name, x.kind]), [["Dev", "site"], ["Amara", "off"]]);
  assert.deepEqual(counts(p), { all: 2, site: 1, off: 1 });
});
