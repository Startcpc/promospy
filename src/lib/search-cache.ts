import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getCompanyById } from './promocodes';
import type { SearchReport } from './web-search';
import { validPromo, validReport } from './promo-validation';
import { mergeOffers } from './offer-identity';

export const MAX_CACHE_BYTES = 2_000_000;
export type CachedSearch = {companyId: number; at: number; report: SearchReport};
export const searchDirectory = () => process.env.PROMO_SEARCH_DATA_DIR ?? path.resolve(process.cwd(),'.cache','promo-search');

export function parseSearchCache(raw: string, id: number, now = Date.now()): CachedSearch | null {
  if (Buffer.byteLength(raw,'utf8') > MAX_CACHE_BYTES || !getCompanyById(id)) return null;
  try {
    const item = JSON.parse(raw) as CachedSearch;
    if (!item || item.companyId !== id || !validReport(item.report) || !Number.isFinite(item.at) || item.at < 0 || item.at > now + 60000) return null;
    const valid = item.report.codes.filter(code => validPromo(code,id)).flatMap(code=>{
      if((item.report.engineVersion??0)>=8||code.extraction?.method!=='card')return [code];
      // Earlier parsers could read a masked child's text through its parent on
      // this catalogue. Quarantine that evidence without deleting the old file
      // or discarding independently retrieved sources of the same offer.
      const sources=code.sources.filter(source=>new URL(source.url).hostname.replace(/^www\./,'')!=='promokodi.ru');
      return sources.length===code.sources.length?[code]:sources.length?[{...code,sources,cached:true}]:[];
    });
    const duplicateIds = new Set(valid.map(code=>code.id)).size < valid.length;
    const codes = duplicateIds ? mergeOffers(valid) : valid;
    if (item.report.codes.length && !codes.length) return null;
    return {...item,report:{...item.report,codes,...(duplicateIds || codes.length !== item.report.codes.length ? {phase:undefined} : {})}};
  } catch {return null;}
}
export async function readSearchCache(id: number, directory = searchDirectory()): Promise<CachedSearch | null> {
  if (!getCompanyById(id)) return null;
  try {
    const filename=path.join(directory,`${id}.json`),info=await stat(filename);
    if(!info.isFile()||info.size>MAX_CACHE_BYTES)return null;
    return parseSearchCache(await readFile(filename,'utf8'),id);
  } catch {return null;}
}
