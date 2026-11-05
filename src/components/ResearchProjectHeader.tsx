import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {useI18n} from '../lib/language';
import {HeaderIconButton} from './HeaderIconButton';

export function ResearchProjectHeader({title,onBack,onMenu,disabled=false}:{title:string;onBack:()=>void;onMenu:()=>void;disabled?:boolean}){
  const {t}=useI18n();const text=useRef<HTMLSpanElement>(null),viewport=useRef<HTMLDivElement>(null);const [overflow,setOverflow]=useState(0);
  useLayoutEffect(()=>{const measure=()=>setOverflow(Math.max(0,(text.current?.scrollWidth||0)-(viewport.current?.clientWidth||0)));const observer=new ResizeObserver(measure);if(viewport.current)observer.observe(viewport.current);measure();return()=>observer.disconnect();},[title]);
  return <header className="research-compact-header"><button type="button" className="research-back-key" onClick={onBack}><kbd><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>{t('research.title')}</kbd></button><div className={`research-header-name${overflow>0?' is-overflowing':''}`} ref={viewport} title={title} style={{'--research-title-travel':`-${overflow}px`,'--research-title-duration':`${Math.max(8,overflow/22+5)}s`} as CSSProperties}><span ref={text}>{title}</span></div><HeaderIconButton label={t('research.members')} onClick={onMenu} disabled={disabled}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></HeaderIconButton></header>;
}
