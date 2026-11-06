import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompanyById } from '../src/lib/promocodes';
import { SEARCH_DOMAINS, safeSource, parseDiscovery, parseMerchantPage, searchMerchant } from '../src/lib/web-search';
const company=getCompanyById(54)!;
const url='https://promokodi.ru/store/vkusvill';
const html='<title>ВкусВилл — промокоды</title><article><h3>Первый заказ</h3><p>Промокод: 1раз</p><p>Заказ от 1000 рублей</p></article>';
test('01: registry targets 30 domains including the selected merchant',()=>assert.equal(new Set(SEARCH_DOMAINS).size+1,30));
test('02: only listed HTTPS origins are followed',()=>assert.equal(safeSource(url,['promokodi.ru']),true));
for(const [name,source] of [['03: rejects HTTP','http://promokodi.ru'],['04: rejects private IP','https://127.0.0.1'],['05: rejects credentials','https://x@y@promokodi.ru'],['06: rejects custom port','https://promokodi.ru:8443'],['07: rejects lookalike','https://promokodi.ru.evil.test']])test(name,()=>assert.equal(safeSource(source,['promokodi.ru']),false));
test('08: www is normalized',()=>assert.equal(safeSource('https://www.promokodi.ru/store/vkusvill',['promokodi.ru']),true));
test('09: RSS discovery deduplicates and filters destinations',()=>assert.deepEqual(parseDiscovery(`<rss><channel><item><link>${url}</link></item><item><link>${url}</link></item><item><link>https://evil.test/</link></item></channel></rss>`,['promokodi.ru']),[url]));
test('10: malformed search markup produces no invented URLs',()=>assert.deepEqual(parseDiscovery('<html>captcha</html>',['promokodi.ru']),[]));
test('11: Cyrillic case is preserved',()=>assert.equal(parseMerchantPage(html,url,company)[0].code,'1раз'));
test('12: title from another merchant excludes codes',()=>assert.deepEqual(parseMerchantPage(html.replace('ВкусВилл','Ozon'),url,company),[]));
test('13: arbitrary uppercase words are not coupons',()=>assert.deepEqual(parseMerchantPage('<title>ВкусВилл</title><article>WELCOME BUY NOW</article>',url,company),[]));
test('14: offers do not receive official/verified status',()=>{const offer=parseMerchantPage(html,url,company)[0];assert.equal(offer.status,'found');assert.equal(offer.checked,undefined);assert.equal(offer.evidence,undefined);});
test('15: source URL remains attached to the code',()=>assert.equal(parseMerchantPage(html,url,company)[0].sources[0].url,url));
test('16: explicit cards retain order conditions',()=>assert.match(parseMerchantPage(html,url,company)[0].conditions.join(' '),/1000/));
test('17: search records actual pages and merges the same code',async()=>{
 const report=await searchMerchant(company,new AbortController().signal,async target=>target.includes('bing.com')?'<rss/>':html);
 assert.equal(report.pagesRead,5);assert.equal(report.targetSites,30);assert.equal(report.codes.length,1);assert.equal(report.codes[0].id,'54:1раз');assert.equal(report.codes[0].sources.length,5);
});
test('18: unavailable search engine does not prevent known public page attempts',async()=>{
 const report=await searchMerchant(company,new AbortController().signal,async target=>{if(target.includes('bing.com'))throw Error('blocked');return html;});
 assert.equal(report.warnings.length,1);assert.equal(report.pagesRead,5);
});
test('19: source failures are reported individually without crashing the search',async()=>{
 const report=await searchMerchant(company,new AbortController().signal,async()=>{throw Error('blocked');});
 assert.equal(report.pagesRead,0);assert.equal(report.pagesFailed,5);assert.equal(report.issues?.length,5);assert.deepEqual(report.codes,[]);
});
test('20: aborted search stops discovery',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(searchMerchant(company,controller.signal,async()=>html));});

