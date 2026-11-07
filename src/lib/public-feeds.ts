import { createRequire } from 'node:module';
import type { Company } from './companies';
import type { PromoCode } from './promocodes';
import { matchesMerchant, extractCouponCards } from './source-extraction';
import { foreignMerchantHeading } from './promo-quality';
import { mergeOffers } from './offer-identity';
const {load}=createRequire(import.meta.url)('cheerio') as typeof import('cheerio');
const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function parsePublicFeed(text:string,url:string,company:Company,now=Date.now()):PromoCode[]{
  let feedTitle='',entries:{title:string;body:string}[]=[];
  if(/^\s*\{/.test(text)){
    try{
      const data=JSON.parse(text);
      if(typeof data.version!=='string'||!data.version.startsWith('https://jsonfeed.org/')||!Array.isArray(data.items))return [];
      feedTitle=typeof data.title==='string'?data.title:'';
      entries=data.items.slice(0,100).filter((item:unknown)=>!!item&&typeof item==='object').map((item:Record<string,unknown>)=>({title:typeof item.title==='string'?item.title:'',body:typeof item.content_html==='string'?item.content_html:typeof item.content_text==='string'?escape(item.content_text):''}));
    }catch{return [];}
  }else{
    const $=load(text,{xmlMode:true});if(!$('rss,feed').length)return [];
    feedTitle=$('channel > title,feed > title').first().text();
    entries=$('item,entry').slice(0,100).toArray().map(element=>({title:$(element).children('title').text(),body:$(element).children('description,content,summary').first().text()}));
  }
  const codes:PromoCode[]=[];
  for(const {title,body} of entries){
    if(foreignMerchantHeading(title,company.id)||!matchesMerchant(title,company)&&!matchesMerchant(feedTitle,company))continue;
    codes.push(...extractCouponCards('<h1>'+escape(company.name)+'</h1><article><h3>'+escape(title)+'</h3>'+body.slice(0,20000)+'</article>',url,company,now,true));
  }
  return mergeOffers(codes);
}
