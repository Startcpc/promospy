import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getCompanyById, type ScanState } from './promocodes';
import { searchMerchant, type SearchReport } from './web-search';
const directory=()=>process.env.PROMO_SEARCH_DATA_DIR ?? path.resolve(process.cwd(),'.cache','promo-search');
const running=new Set<number>();
const failures=new Map<number,{message:string;retry:number}>();
export type MerchantSearchState=ScanState & { report?: Omit<SearchReport,'codes'> };
type Cached={companyId:number;at:number;report:SearchReport};
async function cached(id:number):Promise<Cached|null>{
 try {const raw=await readFile(path.join(directory(),`${id}.json`),'utf8');if(raw.length>2_000_000)return null;const item=JSON.parse(raw) as Cached;return item.companyId===id&&Array.isArray(item.report?.codes)&&Number.isFinite(item.at)?item:null;}catch{return null;}
}
export async function searchState(id:number):Promise<MerchantSearchState>{
 const result=await cached(id),failure=failures.get(id);
 return {codes:result?.report.codes??[],status:running.has(id)?'running':failure?'failed':'idle',lastScan:result?.at??null,
  nextScan:failure?.retry??(result?result.at+15*60000:null),error:failure?.message??null,log:[],
  ...(result?{report: { targetSites:result.report.targetSites,discoveredSites:result.report.discoveredSites,pagesRead:result.report.pagesRead,pagesFailed:result.report.pagesFailed,visited:result.report.visited,warnings:result.report.warnings }}:{}),
 };
}
export async function requestSearch(id:number,execute=searchMerchant):Promise<MerchantSearchState>{
 const company=getCompanyById(id);if(!company)throw new Error('Магазин не найден');
 const state=await searchState(id);
 if(running.has(id)||state.nextScan&&state.nextScan>Date.now())return state;
 if(running.size>=2)return {...state,error:'Сейчас ищем для других магазинов. Повторите чуть позже.'};
 running.add(id);failures.delete(id);
 void (async()=>{
  try {
   const report=await execute(company,AbortSignal.timeout(135000));
   const item:Cached={companyId:id,at:Date.now(),report};await mkdir(directory(),{recursive:true});
   const destination=path.join(directory(),`${id}.json`),temporary=`${destination}.${randomUUID()}.tmp`;
   await writeFile(temporary,JSON.stringify(item),{mode:0o600});await rename(temporary,destination);
  }catch(error){failures.set(id,{message:error instanceof Error?error.message:'Не удалось выполнить поиск',retry:Date.now()+60000});}
  finally{running.delete(id);}
 })();
 return {...state,status:'running',error:null};
}
export async function savedSearchResults(ids:string[]){
 const companyIds=[...new Set(ids.map(id=>Number(id.split(':')[0])).filter(id=>getCompanyById(id)))];
 const all=(await Promise.all(companyIds.map(cached))).flatMap(result=>result?.report.codes??[]);
 const byId=new Map(all.map(code=>[code.id,code]));
 return {codes:ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]),missingIds:ids.filter(id=>!byId.has(id))};
}
export async function searchHealth(){await mkdir(directory(),{recursive:true});}
