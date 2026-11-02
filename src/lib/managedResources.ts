import {useEffect, useSyncExternalStore} from 'react';
import {api, ApiError} from './api';
import type {ResourceCollectionDTO} from '../types';

const records = new Map<string, ResourceCollectionDTO | null>();
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<ResourceCollectionDTO>>();
const refreshed = new Map<string, number>();
const key = (slug:string) => `frienden:resources:v1:${slug}`;
const subscribe = (listener:()=>void) => {listeners.add(listener);return()=>{listeners.delete(listener)}};
function snapshot(slug:string) {
  if (!records.has(slug)) {
    let value:ResourceCollectionDTO|null=null;
    try {
      const stored=JSON.parse(localStorage.getItem(key(slug))||'null');
      if(stored?.slug===slug&&Array.isArray(stored.assets)&&stored.assets.every((a:unknown)=>a&&typeof a==='object'&&typeof (a as {slug?:unknown}).slug==='string'&&typeof (a as {thumbnail_uri?:unknown}).thumbnail_uri==='string'))value=stored;
    }catch{/* Cache is optional. */}
    records.set(slug,value);
  }
  return records.get(slug) ?? null;
}
export function loadResourceCollection(slug:string, force=false) {
  const existing=pending.get(slug);
  if(existing)return existing;
  if(!force&&Date.now()-(refreshed.get(slug)??0)<300_000&&snapshot(slug))return Promise.resolve(snapshot(slug)!);
  const task=api.getResourceCollection(slug).catch(error=>{
    if(!(error instanceof ApiError)||error.status!==404)throw error;
    return {...snapshot(slug),collection_id:0,slug,title:'',title_en:'',version:'',category:'emoji' as const,published:false,updated_at:Date.now()/1000,assets:[]} satisfies ResourceCollectionDTO;
  }).then(value=>{
    records.set(slug,value);refreshed.set(slug,Date.now());
    try{localStorage.setItem(key(slug),JSON.stringify(value))}catch{/* Cache is optional. */}
    listeners.forEach(listener=>listener());return value;
  }).finally(()=>pending.delete(slug));
  pending.set(slug,task);return task;
}
export function useResourceCollection(slug:string, enabled=true) {
  const value=useSyncExternalStore(subscribe,()=>enabled?snapshot(slug):null,()=>null);
  useEffect(()=>{if(enabled)void loadResourceCollection(slug).catch(()=>undefined)},[slug,enabled]);
  return value;
}
