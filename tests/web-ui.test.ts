import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { parseMerchantPage } from '../src/lib/web-search';
import { getCompanyById } from '../src/lib/promocodes';

test('home makes no scans; native links and favorites work without Prisma, keys or carts',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'promospy-web-'));
 const code=parseMerchantPage('<title>ВкусВилл</title><article><h3>Первый заказ</h3><p>Промокод: SAVE10</p></article>','https://promokodi.ru/store/vkusvill',getCompanyById(54)!)[0];
 code.id='54:SAVE10';
 writeFileSync(path.join(directory,'54.json'),JSON.stringify({companyId:54,at:Date.now(),report:{codes:[code],targetSites:30,discoveredSites:2,pagesRead:3,pagesFailed:1,visited:[code.sources[0].url],warnings:[]}}));
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
  const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('storage disabled');};});
  const blockedPage=await blocked.newPage();await blockedPage.goto(base+'/company/54',{waitUntil:'networkidle'});
  await blockedPage.getByRole('button',{name:'Сохранить SAVE10',exact:true}).click();
  await blockedPage.getByRole('button',{name:'Удалить из избранного SAVE10',exact:true}).waitFor();
  await blockedPage.getByRole('alert').filter({hasText:'до закрытия этой вкладки'}).waitFor();
  await blockedPage.getByRole('link',{name:'Избранное (1)',exact:true}).click();await blockedPage.waitForURL(base+'/saved');await blockedPage.getByRole('button',{name:'Условия SAVE10',exact:true}).waitFor();
  await blocked.close();await context.close();
 }finally{await browser?.close();server.kill();}
});
