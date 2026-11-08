import { ENGINE_VERSION } from "../src/lib/search-config";
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { parseMerchantPage } from '../src/lib/web-search';
import { getCompanyById } from '../src/lib/promocodes';
const networkPreload=new URL('./helpers/official-network.mjs',import.meta.url).href;

test('home makes no scans; native links and favorites work without Prisma, keys or carts',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-web-'));
 const code=parseMerchantPage('<title>ВкусВилл</title><article><h3>Первый заказ</h3><p>Промокод: SAVE10</p></article>','https://promokodi.ru/store/vkusvill',getCompanyById(54)!)[0];
 code.id='54:SAVE10';
 writeFileSync(path.join(directory,'54.json'),JSON.stringify({companyId:54,at:Date.now(),report:{engineVersion:ENGINE_VERSION,phase:'complete',codes:[code],targetSites:30,discoveredSites:2,pagesRead:3,pagesFailed:1,visited:[code.sources[0].url],warnings:[],sourceResults:[{url:code.sources[0].url,official:false,outcome:'codes',count:1}]}}));
 const base='http://127.0.0.1:3127';
 const server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,PORT:'3127',HOSTNAME:'127.0.0.1',PROMO_SEARCH_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);
 let browser;
 try{
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,logs);
  const health=await(await fetch(base+'/api/health')).json();assert.equal(health.mode,'public-web-search');
  assert.equal((await fetch(base+'/api/promocodes')).status,410);
  const saved=await(await fetch(base+'/api/promocodes/saved?ids=54%3ASAVE10')).json();assert.equal(saved.codes[0].code,'SAVE10');
  browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage();
  const errors:string[]=[],api:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/api/'))api.push(request.url());});
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(api.length,0);assert.equal(await page.locator('article').count(),0);
  assert.equal(await page.getByLabel('Поиск предложений',{exact:true}).count(),0);
  const merchant=page.getByRole('link',{name:'Промокоды ВкусВилл',exact:true});await merchant.hover();assert.equal(await merchant.evaluate(el=>getComputedStyle(el).transform),'none');await merchant.click();
  await page.getByRole('button',{name:'Сохранить SAVE10',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Обновить',exact:true}).isEnabled(),true);
  assert.equal(await page.getByText(/Повтор через/).count(),0);
  await page.getByRole('button',{name:'Сохранить SAVE10',exact:true}).click();
  await page.getByRole('link',{name:'Избранное (1)',exact:true}).click();
  await page.waitForURL(base+'/saved');
  await page.getByRole('button',{name:'Условия SAVE10',exact:true}).waitFor();await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Условия SAVE10',exact:true}).waitFor();
  await page.getByLabel('Без истёкших').check();assert.equal(await page.locator('article').count(),1);
  await page.route('**/api/promocodes/saved?**',route=>route.fulfill({json:{codes:[],missingIds:[code.id]}}));
  await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  await page.getByText('Сохранённая копия — без подтверждения актуальности.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Условия SAVE10',exact:true}).click();assert.match(await page.locator('article').innerText(),/Первый заказ/);
  await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'Удалить из избранного SAVE10',exact:true}).click();await page.getByText('Пока нет сохранённых кодов',{exact:true}).waitFor();
  // Opening a merchant starts one automatic search; manual refresh remains immediate.
  let posts=0;
  await page.route('**/api/scan/201*',route=>{
   if(route.request().method()==='POST')posts++;
   return route.fulfill({json:{codes:[],status:'idle',lastScan:null,nextScan:null,error:null,log:[]}});
  });
  await page.goto(base+'/company/201',{waitUntil:'networkidle'});assert.equal(posts,1);
  assert.equal(await page.getByText(/Нажмите.*Найти промокоды/).count(),0);
  await page.getByRole('button',{name:'Обновить',exact:true}).click();assert.equal(posts,2);
  assert.deepEqual(errors,[]);
  // Bundled logos paint with JavaScript disabled, without letter placeholders.
  const native=await browser.newContext({javaScriptEnabled:false});const nativePage=await native.newPage();
  await nativePage.goto(base,{waitUntil:'networkidle'});
  const logos=nativePage.locator('img[src^="/logos/"]');assert.equal(await logos.count(),12);
  assert.ok(await logos.evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0&&getComputedStyle(img).opacity==='1')));await native.close();
  const blocked=await browser.newContext();await blocked.addInitScript(()=>{const original=Storage.prototype.setItem;Object.defineProperty(window,'restorePromoStorage',{value:()=>{Storage.prototype.setItem=original;}});Storage.prototype.setItem=()=>{throw Error('storage disabled');};});
  const blockedPage=await blocked.newPage();await blockedPage.goto(base+'/company/54',{waitUntil:'networkidle'});
  await blockedPage.getByRole('button',{name:'Сохранить SAVE10',exact:true}).click();
  await blockedPage.getByRole('button',{name:'Удалить из избранного SAVE10',exact:true}).waitFor();
  await blockedPage.getByRole('alert').filter({hasText:'до перезагрузки или закрытия этой вкладки'}).waitFor();
  await blockedPage.getByRole('link',{name:'Избранное (1)',exact:true}).click();await blockedPage.waitForURL(base+'/saved');await blockedPage.getByRole('button',{name:'Условия SAVE10',exact:true}).waitFor();
  await blockedPage.evaluate(()=>Reflect.get(window,'restorePromoStorage')());
  await blockedPage.getByRole('button',{name:'Удалить из избранного SAVE10',exact:true}).click();
  await blockedPage.getByText('Пока нет сохранённых кодов',{exact:true}).waitFor();
  const secondTab=await blocked.newPage();await secondTab.goto(base);
  await secondTab.evaluate(()=>{Reflect.get(window,'restorePromoStorage')();localStorage.setItem('promospy:saved-promos:v1',JSON.stringify([{id:'54:SAVE10',companyId:54,code:'SAVE10',savedAt:Date.now()}]));});
  await blockedPage.getByRole('button',{name:'Условия SAVE10',exact:true}).waitFor();
  await secondTab.close();
  // Unicode IDs must not produce an oversized GET URL.
  const batches=await browser.newContext();
  await batches.addInitScript(()=>{localStorage.setItem('promospy:saved-promos:v1',JSON.stringify(Array.from({length:100},(_,i)=>({id:`54:A${i}${'Ж'.repeat(55)}`,companyId:54,code:`A${i}${'Ж'.repeat(55)}`,savedAt:Date.now()}))));});
  const batchPage=await batches.newPage(),lookups:string[]=[];
  batchPage.on('request',request=>{if(request.url().includes('/api/promocodes/saved?'))lookups.push(request.url());});
  await batchPage.goto(base+'/saved');
  await batchPage.getByRole('heading',{name:'Избранное (100)',exact:true}).waitFor();
  await batchPage.getByRole('button',{name:'Обновить данные',exact:true}).waitFor({state:'visible'});
  for(let i=0;i<100&&await batchPage.getByRole('button',{name:'Обновить данные',exact:true}).isDisabled();i++)await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(lookups.length>1);assert.ok(lookups.every(url=>url.length<2150));assert.equal(await batchPage.locator('article').count(),100);
  // One failed batch must cancel peers rather than leave requests hanging.
  let requests=0,cancelled=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  batchPage.on('requestfailed',request=>{if(request.url().includes('/api/promocodes/saved?'))cancelled++;});
  await batchPage.route('**/api/promocodes/saved?**',async route=>{
   if(++requests===1){await new Promise(resolve=>setTimeout(resolve,100));await route.fulfill({status:503,json:{error:'Batch source failed'}});}
   else {await gate;await route.fulfill({json:{codes:[],missingIds:[]}}).catch(()=>{});}
  });
  try {
   await batchPage.getByRole('button',{name:'Обновить данные',exact:true}).click();
   await batchPage.getByRole('alert').filter({hasText:'Batch source failed'}).waitFor();
   for(let i=0;i<50&&!cancelled;i++)await new Promise(resolve=>setTimeout(resolve,20));
   assert.ok(requests>1);assert.ok(cancelled>0,'failed grouped requests must cancel their unfinished peers');
   assert.equal(await batchPage.locator('article').count(),100);
  }finally{release();}
  await batches.close();
  await page.goto(base+'/company/unknown');
  await page.getByRole('heading',{name:'Страница не найдена',exact:true}).waitFor();
  assert.equal(await page.locator('meta[name="robots"][content="noindex"]').count()>0,true);
  assert.equal((await fetch(base+'/api/scan/54',{method:'POST',headers:{Origin:'https://unrelated.example'}})).status,403);
  await blocked.close();await context.close();
 }finally{await browser?.close();server.kill();}
});