test('21: official pages finish before the first third-party request',async()=>{
 const order:string[]=[];
 await searchMerchant(company,new AbortController().signal,async target=>{order.push(target);return target.includes('bing.com')?'<rss/>':html;});
 assert.deepEqual(order.slice(0,2),['https://vkusvill.ru/promocodes/','https://vkusvill.ru']);
 assert.ok(order.slice(2).every(target=>!target.startsWith('https://vkusvill.ru')));
});
test('22: official offers are published while other sources are still pending',async()=>{
 let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});let partial=false;
 const task=searchMerchant(company,new AbortController().signal,async target=>{
  if(target.startsWith('https://vkusvill.ru'))return html;
  await gate;return target.includes('bing.com')?'<rss/>':html;
 },report=>{if(report.phase==='official'&&report.codes.length){partial=true;assert.equal(report.codes[0].status,'official');}});
 for(let i=0;i<50&&!partial;i++)await new Promise(resolve=>setTimeout(resolve,2));
 assert.ok(partial);finish();await task;
});
test('23: failed official site falls through to readable third-party pages',async()=>{
 const report=await searchMerchant(company,new AbortController().signal,async target=>{
  if(target.startsWith('https://vkusvill.ru'))throw Error('HTTP 503');
  return target.includes('bing.com')?'<rss/>':html;
 });
 assert.equal(report.codes[0].status,'found');assert.equal(report.officialPagesRead,0);assert.equal(report.pagesRead,3);assert.equal(report.pagesFailed,2);
});
test('24: a single broken coupon source cannot discard other results',async()=>{
 const report=await searchMerchant(company,new AbortController().signal,async target=>{
  if(target.includes('promokodus'))throw Error('HTTP 404');return target.includes('bing.com')?'<rss/>':html;
 });
 assert.equal(report.codes.length,1);assert.equal(report.pagesFailed,1);assert.equal(report.phase,'complete');
});
test('25: official links stay on configured domains and exclude accounts and lookalikes',async()=>{
 const {officialLinks}=await import('../src/lib/web-search');
 assert.deepEqual(officialLinks('<a href="/promocodes/#new">Акции</a><a href="https://evil.test/promo">Акции</a><a href="/account">Войти</a>','https://vkusvill.ru/',['vkusvill.ru']),['https://vkusvill.ru/promocodes/']);
});
test('26: known coupon pages start without waiting for slow discovery',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let direct=false;
 const task=searchMerchant(company,new AbortController().signal,async target=>{
  if(target.includes('bing.com')){await gate;return '<rss/>';}
  if(target.includes('promokodi.ru'))direct=true;return html;
 });
 for(let i=0;i<50&&!direct;i++)await new Promise(resolve=>setTimeout(resolve,2));
 assert.ok(direct);release();await task;
});
test('27: dedicated parsers read observed official VkusVill and Magnit markup',async()=>{
 const {readFileSync}=await import('node:fs');const {parsePublicOfficial}=await import('../src/lib/official-search');
 for(const [id,name]of [[54,'vkusvill'],[201,'magnit']]as const){
  const offers=parsePublicOfficial(id,readFileSync(new URL(`./fixtures/${name}-official.html`,import.meta.url),'utf8'));
  assert.ok(offers.length>0);assert.ok(offers.every(offer=>['official','expired'].includes(offer.status)&&offer.conditions.length>0));
 }
});
test('28: proxy routing respects NO_PROXY without resolving proxy-only destinations locally',async()=>{
 const {routedThroughProxy}=await import('../src/lib/web-search');
 assert.equal(routedThroughProxy(url,{HTTPS_PROXY:'http://proxy:8080'}),true);
 assert.equal(routedThroughProxy(url,{HTTPS_PROXY:'http://proxy:8080',NO_PROXY:'.promokodi.ru'}),false);
 assert.equal(routedThroughProxy(url,{HTTPS_PROXY:'http://proxy:8080',NO_PROXY:'*'}),false);
 assert.equal(routedThroughProxy(url,{HTTPS_PROXY:'http://proxy:8080',NO_PROXY:'other.test'}),true);
 assert.equal(routedThroughProxy(url,{}),false);
});
