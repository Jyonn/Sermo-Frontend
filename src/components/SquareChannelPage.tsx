import {useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject,type MutableRefObject,type UIEvent} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {readTabCache,writeTabCache} from '../lib/tabCache';
import {mergeSquareFeedRefresh,normalizeSquareFeedSnapshot,type SquareFeedSnapshot} from '../lib/squareFeedCache';
import {reconcileSquareItems,filterSquareRemoved,SQUARE_SYNC_EVENT,type SquareSyncChange} from '../lib/squareSync';
import {useSquareFeedLayout} from '../lib/useSquareFeedLayout';
import type {SquareChannel} from '../lib/squareSwipe';
import type {SquareStatementDTO} from '../types';

export interface SquareChannelState {items:SquareStatementDTO[];loading:boolean;hasMore:boolean;loadingMore:boolean;error:string}
export interface SquareChannelView extends SquareChannelState {scrollRef:RefObject<HTMLElement|null>;active:boolean;mode:SquareChannel;layout:'list'|'masonry'}
export function SquareChannelPage({mode,label,cacheKey,scope,active,preload,activeRoot,activeState,settled,params,onScroll,children,rememberScroll=true}:{mode:SquareChannel;label:string;cacheKey:string;scope:string|null;active:boolean;preload:boolean;activeRoot:MutableRefObject<HTMLElement|null>;activeState:SquareChannelState|null;settled:boolean;params:Parameters<typeof api.getSquareStatements>[0];onScroll:(event:UIEvent<HTMLElement>)=>void;children:(view:SquareChannelView)=>ReactNode;rememberScroll?:boolean}){
  const {t}=useI18n(),root=useRef<HTMLElement|null>(null),checked=useRef(new Set<string>());
  const hydrate=():SquareChannelState=>{
    const saved=normalizeSquareFeedSnapshot(readTabCache<SquareFeedSnapshot<SquareStatementDTO>>(scope,cacheKey)?.data);
    return {items:filterSquareRemoved(scope,saved?.trusted?saved.items:[]),loading:!saved?.trusted,hasMore:saved?.hasMore??true,loadingMore:false,error:''};
  };
  const [saved,setSaved]=useState(()=>({key:cacheKey,state:hydrate()}));
  const state=active&&activeState?activeState:saved.key===cacheKey?saved.state:hydrate();
  const [layout]=useSquareFeedLayout(scope,mode==='all'?'explore':mode==='friends'?'friends':'user');
  const scrollPositions=useRef(new Map<string,number>()),scrollTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useLayoutEffect(()=>{
    const top=readTabCache<number>(scope,`${cacheKey}:scroll`)?.data??0;
    scrollPositions.current.set(cacheKey,top);
    if(root.current)root.current.scrollTop=top;
    setSaved({key:cacheKey,state:hydrate()});
  },[cacheKey,scope]);
  useLayoutEffect(()=>{
    root.current?.toggleAttribute('inert',!active);
    if(active&&root.current){activeRoot.current=root.current;onScroll({currentTarget:root.current} as UIEvent<HTMLElement>)}
    else if(root.current){root.current.querySelectorAll<HTMLMediaElement>('audio,video').forEach(media=>media.pause());if(root.current.contains(document.activeElement))(document.activeElement as HTMLElement)?.blur()}
  },[active,activeRoot]);
  useLayoutEffect(()=>{
    if(!active||!activeState)return;
    setSaved({key:cacheKey,state:activeState});
    if(settled)checked.current.add(cacheKey);
  },[active,activeState,cacheKey,settled]);
  useEffect(()=>()=>{
    if(scrollTimer.current!==null){clearTimeout(scrollTimer.current);scrollTimer.current=null}
    const top=scrollPositions.current.get(cacheKey);if(top!==undefined)writeTabCache(scope,`${cacheKey}:scroll`,top);
  },[scope,cacheKey]);
  useEffect(()=>{
    if(mode==='activities'||active||!preload||checked.current.has(cacheKey))return;
    const controller=new AbortController();
    void api.getSquareStatements({...params,limit:20},controller.signal).then(rows=>{
      if(controller.signal.aborted)return;
      const old=normalizeSquareFeedSnapshot(readTabCache<SquareFeedSnapshot<SquareStatementDTO>>(scope,cacheKey)?.data);
      const next=mergeSquareFeedRefresh(filterSquareRemoved(scope,old?.trusted?old.items:[]),rows);
      const hasMore=next.connected&&old?old.hasMore||rows.length===20:rows.length===20;
      const state={items:next.items,hasMore,loading:false,loadingMore:false,error:''};
      setSaved({key:cacheKey,state});checked.current.add(cacheKey);
      writeTabCache(scope,cacheKey,{version:2,items:next.items,hasMore});
    }).catch(cause=>{if(!controller.signal.aborted)setSaved(current=>({key:cacheKey,state:{...current.state,loading:false,error:cause instanceof Error?cause.message:t('square.loadFailed')}}))});
    return()=>controller.abort();
  },[mode,cacheKey,scope,active,preload,t]);
  useEffect(()=>{
    const sync=(event:Event)=>{const change=(event as CustomEvent<SquareSyncChange>).detail;if(change.scope===scope)setSaved(current=>{const items=reconcileSquareItems(current.state.items,change);return items===current.state.items?current:{...current,state:{...current.state,items}}})};
    window.addEventListener(SQUARE_SYNC_EVENT,sync);return()=>window.removeEventListener(SQUARE_SYNC_EVENT,sync);
  },[scope]);
  return <section ref={root} className={`square-channel-page${mode==='activities'?' is-activities':''}${layout==='masonry'?' is-masonry':''}`} role="tabpanel" aria-label={label} aria-hidden={!active} data-channel={mode} onScroll={event=>{
    if(active)onScroll(event);
    if(!rememberScroll)return;
    scrollPositions.current.set(cacheKey,event.currentTarget.scrollTop);
    if(scrollTimer.current===null)scrollTimer.current=setTimeout(()=>{scrollTimer.current=null;writeTabCache(scope,`${cacheKey}:scroll`,scrollPositions.current.get(cacheKey)??0)},200);
  }}>{children({...state,mode,active,layout,scrollRef:root})}</section>;
}
