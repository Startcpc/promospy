import type { Dispatcher } from 'undici';
import { sourceIdentity } from './promo-validation';
import { safeSource, sourceDispatcher } from './fetch-policy';
import { RequestQueue } from './request-queue';
import { parseRobots, robotsAllows, type RobotsRules } from './robots';
import { searchConfig } from './search-config';
import { gunzipSync } from 'node:zlib';

export type FetchKind='document'|'robots'|'resource'|'sitemap';
export type FetchReceipt={url:string;finalUrl:string;status:number;attempts:number;revalidated:boolean;observedAt:number;bytes:number};
export type PublicDocument={body:Uint8Array;contentType:string;receipt:FetchReceipt};
export class SourceError extends Error {
  code:string;url:string;status?:number;retryAt?:number;attempts:number;
  constructor(message:string,code:string,url:string,status?:number,retryAt?:number,attempts=0){
    super(message);this.name='SourceError';this.code=code;this.url=url;this.status=status;this.retryAt=retryAt;this.attempts=attempts;
  }
}
type CachedResponse={body:Uint8Array;contentType:string;etag:string|null;modified:string|null;at:number};
type ReadOptions={kind?:FetchKind;robots?:boolean;maxBytes?:number};
const cacheable=(headers:Headers)=>!/no-store|private/i.test(headers.get('cache-control')??'')&&!headers.has('set-cookie')&&headers.get('vary')?.trim()!=='*';
type ClientOptions={
  transport?:typeof fetch;
  dispatch?:(url:string,signal:AbortSignal)=>Promise<Dispatcher|undefined>;
  concurrency?:number;perHost?:number;intervalMs?:number;timeoutMs?:number;maxBytes?:number;
  retries?:number;backoffMs?:number;
};
export function retryAfter(value:string|null,now=Date.now()):number|undefined{
  if(!value)return undefined;
  if(/^\d+(?:\.\d+)?$/.test(value.trim()))return now+Math.min(86400000,Number(value)*1000);
  const date=Date.parse(value);return Number.isFinite(date)?Math.max(now,Math.min(now+86400000,date)):undefined;
}
function wait(ms:number,signal:AbortSignal){
  signal.throwIfAborted();
  return new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    signal.addEventListener('abort',abort,{once:true});
  });
}
function networkCode(error:unknown){
  const object=error as {name?:string;code?:string;cause?:{code?:string}};
  const code=object?.cause?.code??object?.code??'';
  if(code==='ERR_SOURCE_ADDRESS')return 'restricted';
  if(/CERT|TLS|SSL/i.test(code))return 'tls';
  if(/ENOTFOUND|EAI_AGAIN/.test(code))return 'dns';
  if(/TIMEOUT|ETIMEDOUT/i.test(code)||object?.name==='TimeoutError')return 'timeout';
  return 'network';
}
export function decodeSource(data:Uint8Array,contentType:string|null){
  const header=contentType?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
  const start=Buffer.from(data.subarray(0,4096)).toString('latin1');
  const meta=start.match(/<meta[^>]*charset\s*=\s*["']?([^\s;"'>]+)/i)?.[1]??start.match(/<\?xml[^>]*encoding=["']([^"']+)/i)?.[1];
  try{return new TextDecoder(header??meta??'utf-8').decode(data);}catch{return new TextDecoder('utf-8').decode(data);}
}
export class PublicHttpClient {
  private queue:RequestQueue;
  private cache=new Map<string,CachedResponse>();
  private cacheBytes=0;
  private circuits=new Map<string,{failures:number;until:number;status?:number}>();
  private missing=new Map<string,SourceError>();
  private robots=new Map<string,{rules:RobotsRules;at:number}>();
  private inflight=new Map<string,{controller:AbortController;promise:Promise<PublicDocument>;users:number}>();
  private config:Required<Pick<ClientOptions,'timeoutMs'|'maxBytes'|'retries'|'backoffMs'>>;
  private options:ClientOptions;
  constructor(options:ClientOptions={}){
    this.options=options;
    const defaults=searchConfig();
    this.config={timeoutMs:options.timeoutMs??defaults.requestTimeoutMs,maxBytes:options.maxBytes??defaults.maxBytes,retries:options.retries??2,backoffMs:options.backoffMs??250};
    this.queue=new RequestQueue(options.concurrency??defaults.concurrency,options.perHost??defaults.perHost,options.intervalMs??defaults.intervalMs);
  }
  async readText(url:string,domains:readonly string[],signal:AbortSignal,options:ReadOptions={}){
    const document=await this.read(url,domains,signal,options);
    let body=document.body;
    if(options.kind==='sitemap'&&body[0]===0x1f&&body[1]===0x8b){
      try{body=gunzipSync(body,{maxOutputLength:Math.min(options.maxBytes??this.config.maxBytes,this.config.maxBytes)});}
      catch{throw new SourceError('Сжатая карта сайта повреждена или превышает лимит','size',url);}
    }
    return {text:decodeSource(body,document.contentType),receipt:document.receipt};
  }
  async read(url:string,domains:readonly string[],signal:AbortSignal,options:ReadOptions={}):Promise<PublicDocument>{
    signal.throwIfAborted();
    if(!safeSource(url,domains))throw new SourceError('Адрес вне списка публичных источников','restricted',url);
    const key=sourceIdentity(url)+'|'+[...domains].sort().join(',')+'|'+(options.kind??'document')+'|'+(options.robots!==false)+'|'+(options.maxBytes??this.config.maxBytes);
    let entry=this.inflight.get(key);
    if(!entry||entry.controller.signal.aborted){
      const controller=new AbortController();
      const item={controller,users:0,promise:Promise.resolve(null as unknown as PublicDocument)};
      item.promise=this.perform(url,domains,controller.signal,options).finally(()=>{if(this.inflight.get(key)===item)this.inflight.delete(key);});
      entry=item;this.inflight.set(key,item);
    }
    entry.users++;
    const shared=entry;
    return new Promise((resolve,reject)=>{
      let done=false;
      const finish=()=>{if(done)return false;done=true;signal.removeEventListener('abort',abort);shared.users--;return true;};
      const abort=()=>{if(!finish())return;if(!shared.users)shared.controller.abort(signal.reason);reject(signal.reason);};
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted){abort();return;}
      shared.promise.then(value=>{if(finish())resolve(value);},error=>{if(finish())reject(error);});
    });
  }
  async sitemapHints(url:string,domains:readonly string[],signal:AbortSignal){
    const policy=await this.policy(url,domains,signal);
    return policy.sitemaps.filter(value=>safeSource(value,domains));
  }
  private async policy(url:string,domains:readonly string[],signal:AbortSignal):Promise<RobotsRules>{
    const origin=new URL(url).origin,cached=this.robots.get(origin);
    if(cached&&Date.now()-cached.at<3600000)return cached.rules;
    const robotsUrl=origin+'/robots.txt';
    try{
      const document=await this.read(robotsUrl,domains,signal,{kind:'robots',robots:false,maxBytes:128000});
      const text=decodeSource(document.body,document.contentType);
      if(/^\s*[<{[]|checking your browser|just a moment/i.test(text.replace(/^#.*$/gm,'')))throw new SourceError('robots.txt вернул неподдерживаемый документ','robots',robotsUrl);
      const rules=parseRobots(text);
      if(this.robots.size>=64)this.robots.delete(this.robots.keys().next().value!);
      this.robots.set(origin,{rules,at:Date.now()});this.queue.delayHost(new URL(url).hostname,rules.delayMs);return rules;
    }catch(error){
      if(signal.aborted)throw signal.reason;
      if(error instanceof SourceError&&[404,410].includes(error.status??0)){
        const rules:RobotsRules={rules:[],delayMs:0,sitemaps:[]};
        this.robots.set(origin,{rules,at:Date.now()});return rules;
      }
      // A previously read policy is safer than assuming that a temporary failure grants access.
      if(cached&&Date.now()-cached.at<86400000)return cached.rules;
      throw new SourceError('Не удалось проверить правила robots.txt','robots',url,error instanceof SourceError?error.status:undefined,Date.now()+60000);
    }
  }
  private async perform(original:string,domains:readonly string[],signal:AbortSignal,options:ReadOptions):Promise<PublicDocument>{
    const bounded=AbortSignal.any([signal,AbortSignal.timeout(this.config.timeoutMs)]);
    if(options.robots!==false&&!robotsAllows(await this.policy(original,domains,bounded),original))throw new SourceError('Автоматическое чтение запрещено robots.txt','robots',original);
    let url=original,attempts=0;
    const redirects=new Set<string>();
    while(redirects.size<=4){
      bounded.throwIfAborted();
      if(!safeSource(url,domains))throw new SourceError('Небезопасное перенаправление','restricted',url);
      if(url!==original&&options.robots!==false&&!robotsAllows(await this.policy(url,domains,bounded),url))throw new SourceError('Перенаправление запрещено robots.txt','robots',url);
      const key=sourceIdentity(url),host=new URL(url).hostname;
      const unavailable=this.missing.get(key);
      if(unavailable?.retryAt&&unavailable.retryAt>Date.now())throw new SourceError(unavailable.message,unavailable.code,url,unavailable.status,unavailable.retryAt);
      const circuit=this.circuits.get(host);
      if(circuit&&circuit.until>Date.now())throw new SourceError('Источник временно приостановлен после ошибки','circuit',url,circuit.status,circuit.until);
      let last:unknown;
      for(let retry=0;retry<=this.config.retries;retry++){
        bounded.throwIfAborted();
        try{
          const result=await this.queue.run(host,bounded,async()=>{
            bounded.throwIfAborted();
            const dispatcher=await (this.options.dispatch??sourceDispatcher)(url,bounded);
            const cached=this.cache.get(key);
            const representation=cached&&Date.now()-cached.at<86400000?cached:undefined;
            const headers:Record<string,string>={'User-Agent':'PromoSpy/1.0 public coupon discovery','Accept':'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml,application/json,text/plain','Accept-Language':'ru-RU,ru;q=0.9'};
            if(representation?.etag)headers['If-None-Match']=representation.etag;
            if(representation?.modified)headers['If-Modified-Since']=representation.modified;
            attempts++;
            const response=await (this.options.transport??globalThis.fetch)(url,{redirect:'manual',signal:bounded,headers,credentials:'omit',dispatcher} as RequestInit&{dispatcher?:Dispatcher});
            if([301,302,303,307,308].includes(response.status)){
              const location=response.headers.get('location');await response.body?.cancel();
              if(!location)throw new SourceError('Перенаправление без адреса','redirect',url,response.status);
              let next:string;
              try{next=new URL(location,url).href;}catch{throw new SourceError('Некорректный адрес перенаправления','redirect',url,response.status);}
              if(!safeSource(next,domains))throw new SourceError('Перенаправление вне списка источников','restricted',url,response.status);
              return {redirect:next};
            }
            if(response.status===304){
              await response.body?.cancel();
              if(!representation||!representation.etag&&!representation.modified)throw new SourceError('HTTP 304 без сохранённого содержимого с валидатором','http',url,304);
              if(representation.body.length>Math.min(options.maxBytes??this.config.maxBytes,this.config.maxBytes))throw new SourceError('Сохранённый ответ превышает лимит размера','size',url,304);
              representation.at=Date.now();
              if(!cacheable(response.headers))this.forget(key);
              return {document:{body:representation.body,contentType:representation.contentType,receipt:{url:original,finalUrl:url,status:304,attempts,revalidated:true,observedAt:Date.now(),bytes:representation.body.length}}};
            }
            if(!response.ok){
              await response.body?.cancel();
              const until=retryAfter(response.headers.get('retry-after'));
              const code=[401,403].includes(response.status)?'restricted':response.status===429?'rate_limit':'http';
              throw new SourceError('HTTP '+response.status,code,url,response.status,until,attempts);
            }
            const contentType=response.headers.get('content-type')??'';
            const kind=options.kind??'document';
            if(!(/html|xml|json/i.test(contentType)||kind==='sitemap'&&/gzip/i.test(contentType)||kind==='robots'&&/^text\/plain/i.test(contentType)||kind==='resource'&&/javascript|ecmascript|text\/css|text\/plain/i.test(contentType))){
              await response.body?.cancel();throw new SourceError('Ответ не содержит поддерживаемый текстовый документ','content_type',url,response.status);
            }
            const limit=Math.min(options.maxBytes??this.config.maxBytes,this.config.maxBytes),length=Number(response.headers.get('content-length'));
            if(length>limit){await response.body?.cancel();throw new SourceError('Страница превышает лимит размера','size',url,response.status);}
            const reader=response.body?.getReader();if(!reader)throw new SourceError('Пустой ответ источника','empty',url,response.status);
            const chunks:Uint8Array[]=[];let size=0;
            try{
              while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit)throw new SourceError('Страница превышает лимит размера','size',url,response.status);chunks.push(part.value);}
            }finally{await reader.cancel().catch(()=>{});}
            if(!size)throw new SourceError('Пустой ответ источника','empty',url,response.status);
            if(length>0&&!response.headers.get('content-encoding')&&size<length)throw new SourceError('Источник прислал неполный ответ','partial',url,response.status);
            const body=Buffer.concat(chunks),at=Date.now();
            if(cacheable(response.headers))this.remember(key,{body,at,contentType,etag:response.headers.get('etag'),modified:response.headers.get('last-modified')});
            else this.forget(key);
            return {document:{body,contentType,receipt:{url:original,finalUrl:url,status:response.status,attempts,revalidated:false,observedAt:at,bytes:size}}};
          });
          this.circuits.delete(host);this.missing.delete(key);
          if(typeof result.redirect==='string'){
            if(redirects.has(sourceIdentity(result.redirect)))throw new SourceError('Зацикленное перенаправление','redirect',url);
            redirects.add(sourceIdentity(url));url=result.redirect;break;
          }
          return result.document;
        }catch(error){
          if(signal.aborted)throw signal.reason;
          const problem=error instanceof SourceError?error:new SourceError(networkCode(error)==='tls'?'Ошибка TLS источника':networkCode(error)==='dns'?'Не удалось определить адрес источника':networkCode(error)==='timeout'?'Источник не ответил вовремя':networkCode(error)==='restricted'?'Непубличный адрес источника':'Соединение с источником прервано',networkCode(error),url,undefined,undefined,attempts);
          last=problem;
          const status=problem.status??0;
          if([401,403,429].includes(status)){
            problem.retryAt=problem.retryAt??Date.now()+([401,403].includes(status)?900000:60000);
            this.circuits.set(host,{failures:3,until:problem.retryAt,status});
          }
          if([400,404,410].includes(status)){
            problem.retryAt=Date.now()+(status===400?300000:3600000);
            if(this.missing.size>=256)this.missing.delete(this.missing.keys().next().value!);
            this.missing.set(key,problem);
          }
          const transient=[408,429,500,502,503,504].includes(status)||['network','timeout','partial'].includes(problem.code)||problem.code==='dns'&&((error as {cause?:{code?:string};code?:string})?.cause?.code??(error as {code?:string})?.code)==='EAI_AGAIN';
          if(transient&&!this.circuits.get(host)?.until){
            const state=this.circuits.get(host)??{failures:0,until:0};
            state.failures++;if(state.failures>=3)state.until=Date.now()+60000;
            state.status=problem.status;this.circuits.set(host,state);
          }
          const delay=problem.retryAt?Math.max(0,problem.retryAt-Date.now()):Math.min(2000,this.config.backoffMs*2**retry)*(0.75+Math.random()*0.5);
          if(!transient||retry===this.config.retries||delay>2000||bounded.aborted)throw problem;
          await wait(delay,bounded);
          if(problem.retryAt&&problem.retryAt<=Date.now())this.circuits.delete(host);
        }
      }
      if(url===original&&last)throw last;
    }
    throw new SourceError('Слишком много перенаправлений','redirect',original);
  }
  private remember(key:string,value:CachedResponse){
    const old=this.cache.get(key);if(old)this.cacheBytes-=old.body.length;
    this.cache.delete(key);this.cache.set(key,value);this.cacheBytes+=value.body.length;
    while(this.cache.size>32||this.cacheBytes>16_000_000){
      const oldest=this.cache.keys().next().value!;this.cacheBytes-=this.cache.get(oldest)!.body.length;this.cache.delete(oldest);
    }
  }
  private forget(key:string){
    const old=this.cache.get(key);if(old)this.cacheBytes-=old.body.length;this.cache.delete(key);
  }
  cancel(){
    for(const item of this.inflight.values())item.controller.abort(new Error('Поиск остановлен'));
    this.inflight.clear();
  }
}
export const publicHttp=new PublicHttpClient();