test('empty cache -> automatic search -> official cards; refresh fetches sources again',async()=>{
 const {readFileSync}=await import('node:fs');
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-official-ui-'));
 const requestLog=path.join(directory,'requests.txt');
 const base='http://127.0.0.1:3138';
 const server=spawn(process.execPath,['--import',networkPreload,'scripts/start.mjs'],{
  env:{...process.env,PORT:'3138',HOSTNAME:'127.0.0.1',PROMO_SEARCH_DATA_DIR:directory,PROMO_TEST_REQUEST_LOG:requestLog},stdio:['ignore','pipe','pipe'],
 });
 let logs='';server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);
 let browser;
 try {
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,250));}
  assert.ok(ready,logs);
  browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage();
  await page.goto(base+'/company/54');
  await page.getByRole('button',{name:'Сохранить 1раз',exact:true}).waitFor();
  assert.ok((await page.locator('article').innerText()).includes('На официальном сайте'));
  assert.equal(await page.getByLabel('Без истёкших').isChecked(),true);
  const before=readFileSync(requestLog,'utf8').split('\n').filter(url=>url==='https://vkusvill.ru/promocodes/').length;
  await page.getByRole('button',{name:'Обновить',exact:true}).click();
  await page.waitForFunction(()=>!!document.querySelector('button[aria-label="Сохранить 1раз"]'));
  for(let i=0;i<100;i++){
   if(readFileSync(requestLog,'utf8').split('\n').filter(url=>url==='https://vkusvill.ru/promocodes/').length>before)break;
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  assert.ok(readFileSync(requestLog,'utf8').split('\n').filter(url=>url==='https://vkusvill.ru/promocodes/').length>before);
  const state=await(await fetch(base+'/api/scan/54')).json();
  assert.ok(state.codes.some((code:{code:string})=>code.code==='1раз'));
  assert.ok(state.report.sourceResults.some((source:{outcome:string})=>source.outcome==='codes'));
  assert.equal(await page.getByText('В прочитанных источниках открытые промокоды не найдены.',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Условия 1раз',exact:true}).click();
  await page.getByRole('link',{name:'vkusvill.ru',exact:true}).waitFor();
 } finally {await browser?.close();server.kill();}
});

