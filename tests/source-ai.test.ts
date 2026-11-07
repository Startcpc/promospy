import test from 'node:test';
import assert from 'node:assert/strict';
import { localModelEndpoint, validateLocalFacts, enrichWithLocalModel } from '../src/lib/source-ai';
import type { PromoCode } from '../src/lib/promocodes';
const offer:PromoCode={id:'54:SOURCE20',companyId:54,code:'SOURCE20',description:'Промокод ВкусВилл',discount:'По условиям акции',status:'found',sources:[{url:'https://vkusvill.ru/promocodes/',name:'vkusvill.ru',seenAt:100}],found:100,conditions:[],extraction:{method:'card',text:'Скидка на первый заказ. Только в приложении. Заказ от 1500 рублей.'}};
test('optional AI accepts only an explicitly configured loopback endpoint without credentials',()=>{
  for(const url of ['https://remote.example/','http://169.254.169.254/','http://127.0.0.1.evil/','http://user:password@127.0.0.1/','http://127.0.0.1/?token=x'])assert.equal(localModelEndpoint(url),null);
  assert.equal(localModelEndpoint('http://localhost:11434/'),'http://127.0.0.1:11434/api/chat');
});
test('AI facts must be literal source substrings for the exact already discovered code',()=>{
  assert.ok(validateLocalFacts({code:'SOURCE20',description:'Скидка на первый заказ.',conditions:['Только в приложении.']},offer));
  for(const value of [{code:'INVENTED20',conditions:[]},{code:'SOURCE20',conditions:['Бесплатный заказ']},{code:'SOURCE20',conditions:[],status:'verified'},{code:'SOURCE20',conditions:[],url:'https://evil.test/'}])assert.equal(validateLocalFacts(value,offer),null);
});
test('local AI can enrich literal conditions without changing code, timestamps or status',async()=>{
  const result=await enrichWithLocalModel(offer,AbortSignal.timeout(1000),{model:'local-model',transport:async(input,init)=>{
    assert.equal(String(input),'http://127.0.0.1:11434/api/chat');
    const body=JSON.parse(String(init?.body));assert.equal(body.stream,false);assert.equal(body.model,'local-model');assert.equal(body.options.temperature,0);
    return Response.json({message:{content:JSON.stringify({code:'SOURCE20',description:'Скидка на первый заказ.',conditions:['Только в приложении.']})}});
  }});
  assert.equal(result.code,offer.code);assert.equal(result.status,'found');assert.equal(result.found,100);assert.deepEqual(result.conditions,['Только в приложении.']);assert.equal(result.extraction?.method,'local-ai');
});
test('model errors and invented facts fall back to original deterministic data',async()=>{
  for(const transport of [async()=>new Response('',{status:404}),async()=>Response.json({message:{content:'{"code":"FAKE20","conditions":[]}'}}),async()=>{throw Error('not running');}]){
    assert.deepEqual(await enrichWithLocalModel(offer,AbortSignal.timeout(1000),{model:'local-model',transport}),offer);
  }
});
