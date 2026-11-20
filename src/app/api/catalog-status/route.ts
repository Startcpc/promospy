import { summarizeCatalogStatus, type CatalogStatus } from '@/lib/catalog-status';
import { companies } from '@/lib/companies';
import { searchState } from '@/lib/search-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const entries = await Promise.all(companies.map(async ({id}): Promise<[number, CatalogStatus]> => {
    try {
      return [id, summarizeCatalogStatus(await searchState(id))];
    } catch {
      return [id, {state: 'unavailable', lastSuccess: null}];
    }
  }));
  return Response.json({stores: Object.fromEntries(entries)}, {headers: {'Cache-Control': 'no-store'}});
}
