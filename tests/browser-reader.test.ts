import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium,type Browser } from 'playwright';
import { BrowserReader } from '../src/lib/browser-reader';
import { PublicHttpClient, SourceError } from '../src/lib/public-http';
import { parseMerchantPage } from '../src/lib/web-search';
import { getCompanyById } from '../src/lib/promocodes';
const url='https://example.org/promos';
test('permitted ordinary JavaScript renders with one reused browser and closes all contexts',async()=>{
  let launches=0,instance:Browser|undefined,slowCancelled=0;const seen:string[]=[];
  const http=new PublicHttpClient({intervalMs:0,dispatch:async()=>undefined,transport:async(input,init)=>{
    const target=String(input);seen.push(target);
    if(target.endsWith('/robots.txt'))return new Response('',{status:404});
    if(target.endsWith('/slow.json'))return new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>{slowCancelled++;reject(init!.signal!.reason);},{once:true}));
    if(target.endsWith('/app.js'))return new Response('fetch("/slow.json").catch(()=>{});fetch("https://127.0.0.1/private").catch(()=>{});document.getElementById("root").innerHTML="<article><h3>Скидка на заказ</h3><p>Промокод: JSRENDER20</p></article>";',{headers:{'content-type':'application/javascript'}});
    return new Response('<h1>Промокоды ВкусВилл</h1><div id="root"></div><script src="/app.js"></script>',{headers:{'content-type':'text/html'}});
  }});
  const reader=new BrowserReader({enabled:true,hosts:['example.org'],http,launch:async()=>{
    launches++;instance=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});return instance;
  }});
  try{
    for(let i=0;i<2;i++){
      const result=await reader.render(url,['example.org'],AbortSignal.timeout(10000));
      assert.ok(result.html);assert.equal(result.reason,'rendered');
      assert.equal(parseMerchantPage(result.html,url,getCompanyById(54)!)[0].code,'JSRENDER20');
      assert.equal(instance!.contexts().length,0);
    }
    assert.equal(launches,1);assert.ok(!seen.some(value=>value.includes('127.0.0.1')));
    assert.ok(slowCancelled>=1);
  }finally{http.cancel();await reader.close();}
  assert.equal(instance!.isConnected(),false);
});
test('a challenge page is rejected before executing its scripts',async()=>{
  let instance:Browser|undefined,scripts=0;
  const http=new PublicHttpClient({intervalMs:0,dispatch:async()=>undefined,transport:async input=>{
    if(String(input).endsWith('/robots.txt'))return new Response('',{status:404});
    if(String(input).endsWith('/challenge.js'))scripts++;
    return new Response('<title>Just a moment</title><h1>Checking your browser</h1><script src="/challenge.js"></script>',{headers:{'content-type':'text/html'}});
  }});
  const reader=new BrowserReader({enabled:true,hosts:['example.org'],http,launch:async()=>{
    instance=await chromium.launch({headless:true,...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.PROMO_TEST_CHROMIUM_EXECUTABLE}:{})});return instance;
  }});
  try{
    await assert.rejects(reader.render(url,['example.org'],AbortSignal.timeout(10000)),error=>error instanceof SourceError&&error.code==='restricted');
    assert.equal(scripts,0);assert.equal(instance!.contexts().length,0);
  }finally{await reader.close();}
});
