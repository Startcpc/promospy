import { createRequire } from 'node:module';
import type { Company } from './companies';
import { merchantAliases as names } from './merchant-aliases';
import { foreignMerchantHeading, explicitCode } from './promo-quality';
import { codeKey, type PromoCode } from './promocodes';
import { parsePromoCodesFromHtml, parsePromoDate, mergePromoCodes, type ParseDiagnostics } from './promo-parser';
const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');
const normalize = (value: string) => value.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
export function matchesMerchant(title: string, company: Company) {
  const value = normalize(title);
  return [company.name,...names[company.id] ?? []].some(name => value.includes(normalize(name)));
}
export function isChallengePage(html: string) {
  const $ = load(html);
  $('script,style,noscript,iframe').remove();
  const heading = $('title,h1').text();
  const body = $('body').text().replace(/\s+/g,' ').trim();
  // A CAPTCHA widget on a real shop page is not a blocked document.
  if (/^(?:\s*)(?:just a moment|access denied|проверка безопасности|проверка браузера|доступ ограничен)/i.test(heading)) return true;
  if (/промокод|купон|coupon/i.test(heading) && $('article,.coupon,[data-coupon],.js-vv21-promocode-item,.t-rec').length) return false;
  return body.length < 1800 && /(?:подтвердите|проверьте|confirm|verify).{0,60}(?:не бот|не робот|not a robot|human)|checking your browser|enable javascript and cookies to continue/i.test(body);
}
export function explicitEmpty(html: string) {
  const $ = load(html); $('script,style,noscript,template,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"]').remove();
  return /(?:активных|действующих|доступных)\s+(?:промокодов|купонов)\s+(?:пока\s+)?нет|промокоды\s+не\s+найдены/i.test($('main').length ? $('main').text() : $('body').text());
}
export function merchantContent(html: string) {
  const $ = load(html);
  $('[class*="related"],[class*="similar"],aside,nav,footer,template').remove();
  const elements = $('body *').toArray();
  const cutoff = elements.findIndex(el => $(el).is('h2,h3,h4') && /^(?:похожие\s+(?:промокоды|купоны|магазины)|другие магазины|рекомендуемые магазины)/i.test($(el).text().trim()));
  if (cutoff >= 0) for (const el of elements.slice(cutoff)) $(el).remove();
  return $.html();
}
const CODE = /^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u;
const CARD = 'article,[data-coupon],[data-offer],.coupon,.promocode,.offer,[class*="coupon-item"],[class*="coupon_item"],[class*="offer-item"],[class*="promo-item"]';
const EXPLICIT = '[data-promocode],[data-promo-code],[data-coupon-code],[data-clipboard-text],[data-code],input[readonly][value]';
const CANDIDATE = '[data-promocode],[data-promo-code],[data-coupon-code],[data-clipboard-text],[data-code],code,input[readonly],input[name*="code"],[class*="code"],[class*="Code"]';
/** Read explicit copy/code elements inside one coupon. Never mine arbitrary words. */
export function extractCouponCards(html: string, url: string, company: Company, now = Date.now(), official = false, diagnostics?:ParseDiagnostics): PromoCode[] {
  const $ = load(merchantContent(html));
  const title = $('h1').first().text() || $('title').text();
  if (!official && !matchesMerchant(title,company)) return [];
  $('[class*="related"],[class*="similar"],aside,nav,footer').remove();
  const elements = $('body *').toArray();
  const positions = new Map(elements.map((el,index) => [el,index]));
  const related = $('h2,h3,h4').toArray().find(el => /^(?:похожие\s+(?:промокоды|купоны|магазины)|другие магазины|рекомендуемые магазины)/i.test($(el).text().trim()));
  const ended = $('h2,h3,h4').toArray().find(el => /купоны уже закончились|ист[её]кшие|заверш[её]нные акции|промокоды с ист[её]кшим|expired\s+(?:coupons|codes|offers)|ended\s+(?:promotions|offers)/i.test($(el).text()));
  const result: PromoCode[] = [];
  $(CARD).each((_,el) => {
    const card = $(el);
    if (card.find(CARD).length) return;
    if (card.is(EXPLICIT) || card.find(EXPLICIT).length) return;
    const copy = card.clone(); copy.find('p,div,br,h2,h3,h4').prepend(' ').append(' ');
    const code = explicitCode(copy.text());
    if (code && !/^(?:например|ваш|любой|название)$/i.test(code)) card.attr('data-promospy-code',code);
  });
  $(`${CANDIDATE},[data-promospy-code]`).each((_,el) => {
    if (result.length >= 100 || related && (positions.get(el) ?? 0) > (positions.get(related) ?? Infinity)) return;
    const item = $(el);
    if(item.is('input[type="hidden"]')&&!item.is('[data-promocode],[data-promo-code],[data-coupon-code]'))return;
    // Containers that include both title, code and terms are not themselves codes.
    const raw = codeKey(item.attr('data-promospy-code') ?? item.attr('data-promocode') ?? item.attr('data-promo-code') ?? item.attr('data-coupon-code') ?? item.attr('data-clipboard-text') ?? item.attr('data-code') ?? item.attr('value') ?? item.text().trim());
    if (!CODE.test(raw) || /^(?:coupon|promocode|промокод|скопировать|copy|code)$/i.test(raw)) return;
    let card = item.closest(CARD);
    if (!card.length) {
      // Some sites use unnamed wrappers. Ascend only to the nearest short block
      // with exactly one heading and a coupon/copy label, not the whole page.
      for (const parent of item.parents().toArray().slice(0,5)) {
        const node = $(parent);
        if (node.is('body,main,html')) break;
        if (node.find('h2,h3,h4').length === 1 && /промокод|купон|coupon|скопировать/i.test(node.text()) && node.text().length < 4000) { card = node; break; }
      }
    }
    if (!card.length || card.find('h2,h3,h4').length > 1 || card.text().length > 6000) return;
    if(card.is('[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"]'))return;
    const explicit = item.is(EXPLICIT);
    if (!explicit && (card.is(EXPLICIT) || card.find(EXPLICIT).length)) return;
    // Coupon sites often display only a suffix before "show code" is clicked.
    // A three-character tail is not a full code just because it is alphanumeric.
    if (!explicit && (/masked|code-mask|code-tail|code-part/i.test(item.attr('class') ?? '') || /(?:открыть|показать)\s+промокод/i.test(card.text()))) return;
    const heading = card.find('h2,h3,h4,[data-title],.coupon-title').first().text().replace(/\s+/g,' ').trim() || `Промокод ${company.name}`;
    if (!heading || foreignMerchantHeading(heading,company.id) || !/промокод|купон|coupon|код\s+скидки|используйте\s+код|скидк|заказ|покупк|доставк/i.test(card.text())) return;
    const namedCode=item.is('[data-promocode],[data-promo-code],[data-coupon-code]');
    if(!namedCode&&!/промокод|код\s+(?:купона|скидки)|(?:promo|coupon)\s*code|(?:используйте|введите|примените)\s+код|use\s+code/i.test(card.text()))return;
    if(/^[78]\d{10}$/.test(raw))return;
    const clean = card.clone(); clean.find('script,style,button,input').remove(); clean.find('p,div,li,h2,h3,h4,br').prepend(' ').append(' ');
    const terms = clean.text().replace(/\s+/g,' ').trim();
    const badge=card.find('.status,.coupon-status,[data-status]').text().trim();
    const explicitlyEnded=card.is('.expired,.coupon-expired,[data-expired="true"]')||/^(?:expired|ended|ист[её]к|заверш[её]н)$/i.test(badge)||/срок\s+(?:действия\s+)?ист[её]к|акция\s+завершена|(?:offer|coupon|promotion)\s+(?:has\s+)?expired/i.test(terms);
    const attributeDate = item.attr('data-expires-at') ?? card.attr('data-expires-at') ?? card.find('time[datetime]').attr('datetime');
    const writtenDate = terms.match(/(?:до|по|действует до)\s+(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\s+[а-яё]+\s+\d{4})/i)?.[1];
    const expiresAt = parsePromoDate(attributeDate ?? writtenDate,true);
    const attributeStart = item.attr('data-starts-at') ?? card.attr('data-starts-at');
    const startsAt = parsePromoDate(attributeStart);
    if ((attributeDate !== undefined||writtenDate!==undefined) && expiresAt === undefined || attributeStart !== undefined && startsAt === undefined
      || startsAt !== undefined && expiresAt !== undefined && startsAt > expiresAt) {
      if(diagnostics){diagnostics.incomplete=true;diagnostics.rejectedCodes??=[];if(diagnostics.rejectedCodes.length<100)diagnostics.rejectedCodes.push(raw);if(diagnostics.reasons.length<5)diagnostics.reasons.push('Не распознаны даты одной из карточек');}
      return;
    }
    const amount = heading.match(/(?:скидк[а-яё]*|выгод[а-яё]*)\s*[−–-]?\s*(\d[\d\s]*)\s*(?:₽|руб)/i)?.[1]?.replace(/\s/g,'');
    const offers = parsePromoCodesFromHtml(JSON.stringify([{promoCode:raw,title:heading,conditions:[terms.slice(0,1500)],startsAt,expiresAt,discountAmount:amount}]),url,company.id,now,{diagnostics});
    for (const offer of offers) {
      if (explicitlyEnded || ended && (positions.get(el) ?? 0) > (positions.get(ended) ?? Infinity)) { offer.status = 'expired'; offer.invalidSince = now; }
      result.push({...offer,extraction:{method:"card",text:terms.slice(0,3000)}});
    }
  });
  return mergePromoCodes(result);
}
