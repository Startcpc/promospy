import { parseMerchantPage } from '../src/lib/parse-merchant-page';
import { hasPublicOfficialMarkup, parsePublicOfficial, PUBLIC_OFFICIAL_URLS } from '../src/lib/official-search';
import { catalogueUrls } from '../src/lib/source-catalog';
import { mergeOffers } from '../src/lib/offer-identity';
import { parseRobots, robotsAllows } from '../src/lib/robots';
import { isChallengePage, isLoginWall, explicitEmpty } from '../src/lib/source-extraction';

const headers = { 'User-Agent': 'PromoSpy/0.17 (+https://github.com/Startcpc/promospy)', Accept: 'text/html,text/plain' };

async function boundedText(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Пустой ответ источника');
  const decoder = new TextDecoder();
  let size = 0, result = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) return result + decoder.decode();
      size += value.byteLength;
      if (size > limit) throw Error('Страница превышает лимит размера');
      result += decoder.decode(value,{stream:true});
    }
  } finally { await reader.cancel().catch(()=>{}); }
}

async function fetchPage(url, signal) {
  // All URLs come from the checked-in catalogue. Follow no redirects, including
  // redirects to consent pages or different merchant domains.
  const request = address => fetch(address, {headers, signal, redirect:'manual'});
  const robots = await request(new URL('/robots.txt',url));
  if (robots.ok) {
    const rules = parseRobots(await boundedText(robots,128000));
    if (!robotsAllows(rules,url) || rules.delayMs > 5000) throw Error('Источник ограничил автоматический поиск');
    if (rules.delayMs) await new Promise(resolve=>setTimeout(resolve,rules.delayMs));
  } else if (![404,410].includes(robots.status)) throw Error('Правила источника недоступны (HTTP '+robots.status+')');
  const response = await request(url);
  if (!response.ok) throw Error('Источник вернул HTTP '+response.status);
  const html = await boundedText(response,4000000);
  if (isChallengePage(html) || isLoginWall(html)) throw Error('Источник ограничил доступ к публикациям');
  return html;
}

export async function scan(company) {
  const official = PUBLIC_OFFICIAL_URLS[company.id];
  const urls = [...(official ? [official] : []), ...catalogueUrls(company.id)];
  const report = {phase:'complete',pagesRead:0,pagesFailed:0,pagesBlocked:0,pagesSkipped:0,parseFailures:0,
    targetSites:urls.length,discoveredSites:urls.length,visited:[],warnings:[],sourceResults:[],officialCoupons:0};
  const offers = [];
  const signal = AbortSignal.timeout(22000);
  // Small batches avoid multiple large DOMs competing for the worker's memory.
  let cursor = 0;
  async function readNext() {
    while(cursor<urls.length) {
      const url=urls[cursor++], isOfficial=url===official;
      try {
        const html=await fetchPage(url,signal), now=Date.now();
        report.pagesRead++;report.visited.push(url);
        const diagnostic={incomplete:false,reasons:[]};
        const codes=isOfficial && hasPublicOfficialMarkup(company.id,html) ? parsePublicOfficial(company.id,html,now)
          : parseMerchantPage(html,url,company,now,isOfficial,diagnostic);
        const outcome=codes.length?'codes':explicitEmpty(html)?'empty':'inconclusive';
        report.sourceResults.push({url,official:isOfficial,outcome,count:codes.length,...(diagnostic.incomplete?{partial:true}: {})});
        offers.push(...codes);
      } catch(error) {
        report.pagesFailed++;
        report.sourceResults.push({url,official:isOfficial,outcome:'error',count:0,message:error.message});
      }
    }
  }
  await Promise.all([readNext(),readNext()]);
  const codes=mergeOffers(offers).slice(0,100);
  report.officialCoupons=codes.filter(code=>code.status==='official').length;
  const ok=report.sourceResults.some(result=>['codes','empty'].includes(result.outcome));
  const now=Date.now();
  return {codes,status:ok?'idle':'failed',report,lastScan:ok?now:null,serverTime:now,nextScan:now+(ok?300000:60000),error:null,log:[],
    ...(!ok?{notice:'Источники пока не вернули подтверждённые карточки. Можно повторить поиск.'}:{})};
}
