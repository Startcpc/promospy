import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicHttpClient, SourceError, retryAfter } from '../src/lib/public-http';
import { publicAddress, safeSource, pinnedLookup, resolvePublic } from '../src/lib/fetch-policy';
import { parseRobots, robotsAllows } from '../src/lib/robots';
import { RequestQueue } from '../src/lib/request-queue';
const url='https://example.org/promos',domains=['example.org'];
const html=()=>new Response('<h1>Public source</h1>',{headers:{'content-type':'text/html'}});
const options={robots:false};
function client(transport:typeof fetch,extra:ConstructorParameters<typeof PublicHttpClient>[0]={}){
  return new PublicHttpClient({transport,dispatch:async()=>undefined,intervalMs:0,backoffMs:1,timeoutMs:1000,...extra});
}
for(const status of [401,403,404,400])test('HTTP '+status+' is not repeatedly retried',async()=>{
  let calls=0;const http=client(async()=>{calls++;return new Response('error',{status});});
  await assert.rejects(http.readText(url,domains,AbortSignal.timeout(2000),options),error=>error instanceof SourceError&&error.status===status);
  assert.equal(calls,1);
});
for(const status of [408,500,502,503,504])test('transient HTTP '+status+' retries and recovers',async()=>{
  let calls=0;const http=client(async()=>++calls===1?new Response('busy',{status}):html());
  const result=await http.readText(url,domains,AbortSignal.timeout(2000),options);
  assert.equal(calls,2);assert.equal(result.receipt.attempts,2);assert.match(result.text,/Public/);
});
test('429 respects a long Retry-After without sleeping or hammering the host',async()=>{
  let calls=0;const http=client(async()=>{calls++;return new Response('slow down',{status:429,headers:{'retry-after':'120'}});});
  await assert.rejects(http.readText(url,domains,AbortSignal.timeout(2000),options),error=>error instanceof SourceError&&!!error.retryAt&&error.retryAt>Date.now()+110000);
  await assert.rejects(http.readText(url+'/other',domains,AbortSignal.timeout(2000),options));
  assert.equal(calls,1);
});
test('Retry-After supports seconds and HTTP dates and rejects invalid values',()=>{
  const now=Date.parse('2026-11-07T00:00:00Z');
  assert.equal(retryAfter('15',now),now+15000);assert.equal(retryAfter('Sat, 07 Nov 2026 00:01:00 GMT',now),now+60000);assert.equal(retryAfter('garbage',now),undefined);
});
test('conditional ETag and Last-Modified requests reuse an actual cached body on 304',async()=>{
  let calls=0;const http=client(async(_input,init)=>{
    if(++calls===1)return new Response('<p>Observed</p>',{headers:{'content-type':'text/html',etag:'"real"','last-modified':'Fri, 06 Nov 2026 00:00:00 GMT'}});
    const headers=new Headers(init?.headers);assert.equal(headers.get('if-none-match'),'"real"');assert.ok(headers.has('if-modified-since'));return new Response(null,{status:304});
  });
  await http.readText(url,domains,AbortSignal.timeout(2000),options);
  const result=await http.readText(url,domains,AbortSignal.timeout(2000),options);
  assert.match(result.text,/Observed/);assert.equal(result.receipt.status,304);assert.equal(result.receipt.revalidated,true);
});
test('304 without a usable representation and private responses cannot fabricate a page',async()=>{
  let calls=0;const http=client(async()=>++calls===1?new Response('private',{headers:{'content-type':'text/html','cache-control':'private'}}):new Response(null,{status:304}));
  await http.readText(url,domains,AbortSignal.timeout(2000),options);
  await assert.rejects(http.readText(url,domains,AbortSignal.timeout(2000),options),error=>error instanceof SourceError&&error.status===304);
});
test('redirect loops and redirects to local, metadata or unlisted hosts stop before the next request',async()=>{
  for(const location of ['https://127.0.0.1/a','https://169.254.169.254/latest/meta-data','https://evil.test/promos',url]){
    let calls=0;const http=client(async()=>{calls++;return new Response(null,{status:302,headers:{location}});});
    await assert.rejects(http.readText(url,domains,AbortSignal.timeout(2000),options));assert.ok(calls<=2);
  }
});
test('an allowed redirect is fetched and its final evidence URL is recorded',async()=>{
  const seen:string[]=[];const http=client(async input=>{seen.push(String(input));return seen.length===1?new Response(null,{status:301,headers:{location:'/new-promos'}}):html();});
  const result=await http.readText(url,domains,AbortSignal.timeout(2000),options);
  assert.equal(result.receipt.finalUrl,'https://example.org/new-promos');assert.equal(result.receipt.attempts,2);assert.equal(seen.length,2);
});
test('oversized, empty and unsupported responses fail without being parsed as an empty coupon page',async()=>{
  for(const response of [new Response('a'.repeat(101),{headers:{'content-type':'text/html'}}),new Response('',{headers:{'content-type':'text/html'}}),new Response('binary',{headers:{'content-type':'application/octet-stream'}})]){
    const http=client(async()=>response,{maxBytes:100,retries:0});
    await assert.rejects(http.readText(url,domains,AbortSignal.timeout(2000),options),error=>error instanceof SourceError&&['size','empty','content_type'].includes(error.code));
  }
});
test('TLS failures do not retry while a connection reset receives a bounded retry',async()=>{
  let calls=0;const tls=client(async()=>{calls++;throw Object.assign(new Error('TLS'),{cause:{code:'CERT_HAS_EXPIRED'}});});
  await assert.rejects(tls.readText(url,domains,AbortSignal.timeout(2000),options));assert.equal(calls,1);
  calls=0;const reset=client(async()=>{if(++calls===1)throw Object.assign(new Error('reset'),{cause:{code:'ECONNRESET'}});return html();});
  await reset.readText(url,domains,AbortSignal.timeout(2000),options);assert.equal(calls,2);
});
test('timeouts cancel a stalled transport and cancellation does not retry',async()=>{
  let calls=0;const http=client(async(_input,init)=>{calls++;return new Promise<Response>((_resolve,reject)=>{
    const connection=setTimeout(()=>reject(new Error('test connection stayed open')),500);
    init!.signal!.addEventListener('abort',()=>{clearTimeout(connection);reject(init!.signal!.reason);},{once:true});
  });},{timeoutMs:30});
  await assert.rejects(http.readText(url,domains,AbortSignal.timeout(1000),options));assert.equal(calls,1);
});
test('shared URL retrieval survives cancellation of only one subscriber',async()=>{
  let release!:()=>void,calls=0;const gate=new Promise<void>(resolve=>{release=resolve;});
  const http=client(async()=>{calls++;await gate;return html();});
  const abort=new AbortController(),first=http.readText(url,domains,abort.signal,options),rejected=assert.rejects(first);
  const second=http.readText(url,domains,AbortSignal.timeout(2000),options);abort.abort();release();
  await rejected;assert.match((await second).text,/Public/);assert.equal(calls,1);
});
test('a new subscriber does not inherit a request already cancelled by its last subscriber',async()=>{
 let calls=0;
 const http=client(async(_input,init)=>{
  calls++;if(calls>1)return html();
  return new Promise<Response>((_resolve,reject)=>{init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason),{once:true});});
 });
 const controller=new AbortController(),first=http.readText(url,domains,controller.signal,options);
 const rejected=assert.rejects(first);await new Promise(resolve=>setTimeout(resolve,0));controller.abort();
 const second=http.readText(url,domains,AbortSignal.timeout(2000),options);
 await rejected;assert.match((await second).text,/Public/);assert.equal(calls,2);
});
test('a new non-cacheable response invalidates an older conditional representation',async()=>{
 for(const headers of [{'cache-control':'no-store'},{'cache-control':'private'},{'set-cookie':'session=private'},{vary:'*'}] as Record<string,string>[]){
  let calls=0;
  const http=client(async(_input,init)=>{
   calls++;
   if(calls===3){assert.equal(new Headers(init?.headers).has('if-none-match'),false);return html();}
   return new Response('version '+calls,{headers:{'content-type':'text/html',etag:'"version-'+calls+'"',...(calls===2?headers:{})}});
  },{retries:0});
  for(let i=0;i<3;i++)await http.readText(url,domains,AbortSignal.timeout(2000),options);
 }
});
test('a 304 with no-store can supply the current response but cannot stay cached',async()=>{
 let calls=0;
 const http=client(async(_input,init)=>{
  if(++calls===1)return new Response('current',{headers:{'content-type':'text/html',etag:'"current"'}});
  if(calls===2)return new Response(null,{status:304,headers:{'cache-control':'no-store'}});
  assert.equal(new Headers(init?.headers).has('if-none-match'),false);return html();
 },{retries:0});
 await http.readText(url,domains,AbortSignal.timeout(2000),options);
 assert.equal((await http.readText(url,domains,AbortSignal.timeout(2000),options)).text,'current');
 await http.readText(url,domains,AbortSignal.timeout(2000),options);
});
test('robots rules are checked first; a disallow never fetches the protected document',async()=>{
  const seen:string[]=[];const http=client(async input=>{seen.push(String(input));return new Response('User-agent: *\nDisallow: /private\nAllow: /private/public\nSitemap: https://example.org/sitemap.xml',{headers:{'content-type':'text/plain'}});});
  await assert.rejects(http.readText('https://example.org/private/a',domains,AbortSignal.timeout(2000)),error=>error instanceof SourceError&&error.code==='robots');
  assert.deepEqual(seen,['https://example.org/robots.txt']);
});
test('a missing robots file permits public content; a failed robots check does not grant access',async()=>{
  let pages=0;const allowed=client(async input=>String(input).endsWith('/robots.txt')?new Response('',{status:404}):(pages++,html()));
  await allowed.readText(url,domains,AbortSignal.timeout(2000));assert.equal(pages,1);
  const denied=client(async()=>new Response('server failure',{status:503}),{retries:0});
  await assert.rejects(denied.readText(url,domains,AbortSignal.timeout(2000)),error=>error instanceof SourceError&&error.code==='robots');
});
test('robots longest match, allow ties, agent groups and wildcard rules are respected',()=>{
  const rules=parseRobots('User-agent: *\nDisallow: /\nUser-agent: PromoSpy\nDisallow: /secret*\nAllow: /secret/public\nDisallow: /*?private=*\nCrawl-delay: 2\nSitemap: https://example.org/sitemap.xml');
  assert.equal(robotsAllows(rules,url),true);assert.equal(robotsAllows(rules,'https://example.org/secret/a'),false);assert.equal(robotsAllows(rules,'https://example.org/secret/public'),true);
  assert.equal(robotsAllows(rules,'https://example.org/x?private=1'),false);assert.equal(rules.delayMs,2000);
});
test('private and special addresses are rejected, including IPv6 transition forms',()=>{
  for(const address of ['127.0.0.1','10.1.2.3','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','192.0.2.1','198.51.100.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::'])assert.equal(publicAddress(address),false,address);
  for(const address of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111'])assert.equal(publicAddress(address),true,address);
  for(const target of ['https://example.org/login','https://example.org/cart','https://example.org/?token=secret'])assert.equal(safeSource(target,domains),false);
});
test('DNS answers are pinned for the connection; mixed public/private answers are refused',async()=>{
  const resolve=async()=>[{address:'93.184.216.34',family:4}];
  const records=await resolvePublic('example.org',AbortSignal.timeout(1000),resolve as never);
  const lookup=pinnedLookup('example.org',records);
  await new Promise<void>((accept,reject)=>lookup('example.org',{},(error,address)=>{if(error)reject(error);else{assert.equal(address,'93.184.216.34');accept();}}));
  await assert.rejects(resolvePublic('example.org',AbortSignal.timeout(1000),(async()=>[...records,{address:'127.0.0.1',family:4}]) as never));
});
test('the shared queue enforces both host and global limits without starving another host',async()=>{
  const queue=new RequestQueue(3,1,0),active=new Map<string,number>();let total=0,max=0;
  await Promise.all(['a','a','a','b','c','c'].map(host=>queue.run(host,AbortSignal.timeout(2000),async()=>{
    total++;max=Math.max(max,total);active.set(host,(active.get(host)??0)+1);assert.equal(active.get(host),1);
    await new Promise(resolve=>setTimeout(resolve,5));active.set(host,active.get(host)!-1);total--;
  })));
  assert.equal(max,3);
});
