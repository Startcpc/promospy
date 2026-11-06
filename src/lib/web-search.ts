import { createRequire } from 'node:module';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as http from 'node:http';
import type { Company } from './companies';
import type { PromoCode } from './promocodes';
import { parsePromoCodesFromHtml } from './promo-parser';
import { parsePublicOfficial, PUBLIC_OFFICIAL_URLS } from './official-search';
const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');

// Respect server proxy/CA settings; direct fetch otherwise ignores HTTPS_PROXY.
if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();
else if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  const { EnvHttpProxyAgent, setGlobalDispatcher } = createRequire(import.meta.url)('undici') as typeof import('undici');
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
export const SEARCH_DOMAINS = ['promokod.pikabu.ru','promokodi.ru','promokodus.com','promkod.ru','promokod.vbr.ru','berikod.ru','promokod.ru','pepper.ru','skidkidor.ru','kupon.ru','biglion.ru','gilmon.ru','kuponator.ru','kuponation.ru','picodi.com','megabonus.com','backit.me','letyshops.com','kp.ru','aif.ru','banki.ru','sravni.ru','t-j.ru','dtf.ru','vc.ru','ixbt.com','otzovik.com','irecommend.ru','zen.yandex.ru'];
export type SearchReport = {
  codes: PromoCode[]; targetSites: number; discoveredSites: number;
  pagesRead: number; pagesFailed: number; visited: string[]; warnings: string[];
  phase?: 'official' | 'sources' | 'complete'; officialPagesRead?: number;
  issues?: { url: string; reason: string }[];
};
export type SearchProgress = (report: SearchReport) => void;
function host(value: string) { return new URL(value).hostname.replace(/^www\./, ''); }
export function safeSource(value: string, domains: string[]): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !isIP(u.hostname) && domains.includes(host(value));
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
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  for (let hop = 0; hop < 4; hop++) {
    if (!safeSource(url, domains)) throw new Error('Адрес вне списка источников');
    bounded.throwIfAborted();
    // A configured proxy resolves the allowlisted destination itself. Local DNS
    // is often intentionally absent in proxy-only environments; never bypass it.
    if (!routedThroughProxy(url)) {
    const records = await new Promise<{address: string; family: number}[]>((resolve,reject) => {
      const abort = () => reject(bounded.reason);
      bounded.addEventListener('abort',abort,{once:true});
      lookup(new URL(url).hostname,{all:true,family:4}).then(resolve,reject).finally(() => bounded.removeEventListener('abort',abort));
    });
    if (!records.length || records.some(record => privateAddress(record.address))) throw new Error('Непубличный адрес');
    }
    const response = await fetch(url,{redirect:'manual',signal:bounded,headers:{'User-Agent':'PromoSpy/0.8 public coupon search','Accept':'text/html,application/rss+xml,application/xml','Accept-Language':'ru-RU'}});
    if ([301,302,303,307,308].includes(response.status)) {
      const target = response.headers.get('location'); await response.body?.cancel();
      if (!target) throw new Error('Перенаправление без адреса');
      const next = new URL(target,url).href;
      if (!safeSource(next,domains)) throw new Error('Перенаправление вне списка источников');
      url = next; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    if (!/text\/html|xml/i.test(response.headers.get('content-type') ?? '')) { await response.body?.cancel(); throw new Error('Ответ не HTML/XML'); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('Пустой ответ');
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const {done,value} = await reader.read(); if (done) break;
        bytes += value.length; if (bytes > 2_000_000) throw new Error('Страница превышает лимит размера');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('Слишком много перенаправлений');
}
export function parseDiscovery(xml: string, domains: string[]): string[] {
  const $ = load(xml,{xmlMode:true});
  return [...new Set($('item > link').map((_,el) => $(el).text().trim()).get().filter(url => safeSource(url,domains)))];
}
export function parseMerchantPage(html: string, url: string, company: Company, now = Date.now()): PromoCode[] {
  const $ = load(html); $('script[type!="application/ld+json"],style,noscript').remove();
  const heading = $('title,h1').text().toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]/gu,'');
  const aliases = [company.name,...company.keywords].map(name => name.toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]/gu,''));
  if (host(url) !== host(company.website) && !aliases.some(alias => alias.length >= 4 && heading.includes(alias))) return [];
  const result = parsePromoCodesFromHtml(html,url,company.id,now);
  $('article,.coupon,.promocode,[data-coupon],[data-offer]').each((_,el) => {
    const card = $(el); if (card.find('article,.coupon,.promocode,[data-coupon],[data-offer]').length) return;
    card.find('p,h2,h3,li,div').append(' '); card.find('br').replaceWith(' ');
    const content = card.text().replace(/\s+/g,' ').trim();
    const match = content.match(/(?:промокод|код купона)\s*[:：]\s*([\p{L}\p{N}][\p{L}\p{N}_-]{1,63})(?![\p{L}\p{N}_-])/iu);
    if (!match) return;
    result.push(...parsePromoCodesFromHtml(JSON.stringify([{promoCode:match[1],title:card.find('h2,h3').first().text() || `Промокод ${company.name}`,conditions:[content.slice(0,1000)]}]),url,company.id,now));
  });
  return result.map(code => ({...code,status:code.status === 'expired' ? 'expired' : 'found',checked:undefined,evidence:undefined,validUntil:undefined,verificationDetails:'Найдено в открытом источнике. Применение не проверялось.'}));
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
  const report: SearchReport = {codes:[],targetSites:30,discoveredSites:0,pagesRead:0,pagesFailed:0,visited:[],warnings:[],issues:[],phase:'official',officialPagesRead:0};
  const attempted = new Set<string>();
  const publish = () => {
    report.codes = mergeCodes(report.codes,company.id);
    report.discoveredSites = new Set([...attempted].map(host)).size;
    onProgress?.(structuredClone(report));
  };
  const visit = async (url: string, official: boolean, stageSignal: AbortSignal): Promise<string | null> => {
    if (attempted.has(url)) return null;
    attempted.add(url);
    try {
      const html = await read(url,official ? officialDomains : domains,stageSignal);
      if (/captcha|cf-chl-|проверка браузера|подтвердите.{0,25}не робот/i.test(html.slice(0,15000))) throw new Error('Сайт запросил проверку браузера');
      report.pagesRead++; report.visited.push(url);
      if (official) report.officialPagesRead!++;
      let codes: PromoCode[];
      try {
        if (!official || url !== PUBLIC_OFFICIAL_URLS[company.id]) throw new Error('generic');
        codes = parsePublicOfficial(company.id,html);
      } catch { codes = parseMerchantPage(html,url,company); }
      if (official) codes = codes.map(code => ({...code,status:code.status === 'expired' ? 'expired' : 'official',checked:Date.now(),verificationDetails:'Опубликован на официальном сайте. Применение не проверялось.',evidence:{method:'source',observedAt:Date.now(),sourceUrl:url,message:'Официальная публикация'}}));
      report.codes.push(...codes); publish(); return html;
    } catch (error) {
      report.pagesFailed++;
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
  const known = [`https://promokod.pikabu.ru/shops/${slug}`,`https://promokodi.ru/store/${slug}`,`https://promokodus.com/campaigns/${slug}`];
  // Known pages start immediately; RSS discovery cannot hold them up.
  const knownJob = Promise.all(known.map(url => visit(url,false,signal)));
  const discovered = new Set<string>(); let discoveryCursor = 0, discoveryFailures = 0;
  await Promise.all(Array.from({length:3},async () => {
    while (discoveryCursor < SEARCH_DOMAINS.length && !signal.aborted) {
      const i = discoveryCursor; discoveryCursor += 5;
      const query = `"${company.name}" промокод (${SEARCH_DOMAINS.slice(i,i+5).map(domain => `site:${domain}`).join(' OR ')})`;
      try {
        const xml = await read(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`,['bing.com'],signal);
        for (const url of parseDiscovery(xml,SEARCH_DOMAINS)) discovered.add(url);
      } catch { discoveryFailures++; }
    }
  }));
  await knownJob;
  if (discoveryFailures) report.warnings.push(`Не получена поисковая выдача для ${discoveryFailures} групп; прямые адреса проверены отдельно.`);
  const candidates = [...discovered].filter(url => !attempted.has(url)).slice(0,Math.max(0,30-attempted.size));
  let cursor = 0;
  await Promise.all(Array.from({length:3},async () => {
    while (cursor < candidates.length && !signal.aborted) await visit(candidates[cursor++],false,signal);
  }));
  signal.throwIfAborted();
  report.phase = 'complete'; publish();
  return report;
}
