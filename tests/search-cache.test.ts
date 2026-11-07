import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { backupSearchCache, restoreSearchCache } from '../scripts/search-cache.mjs';
import { readSearchCache, parseSearchCache, MAX_CACHE_BYTES } from '../src/lib/search-cache';

const offer={id:'54:1раз',companyId:54,code:'1раз',description:'Первый заказ',discount:'200 ₽',status:'official',checked:100,found:100,conditions:['От 1000 рублей'],sources:[{url:'https://vkusvill.ru/promocodes/',name:'vkusvill.ru',seenAt:100}]};
const entry={companyId:54,at:200,report:{phase:'complete',codes:[offer],targetSites:30,discoveredSites:1,pagesRead:1,pagesFailed:0,visited:[offer.sources[0].url],warnings:[],sourceResults:[{url:offer.sources[0].url,official:true,outcome:'codes',count:1}]}};
async function temporary(run:(directory:string)=>Promise<void>){const directory=await mkdtemp(path.join(tmpdir(),'promospy-backup-'));try{await run(directory);}finally{await rm(directory,{recursive:true,force:true});}}

test('search backup restores conditions and original timestamps and preserves the pre-restore directory',()=>temporary(async root=>{
 const data=path.join(root,'data'),copies=path.join(root,'copies');await mkdir(data);await writeFile(path.join(data,'54.json'),JSON.stringify(entry));
 const backup=await backupSearchCache(data,copies);assert.equal(backup.count,1);
 await writeFile(path.join(data,'54.json'),'corrupt newer file');await writeFile(path.join(data,'unrelated.txt'),'keep');
 const restored=await restoreSearchCache(backup.filename,data);
 assert.deepEqual(await readSearchCache(54,data),entry);assert.ok(restored.previous);
 assert.equal(await readFile(path.join(restored.previous!,'54.json'),'utf8'),'corrupt newer file');
 assert.equal(await readFile(path.join(restored.previous!,'unrelated.txt'),'utf8'),'keep');
}));
test('backup rotation retains its requested copies and leaves unrelated files alone',()=>temporary(async root=>{
 const data=path.join(root,'data'),copies=path.join(root,'copies');await mkdir(data);await mkdir(copies);await writeFile(path.join(data,'54.json'),JSON.stringify(entry));
 await writeFile(path.join(copies,'notes.json'),'keep');
 for(let i=0;i<4;i++)await backupSearchCache(data,copies,2);
 const files=await readdir(copies);assert.equal(files.filter(name=>name.startsWith('promospy-search-')).length,2);assert.ok(files.includes('notes.json'));assert.ok(!files.some(name=>name.endsWith('.tmp')));
}));
test('invalid backup is rejected before any current data is changed',()=>temporary(async root=>{
 const data=path.join(root,'data'),file=path.join(root,'bad.json');await mkdir(data);await writeFile(path.join(data,'54.json'),JSON.stringify(entry));
 for(const value of ['{',JSON.stringify({format:'unknown',version:1,entries:[entry]}),JSON.stringify({format:'promospy-search-cache',version:1,entries:[entry,entry]}),JSON.stringify({format:'promospy-search-cache',version:1,entries:[{...entry,companyId:999}]})]){
  await writeFile(file,value);await assert.rejects(restoreSearchCache(file,data));assert.deepEqual(await readSearchCache(54,data),entry);
 }
 assert.deepEqual((await readdir(root)).sort(),['bad.json','data']);
}));
test('a failed switch restores the previous directory and cleans staged files',()=>temporary(async root=>{
 const data=path.join(root,'data'),copies=path.join(root,'copies');await mkdir(data);await writeFile(path.join(data,'54.json'),JSON.stringify(entry));
 const backup=await backupSearchCache(data,copies);let moves=0;
 await assert.rejects(restoreSearchCache(backup.filename,data,async(from,to)=>{if(++moves===2)throw Error('disk switch failure');await rename(from,to);}),/disk switch failure/);
 assert.deepEqual(await readSearchCache(54,data),entry);assert.deepEqual((await readdir(root)).sort(),['copies','data']);
}));
test('broken or missing source data cannot replace existing backups with an empty copy',()=>temporary(async root=>{
 const data=path.join(root,'data'),copies=path.join(root,'copies');await mkdir(data);await writeFile(path.join(data,'54.json'),JSON.stringify(entry));
 const backup=await backupSearchCache(data,copies);
 await writeFile(path.join(data,'54.json'),'{');await assert.rejects(backupSearchCache(data,copies));
 await rm(path.join(data,'54.json'));await assert.rejects(backupSearchCache(data,copies));
 assert.deepEqual(await readdir(copies),[path.basename(backup.filename)]);
}));
test('cache size is measured in bytes so multi-byte data cannot evade the bound',()=>{
 const raw=JSON.stringify({...entry,report:{...entry.report,warnings:['Ж'.repeat(MAX_CACHE_BYTES/2)]}});
 assert.ok(raw.length<MAX_CACHE_BYTES);assert.equal(parseSearchCache(raw,54),null);
});
test('restore refuses unrelated folders and backup refuses partially corrupt records',()=>temporary(async root=>{
 const data=path.join(root,'data'),copies=path.join(root,'copies'),unrelated=path.join(root,'documents');
 await mkdir(data);await mkdir(unrelated);await writeFile(path.join(unrelated,'important.txt'),'keep');await writeFile(path.join(data,'54.json'),JSON.stringify(entry));
 const backup=await backupSearchCache(data,copies);await assert.rejects(restoreSearchCache(backup.filename,unrelated),/не похожа/);
 assert.equal(await readFile(path.join(unrelated,'important.txt'),'utf8'),'keep');
 await writeFile(path.join(data,'54.json'),JSON.stringify({...entry,report:{...entry.report,codes:[offer,null]}}));
 await assert.rejects(backupSearchCache(data,copies),/повреждён/);assert.equal((await readdir(copies)).length,1);
}));
test('cache CLI works from another working directory and restores without changing timestamps',()=>temporary(async root=>{
 const data=path.join(root,'data'),copies=path.join(root,'copies');await mkdir(data);await writeFile(path.join(data,'54.json'),JSON.stringify(entry));
 const loader=fileURLToPath(new URL('../scripts/register-ts.mjs',import.meta.url)),script=fileURLToPath(new URL('../scripts/search-cache.mjs',import.meta.url));
 const options={cwd:root,env:{...process.env,PROMO_SEARCH_DATA_DIR:data,PROMO_SEARCH_BACKUP_DIR:copies},encoding:'utf8' as const};
 const output=execFileSync(process.execPath,['--import',loader,script,'backup'],options);assert.match(output,/Сохранено магазинов: 1/);
 const file=path.join(copies,(await readdir(copies))[0]);await writeFile(path.join(data,'54.json'),'{');
 assert.match(execFileSync(process.execPath,['--import',loader,script,'restore',file],options),/Восстановлено магазинов: 1/);
 assert.deepEqual(await readSearchCache(54,data),entry);
}));
