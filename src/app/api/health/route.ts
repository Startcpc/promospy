import { NextResponse } from 'next/server';
import { searchHealth } from '@/lib/search-store';
import { APP_VERSION } from '@/lib/app-version';
import { ENGINE_VERSION } from '@/lib/search-config';
export const dynamic='force-dynamic';
export async function GET(){try{await searchHealth();return NextResponse.json({status:'ok',mode:'public-web-search',version:APP_VERSION,engineVersion:ENGINE_VERSION},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({status:'unavailable',version:APP_VERSION,engineVersion:ENGINE_VERSION},{status:503});}}
