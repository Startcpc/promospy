import { mkdir, mkdtemp, readFile, writeFile, rename, rm, readdir, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { companies } from '../src/lib/companies.ts';
import { parseSearchCache, MAX_CACHE_BYTES } from '../src/lib/search-cache.ts';
import { validReport } from '../src/lib/promo-validation.ts';

const root = fileURLToPath(new URL('../',import.meta.url));
const prefix = 'promospy-search-';
const filename = () => `${prefix}${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.json`;
const missing = error => error?.code === 'ENOENT';
// Offline migration only. These IDs never become active search merchants.
const legacyIds = new Set([5,54,102,201,202,203,204,205,206,207,208,301,302]);

async function readBounded(filename, limit) {
  const info = await lstat(filename);
  if (!info.isFile() || info.size > limit) throw new Error('Резервная копия или кеш слишком большой либо не является обычным файлом.');
  return readFile(filename,'utf8');
}
export async function backupSearchCache(directory, backups, keep = 7) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('Количество копий должно быть положительным целым числом.');
  const entries = [];
  for (const {id} of companies) {
    let raw;
    try {raw=await readBounded(path.join(directory,`${id}.json`),MAX_CACHE_BYTES);} catch(error){if(missing(error))continue;throw error;}
    const item = parseSearchCache(raw,id);
    if (!item || item.report.codes.length!==JSON.parse(raw).report.codes.length) throw new Error(`Кеш магазина ${id} повреждён. Существующие резервные копии сохранены.`);
    entries.push(item);
  }
  if (!entries.length) throw new Error('Нет сохранённых результатов для резервирования. Сначала откройте магазин.');
  await mkdir(backups,{recursive:true,mode:0o700});
  const destination = path.join(backups,filename()), temporary = destination+'.tmp';
  try {
    await writeFile(temporary,JSON.stringify({format:'promospy-search-cache',version:1,createdAt:Date.now(),entries}),{mode:0o600,flag:'wx'});
    await rename(temporary,destination);
  } finally {await rm(temporary,{force:true});}
  const copies = await Promise.all((await readdir(backups)).filter(name=>/^promospy-search-\d{4}-\d{2}-\d{2}T[\d.-]+Z-[a-f\d-]{36}\.json$/.test(name)).map(async name=>({name,info:await lstat(path.join(backups,name))})));
  // A VkusVill-only snapshot cannot replace the historical data in a mixed
  // backup. Rotate validated active backups only; keep legacy/corrupt copies.
  const activeCopies = [];
  for(const copy of copies){
    if(!copy.info.isFile()||path.join(backups,copy.name)===destination)continue;
    try{
      const data=JSON.parse(await readBounded(path.join(backups,copy.name),MAX_CACHE_BYTES+10000));
      if(data?.format==='promospy-search-cache'&&data.version===1&&Array.isArray(data.entries)&&data.entries.length===1&&data.entries[0]?.companyId===54){
        const parsed=parseSearchCache(JSON.stringify(data.entries[0]),54);
        if(parsed&&parsed.report.codes.length===data.entries[0].report.codes.length)activeCopies.push(copy);
      }
    }catch{ /* An unreadable or legacy backup is never discarded by rotation. */ }
  }
  const expired = activeCopies.sort((a,b)=>b.info.mtimeMs-a.info.mtimeMs||b.name.localeCompare(a.name)).slice(keep-1);
  for (const item of expired) await rm(path.join(backups,item.name));
  return {filename:destination,count:entries.length};
}

export async function restoreSearchCache(backup, directory, move = rename) {
  const raw = await readBounded(backup,MAX_CACHE_BYTES*legacyIds.size+10000);
  let data;
  try {data=JSON.parse(raw);} catch {throw new Error('Резервная копия содержит некорректный JSON.');}
  if (data?.format!=='promospy-search-cache'||data.version!==1||!Array.isArray(data.entries)||!data.entries.length||data.entries.length>legacyIds.size) throw new Error('Неизвестный формат резервной копии.');
  const unique = new Set(), entries = [];
  for (const entry of data.entries) {
    if(!legacyIds.has(entry?.companyId)||unique.has(entry.companyId)||!validReport(entry.report))throw new Error('Резервная копия повреждена. Текущие результаты не изменены.');
    unique.add(entry.companyId);
    if(!companies.some(company=>company.id===entry.companyId))continue;
    const parsed = parseSearchCache(JSON.stringify(entry),entry?.companyId);
    if (!parsed || parsed.report.codes.length!==entry.report.codes.length) throw new Error('Резервная копия повреждена. Текущие результаты не изменены.');
    entries.push(parsed);
  }
  if(!entries.length)throw new Error('В копии нет результатов ВкусВилл. Текущие данные не изменены.');
  const target = path.resolve(directory), parent = path.dirname(target);
  await mkdir(parent,{recursive:true});
  let existing;
  try {existing=await lstat(target);} catch(error){if(!missing(error))throw error;}
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new Error('Каталог восстановления должен быть обычной папкой.');
  if (existing) {
    const names=await readdir(target,{withFileTypes:true});
    if (names.some(item=>item.isDirectory()||item.isSymbolicLink()) || names.length && !names.some(item=>[...legacyIds].some(id=>item.name===`${id}.json`))) throw new Error('Выбранная папка не похожа на кеш PromoSpy. Восстановление отменено.');
  }
  const stage = await mkdtemp(path.join(parent,`.${path.basename(target)}-restore-`));
  const previous = `${target}.before-restore-${randomUUID()}`;
  let moved = false;
  try {
    for (const entry of entries) await writeFile(path.join(stage,`${entry.companyId}.json`),JSON.stringify(entry),{mode:0o600,flag:'wx'});
    if (existing) {await move(target,previous);moved=true;}
    try {await move(stage,target);} catch(error){if(moved)await rename(previous,target);throw error;}
    return {count:entries.length,previous:moved?previous:null};
  } finally {await rm(stage,{recursive:true,force:true});}
}

async function main() {
  if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
  const args=process.argv.slice(2),[action,file]=args;
  const directory=path.resolve(root,process.env.PROMO_SEARCH_DATA_DIR??'.cache/promo-search');
  if(action==='backup'&&args.length===1) {
    const result=await backupSearchCache(directory,path.resolve(root,process.env.PROMO_SEARCH_BACKUP_DIR??'.cache/search-backups'));
    console.log(`Сохранено магазинов: ${result.count}\nРезервная копия: ${result.filename}`);
  } else if(action==='restore'&&file&&args.length===2) {
    const result=await restoreSearchCache(path.resolve(file),directory);
    console.log(`Восстановлено магазинов: ${result.count}. Исходные даты сохранены.`);
    if(result.previous)console.log(`Предыдущий каталог: ${result.previous}`);
  } else throw new Error('Использование: pnpm cache:backup или pnpm cache:restore ПУТЬ_К_КОПИИ. Перед восстановлением остановите сайт.');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
