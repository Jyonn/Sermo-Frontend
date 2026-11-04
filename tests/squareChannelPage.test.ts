import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {normalizeSquareFeedSnapshot,mergeSquareFeedRefresh} from '../src/lib/squareFeedCache.ts';
import {reconcileSquareItems} from '../src/lib/squareSync.ts';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/components/SquareChannelPage.tsx',import.meta.url),'utf8');
const translate=(key:string)=>key;
function mount(cache:Map<string,any>,activeRoot:any,requests:any[]){
  const slots:any[]=[],pending:Array<()=>void>=[],events=new EventTarget();let cursor=0,view:any;
  const element={scrollTop:0,attributes:new Set(),toggleAttribute(key:string,on:boolean){if(on)this.attributes.add(key);else this.attributes.delete(key)},querySelectorAll:()=>[],contains:()=>false};
  const effect=(callback:()=>void|(()=>void),deps:any[])=>{const index=cursor++,old=slots[index];if(!old||deps.some((dep,i)=>!Object.is(dep,old.deps[i]))){pending.push(()=>{old?.cleanup?.();slots[index]={deps,cleanup:callback()}})}};
  const react={useRef:(value:any)=>{const index=cursor++;return slots[index]??(slots[index]={current:value})},useState:(value:any)=>{const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],(next:any)=>{slots[index]=typeof next==='function'?next(slots[index]):next}]},useLayoutEffect:effect,useEffect:effect};
  const exports:any={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,AbortController,setTimeout,clearTimeout,document:{activeElement:null},window:events,require:(id:string)=>id==='react'?react:id==='../lib/api'?{api:{getSquareStatements:(params:any)=>{requests.push(params);return Promise.resolve([{statement_id:params.scope==='mine'?2:1}])}}}:id==='../lib/language'?{useI18n:()=>({t:translate})}:id==='../lib/tabCache'?{readTabCache:(_scope:string,key:string)=>cache.has(key)?{data:cache.get(key)}:null,writeTabCache:(_scope:string,key:string,value:any)=>cache.set(key,value)}:id==='../lib/squareFeedCache'?{normalizeSquareFeedSnapshot,mergeSquareFeedRefresh}:id==='../lib/squareSync'?{reconcileSquareItems,filterSquareRemoved:(_scope:string,items:any[])=>items,SQUARE_SYNC_EVENT:'sync'}:id==='../lib/useSquareFeedLayout'?{useSquareFeedLayout:()=>['list']}:require(id),
  });
  const render=(patch:any={})=>{
    cursor=0;const props={mode:'friends',cacheKey:'square:friends',scope:'1:1',active:false,preload:false,activeRoot,activeState:null,settled:true,params:{scope:'friends'},onScroll(){},children:(next:any)=>{view=next;return null},...patch};
    const tree=exports.SquareChannelPage(props);tree.ref.current=element;
    while(pending.length)pending.shift()!();return tree;
  };
  return {render,element,events,get view(){return view}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('independent channel pages retain their own data, DOM reference and scroll position',()=>{
  const cache=new Map<string,any>(),root={current:null},requests:any[]=[];
  const friends=mount(cache,root,requests),mine=mount(cache,root,requests);
  const first=friends.render({active:true,activeState:{items:[{statement_id:11}],loading:false,hasMore:true,error:'',loadingMore:false}});
  friends.element.scrollTop=385;first.props.onScroll({currentTarget:friends.element});
  friends.render();
  mine.render({mode:'mine',cacheKey:'square:mine',params:{scope:'mine'},active:true,activeState:{items:[{statement_id:22}],loading:false,hasMore:false,error:'',loadingMore:false}});
  mine.element.scrollTop=74;
  friends.render({active:true});
  assert.equal(root.current,friends.element);assert.equal(friends.element.scrollTop,385);
  assert.equal(friends.view.items[0].statement_id,11);assert.equal(mine.element.scrollTop,74);
  assert.equal(first.ref.current,friends.element);
});
test('only adjacent pages preload a first page and synchronization removes cached posts',async()=>{
  const cache=new Map<string,any>(),requests:any[]=[],page=mount(cache,{current:null},requests);
  page.render();assert.equal(requests.length,0);
  page.render({preload:true});await tick();page.render({preload:true});
  assert.equal(requests.length,1);assert.equal(requests[0].limit,20);assert.equal(requests[0].before,undefined);
  assert.equal(page.view.items[0].statement_id,1);
  page.events.dispatchEvent(new CustomEvent('sync',{detail:{scope:'1:1',items:[],removed_ids:[1]}}));
  page.render({preload:true});assert.equal(page.view.items.length,0);
  assert.equal(page.element.attributes.has('inert'),true);
});
