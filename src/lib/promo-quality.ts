import type { PromoCode } from './promocodes';
import { companies } from './companies';
import { merchantAliases, isSeparateMerchantService } from './merchant-aliases';
const compact=(text:string)=>text.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
export function explicitCode(text:string){
  return text.match(/(?:(?:промокод|код купона|код скидки|promo\s*code|coupon\s*code)\s*[:：]|(?:используйте|введите|примените|use|enter)\s+(?:промокод|код|code)\s*[:：]?)\s*["'«]?([\p{L}\p{N}][\p{L}\p{N}_-]{1,63})(?![\p{L}\p{N}_-])/iu)?.[1];
}
export function validCouponToken(value:string){
  return /^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(value)&&!/^[78]\d{10}$/.test(value)&&!/^(?:coupon|promocode|промокод|скопировать|copy|code|например|название|ваш|любой)$/i.test(value);
}
export function foreignMerchantHeading(heading:string,companyId:number){
  if(isSeparateMerchantService(heading,companyId))return true;
  const current=companies.find(company=>company.id===companyId);
  const normalized=compact(heading);
  if(current&&[current.name,...merchantAliases[companyId]??[]].some(name=>normalized.includes(compact(name))))return false;
  return companies.some(company=>company.id!==companyId&&[company.name,...merchantAliases[company.id]??[]].some(name=>normalized.includes(compact(name))));
}
export function promoAudience(code:Pick<PromoCode,'description'|'conditions'>){
  const text=[code.description,...code.conditions].join(' ');
  const first=/перв(?:ый|ого|ом|ую)\s+(?:заказ|покупк)|new customers?|first\s+(?:order|purchase)/i.test(text);
  const repeat=/повторн[а-яё]*\s+(?:заказ|покупк)|repeat\s+(?:order|purchase)|existing customers/i.test(text);
  return first&&!repeat?'new':repeat&&!first?'existing':undefined;
}
export const restrictionList=(values:string[]|undefined)=>[...new Set((values??[]).map(value=>value.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim()).filter(Boolean))].sort();
export function offerConflict(a:PromoCode,b:PromoCode){
  for(const key of ['minOrder','startsAt','expiresAt','maxDiscount','channel'] as const)if(a[key]!==undefined&&b[key]!==undefined&&a[key]!==b[key])return true;
  if(a.appOnly!==undefined&&b.appOnly!==undefined&&a.appOnly!==b.appOnly)return true;
  for(const key of ['regions','categories'] as const)if(a[key]?.length&&b[key]?.length&&JSON.stringify(restrictionList(a[key]))!==JSON.stringify(restrictionList(b[key])))return true;
  const discount=(value:string)=>value.replace(/[−–-\s]/g,'').replace(/руб(?:лей|ля)?\.?/gi,'₽').replace(',','.');
  if(a.discount!=='По условиям акции'&&b.discount!=='По условиям акции'&&/\d/.test(a.discount)&&/\d/.test(b.discount)&&discount(a.discount)!==discount(b.discount))return true;
  const audienceA=promoAudience(a),audienceB=promoAudience(b);
  return !!(audienceA&&audienceB&&audienceA!==audienceB);
}
export function discoveryConfidence(code:PromoCode,now=Date.now()){
  const hosts=new Set(code.sources.map(source=>{try{return new URL(source.url).hostname.replace(/^www\./,'');}catch{return '';}}).filter(Boolean));
  const reasons:string[]=[];
  let score=code.status==='official'?85:code.extraction?.method==='structured'?65:55;
  if(code.status==='official')reasons.push('Официальная публикация');else reasons.push('Явное значение промокода в источнике');
  if(hosts.size>1){score+=Math.min(10,(hosts.size-1)*5);reasons.push('Код встречается в независимых источниках');}
  if(code.conditions.length){score+=3;reasons.push('Условия указаны');}
  if(code.expiresAt!==undefined)score+=2;
  const observed=Math.max(0,...code.sources.map(source=>source.seenAt));
  if(observed&&now-observed<3600000)score+=3;
  if(code.status==='expired'||code.expiresAt!==undefined&&code.expiresAt<=now)score=Math.min(score,20);
  return {score:Math.min(98,score),level:score>=80?'high' as const:score>=60?'medium' as const:'low' as const,reasons};
}
