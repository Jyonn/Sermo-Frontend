import {api} from './api';
import {actionsForKind, type ChatActionKind, type ChatQuickAction} from './chatQuickActions';

export interface ShortcutSnapshot {
  preferences: Record<ChatActionKind, ChatQuickAction[]>;
  configured: boolean;
  revision: number;
  call_hint_seen: boolean;
}
type Entry = {value: ShortcutSnapshot; loaded: boolean; pending?: Promise<void>; queue: Promise<unknown>; listeners: Set<()=>void>};
const entries = new Map<string, Entry>();
export const shortcutCacheKey = (scope:string) => `frienden:chat-quick-actions:v2:${scope}`;
function cached(scope:string): unknown {
  try {return JSON.parse(localStorage.getItem(shortcutCacheKey(scope)) ?? localStorage.getItem(`frienden:chat-quick-actions:v1:${scope}`) ?? 'null')} catch {return null}
}
function entry(scope:string) {
  let item=entries.get(scope);
  if(!item){const value=cached(scope);item={value:{preferences:{direct:actionsForKind(value,'direct'),group:actionsForKind(value,'group')},configured:false,revision:-1,call_hint_seen:false},loaded:false,queue:Promise.resolve(),listeners:new Set()};entries.set(scope,item)}
  return item;
}
function accept(scope:string,value:ShortcutSnapshot){
  const item=entry(scope);
  if(value.revision<item.value.revision)return;
  item.value=value;item.loaded=true;
  try{if(value.configured)localStorage.setItem(shortcutCacheKey(scope),JSON.stringify(value.preferences))}catch{/* Server saves do not depend on browser storage. */}
  item.listeners.forEach(listener=>listener());
}
export const shortcutSnapshot=(scope:string)=>entry(scope).value;
export function subscribeShortcuts(scope:string,listener:()=>void){const item=entry(scope);item.listeners.add(listener);return()=>{item.listeners.delete(listener)}}
export async function refreshChatShortcuts(scope:string){
  if(!scope)return;
  const item=entry(scope);
  if(item.pending)return item.pending;
  item.pending=(async()=>{
    const legacy=cached(scope);
    let value=await api.getChatQuickActions(scope);
    if(!value.configured && legacy!==null){
      value=await api.saveChatQuickActions(scope,{migrate:{direct:actionsForKind(legacy,'direct'),group:actionsForKind(legacy,'group')}});
    }
    accept(scope,value);
  })().finally(()=>{item.pending=undefined});
  return item.pending;
}
export async function saveChatShortcuts(scope:string,body:unknown):Promise<boolean>{
  if(!scope)return false;
  const item=entry(scope);
  const job=item.queue.catch(()=>undefined).then(async()=>{
    if(!item.loaded)await refreshChatShortcuts(scope);
    accept(scope,await api.saveChatQuickActions(scope,body));
  });
  item.queue=job;
  try{await job;return true}catch{return false}
}
