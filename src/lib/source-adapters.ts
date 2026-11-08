import type { Company } from './companies';
import { PUBLIC_OFFICIAL_URLS, hasPublicOfficialMarkup, parsePublicOfficial } from './official-search';
import { sourceHost } from './fetch-policy';
import type { PromoCode } from './promocodes';
export const SEARCH_DOMAINS = ['promokod.pikabu.ru','promokodi.ru','promokodus.com','promkod.ru','promokod.vbr.ru','berikod.ru','promokod.ru','pepper.ru','skidkidor.ru','kupon.ru','biglion.ru','gilmon.ru','kuponator.ru','kuponation.ru','picodi.com','megabonus.com','backit.me','letyshops.com','kp.ru','aif.ru','banki.ru','sravni.ru','t-j.ru','dtf.ru','vc.ru','ixbt.com','otzovik.com','getcashback.ru','zen.yandex.ru'];
// Slugs verified against live site catalogues (2026-11): pikabu uses its own
// naming (e.g. /shops/magnit is 404, the delivery page is magnit-info),
// promokodi.ru redirects some generic slugs to unrelated stores (/store/ozon
// goes to Ozon Bank, /store/5ka to "5 карманов"), promokodus.com keeps the
// plain merchant names. One shared map pointed several seeds at 404 pages.
const pikabuSlugs:Record<number,string>={5:'burgerkingrus',54:'vkusvill',102:'vkusnoitochka',201:'magnit-info',202:'5ka',203:'lavka-yandex',204:'market-yandex',205:'perekrestok',206:'lenta',207:'wildberries',208:'ozon',301:'tanuki',302:'kroshka-kartoshka'};
const promokodiSlugs:Record<number,string>={5:'burger-king',54:'vkusvill',102:'vkusno-i-tochka',201:'magnit-dostavka',202:'pyatyorochka',203:'yandex-lavka',204:'yandeks-market',205:'perekrestok',206:'lenta',207:'promokod-wildberries',208:'ozon-ru',301:'tanuki',302:'kroshka-kartoshka'};
const promokodusSlugs:Record<number,string>={5:'burger-king',102:'vkusno-i-tochka',202:'pyaterochka',203:'yandex-lavka',204:'yandex-market',205:'perekrestok',206:'lenta',207:'wildberries',208:'ozon',301:'tanuki',302:'kroshka-kartoshka'};
const cashbackSlugs:Record<number,string>={54:'vkusvill',201:'magnit'};
const additionalSources:Record<number,string[]>={5:[
  'https://getcashback.ru/promocodes/burgerking/',
  'https://promokod.vbr.ru/shops/burger-king/',
]};
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
    const pikabu=pikabuSlugs[company.id],promokodi=promokodiSlugs[company.id];
    if(!pikabu&&!promokodi)return [];
    const seeds:string[]=[];
    if(pikabu)seeds.push('https://promokod.pikabu.ru/shops/'+pikabu);
    if(promokodi)seeds.push('https://promokodi.ru/store/'+promokodi+'/');
    const cashback=cashbackSlugs[company.id],promokodus=promokodusSlugs[company.id];
    if(cashback)seeds.push('https://getcashback.ru/promocodes/'+cashback+'/');
    else if(promokodus)seeds.push('https://promokodus.com/campaigns/'+promokodus);
    return [...new Set([...seeds,...additionalSources[company.id]??[]])];
  },
};
export function officialDomains(company:Company){
  return [...new Set(publicSources.officialUrls(company).map(sourceHost))];
}
