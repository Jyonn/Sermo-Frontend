import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useI18n, type TranslationKey } from '../lib/language';
export function TablePicker({anchor,onClose,onSelect}:{anchor:RefObject<HTMLButtonElement|null>;onClose:()=>void;onSelect:(x:number,y:number)=>void}) {
  const {t:translate}=useI18n();
  const t=(key:string)=>translate(('research.md.'+key) as TranslationKey);
  const panel=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState([1,1]);
  const [position,setPosition]=useState({left:12,top:12});
  useLayoutEffect(()=>{
    const place=()=>{const rect=anchor.current?.getBoundingClientRect(),box=panel.current?.getBoundingClientRect();if(rect&&box)setPosition({left:Math.max(12,Math.min(innerWidth-box.width-12,rect.right-box.width)),top:Math.max(12,Math.min(innerHeight-box.height-12,rect.bottom+8))});};
    const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!anchor.current?.contains(e.target as Node))onClose();};
    place();panel.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);};
  },[anchor,onClose]);
  return createPortal(<div ref={panel} className="v3-table-picker" role="dialog" aria-label={t('mdTable')} style={position} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();anchor.current?.focus();}}}>
    <div className="v3-table-picker-title"><strong>{t('mdTable')}</strong><output aria-live="polite">{size[0]} × {size[1]}</output></div>
    <div className="v3-table-grid">{Array.from({length:100},(_,i)=>{const x=i%10+1,y=Math.floor(i/10)+1;return <button type="button" key={i} aria-label={`${x} × ${y}`} className={x<=size[0]&&y<=size[1]?'active':''} onPointerEnter={()=>setSize([x,y])} onFocus={()=>setSize([x,y])} onClick={()=>onSelect(x,y)} onKeyDown={e=>{const delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:10,ArrowUp:-10}[e.key];if(delta){e.preventDefault();panel.current?.querySelectorAll<HTMLButtonElement>('.v3-table-grid button')[Math.max(0,Math.min(99,i+delta))]?.focus();}}}/>;})}</div>
    <small>{t('tableHint')}</small>
  </div>,document.body);
}
