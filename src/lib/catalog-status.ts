import { effectiveStatus } from './promocodes';
import type { MerchantSearchState } from './search-store';

export type CatalogStatus = {
  state: 'unchecked' | 'updating' | 'ready' | 'empty' | 'partial' | 'failed' | 'saved' | 'unavailable';
  lastSuccess: number | null;
};

export function summarizeCatalogStatus(scan: MerchantSearchState, now = Date.now()): CatalogStatus {
  const lastSuccess = scan.lastScan;
  if (scan.status === 'queued' || scan.status === 'running') return {state: 'updating', lastSuccess};
  if (scan.status === 'failed' || scan.interrupted) return {state: 'failed', lastSuccess};
  if (lastSuccess === null) return {state: 'unchecked', lastSuccess};

  const sources = scan.report?.sourceResults;
  if (!sources?.length) return {state: 'saved', lastSuccess};
  const hasRead = sources.some(source => source.outcome === 'codes' || source.outcome === 'empty');
  if (!hasRead) return {state: 'failed', lastSuccess: null};
  if (scan.report?.phase !== 'complete' || sources.some(source =>
    source.partial || ['blocked', 'skipped', 'error', 'unrecognized'].includes(source.outcome)
  )) return {state: 'partial', lastSuccess};

  const hasActive = scan.codes.some(code => !code.cached && (code.startsAt === undefined || code.startsAt <= now) &&
    ['official', 'verified', 'found'].includes(effectiveStatus(code, now)));
  return {state: hasActive ? 'ready' : 'empty', lastSuccess};
}
