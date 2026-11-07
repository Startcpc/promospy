import { createRequire } from 'node:module';
import type { Company } from './companies';
import { safeSource, sourceHost } from './fetch-policy';
import { sourceIdentity } from './promo-validation';
const {load}=createRequire(import.meta.url)('cheerio') as typeof import('cheerio');
export type PublicReader=(url:string,domains:string[],signal:AbortSignal)=>Promise<string>;
export type DiscoveryResult={provider:string;url:string;outcome:'ok'|'error'|'budget';found:number;message?:string};
export class DiscoveryBudget {
  used=0;
  results:DiscoveryResult[]=[];
  limit:number;
  constructor(limit:number){this.limit=limit;}
  async read(provider:string,url:string,domains:string[],signal:AbortSignal,read:PublicReader){
    if(this.used>=this.limit||signal.aborted)return null;
    this.used++;
    const result:DiscoveryResult={provider,url,outcome:'ok',found:0};this.results.push(result);
    try{return {text:await read(url,domains,signal),result};}
    catch(error){result.outcome='error';result.message=(error instanceof Error?error.message:'Не удалось прочитать индекс').slice(0,500);return null;}
  }
}
function unique(values:string[],domains:string[]){
  return [...new Map(values.filter(url=>safeSource(url,domains)).map(url=>[sourceIdentity(url),url])).values()];
}
export function parseFeedLinks(xml:string,domains:string[]){
  const $=load(xml,{xmlMode:true});
  return unique($('item > link, entry > link').toArray().filter(el=>!$(el).attr('rel')||$(el).attr('rel')==='alternate').map(el=>$(el).attr('href')??$(el).text().trim()),domains);
}
export function parseIndexLinks(html:string,base:string,domains:string[]){
  const $=load(html),result:string[]=[];
  $('a[href]').each((_,element)=>{
    try{
      let target=new URL($(element).attr('href')!,base);
      if(sourceHost(target.href)==='html.duckduckgo.com'&&target.searchParams.has('uddg'))target=new URL(target.searchParams.get('uddg')!);
      if(sourceHost(target.href)==='r.search.yahoo.com'){
        const embedded=target.pathname.match(/\/RU=([^/]+)\/R[SK]=/);if(embedded)target=new URL(decodeURIComponent(embedded[1]));
      }
      if(safeSource(target.href,domains))result.push(target.href);
    }catch{}
  });
  return unique(result,domains);
}
export function parseSitemap(xml:string,domains:string[]){
  const $=load(xml,{xmlMode:true});
  const indexes=unique($('sitemap > loc').slice(0,1000).map((_,el)=>$(el).text().trim()).get(),domains);
  const pages=unique($('url > loc').slice(0,10000).map((_,el)=>$(el).text().trim()).get(),domains)
    .filter(url=>{try{return /promo|coupon|action|offer|special|акци|промокод/i.test(decodeURI(new URL(url).pathname));}catch{return false;}});
  return {indexes,pages};
}
export function pageFeeds(html:string,base:string,domains:string[]){
  const $=load(html);
  return unique($('link[rel="alternate"][href]').toArray().filter(el=>/rss|atom|feed\+json/i.test($(el).attr('type')??'')).flatMap(el=>{
    try{return [new URL($(el).attr('href')!,base).href];}catch{return [];}
  }),domains).slice(0,2);
}
export async function discoverSitemaps(roots:string[],hints:string[],domains:string[],budget:DiscoveryBudget,signal:AbortSignal,read:PublicReader){
  const initial=unique([...hints,...roots.map(root=>new URL('/sitemap.xml',root).href)],domains).slice(0,3);
  const pages:string[]=[];
  let requests=0;
  for(const url of initial){
    if(requests>=3||signal.aborted)break;
    const response=await budget.read('merchant-sitemap',url,domains,signal,read);requests++;
    if(!response)continue;
    const parsed=parseSitemap(response.text,domains);pages.push(...parsed.pages);response.result.found=parsed.pages.length;
    const children=parsed.indexes.sort((a,b)=>Number(/promo|action|offer/i.test(b))-Number(/promo|action|offer/i.test(a))).slice(0,2);
    for(const child of children){
      if(requests>=3||signal.aborted)break;
      const nested=await budget.read('merchant-sitemap',child,domains,signal,read);requests++;
      if(nested){const parsed=parseSitemap(nested.text,domains);pages.push(...parsed.pages);nested.result.found=parsed.pages.length;}
    }
  }
  return unique(pages,domains).slice(0,12);
}
export async function discoverIndexes(company:Company,domains:string[],budget:DiscoveryBudget,signal:AbortSignal,read:PublicReader,onFound:(urls:string[])=>void){
  const encoded=encodeURIComponent('"'+company.name+'" промокод');
  const providers=[
    {name:'duckduckgo-html',url:'https://html.duckduckgo.com/html/?q='+encoded,hosts:['html.duckduckgo.com'],parse:parseIndexLinks},
    {name:'yahoo-html',url:'https://search.yahoo.com/search?p='+encoded,hosts:['search.yahoo.com','r.search.yahoo.com'],parse:parseIndexLinks},
  ];
  // Independent providers run alongside Bing, rather than behind its success.
  const alternatives=Promise.all(providers.map(async provider=>{
    const response=await budget.read(provider.name,provider.url,provider.hosts,signal,read);
    if(response){const urls=provider.parse(response.text,provider.url,domains);response.result.found=urls.length;onFound(urls);}
  }));
  let cursor=0;
  await Promise.all(Array.from({length:2},async()=>{
    while(cursor<domains.length&&!signal.aborted){
      const start=cursor;cursor+=5;
      const query='"'+company.name+'" промокод ('+domains.slice(start,start+5).map(domain=>'site:'+domain).join(' OR ')+')';
      const url='https://www.bing.com/search?format=rss&q='+encodeURIComponent(query);
      const response=await budget.read('bing-rss',url,['bing.com'],signal,read);
      if(response){const urls=parseFeedLinks(response.text,domains);response.result.found=urls.length;onFound(urls);}
      if(budget.used>=budget.limit)break;
    }
  }));
  await alternatives;
}
