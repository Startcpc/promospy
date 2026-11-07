import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMerchantPage, searchMerchant } from '../src/lib/web-search';
import { getCompanyById, type PromoCode } from '../src/lib/promocodes';
import { mergeOffers } from '../src/lib/offer-identity';
import { parseSitemap, parseIndexLinks, parseFeedLinks } from '../src/lib/discovery';
import { parsePromoDate, type ParseDiagnostics } from '../src/lib/promo-parser';
import { validPromo } from '../src/lib/promo-validation';
import { parseSavedPromos, resolveSavedOffer, savedOfferMatches } from '../src/lib/saved-promos';
import { needsRendering, BrowserReader } from '../src/lib/browser-reader';
const company=getCompanyById(54)!;
const card=(code:string,terms='Заказ от 1000 рублей')=>'<h1>Промокоды ВкусВилл</h1><article><h3>Скидка 200 рублей</h3><p>Промокод: '+code+'</p><p>'+terms+'</p></article>';
const third='https://promokodus.com/campaigns/vkusvill-new';
test('DuckDuckGo independently discovers a source when Bing and known pages fail',async()=>{
  const seen:string[]=[];
  const report=await searchMerchant(company,AbortSignal.timeout(3000),async url=>{
    seen.push(url);
    if(url.includes('bing.com'))throw Error('Bing unavailable');
    if(url.includes('duckduckgo.com'))return '<a class="result__a" href="/l/?uddg='+encodeURIComponent(third)+'">ВкусВилл</a>';
    if(url===third)return card('DISCOVER20');
    if(url.includes('yahoo.com'))return '<html></html>';
    if(url.startsWith('https://vkusvill.ru'))return '<title>ВкусВилл</title>';
    throw Error('missing old URL');
  });
  assert.ok(report.codes.some(code=>code.code==='DISCOVER20'));assert.ok(seen.includes(third));
  assert.ok(report.discovery?.some(provider=>provider.provider==='duckduckgo-html'&&provider.found===1));
});
test('merchant sitemap indexes discover promotion pages before external providers',async()=>{
  const source='https://vkusvill.ru/offers/promo-new/',seen:string[]=[];
  const report=await searchMerchant(company,AbortSignal.timeout(3000),async url=>{
    seen.push(url);
    if(url==='https://vkusvill.ru/sitemap.xml')return '<sitemapindex><sitemap><loc>https://vkusvill.ru/promo-map.xml</loc></sitemap></sitemapindex>';
    if(url==='https://vkusvill.ru/promo-map.xml')return '<urlset><url><loc>'+source+'</loc></url><url><loc>https://vkusvill.ru/account/promo</loc></url></urlset>';
    if(url===source)return card('SITEMAP20');
    return url.startsWith('https://vkusvill.ru')?'<title>ВкусВилл</title>':'<rss/>';
  });
  assert.equal(report.codes.find(code=>code.code==='SITEMAP20')?.status,'official');
  assert.ok(seen.indexOf(source)<seen.findIndex(url=>url.includes('bing.com')));
  assert.ok(!seen.some(url=>url.includes('/account/')));
});
test('previously observed URLs are reused, but private, account and unlisted history is ignored',async()=>{
  const history='https://getcashback.ru/promocodes/vkusvill/observed',seen:string[]=[];
  const report=await searchMerchant(company,AbortSignal.timeout(3000),async url=>{
    seen.push(url);if(url===history)return card('HISTORY20');throw Error('unavailable');
  },undefined,{previousUrls:[history,'https://127.0.0.1/','https://evil.example/promos','https://vkusvill.ru/account/promo']});
  assert.equal(report.codes[0].code,'HISTORY20');assert.ok(seen.includes(history));assert.ok(!seen.some(url=>/127\.0\.0\.1|evil\.example|account/.test(url)));
});
test('page and discovery budgets bound the work even with hundreds of sitemap URLs',async()=>{
  const report=await searchMerchant(company,AbortSignal.timeout(3000),async url=>{
    if(url.endsWith('/sitemap.xml'))return '<urlset>'+Array.from({length:500},(_,i)=>'<url><loc>https://vkusvill.ru/promo/'+i+'</loc></url>').join('')+'</urlset>';
    return '<h1>Промокоды ВкусВилл</h1><p>Активных промокодов нет</p>';
  },undefined,{pageBudget:6,discoveryBudget:3});
  assert.ok(report.budget!.pagesUsed<=6);assert.ok(report.budget!.discoveryUsed<=3);assert.ok(report.sourceResults!.some(source=>!source.official));
});
test('RSS, Atom and JSON feeds contain source-backed codes and exclude other merchants',()=>{
  const rss='<rss><channel><title>Промокоды ВкусВилл</title><item><title>Скидка на заказ</title><description><![CDATA[<p>Промокод: FEED20</p>]]></description></item><item><title>Озон: скидка</title><description>Промокод: FOREIGN20</description></item></channel></rss>';
  assert.deepEqual(parseMerchantPage(rss,'https://vkusvill.ru/feed.xml',company).map(code=>code.code),['FEED20']);
  const atom='<feed><title>ВкусВилл</title><entry><title>Скидка на заказ</title><content>Промокод: ATOM20</content></entry></feed>';
  assert.equal(parseMerchantPage(atom,'https://vkusvill.ru/feed.xml',company)[0].code,'ATOM20');
  const json=JSON.stringify({version:'https://jsonfeed.org/version/1.1',title:'ВкусВилл',items:[{title:'Скидка на заказ',content_text:'Промокод: JSONFEED20'}]});
  assert.equal(parseMerchantPage(json,'https://vkusvill.ru/feed.json',company)[0].code,'JSONFEED20');
});
test('feed and index discovery cannot turn redirects into arbitrary URL access',()=>{
  assert.deepEqual(parseIndexLinks('<a href="/l/?uddg=https%3A%2F%2F169.254.169.254%2Fmetadata">bad</a>','https://html.duckduckgo.com/html/',['promokodi.ru']),[]);
  assert.deepEqual(parseFeedLinks('<feed><entry><link rel="alternate" href="https://promokodi.ru/store/vkusvill"/></entry></feed>',['promokodi.ru']),['https://promokodi.ru/store/vkusvill']);
  assert.deepEqual(parseSitemap('<urlset><url><loc>https://evil.example/promo</loc></url></urlset>',['vkusvill.ru']).pages,[]);
});
test('public JSON requires explicit merchant ownership and JSON-LD promo identifiers retain terms',()=>{
  const wrong=JSON.stringify([{promoCode:'NOTOURS20',title:'Скидка',merchantName:'Ozon'}]);
  assert.deepEqual(parseMerchantPage(wrong,'https://promokodi.ru/feed.json',company),[]);
  assert.deepEqual(parseMerchantPage(JSON.stringify([{promoCode:'UNKNOWN20',title:'Скидка'}]),'https://promokodi.ru/feed.json',company),[]);
  const json=JSON.stringify({'@type':'Offer',seller:{name:'ВкусВилл'},identifier:{'@type':'PropertyValue',propertyID:'promoCode',value:'JSONLD20'},description:'Только в приложении. Заказ от 1500 рублей, максимальная скидка 300 рублей',discountPercent:20,regions:['Москва'],eligibleCategories:['Продукты']});
  const [code]=parseMerchantPage(json,'https://promokodi.ru/feed.json',company);
  assert.equal(code.code,'JSONLD20');assert.equal(code.minOrder,1500);assert.equal(code.maxDiscount,300);assert.equal(code.appOnly,true);assert.deepEqual(code.regions,['Москва']);
});
test('recommendations, hidden session tokens, phones and product data-code values are not coupons',()=>{
  const examples=[
    '<h1>ВкусВилл</h1><article data-code="SKU123"><h3>Скидка на товар</h3></article>',
    '<h1>ВкусВилл</h1><article><h3>Промокод на заказ</h3><input type="hidden" name="csrf_code" value="SECRETKEY20"></article>',
    '<h1>ВкусВилл</h1><article><h3>Промокод на заказ</h3><p>Промокод: 79991234567</p></article>',
    '<h1>ВкусВилл</h1><script type="application/json">'+JSON.stringify({session:{promoCode:'SECRET20'},recommendations:[{promoCode:'FOREIGN20'}]})+'</script>',
  ];
  for(const html of examples)assert.deepEqual(parseMerchantPage(html,'https://promokodi.ru/store/vkusvill/',company),[]);
});
test('a partially rejected source does not confirm disappearance of its previous offers',async()=>{
  const html='<h1>Промокоды ВкусВилл</h1><script type="application/json">'+JSON.stringify([{promoCode:'VALID20',merchantName:'ВкусВилл',title:'Скидка 20%'},{promoCode:'BADDATE20',merchantName:'ВкусВилл',title:'Скидка',expiresAt:'2026-02-31'}])+'</script>';
  const report=await searchMerchant(company,AbortSignal.timeout(3000),async url=>url==='https://vkusvill.ru/promocodes/'?html:'<title>Empty</title>');
  assert.ok(report.codes.some(code=>code.code==='VALID20'));
  assert.equal(report.sourceResults?.find(source=>source.url==='https://vkusvill.ru/promocodes/')?.partial,true);
  assert.ok(!report.parsedUrls?.includes('https://vkusvill.ru/promocodes/'));
});
test('explicit expiry badges and English dates do not become active undated offers',()=>{
  const [expired]=parseMerchantPage('<h1>ВкусВилл</h1><h2>Expired coupons</h2><article><h3>Скидка 20%</h3><p>Промокод: ENDED20</p></article>','https://promokodi.ru/store/vkusvill/',company);
  assert.equal(expired.status,'expired');
  assert.equal(parsePromoDate('November 30, 2026',true),Date.parse('2026-11-30T23:59:59.999+03:00'));
  assert.equal(parsePromoDate('31 February 2026'),undefined);
});
test('campaign identities survive response order and a saved offer cannot silently acquire conflicting terms',()=>{
  const base=parseMerchantPage(card('REUSED20'),'https://promokodi.ru/store/vkusvill/',company)[0];
  const other={...base,discount:'500 ₽',minOrder:5000,sources:[{url:'https://getcashback.ru/promocodes/vkusvill/',name:'getcashback.ru',seenAt:200}]};
  const merged=mergeOffers([base,other]),reverse=mergeOffers([other,base]);
  assert.equal(merged.length,2);assert.deepEqual(new Set(merged.map(code=>code.id)),new Set(reverse.map(code=>code.id)));assert.ok(merged.every(code=>validPromo(code,54)));
  const [saved]=parseSavedPromos(JSON.stringify([{...base,savedAt:100,snapshot:base}]));
  assert.equal(resolveSavedOffer(saved,[other]),undefined);assert.equal(savedOfferMatches(saved,merged.find(code=>code.minOrder===1000)!),true);
  assert.equal(savedOfferMatches(saved,merged.find(code=>code.minOrder===5000)!),false);
});
test('a missing optional browser does not break the deterministic engine',async()=>{
  let launches=0;
  const reader=new BrowserReader({enabled:true,hosts:['vkusvill.ru'],launch:async()=>{launches++;throw Error('not installed');}});
  assert.equal((await reader.render('https://vkusvill.ru/promocodes/',['vkusvill.ru'],AbortSignal.timeout(1000))).reason,'unavailable');
  assert.equal((await reader.render('https://promokodi.ru/store/vkusvill/',['promokodi.ru'],AbortSignal.timeout(1000))).reason,'disabled');
  assert.equal(launches,1);assert.equal(needsRendering('<title>Just a moment</title><div id="root">Checking your browser</div>'),false);
});
