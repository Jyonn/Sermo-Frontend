import type {ChatMessage} from '../types';
export interface SystemMessageContext {viewerId?:number;peer?:{user_id:number;name:string}|null;groupTitle?:string}
export type SystemPart=string|{userId:number;name:string;self:boolean};
export function systemMessageParts(message:Pick<ChatMessage,'text'|'payload'|'userId'|'name'|'from'>,context:SystemMessageContext,t:(key:string,values?:Record<string,unknown>)=>string):SystemPart[]{
  const actor=message.payload?.actor_user_id??message.userId;
  const viewer=context.viewerId??(message.from==='self'?actor:undefined);
  const users=new Map<number,string>((message.payload?.reference_users??[]).map(user=>[user.user_id,user.name]));
  if(actor)users.set(actor,message.name||message.payload?.actor_name||'');
  if(context.peer)users.set(context.peer.user_id,context.peer.name);
  if(viewer!==undefined&&!users.has(viewer))users.set(viewer,t('common.me'));
  let text=message.payload?.reference_text||message.text;
  if(message.payload?.event==='travel_map_shared'||message.payload?.kind==='map_access'&&message.payload.chat_grant){
    const recipient=actor===viewer?context.peer?.user_id:viewer;
    text=t('message.system.footprintsShared',{actor:`<@${actor}>`,target:context.groupTitle??(recipient?`<@${recipient}>`:t('message.system.thisChat'))});
  }else if(message.payload?.event==='bgm_entrance'||message.payload?.bgm_entrance){
    text=t('bgm.entranceMessage',{actor:`<@${actor}>`});
  }else if(!message.payload?.reference_text&&actor){
    // Old cached messages still have an authoritative sender ID. Never infer
    // additional identities by matching nicknames, which may be duplicated.
    const oldName=message.payload?.actor_name||message.name;
    if(oldName&&text.startsWith(oldName))text=`<@${actor}>${text.slice(oldName.length)}`;
  }
  const parts:SystemPart[]=[];let cursor=0;
  for(const match of text.matchAll(/<@(\d+)>/g)){
    const index=match.index!;if(index>cursor)parts.push(text.slice(cursor,index));
    const id=Number(match[1]);parts.push(users.has(id)?{userId:id,name:id===viewer?t('common.me'):users.get(id)!,self:id===viewer}:match[0]);cursor=index+match[0].length;
  }
  if(cursor<text.length)parts.push(text.slice(cursor));
  return parts;
}
