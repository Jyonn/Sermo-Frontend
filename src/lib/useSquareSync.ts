import {useEffect,useRef} from 'react';
import {api} from './api';
import {applySquareSync,SQUARE_SYNC_EVENT,SQUARE_SYNC_STORAGE,SQUARE_DIRTY_EVENT,squareSyncRevision,type SquareSyncChange} from './squareSync';
import type {SquareStatementDTO} from '../types';

export function useSquareSync(scope:string|null,feedKey:string,items:SquareStatementDTO[],pinned:SquareStatementDTO|null,activeId:number|null,onChange:(change:SquareSyncChange)=>void){
  const latest=useRef({items,pinned,activeId,onChange});latest.current={items,pinned,activeId,onChange};
  useEffect(()=>{
    if(!scope)return;
    let stopped=false,busy=false,cursor=0;
    const controller=new AbortController();
    const sync=async()=>{
      if(stopped||busy||document.visibilityState==='hidden')return;
      const priority=[...new Set([latest.current.activeId,latest.current.pinned?.statement_id].filter((id):id is number=>typeof id==='number'))];
      const ids=[...new Set(latest.current.items.map(item=>item.statement_id))].filter(id=>!priority.includes(id));
      if(!ids.length&&!priority.length)return;
      if(cursor>=ids.length)cursor=0;
      const page=ids.slice(cursor,cursor+100-priority.length);
      const batch=[...priority,...page];cursor=ids.length?(cursor+page.length)%ids.length:0;
      const revision=squareSyncRevision(scope);busy=true;
      const requestController=new AbortController();
      const abort=()=>requestController.abort();
      controller.signal.addEventListener('abort',abort,{once:true});
      const timeout=window.setTimeout(abort,10000);
      try{
        const result=await api.syncSquareStatements(batch,requestController.signal);
        // Concurrent successful local writes take priority over older snapshots.
        if(!stopped&&revision===squareSyncRevision(scope))applySquareSync(scope,result);
      }catch{/* Offline/error responses never imply deletion. */}finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);busy=false}
    };
    const receive=(event:Event)=>{const change=(event as CustomEvent<SquareSyncChange>).detail;if(change.scope===scope)latest.current.onChange(change)};
    const storage=(event:StorageEvent)=>{
      if(event.key!==SQUARE_SYNC_STORAGE||!event.newValue)return;
      try{const change=JSON.parse(event.newValue) as SquareSyncChange;if(change.scope===scope&&Array.isArray(change.items)&&Array.isArray(change.removed_ids))applySquareSync(scope,change,false)}catch{/* Ignore malformed external storage. */}
    };
    const resume=()=>{cursor=0;void sync()};
    let dirtyTimer:number|undefined;
    const dirty=(event:Event)=>{if((event as CustomEvent).detail.scope!==scope)return;clearTimeout(dirtyTimer);dirtyTimer=window.setTimeout(resume,300)};
    window.addEventListener(SQUARE_DIRTY_EVENT,dirty);
    window.addEventListener(SQUARE_SYNC_EVENT,receive);
    window.addEventListener('storage',storage);
    window.addEventListener('focus',resume);
    document.addEventListener('visibilitychange',resume);
    // Allow cache hydration/initial list response to settle before the first check.
    const initial=window.setTimeout(()=>void sync(),800);
    const timer=window.setInterval(()=>void sync(),15000);
    return()=>{stopped=true;controller.abort();clearTimeout(initial);clearTimeout(dirtyTimer);clearInterval(timer);window.removeEventListener(SQUARE_DIRTY_EVENT,dirty);window.removeEventListener(SQUARE_SYNC_EVENT,receive);window.removeEventListener('storage',storage);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)};
  },[scope,feedKey]);
}
