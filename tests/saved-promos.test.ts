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

test("saved snapshot retains conditions but never carries official or verified claims", () => {
 const item={id:"54:SAVE10",companyId:54,code:"SAVE10",savedAt:1000,snapshot:{id:"54:SAVE10",companyId:54,code:"SAVE10",description:"Первый заказ",discount:"10%",status:"verified",checked:999,conditions:["От 1000 рублей"],sources:[]}};
 const [saved]=parseSavedPromos(JSON.stringify([item]));assert.equal(saved.snapshot?.status,"found");assert.equal(saved.snapshot?.checked,undefined);assert.deepEqual(saved.snapshot?.conditions,["От 1000 рублей"]);
});

test('snapshots retain start date, minimum order and the actual source timestamp',()=>{
 const offer={id:'54:SNAP',companyId:54,code:'SNAP',description:'Terms',discount:'10%',conditions:[],found:100,startsAt:10000,minOrder:1500,sources:[{url:'https://vkusvill.ru/promocodes/',name:'vkusvill.ru',seenAt:200}]};
 const [saved]=parseSavedPromos(JSON.stringify([{...offer,savedAt:1000,snapshot:offer}]));
 assert.equal(saved.snapshot?.startsAt,10000);assert.equal(saved.snapshot?.minOrder,1500);assert.equal(saved.snapshot?.found,100);assert.equal(saved.snapshot?.sources[0].seenAt,200);
});
test('100 long Unicode coupon IDs are split below browser/proxy URL limits',async()=>{
 const {savedIdBatches}=await import('../src/lib/saved-promos');
 const ids=Array.from({length:100},(_,i)=>`54:A${i}${'Ж'.repeat(55)}`),batches=savedIdBatches(ids);
 assert.ok(batches.length>1);assert.ok(batches.every(batch=>encodeURIComponent(batch).length<=2000));assert.deepEqual(batches.flatMap(batch=>parseSavedIds(batch)!),ids);
});
