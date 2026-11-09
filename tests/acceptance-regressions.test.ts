import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompanyById, type PromoCode } from '../src/lib/promocodes';
import { parseMerchantPage, searchMerchant } from '../src/lib/web-search';
import { parsePromoCodesFromHtml, type ParseDiagnostics } from '../src/lib/promo-parser';
import { mergeOffers } from '../src/lib/offer-identity';
import { savedOfferMatches } from '../src/lib/saved-promos';
const company=getCompanyById(54)!,url='https://promokodi.ru/store/vkusvill/';
const now=Date.parse('2026-11-08T12:00:00+03:00');
const page=(body:string)=>'<h1>Промокоды ВкусВилл</h1>'+body;
const card=(terms:string,attrs='')=>page('<article '+attrs+'><h3>Скидка 20%</h3><p>Промокод: ACCEPT20</p><p>'+terms+'</p></article>');
const read=(html:string,diagnostics?:ParseDiagnostics)=>parseMerchantPage(html,url,company,now,false,diagnostics);
const base=():PromoCode=>read(card('Заказ от 1000 рублей'))[0];
test('structured offers keep a deadline written only in their conditions',()=>{
 const [code]=parsePromoCodesFromHtml(JSON.stringify([{promoCode:'ACCEPT20',conditions:['Действует до 30.11.2026']}]),url,54,now);
 assert.equal(code.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
});
test('shared-year Russian numeric ranges preserve both boundaries',()=>{
 const [code]=read(card('С 10.11 по 30.11.2026'));
 assert.equal(code.startsAt,Date.parse('2026-11-10T00:00:00+03:00'));assert.equal(code.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
});
test('English written coupon deadlines are not treated as unlimited',()=>{
 assert.equal(read(card('Valid until November 30, 2026'))[0].expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
});
test('English ISO date deadlines are retained',()=>{
 assert.equal(read(card('Expires: 2026-11-30'))[0].expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
});
test('a visible invalid deadline rejects the affected offer and marks a partial parse',()=>{
 const d:ParseDiagnostics={incomplete:false,reasons:[]};assert.deepEqual(read(card('Действует до 31.11.2026'),d),[]);assert.equal(d.incomplete,true);
});
test('a deadline without a year is not silently advertised as unlimited',()=>{
 const d:ParseDiagnostics={incomplete:false,reasons:[]};assert.deepEqual(read(card('Действует до 30 ноября'),d),[]);assert.equal(d.incomplete,true);
});
test('contradictory visible and machine deadlines reject the affected offer',()=>{
 const d:ParseDiagnostics={incomplete:false,reasons:[]};assert.deepEqual(read(card('Действует до 30.11.2026','data-expires-at="2026-12-31"'),d),[]);assert.equal(d.incomplete,true);
});
test('explicit Moscow clock time is kept in third-party cards',()=>{
 assert.equal(read(card('Действует до 30.11.2026 в 18:30 МСК'))[0].expiresAt,Date.parse('2026-11-30T18:30:00+03:00'));
});
test('a written campaign start is preserved',()=>{
 assert.equal(read(card('С 10 ноября 2026 по 30 ноября 2026'))[0].startsAt,Date.parse('2026-11-10T00:00:00+03:00'));
});
test('backwards written date ranges reject only the affected campaign',()=>{
 assert.deepEqual(read(card('С 30 ноября 2026 по 10 ноября 2026')),[]);
});
test('cards under hidden ancestors cannot become public offers',()=>{
 assert.deepEqual(read(page('<div hidden><article><h3>Скидка 20%</h3><p>Промокод: HIDDEN20</p></article></div>')),[]);
});
test('a hidden code element cannot be recovered through the structured fallback',()=>{
 assert.deepEqual(read(page('<article><h3>Скидка 20%</h3><span hidden data-promocode="HIDDEN20">Промокод</span></article>')),[]);
});
test('inline JS assignments do not expose codes nested under session branches',()=>{
 const html=page('<script>window.state='+JSON.stringify({session:{promoCode:'PRIVATE20'},offers:[{promoCode:'PUBLIC20',title:'Скидка 20%'}]})+';</script>');
 assert.deepEqual(read(html).map(code=>code.code),['PUBLIC20']);
});
test('inline JS preserves the owner of a nested foreign merchant offer',()=>{
 const html=page('<script>window.state='+JSON.stringify({merchantName:'Ozon',offers:[{promoCode:'FOREIGN20',title:'Скидка 20%'}]})+';</script>');
 assert.deepEqual(read(html),[]);
});
test('region restrictions distinguish campaigns even when the code and amount match',()=>{
 const a={...base(),regions:['Москва']},b={...base(),regions:['Казань']};
 const codes=mergeOffers([a,b]);assert.equal(codes.length,2);assert.equal(new Set(codes.map(code=>code.id)).size,2);
});
test('category restrictions distinguish campaigns',()=>{
 assert.equal(mergeOffers([{...base(),categories:['Овощи']},{...base(),categories:['Молоко']}]).length,2);
});
test('region identities ignore list order and case',()=>{
 const a={...base(),regions:['Москва','Казань']},b={...base(),regions:['казань','москва']};assert.equal(mergeOffers([a,b]).length,1);
});
test('a compatible merged source retains an explicit channel and app restriction',()=>{
 const [code]=mergeOffers([base(),{...base(),channel:'app',appOnly:true}]);assert.equal(code.channel,'app');assert.equal(code.appOnly,true);
});
test('merged source timestamps reflect the latest actual observation',()=>{
 const a={...base(),sources:[{url,name:'source',seenAt:100}]},b={...base(),sources:[{url,name:'source',seenAt:200}]};
 assert.equal(mergeOffers([a,b])[0].sources[0].seenAt,200);
});
test('the earliest discovery timestamp survives merge order',()=>{
 const a={...base(),found:100},b={...base(),found:200};assert.equal(mergeOffers([b,a])[0].found,100);
});
test('RSS partial date failures are visible to the source coordinator',()=>{
 const d:ParseDiagnostics={incomplete:false,reasons:[]};
 const rss='<rss><channel><title>ВкусВилл</title><item><title>Скидка 20%</title><description><![CDATA[<p>Промокод: BADDATE20</p><p>До 31.11.2026</p>]]></description></item></channel></rss>';
 assert.deepEqual(read(rss,d),[]);assert.equal(d.incomplete,true);
});
test('Atom XHTML content preserves the explicit code element',()=>{
 const atom='<feed xmlns="http://www.w3.org/2005/Atom"><title>ВкусВилл</title><entry><title>Скидка 20%</title><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Промокод: <code>XHTML20</code></p><p>Заказ от 1000 рублей</p></div></content></entry></feed>';
 assert.equal(read(atom)[0]?.code,'XHTML20');assert.equal(read(atom)[0]?.minOrder,1000);
});
test('an unrestricted old favorite cannot mark both new regional variants as saved',()=>{
 const snapshot=base(),item={...snapshot,snapshot,savedAt:100};
 const variants=mergeOffers([{...snapshot,regions:['Москва']},{...snapshot,regions:['Казань']}]);
 assert.ok(variants.every(offer=>!savedOfferMatches(item,offer)));
});
test('an old favorite is not silently replaced by a new category-specific variant',()=>{
 const snapshot=base(),item={...snapshot,snapshot,savedAt:100};
 const variants=mergeOffers([{...snapshot,categories:['Овощи']},{...snapshot,categories:['Молоко']}]);
 assert.ok(variants.every(offer=>!savedOfferMatches(item,offer)));
});
test('a publication timestamp cannot masquerade as a coupon deadline',()=>{
 const html=card('Действует до 30.11.2026').replace('</article>','<time itemprop="datePublished" datetime="2026-11-01">Обновлено 1 ноября 2026</time></article>');
 assert.equal(read(html)[0]?.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
});
test('a semantic expiry time remains a machine-readable deadline',()=>{
 const html=card('Заказ от 1000 рублей').replace('</article>','<time itemprop="validThrough" datetime="2026-11-30">30 ноября 2026</time></article>');
 assert.equal(read(html)[0]?.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
});
// Live pikabu pages publish the coupon record inside an application/json script
// and name the store with its official service brand, not the short company
// name. Before the alias fix these records were silently dropped.
