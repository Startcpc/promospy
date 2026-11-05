import test from "node:test";
import assert from "node:assert/strict";
import { parseSavedIds, parseSavedPromos, MAX_SAVED_PROMOS } from "../src/lib/saved-promos";

test("saved data preserves Cyrillic case and identity, discards cached statuses and corrupt entries", () => {
  const valid = { id: "54:1раз", companyId: 54, code: "1раз", savedAt: 1000 };
  assert.deepEqual(parseSavedPromos(JSON.stringify([
    { ...valid, status: "verified", expiresAt: 9999999999, conditions: ["old"] }, valid,
    { ...valid, id: "unknown", companyId: -1 }, { ...valid, id: "bad", code: "<script>" },
    { ...valid, id: "future", savedAt: "1000" }, null,
  ])), [valid]);
  for (const raw of [null, "not json", "{}", '"text"', "x".repeat(100001)]) assert.deepEqual(parseSavedPromos(raw), []);
});
test("saved lists and lookup queries are bounded and reject incomplete or invalid IDs", () => {
  const list = Array.from({ length: MAX_SAVED_PROMOS + 1 }, (_, i) => ({ id: `id${i}`, companyId: 54, code: `SAVE${i}`, savedAt: i }));
  assert.equal(parseSavedPromos(JSON.stringify(list)).length, MAX_SAVED_PROMOS);
  assert.deepEqual(parseSavedIds("id1,54:1раз,id1"), ["id1", "54:1раз"]);
  for (const raw of [null, "", "id1,", ",id1", "a b", "<script>", "a".repeat(129), list.map(item => item.id).join(",")]) assert.equal(parseSavedIds(raw), null);
});
