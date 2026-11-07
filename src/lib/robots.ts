export type RobotsRules={rules:{allow:boolean;pattern:string}[];delayMs:number;sitemaps:string[]};
function wildcard(pattern:string,text:string){
  let anchored=pattern.endsWith('$');if(anchored)pattern=pattern.slice(0,-1);
  else pattern+='*';
  let i=0,j=0,star=-1,back=0;
  while(j<text.length){
    if(pattern[i]===text[j]){i++;j++;}
    else if(pattern[i]==='*'){star=i++;back=j;}
    else if(star>=0){i=star+1;j=++back;}
    else return false;
  }
  while(pattern[i]==='*')i++;
  return i===pattern.length;
}
export function parseRobots(body:string,agent='promospy'):RobotsRules{
  const groups:{agents:string[];rules:RobotsRules['rules'];delay:number}[]=[];
  let current={agents:[] as string[],rules:[] as RobotsRules['rules'],delay:0},directives=false;
  const sitemaps:string[]=[];
  const finish=()=>{if(current.agents.length)groups.push(current);current={agents:[],rules:[],delay:0};directives=false;};
  for(const line of body.slice(0,128000).split(/\r?\n/)){
    const clean=line.replace(/#.*$/,'').trim();if(!clean)continue;
    const colon=clean.indexOf(':');if(colon<0)continue;
    const key=clean.slice(0,colon).trim().toLowerCase(),value=clean.slice(colon+1).trim();
    if(key==='sitemap'){if(value.length<=2048&&sitemaps.length<12)sitemaps.push(value);continue;}
    if(key==='user-agent'){if(directives)finish();if(value&&current.agents.length<20)current.agents.push(value.toLowerCase());continue;}
    directives=true;
    if((key==='allow'||key==='disallow')&&value&&value.length<=512&&current.rules.length<200)current.rules.push({allow:key==='allow',pattern:value.replace(/\*+/g,'*')});
    if(key==='crawl-delay'&&/^\d+(?:\.\d+)?$/.test(value))current.delay=Math.min(86400000,Number(value)*1000);
  }
  finish();
  const specific=groups.filter(group=>group.agents.some(value=>value!=='*'&&agent.includes(value)));
  const selected=specific.length?specific:groups.filter(group=>group.agents.includes('*'));
  return {rules:selected.flatMap(group=>group.rules),delayMs:Math.max(0,...selected.map(group=>group.delay)),sitemaps:[...new Set(sitemaps)]};
}
export function robotsAllows(rules:RobotsRules,url:string){
  const parsed=new URL(url);let target=parsed.pathname+parsed.search;
  try{target=decodeURI(target);}catch{}
  let best=-1,allow=true;
  for(const rule of rules.rules)if(wildcard(rule.pattern,target)){
    const specificity=rule.pattern.replace(/[*$]/g,'').length;
    if(specificity>best||specificity===best&&rule.allow){best=specificity;allow=rule.allow;}
  }
  return allow;
}
