// Real HTTP only: saves source documents and robots receipts outside the search cache.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PublicHttpClient, decodeSource, type PublicDocument } from '../src/lib/public-http';
import { PUBLIC_CATALOGUES } from '../src/lib/source-catalog';
import { getCompanyById } from '../src/lib/promocodes';
import { parseMerchantPage } from '../src/lib/web-search';
import { sourceParser, publicSources, officialDomains } from '../src/lib/source-adapters';
import { isChallengePage, isLoginWall } from '../src/lib/source-extraction';
import { closeSourceDispatchers, sourceHost } from '../src/lib/fetch-policy';

const ids=process.argv.slice(2).map(Number);
if(ids.some(id=>!getCompanyById(id)))throw new Error('Передайте числовые ID магазинов, например: pnpm audit:sources 54');
const directory=path.resolve('work','source-audit-'+new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(directory,{recursive:true});
const problem=(error:unknown)=>error instanceof Error?{...error,name:error.name,message:error.message}:String(error);
class AuditClient extends PublicHttpClient {
  private sequence=0;
  override async read(...args:Parameters<PublicHttpClient['read']>):Promise<PublicDocument>{
    const number=++this.sequence,startedAt=Date.now();
    try{
      const document=await super.read(...args);
      writeFileSync(path.join(directory,`${number}.body`),document.body);
      writeFileSync(path.join(directory,`${number}.json`),JSON.stringify({startedAt,kind:args[3]?.kind??'document',contentType:document.contentType,...document.receipt},null,2));
      return document;
    }catch(error){
      writeFileSync(path.join(directory,`${number}.json`),JSON.stringify({url:args[0],startedAt,observedAt:Date.now(),kind:args[3]?.kind??'document',error:problem(error)},null,2));
      throw error;
    }
  }
}
const jobs=PUBLIC_CATALOGUES.flatMap(source=>Object.entries(source.pages).flatMap(([id,urls])=>urls.map(url=>({id:Number(id),url,source:source.name,official:false})))).filter(job=>!ids.length||ids.includes(job.id));
const selected=[...new Set(jobs.map(job=>job.id))];
for(const id of selected)for(const url of publicSources.officialUrls(getCompanyById(id)!))jobs.push({id,url,source:'Официальный сайт',official:true});
const client=new AuditClient(),results:unknown[]=[];
let cursor=0;
console.log(`Документы и отчёт: ${directory}`);
try{
  await Promise.all(Array.from({length:3},async()=>{
    while(cursor<jobs.length){
      const job=jobs[cursor++],company=getCompanyById(job.id)!;
      let result;
      try{
        const domains=job.official?officialDomains(company):[sourceHost(job.url)];
        const document=await client.read(job.url,domains,AbortSignal.timeout(25000));
        const html=decodeSource(document.body,document.contentType);
        const blocked=isChallengePage(html)||isLoginWall(html);
        const adapter=job.official?sourceParser(company,document.receipt.finalUrl,html):undefined;
        const diagnostics={incomplete:false,reasons:[] as string[]};
        const codes=blocked?[]:adapter?adapter.parse(html,document.receipt.finalUrl,Date.now()):parseMerchantPage(html,document.receipt.finalUrl,company,Date.now(),job.official,diagnostics);
        result={...job,receipt:document.receipt,blocked,diagnostics,codes};
        console.log(`${job.id} ${job.url}: HTTP ${document.receipt.status}, ${codes.length} предложений${blocked?', стена доступа':''}`);
      }catch(error){result={...job,error:problem(error)};console.log(`${job.id} ${job.url}: ${error instanceof Error?error.message:String(error)}`);}
      results.push(result);writeFileSync(path.join(directory,'summary.json'),JSON.stringify(results,null,2));
    }
  }));
}finally{await closeSourceDispatchers();}
