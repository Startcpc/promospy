import { PROMO_STATUSES, type PromoCode } from './promocodes';
import type { SearchReport } from './web-search';
const record = (value: unknown): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const validTimestamp = (value: unknown): value is number => finite(value) && value <= 8_640_000_000_000_000;
const strings = (value: unknown, limit: number, length: number): value is string[] => Array.isArray(value) && value.length <= limit && value.every(item => typeof item === 'string' && item.length <= length);
export function validSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { const url = new URL(value);return url.protocol === 'https:' && !url.username && !url.password && !url.hostname.startsWith('[') && !/^(?:\d+\.){3}\d+$/.test(url.hostname) && !/(?:^|\.)localhost(?:\.localdomain)?$/.test(url.hostname); } catch {return false;}
}
/** Disk caches may have been interrupted, edited, or written by an older build. */
export function validPromo(value: unknown, companyId: number): value is PromoCode {
  if (!record(value) || value.companyId !== companyId || typeof value.code !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(value.code)
    || !(value.id === `${companyId}:${value.code}` || typeof value.id === "string" && value.id.startsWith(`${companyId}:${value.code}:`) && /^[a-f0-9]{24}$/.test(value.id.slice(`${companyId}:${value.code}:`.length))) || typeof value.description !== 'string' || value.description.length > 1500
    || typeof value.discount !== 'string' || value.discount.length > 100 || !PROMO_STATUSES.includes(value.status as PromoCode['status'])
    || !validTimestamp(value.found) || !strings(value.conditions,100,1500) || !Array.isArray(value.sources) || value.sources.length > 100) return false;
  if (!value.sources.every(source => record(source) && validSourceUrl(source.url) && typeof source.name === 'string' && source.name.length <= 255 && validTimestamp(source.seenAt))) return false;
  for (const key of ['checked','validUntil','invalidSince','startsAt','expiresAt']) if (value[key] !== undefined && !validTimestamp(value[key])) return false;
  if (value.minOrder !== undefined && !finite(value.minOrder)) return false;
  if (value.maxDiscount !== undefined && !finite(value.maxDiscount)) return false;
  if (value.appOnly !== undefined && typeof value.appOnly !== 'boolean') return false;
  if (value.regions !== undefined && !strings(value.regions,20,200)) return false;
  if (value.categories !== undefined && !strings(value.categories,20,200)) return false;
  if (value.channel !== undefined && !['app','online','in-store'].includes(value.channel as string)) return false;
  if (value.extraction !== undefined && (!record(value.extraction) || !['card','structured','official','local-ai'].includes(value.extraction.method as string) || typeof value.extraction.text!=='string' || value.extraction.text.length>3000)) return false;
  if (value.confidence !== undefined && (!record(value.confidence) || !finite(value.confidence.score) || value.confidence.score>100 || !['low','medium','high'].includes(value.confidence.level as string) || !strings(value.confidence.reasons,10,255))) return false;
  if (value.verificationDetails !== undefined && typeof value.verificationDetails !== 'string') return false;
  if (value.evidence !== undefined) {
    const evidence = value.evidence;
    if (!record(evidence) || !['source','browser'].includes(evidence.method as string) || !validTimestamp(evidence.observedAt) || typeof evidence.message !== 'string') return false;
    for (const key of ['region','accountType','cart']) if (evidence[key] !== undefined && typeof evidence[key] !== 'string') return false;
    if (evidence.sourceUrl !== undefined && !validSourceUrl(evidence.sourceUrl)) return false;
  }
  return true;
}
export function validReport(value: unknown): value is SearchReport {
  if (!record(value) || !Array.isArray(value.codes) || value.codes.length > 100 || !strings(value.visited,100,2048) || !value.visited.every(validSourceUrl) || !strings(value.warnings,100,2000)) return false;
  for (const key of ['targetSites','discoveredSites','pagesRead','pagesFailed']) if (!finite(value[key]) || !Number.isInteger(value[key])) return false;
  if(value.engineVersion!==undefined&&(!finite(value.engineVersion)||!Number.isInteger(value.engineVersion)))return false;
  if (value.phase !== undefined && !['official','sources','complete'].includes(value.phase as string)) return false;
  if (value.parsedUrls !== undefined && (!strings(value.parsedUrls,100,2048) || !value.parsedUrls.every(validSourceUrl))) return false;
  if (value.issues !== undefined && (!Array.isArray(value.issues) || value.issues.length > 100 || !value.issues.every(issue => record(issue) && validSourceUrl(issue.url) && typeof issue.reason === 'string' && issue.reason.length < 2000))) return false;
  if (value.sourceResults !== undefined && (!Array.isArray(value.sourceResults) || value.sourceResults.length > 100 || !value.sourceResults.every(source => record(source) && validSourceUrl(source.url) && typeof source.official === 'boolean' && finite(source.count) && ['codes','empty','index','unrecognized','blocked','error'].includes(source.outcome as string) && (source.message === undefined || typeof source.message === 'string')))) return false;
  for(const key of ['pagesBlocked','parseFailures','officialPagesRead','couponsFound','officialCoupons'])if(value[key]!==undefined&&(!finite(value[key])||!Number.isInteger(value[key])))return false;
  if(Array.isArray(value.sourceResults))for(const source of value.sourceResults){
    if(!record(source))return false;
    for(const key of ['finalUrl','failureUrl'])if(source[key]!==undefined&&!validSourceUrl(source[key]))return false;
    if(source.httpStatus!==undefined&&(!finite(source.httpStatus)||!Number.isInteger(source.httpStatus)||source.httpStatus<100||source.httpStatus>599))return false;
    if(source.attempts!==undefined&&(!finite(source.attempts)||!Number.isInteger(source.attempts)||source.attempts>20))return false;
    if(source.retryAt!==undefined&&!validTimestamp(source.retryAt))return false;
    if(source.errorCode!==undefined&&(typeof source.errorCode!=='string'||source.errorCode.length>64))return false;
    if(source.partial!==undefined&&typeof source.partial!=='boolean')return false;
    if(source.rendering!==undefined&&!['disabled','unavailable','rendered'].includes(source.rendering as string))return false;
  }
  if(value.discovery!==undefined&&(!Array.isArray(value.discovery)||value.discovery.length>30||!value.discovery.every(item=>record(item)&&validSourceUrl(item.url)&&typeof item.provider==='string'&&item.provider.length<=64&&['ok','error','budget'].includes(item.outcome as string)&&finite(item.found)&&(item.message===undefined||typeof item.message==='string'&&item.message.length<=500))))return false;
  if(value.budget!==undefined&&(!record(value.budget)||!['pages','pagesUsed','discoveryRequests','discoveryUsed'].every(key=>finite((value.budget as Record<string,unknown>)[key])&&Number.isInteger((value.budget as Record<string,unknown>)[key]))))return false;
  return true;
}

/** Tracking fragments and slash redirects must not consume separate source slots. */
export function sourceIdentity(value: string) {
  try {
    const url = new URL(value); url.hash = ''; url.hostname = url.hostname.replace(/^www\./,'');
    url.pathname = url.pathname.replace(/\/$/,'') || '/';
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort(); return url.href;
  } catch {return value;}
}
