import {useEffect,useRef,type RefObject} from 'react';
import {adjacentSquareChannel,squareSwipeDirection,type SquareChannel} from './squareSwipe';

export function useSquareChannelSwipe(root:RefObject<HTMLElement|null>,channels:SquareChannel[],current:SquareChannel,onSelect:(channel:SquareChannel)=>void,enabled:boolean,onDrag?:(offset:number,dragging:boolean)=>void){
  const latest=useRef({channels,current,onSelect,enabled,onDrag});latest.current={channels,current,onSelect,enabled,onDrag};
  useEffect(()=>{
    const node=root.current;if(!node)return;
    let gesture:{x:number;y:number;time:number;id:number;axis:'x'|'y'|null}|null=null,suppressClickUntil=0;
    const excluded=(target:EventTarget|null)=>{
      if(!(target instanceof Element)||target.closest('.square-feed-header,input,textarea,select,a,audio,video,[contenteditable="true"],[role="slider"],[data-swipe-ignore],.square-note-music,.square-note-voice,.square-statement-audio'))return true;
      for(let el:Element|null=target;el&&el!==node;el=el.parentElement){const style=getComputedStyle(el);if(el.scrollWidth>el.clientWidth+1&&/auto|scroll/.test(style.overflowX))return true}
      return false;
    };
    const start=(event:TouchEvent)=>{
      latest.current.onDrag?.(0,false);gesture=null;if(!latest.current.enabled||event.touches.length!==1||excluded(event.target))return;
      const touch=event.touches[0];if(touch.clientX<24||touch.clientX>window.innerWidth-24)return;
      gesture={x:touch.clientX,y:touch.clientY,time:Date.now(),id:touch.identifier,axis:null};
    };
    const move=(event:TouchEvent)=>{
      if(!gesture)return;if(event.touches.length!==1){gesture=null;latest.current.onDrag?.(0,false);return}
      const touch=event.touches[0];if(touch.identifier!==gesture.id){gesture=null;latest.current.onDrag?.(0,false);return}
      const dx=Math.abs(touch.clientX-gesture.x),dy=Math.abs(touch.clientY-gesture.y);
      if(!gesture.axis&&Math.max(dx,dy)>=12){if(dy>dx)gesture.axis='y';else if(dx>dy*1.5)gesture.axis='x'}
      if(gesture.axis==='x'){if(event.cancelable)event.preventDefault();suppressClickUntil=Date.now()+500;const offset=touch.clientX-gesture.x;const neighbor=adjacentSquareChannel(latest.current.channels,latest.current.current,offset<0?1:-1);latest.current.onDrag?.(Math.max(-node.clientWidth,Math.min(node.clientWidth,offset))*(neighbor?1:.2),true)}
    };
    const end=(event:TouchEvent)=>{
      const start=gesture;gesture=null;latest.current.onDrag?.(0,false);if(!start||start.axis==='y'||!latest.current.enabled)return;
      const touch=Array.from(event.changedTouches).find(item=>item.identifier===start.id);if(!touch)return;
      const direction=squareSwipeDirection(touch.clientX-start.x,touch.clientY-start.y,Date.now()-start.time,node.clientWidth);
      if(!direction)return;suppressClickUntil=Date.now()+500;
      const next=adjacentSquareChannel(latest.current.channels,latest.current.current,direction);if(next)latest.current.onSelect(next);
    };
    const cancel=()=>{gesture=null;latest.current.onDrag?.(0,false)};
    const click=(event:MouseEvent)=>{if(Date.now()<suppressClickUntil&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation()}};
    node.addEventListener('touchstart',start,{passive:true});node.addEventListener('touchmove',move,{passive:false});node.addEventListener('touchend',end,{passive:true});node.addEventListener('touchcancel',cancel,{passive:true});node.addEventListener('click',click,true);
    return()=>{node.removeEventListener('touchstart',start);node.removeEventListener('touchmove',move);node.removeEventListener('touchend',end);node.removeEventListener('touchcancel',cancel);node.removeEventListener('click',click,true)};
  },[root]);
}
