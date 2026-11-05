import {createContext,useContext,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import {nextOverlayLevel,orderOverlayEntries} from './overlayOrder';

const surfaces='.drawer-backdrop,.sheet-backdrop,.dialog-backdrop,.desktop-panel-slot,.pattern-backdrop,.tour-layer,[data-overlay-layer]';
const Ancestry=createContext<readonly RefObject<HTMLElement|null>[]>([]);
let serial=0,queued=false;
type Entry={root:RefObject<HTMLElement|null>;parents:readonly RefObject<HTMLElement|null>[];node:HTMLElement;base:number;order:number;owner:string;update:(level:number)=>void};
const entries=new Map<object,Entry>();

export function OverlayScope({root,children}:{root:RefObject<HTMLElement|null>;children:ReactNode}){
  const parents=useContext(Ancestry);
  const value=useMemo(()=>[...parents,root],[parents,root]);
  return <Ancestry.Provider value={value}>{children}</Ancestry.Provider>;
}

function layerSurface(root:HTMLElement){
  const known=root.closest<HTMLElement>(surfaces);
  if(known)return known;
  let node=root;
  for(let ancestor:HTMLElement|null=root;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){
    if(getComputedStyle(ancestor).position==='fixed')node=ancestor;
  }
  return node;
}

function schedule(){
  if(queued)return;
  queued=true;
  // All portal refs and layout effects settle before assigning the complete stack.
  queueMicrotask(()=>{
    queued=false;
    const active=Array.from(entries.values()).filter(entry=>entry.node.isConnected);
    const managed=new Set(active.map(entry=>entry.node));
    const external=Array.from(new Set(Array.from(document.querySelectorAll<HTMLElement>(surfaces+',[role="dialog"],[role="alertdialog"]')).map(layerSurface)))
      .filter(node=>!managed.has(node)&&!node.closest('[hidden],[aria-hidden="true"]')&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden')
      .map(node=>Number.parseInt(getComputedStyle(node).zIndex)||0);
    let previous=0;
    for(const entry of orderOverlayEntries(active)){
      const index=nextOverlayLevel(entry.base,[previous,...external]);
      entry.node.style.setProperty('z-index',String(index));
      entry.node.dataset.overlayLayer=String(index);
      entry.node.dataset.overlayOwner=entry.owner;
      entry.update(index);
      previous=index;
    }
  });
}

export function useOverlayLayer(root:RefObject<HTMLElement|null>,open:boolean,scope?:unknown){
  const parents=useContext(Ancestry);
  const [level,setLevel]=useState(0);
  const allocation=useRef<number>();
  useLayoutEffect(()=>{
    if(!open){allocation.current=undefined;return;}
    if(!root.current)return;
    const node=layerSurface(root.current);
    const previous=node.style.getPropertyValue('z-index');
    const previousLayer=node.dataset.overlayLayer,previousOwner=node.dataset.overlayOwner;
    const owner=String(++serial);
    allocation.current??=serial;
    const entry:Entry={root,parents,node,base:Number.parseInt(getComputedStyle(node).zIndex)||0,order:allocation.current,owner,update:setLevel};
    entries.set(root,entry);
    schedule();
    return()=>{
      if(entries.get(root)===entry)entries.delete(root);
      schedule();
      // Another nested drawer may already own this shared desktop slot.
      if(node.dataset.overlayOwner!==owner)return;
      if(previousLayer===undefined)delete node.dataset.overlayLayer;else node.dataset.overlayLayer=previousLayer;
      if(previousOwner===undefined)delete node.dataset.overlayOwner;else node.dataset.overlayOwner=previousOwner;
      if(previous)node.style.setProperty('z-index',previous);else node.style.removeProperty('z-index');
    };
  },[open,root,scope,parents]);
  return level;
}
