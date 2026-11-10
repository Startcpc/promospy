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

test('placeholders and HTTP error captions never become coupon values',()=>{
 for(const value of ['нет','отсутствует','недоступен','undefined','null','HTTP 403','HTTPS','true','false']){
  assert.deepEqual(parseMerchantPage(page(`<article><h3>Скидка 20%</h3><p>Промокод: ${value}</p></article>`),url,company),[],value);
  const json=JSON.stringify([{promoCode:value,title:'Скидка 20%',merchantName:'ВкусВилл'}]);
  assert.deepEqual(parseMerchantPage(json,url,company),[],value);
 }
});
test('removed merchant recommendations remain excluded from cards, feeds and structured data',()=>{
 for(const merchant of ['Ozon','Магнит','Пятёрочка','Яндекс Маркет','Wildberries','Burger King','Лента','Перекрёсток','Тануки']){
  const card=`<article><h3>${merchant}: скидка 20%</h3><p>Промокод: FOREIGN20</p></article>`;
  assert.deepEqual(parseMerchantPage(page(card),url,company),[],merchant);
  const feed=`<rss><channel><title>ВкусВилл</title><item><title>${merchant}: скидка 20%</title><description><![CDATA[<p>Промокод: FOREIGN20</p>]]></description></item></channel></rss>`;
  assert.deepEqual(parseMerchantPage(feed,url,company),[],merchant);
  assert.deepEqual(parseMerchantPage(JSON.stringify({merchantName:merchant,offers:[{promoCode:'FOREIGN20',title:'Скидка 20%'}]}),url,company),[],merchant);
 }
});
test('malformed JSON and HTML do not invent codes or crash the parser',()=>{
 for(const html of ['{','null','[]','{"promoCode":','<html><article><p>Скидка 20%','<script>{"promoCode":</script>'])assert.deepEqual(parseMerchantPage(html,url,company),[]);
});
test('VkusVill structured records preserve explicit maximum discounts and separate campaigns',()=>{
 const records=[500,1500].map(limit=>({promoCode:'LIMIT20',merchantName:'ВкусВилл',title:'Скидка 35% на первый заказ от 1200 рублей',description:`Максимальная сумма скидки ${limit} рублей.`}));
 const codes=parseMerchantPage(JSON.stringify(records),url,company);
 assert.equal(codes.length,2);assert.deepEqual(new Set(codes.map(code=>code.maxDiscount)),new Set([500,1500]));
});

test('cancellation during a source read stops the search before alternative sources start',async()=>{
 const {searchMerchant}=await import('../src/lib/web-search');
 const controller=new AbortController();let calls=0,started!:()=>void;
 const ready=new Promise<void>(resolve=>{started=resolve;});
 const pending=searchMerchant(company,controller.signal,async(_url,_domains,signal)=>{
  calls++;started();return new Promise<string>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 });
 const rejected=assert.rejects(pending,/cancel test/);await ready;controller.abort(new Error('cancel test'));await rejected;assert.equal(calls,1);
});

test('coupon maximum wording and several service-specific limits stay faithful to source terms',()=>{
 for(const description of ['Максимум - 500 рублей.','Максимальная сумма скидки 500 рублей.']){
  const [code]=parseMerchantPage(JSON.stringify([{promoCode:'CAP20',merchantName:'ВкусВилл',title:'Скидка 20%',description}]),url,company);
  assert.equal(code.maxDiscount,500);
 }
 const description='Максимальная сумма скидки 1500 рублей при доставке. Максимальная сумма скидки 500 рублей в магазине.';
 const [code]=parseMerchantPage(JSON.stringify([{promoCode:'CAP20',merchantName:'ВкусВилл',title:'Скидка 20%',description}]),url,company);
 assert.equal(code.maxDiscount,undefined);assert.ok(code.conditions.includes(description));
});
test('recognizable VkusVill markup cannot override a foreign title or heading',async()=>{
 const {readFileSync}=await import('node:fs'),{searchMerchant}=await import('../src/lib/web-search');
 const fixture=readFileSync(new URL('./fixtures/vkusvill-official.html',import.meta.url),'utf8');
 for(const tag of ['title','h1']){
  const html=fixture.replace(new RegExp('<'+tag+'[^>]*>[\\s\\S]*?</'+tag+'>','i'),'<'+tag+'>Промокоды Ozon</'+tag+'>');
  const report=await searchMerchant(company,AbortSignal.timeout(3000),async target=>target==='https://vkusvill.ru/promocodes/'?html:'<rss/>');
  assert.deepEqual(report.codes,[]);assert.deepEqual(report.parsedUrls,[]);
 }
});

