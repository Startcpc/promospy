// Real browser clicks, real source requests, then closed tabs and GET-only observation.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const base=new URL(process.argv[2]??'http://127.0.0.1:3000').origin;
const requested=process.argv.slice(3);
const ids=requested.length ? [...new Set(requested.map(Number))] : [54,201,209,210,211,212];
assert.ok(ids.every(id=>Number.isSafeInteger(id)&&id>0),'Use numeric store IDs');
const output='work/live-refresh-verification.json';
mkdirSync('work',{recursive:true});
const result={startedAt:new Date().toISOString(),base,initial:[],automatic:[]};
const save=()=>writeFileSync(output,JSON.stringify(result,null,2));
const state=async id=>{const response=await fetch(`${base}/api/scan/${id}?fresh=1`);assert.ok(response.ok);return response.json();};
const summary=(id,data)=>({id,lastScan:data.lastScan,nextScan:data.nextScan,status:data.status,pagesRead:data.report?.pagesRead,official:data.codes.filter(code=>code.status==='official').map(({code,conditions,minOrder,sources})=>({code,conditions,minOrder,sources})),sources:data.report?.sourceResults});
const browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
try{
  for(const id of ids){
    const page=await browser.newPage();await page.goto(`${base}/company/${id}`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('article').count(),0);
    await page.getByRole('button',{name:'Обновить',exact:true}).click();
    await page.locator('article').first().waitFor({timeout:110000});
    await page.getByRole('button',{name:'Обновить',exact:true}).waitFor({timeout:110000});
    const data=await state(id);assert.equal(data.status,'idle');
    const item=summary(id,data);assert.ok(item.official.length>0);assert.ok(item.pagesRead>0);
    result.initial.push(item);save();
    await page.screenshot({path:`work/live-store-${id}.png`,fullPage:true});
    console.log(JSON.stringify({phase:'initial',id,lastScan:item.lastScan,official:item.official.map(x=>x.code)}));
    await page.close();
  }
}finally{await browser.close();}
result.tabsClosedAt=new Date().toISOString();save();
const deadline=Date.now()+420000;
while(result.automatic.length<ids.length&&Date.now()<deadline){
  for(const id of ids.filter(id=>!result.automatic.some(item=>item.id===id))){
    const data=await state(id),before=result.initial.find(item=>item.id===id);
    if(data.status==='idle'&&data.lastScan>before.lastScan){
      const item=summary(id,data);assert.ok(item.official.length>0);assert.ok(item.pagesRead>0);
      assert.ok(item.lastScan-before.lastScan>=300000);
      result.automatic.push(item);save();console.log(JSON.stringify({phase:'automatic',id,lastScan:item.lastScan,official:item.official.map(x=>x.code)}));
    }
  }
  if(result.automatic.length<ids.length)await new Promise(resolve=>setTimeout(resolve,5000));
}
assert.equal(result.automatic.length,ids.length,'All selected stores must refresh with no open tabs or repeated POST');
result.completedAt=new Date().toISOString();save();console.log('Verified real automatic refresh for all selected stores');
