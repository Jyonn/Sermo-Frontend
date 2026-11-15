export const DROP_API_ORIGIN='https://api.drop.jyonn.space';
export const DROP_ORIGIN='https://drop.jyonn.space';
export const DROP_ICON=DROP_API_ORIGIN+'/static/web/drop-icon.png';
const id=/^[A-Za-z0-9._~-]{1,128}$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const DROP_FIELDS=['text','occurred_at','audio','city','place','latitude','longitude'];
export function dropShareUrl(value:unknown){
  if(typeof value!=='string')return null;
  try{const url=new URL(value);const token=url.searchParams.getAll('share');if(url.origin!==DROP_ORIGIN||url.username||url.password||url.pathname!=='/'||url.hash||[...url.searchParams.keys()].length!==1||token.length!==1||!/^[-\w]{43}$/.test(token[0]))return null;return DROP_ORIGIN+'/?share='+token[0]}catch{return null}
}
export function readDropPickerMessage(event:MessageEvent,frame:Window|null){
  if(!frame||event.source!==frame||event.origin!==DROP_API_ORIGIN)return null;
  const m=event.data;if(!m||m.version!==1)return null;
  if(m.type==='drop.picker.ready')return {type:'ready'} as const;
  if(m.type==='drop.picker.cancelled')return {type:'cancelled'} as const;
  if(m.type==='drop.picker.selected'){const url=dropShareUrl(m.url);return url?{type:'selected',url} as const:null}
  if(m.type!=='drop.picker.request'||typeof m.requestId!=='string'||!id.test(m.requestId))return null;
  if(m.action==='entries'&&typeof m.query==='string'&&m.query.length<=200&&Number.isSafeInteger(m.offset)&&m.offset>=0&&m.offset<=100000)return {type:'entries',requestId:m.requestId,query:m.query,offset:m.offset} as const;
  if(m.action==='share'&&Array.isArray(m.entryIds)&&m.entryIds.length>=1&&m.entryIds.length<=100&&m.entryIds.every((x:unknown)=>typeof x==='string'&&uuid.test(x))&&new Set(m.entryIds).size===m.entryIds.length&&Array.isArray(m.fields)&&m.fields.every((x:unknown)=>typeof x==='string'&&DROP_FIELDS.includes(x))&&m.fields.includes('text')&&m.fields.includes('occurred_at')&&new Set(m.fields).size===m.fields.length&&Number.isSafeInteger(m.expiresIn)&&m.expiresIn>=60&&m.expiresIn<=2592000&&typeof m.operationId==='string'&&id.test(m.operationId))return {type:'share',requestId:m.requestId,entryIds:m.entryIds as string[],fields:m.fields as string[],expiresIn:m.expiresIn,operationId:m.operationId} as const;
  return null;
}
export interface DropShare {id:string;url:string;fields:string[];expires_at:string}
