import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompanyById } from '../src/lib/promocodes';
import { parseMerchantPage, readPublicPage } from '../src/lib/web-search';
const company=getCompanyById(54)!,url='https://promokodi.ru/store/vkusvill/';
const page=(body:string)=>`<h1>Промокоды ВкусВилл</h1>${body}`;

test('explicit Russian and English labels are extracted without uppercase guessing',()=>{
 for(const label of ['Код скидки:','Используйте код:','Promo code:','Coupon code:','Скопировать промокод:']) {
  const codes=parseMerchantPage(page(`<article><h3>Скидка на заказ</h3><p>${label} REAL20</p></article>`),url,company);
  assert.equal(codes[0]?.code,'REAL20',label);
 }
});
test('an unrelated merchant card inside the main page cannot be attributed to this merchant',()=>{
 const codes=parseMerchantPage(page('<article><h3>Ozon: скидка на заказ</h3><p>Промокод: FOREIGN20</p></article>'),url,company);
 assert.deepEqual(codes,[]);
});
test('the same code with conflicting explicit conditions remains separate offers',()=>{
 const codes=parseMerchantPage(page('<article><h3>Скидка 100 рублей</h3><p>Промокод: REUSED20</p><p>Заказ от 1000 рублей</p></article><article><h3>Скидка 500 рублей</h3><p>Промокод: REUSED20</p><p>Заказ от 5000 рублей</p></article>'),url,company);
 assert.equal(codes.length,2);assert.deepEqual(new Set(codes.map(code=>code.minOrder)),new Set([1000,5000]));
});
test('304 reuses an actually retrieved representation rather than losing the source',async()=>{
 const original=globalThis.fetch,proxy=process.env.HTTPS_PROXY;process.env.HTTPS_PROXY='http://test-proxy.invalid';let calls=0;
 globalThis.fetch=async input=>{
  if(String(input).endsWith('/robots.txt'))return new Response('',{status:404});
  return ++calls===1?new Response('<h1>Source</h1>',{headers:{'content-type':'text/html',etag:'"v1"'}}):new Response(null,{status:304});
 };
 try {
  assert.match(await readPublicPage(url,['promokodi.ru'],AbortSignal.timeout(10000)),/Source/);
  assert.match(await readPublicPage(url,['promokodi.ru'],AbortSignal.timeout(10000)),/Source/);
 } finally {globalThis.fetch=original;if(proxy===undefined)delete process.env.HTTPS_PROXY;else process.env.HTTPS_PROXY=proxy;}
});
test('one transient 503 receives a bounded retry instead of ending the source immediately',async()=>{
 const original=globalThis.fetch,proxy=process.env.HTTPS_PROXY;process.env.HTTPS_PROXY='http://test-proxy.invalid';let calls=0;
 globalThis.fetch=async input=>{
  if(String(input).endsWith('/robots.txt'))return new Response('',{status:404});
  return ++calls===1?new Response('busy',{status:503}):new Response('<h1>Recovered</h1>',{headers:{'content-type':'text/html'}});
 };
 try {assert.match(await readPublicPage(url+'retry',['promokodi.ru'],AbortSignal.timeout(10000)),/Recovered/);assert.equal(calls,2);}
 finally {globalThis.fetch=original;if(proxy===undefined)delete process.env.HTTPS_PROXY;else process.env.HTTPS_PROXY=proxy;}
});
