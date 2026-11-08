// Synthetic HTTP regression scenario only. Never imported by the application.
import { appendFileSync } from 'node:fs';
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url))return original(input,init);
 if(process.env.PROMO_TEST_REQUEST_LOG)appendFileSync(process.env.PROMO_TEST_REQUEST_LOG,url+'\n');
 const parsed=new URL(url);
 if(parsed.pathname==='/robots.txt')return new Response('robots resource requires authentication',{status:401});
 if(parsed.hostname==='burgerkingrus.ru')return new Response('forbidden',{status:403});
 if(parsed.hostname==='promokod.pikabu.ru')return new Response('not found',{status:404});
 if(parsed.hostname==='getcashback.ru')return new Response('<title>Just a moment</title><h1>Checking your browser</h1>',{headers:{'content-type':'text/html'}});
 if(url==='https://promokodi.ru/store/burger-king/')return new Response('<h1>Промокоды Burger King</h1><article><h3>Тестовая скидка 20%</h3><p>Промокод: TESTBK20</p><p>Синтетический ответ только для теста</p></article>',{headers:{'content-type':'text/html'}});
 return new Response('<rss/>',{headers:{'content-type':'application/rss+xml'}});
};
