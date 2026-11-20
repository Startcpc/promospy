import { ALLO_ID, EDO_ID, FOX_ID, METRO_ID, type Company } from './companies';
import { PUBLIC_OFFICIAL_URLS, alloPromotionUrls, hasPublicOfficialMarkup, isAlloPromotionDetail, parsePublicOfficial } from './official-search';
import { sourceHost } from './fetch-policy';
import type { PromoCode } from './promocodes';
import { catalogueUrls } from './source-catalog';
import { sourceIdentity } from './promo-validation';
export { SEARCH_DOMAINS } from './source-catalog';
export type SourceAdapter={
  id:string;
  officialUrls:(company:Company)=>string[];
  seedUrls:(company:Company)=>string[];
};
type OfficialPageParser = {
  emptyWhenNoCodes?: boolean;
  parse: (html: string, url: string, now: number) => PromoCode[];
};
export type PromotionParser = OfficialPageParser & {
  name:string;hosts:string[];companyId:number;
  recognizes:(html:string)=>boolean;
};
export const promotionParsers:PromotionParser[]=[
  {name:'vkusvill-public-cards',hosts:['vkusvill.ru'],companyId:54,recognizes:html=>hasPublicOfficialMarkup(54,html),parse:(html,url,now)=>parsePublicOfficial(54,html,now).map(code=>({...code,sources:[{url,name:new URL(url).hostname,seenAt:now}],evidence:code.evidence?{...code.evidence,sourceUrl:url}:undefined}))},
  {name:'magnit-public-cards',hosts:['promo.magnit.ru'],companyId:201,recognizes:html=>hasPublicOfficialMarkup(201,html),parse:(html,url,now)=>parsePublicOfficial(201,html,now).map(code=>({...code,sources:[{url,name:new URL(url).hostname,seenAt:now}],evidence:code.evidence?{...code.evidence,sourceUrl:url}:undefined}))},
];
const fixedOfficialCompanies = new Set([METRO_ID, EDO_ID, FOX_ID, ALLO_ID]);
export function hasFixedOfficialSource(companyId: number) {
  return fixedOfficialCompanies.has(companyId);
}

export function officialDetailUrls(company: Company, html: string) {
  return company.id === ALLO_ID ? alloPromotionUrls(html) : [];
}

export function sourceParser(company:Company,url:string,html:string): OfficialPageParser | undefined {
  if (hasFixedOfficialSource(company.id)) {
    const isDetail = company.id === ALLO_ID && isAlloPromotionDetail(url);
    return {
      emptyWhenNoCodes: company.id === FOX_ID || isDetail,
      parse: (body: string, finalUrl: string, now: number) => {
        const expectedUrl = isDetail ? url : PUBLIC_OFFICIAL_URLS[company.id];
        if (sourceIdentity(finalUrl) !== sourceIdentity(expectedUrl)) {
          throw new Error('Изменился адрес официальной страницы промокодов');
        }
        return parsePublicOfficial(company.id, body, now, finalUrl);
      },
    };
  }
  return promotionParsers.find(parser=>parser.companyId===company.id&&parser.hosts.includes(sourceHost(url))&&parser.recognizes(html));
}
/** Only observed public merchant URLs; never add coupon values. */
export const publicSources:SourceAdapter={
  id:'public-promotions',
  officialUrls(company){
    const primary=PUBLIC_OFFICIAL_URLS[company.id];
    if (hasFixedOfficialSource(company.id)) return [primary];
    return [...new Set([primary,company.website].filter((url):url is string=>!!url))];
  },
  seedUrls(company){
    return catalogueUrls(company.id);
  },
};
export function officialDomains(company:Company){
  return [...new Set(publicSources.officialUrls(company).map(sourceHost))];
}