test('explicit labels never truncate masked or invalid tokens into invented codes',()=>{
 for(const value of ['ABC***','ABC…','ABC...','ABC•••','ABC****DEF','ABC[скрыто]','ABCD/1234','ABC ****','ABC …']){
  assert.deepEqual(parseMerchantPage(page(`<article><h3>Скидка 20%</h3><p>Промокод: ${value}</p></article>`),url,company),[],value);
  const json=JSON.stringify({'@type':'Offer',merchantName:'ВкусВилл',description:`Промокод: ${value}`});
  assert.deepEqual(parseMerchantPage(json,url,company),[],value);
 }
 for(const value of ['MiXeD20.','«MiXeD20»','MiXeD20,'])assert.equal(parseMerchantPage(page(`<article><h3>Скидка 20%</h3><p>Промокод: ${value}</p></article>`),url,company)[0]?.code,'MiXeD20');
});

test('an archived catalogue campaign cannot expire a freshly published official code',async()=>{
 const {mergeOffers}=await import('../src/lib/offer-identity');
 const current=parseMerchantPage(page('<article><h3>Скидка 200 рублей</h3><p>Промокод: REUSED20</p><p>На первый заказ от 1000 рублей</p></article>'),url,company)[0];
 const official={...current,status:'official',checked:Date.now()} as typeof current;
 const archived={...current,status:'expired',expiresAt:Date.parse('2025-12-31T23:59:59+03:00'),sources:[{url:'https://getcashback.ru/promocodes/vkusvill/',name:'getcashback.ru',seenAt:Date.now()}]} as typeof current;
 for(const input of [[official,archived],[archived,official]]){
  const offers=mergeOffers(input);assert.equal(offers.length,2);
  const live=offers.find(code=>code.status==='official')!;assert.equal(live.expiresAt,undefined);assert.equal(live.sources.length,1);
  assert.equal(offers.find(code=>code.status==='expired')?.expiresAt,archived.expiresAt);
 }
});

test('string merchant owners are respected and inherited by nested structured offers',()=>{
 for(const owner of ['merchant','seller','shop']){
  const content=(name:string)=>page('<script type="application/json">'+JSON.stringify({[owner]:name,offers:[{promoCode:'OWNER20',title:'Скидка 20%'}]})+'</script>');
  assert.deepEqual(parseMerchantPage(content('Ozon'),url,company),[],owner);
  assert.equal(parseMerchantPage(content('ВкусВилл'),url,company)[0]?.code,'OWNER20',owner);
 }
});
test('a late deadline and restrictions survive long HTML and JSON conditions',()=>{
 const terms='Условия заказа. '.repeat(130)+' Действует до 01.01.2020. Заказ от 5000 рублей. Только в приложении.';
 const bodies=['<article><h3>Скидка 20%</h3><p>Промокод: LATE20</p><p>'+terms+'</p></article>','<script type="application/json">'+JSON.stringify([{promoCode:'LATE20',title:'Скидка 20%',conditions:[terms]}])+'</script>'];
 for(const body of bodies){const [code]=parseMerchantPage(page(body),url,company);assert.equal(code?.status,'expired');assert.equal(code.expiresAt,Date.parse('2020-01-01T23:59:59.999+03:00'));assert.equal(code.minOrder,5000);assert.equal(code.appOnly,true);assert.match(code.conditions.join(' '),/01.01.2020/);assert.ok(code.conditions.every(text=>text.length<=1500));}
});
test('unsafe numeric JSON coupon values cannot be rounded into invented strings',()=>{
 assert.deepEqual(parseMerchantPage('[{"merchantName":"ВкусВилл","promoCode":1234567890123456789,"title":"Скидка 20%"}]',url,company),[]);
 assert.equal(parseMerchantPage('[{"merchantName":"ВкусВилл","promoCode":12345,"title":"Скидка 20%"}]',url,company)[0]?.code,'12345');
});
test('oversized named-code cards cannot fall back to undated structured attributes',()=>{
 const diagnostics={incomplete:false,reasons:[] as string[]};
 const html=page('<article data-promocode="TOOLONG20"><h3>Скидка 20%</h3><p>'+('Условия заказа. '.repeat(410))+' Действует до 01.01.2020</p></article>');
 assert.deepEqual(parseMerchantPage(html,url,company,Date.now(),false,diagnostics),[]);assert.equal(diagnostics.incomplete,true);
});

