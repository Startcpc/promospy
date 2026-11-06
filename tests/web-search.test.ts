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
 assert.equal(report.pagesRead,4);assert.equal(report.targetSites,30);assert.equal(report.codes.length,1);assert.equal(report.codes[0].id,'54:1раз');assert.equal(report.codes[0].sources.length,4);
});
test('18: unavailable search engine does not prevent known public page attempts',async()=>{
 const report=await searchMerchant(company,new AbortController().signal,async target=>{if(target.includes('bing.com'))throw Error('blocked');return html;});
 assert.equal(report.warnings.length,1);assert.equal(report.pagesRead,4);
});
test('19: every inaccessible page is an error, not an empty successful search',async()=>{
 await assert.rejects(searchMerchant(company,new AbortController().signal,async()=>{throw Error('blocked');}),/недоступны/);
});
test('20: aborted search stops discovery',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(searchMerchant(company,controller.signal,async()=>html));});
