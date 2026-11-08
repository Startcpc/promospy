/** Brand aliases only. Short search abbreviations do not prove source ownership. */
export const merchantAliases:Record<number,string[]>={
  5:['бургер кинг','burger king'],54:['вкусвилл','вкус вилл','vkusvill'],102:['вкусно и точка','vkusnoitochka'],
  201:['магнит','magnit','магнит доставка'],202:['пятерочка','пятёрочка','5ka'],203:['яндекс лавка','yandex lavka'],204:['яндекс маркет','yandex market'],
  205:['перекресток','перекрёсток','perekrestok','перекресток впрок','перекрёсток впрок'],206:['лента','lenta','лента онлайн'],207:['wildberries','вайлдберриз'],208:['ozon','озон'],
  301:['tanuki','тануки'],302:['крошка картошка','kroshka kartoshka'],
};
export const normalizeMerchantName=(name:string)=>name.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
// Shared brand words do not make separate services the same merchant. These
// names are known redirect destinations and sibling shops in public catalogues.
const separateServices:Record<number,string[]>={
  208:['ozonbank','ozonбанк','озонбанк','озонbank'],
  201:['магнитаптека','аптекамагнит','magnitapteka','aptekamagnit'],
};
export function isSeparateMerchantService(name:string,companyId:number){
  const normalized=normalizeMerchantName(name);
  return separateServices[companyId]?.some(service=>{
    const position=normalized.indexOf(service);
    if(position<0)return false;
    // "Ozon ... paid with an Ozon Bank card" still belongs to the marketplace.
    return !(merchantAliases[companyId]??[]).some(alias=>{
      const first=normalized.indexOf(normalizeMerchantName(alias));
      return first>=0&&first<position;
    });
  })??false;
}
