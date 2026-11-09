import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_CATALOGUES, SEARCH_DOMAINS, catalogueUrls, EXCLUDED_CATALOGUES } from '../src/lib/source-catalog';
import { companies } from '../src/lib/companies';
import { safeSource } from '../src/lib/fetch-policy';
import { SourceAvailability } from '../src/lib/source-availability';
import { SourceError } from '../src/lib/public-http';
import { parseMerchantPage, searchMerchant } from '../src/lib/web-search';
import { isLoginWall } from '../src/lib/source-extraction';
import { validPromo, validReport } from '../src/lib/promo-validation';
const company=companies.find(item=>item.id===54)!;
const url='https://promocodex.ru/promocodes/vkusvill/';
const now=Date.parse('2026-11-08T12:00:00Z');
// All values below are synthetic. These documents never enter the runtime cache.
const table=(rows:string,headers='<th>Промокод</th><th>Условия</th><th>Действует до</th>')=>'<h1>Промокоды ВкусВилл</h1><table><thead><tr>'+headers+'</tr></thead><tbody>'+rows+'</tbody></table>';
const row=(code='TABLE20',terms='Скидка 20% на заказ от 1500 рублей',date='30.11.2026')=>`<tr><td>${code}</td><td>${terms}</td><td>${date}</td></tr>`;
test('catalogue has five independent domains and a concrete public URL for each',()=>{
  assert.equal(PUBLIC_CATALOGUES.length,5);assert.equal(new Set(SEARCH_DOMAINS).size,5);
  for(const source of PUBLIC_CATALOGUES){const pages=Object.values(source.pages).flat();assert.ok(pages.length);assert.ok(pages.every(page=>safeSource(page,[source.domain])));}
});
test('closed sources and paid voucher shops cannot re-enter through discovery',()=>{
  for(const domain of [...EXCLUDED_CATALOGUES.map(source=>source.domain),'biglion.ru','gilmon.ru','dtf.ru','vc.ru'])assert.ok(!SEARCH_DOMAINS.includes(domain));
});
test('only VkusVill has public candidates',()=>{
  assert.deepEqual(companies.map(company=>company.id),[54]);
  assert.equal(catalogueUrls(54).length,5);
  for(const id of [5,201,208,999])assert.deepEqual(catalogueUrls(id),[]);
  for(const source of PUBLIC_CATALOGUES)assert.deepEqual(Object.keys(source.pages),['54']);
});
test('table code retains its conditions, source, expiry and unverified status',()=>{
  const [code]=parseMerchantPage(table(row()),url,company,now);
  assert.equal(code.code,'TABLE20');assert.equal(code.minOrder,1500);assert.equal(code.discount,'20%');
  assert.equal(code.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));assert.equal(code.status,'found');
  assert.equal(code.sources[0].url,url);assert.equal(code.checked,undefined);assert.ok(validPromo(code,54));
});
test('table columns can be reordered without exchanging deadline and conditions',()=>{
  const html=table('<tr><td>30.11.2026</td><td>Скидка 10% на заказ от 3000 рублей</td><td>REORDER10</td></tr>','<th>Срок действия</th><th>Скидка</th><th>Код скидки</th>');
  const [code]=parseMerchantPage(html,url,company,now);assert.equal(code.code,'REORDER10');assert.equal(code.minOrder,3000);
});
test('adjacent table rows retain distinct order minimums',()=>{
  const codes=parseMerchantPage(table(row('ROW20')+row('ROW30','Скидка 30% на заказ от 5000 рублей')),url,company,now);
  assert.equal(codes.length,2);assert.equal(codes.find(code=>code.code==='ROW20')?.minOrder,1500);assert.equal(codes.find(code=>code.code==='ROW30')?.minOrder,5000);
});
test('table statistics and arbitrary uppercase text do not become codes',()=>{
  assert.deepEqual(parseMerchantPage(table(row(),' <th>Магазин</th><th>Условия</th><th>Срок</th>'),url,company,now),[]);
});
test('masked table values and hidden rows are ignored',()=>{
  const html=table(row('ABC***')+row('<span class="code-tail">XYZ</span>')+row('HIDDEN20').replace('<tr>','<tr hidden>'));
  assert.deepEqual(parseMerchantPage(html,url,company,now),[]);
});
test('expired table rows remain expired and indefinite rows get no invented date',()=>{
  const codes=parseMerchantPage(table(row('OLD20','Скидка 20%','01.11.2026')+row('NOEND20','Скидка 20%','До отмены')),url,company,now);
  assert.equal(codes.find(code=>code.code==='OLD20')?.status,'expired');assert.equal(codes.find(code=>code.code==='NOEND20')?.expiresAt,undefined);
});
test('tables in an archive section stay expired even with a future written date',()=>{
  const html='<h1>ВкусВилл</h1><h2>Истёкшие промокоды</h2>'+table(row());
  assert.equal(parseMerchantPage(html,url,company,now)[0].status,'expired');
});
test('invalid table dates reject only the bad row and mark the page partial',()=>{
  const diagnostics={incomplete:false,reasons:[] as string[]};
  const codes=parseMerchantPage(table(row('BAD20','Скидка 20%','31.02.2026')+row()),url,company,now,false,diagnostics);
  assert.deepEqual(codes.map(code=>code.code),['TABLE20']);assert.equal(diagnostics.incomplete,true);
});
test('a coupon table for another merchant or a recommendation cannot be attributed',()=>{
  assert.deepEqual(parseMerchantPage(table(row()).replace('ВкусВилл','Ozon'),url,company,now),[]);
  assert.deepEqual(parseMerchantPage('<h1>ВкусВилл</h1><aside>'+table(row())+'</aside>',url,company,now),[]);
});
test('private HTML cards and structured premium records are excluded',()=>{
  const html='<h1>ВкусВилл</h1><article data-requires-login="true"><h3>Скидка 20%</h3><p>Промокод: PRIVATE20</p></article><script type="application/json">'+JSON.stringify([{promoCode:'PREMIUM20',title:'Скидка 20%',isPremium:true}])+'</script>';
  assert.deepEqual(parseMerchantPage(html,url,company,now),[]);
});
test('a private structured parent cannot leak nested coupon values',()=>{
  const html='<h1>ВкусВилл</h1><script type="application/json">'+JSON.stringify({requiresLogin:true,offers:[{promoCode:'NESTED20',title:'Скидка 20%'}]})+'</script>';
  assert.deepEqual(parseMerchantPage(html,url,company,now),[]);
});
test('a login wall is distinguished from the shop account needed to redeem a public code',()=>{
  assert.equal(isLoginWall('<h1>Войдите, чтобы увидеть промокоды</h1>'),true);
  assert.equal(isLoginWall('<h1>ВкусВилл</h1><nav>Войти</nav><article><p>Чтобы применить промокод, войдите в приложение магазина</p></article>'),false);
  assert.equal(isLoginWall('<h1>ВкусВилл</h1>'+table(row())+'<h2>Войдите, чтобы увидеть промокоды</h2>'),false);
});
test('a denied private URL does not pause other public paths',()=>{
  const tracker=new SourceAvailability();tracker.remember(url,new SourceError('HTTP 401','restricted',url,401),now);
  assert.equal(tracker.get(url,now)?.httpStatus,401);assert.equal(tracker.get('https://promocodex.ru/promocodes/another/',now),undefined);
});
test('a browser challenge pauses the host and expires after 15 minutes',()=>{
  const tracker=new SourceAvailability();tracker.remember(url,new SourceError('Challenge','restricted',url,200),now);
  assert.ok(tracker.get('https://promocodex.ru/another/',now));assert.equal(tracker.get(url,now+15*60_000),undefined);
});
test('rate limiting keeps a longer server Retry-After for the entire host',()=>{
  const tracker=new SourceAvailability(),retryAt=now+3600_000;
  tracker.remember(url,new SourceError('HTTP 429','rate_limit',url,429,retryAt),now);
  assert.equal(tracker.get('https://promocodex.ru/another/',now)?.retryAt,retryAt);
});
test('ordinary parse failures never suppress a subsequent public request',()=>{
  const tracker=new SourceAvailability();tracker.remember(url,new SourceError('Markup','parse',url,200),now);
  assert.equal(tracker.get(url,now),undefined);
});
test('a challenge is not retried on refresh and independent sources still return codes',async()=>{
  let blockedCalls=0,publicCalls=0;
  const read=async(target:string)=>{
    if(target==='https://getcashback.ru/promocodes/vkusvill/'){blockedCalls++;return '<title>Just a moment</title>';}
    if(target===url){publicCalls++;return table(row());}
    return '<rss/>';
  };
  const first=await searchMerchant(company,AbortSignal.timeout(3000),read);
  const second=await searchMerchant(company,AbortSignal.timeout(3000),read);
  assert.equal(blockedCalls,1);assert.equal(publicCalls,2);assert.ok(first.codes.length);assert.ok(second.codes.length);
  assert.equal(second.pagesSkipped,1);assert.ok(second.sourceResults?.some(source=>source.outcome==='skipped'&&source.url.includes('getcashback.ru')));
  assert.ok(validReport(second));
});
test('an official login wall falls through to public catalogues without being parsed as empty',async()=>{
  const report=await searchMerchant(company,AbortSignal.timeout(3000),async target=>target.startsWith('https://vkusvill.ru')?'<h1>Войдите, чтобы увидеть промокоды</h1>':target===url?table(row()):'<rss/>');
  assert.ok(report.codes.length);assert.equal(report.codes[0].status,'found');assert.equal(report.officialPagesRead,0);
  assert.ok(!report.parsedUrls?.some(page=>page.startsWith('https://vkusvill.ru')));assert.ok(report.pagesSkipped!>0);
});
test('a proven previous public URL is scheduled before new catalogue candidates',async()=>{
  const seen:string[]=[],previous='https://promocodex.ru/promocodes/observed-vkusvill/';
  await searchMerchant(company,AbortSignal.timeout(3000),async target=>{seen.push(target);return '<rss/>';},undefined,{previousUrls:[previous]});
  assert.ok(seen.indexOf(previous)<seen.indexOf('https://promokod.pikabu.ru/shops/vkusvill'));
});

