import {useSyncExternalStore} from 'react';
import type {SquareFeedLayout} from './squareFeedLayout';
export type SquareLayoutChannel='explore'|'friends'|'user';
const prefix='frienden:square-layout:v2:';
const legacyPrefix='frienden:square-layout:v1:';
const memory=new Map<string,SquareFeedLayout>(),listeners=new Set<()=>void>();
export function getSquareFeedLayout(scope:string|null,channel:SquareLayoutChannel='explore'){
  const key=prefix+(scope??'guest')+':'+channel;
  if(!memory.has(key)){let value:SquareFeedLayout=channel==='explore'?'masonry':'list';try{const saved=localStorage.getItem(key)??(channel==='explore'?localStorage.getItem(legacyPrefix+(scope??'guest')):null);if(saved==='masonry'||saved==='list')value=saved}catch{/* Optional device storage. */}memory.set(key,value)}
  return memory.get(key)!;
}
export function setSquareFeedLayout(scope:string|null,next:SquareFeedLayout,channel:SquareLayoutChannel='explore'){const key=prefix+(scope??'guest')+':'+channel;memory.set(key,next);try{localStorage.setItem(key,next)}catch{/* Keep the in-memory preference. */}listeners.forEach(listener=>listener())}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===null||event.key.startsWith(prefix)||event.key.startsWith(legacyPrefix)){memory.clear();listeners.forEach(listener=>listener())}});
export function useSquareFeedLayout(scope:string|null,channel:SquareLayoutChannel='explore'){
  const value=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},()=>getSquareFeedLayout(scope,channel),()=>channel==='explore'?'masonry' as const:'list' as const);
  return [value,(next:SquareFeedLayout)=>setSquareFeedLayout(scope,next,channel)] as const;
}
