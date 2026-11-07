type Pending={host:string;signal:AbortSignal;run:()=>Promise<unknown>;resolve:(value:unknown)=>void;reject:(reason:unknown)=>void;abort:()=>void};
export class RequestQueue {
  private pending:Pending[]=[];
  private active=0;
  private hosts=new Map<string,{active:number;next:number;delay:number}>();
  private timer:ReturnType<typeof setTimeout>|undefined;
  private globalLimit:number;
  private hostLimit:number;
  private interval:number;
  constructor(globalLimit=6,hostLimit=2,interval=500){this.globalLimit=globalLimit;this.hostLimit=hostLimit;this.interval=interval;}
  run<T>(host:string,signal:AbortSignal,run:()=>Promise<T>):Promise<T>{
    signal.throwIfAborted();
    if(this.pending.length>=128)return Promise.reject(new Error('Очередь запросов заполнена'));
    return new Promise<T>((resolve,reject)=>{
      const item:Pending={host,signal,run,resolve:resolve as (value:unknown)=>void,reject,abort:()=>{
        const index=this.pending.indexOf(item);if(index>=0)this.pending.splice(index,1);
        reject(signal.reason);this.drain();
      }};
      this.pending.push(item);signal.addEventListener('abort',item.abort,{once:true});this.drain();
    });
  }
  delayHost(host:string,delay:number){
    const state=this.hosts.get(host)??{active:0,next:0,delay:this.interval};
    const nextDelay=Math.max(this.interval,delay);
    if(state.next)state.next=Math.max(state.next,state.next-state.delay+nextDelay);
    state.delay=nextDelay;this.hosts.set(host,state);
  }
  private drain(){
    clearTimeout(this.timer);
    let next=Infinity;
    for(let i=0;i<this.pending.length&&this.active<this.globalLimit;){
      const item=this.pending[i],state=this.hosts.get(item.host)??{active:0,next:0,delay:this.interval};
      this.hosts.set(item.host,state);
      if(state.active>=this.hostLimit){i++;continue;}
      if(state.next>Date.now()){next=Math.min(next,state.next);i++;continue;}
      this.pending.splice(i,1);item.signal.removeEventListener('abort',item.abort);
      if(item.signal.aborted){item.reject(item.signal.reason);continue;}
      state.active++;state.next=Date.now()+state.delay;this.active++;
      void Promise.resolve().then(item.run).then(item.resolve,item.reject).finally(()=>{
        state.active--;this.active--;this.drain();
      });
    }
    if(this.pending.length&&next!==Infinity)this.timer=setTimeout(()=>this.drain(),Math.max(1,next-Date.now()));
    if(this.hosts.size>96)for(const [host,state] of this.hosts){
      if(!state.active&&state.next<Date.now()-60000&&!this.pending.some(item=>item.host===host))this.hosts.delete(host);
    }
  }
}