test('cycle 3: clipboard feedback follows the latest click and its timer restarts',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-copy-ui-')),base='http://127.0.0.1:3139';
 const server=spawn(process.execPath,['--import',networkPreload,'scripts/start.mjs'],{env:{...process.env,PORT:'3139',HOSTNAME:'127.0.0.1',PROMO_SEARCH_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);let browser;
 try {
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,logs);
  browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage();await page.goto(base+'/company/54');
  const copy=page.getByRole('button',{name:'Скопировать 1раз',exact:true});await copy.waitFor();
  await page.evaluate(()=>{
   let calls=0;
   Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>{
    if(++calls===1)return new Promise((_resolve,reject)=>Reflect.set(window,'rejectOldCopy',()=>reject(Error('old permission failure'))));
    return Promise.resolve();
   }}});
  });
  await copy.click();await copy.click();await page.getByText('Код скопирован',{exact:true}).waitFor();
  await page.evaluate(()=>Reflect.get(window,'rejectOldCopy')());
  await page.waitForTimeout(50);assert.equal(await page.getByText('Не удалось скопировать. Выделите код вручную.',{exact:true}).count(),0);
  await page.waitForTimeout(1300);await copy.click();await page.waitForTimeout(1000);
  assert.equal(await page.getByText('Код скопирован',{exact:true}).isVisible(),true);
  await page.getByText('Код скопирован',{exact:true}).waitFor({state:'hidden'});
 } finally {await browser?.close();server.kill();}
});


