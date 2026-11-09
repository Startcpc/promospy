import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCompanyById } from '../src/lib/promocodes';
import { isChallengePage, explicitEmpty, extractCouponCards, matchesMerchant } from '../src/lib/source-extraction';
import { parseMerchantPage, searchMerchant } from '../src/lib/web-search';
import { parsePublicOfficial } from '../src/lib/official-search';
const company = getCompanyById(54)!;
const url = 'https://promokodi.ru/store/vkusvill/';
const page = (content: string) => `<title>Промокоды ВкусВилл</title><h1>Промокоды ВкусВилл</h1>${content}`;
const offer = (content: string) => `<article><h3>Скидка 200 рублей на первый заказ</h3><p>Промокод</p>${content}<p>Заказ от 1000 рублей</p></article>`;

test('ordinary captcha script on a coupon page is not a blocked response', () => {
  assert.equal(isChallengePage(page('<script src="https://captcha.example/script.js"></script>'+offer('<code>1раз</code>'))),false);
});
test('visible security challenge is distinguished from a coupon document', () => {
  assert.equal(isChallengePage('<title>Проверка безопасности</title><h1>Пожалуйста, подтвердите, что вы не бот</h1>'),true);
});
test('direct copy attribute produces a source-backed code with its own conditions', () => {
  const [code] = extractCouponCards(page(offer('<button data-clipboard-text="1раз">Скопировать</button>')),url,company);
  assert.equal(code.code,'1раз');assert.equal(code.minOrder,1000);assert.equal(code.sources[0].url,url);
});
test('coupon code class and readonly input are read without uppercase guessing', () => {
  for(const content of ['<span class="coupon-code">1раз</span>','<input readonly value="1раз">']) {
    assert.equal(extractCouponCards(page(offer(content)),url,company)[0].code,'1раз');
  }
});
test('separate coupon cards never exchange conditions', () => {
  const html = page(offer('<code>1раз</code>')+'<article><h3>Другой заказ</h3><p>Промокод</p><code>SECOND99</code><p>Заказ от 5000 рублей</p></article>');
  const codes = extractCouponCards(html,url,company);
  assert.equal(codes[0].minOrder,1000);assert.equal(codes[1].minOrder,5000);assert.doesNotMatch(codes[0].conditions.join(' '),/5000/);
});
test('masked codes are not promoted to real coupons', () => {
  assert.deepEqual(extractCouponCards(page(offer('<code>ABC***</code>')),url,company),[]);
});
test('related merchants and trailing recommendation sections are excluded', () => {
  const html = page(offer('<code>1раз</code>')+'<h2>Похожие промокоды</h2><article><h3>Ozon</h3><p>Промокод: FOREIGN99</p><code>FOREIGN99</code></article>');
  assert.deepEqual(parseMerchantPage(html,url,company).map(code=>code.code),['1раз']);
});
test('expired section is marked even when an individual card has no date', () => {
  const html = page('<h3>Купоны уже закончились, но возможно ещё действуют</h3>'+offer('<code>OLD99</code>'));
  assert.equal(extractCouponCards(html,url,company)[0].status,'expired');
});
test('explicit expiry date retains the source day rather than a generated deadline', () => {
  const [code] = extractCouponCards(page(offer('<code>1раз</code><p>До 30.11.2026</p>')),url,company);
  assert.equal(new Date(code.expiresAt!).toISOString(),'2026-11-30T20:59:59.999Z');
});
test('generic taste/sushi keywords cannot identify an unrelated merchant', () => {
  assert.equal(matchesMerchant('Вкусные суши — промокоды',company),false);
});
test('unknown markup is not reported as explicit absence of coupons', () => {
  assert.equal(explicitEmpty(page('<div>Добро пожаловать</div>')),false);
  assert.equal(explicitEmpty(page('<p>Активных промокодов пока нет</p>')),true);
});
test('official VkusVill copy-button caption can change without losing the published code', () => {
  const html = readFileSync(new URL('./fixtures/vkusvill-official.html',import.meta.url),'utf8');
  const changed = html.replace(/(class="[^"]*js-vv21-promocode-item__btn[^\"]*"[^>]*>)[^<]*/,'$1Скопировать');
  assert.ok(parsePublicOfficial(54,changed).some(code=>code.code==='1раз'));
});
test('pipeline retains official coupons when captcha is only a header script',async()=>{
  const html = readFileSync(new URL('./fixtures/vkusvill-official.html',import.meta.url),'utf8');
  const report = await searchMerchant(company,new AbortController().signal,async target=>target==='https://vkusvill.ru/promocodes/'?'<script src="/captcha.js"></script>'+html:'<title>Empty</title>');
  assert.ok(report.codes.some(code=>code.code==='1раз'&&code.status==='official'));
  assert.ok(report.parsedUrls?.includes('https://vkusvill.ru/promocodes/'));
});
test('HTML landing pages without a parsed coupon list remain unrecognized',async()=>{
  const report = await searchMerchant(company,new AbortController().signal,async()=>page('<div>Динамический контент</div>'));
  assert.equal(report.codes.length,0);assert.equal(report.parsedUrls?.length,0);
  assert.ok(report.sourceResults?.some(source=>source.outcome==='unrecognized'));
});
test('captcha in a feedback form does not hide an otherwise readable coupon card',()=>{
 const html = page(offer('<code>1раз</code>')+'<form>Пожалуйста, подтвердите, что вы не робот</form>');
 assert.equal(isChallengePage(html),false);
 assert.equal(extractCouponCards(html,url,company)[0].code,'1раз');
});
test('a visible short suffix beside Show code is never treated as a full coupon',()=>{
 const html=page(offer('<button>Открыть промокод</button><span class="coupon-code">TD4</span>'));
 assert.deepEqual(extractCouponCards(html,url,company),[]);
});
test('full copy value wins over the masked visible suffix in the same card',()=>{
 const button=page(offer('<button data-clipboard-text="FULLCODE99">Открыть промокод</button><span class="coupon-code code-tail">E99</span>'));
 const container=page(offer('<p>Промокод: E99</p><span class="coupon-code">E99</span>').replace('<article>','<article data-code="FULLCODE99">'));
 for(const html of [button,container]) assert.deepEqual(extractCouponCards(html,url,company).map(code=>code.code),['FULLCODE99']);
});
test('hidden UI templates are not evidence that the live coupon list is empty',()=>{
 assert.equal(explicitEmpty(page('<template>Активных промокодов нет</template><div hidden>Промокоды не найдены</div>')) ,false);
});
test('ISO end-of-day is accepted only for exact midnight',async()=>{
 const {parsePromoDate}=await import('../src/lib/promo-parser');
 assert.equal(parsePromoDate('2026-11-30T24:00:00Z'),Date.parse('2026-12-01T00:00:00Z'));
 assert.equal(parsePromoDate('2026-11-30T24:01:00Z'),undefined);
 assert.equal(parsePromoDate('2026-11-30T24:00:00.001Z'),undefined);
 assert.ok(parsePromoDate('2026-11-30T23:59:59Z'));
});
test('cycle 2: archived card is not reactivated by its undated JSON copy',()=>{
 const metadata='<script type="application/json">'+JSON.stringify([{promoCode:'ENDED99',title:'Скидка 200 рублей на первый заказ'}])+'</script>';
 const html=page(metadata+'<h2>Купоны уже закончились</h2>'+offer('<code>ENDED99</code>'));
 const codes=parseMerchantPage(html,url,company);assert.equal(codes.length,1);assert.equal(codes[0].status,'expired');
});
test('cycle 2: current card takes precedence over an old JSON campaign using the same code',()=>{
 const metadata='<script type="application/json">'+JSON.stringify([{promoCode:'REUSED99',title:'Прошлая акция',expiresAt:'2020-01-01'}])+'</script>';
 const codes=parseMerchantPage(page(metadata+offer('<code>REUSED99</code>')),url,company);
 assert.equal(codes.length,1);assert.equal(codes[0].status,'found');assert.match(codes[0].description,/первый заказ/);
});
test('cycle 2: matching structured expiry remains attached to the same visible offer',()=>{
 const metadata='<script type="application/json">'+JSON.stringify([{promoCode:'DATED99',title:'Скидка 200 рублей на первый заказ',expiresAt:'2020-01-01'}])+'</script>';
 const [code]=parseMerchantPage(page(metadata+offer('<code>DATED99</code>')),url,company);
 assert.equal(code.status,'expired');assert.ok(code.expiresAt);
});


