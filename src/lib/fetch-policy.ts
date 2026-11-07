import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createRequire } from 'node:module';
import type { LookupFunction } from 'node:net';
import type { Dispatcher } from 'undici';
import { validSourceUrl } from './promo-validation';
const {Agent,EnvHttpProxyAgent} = createRequire(import.meta.url)('undici') as typeof import('undici');
export const sourceHost = (value: string) => new URL(value).hostname.toLowerCase().replace(/^www\./,'');
export function safeSource(value: string, domains: readonly string[]): boolean {
  try {
    const url = new URL(value);
    return validSourceUrl(value) && !url.port && !isIP(url.hostname) && !/(?:^|\.)localhost(?:\.localdomain)?$/.test(url.hostname) && domains.includes(sourceHost(value)) &&
      !/(?:^|\/)(?:login|signin|account|cart|checkout|basket|oauth|authorize|register)(?:\/|$)/i.test(url.pathname) &&
      ![...url.searchParams.keys()].some(key=>/^(?:access_token|token|api[_-]?key|client_secret|password|session(?:id)?)$/i.test(key));
  } catch {return false;}
}
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || a===169&&b===254 || a===172&&b>=16&&b<=31 ||
      a===192&&(b===168 || b===0&&c===0 || b===0&&c===2) || a===100&&b>=64&&b<=127 ||
      a===198&&(b===18||b===19||b===51&&c===100) || a===203&&b===0&&c===113);
  }
  if (isIP(address) !== 6) return false;
  const value=address.toLowerCase(),first=parseInt(value.split(':')[0],16);
  // Global unicast only; exclude documentation and transition/tunnel prefixes.
  return first>=0x2000&&first<=0x3fff&&!/^2001:(?:0*:|0*db8:|0*1[0-9a-f]:|0*2[0-9a-f]:)|^2002:/i.test(value);
}
export function routedThroughProxy(value: string, env: Record<string,string|undefined> = process.env) {
  if (!(env.https_proxy||env.HTTPS_PROXY)) return false;
  const target=new URL(value);
  return !(env.no_proxy||env.NO_PROXY||'').split(',').some(entry=>{
    const rule=entry.trim().toLowerCase();if(rule==='*')return true;if(!rule)return false;
    const [domain,port]=rule.replace(/^\*?\./,'').split(':');
    return (!port||port===(target.port||'443'))&&(target.hostname===domain||target.hostname.endsWith('.'+domain));
  });
}
export type AddressRecord={address:string;family:number};
export function pinnedLookup(hostname: string, records: AddressRecord[]): LookupFunction {
  // The connection uses this immutable answer, rather than resolving again after validation.
  return ((name: string, options: {all?:boolean;family?:number}, callback: (...args: unknown[])=>void)=>{
    if(name.toLowerCase()!==hostname.toLowerCase())return callback(new Error('Имя соединения изменилось'));
    const selected=records.filter(record=>!options.family||record.family===options.family);
    if(!selected.length)return callback(new Error('Нет разрешённого адреса нужного семейства'));
    if(options.all)callback(null,selected);else callback(null,selected[0].address,selected[0].family);
  }) as LookupFunction;
}
export async function resolvePublic(hostname: string, signal: AbortSignal, resolve = lookup): Promise<AddressRecord[]> {
  signal.throwIfAborted();
  const records=await new Promise<AddressRecord[]>((accept,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    resolve(hostname,{all:true}).then(accept,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
  if(!records.length||records.some(record=>!publicAddress(record.address)))throw Object.assign(new Error('Непубличный адрес источника'),{code:'ERR_SOURCE_ADDRESS'});
  return records;
}
const agents=new Map<string,{agent:Dispatcher;at:number}>();
let proxy: {key:string;agent:Dispatcher}|undefined;
export async function sourceDispatcher(url: string, signal: AbortSignal): Promise<Dispatcher> {
  if(routedThroughProxy(url)){
    const key=[process.env.HTTPS_PROXY,process.env.https_proxy,process.env.NO_PROXY,process.env.no_proxy].join('|');
    if(proxy?.key!==key){void proxy?.agent.close();proxy={key,agent:new EnvHttpProxyAgent()};}
    return proxy!.agent;
  }
  const hostname=new URL(url).hostname;
  const records=await resolvePublic(hostname,signal),key=hostname+'|'+records.map(record=>record.address).sort().join(',');
  const previous=agents.get(key);
  if(previous){previous.at=Date.now();return previous.agent;}
  if(agents.size>=24){
    const oldest=[...agents].sort((a,b)=>a[1].at-b[1].at)[0];
    agents.delete(oldest[0]);void oldest[1].agent.close();
  }
  const agent=new Agent({connect:{lookup:pinnedLookup(hostname,records),timeout:8000},keepAliveTimeout:10000,connections:2});
  agents.set(key,{agent,at:Date.now()});return agent;
}
export async function closeSourceDispatchers() {
  const all=[...agents.values()].map(item=>item.agent);
  agents.clear();if(proxy){all.push(proxy.agent);proxy=undefined;}
  await Promise.allSettled(all.map(agent=>agent.close()));
}
