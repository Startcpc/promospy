import type { Company } from './companies';
import type { PromoCode } from './promocodes';
import { load } from './html-document';
import { parsePromoCodesFromHtml, mergePromoCodes, type ParseDiagnostics } from './promo-parser';
import { extractOfficialDates } from './promo-terms';
import { extractCouponCards, extractCouponTables, matchesMerchant, merchantContent } from './source-extraction';
import { foreignMerchantHeading } from './promo-quality';
import { parsePublicFeed } from './public-feeds';
import { sourceHost } from './source-host';
import { catalogueMarkup } from './catalogue-markup';

export function parseMerchantPage(html: string, url: string, company: Company, now = Date.now(), official = false, diagnostics:ParseDiagnostics={incomplete:false,reasons:[]}): PromoCode[] {
  if(/^\s*[\[{]/.test(html)){try{const feed=JSON.parse(html);if(typeof feed.version==='string'&&feed.version.startsWith('https://jsonfeed.org/'))return parsePublicFeed(html,url,company,now,diagnostics);}catch{}return parsePromoCodesFromHtml(html,url,company.id,now,{requireMerchant:!official,diagnostics});}
  if(/<(?:rss|feed)(?:\s|>)/i.test(html))return parsePublicFeed(html,url,company,now,diagnostics);
  const scoped = catalogueMarkup(merchantContent(html),url,company.id), $ = load(scoped);
  if($('title,h1').toArray().some(element=>foreignMerchantHeading($(element).text(),company.id)))return [];
  const ownHost = sourceHost(url) === sourceHost(company.website);
  if (!official && !ownHost && !matchesMerchant($('h1').first().text() || $('title').text(),company)) return [];
  const structuredDiagnostics:ParseDiagnostics={incomplete:false,reasons:[]},cardDiagnostics:ParseDiagnostics={incomplete:false,reasons:[]};
  const structured = parsePromoCodesFromHtml(scoped,url,company.id,now,{diagnostics:structuredDiagnostics});
  const cards = [...extractCouponCards(scoped,url,company,now,official || ownHost,cardDiagnostics),...extractCouponTables(scoped,url,company,now,official || ownHost,cardDiagnostics)].map(card => {
    const metadata = structured.find(item => item.code === card.code && item.description === card.description);
    if (!metadata) return card;
    const expiresAt = card.expiresAt ?? metadata.expiresAt;
    return {...card,expiresAt,startsAt:card.startsAt ?? metadata.startsAt,minOrder:card.minOrder ?? metadata.minOrder,
      status:card.status === 'expired' || expiresAt !== undefined && expiresAt <= now ? 'expired' as const : card.status};
  });
  // The actual coupon card determines whether the campaign is archived. A JSON
  // copy may be stale, while a reused code can belong to a new visible campaign.
  diagnostics.incomplete=cardDiagnostics.incomplete||structuredDiagnostics.incomplete&&(!structuredDiagnostics.rejectedCodes?.length||structuredDiagnostics.rejectedCodes.some(code=>!cards.some(card=>card.code===code)));
  diagnostics.reasons=[...cardDiagnostics.reasons,...structuredDiagnostics.reasons].slice(0,5);
  const result = mergePromoCodes([...cards,...structured.filter(code=>!cards.some(card=>card.code===code.code)&&!cardDiagnostics.rejectedCodes?.includes(code.code))]);
  return result.map(code => {
    const dates = official ? extractOfficialDates([code.description,...code.conditions].join(' ')) : {};
    const startsAt = code.startsAt ?? dates.startsAt, expiresAt = code.expiresAt ?? dates.expiresAt;
    return {...code,startsAt,expiresAt,status:code.status === 'expired' || expiresAt !== undefined && expiresAt <= now ? 'expired' : 'found',checked:undefined,evidence:undefined,validUntil:undefined,verificationDetails:'Найдено в открытом источнике. Применение не проверялось.'};
  });
}
