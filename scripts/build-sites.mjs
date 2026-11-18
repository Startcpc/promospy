import {build} from 'esbuild';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.argv[2]??path.join(root,'work/sites-worker/server/index.js'));
const assets=Object.create(null);
function asset(url, mime, data) {assets[url]={mime,data:Buffer.from(data).toString('base64')};}
const common={absWorkingDir:root,bundle:true,minify:true,platform:'browser',target:'es2022',write:false,legalComments:'none',define:{'process.env.NODE_ENV':'"production"'}};
const client=await build({...common,entryPoints:['sites/client.tsx'],jsx:'automatic',alias:{'next/link':path.join(root,'sites/link.tsx')}});
asset('/client.js','text/javascript;charset=utf-8',client.outputFiles[0].contents);
const cssDir=path.join(root,'.next/static/css'),styles=(await readdir(cssDir)).filter(name=>name.endsWith('.css')).sort();
if(!styles.length)throw Error('Сначала выполните pnpm build');
let css='';
for(const name of styles)css+=await readFile(path.join(cssDir,name),'utf8');
asset('/site.css','text/css;charset=utf-8',css.replaceAll('../media/','/_next/static/media/'));
for(const name of await readdir(path.join(root,'.next/static/media')))if(name.endsWith('.woff2'))asset('/_next/static/media/'+name,'font/woff2',await readFile(path.join(root,'.next/static/media',name)));
for(const [url,mime] of Object.entries({'/images/catalog-burger.webp':'image/webp','/images/catalog-produce.webp':'image/webp','/logos/vkusvill-user.png':'image/png','/favicon.svg':'image/svg+xml'}))asset(url,mime,await readFile(path.join(root,'public',url)));
asset('/index.html','text/html;charset=utf-8','<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PromoSpy · Промокоды на еду</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/site.css"></head><body><div id="app"></div><noscript>Для поиска промокодов включите JavaScript.</noscript><script type="module" src="/client.js"></script></body></html>');
const worker=await build({...common,format:'esm',entryPoints:['sites/worker.js'],plugins:[{name:'worker-inputs',setup(api){
  api.onResolve({filter:/^site-assets$/},()=>({path:'assets',namespace:'embedded'}));
  api.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:JSON.stringify(assets),loader:'json'}));
  api.onResolve({filter:/^\.\/html-document$/},()=>({path:'cheerio',namespace:'worker-dom'}));
  api.onLoad({filter:/.*/,namespace:'worker-dom'},()=>({contents:"export {load} from 'cheerio';",resolveDir:root}));
}}]});
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,worker.outputFiles[0].contents);
console.log('Worker built at',output,worker.outputFiles[0].contents.length,'bytes');
