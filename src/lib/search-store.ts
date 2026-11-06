import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getCompanyById, type PromoCode, type ScanState } from './promocodes';
import { searchMerchant, type SearchReport } from './web-search';
const directory = () => process.env.PROMO_SEARCH_DATA_DIR ?? path.resolve(process.cwd(),'.cache','promo-search');
export type MerchantSearchState = ScanState & { report?: Omit<SearchReport,'codes'>; notice?: string };
type Cached = {companyId: number; at: number; report: SearchReport};
type Job = {id: number; execute: typeof searchMerchant; status: 'queued' | 'running'; report?: SearchReport};
const jobs = new Map<number,Job>();
const failures = new Map<number,{message: string; retry: number; report?: SearchReport}>();
let active = 0;
async function cached(id: number): Promise<Cached | null> {
  try {
    const raw = await readFile(path.join(directory(),`${id}.json`),'utf8');
    if (raw.length > 2_000_000) return null;
    const item = JSON.parse(raw) as Cached;
    return item.companyId === id && Array.isArray(item.report?.codes) && Number.isFinite(item.at) ? item : null;
  } catch { return null; }
}
function mergeWithSaved(fresh: PromoCode[], old: PromoCode[]) {
  return [...new Map([...old,...fresh].map(code => [code.id,code])).values()];
}
export async function searchState(id: number): Promise<MerchantSearchState> {
  const result = await cached(id), failure = failures.get(id), job = jobs.get(id);
  const report = job?.report ?? failure?.report ?? result?.report;
  const {codes: _codes,...summary} = report ?? {codes:[]};
  return {
    codes: job ? mergeWithSaved(job.report?.codes ?? [],result?.report.codes ?? []) : result?.report.codes ?? [],
    status: job?.status ?? (failure ? 'failed' : 'idle'),lastScan:result?.at ?? null,
    nextScan:failure?.retry ?? (result ? result.at + 15*60000 : null),error:null,log:[],
    ...(report ? {report:summary as Omit<SearchReport,'codes'>} : {}),
    ...(failure ? {notice:result ? 'Показываем сохранённые предложения. Новые источники проверим при следующем обновлении.' : 'Свежих предложений пока нет. Посмотрите акции на сайте магазина.'} : {}),
  };
}
async function persist(id: number, report: SearchReport) {
  const previous = await cached(id);
  // A failed source cannot erase its last known offers or renew their confirmation.
  const retained = (previous?.report.codes ?? []).filter(code => code.sources.length && code.sources.every(source => !report.visited.includes(source.url)))
    .map(code => ({...code,status:code.status === 'expired' ? 'expired' as const : 'found' as const}));
  const item: Cached = {companyId:id,at:Date.now(),report:{...report,codes:mergeWithSaved(report.codes,retained)}};
  await mkdir(directory(),{recursive:true});
  const destination = path.join(directory(),`${id}.json`), temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(item),{mode:0o600}); await rename(temporary,destination);
}
function drain() {
  for (const job of jobs.values()) {
    if (active >= 2) break;
    if (job.status !== 'queued') continue;
    job.status = 'running'; active++;
    void (async () => {
      try {
        const report = await job.execute(getCompanyById(job.id)!,AbortSignal.timeout(90000),undefined,progress => {job.report = progress;});
        if (!report.pagesRead) {
          failures.set(job.id,{message:'Источники не вернули страницы',retry:Date.now()+60000,report});
        } else { await persist(job.id,report); failures.delete(job.id); }
      } catch (error) {
        if (job.report?.pagesRead) await persist(job.id,job.report).catch(() => {});
        failures.set(job.id,{message:error instanceof Error ? error.message : 'Ошибка обновления',retry:Date.now()+60000,report:job.report});
      } finally { jobs.delete(job.id); active--; drain(); }
    })();
  }
}
export async function requestSearch(id: number, execute = searchMerchant, force = false): Promise<MerchantSearchState> {
  if (!getCompanyById(id)) throw new Error('Магазин не найден');
  const state = await searchState(id);
  if (jobs.has(id) || !force && state.nextScan && state.nextScan > Date.now()) return state;
  failures.delete(id); jobs.set(id,{id,execute,status:'queued'}); drain();
  return {...state,status:jobs.get(id)?.status ?? 'running',error:null,notice:undefined};
}
export async function savedSearchResults(ids: string[]) {
  const companyIds = [...new Set(ids.map(id => Number(id.split(':')[0])).filter(id => getCompanyById(id)))];
  const all = (await Promise.all(companyIds.map(cached))).flatMap(result => result?.report.codes ?? []);
  const byId = new Map(all.map(code => [code.id,code]));
  return {codes:ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []),missingIds:ids.filter(id => !byId.has(id))};
}
export async function searchHealth() { await mkdir(directory(),{recursive:true}); }
