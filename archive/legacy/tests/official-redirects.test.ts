import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectPublicOfficial } from '../src/lib/public-official';
const html=readFileSync(new URL('./fixtures/vkusvill-official.html',import.meta.url),'utf8');
test('follows an official 302 to the canonical www host',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async (url: string|URL|Request,init?:RequestInit)=>{
  assert.equal(init?.redirect,'manual');calls++;
  if(calls===1)return new Response(null,{status:302,headers:{location:'https://www.vkusvill.ru/promocodes/'}});
  assert.equal(url,'https://www.vkusvill.ru/promocodes/');
  return new Response(html,{headers:{'content-type':'text/html'}});
 });
 const snapshot=await collectPublicOfficial(54,AbortSignal.timeout(3000));
 assert.equal(snapshot.complete,true);assert.equal(snapshot.codes[0].code,'1раз');assert.equal(calls,2);
});
test('external redirect never reaches its destination or revokes previous publication',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://evil.example/'}});});
 const snapshot=await collectPublicOfficial(54,AbortSignal.timeout(3000));
 assert.equal(snapshot.complete,false);assert.equal(calls,1);assert.match(snapshot.error!,/пределы/);
});
test('redirect loops are bounded',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(null,{status:302,headers:{location:'/promocodes/'}});});
 assert.equal((await collectPublicOfficial(54,AbortSignal.timeout(3000))).complete,false);assert.equal(calls,4);
});
