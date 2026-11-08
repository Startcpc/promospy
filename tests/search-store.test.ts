import { ENGINE_VERSION } from "../src/lib/search-config";
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {requestSearch,searchState,savedSearchResults} from '../src/lib/search-store';
const dir=mkdtempSync(path.join(tmpdir(),'promo-cache-')),old=process.env.PROMO_SEARCH_DATA_DIR;
process.env.PROMO_SEARCH_DATA_DIR=dir;
after(()=>{if(old===undefined)delete process.env.PROMO_SEARCH_DATA_DIR;else process.env.PROMO_SEARCH_DATA_DIR=old;rmSync(dir,{recursive:true,force:true});});
const report={engineVersion:ENGINE_VERSION,phase:'complete' as const,codes:[],targetSites:30,discoveredSites:1,pagesRead:1,pagesFailed:0,visited:['https://vkusvill.ru/'],warnings:[],sourceResults:[{url:'https://vkusvill.ru/',official:true,outcome:'empty' as const,count:0}]};
async function settle(id:number){for(let i=0;i<200;i++){const state=await searchState(id);if(state.status!=='running'&&state.status!=='queued')return state;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('job did not finish');}
test('search is deduplicated, cached and subject to a shared cooldown',async()=>{
 let calls=0;const execute=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,50));return report;};
 await Promise.all([requestSearch(54,execute),requestSearch(54,execute)]);assert.equal(calls,1);
 assert.equal((await settle(54)).status,'idle');assert.equal((await requestSearch(54,execute)).status,'idle');assert.equal(calls,1);
});
test('failed refresh retains the last successfully read data',async()=>{
 const data=JSON.parse(readFileSync(path.join(dir,'54.json'),'utf8'));data.at=Date.now()-16*60000;writeFileSync(path.join(dir,'54.json'),JSON.stringify(data));
 await requestSearch(54,async()=>{throw Error('network unavailable');});const state=await settle(54);assert.equal(state.status,'failed');assert.equal(state.lastScan,data.at);assert.equal(state.error,null);assert.match(state.notice!,/Источники/);
});
test('missing saved offers are explicit and do not require a database',async()=>{
 assert.deepEqual(await savedSearchResults(['54:UNKNOWN']),{codes:[],missingIds:['54:UNKNOWN']});
});
test('manual refresh bypasses the automatic cache interval',async()=>{
 let calls=0;await requestSearch(201,async()=>{calls++;return report;});await settle(201);
 await requestSearch(201,async()=>{calls++;return report;});assert.equal(calls,1);
 await requestSearch(201,async()=>{calls++;return report;},true);await settle(201);assert.equal(calls,2);
});
test('busy searches queue automatically instead of rejecting clicks',async()=>{
 let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});let active=0,max=0;
 const execute=async()=>{active++;max=Math.max(max,active);await gate;active--;return report;};
 await requestSearch(302,execute);await requestSearch(5,execute);
 assert.equal((await requestSearch(102,execute)).status,'queued');
 assert.equal((await searchState(102)).error,null);finish();await Promise.all([settle(302),settle(5),settle(102)]);assert.equal(max,2);
});
test('partial progress is visible before the search finishes',async()=>{
 let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});
 await requestSearch(202,async(_company,_signal,_read,progress)=>{progress?.({...report,phase:'official'});await gate;return report;});
 const state=await searchState(202);assert.equal(state.status,'running');assert.equal(state.report?.phase,'official');assert.equal(state.report?.pagesRead,1);
 finish();await settle(202);
});
test('zero readable pages preserve cache and expose a neutral retry state',async()=>{
 const before=(await searchState(201)).lastScan;
 await requestSearch(201,async()=>({...report,pagesRead:0,pagesFailed:4,visited:[]}),true);
 const state=await settle(201);assert.equal(state.lastScan,before);assert.equal(state.status,'failed');assert.equal(state.error,null);assert.ok(state.notice);
});
test('fresh empty cache from the old parser cannot suppress a new search',async()=>{
 const id=203;writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at:Date.now(),report:{...report,sourceResults:undefined}}));
 let calls=0;await requestSearch(id,async()=>{calls++;return report;});await settle(id);assert.equal(calls,1);
});
test('upgrading the engine refreshes a current cache without waiting for its TTL',async()=>{
 const id=203;writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at:Date.now(),report:{...report,engineVersion:ENGINE_VERSION-1}}));
 let calls=0;await requestSearch(id,async()=>{calls++;return report;});await settle(id);assert.equal(calls,1);
});
test('unrecognized markup keeps prior offers and does not renew a successful timestamp',async()=>{
 const id=204,at=Date.now()-100000;
 const code={id:'204:KNOWN',companyId:id,code:'KNOWN',description:'Previously read offer',discount:'10%',status:'found',sources:[{url:'https://market.yandex.ru/',name:'market.yandex.ru',seenAt:at}],conditions:[],found:at};
 writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at,report:{...report,codes:[code]}}));
 await requestSearch(id,async()=>({...report,codes:[],visited:['https://market.yandex.ru/'],parsedUrls:[],sourceResults:[{url:'https://market.yandex.ru/',official:true,outcome:'unrecognized',count:0}]}),true);
 const state=await settle(id);assert.equal(state.status,'failed');assert.equal(state.codes[0].code,'KNOWN');assert.equal(state.lastScan,at);
});
test('a trailing slash cannot resurrect an offer removed from a successfully parsed source',async()=>{
 const id=205,source='https://www.perekrestok.ru/offers';
 const code={id:'205:OLD',companyId:id,code:'OLD',description:'Old offer',discount:'10%',status:'found',sources:[{url:source,name:'perekrestok.ru',seenAt:1}],conditions:[],found:1};
 writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at:1,report:{...report,codes:[code]}}));
 await requestSearch(id,async()=>({...report,codes:[],visited:[source+'/'],parsedUrls:[source+'/'],sourceResults:[{url:source+'/',official:true,outcome:'empty',count:0}]}),true);
 assert.deepEqual((await settle(id)).codes,[]);
});
test('aborted progress containing only index pages cannot renew a successful cache',async()=>{
 const before=(await searchState(201)).lastScan;
 await requestSearch(201,async(_company,_signal,_read,progress)=>{
  progress?.({...report,sourceResults:[{url:'https://magnit.ru/',official:true,outcome:'index',count:0}],parsedUrls:[]});
  throw Error('aborted after index');
 },true);
 const state=await settle(201);assert.equal(state.status,'failed');assert.equal(state.lastScan,before);
});
test('malformed offers in a disk cache are excluded before reaching the UI',async()=>{
 writeFileSync(path.join(dir,'207.json'),JSON.stringify({companyId:207,at:Date.now(),report:{...report,codes:[null,'bad',{id:'207:X',code:'X'}]}}));
 assert.deepEqual((await searchState(207)).codes,[]);
});
test('fresh offers take priority and retained offers cannot grow the cache without a bound',async()=>{
 const id=208,at=Date.now()-100000;
 const offer=(prefix:string,i:number)=>({id:`208:${prefix}${i}`,companyId:id,code:`${prefix}${i}`,description:'Offer',discount:'10%',status:'found' as const,conditions:[],found:at,sources:[{url:`https://ozon.ru/${prefix}`,name:'ozon.ru',seenAt:at}]});
 writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at,report:{...report,codes:Array.from({length:100},(_,i)=>offer('OLD',i))}}));
 await requestSearch(id,async()=>({...report,codes:Array.from({length:100},(_,i)=>offer('NEW',i))}),true);
 const state=await settle(id);assert.equal(state.codes.length,100);assert.ok(state.codes.every(code=>code.code.startsWith('NEW')));
});
test('health probe detects a non-writable cache directory',async()=>{
 const {chmodSync}=await import('node:fs');const {searchHealth}=await import('../src/lib/search-store');
 if(process.platform==='win32'||process.getuid?.()===0)return;
 chmodSync(dir,0o500);
 try {await assert.rejects(searchHealth());}finally{chmodSync(dir,0o700);}
});
test('a partial result left by a restart does not block the next automatic update',async()=>{
 writeFileSync(path.join(dir,'301.json'),JSON.stringify({companyId:301,at:Date.now(),report:{...report,phase:'official'}}));
 let calls=0;await requestSearch(301,async()=>{calls++;return report;});await settle(301);assert.equal(calls,1);
});
test('cycle 1: another failed source retains its last offer after the first source removes it',async()=>{
 const id=206,sourceA='https://lenta.com/promo/',sourceB='https://promokodi.ru/store/lenta/';
 const code={id:'206:MULTI',companyId:206,code:'MULTI',description:'Last observed offer',discount:'10%',status:'official',conditions:[],found:1,sources:[{url:sourceA,name:'lenta.com',seenAt:1},{url:sourceB,name:'promokodi.ru',seenAt:1}]};
 writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at:1,report:{...report,codes:[code]}}));
 await requestSearch(id,async()=>({...report,visited:[sourceA],parsedUrls:[sourceA],sourceResults:[{url:sourceA,official:true,outcome:'empty',count:0},{url:sourceB,official:false,outcome:'error',count:0}]}),true);
 const state=await settle(id);assert.equal(state.codes[0]?.code,'MULTI');assert.equal(state.codes[0].status,'found');assert.deepEqual(state.codes[0].sources.map(source=>source.url),[sourceB]);
});
test('cycle 1: partially corrupt cache does not block refresh for fifteen minutes',async()=>{
 const id=302;const code={id:'302:GOOD',companyId:id,code:'GOOD',description:'Offer',discount:'10%',status:'found',conditions:[],found:1,sources:[{url:'https://www.kartoshka.com/actions/',name:'kartoshka.com',seenAt:1}]};
 writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at:Date.now(),report:{...report,codes:[code,null]}}));
 let calls=0;await requestSearch(id,async()=>{calls++;return report;});await settle(id);assert.equal(calls,1);
});
test('cycle 5: a cache write error does not discard freshly found coupons from the UI',async()=>{
 const {chmodSync}=await import('node:fs');
 if(process.platform==='win32'||process.getuid?.()===0)return;
 const id=54,before=(await searchState(id)).lastScan,now=Date.now();
 const code={id:'54:VOLATILE',companyId:id,code:'VOLATILE',description:'Fresh source result',discount:'10%',status:'found' as const,conditions:[],found:now,sources:[{url:'https://vkusvill.ru/promocodes/',name:'vkusvill.ru',seenAt:now}]};
 chmodSync(dir,0o500);
 try {
  await requestSearch(id,async()=>({...report,codes:[code],sourceResults:[{url:code.sources[0].url,official:true,outcome:'codes',count:1}]}),true);
  const state=await settle(id);assert.equal(state.status,'failed');assert.equal(state.codes[0]?.code,'VOLATILE');assert.equal(state.lastScan,before);assert.match(state.notice!,/сохранить кеш/);
 }finally{chmodSync(dir,0o700);}
});


