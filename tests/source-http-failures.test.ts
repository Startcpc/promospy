import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicHttpClient, SourceError } from '../src/lib/public-http';
const origin='https://example.org',domains=['example.org'];
const html=()=>new Response('<h1>Public page</h1>',{headers:{'content-type':'text/html'}});
function client(transport:typeof fetch){return new PublicHttpClient({transport,dispatch:async()=>undefined,intervalMs:0,backoffMs:1,retries:0,timeoutMs:1000});}
for(const status of [401,403])test('HTTP '+status+' on one URL does not disable another public URL on the host',async()=>{
 const seen:string[]=[];
 const http=client(async input=>{const url=String(input);seen.push(url);return url.endsWith('/partner-promos')?new Response('restricted',{status}):html();});
 await assert.rejects(http.readText(origin+'/partner-promos',domains,AbortSignal.timeout(2000),{robots:false}),error=>error instanceof SourceError&&error.status===status);
 assert.match((await http.readText(origin+'/public-promos',domains,AbortSignal.timeout(2000),{robots:false})).text,/Public/);
 assert.equal(seen.length,2);
 await assert.rejects(http.readText(origin+'/partner-promos',domains,AbortSignal.timeout(2000),{robots:false}));
 assert.equal(seen.length,2,'the denied URL is not hammered again');
});
for(const status of [400,401,403,404,410])test('unavailable robots HTTP '+status+' is separate from access to a public document',async()=>{
 const seen:string[]=[];
 const http=client(async input=>{const url=String(input);seen.push(url);return url.endsWith('/robots.txt')?new Response('unavailable',{status}):html();});
 assert.match((await http.readText(origin+'/promos',domains,AbortSignal.timeout(2000))).text,/Public/);
 assert.deepEqual(seen,[origin+'/robots.txt',origin+'/promos']);
});
for(const status of [200,204])test('an empty successful robots response HTTP '+status+' has no rules',async()=>{
 const http=client(async input=>String(input).endsWith('/robots.txt')?new Response(status===204?null:'',{status,headers:status===200?{'content-type':'text/plain'}:{}}):html());
 assert.match((await http.readText(origin+'/promos',domains,AbortSignal.timeout(2000))).text,/Public/);
});
test('an unavailable robots file does not grant access to a document that returns 401',async()=>{
 const http=client(async input=>new Response('unauthorized',{status:String(input).endsWith('/robots.txt')?403:401}));
 await assert.rejects(http.readText(origin+'/promos',domains,AbortSignal.timeout(2000)),error=>error instanceof SourceError&&error.status===401&&error.code==='restricted');
});
for(const status of [429,503])test('robots HTTP '+status+' cannot be treated as an absent file',async()=>{
 let documents=0;
 const http=client(async input=>String(input).endsWith('/robots.txt')?new Response('busy',{status,headers:{'retry-after':'120'}}):(documents++,html()));
 await assert.rejects(http.readText(origin+'/promos',domains,AbortSignal.timeout(2000)),error=>error instanceof SourceError&&error.code==='robots');
 assert.equal(documents,0);
});
test('a robots transport error preserves the actual failing URL',async()=>{
 const http=client(async()=>{throw Object.assign(new Error('DNS'),{cause:{code:'ENOTFOUND'}});});
 await assert.rejects(http.readText(origin+'/promos',domains,AbortSignal.timeout(2000)),error=>error instanceof SourceError&&error.code==='robots'&&error.url===origin+'/robots.txt'&&error.attempts===1);
});

test('merchant search reads another official page after the primary URL returns 401',async()=>{
 const {searchMerchant}=await import('../src/lib/web-search');
 const {getCompanyById}=await import('../src/lib/promocodes');
 const http=client(async input=>{
  const url=String(input);
  if(url.endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /',{headers:{'content-type':'text/plain'}});
  if(url==='https://vkusvill.ru/promocodes/')return new Response('unauthorized',{status:401});
  if(url==='https://vkusvill.ru')return new Response('<h1>Промокоды ВкусВилл</h1><article><h3>Скидка на заказ</h3><p>Промокод: PUBLIC20</p></article>',{headers:{'content-type':'text/html'}});
  return new Response('missing',{status:404});
 });
 const report=await searchMerchant(getCompanyById(54)!,AbortSignal.timeout(3000),async(url,allowed,signal)=>(await http.readText(url,allowed,signal)).text);
 assert.ok(report.codes.some(code=>code.code==='PUBLIC20'));
 assert.ok(report.sourceResults?.some(source=>source.url==='https://vkusvill.ru/promocodes/'&&source.outcome==='blocked'));
});

test('Burger King proceeds to additional public sources after 403, 404 and a browser challenge',async()=>{
 const {searchMerchant}=await import('../src/lib/web-search');
 const {getCompanyById}=await import('../src/lib/promocodes');
 const seen:string[]=[];
 const http=client(async input=>{
  const url=String(input);seen.push(url);
  if(url.endsWith('/robots.txt'))return new Response('',{status:401});
  if(url==='https://promokod.vbr.ru/shops/burger-king/')return new Response('<h1>Промокоды Burger King</h1><article><h3>Тестовая скидка 20%</h3><p>Промокод: SOURCEBK20</p></article>',{headers:{'content-type':'text/html'}});
  if(url.includes('burgerkingrus.ru'))return new Response('forbidden',{status:403});
  if(url.includes('promokodus.com'))return new Response('<title>Just a moment</title>',{headers:{'content-type':'text/html'}});
  return new Response('missing',{status:404});
 });
 const report=await searchMerchant(getCompanyById(5)!,AbortSignal.timeout(3000),async(url,allowed,signal)=>(await http.readText(url,allowed,signal)).text);
 assert.ok(report.codes.some(code=>code.code==='SOURCEBK20'));
 assert.ok(seen.includes('https://promokod.vbr.ru/shops/burger-king/'));
 assert.equal(report.codes[0].status,'found');
});
