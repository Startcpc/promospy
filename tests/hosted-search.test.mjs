import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../work/sites-worker/server/index.js';

const origin='https://site.example';
function request(path,method='GET') {
  return new Request(origin+path,{method,headers:{Origin:origin}});
}

test('hosted catalog and search work without access to a platform cache', async t=>{
  const reads=[];
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);
    reads.push(url.href);
    if(url.pathname==='/robots.txt')return new Response('User-agent: *\nAllow: /');
    if(url.hostname==='promocodex.ru')return new Response('<h1>Промокоды Вкусно и точка</h1><article><h3>Скидка 10% на заказ</h3><p>Промокод: TESTSITE10</p></article>');
    return new Response('Временно недоступно',{status:403});
  });
  const html=await (await worker.fetch(request('/company/402'))).text();
  assert.match(html,/\/client\.js/);assert.match(html,/__variable_/);
  const initial=await (await worker.fetch(request('/api/scan/402'))).json();
  assert.equal(initial.status,'idle');assert.deepEqual(reads,[]);
  const response=await worker.fetch(request('/api/scan/402','POST'));
  const state=await response.json();
  assert.equal(response.status,200);assert.equal(state.status,'idle');
  assert.deepEqual(state.codes.map(code=>[code.companyId,code.code]),[[402,'TESTSITE10']]);
  assert.ok(state.report.sourceResults.some(source=>source.message?.includes('403')));
  const saved=await (await worker.fetch(request('/api/promocodes/saved?ids=402:TESTSITE10'))).json();
  assert.equal(saved.codes[0].sources[0].url,'https://promocodex.ru/promocodes/vkusnoitochka/');
  assert.deepEqual((await (await worker.fetch(request('/api/scan/403'))).json()).codes,[]);
  assert.equal((await worker.fetch(request('/api/scan/999','POST'))).status,404);
  assert.equal((await worker.fetch(new Request(origin+'/api/scan/402',{method:'POST',headers:{Origin:'https://other.example'}}))).status,403);
});
