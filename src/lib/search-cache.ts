import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getCompanyById } from './promocodes';
import type { SearchReport } from './web-search';
import { validPromo, validReport } from './promo-validation';

export const MAX_CACHE_BYTES = 2_000_000;
export type CachedSearch = {companyId: number; at: number; report: SearchReport};
export const searchDirectory = () => process.env.PROMO_SEARCH_DATA_DIR ?? path.resolve(process.cwd(),'.cache','promo-search');

export function parseSearchCache(raw: string, id: number, now = Date.now()): CachedSearch | null {
  if (Buffer.byteLength(raw,'utf8') > MAX_CACHE_BYTES || !getCompanyById(id)) return null;
  try {
    const item = JSON.parse(raw) as CachedSearch;
    if (!item || item.companyId !== id || !validReport(item.report) || !Number.isFinite(item.at) || item.at < 0 || item.at > now + 60000) return null;
    const codes = item.report.codes.filter(code => validPromo(code,id));
    if (item.report.codes.length && !codes.length) return null;
    return {...item,report:{...item.report,codes,...(codes.length !== item.report.codes.length ? {phase:undefined} : {})}};
  } catch {return null;}
}
export async function readSearchCache(id: number, directory = searchDirectory()): Promise<CachedSearch | null> {
  try {return parseSearchCache(await readFile(path.join(directory,`${id}.json`),'utf8'),id);} catch {return null;}
}
