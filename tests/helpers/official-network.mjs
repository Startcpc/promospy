// Isolated test process only. Frozen responses, not a claim of live Internet access.
import { readFileSync, appendFileSync } from 'node:fs';
const fixtures = new Map([
  ['https://vkusvill.ru/promocodes/', readFileSync(new URL('../fixtures/vkusvill-official.html',import.meta.url),'utf8')],
]);
const original = globalThis.fetch;
globalThis.fetch = async (input,init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) return original(input,init);
  if (process.env.PROMO_TEST_REQUEST_LOG) appendFileSync(process.env.PROMO_TEST_REQUEST_LOG,url+'\n');
  if (new URL(url).pathname === "/robots.txt") return new Response("",{status:404});
  if (fixtures.has(url)) return new Response('<script src="/captcha.js"></script>'+fixtures.get(url),{headers:{'content-type':'text/html; charset=utf-8'}});
  if (url.includes('bing.com')) return new Response('<rss/>',{headers:{'content-type':'application/rss+xml'}});
  return new Response('<title>Страница без купонов</title>',{headers:{'content-type':'text/html'}});
};
