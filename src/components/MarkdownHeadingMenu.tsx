import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export function MarkdownHeadingMenu({anchor,label,onClose,onSelect}:{
  anchor:RefObject<HTMLButtonElement|null>;label:string;onClose:()=>void;onSelect:(level:number)=>void;
}) {
  const panel=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);
  close.current=onClose;
  const [position,setPosition]=useState({left:12,top:12});
  useLayoutEffect(()=>{
    const place=()=>{
      const rect=anchor.current?.getBoundingClientRect(),box=panel.current?.getBoundingClientRect();
      if(!rect||!box)return;
      setPosition({left:Math.max(12,Math.min(innerWidth-box.width-12,rect.left)),top:Math.max(12,Math.min(innerHeight-box.height-12,rect.bottom+8))});
    };
    const outside=(event:PointerEvent)=>{
      if(!panel.current?.contains(event.target as Node)&&!anchor.current?.contains(event.target as Node))close.current();
    };
    place();
    panel.current?.querySelector('button')?.focus({preventScroll:true});
    document.addEventListener('pointerdown',outside);
    window.addEventListener('resize',place);
    window.addEventListener('scroll',place,true);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[anchor]);
  return createPortal(<div ref={panel} className="v3-heading-menu" role="menu" aria-label={label} style={position} onKeyDown={event=>{
    const buttons=Array.from(panel.current?.querySelectorAll('button')||[]);
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();anchor.current?.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?5:(index+(event.key==='ArrowDown'?1:5))%6;
      buttons[next]?.focus();
    }
  }}>{[1,2,3,4,5,6].map(level=><button type="button" role="menuitem" key={level} onClick={()=>onSelect(level)}><strong>{`H${level}`}</strong></button>)}</div>,document.body);
}
