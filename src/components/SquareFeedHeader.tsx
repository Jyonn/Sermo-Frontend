import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {useI18n} from '../lib/language';
import './SquareFeedHeader.css';

export function SquareFeedHeader({children,search,publish,syncing,activeKey}:{children:ReactNode;search:ReactNode;publish?:()=>void;syncing:boolean;activeKey:string}){
  const {t}=useI18n();
  const root=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{const scroll=root.current?.querySelector<HTMLElement>('.square-workspace-tabs'),selected=scroll?.querySelector<HTMLElement>('[aria-selected="true"]');if(!scroll||!selected)return;const reveal=()=>{const parent=scroll.getBoundingClientRect(),edge=parent.width/12,child=(selected.closest<HTMLElement>('.square-feed-user-tab')??selected).getBoundingClientRect();const delta=child.left<parent.left+edge?child.left-parent.left-edge:child.right>parent.right-edge?child.right-parent.right+edge:0;if(delta)scroll.scrollTo({left:scroll.scrollLeft+delta,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};reveal();const observer=new ResizeObserver(reveal);observer.observe(scroll);return()=>observer.disconnect()},[activeKey]);
  return <header ref={root} className="square-feed-header" aria-busy={syncing}>
    <div className="square-feed-header-side">{search}</div>
    <nav className="square-feed-header-channels" aria-label={t('square.title')}>{children}</nav>
    <div className="square-feed-header-side">{publish?<button className="square-feed-publish" aria-label={t('square.publish')} title={t('square.publish')} onClick={publish} type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 5.5 18.5 10.5M4 20l5-1 11-11a3.54 3.54 0 0 0-5-5L4 14zM4 20h16"/></svg></button>:null}</div>
  </header>;
}