test('unreadable official source keeps its last confirmation and conditions when another source updates',async()=>{
 const id=54,source='https://vkusvill.ru/promocodes/',other='https://promokodi.ru/store/vkusvill/';
 const code={id:'54:CONFIRMED',companyId:id,code:'CONFIRMED',description:'Official conditions',discount:'10%',status:'official' as const,checked:100,conditions:['Order from 1000'],found:100,sources:[{url:source,name:'vkusvill.ru',seenAt:100}],evidence:{method:'source' as const,observedAt:100,sourceUrl:source,message:'Official publication'}};
 writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at:100,report:{...report,codes:[code]}}));
 const fresh={...code,status:'found' as const,description:'Other terms',checked:undefined,evidence:undefined,sources:[{url:other,name:'promokodi.ru',seenAt:200}]};
 await requestSearch(id,async()=>({...report,codes:[fresh],visited:[other],parsedUrls:[other],sourceResults:[{url:source,official:true,outcome:'error',count:0},{url:other,official:false,outcome:'codes',count:1}]}),true);
 const state=await settle(id);assert.equal(state.codes[0].status,'official');assert.equal(state.codes[0].checked,100);assert.equal(state.codes[0].description,'Official conditions');assert.equal(state.codes[0].sources.length,2);
});
test('unrepresentable timestamps are filtered from disk before rendering',async()=>{
 const id=201,code={id:'201:BADDATE',companyId:id,code:'BADDATE',description:'Offer',discount:'10%',status:'found',conditions:[],found:1,startsAt:Number.MAX_VALUE,sources:[]};
 writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({companyId:id,at:Date.now(),report:{...report,codes:[code]}}));
 assert.deepEqual((await searchState(id)).codes,[]);
});

test('completion between cache and status reads cannot return idle with the pre-refresh offers',async()=>{
 const fs=await import('node:fs/promises'),{syncBuiltinESMExports}=await import('node:module');
 const original=fs.default.readFile,id=208,file=path.join(dir,'208.json');
 const offer=(code:string)=>({id:'208:'+code,companyId:id,code,description:'Race fixture',discount:'10%',status:'found' as const,conditions:[],found:100,sources:[{url:'https://ozon.ru/race',name:'ozon.ru',seenAt:100}]});
 writeFileSync(file,JSON.stringify({companyId:id,at:100,report:{...report,codes:[offer('BEFORE')]} }));
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await requestSearch(id,async()=>{await gate;return {...report,codes:[offer('AFTER')]};},true);
 let captured=false;
 fs.default.readFile=(async(...args:Parameters<typeof original>)=>{
  const value=await original(...args);
  if(String(args[0])===file&&!captured){captured=true;release();await settle(id);}
  return value;
 }) as typeof original;
 syncBuiltinESMExports();
 try{const state=await searchState(id);assert.equal(state.status,'idle');assert.equal(state.codes[0]?.code,'AFTER');}
 finally{release();fs.default.readFile=original;syncBuiltinESMExports();await settle(id);}
});
