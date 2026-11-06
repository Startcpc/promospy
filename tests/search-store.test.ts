import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {requestSearch,searchState,savedSearchResults} from '../src/lib/search-store';
const dir=mkdtempSync(path.join(tmpdir(),'promo-cache-')),old=process.env.PROMO_SEARCH_DATA_DIR;
process.env.PROMO_SEARCH_DATA_DIR=dir;
after(()=>{if(old===undefined)delete process.env.PROMO_SEARCH_DATA_DIR;else process.env.PROMO_SEARCH_DATA_DIR=old;rmSync(dir,{recursive:true,force:true});});
const report={codes:[],targetSites:30,discoveredSites:1,pagesRead:1,pagesFailed:0,visited:['https://vkusvill.ru/'],warnings:[]};
async function settle(id:number){for(let i=0;i<200;i++){const state=await searchState(id);if(state.status!=='running')return state;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('job did not finish');}
test('search is deduplicated, cached and subject to a shared cooldown',async()=>{
 let calls=0;const execute=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,50));return report;};
 await Promise.all([requestSearch(54,execute),requestSearch(54,execute)]);assert.equal(calls,1);
 assert.equal((await settle(54)).status,'idle');assert.equal((await requestSearch(54,execute)).status,'idle');assert.equal(calls,1);
});
test('failed refresh retains the last successfully read data',async()=>{
 const data=JSON.parse(readFileSync(path.join(dir,'54.json'),'utf8'));data.at=Date.now()-16*60000;writeFileSync(path.join(dir,'54.json'),JSON.stringify(data));
 await requestSearch(54,async()=>{throw Error('network unavailable');});const state=await settle(54);assert.equal(state.status,'failed');assert.equal(state.lastScan,data.at);assert.equal(state.error,null);assert.match(state.notice!,/сохранённые/);
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
