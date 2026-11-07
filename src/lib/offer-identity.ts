import { createHash } from 'node:crypto';
import { codeKey, type PromoCode } from './promocodes';
import { offerConflict, promoAudience, discoveryConfidence, restrictionList } from './promo-quality';
import { sourceIdentity } from './promo-validation';
function identity(code:PromoCode){
  return JSON.stringify([code.discount,code.minOrder??null,code.startsAt??null,code.expiresAt??null,code.maxDiscount??null,code.channel??null,promoAudience(code)??null,code.appOnly??null,restrictionList(code.regions),restrictionList(code.categories)]);
}
/** Keep contradictory campaigns separate; a shared string is not shared conditions. */
export function mergeOffers(codes:PromoCode[]):PromoCode[]{
  const groups=new Map<string,PromoCode[]>();
  for(const item of codes){
    const base=String(item.companyId)+':'+codeKey(item.code),group=groups.get(base)??[];
    const index=group.findIndex(code=>!offerConflict(code,item)),existing=group[index];
    if(existing){
      const lastSeen=(code:PromoCode)=>Math.max(0,...code.sources.map(source=>source.seenAt));
      const preferNew=item.status==='official'&&existing.status!=='official'||item.status!=='official'&&existing.status!=='official'&&lastSeen(item)>lastSeen(existing);
      const preferred=preferNew?{...item,sources:[...item.sources]}:existing;
      const other=preferred===existing?item:existing;
      for(const key of ['minOrder','startsAt','expiresAt','maxDiscount'] as const)if(preferred[key]===undefined&&other[key]!==undefined)preferred[key]=other[key];
      if(preferred.channel===undefined)preferred.channel=other.channel;
      if(preferred.appOnly===undefined)preferred.appOnly=other.appOnly;
      if(!preferred.regions?.length&&other.regions?.length)preferred.regions=[...other.regions];
      if(!preferred.categories?.length&&other.categories?.length)preferred.categories=[...other.categories];
      preferred.conditions=[...new Set([...preferred.conditions,...other.conditions])].slice(0,40);
      preferred.found=Math.min(preferred.found,other.found);
      const sources=new Map(preferred.sources.map(source=>[sourceIdentity(source.url),source]));
      for(const source of other.sources){const key=sourceIdentity(source.url),old=sources.get(key);if(!old||source.seenAt>old.seenAt)sources.set(key,source);}
      preferred.sources=[...sources.values()].slice(0,100);
      group[index]=preferred;
    }else group.push({...item,sources:[...item.sources]});
    groups.set(base,group);
  }
  return [...groups].flatMap(([base,offers])=>offers.map(code=>{
    const id=offers.length>1?base+':'+createHash('sha256').update(identity(code)).digest('hex').slice(0,24):base;
    const result={...code,id};return {...result,confidence:discoveryConfidence(result)};
  }));
}
