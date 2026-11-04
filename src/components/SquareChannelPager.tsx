import {useLayoutEffect,useRef,type CSSProperties,type ReactNode} from 'react';
import {useSquareChannelSwipe} from '../lib/useSquareChannelSwipe';
import type {SquareChannel} from '../lib/squareSwipe';
import './SquareChannelPager.css';

export function SquareChannelPager({channels,current,enabled,onSelect,children}:{channels:SquareChannel[];current:SquareChannel;enabled:boolean;onSelect:(channel:SquareChannel)=>void;children:ReactNode}){
  const root=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null);
  const index=Math.max(0,channels.indexOf(current));
  const drag=(offset:number,dragging:boolean)=>{
    const node=track.current;if(!node)return;
    node.dataset.dragging=String(dragging);
    node.style.setProperty('--square-drag',`${offset}px`);
  };
  useSquareChannelSwipe(root,channels,current,onSelect,enabled,drag);
  useLayoutEffect(()=>{drag(0,false)},[current,channels.join('|'),enabled]);
  return <div className="square-channel-viewport" ref={root}><div className="square-channel-track" ref={track} style={{'--square-channel-index':index} as CSSProperties}>{children}</div></div>;
}