test('open merchant renews an expired cache and retries a failed manual refresh with force',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-renew-ui-')),base='http://127.0.0.1:3140';
 const server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,PORT:'3140',HOSTNAME:'127.0.0.1',PROMO_SEARCH_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);let browser;
 try {
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,logs);
  browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date()});
  let posts=0;const deadline=Date.now()+10000;
  await page.route('**/api/scan/201*',route=>{
   if(route.request().method()==='POST')posts++;
   return route.fulfill({json:{codes:[],status:'idle',lastScan:deadline-900000,nextScan:posts>1?deadline+900000:deadline,error:null,log:[]}});
  });
  await page.goto(base+'/company/201',{waitUntil:'networkidle'});assert.equal(posts,1);
  await page.clock.fastForward(31000);await page.waitForTimeout(100);
  assert.equal(posts,2,'an open page must initiate a new search after its cache expires');
  let attempts=0;const retryUrls:string[]=[];
  await page.unroute('**/api/scan/201*');
  await page.route('**/api/scan/201*',route=>{
   if(route.request().method()==='POST'){retryUrls.push(route.request().url());if(++attempts===1)return route.fulfill({status:503,json:{error:'Temporary API failure'}});}
   return route.fulfill({json:{codes:[],status:'idle',lastScan:deadline,nextScan:deadline+900000,error:null,log:[]}});
  });
  await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.getByText('Temporary API failure',{exact:false}).waitFor({state:'attached'});
  await page.clock.fastForward(3100);await page.waitForTimeout(100);
  assert.equal(attempts,2);assert.ok(retryUrls.every(url=>new URL(url).searchParams.get('refresh')==='1'));
  // A wrong wall clock must not turn a fifteen-minute TTL into a POST loop.
  await page.unroute('**/api/scan/201*');posts=0;
  const serverTime=Date.now();
  await page.route('**/api/scan/201*',route=>{
   if(route.request().method()==='POST')posts++;
   return route.fulfill({json:{codes:[],status:'idle',lastScan:serverTime,nextScan:serverTime+900000,serverTime,error:null,log:[]}});
  });
  await page.clock.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  await page.goto(base+'/company/201',{waitUntil:'networkidle'});assert.equal(posts,1);
  await page.clock.fastForward(31000);await page.waitForTimeout(100);assert.equal(posts,1);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill();}
});


test('search and favorites work without recent browser AbortSignal helpers',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-legacy-browser-')),base='http://127.0.0.1:3141';
 const server=spawn(process.execPath,['--import',networkPreload,'scripts/start.mjs'],{env:{...process.env,PORT:'3141',HOSTNAME:'127.0.0.1',PROMO_SEARCH_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);let browser;
 try {
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,logs);
  browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   Object.defineProperties(AbortSignal,{any:{value:undefined,configurable:true},timeout:{value:undefined,configurable:true}});
   Object.defineProperty(AbortSignal.prototype,'throwIfAborted',{value:undefined,configurable:true});
  });
  await page.goto(base+'/company/54');
  await page.getByRole('button',{name:'Сохранить 1раз',exact:true}).waitFor({timeout:5000});
  await page.getByRole('button',{name:'Сохранить 1раз',exact:true}).click();
  await page.getByRole('link',{name:'Избранное (1)',exact:true}).click();
  await page.getByRole('button',{name:'Условия 1раз',exact:true}).waitFor({timeout:5000});
  await page.getByText(/^Обновлено:/).waitFor({timeout:5000});assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill();}
});


