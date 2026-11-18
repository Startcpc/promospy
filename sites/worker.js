import assets from 'site-assets';
import { getCompanyById } from '../src/lib/promocodes';
import { parseSavedIds } from '../src/lib/saved-promos';
import { scan } from './search';

function json(value,status=200) { return Response.json(value,{status,headers:{'Cache-Control':'no-store'}}); }
function asset(path,status=200) {
  const item=assets[path];
  return new Response(Uint8Array.from(atob(item.data),chr=>chr.charCodeAt(0)),{status,headers:{'Content-Type':item.mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}
// At most one public snapshot per registered shop. An isolate can be evicted.
const latest = new Map();
function cached(id) {
  const state=latest.get(id);
  return state && state.serverTime+3600000>Date.now() ? state : undefined;
}
const idle=()=>({status:'idle',codes:[],report:undefined,lastScan:null,nextScan:null,serverTime:Date.now(),error:null,log:[]});

const worker={async fetch(request) {
  const url=new URL(request.url), path=url.pathname;
  const id=Number(/^\/api\/scan\/(\d+)$/.exec(path)?.[1]);
  if (path.startsWith('/api/scan/')) {
    const company=getCompanyById(id);
    if(!company)return json({error:'Магазин не найден'},404);
    if(request.method==='GET') {
      const old=cached(id);
      return json(old?{...old,serverTime:Date.now()}:idle());
    }
    if(request.method!=='POST')return json({error:'Метод не поддерживается'},405);
    if(request.headers.get('Origin') && request.headers.get('Origin')!==url.origin)return json({error:'Недопустимый источник запроса'},403);
    const old=cached(id);
    if(old && old.serverTime+30000>Date.now())return json({...old,serverTime:Date.now()});
    const state=await scan(company);
    latest.set(id,state);
    return json(state);
  }
  if(request.method!=='GET' && request.method!=='HEAD')return json({error:'Метод не поддерживается'},405);
  if(path==='/api/promocodes/saved') {
    const ids=parseSavedIds(url.searchParams.get('ids'));
    if(!ids)return json({error:'Некорректные идентификаторы'},400);
    const states=[...new Set(ids.map(id=>Number(id.split(':')[0])))].map(cached);
    const codes=states.flatMap(state=>state?.codes??[]).filter(code=>ids.includes(code.id));
    return json({codes,missingIds:ids.filter(id=>!codes.some(code=>code.id===id))});
  }
  if(path==='/api/health')return json({ok:true,version:'0.17.0'});
  if(Object.hasOwn(assets,path))return asset(path);
  const merchant=getCompanyById(Number(/^\/company\/(\d+)\/?$/.exec(path)?.[1]));
  return asset('/index.html',path==='/'||path==='/saved'||merchant?200:404);
}};

export default worker;
