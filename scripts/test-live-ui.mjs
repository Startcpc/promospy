// Real browser + real server + real public sources. No routing mocks or seeded coupons.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3000').origin;
const output = path.resolve('work/live-ui');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE} : {})});
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage();
  const errors = [], httpErrors = [], scans = [];
  let latest;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) httpErrors.push({url:response.url(),status:response.status()});
    if (new URL(response.url()).pathname === '/api/scan/54') {
      scans.push({method:response.request().method(),status:response.status()});
      void response.json().then(data => {latest=data;}).catch(() => {});
    }
  });
  await page.goto(base, {waitUntil:'networkidle'});
  await page.screenshot({path:path.join(output,'home-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:path.join(output,'home-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('link',{name:'Промокоды ВкусВилл',exact:true}).click();
  await page.getByText('Нажмите «Обновить», чтобы найти промокоды.',{exact:true}).waitFor();
  assert.equal(scans.length,0,'Opening the app must not start a scan');
  assert.equal(await page.locator('article').count(),0);
  await page.getByRole('button',{name:'Обновить',exact:true}).click();
  await page.locator('article').first().waitFor({timeout:110000});
  await page.getByRole('button',{name:'Обновить',exact:true}).waitFor({timeout:110000});
  await page.waitForFunction(() => !document.querySelector('button.button-primary:disabled'));
  assert.equal(latest?.status,'idle',latest?.notice);
  assert.ok(latest.report.pagesRead > 0);
  assert.ok(latest.codes.length > 0);
  assert.ok(latest.codes.every(code => code.companyId === 54 && !code.cached));
  const card = page.locator('article').first();
  const firstCode = (await card.locator('.promo-code-field code').innerText()).trim();
  await card.getByRole('button',{name:`Скопировать ${firstCode}`,exact:true}).click();
  await page.getByText('Код скопирован',{exact:true}).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()),firstCode);
  await card.getByRole('button',{name:`Сохранить ${firstCode}`,exact:true}).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path:path.join(output,'search-desktop.png')});
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`Overflow at ${width}px`);
    if (width===390) await page.screenshot({path:path.join(output,'search-mobile.png')});
  }
  const visibleOffers = await page.locator('article').count();
  await page.getByRole('link',{name:'Избранное (1)',exact:true}).click();
  await page.waitForURL(base+'/saved');
  await page.getByRole('button',{name:`Условия ${firstCode}`,exact:true}).waitFor();
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:`Условия ${firstCode}`,exact:true}).waitFor();
  await context.setOffline(true);
  await page.getByText(/Нет подключения. Сохранённые копии доступны/).waitFor();
  assert.equal(await page.locator('article').count(),1);
  await context.setOffline(false);
  assert.deepEqual(errors,[]);
  assert.deepEqual(httpErrors,[]);
  const health=await(await fetch(base+'/api/health')).json();
  const summary={checkedAt:new Date().toISOString(),version:health.version,base,mocked:false,visibleOffers,totalOffers:latest.codes.length,pagesRead:latest.report.pagesRead,firstCode,clipboard:true,favoriteReload:true,favoriteOffline:true,errors,httpErrors,scans,sources:latest.report.sourceResults};
  writeFileSync(path.join(output,'report.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
} finally {await browser.close();}
