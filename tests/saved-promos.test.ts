import test from "node:test";
import assert from "node:assert/strict";
import { parseSavedIds, parseSavedPromos, MAX_SAVED_PROMOS, exportSavedPromos, importSavedPromos } from "../src/lib/saved-promos";

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
  const list = Array.from({ length: MAX_SAVED_PROMOS + 1 }, (_, i) => ({ id: `54:SAVE${i}`, companyId: 54, code: `SAVE${i}`, savedAt: i }));
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


test('saved snapshots keep an archived or rejected status after server cache loss',()=>{
 for(const status of ['expired','rejected']) {
  const offer={id:'54:ENDED',companyId:54,code:'ENDED',description:'Old campaign',discount:'10%',status,conditions:[],sources:[],found:100,invalidSince:200};
  const [saved]=parseSavedPromos(JSON.stringify([{...offer,savedAt:1000,snapshot:offer}]));
  assert.equal(saved.snapshot?.status,status);assert.equal(saved.snapshot?.invalidSince,200);
 }
});
test('invalid calendar timestamps in saved snapshots cannot crash date formatting',()=>{
 const offer={id:'54:BADDATE',companyId:54,code:'BADDATE',description:'Offer',startsAt:Number.MAX_VALUE,expiresAt:-1,checked:Number.MAX_VALUE,sources:[]};
 const [saved]=parseSavedPromos(JSON.stringify([{...offer,savedAt:1000,snapshot:offer}]));
 assert.equal(saved.snapshot?.startsAt,undefined);assert.equal(saved.snapshot?.expiresAt,undefined);
});

test('favorites export/import keeps Unicode codes and conditions without positive cached claims',()=>{
 const offer={id:'54:1раз',companyId:54,code:'1раз',description:'Первый заказ',discount:'10%',status:'official',found:100,startsAt:200,conditions:['От 1000 рублей'],sources:[{url:'https://vkusvill.ru/promocodes/',name:'vkusvill.ru',seenAt:100}]};
 const source=parseSavedPromos(JSON.stringify([{...offer,snapshot:offer,savedAt:300}]));
 const result=importSavedPromos(exportSavedPromos(source),[]);
 assert.equal(result.added,1);assert.deepEqual(result.items,source);assert.equal(result.items[0].snapshot?.status,'found');
});
test('favorites import appends new codes, preserves existing copies and can enrich a missing snapshot',()=>{
 const current=[{id:'54:KEEP',companyId:54,code:'KEEP',savedAt:100},{id:'54:OTHER',companyId:54,code:'OTHER',savedAt:200}];
 const incoming=[{...current[0],savedAt:900},{id:'54:NEW',companyId:54,code:'NEW',savedAt:300}];
 const result=importSavedPromos(exportSavedPromos(incoming),current);
 assert.equal(result.added,1);assert.equal(result.items.length,3);assert.equal(result.items[0].savedAt,100);
 assert.equal(importSavedPromos(exportSavedPromos(result.items),result.items).added,0);
});
test('corrupt, foreign, oversized and duplicate favorites files fail without altering the current list',()=>{
 const current=[{id:'54:KEEP',companyId:54,code:'KEEP',savedAt:100}],before=JSON.stringify(current);
 const envelope=(items:unknown)=>JSON.stringify({format:'promospy-favorites',version:1,items});
 for(const raw of ['{','null','[]',JSON.stringify({format:'other',version:1,items:[]}),envelope([null]),envelope([current[0],current[0]]),' '.repeat(4_000_001)])assert.throws(()=>importSavedPromos(raw,current));
 assert.equal(JSON.stringify(current),before);
});
test('favorites import refuses an overflowing merge without silently dropping either list',()=>{
 const current=Array.from({length:100},(_,i)=>({id:`54:OLD${i}`,companyId:54,code:`OLD${i}`,savedAt:100}));
 const raw=exportSavedPromos([{id:'54:EXTRA',companyId:54,code:'EXTRA',savedAt:200}]);
 assert.throws(()=>importSavedPromos(raw,current),/больше 100/);assert.equal(current.length,100);
});

test('legacy mixed favorites import only VkusVill and report skipped records',()=>{
 const supported={id:'54:KEEP',companyId:54,code:'KEEP',savedAt:100};
 const foreign={id:'201:OLD',companyId:201,code:'OLD',savedAt:100};
 const raw=JSON.stringify({format:'promospy-favorites',version:1,items:[supported,foreign]});
 assert.deepEqual(parseSavedPromos(JSON.stringify([supported,foreign])),[supported]);
 const result=importSavedPromos(raw,[]);assert.deepEqual(result.items,[supported]);assert.equal(result.added,1);assert.equal(result.skipped,1);
});
test('favorites reject mismatched identities and placeholder coupon values',()=>{
 for(const item of [{id:'201:CODE',companyId:54,code:'CODE',savedAt:100},{id:'54:OTHER',companyId:54,code:'CODE',savedAt:100},{id:'54:undefined',companyId:54,code:'undefined',savedAt:100}])assert.deepEqual(parseSavedPromos(JSON.stringify([item])),[]);
});

test('opaque legacy favorite IDs migrate without losing the supported code or its saved copy',()=>{
 const old={id:'legacyDatabaseId',companyId:54,code:'MiXeD20',savedAt:100,snapshot:{id:'legacyDatabaseId',companyId:54,code:'MiXeD20',description:'Первый заказ',conditions:['От 1000 рублей'],sources:[],status:'official'}};
 const [saved]=parseSavedPromos(JSON.stringify([old]));
 assert.equal(saved.id,'54:MiXeD20');assert.equal(saved.code,'MiXeD20');assert.equal(saved.savedAt,100);
 assert.equal(saved.snapshot?.id,saved.id);assert.equal(saved.snapshot?.status,'found');assert.deepEqual(saved.snapshot?.conditions,['От 1000 рублей']);
});