test('invalid official conditions cannot fall back to an undated generic card',async()=>{
 const broken=page('<article data-promocode="BROKEN99"><h3>Скидка на заказ</h3><p>Промокод: BROKEN99</p><p>Действует до 31.02.2026</p></article>');
 const report=await searchMerchant(company,new AbortController().signal,async target=>target==='https://vkusvill.ru/promocodes/'?broken:'<title>Empty</title>');
 assert.equal(report.codes.length,0);assert.ok(report.sourceResults?.some(source=>source.official&&source.outcome==='error'));
});
test('a rejected known official card cannot be rescued by stale JSON metadata',async()=>{
 const fixture=readFileSync(new URL('./fixtures/vkusvill-official.html',import.meta.url),'utf8');
 const broken=fixture.replace('на&nbsp;первый заказ','до 31.02.2026 на&nbsp;первый заказ')+'<script type="application/json">'+JSON.stringify([{promoCode:'1раз',title:'Previous campaign'}])+'</script>';
 const report=await searchMerchant(company,new AbortController().signal,async target=>target==='https://vkusvill.ru/promocodes/'?broken:'<title>Empty</title>');
 assert.equal(report.codes.length,0);assert.ok(report.sourceResults?.some(source=>source.official&&source.outcome==='error'));
});
test('generic official cards keep both ends of an explicit campaign period',()=>{
 const now=Date.parse('2026-11-07T00:00:00Z');
 const [code]=parseMerchantPage(page(offer('<code>FUTURE99</code><p>С 20.11.2026 по 30.11.2026</p>')),'https://vkusvill.ru/actions/new/',company,now,true);
 assert.equal(code.startsAt,Date.parse('2026-11-20T00:00:00+03:00'));assert.equal(code.expiresAt,Date.parse('2026-11-30T23:59:59.999+03:00'));
});


test('invalid explicit dates in official metadata cannot become unlimited offers',async()=>{
 for(const fields of [{expiresAt:'2026-02-31'},{startsAt:'not-a-date'},{startsAt:'2026-11-30',expiresAt:'2026-11-01'}]) {
  const html=page('<script type="application/json">'+JSON.stringify([{promoCode:'BADJSON99',title:'Скидка на заказ',...fields}])+'</script>');
  const report=await searchMerchant(company,new AbortController().signal,async target=>target==='https://vkusvill.ru/promocodes/'?html:'<title>Empty</title>');
  assert.equal(report.codes.length,0);
 }
});

test('previously available VkusVill coupons stay archived even with a future date',()=>{
 const html='<h1>Промокоды ВкусВилл</h1><h2>Купоны на скидку в ВкусВилл доступные ранее:</h2><article data-expires-at="2030-12-31"><h3>Скидка на заказ</h3><p>Промокод: ARCHIVEDVV</p></article>';
 const [code]=parseMerchantPage(html,'https://getcashback.ru/promocodes/vkusvill/',getCompanyById(54)!);
 assert.equal(code.status,'expired');
});
