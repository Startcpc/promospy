import { createRequire } from 'node:module';
import { publicHttp, SourceError, type FetchReceipt } from './public-http';
import { SEARCH_DOMAINS, publicSources, sourceParser, officialDomains as merchantDomains } from './source-adapters';
import { DiscoveryBudget, discoverSitemaps, discoverIndexes, parseFeedLinks, pageFeeds, type DiscoveryResult } from './discovery';
import { parsePublicFeed } from './public-feeds';
import { browserReader, needsRendering } from './browser-reader';
import { enrichWithLocalModel } from './source-ai';
import { searchConfig, ENGINE_VERSION } from './search-config';
import { safeSource, sourceHost } from './fetch-policy';
import type { Company } from './companies';
import { sourceIdentity } from './promo-validation';
import type { PromoCode } from './promocodes';
import { parsePromoCodesFromHtml, mergePromoCodes, type ParseDiagnostics } from './promo-parser';
import { extractOfficialDates } from './promo-terms';
import { extractCouponCards, extractCouponTables, isChallengePage, isLoginWall, matchesMerchant, explicitEmpty, merchantContent } from './source-extraction';
import { isSeparateMerchantService } from './merchant-aliases';
import { SourceAvailability } from './source-availability';
const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');

export { SEARCH_DOMAINS } from './source-adapters';
export type SearchReport = {
  engineVersion?:number;
  codes: PromoCode[]; targetSites: number; discoveredSites: number;
  pagesRead: number; pagesFailed: number; visited: string[]; warnings: string[];
  phase?: 'official' | 'sources' | 'complete'; officialPagesRead?: number;
  pagesBlocked?: number; pagesSkipped?:number; parseFailures?: number; couponsFound?:number; officialCoupons?:number;
  issues?: {url:string;reason:string}[];
  parsedUrls?: string[];
  discovery?: DiscoveryResult[];
  budget?: {pages:number;pagesUsed:number;discoveryRequests:number;discoveryUsed:number};
  sourceResults?: {url:string;official:boolean;outcome:'codes'|'empty'|'index'|'unrecognized'|'blocked'|'skipped'|'error';count:number;message?:string;
    httpStatus?:number;attempts?:number;finalUrl?:string;failureUrl?:string;errorCode?:string;retryAt?:number;rendering?:string;partial?:boolean}[];
};
export type SearchOptions={previousUrls?:string[];pageBudget?:number;discoveryBudget?:number};
export type SearchProgress = (report: SearchReport) => void;
const host=sourceHost;
export { safeSource, routedThroughProxy } from './fetch-policy';
export { decodeSource } from './public-http';
export async function readPublicPage(url:string,domains:string[],signal:AbortSignal):Promise<string>{
  const path=new URL(url).pathname;
  return (await publicHttp.readText(url,domains,signal,/\/robots\.txt$/.test(path)?{kind:'robots',robots:false}:/\.xml(?:\.gz)?$/.test(path)?{kind:'sitemap'}:{})).text;
}
const availabilityByReader=new WeakMap<typeof readPublicPage,SourceAvailability>();
export function parseDiscovery(xml:string,domains:string[]){return parseFeedLinks(xml,domains);}
export function parseMerchantPage(html: string, url: string, company: Company, now = Date.now(), official = false, diagnostics:ParseDiagnostics={incomplete:false,reasons:[]}): PromoCode[] {
  if(/^\s*[\[{]/.test(html)){try{const feed=JSON.parse(html);if(typeof feed.version==='string'&&feed.version.startsWith('https://jsonfeed.org/'))return parsePublicFeed(html,url,company,now,diagnostics);}catch{}return parsePromoCodesFromHtml(html,url,company.id,now,{requireMerchant:!official,diagnostics});}
  if(/<(?:rss|feed)(?:\s|>)/i.test(html))return parsePublicFeed(html,url,company,now,diagnostics);
  const scoped = merchantContent(html), $ = load(scoped);
  if($('title,h1').toArray().some(element=>isSeparateMerchantService($(element).text(),company.id)))return [];
  const ownHost = host(url) === host(company.website);
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
  diagnostics.incomplete=cardDiagnostics.incomplete||(structuredDiagnostics.rejectedCodes??[]).some(code=>!cards.some(card=>card.code===code));
  diagnostics.reasons=[...cardDiagnostics.reasons,...structuredDiagnostics.reasons].slice(0,5);
  const result = mergePromoCodes([...cards,...structured.filter(code=>!cards.some(card=>card.code===code.code)&&!cardDiagnostics.rejectedCodes?.includes(code.code))]);
  return result.map(code => {
    const dates = official ? extractOfficialDates([code.description,...code.conditions].join(' ')) : {};
    const startsAt = code.startsAt ?? dates.startsAt, expiresAt = code.expiresAt ?? dates.expiresAt;
    return {...code,startsAt,expiresAt,status:code.status === 'expired' || expiresAt !== undefined && expiresAt <= now ? 'expired' : 'found',checked:undefined,evidence:undefined,validUntil:undefined,verificationDetails:'Найдено в открытом источнике. Применение не проверялось.'};
  });
}

export function officialUrls(company:Company){return publicSources.officialUrls(company);}
export function officialLinks(html: string, base: string, domains: string[]): string[] {
  const $ = load(html);
  return [...new Set($('a[href]').map((_,el) => {
    try {
      const url = new URL($(el).attr('href')!,base); url.hash = '';
      return /промокод|акци|купон|скидк|promocode|promo|coupon|action|offer|special/i.test(`${$(el).text()} ${url.pathname}`) && safeSource(url.href,domains) ? url.href : '';
    } catch { return ''; }
  }).get().filter(Boolean))].slice(0,4);
}
function mergeCodes(codes: PromoCode[], _companyId: number): PromoCode[] {
  return mergePromoCodes(codes).slice(0,100);
}
export async function searchMerchant(company:Company,signal:AbortSignal,read: (url:string,domains:string[],signal:AbortSignal)=>Promise<string> = readPublicPage,onProgress?:SearchProgress,options:SearchOptions={}):Promise<SearchReport>{
  signal.throwIfAborted();
  const config=searchConfig(),pageLimit=Math.min(50,Math.max(6,options.pageBudget??config.pages));
  const budget=new DiscoveryBudget(Math.min(20,Math.max(3,options.discoveryBudget??config.discoveryRequests)));
  const initial=officialUrls(company),officialDomains=merchantDomains(company),domains=[...new Set([...officialDomains,...SEARCH_DOMAINS])];
  const availability=availabilityByReader.get(read)??new SourceAvailability();availabilityByReader.set(read,availability);
  const report:SearchReport={engineVersion:ENGINE_VERSION,codes:[],targetSites:domains.length,discoveredSites:0,pagesRead:0,pagesFailed:0,visited:[],warnings:[],issues:[],parsedUrls:[],sourceResults:[],phase:'official',officialPagesRead:0,pagesBlocked:0,pagesSkipped:0,parseFailures:0,discovery:budget.results};
  const attempted=new Map<string,string>(),candidates=new Map<string,string>();
  const skipped=new Set<string>();
  const add=(urls:string[])=>{for(const url of urls)if(safeSource(url,domains)&&candidates.size<150)candidates.set(sourceIdentity(url),url);};
  const publish=()=>{
    report.codes=mergeCodes(report.codes,company.id);report.couponsFound=report.codes.length;report.officialCoupons=report.codes.filter(code=>code.status==='official').length;
    report.discoveredSites=new Set([...candidates.values(),...attempted.values()].map(host)).size;
    report.budget={pages:pageLimit,pagesUsed:attempted.size,discoveryRequests:budget.limit,discoveryUsed:budget.used};
    onProgress?.(structuredClone(report));
  };
  const feeds=new Set<string>();
  const visit=async(url:string,official:boolean,stageSignal:AbortSignal):Promise<string|null>=>{
    const identity=sourceIdentity(url),limit=report.phase==='official'?pageLimit-3:pageLimit;
    if(attempted.has(identity)||skipped.has(identity)||attempted.size>=limit||attempted.size+skipped.size>=100||stageSignal.aborted||!safeSource(url,official?officialDomains:domains))return null;
    const pause=availability.get(url);
    if(pause){skipped.add(identity);report.pagesSkipped!++;report.sourceResults!.push({url,official,outcome:'skipped',count:0,...pause});publish();return null;}
    attempted.set(identity,url);add([url]);
    let fetched=false,receipt:FetchReceipt|undefined,actualUrl=url,rendering:string|undefined;
    try{
      let html:string;
      if(read===readPublicPage){const result=await publicHttp.readText(url,official?officialDomains:domains,stageSignal);html=result.text;receipt=result.receipt;actualUrl=receipt.finalUrl;}
      else html=await read(url,official?officialDomains:domains,stageSignal);
      const actualOfficial=official||officialDomains.includes(host(actualUrl));
      if(isChallengePage(html))throw new SourceError('Сайт запросил проверку браузера','restricted',actualUrl,receipt?.status,undefined,receipt?.attempts);
      if(isLoginWall(html))throw new SourceError('Для просмотра кодов требуется вход или подписка','restricted',actualUrl,undefined,undefined,receipt?.attempts);
      fetched=true;report.pagesRead++;report.visited.push(url);if(actualOfficial)report.officialPagesRead!++;
      const diagnostics:ParseDiagnostics={incomplete:false,reasons:[]};
      const parse=()=>{
        const document=load(html);
        if(document('title,h1').toArray().some(element=>isSeparateMerchantService(document(element).text(),company.id)))throw new Error('Страница относится к другому сервису магазина');
        const adapter=actualOfficial?sourceParser(company,actualUrl,html):undefined;
        return adapter?adapter.parse(html,actualUrl,receipt?.observedAt??Date.now()):parseMerchantPage(html,actualUrl,company,receipt?.observedAt??Date.now(),actualOfficial,diagnostics);
      };
      let codes:PromoCode[];
      try{codes=parse();}catch(error){throw new SourceError(error instanceof Error?error.message:'Изменилась разметка источника','parse',actualUrl,receipt?.status,undefined,receipt?.attempts);}
      if(!codes.length&&diagnostics.incomplete)throw new SourceError(diagnostics.reasons.join('; '),'parse',actualUrl,receipt?.status,undefined,receipt?.attempts);
      if(!codes.length&&needsRendering(html)&&config.browser){
        const result=await browserReader.render(actualUrl,actualOfficial?officialDomains:domains,stageSignal);rendering=result.reason;
        if(result.html){html=result.html;actualUrl=result.finalUrl??actualUrl;codes=parse();}
      }
      if(actualOfficial)codes=codes.map(code=>({...code,status:code.status==='expired'?'expired':'official',checked:receipt?.observedAt??Date.now(),verificationDetails:'Опубликован на официальном сайте. Применение в корзине не проверялось.',evidence:{method:'source',observedAt:receipt?.observedAt??Date.now(),sourceUrl:actualUrl,message:'Официальная публикация'}}));
      const document=load(html),heading=document('title,h1').text(),merchantMatches=matchesMerchant(heading,company);
      const empty=!isSeparateMerchantService(heading,company.id)&&/промокод|купон|coupon/i.test(heading)&&(actualOfficial||merchantMatches)&&explicitEmpty(merchantContent(html));
      const isIndex=!codes.length&&!empty&&sourceIdentity(actualUrl)===sourceIdentity(company.website);
      const outcome=codes.length?'codes':empty?'empty':isIndex?'index':'unrecognized';
      report.sourceResults!.push({url,official:actualOfficial,outcome,count:codes.length,...(receipt?{httpStatus:receipt.status,attempts:receipt.attempts,finalUrl:actualUrl}:{}),...(rendering?{rendering}:{}),...(diagnostics.incomplete?{partial:true,message:diagnostics.reasons.join('; ')}:{}),...(outcome==='unrecognized'?{message:'Страница загружена, но промокоды не распознаны'}:{})});
      if(diagnostics.incomplete)report.parseFailures!++;
      if((codes.length||empty)&&!diagnostics.incomplete)for(const parsed of [url,actualUrl])if(!report.parsedUrls!.includes(parsed))report.parsedUrls!.push(parsed);
      if(outcome==='unrecognized'){report.parseFailures!++;report.issues!.push({url,reason:'Не распознана разметка промокодов'});}
      for(const feed of pageFeeds(html,actualUrl,actualOfficial?officialDomains:domains))feeds.add(feed);
      report.codes.push(...codes);publish();return html;
    }catch(error){
      const problem=error instanceof SourceError?error:undefined;
      if(problem)availability.remember(url,problem);
      const blocked=problem&&['restricted','robots','rate_limit'].includes(problem.code)||problem?.code==='circuit'&&[401,403,429].includes(problem.status??0);
      if(!fetched)report.pagesFailed++;
      if(blocked)report.pagesBlocked!++;else if(fetched)report.parseFailures!++;
      const message=(error instanceof Error?error.message:'Не удалось прочитать источник').slice(0,500);
      report.sourceResults!.push({url,official,outcome:blocked?'blocked':'error',count:0,message,...(problem?{errorCode:problem.code,...(problem.status?{httpStatus:problem.status}:{}),attempts:problem.attempts,...(problem.retryAt?{retryAt:problem.retryAt}:{}),failureUrl:problem.url}:{}),...(receipt?{finalUrl:actualUrl}:{}),...(rendering?{rendering}:{})});
      report.issues!.push({url,reason:message});publish();return null;
    }
  };
  const officialSignal=AbortSignal.any([signal,AbortSignal.timeout(Math.min(25000,config.timeoutMs/2))]);
  const linked=new Set<string>();
  for(const url of initial){
    if(officialSignal.aborted)break;
    const html=await visit(url,true,officialSignal);if(html)for(const link of officialLinks(html,url,officialDomains))linked.add(link);
  }
  const history=(options.previousUrls??[]).filter(url=>safeSource(url,domains)).slice(0,16);add(history);
  for(const url of history)if(officialDomains.includes(host(url)))linked.add(url);
  await Promise.all([...linked].slice(0,4).map(url=>visit(url,true,officialSignal)));
  if(!officialSignal.aborted&&initial.some(url=>!availability.get(url))){
    let hints:string[]=[];
    if(read===readPublicPage)try{hints=await publicHttp.sitemapHints(initial[0],officialDomains,officialSignal);}catch{}
    const sitemapPages=await discoverSitemaps(initial,hints,officialDomains,budget,officialSignal,read);add(sitemapPages);
    await Promise.all(sitemapPages.slice(0,4).map(url=>visit(url,true,officialSignal)));
    for(const url of [...feeds].filter(url=>officialDomains.includes(host(url))).slice(0,2))await visit(url,true,officialSignal);
  }
  signal.throwIfAborted();report.phase='sources';publish();
  const known=publicSources.seedUrls(company);add(known);add(history);
  const direct=[...new Set([...history.filter(url=>!officialDomains.includes(host(url))),...known])];
  let directCursor=0;
  const directJob=Promise.all(Array.from({length:3},async()=>{while(directCursor<direct.length&&!signal.aborted)await visit(direct[directCursor++],false,signal);}));
  await discoverIndexes(company,SEARCH_DOMAINS,budget,signal,read,urls=>{add(urls);publish();});
  await directJob;
  const remaining=[...candidates.values()].filter(url=>!attempted.has(sourceIdentity(url))&&!skipped.has(sourceIdentity(url))).slice(0,Math.max(0,pageLimit-attempted.size));
  let cursor=0;
  await Promise.all(Array.from({length:3},async()=>{while(cursor<remaining.length&&!signal.aborted){const url=remaining[cursor++];await visit(url,officialDomains.includes(host(url)),signal);}}));
  for(const feed of [...feeds].slice(0,3))if(!signal.aborted)await visit(feed,officialDomains.includes(host(feed)),signal);
  if(budget.results.some(result=>result.outcome==='error'))report.warnings.push('Часть индексов или карт сайта не прочитана; остальные источники проверены независимо.');
  if(process.env.PROMO_OLLAMA_MODEL){
    let count=0;
    for(let i=0;i<report.codes.length&&!signal.aborted&&count<2;i++)if(report.codes[i].status!=='official'&&(/^Промокод\b/i.test(report.codes[i].description)||report.codes[i].conditions.length<=1)){
      report.codes[i]=await enrichWithLocalModel(report.codes[i],signal);count++;publish();
    }
  }
  signal.throwIfAborted();report.phase='complete';publish();return report;
}
