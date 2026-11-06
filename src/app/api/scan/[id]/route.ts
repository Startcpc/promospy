import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/promocodes';
import { allowedRequestOrigin, configuredPublicOrigin } from '@/lib/request-origin';
import { searchState, requestSearch } from '@/lib/search-store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
async function handle(request:NextRequest,context:Context,search:boolean){
 const {id}=await context.params;
 if(!/^\d+$/.test(id)||!getCompanyById(Number(id)))return NextResponse.json({error:'Магазин не найден'},{status:404});
 if(search&&!allowedRequestOrigin(request.headers.get('origin'),request.url,request.headers.get('host'),configuredPublicOrigin()))return NextResponse.json({error:'Недопустимый источник запроса'},{status:403});
 try {
  const result=await (search?requestSearch(Number(id),undefined,request.nextUrl.searchParams.get("refresh") === "1"):searchState(Number(id)));
  return NextResponse.json(result,{status:result.status==='running'||result.status==='queued'?202:200,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Поиск временно недоступен'},{status:503});}
}
export async function GET(request:NextRequest,context:Context){return handle(request,context,false);}
export async function POST(request:NextRequest,context:Context){return handle(request,context,true);}
