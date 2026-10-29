import {useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {nextOverlayLevel} from './overlayOrder';

const surfaces='.drawer-backdrop,.sheet-backdrop,.dialog-backdrop,.detached-drawer-slot,.pattern-backdrop,.tour-layer,[data-overlay-layer]';
let serial=0;

function layerSurface(root:HTMLElement){
  const known=root.closest<HTMLElement>(surfaces);
  if(known)return known;
  let node=root;
  for(let ancestor:HTMLElement|null=root;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){
    if(getComputedStyle(ancestor).position==='fixed')node=ancestor;
  }
  return node;
}

export function useOverlayLayer(root:RefObject<HTMLElement|null>,open:boolean,scope?:unknown){
  const [level,setLevel]=useState(0);
  const allocation=useRef<number>();
  useLayoutEffect(()=>{
    if(!open){allocation.current=undefined;return;}
    if(!root.current)return;
    const node=layerSurface(root.current);
    const candidates=new Set(Array.from(document.querySelectorAll<HTMLElement>(surfaces+',[role="dialog"],[role="alertdialog"]')).map(layerSurface));
    const visible=Array.from(candidates).filter(other=>other!==node&&!node.contains(other)&&!other.closest('[hidden],[aria-hidden="true"]')&&other.getClientRects().length>0&&getComputedStyle(other).visibility!=='hidden');
    const index=nextOverlayLevel(Number.parseInt(getComputedStyle(node).zIndex)||0,visible.map(other=>Number.parseInt(getComputedStyle(other).zIndex)||0),allocation.current);
    // Changing the desktop portal host is not a new opening: keep children above it.
    allocation.current=index;
    const previous=node.style.getPropertyValue('z-index');
    const previousLayer=node.dataset.overlayLayer,previousOwner=node.dataset.overlayOwner;
    const owner=String(++serial);
    node.style.setProperty('z-index',String(index));
    node.dataset.overlayLayer=String(index);
    node.dataset.overlayOwner=owner;
    setLevel(index);
    return()=>{
      // Another nested drawer may already own this shared desktop slot.
      if(node.dataset.overlayOwner!==owner)return;
      if(previousLayer===undefined)delete node.dataset.overlayLayer;else node.dataset.overlayLayer=previousLayer;
      if(previousOwner===undefined)delete node.dataset.overlayOwner;else node.dataset.overlayOwner=previousOwner;
      if(previous)node.style.setProperty('z-index',previous);else node.style.removeProperty('z-index');
    };
  },[open,root,scope]);
  return level;
}
