import { createRequire } from 'node:module';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as http from 'node:http';
import { HttpPageError, resilientRequest } from './network-resilience';
import { looksLikeClientRenderedShell, renderPublicPage } from './browser-render';
import { enrichLiteralTerms, enrichWithLocalModel } from './promo-nlp';
import type { Company } from './companies';
import { sourceIdentity, validSourceUrl } from './promo-validation';
import type { PromoCode } from './promocodes';
import { parsePromoCodesFromHtml, mergePromoCodes } from './promo-parser';
import { parsePublicOfficial, hasPublicOfficialMarkup, PUBLIC_OFFICIAL_URLS } from './official-search';
import { extractOfficialDates } from './promo-terms';
import { extractCouponCards, isChallengePage, matchesMerchant, explicitEmpty, merchantContent } from './source-extraction';
const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');

// Respect server proxy/CA settings; direct fetch otherwise ignores HTTPS_PROXY.
if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();
else if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  const { EnvHttpProxyAgent, setGlobalDispatcher } = createRequire(import.meta.url)('undici') as typeof import('undici');
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
export const SEARCH_DOMAINS = ['promokod.pikabu.ru','promokodi.ru','promokodus.com','promkod.ru','promokod.vbr.ru','berikod.ru','promokod.ru','pepper.ru','skidkidor.ru','kupon.ru','biglion.ru','gilmon.ru','kuponator.ru','kuponation.ru','picodi.com','megabonus.com','backit.me','letyshops.com','kp.ru','aif.ru','banki.ru','sravni.ru','t-j.ru','dtf.ru','vc.ru','ixbt.com','otzovik.com','getcashback.ru','zen.yandex.ru'];
export type SearchReport = {
  codes: PromoCode[]; targetSites: number; discoveredSites: number;
  pagesRead: number; pagesFailed: number; visited: string[]; warnings: string[];
  phase?: 'official' | 'sources' | 'complete'; officialPagesRead?: number;
  issues?: { url: string; reason: string }[];
  parsedUrls?: string[];
  sourceResults?: { url: string; official: boolean; outcome: 'codes' | 'empty' | 'index' | 'unrecognized' | 'blocked' | 'error'; count: number; message?: string }[];
};
export type SearchProgress = (report: SearchReport) => void;
function host(value: string) { return new URL(value).hostname.replace(/^www\./, ''); }
export function safeSource(value: string, domains: string[]): boolean {
  try {
    const u = new URL(value);
    return validSourceUrl(value) && u.protocol === 'https:' && !u.username && !u.password && !u.port && !isIP(u.hostname) && domains.includes(host(value));
  } catch { return false; }
}
function privateAddress(address: string) {
  if (address.includes(':')) return true;
  const [a,b] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19);
}
export function routedThroughProxy(url: string, env: Record<string,string | undefined> = process.env) {
  if (!(env.https_proxy || env.HTTPS_PROXY)) return false;
  const target = new URL(url);
  return !(env.no_proxy || env.NO_PROXY || '').split(',').some(entry => {
    const rule = entry.trim().toLowerCase();
    if (rule === '*') return true;
    if (!rule) return false;
    const [domain,port] = rule.replace(/^\*?\./,'').split(':');
    if (port && port !== (target.port || '443')) return false;
    return target.hostname === domain || target.hostname.endsWith(`.${domain}`);
  });
}
export async function readPublicPage(url: string, domains: string[], signal: AbortSignal): Promise<string> {
  if (!safeSource(url, domains)) throw new Error('Адрес вне списка источников');
  // Retries are bounded and share a per-domain token bucket across all scans.
  return resilientRequest(host(url), signal, async () => {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
    let current = url;
    for (let hop = 0; hop < 4; hop++) {
      if (!safeSource(current, domains)) throw new Error('Адрес вне списка источников');
      bounded.throwIfAborted();
      // Proxy deployments intentionally resolve destinations remotely; normal
      // direct requests reject local/private IPv4 destinations before fetching.
      if (!routedThroughProxy(current)) {
        const records = await new Promise<{address: string; family: number}[]>((resolve, reject) => {
          const abort = () => reject(bounded.reason);
          bounded.addEventListener('abort', abort, { once: true });
          lookup(new URL(current).hostname, { all: true, family: 4 })
            .then(resolve, reject).finally(() => bounded.removeEventListener('abort', abort));
        });
        if (!records.length || records.some(record => privateAddress(record.address))) {
          throw new Error('Непубличный адрес');
        }
      }
      const response = await fetch(current, {
        redirect: 'manual',
        signal: bounded,
        headers: {
          'User-Agent': 'PromoSpy/0.9 public promotion discovery',
          'Accept': 'text/html,application/xhtml+xml,application/rss+xml,application/xml,application/json',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const target = response.headers.get('location');
        await response.body?.cancel();
        if (!target) throw new Error('Перенаправление без адреса');
        const next = new URL(target, current).href;
        if (!safeSource(next, domains)) throw new Error('Перенаправление вне списка источников');
        current = next;
        continue;
      }
      if (!response.ok) {
        const failure = new HttpPageError(response.status, response.headers.get('retry-after'));
        await response.body?.cancel();
        throw failure;
      }
      if (!/text\/html|xml|application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type') ?? '')) {
        await response.body?.cancel();
        throw new Error('Ответ не HTML/XML/JSON');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Пустой ответ');
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 6_000_000) throw new Error('Страница превышает лимит размера');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return decodeSource(Buffer.concat(chunks), response.headers.get('content-type'));
    }
    throw new Error('Слишком много перенаправлений');
  });
}
export function decodeSource(data: Uint8Array, contentType: string | null) {
  const header = contentType?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
  const start = Buffer.from(data.subarray(0,4096)).toString('latin1');
  const meta = start.match(/<meta[^>]*charset\s*=\s*["']?([^\s;"'>]+)/i)?.[1]
    ?? start.match(/<\?xml[^>]*encoding=["']([^"']+)/i)?.[1];
  try {return new TextDecoder(header ?? meta ?? 'utf-8').decode(data);} catch {return new TextDecoder('utf-8').decode(data);}
}
export function parseDiscovery(xml: string, domains: string[]): string[] {
  const $ = load(xml,{xmlMode:true}), unique = new Map<string,string>();
  for (const value of $('item > link').map((_,el) => $(el).text().trim()).get()) {
    if (safeSource(value,domains) && !unique.has(sourceIdentity(value))) {
      const url = new URL(value); url.hash=''; unique.set(sourceIdentity(value),url.href);
    }
  }
  return [...unique.values()];
}
export function parseMerchantPage(html: string, url: string, company: Company, now = Date.now(), official = false): PromoCode[] {
  const scoped = merchantContent(html), $ = load(scoped);
  const ownHost = host(url) === host(company.website);
  if (!official && !ownHost && !matchesMerchant($('h1').first().text() || $('title').text(),company)) return [];
  const structured = parsePromoCodesFromHtml(scoped,url,company.id,now);
  const cards = extractCouponCards(scoped,url,company,now,official || ownHost).map(card => {
    const metadata = structured.find(item => item.code === card.code && item.description === card.description);
    if (!metadata) return card;
    const expiresAt = card.expiresAt ?? metadata.expiresAt;
    return {...card,expiresAt,startsAt:card.startsAt ?? metadata.startsAt,minOrder:card.minOrder ?? metadata.minOrder,
      status:card.status === 'expired' || expiresAt !== undefined && expiresAt <= now ? 'expired' as const : card.status};
  });
  // The actual coupon card determines whether the campaign is archived. A JSON
  // copy may be stale, while a reused code can belong to a new visible campaign.
  const result = mergePromoCodes([...cards,...structured]);
  return result.map(code => {
    const dates = official ? extractOfficialDates([code.description,...code.conditions].join(' ')) : {};
    const startsAt = code.startsAt ?? dates.startsAt, expiresAt = code.expiresAt ?? dates.expiresAt;
    return {...code,startsAt,expiresAt,status:code.status === 'expired' || expiresAt !== undefined && expiresAt <= now ? 'expired' : 'found',checked:undefined,evidence:undefined,validUntil:undefined,verificationDetails:'Найдено в открытом источнике. Применение не проверялось.'};
  });
}

const slugs: Record<number,string> = {5:'burger-king',54:'vkusvill',102:'vkusno-i-tochka',201:'magnit',202:'pyaterochka',203:'yandex-lavka',204:'yandex-market',205:'perekrestok',206:'lenta',207:'wildberries',208:'ozon',301:'tanuki',302:'kroshka-kartoshka'};
export function officialUrls(company: Company): string[] {
  const primary = PUBLIC_OFFICIAL_URLS[company.id] ?? ({5:'https://burgerkingrus.ru/coupons/',302:'https://www.kartoshka.com/actions/'} as Record<number,string>)[company.id];
  return [...new Set([primary,company.website].filter((url): url is string => !!url))];
}
export function officialLinks(html: string, base: string, domains: string[]): string[] {
  const $ = load(html);
  return [...new Set($('a[href]').map((_,el) => {
    try {
      const url = new URL($(el).attr('href')!,base); url.hash = '';
      return /промокод|акци|купон|скидк|promocode|promo|coupon|action|offer|special/i.test(`${$(el).text()} ${url.pathname}`) && safeSource(url.href,domains) ? url.href : '';
    } catch { return ''; }
  }).get().filter(Boolean))].slice(0,4);
}
function mergeCodes(codes: PromoCode[], companyId: number): PromoCode[] {
  const unique = new Map<string,PromoCode>();
  for (const code of codes) {
    const previous = unique.get(code.code);
    if (!previous) { unique.set(code.code,{...code,id:`${companyId}:${code.code}`,sources:[...code.sources]}); continue; }
    // Official terms take precedence; a third-party card only adds its source.
    for (const source of code.sources) if (!previous.sources.some(old => old.url === source.url)) previous.sources.push(source);
  }
  return [...unique.values()].slice(0,100);
}
export async function searchMerchant(company: Company, signal: AbortSignal, read = readPublicPage, onProgress?: SearchProgress): Promise<SearchReport> {
  signal.throwIfAborted();
  const initial = officialUrls(company), officialDomains = [...new Set(initial.map(host))];
  const domains = [...new Set([...officialDomains,...SEARCH_DOMAINS])];
  const report: SearchReport = {codes:[],targetSites:30,discoveredSites:0,pagesRead:0,pagesFailed:0,visited:[],warnings:[],issues:[],parsedUrls:[],sourceResults:[],phase:'official',officialPagesRead:0};
  const attempted = new Set<string>();
  let browserBudget = 2;
  let localModelBudget = 4;
  const publish = () => {
    report.codes = mergeCodes(report.codes,company.id);
    report.discoveredSites = new Set([...attempted].map(host)).size;
    onProgress?.(structuredClone(report));
  };
  const visit = async (url: string, official: boolean, stageSignal: AbortSignal): Promise<string | null> => {
    const identity = sourceIdentity(url);
    if ([...attempted].some(previous => sourceIdentity(previous) === identity)) return null;
    attempted.add(url);
    try {
      let html = await read(url,official ? officialDomains : domains,stageSignal);
      if (isChallengePage(html)) {
        report.sourceResults!.push({url,official,outcome:'blocked',count:0,message:'Сайт запросил проверку браузера'});
        throw new Error('Сайт запросил проверку браузера');
      }
      // Render only successful but empty client-side shells. Access-denied pages
      // never reach this fallback; the browser cannot override a site restriction.
      if (browserBudget > 0 && process.env.PROMO_RENDER_JS === '1' && looksLikeClientRenderedShell(html)) {
        browserBudget--;
        try {
          html = await renderPublicPage(url, official ? officialDomains : domains, stageSignal) ?? html;
        } catch (error) {
          if (stageSignal.aborted) throw error;
          report.warnings.push('JS-страница не отрисована: ' + (error instanceof Error ? error.message : 'ошибка браузера'));
        }
      }
      report.pagesRead++; report.visited.push(url);
      if (official) report.officialPagesRead!++;
      let codes: PromoCode[];
      if (official && url === PUBLIC_OFFICIAL_URLS[company.id] && hasPublicOfficialMarkup(company.id,html)) codes = parsePublicOfficial(company.id,html);
      else codes = parseMerchantPage(html,url,company,Date.now(),official);
      codes = codes.map(code => enrichLiteralTerms(code));
      if (codes.length && localModelBudget > 0 && process.env.PROMO_OLLAMA_MODEL) {
        const count = Math.min(codes.length, localModelBudget);
        localModelBudget -= count;
        codes = [...await enrichWithLocalModel(codes.slice(0, count), stageSignal), ...codes.slice(count)];
      }
      if (official) codes = codes.map(code => ({...code,status:code.status === 'expired' ? 'expired' : 'official',checked:Date.now(),verificationDetails:'Опубликован на официальном сайте. Применение не проверялось.',evidence:{method:'source',observedAt:Date.now(),sourceUrl:url,message:'Официальная публикация'}}));
      const document = load(html);
      const merchantMatches = matchesMerchant(`${document('title').text()} ${document('h1').text()}`,company);
      const couponContext = /промокод|купон|coupon/i.test(`${document('title').text()} ${document('h1').text()}`);
      const empty = couponContext && (official || merchantMatches) && explicitEmpty(merchantContent(html));
      const isIndex = !codes.length && !empty && url.replace(/\/$/,'') === company.website.replace(/\/$/,'');
      const outcome = codes.length ? 'codes' : empty ? 'empty' : isIndex ? 'index' : 'unrecognized';
      report.sourceResults!.push({url,official,outcome,count:codes.length,...(outcome === 'unrecognized' ? {message:'Страница загружена, но разметка промокодов не распознана'} : {})});
      if (codes.length || empty) report.parsedUrls!.push(url);
      if (outcome === 'unrecognized') report.issues!.push({url,reason:'Не распознана разметка промокодов'});
      report.codes.push(...codes); publish(); return html;
    } catch (error) {
      report.pagesFailed++;
      const outcome = error instanceof HttpPageError && [401, 403, 429].includes(error.status) ? 'blocked' : 'error';
      if (!report.sourceResults!.some(source => source.url === url)) report.sourceResults!.push({url,official,outcome,count:0,message:error instanceof Error ? error.message : 'Ошибка загрузки'});
      report.issues!.push({url,reason:error instanceof Error ? error.message : 'Не удалось прочитать страницу'});
      publish(); return null;
    }
  };
  // Finish the official stage before issuing any third-party request.
  const officialSignal = AbortSignal.any([signal,AbortSignal.timeout(20000)]);
  const linked = new Set<string>();
  for (const url of initial) {
    if (officialSignal.aborted) break;
    const html = await visit(url,true,officialSignal);
    if (html) for (const link of officialLinks(html,url,officialDomains)) linked.add(link);
  }
  const remaining = [...linked].filter(url => !attempted.has(url)).slice(0,4);
  await Promise.all(remaining.map(url => officialSignal.aborted ? null : visit(url,true,officialSignal)));
  signal.throwIfAborted();
  report.phase = 'sources'; publish();
  const slug = slugs[company.id];
  const known = [`https://promokod.pikabu.ru/shops/${slug}`,`https://promokodi.ru/store/${slug}/`,[54,201].includes(company.id) ? `https://getcashback.ru/promocodes/${slug}/` : `https://promokodus.com/campaigns/${slug}`];
  // Known pages start immediately; RSS discovery cannot hold them up.
  const knownJob = Promise.all(known.map(url => visit(url,false,signal)));
  const discovered = new Map<string,string>(); let discoveryCursor = 0, discoveryFailures = 0;
  await Promise.all(Array.from({length:3},async () => {
    while (discoveryCursor < SEARCH_DOMAINS.length && !signal.aborted) {
      const i = discoveryCursor; discoveryCursor += 5;
      const query = `"${company.name}" промокод (${SEARCH_DOMAINS.slice(i,i+5).map(domain => `site:${domain}`).join(' OR ')})`;
      try {
        const xml = await read(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`,['bing.com'],signal);
        for (const url of parseDiscovery(xml,SEARCH_DOMAINS)) if (!discovered.has(sourceIdentity(url))) discovered.set(sourceIdentity(url),url);
      } catch { discoveryFailures++; }
    }
  }));
  await knownJob;
  if (discoveryFailures) report.warnings.push(`Не получена поисковая выдача для ${discoveryFailures} групп; прямые адреса проверены отдельно.`);
  const candidates = [...discovered.values()].filter(url => ![...attempted].some(previous => sourceIdentity(previous) === sourceIdentity(url))).slice(0,Math.max(0,30-attempted.size));
  let cursor = 0;
  await Promise.all(Array.from({length:3},async () => {
    while (cursor < candidates.length && !signal.aborted) await visit(candidates[cursor++],false,signal);
  }));
  signal.throwIfAborted();
  report.phase = 'complete'; publish();
  return report;
}
