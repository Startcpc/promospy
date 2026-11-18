import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { normalizePromokodList } from '../src/lib/restaurant-catalogue';
const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');

const url = 'https://promokod.com/coupon-store/vkusvill-ru';
const row = (code: string, cross = '0') => `<div class="coupon-wrap" data-code="${code}" data-cross-promo="${cross}" data-ctype="1" data-action="0">
  <div class="coupon"><div class="coupon-main"><h3 class="coupon-title">Скидка на первый заказ</h3></div>
    <div class="valid"><span class="v-full">Действует до 25 ноября 2026</span></div></div>
  <div class="coupon-detail"><p class="detail-desc">Первый заказ от 1500 рублей в приложении.</p></div></div>`;

function document(markup: string, source = url, heading = 'Промокоды ВкусВилл') {
  return load(`<link rel="canonical" href="${source}"><main><h1>${heading}</h1>${markup}</main>`);
}

test('current Promokod.com shop list retains complete codes, dates and conditions of primary offers', () => {
  const $ = document(`<div id="couponList">${row('SHOP20')}${row('OTHER20','1')}${row('A***')}
    <div class="recommendations">${row('ADVERTISEMENT')}</div></div><section>${row('ARCHIVE')}</section>`);
  normalizePromokodList($, url, 54);
  assert.deepEqual($('.coupon-wrap').map((_, el) => $(el).attr('data-code')).get(), ['SHOP20']);
  assert.equal($('.coupon-wrap').attr('data-store-name'), 'ВкусВилл');
  assert.equal($('.coupon-wrap').attr('data-expires-at'), '25 ноября 2026');
  assert.match($('.coupon-wrap').text(), /от 1500/);
});

test('anonymous shop rows require both the registered canonical URL and matching shop heading', () => {
  const html = `<div id="couponList">${row('SHOP20')}</div>`;
  for (const [source, canonical, heading] of [
    [url, url, 'Промокоды другого магазина'],
    [url, 'https://promokod.com/coupon-store/other', 'ВкусВилл'],
    ['https://promokod.com/coupon-store/other', 'https://promokod.com/coupon-store/other', 'ВкусВилл'],
  ]) {
    const $ = document(html, canonical, heading);
    normalizePromokodList($, source, 54);
    assert.equal($('.coupon-wrap').length, 0);
  }
});