// Reproduced from an actual HTTP response, reduced to the card structure.
// Coupon values in this fixture are synthetic and never loaded by the app.
const getcashbackUrl='https://getcashback.ru/promocodes/vkusvill/';
const getcashbackHtml=readFileSync(new URL('./fixtures/getcashback-public.html',import.meta.url),'utf8');
test('GetCashback full public codes retain card-specific terms and Moscow deadlines',()=>{
  const codes=parseMerchantPage(getcashbackHtml,getcashbackUrl,company,now);
  const code=codes.find(code=>code.code==='PUBLIC600')!;
  assert.ok(code);assert.equal(code.status,'found');assert.equal(code.minOrder,3000);
  assert.equal(code.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
  assert.ok(code.conditions.join(' ').includes('Не действует на товары от партнёров'));
  assert.equal(code.appOnly,true);assert.equal(code.sources[0].url,getcashbackUrl);
  assert.equal(code.checked,undefined);assert.ok(validPromo(code,54));
  assert.equal(codes.find(code=>code.code==='ARCHIVE200')?.status,'expired');
});
test('GetCashback adaptation is limited to the observed host and merchant',()=>{
  assert.deepEqual(parseMerchantPage(getcashbackHtml,'https://promokodi.ru/store/vkusvill/',company,now),[]);
  assert.deepEqual(parseMerchantPage(getcashbackHtml.replace('Промокоды ВкусВилл','Промокоды Ozon'),getcashbackUrl,company,now),[]);
});
test('GetCashback masks, link placeholders and Telegram ads do not become codes',()=>{
  for(const value of ['AB***','Подробнее по ссылке'])assert.equal(parseMerchantPage(getcashbackHtml.replace('PUBLIC600',value),getcashbackUrl,company,now).some(code=>code.status==='found'),false);
  assert.deepEqual(parseMerchantPage('<h1>ВкусВилл</h1><div class="m-banner">'+getcashbackHtml.replace('PUBLIC600','TG')+'</div>',getcashbackUrl,company,now),[]);
});
test('GetCashback invalid deadlines mark the page partial and preserve the valid sibling',()=>{
  const diagnostics={incomplete:false,reasons:[] as string[]};
  const codes=parseMerchantPage(getcashbackHtml.replace('30 ноября 2026 г.','31 февраля 2026 г.'),getcashbackUrl,company,now,false,diagnostics);
  assert.deepEqual(codes.map(code=>code.code),['ARCHIVE200']);assert.equal(diagnostics.incomplete,true);
});
test('GetCashback hidden and paid cards remain excluded after adaptation',()=>{
  for(const attribute of ['hidden','data-premium="true"','data-requires-login="true"']){
    const html=getcashbackHtml.replaceAll('class="coupon--item',attribute+' class="coupon--item');
    assert.deepEqual(parseMerchantPage(html,getcashbackUrl,company,now),[]);
  }
});
test('GetCashback popular coupons cannot leak other merchants with the same card markup',()=>{
  for(const heading of ['<h2>Популярные купоны</h2>','<div class="coupon-title">Похожие купоны</div>']){
    const html=getcashbackHtml+heading+getcashbackHtml.replaceAll('PUBLIC600','FOREIGN600').replaceAll('ARCHIVE200','FOREIGN200');
    assert.deepEqual(parseMerchantPage(html,getcashbackUrl,company,now).map(code=>code.code).sort(),['ARCHIVE200','PUBLIC600']);
  }
});

// Reduced observed Promokod.com structure; coupon values are synthetic.
const promokodPage=(code='FULLCODE20',owner='ВкусВилл')=>`<h1>Промокоды ВкусВилл</h1><div class="pk-store-tile"><div class="coupon-wrap" data-code="${code}" data-store-name="${owner}" data-title="Сэкономьте 300 рублей при заказе от 1500 рублей!">
<div class="coupon"><h3 class="coupon-title">Сэкономьте 300 рублей при заказе от 1500 рублей!</h3><div class="coupon-meta">Проверено · Применен 167 раз · Подробнее</div><div class="valid"><span class="v-full">Действует до 30 ноября 2026</span><span class="v-short">До 30 ноября 2026</span></div><span class="used-mobile">Применен 167 раз</span><a class="code-btn">Открыть промокод <span class="peek-real">E20</span></a></div>
<div class="coupon-detail"><p>Скидка 300 рублей на первый онлайн-заказ от 1500 рублей.</p><div class="detail-act-title">Активность</div><ul class="detail-act"><li>Гость воспользовался этим промокодом 3 часа назад</li></ul></div></div></div>`;
test('Promokod.com public wrappers retain real terms without inheriting checkout or usage claims',()=>{
 const [code]=parseMerchantPage(promokodPage(),'https://promokod.com/coupon-store/vkusvill-ru',company,now);
 assert.equal(code.code,'FULLCODE20');assert.equal(code.description,'Сэкономьте 300 рублей при заказе от 1500 рублей!');
 assert.equal(code.discount,'300 ₽');
 assert.equal(code.minOrder,1500);assert.equal(code.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
 assert.doesNotMatch([code.description,...code.conditions].join(' '),/Проверено|Применен|воспользовался|Открыть промокод/);
 assert.match(code.conditions.join(' '),/первый онлайн-заказ/);assert.equal(code.status,'found');assert.equal(code.evidence,undefined);
});
test('Promokod.com masks and explicit foreign owners cannot enter the merchant result',()=>{
 for(const html of [promokodPage('ABC***'),promokodPage('FOREIGN20','Ozon')])assert.deepEqual(parseMerchantPage(html,'https://promokod.com/coupon-store/vkusvill-ru',company,now),[]);
});
