import { NextRequest, NextResponse } from 'next/server';
import { savedSearchResults } from '@/lib/search-store';
import { parseSavedIds } from '@/lib/saved-promos';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const ids=parseSavedIds(request.nextUrl.searchParams.get('ids'));
 if(!ids)return NextResponse.json({error:'Некорректные идентификаторы'},{status:400});
 return NextResponse.json(await savedSearchResults(ids),{headers:{'Cache-Control':'no-store'}});
}
