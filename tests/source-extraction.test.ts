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
test('official Magnit code is accepted as a standalone atom immediately after its label', () => {
  const html = '<title>Промокоды Магнит</title><div class="t-rec"><div class="tn-atom">Промокод</div><div class="tn-atom">ДОСТАВКА25</div><div class="tn-atom">−25%</div><div class="tn-atom">Скидка на первый заказ от 1000₽</div><div class="tn-atom">в Магнит Экспрессе</div></div>';
  const [code] = parsePublicOfficial(201,html);assert.equal(code.code,'ДОСТАВКА25');assert.equal(code.minOrder,1000);
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
