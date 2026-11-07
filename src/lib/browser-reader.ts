import { createRequire } from 'node:module';
import type { Browser } from 'playwright';
import { safeSource, sourceHost } from './fetch-policy';
import { publicHttp, decodeSource, SourceError, type PublicHttpClient } from './public-http';
import { isChallengePage } from './source-extraction';
import { RequestQueue } from './request-queue';
export function needsRendering(html:string){
  const visible=html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return !isChallengePage(html)&&visible.length<500&&/(?:id=["'](?:app|root|__next)["']|enable javascript|включите javascript|загрузка|loading|type=["']module["'])/i.test(html);
}
function configuredHosts(){
  return (process.env.PROMO_BROWSER_HOSTS??'').split(',').map(value=>value.trim().toLowerCase().replace(/^www\./,'')).filter(value=>/^[a-z0-9.-]+$/.test(value)).slice(0,12);
}
type BrowserOptions={enabled?:boolean;hosts?:string[];http?:PublicHttpClient;launch?:()=>Promise<Browser>};
export class BrowserReader {
  private browser:Promise<Browser>|undefined;
  private queue=new RequestQueue(1,1,0);
  private options:BrowserOptions;
  constructor(options:BrowserOptions={}){this.options=options;}
  async render(url:string,domains:string[],signal:AbortSignal){
    const enabled=this.options.enabled??process.env.PROMO_BROWSER_ENABLED==='1',hosts=this.options.hosts??configuredHosts();
    if(!enabled||!hosts.includes(sourceHost(url)))return {html:null,reason:'disabled' as const};
    if(!safeSource(url,domains))throw new SourceError('Адрес рендеринга вне списка источников','restricted',url);
    return this.queue.run(sourceHost(url),signal,async()=>{
      const resources=new AbortController();
      const bounded=AbortSignal.any([signal,resources.signal,AbortSignal.timeout(8000)]);
      let browser:Browser;
      try{
        this.browser??=(this.options.launch?this.options.launch():(async()=>{
          const {chromium}=createRequire(import.meta.url)('playwright') as typeof import('playwright');
          return chromium.launch({headless:true,timeout:6000,args:['--js-flags=--max-old-space-size=128'],...(process.env.PROMO_BROWSER_EXECUTABLE?{executablePath:process.env.PROMO_BROWSER_EXECUTABLE}:{})});
        })());
        browser=await this.browser;
      }catch{this.browser=undefined;return {html:null,reason:'unavailable' as const};}
      bounded.throwIfAborted();
      const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
      const close=()=>{void context.close().catch(()=>{});};
      bounded.addEventListener('abort',close,{once:true});
      const resourceHosts=[sourceHost(url),...(process.env.PROMO_BROWSER_RESOURCE_HOSTS??'').split(',').map(value=>value.trim().toLowerCase().replace(/^www\./,'')).filter(value=>/^[a-z0-9.-]+$/.test(value)).slice(0,8)];
      let requests=0,bytes=0,restricted=false;
      try{
        await context.routeWebSocket('**/*',socket=>socket.close());
        await context.addInitScript(()=>{
          for(const key of ['RTCPeerConnection','webkitRTCPeerConnection','WebTransport'])try{Object.defineProperty(globalThis,key,{value:undefined,configurable:false});}catch{}
        });
        await context.route('**/*',async route=>{
          const request=route.request();
          if(!['GET','HEAD'].includes(request.method())||['image','media','font','manifest'].includes(request.resourceType())||!safeSource(request.url(),resourceHosts)||request.isNavigationRequest()&&!safeSource(request.url(),domains)||++requests>30){
            await route.abort().catch(()=>{});return;
          }
          try{
            const response=await (this.options.http??publicHttp).read(request.url(),resourceHosts,bounded,{kind:'resource',maxBytes:1_500_000});
            if(request.isNavigationRequest()&&/html/i.test(response.contentType)&&isChallengePage(decodeSource(response.body,response.contentType))){restricted=true;throw new Error('Проверка браузера');}
            bytes+=response.body.length;if(bytes>8_000_000)throw new Error('Лимит ресурсов страницы');
            if(response.receipt.finalUrl!==request.url()){
              await route.fulfill({status:302,headers:{location:response.receipt.finalUrl}});
            }else{
              const contentType=response.contentType.replace(/;\s*charset\s*=\s*["']?[^\s;"']+["']?/i,'')+'; charset=utf-8';
              await route.fulfill({status:200,contentType,body:Buffer.from(decodeSource(response.body,response.contentType),'utf8')});
            }
          }catch{await route.abort().catch(()=>{});}
        });
        const page=await context.newPage();
        page.on('dialog',dialog=>void dialog.dismiss().catch(()=>{}));
        context.on('page',popup=>{if(popup!==page)void popup.close().catch(()=>{});});
        await page.goto(url,{waitUntil:'domcontentloaded',timeout:6000});
        await page.waitForFunction(()=>!!document.querySelector('[data-promocode],[data-promo-code],[data-coupon-code],code')||/(?:промокод|promo code|coupon code)\s*:/i.test(document.body?.innerText??''),{},{timeout:1500}).catch(()=>{});
        bounded.throwIfAborted();
        if(!safeSource(page.url(),domains))throw new SourceError('Страница ушла за границы разрешённых источников','restricted',url);
        const html=await page.content();
        if(Buffer.byteLength(html,'utf8')>2_000_000)throw new SourceError('Отрисованная страница слишком большая','size',url);
        if(isChallengePage(html))throw new SourceError('Страница запросила проверку браузера','restricted',url);
        return {html,reason:'rendered' as const,finalUrl:page.url()};
      }catch(error){if(restricted)throw new SourceError('Сайт запросил проверку браузера','restricted',url);throw error;}
      finally{bounded.removeEventListener('abort',close);resources.abort(new Error('Рендеринг завершён'));await context.close().catch(()=>{});}
    });
  }
  async close(){
    const pending=this.browser;this.browser=undefined;
    if(pending)try{await(await pending).close();}catch{}
  }
}
export const browserReader=new BrowserReader();