test('favorites transfer survives reload and invalid files; hidden and offline pages pause requests',async()=>{
 const {readFileSync}=await import('node:fs');
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-transfer-ui-')),base='http://127.0.0.1:3142';
 const server=spawn(process.execPath,['--import',networkPreload,'scripts/start.mjs'],{env:{...process.env,PORT:'3142',HOSTNAME:'127.0.0.1',PROMO_SEARCH_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);let browser;
 try {
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,logs);
  browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
  const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const requests:string[]=[];page.on('request',request=>{if(request.url().includes('/api/'))requests.push(request.url());});
  await page.clock.install({time:new Date()});await page.goto(base+'/company/54');
  await page.getByRole('button',{name:'Сохранить 1раз',exact:true}).waitFor();
  await page.getByRole('button',{name:'Сохранить 1раз',exact:true}).click();await page.getByRole('link',{name:'Избранное (1)',exact:true}).click();
  await page.getByText(/^Обновлено:/).waitFor();await page.getByText('Перенос избранного',{exact:true}).click();
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать файл',exact:true}).click();
  const download=await downloaded;assert.match(download.suggestedFilename(),/^promospy-favorites-/);
  const raw=readFileSync((await download.path())!,'utf8'),file={name:'favorites.json',mimeType:'application/json',buffer:Buffer.from(raw)};
  const contents=JSON.parse(raw);assert.equal(contents.items[0].code,'1раз');assert.equal(contents.items[0].snapshot.status,'found');
  await page.getByRole('button',{name:'Удалить из избранного 1раз',exact:true}).click();await page.getByText('Пока нет сохранённых кодов',{exact:true}).waitFor();
  await page.getByLabel('Файл избранного',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"other"}')});
  await page.getByRole('alert').filter({hasText:'Неизвестный формат'}).waitFor();assert.equal(await page.locator('article').count(),0);
  await page.getByLabel('Файл избранного',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Условия 1раз',exact:true}).waitFor();
  await page.getByText('Добавлено кодов: 1. Существующие сохранены.',{exact:true}).waitFor();
  await page.getByLabel('Файл избранного',{exact:true}).setInputFiles(file);await page.getByText('Все коды уже есть в избранном.',{exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Условия 1раз',exact:true}).waitFor();await page.getByText(/^Обновлено:/).waitFor();
  await page.evaluate(()=>{Reflect.set(window,'promoHidden',false);Object.defineProperty(document,'hidden',{configurable:true,get:()=>Reflect.get(window,'promoHidden')===true});});
  const hide=()=>page.evaluate(()=>{Reflect.set(window,'promoHidden',true);document.dispatchEvent(new Event('visibilitychange'));});
  const reveal=()=>page.evaluate(()=>{Reflect.set(window,'promoHidden',false);document.dispatchEvent(new Event('visibilitychange'));});
  await hide();let before=requests.length;await page.clock.fastForward(90000);await page.waitForTimeout(50);assert.equal(requests.length,before);
  let resumed=page.waitForResponse(response=>response.url().includes('/api/promocodes/saved?'));await reveal();await resumed;
  await context.setOffline(true);await page.getByText(/Нет подключения. Сохранённые копии доступны/).waitFor();
  before=requests.length;await page.clock.fastForward(90000);await page.waitForTimeout(50);assert.equal(requests.length,before);assert.equal(await page.locator('article').count(),1);
  resumed=page.waitForResponse(response=>response.url().includes('/api/promocodes/saved?'));await context.setOffline(false);await resumed;
  await page.goto(base+'/company/54');await page.getByRole('button',{name:'Удалить из избранного 1раз',exact:true}).waitFor();
  await page.evaluate(()=>{Reflect.set(window,'promoHidden',false);Object.defineProperty(document,'hidden',{configurable:true,get:()=>Reflect.get(window,'promoHidden')===true});});
  await hide();before=requests.length;await page.clock.fastForward(90000);await page.waitForTimeout(50);assert.equal(requests.length,before);
  resumed=page.waitForResponse(response=>response.url().includes('/api/scan/54'));await reveal();await resumed;
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser?.close();server.kill();}
});

test('Burger King source failures do not prevent a public fallback from appearing and refreshing',async()=>{
 const {readFileSync}=await import('node:fs');
 const {APP_VERSION}=await import('../src/lib/app-version');
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-source-failures-')),base='http://127.0.0.1:3143';
 const requestLog=path.join(directory,'requests.txt');
 const server=spawn(process.execPath,['--import',new URL('./helpers/source-http-network.mjs',import.meta.url).href,'scripts/start.mjs'],{
  env:{...process.env,PORT:'3143',HOSTNAME:'127.0.0.1',PROMO_SEARCH_DATA_DIR:directory,PROMO_TEST_REQUEST_LOG:requestLog},stdio:['ignore','pipe','pipe'],
 });
 let logs='';server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);let browser;
 try{
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,logs);
  const health=await(await fetch(base+'/api/health')).json();assert.equal(health.version,APP_VERSION);
  browser=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/company/5');await page.getByRole('button',{name:'Сохранить TESTBK20',exact:true}).waitFor();
  for(let i=0;i<100&&await page.getByRole('button',{name:'Обновить',exact:true}).isDisabled();i++)await page.waitForTimeout(100);
  await page.getByText('Подробнее об обновлении',{exact:true}).click();
  await page.getByText('PromoSpy '+APP_VERSION,{exact:true}).waitFor();
  assert.ok(await page.getByText('Сайт отклонил запрос',{exact:false}).count()>0);
  assert.ok(await page.getByText('HTTP 403',{exact:false}).count()>0);
  const source='https://promokodi.ru/store/burger-king/';
  const before=readFileSync(requestLog,'utf8').split('\n').filter(url=>url===source).length;assert.ok(before>0);
  await page.getByRole('button',{name:'Обновить',exact:true}).click();
  for(let i=0;i<100;i++){if(readFileSync(requestLog,'utf8').split('\n').filter(url=>url===source).length>before)break;await page.waitForTimeout(100);}
  assert.ok(readFileSync(requestLog,'utf8').split('\n').filter(url=>url===source).length>before);
  await page.getByRole('button',{name:'Сохранить TESTBK20',exact:true}).click();await page.getByRole('link',{name:'Избранное (1)',exact:true}).click();
  await page.getByRole('button',{name:'Условия TESTBK20',exact:true}).waitFor();assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill();}
});
