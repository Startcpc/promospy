import { mkdir, rename, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getCompanyById, type PromoCode, type ScanState } from './promocodes';
import { searchMerchant, type SearchReport } from './web-search';
import { sourceIdentity } from './promo-validation';
import { readSearchCache as cached, searchDirectory as directory, MAX_CACHE_BYTES, type CachedSearch } from './search-cache';
export type MerchantSearchState = ScanState & { report?: Omit<SearchReport,'codes'>; notice?: string; serverTime?: number };
type Job = {id: number; execute: typeof searchMerchant; status: 'queued' | 'running'; report?: SearchReport};
const jobs = new Map<number,Job>();
const failures = new Map<number,{message: string; retry: number; report?: SearchReport; storageError?: boolean}>();
let active = 0;
function mergeWithSaved(fresh: PromoCode[], old: PromoCode[]) {
  const codes = new Map(fresh.map(code => [code.id,code]));
  for (const code of old) if (!codes.has(code.id)) codes.set(code.id,code);
  return [...codes.values()].slice(0,100);
}
export async function searchState(id: number): Promise<MerchantSearchState> {
  const result = await cached(id), failure = failures.get(id), job = jobs.get(id);
  const report = job?.report ?? failure?.report ?? result?.report;
  const {codes: _codes,...summary} = report ?? {codes:[]};
  return {
    codes: job?.report ? resultCodes(job.report,result?.report.codes ?? []) : job ? result?.report.codes ?? [] : failure?.storageError && failure.report ? resultCodes(failure.report,result?.report.codes ?? []) : result?.report.codes ?? [],
    status: job?.status ?? (failure ? 'failed' : 'idle'),lastScan:result?.at ?? null,
    serverTime:Date.now(),
    nextScan:failure?.retry ?? (result ? result.at + 15*60000 : null),error:null,log:[],
    ...(report ? {report:summary as Omit<SearchReport,'codes'>} : {}),
    ...(failure ? {notice:failure.storageError ? 'Не удалось сохранить кеш. Результаты доступны до перезапуска сервера.' : result?.report.codes.length ? 'Показываем сохранённые предложения. Новые источники проверим при следующем обновлении.' : failure.report?.pagesRead ? 'Страницы загрузились, но извлечь промокоды не удалось. Можно повторить поиск.' : 'Источники не загрузились. Можно повторить поиск.'} : {}),
  };
}
function resultCodes(report: SearchReport, previous: PromoCode[]) {
  // A failed source cannot erase its last known offers or renew their confirmation.
  const refreshed = new Set((report.parsedUrls ?? report.visited).map(sourceIdentity));
  const retained = previous.flatMap(code => {
    const sources = code.sources.filter(source => !refreshed.has(sourceIdentity(source.url)));
    const officialSource = code.evidence?.sourceUrl;
    const keepsOfficial = code.status === 'official' && officialSource && sources.some(source => sourceIdentity(source.url) === sourceIdentity(officialSource));
    return sources.length ? [{...code,sources,...(!keepsOfficial && code.status !== 'expired' && code.status !== 'rejected' ? {status:'found' as const,verificationDetails:'Сохранено с предыдущего чтения. Свежая публикация не подтверждена.'} : {})}] : [];
  });
  const byId = new Map(retained.map(code => [code.id,code]));
  const fresh = report.codes.map(code => {
    const saved = byId.get(code.id);
    if (!saved) return code;
    const preferred = saved.status === 'official' && code.status !== 'official' ? saved : code;
    const sources = new Map([...preferred.sources,...code.sources,...saved.sources].map(source => [sourceIdentity(source.url),source]));
    return {...preferred,sources:[...sources.values()]};
  });
  return mergeWithSaved(fresh,retained);
}
async function persist(id: number, report: SearchReport) {
  const previous = await cached(id);
  const item: CachedSearch = {companyId:id,at:Date.now(),report:{...report,codes:resultCodes(report,previous?.report.codes ?? [])}};
  await mkdir(directory(),{recursive:true});
  const destination = path.join(directory(),`${id}.json`), temporary = `${destination}.${randomUUID()}.tmp`;
  const data = JSON.stringify(item);
  if (Buffer.byteLength(data,'utf8') > MAX_CACHE_BYTES) throw new Error('Результат превышает размер кеша');
  try { await writeFile(temporary,data,{mode:0o600}); await rename(temporary,destination); }
  finally { await rm(temporary,{force:true}); }
}
function understood(report: SearchReport) {
  return report.pagesRead > 0 && (!report.sourceResults || report.sourceResults.some(source => source.outcome === 'codes' || source.outcome === 'empty'));
}
function drain() {
  for (const job of jobs.values()) {
    if (active >= 2) break;
    if (job.status !== 'queued') continue;
    job.status = 'running'; active++;
    void (async () => {
      let storageError = false;
      try {
        const report = await job.execute(getCompanyById(job.id)!,AbortSignal.timeout(90000),undefined,progress => {job.report = progress;});
        job.report = report;
        if (!understood(report)) {
          failures.set(job.id,{message:report.pagesRead ? 'Не распознана разметка источников' : 'Источники не вернули страницы',retry:Date.now()+60000,report});
        } else {
          try {await persist(job.id,report);}catch(error){storageError=true;throw error;}
          failures.delete(job.id);
        }
      } catch (error) {
        if (!storageError && job.report && understood(job.report)) {
          try {await persist(job.id,job.report);}catch{storageError=true;}
        }
        failures.set(job.id,{message:error instanceof Error ? error.message : 'Ошибка обновления',retry:Date.now()+60000,report:job.report,storageError});
      } finally { jobs.delete(job.id); active--; drain(); }
    })();
  }
}
export async function requestSearch(id: number, execute = searchMerchant, force = false): Promise<MerchantSearchState> {
  if (!getCompanyById(id)) throw new Error('Магазин не найден');
  const state = await searchState(id);
  const oldParserCache = state.status !== 'failed' && state.report && (!state.report.sourceResults || state.report.phase !== 'complete');
  if (jobs.has(id) || !force && !oldParserCache && state.nextScan && state.nextScan > Date.now()) return state;
  failures.delete(id); jobs.set(id,{id,execute,status:'queued'}); drain();
  return {...state,status:jobs.get(id)?.status ?? 'running',error:null,notice:undefined};
}
export async function savedSearchResults(ids: string[]) {
  const companyIds = [...new Set(ids.map(id => Number(id.split(':')[0])).filter(id => getCompanyById(id)))];
  const all = (await Promise.all(companyIds.map(id=>cached(id)))).flatMap(result => result?.report.codes ?? []);
  const byId = new Map(all.map(code => [code.id,code]));
  return {codes:ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []),missingIds:ids.filter(id => !byId.has(id))};
}
export async function searchHealth() {
  await mkdir(directory(),{recursive:true});
  const probe = path.join(directory(),`.health-${randomUUID()}`);
  try { await writeFile(probe,'ok',{mode:0o600}); } finally {await rm(probe,{force:true});}
}
