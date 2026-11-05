import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 },
  locale: 'ru-RU',
});
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

for (const url of ['https://tanuki.ru', 'https://www.tanuki.ru']) {
  try {
    console.log(`\n=== ${url} ===`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log(`HTTP: ${resp?.status()}`);
    console.log(`URL после: ${page.url()}`);
    const title = await page.title();
    console.log(`Title: ${title}`);
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 800) ?? '(empty)');
    console.log(`Body: ${body}`);
  } catch (e) {
    console.log(`Ошибка: ${e.message}`);
  }
}
await browser.close();
