import {useSyncExternalStore} from 'react';
import type {SquareFeedLayout} from './squareFeedLayout';
const prefix='frienden:square-layout:v1:';
const memory=new Map<string,SquareFeedLayout>(),listeners=new Set<()=>void>();
export function getSquareFeedLayout(scope:string|null){
  const key=prefix+(scope??'guest');
  if(!memory.has(key)){let value:SquareFeedLayout='list';try{if(localStorage.getItem(key)==='masonry')value='masonry'}catch{/* Optional device storage. */}memory.set(key,value)}
  return memory.get(key)!;
}
export function setSquareFeedLayout(scope:string|null,next:SquareFeedLayout){const key=prefix+(scope??'guest');memory.set(key,next);try{localStorage.setItem(key,next)}catch{/* Keep the in-memory preference. */}listeners.forEach(listener=>listener())}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===null||event.key.startsWith(prefix)){if(event.key)memory.delete(event.key);else memory.clear();listeners.forEach(listener=>listener())}});
export function useSquareFeedLayout(scope:string|null){
  const value=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},()=>getSquareFeedLayout(scope),()=>'list' as SquareFeedLayout);
  return [value,(next:SquareFeedLayout)=>setSquareFeedLayout(scope,next)] as const;
}