test('a parent code wrapper cannot bypass a masked child without explicit full-copy evidence',()=>{
 const masked=page('<article><h3>Скидка 20%</h3><p>Промокод</p><div class="btn-code"><span class="code-part">ABC</span></div></article>');
 assert.deepEqual(parseMerchantPage(masked,url,company),[]);
 assert.equal(parseMerchantPage(masked.replace('class="btn-code"','class="btn-code" data-clipboard-text="FULLCODE20"'),url,company)[0]?.code,'FULLCODE20');
});
test('observed Promokodi archive containers never advertise ended offers as current',()=>{
 const html=page('<div class="shop-expired-coupon-list" id="expired-coupon-list"><div class="offer"><h3>Скидка 20%</h3><p>Промокод</p><button data-clipboard-text="ARCHIVED20">Копировать</button><div class="offer__meta__icon" title="Период действия купона завершён."><span class="count">01.09.2026</span></div></div></div>');
 const [code]=parseMerchantPage(html,url,company);assert.equal(code?.status,'expired');assert.equal(code.expiresAt,Date.parse('2026-09-01T23:59:59.999+03:00'));
});

test('conflicting structured merchant claims are rejected while equivalent VkusVill aliases remain valid',()=>{
 const content=(shop:string)=>page('<script type="application/json">'+JSON.stringify({merchantName:'ВкусВилл',shop,offers:[{promoCode:'OWNER20',title:'Скидка 20%'}]})+'</script>');
 assert.deepEqual(parseMerchantPage(content('Ozon'),url,company),[]);
 assert.equal(parseMerchantPage(content('vkusvill'),url,company)[0]?.code,'OWNER20');
});
test('oversized structured terms are rejected as incomplete instead of losing late restrictions',()=>{
 for(const conditions of [Array.from({length:21},(_,i)=>i===20?'Действует до 01.01.2020':'Условие заказа'),['Условие '.repeat(5000)],['Ж'.repeat(1501)+' Действует до 01.01.2020']]){
  const diagnostics={incomplete:false,reasons:[] as string[]};
  const html=page('<script type="application/json">'+JSON.stringify([{promoCode:'LIMITED20',title:'Скидка 20%',conditions}])+'</script>');
  assert.deepEqual(parseMerchantPage(html,url,company,Date.now(),false,diagnostics),[]);assert.equal(diagnostics.incomplete,true);
 }
});

test('explicit merchant ownership on HTML cards also constrains copy and named-code attributes',()=>{
 for(const attribute of ['data-clipboard-text','data-promocode'])for(const owner of ['data-merchant-name','data-store-name','data-shop-name']){
  const html=page(`<article ${owner}="Ozon"><h3>Скидка 20%</h3><p>Промокод</p><button ${attribute}="FOREIGN20">Копировать</button></article>`);
  assert.deepEqual(parseMerchantPage(html,url,company),[]);
  assert.equal(parseMerchantPage(html.replace('Ozon','ВкусВилл'),url,company)[0]?.code,'FOREIGN20');
 }
});
test('ambiguous named-code containers cannot be rescued as generic undated offers',()=>{
 const diagnostics={incomplete:false,reasons:[] as string[]};
 const html=page('<article data-promocode="AMBIG20"><h3>Скидка 20%</h3><h3>Другие условия</h3><p>Заказ от 1000 рублей</p></article>');
 assert.deepEqual(parseMerchantPage(html,url,company,Date.now(),false,diagnostics),[]);assert.equal(diagnostics.incomplete,true);
});

test('distribution contains only the VkusVill catalogue and no legacy database or maintenance commands',async()=>{
 const {existsSync,readFileSync,readdirSync}=await import('node:fs');
 const {companies}=await import('../src/lib/companies');
 const root=new URL('../',import.meta.url);
 assert.deepEqual(companies.map(company=>company.id),[54]);
 assert.deepEqual(readdirSync(new URL('public/logos/',root)),['vkusvill-user.png']);
 for(const file of ['db/custom.db','prisma/schema.prisma','prisma/bootstrap.sql','scripts/database-tools.mjs','scripts/backup-db.mjs','scripts/restore-db.mjs','tests/database-tools.test.mjs','Caddyfile'])assert.equal(existsSync(new URL(file,root)),false,file);
 const metadata=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
 for(const command of ['db:backup','db:restore','test:database'])assert.equal(metadata.scripts[command],undefined);
 assert.ok(!metadata.scripts.check.includes('test:database'));
 assert.deepEqual(readdirSync(new URL('docs/',root)).sort(),['release-0.13.0.md','server-setup.md']);
});
