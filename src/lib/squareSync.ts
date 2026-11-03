import {updateTabCaches} from './tabCache.ts';
import type {SquareStatementDTO} from '../types';

export type SquarePatch=Pick<SquareStatementDTO,'statement_id'> & Partial<SquareStatementDTO>;
export interface SquareSyncResult {items:SquarePatch[];removed_ids:number[]}
export const SQUARE_SYNC_EVENT='frienden:square-sync';
export const SQUARE_SYNC_STORAGE='frienden:square-sync';
export const SQUARE_DIRTY_EVENT='frienden:square-dirty';
export interface SquareSyncChange extends SquareSyncResult {scope:string}
const revisions=new Map<string,number>();
const removed=new Map<string,Map<number,number>>();
const recentPatches=new Map<string,Map<number,{revision:number;patch:SquarePatch}>>();
export const squareSyncRevision=(scope:string)=>revisions.get(scope)??0;
export function filterSquareRemoved<T extends {statement_id:number}>(scope:string|null,items:T[]):T[]{return scope?items.filter(item=>!removed.get(scope)?.has(item.statement_id)):items}

export function reconcileSquareItems<T extends {statement_id:number}>(items:T[],change:SquareSyncResult):T[]{
  const missing=new Set(change.removed_ids),patches=new Map(change.items.map(item=>[item.statement_id,item]));
  const next=items.filter(item=>!missing.has(item.statement_id)).map(item=>{
    const patch=patches.get(item.statement_id);
    return patch&&Object.entries(patch).some(([key,value])=>item[key as keyof T]!==value)?{...item,...patch}:item;
  });
  return next.length===items.length&&next.every((item,index)=>item===items[index])?items:next;
}

export function applySquareSync(scope:string,result:SquareSyncResult,broadcast=true){
  revisions.set(scope,squareSyncRevision(scope)+1);
  const patches=recentPatches.get(scope)??new Map<number,{revision:number;patch:SquarePatch}>();
  result.items.forEach(item=>patches.set(item.statement_id,{revision:squareSyncRevision(scope),patch:{...patches.get(item.statement_id)?.patch,...item}}));
  result.removed_ids.forEach(id=>patches.delete(id));
  recentPatches.set(scope,patches);
  const tombstones=removed.get(scope)??new Map<number,number>();
  result.items.forEach(item=>tombstones.delete(item.statement_id));
  result.removed_ids.forEach(id=>tombstones.set(id,squareSyncRevision(scope)));
  removed.set(scope,tombstones);
  const change={scope,items:result.items.filter(item=>!tombstones.has(item.statement_id)),removed_ids:[...tombstones.keys()]};
  updateTabCaches(scope,(tab,data)=>{
    if(!tab.startsWith('square:')||!data||typeof data!=='object'||!('items' in data)||!Array.isArray(data.items))return data;
    if(!data.items.every(item=>item&&typeof item.statement_id==='number'))return data;
    const items=reconcileSquareItems(data.items,change);
    return items===data.items?data:{...data,items};
  });
  if(typeof window!=='undefined'){
    window.dispatchEvent(new CustomEvent(SQUARE_SYNC_EVENT,{detail:change}));
    if(broadcast)try{window.localStorage.setItem(SQUARE_SYNC_STORAGE,JSON.stringify({...change,nonce:Date.now()}))}catch{/* Best effort. */}
  }
}

// Successful writes update every feed, including callers outside SquarePage.
export function rememberSquareResponse<T>(scope:string|null,path:string,method:string,data:T,revision:number):T{
  if(!scope||!path.startsWith('/square/'))return data;
  const id=Number(path.match(/^\/square\/statements\/(\d+)/)?.[1]);
  if(method==='DELETE'&&/^\/square\/statements\/\d+$/.test(path))applySquareSync(scope,{items:[],removed_ids:[id]});
  else if(method!=='GET'&&path.endsWith('/like')&&id&&data&&typeof data==='object')applySquareSync(scope,{items:[{statement_id:id,...data}],removed_ids:[]});
  else if(method!=='GET'&&path.endsWith('/pin')&&data&&typeof data==='object'){
    const statement=data as unknown as SquarePatch;
    const unpinned:SquarePatch[]=[];
    updateTabCaches(scope,(tab,cached)=>{
      if(!tab.startsWith('square:')||!cached||typeof cached!=='object'||!('items' in cached)||!Array.isArray(cached.items))return cached;
      for(const item of cached.items)if(item.is_pinned&&item.user?.user_id===statement.user?.user_id&&item.statement_id!==id)unpinned.push({statement_id:item.statement_id,is_pinned:false});
      return cached;
    });
    applySquareSync(scope,{items:[...unpinned,statement],removed_ids:[]});
  }
  // A response started before a local deletion must never resurrect that post.
  if(method==='GET'&&Array.isArray(data)&&path==='/square/statements'){
    for(const item of data){const deletedAt=removed.get(scope)?.get(item.statement_id);if(deletedAt!==undefined&&revision>=deletedAt)removed.get(scope)?.delete(item.statement_id)}
    return filterSquareRemoved(scope,data).map(item=>{
      const fresh=recentPatches.get(scope)?.get(item.statement_id);
      return fresh&&fresh.revision>revision?{...item,...fresh.patch}:item;
    }) as T;
  }
  if(method==='GET'&&/^\/square\/statements\/\d+$/.test(path)&&data&&typeof data==='object'){
    const fresh=recentPatches.get(scope)?.get(id);
    const statement=fresh&&fresh.revision>revision?{...data,...fresh.patch}:data;
    if(revision===squareSyncRevision(scope))applySquareSync(scope,{items:[statement as unknown as SquarePatch],removed_ids:[]});
    return statement as T;
  }
  if(method!=='GET'&&!path.endsWith('/sync')&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent(SQUARE_DIRTY_EVENT,{detail:{scope}}));
  return data;
}
