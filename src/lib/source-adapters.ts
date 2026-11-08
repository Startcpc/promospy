import type { Company } from './companies';
import { PUBLIC_OFFICIAL_URLS, hasPublicOfficialMarkup, parsePublicOfficial } from './official-search';
import { sourceHost } from './fetch-policy';
import type { PromoCode } from './promocodes';
import { catalogueUrls } from './source-catalog';
export { SEARCH_DOMAINS } from './source-catalog';
export type SourceAdapter={
  id:string;
  officialUrls:(company:Company)=>string[];
  seedUrls:(company:Company)=>string[];
};
export type PromotionParser={
  name:string;hosts:string[];companyId:number;
  recognizes:(html:string)=>boolean;
  parse:(html:string,url:string,now:number)=>PromoCode[];
};
export const promotionParsers:PromotionParser[]=[
  {name:'vkusvill-public-cards',hosts:['vkusvill.ru'],companyId:54,recognizes:html=>hasPublicOfficialMarkup(54,html),parse:(html,url,now)=>parsePublicOfficial(54,html,now).map(code=>({...code,sources:[{url,name:new URL(url).hostname,seenAt:now}],evidence:code.evidence?{...code.evidence,sourceUrl:url}:undefined}))},
  {name:'magnit-public-cards',hosts:['promo.magnit.ru','magnit.ru'],companyId:201,recognizes:html=>hasPublicOfficialMarkup(201,html),parse:(html,url,now)=>parsePublicOfficial(201,html,now).map(code=>({...code,sources:[{url,name:new URL(url).hostname,seenAt:now}],evidence:code.evidence?{...code.evidence,sourceUrl:url}:undefined}))},
];
export function sourceParser(company:Company,url:string,html:string){
  return promotionParsers.find(parser=>parser.companyId===company.id&&parser.hosts.includes(sourceHost(url))&&parser.recognizes(html));
}
/** Add a merchant or an observed source URL here; never add coupon values. */
export const publicSources:SourceAdapter={
  id:'public-promotions',
  officialUrls(company){
    const primary=PUBLIC_OFFICIAL_URLS[company.id]??({5:'https://burgerkingrus.ru/coupons/',302:'https://www.kartoshka.com/actions/'} as Record<number,string>)[company.id];
    return [...new Set([primary,company.website].filter((url):url is string=>!!url))];
  },
  seedUrls(company){
    return catalogueUrls(company.id);
  },
};
export function officialDomains(company:Company){
  return [...new Set(publicSources.officialUrls(company).map(sourceHost))];
}
