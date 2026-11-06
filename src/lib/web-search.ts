import { createRequire } from 'node:module';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Company } from './companies';
import type { PromoCode } from './promocodes';
import { parsePromoCodesFromHtml } from './promo-parser';
const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');

// Search targets, not claims that all these sites were read or contain a coupon.
export const SEARCH_DOMAINS = ['promokod.pikabu.ru','promokodi.ru','promokodus.com','promkod.ru','promokod.vbr.ru','berikod.ru','promokod.ru','pepper.ru','skidkidor.ru','kupon.ru','biglion.ru','gilmon.ru','kuponator.ru','kuponation.ru','picodi.com','megabonus.com','backit.me','letyshops.com','kp.ru','aif.ru','banki.ru','sravni.ru','t-j.ru','dtf.ru','vc.ru','ixbt.com','otzovik.com','irecommend.ru','zen.yandex.ru'];
export type SearchReport = { codes: PromoCode[]; targetSites: number; discoveredSites: number; pagesRead: number; pagesFailed: number; visited: string[]; warnings: string[] };
function host(value: string) { return new URL(value).hostname.replace(/^www\./,''); }
export function safeSource(value: string, domains: string[]): boolean {
 try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password && !u.port && !isIP(u.hostname) && domains.includes(host(value)); } catch {return false;}
}
function privateAddress(address: string) {
 if (address.includes(':')) return true; // Public IPv4 only; do not permit private IPv6 or mapped addresses.
 const parts=address.split('.').map(Number), [a,b]=parts;
 return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19);
}
export async function readPublicPage(url: string, domains: string[], signal: AbortSignal): Promise<string> {
 for(let hop=0;hop<4;hop++) {
  if(!safeSource(url,domains)) throw new Error('Недопустимый адрес источника');
  const bounded=AbortSignal.any([signal,AbortSignal.timeout(10000)]);
  bounded.throwIfAborted();
  const records=await new Promise<{address:string;family:number}[]>((resolve,reject)=>{
   const abort=()=>reject(bounded.reason);bounded.addEventListener('abort',abort,{once:true});
   lookup(new URL(url).hostname,{all:true,family:4}).then(resolve,reject).finally(()=>bounded.removeEventListener('abort',abort));
  });
  if(!records.length||records.some(record=>privateAddress(record.address))) throw new Error('Источник не является публичным сайтом');
  const response=await fetch(url,{redirect:'manual',signal:bounded,headers:{'User-Agent':'PromoSpy/0.7 public coupon search','Accept':'text/html,application/rss+xml,application/xml','Accept-Language':'ru-RU'}});
  if([301,302,303,307,308].includes(response.status)) {
   const target=response.headers.get('location');await response.body?.cancel();
   if(!target)throw new Error('Перенаправление без адреса');
   const next=new URL(target,url).href;
   if(host(next)!==host(url))throw new Error('Источник перенаправил на другой сайт');
   url=next;continue;
  }
  if(!response.ok){await response.body?.cancel();throw new Error(`HTTP ${response.status}`);}
  if(!/text\/html|xml/i.test(response.headers.get('content-type')??'')){await response.body?.cancel();throw new Error('Не HTML/XML');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Пустой ответ');
  const chunks:Uint8Array[]=[];let bytes=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2_000_000)throw new Error('Страница слишком большая');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks).toString('utf8');
 }
 throw new Error('Слишком много перенаправлений');
}
export function parseDiscovery(xml:string,domains:string[]):string[] {
 const $=load(xml,{xmlMode:true});
 return [...new Set($('item > link').map((_,el)=>$(el).text().trim()).get().filter(url=>safeSource(url,domains)))];
}
export function parseMerchantPage(html:string,url:string,company:Company,now=Date.now()):PromoCode[] {
 const $=load(html);$('script[type!="application/ld+json"],style,noscript').remove();
 const heading=$('title,h1').text().toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]/gu,'');
 const aliases=[company.name,...company.keywords].map(name=>name.toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]/gu,''));
 if(host(url)!==host(company.website)&&!aliases.some(alias=>alias.length>=4&&heading.includes(alias)))return [];
 const result=parsePromoCodesFromHtml(html,url,company.id,now);
 // Explicit labels in individual cards; never mine arbitrary uppercase words from a page.
 $('article,.coupon,.promocode,[data-coupon],[data-offer]').each((_,el)=>{
  const card=$(el);if(card.find('article,.coupon,.promocode,[data-coupon],[data-offer]').length)return;
  card.find('p,h2,h3,li,div').append(' ');card.find('br').replaceWith(' ');
  const content=card.text().replace(/\s+/g,' ').trim();
  const match=content.match(/(?:промокод|код купона)\s*[:：]\s*([\p{L}\p{N}][\p{L}\p{N}_-]{1,63})(?![\p{L}\p{N}_-])/iu);
  if(!match)return;
  result.push(...parsePromoCodesFromHtml(JSON.stringify([{promoCode:match[1],title:card.find('h2,h3').first().text()||`Промокод ${company.name}`,conditions:[content.slice(0,1000)]}]),url,company.id,now));
 });
 return result.map(code=>({...code,status:code.status==='expired'?'expired':'found',checked:undefined,evidence:undefined,validUntil:undefined,verificationDetails:'Найдено в открытом источнике. Применение не проверялось.'}));
}
const slugs:Record<number,string>={5:'burger-king',54:'vkusvill',102:'vkusno-i-tochka',201:'magnit',202:'pyaterochka',203:'yandex-lavka',204:'yandex-market',205:'perekrestok',206:'lenta',207:'wildberries',208:'ozon',301:'tanuki',302:'kroshka-kartoshka'};
export async function searchMerchant(company:Company,signal:AbortSignal,read=readPublicPage):Promise<SearchReport> {
 const domains=[host(company.website),...SEARCH_DOMAINS];
 const report:SearchReport={codes:[],targetSites:domains.length,discoveredSites:0,pagesRead:0,pagesFailed:0,visited:[],warnings:[]};
 const slug=slugs[company.id];
 const urls=new Set([company.website,`https://promokod.pikabu.ru/shops/${slug}`,`https://promokodi.ru/store/${slug}`,`https://promokodus.com/campaigns/${slug}`]);
 let discoveryFailures=0;
 let discoveryCursor=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(discoveryCursor<domains.length){
   const i=discoveryCursor;discoveryCursor+=5;signal.throwIfAborted();
   const query=`"${company.name}" промокод (${domains.slice(i,i+5).map(domain=>`site:${domain}`).join(' OR ')})`;
   try {const xml=await read(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`,['bing.com'],signal);for(const url of parseDiscovery(xml,domains))urls.add(url);}catch {discoveryFailures++;}
  }
 }));
 if(discoveryFailures)report.warnings.push(`Поисковая выдача недоступна для ${discoveryFailures} из 6 групп источников.`);
 const candidates=[...urls].slice(0,30);report.discoveredSites=new Set(candidates.map(host)).size;
 let cursor=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(cursor<candidates.length){const url=candidates[cursor++];signal.throwIfAborted();
   try {const html=await read(url,domains,signal);if(/captcha|cf-chl-|проверка браузера|подтвердите.{0,25}не робот/i.test(html.slice(0,15000)))throw new Error('Защита сайта');
    report.pagesRead++;report.visited.push(url);report.codes.push(...parseMerchantPage(html,url,company));
   }catch{report.pagesFailed++;}
  }
 }));
 const unique=new Map<string,PromoCode>();
 for(const code of report.codes){const existing=unique.get(code.code);if(!existing){unique.set(code.code,{...code,id:`${company.id}:${code.code}`});continue;}for(const source of code.sources)if(!existing.sources.some(old=>old.url===source.url))existing.sources.push(source);}
 report.codes=[...unique.values()].slice(0,100);
 if(!report.pagesRead)throw new Error('Открытые сайты недоступны. Попробуйте позже.');
 return report;
}
