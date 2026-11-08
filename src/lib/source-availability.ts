import { sourceHost } from './fetch-policy';
import { sourceIdentity } from './promo-validation';
import { SourceError } from './public-http';
type Pause={retryAt:number;message:string;httpStatus?:number;errorCode:string;failureUrl:string};
/** Bounded, process-local cooldown. No cookies, credentials or challenge solving. */
export class SourceAvailability {
  private pauses=new Map<string,Pause>();
  private key(url:string){return sourceIdentity(url);}
  get(url:string,now=Date.now()):Pause|undefined{
    for(const key of ['host:'+sourceHost(url),this.key(url)]){
      const pause=this.pauses.get(key);
      if(pause&&pause.retryAt>now)return pause;
      if(pause)this.pauses.delete(key);
    }
  }
  remember(url:string,error:SourceError,now=Date.now()){
    const restricted=['restricted','robots','rate_limit'].includes(error.code)||[401,403,404,429].includes(error.status??0);
    if(!restricted)return;
    // A denied private path must not suppress another public path on the host.
    // An explicit challenge/login wall or a denied root is host-wide evidence.
    const hostWide=error.code==='rate_limit'||error.status===429||error.code==='restricted'&&(!error.status||error.status<400||new URL(url).pathname==='/')||error.code==='robots'&&new URL(error.url).pathname==='/robots.txt';
    const key=hostWide?'host:'+sourceHost(url):this.key(url);
    this.pauses.delete(key);
    this.pauses.set(key,{retryAt:Math.max(error.retryAt??0,now+15*60_000),message:error.message.slice(0,500),httpStatus:error.status,errorCode:error.code,failureUrl:error.url});
    while(this.pauses.size>500)this.pauses.delete(this.pauses.keys().next().value!);
  }
}
