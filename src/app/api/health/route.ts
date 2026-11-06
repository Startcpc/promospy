import { NextResponse } from 'next/server';
import { searchHealth } from '@/lib/search-store';
export const dynamic='force-dynamic';
export async function GET(){try{await searchHealth();return NextResponse.json({status:'ok',mode:'public-web-search'},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({status:'unavailable'},{status:503});}}
