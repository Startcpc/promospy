import { ENGINE_VERSION } from "../src/lib/search-config";
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('shutdown checkpoints observed results and a new process resumes an interrupted search',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'promospy-checkpoint-'));
  const loader=new URL('../scripts/register-ts.mjs',import.meta.url).href,storeModuleUrl=new URL('../src/lib/search-store.ts',import.meta.url).href;
  const code={id:'54:CHECKPOINT20',companyId:54,code:'CHECKPOINT20',description:'Observed fixture',discount:'20%',status:'official',found:100,checked:100,conditions:[],sources:[{url:'https://vkusvill.ru/promocodes/',name:'vkusvill.ru',seenAt:100}]};
  const report={engineVersion:ENGINE_VERSION,phase:'official',codes:[code],targetSites:30,discoveredSites:1,pagesRead:1,pagesFailed:0,visited:[code.sources[0].url],parsedUrls:[code.sources[0].url],warnings:[],sourceResults:[{url:code.sources[0].url,official:true,outcome:'codes',count:1}]};
  const options={encoding:'utf8' as const,env:{...process.env,PROMO_SEARCH_DATA_DIR:directory},timeout:10000};
  try{
    const first='import {requestSearch,shutdownSearches} from '+JSON.stringify(storeModuleUrl)+';const report='+JSON.stringify(report)+';await requestSearch(54,async(_company,signal,_read,progress)=>{progress(report);await new Promise((_r,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));return report;});await shutdownSearches();';
    execFileSync(process.execPath,['--import',loader,'--input-type=module','-e',first],options);
    const cached=JSON.parse(await readFile(path.join(directory,'54.json'),'utf8'));
    assert.equal(cached.report.codes[0].code,'CHECKPOINT20');assert.equal(cached.report.codes[0].checked,100);assert.equal(cached.report.codes[0].sources[0].seenAt,100);
    assert.ok(await readFile(path.join(directory,'54.pending'),'utf8'));
    const second='import {requestSearch,searchState} from '+JSON.stringify(storeModuleUrl)+';let calls=0;const report='+JSON.stringify({...report,phase:'complete'})+';await requestSearch(54,async()=>{calls++;return report;});for(let i=0;i<100;i++){const state=await searchState(54);if(state.status==="idle")break;await new Promise(r=>setTimeout(r,10));}console.log(calls);';
    assert.equal(execFileSync(process.execPath,['--import',loader,'--input-type=module','-e',second],options).trim(),'1');
  }finally{await rm(directory,{recursive:true,force:true});}
});
