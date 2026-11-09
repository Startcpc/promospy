import { mkdir, rename, writeFile, readFile, rm } from 'node:fs/promises';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getCompanyById, type PromoCode, type ScanState } from './promocodes';
import { searchMerchant, type SearchReport } from './web-search';
import { sourceIdentity } from './promo-validation';
import { readSearchCache as cached, searchDirectory as directory, MAX_CACHE_BYTES, parseSearchCache, type CachedSearch } from './search-cache';
import { mergeOffers } from './offer-identity';
import { offerConflict } from './promo-quality';
import { searchConfig, ENGINE_VERSION } from './search-config';
import { publicHttp } from './public-http';
import { browserReader } from './browser-reader';
import { closeSourceDispatchers } from './fetch-policy';
export type MerchantSearchState = ScanState & { report?: Omit<SearchReport,'codes'>; notice?: string; serverTime?: number };
type Job = {id:number;execute:typeof searchMerchant;status:'queued'|'running';report?:SearchReport;controller:AbortController;previousUrls:string[]};
type Failure={message:string;retry:number;report?:SearchReport;storageError?:boolean};
type Runtime={jobs:Map<number,Job>;failures:Map<number,Failure>;revisions:Map<number,number>;active:number;stopping:boolean;tasks:Set<Promise<void>>};
const runtimeKey=Symbol.for('promospy.search.runtime');
const globals=globalThis as typeof globalThis & {[runtimeKey]?:Runtime};
const runtime=globals[runtimeKey]??{jobs:new Map<number,Job>(),failures:new Map<number,Failure>(),revisions:new Map<number,number>(),active:0,stopping:false,tasks:new Set<Promise<void>>()};
runtime.revisions??=new Map<number,number>();
globals[runtimeKey]=runtime;
const {jobs,failures,revisions}=runtime;
const markerPath=(id:number)=>path.join(directory(),String(id)+'.pending');
async function marker(id:number):Promise<{retry?:number}|null>{
  try{const raw=await readFile(markerPath(id),'utf8');if(raw.length>1000)return null;const data=JSON.parse(raw);return data&&typeof data==='object'?{retry:Number.isFinite(data.retry)&&data.retry>Date.now()&&data.retry<Date.now()+86400000?data.retry:undefined}:null;}catch{return null;}
}
async function writeMarker(id:number,retry?:number){
  const target=markerPath(id),temporary=target+'.'+randomUUID()+'.tmp';
  try{await mkdir(directory(),{recursive:true});await writeFile(temporary,JSON.stringify({requestedAt:Date.now(),...(retry?{retry}:{})}),{mode:0o600});await rename(temporary,target);}catch{}finally{await rm(temporary,{force:true}).catch(()=>{});}
}
function mergeWithSaved(fresh: PromoCode[], old: PromoCode[]) {
  return mergeOffers([...fresh,...old]).slice(0,100);
}
export async function searchState(id: number): Promise<MerchantSearchState> {
  if (!getCompanyById(id)) throw new Error('Магазин не найден');
  for(let attempt=0;attempt<5;attempt++){
    const revision=revisions.get(id)??0;
    const result=await cached(id),interrupted=await marker(id);
    // A job may finish while the old cache is being read. Its idle status must
    // never be paired with that pre-refresh snapshot.
    if(revision!==(revisions.get(id)??0))continue;
    const job=jobs.get(id);
    const failure:Failure|undefined=failures.get(id)??(interrupted?.retry?{message:'Предыдущий поиск не завершился',retry:interrupted.retry}:undefined);
    const report=job?.report??failure?.report??(interrupted&&!failure&&result?{...result.report,phase:undefined}:result?.report);
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
  throw new Error('Состояние поиска меняется. Повторите запрос.');
}
function resultCodes(report: SearchReport, previous: PromoCode[]) {
  // A failed source cannot erase its last known offers or renew their confirmation.
  const refreshed = new Set((report.parsedUrls ?? report.visited).map(sourceIdentity));
  const retained = previous.flatMap(code => {
    const sources = code.sources.filter(source => !refreshed.has(sourceIdentity(source.url)));
    const officialSource = code.evidence?.sourceUrl;
    const keepsOfficial = code.status === 'official' && officialSource && sources.some(source => sourceIdentity(source.url) === sourceIdentity(officialSource));
    return sources.length ? [{...code,sources,cached:true,...(!keepsOfficial && code.status !== 'expired' && code.status !== 'rejected' ? {status:'found' as const,verificationDetails:'Сохранено с предыдущего чтения. Свежая публикация не подтверждена.'} : {})}] : [];
  });
  const byId = new Map(retained.map(code => [code.id,code]));
  const fresh = report.codes.filter(code => code.companyId === 54).map(code => {
    code = {...code,cached:false};
    const original=previous.find(old=>old.code===code.code&&!offerConflict(old,code));
    if(original)code={...code,found:Math.min(code.found,original.found)};
    const saved = byId.get(code.id);
    if (!saved) return code;
    if (offerConflict(saved,code)) return code;
    const preferred = saved.status === 'official' && code.status !== 'official' ? saved : code;
    const sources = new Map(preferred.sources.map(source => [sourceIdentity(source.url),source]));
    for (const source of [...code.sources,...saved.sources]) {
      const key = sourceIdentity(source.url), previousSource = sources.get(key);
      if (!previousSource || source.seenAt > previousSource.seenAt) sources.set(key,source);
    }
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
    if (runtime.stopping || runtime.active >= 2) break;
    if (job.status !== 'queued') continue;
    job.status = 'running'; runtime.active++;
    const task=(async () => {
      let storageError = false;
      try {
        const report = await job.execute(getCompanyById(job.id)!,AbortSignal.any([job.controller.signal,AbortSignal.timeout(searchConfig().timeoutMs)]),undefined,progress => {job.report = progress;},{previousUrls:job.previousUrls});
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
      } finally {
        const failure=failures.get(job.id);
        if(!runtime.stopping){if(failure)await writeMarker(job.id,failure.retry);else await rm(markerPath(job.id),{force:true}).catch(()=>{});}
        revisions.set(job.id,(revisions.get(job.id)??0)+1);jobs.delete(job.id);runtime.active--;drain();
      }
    })();
    runtime.tasks.add(task);void task.finally(()=>runtime.tasks.delete(task));
  }
}
export async function requestSearch(id: number, execute = searchMerchant, force = false): Promise<MerchantSearchState> {
  if (!getCompanyById(id)) throw new Error('Магазин не найден');
  if(runtime.stopping)throw new Error('Сервер останавливается');
  const state = await searchState(id);
  const oldParserCache = state.status !== 'failed' && state.report && (!state.report.sourceResults || state.report.phase !== 'complete' || state.report.engineVersion!==ENGINE_VERSION);
  if(jobs.has(id))return searchState(id);
  if (!force && !oldParserCache && state.nextScan && state.nextScan > Date.now()) return state;
  failures.delete(id);jobs.set(id,{id,execute,status:'queued',controller:new AbortController(),previousUrls:[...new Set([...state.codes.flatMap(code=>code.sources.map(source=>source.url)),...state.report?.visited??[]])].slice(0,16)});
  revisions.set(id,(revisions.get(id)??0)+1);
  await writeMarker(id);drain();
  return {...state,status:jobs.get(id)?.status ?? 'running',error:null,notice:undefined};
}
export async function savedSearchResults(ids: string[]) {
  const companyIds = [...new Set(ids.map(id => Number(id.split(':')[0])).filter(id => getCompanyById(id)))];
  const all = (await Promise.all(companyIds.map(id=>cached(id)))).flatMap(result => result?.report.codes ?? []);
  const byId = new Map(all.map(code => [code.id,code]));
  const found=new Map<string,PromoCode>(),missingIds:string[]=[];
  for(const id of ids){
    const exact=byId.get(id);
    if(exact){found.set(exact.id,exact);continue;}
    const base=id.split(':').slice(0,2).join(':'),candidates=all.filter(code=>String(code.companyId)+':'+code.code===base);
    if(candidates.length===1)found.set(candidates[0].id,candidates[0]);else missingIds.push(id);
  }
  return {codes:[...found.values()],missingIds};
}
export async function searchHealth() {
  await mkdir(directory(),{recursive:true});
  const probe = path.join(directory(),`.health-${randomUUID()}`);
  try { await writeFile(probe,'ok',{mode:0o600}); } finally {await rm(probe,{force:true});}
}

/** Called synchronously before Next.js closes the HTTP server. */
export function checkpointSearches(){
  runtime.stopping=true;
  for(const job of jobs.values()){
    if(job.report&&understood(job.report)){
      let temporary:string|undefined;
      try{
        let previous:CachedSearch|null=null;try{previous=parseSearchCache(readFileSync(path.join(directory(),String(job.id)+'.json'),'utf8'),job.id);}catch{}
        const data=JSON.stringify({companyId:job.id,at:Date.now(),report:{...job.report,codes:resultCodes(job.report,previous?.report.codes??[])}});
        if(Buffer.byteLength(data,'utf8')<=MAX_CACHE_BYTES){
          mkdirSync(directory(),{recursive:true});const target=path.join(directory(),String(job.id)+'.json');temporary=target+'.'+randomUUID()+'.tmp';
          writeFileSync(temporary,data,{mode:0o600});renameSync(temporary,target);temporary=undefined;
        }
      }catch{}finally{if(temporary)try{rmSync(temporary,{force:true});}catch{}}
    }
    job.controller.abort(new Error('Поиск остановлен вместе с сервером'));
  }
}
export async function shutdownSearches(){
  checkpointSearches();publicHttp.cancel();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([Promise.allSettled([...runtime.tasks,browserReader.close(),closeSourceDispatchers()]),new Promise(resolve=>{timer=setTimeout(resolve,2000);})]);}
  finally{clearTimeout(timer);}
}
Object.defineProperty(globalThis,Symbol.for('promospy.search.checkpoint'),{value:()=>{void shutdownSearches();},configurable:true});
