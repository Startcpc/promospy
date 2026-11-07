import { createHash } from 'node:crypto';
import { codeKey, type PromoCode } from './promocodes';
import { offerConflict, promoAudience, discoveryConfidence } from './promo-quality';
import { sourceIdentity } from './promo-validation';
function identity(code:PromoCode){
  return JSON.stringify([code.discount,code.minOrder??null,code.startsAt??null,code.expiresAt??null,code.maxDiscount??null,code.channel??null,promoAudience(code)??null]);
}
/** Keep contradictory campaigns separate; a shared string is not shared conditions. */
export function mergeOffers(codes:PromoCode[]):PromoCode[]{
  const groups=new Map<string,PromoCode[]>();
  for(const item of codes){
    const base=String(item.companyId)+':'+codeKey(item.code),group=groups.get(base)??[];
    const index=group.findIndex(code=>!offerConflict(code,item)),existing=group[index];
    if(existing){
      const preferred=item.status==='official'&&existing.status!=='official'?{...item,sources:[...item.sources]}:existing;
      const other=preferred===existing?item:existing;
      for(const key of ['minOrder','startsAt','expiresAt','maxDiscount'] as const)if(preferred[key]===undefined&&other[key]!==undefined)preferred[key]=other[key];
      if(!preferred.conditions.length)preferred.conditions=[...other.conditions];
      for(const source of other.sources)if(!preferred.sources.some(old=>sourceIdentity(old.url)===sourceIdentity(source.url)))preferred.sources.push(source);
      group[index]=preferred;
    }else group.push({...item,sources:[...item.sources]});
    groups.set(base,group);
  }
  return [...groups].flatMap(([base,offers])=>offers.map(code=>{
    const id=offers.length>1?base+':'+createHash('sha256').update(identity(code)).digest('hex').slice(0,24):base;
    const result={...code,id};return {...result,confidence:discoveryConfidence(result)};
  }));
}
