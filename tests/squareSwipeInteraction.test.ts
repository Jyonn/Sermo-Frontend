import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {adjacentSquareChannel,squareSwipeDirection} from '../src/lib/squareSwipe.ts';

function harness(current='friends'){
  let time=0,cleanup=()=>{};const listeners=new Map<string,Function>(),selected:string[]=[],drag:Array<[number,boolean]>=[];
  class Target{parentElement:any=null;scrollWidth=100;clientWidth=100;overflowX='visible';blocked=false;closest(){return this.blocked?this:null}}
  const root={clientWidth:390,addEventListener:(key:string,fn:Function)=>listeners.set(key,fn),removeEventListener:(key:string)=>listeners.delete(key)};
  const target=new Target();target.parentElement=root;
  const exports:any={};
  const source=readFileSync(new URL('../src/lib/useSquareChannelSwipe.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,require:(key:string)=>key==='react'?{useRef:(value:any)=>({current:value}),useEffect:(effect:Function)=>{cleanup=effect()}}:{adjacentSquareChannel,squareSwipeDirection},
    Element:Target,window:{innerWidth:390},Date:{now:()=>time},getComputedStyle:(el:Target)=>({overflowX:el.overflowX}),
  });
  exports.useSquareChannelSwipe({current:root},['activities','all','friends','mine'],current,(channel:string)=>selected.push(channel),true,(offset:number,dragging:boolean)=>drag.push([offset,dragging]));
  const event=(x:number,y:number,count=1)=>({target,touches:Array.from({length:count},(_,identifier)=>({clientX:x,clientY:y,identifier})),changedTouches:[{clientX:x,clientY:y,identifier:0}],cancelable:true,preventDefault(){this.prevented=true},prevented:false});
  return {target,selected,listeners,drag,cleanup:()=>cleanup(),start:(x=200,y=100)=>{time=0;listeners.get('touchstart')!(event(x,y))},move:(x:number,y:number,count=1)=>{time=100;const e=event(x,y,count);listeners.get('touchmove')!(e);return e.prevented},end:(x:number,y:number)=>{time=300;listeners.get('touchend')!(event(x,y))},click:()=>{let blocked=false;listeners.get('click')!({detail:1,preventDefault:()=>{blocked=true},stopImmediatePropagation:()=>{}});return blocked}};
}
test('neighbor pages follow the finger before selection and return on cancellation',()=>{
  const h=harness();h.start();h.move(130,102);
  assert.deepEqual(h.drag.at(-1),[-70,true]);assert.deepEqual(h.selected,[]);
  h.listeners.get('touchcancel')!();assert.deepEqual(h.drag.at(-1),[0,false]);
});
test('the first page resists dragging past the edge without wrapping',()=>{
  const h=harness('activities');h.start();h.move(300,100);
  assert.deepEqual(h.drag.at(-1),[20,true]);h.end(300,100);assert.deepEqual(h.selected,[]);
});
test('horizontal feed swipe switches once and suppresses the accidental post click',()=>{
  const h=harness();h.start();assert.equal(h.move(100,110),true);h.end(100,110);
  assert.deepEqual(h.selected,['mine']);assert.equal(h.click(),true);
  h.cleanup();assert.equal(h.listeners.size,0);
});
test('vertical browsing retains native scrolling and ordinary clicks',()=>{
  const h=harness();h.start();assert.equal(h.move(210,220),false);h.end(210,220);
  assert.deepEqual(h.selected,[]);assert.equal(h.click(),false);
});
test('nested horizontal scrollers and media controls own their gestures',()=>{
  for(const media of [false,true]){const h=harness();h.target.blocked=media;
    if(!media){h.target.scrollWidth=400;h.target.overflowX='auto'}
    h.start();assert.equal(h.move(100,100),false);h.end(100,100);assert.deepEqual(h.selected,[]);
  }
});
test('system edge gestures and multi-touch do not change channels',()=>{
  const edge=harness();edge.start(10,100);edge.move(180,100);edge.end(180,100);assert.deepEqual(edge.selected,[]);
  const pinch=harness();pinch.start();pinch.move(100,100,2);pinch.end(100,100);assert.deepEqual(pinch.selected,[]);
});
