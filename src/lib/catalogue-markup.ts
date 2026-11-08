import { createRequire } from 'node:module';
import { sourceHost } from './fetch-policy';
import { validCouponToken } from './promo-quality';
const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');

/** Normalize the observed public GetCashback card into the shared card parser.
 * No popup, referral URL or script is fetched to reveal a code.
 */
export function catalogueMarkup(html:string,url:string):string {
  if(sourceHost(url)!=='getcashback.ru')return html;
  const $=load(html);
  // This site puts unrelated offers directly after this heading, using the
  // same card classes and no related/similar wrapper.
  const elements=$('body *').toArray();
  const cutoff=elements.findIndex(element=>$(element).is('h2,h3,h4,.coupon-title')&&/^(?:Похожие|Популярные) купоны/i.test($(element).text().trim()));
  if(cutoff>=0)for(const element of elements.slice(cutoff))$(element).remove();
  $('.coupon--item').slice(0,200).each((_,element)=>{
    const card=$(element),label=card.find('.stock-info > .promo-text'),code=card.find('.promo-info > .promo-num');
    const title=card.find('.stock-info > p.promokode-modal'),deadline=card.find('.stock-info > .remain');
    if(card.closest('.m-banner,aside,nav,footer').length||card.find('.coupon--item').length
      ||label.length!==1||label.text().trim()!=='Промокод'||code.length!==1||title.length!==1
      ||!validCouponToken(code.text().trim())||!title.text().trim())return;
    // The whole .promo-num value is present in the HTTP document. Masked
    // characters, link placeholders and promotional banners are not codes.
    if(/masked|code-mask|code-tail|code-part/i.test(code.attr('class')??''))return;
    card.attr('data-coupon','');code.attr('data-promocode',code.text().trim());
    title.replaceWith($('<h3>').text(title.text()));
    if(deadline.length===1&&deadline.text().trim())card.attr('data-expires-at',deadline.text().replace(/\s+/g,' ').trim());
  });
  return $.html();
}
