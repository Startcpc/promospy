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
 await requestSearch(54,async()=>{throw Error('network unavailable');});const state=await settle(54);assert.equal(state.status,'failed');assert.equal(state.lastScan,data.at);assert.match(state.error!,/network/);
});
test('missing saved offers are explicit and do not require a database',async()=>{
 assert.deepEqual(await savedSearchResults(['54:UNKNOWN']),{codes:[],missingIds:['54:UNKNOWN']});
});
