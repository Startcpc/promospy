// Production-container checks. --live performs real public reads, never checkout.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const args=process.argv.slice(2),live=args.includes('--live');
if(args.some(arg=>arg.startsWith('--')&&arg!=='--live')||args.filter(arg=>!arg.startsWith('--')).length>1)throw Error('Usage: node scripts/test-container.mjs [http://localhost:3000] [--live]');
const base=new URL(args.find(arg=>!arg.startsWith('--'))??'http://127.0.0.1:3000');
const expectedVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const request=(path,options={})=>fetch(new URL(path,base),{...options,signal:AbortSignal.timeout(15000)});
const health=await request('/api/health');assert.equal(health.status,200);
const identity=await health.json();assert.equal(identity.status,'ok');assert.equal(identity.version,expectedVersion);
const home=await request('/');assert.equal(home.status,200);assert.match(await home.text(),/ВкусВилл/);
const page=await request('/company/54');assert.equal(page.status,200);
const html=await page.text();assert.ok(!/<article(?:\s|>)/i.test(html),'Search page must be empty before clicking Refresh');
assert.ok(!html.includes('Результаты получены:'));assert.ok(!html.includes('promokodus.com'));
for(const id of [201,999])for(const method of ['GET','POST'])assert.equal((await request('/api/scan/'+id,{method})).status,404);
assert.equal((await request('/api/scan/54',{method:'POST',headers:{Origin:'https://unrelated.example'}})).status,403);
console.log(JSON.stringify({version:identity.version,health:'ok',emptyBeforeClick:true,unsupportedMerchants:'404',foreignOrigin:'403'}));
if(live){
 const started=await request('/api/scan/54?refresh=1&fresh=1',{method:'POST'});assert.ok([200,202].includes(started.status));
 let state=await started.json();const deadline=Date.now()+120000;
 while(['running','queued'].includes(state.status)&&Date.now()<deadline){
  await new Promise(resolve=>setTimeout(resolve,750));
  const response=await request('/api/scan/54?fresh=1');assert.ok([200,202].includes(response.status));state=await response.json();
 }
 assert.equal(state.status,'idle',state.notice??'Live search did not complete');
 const now=Date.now(),active=state.codes.filter(code=>!['expired','rejected'].includes(code.status)&&(code.expiresAt===undefined||code.expiresAt>now)&&(code.startsAt===undefined||code.startsAt<=now));
 assert.ok(active.length>0,'No non-expired public offers found; inspect source results and network access');
 assert.ok(state.codes.every(code=>code.companyId===54&&!code.cached));
 assert.equal(state.nextScan-state.lastScan,300000);
 console.log(JSON.stringify({live:true,pagesRead:state.report?.pagesRead,active:active.length,total:state.codes.length,refreshIntervalMs:state.nextScan-state.lastScan,sources:state.report?.sourceResults},null,2));
}
