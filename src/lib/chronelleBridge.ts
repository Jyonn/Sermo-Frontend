const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function displayURL(value:string) {
  try {const url=new URL(value);const local=['127.0.0.1','localhost'].includes(url.hostname);
    if(!(local&&url.protocol==='http:')&&!(url.protocol==='https:'&&['chronelle.jyonn.space','chronelle.6-79.cn'].includes(url.hostname)))return null;
    if(url.username||url.password||url.search||url.hash)return null;
    const match=url.pathname.match(/^\/binding-embed\/([^/]+)\/$/);if(!match||!uuid.test(match[1]))return null;
    return {url:url.href,origin:url.origin,id:match[1]};
  }catch{return null;}
}
export type CalendarRange={start:string;end:string;timezone:string;all_day:boolean};
export type BridgeReply={type:'state';payload:{state:string;coverage?:string;availability?:string;code?:string}}|{type:'range-selected';payload:CalendarRange};
export function trustedReply(event:{origin:string;source:unknown;data:unknown},source:unknown,origin:string,channel:string,request:string) {
  return source && event.source===source && event.origin===origin ? bridgeReply(event.data,channel,request) : null;
}
export function bridgeReply(value:unknown,channel:string,request:string):BridgeReply|null {
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,any>;
  if(v.protocol!=='chronelle.calendar'||v.version!==1||v.channel!==channel||v.request_id!==request||!v.payload||typeof v.payload!=='object')return null;
  const p=v.payload;
  if(v.type==='state'&&['loading','ready','permission-denied','login-expired','load-failed'].includes(p.state))return {type:'state',payload:{state:p.state,coverage:p.coverage,availability:p.availability,code:typeof p.code==='string'?p.code:undefined}};
  if(v.type==='range-selected'&&typeof p.all_day==='boolean'&&typeof p.start==='string'&&typeof p.end==='string'&&typeof p.timezone==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(p.start)&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(p.end)&&Number.isFinite(Date.parse(p.start))&&Date.parse(p.end)>Date.parse(p.start)&&Date.parse(p.end)-Date.parse(p.start)<=90000000){
    try{new Intl.DateTimeFormat('en',{timeZone:p.timezone});}catch{return null;}
    return {type:'range-selected',payload:{start:p.start,end:p.end,timezone:p.timezone,all_day:p.all_day}};
  }
  return null;
}
export function localInput(iso:string) {
  const d=new Date(iso),pad=(n:number)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
